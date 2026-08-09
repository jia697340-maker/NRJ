/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { globalSettings, apiSettings, summaryApiSettings, visionApiSettings, momentApiSettings, embeddingApiSettings, cotSettings, type CotItem, type ApiPreset } from '../store'
import SearchableSelect from './SearchableSelect.vue'
import TextEditModal from './TextEditModal.vue'
import ApiPresetManageModal from './ApiPresetManageModal.vue'
import { parseAdapterResponse, prepareAdapterRequest } from '../services/modelAdapters'

const currentTab = ref<'global' | 'summary' | 'vision' | 'moment' | 'embedding'>('global')

const activeSettings = computed<any>(() => {
  if (currentTab.value === 'embedding') return embeddingApiSettings
  if (currentTab.value === 'summary') return summaryApiSettings
  if (currentTab.value === 'vision') return visionApiSettings
  if (currentTab.value === 'moment') return momentApiSettings
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

// --- 真实 API 连通性测试逻辑 ---
const showTestModal = ref(false)
const testLoading = ref(false)
const testInputText = ref('Hello')
const testResult = ref<{ type: 'success' | 'error', text: string } | null>(null)

const handleTestConnectionClick = () => {
  if (!activeSettings.value.url || !activeSettings.value.key) {
    showTestModal.value = true
    testResult.value = { type: 'error', text: '请先填写 API 地址和密钥' }
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
  
  testLoading.value = true
  testResult.value = null
  
  try {
    const baseUrl = activeSettings.value.url.replace(/\/+$/, '')
    const isEmbeddingTest = currentTab.value === 'embedding'
    // 如果没有选择模型，则默认一个
    const modelToUse = activeSettings.value.model || (activeSettings.value.availableModels && activeSettings.value.availableModels[0]) || 'gpt-3.5-turbo'
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
    
    <!-- 百合花背景水印 -->
    <div class="lily-watermark"></div>

    <div class="content-scroll">
      
      <div class="page-header">
        <div class="title-wrapper" @click="emit('close')" role="button" title="点击返回">
          <h1 class="en-title">Destiny</h1>
          <span class="cn-subtitle">API 节点配置</span>
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

        <template v-if="currentTab === 'global' || (currentTab === 'summary' && summaryApiSettings.enabled) || (currentTab === 'vision' && visionApiSettings.enabled) || (currentTab === 'moment' && momentApiSettings.enabled) || (currentTab === 'embedding' && embeddingApiSettings.enabled)">
          
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

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Noto+Serif+SC:wght@300;400;500&display=swap');

.editorial-style {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #FFFFFF;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  color: #1A1A1A;
  z-index: 1000;
  overflow: hidden;
  transition: background-color 0.3s, color 0.3s;
}

.is-dark.editorial-style {
  background-color: #0D0D0D;
  color: #E6E6E6;
}

/* --- 百合花水印背景 --- */
.lily-watermark {
  position: absolute;
  right: -10%;
  bottom: -5%;
  width: 80%;
  height: 80%;
  background-image: url('https://img.baibai.cv/f/BpZaFX/natalie-kinnear-01o_HP0wu_E-unsplash.jpg');
  background-size: contain;
  background-position: bottom right;
  background-repeat: no-repeat;
  pointer-events: none;
  z-index: 0;
  /* 褪色做旧调色 */
  filter: grayscale(100%) contrast(120%) sepia(10%);
  opacity: 0.12;
  mix-blend-mode: multiply;
  transition: opacity 0.5s, filter 0.5s;
}

.is-dark .lily-watermark {
  filter: grayscale(100%) contrast(120%) invert(1);
  opacity: 0.08;
  mix-blend-mode: screen;
}

/* --- 主内容区 --- */
.content-scroll {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 56px 32px;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 48px;
  position: relative;
}

.title-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  cursor: pointer;
  transition: opacity 0.2s;
}

.title-wrapper:active {
  opacity: 0.7;
}

.en-title {
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: 52px;
  font-weight: 400;
  color: #111;
  line-height: 1;
  margin: 0;
  letter-spacing: -1px;
}

.is-dark .en-title {
  color: #F5F5F5;
}

.cn-subtitle {
  font-family: 'Noto Serif SC', serif;
  font-size: 10px;
  font-weight: 300;
  color: #666;
  letter-spacing: 8px;
  margin-top: 4px;
  margin-left: 24px; /* 错落排版 */
  text-transform: uppercase;
}

.is-dark .cn-subtitle {
  color: #999;
}

/* 搜索框隐形化 */
.minimal-search {
  display: flex;
  align-items: center;
  border-bottom: 1px solid transparent;
  padding: 4px 0;
  width: 14px; /* 初始只显示图标宽度 */
  height: 24px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  margin-top: 12px;
}

.minimal-search.is-active {
  width: 140px;
  border-bottom-color: #E0E0E0;
}

.is-dark .minimal-search.is-active {
  border-bottom-color: #333;
}

.minimal-search .search-icon {
  color: #999;
  flex-shrink: 0;
  cursor: pointer;
  transition: color 0.3s;
}

.minimal-search.is-active .search-icon {
  color: #111;
}

.is-dark .minimal-search.is-active .search-icon {
  color: #EEE;
}

.minimal-search .search-input {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 12px;
  color: #111;
  font-family: 'Noto Serif SC', serif;
  padding-left: 10px;
  opacity: 0;
  transition: opacity 0.3s;
}

.is-dark .minimal-search .search-input {
  color: #EEE;
}

.minimal-search.is-active .search-input {
  opacity: 1;
}

.minimal-search .search-input::placeholder {
  color: #BBB;
  font-family: 'Noto Serif SC', 'Playfair Display', serif;
  font-size: 12px;
}

.is-dark .minimal-search .search-input::placeholder {
  color: #555;
}

.clear-search-btn {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 4px;
  flex-shrink: 0;
}

/* 纯文本 Tabs */
.text-tabs {
    display: flex;
    gap: 18px;
    margin-bottom: 40px;
    overflow-x: auto;
    scrollbar-width: none;
  }
.text-tabs::-webkit-scrollbar { display: none; }
.tab-item {
  flex: 0 0 calc((100% - 54px) / 4);
  white-space: nowrap;
  text-align: center;
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  color: #999;
  cursor: pointer;
  position: relative;
  padding-bottom: 6px;
  transition: color 0.3s;
}
.is-dark .tab-item {
  color: #666;
}
.tab-item.active {
  color: #111;
  font-weight: 500;
}
.is-dark .tab-item.active {
  color: #F5F5F5;
}
.tab-line {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0%;
  height: 1px;
  background-color: #C62828;
  transition: width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.tab-item.active .tab-line {
  width: 100%;
}

/* 线程容器 & 红线 */
.thread-wrapper {
  position: relative;
  padding-left: 20px; /* 为红线留出空间 */
}
.red-line-track {
  position: absolute;
  top: 10px;
  bottom: 0;
  left: 2px; /* 红线位置 */
  width: 1px;
  background-color: rgba(198, 40, 40, 0.2);
  z-index: 0;
}

/* 区域排版 */
.settings-section {
  position: relative;
  margin-bottom: 48px;
}
.red-dot {
  position: absolute;
  left: -20px; 
  top: 6px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: #C62828;
  z-index: 1;
}

.section-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 20px;
}
.section-title .cn {
  font-family: 'Noto Serif SC', serif;
  font-size: 16px;
  font-weight: 500;
  color: #111;
  letter-spacing: 1px;
}
.is-dark .section-title .cn {
  color: #EEE;
}
.section-title .en {
  font-family: 'Playfair Display', serif;
  font-size: 11px;
  font-style: italic;
  color: #888;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.form-grid {
  display: flex;
  flex-direction: column;
}
.form-row {
  display: flex;
  flex-direction: column;
  padding: 16px 0;
  border-bottom: 1px solid #F0F0F0;
}
.is-dark .form-row {
  border-bottom-color: #222;
}
.form-row.border-none {
  border-bottom: none;
}
.form-row-footer {
  padding: 24px 0 8px 0;
  border-bottom: none;
}

.form-label {
  font-size: 12px;
  font-weight: 400;
  color: #666;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: 0.5px;
}
.is-dark .form-label {
  color: #999;
}
.space-between {
  justify-content: space-between;
  margin-bottom: 0;
}

.auto-tag {
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: 10px;
  color: #C62828;
  opacity: 0.8;
}

.form-value {
  display: flex;
  align-items: center;
  width: 100%;
  position: relative;
}
.full-width {
  width: 100%;
}
.relative {
  position: relative;
}

/* 极简下划线输入框 */
.line-input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 14px;
  color: #111;
  padding: 4px 0;
  outline: none;
  font-family: inherit;
  font-weight: 400;
  letter-spacing: 0.5px;
  border-bottom: 1px dashed transparent;
  transition: border-color 0.3s;
}
.is-dark .line-input {
  color: #EEE;
}
.line-input:focus {
  border-bottom-color: #CCC;
}
.is-dark .line-input:focus {
  border-bottom-color: #555;
}
.line-input::placeholder {
  color: #CCC;
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
}
.is-dark .line-input::placeholder {
  color: #444;
}
.num-input {
  width: 50px;
  text-align: right;
}
.num-input.large {
  width: 70px;
}

/* 杂志风开关 */
.editorial-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 18px;
  flex-shrink: 0;
}
.editorial-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #E0E0E0;
  transition: .4s;
  border-radius: 18px;
}
.is-dark .slider {
  background-color: #333;
}
.slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: #FFF;
  transition: .4s;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
input:checked + .slider {
  background-color: #111;
}
.is-dark input:checked + .slider {
  background-color: #E6E6E6;
}
.is-dark input:checked + .slider:before {
  background-color: #111;
}
input:checked + .slider:before {
  transform: translateX(18px);
}

.input-with-action {
  gap: 12px;
}
.icon-action-btn {
  background: none;
  border: none;
  color: #999;
  padding: 4px;
  cursor: pointer;
  transition: color 0.2s;
}
.icon-action-btn:hover {
  color: #111;
}
.is-dark .icon-action-btn:hover {
  color: #EEE;
}

.action-group {
  gap: 16px;
}

/* 范围滑动条极简 */
.line-range {
  -webkit-appearance: none;
  flex: 1;
  height: 1px;
  background: #E0E0E0;
  outline: none;
}
.is-dark .line-range {
  background: #333;
}
.line-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #111;
  cursor: pointer;
}
.is-dark .line-range::-webkit-slider-thumb {
  background: #EEE;
}

.footer-actions {
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  width: 100%;
}

/* 花字动作按钮 */
.text-action-btn {
  background: none;
  border: none;
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  color: #666;
  cursor: pointer;
  padding: 4px 0;
  border-bottom: 1px solid transparent;
  transition: all 0.3s;
}
.text-action-btn .cn-text {
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 1px;
}
.text-action-btn .en-text {
  font-family: 'Playfair Display', serif;
  font-size: 11px;
  font-style: italic;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.75;
}
.is-dark .text-action-btn {
  color: #999;
}
.text-action-btn:hover {
  color: #111;
  border-bottom-color: #111;
}
.is-dark .text-action-btn:hover {
  color: #EEE;
  border-bottom-color: #EEE;
}
.text-action-btn.reset-btn {
  color: #C62828;
}
.text-action-btn.reset-btn:hover {
  border-bottom-color: #C62828;
}
.sync-btn {
  white-space: nowrap;
}

.section-desc {
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  color: #999;
  margin-top: 12px;
  line-height: 1.6;
  letter-spacing: 0.5px;
}
.is-dark .section-desc {
  color: #666;
}

.status-msg .error { color: #C62828; }
.status-msg .success { color: #4CAF50; }

.scroll-spacer {
  height: 120px;
}

/* 底部渐变遮罩 */
.bottom-mask {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 140px;
  background: linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 70%);
  pointer-events: none;
  z-index: 50;
}

/* 摄影师版权署名 */
.photo-credit {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  font-size: 9px;
  color: #999;
  letter-spacing: 0.5px;
  z-index: 100;
  pointer-events: auto;
  opacity: 0.6;
  transition: opacity 0.3s;
}
.is-dark .photo-credit {
  color: #666;
}
.photo-credit:hover {
  opacity: 1;
}
.photo-credit a {
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid rgba(153, 153, 153, 0.3);
  padding-bottom: 1px;
  transition: border-color 0.2s;
}
.photo-credit a:hover {
  border-bottom-color: #999;
}

.is-dark .bottom-mask {
  background: linear-gradient(to bottom, rgba(13,13,13,0) 0%, rgba(13,13,13,1) 70%);
}

/* 底部极简返回 */
.editorial-return-btn {
  position: absolute;
  bottom: 32px;
  right: 32px;
  background: none;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  cursor: pointer;
  z-index: 100;
  padding: 0;
}
.editorial-return-btn .cn {
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  font-weight: 500;
  color: #111;
  margin-bottom: 2px;
  letter-spacing: 1px;
  transition: color 0.3s;
}
.is-dark .editorial-return-btn .cn {
  color: #EEE;
}
.editorial-return-btn .en {
  font-family: 'Playfair Display', serif;
  font-size: 10px;
  font-weight: 400;
  font-style: italic;
  color: #999;
  letter-spacing: 2px;
  transition: color 0.3s;
}
.is-dark .editorial-return-btn .en {
  color: #666;
}
.editorial-return-btn .btn-line {
  width: 0%;
  height: 1px;
  background-color: #C62828;
  margin-top: 4px;
  transition: width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.editorial-return-btn:hover .btn-line {
  width: 100%;
}

/* 覆写 SearchableSelect 样式 */
:deep(.editorial .select-trigger) {
  background: transparent !important;
  padding: 4px 0 !important;
  font-size: 14px !important;
  color: #111 !important;
  border: none !important;
  border-bottom: 1px dashed transparent !important;
  border-radius: 0 !important;
  transition: border-color 0.3s !important;
}
.is-dark :deep(.editorial .select-trigger) {
  color: #EEE !important;
}
:deep(.editorial .select-trigger:hover) {
  border-bottom-color: #CCC !important;
}
.is-dark :deep(.editorial .select-trigger:hover) {
  border-bottom-color: #555 !important;
}
:deep(.editorial .select-dropdown) {
  border-radius: 4px !important;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1) !important;
  border: 1px solid #EEE !important;
}
.is-dark :deep(.editorial .select-dropdown) {
  box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
  border-color: #333 !important;
}

/* --- 极简排版二次确认弹窗 --- */
.editorial-modal-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.3s ease;
}
.is-dark .editorial-modal-overlay {
  background-color: rgba(13, 13, 13, 0.85);
}

.editorial-modal-content {
  background: transparent;
  padding: 40px;
  max-width: 320px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.modal-en-title {
  font-family: 'Playfair Display', serif;
  font-size: 32px;
  font-style: italic;
  font-weight: 400;
  color: #111;
  margin: 0;
  letter-spacing: 1px;
}
.is-dark .modal-en-title {
  color: #F5F5F5;
}

.modal-cn-desc {
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  color: #666;
  line-height: 1.8;
  margin: 0;
  letter-spacing: 0.5px;
}
.is-dark .modal-cn-desc {
  color: #999;
}

.editorial-modal-content.wide {
  max-width: 420px;
}

.modal-actions {
  display: flex;
  gap: 32px;
  margin-top: 16px;
}

.test-warning {
  font-size: 13px;
  line-height: 1.6;
  opacity: 0.85;
}
.test-warning .highlight {
  color: #C62828;
  font-weight: 500;
}
.text-left {
  text-align: left;
}

.test-input-wrapper {
  width: 100%;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.input-label {
  font-family: 'Noto Serif SC', serif;
  font-size: 12px;
  color: #888;
  text-align: left;
}
.is-dark .input-label {
  color: #666;
}
.text-center {
  text-align: center;
}
.token-estimate {
  font-family: 'Noto Serif SC', serif;
  font-size: 11px;
  color: #AAA;
  text-align: right;
  margin-top: 4px;
  font-style: italic;
}
.is-dark .token-estimate {
  color: #555;
}

.test-result-area {
  width: 100%;
  padding: 12px;
  font-size: 12px;
  font-family: 'Noto Serif SC', serif;
  text-align: left;
  border-left: 2px solid transparent;
  background: rgba(0,0,0,0.02);
  word-break: break-all;
  max-height: 150px;
  overflow-y: auto;
  animation: fadeIn 0.3s ease;
}
.is-dark .test-result-area {
  background: rgba(255,255,255,0.05);
}
.test-result-area.success {
  border-left-color: #4CAF50;
  color: #2E7D32;
}
.is-dark .test-result-area.success {
  color: #81C784;
}
.test-result-area.error {
  border-left-color: #C62828;
  color: #C62828;
}
.is-dark .test-result-area.error {
  color: #EF5350;
}

.submit-btn {
  color: #111;
}
.is-dark .submit-btn {
  color: #EEE;
}
.submit-btn:hover {
  border-bottom-color: #111;
}
.is-dark .submit-btn:hover {
  border-bottom-color: #EEE;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
