/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, watch } from 'vue'
import { readStoredJSON } from './utils'

export interface ApiPreset {
  id: string
  name: string
  provider: string
  url: string
  key: string
  model: string
  customUrl: string
  customKey: string
  enableTemperature?: boolean
  temperature?: number
  enableMaxTokens?: boolean
  maxTokens?: number
  enableTopP?: boolean
  topP?: number
  enableFrequencyPenalty?: boolean
  frequencyPenalty?: number
  enablePresencePenalty?: boolean
  presencePenalty?: number
  enableStream?: boolean
  batchSize?: number
}

const API_STORAGE_KEY = 'clingy_api_settings'
const savedApiSettings = readStoredJSON<Record<string, any>>(API_STORAGE_KEY, {})

export const apiSettings = reactive({
  provider: savedApiSettings.provider || 'deepseek',
  url: savedApiSettings.url ?? 'https://api.deepseek.com',
  key: savedApiSettings.key ?? '',
  model: savedApiSettings.model ?? '',
  availableModels: savedApiSettings.availableModels || [],
  apiClassicTheme: savedApiSettings.apiClassicTheme || 'default',
  customUrl: savedApiSettings.customUrl ?? '',
  customKey: savedApiSettings.customKey ?? '',
  enableTemperature: savedApiSettings.enableTemperature ?? false,
  temperature: savedApiSettings.temperature ?? 0.7,
  enableMaxTokens: savedApiSettings.enableMaxTokens ?? false,
  maxTokens: savedApiSettings.maxTokens ?? 1000,
  enableTopP: savedApiSettings.enableTopP ?? false,
  topP: savedApiSettings.topP ?? 1.0,
  enableFrequencyPenalty: savedApiSettings.enableFrequencyPenalty ?? false,
  frequencyPenalty: savedApiSettings.frequencyPenalty ?? 0,
  enablePresencePenalty: savedApiSettings.enablePresencePenalty ?? false,
  presencePenalty: savedApiSettings.presencePenalty ?? 0,
  enableStream: savedApiSettings.enableStream ?? false,
  presets: (savedApiSettings.presets || []) as ApiPreset[],
  currentPresetId: savedApiSettings.currentPresetId ?? '',
  enableApiLogging: savedApiSettings.enableApiLogging ?? false,
  apiLogMaxCount: savedApiSettings.apiLogMaxCount ?? 1000
})

watch(apiSettings, (newVal) => {
  localStorage.setItem(API_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const VISION_API_STORAGE_KEY = 'clingy_vision_api_settings'
const savedVisionApiSettings = readStoredJSON<Record<string, any>>(VISION_API_STORAGE_KEY, {})

export const visionApiSettings = reactive({
  enabled: savedVisionApiSettings.enabled ?? false,
  provider: savedVisionApiSettings.provider || 'deepseek',
  url: savedVisionApiSettings.url ?? 'https://api.deepseek.com',
  key: savedVisionApiSettings.key ?? '',
  model: savedVisionApiSettings.model ?? '',
  availableModels: savedVisionApiSettings.availableModels || [],
  customUrl: savedVisionApiSettings.customUrl ?? '',
  customKey: savedVisionApiSettings.customKey ?? '',
  enableTemperature: savedVisionApiSettings.enableTemperature ?? false,
  temperature: savedVisionApiSettings.temperature ?? 0.7,
  enableMaxTokens: savedVisionApiSettings.enableMaxTokens ?? false,
  maxTokens: savedVisionApiSettings.maxTokens ?? 1000,
  enableTopP: savedVisionApiSettings.enableTopP ?? false,
  topP: savedVisionApiSettings.topP ?? 1.0,
  enableFrequencyPenalty: savedVisionApiSettings.enableFrequencyPenalty ?? false,
  frequencyPenalty: savedVisionApiSettings.frequencyPenalty ?? 0,
  enablePresencePenalty: savedVisionApiSettings.enablePresencePenalty ?? false,
  presencePenalty: savedVisionApiSettings.presencePenalty ?? 0,
  enableStream: savedVisionApiSettings.enableStream ?? false,
  presets: (savedVisionApiSettings.presets || []) as ApiPreset[],
  currentPresetId: savedVisionApiSettings.currentPresetId ?? ''
})

watch(visionApiSettings, (newVal) => {
  localStorage.setItem(VISION_API_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const SUMMARY_API_STORAGE_KEY = 'clingy_summary_api_settings'
const savedSummaryApiSettings = readStoredJSON<Record<string, any>>(SUMMARY_API_STORAGE_KEY, {})

export const summaryApiSettings = reactive({
  enabled: savedSummaryApiSettings.enabled ?? false,
  provider: savedSummaryApiSettings.provider || 'deepseek',
  url: savedSummaryApiSettings.url ?? 'https://api.deepseek.com',
  key: savedSummaryApiSettings.key ?? '',
  model: savedSummaryApiSettings.model ?? '',
  availableModels: savedSummaryApiSettings.availableModels || [],
  customUrl: savedSummaryApiSettings.customUrl ?? '',
  customKey: savedSummaryApiSettings.customKey ?? '',
  enableTemperature: savedSummaryApiSettings.enableTemperature ?? false,
  temperature: savedSummaryApiSettings.temperature ?? 0.7,
  enableMaxTokens: savedSummaryApiSettings.enableMaxTokens ?? false,
  maxTokens: savedSummaryApiSettings.maxTokens ?? 1000,
  enableTopP: savedSummaryApiSettings.enableTopP ?? false,
  topP: savedSummaryApiSettings.topP ?? 1.0,
  enableFrequencyPenalty: savedSummaryApiSettings.enableFrequencyPenalty ?? false,
  frequencyPenalty: savedSummaryApiSettings.frequencyPenalty ?? 0,
  enablePresencePenalty: savedSummaryApiSettings.enablePresencePenalty ?? false,
  presencePenalty: savedSummaryApiSettings.presencePenalty ?? 0,
  enableStream: savedSummaryApiSettings.enableStream ?? false,
  presets: (savedSummaryApiSettings.presets || []) as ApiPreset[],
  currentPresetId: savedSummaryApiSettings.currentPresetId ?? ''
})

watch(summaryApiSettings, (newVal) => {
  localStorage.setItem(SUMMARY_API_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const EMBEDDING_API_STORAGE_KEY = 'clingy_embedding_api_settings'
const savedEmbeddingApiSettings = readStoredJSON<Record<string, any>>(EMBEDDING_API_STORAGE_KEY, {})

// 向量节点完全可选。未启用时，长期记忆自动降级为关键词、标签、时间与重要度混合检索。
export const embeddingApiSettings = reactive({
  enabled: savedEmbeddingApiSettings.enabled ?? false,
  provider: savedEmbeddingApiSettings.provider || 'openai',
  url: savedEmbeddingApiSettings.url ?? 'https://api.openai.com',
  key: savedEmbeddingApiSettings.key ?? '',
  model: savedEmbeddingApiSettings.model ?? '',
  availableModels: savedEmbeddingApiSettings.availableModels || [],
  customUrl: savedEmbeddingApiSettings.customUrl ?? '',
  customKey: savedEmbeddingApiSettings.customKey ?? '',
  batchSize: savedEmbeddingApiSettings.batchSize ?? 20,
  presets: (savedEmbeddingApiSettings.presets || []) as ApiPreset[],
  currentPresetId: savedEmbeddingApiSettings.currentPresetId ?? ''
})

watch(embeddingApiSettings, (newVal) => {
  localStorage.setItem(EMBEDDING_API_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const MOMENT_API_STORAGE_KEY = 'clingy_moment_api_settings'
const savedMomentApiSettings = readStoredJSON<Record<string, any>>(MOMENT_API_STORAGE_KEY, {})

// 朋友圈专用节点只接管角色读取朋友圈后的第二轮回应。
// 未启用或配置不完整时，调用层会自动继续使用全局节点。
export const momentApiSettings = reactive({
  enabled: savedMomentApiSettings.enabled ?? false,
  provider: savedMomentApiSettings.provider || 'deepseek',
  url: savedMomentApiSettings.url ?? 'https://api.deepseek.com',
  key: savedMomentApiSettings.key ?? '',
  model: savedMomentApiSettings.model ?? '',
  availableModels: savedMomentApiSettings.availableModels || [],
  customUrl: savedMomentApiSettings.customUrl ?? '',
  customKey: savedMomentApiSettings.customKey ?? '',
  enableTemperature: savedMomentApiSettings.enableTemperature ?? false,
  temperature: savedMomentApiSettings.temperature ?? 0.7,
  enableMaxTokens: savedMomentApiSettings.enableMaxTokens ?? true,
  maxTokens: savedMomentApiSettings.maxTokens ?? 500,
  enableTopP: savedMomentApiSettings.enableTopP ?? false,
  topP: savedMomentApiSettings.topP ?? 1.0,
  enableFrequencyPenalty: savedMomentApiSettings.enableFrequencyPenalty ?? false,
  frequencyPenalty: savedMomentApiSettings.frequencyPenalty ?? 0,
  enablePresencePenalty: savedMomentApiSettings.enablePresencePenalty ?? false,
  presencePenalty: savedMomentApiSettings.presencePenalty ?? 0,
  enableStream: savedMomentApiSettings.enableStream ?? false,
  presets: (savedMomentApiSettings.presets || []) as ApiPreset[],
  currentPresetId: savedMomentApiSettings.currentPresetId ?? ''
})

watch(momentApiSettings, (newVal) => {
  localStorage.setItem(MOMENT_API_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })
