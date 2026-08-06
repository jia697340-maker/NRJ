/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'

// 定义备份模块
export type BackupModule = 'settings' | 'chats' | 'worldbooks' | 'images' | 'history'

// 备份元数据
export interface BackupMeta {
  version: string
  timestamp: number
  modules: BackupModule[]
  chatCount?: number
  worldbookCount?: number
  imageCount?: number
}

// 备份数据结构
export interface BackupData {
  meta: BackupMeta
  localStorage: Record<string, string>
  indexedDB: Record<string, Record<string, Record<string, any>>> // dbName -> storeName -> key -> value
}

const KNOWN_DBS = [
  { dbName: 'nrt-app', storeNames: ['chatEmojis', 'chatImages', 'avatars', 'worldbook-covers', 'wallpapers', 'media-thumbs'] },
  { dbName: 'app_vibe_storage', storeNames: ['keyvaluepairs'] },
  { dbName: 'app_novelai_history', storeNames: ['keyvaluepairs'] }
]

// 核心备份引擎
export function useDataBackup() {
  
  // ================= 1. 数据收集与打包 =================
  const generateBackupData = async (modules: BackupModule[]): Promise<BackupData> => {
    const data: BackupData = {
      meta: {
        version: '1.0',
        timestamp: Date.now(),
        modules,
        chatCount: 0,
        worldbookCount: 0,
        imageCount: 0
      },
      localStorage: {},
      indexedDB: {}
    }

    // 1.1 收集 LocalStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      const val = localStorage.getItem(key) || ''
      
      // 根据模块过滤
      const k = key.toLowerCase()
      let shouldInclude = false
      if (modules.includes('settings') && (k.includes('setting') || k.includes('theme') || k.includes('appearance') || k.includes('prompt') || k.includes('preset'))) {
        shouldInclude = true
      }
      if (modules.includes('chats') && (k.includes('chat') || k.includes('persona'))) {
        shouldInclude = true
        if (k === 'chats') {
          try {
            data.meta.chatCount = JSON.parse(val).length
          } catch(e) {}
        }
      }
      if (modules.includes('worldbooks') && k.includes('worldbook')) {
        shouldInclude = true
        if (k === 'worldbooks') {
          try {
            data.meta.worldbookCount = JSON.parse(val).length
          } catch(e) {}
        }
      }
      if (modules.includes('history') && (k.includes('cot') || k.includes('log') || k.includes('history'))) {
        shouldInclude = true
      }

      if (shouldInclude) {
        data.localStorage[key] = val
      }
    }

    // 1.2 收集 IndexedDB
    for (const dbInfo of KNOWN_DBS) {
      data.indexedDB[dbInfo.dbName] = {}
      for (const storeName of dbInfo.storeNames) {
        let shouldIncludeStore = false
        if (modules.includes('images') && ['chatImages', 'avatars', 'worldbook-covers', 'wallpapers', 'media-thumbs', 'chatEmojis'].includes(storeName)) {
          shouldIncludeStore = true
        }
        if (modules.includes('history') && dbInfo.dbName.includes('history')) {
          shouldIncludeStore = true
        }
        
        if (shouldIncludeStore) {
          data.indexedDB[dbInfo.dbName][storeName] = {}
          try {
            const store = localforage.createInstance({ name: dbInfo.dbName, storeName })
            await store.iterate((value: any, key: string) => {
              // Blob 需要转 Base64 才能 JSON 序列化，但本项目要求图片存 Base64，所以一般是字符串
              // 如果遇到 Blob，可以使用 FileReader 转换，这里简单处理假设已经是 Base64 或可序列化对象
              data.indexedDB[dbInfo.dbName][storeName][key] = value
              data.meta.imageCount = (data.meta.imageCount || 0) + 1
            })
          } catch (e) {
            console.warn(`无法读取 Store: ${dbInfo.dbName}/${storeName}`, e)
          }
        }
      }
    }

    return data
  }

  // ================= 2. 数据恢复与合并 =================
  const restoreBackupData = async (data: BackupData, mode: 'overwrite' | 'merge'): Promise<void> => {
    // 2.1 恢复 LocalStorage
    if (mode === 'overwrite') {
      localStorage.clear()
    }
    for (const [key, value] of Object.entries(data.localStorage)) {
      if (mode === 'merge') {
        // 简单合并策略：如果是数组类型的 JSON，尝试合并
        if ((key === 'chats' || key === 'worldbooks' || key.includes('presets')) && value.startsWith('[')) {
          try {
            const existingVal = localStorage.getItem(key) || '[]'
            const existingArr = JSON.parse(existingVal)
            const newArr = JSON.parse(value)
            if (Array.isArray(existingArr) && Array.isArray(newArr)) {
              // 假设有 id 字段，去重合并
              const map = new Map()
              existingArr.forEach(item => { if (item.id) map.set(item.id, item) })
              newArr.forEach(item => { if (item.id) map.set(item.id, item) })
              localStorage.setItem(key, JSON.stringify(Array.from(map.values())))
              continue
            }
          } catch(e) {}
        }
      }
      // 默认覆盖单个 key
      localStorage.setItem(key, value)
    }

    // 2.2 恢复 IndexedDB
    for (const [dbName, stores] of Object.entries(data.indexedDB)) {
      for (const [storeName, records] of Object.entries(stores)) {
        try {
          const store = localforage.createInstance({ name: dbName, storeName })
          if (mode === 'overwrite') {
            await store.clear()
          }
          for (const [key, value] of Object.entries(records)) {
            await store.setItem(key, value)
          }
        } catch (e) {
          console.error(`恢复 Store 失败: ${dbName}/${storeName}`, e)
        }
      }
    }
  }

  // ================= 3. 加解密 (Web Crypto API) =================
  
  // 从密码派生 AES-GCM 密钥
  const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    )
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  // 加密对象为 ArrayBuffer
  const encryptData = async (data: any, password?: string): Promise<ArrayBuffer> => {
    const jsonStr = JSON.stringify(data)
    const enc = new TextEncoder()
    const encodedData = enc.encode(jsonStr)

    if (!password) {
      return encodedData.buffer.slice(encodedData.byteOffset, encodedData.byteOffset + encodedData.byteLength)
    }

    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const key = await deriveKey(password, salt)

    const encryptedContent = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    )

    // 组装格式: salt(16) + iv(12) + encryptedContent
    const result = new Uint8Array(16 + 12 + encryptedContent.byteLength)
    result.set(salt, 0)
    result.set(iv, 16)
    result.set(new Uint8Array(encryptedContent), 28)
    return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength)
  }

  // 解密 ArrayBuffer 为对象
  const decryptData = async (buffer: ArrayBuffer, password?: string): Promise<any> => {
    if (!password) {
      const dec = new TextDecoder()
      return JSON.parse(dec.decode(buffer))
    }

    const dataArray = new Uint8Array(buffer)
    const salt = dataArray.slice(0, 16)
    const iv = dataArray.slice(16, 28)
    const encryptedContent = dataArray.slice(28)

    const key = await deriveKey(password, salt)
    
    try {
      const decryptedContent = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedContent
      )
      const dec = new TextDecoder()
      return JSON.parse(dec.decode(decryptedContent))
    } catch (e) {
      throw new Error('密码错误或文件已损坏')
    }
  }

  return {
    generateBackupData,
    restoreBackupData,
    encryptData,
    decryptData
  }
}
