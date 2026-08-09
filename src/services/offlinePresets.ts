/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type OfflineModelProfile = 'auto' | 'openai-compatible' | 'deepseek-chat' | 'deepseek-reasoner' | 'claude' | 'gemini'
export type OfflinePresetSource = 'builtin' | 'user'
export type OfflinePromptSection = 'main' | 'mode' | 'postHistory'

export interface OfflinePromptEntry {
  id: string
  name: string
  content: string
  enabled: boolean
  section: OfflinePromptSection
}

export interface OfflinePromptPreset {
  id: string
  name: string
  description: string
  version: number
  source: OfflinePresetSource
  mainPrompt: string
  modePrompt: string
  postHistoryPrompt: string
  entries?: OfflinePromptEntry[]
}

export interface OfflinePresetSettingsData {
  version: number
  currentPresetId: string
  presets: OfflinePromptPreset[]
}

export const OFFLINE_PRESET_STORAGE_KEY = 'clingy_offline_prompt_presets'
export const OFFLINE_PRESET_SCHEMA_VERSION = 1

export const defaultOfflinePresets: OfflinePromptPreset[] = [
  {
    id: 'offline_default',
    name: '官方 Default',
    description: '自然、稳定的线下面对面互动，按场景自动决定详略。',
    version: 1,
    source: 'builtin',
    mainPrompt: '续写{{char_name}}与{{user_name}}当前的线下面对面互动。只生成{{char_name}}的下一次回应。',
    modePrompt: `<offline_mode>
当前互动发生在线下面对面的现实场景中，而不是手机聊天。
{{char_name}}可以通过语言、神态、视线、动作、距离和对环境的反应自然表达自己。
保持既有角色、关系、场景和事件连续性。
</offline_mode>`,
    postHistoryPrompt: `<response_rules>
- 只生成{{char_name}}的下一次回应。
- 不替{{user_name}}说话、行动、思考、感受或作出选择。
- 不重复已经发生的内容，不总结场景，不跳出角色。
- 根据当前情境决定回复长度；简单动作可以很短，重要场景可以更细致。
- 回复正文使用一个完整的 <msg>...</msg>；系统另行提供的已启用功能标签可以独立输出。
</response_rules>`
  },
  {
    id: 'offline_concise',
    name: '简短互动',
    description: '对白优先、少量动作，适合日常快速交流。',
    version: 1,
    source: 'builtin',
    mainPrompt: '续写{{char_name}}与{{user_name}}当前的线下面对面互动。只生成{{char_name}}的下一次回应。',
    modePrompt: `<offline_mode>
当前互动发生在线下面对面的现实场景中。保持既有角色、关系和场景连续性，以自然对白为主，只补充必要的神态与动作。
</offline_mode>`,
    postHistoryPrompt: `<response_rules>
- 只控制{{char_name}}，不要替{{user_name}}决定任何言行、心理或感受。
- 回复保持简短自然，通常一至两段，不重复上下文。
- 回复正文使用一个完整的 <msg>...</msg>；系统另行提供的已启用功能标签可以独立输出。
</response_rules>`
  },
  {
    id: 'offline_immersive',
    name: '沉浸叙事',
    description: '强化动作、情绪、距离与环境细节，适合重要场景。',
    version: 1,
    source: 'builtin',
    mainPrompt: '续写{{char_name}}与{{user_name}}当前的线下面对面互动。只生成{{char_name}}的下一次回应，并让情节自然向前发展。',
    modePrompt: `<offline_mode>
当前互动发生在线下面对面的现实场景中。始终保持角色，缓慢而自然地发展情节。
描写与当前回应有关的动作、情绪、视线、距离、声音和环境感受，但不要为了细致而堆砌辞藻。
保持地点、时间、服装、物品和人物位置的连续性。
</offline_mode>`,
    postHistoryPrompt: `<response_rules>
- 只生成{{char_name}}的一次回应，不替{{user_name}}说话、行动、思考、感受或选择。
- 通常写一至四个自然段；简单情境仍可简短。
- 不复述、不总结、不跳出角色，不擅自制造巨大时间跳跃或地点切换。
- 回复正文使用一个完整的 <msg>...</msg>；系统另行提供的已启用功能标签可以独立输出。
</response_rules>`
  }
]

const cloneDefaults = () => JSON.parse(JSON.stringify(defaultOfflinePresets)) as OfflinePromptPreset[]

const sectionMeta: Record<OfflinePromptSection, { name: string; field: 'mainPrompt' | 'modePrompt' | 'postHistoryPrompt' }> = {
  main: { name: '主要任务', field: 'mainPrompt' },
  mode: { name: '线下模式', field: 'modePrompt' },
  postHistory: { name: '回复规则', field: 'postHistoryPrompt' }
}

const splitLegacyContent = (content: string) => {
  const normalized = content.trim().replace(/\r\n/g, '\n')
  const withoutWrapper = normalized.replace(/^<([a-z_][\w-]*)>\s*\n?/i, '').replace(/\n?\s*<\/([a-z_][\w-]*)>$/i, '')
  return withoutWrapper.split(/\n+/).map(line => line.trim()).filter(Boolean)
}

const inferLegacyEntryName = (content: string, fallback: string, index: number) => {
  const cleaned = content.replace(/^[-*•]\s*/, '').replace(/<[^>]+>/g, '').trim()
  if (!cleaned) return `${fallback} ${index + 1}`
  return cleaned.length > 18 ? `${cleaned.slice(0, 18)}…` : cleaned
}

export const createOfflineEntriesFromLegacy = (preset: OfflinePromptPreset): OfflinePromptEntry[] => (
  (Object.keys(sectionMeta) as OfflinePromptSection[]).flatMap(section => {
    const meta = sectionMeta[section]
    const parts = splitLegacyContent(preset[meta.field] || '')
    return parts.map((content, index) => ({
      id: `offline_entry_${preset.id}_${section}_${index}`,
      name: inferLegacyEntryName(content, meta.name, index),
      content,
      enabled: true,
      section
    }))
  })
)

export const getOfflinePresetEntries = (preset: OfflinePromptPreset): OfflinePromptEntry[] => {
  if (Array.isArray(preset.entries) && preset.entries.length) {
    return preset.entries
      .filter(entry => entry && typeof entry.content === 'string' && entry.section in sectionMeta)
      .map((entry, index) => ({
        id: typeof entry.id === 'string' && entry.id ? entry.id : `offline_entry_${Date.now()}_${index}`,
        name: typeof entry.name === 'string' && entry.name.trim() ? entry.name : `条目 ${index + 1}`,
        content: entry.content,
        enabled: entry.enabled !== false,
        section: entry.section
      }))
  }
  return createOfflineEntriesFromLegacy(preset)
}

export const resolveOfflinePresetSection = (preset: OfflinePromptPreset, section: OfflinePromptSection): string => {
  if (!Array.isArray(preset.entries) || !preset.entries.length) return preset[sectionMeta[section].field]
  return getOfflinePresetEntries(preset)
    .filter(entry => entry.enabled && entry.section === section)
    .map(entry => entry.content.trim())
    .filter(Boolean)
    .join('\n\n')
}

export const syncOfflinePresetLegacyFields = (preset: OfflinePromptPreset): OfflinePromptPreset => {
  preset.mainPrompt = resolveOfflinePresetSection(preset, 'main')
  preset.modePrompt = resolveOfflinePresetSection(preset, 'mode')
  preset.postHistoryPrompt = resolveOfflinePresetSection(preset, 'postHistory')
  return preset
}

const isPreset = (value: any): value is OfflinePromptPreset => Boolean(
  value && typeof value.id === 'string' && typeof value.name === 'string' &&
  typeof value.mainPrompt === 'string' && typeof value.modePrompt === 'string' &&
  typeof value.postHistoryPrompt === 'string'
)

export const loadOfflinePresetSettings = (): OfflinePresetSettingsData => {
  let saved: Partial<OfflinePresetSettingsData> = {}
  try {
    saved = JSON.parse(localStorage.getItem(OFFLINE_PRESET_STORAGE_KEY) || '{}')
  } catch (error) {
    console.warn('线下预设数据损坏，已恢复官方配置。', error)
  }

  const userPresets = Array.isArray(saved.presets)
    ? saved.presets.filter(isPreset).filter(item => item.source !== 'builtin').map(item => ({
        ...item,
        source: 'user' as const,
        version: Number(item.version) || 1,
        description: typeof item.description === 'string' ? item.description : ''
      }))
    : []

  const presets = [...cloneDefaults(), ...userPresets]
  const requestedId = typeof saved.currentPresetId === 'string' ? saved.currentPresetId : 'offline_default'

  return {
    version: OFFLINE_PRESET_SCHEMA_VERSION,
    currentPresetId: presets.some(item => item.id === requestedId) ? requestedId : 'offline_default',
    presets
  }
}

export const serializeOfflinePresetSettings = (settings: OfflinePresetSettingsData) => ({
  version: OFFLINE_PRESET_SCHEMA_VERSION,
  currentPresetId: settings.currentPresetId,
  // 内置预设由应用版本维护，避免旧副本覆盖官方升级。
  presets: settings.presets.filter(item => item.source === 'user')
})

export const createOfflinePresetCopy = (source: OfflinePromptPreset, name?: string): OfflinePromptPreset => ({
  ...JSON.parse(JSON.stringify(source)),
  id: `offline_user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  name: name?.trim() || `${source.name} 副本`,
  description: source.description,
  version: 1,
  source: 'user'
})

export const validateImportedOfflinePresets = (raw: unknown): OfflinePromptPreset[] => {
  const source = Array.isArray(raw) ? raw : (raw as any)?.presets
  if (!Array.isArray(source)) throw new Error('导入内容中没有预设列表。')

  const presets = source.filter(isPreset).map((item: OfflinePromptPreset, index: number) => ({
    ...item,
    id: `offline_user_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
    name: item.name.trim() || `导入预设 ${index + 1}`,
    description: typeof item.description === 'string' ? item.description : '',
    version: Number(item.version) || 1,
    source: 'user' as const
  }))

  if (presets.length === 0) throw new Error('没有找到有效的线下预设。')
  return presets
}

export const replacePromptVariables = (content: string, values: Record<string, string>) => {
  let resolved = content
  for (const [key, value] of Object.entries(values)) {
    resolved = resolved.split(`{{${key}}}`).join(value)
  }
  return resolved
}

export const getOfflineModelProfileLabel = (profile: OfflineModelProfile) => ({
  auto: '自动适配（推荐）',
  'openai-compatible': 'OpenAI 兼容',
  'deepseek-chat': 'DeepSeek Chat',
  'deepseek-reasoner': 'DeepSeek Reasoner',
  claude: 'Claude Native',
  gemini: 'Gemini Native'
}[profile])
