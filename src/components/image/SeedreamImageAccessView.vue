<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSeedreamImage, type SeedreamImageFormat, type SeedreamImageSize } from '../../composables/useSeedreamImage'
import { useSeedreamImageHistory } from '../../composables/useSeedreamImageHistory'
import { useSeedreamImageReference, type SeedreamReferenceGroup } from '../../composables/useSeedreamImageReference'

defineEmits<{ (e: 'back'): void }>()

const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const MODELS = [
  { value: 'doubao-seedream-5-0-lite-260128', label: 'Seedream 5.0 Lite（推荐）' },
  { value: 'doubao-seedream-5-0-260128', label: 'Seedream 5.0（高质量）' },
  { value: 'doubao-seedream-4-5-251128', label: 'Seedream 4.5（兼容）' },
  { value: '__custom__', label: '自定义模型 ID' }
]

const activeTab = ref<'generate' | 'references' | 'history'>('generate')
const showApiKey = ref(false)
const prompt = ref(localStorage.getItem('app_seedream_image_prompt') || '')
const previewImages = ref<string[]>([])
const selectedGroupIds = ref<string[]>(JSON.parse(localStorage.getItem('app_seedream_image_selected_groups') || '[]'))
const uploadInput = ref<HTMLInputElement | null>(null)
const editingGroupId = ref('')
const groupName = ref('')
const groupDescription = ref('')
const savedModel = localStorage.getItem('app_seedream_image_model') || 'doubao-seedream-5-0-lite-260128'
const modelPreset = ref(MODELS.some(item => item.value === savedModel) ? savedModel : '__custom__')
const config = ref({
  apiKey: localStorage.getItem('app_seedream_image_apikey') || '',
  baseUrl: localStorage.getItem('app_seedream_image_baseurl') || DEFAULT_BASE_URL,
  model: savedModel,
  size: (localStorage.getItem('app_seedream_image_size') || '2K') as SeedreamImageSize,
  outputFormat: (localStorage.getItem('app_seedream_image_format') || 'png') as SeedreamImageFormat,
  watermark: localStorage.getItem('app_seedream_image_watermark') === 'true',
  seed: localStorage.getItem('app_seedream_image_seed') || '',
  sequential: (localStorage.getItem('app_seedream_image_sequential') === 'auto' ? 'auto' : 'disabled') as 'auto' | 'disabled',
  maxImages: Number(localStorage.getItem('app_seedream_image_max_images') || 4)
})

watch(modelPreset, value => { if (value !== '__custom__') config.value.model = value })
watch(config, value => {
  localStorage.setItem('app_seedream_image_apikey', value.apiKey)
  localStorage.setItem('app_seedream_image_baseurl', value.baseUrl)
  localStorage.setItem('app_seedream_image_model', value.model)
  localStorage.setItem('app_seedream_image_size', value.size)
  localStorage.setItem('app_seedream_image_format', value.outputFormat)
  localStorage.setItem('app_seedream_image_watermark', String(value.watermark))
  localStorage.setItem('app_seedream_image_seed', String(value.seed))
  localStorage.setItem('app_seedream_image_sequential', value.sequential)
  localStorage.setItem('app_seedream_image_max_images', String(value.maxImages))
}, { deep: true })
watch(prompt, value => localStorage.setItem('app_seedream_image_prompt', value))
watch(selectedGroupIds, value => localStorage.setItem('app_seedream_image_selected_groups', JSON.stringify(value)), { deep: true })

const { isGenerating, errorMsg, lastGeneratedParams, generateImages, abortGeneration } = useSeedreamImage()
const { historyItems, loadHistoryList, addHistoryItem, deleteHistoryItem, getHistoryImageUrl } = useSeedreamImageHistory()
const {
  referenceImages, referenceGroups, loadData, addImage, removeImage,
  addGroup, updateGroup, removeGroup, getImagesForGroups
} = useSeedreamImageReference()
const editingGroup = computed(() => referenceGroups.value.find(group => group.id === editingGroupId.value) || null)
const selectedReferenceCount = computed(() => getImagesForGroups(selectedGroupIds.value).length)
const totalImageCount = computed(() => selectedReferenceCount.value + (config.value.sequential === 'auto' ? config.value.maxImages : 1))
const countError = computed(() => totalImageCount.value > 15 ? '参考图与输出图片合计不能超过 15 张' : '')

const buildPrompt = () => {
  const instructions = referenceGroups.value
    .filter(group => selectedGroupIds.value.includes(group.id) && group.description.trim())
    .map(group => `参考组“${group.name}”：${group.description.trim()}`)
  return [...instructions, prompt.value.trim()].filter(Boolean).join('\n')
}

const handleGenerate = async () => {
  try {
    const images = await generateImages({ apiKey: config.value.apiKey, baseUrl: config.value.baseUrl }, {
      model: config.value.model,
      prompt: buildPrompt(),
      size: config.value.size,
      outputFormat: config.value.outputFormat,
      watermark: config.value.watermark,
      seed: config.value.seed === '' ? null : Number(config.value.seed),
      referenceImages: getImagesForGroups(selectedGroupIds.value).map(item => item.dataUrl),
      sequentialImageGeneration: config.value.sequential,
      maxImages: config.value.sequential === 'auto' ? config.value.maxImages : 1
    })
    previewImages.value = images
    if (lastGeneratedParams.value) {
      for (const image of images) await addHistoryItem(lastGeneratedParams.value, image)
    }
  } catch {
    // composable 已提供可见错误。
  }
}

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})
const handleUpload = async (event: Event) => {
  const files = Array.from((event.target as HTMLInputElement).files || [])
  for (const file of files) await addImage(file.name, await readAsDataUrl(file))
  if (uploadInput.value) uploadInput.value.value = ''
}
const startGroup = (group?: SeedreamReferenceGroup) => {
  editingGroupId.value = group?.id || ''
  groupName.value = group?.name || ''
  groupDescription.value = group?.description || ''
}
const saveGroup = async () => {
  if (!groupName.value.trim()) return
  if (editingGroup.value) {
    await updateGroup({ ...editingGroup.value, name: groupName.value.trim(), description: groupDescription.value.trim() })
  } else {
    const group = await addGroup(groupName.value.trim(), groupDescription.value.trim())
    editingGroupId.value = group.id
  }
}
const toggleGroupImage = async (imageId: string) => {
  if (!editingGroup.value) return
  const ids = editingGroup.value.imageIds.includes(imageId)
    ? editingGroup.value.imageIds.filter(id => id !== imageId)
    : [...editingGroup.value.imageIds, imageId]
  if (ids.length > 10) return
  await updateGroup({ ...editingGroup.value, imageIds: ids })
}
const openHistory = async (id: string) => {
  const url = await getHistoryImageUrl(id)
  if (url) { previewImages.value = [url]; activeTab.value = 'generate' }
}

onMounted(async () => { await Promise.all([loadData(), loadHistoryList()]) })
</script>

<template>
  <div class="ia-page">
    <div class="header-minimal">
      <div class="header-titles"><h1 class="main-title">Seedream 接入</h1></div>
      <button class="back-btn" aria-label="返回图像引擎" @click="$emit('back')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
      </button>
    </div>
    <div class="seedream-page"><div class="seedream-scroll">
      <section class="card hero-card">
        <div class="section-heading"><div><span class="eyebrow">VOLCENGINE ARK</span><h3>Seedream 独立接入</h3><p>使用 2026 Seedream 5.0 系列，不读取其他图像引擎配置。</p></div><span class="model-badge">5.0</span></div>
      </section>

      <div class="pill-menu">
        <button class="pill-item" :class="{ active: activeTab === 'generate' }" @click="activeTab = 'generate'">生成与配置</button>
        <button class="pill-item" :class="{ active: activeTab === 'references' }" @click="activeTab = 'references'">参考组</button>
        <button class="pill-item" :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">生成历史</button>
      </div>

      <template v-if="activeTab === 'generate'">
        <section class="card">
          <div class="section-heading"><div><h3>火山方舟</h3><p>API Key 仅保存在当前设备，可填写官方地址或自托管兼容代理。</p></div></div>
          <label class="field"><span>方舟 API / 代理基础地址</span><input v-model="config.baseUrl" placeholder="https://ark.cn-beijing.volces.com/api/v3"><small>请求路径会自动补全为 /images/generations。</small></label>
          <label class="field"><span>ARK API Key（仅保存在本机）</span><div class="inline"><input v-model="config.apiKey" :type="showApiKey ? 'text' : 'password'" placeholder="填写火山方舟 API Key"><button class="ghost-btn" @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button></div></label>
          <label class="field"><span>模型版本</span><select v-model="modelPreset"><option v-for="model in MODELS" :key="model.value" :value="model.value">{{ model.label }}</option></select></label>
          <label v-if="modelPreset === '__custom__'" class="field"><span>自定义模型 ID</span><input v-model="config.model" placeholder="doubao-seedream-..."><small>保留此入口以兼容后续官方版本更新。</small></label>
        </section>

        <section class="card">
          <h3>Seedream 参数</h3>
          <label class="field"><span>画面描述</span><textarea v-model="prompt" rows="7" placeholder="用自然语言描述主体、动作、场景、构图、光线和需要保持的特征……"></textarea></label>
          <div class="field-grid">
            <label class="field"><span>清晰度</span><select v-model="config.size"><option value="1K">1K</option><option value="2K">2K（推荐）</option><option value="4K">4K</option></select></label>
            <label class="field"><span>图片格式</span><select v-model="config.outputFormat"><option value="png">PNG</option><option value="jpeg">JPEG</option></select></label>
            <label class="field"><span>生成模式</span><select v-model="config.sequential"><option value="disabled">单张图片</option><option value="auto">连续组图</option></select></label>
            <label v-if="config.sequential === 'auto'" class="field"><span>最多输出</span><input v-model.number="config.maxImages" type="number" min="1" max="15"></label>
            <label class="field"><span>Seed（留空随机）</span><input v-model="config.seed" type="number" placeholder="随机"></label>
          </div>
          <label class="switch-row"><span><strong>添加官方水印</strong><small>由 Seedream 在输出图片中添加模型水印。</small></span><span class="switch"><input v-model="config.watermark" type="checkbox"><i></i></span></label>
          <div class="generate-row"><p class="hint">已选择 {{ selectedReferenceCount }}/10 张参考图；当前请求共 {{ totalImageCount }}/15 张输入与输出。</p><div class="actions"><button v-if="isGenerating" class="danger-btn" @click="abortGeneration">取消</button><button class="primary-btn" :disabled="isGenerating || !!countError" @click="handleGenerate">{{ isGenerating ? '正在生成…' : '开始生成' }}</button></div></div>
          <p v-if="countError" class="error">{{ countError }}</p><p v-if="errorMsg" class="error">{{ errorMsg }}</p>
        </section>

        <section class="card preview-card"><div v-if="previewImages.length" class="preview-grid"><img v-for="(image, index) in previewImages" :key="index" :src="image" :alt="`Seedream 生成结果 ${index + 1}`"></div><div v-else class="empty">生成结果将在这里显示</div></section>
      </template>

      <section v-else-if="activeTab === 'references'" class="card">
        <div class="section-heading"><div><h3>独立参考图库</h3><p>角色、画风、服装和场景参考仅供 Seedream 使用。</p></div><button class="primary-btn" @click="uploadInput?.click()">上传图片</button><input ref="uploadInput" type="file" accept="image/*" multiple hidden @change="handleUpload"></div>
        <div class="group-editor"><select v-model="editingGroupId" @change="startGroup(editingGroup || undefined)"><option value="">新建参考组</option><option v-for="group in referenceGroups" :key="group.id" :value="group.id">{{ group.name }}</option></select><input v-model="groupName" placeholder="参考组名称"><input v-model="groupDescription" placeholder="例如：保持人物面部、发型和服装一致"><button class="primary-btn" @click="saveGroup">保存参考组</button><button v-if="editingGroup" class="danger-btn" @click="removeGroup(editingGroup.id); startGroup()">删除组</button></div>
        <div class="image-grid"><article v-for="image in referenceImages" :key="image.id" :class="{ selected: editingGroup?.imageIds.includes(image.id) }" @click="toggleGroupImage(image.id)"><img :src="image.dataUrl" :alt="image.name"><span>{{ image.name }}</span><button @click.stop="removeImage(image.id)">×</button></article><div v-if="!referenceImages.length" class="empty">尚未上传 Seedream 参考图</div></div>
        <div class="group-list"><label v-for="group in referenceGroups" :key="group.id"><input v-model="selectedGroupIds" type="checkbox" :value="group.id"><span><strong>{{ group.name }}</strong><small>{{ group.imageIds.length }} 张 · {{ group.description || '无说明' }}</small></span></label></div>
      </section>

      <section v-else class="card history"><article v-for="item in historyItems" :key="item.id"><button class="history-main" @click="openHistory(item.id)"><strong>{{ item.params.model }}</strong><span>{{ new Date(item.timestamp).toLocaleString() }}</span><small>{{ item.params.size || '2K' }} · {{ item.params.prompt }}</small></button><button class="danger-btn" @click="deleteHistoryItem(item.id)">删除</button></article><div v-if="!historyItems.length" class="empty">暂无 Seedream 生成历史</div></section>
    </div></div>
  </div>
</template>

<style scoped src="../app_ImageAccess.css"></style>
<style scoped>
.seedream-page{height:100%;min-height:0;color:#1d1d1f}.seedream-scroll{height:100%;overflow-y:auto;padding:10px 24px 60px;box-sizing:border-box}.card{max-width:760px;margin:0 auto 18px;padding:22px;border-radius:22px;background:rgba(255,255,255,.88);box-shadow:0 12px 40px rgba(43,56,82,.08);border:1px solid rgba(255,255,255,.8)}.hero-card{background:linear-gradient(135deg,#1c3570,#3566a8);color:#fff}.section-heading,.generate-row{display:flex;align-items:center;justify-content:space-between;gap:16px}.section-heading h3{margin:4px 0 6px}.section-heading p,.hint{margin:3px 0 0;color:#7a7f89;font-size:12px;line-height:1.5}.hero-card p{color:rgba(255,255,255,.72)}.eyebrow{font-size:10px;letter-spacing:2px;color:#cfe3ff}.model-badge{flex:none;padding:9px 12px;border:1px solid rgba(255,255,255,.24);border-radius:12px;font-size:13px;font-weight:800}.pill-menu{display:flex;max-width:760px;margin:0 auto 18px;padding:4px;border-radius:20px;background:#e9eaf0}.pill-item{flex:1;padding:9px 0;border:0;border-radius:16px;background:transparent;color:#555;font:inherit;font-size:14px;font-weight:500;cursor:pointer}.pill-item.active{background:#fff;color:#111;box-shadow:0 2px 8px rgba(0,0,0,.05)}h3{margin:0 0 14px;font-size:18px}.field{display:flex;flex-direction:column;gap:7px;margin-top:14px;font-size:13px;font-weight:600}.field small{color:#7a7f89;font-size:11px;font-weight:400;line-height:1.45}input,select,textarea{width:100%;box-sizing:border-box;border:1px solid #e2e5ea;border-radius:12px;padding:11px 12px;background:#f8f9fb;color:#222;font:inherit;outline:none}input:focus,select:focus,textarea:focus{border-color:#6885ad;box-shadow:0 0 0 3px rgba(53,102,168,.1)}textarea{resize:vertical;line-height:1.55}.inline{display:flex;gap:8px}.ghost-btn,.primary-btn,.danger-btn,.history-main{border:0;border-radius:11px;font:inherit;cursor:pointer}.ghost-btn{flex:none;padding:0 14px;background:#eceef2;color:#4d5158}.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.switch-row{display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding:12px;border-radius:12px;background:#f8f9fb;font-size:13px}.switch-row>span:first-child{display:flex;flex-direction:column;gap:3px}.switch-row small{color:#7a7f89;font-weight:400}.switch{position:relative;width:50px;height:30px;flex:none}.switch input{position:absolute;opacity:0;width:0;height:0}.switch i{position:absolute;inset:0;border-radius:30px;background:#e5e5ea;transition:.3s}.switch i:before{content:"";position:absolute;width:26px;height:26px;left:2px;top:2px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.1);transition:.3s}.switch input:checked+i{background:#3566a8}.switch input:checked+i:before{transform:translateX(20px)}.generate-row{align-items:flex-end;margin-top:18px}.actions{display:flex;gap:8px;flex:none}.primary-btn,.danger-btn{padding:11px 16px;font-weight:700}.primary-btn{background:#3566a8;color:#fff}.primary-btn:disabled{opacity:.55}.danger-btn{background:#f6e9e9;color:#9d3030}.error{color:#c0392b;font-size:12px}.preview-card{min-height:320px;background:#111827}.preview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;width:100%}.preview-grid img{width:100%;max-height:70vh;object-fit:contain;border-radius:12px}.empty{padding:40px;text-align:center;color:#888}.group-editor{display:grid;grid-template-columns:1fr 1fr 2fr auto auto;gap:8px;margin:16px 0}.image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px}.image-grid>.empty{grid-column:1/-1}.image-grid article{position:relative;padding:7px;border:2px solid transparent;border-radius:12px;background:#f5f6f7;cursor:pointer}.image-grid article.selected{border-color:#3566a8}.image-grid img{width:100%;height:100px;object-fit:cover;border-radius:8px}.image-grid span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.image-grid button{position:absolute;right:3px;top:3px;border:0;border-radius:50%;background:#fff;color:#a22}.group-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:16px}.group-list label{display:flex;align-items:flex-start;gap:8px;padding:10px;border-radius:10px;background:#f5f6f7;font-size:12px}.group-list input{appearance:none;flex:none;width:18px;height:18px;padding:0;border:1px solid #cbd3df;border-radius:5px;background:#fff}.group-list input:checked{border-color:#3566a8;background:#3566a8}.group-list input:checked:after{content:'✓';display:grid;height:100%;place-items:center;color:#fff;font-size:12px;font-weight:800}.group-list span{display:flex;flex-direction:column}.group-list small{color:#777}.history article{display:flex;gap:8px;margin-bottom:8px}.history-main{display:flex;flex:1;min-width:0;flex-direction:column;align-items:flex-start;padding:11px;background:#f5f6f7;color:inherit;text-align:left}.history-main span{font-size:12px;color:#777}.history-main small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#777}@media(max-width:560px){.seedream-scroll{padding:10px 16px 46px}.card{padding:18px;border-radius:18px}.field-grid,.group-editor{grid-template-columns:1fr}.section-heading{align-items:flex-start}.generate-row{align-items:stretch;flex-direction:column}.actions{justify-content:flex-end}.primary-btn{flex:1}.model-badge{font-size:11px}.history article{align-items:stretch}.history .danger-btn{padding:9px}}.ia-page>.seedream-page{height:auto;flex:1}
</style>
