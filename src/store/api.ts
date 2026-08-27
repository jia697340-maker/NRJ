/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, watch } from 'vue'
import { readStoredJSON } from './utils'
import type { NewApiNodeInfo } from '../services/newApiNode'
import { apiCapabilityRegistry, type ApiCapabilityId } from '../services/apiCapabilities'

export interface ApiPreset {
  id: string
  name: string
  provider: string
  url: string
  key: string
  model: string
  adapterProfile?: string
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

export interface ApiParameterSettings {
  enableTemperature: boolean
  temperature: number
  enableMaxTokens: boolean
  maxTokens: number
  enableTopP: boolean
  topP: number
  enableFrequencyPenalty: boolean
  frequencyPenalty: number
  enablePresencePenalty: boolean
  presencePenalty: number
  enableStream: boolean
}

export interface ApiCapabilityOverride {
  inheritModel: boolean
  model: string
  inheritParameters: boolean
  parameters: ApiParameterSettings
}

export interface ApiNode extends ApiParameterSettings {
  id: string
  name: string
  enabled: boolean
  provider: string
  url: string
  key: string
  model: string
  availableModels: string[]
  adapterProfile: string
  customUrl: string
  customKey: string
  presets: ApiPreset[]
  currentPresetId: string
  newApiNode: NewApiNodeInfo | null
  batchSize: number
  fallbackToDefault: boolean
  capabilities: Partial<Record<ApiCapabilityId, ApiCapabilityOverride>>
  createdAt: number
  updatedAt: number
}

export interface ApiNodesState {
  schemaVersion: 1
  nodes: ApiNode[]
  migratedAt: number
  migrationNotes: string[]
  legacyReconciliationVersion: number
}

export type ApiNodeConflictResolution = 'keep-current' | 'take-over'

const API_STORAGE_KEY = 'clingy_api_settings'
const API_NODES_STORAGE_KEY = 'clingy_api_nodes_v1'
const savedApiSettings = readStoredJSON<Record<string, any>>(API_STORAGE_KEY, {})

const parameterDefaults = (source: Record<string, any> = {}): ApiParameterSettings => ({
  enableTemperature: source.enableTemperature ?? false,
  temperature: Number(source.temperature ?? 0.7),
  enableMaxTokens: source.enableMaxTokens ?? false,
  maxTokens: Number(source.maxTokens ?? 1000),
  enableTopP: source.enableTopP ?? false,
  topP: Number(source.topP ?? 1),
  enableFrequencyPenalty: source.enableFrequencyPenalty ?? false,
  frequencyPenalty: Number(source.frequencyPenalty ?? 0),
  enablePresencePenalty: source.enablePresencePenalty ?? false,
  presencePenalty: Number(source.presencePenalty ?? 0),
  enableStream: source.enableStream ?? false
})

export const apiSettings = reactive({
  provider: savedApiSettings.provider || 'deepseek',
  url: savedApiSettings.url ?? 'https://api.deepseek.com',
  key: savedApiSettings.key ?? '',
  model: savedApiSettings.model ?? '',
  availableModels: savedApiSettings.availableModels || [],
  adapterProfile: savedApiSettings.adapterProfile || 'auto',
  apiClassicTheme: savedApiSettings.apiClassicTheme || 'default',
  customUrl: savedApiSettings.customUrl ?? '',
  customKey: savedApiSettings.customKey ?? '',
  ...parameterDefaults(savedApiSettings),
  presets: (savedApiSettings.presets || []) as ApiPreset[],
  currentPresetId: savedApiSettings.currentPresetId ?? '',
  newApiNode: (savedApiSettings.newApiNode || null) as NewApiNodeInfo | null,
  enableApiLogging: savedApiSettings.enableApiLogging ?? false,
  apiLogMaxCount: savedApiSettings.apiLogMaxCount ?? 1000
})

watch(apiSettings, value => localStorage.setItem(API_STORAGE_KEY, JSON.stringify(value)), { deep: true })

const makeId = (prefix = 'api_node') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
// url/key 是节点编辑器的当前值；customUrl/customKey 仅作为旧数据兼容回退，
// 避免用户修改自定义节点后仍被历史字段中的旧地址或旧密钥覆盖。
const effectiveUrl = (settings: { provider: string; url: string; customUrl: string }) => settings.url || settings.customUrl
const effectiveKey = (settings: { provider: string; key: string; customKey: string }) => settings.key || settings.customKey

const createCapabilityOverride = (source: Record<string, any>, base: Record<string, any>): ApiCapabilityOverride => {
  const sourceParameters = parameterDefaults(source)
  const baseParameters = parameterDefaults(base)
  return {
    inheritModel: String(source.model || '') === String(base.model || ''),
    model: String(source.model || ''),
    inheritParameters: JSON.stringify(sourceParameters) === JSON.stringify(baseParameters),
    parameters: sourceParameters
  }
}

const createNodeFromSettings = (name: string, source: Record<string, any>): ApiNode => ({
  id: makeId(),
  name,
  enabled: source.enabled !== false,
  provider: source.provider || 'deepseek',
  url: source.url || '',
  key: source.key || '',
  model: source.model || '',
  availableModels: Array.isArray(source.availableModels) ? [...source.availableModels] : [],
  adapterProfile: source.adapterProfile || 'auto',
  customUrl: source.customUrl || '',
  customKey: source.customKey || '',
  ...parameterDefaults(source),
  presets: Array.isArray(source.presets) ? source.presets.map((item: ApiPreset) => ({ ...item })) : [],
  currentPresetId: source.currentPresetId || '',
  newApiNode: source.newApiNode ? { ...source.newApiNode } : null,
  batchSize: Math.max(1, Math.min(100, Number(source.batchSize || 20))),
  fallbackToDefault: source.fallbackToDefault !== false,
  capabilities: {},
  createdAt: Date.now(),
  updatedAt: Date.now()
})

const connectionFingerprint = (source: Record<string, any>) => [
  source.provider || 'deepseek',
  effectiveUrl({ provider: source.provider || 'deepseek', url: source.url || '', customUrl: source.customUrl || '' }).replace(/\/+$/, ''),
  effectiveKey({ provider: source.provider || 'deepseek', key: source.key || '', customKey: source.customKey || '' }),
  source.adapterProfile || 'auto'
].join('\u0001')

type LegacyCandidate = { name: string; sourceKey: string; settings: Record<string, any>; capabilities: ApiCapabilityId[] }

const collectNestedNaiCandidates = () => {
  const candidates: LegacyCandidate[] = []
  if (typeof localStorage === 'undefined') return candidates
  const seen = new Set<string>()
  const visit = (value: any) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(visit); return }
    const config = value.naiConfig
    if (config?.llmApiUrl && config.llmApiKey && config.llmModel) {
      const fingerprint = `${config.llmApiUrl}\u0001${config.llmApiKey}\u0001${config.llmModel}`
      if (!seen.has(fingerprint)) {
        seen.add(fingerprint)
        candidates.push({ name: '旧 NAI 生图辅助', sourceKey: `nai_${seen.size}`, settings: { enabled: config.enableLlmAssist === true, provider: config.llmProvider || 'custom', url: config.llmApiUrl, key: config.llmApiKey, customUrl: config.llmApiUrl, customKey: config.llmApiKey, model: config.llmModel, enableTemperature: true, temperature: 0.7, enableMaxTokens: true, maxTokens: 1000 }, capabilities: [] })
      }
    }
    Object.values(value).forEach(visit)
  }
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key || (!key.includes('chat') && !key.includes('contact'))) continue
    try { visit(JSON.parse(localStorage.getItem(key) || 'null')) } catch { /* 非 JSON 存储无需迁移。 */ }
  }
  return candidates
}

const migrateLegacyNodes = (): ApiNodesState => {
  const notes: string[] = []
  const candidates: LegacyCandidate[] = []
  const add = (sourceKey: string, name: string, capabilities: ApiCapabilityId[]) => {
    const settings = readStoredJSON<Record<string, any>>(sourceKey, {})
    if (typeof localStorage === 'undefined' || localStorage.getItem(sourceKey) === null) return
    candidates.push({ name, sourceKey, settings: { ...settings, enabled: settings.enabled === true }, capabilities })
  }
  add('clingy_summary_api_settings', '总结节点', ['summary'])
  add('clingy_vision_api_settings', '图像辅助节点', ['vision-understanding', 'image-prompt'])
  add('clingy_moment_api_settings', '朋友圈与社交节点', ['moment-interaction', 'social-generation'])
  add('clingy_character_api_settings', '角色与人设节点', ['character-workshop'])
  add('clingy_embedding_api_settings', '向量节点', ['embedding'])

  const forum = readStoredJSON<Record<string, any>>('clingy_forum_api_settings', {})
  if (typeof localStorage !== 'undefined' && localStorage.getItem('clingy_forum_api_settings') !== null) {
    const scopes = new Set<string>(forum.bindAllForum !== false ? ['forum-post', 'forum-comment', 'forum-dm'] : (forum.scopes || []))
    const capabilities: ApiCapabilityId[] = []
    if (['forum-account', 'forum-circle', 'forum-population', 'forum-post'].some(item => scopes.has(item))) capabilities.push('forum-content')
    if (scopes.has('forum-comment')) capabilities.push('forum-interaction')
    if (scopes.has('forum-dm')) capabilities.push('forum-dm')
    if (['forum-group', 'forum-media', 'forum-memory'].some(item => scopes.has(item))) notes.push('旧论坛节点中的群组、媒体或记忆选项没有对应 LLM 调用，未创建无效绑定。')
    candidates.push({ name: '论坛节点', sourceKey: 'clingy_forum_api_settings', settings: { ...forum, enabled: forum.enabled === true }, capabilities })
  }

  const llmPresets = readStoredJSON<any[]>('app_llm_presets', [])
  llmPresets.filter(item => item?.apiUrl && item?.apiKey && item?.model).forEach((item, index) => candidates.push({
    name: `NAI 辅助 · ${String(item.name || index + 1)}`,
    sourceKey: `app_llm_presets_${index}`,
    settings: { enabled: true, provider: item.provider || 'custom', url: item.apiUrl, key: item.apiKey, customUrl: item.apiUrl, customKey: item.apiKey, model: item.model, enableTemperature: true, temperature: 0.7, enableMaxTokens: true, maxTokens: 1000 },
    capabilities: []
  }))
  candidates.push(...collectNestedNaiCandidates())

  const nodes: ApiNode[] = []
  const namesByNode = new Map<string, string[]>()
  const assigned = new Set<ApiCapabilityId>()
  for (const candidate of candidates) {
    const fingerprint = connectionFingerprint(candidate.settings)
    let node = nodes.find(item => connectionFingerprint(item) === fingerprint && item.enabled === (candidate.settings.enabled !== false))
    if (!node) {
      node = createNodeFromSettings(candidate.name, candidate.settings)
      nodes.push(node)
      namesByNode.set(node.id, [])
    }
    namesByNode.get(node.id)!.push(candidate.name.replace(/节点$/, ''))
    for (const capability of candidate.capabilities) {
      if (assigned.has(capability)) {
        notes.push(`${apiCapabilityRegistry[capability].name}存在多份旧配置，已保留额外节点但仅绑定第一份有效配置。`)
        continue
      }
      node.capabilities[capability] = createCapabilityOverride(candidate.settings, node)
      assigned.add(capability)
    }
    const prefix = candidate.sourceKey.replace(/[^a-z0-9]+/gi, '_')
    const importedPresets = (candidate.settings.presets || []).map((preset: ApiPreset) => ({ ...preset, id: `${prefix}_${preset.id}` }))
    for (const preset of importedPresets) if (!node.presets.some(item => item.id === preset.id)) node.presets.push(preset)
  }
  const imagePromptOwner = nodes.some(node => node.enabled && node.capabilities['image-prompt'])
  if (!imagePromptOwner) {
    const naiNode = nodes.find(node => node.name.startsWith('NAI') || node.name.startsWith('旧 NAI'))
    if (naiNode) {
      naiNode.capabilities['image-prompt'] = createCapabilityOverride(naiNode, naiNode)
      notes.push('已将第一份旧 NAI LLM 配置绑定到“生图提示词辅助”，其他旧配置保留为未绑定节点。')
    }
  }
  nodes.forEach(node => {
    const names = [...new Set(namesByNode.get(node.id) || [node.name])]
    if (names.length > 1) node.name = `迁移节点 · ${names.join(' / ')}`
  })
  return { schemaVersion: 1, nodes, migratedAt: Date.now(), migrationNotes: [...new Set(notes)], legacyReconciliationVersion: 2 }
}

const savedNodesState = readStoredJSON<Partial<ApiNodesState>>(API_NODES_STORAGE_KEY, {})
const initialNodesState = savedNodesState.schemaVersion === 1 && Array.isArray(savedNodesState.nodes)
  ? { schemaVersion: 1 as const, nodes: savedNodesState.nodes.map(node => ({ ...node, fallbackToDefault: node.fallbackToDefault !== false })), migratedAt: Number(savedNodesState.migratedAt || Date.now()), migrationNotes: savedNodesState.migrationNotes || [], legacyReconciliationVersion: Number(savedNodesState.legacyReconciliationVersion || 0) }
  : migrateLegacyNodes()

// 兼容已经打开过重构版本的用户：旧的停用节点或后发现的 NAI 配置也要补迁移，
// 但绝不覆盖用户已经在新节点页面做过的编辑。
if (savedNodesState.schemaVersion === 1 && Array.isArray(savedNodesState.nodes) && initialNodesState.legacyReconciliationVersion < 2) {
  const supplemental = migrateLegacyNodes()
  for (const legacyNode of supplemental.nodes) {
    if (legacyNode.enabled) continue
    const existing = initialNodesState.nodes.find(node => connectionFingerprint(node) === connectionFingerprint(legacyNode))
    if (!existing) initialNodesState.nodes.push(legacyNode)
  }
  initialNodesState.migrationNotes = [...new Set([...initialNodesState.migrationNotes, ...supplemental.migrationNotes])]
  initialNodesState.legacyReconciliationVersion = 2
}

export const apiNodesState = reactive<ApiNodesState>(initialNodesState)
localStorage.setItem(API_NODES_STORAGE_KEY, JSON.stringify(apiNodesState))
watch(apiNodesState, value => localStorage.setItem(API_NODES_STORAGE_KEY, JSON.stringify(value)), { deep: true })

export const createEmptyApiNode = (name = '新节点') => createNodeFromSettings(name, { enabled: true, provider: 'deepseek', url: 'https://api.deepseek.com' })

export const addApiNode = (node: ApiNode) => {
  node.name = node.name.trim() || '未命名节点'
  node.updatedAt = Date.now()
  apiNodesState.nodes.push(node)
  return node
}

export const findApiNode = (nodeId: string) => apiNodesState.nodes.find(node => node.id === nodeId)

export const getCapabilityOwner = (capability: ApiCapabilityId, excludeNodeId = '') => apiNodesState.nodes.find(node => (
  node.enabled && node.id !== excludeNodeId && Boolean(node.capabilities[capability])
))

export const setApiNodeCapability = (nodeId: string, capability: ApiCapabilityId, selected: boolean) => {
  const node = findApiNode(nodeId)
  if (!node || !apiCapabilityRegistry[capability].assignable) return { ok: false, owner: undefined as ApiNode | undefined }
  if (!selected) {
    delete node.capabilities[capability]
    node.updatedAt = Date.now()
    return { ok: true, owner: undefined }
  }
  const owner = getCapabilityOwner(capability, nodeId)
  if (node.enabled && owner) return { ok: false, owner }
  node.capabilities[capability] ||= createCapabilityOverride(node, node)
  node.updatedAt = Date.now()
  return { ok: true, owner: undefined }
}

export const getApiNodeEnableConflicts = (nodeId: string) => {
  const node = findApiNode(nodeId)
  if (!node) return []
  return (Object.keys(node.capabilities) as ApiCapabilityId[]).flatMap(capability => {
    const owner = getCapabilityOwner(capability, nodeId)
    return owner ? [{ capability, owner }] : []
  })
}

export const setApiNodeEnabled = (nodeId: string, enabled: boolean, resolution?: ApiNodeConflictResolution) => {
  const node = findApiNode(nodeId)
  if (!node) return { ok: false, conflicts: [] as ReturnType<typeof getApiNodeEnableConflicts> }
  if (!enabled) { node.enabled = false; node.updatedAt = Date.now(); return { ok: true, conflicts: [] } }
  const conflicts = getApiNodeEnableConflicts(nodeId)
  if (conflicts.length && !resolution) return { ok: false, conflicts }
  if (resolution === 'keep-current') conflicts.forEach(({ capability }) => delete node.capabilities[capability])
  if (resolution === 'take-over') conflicts.forEach(({ capability, owner }) => delete owner.capabilities[capability])
  node.enabled = true
  node.updatedAt = Date.now()
  return { ok: true, conflicts: [] }
}

export const deleteApiNode = (nodeId: string) => {
  const index = apiNodesState.nodes.findIndex(node => node.id === nodeId)
  if (index < 0) return false
  apiNodesState.nodes.splice(index, 1)
  return true
}

export const isApiSettingsReady = (settings: { provider: string; url: string; key: string; customUrl: string; customKey: string; model: string }) => Boolean(
  effectiveUrl(settings).trim() && effectiveKey(settings).trim() && settings.model.trim()
)

const mergeCapabilitySettings = (node: ApiNode, capability: ApiCapabilityId): ApiNode => {
  const override = node.capabilities[capability]
  if (!override) return node
  const merged = { ...node, capabilities: node.capabilities } as ApiNode
  if (!override.inheritModel && override.model.trim()) merged.model = override.model.trim()
  if (!override.inheritParameters) Object.assign(merged, override.parameters)
  return merged
}

export const resolveApiCapability = (capability: ApiCapabilityId, options: { forceDefault?: boolean; excludeNodeId?: string } = {}) => {
  const definition = apiCapabilityRegistry[capability]
  const owner = !options.forceDefault && definition.assignable
    ? apiNodesState.nodes.find(node => node.enabled && node.id !== options.excludeNodeId && Boolean(node.capabilities[capability]))
    : undefined
  if (owner) {
    const settings = mergeCapabilitySettings(owner, capability)
    if (isApiSettingsReady(settings)) return { capability, definition, settings, node: owner, source: 'custom' as const, fallbackReason: '' }
  }
  if (definition.fallback === 'local-non-vector') return { capability, definition, settings: null, node: owner, source: 'local' as const, fallbackReason: owner ? '节点配置不完整' : '未绑定节点' }
  return { capability, definition, settings: apiSettings, node: owner, source: 'default' as const, fallbackReason: owner ? '节点配置不完整' : '未绑定节点' }
}

export const apiNodeEffectiveUrl = effectiveUrl
export const apiNodeEffectiveKey = effectiveKey
export const API_NODES_KEY = API_NODES_STORAGE_KEY
