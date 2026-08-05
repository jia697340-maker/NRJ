/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useNovelAI } from '../composables/useNovelAI'
import { useNovelAIVibe } from '../composables/useNovelAIVibe'
import { useNovelAIHistory } from '../composables/useNovelAIHistory'
import ImageVibeManageModal from './ImageVibeManageModal.vue'
import ImageHistoryModal from './ImageHistoryModal.vue'

const emit = defineEmits(['close'])

const activeTab = ref('specs')
const showApiKey = ref(false)
const showPreviewModal = ref(false)
const showVibeManageModal = ref(false)
const showHistoryModal = ref(false)

const currentView = ref<'platforms' | 'novelai'>('platforms')

const {
  isGenerating,
  currentProgressImage,
  finalImage,
  errorMsg,
  pointsCost,
  generateImage,
  abortGeneration,
  lastGeneratedParams
} = useNovelAI()

const { addHistoryItem } = useNovelAIHistory()

watch(finalImage, async (newVal) => {
  if (newVal && lastGeneratedParams.value) {
    await addHistoryItem(lastGeneratedParams.value, newVal)
  }
})

const { vibeGroups, vibeImages } = useNovelAIVibe()

const presets = ref<any[]>(JSON.parse(localStorage.getItem('app_novelai_presets') || '[]'))
const currentPresetId = ref<string>(localStorage.getItem('app_novelai_current_preset') || '')

const promptPresets = ref<any[]>(JSON.parse(localStorage.getItem('app_novelai_prompt_presets') || '[]'))
const currentPromptPresetId = ref<string>(localStorage.getItem('app_novelai_current_prompt_preset') || '')

watch(presets, (val) => localStorage.setItem('app_novelai_presets', JSON.stringify(val)), { deep: true })
watch(currentPresetId, (val) => localStorage.setItem('app_novelai_current_preset', val))
watch(promptPresets, (val) => localStorage.setItem('app_novelai_prompt_presets', JSON.stringify(val)), { deep: true })
watch(currentPromptPresetId, (val) => localStorage.setItem('app_novelai_current_prompt_preset', val))

const config = ref({
  apiKey: localStorage.getItem('app_novelai_apikey') || '',
  baseUrl: localStorage.getItem('app_novelai_baseurl') || 'https://image.novelai.net',
  useStream: localStorage.getItem('app_novelai_usestream') !== 'false'
})

watch(() => config.value.apiKey, (val) => localStorage.setItem('app_novelai_apikey', val))
watch(() => config.value.baseUrl, (val) => localStorage.setItem('app_novelai_baseurl', val))
watch(() => config.value.useStream, (val) => localStorage.setItem('app_novelai_usestream', String(val)))

const showPresetNameModal = ref(false)
const newPresetName = ref('')

const showPromptPresetNameModal = ref(false)
const newPromptPresetName = ref('')

const showConfirmModal = ref(false)
const confirmModalMessage = ref('')
const confirmModalAction = ref<(() => void) | null>(null)

const handleConfirm = (message: string, action: () => void) => {
  confirmModalMessage.value = message
  confirmModalAction.value = action
  showConfirmModal.value = true
}

const executeConfirm = () => {
  if (confirmModalAction.value) {
    confirmModalAction.value()
  }
  showConfirmModal.value = false
}

const cancelConfirm = () => {
  showConfirmModal.value = false
}

const applyPreset = () => {
  if (!currentPresetId.value) return
  const preset = presets.value.find(p => p.id === currentPresetId.value)
  if (preset) {
    config.value.baseUrl = preset.baseUrl
    config.value.apiKey = preset.apiKey
    config.value.useStream = preset.useStream
  }
}

const savePreset = () => {
  newPresetName.value = ''
  showPresetNameModal.value = true
}

const confirmSavePreset = () => {
  const name = newPresetName.value.trim()
  if (!name) return
  
  const existingIndex = presets.value.findIndex(p => p.name === name)
  const presetData = {
    id: Date.now().toString(),
    name: name,
    baseUrl: config.value.baseUrl,
    apiKey: config.value.apiKey,
    useStream: config.value.useStream
  }
  
  if (existingIndex > -1) {
    handleConfirm(`预设 "${name}" 已存在，是否覆盖？`, () => {
      presetData.id = presets.value[existingIndex].id
      presets.value[existingIndex] = presetData
      currentPresetId.value = presetData.id
      showPresetNameModal.value = false
    })
  } else {
    presets.value.push(presetData)
    currentPresetId.value = presetData.id
    showPresetNameModal.value = false
  }
}

const cancelSavePreset = () => {
  showPresetNameModal.value = false
}

const deletePreset = () => {
  if (!currentPresetId.value) return
  handleConfirm('确定要删除此预设吗？', () => {
    presets.value = presets.value.filter(p => p.id !== currentPresetId.value)
    currentPresetId.value = ''
  })
}

const applyPromptPreset = () => {
  if (!currentPromptPresetId.value) return
  const preset = promptPresets.value.find(p => p.id === currentPromptPresetId.value)
  if (preset) {
    params.value.input = preset.prompt
    params.value.negative_prompt = preset.negativePrompt
  }
}

const savePromptPreset = () => {
  newPromptPresetName.value = ''
  showPromptPresetNameModal.value = true
}

const confirmSavePromptPreset = () => {
  const name = newPromptPresetName.value.trim()
  if (!name) return
  
  const existingIndex = promptPresets.value.findIndex(p => p.name === name)
  const presetData = {
    id: Date.now().toString(),
    name: name,
    prompt: params.value.input,
    negativePrompt: params.value.negative_prompt
  }
  
  if (existingIndex > -1) {
    handleConfirm(`预设 "${name}" 已存在，是否覆盖？`, () => {
      presetData.id = promptPresets.value[existingIndex].id
      promptPresets.value[existingIndex] = presetData
      currentPromptPresetId.value = presetData.id
      showPromptPresetNameModal.value = false
    })
  } else {
    promptPresets.value.push(presetData)
    currentPromptPresetId.value = presetData.id
    showPromptPresetNameModal.value = false
  }
}

const cancelSavePromptPreset = () => {
  showPromptPresetNameModal.value = false
}

const deletePromptPreset = () => {
  if (!currentPromptPresetId.value) return
  handleConfirm('确定要删除此预设吗？', () => {
    promptPresets.value = promptPresets.value.filter(p => p.id !== currentPromptPresetId.value)
    currentPromptPresetId.value = ''
  })
}

const DEFAULT_PROMPT = '1girl, solo, masterpiece, best quality, very aesthetic, absurdres, highres, highly detailed, beautiful detailed eyes, cinematic lighting'
const DEFAULT_NEGATIVE = 'lowres, {bad}, error, fewer, extra, missing, worst quality, jpeg artifacts, bad anatomy, bad hands, missing fingers, extra digits, blurry, cropped, signature, watermark, username, text'

const COMMON_RESOLUTIONS = [
  { label: '标准竖图 832×1216', width: 832, height: 1216 },
  { label: '标准横图 1216×832', width: 1216, height: 832 },
  { label: '标准方图 1024×1024', width: 1024, height: 1024 },
  { label: '大图竖图 1024×1536', width: 1024, height: 1536 },
  { label: '大图横图 1536×1024', width: 1536, height: 1024 },
  { label: '大图方图 1472×1472', width: 1472, height: 1472 },
  { label: '宽图竖图 1088×1920', width: 1088, height: 1920 },
  { label: '宽图横图 1920×1088', width: 1920, height: 1088 },
  { label: '小图竖图 512×768', width: 512, height: 768 },
  { label: '小图横图 768×512', width: 768, height: 512 },
  { label: '小图方图 640×640', width: 640, height: 640 }
]

const params = ref({
  input: localStorage.getItem('app_novelai_prompt') || DEFAULT_PROMPT,
  model: 'nai-diffusion-4-5-full',
  action: 'generate',
  width: 832,
  height: 1216,
  scale: 5.0,
  sampler: 'k_euler_ancestral',
  steps: 28,
  n_samples: 1,
  seed: '',
  noise_schedule: 'karras',
  sm: false,
  sm_dyn: false,
  skip_cfg_above_sigma: false,
  negative_prompt: localStorage.getItem('app_novelai_negative') || DEFAULT_NEGATIVE,
  vibe_group_ids: [] as string[]
})

watch(() => params.value.input, (val) => localStorage.setItem('app_novelai_prompt', val))
watch(() => params.value.negative_prompt, (val) => localStorage.setItem('app_novelai_negative', val))

onMounted(() => {
  const oldStyle = localStorage.getItem('app_novelai_styletags')
  if (oldStyle) {
    if (!params.value.input.includes(oldStyle.split(',')[0])) {
      params.value.input = oldStyle + ',\n' + params.value.input
    }
    localStorage.removeItem('app_novelai_styletags')
  }
})

const fixResolution = (val: number | string) => {
  let num = Number(val)
  if (isNaN(num)) num = 1024
  num = Math.max(64, num)
  return Math.floor(num / 64) * 64
}

const onWidthBlur = () => { params.value.width = fixResolution(params.value.width) }
const onHeightBlur = () => { params.value.height = fixResolution(params.value.height) }

const handleGenerate = () => {
  params.value.width = fixResolution(params.value.width)
  params.value.height = fixResolution(params.value.height)
  
  if (!config.value.apiKey) {
    alert('请填写 API Key')
    return
  }
  if (!params.value.input) {
    alert('提示词不能为空')
    return
  }
  
  showPreviewModal.value = true

  const { vibe_group_ids, seed, sm, sm_dyn, skip_cfg_above_sigma, ...restParams } = params.value
  const finalParams: any = { ...restParams }

  if (seed) {
    finalParams.seed = parseInt(seed as string)
  }
  
  if (params.value.model.includes('nai-diffusion-3')) {
    finalParams.sm = sm
    finalParams.sm_dyn = sm_dyn
  }
  
  if (params.value.model.includes('nai-diffusion-4')) {
    if (skip_cfg_above_sigma) {
      finalParams.skip_cfg_above_sigma = 19
    }
  }

  if (vibe_group_ids && vibe_group_ids.length > 0) {
    const refImages: string[] = []
    const refStrengths: number[] = []
    const refExtracteds: number[] = []

    for (const gid of vibe_group_ids) {
      const g = vibeGroups.value.find(vg => vg.id === gid)
      if (g) {
        for (const item of g.items) {
          const img = vibeImages.value.find(vi => vi.id === item.imageId)
          if (img) {
            refImages.push(img.base64)
            refStrengths.push(item.strength)
            refExtracteds.push(item.extracted)
          }
        }
      }
    }

    if (refImages.length > 0) {
      finalParams.reference_image_multiple = refImages
      finalParams.reference_strength_multiple = refStrengths
      finalParams.reference_information_extracted_multiple = refExtracteds
    }
  }

  generateImage(config.value, finalParams)
}

const closePreviewModal = () => {
  if (isGenerating.value) {
    abortGeneration()
  }
  showPreviewModal.value = false
}

const downloadImage = () => {
  if (!finalImage.value) return
  const link = document.createElement('a')
  link.href = finalImage.value
  link.download = `image_${Date.now()}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const resetPrompts = () => {
  handleConfirm('确定要恢复默认提示词吗？', () => {
    params.value.input = DEFAULT_PROMPT
    params.value.negative_prompt = DEFAULT_NEGATIVE
  })
}
</script>

<template>
  <div class="ia-wrapper">
    <!-- Platform Selection View -->
    <div v-if="currentView === 'platforms'" class="ia-page">
      <div class="ia-header">
        <div class="ia-header-left"></div>
        <h2 class="ia-title">图像引擎</h2>
        <div class="ia-header-right">
          <button class="nav-icon-btn" @click="$emit('close')" title="关闭">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM12 16L7 11H10V8H14V11H17L12 16Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="ia-scroll-body" style="padding-top: 20px;">
        <p class="ia-subtitle">选择要接入的图像生成服务</p>
        
        <div class="platform-list">
          <div class="platform-card active" @click="currentView = 'novelai'">
            <div class="platform-icon nai-icon">
              <span style="font-weight: 800; font-style: italic; font-size: 16px;">NAI</span>
            </div>
            <div class="platform-info">
              <h3>NovelAI</h3>
              <p>二次元及丰富画风的图像生成引擎</p>
            </div>
            <div class="platform-arrow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </div>
          
          <div class="platform-card disabled">
            <div class="platform-icon default-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            </div>
            <div class="platform-info">
              <h3>更多平台</h3>
              <p>敬请期待更多优秀生图引擎接入</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- NovelAI View -->
    <div v-else-if="currentView === 'novelai'" class="ia-page">
      <!-- Header -->
      <div class="ia-header">
        <div class="ia-header-left" style="gap: 8px;">
          <button class="nav-icon-btn" @click="currentView = 'platforms'" title="返回">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button class="nav-icon-btn" @click="showHistoryModal = true" title="历史记录">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4V1L8 5L12 9V6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18C8.69 18 6 15.31 6 12H4C4 16.42 7.58 20 12 20C16.42 20 20 16.42 20 12C20 7.58 16.42 4 12 4Z" fill="currentColor"/>
              <path d="M11 8V13L15.28 15.54L16.5 14L13 11.8V8H11Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <h2 class="ia-title">NovelAI</h2>
        <div class="ia-header-right">
          <button class="nav-icon-btn" @click="$emit('close')" title="关闭">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM12 16L7 11H10V8H14V11H17L12 16Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Scrollable Body -->
      <div class="ia-scroll-body">
      
      <!-- 第一部分：API 引擎与配置 -->
      <div class="section">
        <h3 class="section-title">API 引擎与配置</h3>
        <div class="form-row">
          <label>节点预设方案</label>
          <div class="input-with-btn">
            <select v-model="currentPresetId" @change="applyPreset" class="form-input">
              <option value="">当前自定义配置</option>
              <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <button class="text-btn" @click="savePreset">保存</button>
            <button v-if="currentPresetId" class="text-btn" style="color: #ff3b30;" @click="deletePreset">删除</button>
          </div>
        </div>
        <div class="form-row">
          <label>API Key</label>
          <div class="input-with-btn">
            <input :type="showApiKey ? 'text' : 'password'" v-model="config.apiKey" class="form-input" placeholder="输入 NovelAI API Key" />
            <button class="text-btn" @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button>
          </div>
        </div>
        <div class="form-row">
          <label>Base URL</label>
          <div class="input-with-btn">
            <input type="text" v-model="config.baseUrl" class="form-input" />
            <button class="text-btn" @click="config.baseUrl = 'https://image.novelai.net'" title="恢复为官方默认地址">恢复官方</button>
          </div>
        </div>
        <div class="form-row">
          <div class="flex-between">
            <label>流式生成 (SSE)</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="config.useStream" class="toggle-checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div style="font-size: 12px; color: #888; margin-top: 8px; line-height: 1.4;">
            * 提示：若使用第三方节点时频繁生成失败，可尝试关闭此项。
          </div>
        </div>
      </div>

      <!-- 第二部分：模型与图像规格 / 氛围参考 -->
      <div class="section">
        <div class="pill-menu-wrapper">
          <div class="pill-menu">
            <button class="pill-item" :class="{active: activeTab === 'specs'}" @click="activeTab = 'specs'">模型与规格</button>
            <button class="pill-item" :class="{active: activeTab === 'vibe'}" @click="activeTab = 'vibe'">氛围参考 (Vibe)</button>
          </div>
        </div>

        <!-- 规格面板 -->
        <div v-if="activeTab === 'specs'" class="tab-content">
          <div class="form-row">
            <label>模型 (Model)</label>
            <select v-model="params.model" class="form-select">
              <option value="nai-diffusion-4-5-full">NAI 4.5 完整版</option>
              <option value="nai-diffusion-4-5-curated-preview">NAI 4.5 精选预览版</option>
              <option value="nai-diffusion-4-full">NAI 4 完整版</option>
              <option value="nai-diffusion-4-curated-preview">NAI 4 精选预览版</option>
              <option value="nai-diffusion-3">NAI 3 标准模型</option>
              <option value="nai-diffusion-furry-3">NAI 3 Furry模型</option>
            </select>
          </div>
          
          <div class="form-row">
            <label>快捷尺寸</label>
            <select class="form-select" @change="(e) => {
              const val = (e.target as HTMLSelectElement).value;
              if (val) {
                const parts = val.split('x');
                params.width = parseInt(parts[0]);
                params.height = parseInt(parts[1]);
              }
            }">
              <option value="">-- 选择常用尺寸 --</option>
              <option v-for="res in COMMON_RESOLUTIONS" :key="res.label" :value="`${res.width}x${res.height}`">
                {{ res.label }}
              </option>
            </select>
          </div>

          <div class="form-row-half">
            <div class="form-row">
              <label>宽度 (Width)</label>
              <input type="number" step="64" min="64" v-model.number="params.width" @blur="onWidthBlur" class="form-input" />
            </div>
            <div class="form-row">
              <label>高度 (Height)</label>
              <input type="number" step="64" min="64" v-model.number="params.height" @blur="onHeightBlur" class="form-input" />
            </div>
          </div>
          <div class="form-row-half">
            <div class="form-row">
              <label>生成步数 (Steps)</label>
              <input type="number" min="1" max="50" v-model.number="params.steps" class="form-input" />
            </div>
            <div class="form-row">
              <label>引导系数 (Scale)</label>
              <input type="number" step="0.1" v-model.number="params.scale" class="form-input" />
            </div>
          </div>
          <div class="form-row-half">
            <div class="form-row">
              <label>采样器 (Sampler)</label>
              <select v-model="params.sampler" class="form-select">
                <option value="k_euler_ancestral">Euler Ancestral</option>
                <option value="k_euler">Euler</option>
                <option value="k_dpmpp_2s_ancestral">DPM++ 2S Ancestral</option>
                <option value="k_dpmpp_2m_sde">DPM++ 2M SDE</option>
                <option value="k_dpmpp_2m">DPM++ 2M</option>
                <option value="k_dpmpp_sde">DPM++ SDE</option>
                <option value="ddim" v-if="params.model.includes('nai-diffusion-3')">DDIM</option>
              </select>
            </div>
            <div class="form-row">
              <label>噪声调度 (Schedule)</label>
              <select v-model="params.noise_schedule" class="form-select">
                <option value="karras">Karras</option>
                <option value="exponential">Exponential</option>
                <option value="polyexponential">Polyexponential</option>
                <option value="native" v-if="params.model.includes('nai-diffusion-3')">Native</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <label>随机种子 (Seed)</label>
            <input type="number" v-model="params.seed" class="form-input" placeholder="不填表示随机" />
          </div>

          <!-- NAI3 特定设置 -->
          <div v-if="params.model.includes('nai-diffusion-3')" class="form-row" style="margin-top: 10px; padding: 12px; background: rgba(0,0,0,0.02); border-radius: 8px;">
            <div class="flex-between" style="margin-bottom: 8px;">
              <label>启用 SMEA (sm)</label>
              <label class="toggle-switch">
                <input type="checkbox" v-model="params.sm" class="toggle-checkbox" />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="flex-between" :style="{ opacity: params.sm ? 1 : 0.5 }">
              <label>启用 SMEA DYN (sm_dyn)</label>
              <label class="toggle-switch">
                <input type="checkbox" v-model="params.sm_dyn" :disabled="!params.sm" class="toggle-checkbox" />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <!-- NAI4 特定设置 -->
          <div v-if="params.model.includes('nai-diffusion-4')" class="form-row" style="margin-top: 10px; padding: 12px; background: rgba(0,0,0,0.02); border-radius: 8px;">
            <div class="flex-between">
              <label>启用 Variety+ (skip_cfg_above_sigma)</label>
              <label class="toggle-switch">
                <input type="checkbox" v-model="params.skip_cfg_above_sigma" class="toggle-checkbox" />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- 氛围参考面板 -->
        <div v-if="activeTab === 'vibe'" class="tab-content">
          <button class="action-btn" @click="showVibeManageModal = true">管理氛围参考图库</button>
          <div class="vibe-checkbox-list">
            <div v-if="vibeGroups.length === 0" class="vibe-empty">暂无氛围组，请先进入图库添加</div>
            <label v-for="g in vibeGroups" :key="g.id" class="vibe-checkbox-item">
              <span class="vci-name">{{ g.name }} <span class="vci-count">({{ g.items.length }}图)</span></span>
              <input type="checkbox" :value="g.id" v-model="params.vibe_group_ids" class="styled-checkbox" />
            </label>
          </div>
        </div>
      </div>

      <!-- 第三部分：核心提示词输入区 -->
      <div class="section">
        <div class="flex-between" style="margin-bottom: 16px;">
          <h3 class="section-title" style="margin: 0;">画面描述 (Prompt)</h3>
          <button class="text-btn text-btn-small" @click="resetPrompts">重置默认</button>
        </div>
        <div class="form-row">
          <label>提示词预设方案</label>
          <div class="input-with-btn">
            <select v-model="currentPromptPresetId" @change="applyPromptPreset" class="form-input">
              <option value="">当前自定义</option>
              <option v-for="p in promptPresets" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <button class="text-btn" @click="savePromptPreset">保存</button>
            <button v-if="currentPromptPresetId" class="text-btn" style="color: #ff3b30;" @click="deletePromptPreset">删除</button>
          </div>
        </div>
        <div class="form-row">
          <label>正向提示词与画风</label>
          <textarea v-model="params.input" class="form-textarea" rows="6" placeholder="输入你想画的内容及画风描述..."></textarea>
        </div>
        <div class="form-row">
          <label>反向提示词 (Negative)</label>
          <textarea v-model="params.negative_prompt" class="form-textarea" rows="3" placeholder="不希望出现的内容..."></textarea>
        </div>
        
        <button class="generate-btn" @click="handleGenerate">生成图像</button>
        
        <div v-if="finalImage || currentProgressImage" class="result-card">
          <div class="result-img-wrapper" @click="showPreviewModal = true">
            <img :src="finalImage || currentProgressImage" class="result-thumbnail" />
            <div class="result-overlay">
              <span>点击查看大图</span>
            </div>
          </div>
          <div class="result-actions" v-if="finalImage">
            <button class="result-action-btn" @click="downloadImage">保存图片</button>
          </div>
        </div>
      </div>

    </div>

    <!-- 第四部分：纯净明亮的生成与预览弹窗 (Light Glass Modal) -->
    <div v-if="showPreviewModal" class="light-glass-modal">
      <div class="lgm-header">
        <button class="lgm-btn" :class="{ 'lgm-btn-danger': isGenerating }" @click="closePreviewModal">
          {{ isGenerating ? '取消' : '关闭' }}
        </button>
        <span class="lgm-title">生成预览</span>
        <button class="lgm-btn" @click="downloadImage" :disabled="!finalImage">保存</button>
      </div>
      <div class="lgm-body">
        <div v-if="isGenerating" class="lgm-generating">
          <div class="lgm-spinner"></div>
          <div class="lgm-text">正在渲染图像...</div>
        </div>
        <div v-else-if="finalImage || currentProgressImage" class="lgm-image-wrapper">
          <img :src="finalImage || currentProgressImage" class="lgm-image" />
        </div>
        <div v-else class="lgm-empty">等待生成...</div>
        
        <div v-if="errorMsg" class="lgm-error">{{ errorMsg }}</div>
        <div v-if="pointsCost !== null" class="lgm-info">消耗 Anlas: {{ pointsCost }}</div>
      </div>
    </div>

      <ImageVibeManageModal v-if="showVibeManageModal" @close="showVibeManageModal = false" />
      <ImageHistoryModal v-if="showHistoryModal" @close="showHistoryModal = false" />

      <!-- 通用确认弹窗 -->
      <Transition name="fade">
        <div class="simple-modal-overlay" v-if="showConfirmModal">
          <div class="simple-modal">
            <div class="simple-modal-title">提示</div>
            <div class="simple-modal-body" style="text-align: center; color: #666; font-size: 14px;">
              {{ confirmModalMessage }}
            </div>
            <div class="simple-modal-footer">
              <button class="simple-modal-btn cancel" @click="cancelConfirm">取消</button>
              <button class="simple-modal-btn confirm" style="color: #ff3b30;" @click="executeConfirm">确定</button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- 轻量级 iOS 风格命名弹窗 -->
    <Transition name="fade">
      <div class="simple-modal-overlay" v-if="showPresetNameModal">
        <div class="simple-modal">
          <div class="simple-modal-title">保存节点预设</div>
          <div class="simple-modal-body">
            <input 
              v-model="newPresetName" 
              class="simple-modal-input" 
              placeholder="请输入预设名称 (例如：第三方节点)" 
              spellcheck="false" 
              autocomplete="off"
              @keyup.enter="confirmSavePreset"
            />
          </div>
          <div class="simple-modal-footer">
            <button class="simple-modal-btn cancel" @click="cancelSavePreset">取消</button>
            <button class="simple-modal-btn confirm" @click="confirmSavePreset">确定</button>
          </div>
          </div>
        </div>
      </Transition>

      <Transition name="fade">
        <div class="simple-modal-overlay" v-if="showPromptPresetNameModal">
          <div class="simple-modal">
            <div class="simple-modal-title">保存提示词预设</div>
            <div class="simple-modal-body">
              <input 
                v-model="newPromptPresetName" 
                class="simple-modal-input" 
                placeholder="请输入预设名称 (例如：日常场景)" 
                spellcheck="false" 
                autocomplete="off"
                @keyup.enter="confirmSavePromptPreset"
              />
            </div>
            <div class="simple-modal-footer">
              <button class="simple-modal-btn cancel" @click="cancelSavePromptPreset">取消</button>
              <button class="simple-modal-btn confirm" @click="confirmSavePromptPreset">确定</button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.ia-wrapper {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background-color: #f4f5f7; color: #111; z-index: 100;
  display: flex; flex-direction: column; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.ia-page {
  display: flex; flex-direction: column; height: 100%; width: 100%;
}

/* Header */
.ia-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: calc(env(safe-area-inset-top) + 16px) 20px 16px;
  background-color: #f4f5f7;
  z-index: 10;
}
.ia-title { font-size: 17px; font-weight: 600; margin: 0; }
.ia-header-left, .ia-header-right { width: 70px; display: flex; align-items: center; }
.ia-header-right { justify-content: flex-end; }
.nav-btn {
  background: none; border: none; padding: 4px 0; color: #007aff;
  font-size: 16px; font-weight: 500; cursor: pointer; display: flex; align-items: center;
}
.nav-icon-btn {
  background: none; border: none; padding: 0; color: #111;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  border-radius: 50%; transition: background-color 0.2s; width: 32px; height: 32px;
}
.nav-icon-btn:hover { background-color: rgba(0,0,0,0.05); }

/* Body */
.ia-scroll-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 40px 20px;
}

/* Platform Select */
.ia-subtitle { font-size: 14px; color: #888888; margin-bottom: 24px; text-align: center; }

.platform-list { display: flex; flex-direction: column; gap: 16px; }

.platform-card {
  background: #ffffff; border-radius: 16px; padding: 20px;
  display: flex; align-items: center; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
  transition: transform 0.2s, box-shadow 0.2s;
}

.platform-card.active { cursor: pointer; }
.platform-card.active:active { transform: scale(0.98); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02); }
.platform-card.disabled { opacity: 0.6; }

.platform-icon {
  width: 48px; height: 48px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; margin-right: 16px;
}

.nai-icon { background: #111; color: #fff; }
.default-icon { background: #f5f5f5; color: #999999; }

.platform-info { flex: 1; }
.platform-info h3 { margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #222222; }
.platform-info p { margin: 0; font-size: 13px; color: #888888; }
.platform-arrow { color: #cccccc; }

/* Sections */
.section {
  padding: 20px;
  background: #ffffff;
  border-radius: 16px;
  margin-bottom: 24px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.02);
}
.section-title {
  font-size: 16px; font-weight: 600; color: #111; margin: 0 0 20px 0;
}

/* Forms */
.form-row { margin-bottom: 20px; }
.form-row:last-child { margin-bottom: 0; }
.form-row label {
  display: block; font-size: 14px; font-weight: 500; color: #333; margin-bottom: 8px;
}
.form-input, .form-select, .form-textarea {
  width: 100%; background: #f7f7f8; border: 1px solid transparent;
  border-radius: 12px; padding: 14px; font-size: 15px; color: #111;
  box-sizing: border-box; transition: all 0.2s; font-family: inherit;
}
.form-input:focus, .form-select:focus, .form-textarea:focus {
  outline: none; background: #ffffff; border-color: #007aff;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}
.form-textarea { resize: vertical; line-height: 1.5; }

.input-with-btn {
  display: flex; align-items: center; background: #f7f7f8;
  border-radius: 12px; border: 1px solid transparent; overflow: hidden; transition: all 0.2s;
}
.input-with-btn:focus-within {
  background: #ffffff; border-color: #007aff; box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}
.input-with-btn .form-input {
  border: none; background: transparent; box-shadow: none; flex: 1;
}
.input-with-btn .form-input:focus { box-shadow: none; }
.input-with-btn .text-btn {
  padding: 0 16px; color: #007aff; font-size: 14px; font-weight: 500;
  background: none; border: none; cursor: pointer; height: 100%;
}

.text-btn-small { color: #888; font-size: 13px; font-weight: 400; padding: 4px 8px; cursor: pointer; background: none; border: none; }
.text-btn-small:hover { color: #111; }

.form-row-half { display: flex; gap: 16px; margin-bottom: 20px; }
.form-row-half .form-row { flex: 1; margin-bottom: 0; }

.flex-between { display: flex; align-items: center; justify-content: space-between; }
.flex-between label { margin-bottom: 0; }

/* Toggle Switch */
.toggle-switch { position: relative; width: 50px; height: 30px; }
.toggle-checkbox { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
  background-color: #e5e5ea; transition: .4s; border-radius: 30px;
}
.toggle-slider:before {
  position: absolute; content: ""; height: 26px; width: 26px; left: 2px; bottom: 2px;
  background-color: white; transition: .4s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.toggle-checkbox:checked + .toggle-slider { background-color: #34c759; }
.toggle-checkbox:checked + .toggle-slider:before { transform: translateX(20px); }

/* Pill Menu */
.pill-menu-wrapper { margin-bottom: 20px; }
.pill-menu {
  display: flex; background: #f0f0f5; border-radius: 20px; padding: 4px;
}
.pill-item {
  flex: 1; text-align: center; padding: 8px 0; border-radius: 16px;
  font-size: 14px; font-weight: 500; color: #555; background: transparent;
  border: none; cursor: pointer; transition: all 0.3s ease;
}
.pill-item.active {
  background: #ffffff; color: #111; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

/* Vibe Section */
.action-btn {
  width: 100%; background: #f0f0f5; color: #111; border: none; padding: 14px;
  border-radius: 12px; font-size: 15px; font-weight: 500; cursor: pointer; margin-bottom: 16px;
}
.vibe-checkbox-list { display: flex; flex-direction: column; }
.vibe-empty { font-size: 14px; color: #888; text-align: center; padding: 16px 0; }
.vibe-checkbox-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 0; border-bottom: 1px solid #f5f5f5; cursor: pointer;
}
.vibe-checkbox-item:last-child { border-bottom: none; }
.vci-name { font-size: 15px; color: #111; }
.vci-count { font-size: 13px; color: #888; margin-left: 6px; }
.styled-checkbox { width: 20px; height: 20px; accent-color: #007aff; }

/* Actions */
.generate-btn {
  width: 100%; background: #111; color: #fff; border: none; padding: 16px;
  border-radius: 14px; font-size: 16px; font-weight: 600; cursor: pointer;
  margin-top: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: transform 0.1s;
}
.generate-btn:active { transform: scale(0.98); }

.result-card {
  margin-top: 16px; background: #f7f7f8; border-radius: 14px; padding: 12px;
  display: flex; flex-direction: column; gap: 12px; border: 1px solid rgba(0,0,0,0.05);
}
.result-img-wrapper {
  position: relative; width: 100%; height: 240px; border-radius: 8px;
  overflow: hidden; cursor: pointer; background: #eaeaea; display: flex; align-items: center; justify-content: center;
}
.result-thumbnail { max-width: 100%; max-height: 100%; object-fit: contain; }
.result-overlay {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3);
  display: flex; align-items: center; justify-content: center; color: #fff;
  font-size: 14px; font-weight: 500; opacity: 0; transition: opacity 0.2s;
}
.result-img-wrapper:hover .result-overlay { opacity: 1; }
.result-action-btn {
  width: 100%; background: #007aff; color: #fff; border: none; padding: 12px;
  border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: transform 0.1s;
}
.result-action-btn:active { transform: scale(0.98); }

/* Light Glass Modal */
.light-glass-modal {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 1000;
  background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px); display: flex; flex-direction: column;
}
.lgm-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: calc(env(safe-area-inset-top) + 16px) 20px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}
.lgm-btn {
  background: none; border: none; color: #007aff; font-size: 16px; font-weight: 500; padding: 0; cursor: pointer;
}
.lgm-btn:disabled { color: #999; cursor: not-allowed; }
.lgm-btn-danger { color: #ff3b30 !important; }
.lgm-title { font-size: 17px; font-weight: 600; color: #111; }
.lgm-body {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 20px; position: relative; overflow: hidden;
}
.lgm-image-wrapper { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.lgm-image { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
.lgm-generating { display: flex; flex-direction: column; align-items: center; }
.lgm-spinner {
  width: 40px; height: 40px; border: 3px solid rgba(0,0,0,0.1); border-top-color: #111;
  border-radius: 50%; animation: lgm-spin 1s linear infinite; margin-bottom: 16px;
}
.lgm-text { font-size: 15px; color: #333; font-weight: 500; }
.lgm-empty { color: #888; font-size: 15px; }
.lgm-error {
  position: absolute; bottom: 80px; background: rgba(255,59,48,0.1); color: #ff3b30;
  padding: 12px 20px; border-radius: 12px; font-size: 14px; text-align: center; max-width: 80%;
}
.lgm-info {
  position: absolute; bottom: 30px; background: rgba(0,0,0,0.05); color: #333;
  padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500;
}

@keyframes lgm-spin { 100% { transform: rotate(360deg); } }

/* --- 轻量级弹窗样式 --- */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.simple-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.simple-modal {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(25px) saturate(200%);
  -webkit-backdrop-filter: blur(25px) saturate(200%);
  width: 270px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  transform: translateY(-10%);
}

.simple-modal-title {
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  padding: 20px 16px 8px;
  color: #111;
}

.simple-modal-body {
  padding: 0 16px 20px;
}

.simple-modal-input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  background: #fff;
  font-size: 14px;
  color: #111;
  outline: none;
}

.simple-modal-input:focus {
  border-color: #007aff;
}

.simple-modal-footer {
  display: flex;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.simple-modal-btn {
  flex: 1;
  background: transparent;
  border: none;
  padding: 12px 0;
  font-size: 16px;
  cursor: pointer;
  color: #007aff;
}

.simple-modal-btn.cancel {
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  font-weight: 400;
}

.simple-modal-btn.confirm {
  font-weight: 600;
}

.simple-modal-btn:active {
  background: rgba(0, 0, 0, 0.05);
}
</style>
