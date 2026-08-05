/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, watch } from 'vue'
import localforage from 'localforage'

export interface StorageItem {
  id: string
  source: string
  storeName: string
  dbName: string
  category: string
  key: string
  size: number
  formattedSize: string
  type: string
  preview: string
  timestamp: number
}

const CATEGORY_MAP: Record<string, { name: string, color: string }> = {
  avatars: { name: '角色头像缓存', color: '#a7c7e7' },
  chat_images: { name: '聊天配图 (收发)', color: '#c4b5fd' },
  chat_emojis: { name: '聊天表情包', color: '#fbcfe8' },
  worldbook_covers: { name: '世界书封面图片', color: '#a7f3d0' },
  wallpapers: { name: '全局背景壁纸', color: '#fde047' },
  media_thumbs: { name: '媒体缩略图', color: '#a5b4fc' },
  chat_text: { name: '聊天记录文本', color: '#cbd5e1' },
  personas: { name: '角色核心设定数据', color: '#5eead4' },
  presets: { name: '快捷回复预设', color: '#fda4af' },
  worldbook_text: { name: '世界书文本数据', color: '#7dd3fc' },
  prompts: { name: '提示词 (Prompt) 模板', color: '#d9f99d' },
  ai_history: { name: 'AI 生图历史记录', color: '#d8b4fe' },
  nai_vibe: { name: 'NAI Vibe 缓存', color: '#f0abfc' },
  theme_appearance: { name: '主题与外观配色', color: '#fdba74' },
  voice_data: { name: '语音合成缓存', color: '#67e8f9' },
  cot_logs: { name: '思维链 (CoT) 日志', color: '#fef08a' },
  error_logs: { name: '控制台日志缓存', color: '#fca5a5' },
  user_settings: { name: '用户个人偏好设置', color: '#bae6fd' },
  plugins: { name: '插件与扩展数据', color: '#6ee7b7' },
  emoji_groups: { name: '表情包分组设定', color: '#f9a8d4' },
  others: { name: '其它未归类的底层碎片', color: '#e2e8f0' }
}

export function useAdvancedSettingsStorage(showConfirm: (message: string, title?: string, showCancel?: boolean, type?: 'normal' | 'danger') => Promise<boolean>) {
  const storageInfo = ref({
    usage: 0,
    quota: 0,
    percentage: 0,
    details: [] as Array<{id: string, name: string, usage: number, percentage: number, color: string}>
  })
  const isPersisted = ref(false)
  const showBreakdownModal = ref(false)
  const showCompressModal = ref(false)
  const compressQuality = ref(parseInt(localStorage.getItem('compressQuality') || '70'))
  const isCompressing = ref(false)
  const compressProgress = ref({ current: 0, total: 0, text: '' })
  
  const deepScanResults = ref<StorageItem[]>([])
  const isScanning = ref(false)

  watch(compressQuality, (newVal) => {
    localStorage.setItem('compressQuality', newVal.toString())
  })

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const extractTimestamp = (key: string): number => {
    const match = key.match(/\d{13}/)
    if (match) {
      return parseInt(match[0], 10)
    }
    return 0
  }

  const scanAllStorageDetails = async () => {
    isScanning.value = true
    deepScanResults.value = []
    const results: StorageItem[] = []

    // 1. 扫描 LocalStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const val = localStorage.getItem(key) || ''
        const size = (key.length + val.length) * 2 // UTF-16
        let type = 'text'
        let preview = val.length > 50 ? val.slice(0, 50) + '...' : val
        if (val.startsWith('data:image/')) {
          type = 'image'
          preview = val
        } else if (val.startsWith('{') || val.startsWith('[')) {
          type = 'object'
        }
        
        let category = 'others'
        const k = key.toLowerCase()
        if (k.includes('chat') && !k.includes('preset') && k !== 'chat_settings') category = 'chat_text'
        else if (k.includes('persona') || k.includes('character')) category = 'personas'
        else if (k.includes('preset') || k.includes('reply')) category = 'presets'
        else if (k.includes('worldbook') || k.includes('lorebook') || k.includes('entry')) category = 'worldbook_text'
        else if (k.includes('prompt')) category = 'prompts'
        else if (k.includes('theme') || k.includes('appearance') || k.includes('color') || k.includes('bg')) category = 'theme_appearance'
        else if (k.includes('voice') || k.includes('audio')) category = 'voice_data'
        else if (k.includes('cot') || k.includes('chain')) category = 'cot_logs'
        else if (k.includes('log') || k.includes('error') || k.includes('console')) category = 'error_logs'
        else if (k.includes('setting') || k.includes('config') || k.includes('api') || k.includes('key')) category = 'user_settings'
        else if (k.includes('plugin') || k.includes('extension')) category = 'plugins'
        else if (k.includes('emojigroup')) category = 'emoji_groups'

        results.push({
          id: `ls_${key}`,
          source: 'Local Storage',
          storeName: 'localStorage',
          dbName: 'localStorage',
          category,
          key,
          size,
          formattedSize: formatBytes(size),
          type,
          preview,
          timestamp: extractTimestamp(key) || Date.now() - 100000000
        })
      }
    }

    // 2. 扫描所有 IndexedDB
    const knownStores = [
      { name: 'nrt-app', storeName: 'chatEmojis', label: '聊天表情包', category: 'chat_emojis' },
      { name: 'nrt-app', storeName: 'chatImages', label: '聊天配图', category: 'chat_images' },
      { name: 'nrt-app', storeName: 'avatars', label: '角色头像', category: 'avatars' },
      { name: 'nrt-app', storeName: 'worldbook-covers', label: '世界书封面', category: 'worldbook_covers' },
      { name: 'nrt-app', storeName: 'wallpapers', label: '全局壁纸', category: 'wallpapers' },
      { name: 'nrt-app', storeName: 'media-thumbs', label: '媒体缩略图', category: 'media_thumbs' },
      { name: 'app_vibe_storage', storeName: 'keyvaluepairs', label: 'NAI Vibe', category: 'nai_vibe' },
      { name: 'app_novelai_history', storeName: 'keyvaluepairs', label: '生成历史', category: 'ai_history' }
    ]

    for (const ks of knownStores) {
      try {
        const db = localforage.createInstance({ name: ks.name, storeName: ks.storeName })
        await db.iterate((value: any, key: string) => {
          let size = 0
          let type = 'other'
          let preview = ''
          
          if (typeof value === 'string') {
            size = value.length * 2
            if (value.startsWith('data:image/')) {
              type = 'image'
              preview = value
            } else {
              type = 'text'
              preview = value.length > 50 ? value.slice(0, 50) + '...' : value
            }
          } else if (value instanceof Blob) {
            size = value.size
            type = value.type.startsWith('image/') ? 'image' : 'other'
            preview = '[Blob 文件]'
          } else {
            try {
              const str = JSON.stringify(value) || ''
              size = str.length * 2
              type = 'object'
              preview = str.length > 50 ? str.slice(0, 50) + '...' : str
            } catch (e) {
              size = 1024
              preview = '[复杂对象]'
            }
          }

          results.push({
            id: `idb_${ks.name}_${ks.storeName}_${key}`,
            source: ks.label,
            storeName: ks.storeName,
            dbName: ks.name,
            category: ks.category,
            key,
            size,
            formattedSize: formatBytes(size),
            type,
            preview,
            timestamp: extractTimestamp(key) || Date.now() - 50000000
          })
        })
      } catch (e) {
        console.warn(`无法扫描库: ${ks.name}/${ks.storeName}`, e)
      }
    }

    results.sort((a, b) => b.size - a.size)
    deepScanResults.value = results
    isScanning.value = false
  }

  const computeStorageInfo = async () => {
    // 基于 20 种详细分类计算总占比
    let totalUsage = 0
    const usageByCategory: Record<string, number> = {}
    for (const item of deepScanResults.value) {
      totalUsage += item.size
      usageByCategory[item.category] = (usageByCategory[item.category] || 0) + item.size
    }

    let quota = 0
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate()
        quota = estimate.quota || 0
      } catch (e) {}
    }

    const details = []
    for (const [cat, size] of Object.entries(usageByCategory)) {
      if (size > 0) {
        const meta = CATEGORY_MAP[cat] || CATEGORY_MAP['others']
        details.push({
          id: cat,
          name: meta.name,
          usage: size,
          percentage: totalUsage > 0 ? Number(((size / totalUsage) * 100).toFixed(1)) : 0,
          color: meta.color
        })
      }
    }

    details.sort((a, b) => b.usage - a.usage)

    storageInfo.value = {
      usage: totalUsage,
      quota,
      percentage: quota > 0 ? Number(((totalUsage / quota) * 100).toFixed(2)) : 0,
      details
    }
  }

  const checkStorage = async () => {
    isScanning.value = true
    await scanAllStorageDetails()
    await computeStorageInfo()
    
    if (navigator.storage && navigator.storage.persisted) {
      try {
        isPersisted.value = await navigator.storage.persisted()
      } catch (e) {}
    }
    isScanning.value = false
  }

  const deleteStorageItems = async (items: StorageItem[]) => {
    isScanning.value = true
    let deletedCount = 0
    let deletedSize = 0

    for (const item of items) {
      try {
        if (item.storeName === 'localStorage') {
          localStorage.removeItem(item.key)
          deletedCount++
          deletedSize += item.size
        } else {
          const db = localforage.createInstance({ name: item.dbName, storeName: item.storeName })
          await db.removeItem(item.key)
          deletedCount++
          deletedSize += item.size
        }
      } catch (e) {
        console.error(`删除文件失败: ${item.key}`, e)
      }
    }

    await checkStorage()
    isScanning.value = false
    await showConfirm(`已成功删除 ${deletedCount} 个文件，共释放了 ${formatBytes(deletedSize)} 存储空间。`, '提示', false)
  }

  const requestPersistence = async () => {
    if (navigator.storage && navigator.storage.persist) {
      try {
        const result = await navigator.storage.persist()
        isPersisted.value = result
        if (result) {
          await showConfirm('持久化保护已成功开启！', '提示', false)
        } else {
          await showConfirm('浏览器拒绝了持久化请求，请尝试将本应用加入书签后再试。', '提示', false)
        }
      } catch (e) {
        await showConfirm('申请持久化时发生错误', '提示', false)
      }
    } else {
      await showConfirm('当前浏览器不支持持久化存储 API', '提示', false)
    }
  }

  const compressImageBase64 = (base64: string, quality: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!base64.startsWith('data:image/') || base64.startsWith('data:image/svg+xml') || base64.startsWith('data:image/gif')) {
        return resolve(base64)
      }
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(base64)
        
        ctx.drawImage(img, 0, 0)
        const compressed = canvas.toDataURL('image/jpeg', quality / 100)
        if (compressed.length >= base64.length) resolve(base64)
        else resolve(compressed)
      }
      img.onerror = () => resolve(base64)
      img.src = base64
    })
  }

  const startImageCompression = async () => {
    isCompressing.value = true
    compressProgress.value = { current: 0, total: 0, text: '正在扫描图片数据...' }
    try {
      const stores = [
        { name: 'avatars', desc: '头像' },
        { name: 'worldbook-covers', desc: '世界书封面' },
        { name: 'wallpapers', desc: '聊天壁纸' },
        { name: 'media-thumbs', desc: '媒体缩略图' }
      ]
      let totalImagesToProcess = 0
      const allTasks: Array<{ store: LocalForage, key: string, originalData: any }> = []
      
      for (const s of stores) {
        const db = localforage.createInstance({ name: 'nrt-app', storeName: s.name })
        const keys = await db.keys()
        for (const key of keys) {
          const data = await db.getItem(key)
          if (typeof data === 'string' && data.startsWith('data:image/')) {
            allTasks.push({ store: db, key, originalData: data })
          }
        }
      }
      totalImagesToProcess = allTasks.length
      compressProgress.value.total = totalImagesToProcess
      
      if (totalImagesToProcess === 0) {
        await showConfirm('没有找到需要压缩的本地图片数据。', '提示', false)
        isCompressing.value = false
        showCompressModal.value = false
        return
      }

      let processed = 0
      let savedBytes = 0
      for (const task of allTasks) {
        compressProgress.value.current = processed + 1
        compressProgress.value.text = `正在处理... (${processed + 1}/${totalImagesToProcess})`
        const originalLength = task.originalData.length
        const compressedData = await compressImageBase64(task.originalData, compressQuality.value)
        const compressedLength = compressedData.length
        if (compressedLength < originalLength) {
          await task.store.setItem(task.key, compressedData)
          savedBytes += (originalLength - compressedLength)
        }
        processed++
        await new Promise(r => setTimeout(r, 10))
      }
      
      const approxSavedMB = (savedBytes / 1024 / 1024).toFixed(2)
      await checkStorage()
      isCompressing.value = false
      showCompressModal.value = false
      await showConfirm(`压缩完成！\n共处理 ${totalImagesToProcess} 张图片，大约释放了 ${approxSavedMB} MB 的存储空间。`, '提示', false)
    } catch (e) {
      isCompressing.value = false
      await showConfirm('压缩过程中发生错误。', '提示', false)
    }
  }

  const clearAllData = async () => {
    const confirmed = await showConfirm(
      '【极度危险】确定要彻底清除本应用产生的所有数据吗？\n\n警告：清除了之后，就相当于整个数据都没了！所有的聊天记录、角色、配图、世界书和设置将彻底消失，且绝对无法找回！\n\n请再次确认是否要执行此不可逆操作？',
      '【警告】彻底清除所有数据',
      true,
      'danger'
    )
    if (!confirmed) return
    isScanning.value = true 
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        for (const name of cacheNames) {
          await caches.delete(name)
        }
      }
      const knownDBs = ['nrt-app', 'app_vibe_storage', 'app_novelai_history']
      if (indexedDB.databases) {
        try {
          const dbs = await indexedDB.databases()
          for (const db of dbs) {
            if (db.name) indexedDB.deleteDatabase(db.name)
          }
        } catch(e) {
          knownDBs.forEach(dbName => indexedDB.deleteDatabase(dbName))
        }
      } else {
         knownDBs.forEach(dbName => indexedDB.deleteDatabase(dbName))
      }
      localStorage.clear()
      sessionStorage.clear()
      window.location.reload()
    } catch (e) {
      isScanning.value = false
      await showConfirm('清除数据失败，请重试或手动清除浏览器缓存。', '提示', false)
    }
  }

  const clearUnusedData = async () => {
    const confirmed = await showConfirm(
      '确定要执行深度垃圾回收吗？\n\n这会清理所有临时缓存，并销毁未被引用的幽灵图片/表情等。\n（正常使用的数据不会受到影响）',
      '深度清理无用数据',
      true,
      'danger'
    )
    if (!confirmed) return
    isScanning.value = true 
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        for (const name of cacheNames) {
          await caches.delete(name)
        }
      }
      const activeImageIds = new Set<string>()
      const activeEmojiIds = new Set<string>()
      const rawChats = localStorage.getItem('chats')
      if (rawChats) {
        try {
          const chats = JSON.parse(rawChats)
          for (const chat of chats) {
            if (chat.messages && Array.isArray(chat.messages)) {
              for (const msg of chat.messages) {
                if (msg.role === 'image' && msg.content && !msg.content.startsWith('data:image/')) {
                  activeImageIds.add(msg.content)
                }
                if (msg.emojiId) activeEmojiIds.add(msg.emojiId)
                if (msg.imgUrl && !msg.imgUrl.startsWith('data:image/')) {
                  activeImageIds.add(msg.imgUrl)
                }
              }
            }
          }
        } catch(e) {}
      }
      let deletedImagesCount = 0
      let deletedEmojisCount = 0
      let releasedBytes = 0

      const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
      const imgKeys = await imageStore.keys()
      for (const key of imgKeys) {
        if (!activeImageIds.has(key)) {
          const val = await imageStore.getItem<string>(key)
          if (val) releasedBytes += val.length * 2
          await imageStore.removeItem(key)
          deletedImagesCount++
        }
      }

      const emojiStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatEmojis' })
      const emojiKeys = await emojiStore.keys()
      const rawEmojiGroups = localStorage.getItem('emojiGroups')
      const activeGroupEmojiIds = new Set<string>()
      if (rawEmojiGroups) {
        try {
          const groups = JSON.parse(rawEmojiGroups)
          for (const g of groups) {
            if (g.emojis && Array.isArray(g.emojis)) {
              for (const e of g.emojis) {
                if (e.id) activeGroupEmojiIds.add(e.id)
              }
            }
          }
        } catch(e) {}
      }
      for (const key of emojiKeys) {
        if (!activeEmojiIds.has(key) && !activeGroupEmojiIds.has(key)) {
          const val = await emojiStore.getItem<string>(key)
          if (val) releasedBytes += val.length * 2
          await emojiStore.removeItem(key)
          deletedEmojisCount++
        }
      }

      await checkStorage()
      isScanning.value = false
      const summaryMsg = `清理完成！\n\n清理了 ${deletedImagesCount} 张失效配图。\n清理了 ${deletedEmojisCount} 个失效表情包。\n共计找回大约 ${formatBytes(releasedBytes)} 的空间！`
      await showConfirm(summaryMsg, '提示', false)
    } catch (e) {
      isScanning.value = false
      await showConfirm('清理失败，请重试。', '提示', false)
    }
  }

  return {
    storageInfo,
    isPersisted,
    showBreakdownModal,
    showCompressModal,
    compressQuality,
    isCompressing,
    compressProgress,
    formatBytes,
    checkStorage,
    requestPersistence,
    startImageCompression,
    clearUnusedData,
    clearAllData,
    deepScanResults,
    isScanning,
    scanAllStorageDetails,
    deleteStorageItems
  }
}
