<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useFluxImage, type FluxImageFormat, type FluxImageModel } from '../../composables/useFluxImage'
import { useFluxImageHistory } from '../../composables/useFluxImageHistory'
import { useFluxImageReference, type FluxReferenceGroup } from '../../composables/useFluxImageReference'

defineEmits<{ (e: 'back'): void }>()

const MODELS = [
  { value: 'flux-2-pro-preview', label: 'FLUX.2 Pro Preview（推荐）' },
  { value: 'flux-2-pro', label: 'FLUX.2 Pro（固定版本）' },
  { value: 'flux-2-max', label: 'FLUX.2 Max（最高质量）' }
] as const
const DEFAULT_PROXY = 'https://clingy-flux-proxy.q89028615.workers.dev'

const activeTab = ref<'generate' | 'references' | 'history'>('generate')
const showApiKey = ref(false)
const prompt = ref(localStorage.getItem('app_flux_image_prompt') || '')
const selectedGroupIds = ref<string[]>(JSON.parse(localStorage.getItem('app_flux_image_selected_groups') || '[]'))
const previewImage = ref('')
const historyUrls = ref<Record<string, string>>({})
const uploadInput = ref<HTMLInputElement | null>(null)
const editingGroupId = ref('')
const groupName = ref('')
const groupDescription = ref('')
const config = ref({
  apiKey: localStorage.getItem('app_flux_image_apikey') || '',
  proxyUrl: localStorage.getItem('app_flux_image_proxy_url') || DEFAULT_PROXY,
  model: (localStorage.getItem('app_flux_image_model') || 'flux-2-pro-preview') as FluxImageModel,
  width: Number(localStorage.getItem('app_flux_image_width') || 1024),
  height: Number(localStorage.getItem('app_flux_image_height') || 1536),
  outputFormat: (localStorage.getItem('app_flux_image_format') || 'png') as FluxImageFormat,
  safetyTolerance: Number(localStorage.getItem('app_flux_image_safety') || 2),
  seed: localStorage.getItem('app_flux_image_seed') || '',
  disablePromptUpsampling: localStorage.getItem('app_flux_image_disable_pup') === 'true'
})

watch(config, value => {
  localStorage.setItem('app_flux_image_apikey', value.apiKey)
  localStorage.setItem('app_flux_image_proxy_url', value.proxyUrl)
  localStorage.setItem('app_flux_image_model', value.model)
  localStorage.setItem('app_flux_image_width', String(value.width))
  localStorage.setItem('app_flux_image_height', String(value.height))
  localStorage.setItem('app_flux_image_format', value.outputFormat)
  localStorage.setItem('app_flux_image_safety', String(value.safetyTolerance))
  localStorage.setItem('app_flux_image_seed', String(value.seed))
  localStorage.setItem('app_flux_image_disable_pup', String(value.disablePromptUpsampling))
}, { deep: true })
watch(prompt, value => localStorage.setItem('app_flux_image_prompt', value))
watch(selectedGroupIds, value => localStorage.setItem('app_flux_image_selected_groups', JSON.stringify(value)), { deep: true })

const { isGenerating, finalImage, errorMsg, lastGeneratedParams, generateImage, abortGeneration } = useFluxImage()
const { historyItems, addHistoryItem, deleteHistoryItem, getHistoryImageUrl, loadHistoryList } = useFluxImageHistory()
const {
  referenceImages,
  referenceGroups,
  loadData,
  addImage,
  removeImage,
  addGroup,
  updateGroup,
  removeGroup,
  getImagesForGroups
} = useFluxImageReference()

const editingGroup = computed(() => referenceGroups.value.find(group => group.id === editingGroupId.value) || null)
const selectedReferenceCount = computed(() => getImagesForGroups(selectedGroupIds.value).length)
const sizeError = computed(() => {
  const { width, height } = config.value
  if (width < 64 || height < 64) return '宽高不能小于 64'
  if (width % 16 !== 0 || height % 16 !== 0) return '宽高必须是 16 的倍数'
  if (width * height > 4_000_000) return '总像素不能超过 4MP'
  return ''
})

const buildPrompt = () => {
  const instructions = referenceGroups.value
    .filter(group => selectedGroupIds.value.includes(group.id) && group.description.trim())
    .map(group => `参考组“${group.name}”：${group.description.trim()}`)
  return [...instructions, prompt.value.trim()].filter(Boolean).join('\n')
}

const handleGenerate = async () => {
  try {
    const image = await generateImage(
      { apiKey: config.value.apiKey, proxyUrl: config.value.proxyUrl },
      {
        model: config.value.model,
        prompt: buildPrompt(),
        width: config.value.width,
        height: config.value.height,
        outputFormat: config.value.outputFormat,
        safetyTolerance: config.value.safetyTolerance,
        seed: config.value.seed === '' ? null : Number(config.value.seed),
        disablePromptUpsampling: config.value.disablePromptUpsampling,
        referenceImages: getImagesForGroups(selectedGroupIds.value).map(item => item.dataUrl)
      }
    )
    previewImage.value = image
    if (lastGeneratedParams.value) await addHistoryItem(lastGeneratedParams.value, image)
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

const startGroup = (group?: FluxReferenceGroup) => {
  editingGroupId.value = group?.id || ''
  groupName.value = group?.name || ''
  groupDescription.value = group?.description || ''
}

const saveGroup = async () => {
  if (!groupName.value.trim()) return
  if (editingGroup.value) {
    await updateGroup({
      ...editingGroup.value,
      name: groupName.value.trim(),
      description: groupDescription.value.trim()
    })
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
  if (ids.length > 8) return
  await updateGroup({ ...editingGroup.value, imageIds: ids })
}

const openHistory = async (id: string) => {
  const url = await getHistoryImageUrl(id)
  if (url) {
    historyUrls.value[id] = url
    previewImage.value = url
  }
}

onMounted(async () => {
  await Promise.all([loadData(), loadHistoryList()])
  if (finalImage.value) previewImage.value = finalImage.value
})
</script>

<template>
  <div class="ia-page">
    <div class="header-minimal">
      <div class="header-titles">
        <h1 class="main-title">FLUX.2 接入</h1>
      </div>
      <button class="back-btn" @click="$emit('back')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
      </button>
    </div>
    <div class="flux-page">
    <div class="hero">
      <div>
        <span class="brand">BLACK FOREST LABS</span>
        <h2>FLUX.2 独立接入</h2>
        <p>通过专用 Cloudflare 代理调用 Pro / Max，不读取其他生图引擎配置。</p>
      </div>
      <div class="model-badge">{{ config.model.replace('flux-2-', '').toUpperCase() }}</div>
    </div>

    <nav>
      <button :class="{ active: activeTab === 'generate' }" @click="activeTab = 'generate'">生成</button>
      <button :class="{ active: activeTab === 'references' }" @click="activeTab = 'references'">参考组</button>
      <button :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">历史</button>
    </nav>

    <section v-if="activeTab === 'generate'" class="workspace">
      <div class="panel form">
        <label><span>BFL API Key（仅保存在本机）</span><div class="inline"><input v-model="config.apiKey" :type="showApiKey ? 'text' : 'password'" placeholder="暂无 Key 时可先完成配置"><button @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button></div></label>
        <label>
          <span>Cloudflare 代理地址</span>
          <input v-model="config.proxyUrl" placeholder="https://xxx.workers.dev">
          <span class="hint proxy-hint">
            <strong>免责声明：</strong> 此默认代理由作者免费提供，绝不会保存您的 API Key 及图片数据。若有隐私顾虑，可使用源码中 <code>workers/flux-proxy</code> 自行部署专属代理替换此处。
          </span>
        </label>
        <label><span>模型</span><select v-model="config.model"><option v-for="model in MODELS" :key="model.value" :value="model.value">{{ model.label }}</option></select></label>
        <label><span>画面描述</span><textarea v-model="prompt" rows="7" placeholder="描述主体、动作、场景、构图和光线……"></textarea></label>
        <div class="grid">
          <label><span>宽度</span><input v-model.number="config.width" type="number" min="64" step="16"></label>
          <label><span>高度</span><input v-model.number="config.height" type="number" min="64" step="16"></label>
          <label><span>格式</span><select v-model="config.outputFormat"><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option></select></label>
          <label><span>安全级别 0–5</span><input v-model.number="config.safetyTolerance" type="number" min="0" max="5"></label>
          <label><span>Seed（可选）</span><input v-model="config.seed" type="number" placeholder="随机"></label>
          <label class="switch"><input v-model="config.disablePromptUpsampling" type="checkbox"><span>关闭内置提示词扩写</span></label>
        </div>
        <p v-if="sizeError" class="error">{{ sizeError }}</p>
        <p class="hint">已选择 {{ selectedReferenceCount }}/8 张参考图。FLUX.2 默认会自动丰富短提示词。</p>
        <div class="actions"><button v-if="isGenerating" class="stop" @click="abortGeneration">取消</button><button class="primary" :disabled="isGenerating || !!sizeError" @click="handleGenerate">{{ isGenerating ? '正在生成…' : '开始生成' }}</button></div>
        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      </div>
      <div class="panel preview"><img v-if="previewImage" :src="previewImage" alt="FLUX 生成结果"><div v-else class="empty">生成结果将在这里显示</div></div>
    </section>

    <section v-else-if="activeTab === 'references'" class="panel references">
      <div class="toolbar"><div><h3>独立参考图库</h3><p>最多向 FLUX 提交 8 张参考图。</p></div><button class="primary" @click="uploadInput?.click()">上传图片</button><input ref="uploadInput" type="file" accept="image/*" multiple hidden @change="handleUpload"></div>
      <div class="group-editor">
        <select v-model="editingGroupId" @change="startGroup(editingGroup || undefined)"><option value="">新建参考组</option><option v-for="group in referenceGroups" :key="group.id" :value="group.id">{{ group.name }}</option></select>
        <input v-model="groupName" placeholder="参考组名称">
        <input v-model="groupDescription" placeholder="用途，例如：保持角色面部和发型一致">
        <button class="primary" @click="saveGroup">保存参考组</button>
        <button v-if="editingGroup" class="danger" @click="removeGroup(editingGroup.id); startGroup()">删除组</button>
      </div>
      <div class="image-grid">
        <article v-for="image in referenceImages" :key="image.id" :class="{ selected: editingGroup?.imageIds.includes(image.id) }" @click="toggleGroupImage(image.id)">
          <img :src="image.dataUrl" :alt="image.name"><span>{{ image.name }}</span><button @click.stop="removeImage(image.id)">×</button>
        </article>
        <div v-if="!referenceImages.length" class="empty">尚未上传 FLUX 参考图</div>
      </div>
      <div class="group-list"><label v-for="group in referenceGroups" :key="group.id"><input v-model="selectedGroupIds" type="checkbox" :value="group.id"><span><strong>{{ group.name }}</strong><small>{{ group.imageIds.length }} 张 · {{ group.description || '无说明' }}</small></span></label></div>
    </section>

    <section v-else class="panel history">
      <article v-for="item in historyItems" :key="item.id"><button class="history-main" @click="openHistory(item.id)"><strong>{{ item.params.model }}</strong><span>{{ new Date(item.timestamp).toLocaleString() }}</span><small>{{ item.params.width }}×{{ item.params.height }} · {{ item.params.prompt }}</small></button><button class="danger" @click="deleteHistoryItem(item.id)">删除</button></article>
      <div v-if="!historyItems.length" class="empty">暂无 FLUX 生成历史</div>
    </section>
    </div>
  </div>
</template>

<style scoped src="../app_ImageAccess.css"></style>
<style scoped>
.ia-page>.flux-page{height:auto;flex:1}
.flux-page{flex:1;overflow-y:auto;height:100%;padding:20px;box-sizing:border-box;color:var(--text-primary,#202124)}.hero{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:22px;border-radius:20px;background:linear-gradient(135deg,#111,#26352e);color:#fff}.hero h2{margin:5px 0;font-size:24px}.hero p,.toolbar p{margin:0;opacity:.72;font-size:12px}.brand{font-size:10px;letter-spacing:2px;color:#b9f8d0}.model-badge{padding:10px 14px;border:1px solid rgba(255,255,255,.25);border-radius:12px;font-weight:800}nav{display:flex;gap:5px;margin-bottom:14px;padding:5px;border-radius:13px;background:var(--sys-bg-secondary,#eef0f2)}nav button{flex:1;padding:10px;border:0;border-radius:9px;background:transparent;color:inherit}nav .active{background:var(--sys-bg-primary,#fff);box-shadow:0 2px 8px rgba(0,0,0,.08);font-weight:700}.workspace{display:grid;grid-template-columns:minmax(320px,1fr) minmax(300px,1fr);gap:14px}.panel{padding:18px;border:1px solid var(--border-color,#e2e4e8);border-radius:18px;background:var(--sys-bg-primary,#fff)}label{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;font-size:12px;font-weight:650}input,select,textarea,button{box-sizing:border-box;font:inherit}input,select,textarea{width:100%;padding:10px 11px;border:1px solid var(--border-color,#dfe2e6);border-radius:10px;background:var(--sys-bg-secondary,#f6f7f8);color:inherit}.inline{display:flex;gap:6px}.inline button{border:0;border-radius:9px;padding:0 12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}.switch{flex-direction:row;align-items:center}.switch input{width:auto}.actions{display:flex;justify-content:flex-end;gap:8px}.primary,.stop,.danger{border:0;border-radius:10px;padding:10px 14px}.primary{background:#176b42;color:#fff;font-weight:700}.primary:disabled{opacity:.5}.stop,.danger{background:#f5e8e8;color:#9d3030}.preview{display:grid;min-height:520px;place-items:center;background:#101411}.preview img{max-width:100%;max-height:70vh;border-radius:12px}.empty{grid-column:1/-1;padding:40px;text-align:center;color:var(--text-secondary,#888)}.hint{font-size:12px;color:var(--text-secondary,#777)}.proxy-hint{margin-top:4px;line-height:1.4;font-weight:normal}.proxy-hint strong{color:var(--text-primary,#333)}.proxy-hint code{background:var(--border-color,#e2e4e8);padding:2px 4px;border-radius:4px;font-family:monospace;font-size:11px}.error{color:#c0392b;font-size:12px}.toolbar{display:flex;justify-content:space-between;align-items:center}.toolbar h3{margin:0 0 4px}.group-editor{display:grid;grid-template-columns:1fr 1fr 2fr auto auto;gap:8px;margin:16px 0}.image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px}.image-grid article{position:relative;padding:7px;border:2px solid transparent;border-radius:12px;background:var(--sys-bg-secondary,#f5f6f7);cursor:pointer}.image-grid article.selected{border-color:#26965f}.image-grid img{width:100%;height:100px;object-fit:cover;border-radius:8px}.image-grid span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.image-grid button{position:absolute;right:3px;top:3px;border:0;border-radius:50%;background:#fff;color:#a22}.group-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:16px}.group-list label{flex-direction:row;padding:10px;border-radius:10px;background:var(--sys-bg-secondary,#f5f6f7)}.group-list input{width:auto}.group-list span{display:flex;flex-direction:column}.group-list small{color:var(--text-secondary,#777)}.history article{display:flex;gap:8px;margin-bottom:8px}.history-main{display:flex;flex:1;flex-direction:column;align-items:flex-start;padding:11px;border:0;border-radius:10px;background:var(--sys-bg-secondary,#f5f6f7);color:inherit;text-align:left}.history-main small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary,#777)}@media(max-width:760px){.workspace{grid-template-columns:1fr}.preview{min-height:340px}.group-editor{grid-template-columns:1fr}.hero{align-items:flex-start}.model-badge{font-size:10px}.grid{grid-template-columns:1fr}}
</style>
