<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SearchableSelect from '../SearchableSelect.vue'
import TextEditModal from '../TextEditModal.vue'
import ApiPresetManageModal from '../ApiPresetManageModal.vue'
import NewApiImportModal from '../NewApiImportModal.vue'
import NewApiNodeStatusCard from '../NewApiNodeStatusCard.vue'
import { apiCapabilityGroups, assignableApiCapabilities, type ApiCapabilityId } from '../../services/apiCapabilities'
import { apiNodeEffectiveKey, apiNodeEffectiveUrl, getCapabilityOwner, setApiNodeCapability, type ApiNode, type ApiPreset } from '../../store'
import { detectNewApiNode, type NewApiDetectionResult } from '../../services/newApiNode'
import { parseAdapterResponse, prepareAdapterRequest, type ModelAdapterProfile } from '../../services/modelAdapters'

const props = defineProps<{ settings: any; node?: ApiNode; isDefault?: boolean; darkMode: boolean; searchQuery?: string }>()
const emit = defineEmits<{ back: []; 'toggle-enabled': []; delete: [] }>()

const providers = [
  { id: 'deepseek', name: 'DeepSeek', defaultUrl: 'https://api.deepseek.com' },
  { id: 'gemini', name: 'Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com' },
  { id: 'claude', name: 'Anthropic Claude', defaultUrl: 'https://api.anthropic.com' },
  { id: 'glm', name: '智谱 GLM', defaultUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'openai', name: 'OpenAI', defaultUrl: 'https://api.openai.com' },
  { id: 'custom', name: '自定义', defaultUrl: '' }
]
const providerOptions = providers.map(item => ({ value: item.id, label: item.name }))
const adapterOptions: Array<{ value: ModelAdapterProfile; label: string }> = [
  { value: 'auto', label: '自动识别（推荐）' }, { value: 'openai-compatible', label: 'OpenAI Chat Completions' },
  { value: 'openai-responses', label: 'OpenAI Responses' }, { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' }, { value: 'glm', label: '智谱 GLM' },
  { value: 'gemini', label: 'Gemini Native' }, { value: 'claude', label: 'Claude Native' }
]
const modelOptions = computed(() => (props.settings.availableModels || []).map((model: string) => ({ value: model, label: model })))
const presetOptions = computed(() => [
  { value: '', label: '未选择预设 (当前临时配置)' },
  ...(props.settings.presets || []).map((item: ApiPreset) => ({ value: item.id, label: item.name }))
])
const visibleGroups = computed(() => apiCapabilityGroups.map(group => ({
  ...group,
  items: assignableApiCapabilities.filter(item => item.group === group.id)
})).filter(group => group.items.length))
const selectedCapabilities = computed(() => props.node ? Object.keys(props.node.capabilities) as ApiCapabilityId[] : [])
const hasForumCapability = computed(() => selectedCapabilities.value.some(id => id.startsWith('forum-')))
const hasEmbeddingCapability = computed(() => selectedCapabilities.value.includes('embedding'))
const isEmbeddingOnly = computed(() => selectedCapabilities.value.length === 1 && selectedCapabilities.value[0] === 'embedding')
const advancedOpen = ref(false)
const capabilityOpen = ref<ApiCapabilityId | ''>('')
const showPassword = ref(false)
const syncing = ref(false)
const syncMessage = ref('')
const showTest = ref(false)
const testing = ref(false)
const testCapability = ref<ApiCapabilityId | 'node-default'>('node-default')
const testText = ref('Hello')
const testResult = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const showSavePreset = ref(false)
const showManagePresets = ref(false)
const showImport = ref(false)
const refreshingImported = ref(false)
const showReset = ref(false)

const isMatch = (keywords: string) => {
  const query = props.searchQuery?.trim().toLowerCase()
  return !query || keywords.toLowerCase().includes(query)
}
const searchableText = computed(() => [
  '节点信息 名称 启用 停用 参与功能路由',
  '负责功能 职责 图像辅助 内容与角色 论坛 特殊能力',
  ...assignableApiCapabilities.flatMap(item => [item.name, item.description]),
  '预设 方案 保存 管理 切换',
  '基础接入 服务商 接口协议 接口地址 API 密钥 New API 导入 测试 重置',
  '引擎 参数 可用模型 指定模型 同步 手动填写 批量 大小',
  '高级参数 Temperature 温度 Max Tokens 最大长度 Top P 核采样 Frequency Penalty 频率惩罚 Presence Penalty 存在惩罚 Stream 流式 网络',
  '预设 保存 管理 切换 测试 连接 重置'
].join(' '))
const hasSearchResult = computed(() => isMatch(searchableText.value))
const estimatedTokens = computed(() => {
  const text = testText.value
  if (!text) return 0
  let cnCount = 0
  let enCount = 0
  for (const character of text) character.charCodeAt(0) > 255 ? cnCount += 1 : enCount += 1
  return Math.ceil(cnCount * 1.5 + enCount * 0.25) + 10
})

const ownerFor = (capability: ApiCapabilityId) => getCapabilityOwner(capability, props.node?.id || '')
const isSelected = (capability: ApiCapabilityId) => Boolean(props.node?.capabilities[capability])
const toggleCapability = (capability: ApiCapabilityId) => {
  if (!props.node) return
  const result = setApiNodeCapability(props.node.id, capability, !isSelected(capability))
  if (!result.ok && result.owner) syncMessage.value = `${result.owner.name} 已负责“${assignableApiCapabilities.find(item => item.id === capability)?.name}”`
}
const toggleCapabilityDetail = (capability: ApiCapabilityId) => { capabilityOpen.value = capabilityOpen.value === capability ? '' : capability }

const onProviderChange = () => {
  if (props.settings.provider !== 'custom') props.settings.url = providers.find(item => item.id === props.settings.provider)?.defaultUrl || ''
  else props.settings.url = props.settings.customUrl || props.settings.url
  props.settings.key = ''
}

const syncModels = async () => {
  const url = apiNodeEffectiveUrl(props.settings).trim()
  const key = apiNodeEffectiveKey(props.settings).trim()
  if (!url || !key) { syncMessage.value = '请先填写接口地址和密钥'; return }
  syncing.value = true; syncMessage.value = ''
  try {
    const base = url.replace(/\/+$/, '')
    let endpoint = `${base}${base.endsWith('/v1') ? '' : '/v1'}/models`
    let headers: Record<string, string> = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
    if (props.settings.provider === 'claude') headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
    if (props.settings.provider === 'gemini') { endpoint = `${base.replace(/\/v1(?:beta)?$/i, '')}/v1beta/models?pageSize=1000`; headers = { 'x-goog-api-key': key } }
    const response = await fetch(endpoint, { headers })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    const models = props.settings.provider === 'gemini'
      ? (data.models || []).filter((item: any) => !item.supportedGenerationMethods || item.supportedGenerationMethods.includes('generateContent')).map((item: any) => String(item.name || '').replace(/^models\//, ''))
      : (data.data || []).map((item: any) => String(item.id || '')).filter(Boolean)
    if (!models.length) throw new Error('接口没有返回可用模型')
    props.settings.availableModels = models
    if (!props.settings.model || !models.includes(props.settings.model)) props.settings.model = models[0]
    syncMessage.value = `已同步 ${models.length} 个模型`
  } catch (error: any) { syncMessage.value = error?.message || '同步失败' }
  finally { syncing.value = false }
}

onMounted(() => {
  if (props.isDefault && props.settings.url && props.settings.key && !(props.settings.availableModels || []).length) syncModels()
})

const testConnection = async () => {
  if (!testText.value.trim()) { testResult.value = { type: 'error', text: '测试文本不能为空' }; return }
  const url = apiNodeEffectiveUrl(props.settings).trim()
  const key = apiNodeEffectiveKey(props.settings).trim()
  const capabilityOverride = testCapability.value === 'node-default' ? null : props.node?.capabilities[testCapability.value]
  const model = capabilityOverride && !capabilityOverride.inheritModel ? capabilityOverride.model : props.settings.model
  if (!url || !key || !model) { testResult.value = { type: 'error', text: '请先完整填写地址、密钥和测试目标模型' }; return }
  testing.value = true; testResult.value = null
  try {
    if (testCapability.value === 'embedding') {
      const base = url.replace(/\/+$/, '')
      const endpoint = base.endsWith('/embeddings') ? base : `${base}${base.includes('/v1') ? '' : '/v1'}/embeddings`
      const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, input: [testText.value] }) })
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      const dimensions = (await response.json())?.data?.[0]?.embedding?.length
      if (!dimensions) throw new Error('接口没有返回有效向量')
      testResult.value = { type: 'success', text: `向量连接成功，返回 ${dimensions} 维向量` }
      return
    }
    const prepared = prepareAdapterRequest({ provider: props.settings.provider, url, key, model, profile: props.settings.adapterProfile || 'auto', maxTokens: 50, stream: false }, [{ role: 'user', content: testText.value }])
    const response = await fetch(prepared.endpoint, { method: 'POST', headers: prepared.headers, body: JSON.stringify(prepared.body) })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    const parsed = parseAdapterResponse(prepared.profile, await response.json())
    if (!parsed.content && !parsed.thinking) throw new Error('接口返回格式无法识别')
    testResult.value = { type: 'success', text: parsed.content || parsed.thinking || '连接成功' }
  } catch (error: any) { testResult.value = { type: 'error', text: error?.message || '测试失败' } }
  finally { testing.value = false }
}

const savePreset = (name: string) => {
  const preset: ApiPreset = {
    id: `preset_${Date.now()}`, name: name.trim(), provider: props.settings.provider, url: props.settings.url, key: props.settings.key,
    model: props.settings.model, adapterProfile: props.settings.adapterProfile, customUrl: props.settings.customUrl || '', customKey: props.settings.customKey || '',
    enableTemperature: props.settings.enableTemperature, temperature: props.settings.temperature, enableMaxTokens: props.settings.enableMaxTokens,
    maxTokens: props.settings.maxTokens, enableTopP: props.settings.enableTopP, topP: props.settings.topP,
    enableFrequencyPenalty: props.settings.enableFrequencyPenalty, frequencyPenalty: props.settings.frequencyPenalty,
    enablePresencePenalty: props.settings.enablePresencePenalty, presencePenalty: props.settings.presencePenalty,
    enableStream: props.settings.enableStream, batchSize: props.settings.batchSize
  }
  props.settings.presets ||= []; props.settings.presets.push(preset); props.settings.currentPresetId = preset.id; showSavePreset.value = false
}
const applyPreset = () => {
  const preset = props.settings.presets?.find((item: ApiPreset) => item.id === props.settings.currentPresetId)
  if (!preset) return
  ;['provider','url','key','model','adapterProfile','customUrl','customKey','enableTemperature','temperature','enableMaxTokens','maxTokens','enableTopP','topP','enableFrequencyPenalty','frequencyPenalty','enablePresencePenalty','presencePenalty','enableStream','batchSize'].forEach(key => {
    if ((preset as any)[key] !== undefined) props.settings[key] = (preset as any)[key]
  })
}
const deletePresets = (ids: string[]) => { props.settings.presets = (props.settings.presets || []).filter((item: ApiPreset) => !ids.includes(item.id)); if (ids.includes(props.settings.currentPresetId)) props.settings.currentPresetId = '' }

const importNode = (result: NewApiDetectionResult) => {
  Object.assign(props.settings, { provider: 'custom', url: result.credentials.baseUrl, key: result.credentials.apiKey, customUrl: result.credentials.baseUrl, customKey: result.credentials.apiKey, availableModels: [...result.models], newApiNode: { ...result.nodeInfo } })
  if (!result.models.includes(props.settings.model)) props.settings.model = result.models[0] || ''
  props.settings.presets ||= []
  const existing = props.settings.presets.find((preset: ApiPreset) => preset.provider === 'custom' && preset.url === result.credentials.baseUrl && preset.key === result.credentials.apiKey)
  const preset: ApiPreset = {
    id: existing?.id || `new-api_${Date.now()}`,
    name: `${result.nodeInfo.systemName} · New API`,
    provider: 'custom', url: result.credentials.baseUrl, key: result.credentials.apiKey, model: props.settings.model,
    adapterProfile: props.settings.adapterProfile || 'auto', customUrl: result.credentials.baseUrl, customKey: result.credentials.apiKey,
    enableTemperature: props.settings.enableTemperature, temperature: props.settings.temperature,
    enableMaxTokens: props.settings.enableMaxTokens, maxTokens: props.settings.maxTokens,
    enableTopP: props.settings.enableTopP, topP: props.settings.topP,
    enableFrequencyPenalty: props.settings.enableFrequencyPenalty, frequencyPenalty: props.settings.frequencyPenalty,
    enablePresencePenalty: props.settings.enablePresencePenalty, presencePenalty: props.settings.presencePenalty,
    enableStream: props.settings.enableStream, batchSize: props.settings.batchSize
  }
  if (existing) Object.assign(existing, preset); else props.settings.presets.push(preset)
  props.settings.currentPresetId = preset.id
}
const refreshImportedNode = async () => {
  if (!props.settings.newApiNode || refreshingImported.value) return
  refreshingImported.value = true
  try { importNode(await detectNewApiNode({ baseUrl: props.settings.newApiNode.baseUrl || props.settings.url, apiKey: apiNodeEffectiveKey(props.settings) })) }
  catch (error: any) { props.settings.newApiNode = { ...props.settings.newApiNode, connected: false, checkedAt: Date.now(), errorMessage: error?.message || '刷新失败' } }
  finally { refreshingImported.value = false }
}
const openImportedDetail = () => {
  const baseUrl = props.settings.newApiNode?.baseUrl
  if (baseUrl) window.open(`${baseUrl}/console/token`, '_blank', 'noopener,noreferrer')
}
const confirmReset = () => {
  props.settings.url = ''
  props.settings.key = ''
  if (props.settings.provider === 'custom') {
    props.settings.customUrl = ''
    props.settings.customKey = ''
  }
  showReset.value = false
}
</script>

<template>
  <div class="node-editor">
    <div class="editor-toolbar"><button class="text-action-btn" type="button" @click="emit('back')">← 返回节点列表</button><button v-if="!isDefault" class="text-action-btn danger" type="button" @click="emit('delete')">删除节点</button></div>
    <p v-if="searchQuery&&!hasSearchResult" class="node-empty">没有匹配的设置项</p>
    <section v-show="isMatch('节点信息 名称 启用 停用 参与功能路由')" class="settings-section"><div class="red-dot"></div><div class="section-title"><span class="cn">{{isDefault?'默认节点':'节点信息'}}</span><span class="en">IDENTITY</span></div>
      <div class="form-row" v-if="!isDefault"><label class="form-label">节点名称</label><input v-model.trim="settings.name" maxlength="40" class="line-input" placeholder="例如：Gemini 多功能节点"></div>
      <div class="form-row" v-if="!isDefault"><div class="form-label space-between"><span>参与功能路由</span><button class="compact-switch" :class="{active:node?.enabled}" type="button" @click="emit('toggle-enabled')"><i></i><span>{{node?.enabled?'已启用':'已停用'}}</span></button></div><p class="inline-hint">停用后保留配置和职责，功能暂时按各自规则降级。</p></div>
      <p v-else class="section-desc">永久负责普通聊天，也是未绑定文本功能的安全回退节点，不可删除或停用。</p>
    </section>

    <section v-if="node" v-show="isMatch('负责功能 职责 图像辅助 内容与角色 论坛 特殊能力 '+assignableApiCapabilities.map(item=>item.name+' '+item.description).join(' '))" class="settings-section"><div class="red-dot"></div><div class="section-title"><span class="cn">负责功能</span><span class="en">CAPABILITIES</span></div>
      <div v-for="group in visibleGroups" :key="group.id" class="capability-group"><b>{{group.name}}</b>
        <div v-for="capability in group.items" :key="capability.id" class="capability-row" :class="{selected:isSelected(capability.id),blocked:ownerFor(capability.id)}">
          <button class="capability-main" type="button" :disabled="Boolean(ownerFor(capability.id))" @click="toggleCapability(capability.id)"><i>{{isSelected(capability.id)?'✓':''}}</i><span><strong>{{capability.name}}</strong><small v-if="ownerFor(capability.id)">已分配至「{{ownerFor(capability.id)?.name}}」</small><small v-else>{{capability.description}}</small></span></button>
          <button v-if="isSelected(capability.id)" class="capability-detail-btn" type="button" @click="toggleCapabilityDetail(capability.id)">{{capabilityOpen===capability.id?'收起':'单独设置'}}</button>
          <div v-if="isSelected(capability.id)&&capabilityOpen===capability.id" class="capability-detail">
            <label><span>模型</span><button type="button" @click="node!.capabilities[capability.id]!.inheritModel=!node!.capabilities[capability.id]!.inheritModel">{{node!.capabilities[capability.id]!.inheritModel?'继承节点':'单独设置'}}</button></label>
            <input v-if="!node.capabilities[capability.id]!.inheritModel" v-model="node.capabilities[capability.id]!.model" class="line-input" placeholder="功能专用模型标识">
            <label v-if="capability.supportsParameterOverrides"><span>高级参数</span><button type="button" @click="node!.capabilities[capability.id]!.inheritParameters=!node!.capabilities[capability.id]!.inheritParameters">{{node!.capabilities[capability.id]!.inheritParameters?'继承节点':'单独设置'}}</button></label>
            <div v-if="capability.supportsParameterOverrides&&!node.capabilities[capability.id]!.inheritParameters" class="override-grid">
              <label>Temperature <button type="button" @click="node!.capabilities[capability.id]!.parameters.enableTemperature=!node!.capabilities[capability.id]!.parameters.enableTemperature">{{node.capabilities[capability.id]!.parameters.enableTemperature?'启用':'默认'}}</button><input v-model.number="node.capabilities[capability.id]!.parameters.temperature" type="number" min="0" max="2" step="0.1"></label>
              <label>Max Tokens <button type="button" @click="node!.capabilities[capability.id]!.parameters.enableMaxTokens=!node!.capabilities[capability.id]!.parameters.enableMaxTokens">{{node.capabilities[capability.id]!.parameters.enableMaxTokens?'启用':'默认'}}</button><input v-model.number="node.capabilities[capability.id]!.parameters.maxTokens" type="number" min="1" step="100"></label>
              <label>Top P <button type="button" @click="node!.capabilities[capability.id]!.parameters.enableTopP=!node!.capabilities[capability.id]!.parameters.enableTopP">{{node.capabilities[capability.id]!.parameters.enableTopP?'启用':'默认'}}</button><input v-model.number="node.capabilities[capability.id]!.parameters.topP" type="number" min="0" max="1" step="0.05"></label>
              <label>Frequency Penalty <button type="button" @click="node!.capabilities[capability.id]!.parameters.enableFrequencyPenalty=!node!.capabilities[capability.id]!.parameters.enableFrequencyPenalty">{{node.capabilities[capability.id]!.parameters.enableFrequencyPenalty?'启用':'默认'}}</button><input v-model.number="node.capabilities[capability.id]!.parameters.frequencyPenalty" type="number" min="-2" max="2" step="0.1"></label>
              <label>Presence Penalty <button type="button" @click="node!.capabilities[capability.id]!.parameters.enablePresencePenalty=!node!.capabilities[capability.id]!.parameters.enablePresencePenalty">{{node.capabilities[capability.id]!.parameters.enablePresencePenalty?'启用':'默认'}}</button><input v-model.number="node.capabilities[capability.id]!.parameters.presencePenalty" type="number" min="-2" max="2" step="0.1"></label>
              <label>Stream <button type="button" @click="node!.capabilities[capability.id]!.parameters.enableStream=!node!.capabilities[capability.id]!.parameters.enableStream">{{node.capabilities[capability.id]!.parameters.enableStream?'已开启':'已关闭'}}</button></label>
            </div>
          </div>
        </div>
      </div>
      <div v-if="hasForumCapability" class="form-row forum-fallback-row"><div class="form-label space-between"><span>专用节点失败时回退默认节点</span><label class="editorial-switch"><input v-model="node.fallbackToDefault" type="checkbox"><span class="slider"></span></label></div></div>
    </section>

    <section v-show="isMatch('预设 方案 保存 管理 切换')" class="settings-section"><div class="red-dot"></div><div class="section-title"><span class="cn">预设方案</span><span class="en">PRESETS</span></div>
      <div class="form-grid"><div class="form-row"><div class="form-label">切换预设</div><div class="form-value full-width"><SearchableSelect v-model="settings.currentPresetId" :options="presetOptions" placeholder="请选择预设方案" :is-dark="darkMode" currentStyle="editorial" @change="applyPreset" /></div></div>
      <div class="form-row form-row-footer border-none"><div class="footer-actions"><button class="text-action-btn" type="button" @click="showSavePreset=true"><span class="cn-text">保存当前配置</span><span class="en-text">SAVE PRESET</span></button><button class="text-action-btn" type="button" @click="showManagePresets=true"><span class="cn-text">管理预设</span><span class="en-text">MANAGE</span></button></div></div></div>
      <p class="section-desc">每个节点的预设方案相互独立，可保存常用的配置组合以便快速切换。</p>
    </section>

    <section v-show="isMatch('基础接入 服务商 接口协议 接口地址 API 密钥 New API 导入 测试 重置')" class="settings-section"><div class="red-dot"></div><div class="section-title"><span class="cn">基础接入</span><span class="en">CONNECTION</span></div>
      <div class="form-grid">
        <div v-show="isMatch('基础接入 服务商')" class="form-row"><div class="form-label">服务商</div><div class="form-value full-width"><SearchableSelect v-model="settings.provider" :options="providerOptions" :is-dark="darkMode" currentStyle="editorial" @change="onProviderChange" /></div></div>
        <div v-if="settings.provider==='custom'" v-show="isMatch('基础接入 接口协议 协议 适配')" class="form-row"><div class="form-label">接口协议</div><div class="form-value full-width"><SearchableSelect v-model="settings.adapterProfile" :options="adapterOptions" :is-dark="darkMode" currentStyle="editorial" /></div></div>
        <div v-show="isMatch('基础接入 接口地址')" class="form-row"><div class="form-label">接口地址 <span v-if="settings.provider!=='custom'" class="auto-tag">默认</span></div><div class="form-value"><input v-model="settings.url" class="line-input" autocomplete="off" spellcheck="false" placeholder="https://..."></div></div>
        <div v-show="isMatch('基础接入 API 密钥')" class="form-row"><div class="form-label">API 密钥</div><div class="form-value input-with-action"><input v-model="settings.key" :type="showPassword?'text':'password'" class="line-input" autocomplete="off" spellcheck="false" placeholder="sk-..."><button class="icon-action-btn" type="button" :title="showPassword?'隐藏':'显示'" @click="showPassword=!showPassword"><svg v-if="!showPassword" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg><svg v-else viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg></button></div></div>
        <div v-show="isMatch('基础接入 New API 导入')" class="form-row border-none import-btn-row"><div class="form-value full-width"><button class="import-new-api-btn" type="button" @click="showImport=true"><span class="cn-text">导入 New API 节点</span><span class="en-text">IMPORT NEW API</span></button></div></div>
        <div v-show="isMatch('基础接入 测试 重置')" class="form-row form-row-footer"><div class="footer-actions"><button class="text-action-btn test-btn" type="button" @click="showTest=true;testResult=null"><span class="cn-text">测试</span><span class="en-text">TEST CONNECTION</span></button><button class="text-action-btn reset-btn" type="button" @click="showReset=true"><span class="cn-text">重置</span><span class="en-text">RESET</span></button></div></div>
      </div>
      <p class="section-desc">您的凭证仅保存在本地设备，确保极致隐私安全。</p>
      <NewApiNodeStatusCard v-if="settings.newApiNode" :dark-mode="darkMode" :node-info="settings.newApiNode" :refreshing="refreshingImported" @refresh="refreshImportedNode" @detail="openImportedDetail" @reimport="showImport=true" @unbind="settings.newApiNode=null" />
    </section>

    <section v-show="isMatch('引擎 参数 可用模型 指定模型 同步 手动填写 批量 大小')" class="settings-section"><div class="red-dot"></div><div class="section-title"><span class="cn">引擎与参数</span><span class="en">MODEL</span></div>
      <div class="form-grid">
        <div v-show="isMatch('引擎 参数 可用模型 同步')" class="form-row"><div class="form-label">可用模型</div><div class="form-value action-group"><div class="full-width relative"><SearchableSelect v-model="settings.model" :options="modelOptions" :disabled="!modelOptions.length" placeholder="请选择拉取到的模型" :is-dark="darkMode" currentStyle="editorial" /></div><button class="text-action-btn sync-btn" type="button" :disabled="syncing" @click="syncModels"><span class="cn-text">同步</span><span class="en-text">{{syncing?'SYNCING...':'SYNC'}}</span></button></div></div>
        <div v-show="isMatch('引擎 参数 指定模型 手动填写')" class="form-row"><div class="form-label">指定模型</div><div class="form-value"><input v-model="settings.model" class="line-input" placeholder="可手动填入模型标识..." spellcheck="false" autocomplete="off"></div></div>
        <div v-if="hasEmbeddingCapability" v-show="isMatch('引擎 参数 批量 大小')" class="form-row"><div class="form-label">批量大小</div><div class="form-value"><input v-model.number="settings.batchSize" class="line-input" type="number" min="1" max="100"></div></div>
      </div>
      <p v-if="syncMessage" class="section-desc status-msg">{{syncMessage}}</p><p v-else class="section-desc">可自动同步节点支持的模型或手动指定。</p>
    </section>

    <section v-if="!isEmbeddingOnly" v-show="isMatch('高级参数 Temperature 温度 Max Tokens 最大长度 Top P 核采样 Frequency Penalty 频率惩罚 Presence Penalty 存在惩罚')" class="settings-section"><div class="red-dot"></div><div class="section-title"><span class="cn">高级参数</span><span class="en">ADVANCED</span></div>
      <div class="form-grid restored-advanced">
        <div class="form-row"><div class="form-label space-between"><span>Temperature (温度)</span><label class="editorial-switch"><input v-model="settings.enableTemperature" type="checkbox"><span class="slider"></span></label></div><div v-if="settings.enableTemperature" class="form-value action-group"><input v-model.number="settings.temperature" class="line-range" type="range" min="0" max="2" step="0.1"><input v-model.number="settings.temperature" class="line-input num-input" type="number" step="0.1"><button class="icon-action-btn" type="button" title="重置(0.7)" @click="settings.temperature=0.7"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg></button></div></div>
        <div class="form-row"><div class="form-label space-between"><span>Max Tokens (最大长度)</span><label class="editorial-switch"><input v-model="settings.enableMaxTokens" type="checkbox"><span class="slider"></span></label></div><div v-if="settings.enableMaxTokens" class="form-value action-group"><input v-model.number="settings.maxTokens" class="line-range" type="range" min="100" max="128000" step="100"><input v-model.number="settings.maxTokens" class="line-input num-input large" type="number" step="100"><button class="icon-action-btn" type="button" title="重置(1000)" @click="settings.maxTokens=1000"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg></button></div></div>
        <div class="form-row"><div class="form-label space-between"><span>Top P (核采样)</span><label class="editorial-switch"><input v-model="settings.enableTopP" type="checkbox"><span class="slider"></span></label></div><div v-if="settings.enableTopP" class="form-value action-group"><input v-model.number="settings.topP" class="line-range" type="range" min="0" max="1" step="0.05"><input v-model.number="settings.topP" class="line-input num-input" type="number" step="0.05"><button class="icon-action-btn" type="button" title="重置(1.0)" @click="settings.topP=1"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg></button></div></div>
        <div class="form-row"><div class="form-label space-between"><span>Frequency Penalty (频率惩罚)</span><label class="editorial-switch"><input v-model="settings.enableFrequencyPenalty" type="checkbox"><span class="slider"></span></label></div><div v-if="settings.enableFrequencyPenalty" class="form-value action-group"><input v-model.number="settings.frequencyPenalty" class="line-range" type="range" min="-2" max="2" step="0.1"><input v-model.number="settings.frequencyPenalty" class="line-input num-input" type="number" step="0.1"><button class="icon-action-btn" type="button" title="重置(0)" @click="settings.frequencyPenalty=0"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg></button></div></div>
        <div class="form-row"><div class="form-label space-between"><span>Presence Penalty (存在惩罚)</span><label class="editorial-switch"><input v-model="settings.enablePresencePenalty" type="checkbox"><span class="slider"></span></label></div><div v-if="settings.enablePresencePenalty" class="form-value action-group"><input v-model.number="settings.presencePenalty" class="line-range" type="range" min="-2" max="2" step="0.1"><input v-model.number="settings.presencePenalty" class="line-input num-input" type="number" step="0.1"><button class="icon-action-btn" type="button" title="重置(0)" @click="settings.presencePenalty=0"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg></button></div></div>
      </div><p class="section-desc">未开启时将使用服务商默认值。</p>
    </section>

    <section v-if="!isEmbeddingOnly" v-show="isMatch('Stream 流式 接收 网络')" class="settings-section"><div class="red-dot"></div><div class="section-title"><span class="cn">网络策略</span><span class="en">NETWORK</span></div><div class="form-row border-none"><div class="form-label space-between"><span>底层流式接收 (Stream)</span><label class="editorial-switch"><input v-model="settings.enableStream" type="checkbox"><span class="slider"></span></label></div></div><p class="section-desc">建议代理节点容易超时的用户开启。开启后底层静默流式接收，UI 保留平滑打字机动画。</p></section>

    <TextEditModal v-if="showSavePreset" :visible="showSavePreset" title="保存预设方案" currentText="" defaultText="" placeholder="请输入预设名称，例如：深度思考(慢)" @saved="savePreset" @update:visible="showSavePreset=$event" />
    <ApiPresetManageModal v-if="showManagePresets" :presets="settings.presets||[]" :currentPresetId="settings.currentPresetId" @delete="deletePresets" @close="showManagePresets=false" />
    <NewApiImportModal :visible="showImport" :dark-mode="darkMode" :target-name="isDefault?'默认节点':settings.name" @close="showImport=false" @detect="()=>{}" @confirm="importNode" />
    <Teleport to=".api-modal">
    <div v-if="showReset" class="editorial-modal-overlay">
      <div class="editorial-modal-content">
        <h2 class="modal-en-title">Warning</h2>
        <p class="modal-cn-desc">确定要清空当前节点的配置信息吗？<br>此操作无法撤销。</p>
        <div class="modal-actions">
          <button class="text-action-btn" type="button" @click="showReset=false"><span class="cn-text">取消</span><span class="en-text">CANCEL</span></button>
          <button class="text-action-btn reset-btn" type="button" @click="confirmReset"><span class="cn-text">确认</span><span class="en-text">CONFIRM</span></button>
        </div>
      </div>
    </div>
    <div v-if="showTest" class="editorial-modal-overlay">
      <div class="editorial-modal-content wide">
        <h2 class="modal-en-title">Connection</h2>
        <div class="modal-cn-desc text-left test-warning">
          <span class="highlight">温馨提示：真实测试将消耗您的 API 额度（Token）或使用次数。</span><br>
          若因测试触发风控导致封号或额度损耗，本应用概不负责。请确保您的服务商允许此操作。
        </div>
        <div v-if="node&&selectedCapabilities.length" class="test-targets"><button type="button" :class="{active:testCapability==='node-default'}" @click="testCapability='node-default'">节点默认</button><button v-for="id in selectedCapabilities" :key="id" type="button" :class="{active:testCapability===id}" @click="testCapability=id">{{assignableApiCapabilities.find(item=>item.id===id)?.name}}</button></div>
        <div class="test-input-wrapper">
          <div class="input-label">请在下方输入自定义的测试文本：</div>
          <input v-model="testText" class="line-input text-center" :disabled="testing" placeholder="例如: Hello" spellcheck="false">
          <div v-if="testText" class="token-estimate">预估消耗 Token: 约 {{estimatedTokens}} (仅供参考)</div>
        </div>
        <div v-if="testResult" class="test-result-area" :class="testResult.type">{{testResult.text}}</div>
        <div class="modal-actions">
          <button class="text-action-btn" type="button" :disabled="testing" @click="showTest=false"><span class="cn-text">取消</span><span class="en-text">CANCEL</span></button>
          <button class="text-action-btn submit-btn" type="button" :disabled="testing" @click="testConnection"><span class="cn-text">{{testing?'发送中':'发送'}}</span><span class="en-text">{{testing?'SENDING...':'SEND'}}</span></button>
        </div>
      </div>
    </div>
    </Teleport>
  </div>
</template>

<style scoped src="../ApiSettings.css"></style>
<style scoped>
.node-editor{min-width:0}.editor-toolbar{display:flex;justify-content:space-between;gap:12px;margin-bottom:30px}.text-action-btn.danger{color:#b92d2d}.compact-switch{display:flex;align-items:center;gap:7px;border:0;background:transparent;color:#999;font:inherit;font-size:11px;cursor:pointer}.compact-switch i{position:relative;width:30px;height:16px;border-radius:9px;background:#ddd}.compact-switch i:after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;transition:.2s}.compact-switch.active{color:inherit}.compact-switch.active i{background:#222}.compact-switch.active i:after{transform:translateX(14px)}.inline-hint{margin:8px 0 0;color:#999;font-size:11px;line-height:1.55}.capability-group{margin-top:18px}.capability-group>b{display:block;margin-bottom:7px;color:#777;font-size:11px;font-weight:500;letter-spacing:1px}.capability-row{display:grid;grid-template-columns:minmax(0,1fr) auto;border-bottom:1px solid #eee}.capability-main{display:flex;min-width:0;gap:10px;align-items:center;padding:11px 0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.capability-main>i{display:grid;place-items:center;width:16px;height:16px;box-sizing:border-box;flex:none;border:1px solid #ccc;border-radius:4px;color:#fff;font-size:10px;font-style:normal}.selected .capability-main>i{border-color:#222;background:#222}.capability-main span{min-width:0}.capability-main strong,.capability-main small{display:block}.capability-main strong{font-size:12px;font-weight:500}.capability-main small{margin-top:3px;overflow:hidden;color:#999;font-size:10px;line-height:1.4;text-overflow:ellipsis;white-space:nowrap}.blocked .capability-main{cursor:not-allowed;opacity:.65}.blocked .capability-main small{color:#b92d2d}.capability-detail-btn{align-self:center;padding:4px 0;border:0;background:transparent;color:#777;font-size:10px;cursor:pointer}.capability-detail{grid-column:1/-1;padding:3px 0 13px 26px}.capability-detail>label{display:flex;align-items:center;justify-content:space-between;min-height:32px;color:#777;font-size:11px}.capability-detail button,.tool-row button,.model-row>button,.secret-row button,.advanced-fields button{border:0;background:transparent;color:#666;font:inherit;font-size:10px;cursor:pointer}.override-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.override-grid label{color:#888;font-size:10px}.override-grid label button{float:right}.override-grid input,.mini-number,.advanced-fields input{box-sizing:border-box;width:100%;margin-top:4px;padding:6px;border:1px solid #ddd;background:transparent;color:inherit}.secret-row,.model-row{display:flex;align-items:center;gap:12px;min-width:0}.secret-row .line-input,.model-row>:first-child{min-width:0;flex:1}.model-manual{margin-top:9px}.import-new-api-btn.compact{margin-top:14px;padding:10px}.advanced-toggle{display:flex;width:100%;justify-content:space-between;padding:13px 0;border:0;border-bottom:1px solid #eee;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}.advanced-toggle small{color:#999;font-size:10px}.advanced-fields label{display:grid;grid-template-columns:minmax(90px,1fr) 90px 52px;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #eee;font-size:11px}.advanced-fields button.active{color:#111;font-weight:600}.tool-row{display:flex;flex-wrap:wrap;gap:18px}.tool-row button{padding:5px 0;border-bottom:1px solid transparent;font-size:11px}.tool-row button:hover{border-color:currentColor}.test-targets{display:flex;width:100%;gap:6px;overflow-x:auto}.test-targets button{flex:none;padding:5px 7px;border:1px solid #ddd;background:transparent;color:#888;font:inherit;font-size:9px;cursor:pointer}.test-targets button.active{border-color:#222;color:#222}.is-dark .capability-row,.is-dark .advanced-toggle,.is-dark .advanced-fields label{border-color:#2a2a2a}.is-dark .selected .capability-main>i,.is-dark .compact-switch.active i{background:#eee;border-color:#eee;color:#111}.is-dark .test-targets button.active{border-color:#ddd;color:#ddd}@media(max-width:390px){.editor-toolbar{margin-bottom:24px}.capability-main small{max-width:210px}.capability-detail{padding-left:0}.override-grid{grid-template-columns:1fr}.advanced-fields label{grid-template-columns:minmax(80px,1fr) 76px 46px}.tool-row{gap:12px}.model-row{gap:8px}}
</style>
