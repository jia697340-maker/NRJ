/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, watch } from 'vue'
import localforage from 'localforage'
import { useChatAuth } from './useChatAuth'

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
  storageFormat: string
  reclaimable: boolean
  protected: boolean
  status: 'normal' | 'legacy' | 'duplicate' | 'orphan' | 'system'
  description: string
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
  gpt_references: { name: 'GPT 参考组缓存', color: '#a5b4fc' },
  gemini_references: { name: 'Gemini 参考组缓存', color: '#93c5fd' },
  theme_appearance: { name: '主题与外观配色', color: '#fdba74' },
  voice_data: { name: '语音合成缓存', color: '#67e8f9' },
  cot_logs: { name: '思维链 (CoT) 日志', color: '#fef08a' },
  error_logs: { name: '控制台日志缓存', color: '#fca5a5' },
  user_settings: { name: '用户个人偏好设置', color: '#bae6fd' },
  plugins: { name: '插件与扩展数据', color: '#6ee7b7' },
  emoji_groups: { name: '表情包分组设定', color: '#f9a8d4' },
  backup_data: { name: '本机恢复点与待发送备份', color: '#d6d3d1' },
  offline_cache: { name: '离线应用缓存', color: '#dbe4ee' },
  system_overhead: { name: '数据库与浏览器开销', color: '#edf0f3' },
  others: { name: '其它可识别数据', color: '#e2e8f0' }
}

const isSensitiveStorageKey = (key: string) => /(api[_-]?key|apikey|token|secret|password|credential|github_backup_config|webdav_config|clingy_(api|vision_api|summary_api|moment_api|embedding_api)_settings|minimax_voice_config|seed_audio_config|gemini_voice_config|elevenlabs_voice_config)/i.test(key)

export function useAdvancedSettingsStorage(showConfirm: (message: string, title?: string, showCancel?: boolean, type?: 'normal' | 'danger') => Promise<boolean>) {
  const storageInfo = ref({
    usage: 0,
    quota: 0,
    percentage: 0,
    details: [] as Array<{id: string, name: string, usage: number, percentage: number, color: string, count: number, reclaimable: number}>,
    recognizedUsage: 0,
    userDataUsage: 0,
    cacheUsage: 0,
    backupUsage: 0,
    overheadUsage: 0,
    reclaimableUsage: 0,
    itemCount: 0,
    accuracy: '估算' as '浏览器统计' | '内容估算' | '估算'
  })
  const isPersisted = ref<boolean | null>(null)
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

  const utf8Size = (value: string) => new Blob([value]).size

  const decodedDataUrlSize = (value: string) => {
    const comma = value.indexOf(',')
    if (comma < 0 || !value.slice(0, comma).includes(';base64')) return utf8Size(value)
    const body = value.slice(comma + 1)
    const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0
    return Math.max(0, Math.floor(body.length * 3 / 4) - padding)
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
    const referencedAssetKeys = new Set<string>()

    // 1. 扫描 LocalStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const val = localStorage.getItem(key) || ''
        for (const match of val.matchAll(/localforage:([^"'\\\s}]+)/g)) referencedAssetKeys.add(match[1])
        const size = utf8Size(key) + utf8Size(val)
        const containsInlineImage = val.includes('data:image/')
        let type = 'text'
        let preview = val.length > 50 ? val.slice(0, 50) + '...' : val
        if (val.startsWith('data:image/')) {
          type = 'image'
          preview = val
        } else if (val.startsWith('{') || val.startsWith('[')) {
          type = 'object'
        }
        if (isSensitiveStorageKey(key)) {
          type = 'object'
          preview = '[敏感配置已隐藏]'
        }
        
        let category = 'others'
        const k = key.toLowerCase()
        if (k.includes('persona') || k.includes('character') || k.includes('account') || k.includes('contact')) category = 'personas'
        else if (k.includes('chat') && !k.includes('preset') && k !== 'chat_settings') category = 'chat_text'
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
          timestamp: extractTimestamp(key) || Date.now() - 100000000,
          storageFormat: containsInlineImage ? 'Base64（旧版）' : '文本 / JSON',
          reclaimable: false,
          protected: category === 'personas' || category === 'chat_text' || isSensitiveStorageKey(key),
          status: containsInlineImage ? 'legacy' : 'normal',
          description: containsInlineImage ? '包含内嵌图片，建议迁移为压缩媒体资源' : '应用设置或结构化文本数据'
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
      { name: 'nrt-app', storeName: 'mediaThumbs', label: '媒体缩略图', category: 'media_thumbs' },
      { name: 'nrt-app', storeName: 'appIcons', label: '应用图标', category: 'theme_appearance' },
      { name: 'nrt-app', storeName: 'customFonts', label: '自定义字体', category: 'theme_appearance' },
      { name: 'nrt-app', storeName: 'chatWallpapers', label: '聊天壁纸', category: 'wallpapers' },
      { name: 'nrt-app', storeName: 'memoryCovers', label: '记忆封面', category: 'worldbook_covers' },
      { name: 'nrt-app', storeName: 'memoryStyles', label: '记忆样式', category: 'theme_appearance' },
      { name: 'nrt-app', storeName: 'discover_moments', label: '动态广场', category: 'chat_images' },
      { name: 'nrt-app', storeName: 'history_items', label: '生成历史', category: 'ai_history' },
      { name: 'nrt-app', storeName: 'chatVoices', label: '语音合成缓存', category: 'voice_data' },
      { name: 'nrt-app', storeName: 'chatVoiceMeta', label: '语音缓存索引', category: 'voice_data' },
      { name: 'app_vibe_storage', storeName: 'keyvaluepairs', label: 'NAI Vibe', category: 'nai_vibe' },
      { name: 'app_novelai_history', storeName: 'keyvaluepairs', label: '生成历史', category: 'ai_history' },
      { name: 'app_gpt_image_references', storeName: 'reference_data', label: 'GPT 参考组', category: 'gpt_references' },
      { name: 'app_gpt_image_history', storeName: 'history_items', label: 'GPT 生成历史', category: 'ai_history' },
      { name: 'app_gemini_image_references', storeName: 'reference_data', label: 'Gemini 参考组', category: 'gemini_references' },
      { name: 'app_gemini_image_history', storeName: 'history_items', label: 'Gemini 生成历史', category: 'ai_history' },
      { name: 'nrt-backup-manager', storeName: 'snapshots', label: '本机恢复点', category: 'backup_data' },
      { name: 'nrt-backup-manager', storeName: 'pending-email', label: '待发送备份', category: 'backup_data' }
    ]

    // 只扫描已经存在的数据库与对象仓库，避免“查看存储”本身创建一批空仓库并抬高占用。
    let existingStores: Map<string, Set<string>> | null = null
    if (indexedDB.databases) {
      try {
        const existingNames = new Set((await indexedDB.databases()).map(item => item.name).filter((name): name is string => !!name))
        existingStores = new Map()
        for (const name of new Set(knownStores.map(item => item.name))) {
          if (!existingNames.has(name)) continue
          const stores = await new Promise<Set<string>>((resolve) => {
            const request = indexedDB.open(name)
            request.onsuccess = () => {
              const db = request.result
              const names = new Set(Array.from(db.objectStoreNames))
              db.close()
              resolve(names)
            }
            request.onerror = () => resolve(new Set())
            request.onblocked = () => resolve(new Set())
          })
          existingStores.set(name, stores)
        }
      } catch {
        existingStores = null
      }
    }

    for (const ks of knownStores) {
      if (existingStores && !existingStores.get(ks.name)?.has(ks.storeName)) continue
      try {
        const db = localforage.createInstance({ name: ks.name, storeName: ks.storeName })
        await db.iterate((value: any, key: string) => {
          let size = 0
          let type = 'other'
          let preview = ''
          
          if (typeof value === 'string') {
            size = value.startsWith('data:') ? decodedDataUrlSize(value) : utf8Size(value)
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
              size = utf8Size(str)
              type = 'object'
              preview = str.length > 50 ? str.slice(0, 50) + '...' : str
            } catch (e) {
              size = 1024
              preview = '[复杂对象]'
            }
          }

          const isLegacyImage = typeof value === 'string' && value.startsWith('data:image/')
          const isOrphanAvatar = ks.category === 'avatars'
            && (key.startsWith('persona_avatar_') || key.startsWith('avatar_content_') || key.startsWith('avatar_st_'))
            && !referencedAssetKeys.has(key)
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
            timestamp: extractTimestamp(key) || Date.now() - 50000000,
            storageFormat: value instanceof Blob ? `Blob · ${value.type || '未知格式'}` : isLegacyImage ? 'Base64（旧版）' : type === 'object' ? '结构化数据' : '文本',
            reclaimable: isOrphanAvatar,
            protected: !isOrphanAvatar && !['ai_history', 'media_thumbs'].includes(ks.category),
            status: isOrphanAvatar ? 'orphan' : isLegacyImage ? 'legacy' : 'normal',
            description: isOrphanAvatar ? '没有业务数据引用，可安全清理' : isLegacyImage ? '内嵌图片，可通过图片优化降低占用' : `${ks.label}中的本地数据`
          })
        })
      } catch (e) {
        console.warn(`无法扫描库: ${ks.name}/${ks.storeName}`, e)
      }
    }

    // 3. 单独盘点离线应用缓存；它属于应用壳，不与用户内容混算。
    if ('caches' in window) {
      try {
        for (const cacheName of await caches.keys()) {
          const cache = await caches.open(cacheName)
          for (const request of await cache.keys()) {
            try {
              const response = await cache.match(request)
              const blob = response ? await response.clone().blob() : null
              const url = new URL(request.url)
              results.push({
                id: `cache_${cacheName}_${request.url}`,
                source: '离线应用缓存',
                storeName: cacheName,
                dbName: 'CacheStorage',
                category: 'offline_cache',
                key: `${url.pathname}${url.search}`,
                size: blob?.size || 0,
                formattedSize: formatBytes(blob?.size || 0),
                type: blob?.type.startsWith('image/') ? 'image' : 'other',
                preview: request.url,
                timestamp: 0,
                storageFormat: blob?.type || '缓存响应',
                reclaimable: true,
                protected: false,
                status: 'normal',
                description: '供离线打开和加快加载使用，删除后会在联网时重新生成'
              })
            } catch (error) {
              console.warn(`无法读取缓存项: ${request.url}`, error)
            }
          }
        }
      } catch (error) {
        console.warn('无法扫描离线应用缓存', error)
      }
    }

    // 标记内容完全相同的内嵌图片；仅提示重复，不直接把仍被引用的数据当垃圾删除。
    const imageSignatures = new Map<string, StorageItem>()
    for (const item of results) {
      if (item.type !== 'image' || !item.preview.startsWith('data:image/')) continue
      const signature = `${item.size}:${item.preview.slice(0, 96)}:${item.preview.slice(-96)}`
      const existing = imageSignatures.get(signature)
      if (existing) {
        item.status = 'duplicate'
        item.description = `与“${existing.key}”内容相同；媒体迁移时可合并为单一资源`
      } else imageSignatures.set(signature, item)
    }

    results.sort((a, b) => b.size - a.size)
    deepScanResults.value = results
    isScanning.value = false
  }

  const computeStorageInfo = async () => {
    deepScanResults.value = deepScanResults.value.filter(item => item.category !== 'system_overhead')
    let recognizedUsage = 0
    const usageByCategory: Record<string, number> = {}
    const countByCategory: Record<string, number> = {}
    const reclaimableByCategory: Record<string, number> = {}
    for (const item of deepScanResults.value) {
      recognizedUsage += item.size
      usageByCategory[item.category] = (usageByCategory[item.category] || 0) + item.size
      countByCategory[item.category] = (countByCategory[item.category] || 0) + 1
      if (item.reclaimable) reclaimableByCategory[item.category] = (reclaimableByCategory[item.category] || 0) + item.size
    }

    let quota = 0
    let browserUsage = 0
    let accuracy: '浏览器统计' | '内容估算' | '估算' = '内容估算'
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate()
        quota = estimate.quota || 0
        browserUsage = estimate.usage || 0
        accuracy = browserUsage > 0 ? '浏览器统计' : '内容估算'
      } catch (e) {}
    }
    // 浏览器值是物理占用，逐项扫描是可解释载荷；差额单列，绝不伪装成业务碎片。
    const totalUsage = Math.max(browserUsage, recognizedUsage)
    const overheadUsage = Math.max(0, totalUsage - recognizedUsage)
    if (overheadUsage > 0) {
      usageByCategory.system_overhead = overheadUsage
      countByCategory.system_overhead = 1
      deepScanResults.value.push({
        id: 'system_overhead', source: '浏览器存储系统', storeName: '系统开销', dbName: 'BrowserStorage',
        category: 'system_overhead', key: '数据库页、索引与浏览器统计差额', size: overheadUsage,
        formattedSize: formatBytes(overheadUsage), type: 'system', preview: '这部分由浏览器统一统计，无法安全拆分为单个业务文件。',
        timestamp: 0, storageFormat: '浏览器内部数据', reclaimable: false, protected: true, status: 'system',
        description: '包括数据库页、索引、事务日志及浏览器计量差异；不能作为垃圾直接删除'
      })
    }

    const details: Array<{id: string, name: string, usage: number, percentage: number, color: string, count: number, reclaimable: number}> = []
    for (const [cat, size] of Object.entries(usageByCategory)) {
      if (size > 0) {
        const meta = CATEGORY_MAP[cat] || CATEGORY_MAP['others']
        details.push({
          id: cat,
          name: meta.name,
          usage: size,
          percentage: totalUsage > 0 ? Number(((size / totalUsage) * 100).toFixed(1)) : 0,
          color: meta.color,
          count: countByCategory[cat] || 0,
          reclaimable: reclaimableByCategory[cat] || 0
        })
      }
    }

    details.sort((a, b) => b.usage - a.usage)

    const cacheUsage = usageByCategory.offline_cache || 0
    const backupUsage = usageByCategory.backup_data || 0
    const reclaimableUsage = deepScanResults.value.reduce((sum, item) => sum + (item.reclaimable ? item.size : 0), 0)
    storageInfo.value = {
      usage: totalUsage,
      quota,
      percentage: quota > 0 ? Number(((totalUsage / quota) * 100).toFixed(2)) : 0,
      details,
      recognizedUsage,
      userDataUsage: Math.max(0, recognizedUsage - cacheUsage - backupUsage),
      cacheUsage,
      backupUsage,
      overheadUsage,
      reclaimableUsage,
      itemCount: deepScanResults.value.length,
      accuracy
    }
  }

  const migrateDuplicateAccountAvatars = async () => {
    try {
      const accounts = JSON.parse(localStorage.getItem('clingy_chat_accounts') || '[]') as Array<{ id: string; avatarUrl?: string }>
      const accountByAvatar = new Map(accounts.filter(item => item.avatarUrl?.startsWith('data:image/')).map(item => [item.avatarUrl as string, item.id]))
      if (!accountByAvatar.size) return
      const removableKeys = new Set<string>()
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index)
        if (!key || !key.includes('app_chat_personas')) continue
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const personas = JSON.parse(raw)
        if (!Array.isArray(personas)) continue
        let changed = false
        for (const persona of personas) {
          if (typeof persona?.avatar !== 'string' || !persona.avatar.startsWith('localforage:')) continue
          const assetKey = persona.avatar.slice('localforage:'.length)
          const value = await localforage.createInstance({ name: 'nrt-app', storeName: 'avatars' }).getItem<string>(assetKey)
          const accountId = value ? accountByAvatar.get(value) : undefined
          if (!accountId) continue
          persona.avatar = `account-avatar:${accountId}`
          removableKeys.add(assetKey)
          changed = true
        }
        if (changed) localStorage.setItem(key, JSON.stringify(personas))
      }
      const remainingReferences = Array.from({ length: localStorage.length }, (_, index) => localStorage.getItem(localStorage.key(index) || '') || '').join('\n')
      const avatars = localforage.createInstance({ name: 'nrt-app', storeName: 'avatars' })
      for (const key of removableKeys) {
        if (!remainingReferences.includes(`localforage:${key}`)) await avatars.removeItem(key)
      }
    } catch (error) {
      console.warn('头像重复副本迁移已跳过', error)
    }
  }

  const checkStorage = async () => {
    isScanning.value = true
    await migrateDuplicateAccountAvatars()
    await scanAllStorageDetails()
    await computeStorageInfo()
    
    if (navigator.storage && navigator.storage.persisted) {
      try {
        isPersisted.value = await navigator.storage.persisted()
      } catch (e) { isPersisted.value = null }
    } else isPersisted.value = null
    isScanning.value = false
  }

  const deleteStorageItems = async (items: StorageItem[]) => {
    isScanning.value = true
    let deletedCount = 0
    let deletedSize = 0

    for (const item of items) {
      try {
        if (item.protected || item.status === 'system') continue
        if (item.dbName === 'CacheStorage') {
          const cache = await caches.open(item.storeName)
          await cache.delete(item.preview)
          deletedCount++
          deletedSize += item.size
        } else if (item.storeName === 'localStorage') {
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
      isPersisted.value = null
      await showConfirm('当前浏览器不支持持久化存储 API', '提示', false)
    }
  }

  const compressImageBase64 = (base64: string, quality: number, maxSide = 1600): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!base64.startsWith('data:image/') || base64.startsWith('data:image/svg+xml') || base64.startsWith('data:image/gif')) {
        return resolve(base64)
      }
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(base64)
        
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const compressed = canvas.toDataURL('image/webp', quality / 100)
        if (decodedDataUrlSize(compressed) >= decodedDataUrlSize(base64)) resolve(base64)
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
      let processed = 0
      let savedBytes = 0
      const optimizeEmbeddedImages = async (value: any, maxSide: number): Promise<any> => {
        if (typeof value === 'string' && value.startsWith('data:image/')) {
          const before = decodedDataUrlSize(value)
          const optimized = await compressImageBase64(value, compressQuality.value, maxSide)
          const after = decodedDataUrlSize(optimized)
          processed++
          savedBytes += Math.max(0, before - after)
          compressProgress.value.text = `正在优化内嵌图片…（已处理 ${processed} 张）`
          return optimized
        }
        if (Array.isArray(value)) return Promise.all(value.map(item => optimizeEmbeddedImages(item, maxSide)))
        if (value && typeof value === 'object') {
          const output: Record<string, any> = {}
          for (const [key, child] of Object.entries(value)) output[key] = await optimizeEmbeddedImages(child, maxSide)
          return output
        }
        return value
      }
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index)
        const raw = key ? localStorage.getItem(key) : null
        if (!key || !raw?.includes('data:image/')) continue
        try {
          const parsed = JSON.parse(raw)
          const maxSide = /(account|persona|contact|avatar)/i.test(key) ? 512 : 1600
          const optimizedValue = await optimizeEmbeddedImages(parsed, maxSide)
          localStorage.setItem(key, JSON.stringify(optimizedValue))
          if (key === 'clingy_chat_accounts' && Array.isArray(optimizedValue)) useChatAuth().chatAccounts.value = optimizedValue
        } catch {
          if (raw.startsWith('data:image/')) localStorage.setItem(key, await optimizeEmbeddedImages(raw, 1600))
        }
      }

      const stores = [
        { name: 'avatars', desc: '头像', maxSide: 512 },
        { name: 'worldbook-covers', desc: '世界书封面', maxSide: 1200 },
        { name: 'wallpapers', desc: '全局壁纸', maxSide: 1920 },
        { name: 'media-thumbs', desc: '媒体缩略图', maxSide: 640 },
        { name: 'mediaThumbs', desc: '媒体缩略图', maxSide: 640 },
        { name: 'appIcons', desc: '应用图标', maxSide: 512 },
        { name: 'chatWallpapers', desc: '聊天壁纸', maxSide: 1920 },
        { name: 'memoryCovers', desc: '记忆封面', maxSide: 1200 },
        { name: 'chatImages', desc: '聊天配图', maxSide: 1600 },
        { name: 'chatEmojis', desc: '聊天表情', maxSide: 640 }
      ]
      let totalImagesToProcess = 0
      const allTasks: Array<{ store: LocalForage, key: string, originalData: string, maxSide: number }> = []
      
      for (const s of stores) {
        const db = localforage.createInstance({ name: 'nrt-app', storeName: s.name })
        const keys = await db.keys()
        for (const key of keys) {
          const data = await db.getItem(key)
          if (typeof data === 'string' && data.startsWith('data:image/')) {
            allTasks.push({ store: db, key, originalData: data, maxSide: s.maxSide })
          }
        }
      }
      totalImagesToProcess = processed + allTasks.length
      compressProgress.value.total = totalImagesToProcess
      
      if (totalImagesToProcess === 0) {
        await showConfirm('没有找到需要压缩的本地图片数据。', '提示', false)
        isCompressing.value = false
        showCompressModal.value = false
        return
      }

      for (const task of allTasks) {
        compressProgress.value.current = processed + 1
        compressProgress.value.text = `正在处理... (${processed + 1}/${totalImagesToProcess})`
        const originalLength = decodedDataUrlSize(task.originalData)
        const compressedData = await compressImageBase64(task.originalData, compressQuality.value, task.maxSide)
        const compressedLength = decodedDataUrlSize(compressedData)
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
      const knownDBs = ['nrt-app', 'app_vibe_storage', 'app_novelai_history', 'app_gpt_image_references', 'app_gpt_image_history', 'nrt-backup-manager']
      let databaseNames = knownDBs
      if (indexedDB.databases) {
        try {
          databaseNames = Array.from(new Set((await indexedDB.databases()).map(db => db.name).filter((name): name is string => !!name)))
        } catch {}
      }
      // 等待 localForage 真正关闭并删除数据库；旧实现发出删除请求后立即刷新，容易出现统计先升后降。
      await Promise.allSettled(databaseNames.map(name => localforage.dropInstance({ name })))
      const remainingNames = indexedDB.databases
        ? new Set((await indexedDB.databases().catch(() => [])).map(db => db.name).filter((name): name is string => !!name))
        : new Set<string>()
      await Promise.allSettled(databaseNames.filter(name => remainingNames.has(name)).map(name => new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(name)
        request.onsuccess = () => resolve()
        request.onerror = () => resolve()
        request.onblocked = () => resolve()
      })))
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
      // 不清除 Service Worker 的离线应用缓存；垃圾回收只处理确认未被业务数据引用的媒体。
      const activeImageIds = new Set<string>()
      const activeEmojiIds = new Set<string>()
      let referenceScanFailed = false
      const collectMediaReferences = (value: any, seen = new WeakSet<object>()) => {
        if (!value || typeof value !== 'object' || seen.has(value)) return
        seen.add(value)
        if (typeof value.imageId === 'string') activeImageIds.add(value.imageId)
        if (typeof value.emojiId === 'string') activeEmojiIds.add(value.emojiId)
        if (typeof value.imgUrl === 'string' && !value.imgUrl.startsWith('data:')) activeImageIds.add(value.imgUrl)
        if (value.role === 'image' && typeof value.content === 'string' && !value.content.startsWith('data:')) activeImageIds.add(value.content)
        if (Array.isArray(value)) value.forEach(item => collectMediaReferences(item, seen))
        else Object.values(value).forEach(item => collectMediaReferences(item, seen))
      }
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index)
        if (!key || !(key === 'chats' || key === 'clingy_system_messages' || key.startsWith('clingy_custom_contacts') || key.startsWith('clingy_group_chats'))) continue
        const rawChats = localStorage.getItem(key)
        if (!rawChats) continue
        try {
          collectMediaReferences(JSON.parse(rawChats))
        } catch { referenceScanFailed = true }
      }
      if (referenceScanFailed) throw new Error('聊天数据存在损坏，已停止垃圾回收以避免误删媒体')
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
        } catch { throw new Error('表情分组数据存在损坏，已停止垃圾回收以避免误删') }
      }
      let deletedImagesCount = 0
      let deletedEmojisCount = 0
      let deletedAvatarsCount = 0
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
      for (const key of emojiKeys) {
        if (!activeEmojiIds.has(key) && !activeGroupEmojiIds.has(key)) {
          const val = await emojiStore.getItem<string>(key)
          if (val) releasedBytes += val.length * 2
          await emojiStore.removeItem(key)
          deletedEmojisCount++
        }
      }

      const referencedAvatars = new Set<string>()
      for (let index = 0; index < localStorage.length; index++) {
        const raw = localStorage.getItem(localStorage.key(index) || '') || ''
        for (const match of raw.matchAll(/localforage:([^"'\\\s}]+)/g)) referencedAvatars.add(match[1])
        for (const match of raw.matchAll(/"avatarKey"\s*:\s*"([^"\\]+)"/g)) referencedAvatars.add(match[1])
      }
      const avatarStore = localforage.createInstance({ name: 'nrt-app', storeName: 'avatars' })
      for (const key of await avatarStore.keys()) {
        if (!(key.startsWith('persona_avatar_') || key.startsWith('avatar_content_') || key.startsWith('avatar_st_') || key.startsWith('avatar_social_')) || referencedAvatars.has(key)) continue
        const value = await avatarStore.getItem<any>(key)
        if (typeof value === 'string') releasedBytes += value.startsWith('data:') ? decodedDataUrlSize(value) : utf8Size(value)
        else if (value instanceof Blob) releasedBytes += value.size
        await avatarStore.removeItem(key)
        deletedAvatarsCount++
      }

      await checkStorage()
      isScanning.value = false
      const summaryMsg = `清理完成！\n\n清理了 ${deletedImagesCount} 张失效配图。\n清理了 ${deletedEmojisCount} 个失效表情包。\n清理了 ${deletedAvatarsCount} 个孤儿头像。\n共计找回大约 ${formatBytes(releasedBytes)} 的空间！`
      await showConfirm(summaryMsg, '提示', false)
    } catch (e: any) {
      isScanning.value = false
      await showConfirm(e?.message || '清理失败，请重试。', '提示', false)
    }
  }

  const clearOfflineCache = async () => {
    const cacheItems = deepScanResults.value.filter(item => item.category === 'offline_cache')
    if (!cacheItems.length) return showConfirm('当前没有可清除的离线应用缓存。', '提示', false)
    const confirmed = await showConfirm(`确定清除 ${formatBytes(cacheItems.reduce((sum, item) => sum + item.size, 0))} 离线应用缓存吗？\n\n头像、聊天、人设和备份不会受影响；联网后缓存会重新生成。`, '清除离线缓存', true)
    if (!confirmed) return
    for (const name of await caches.keys()) await caches.delete(name)
    await checkStorage()
    await showConfirm('离线应用缓存已清除，用户内容未受影响。', '提示', false)
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
    clearOfflineCache,
    clearAllData,
    deepScanResults,
    isScanning,
    scanAllStorageDetails,
    deleteStorageItems
  }
}
