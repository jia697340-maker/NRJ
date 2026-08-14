/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useNovelAI } from '../../composables/useNovelAI'
import { buildNovelAIVibeReferences, useNovelAIVibe } from '../../composables/useNovelAIVibe'
import { useNovelAIHistory } from '../../composables/useNovelAIHistory'
import ImageVibeManageModal from '../ImageVibeManageModal.vue'
import ImageHistoryModal from '../ImageHistoryModal.vue'
import ImageParseModal from '../ImageParseModal.vue'

const emit = defineEmits(['back'])

const activeTab = ref('specs')
const showApiKey = ref(false)
const showPreviewModal = ref(false)
const showVibeManageModal = ref(false)
const showHistoryModal = ref(false)
const showImageParseModal = ref(false)
const baseImage = ref('')
const imageStrength = ref(0.55)
const imageNoise = ref(0)
const preciseReferenceImage = ref('')
const preciseReferenceStrength = ref(0.65)
const preciseReferenceFidelity = ref(0.5)
const baseImageInput = ref<HTMLInputElement | null>(null)
const refImageInput = ref<HTMLInputElement | null>(null)

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
  if (baseImage.value) {
    finalParams.image = baseImage.value
    finalParams.strength = imageStrength.value
    finalParams.noise = imageNoise.value
  }
  if (preciseReferenceImage.value) {
    finalParams.reference_image = preciseReferenceImage.value
    finalParams.reference_strength = preciseReferenceStrength.value
    finalParams.reference_fidelity = preciseReferenceFidelity.value
  }

  if (vibe_group_ids && vibe_group_ids.length > 0) {
    const references = buildNovelAIVibeReferences(
      vibeGroups.value,
      vibeImages.value,
      vibe_group_ids,
      params.value.model
    )
    if (references.images.length > 0) {
      finalParams.reference_image_multiple = references.images
      finalParams.reference_encoding_multiple = references.encodings
      finalParams.reference_strength_multiple = references.strengths
      finalParams.reference_information_extracted_multiple = references.informationExtracted
    }
  }

  generateImage(config.value, finalParams)
}

const applyParsedImage = (incoming: any, image: string) => {
  const allowed = ['input', 'negative_prompt', 'model', 'width', 'height', 'scale', 'sampler', 'steps', 'seed', 'n_samples', 'noise_schedule']
  for (const key of allowed) if (incoming[key] !== undefined && incoming[key] !== null && incoming[key] !== '') (params.value as any)[key] = incoming[key]
  baseImage.value = image
  showImageParseModal.value = false
}

const onBaseImage = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => baseImage.value = String(reader.result)
  reader.readAsDataURL(file)
}
const onPreciseReference = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => preciseReferenceImage.value = String(reader.result)
  reader.readAsDataURL(file)
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
  <div class="ia-page">
    <!-- 极简无界顶栏 -->
    <div class="header-minimal">
      <div class="header-titles">
        <h1 class="main-title">NovelAI 接入</h1>
      </div>
      <button class="back-btn" @click="$emit('back')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
      </button>
      <button class="history-btn" @click="showHistoryModal = true" title="历史记录">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4V1L8 5L12 9V6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18C8.69 18 6 15.31 6 12H4C4 16.42 7.58 20 12 20C16.42 20 20 16.42 20 12C20 7.58 16.42 4 12 4Z" fill="currentColor"/>
          <path d="M11 8V13L15.28 15.54L16.5 14L13 11.8V8H11Z" fill="currentColor"/>
        </svg>
      </button>
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
        <div class="form-row" style="display:flex;gap:8px;align-items:center">
          <button class="action-btn" @click="showImageParseModal = true">解析图片 / 读取 NAI 参数</button>
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
        <div class="tab-content" style="margin-top:18px">
          <label style="margin-bottom:12px;display:block">图生图底图（可删除）</label>
          <div class="upload-area-mini" @click="baseImageInput?.click()">
            <input ref="baseImageInput" type="file" accept="image/*" @change="onBaseImage" hidden />
            <div v-if="!baseImage" class="upload-placeholder-mini">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#888;margin-bottom:4px"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>上传底图</span>
            </div>
            <img v-else :src="baseImage" class="preview-mini" />
          </div>
          
          <div v-if="baseImage" style="margin-top:12px">
            <button class="action-btn-danger" @click="baseImage = ''">移除底图</button>
            <div class="form-row-half" style="margin-top:16px">
              <div class="form-row"><label>变化强度 (Strength)</label><input v-model.number="imageStrength" type="number" min="0" max="1" step="0.05" class="form-input" /></div>
              <div class="form-row"><label>噪声 (Noise)</label><input v-model.number="imageNoise" type="number" min="0" max="1" step="0.05" class="form-input" /></div>
            </div>
          </div>
        </div>
        <div v-if="params.model.includes('nai-diffusion-4-5')" class="tab-content" style="margin-top:24px;padding-top:20px;border-top:1px solid #eee">
          <label style="margin-bottom:12px;display:block">精密参考（角色 / 风格）<br><span style="font-size:12px;color:#888;font-weight:400">注意：与 Vibe 参考不能同时使用</span></label>
          <div class="upload-area-mini" @click="refImageInput?.click()">
            <input ref="refImageInput" type="file" accept="image/*" @change="onPreciseReference" hidden />
            <div v-if="!preciseReferenceImage" class="upload-placeholder-mini">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#888;margin-bottom:4px"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>上传精密参考</span>
            </div>
            <img v-else :src="preciseReferenceImage" class="preview-mini" />
          </div>
          
          <div v-if="preciseReferenceImage" style="margin-top:12px">
            <button class="action-btn-danger" @click="preciseReferenceImage = ''">删除参考图</button>
            <div class="form-row-half" style="margin-top:16px">
              <div class="form-row"><label>参考强度</label><input v-model.number="preciseReferenceStrength" type="number" min="0" max="1" step="0.05" class="form-input" /></div>
              <div class="form-row"><label>忠实度</label><input v-model.number="preciseReferenceFidelity" type="number" min="0" max="1" step="0.05" class="form-input" /></div>
            </div>
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
            <img :src="finalImage || currentProgressImage || undefined" class="result-thumbnail" />
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
          <img :src="finalImage || currentProgressImage || undefined" class="lgm-image" />
        </div>
        <div v-else class="lgm-empty">等待生成...</div>
        
        <div v-if="errorMsg" class="lgm-error">{{ errorMsg }}</div>
        <div v-if="pointsCost !== null" class="lgm-info">消耗 Anlas: {{ pointsCost }}</div>
      </div>
    </div>

    <ImageVibeManageModal v-if="showVibeManageModal" @close="showVibeManageModal = false" />
    <ImageHistoryModal v-if="showHistoryModal" @close="showHistoryModal = false" @reuse="applyParsedImage($event, '')" @variant="applyParsedImage({ ...$event, seed: '' }, '')" />
    <ImageParseModal v-if="showImageParseModal" @close="showImageParseModal = false" @apply="applyParsedImage" />

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
</template>

<style scoped src="../app_ImageAccess.css"></style>
