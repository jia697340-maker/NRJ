/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, watch } from 'vue'
import type { DoubanCapabilitySettings, McpSettings } from '../types/mcp'
import { readStoredJSON } from './utils'
import { getSecureValue, isNativeMobileApp, setSecureValue } from '../services/mobileSecureStorage'

const SETTINGS_KEY = 'clingy_mcp_settings'
const JINA_KEY = 'clingy_mcp_jina_api_key'
const LEGACY_KEYS = ['clingy_mcp_connections', 'clingy_mcp_activity', 'clingy_mcp_shared_life']

export const defaultDoubanSettings = (): DoubanCapabilitySettings => ({
  enabled: false,
  readPostBody: true,
  readSubjectInfo: true,
  readComments: true,
  readShortReviews: true,
  readLongReviews: false,
  readRatingAndTags: true,
  readAuthorPublicInfo: false,
  readRelatedItems: false,
  triggerMode: 'auto',
  depth: 'standard',
  showCapabilityCard: true
})

const defaults = (): McpSettings => ({
  schemaVersion: 2,
  enabled: false,
  jinaApiKey: '',
  douban: defaultDoubanSettings()
})

// 用户已明确要求清空旧 MCP。旧结构不迁移，避免旧授权在新能力中被意外继承。
for (const key of LEGACY_KEYS) localStorage.removeItem(key)
const stored = readStoredJSON<Partial<McpSettings>>(SETTINGS_KEY, {})
const storedWebKey = isNativeMobileApp() ? '' : String(localStorage.getItem(JINA_KEY) || stored.jinaApiKey || '')
const initial = stored.schemaVersion === 2
  ? { ...defaults(), ...stored, douban: { ...defaultDoubanSettings(), ...(stored.douban || {}) } }
  : defaults()
initial.jinaApiKey = storedWebKey
if (initial.douban.triggerMode === 'confirm') initial.douban.showCapabilityCard = true

export const mcpSettings = reactive<McpSettings>(initial)

watch(mcpSettings, value => {
  const { jinaApiKey: _secret, ...safeSettings } = value
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(safeSettings))
}, { deep: true })

let nativeSecretReady = !isNativeMobileApp()
if (isNativeMobileApp()) void getSecureValue(JINA_KEY).then(value => {
  mcpSettings.jinaApiKey = value || ''
  nativeSecretReady = true
})
watch(() => mcpSettings.jinaApiKey, value => {
  if (!nativeSecretReady) return
  if (isNativeMobileApp()) void setSecureValue(JINA_KEY, value)
  else if (value) localStorage.setItem(JINA_KEY, value)
  else localStorage.removeItem(JINA_KEY)
})

export const resetMcpSettings = () => Object.assign(mcpSettings, defaults())
