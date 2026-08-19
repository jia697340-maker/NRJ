/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, watch } from 'vue'
import { readStoredJSON } from './utils'

export type WebSearchMode = 'managed' | 'self-hosted'

const WEB_SEARCH_STORAGE_KEY = 'clingy_web_search_settings'
const saved = readStoredJSON<Record<string, any>>(WEB_SEARCH_STORAGE_KEY, {})

export const webSearchSettings = reactive({
  mode: (saved.mode === 'self-hosted' ? 'self-hosted' : 'managed') as WebSearchMode,
  selfHostedUrl: String(saved.selfHostedUrl || ''),
  selfHostedToken: String(saved.selfHostedToken || ''),
  maxResults: Math.max(1, Math.min(10, Number(saved.maxResults) || 5)),
  timeoutSeconds: Math.max(5, Math.min(60, Number(saved.timeoutSeconds) || 25))
})

watch(webSearchSettings, value => {
  localStorage.setItem(WEB_SEARCH_STORAGE_KEY, JSON.stringify(value))
}, { deep: true })
