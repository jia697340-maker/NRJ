<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useGptImage, type GptImageFormat, type GptImageModeration, type GptImageQuality } from '../../composables/useGptImage'
import { useGptImageHistory } from '../../composables/useGptImageHistory'
import { useGptImageReference, type GptReferenceGroup } from '../../composables/useGptImageReference'

defineEmits<{ (e: 'back'): void }>()

interface GptApiPreset {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  model: string
}

const GPT_IMAGE_MODELS = [
  { value: 'gpt-image-2', label: 'GPT Image 2（最新）' },
  { value: 'gpt-image-2-2026-04-21', label: 'GPT Image 2（2026-04-21 固定版本）' },
  { value: 'gpt-image-1.5', label: 'GPT Image 1.5（已弃用）' },
  { value: 'chatgpt-image-latest', label: 'ChatGPT Image Latest（已弃用）' },
  { value: 'gpt-image-1', label: 'GPT Image 1（已弃用）' },
  { value: 'gpt-image-1-mini', label: 'GPT Image 1 Mini（低成本，已弃用）' }
] as const

const PARAMETER_HELP: Record<string, { title: string; description: string }> = {
  model: {
    title: '模型',
    description: '决定实际调用的图片模型。GPT Image 2 是当前推荐版本；带日期的是行为固定的快照。旧模型仍列出供兼容使用，但可能被服务商停止提供。第三方接口可选择“自定义模型”。'
  },
  size: {
    title: '尺寸',
    description: '控制输出图片的宽高。GPT Image 2 支持符合限制的灵活尺寸；旧版模型通常只支持列表中的标准尺寸。尺寸越大，生成成本和等待时间通常越高。'
  },
  quality: {
    title: '质量',
    description: '控制生成细节与计算量。“自动”由接口决定；低、中、高会逐级增加细节、耗时和费用。日常使用建议选择“中”。'
  },
  count: {
    title: '生成数量',
    description: '一次请求返回的图片张数，范围为 1–10。数量越多，费用和生成时间通常会按张数增加；部分服务商可能限制为 1 张。'
  },
  format: {
    title: '输出格式',
    description: 'PNG 适合无损保存；JPEG 文件通常较小，适合照片；WebP 在画质与体积之间较均衡。服务商不支持某种格式时会返回错误。'
  },
  compression: {
    title: '压缩质量',
    description: '仅 JPEG 和 WebP 使用。数值越高，画面细节越完整、文件也越大；数值越低，文件更小但压缩痕迹更明显。'
  },
  moderation: {
    title: '内容审核',
    description: '控制图片请求的审核强度。“自动”使用标准审核策略；“较宽松”会减少部分敏感内容的拦截，但不代表关闭审核，也不能绕过服务条款。'
  }
}

const showApiKey = ref(false)
const activeTab = ref<'specs' | 'references'>('specs')
const activeParameterHelp = ref('')
const showReferenceManager = ref(false)
const showHistory = ref(false)
const showPresetNameModal = ref(false)
const newPresetName = ref('')
const apiPresets = ref<GptApiPreset[]>(JSON.parse(localStorage.getItem('app_gpt_image_presets') || '[]'))
const currentPresetId = ref(localStorage.getItem('app_gpt_image_current_preset') || '')
const selectedReferenceGroupIds = ref<string[]>(JSON.parse(localStorage.getItem('app_gpt_image_selected_groups') || '[]'))
const prompt = ref(localStorage.getItem('app_gpt_image_prompt') || '')
const config = ref({
  apiKey: localStorage.getItem('app_gpt_image_apikey') || '',
  baseUrl: localStorage.getItem('app_gpt_image_baseurl') || 'https://api.openai.com/v1',
  model: localStorage.getItem('app_gpt_image_model') || 'gpt-image-2',
  size: localStorage.getItem('app_gpt_image_size') || '1024x1536',
  quality: (localStorage.getItem('app_gpt_image_quality') || 'medium') as GptImageQuality,
  n: Number(localStorage.getItem('app_gpt_image_count') || 1),
  outputFormat: (localStorage.getItem('app_gpt_image_format') || 'png') as GptImageFormat,
  outputCompression: Number(localStorage.getItem('app_gpt_image_compression') || 90),
  moderation: (localStorage.getItem('app_gpt_image_moderation') || 'auto') as GptImageModeration
})

watch(config, value => {
  localStorage.setItem('app_gpt_image_apikey', value.apiKey)
  localStorage.setItem('app_gpt_image_baseurl', value.baseUrl)
  localStorage.setItem('app_gpt_image_model', value.model)
  localStorage.setItem('app_gpt_image_size', value.size)
  localStorage.setItem('app_gpt_image_quality', value.quality)
  localStorage.setItem('app_gpt_image_count', String(value.n))
  localStorage.setItem('app_gpt_image_format', value.outputFormat)
  localStorage.setItem('app_gpt_image_compression', String(value.outputCompression))
  localStorage.setItem('app_gpt_image_moderation', value.moderation)
}, { deep: true })
watch(apiPresets, value => localStorage.setItem('app_gpt_image_presets', JSON.stringify(value)), { deep: true })
watch(currentPresetId, value => localStorage.setItem('app_gpt_image_current_preset', value))
watch(prompt, value => localStorage.setItem('app_gpt_image_prompt', value))
watch(selectedReferenceGroupIds, value => localStorage.setItem('app_gpt_image_selected_groups', JSON.stringify(value)), { deep: true })

const {
  isGenerating,
  finalImages,
  errorMsg,
  lastGeneratedParams,
  generateImages,
  abortGeneration
} = useGptImage()
const { historyItems, addHistoryItem, deleteHistoryItem, getHistoryImageUrl, loadHistoryList } = useGptImageHistory()
const {
  referenceImages,
  referenceGroups,
  addImage,
  removeImage,
  addGroup,
  updateGroup,
  removeGroup,
  getImagesForGroups
} = useGptImageReference()

const editingGroupId = ref('')
const newGroupName = ref('')
const newGroupDescription = ref('')
const historyImageUrls = ref<Record<string, string>>({})
const selectedPreview = ref('')

const editingGroup = computed(() => referenceGroups.value.find(group => group.id === editingGroupId.value) || null)
const selectedReferenceCount = computed(() => getImagesForGroups(selectedReferenceGroupIds.value).length)
const isKnownModel = computed(() => GPT_IMAGE_MODELS.some(model => model.value === config.value.model))
const activeHelp = computed(() => PARAMETER_HELP[activeParameterHelp.value] || null)
const availableSizes = computed(() => {
  if (config.value.model.startsWith('gpt-image-2')) {
    return ['auto', '1024x1024', '1536x1024', '1024x1536', '1920x1088']
  }
  return ['auto', '1024x1024', '1536x1024', '1024x1536']
})

const selectModel = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  config.value.model = value === '__custom' ? '' : value
}

const sizeError = computed(() => {
  if (!config.value.model.startsWith('gpt-image-2')) return ''
  if (config.value.size === 'auto') return ''
  const match = config.value.size.match(/^(\d+)x(\d+)$/)
  if (!match) return '尺寸格式应为“宽x高”，例如 1024x1536'
  const width = Number(match[1])
  const height = Number(match[2])
  if (width % 16 !== 0 || height % 16 !== 0) return 'GPT Image 2 的宽高必须是 16 的倍数'
  const ratio = width / height
  if (ratio < 1 / 3 || ratio > 3) return '宽高比例必须在 1:3 到 3:1 之间'
  const pixels = width * height
  if (pixels < 655360 || pixels > 8294400) return '总像素必须在 655,360 到 8,294,400 之间'
  return ''
})

const buildPrompt = () => {
  const descriptions = referenceGroups.value
    .filter(group => selectedReferenceGroupIds.value.includes(group.id) && group.description.trim())
    .map(group => `参考组“${group.name}”的用途：${group.description.trim()}`)
  return [...descriptions, prompt.value.trim()].filter(Boolean).join('\n')
}

const applyApiPreset = () => {
  const preset = apiPresets.value.find(item => item.id === currentPresetId.value)
  if (!preset) return
  config.value.apiKey = preset.apiKey
  config.value.baseUrl = preset.baseUrl
  config.value.model = preset.model
}

const openSavePreset = () => {
  const current = apiPresets.value.find(item => item.id === currentPresetId.value)
  newPresetName.value = current?.name || ''
  showPresetNameModal.value = true
}

const confirmSavePreset = () => {
  const name = newPresetName.value.trim()
  if (!name) return

  const selectedIndex = apiPresets.value.findIndex(item => item.id === currentPresetId.value)
  const sameNameIndex = apiPresets.value.findIndex(item => item.name === name)
  const targetIndex = selectedIndex >= 0 ? selectedIndex : sameNameIndex
  const preset: GptApiPreset = {
    id: targetIndex >= 0 ? apiPresets.value[targetIndex].id : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    apiKey: config.value.apiKey,
    baseUrl: config.value.baseUrl,
    model: config.value.model
  }

  if (targetIndex >= 0) apiPresets.value[targetIndex] = preset
  else apiPresets.value.push(preset)
  currentPresetId.value = preset.id
  showPresetNameModal.value = false
}

const deleteApiPreset = () => {
  if (!currentPresetId.value || !window.confirm('确定要删除当前 GPT API 预设吗？')) return
  apiPresets.value = apiPresets.value.filter(item => item.id !== currentPresetId.value)
  currentPresetId.value = ''
}

const handleGenerate = async () => {
  if (sizeError.value) return
  const references = getImagesForGroups(selectedReferenceGroupIds.value)
  try {
    const images = await generateImages(
      { apiKey: config.value.apiKey, baseUrl: config.value.baseUrl },
      {
        model: config.value.model.trim() || 'gpt-image-2',
        prompt: buildPrompt(),
        size: config.value.size,
        quality: config.value.quality,
        n: config.value.n,
        output_format: config.value.outputFormat,
        output_compression: config.value.outputCompression,
        moderation: config.value.moderation,
        referenceImages: references.map(image => image.dataUrl)
      }
    )
    for (const image of images) await addHistoryItem(lastGeneratedParams.value, image)
  } catch {
    // 错误信息由 composable 统一展示。
  }
}

const downloadImage = (image: string, index = 0) => {
  const link = document.createElement('a')
  link.href = image
  link.download = `gpt_image_${Date.now()}_${index + 1}.${config.value.outputFormat}`
  link.click()
}

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

const handleReferenceUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  for (const file of Array.from(input.files || [])) {
    await addImage(file.name, await fileToDataUrl(file))
  }
  input.value = ''
}

const createGroup = async () => {
  if (!newGroupName.value.trim()) return
  const group = await addGroup(newGroupName.value.trim(), newGroupDescription.value.trim())
  editingGroupId.value = group.id
  newGroupName.value = ''
  newGroupDescription.value = ''
}

const toggleGroupImage = async (group: GptReferenceGroup, imageId: string, checked: boolean) => {
  const next = { ...group, imageIds: [...group.imageIds] }
  if (checked && !next.imageIds.includes(imageId)) next.imageIds.push(imageId)
  if (!checked) next.imageIds = next.imageIds.filter(id => id !== imageId)
  await updateGroup(next)
}

const updateEditingGroupText = async (field: 'name' | 'description', value: string) => {
  if (!editingGroup.value) return
  await updateGroup({ ...editingGroup.value, [field]: value })
}

const openHistory = async () => {
  await loadHistoryList()
  const nextUrls: Record<string, string> = {}
  for (const item of historyItems.value) {
    const url = await getHistoryImageUrl(item.id)
    if (url) nextUrls[item.id] = url
  }
  Object.values(historyImageUrls.value).forEach(url => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  })
  historyImageUrls.value = nextUrls
  showHistory.value = true
}

const deleteHistory = async (id: string) => {
  const oldUrl = historyImageUrls.value[id]
  if (oldUrl?.startsWith('blob:')) URL.revokeObjectURL(oldUrl)
  await deleteHistoryItem(id)
  delete historyImageUrls.value[id]
}

onUnmounted(() => {
  Object.values(historyImageUrls.value).forEach(url => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  })
})
</script>

<template>
  <div class="ia-page">
    <div class="header-minimal">
      <div class="header-titles">
        <h1 class="main-title">GPT Image 接入</h1>
      </div>
      <button class="back-btn" @click="$emit('back')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
      </button>
    </div>
    <div class="gpt-page">
    <div class="gpt-scroll">
      <section class="card">
        <div class="section-heading">
          <div>
            <h3>GPT Image API</h3>
            <p>独立配置，不读取 NovelAI 的密钥、节点或预设。</p>
          </div>
          <button class="ghost-btn" @click="openHistory">生成历史</button>
        </div>

        <label class="field">
          <span>API 预设方案</span>
          <div class="preset-row">
            <select v-model="currentPresetId" @change="applyApiPreset">
              <option value="">当前自定义配置</option>
              <option v-for="preset in apiPresets" :key="preset.id" :value="preset.id">{{ preset.name }}</option>
            </select>
            <button class="preset-action" @click="openSavePreset">保存</button>
            <button v-if="currentPresetId" class="preset-action danger-text" @click="deleteApiPreset">删除</button>
          </div>
        </label>
        <label class="field">
          <span>API Key</span>
          <div class="field-with-action">
            <input v-model="config.apiKey" :type="showApiKey ? 'text' : 'password'" placeholder="OpenAI 或兼容服务 API Key">
            <button @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button>
          </div>
        </label>
        <label class="field">
          <span>Base URL</span>
          <div class="field-with-action">
            <input v-model="config.baseUrl" placeholder="https://api.openai.com/v1">
            <button @click="config.baseUrl = 'https://api.openai.com/v1'">官方</button>
          </div>
        </label>
        <label class="field">
          <span class="field-title">
            模型
            <button type="button" class="help-btn" aria-label="查看模型说明" @click.prevent="activeParameterHelp = 'model'">?</button>
          </span>
          <select :value="isKnownModel ? config.model : '__custom'" @change="selectModel">
            <option v-for="model in GPT_IMAGE_MODELS" :key="model.value" :value="model.value">
              {{ model.label }}
            </option>
            <option value="__custom">自定义模型（兼容第三方接口）</option>
          </select>
          <input
            v-if="!isKnownModel"
            v-model="config.model"
            class="custom-model-input"
            placeholder="输入第三方接口支持的模型名称"
          >
        </label>
      </section>

      <section class="card">
        <div class="tabs">
          <button :class="{ active: activeTab === 'specs' }" @click="activeTab = 'specs'">生成参数</button>
          <button :class="{ active: activeTab === 'references' }" @click="activeTab = 'references'">
            GPT 参考组 <span v-if="selectedReferenceCount">({{ selectedReferenceCount }}图)</span>
          </button>
        </div>

        <div v-if="activeTab === 'specs'" class="tab-panel">
          <div class="grid">
            <label class="field">
              <span class="field-title">
                尺寸
                <button type="button" class="help-btn" aria-label="查看尺寸说明" @click.prevent="activeParameterHelp = 'size'">?</button>
              </span>
              <input v-model="config.size" list="gpt-image-sizes">
              <datalist id="gpt-image-sizes">
                <option v-for="size in availableSizes" :key="size" :value="size"></option>
              </datalist>
            </label>
            <label class="field">
              <span class="field-title">
                质量
                <button type="button" class="help-btn" aria-label="查看质量说明" @click.prevent="activeParameterHelp = 'quality'">?</button>
              </span>
              <select v-model="config.quality">
                <option value="auto">自动</option>
                <option value="low">低（更省）</option>
                <option value="medium">中（推荐）</option>
                <option value="high">高</option>
              </select>
            </label>
            <label class="field">
              <span class="field-title">
                生成数量
                <button type="button" class="help-btn" aria-label="查看生成数量说明" @click.prevent="activeParameterHelp = 'count'">?</button>
              </span>
              <input v-model.number="config.n" type="number" min="1" max="10">
            </label>
            <label class="field">
              <span class="field-title">
                输出格式
                <button type="button" class="help-btn" aria-label="查看输出格式说明" @click.prevent="activeParameterHelp = 'format'">?</button>
              </span>
              <select v-model="config.outputFormat">
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
              </select>
            </label>
            <label v-if="config.outputFormat !== 'png'" class="field">
              <span class="field-title">
                压缩质量 {{ config.outputCompression }}%
                <button type="button" class="help-btn" aria-label="查看压缩质量说明" @click.prevent="activeParameterHelp = 'compression'">?</button>
              </span>
              <input v-model.number="config.outputCompression" type="range" min="0" max="100">
            </label>
            <label class="field">
              <span class="field-title">
                内容审核
                <button type="button" class="help-btn" aria-label="查看内容审核说明" @click.prevent="activeParameterHelp = 'moderation'">?</button>
              </span>
              <select v-model="config.moderation">
                <option value="auto">自动</option>
                <option value="low">较宽松</option>
              </select>
            </label>
          </div>
          <p v-if="sizeError" class="error-text">{{ sizeError }}</p>
          <p class="hint">GPT Image 接口不使用采样器、步数、CFG、Seed 或 Negative Prompt。</p>
        </div>

        <div v-else class="tab-panel">
          <div class="reference-toolbar">
            <p>参考组通过多图编辑接口发送，不使用 NAI Vibe 编码和强度参数。</p>
            <button class="primary-small" @click="showReferenceManager = true">管理参考图库</button>
          </div>
          <div v-if="referenceGroups.length" class="group-list">
            <label v-for="group in referenceGroups" :key="group.id" class="group-option">
              <input v-model="selectedReferenceGroupIds" type="checkbox" :value="group.id">
              <span>
                <strong>{{ group.name }}</strong>
                <small>{{ group.imageIds.length }} 张图 · {{ group.description || '未填写用途说明' }}</small>
              </span>
            </label>
          </div>
          <div v-else class="empty">还没有 GPT 参考组，可以创建角色、画风或场景参考组。</div>
        </div>
      </section>

      <section class="card">
        <h3>画面描述</h3>
        <p class="hint">直接使用中文自然语言。选择参考组后，组用途说明会自动加入提示词。</p>
        <textarea v-model="prompt" class="prompt-textarea" rows="7" placeholder="描述人物、动作、场景、构图、镜头与光线……"></textarea>
        <div v-if="errorMsg" class="error-box">{{ errorMsg }}</div>
        <div class="generate-row">
          <button v-if="!isGenerating" class="generate-btn" :disabled="!!sizeError" @click="handleGenerate">使用 GPT 图片模型生成</button>
          <button v-else class="cancel-btn" @click="abortGeneration">取消生成</button>
        </div>
      </section>

      <section v-if="finalImages.length" class="card">
        <h3>生成结果</h3>
        <div class="result-grid">
          <article v-for="(image, index) in finalImages" :key="index" class="result-item">
            <img :src="image" alt="GPT 生成结果" @click="selectedPreview = image">
            <button @click="downloadImage(image, index)">保存图片</button>
          </article>
        </div>
      </section>
    </div>

    <div v-if="showReferenceManager" class="overlay" @click.self="showReferenceManager = false">
      <div class="modal wide">
        <div class="modal-header">
          <div><h3>GPT 参考图库</h3><p>图片、分组和用途说明均独立保存。</p></div>
          <button class="icon-btn" @click="showReferenceManager = false">×</button>
        </div>
        <div class="manager-layout">
          <aside>
            <div class="new-group">
              <input v-model="newGroupName" placeholder="参考组名称">
              <textarea v-model="newGroupDescription" rows="3" placeholder="例如：只参考人物外貌，不复制背景"></textarea>
              <button @click="createGroup">创建参考组</button>
            </div>
            <button
              v-for="group in referenceGroups"
              :key="group.id"
              class="group-nav"
              :class="{ active: editingGroupId === group.id }"
              @click="editingGroupId = group.id"
            >
              {{ group.name }} · {{ group.imageIds.length }}图
            </button>
          </aside>
          <main>
            <label class="upload-btn">
              上传参考图片
              <input type="file" accept="image/*" multiple hidden @change="handleReferenceUpload">
            </label>
            <template v-if="editingGroup">
              <label class="field">
                <span>组名称</span>
                <input :value="editingGroup.name" @change="updateEditingGroupText('name', ($event.target as HTMLInputElement).value)">
              </label>
              <label class="field">
                <span>用途说明</span>
                <textarea :value="editingGroup.description" rows="3" @change="updateEditingGroupText('description', ($event.target as HTMLTextAreaElement).value)"></textarea>
              </label>
            </template>
            <div v-if="referenceImages.length" class="library-grid">
              <article v-for="image in referenceImages" :key="image.id" class="library-item">
                <img :src="image.dataUrl" :alt="image.name">
                <label v-if="editingGroup">
                  <input
                    type="checkbox"
                    :checked="editingGroup.imageIds.includes(image.id)"
                    @change="toggleGroupImage(editingGroup, image.id, ($event.target as HTMLInputElement).checked)"
                  >
                  加入当前组
                </label>
                <button @click="removeImage(image.id)">删除图片</button>
              </article>
            </div>
            <div v-else class="empty">请先上传参考图片。</div>
            <button v-if="editingGroup" class="danger-btn" @click="removeGroup(editingGroup.id); editingGroupId = ''">删除当前参考组</button>
          </main>
        </div>
      </div>
    </div>

    <div v-if="activeHelp" class="overlay help-overlay" @click.self="activeParameterHelp = ''">
      <div class="modal help-modal" role="dialog" aria-modal="true" :aria-label="`${activeHelp.title}说明`">
        <div class="modal-header">
          <h3>{{ activeHelp.title }}</h3>
          <button class="icon-btn" aria-label="关闭参数说明" @click="activeParameterHelp = ''">×</button>
        </div>
        <p>{{ activeHelp.description }}</p>
        <button class="help-close-btn" @click="activeParameterHelp = ''">知道了</button>
      </div>
    </div>

    <div v-if="showHistory" class="overlay" @click.self="showHistory = false">
      <div class="modal">
        <div class="modal-header">
          <div><h3>GPT 生图历史</h3><p>最多保留最近 30 张，与 NAI 历史完全分离。</p></div>
          <button class="icon-btn" @click="showHistory = false">×</button>
        </div>
        <div v-if="historyItems.length" class="history-grid">
          <article v-for="item in historyItems" :key="item.id">
            <img v-if="historyImageUrls[item.id]" :src="historyImageUrls[item.id]" @click="selectedPreview = historyImageUrls[item.id]">
            <p>{{ new Date(item.timestamp).toLocaleString() }}</p>
            <small>{{ item.params?.prompt || '无提示词' }}</small>
            <button @click="deleteHistory(item.id)">删除</button>
          </article>
        </div>
        <div v-else class="empty">暂无 GPT 生图历史。</div>
      </div>
    </div>

    <div v-if="showPresetNameModal" class="overlay" @click.self="showPresetNameModal = false">
      <div class="modal preset-modal">
        <div class="modal-header">
          <div>
            <h3>{{ currentPresetId ? '保存 GPT API 预设' : '新建 GPT API 预设' }}</h3>
            <p>保存当前 API Key、Base URL 和模型。</p>
          </div>
          <button class="icon-btn" @click="showPresetNameModal = false">×</button>
        </div>
        <label class="field">
          <span>预设名称</span>
          <input v-model="newPresetName" autofocus placeholder="例如：OpenAI 官方" @keyup.enter="confirmSavePreset">
        </label>
        <div class="preset-modal-actions">
          <button class="preset-cancel" @click="showPresetNameModal = false">取消</button>
          <button class="preset-confirm" :disabled="!newPresetName.trim()" @click="confirmSavePreset">保存</button>
        </div>
      </div>
    </div>

    <div v-if="selectedPreview" class="overlay preview-overlay" @click="selectedPreview = ''">
      <img :src="selectedPreview" alt="大图预览">
    </div>
    </div>
  </div>
</template>

<style scoped src="../app_ImageAccess.css"></style>
<style scoped>
.ia-page>.gpt-page{height:auto;flex:1}
.gpt-page { height: 100%; min-height: 0; color: #1d1d1f; }
.gpt-scroll { height: 100%; overflow-y: auto; padding: 10px 24px 60px; box-sizing: border-box; }
.card { max-width: 760px; margin: 0 auto 18px; padding: 22px; border-radius: 22px; background: rgba(255,255,255,.88); box-shadow: 0 12px 40px rgba(43,56,82,.08); border: 1px solid rgba(255,255,255,.8); }
h3 { margin: 0 0 14px; font-size: 18px; }
.section-heading, .modal-header, .reference-toolbar, .generate-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.section-heading p, .modal-header p, .reference-toolbar p, .hint { margin: 3px 0 0; color: #7a7f89; font-size: 12px; line-height: 1.5; }
.field { display: flex; flex-direction: column; gap: 7px; margin-top: 14px; font-size: 13px; font-weight: 600; }
input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #e2e5ea; border-radius: 12px; padding: 11px 12px; background: #f8f9fb; color: #222; font: inherit; outline: none; }
input:focus, select:focus, textarea:focus { border-color: #8a8f97; box-shadow: 0 0 0 3px rgba(73,78,86,.1); }
textarea { resize: vertical; line-height: 1.55; }
.prompt-textarea { font-size: 14px; }
.field-title { display: flex; align-items: center; gap: 6px; }
.help-btn { display: inline-grid; width: 18px; height: 18px; place-items: center; padding: 0; border: 1px solid #cfd2d7; border-radius: 50%; background: #f3f4f5; color: #666b73; font-size: 11px; font-weight: 700; line-height: 1; cursor: pointer; }
.help-btn:active { background: #e4e6e8; }
.custom-model-input { margin-top: 1px; }
.field-with-action { display: flex; gap: 8px; }
.field-with-action button, .ghost-btn, .primary-small, .upload-btn { flex: 0 0 auto; border: 0; border-radius: 11px; padding: 0 14px; background: #eceef0; color: #4c5158; cursor: pointer; font-weight: 600; }
.ghost-btn, .primary-small, .upload-btn { padding: 10px 14px; }
.preset-row { display: flex; gap: 8px; }
.preset-row select { min-width: 0; }
.preset-action { flex: 0 0 auto; border: 0; border-radius: 11px; padding: 0 14px; background: #eceef0; color: #4c5158; cursor: pointer; font-weight: 600; }
.danger-text { color: #79585b; background: #f1eded; }
.tabs { display: flex; padding: 4px; border-radius: 14px; background: #f0f2f6; }
.tabs button { flex: 1; border: 0; padding: 10px; border-radius: 11px; background: transparent; color: #777; cursor: pointer; }
.tabs button.active { background: #fff; color: #41454b; box-shadow: 0 2px 8px rgba(0,0,0,.07); font-weight: 700; }
.tab-panel { padding-top: 12px; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 14px; }
.group-list { display: grid; gap: 9px; margin-top: 14px; }
.group-option { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border-radius: 13px; background: #f7f8fb; }
.group-option input { width: auto; margin-top: 3px; }
.group-option span { display: flex; flex-direction: column; gap: 3px; }
.group-option small { color: #7c818c; font-weight: 400; }
.generate-btn, .cancel-btn { width: 100%; margin-top: 18px; border: 0; border-radius: 14px; padding: 14px; color: #fff; background: #4d5259; font-weight: 700; cursor: pointer; }
.generate-btn:disabled { opacity: .45; cursor: not-allowed; }
.cancel-btn { background: #6b7077; }
.error-text, .error-box { color: #c63d48; font-size: 12px; margin-top: 10px; }
.error-box { padding: 10px 12px; background: #fff0f1; border-radius: 10px; }
.result-grid, .library-grid, .history-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }
.result-item, .library-item, .history-grid article { overflow: hidden; border: 1px solid #eceef2; border-radius: 14px; background: #fafbfc; }
.result-item img, .library-item img, .history-grid img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; cursor: zoom-in; }
.result-item button, .library-item button, .history-grid button { width: 100%; border: 0; padding: 9px; color: #555b63; background: transparent; cursor: pointer; }
.library-item label { display: flex; gap: 5px; padding: 8px; font-size: 12px; }
.library-item label input { width: auto; }
.empty { padding: 30px 10px; text-align: center; color: #999; font-size: 13px; }
.overlay { position: fixed; z-index: 12000; inset: 0; display: grid; place-items: center; padding: 18px; background: rgba(22,25,35,.48); backdrop-filter: blur(10px); }
.modal { width: min(720px,calc(100vw - 36px)); max-height: 84vh; overflow-y: auto; padding: 22px; box-sizing: border-box; border-radius: 22px; background: #fff; box-shadow: 0 24px 80px rgba(0,0,0,.24); margin: 0 auto; }
.modal.wide { width: min(980px,calc(100vw - 36px)); }
.modal.preset-modal { width: min(430px,calc(100vw - 36px)); }
.modal.help-modal { width: min(390px,calc(100vw - 36px)); }
.help-modal p { margin: 4px 0 18px; color: #62676f; font-size: 14px; line-height: 1.7; }
.help-close-btn { width: 100%; border: 0; border-radius: 11px; padding: 11px; background: #e8eaec; color: #444950; font-weight: 600; cursor: pointer; }
.icon-btn { border: 0; background: transparent; color: #555; font-size: 30px; cursor: pointer; }
.preset-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.preset-cancel, .preset-confirm { border: 0; border-radius: 11px; padding: 10px 18px; cursor: pointer; font-weight: 600; }
.preset-cancel { background: #f0f1f4; color: #666; }
.preset-confirm { background: #4d5259; color: #fff; }
.preset-confirm:disabled { opacity: .45; cursor: not-allowed; }
.manager-layout { display: grid; grid-template-columns: 220px 1fr; gap: 18px; margin-top: 18px; }
.manager-layout aside { padding-right: 14px; border-right: 1px solid #eceef2; }
.new-group { display: grid; gap: 8px; margin-bottom: 12px; }
.new-group button, .danger-btn { border: 0; border-radius: 10px; padding: 10px; background: #4d5259; color: #fff; cursor: pointer; }
.group-nav { width: 100%; margin-bottom: 6px; border: 0; border-radius: 10px; padding: 10px; text-align: left; background: #f3f4f7; color: #555; cursor: pointer; }
.group-nav.active { color: #3f444b; background: #e5e7e9; font-weight: 700; }
.upload-btn { display: inline-block; margin-bottom: 10px; }
.danger-btn { margin-top: 16px; background: #fff0f1; color: #c43f49; }
.history-grid article p { margin: 8px 8px 2px; font-size: 11px; color: #777; }
.history-grid article small { display: -webkit-box; margin: 0 8px; overflow: hidden; color: #555; font-size: 11px; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.preview-overlay img { max-width: 95vw; max-height: 92vh; object-fit: contain; border-radius: 12px; }
@media (max-width: 640px) {
  .gpt-scroll { padding: 10px 12px 48px; }
  .card { padding: 16px; border-radius: 18px; }
  .grid { grid-template-columns: 1fr; }
  .result-grid, .library-grid, .history-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .manager-layout { grid-template-columns: 1fr; }
  .manager-layout aside { padding-right: 0; padding-bottom: 12px; border-right: 0; border-bottom: 1px solid #eceef2; }
  .section-heading, .reference-toolbar { align-items: flex-start; }
}
</style>
