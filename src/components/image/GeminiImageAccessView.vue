<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import {
  useGeminiImage,
  type GeminiImageMimeType,
  type GeminiImageSize,
  type GeminiImageTransport,
  type GeminiThinkingLevel
} from '../../composables/useGeminiImage'
import { useGeminiImageHistory } from '../../composables/useGeminiImageHistory'
import {
  useGeminiImageReference,
  type GeminiReferenceGroup,
  type GeminiReferenceKind
} from '../../composables/useGeminiImageReference'

defineEmits<{ (e: 'back'): void }>()

interface GeminiApiPreset {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  transport: GeminiImageTransport
  model: string
}

const OFFICIAL_MODELS = [
  { value: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image（推荐）' },
  { value: 'gemini-3.1-flash-lite-image', label: 'Gemini 3.1 Flash Lite Image（快速低成本）' },
  { value: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image（最高质量）' }
]
const OPENROUTER_MODELS = [
  { value: 'google/gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image（推荐）' },
  { value: 'google/gemini-3.1-flash-lite-image', label: 'Gemini 3.1 Flash Lite Image（快速低成本）' },
  { value: 'google/gemini-3-pro-image', label: 'Gemini 3 Pro Image（最高质量）' }
]
const ASPECT_RATIOS = ['1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5', '16:9', '9:16', '21:9']
const GROUP_KIND_LABELS: Record<GeminiReferenceKind, string> = {
  character: '角色一致性',
  object: '物体参考',
  style: '画风参考',
  scene: '场景参考'
}

const getDefaultBaseUrl = (transport: GeminiImageTransport) => transport === 'official'
  ? 'https://generativelanguage.googleapis.com'
  : 'https://openrouter.ai/api/v1'
const getDefaultModel = (transport: GeminiImageTransport) => transport === 'official'
  ? 'gemini-3.1-flash-image'
  : 'google/gemini-3.1-flash-image'

const savedTransport = (localStorage.getItem('app_gemini_image_transport') || 'official') as GeminiImageTransport
const showApiKey = ref(false)
const activeTab = ref<'specs' | 'references'>('specs')
const showReferenceManager = ref(false)
const showHistory = ref(false)
const showPresetNameModal = ref(false)
const newPresetName = ref('')
const prompt = ref(localStorage.getItem('app_gemini_image_prompt') || '')
const apiPresets = ref<GeminiApiPreset[]>(JSON.parse(localStorage.getItem('app_gemini_image_presets') || '[]'))
const currentPresetId = ref(localStorage.getItem('app_gemini_image_current_preset') || '')
const selectedReferenceGroupIds = ref<string[]>(JSON.parse(localStorage.getItem('app_gemini_image_selected_groups') || '[]'))
const config = ref({
  apiKey: localStorage.getItem('app_gemini_image_apikey') || '',
  baseUrl: localStorage.getItem('app_gemini_image_baseurl') || getDefaultBaseUrl(savedTransport),
  transport: savedTransport,
  model: localStorage.getItem('app_gemini_image_model') || getDefaultModel(savedTransport),
  aspectRatio: localStorage.getItem('app_gemini_image_aspect_ratio') || '2:3',
  imageSize: (localStorage.getItem('app_gemini_image_size') || '1K') as GeminiImageSize,
  mimeType: (localStorage.getItem('app_gemini_image_mime_type') || 'image/png') as GeminiImageMimeType,
  thinkingLevel: (localStorage.getItem('app_gemini_image_thinking_level') || 'minimal') as GeminiThinkingLevel,
  useGoogleSearch: localStorage.getItem('app_gemini_image_google_search') === 'true',
  useImageSearch: localStorage.getItem('app_gemini_image_image_search') === 'true'
})

watch(config, value => {
  localStorage.setItem('app_gemini_image_apikey', value.apiKey)
  localStorage.setItem('app_gemini_image_baseurl', value.baseUrl)
  localStorage.setItem('app_gemini_image_transport', value.transport)
  localStorage.setItem('app_gemini_image_model', value.model)
  localStorage.setItem('app_gemini_image_aspect_ratio', value.aspectRatio)
  localStorage.setItem('app_gemini_image_size', value.imageSize)
  localStorage.setItem('app_gemini_image_mime_type', value.mimeType)
  localStorage.setItem('app_gemini_image_thinking_level', value.thinkingLevel)
  localStorage.setItem('app_gemini_image_google_search', String(value.useGoogleSearch))
  localStorage.setItem('app_gemini_image_image_search', String(value.useImageSearch))
}, { deep: true })
watch(apiPresets, value => localStorage.setItem('app_gemini_image_presets', JSON.stringify(value)), { deep: true })
watch(currentPresetId, value => localStorage.setItem('app_gemini_image_current_preset', value))
watch(prompt, value => localStorage.setItem('app_gemini_image_prompt', value))
watch(selectedReferenceGroupIds, value => localStorage.setItem('app_gemini_image_selected_groups', JSON.stringify(value)), { deep: true })

const {
  isGenerating,
  finalImages,
  errorMsg,
  lastGeneratedParams,
  generateImages,
  abortGeneration
} = useGeminiImage()
const { historyItems, addHistoryItem, deleteHistoryItem, getHistoryImageUrl, loadHistoryList } = useGeminiImageHistory()
const {
  referenceImages,
  referenceGroups,
  addImage,
  removeImage,
  addGroup,
  updateGroup,
  removeGroup,
  getImagesForGroups
} = useGeminiImageReference()

const editingGroupId = ref('')
const newGroupName = ref('')
const newGroupDescription = ref('')
const newGroupKind = ref<GeminiReferenceKind>('character')
const historyImageUrls = ref<Record<string, string>>({})
const selectedPreview = ref('')
const editingGroup = computed(() => referenceGroups.value.find(group => group.id === editingGroupId.value) || null)
const selectedReferenceCount = computed(() => getImagesForGroups(selectedReferenceGroupIds.value).length)
const modelOptions = computed(() => config.value.transport === 'official' ? OFFICIAL_MODELS : OPENROUTER_MODELS)
const isKnownModel = computed(() => modelOptions.value.some(model => model.value === config.value.model))
const isLiteModel = computed(() => config.value.model.includes('flash-lite-image'))
const isFlashModel = computed(() => config.value.model.includes('3.1-flash-image'))
const availableImageSizes = computed<GeminiImageSize[]>(() => isLiteModel.value ? ['1K'] : isFlashModel.value ? ['0.5K', '1K', '2K', '4K'] : ['1K', '2K', '4K'])

const changeTransport = (transport: GeminiImageTransport) => {
  config.value.transport = transport
  config.value.baseUrl = getDefaultBaseUrl(transport)
  config.value.model = getDefaultModel(transport)
}
const selectModel = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  config.value.model = value === '__custom' ? '' : value
  if (config.value.model.includes('flash-lite-image')) config.value.imageSize = '1K'
  else if (!config.value.model.includes('3.1-flash-image') && config.value.imageSize === '0.5K') config.value.imageSize = '1K'
}
const applyApiPreset = () => {
  const preset = apiPresets.value.find(item => item.id === currentPresetId.value)
  if (!preset) return
  config.value.apiKey = preset.apiKey
  config.value.baseUrl = preset.baseUrl
  config.value.transport = preset.transport
  config.value.model = preset.model
}
const confirmSavePreset = () => {
  const name = newPresetName.value.trim()
  if (!name) return
  const index = apiPresets.value.findIndex(item => item.id === currentPresetId.value || item.name === name)
  const preset: GeminiApiPreset = {
    id: index >= 0 ? apiPresets.value[index].id : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    apiKey: config.value.apiKey,
    baseUrl: config.value.baseUrl,
    transport: config.value.transport,
    model: config.value.model
  }
  if (index >= 0) apiPresets.value[index] = preset
  else apiPresets.value.push(preset)
  currentPresetId.value = preset.id
  showPresetNameModal.value = false
}
const deleteApiPreset = () => {
  if (!currentPresetId.value || !window.confirm('确定删除当前 Gemini API 预设吗？')) return
  apiPresets.value = apiPresets.value.filter(item => item.id !== currentPresetId.value)
  currentPresetId.value = ''
}
const buildPrompt = () => {
  const instructions = referenceGroups.value
    .filter(group => selectedReferenceGroupIds.value.includes(group.id))
    .map(group => `${GROUP_KIND_LABELS[group.kind]}“${group.name}”：${group.description || '按该组图片进行参考'}。`)
  return [...instructions, prompt.value.trim()].filter(Boolean).join('\n')
}
const handleGenerate = async () => {
  try {
    const images = await generateImages(
      { apiKey: config.value.apiKey, baseUrl: config.value.baseUrl, transport: config.value.transport },
      {
        model: config.value.model || getDefaultModel(config.value.transport),
        prompt: buildPrompt(),
        aspectRatio: config.value.aspectRatio,
        imageSize: config.value.imageSize,
        mimeType: config.value.mimeType,
        thinkingLevel: config.value.thinkingLevel,
        useGoogleSearch: config.value.transport === 'official' && config.value.useGoogleSearch,
        useImageSearch: config.value.transport === 'official' && config.value.useImageSearch,
        referenceImages: getImagesForGroups(selectedReferenceGroupIds.value).map(image => image.dataUrl)
      }
    )
    for (const image of images) await addHistoryItem(lastGeneratedParams.value, image)
  } catch {
    // 错误由 composable 统一展示。
  }
}
const downloadImage = (image: string, index: number) => {
  const link = document.createElement('a')
  link.href = image
  link.download = `gemini_image_${Date.now()}_${index + 1}.${config.value.mimeType === 'image/jpeg' ? 'jpg' : 'png'}`
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
  for (const file of Array.from(input.files || [])) await addImage(file.name, await fileToDataUrl(file))
  input.value = ''
}
const createGroup = async () => {
  if (!newGroupName.value.trim()) return
  const group = await addGroup(newGroupName.value.trim(), newGroupDescription.value.trim(), newGroupKind.value)
  editingGroupId.value = group.id
  newGroupName.value = ''
  newGroupDescription.value = ''
}
const toggleGroupImage = async (group: GeminiReferenceGroup, imageId: string, checked: boolean) => {
  const next = { ...group, imageIds: [...group.imageIds] }
  if (checked && !next.imageIds.includes(imageId)) next.imageIds.push(imageId)
  if (!checked) next.imageIds = next.imageIds.filter(id => id !== imageId)
  await updateGroup(next)
}
const updateEditingGroup = async (patch: Partial<GeminiReferenceGroup>) => {
  if (editingGroup.value) await updateGroup({ ...editingGroup.value, ...patch })
}
const openHistory = async () => {
  await loadHistoryList()
  const urls: Record<string, string> = {}
  for (const item of historyItems.value) {
    const url = await getHistoryImageUrl(item.id)
    if (url) urls[item.id] = url
  }
  Object.values(historyImageUrls.value).forEach(url => url.startsWith('blob:') && URL.revokeObjectURL(url))
  historyImageUrls.value = urls
  showHistory.value = true
}
const deleteHistory = async (id: string) => {
  const url = historyImageUrls.value[id]
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  await deleteHistoryItem(id)
  delete historyImageUrls.value[id]
}
onUnmounted(() => Object.values(historyImageUrls.value).forEach(url => url.startsWith('blob:') && URL.revokeObjectURL(url)))
</script>

<template>
  <div class="ia-page">
    <div class="header-minimal">
      <div class="header-titles">
        <h1 class="main-title">Gemini Image 接入</h1>
      </div>
      <button class="back-btn" @click="$emit('back')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
      </button>
    </div>
    <div class="gemini-page">
    <div class="scroll">
      <section class="card">
        <div class="heading">
          <div><h3>Gemini Image API</h3><p>独立配置，不读取 NovelAI 或 GPT Image 的密钥和图库。</p></div>
          <button class="soft-btn" @click="openHistory">生成历史</button>
        </div>
        <label class="field">
          <span>接口类型</span>
          <div class="transport-tabs">
            <button :class="{ active: config.transport === 'official' }" @click="changeTransport('official')">Google 官方</button>
            <button :class="{ active: config.transport === 'openrouter' }" @click="changeTransport('openrouter')">OpenRouter</button>
          </div>
        </label>
        <label class="field">
          <span>API 预设</span>
          <div class="row">
            <select v-model="currentPresetId" @change="applyApiPreset">
              <option value="">当前自定义配置</option>
              <option v-for="preset in apiPresets" :key="preset.id" :value="preset.id">{{ preset.name }}</option>
            </select>
            <button class="soft-btn" @click="newPresetName = apiPresets.find(item => item.id === currentPresetId)?.name || ''; showPresetNameModal = true">保存</button>
            <button v-if="currentPresetId" class="soft-btn danger" @click="deleteApiPreset">删除</button>
          </div>
        </label>
        <label class="field">
          <span>API Key</span>
          <div class="row">
            <input v-model="config.apiKey" :type="showApiKey ? 'text' : 'password'" :placeholder="config.transport === 'official' ? 'Google AI Studio API Key' : 'OpenRouter API Key'">
            <button class="soft-btn" @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button>
          </div>
        </label>
        <label class="field">
          <span>Base URL</span>
          <div class="row">
            <input v-model="config.baseUrl">
            <button class="soft-btn" @click="config.baseUrl = getDefaultBaseUrl(config.transport)">恢复默认</button>
          </div>
        </label>
        <label class="field">
          <span>模型</span>
          <select :value="isKnownModel ? config.model : '__custom'" @change="selectModel">
            <option v-for="model in modelOptions" :key="model.value" :value="model.value">{{ model.label }}</option>
            <option value="__custom">自定义模型</option>
          </select>
          <input v-if="!isKnownModel" v-model="config.model" placeholder="输入服务商支持的模型名称">
        </label>
      </section>

      <section class="card">
        <div class="tabs">
          <button :class="{ active: activeTab === 'specs' }" @click="activeTab = 'specs'">生成参数</button>
          <button :class="{ active: activeTab === 'references' }" @click="activeTab = 'references'">Gemini 参考组<span v-if="selectedReferenceCount">（{{ selectedReferenceCount }}图）</span></button>
        </div>
        <div v-if="activeTab === 'specs'" class="grid">
          <label class="field"><span>宽高比</span><select v-model="config.aspectRatio"><option v-for="ratio in ASPECT_RATIOS" :key="ratio">{{ ratio }}</option></select></label>
          <label class="field"><span>分辨率</span><select v-model="config.imageSize"><option v-for="size in availableImageSizes" :key="size">{{ size }}</option></select></label>
          <label class="field"><span>输出格式</span><select v-model="config.mimeType"><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option></select></label>
          <label class="field"><span>思考等级</span><select v-model="config.thinkingLevel" :disabled="!isFlashModel"><option value="minimal">Minimal（快速）</option><option value="high">High（复杂画面）</option></select></label>
          <template v-if="config.transport === 'official'">
            <label class="switch-field"><span><strong>Google 联网搜索</strong><small>根据实时信息生成，可能增加费用与耗时</small></span><input v-model="config.useGoogleSearch" type="checkbox"></label>
            <label class="switch-field"><span><strong>图片搜索</strong><small>查找现实地点或物体的视觉资料</small></span><input v-model="config.useImageSearch" type="checkbox"></label>
          </template>
          <p class="hint full">Gemini 不使用 Negative Prompt、Seed、Sampler、Steps 或 CFG。单次生成返回一张最终图片。</p>
        </div>
        <div v-else class="reference-panel">
          <div class="heading"><p class="hint">角色、物体、画风和场景参考均与其他引擎分开保存。</p><button class="soft-btn" @click="showReferenceManager = true">管理参考图库</button></div>
          <label v-for="group in referenceGroups" :key="group.id" class="group-option">
            <input v-model="selectedReferenceGroupIds" type="checkbox" :value="group.id">
            <span><strong>{{ group.name }} · {{ GROUP_KIND_LABELS[group.kind] }}</strong><small>{{ group.imageIds.length }} 张图 · {{ group.description || '无用途说明' }}</small></span>
          </label>
          <div v-if="!referenceGroups.length" class="empty">暂无 Gemini 参考组。</div>
        </div>
      </section>

      <section class="card">
        <h3>画面描述</h3>
        <p class="hint">Gemini 可直接理解中文自然语言，不需要转换为标签。</p>
        <textarea v-model="prompt" rows="7" placeholder="描述人物、动作、场景、构图、镜头、文字与光线……"></textarea>
        <div v-if="errorMsg" class="error">{{ errorMsg }}</div>
        <button v-if="!isGenerating" class="primary" @click="handleGenerate">使用 Gemini 生成</button>
        <button v-else class="primary cancel" @click="abortGeneration">取消生成</button>
      </section>

      <section v-if="finalImages.length" class="card">
        <h3>生成结果</h3>
        <div class="image-grid">
          <article v-for="(image, index) in finalImages" :key="index">
            <img :src="image" alt="Gemini 生成结果" @click="selectedPreview = image">
            <button @click="downloadImage(image, index)">保存图片</button>
          </article>
        </div>
      </section>
    </div>

    <div v-if="showReferenceManager" class="overlay" @click.self="showReferenceManager = false">
      <div class="modal wide">
        <div class="heading"><div><h3>Gemini 参考图库</h3><p>最多选择 14 张图片参与一次生成。</p></div><button class="close" @click="showReferenceManager = false">×</button></div>
        <div class="manager">
          <aside>
            <input v-model="newGroupName" placeholder="参考组名称">
            <select v-model="newGroupKind"><option v-for="(label, kind) in GROUP_KIND_LABELS" :key="kind" :value="kind">{{ label }}</option></select>
            <textarea v-model="newGroupDescription" rows="3" placeholder="例如：保持人物脸型和发色"></textarea>
            <button class="soft-btn block" @click="createGroup">创建参考组</button>
            <button v-for="group in referenceGroups" :key="group.id" class="group-nav" :class="{ active: editingGroupId === group.id }" @click="editingGroupId = group.id">{{ group.name }} · {{ group.imageIds.length }}图</button>
          </aside>
          <main>
            <label class="upload">上传参考图片<input type="file" accept="image/*" multiple hidden @change="handleReferenceUpload"></label>
            <template v-if="editingGroup">
              <label class="field"><span>组名称</span><input :value="editingGroup.name" @change="updateEditingGroup({ name: ($event.target as HTMLInputElement).value })"></label>
              <label class="field"><span>参考类型</span><select :value="editingGroup.kind" @change="updateEditingGroup({ kind: ($event.target as HTMLSelectElement).value as GeminiReferenceKind })"><option v-for="(label, kind) in GROUP_KIND_LABELS" :key="kind" :value="kind">{{ label }}</option></select></label>
              <label class="field"><span>用途说明</span><textarea :value="editingGroup.description" rows="3" @change="updateEditingGroup({ description: ($event.target as HTMLTextAreaElement).value })"></textarea></label>
            </template>
            <div class="image-grid">
              <article v-for="image in referenceImages" :key="image.id">
                <img :src="image.dataUrl" :alt="image.name">
                <label v-if="editingGroup" class="check"><input type="checkbox" :checked="editingGroup.imageIds.includes(image.id)" @change="toggleGroupImage(editingGroup, image.id, ($event.target as HTMLInputElement).checked)">加入当前组</label>
                <button @click="removeImage(image.id)">删除图片</button>
              </article>
            </div>
            <div v-if="!referenceImages.length" class="empty">请先上传参考图片。</div>
            <button v-if="editingGroup" class="soft-btn danger block" @click="removeGroup(editingGroup.id); editingGroupId = ''">删除当前参考组</button>
          </main>
        </div>
      </div>
    </div>

    <div v-if="showHistory" class="overlay" @click.self="showHistory = false">
      <div class="modal">
        <div class="heading"><div><h3>Gemini 生图历史</h3><p>最多保留最近 30 张。</p></div><button class="close" @click="showHistory = false">×</button></div>
        <div class="image-grid">
          <article v-for="item in historyItems" :key="item.id">
            <img v-if="historyImageUrls[item.id]" :src="historyImageUrls[item.id]" @click="selectedPreview = historyImageUrls[item.id]">
            <small>{{ new Date(item.timestamp).toLocaleString() }}</small>
            <button @click="deleteHistory(item.id)">删除</button>
          </article>
        </div>
        <div v-if="!historyItems.length" class="empty">暂无 Gemini 生图历史。</div>
      </div>
    </div>

    <div v-if="showPresetNameModal" class="overlay" @click.self="showPresetNameModal = false">
      <div class="modal small"><h3>保存 Gemini API 预设</h3><input v-model="newPresetName" autofocus placeholder="预设名称" @keyup.enter="confirmSavePreset"><button class="primary" :disabled="!newPresetName.trim()" @click="confirmSavePreset">保存</button></div>
    </div>
    <div v-if="selectedPreview" class="overlay preview" @click="selectedPreview = ''"><img :src="selectedPreview"></div>
    </div>
  </div>
</template>

<style scoped src="../app_ImageAccess.css"></style>
<style scoped>
.ia-page>.gemini-page{height:auto;flex:1}
.gemini-page{height:100%;min-height:0;color:#1d1d1f}.scroll{height:100%;overflow-y:auto;padding:10px 24px 60px;box-sizing:border-box}.card{max-width:760px;margin:0 auto 18px;padding:22px;border-radius:22px;background:rgba(255,255,255,.9);box-shadow:0 12px 40px rgba(43,56,82,.08)}h3{margin:0 0 14px;font-size:18px}.heading,.row{display:flex;align-items:center;justify-content:space-between;gap:10px}.heading p,.hint{margin:3px 0;color:#7a7f89;font-size:12px;line-height:1.5}.field{display:flex;flex-direction:column;gap:7px;margin-top:14px;font-size:13px;font-weight:600}input,select,textarea{width:100%;box-sizing:border-box;border:1px solid #e2e5ea;border-radius:12px;padding:11px 12px;background:#f8f9fb;color:#222;font:inherit;outline:none}textarea{resize:vertical;line-height:1.55}.soft-btn,.upload{flex:0 0 auto;border:0;border-radius:11px;padding:10px 14px;background:#eceef0;color:#4c5158;cursor:pointer;font-weight:600}.danger{color:#b23c45;background:#fff0f1}.block{display:block;width:100%;margin:8px 0}.transport-tabs,.tabs{display:flex;padding:4px;border-radius:14px;background:#f0f2f6}.transport-tabs button,.tabs button{flex:1;border:0;padding:10px;border-radius:11px;background:transparent;color:#777;cursor:pointer}.transport-tabs button.active,.tabs button.active{background:#fff;color:#41454b;box-shadow:0 2px 8px #00000012;font-weight:700}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px;padding-top:8px}.full{grid-column:1/-1}.switch-field{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;padding:12px;border-radius:13px;background:#f7f8fb}.switch-field span{display:flex;flex-direction:column;font-size:13px}.switch-field small,.group-option small{color:#7c818c;font-weight:400}.switch-field input,.group-option input,.check input{width:auto}.reference-panel{padding-top:12px}.group-option{display:flex;gap:10px;align-items:flex-start;margin-top:9px;padding:12px;border-radius:13px;background:#f7f8fb}.group-option span{display:flex;flex-direction:column;gap:3px}.primary{width:100%;margin-top:18px;border:0;border-radius:14px;padding:14px;color:#fff;background:#4d5259;font-weight:700;cursor:pointer}.primary.cancel{background:#6b7077}.primary:disabled{opacity:.45}.error{margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff0f1;color:#c63d48;font-size:12px}.image-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.image-grid article{overflow:hidden;border:1px solid #eceef2;border-radius:14px;background:#fafbfc}.image-grid img{width:100%;aspect-ratio:1;object-fit:cover;display:block;cursor:zoom-in}.image-grid button{width:100%;border:0;padding:9px;color:#555b63;background:transparent;cursor:pointer}.image-grid small{display:block;padding:8px;color:#777}.check{display:flex;gap:5px;padding:8px;font-size:12px}.empty{padding:30px 10px;text-align:center;color:#999;font-size:13px}.overlay{position:fixed;z-index:12000;inset:0;display:grid;place-items:center;padding:18px;background:#1619237a;backdrop-filter:blur(10px)}.modal{width:min(720px,calc(100vw - 36px));max-height:84vh;overflow-y:auto;padding:22px;box-sizing:border-box;border-radius:22px;background:#fff}.modal.wide{width:min(980px,calc(100vw - 36px))}.modal.small{width:min(420px,calc(100vw - 36px))}.close{border:0;background:transparent;font-size:30px;cursor:pointer}.manager{display:grid;grid-template-columns:220px 1fr;gap:18px;margin-top:18px}.manager aside{display:flex;flex-direction:column;gap:8px;padding-right:14px;border-right:1px solid #eceef2}.group-nav{width:100%;border:0;border-radius:10px;padding:10px;text-align:left;background:#f3f4f7;color:#555;cursor:pointer}.group-nav.active{background:#e5e7e9;font-weight:700}.upload{display:inline-block;margin-bottom:10px}.preview img{max-width:95vw;max-height:92vh;object-fit:contain;border-radius:12px}@media(max-width:640px){.scroll{padding:10px 12px 48px}.card{padding:16px}.grid{grid-template-columns:1fr}.image-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.manager{grid-template-columns:1fr}.manager aside{padding-right:0;padding-bottom:12px;border-right:0;border-bottom:1px solid #eceef2}}
</style>
