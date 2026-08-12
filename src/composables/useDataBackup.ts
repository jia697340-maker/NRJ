/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import JSZip from 'jszip'

// 定义备份模块
export type BackupModule = string

export interface BackupCatalogItem {
  id: string
  group: string
  name: string
  description: string
  sensitive?: boolean
  localKeys?: string[]
  stores?: Array<{ dbName: string; storeName: string }>
}

export const BACKUP_CATALOG: BackupCatalogItem[] = [
  { id: 'novelai-api-key', group: '账号与安全', name: 'NovelAI API 密钥', description: 'NovelAI 的访问密钥', sensitive: true, localKeys: ['app_novelai_apikey'] },
  { id: 'novelai-api-address', group: '账号与安全', name: 'NovelAI API 地址', description: '自定义服务地址', localKeys: ['app_novelai_baseurl'] },
  { id: 'gpt-image-api-key', group: '账号与安全', name: 'GPT 生图 API 密钥', description: 'GPT Image 2 的访问密钥', sensitive: true, localKeys: ['app_gpt_image_apikey'] },
  { id: 'gpt-image-api-settings', group: '账号与安全', name: 'GPT 生图 API 配置', description: 'GPT Image 2 的接口地址与模型', localKeys: ['app_gpt_image_baseurl', 'app_gpt_image_model'] },
  { id: 'gpt-image-api-presets', group: '账号与安全', name: 'GPT 生图 API 预设', description: 'GPT Image 2 的多套接口预设', sensitive: true, localKeys: ['app_gpt_image_presets', 'app_gpt_image_current_preset'] },
  { id: 'gemini-image-api-key', group: '账号与安全', name: 'Gemini 生图 API 密钥', description: 'Gemini Image 的访问密钥', sensitive: true, localKeys: ['app_gemini_image_apikey'] },
  { id: 'gemini-image-api-settings', group: '账号与安全', name: 'Gemini 生图 API 配置', description: '官方或 OpenRouter 的接口地址与模型', localKeys: ['app_gemini_image_baseurl', 'app_gemini_image_transport', 'app_gemini_image_model'] },
  { id: 'gemini-image-api-presets', group: '账号与安全', name: 'Gemini 生图 API 预设', description: 'Gemini Image 的多套接口预设', sensitive: true, localKeys: ['app_gemini_image_presets', 'app_gemini_image_current_preset'] },
  { id: 'flux-image-api-key', group: '账号与安全', name: 'FLUX 生图 API 密钥', description: 'Black Forest Labs 的访问密钥', sensitive: true, localKeys: ['app_flux_image_apikey'] },
  { id: 'flux-image-api-settings', group: '账号与安全', name: 'FLUX 生图 API 配置', description: '独立代理地址与模型', localKeys: ['app_flux_image_proxy_url', 'app_flux_image_model'] },
  { id: 'minimax-voice', group: '账号与安全', name: 'MiniMax 语音配置', description: '语音服务配置', sensitive: true, localKeys: ['minimax_voice_config_v4'] },
  { id: 'seed-audio-voice', group: '账号与安全', name: 'Seed Audio 语音配置', description: '独立的官方、fal 与中转服务配置', sensitive: true, localKeys: ['seed_audio_config_v1'] },
  { id: 'gemini-voice', group: '账号与安全', name: 'Gemini TTS 语音配置', description: '独立的官方与中转服务配置', sensitive: true, localKeys: ['gemini_voice_config_v1'] },
  { id: 'elevenlabs-voice', group: '账号与安全', name: 'ElevenLabs 语音配置', description: '独立的官方与中转服务配置', sensitive: true, localKeys: ['elevenlabs_voice_config_v1'] },
  { id: 'microsoft-mai-voice', group: '账号与安全', name: 'Microsoft MAI Voice 配置', description: '独立的 Azure Speech 官方与中转服务配置', sensitive: true, localKeys: ['microsoft_mai_voice_config_v1'] },
  { id: 'aliyun-tts', group: '账号与安全', name: '阿里云 TTS 配置', description: '独立的阿里云百炼官方与中转服务配置', sensitive: true, localKeys: ['aliyun_tts_config_v1'] },
  { id: 'llm-presets', group: 'AI 与生成设置', name: 'LLM 预设列表', description: '模型预设与参数', localKeys: ['app_llm_presets'] },
  { id: 'system-prompt-schemes', group: 'AI 与生成设置', name: '系统提示词方案', description: '常规聊天方案、线下预设与特殊任务提示词', localKeys: ['clingy_global_prompt_settings', 'clingy_offline_prompt_presets', 'clingy_task_prompt_settings'] },
  { id: 'novelai-presets', group: 'AI 与生成设置', name: 'NovelAI 预设列表', description: '图像生成预设', localKeys: ['app_novelai_presets'] },
  { id: 'current-ai-preset', group: 'AI 与生成设置', name: '当前 AI 预设', description: '当前使用的模型与图像预设', localKeys: ['app_novelai_current_preset', 'app_novelai_current_prompt_preset'] },
  { id: 'prompt-presets', group: 'AI 与生成设置', name: '提示词预设', description: '正向提示词预设', localKeys: ['app_novelai_prompt_presets'] },
  { id: 'current-prompts', group: 'AI 与生成设置', name: '当前提示词', description: '正向与反向提示词', localKeys: ['app_novelai_prompt', 'app_novelai_negative'] },
  { id: 'style-tags', group: 'AI 与生成设置', name: '风格标签', description: '常用风格标签', localKeys: ['app_novelai_styletags'] },
  { id: 'vibe-settings', group: 'AI 与生成设置', name: 'Vibe 分组与图片', description: 'Vibe 分组和关联图片', localKeys: ['app_novelai_vibe_groups', 'app_novelai_vibe_images'], stores: [{ dbName: 'app_vibe_storage', storeName: 'keyvaluepairs' }] },
  { id: 'stream-setting', group: 'AI 与生成设置', name: '流式生成开关', description: '生成输出方式', localKeys: ['app_novelai_usestream'] },
  { id: 'gpt-image-settings', group: 'AI 与生成设置', name: 'GPT 生图设置', description: 'GPT Image 2 的尺寸、质量、格式和当前提示词', localKeys: ['app_gpt_image_size', 'app_gpt_image_quality', 'app_gpt_image_count', 'app_gpt_image_format', 'app_gpt_image_compression', 'app_gpt_image_moderation', 'app_gpt_image_prompt', 'app_gpt_image_selected_groups'] },
  { id: 'gpt-image-references', group: 'AI 与生成设置', name: 'GPT 参考组', description: 'GPT 生图参考图片与分组', stores: [{ dbName: 'app_gpt_image_references', storeName: 'reference_data' }] },
  { id: 'gemini-image-settings', group: 'AI 与生成设置', name: 'Gemini 生图设置', description: 'Gemini 的比例、分辨率、思考和搜索设置', localKeys: ['app_gemini_image_aspect_ratio', 'app_gemini_image_size', 'app_gemini_image_mime_type', 'app_gemini_image_thinking_level', 'app_gemini_image_google_search', 'app_gemini_image_image_search', 'app_gemini_image_prompt', 'app_gemini_image_selected_groups'] },
  { id: 'gemini-image-references', group: 'AI 与生成设置', name: 'Gemini 参考组', description: 'Gemini 生图参考图片与分组', stores: [{ dbName: 'app_gemini_image_references', storeName: 'reference_data' }] },
  { id: 'flux-image-settings', group: 'AI 与生成设置', name: 'FLUX 生图设置', description: 'FLUX 的尺寸、格式、审核与提示词设置', localKeys: ['app_flux_image_width', 'app_flux_image_height', 'app_flux_image_format', 'app_flux_image_safety', 'app_flux_image_seed', 'app_flux_image_disable_pup', 'app_flux_image_prompt', 'app_flux_image_selected_groups'] },
  { id: 'flux-image-references', group: 'AI 与生成设置', name: 'FLUX 参考组', description: 'FLUX 独立参考图片与分组', stores: [{ dbName: 'app_flux_image_references', storeName: 'reference_data' }] },
  { id: 'app-theme', group: '外观与系统', name: '应用主题', description: '应用主题与登录页主题', localKeys: ['clingy_auth_theme'] },
  { id: 'app-icons', group: '外观与系统', name: '应用图标', description: '自定义应用图标', stores: [{ dbName: 'nrt-app', storeName: 'appIcons' }] },
  { id: 'custom-fonts', group: '外观与系统', name: '自定义字体', description: '字体文件与作用范围', localKeys: ['clingy_custom_fonts'], stores: [{ dbName: 'nrt-app', storeName: 'customFonts' }] },
  { id: 'wallpapers', group: '外观与系统', name: '全局壁纸', description: '应用壁纸库', stores: [{ dbName: 'nrt-app', storeName: 'wallpapers' }] },
  { id: 'compression-setting', group: '外观与系统', name: '图片压缩设置', description: '图片压缩质量', localKeys: ['compressQuality'] },
  { id: 'personas', group: '联系人与角色', name: '角色列表', description: '角色资料与头像关联', localKeys: ['app_chat_personas'] },
  { id: 'active-persona', group: '联系人与角色', name: '当前角色', description: '当前选中的角色', localKeys: ['app_chat_active_persona_index'] },
  { id: 'chat-records', group: '聊天内容', name: '聊天会话与消息', description: '全部聊天会话和消息内容', localKeys: ['chats'] },
  { id: 'chat-groups', group: '聊天内容', name: '聊天分组', description: '聊天分组与排序', localKeys: ['clingy_chat_groups'] },
  { id: 'chat-settings', group: '聊天内容', name: '聊天设置', description: '聊天显示、通话及交互设置', localKeys: ['clingy_chat_settings'] },
  { id: 'system-messages', group: '聊天内容', name: '系统消息与通知', description: '系统消息、置顶和已读状态', localKeys: ['clingy_system_messages', 'clingy_system_notice_pinned', 'clingy_system_notice_read'] },
  { id: 'chat-emojis', group: '聊天内容', name: '聊天表情与分组', description: '表情包、表情分组', localKeys: ['emojiGroups'], stores: [{ dbName: 'nrt-app', storeName: 'chatEmojis' }] },
  { id: 'chat-images', group: '聊天内容', name: '聊天图片', description: '聊天内发送与保存的图片', stores: [{ dbName: 'nrt-app', storeName: 'chatImages' }] },
  { id: 'chat-voices', group: '聊天内容', name: '聊天语音与元数据', description: '语音消息及其播放信息', stores: [{ dbName: 'nrt-app', storeName: 'chatVoices' }, { dbName: 'nrt-app', storeName: 'chatVoiceMeta' }] },
  { id: 'chat-wallpapers', group: '聊天内容', name: '聊天壁纸', description: '会话专属背景', stores: [{ dbName: 'nrt-app', storeName: 'chatWallpapers' }] },
  { id: 'worldbooks', group: '世界书与记忆', name: '世界书正文与分组', description: '世界书内容和结构', localKeys: ['worldbooks'] },
  { id: 'worldbook-covers', group: '世界书与记忆', name: '世界书封面', description: '世界书封面图片', stores: [{ dbName: 'nrt-app', storeName: 'worldbook-covers' }] },
  { id: 'memory-covers', group: '世界书与记忆', name: '聊天记忆封面', description: '记忆卡封面', stores: [{ dbName: 'nrt-app', storeName: 'memoryCovers' }] },
  { id: 'memory-styles', group: '世界书与记忆', name: '聊天记忆样式', description: '记忆卡样式配置', stores: [{ dbName: 'nrt-app', storeName: 'memoryStyles' }] },
  { id: 'avatars', group: '图片与媒体', name: '头像库', description: '角色与用户头像', stores: [{ dbName: 'nrt-app', storeName: 'avatars' }] },
  { id: 'media-thumbs', group: '图片与媒体', name: '媒体缩略图', description: '图片和媒体的缩略图', stores: [{ dbName: 'nrt-app', storeName: 'media-thumbs' }, { dbName: 'nrt-app', storeName: 'mediaThumbs' }] },
  { id: 'image-history', group: '图片与媒体', name: '图片生成历史', description: 'NovelAI 图片生成历史', stores: [{ dbName: 'app_novelai_history', storeName: 'keyvaluepairs' }, { dbName: 'nrt-app', storeName: 'history_items' }] },
  { id: 'gpt-image-history', group: '图片与媒体', name: 'GPT 图片生成历史', description: 'GPT Image 2 独立生成历史', stores: [{ dbName: 'app_gpt_image_history', storeName: 'history_items' }] },
  { id: 'gemini-image-history', group: '图片与媒体', name: 'Gemini 图片生成历史', description: 'Gemini Image 独立生成历史', stores: [{ dbName: 'app_gemini_image_history', storeName: 'history_items' }] },
  { id: 'flux-image-history', group: '图片与媒体', name: 'FLUX 图片生成历史', description: 'FLUX.2 独立生成历史', stores: [{ dbName: 'app_flux_image_history', storeName: 'history_items' }] },
  { id: 'discover-moments', group: '发现与社交', name: '动态广场内容', description: '发布的动态及关联媒体', stores: [{ dbName: 'nrt-app', storeName: 'discover_moments' }] },
  { id: 'ui-preferences', group: '界面偏好', name: '界面位置与显示偏好', description: '页签、发现页控制等界面状态', localKeys: ['clingy_chat_setting_tab', 'clingy_discover_show_controls', 'clingy_last_timezone_tab'] }
]

// 备份元数据
export interface BackupMeta {
  version: string
  timestamp: number
  modules: BackupModule[]
  excludedSensitiveKeys?: string[]
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

export interface BackupFileInfo {
  encrypted: boolean
  legacy: boolean
  valid: boolean
  checksum?: string
}

export interface BackupSnapshot {
  id: string
  createdAt: number
  reason: string
  size: number
}

export interface BackupAutomationConfig {
  enabled: boolean
  intervalDays: number
  lastRunAt: number
}

export type BackupDestination = 'webdav' | 'github' | 'email'
export interface BackupAutomationPlan {
  destination: BackupDestination
  enabled: boolean
  intervalDays: number
  modules: BackupModule[]
  lastRunAt: number
}
export interface PendingEmailBackup { id: string; createdAt: number; size: number; modules: BackupModule[]; passwordProtected: boolean }

export interface BackupCreateOptions {
  includeSensitive?: boolean
}

export type RestoreStrategy = 'merge' | 'overwrite' | 'skip'
export type RestoreStrategies = Partial<Record<BackupModule, RestoreStrategy>>

const BACKUP_MAGIC_V2 = new TextEncoder().encode('NRTBKP02')
const BACKUP_MAGIC_V3 = new TextEncoder().encode('NRTBKP03')
const LEGACY_KDF_ITERATIONS = 100000
const CURRENT_KDF_ITERATIONS = 600000
const SNAPSHOT_STORE = localforage.createInstance({ name: 'nrt-backup-manager', storeName: 'snapshots' })
const SNAPSHOT_META_KEY = 'nrt_backup_snapshots'
const AUTOMATION_KEY = 'nrt_backup_automation'
const AUTOMATION_PLANS_KEY = 'nrt_backup_automation_plans'
const PENDING_EMAIL_META_KEY = 'nrt_pending_email_backup'
const PENDING_EMAIL_STORE = localforage.createInstance({ name: 'nrt-backup-manager', storeName: 'pending-email' })

const KNOWN_STORES = Array.from(new Map(BACKUP_CATALOG.flatMap(item => item.stores || []).map(store => [`${store.dbName}/${store.storeName}`, store])).values())
const KNOWN_DBS = Array.from(new Set(KNOWN_STORES.map(store => store.dbName))).map(dbName => ({ dbName }))
const BACKUP_INTERNAL_KEYS = new Set([
  SNAPSHOT_META_KEY,
  AUTOMATION_KEY,
  AUTOMATION_PLANS_KEY,
  PENDING_EMAIL_META_KEY,
  'github_backup_config',
  'webdav_config',
  'email_backup_password'
])
const SENSITIVE_KEY_PATTERN = /(api[_-]?key|apikey|token|secret|password|credential|clingy_(api|vision_api|summary_api|moment_api|embedding_api)_settings|minimax_voice_config|seed_audio_config|gemini_voice_config|elevenlabs_voice_config)/i
const NESTED_SENSITIVE_PROPERTY_PATTERN = /^(api[_-]?key|apikey|token|secret|password|credential)$/i

const isInfrastructureCredentialKey = (key: string) => BACKUP_INTERNAL_KEYS.has(key) || /github.*config|webdav.*config/i.test(key)
const isSensitiveKey = (key: string) => isInfrastructureCredentialKey(key) || SENSITIVE_KEY_PATTERN.test(key)
const redactNestedCredentials = (value: any): any => {
  if (Array.isArray(value)) return value.map(redactNestedCredentials)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [
    key,
    NESTED_SENSITIVE_PROPERTY_PATTERN.test(key) ? '' : redactNestedCredentials(nestedValue)
  ]))
}

// 核心备份引擎
export function useDataBackup() {
  const isFullBackup = (modules: BackupModule[]) => modules.includes('__full__')
    || ['settings', 'chats', 'worldbooks', 'images', 'history'].every(module => modules.includes(module))
    || BACKUP_CATALOG.every(item => modules.includes(item.id))
  
  // ================= 1. 数据收集与打包 =================
  const generateBackupData = async (modules: BackupModule[], options: BackupCreateOptions = {}): Promise<BackupData> => {
    const fullBackup = isFullBackup(modules)
    const data: BackupData = {
      meta: {
        version: '1.0',
        timestamp: Date.now(),
        modules,
        excludedSensitiveKeys: [],
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

      // 云端连接凭据和备份管理元数据永远不进入备份，避免令牌随备份外泄或恢复后污染当前设备。
      // 其余 API 密钥只有在备份文件使用密码加密时才允许包含。
      if (isInfrastructureCredentialKey(key) || (isSensitiveKey(key) && !options.includeSensitive)) {
        data.meta.excludedSensitiveKeys?.push(key)
        continue
      }
      
      // 完整备份不依赖 key 的命名规则，避免新增数据因命名差异被静默遗漏。
      // 自定义导出才按模块规则进行筛选。
      let shouldInclude = fullBackup || BACKUP_CATALOG.some(item => modules.includes(item.id) && item.localKeys?.includes(key))
      if (modules.includes('chats') && (key.includes('chat') || key.includes('persona'))) {
        shouldInclude = true
        if (key === 'chats') {
          try {
            data.meta.chatCount = JSON.parse(val).length
          } catch(e) {}
        }
      }
      if (modules.includes('worldbooks') && key.includes('worldbook')) {
        shouldInclude = true
        if (key === 'worldbooks') {
          try {
            data.meta.worldbookCount = JSON.parse(val).length
          } catch(e) {}
        }
      }
      if (modules.includes('history') && (key.includes('cot') || key.includes('log') || key.includes('history'))) {
        shouldInclude = true
      }

      if (shouldInclude) {
        if (!options.includeSensitive && key.startsWith('clingy_custom_contacts')) {
          try {
            data.localStorage[key] = JSON.stringify(redactNestedCredentials(JSON.parse(val)))
            data.meta.excludedSensitiveKeys?.push(`${key}:嵌套凭据`)
          } catch {
            data.localStorage[key] = val
          }
        } else {
          data.localStorage[key] = val
        }
      }
    }

    // 1.2 收集 IndexedDB
    for (const dbInfo of KNOWN_DBS) {
      data.indexedDB[dbInfo.dbName] = {}
      for (const dbStore of KNOWN_STORES.filter(item => item.dbName === dbInfo.dbName)) {
        const storeName = dbStore.storeName
        let shouldIncludeStore = fullBackup || BACKUP_CATALOG.some(item => modules.includes(item.id) && item.stores?.some(store => store.dbName === dbInfo.dbName && store.storeName === storeName))
        if (modules.includes('images') && ['chatImages', 'avatars', 'worldbook-covers', 'wallpapers', 'media-thumbs', 'chatEmojis'].includes(storeName)) shouldIncludeStore = true
        if (modules.includes('history') && dbInfo.dbName.includes('history')) shouldIncludeStore = true
        
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
  const restoreBackupData = async (data: BackupData, mode: 'overwrite' | 'merge', strategies: RestoreStrategies = {}): Promise<void> => {
    if (!data || typeof data !== 'object' || !data.meta || !data.localStorage || !data.indexedDB) {
      throw new Error('备份数据结构不完整，已停止恢复')
    }
    const strategyForKey = (key: string): RestoreStrategy => {
      const lower = key.toLowerCase()
      const module: BackupModule = lower.includes('worldbook') ? 'worldbooks' : lower.includes('chat') || lower.includes('persona') ? 'chats' : lower.includes('history') || lower.includes('log') || lower.includes('cot') ? 'history' : lower.includes('setting') || lower.includes('theme') || lower.includes('prompt') || lower.includes('preset') ? 'settings' : 'images'
      return strategies[module] || mode
    }
    const localBefore: Record<string, string> = {}
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (key) localBefore[key] = localStorage.getItem(key) || ''
    }
    const storesBefore: Record<string, Record<string, Record<string, any>>> = {}
    for (const [dbName, stores] of Object.entries(data.indexedDB)) {
      storesBefore[dbName] = {}
      for (const storeName of Object.keys(stores)) {
        const store = localforage.createInstance({ name: dbName, storeName })
        storesBefore[dbName][storeName] = {}
        await store.iterate((value: any, key: string) => { storesBefore[dbName][storeName][key] = value })
      }
    }

    try {
      // 2.1 恢复 LocalStorage。保留当前设备的云端凭据和未包含在文件内的敏感配置。
      if (mode === 'overwrite') {
        for (const key of Object.keys(localBefore)) {
          if (isInfrastructureCredentialKey(key)) continue
          if (isSensitiveKey(key) && !(key in data.localStorage)) continue
          localStorage.removeItem(key)
        }
      }
      for (const [key, value] of Object.entries(data.localStorage)) {
        if (isInfrastructureCredentialKey(key)) continue
        const keyStrategy = strategyForKey(key)
        if (keyStrategy === 'skip') continue
        if (keyStrategy === 'merge' && (key === 'chats' || key === 'worldbooks' || key.includes('presets')) && value.startsWith('[')) {
          try {
            const existingArr = JSON.parse(localStorage.getItem(key) || '[]')
            const incomingArr = JSON.parse(value)
            if (Array.isArray(existingArr) && Array.isArray(incomingArr)) {
              const merged = [...existingArr]
              const indexById = new Map<any, number>()
              existingArr.forEach((item: any, index: number) => { if (item?.id !== undefined && item?.id !== null) indexById.set(item.id, index) })
              const signatures = new Set(existingArr.filter((item: any) => item?.id === undefined).map((item: any) => JSON.stringify(item)))
              for (const item of incomingArr) {
                if (item?.id !== undefined && indexById.has(item.id)) merged[indexById.get(item.id)!] = item
                else if (item?.id !== undefined) { indexById.set(item.id, merged.length); merged.push(item) }
                else if (!signatures.has(JSON.stringify(item))) { signatures.add(JSON.stringify(item)); merged.push(item) }
              }
              localStorage.setItem(key, JSON.stringify(merged))
              continue
            }
          } catch { /* 无法解析时按普通键处理 */ }
        }
        if (keyStrategy === 'overwrite' || localStorage.getItem(key) === null) localStorage.setItem(key, value)
      }

      // 2.2 恢复 IndexedDB。任何 Store 失败都会触发整体回滚，不再静默报告成功。
      for (const [dbName, stores] of Object.entries(data.indexedDB)) {
        for (const [storeName, records] of Object.entries(stores)) {
          const store = localforage.createInstance({ name: dbName, storeName })
          const storeStrategy = strategies[dbName.includes('history') ? 'history' : 'images'] || mode
          if (storeStrategy === 'skip') continue
          if (storeStrategy === 'overwrite') await store.clear()
          for (const [key, value] of Object.entries(records)) {
            if (storeStrategy === 'overwrite' || await store.getItem(key) === null) await store.setItem(key, value)
          }
        }
      }
    } catch (error) {
      try {
        localStorage.clear()
        for (const [key, value] of Object.entries(localBefore)) localStorage.setItem(key, value)
        for (const [dbName, stores] of Object.entries(storesBefore)) {
          for (const [storeName, records] of Object.entries(stores)) {
            const store = localforage.createInstance({ name: dbName, storeName })
            await store.clear()
            for (const [key, value] of Object.entries(records)) await store.setItem(key, value)
          }
        }
      } catch (rollbackError) {
        console.error('恢复失败且自动回滚未完整完成', rollbackError)
      }
      throw error
    }
  }

  // ================= 3. 加解密 (Web Crypto API) =================
  
  // 从密码派生 AES-GCM 密钥
  const deriveKey = async (password: string, salt: Uint8Array, iterations = LEGACY_KDF_ITERATIONS): Promise<CryptoKey> => {
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
        salt: salt as unknown as BufferSource,
        iterations,
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

  const sha256 = async (value: string) => {
    const bytes = new TextEncoder().encode(value)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest)).map(item => item.toString(16).padStart(2, '0')).join('')
  }

  const bytesToBase64 = (bytes: Uint8Array) => {
    let binary = ''
    const batchSize = 0x8000
    for (let index = 0; index < bytes.length; index += batchSize) binary += String.fromCharCode(...bytes.subarray(index, index + batchSize))
    return btoa(binary)
  }

  const toPortableValue = async (value: any): Promise<any> => {
    if (value instanceof Blob) {
      const bytes = new Uint8Array(await value.arrayBuffer())
      return { __nrtBackupType: 'blob', type: value.type, data: bytesToBase64(bytes) }
    }
    if (Array.isArray(value)) return Promise.all(value.map(toPortableValue))
    if (value && typeof value === 'object') {
      const result: Record<string, any> = {}
      for (const [key, item] of Object.entries(value)) result[key] = await toPortableValue(item)
      return result
    }
    return value
  }

  const fromPortableValue = (value: any): any => {
    if (Array.isArray(value)) return value.map(fromPortableValue)
    if (value && typeof value === 'object') {
      if (value.__nrtBackupType === 'blob') {
        const binary = atob(value.data)
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
        return new Blob([bytes], { type: value.type || 'application/octet-stream' })
      }
      const result: Record<string, any> = {}
      for (const [key, item] of Object.entries(value)) result[key] = fromPortableValue(item)
      return result
    }
    return value
  }

  const createBackupFile = async (modules: BackupModule[], password?: string, options: BackupCreateOptions = {}): Promise<{ buffer: ArrayBuffer; info: BackupFileInfo; data: BackupData }> => {
    const data = await generateBackupData(modules, { ...options, includeSensitive: options.includeSensitive ?? !!password })
    data.meta.version = '3.0'
    const portableData = await toPortableValue(data)
    const payload = JSON.stringify(portableData)
    const checksum = await sha256(payload)
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify({ format: 'nrt-backup', version: 3, createdAt: data.meta.timestamp, encrypted: !!password, checksum, kdf: password ? { name: 'PBKDF2-SHA256', iterations: CURRENT_KDF_ITERATIONS } : undefined }))
    zip.file('payload.json', payload)
    const archive = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
    if (!password) return { buffer: archive, info: { encrypted: false, legacy: false, valid: true, checksum }, data }
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const key = await deriveKey(password, salt, CURRENT_KDF_ITERATIONS)
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, archive)
    const result = new Uint8Array(BACKUP_MAGIC_V3.length + 4 + salt.length + iv.length + encrypted.byteLength)
    result.set(BACKUP_MAGIC_V3, 0)
    new DataView(result.buffer).setUint32(BACKUP_MAGIC_V3.length, CURRENT_KDF_ITERATIONS, false)
    result.set(salt, BACKUP_MAGIC_V3.length + 4)
    result.set(iv, BACKUP_MAGIC_V3.length + 20)
    result.set(new Uint8Array(encrypted), BACKUP_MAGIC_V3.length + 32)
    return { buffer: result.buffer, info: { encrypted: true, legacy: false, valid: true, checksum }, data }
  }

  const inspectBackupFile = (buffer: ArrayBuffer): BackupFileInfo => {
    const bytes = new Uint8Array(buffer)
    const encrypted = BACKUP_MAGIC_V2.every((byte, index) => bytes[index] === byte) || BACKUP_MAGIC_V3.every((byte, index) => bytes[index] === byte)
    const legacy = !encrypted && new TextDecoder().decode(bytes.slice(0, 1)) === '{'
    return { encrypted, legacy, valid: encrypted || legacy || bytes[0] === 0x50 }
  }

  const readBackupFile = async (buffer: ArrayBuffer, password?: string): Promise<{ data: BackupData; info: BackupFileInfo }> => {
    const info = inspectBackupFile(buffer)
    if (!info.valid && password) {
      const data = await decryptData(buffer, password)
      if (!data?.meta || !data?.localStorage || !data?.indexedDB) throw new Error('旧版备份数据结构不完整')
      return { data, info: { encrypted: true, legacy: true, valid: true } }
    }
    if (!info.valid) throw new Error('不是可识别的备份文件；旧版 .clingybackup 请先输入密码')
    if (info.legacy) return { data: await decryptData(buffer, password), info }
    let archive = buffer
    if (info.encrypted) {
      if (!password) throw new Error('该备份已加密，请输入密码')
      const bytes = new Uint8Array(buffer)
      const isV3 = BACKUP_MAGIC_V3.every((byte, index) => bytes[index] === byte)
      const iterations = isV3 ? new DataView(buffer).getUint32(BACKUP_MAGIC_V3.length, false) : LEGACY_KDF_ITERATIONS
      if (iterations < 10000 || iterations > 5000000) throw new Error('备份加密参数无效')
      const headerLength = isV3 ? BACKUP_MAGIC_V3.length + 4 : BACKUP_MAGIC_V2.length
      const salt = bytes.slice(headerLength, headerLength + 16)
      const iv = bytes.slice(headerLength + 16, headerLength + 28)
      const key = await deriveKey(password, salt, iterations)
      try { archive = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, bytes.slice(headerLength + 28)) } catch { throw new Error('密码错误或备份文件已损坏') }
    }
    const zip = await JSZip.loadAsync(archive)
    const manifestText = await zip.file('manifest.json')?.async('string')
    const payload = await zip.file('payload.json')?.async('string')
    if (!manifestText || !payload) throw new Error('备份文件缺少必要内容')
    const manifest = JSON.parse(manifestText)
    const checksum = await sha256(payload)
    if (manifest.format !== 'nrt-backup' || checksum !== manifest.checksum) throw new Error('备份校验失败，文件可能已损坏')
    return { data: fromPortableValue(JSON.parse(payload)), info: { ...info, valid: true, checksum } }
  }

  const listSnapshots = (): BackupSnapshot[] => {
    try { return JSON.parse(localStorage.getItem(SNAPSHOT_META_KEY) || '[]') } catch { return [] }
  }
  const saveSnapshot = async (reason: string) => {
    const file = await createBackupFile(['settings', 'chats', 'worldbooks', 'images', 'history'])
    const id = `snapshot-${Date.now()}`
    await SNAPSHOT_STORE.setItem(id, file.buffer)
    const snapshots = [{ id, createdAt: Date.now(), reason, size: file.buffer.byteLength }, ...listSnapshots()].slice(0, 6)
    const removed = listSnapshots().slice(5)
    await Promise.all(removed.map(item => SNAPSHOT_STORE.removeItem(item.id)))
    localStorage.setItem(SNAPSHOT_META_KEY, JSON.stringify(snapshots))
    return id
  }
  const restoreSnapshot = async (id: string) => {
    const buffer = await SNAPSHOT_STORE.getItem<ArrayBuffer>(id)
    if (!buffer) throw new Error('找不到该恢复点')
    const { data } = await readBackupFile(buffer)
    await saveSnapshot('恢复操作前自动恢复点')
    await restoreBackupData(data, 'overwrite')
  }
  const deleteSnapshot = async (id: string) => {
    await SNAPSHOT_STORE.removeItem(id)
    localStorage.setItem(SNAPSHOT_META_KEY, JSON.stringify(listSnapshots().filter(item => item.id !== id)))
  }
  const getImportDiff = (data: BackupData) => {
    const incoming = Object.keys(data.localStorage)
    const existing = incoming.filter(key => localStorage.getItem(key) !== null)
    const added = incoming.length - existing.length
    const stores = Object.values(data.indexedDB).reduce((total, db) => total + Object.values(db).reduce((sum, records) => sum + Object.keys(records).length, 0), 0)
    return { added, overwritten: existing.length, mediaRecords: stores }
  }
  const getAutomationConfig = (): BackupAutomationConfig => {
    try { return { enabled: false, intervalDays: 7, lastRunAt: 0, ...JSON.parse(localStorage.getItem(AUTOMATION_KEY) || '{}') } } catch { return { enabled: false, intervalDays: 7, lastRunAt: 0 } }
  }
  const setAutomationConfig = (config: BackupAutomationConfig) => localStorage.setItem(AUTOMATION_KEY, JSON.stringify(config))
  const runAutomaticBackupIfDue = async () => {
    const config = getAutomationConfig()
    if (!config.enabled || Date.now() - config.lastRunAt < config.intervalDays * 86400000) return false
    await saveSnapshot('自动备份')
    setAutomationConfig({ ...config, lastRunAt: Date.now() })
    return true
  }

  const getAutomationPlans = (): BackupAutomationPlan[] => {
    try {
      const saved = JSON.parse(localStorage.getItem(AUTOMATION_PLANS_KEY) || '[]')
      return (['webdav', 'github', 'email'] as BackupDestination[]).map(destination => ({ destination, enabled: false, intervalDays: 7, modules: ['__full__'], lastRunAt: 0, ...(saved.find((item: BackupAutomationPlan) => item.destination === destination) || {}) }))
    } catch { return [] }
  }
  const setAutomationPlan = (plan: BackupAutomationPlan) => {
    const plans = getAutomationPlans().filter(item => item.destination !== plan.destination)
    localStorage.setItem(AUTOMATION_PLANS_KEY, JSON.stringify([...plans, plan]))
  }
  const isAutomationDue = (plan: BackupAutomationPlan) => plan.enabled && Date.now() - plan.lastRunAt >= Math.max(1, plan.intervalDays) * 86400000
  const markAutomationRun = (destination: BackupDestination) => {
    const plan = getAutomationPlans().find(item => item.destination === destination)
    if (plan) setAutomationPlan({ ...plan, lastRunAt: Date.now() })
  }
  const savePendingEmailBackup = async (buffer: ArrayBuffer, modules: BackupModule[], passwordProtected: boolean) => {
    const id = `email-${Date.now()}`
    await PENDING_EMAIL_STORE.setItem(id, buffer)
    const previous = getPendingEmailBackup()
    if (previous) await PENDING_EMAIL_STORE.removeItem(previous.id)
    const meta: PendingEmailBackup = { id, createdAt: Date.now(), size: buffer.byteLength, modules, passwordProtected }
    localStorage.setItem(PENDING_EMAIL_META_KEY, JSON.stringify(meta))
    return meta
  }
  const getPendingEmailBackup = (): PendingEmailBackup | null => { try { return JSON.parse(localStorage.getItem(PENDING_EMAIL_META_KEY) || 'null') } catch { return null } }
  const readPendingEmailBackup = async () => { const meta = getPendingEmailBackup(); return meta ? { meta, buffer: await PENDING_EMAIL_STORE.getItem<ArrayBuffer>(meta.id) } : null }
  const clearPendingEmailBackup = async () => { const meta = getPendingEmailBackup(); if (meta) await PENDING_EMAIL_STORE.removeItem(meta.id); localStorage.removeItem(PENDING_EMAIL_META_KEY) }

  return {
    generateBackupData,
    restoreBackupData,
    encryptData,
    decryptData
    , createBackupFile
    , readBackupFile
    , inspectBackupFile
    , listSnapshots
    , saveSnapshot
    , restoreSnapshot
    , deleteSnapshot
    , getImportDiff
    , getAutomationConfig
    , setAutomationConfig
    , runAutomaticBackupIfDue
    , getAutomationPlans
    , setAutomationPlan
    , isAutomationDue
    , markAutomationRun
    , savePendingEmailBackup
    , getPendingEmailBackup
    , readPendingEmailBackup
    , clearPendingEmailBackup
  }
}
