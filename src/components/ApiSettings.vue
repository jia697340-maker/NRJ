/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { globalSettings, apiSettings, summaryApiSettings, visionApiSettings, momentApiSettings, embeddingApiSettings, characterApiSettings, cotSettings, type CotItem, type ApiPreset } from '../store'
import SearchableSelect from './SearchableSelect.vue'
import TextEditModal from './TextEditModal.vue'
import ApiPresetManageModal from './ApiPresetManageModal.vue'
import NewApiImportModal from './NewApiImportModal.vue'
import NewApiNoticeModal from './NewApiNoticeModal.vue'
import NewApiNodeStatusCard from './NewApiNodeStatusCard.vue'
import { parseAdapterResponse, prepareAdapterRequest } from '../services/modelAdapters'
import {
  detectNewApiNode,
  type NewApiDetectionResult
} from '../services/newApiNode'

const currentTab = ref<'global' | 'summary' | 'vision' | 'moment' | 'embedding' | 'character'>('global')

const activeSettings = computed<any>(() => {
  if (currentTab.value === 'embedding') return embeddingApiSettings
  if (currentTab.value === 'summary') return summaryApiSettings
  if (currentTab.value === 'vision') return visionApiSettings
  if (currentTab.value === 'moment') return momentApiSettings
  if (currentTab.value === 'character') return characterApiSettings
  return apiSettings
})

const searchQuery = ref('')
const isSearchFocused = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
const isMatch = (keywords: string) => {
  if (!searchQuery.value) return true
  return keywords.toLowerCase().includes(searchQuery.value.toLowerCase())
}

const emit = defineEmits(['close'])

const providers = [
  { id: 'deepseek', name: 'DeepSeek', defaultUrl: 'https://api.deepseek.com' },
  { id: 'gemini', name: 'Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com' },
  { id: 'claude', name: 'Anthropic Claude', defaultUrl: 'https://api.anthropic.com' },
  { id: 'glm', name: '智谱 GLM', defaultUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'openai', name: 'OpenAI', defaultUrl: 'https://api.openai.com' },
  { id: 'custom', name: '自定义', defaultUrl: '' },
]

const providerOptions = providers.map(p => ({ value: p.id, label: p.name }))

const modelOptions = computed(() => {
  return (activeSettings.value.availableModels || []).map((m: string) => ({ value: m, label: m }))
})

const onProviderChange = () => {
  if (activeSettings.value.provider !== 'custom') {
    const p = providers.find(x => x.id === activeSettings.value.provider)
    if (p) activeSettings.value.url = p.defaultUrl
  } else {
    activeSettings.value.url = activeSettings.value.customUrl
  }
  activeSettings.value.key = ''
}

// --- 预设方案管理逻辑 ---
const showSavePresetModal = ref(false)
const showManagePresetModal = ref(false)

const presetOptions = computed(() => {
  return [
    { value: '', label: '未选择预设 (当前临时配置)' },
    ...(activeSettings.value.presets || []).map((p: ApiPreset) => ({
      value: p.id,
      label: p.name
    }))
  ]
})

const applyPreset = (presetId: string) => {
  activeSettings.value.currentPresetId = presetId
  if (!presetId) return
  
  const preset = (activeSettings.value.presets || []).find((p: ApiPreset) => p.id === presetId)
  if (!preset) return

  activeSettings.value.provider = preset.provider
  activeSettings.value.url = preset.url
  activeSettings.value.key = preset.key
  activeSettings.value.model = preset.model
  activeSettings.value.customUrl = preset.customUrl || ''
  activeSettings.value.customKey = preset.customKey || ''
  
  if (preset.enableTemperature !== undefined) activeSettings.value.enableTemperature = preset.enableTemperature
  if (preset.temperature !== undefined) activeSettings.value.temperature = preset.temperature
  if (preset.enableMaxTokens !== undefined) activeSettings.value.enableMaxTokens = preset.enableMaxTokens
  if (preset.maxTokens !== undefined) activeSettings.value.maxTokens = preset.maxTokens
  if (preset.enableTopP !== undefined) activeSettings.value.enableTopP = preset.enableTopP
  if (preset.topP !== undefined) activeSettings.value.topP = preset.topP
  if (preset.enableFrequencyPenalty !== undefined) activeSettings.value.enableFrequencyPenalty = preset.enableFrequencyPenalty
  if (preset.frequencyPenalty !== undefined) activeSettings.value.frequencyPenalty = preset.frequencyPenalty
  if (preset.enablePresencePenalty !== undefined) activeSettings.value.enablePresencePenalty = preset.enablePresencePenalty
  if (preset.presencePenalty !== undefined) activeSettings.value.presencePenalty = preset.presencePenalty
  if (preset.enableStream !== undefined) activeSettings.value.enableStream = preset.enableStream
  
  // Embedding 特有属性
  if (currentTab.value === 'embedding' && preset.batchSize !== undefined) {
    activeSettings.value.batchSize = preset.batchSize
  }
}

const handleSavePreset = (name: string) => {
  if (!name.trim()) return
  
  const newPreset: ApiPreset = {
    id: 'preset_' + Date.now().toString(),
    name: name.trim(),
    provider: activeSettings.value.provider,
    url: activeSettings.value.url,
    key: activeSettings.value.key,
    model: activeSettings.value.model,
    customUrl: activeSettings.value.customUrl || '',
    customKey: activeSettings.value.customKey || '',
    enableTemperature: activeSettings.value.enableTemperature,
    temperature: activeSettings.value.temperature,
    enableMaxTokens: activeSettings.value.enableMaxTokens,
    maxTokens: activeSettings.value.maxTokens,
    enableTopP: activeSettings.value.enableTopP,
    topP: activeSettings.value.topP,
    enableFrequencyPenalty: activeSettings.value.enableFrequencyPenalty,
    frequencyPenalty: activeSettings.value.frequencyPenalty,
    enablePresencePenalty: activeSettings.value.enablePresencePenalty,
    presencePenalty: activeSettings.value.presencePenalty,
    enableStream: activeSettings.value.enableStream
  }
  
  if (currentTab.value === 'embedding') {
    newPreset.batchSize = activeSettings.value.batchSize
  }
  
  if (!activeSettings.value.presets) {
    activeSettings.value.presets = []
  }
  
  activeSettings.value.presets.push(newPreset)
  activeSettings.value.currentPresetId = newPreset.id
  showSavePresetModal.value = false
}

const handleDeletePresets = (ids: string[]) => {
  if (!activeSettings.value.presets) return
  activeSettings.value.presets = activeSettings.value.presets.filter((p: ApiPreset) => !ids.includes(p.id))
  
  if (ids.includes(activeSettings.value.currentPresetId)) {
    activeSettings.value.currentPresetId = ''
  }
}

const showResetModal = ref(false)

const handleResetClick = () => {
  showResetModal.value = true
}

const confirmReset = () => {
  activeSettings.value.url = ''
  activeSettings.value.key = ''
  if (activeSettings.value.provider === 'custom') {
    activeSettings.value.customUrl = ''
    activeSettings.value.customKey = ''
  }
  showResetModal.value = false
}

const cancelReset = () => {
  showResetModal.value = false
}

watch(() => apiSettings.url, (newUrl) => {
  if (apiSettings.provider === 'custom') {
    apiSettings.customUrl = newUrl
  }
})

watch(() => apiSettings.key, (newKey) => {
  if (apiSettings.provider === 'custom') {
    apiSettings.customKey = newKey
  }
})

watch(() => summaryApiSettings.url, (newUrl) => {
  if (summaryApiSettings.provider === 'custom') {
    summaryApiSettings.customUrl = newUrl
  }
})

watch(() => summaryApiSettings.key, (newKey) => {
  if (summaryApiSettings.provider === 'custom') {
    summaryApiSettings.customKey = newKey
  }
})

watch(() => visionApiSettings.url, (newUrl) => {
  if (visionApiSettings.provider === 'custom') {
    visionApiSettings.customUrl = newUrl
  }
})

watch(() => visionApiSettings.key, (newKey) => {
  if (visionApiSettings.provider === 'custom') {
    visionApiSettings.customKey = newKey
  }
})

watch(() => momentApiSettings.url, (newUrl) => {
  if (momentApiSettings.provider === 'custom') {
    momentApiSettings.customUrl = newUrl
  }
})

watch(() => momentApiSettings.key, (newKey) => {
  if (momentApiSettings.provider === 'custom') {
    momentApiSettings.customKey = newKey
  }
})

watch(() => characterApiSettings.url, newUrl => {
  if (characterApiSettings.provider === 'custom') characterApiSettings.customUrl = newUrl
})

watch(() => characterApiSettings.key, newKey => {
  if (characterApiSettings.provider === 'custom') characterApiSettings.customKey = newKey
})

watch(() => embeddingApiSettings.url, (newUrl) => {
  if (embeddingApiSettings.provider === 'custom') embeddingApiSettings.customUrl = newUrl
})

watch(() => embeddingApiSettings.key, (newKey) => {
  if (embeddingApiSettings.provider === 'custom') embeddingApiSettings.customKey = newKey
})

const isFetching = ref(false)
const fetchError = ref('')
const fetchSuccess = ref(false)

const fetchModels = async () => {
  if (!activeSettings.value.url || !activeSettings.value.key) {
    fetchError.value = '请先填写API地址和密钥'
    return
  }
  isFetching.value = true
  fetchError.value = ''
  fetchSuccess.value = false
  
  try {
    const baseUrl = activeSettings.value.url.replace(/\/+$/, '')
    const provider = activeSettings.value.provider
    let endpoint = `${baseUrl}${baseUrl.endsWith('/v1') ? '' : '/v1'}/models`
    let headers: Record<string, string> = { Authorization: `Bearer ${activeSettings.value.key}`, 'Content-Type': 'application/json' }
    if (provider === 'claude') {
      endpoint = `${baseUrl}${baseUrl.endsWith('/v1') ? '' : '/v1'}/models`
      headers = { 'x-api-key': activeSettings.value.key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
    } else if (provider === 'gemini') {
      endpoint = `${baseUrl.replace(/\/v1(?:beta)?$/i, '')}/v1beta/models?pageSize=1000`
      headers = { 'x-goog-api-key': activeSettings.value.key, 'Content-Type': 'application/json' }
    }
    const res = await fetch(endpoint, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const modelIds = provider === 'gemini'
      ? (Array.isArray(data?.models) ? data.models.filter((m: any) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent')).map((m: any) => String(m.name || '').replace(/^models\//, '')) : [])
      : (Array.isArray(data?.data) ? data.data.map((m: any) => m.id) : [])
    if (modelIds.length) {
      activeSettings.value.availableModels = modelIds
      fetchSuccess.value = true
      
      if (activeSettings.value.availableModels.length > 0 && (!activeSettings.value.model || !activeSettings.value.availableModels.includes(activeSettings.value.model))) {
        activeSettings.value.model = activeSettings.value.availableModels[0]
      }
    } else {
      throw new Error('未返回标准格式')
    }
  } catch (err: any) {
    fetchError.value = err.message || '拉取失败'
  } finally {
    isFetching.value = false
    setTimeout(() => {
      fetchError.value = ''
      fetchSuccess.value = false
    }, 3000)
  }
}

onMounted(() => {
  if (apiSettings.url && apiSettings.key && (!apiSettings.availableModels || apiSettings.availableModels.length === 0)) {
    const originalTab = currentTab.value
    currentTab.value = 'global'
    fetchModels()
    currentTab.value = originalTab
  }
})

const showPassword = ref(false)

const togglePassword = () => {
  showPassword.value = !showPassword.value
}

// --- New API 导入逻辑 ---
const showNewApiImportModal = ref(false)

const handleOpenNewApiImport = () => {
  showNewApiImportModal.value = true
}

const targetNodeName = computed(() => {
  const map: Record<string, string> = {
    global: '全局节点',
    summary: '总结节点',
    vision: '识图节点',
    moment: '朋友圈节点',
    embedding: '向量节点',
    character: '角色生成节点'
  }
  return map[currentTab.value] || '未知节点'
})

const importedNodeInfo = computed(() => activeSettings.value.newApiNode || null)
const isRefreshingImportedNode = ref(false)

const handleNewApiDetect = (_data: { baseUrl: string, apiKey: string }) => {}

const handleNewApiConfirm = (result: NewApiDetectionResult) => {
  const settings = activeSettings.value
  const { baseUrl, apiKey } = result.credentials

  settings.provider = 'custom'
  settings.url = baseUrl
  settings.key = apiKey
  settings.customUrl = baseUrl
  settings.customKey = apiKey
  settings.availableModels = [...result.models]
  if (!settings.model || !result.models.includes(settings.model)) {
    settings.model = result.models[0] || ''
  }
  settings.newApiNode = { ...result.nodeInfo }

  if (!Array.isArray(settings.presets)) settings.presets = []
  const existingPreset = settings.presets.find((preset: ApiPreset) => (
    preset.provider === 'custom' && preset.url === baseUrl && preset.key === apiKey
  ))
  const presetData: ApiPreset = {
    id: existingPreset?.id || `new-api_${Date.now()}`,
    name: `${result.nodeInfo.systemName} · New API`,
    provider: 'custom',
    url: baseUrl,
    key: apiKey,
    model: settings.model,
    customUrl: baseUrl,
    customKey: apiKey,
    enableTemperature: settings.enableTemperature,
    temperature: settings.temperature,
    enableMaxTokens: settings.enableMaxTokens,
    maxTokens: settings.maxTokens,
    enableTopP: settings.enableTopP,
    topP: settings.topP,
    enableFrequencyPenalty: settings.enableFrequencyPenalty,
    frequencyPenalty: settings.frequencyPenalty,
    enablePresencePenalty: settings.enablePresencePenalty,
    presencePenalty: settings.presencePenalty,
    enableStream: settings.enableStream,
    batchSize: currentTab.value === 'embedding' ? settings.batchSize : undefined
  }

  if (existingPreset) Object.assign(existingPreset, presetData)
  else settings.presets.push(presetData)
  settings.currentPresetId = presetData.id
}

const handleRefreshImportedNode = async () => {
  const settings = activeSettings.value
  if (!settings.newApiNode || !settings.key || isRefreshingImportedNode.value) return

  isRefreshingImportedNode.value = true
  try {
    const result = await detectNewApiNode({
      baseUrl: settings.newApiNode.baseUrl || settings.url,
      apiKey: settings.key
    })
    settings.newApiNode = { ...result.nodeInfo }
    settings.availableModels = [...result.models]
    if (!settings.model || !result.models.includes(settings.model)) {
      settings.model = result.models[0] || ''
    }
  } catch (error: any) {
    settings.newApiNode = {
      ...settings.newApiNode,
      connected: false,
      checkedAt: Date.now(),
      errorMessage: error?.message || '刷新节点信息失败'
    }
  } finally {
    isRefreshingImportedNode.value = false
  }
}

const handleUnbindNode = () => {
  activeSettings.value.newApiNode = null
}

const handleNodeDetail = () => {
  const baseUrl = importedNodeInfo.value?.baseUrl
  if (!baseUrl) return
  window.open(`${baseUrl}/console/token`, '_blank', 'noopener,noreferrer')
}

// --- 真实 API 连通性测试逻辑 ---
const showTestModal = ref(false)
const testLoading = ref(false)
const testInputText = ref('Hello')
const testResult = ref<{ type: 'success' | 'error', text: string } | null>(null)

const handleTestConnectionClick = () => {
  if (!activeSettings.value.url || !activeSettings.value.key) {
    showTestModal.value = true
    testResult.value = { type: 'error', text: '请先填写 API 地址和密钥' }
  } else if (!activeSettings.value.model) {
    showTestModal.value = true
    testResult.value = { type: 'error', text: '请先在“指定模型”中填入或同步模型名称' }
  } else {
    showTestModal.value = true
    testResult.value = null
  }
}

const cancelTest = () => {
  if (testLoading.value) return
  showTestModal.value = false
  testResult.value = null
}

const estimatedTokens = computed(() => {
  if (!testInputText.value) return 0
  const text = testInputText.value
  let cnCount = 0
  let enCount = 0
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 255) {
      cnCount++
    } else {
      enCount++
    }
  }
  // 简易估算：中文约 1.5 Token，英文字符约 0.25 Token (1单词约4字符) + 基础 Prompt 约 10 Token
  const basePromptTokens = 10
  return Math.ceil(cnCount * 1.5 + enCount * 0.25) + basePromptTokens
})

const confirmTest = async () => {
  if (!testInputText.value.trim()) {
    testResult.value = { type: 'error', text: '测试文本不能为空' }
    return
  }

  if (!activeSettings.value.model) {
    testResult.value = { type: 'error', text: '请先在“指定模型”中填入或同步模型名称' }
    return
  }
  
  testLoading.value = true
  testResult.value = null
  
  try {
    const baseUrl = activeSettings.value.url.replace(/\/+$/, '')
    const isEmbeddingTest = currentTab.value === 'embedding'
    const modelToUse = activeSettings.value.model
    const prepared = isEmbeddingTest ? null : prepareAdapterRequest({
      provider: activeSettings.value.provider,
      url: baseUrl,
      key: activeSettings.value.key,
      model: modelToUse,
      maxTokens: 50,
      stream: false
    }, [{ role: 'user', content: testInputText.value }])
    const endpoint = isEmbeddingTest
      ? (baseUrl.endsWith('/embeddings') ? baseUrl : `${baseUrl}${baseUrl.includes('/v1') ? '' : '/v1'}/embeddings`)
      : prepared!.endpoint
    const headers = isEmbeddingTest
      ? { Authorization: `Bearer ${activeSettings.value.key}`, 'Content-Type': 'application/json' }
      : prepared!.headers
    const payload = isEmbeddingTest ? { model: modelToUse, input: [testInputText.value] } : prepared!.body

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })
    
    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`HTTP ${res.status}: ${errorText}`)
    }
    
    const data = await res.json()
    if (isEmbeddingTest && Array.isArray(data.data) && Array.isArray(data.data[0]?.embedding)) {
      testResult.value = { type: 'success', text: `向量节点连接成功，返回 ${data.data[0].embedding.length} 维向量。` }
    } else if (prepared) {
      const parsed = parseAdapterResponse(prepared.profile, data)
      if (!parsed.content && !parsed.thinking) throw new Error('返回数据格式异常')
      testResult.value = { type: 'success', text: parsed.content || parsed.thinking }
    } else {
      throw new Error('返回数据格式异常')
    }
    
  } catch (err: any) {
    testResult.value = { type: 'error', text: err.message || '请求失败' }
  } finally {
    testLoading.value = false
  }
}
</script>

<template>
  <div class="api-modal editorial-style" :class="{ 'is-dark': globalSettings.darkMode }">
    
    <!-- 百合花背景水印：使用原生img标签以恢复自然流式加载，不阻塞UI -->
    <img class="lily-watermark" src="https://img.baibai.cv/f/BpZaFX/natalie-kinnear-01o_HP0wu_E-unsplash.jpg" alt="" />

    <div class="content-scroll">
      
      <div class="page-header">
        <div class="page-title-group">
          <div class="title-wrapper" @click="emit('close')" role="button" title="点击返回">
            <h1 class="en-title">Destiny</h1>
            <span class="cn-subtitle">API 节点配置</span>
          </div>
        </div>

        <div class="minimal-search" :class="{ 'is-active': searchQuery || isSearchFocused }">
          <svg class="search-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" @click="searchInput?.focus()"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            ref="searchInput"
            v-model="searchQuery" 
            class="search-input" 
            placeholder="搜索 Search..." 
            spellcheck="false" 
            autocomplete="off"
            @focus="isSearchFocused = true"
            @blur="isSearchFocused = false"
          />
          <button v-if="searchQuery" class="clear-search-btn" @click="searchQuery = ''; searchInput?.focus()">
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <!-- 纯文本排版的 Tabs -->
      <div class="text-tabs">
        <div class="tab-item" :class="{ active: currentTab === 'global' }" @click="currentTab = 'global'">
          <span>全局节点</span>
          <div class="tab-line"></div>
        </div>
        <div class="tab-item" :class="{ active: currentTab === 'summary' }" @click="currentTab = 'summary'">
          <span>总结节点</span>
          <div class="tab-line"></div>
        </div>
        <div class="tab-item" :class="{ active: currentTab === 'vision' }" @click="currentTab = 'vision'">
          <span>识图节点</span>
          <div class="tab-line"></div>
        </div>
        <div class="tab-item" :class="{ active: currentTab === 'moment' }" @click="currentTab = 'moment'">
          <span>朋友圈节点</span>
          <div class="tab-line"></div>
        </div>
        <div class="tab-item" :class="{ active: currentTab === 'embedding' }" @click="currentTab = 'embedding'">
          <span>向量节点</span>
          <div class="tab-line"></div>
        </div>
        <div class="tab-item" :class="{ active: currentTab === 'character' }" @click="currentTab = 'character'">
          <span>角色生成</span>
          <div class="tab-line"></div>
        </div>
      </div>

      <!-- 线程主容器，用于绘制贯穿红线 -->
      <div class="thread-wrapper">
        <div class="red-line-track"></div>

        <!-- 总结节点专属开关 -->
        <div class="settings-section" v-if="currentTab === 'summary'">
          <div class="red-dot"></div>
          <div class="form-grid">
            <div class="form-row">
              <div class="form-label space-between">
                <span class="cn-text">启用独立的总结节点</span>
                <label class="editorial-switch">
                  <input type="checkbox" v-model="summaryApiSettings.enabled">
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          </div>
          <div class="section-desc" v-if="!summaryApiSettings.enabled">
            当前总结功能使用全局节点。开启后可为总结单独配置更便宜的模型。
          </div>
        </div>

        <!-- 识图节点专属开关 -->
        <div class="settings-section" v-if="currentTab === 'vision'">
          <div class="red-dot"></div>
          <div class="form-grid">
            <div class="form-row">
              <div class="form-label space-between">
                <span class="cn-text">启用独立的识图节点</span>
                <label class="editorial-switch">
                  <input type="checkbox" v-model="visionApiSettings.enabled">
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          </div>
          <div class="section-desc" v-if="!visionApiSettings.enabled">
            当前识图功能使用全局节点。开启后可为识图单独配置更专业的模型。
          </div>
        </div>

        <!-- 朋友圈节点专属开关 -->
        <div class="settings-section" v-if="currentTab === 'moment'">
          <div class="red-dot"></div>
          <div class="form-grid">
            <div class="form-row">
              <div class="form-label space-between">
                <span class="cn-text">启用独立的朋友圈节点</span>
                <label class="editorial-switch">
                  <input type="checkbox" v-model="momentApiSettings.enabled">
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          </div>
          <div class="section-desc" v-if="!momentApiSettings.enabled">
            当前角色看完朋友圈后的回应使用全局节点。开启后可为第二轮回应单独配置更便宜的模型。
          </div>
          <div class="section-desc" v-else>
            仅接管角色读取朋友圈后的第二轮回应；首次聊天与是否查看朋友圈的判断仍使用全局节点。配置不完整时会自动使用全局节点。
          </div>
        </div>

        <div class="settings-section" v-if="currentTab === 'embedding'">
          <div class="red-dot"></div>
          <div class="form-grid">
            <div class="form-row">
              <div class="form-label space-between">
                <span class="cn-text">启用独立的向量节点</span>
                <label class="editorial-switch">
                  <input type="checkbox" v-model="embeddingApiSettings.enabled">
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          </div>
          <div class="section-desc" v-if="!embeddingApiSettings.enabled">
            向量记忆为可选功能。未开启时仍可使用总结、变量、表格记忆，并自动采用本地关键词混合召回。
          </div>
          <div class="section-desc" v-else>
            需要支持 OpenAI 风格 /v1/embeddings 的节点。聊天与总结模型不会因此改变。
          </div>
        </div>

        <div class="settings-section" v-if="currentTab === 'character'">
          <div class="red-dot"></div>
          <div class="form-grid">
            <div class="form-row">
              <div class="form-label space-between">
                <span class="cn-text">启用独立的角色生成节点</span>
                <label class="editorial-switch">
                  <input type="checkbox" v-model="characterApiSettings.enabled">
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          </div>
          <div class="section-desc" v-if="!characterApiSettings.enabled">当前角色工坊使用全局节点。开启后可单独配置更擅长长文本规划与结构化输出的模型。</div>
          <div class="section-desc" v-else>仅接管角色创建、补全与试演。配置不完整时自动回退全局节点，不影响日常聊天。</div>
        </div>

        <template v-if="currentTab === 'global' || (currentTab === 'summary' && summaryApiSettings.enabled) || (currentTab === 'vision' && visionApiSettings.enabled) || (currentTab === 'moment' && momentApiSettings.enabled) || (currentTab === 'embedding' && embeddingApiSettings.enabled) || (currentTab === 'character' && characterApiSettings.enabled)">
          
          <!-- 预设方案区域 -->
          <div class="settings-section" v-show="isMatch('预设 方案 管理')">
            <div class="red-dot"></div>
            <div class="section-title">
              <span class="cn">预设方案</span>
              <span class="en">PRESETS</span>
            </div>
            <div class="form-grid">
              <div class="form-row">
                <div class="form-label">切换预设</div>
                <div class="form-value full-width">
                  <SearchableSelect
                    v-model="activeSettings.currentPresetId"
                    :options="presetOptions"
                    @change="applyPreset(activeSettings.currentPresetId)"
                    placeholder="请选择预设方案"
                    :is-dark="globalSettings.darkMode"
                    currentStyle="editorial"
                  />
                </div>
              </div>

              <div class="form-row form-row-footer border-none">
                <div class="footer-actions">
                  <button class="text-action-btn" @click="showSavePresetModal = true">
                    <span class="cn-text">保存当前配置</span>
                    <span class="en-text">SAVE PRESET</span>
                  </button>
                  <button class="text-action-btn" @click="showManagePresetModal = true">
                    <span class="cn-text">管理预设</span>
                    <span class="en-text">MANAGE</span>
                  </button>
                </div>
              </div>
            </div>
            <div class="section-desc">每个节点的预设方案相互独立，可保存常用的配置组合以便快速切换。</div>
          </div>

          <div class="settings-section" v-show="isMatch('服务商 接口地址 api密钥 测试 重置')">
            <div class="red-dot"></div>
            <div class="section-title">
              <span class="cn">基础接入</span>
              <span class="en">CONNECTION</span>
            </div>
            <div class="form-grid">
              
              <div class="form-row" v-show="isMatch('服务商')">
                <div class="form-label">服务商</div>
                <div class="form-value full-width">
                  <SearchableSelect
                    v-model="activeSettings.provider"
                    :options="providerOptions"
                    @change="onProviderChange"
                    :is-dark="globalSettings.darkMode"
                    currentStyle="editorial"
                  />
                </div>
              </div>
              
              <div class="form-row" v-show="isMatch('接口地址')">
                <div class="form-label">
                  接口地址
                  <span v-if="activeSettings.provider !== 'custom'" class="auto-tag">默认</span>
                </div>
                <div class="form-value">
                  <input v-model="activeSettings.url" class="line-input" placeholder="https://..." spellcheck="false" autocomplete="off" />
                </div>
              </div>

              <div class="form-row" v-show="isMatch('api 密钥')">
                <div class="form-label">API 密钥</div>
                <div class="form-value input-with-action">
                  <input :type="showPassword ? 'text' : 'password'" v-model="activeSettings.key" class="line-input" placeholder="sk-..." spellcheck="false" autocomplete="off" />
                  <button class="icon-action-btn" @click="togglePassword" :title="showPassword ? '隐藏' : '显示'">
                    <svg v-if="!showPassword" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    <svg v-else viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  </button>
                </div>
              </div>

              <!-- 导入 New API 节点入口按钮 -->
              <div class="form-row border-none import-btn-row">
                <div class="form-value full-width">
                  <button class="import-new-api-btn" type="button" @click="handleOpenNewApiImport">
                    <span class="cn-text">导入 New API 节点</span>
                    <span class="en-text">IMPORT NEW API</span>
                  </button>
                </div>
              </div>

              <div class="form-row form-row-footer" v-show="isMatch('服务商 接口地址 api密钥 测试 重置')">
                <div class="footer-actions">
                  <button class="text-action-btn test-btn" @click="handleTestConnectionClick">
                    <span class="cn-text">测试</span>
                    <span class="en-text">TEST CONNECTION</span>
                  </button>
                  <button class="text-action-btn reset-btn" @click="handleResetClick">
                    <span class="cn-text">重置</span>
                    <span class="en-text">RESET</span>
                  </button>
                </div>
              </div>

            </div>
            <div class="section-desc">您的凭证仅保存在本地设备，确保极致隐私安全。</div>

            <!-- 导入成功后的节点状态卡片 -->
            <NewApiNodeStatusCard
              v-if="importedNodeInfo"
              :dark-mode="globalSettings.darkMode"
              :node-info="importedNodeInfo"
              :refreshing="isRefreshingImportedNode"
              @refresh="handleRefreshImportedNode"
              @detail="handleNodeDetail"
              @reimport="handleOpenNewApiImport"
              @unbind="handleUnbindNode"
            />
          </div>

          <div class="settings-section" v-show="isMatch('可用模型 指定模型')">
            <div class="red-dot"></div>
            <div class="section-title">
              <span class="cn">引擎与参数</span>
              <span class="en">MODEL</span>
            </div>
            <div class="form-grid">
              
              <div class="form-row" v-show="isMatch('可用模型')">
                <div class="form-label">可用模型</div>
                <div class="form-value action-group">
                  <div class="full-width relative">
                    <SearchableSelect
                      v-model="activeSettings.model"
                      :options="modelOptions"
                      :disabled="!activeSettings.availableModels?.length"
                      placeholder="请选择拉取到的模型"
                      :is-dark="globalSettings.darkMode"
                      currentStyle="editorial"
                    />
                  </div>
                  <button class="text-action-btn sync-btn" @click="fetchModels" :disabled="isFetching">
                    <span class="cn-text">同步</span>
                    <span class="en-text">{{ isFetching ? 'SYNCING...' : 'SYNC' }}</span>
                  </button>
                </div>
              </div>
              
              <div class="form-row" v-show="isMatch('指定模型')">
                <div class="form-label">指定模型</div>
                <div class="form-value">
                  <input v-model="activeSettings.model" class="line-input" placeholder="可手动填入模型标识..." spellcheck="false" autocomplete="off" />
                </div>
              </div>

              <div class="form-row" v-if="currentTab === 'embedding'" v-show="isMatch('批量 大小')">
                <div class="form-label">批量大小</div>
                <div class="form-value">
                  <input type="number" v-model.number="embeddingApiSettings.batchSize" min="1" max="100" class="line-input" />
                </div>
              </div>

            </div>
            <div class="section-desc status-msg" v-if="fetchError || fetchSuccess">
              <span class="error" v-if="fetchError">{{ fetchError }}</span>
              <span class="success" v-if="fetchSuccess">已成功同步节点支持的模型。</span>
            </div>
            <div class="section-desc" v-else>
              可自动同步节点支持的模型或手动指定。
            </div>
          </div>

          <div class="settings-section" v-if="currentTab !== 'embedding'" v-show="isMatch('高级 参数 温度 max_tokens top_p 惩罚')">
            <div class="red-dot"></div>
            <div class="section-title">
              <span class="cn">高级参数</span>
              <span class="en">ADVANCED</span>
            </div>
            <div class="form-grid">
              
              <div class="form-row">
                <div class="form-label space-between">
                  <span>Temperature (温度)</span>
                  <label class="editorial-switch">
                    <input type="checkbox" v-model="activeSettings.enableTemperature">
                    <span class="slider"></span>
                  </label>
                </div>
                <div class="form-value action-group" v-if="activeSettings.enableTemperature">
                  <input type="range" v-model.number="activeSettings.temperature" min="0" max="2" step="0.1" class="line-range" />
                  <input type="number" v-model.number="activeSettings.temperature" class="line-input num-input" step="0.1" />
                  <button class="icon-action-btn" @click="activeSettings.temperature = 0.7" title="重置(0.7)">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
                  </button>
                </div>
              </div>

              <div class="form-row">
                <div class="form-label space-between">
                  <span>Max Tokens (最大长度)</span>
                  <label class="editorial-switch">
                    <input type="checkbox" v-model="activeSettings.enableMaxTokens">
                    <span class="slider"></span>
                  </label>
                </div>
                <div class="form-value action-group" v-if="activeSettings.enableMaxTokens">
                  <input type="range" v-model.number="activeSettings.maxTokens" min="100" max="128000" step="100" class="line-range" />
                  <input type="number" v-model.number="activeSettings.maxTokens" class="line-input num-input large" step="100" />
                  <button class="icon-action-btn" @click="activeSettings.maxTokens = 1000" title="重置(1000)">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
                  </button>
                </div>
              </div>

              <div class="form-row">
                <div class="form-label space-between">
                  <span>Top P (核采样)</span>
                  <label class="editorial-switch">
                    <input type="checkbox" v-model="activeSettings.enableTopP">
                    <span class="slider"></span>
                  </label>
                </div>
                <div class="form-value action-group" v-if="activeSettings.enableTopP">
                  <input type="range" v-model.number="activeSettings.topP" min="0" max="1" step="0.05" class="line-range" />
                  <input type="number" v-model.number="activeSettings.topP" class="line-input num-input" step="0.05" />
                  <button class="icon-action-btn" @click="activeSettings.topP = 1.0" title="重置(1.0)">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
                  </button>
                </div>
              </div>

              <div class="form-row">
                <div class="form-label space-between">
                  <span>Frequency Penalty (频率惩罚)</span>
                  <label class="editorial-switch">
                    <input type="checkbox" v-model="activeSettings.enableFrequencyPenalty">
                    <span class="slider"></span>
                  </label>
                </div>
                <div class="form-value action-group" v-if="activeSettings.enableFrequencyPenalty">
                  <input type="range" v-model.number="activeSettings.frequencyPenalty" min="-2" max="2" step="0.1" class="line-range" />
                  <input type="number" v-model.number="activeSettings.frequencyPenalty" class="line-input num-input" step="0.1" />
                  <button class="icon-action-btn" @click="activeSettings.frequencyPenalty = 0" title="重置(0)">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
                  </button>
                </div>
              </div>

              <div class="form-row">
                <div class="form-label space-between">
                  <span>Presence Penalty (存在惩罚)</span>
                  <label class="editorial-switch">
                    <input type="checkbox" v-model="activeSettings.enablePresencePenalty">
                    <span class="slider"></span>
                  </label>
                </div>
                <div class="form-value action-group" v-if="activeSettings.enablePresencePenalty">
                  <input type="range" v-model.number="activeSettings.presencePenalty" min="-2" max="2" step="0.1" class="line-range" />
                  <input type="number" v-model.number="activeSettings.presencePenalty" class="line-input num-input" step="0.1" />
                  <button class="icon-action-btn" @click="activeSettings.presencePenalty = 0" title="重置(0)">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
                  </button>
                </div>
              </div>
              
            </div>
            <div class="section-desc">未开启时将使用服务商默认值。</div>
          </div>

          <div class="settings-section" v-show="isMatch('流式 接收 stream 网络')">
            <div class="red-dot"></div>
            <div class="section-title">
              <span class="cn">网络策略</span>
              <span class="en">NETWORK</span>
            </div>
            <div class="form-grid">
              <div class="form-row border-none">
                <div class="form-label space-between">
                  <span class="cn-text">底层流式接收 (Stream)</span>
                  <label class="editorial-switch">
                    <input type="checkbox" v-model="activeSettings.enableStream">
                    <span class="slider"></span>
                  </label>
                </div>
              </div>
            </div>
            <div class="section-desc">
              建议代理节点容易超时的用户开启。开启后底层静默流式接收，UI 保留平滑打字机动画。
            </div>
          </div>
        </template>

      </div>
      
      <div class="scroll-spacer"></div>
    </div>

    <!-- 底部渐变遮罩，防内容干扰返回按钮 -->
    <div class="bottom-mask"></div>

    <!-- 摄影师署名 -->
    <div class="photo-credit">
      Photo by <a href="https://unsplash.com/@nataliekinnear?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noopener noreferrer">Natalie Kinnear</a> on <a href="https://unsplash.com/photos/a-pink-flower-with-green-leaves-in-a-vase-01o_HP0wu_E?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noopener noreferrer">Unsplash</a>
    </div>

    <!-- 极简返回按钮 -->
    <button class="editorial-return-btn" @click="emit('close')">
      <span class="cn">返回</span>
      <span class="en">RETURN</span>
      <div class="btn-line"></div>
    </button>

    <!-- 极简排版风格的重置确认弹窗 -->
    <div class="editorial-modal-overlay" v-if="showResetModal">
      <div class="editorial-modal-content">
        <h2 class="modal-en-title">Warning</h2>
        <p class="modal-cn-desc">确定要清空当前节点的配置信息吗？<br>此操作无法撤销。</p>
        <div class="modal-actions">
          <button class="text-action-btn" @click="cancelReset">
            <span class="cn-text">取消</span>
            <span class="en-text">CANCEL</span>
          </button>
          <button class="text-action-btn reset-btn" @click="confirmReset">
            <span class="cn-text">确认</span>
            <span class="en-text">CONFIRM</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 保存预设名称输入弹窗 -->
    <TextEditModal
      v-if="showSavePresetModal"
      :visible="showSavePresetModal"
      title="保存预设方案"
      currentText=""
      defaultText=""
      placeholder="请输入预设名称，例如：深度思考(慢)"
      @saved="handleSavePreset"
      @update:visible="showSavePresetModal = $event"
    />

    <!-- 预设方案管理弹窗 -->
    <ApiPresetManageModal
      v-if="showManagePresetModal"
      :presets="activeSettings.presets || []"
      :currentPresetId="activeSettings.currentPresetId"
      @delete="handleDeletePresets"
      @close="showManagePresetModal = false"
    />

    <!-- New API 一键导入弹窗 -->
    <NewApiImportModal
      :visible="showNewApiImportModal"
      :dark-mode="globalSettings.darkMode"
      :target-name="targetNodeName"
      @close="showNewApiImportModal = false"
      @detect="handleNewApiDetect"
      @confirm="handleNewApiConfirm"
    />

    <!-- 极简排版风格的测试连通性弹窗 -->
    <div class="editorial-modal-overlay" v-if="showTestModal">
      <div class="editorial-modal-content wide">
        <h2 class="modal-en-title">Connection</h2>
        
        <div class="modal-cn-desc text-left test-warning">
          <span class="highlight">温馨提示：真实测试将消耗您的 API 额度（Token）或使用次数。</span><br>
          若因测试触发风控导致封号或额度损耗，本应用概不负责。请确保您的服务商允许此操作。
        </div>

        <div class="test-input-wrapper">
          <div class="input-label">请在下方输入自定义的测试文本：</div>
          <input 
            v-model="testInputText" 
            class="line-input text-center" 
            placeholder="例如: Hello" 
            spellcheck="false" 
            :disabled="testLoading"
          />
          <div class="token-estimate" v-if="testInputText">
            预估消耗 Token: 约 {{ estimatedTokens }} (仅供参考)
          </div>
        </div>

        <!-- 结果回显区 -->
        <div class="test-result-area" v-if="testResult" :class="testResult.type">
          {{ testResult.text }}
        </div>

        <div class="modal-actions">
          <button class="text-action-btn" @click="cancelTest" :disabled="testLoading">
            <span class="cn-text">取消</span>
            <span class="en-text">CANCEL</span>
          </button>
          <button class="text-action-btn submit-btn" @click="confirmTest" :disabled="testLoading">
            <span class="cn-text">发送</span>
            <span class="en-text">{{ testLoading ? 'SENDING...' : 'SEND' }}</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped src="./ApiSettings.css"></style>
