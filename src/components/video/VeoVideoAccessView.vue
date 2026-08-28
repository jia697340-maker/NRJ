/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { globalSettings } from '../../store/global'
import {
  VEO_DEFAULT_BASE_URL,
  VEO_MODELS,
  downloadVeoVideo,
  estimateVeoCost,
  getVeoOperation,
  isLiteVeoModel,
  submitVeoGeneration,
  supportsVeoExtension,
  supportsVeoReferences,
  validateVeoInput,
  type VeoAspectRatio,
  type VeoDuration,
  type VeoGenerationInput,
  type VeoMode,
  type VeoModel,
  type VeoResolution
} from '../../services/veoVideo'
import { useVeoVideoHistory, type VeoVideoTask, type VeoVideoTaskMeta } from '../../composables/useVeoVideoHistory'

defineEmits<{
  (event: 'back'): void
}>()

const readStorage = (key: string, fallback: string) => localStorage.getItem(key) || fallback
const savedModel = readStorage('app_veo_video_model', 'veo-3.1-lite-generate-preview') as VeoModel
const savedDuration = Number(readStorage('app_veo_video_duration', '4')) as VeoDuration

const config = reactive({
  apiKey: readStorage('app_veo_video_api_key', ''),
  baseUrl: readStorage('app_veo_video_base_url', VEO_DEFAULT_BASE_URL),
  model: VEO_MODELS.some(item => item.value === savedModel) ? savedModel : 'veo-3.1-lite-generate-preview' as VeoModel,
  aspectRatio: readStorage('app_veo_video_aspect_ratio', '16:9') as VeoAspectRatio,
  resolution: readStorage('app_veo_video_resolution', '720p') as VeoResolution,
  durationSeconds: ([4, 6, 8].includes(savedDuration) ? savedDuration : 4) as VeoDuration,
  seed: readStorage('app_veo_video_seed', '')
})
const prompt = ref(readStorage('app_veo_video_prompt', ''))
const activeTab = ref<'create' | 'works'>('create')
const mode = ref<VeoMode>('text')
const showSettings = ref(!config.apiKey)
const showApiKey = ref(false)
const isSubmitting = ref(false)
const pageMessage = ref('')
const pageError = ref('')
const selectedTaskId = ref('')
const pendingDelete = ref<VeoVideoTaskMeta | null>(null)
const firstFrame = ref<File | null>(null)
const lastFrame = ref<File | null>(null)
const referenceImages = ref<File[]>([])
const extensionTaskId = ref('')
const firstFrameUrl = ref('')
const lastFrameUrl = ref('')
const referenceUrls = ref<string[]>([])
const videoUrls = ref<Record<string, string>>({})
const volatileVideos = new Map<string, Blob>()
const pollingControllers = new Map<string, AbortController>()

const { tasks, loadVeoTasks, saveVeoTask, patchVeoTask, getVeoTask, removeVeoTask, getVeoVideoUrl } = useVeoVideoHistory()

watch(config, value => {
  localStorage.setItem('app_veo_video_api_key', value.apiKey)
  localStorage.setItem('app_veo_video_base_url', value.baseUrl)
  localStorage.setItem('app_veo_video_model', value.model)
  localStorage.setItem('app_veo_video_aspect_ratio', value.aspectRatio)
  localStorage.setItem('app_veo_video_resolution', value.resolution)
  localStorage.setItem('app_veo_video_duration', String(value.durationSeconds))
  localStorage.setItem('app_veo_video_seed', value.seed)
}, { deep: true })
watch(prompt, value => localStorage.setItem('app_veo_video_prompt', value))

const modelInfo = computed(() => VEO_MODELS.find(item => item.value === config.model)!)
const availableResolutions = computed<VeoResolution[]>(() => isLiteVeoModel(config.model) ? ['720p', '1080p'] : ['720p', '1080p', '4k'])
const estimatedCost = computed(() => estimateVeoCost(config.model, config.resolution, config.durationSeconds))
const estimatedCostText = computed(() => estimatedCost.value === null ? '当前组合不可用' : `预计 $${estimatedCost.value.toFixed(2)}`)
const activeTasks = computed(() => tasks.value.filter(task => ['submitting', 'generating', 'downloading'].includes(task.status)))
const eligibleExtensionTasks = computed(() => tasks.value.filter(task =>
  task.status === 'completed' && (task.hasVideo || Boolean(videoUrls.value[task.id])) && task.params.resolution === '720p' && Date.now() - task.createdAt < 2 * 86400000
))
const selectedTask = computed(() => tasks.value.find(task => task.id === selectedTaskId.value) || tasks.value[0] || null)

const modeOptions: Array<{ value: VeoMode; label: string; description: string }> = [
  { value: 'text', label: '文字', description: '文字生成视频' },
  { value: 'image', label: '图生', description: '从一张图片开始' },
  { value: 'interpolation', label: '首尾帧', description: '控制开始与结束画面' },
  { value: 'references', label: '参考图', description: '最多三张形象或风格参考' },
  { value: 'extension', label: '续写', description: '延长两天内生成的 720p 视频' }
]

const isModeDisabled = (value: VeoMode) => {
  if (value === 'references') return !supportsVeoReferences(config.model)
  if (value === 'extension') return !supportsVeoExtension(config.model) || eligibleExtensionTasks.value.length === 0
  return false
}

const normalizeParameters = () => {
  pageMessage.value = ''
  if (!availableResolutions.value.includes(config.resolution)) {
    config.resolution = '1080p'
    pageMessage.value = 'Lite 不支持 4K，已改为 1080p。'
  }
  if (config.resolution !== '720p' && config.durationSeconds !== 8) {
    config.durationSeconds = 8
    pageMessage.value = '1080p 与 4K 仅支持 8 秒，已同步时长。'
  }
  if (mode.value === 'references' && !supportsVeoReferences(config.model)) {
    mode.value = 'text'
    pageMessage.value = 'Lite 不支持参考图，已返回文字生成。'
  }
  if (mode.value === 'extension' && !supportsVeoExtension(config.model)) {
    mode.value = 'text'
    pageMessage.value = 'Lite 不支持视频续写，已返回文字生成。'
  }
  if ((mode.value === 'references' || mode.value === 'extension') && config.durationSeconds !== 8) config.durationSeconds = 8
  if (mode.value === 'extension' && config.resolution !== '720p') config.resolution = '720p'
}
watch(() => [config.model, config.resolution, config.durationSeconds], normalizeParameters)

const chooseMode = (value: VeoMode) => {
  if (isModeDisabled(value)) {
    pageMessage.value = value === 'extension' && !eligibleExtensionTasks.value.length
      ? '完成一个 720p 视频后即可使用续写。'
      : `${modelInfo.value.label} 暂不支持这项能力。`
    return
  }
  mode.value = value
  normalizeParameters()
}

const replacePreviewUrl = (target: typeof firstFrameUrl, file: File | null) => {
  if (target.value) URL.revokeObjectURL(target.value)
  target.value = file ? URL.createObjectURL(file) : ''
}

const validateImageFile = (file?: File) => {
  if (!file) return null
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件')
  if (file.size > 20 * 1024 * 1024) throw new Error('单张图片不能超过 20MB')
  return file
}

const selectFrame = (kind: 'first' | 'last', event: Event) => {
  pageError.value = ''
  const input = event.target as HTMLInputElement
  try {
    const file = validateImageFile(input.files?.[0])
    if (kind === 'first') { firstFrame.value = file; replacePreviewUrl(firstFrameUrl, file) }
    else { lastFrame.value = file; replacePreviewUrl(lastFrameUrl, file) }
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : '图片读取失败'
  }
  input.value = ''
}

const selectReferences = (event: Event) => {
  pageError.value = ''
  const input = event.target as HTMLInputElement
  try {
    const incoming = Array.from(input.files || []).map(file => validateImageFile(file)!).filter(Boolean)
    if (referenceImages.value.length + incoming.length > 3) throw new Error('参考图最多三张')
    referenceImages.value.push(...incoming)
    referenceUrls.value.push(...incoming.map(file => URL.createObjectURL(file)))
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : '参考图读取失败'
  }
  input.value = ''
}

const removeReference = (index: number) => {
  URL.revokeObjectURL(referenceUrls.value[index])
  referenceUrls.value.splice(index, 1)
  referenceImages.value.splice(index, 1)
}

const clearFrame = (kind: 'first' | 'last') => {
  if (kind === 'first') { firstFrame.value = null; replacePreviewUrl(firstFrameUrl, null) }
  else { lastFrame.value = null; replacePreviewUrl(lastFrameUrl, null) }
}

const taskStatusLabel = (status: VeoVideoTaskMeta['status']) => ({
  submitting: '正在提交', generating: '生成中', paused: '已暂停查询', downloading: '正在保存', completed: '已完成', failed: '生成失败'
}[status])

const modeLabel = (value: VeoMode) => modeOptions.find(item => item.value === value)?.label || value
const taskModelLabel = (model: VeoModel) => VEO_MODELS.find(item => item.value === model)?.shortLabel || model
const formatTime = (value: number) => new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(value)

const refreshVideoUrl = async (id: string) => {
  const old = videoUrls.value[id]
  if (old) URL.revokeObjectURL(old)
  const volatile = volatileVideos.get(id)
  const url = volatile ? URL.createObjectURL(volatile) : await getVeoVideoUrl(id)
  if (url) videoUrls.value = { ...videoUrls.value, [id]: url }
}

const pollTask = async (id: string) => {
  if (pollingControllers.has(id)) return
  const controller = new AbortController()
  pollingControllers.set(id, controller)
  try {
    let task = await getVeoTask(id)
    if (!task?.operationName) throw new Error('任务提交中断，缺少可恢复的任务编号')
    const operationName = task.operationName
    if (!config.apiKey.trim()) {
      await patchVeoTask(id, { status: 'paused', error: '填写原 Gemini Auth Key 后可继续查询' })
      return
    }
    if (task.status === 'paused' || task.status === 'failed') await patchVeoTask(id, { status: 'generating', error: '' })
    while (!controller.signal.aborted) {
      const result = await getVeoOperation({ apiKey: config.apiKey, baseUrl: task.baseUrl }, operationName, controller.signal)
      if (result.done) {
        if (!result.video) throw new Error('任务已结束，但接口没有返回视频文件')
        await patchVeoTask(id, { status: 'downloading', remoteVideo: result.video, error: '' })
        const videoBlob = await downloadVeoVideo({ apiKey: config.apiKey, baseUrl: task.baseUrl }, result.video, controller.signal)
        task = (await getVeoTask(id))!
        try {
          await saveVeoTask({ ...task, status: 'completed', remoteVideo: result.video, videoBlob, error: '', updatedAt: Date.now() })
        } catch {
          volatileVideos.set(id, videoBlob)
          await saveVeoTask({ ...task, status: 'completed', remoteVideo: result.video, error: '本机存储空间不足，请立即下载视频', updatedAt: Date.now() })
        }
        await refreshVideoUrl(id)
        selectedTaskId.value = id
        pageMessage.value = '视频已生成并保存到作品。'
        return
      }
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, 10000)
        controller.signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
      })
      task = (await getVeoTask(id)) || task
    }
  } catch (error: any) {
    if (error?.name !== 'AbortError') {
      await patchVeoTask(id, { status: 'failed', error: error?.message || 'Veo 视频生成失败' }).catch(() => undefined)
      pageError.value = error?.message || 'Veo 视频生成失败'
    }
  } finally {
    pollingControllers.delete(id)
  }
}

const buildInput = async (): Promise<VeoGenerationInput> => {
  if (!config.apiKey.trim()) throw new Error('请先填写 Gemini Auth Key')
  const seed = config.seed.trim() === '' ? undefined : Number(config.seed)
  if (seed !== undefined && (!Number.isInteger(seed) || seed < 0)) throw new Error('Seed 必须是大于或等于 0 的整数')
  let extensionVideo: Blob | undefined
  if (mode.value === 'extension') {
    const source = await getVeoTask(extensionTaskId.value)
    extensionVideo = source?.videoBlob || volatileVideos.get(extensionTaskId.value)
    if (!extensionVideo) throw new Error('请选择本机仍有文件的可续写视频')
  }
  const input: VeoGenerationInput = {
    prompt: prompt.value,
    model: config.model,
    mode: mode.value,
    aspectRatio: config.aspectRatio,
    resolution: config.resolution,
    durationSeconds: config.durationSeconds,
    seed,
    firstFrame: firstFrame.value || undefined,
    lastFrame: lastFrame.value || undefined,
    referenceImages: referenceImages.value,
    extensionVideo
  }
  validateVeoInput(input)
  return input
}

const generateVideo = async () => {
  if (isSubmitting.value) return
  pageError.value = ''
  pageMessage.value = ''
  isSubmitting.value = true
  const id = `veo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  try {
    const input = await buildInput()
    const inputNames = mode.value === 'references'
      ? referenceImages.value.map(file => file.name)
      : mode.value === 'interpolation'
        ? [firstFrame.value?.name, lastFrame.value?.name].filter(Boolean) as string[]
        : mode.value === 'image' ? [firstFrame.value?.name || ''] : []
    const task: VeoVideoTask = {
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'submitting',
      baseUrl: config.baseUrl,
      params: {
        prompt: input.prompt.trim(), model: input.model, mode: input.mode, aspectRatio: input.aspectRatio,
        resolution: input.resolution, durationSeconds: input.durationSeconds, seed: input.seed, inputNames
      }
    }
    await saveVeoTask(task)
    selectedTaskId.value = id
    const operationName = await submitVeoGeneration({ apiKey: config.apiKey, baseUrl: config.baseUrl }, input)
    await patchVeoTask(id, { status: 'generating', operationName, error: '' })
    pageMessage.value = '任务已提交，可以离开页面，回来后会继续查询。'
    void pollTask(id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Veo 任务提交失败'
    pageError.value = message
    if (!config.apiKey.trim()) showSettings.value = true
    const existing = await getVeoTask(id)
    if (existing) await patchVeoTask(id, { status: 'failed', error: message })
  } finally {
    isSubmitting.value = false
  }
}

const pauseTask = async (task: VeoVideoTaskMeta) => {
  pollingControllers.get(task.id)?.abort()
  await patchVeoTask(task.id, { status: 'paused', error: '' })
}

const resumeTask = async (task: VeoVideoTaskMeta) => {
  pageError.value = ''
  if (!config.apiKey.trim()) { showSettings.value = true; pageError.value = '请先填写原 Gemini Auth Key'; return }
  await patchVeoTask(task.id, { status: 'generating', error: '' })
  void pollTask(task.id)
}

const downloadTask = async (task: VeoVideoTaskMeta) => {
  const blob = volatileVideos.get(task.id) || (await getVeoTask(task.id))?.videoBlob
  if (!blob) { pageError.value = '本机没有可下载的视频文件'; return }
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = `veo_${task.params.model.includes('lite') ? 'lite' : task.params.model.includes('fast') ? 'fast' : 'standard'}_${task.createdAt}.mp4`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const useAsExtension = (task: VeoVideoTaskMeta) => {
  if (!supportsVeoExtension(config.model)) config.model = 'veo-3.1-fast-generate-preview'
  extensionTaskId.value = task.id
  mode.value = 'extension'
  config.resolution = '720p'
  config.durationSeconds = 8
  prompt.value = ''
  activeTab.value = 'create'
  pageMessage.value = '已选择这个视频作为续写起点，请描述接下来的画面。'
}

const confirmDelete = async () => {
  const task = pendingDelete.value
  if (!task) return
  pollingControllers.get(task.id)?.abort()
  const url = videoUrls.value[task.id]
  if (url) URL.revokeObjectURL(url)
  volatileVideos.delete(task.id)
  await removeVeoTask(task.id)
  const next = { ...videoUrls.value }; delete next[task.id]; videoUrls.value = next
  if (selectedTaskId.value === task.id) selectedTaskId.value = ''
  if (extensionTaskId.value === task.id) extensionTaskId.value = ''
  pendingDelete.value = null
}

onMounted(async () => {
  await loadVeoTasks()
  for (const task of tasks.value.filter(item => item.status === 'submitting' && !item.operationName)) {
    await patchVeoTask(task.id, { status: 'failed', error: '页面在任务编号返回前中断，请重新提交' })
  }
  await loadVeoTasks()
  for (const task of tasks.value) {
    if (task.status === 'completed' && task.hasVideo) await refreshVideoUrl(task.id)
  }
  for (const task of tasks.value.filter(item => ['generating', 'downloading'].includes(item.status))) void pollTask(task.id)
})

onUnmounted(() => {
  pollingControllers.forEach(controller => controller.abort())
  pollingControllers.clear()
  if (firstFrameUrl.value) URL.revokeObjectURL(firstFrameUrl.value)
  if (lastFrameUrl.value) URL.revokeObjectURL(lastFrameUrl.value)
  referenceUrls.value.forEach(url => URL.revokeObjectURL(url))
  Object.values(videoUrls.value).forEach(url => URL.revokeObjectURL(url))
})
</script>

<template>
  <div class="video-hall" :class="{ dark: globalSettings.darkMode }">
    <header class="hall-header">
      <button class="icon-button back-button" type="button" aria-label="返回列表" @click="$emit('back')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
      </button>
      <div class="header-copy"><h1>Veo 3.1</h1><p>Google 原生视频生成</p></div>
      <div class="header-spacer"></div>
    </header>

    <nav class="hall-tabs" aria-label="视频大厅页面">
      <button type="button" :class="{ active: activeTab === 'create' }" @click="activeTab = 'create'">创作</button>
      <button type="button" :class="{ active: activeTab === 'works' }" @click="activeTab = 'works'">作品<span v-if="tasks.length">{{ tasks.length }}</span></button>
    </nav>

    <main class="hall-scroll">
      <Transition name="message"><p v-if="pageMessage" class="page-message" role="status">{{ pageMessage }}</p></Transition>
      <Transition name="message"><p v-if="pageError" class="page-error" role="alert">{{ pageError }}</p></Transition>

      <template v-if="activeTab === 'create'">
        <section class="settings-panel" :class="{ open: showSettings }">
          <button class="section-toggle" type="button" @click="showSettings = !showSettings">
            <span><small>接入设置</small><strong>{{ config.apiKey ? 'Gemini Auth Key 已填写' : '填写 Gemini Auth Key' }}</strong></span>
            <svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg>
          </button>
          <div v-if="showSettings" class="settings-body">
            <label class="field"><span>Auth Key</span><div class="input-action"><input v-model="config.apiKey" :type="showApiKey ? 'text' : 'password'" autocomplete="off" placeholder="Google AI Studio Auth Key"><button type="button" @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button></div><small>仅保存在当前浏览器，不读取聊天或图像接入配置。</small></label>
            <label class="field"><span>Base URL</span><div class="input-action"><input v-model="config.baseUrl" inputmode="url"><button type="button" @click="config.baseUrl = VEO_DEFAULT_BASE_URL">默认</button></div></label>
          </div>
        </section>

        <section class="create-section">
          <div class="section-heading"><div><small>生成引擎</small><h2>Veo 3.1</h2></div><span class="cost-pill">{{ estimatedCostText }}</span></div>
          <div class="model-grid">
            <button v-for="item in VEO_MODELS" :key="item.value" type="button" :class="{ active: config.model === item.value }" @click="config.model = item.value">
              <strong>{{ item.shortLabel }}</strong><small>{{ item.description }}</small>
            </button>
          </div>
        </section>

        <section class="create-section">
          <div class="section-heading"><div><small>生成方式</small><h2>{{ modeOptions.find(item => item.value === mode)?.description }}</h2></div></div>
          <div class="mode-tabs">
            <button v-for="item in modeOptions" :key="item.value" type="button" :class="{ active: mode === item.value, disabled: isModeDisabled(item.value) }" :aria-disabled="isModeDisabled(item.value)" @click="chooseMode(item.value)">{{ item.label }}</button>
          </div>

          <div v-if="mode === 'image' || mode === 'interpolation'" class="upload-grid" :class="{ double: mode === 'interpolation' }">
            <div class="upload-slot" :class="{ filled: firstFrameUrl }">
              <img v-if="firstFrameUrl" :src="firstFrameUrl" alt="起始图片预览">
              <label v-else><input type="file" accept="image/*" @change="selectFrame('first', $event)"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>{{ mode === 'interpolation' ? '添加首帧' : '添加起始图片' }}</span><small>不超过 20MB</small></label>
              <button v-if="firstFrameUrl" type="button" aria-label="移除起始图片" @click="clearFrame('first')">×</button>
            </div>
            <div v-if="mode === 'interpolation'" class="upload-slot" :class="{ filled: lastFrameUrl }">
              <img v-if="lastFrameUrl" :src="lastFrameUrl" alt="尾帧图片预览">
              <label v-else><input type="file" accept="image/*" @change="selectFrame('last', $event)"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>添加尾帧</span><small>不超过 20MB</small></label>
              <button v-if="lastFrameUrl" type="button" aria-label="移除尾帧图片" @click="clearFrame('last')">×</button>
            </div>
          </div>

          <div v-if="mode === 'references'" class="reference-upload">
            <div class="reference-list">
              <div v-for="(url, index) in referenceUrls" :key="url" class="reference-thumb"><img :src="url" :alt="`参考图 ${index + 1}`"><button type="button" :aria-label="`移除参考图 ${index + 1}`" @click="removeReference(index)">×</button></div>
              <label v-if="referenceImages.length < 3" class="reference-add"><input type="file" accept="image/*" multiple @change="selectReferences"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>添加参考图</span></label>
            </div>
            <p>可添加 1–3 张角色、物体或风格参考图；参考图模式固定生成 8 秒。</p>
          </div>

          <label v-if="mode === 'extension'" class="field extension-picker"><span>续写来源</span><select v-model="extensionTaskId"><option value="">选择两天内生成的 720p 视频</option><option v-for="task in eligibleExtensionTasks" :key="task.id" :value="task.id">{{ formatTime(task.createdAt) }} · {{ task.params.prompt.slice(0, 24) }}</option></select><small>续写会生成包含原片的新视频，固定为 720p、8 秒生成任务。</small></label>
        </section>

        <section class="create-section prompt-section">
          <div class="section-heading"><div><small>画面与声音</small><h2>描述视频内容</h2></div><span class="counter">{{ prompt.length }} 字</span></div>
          <textarea v-model="prompt" rows="6" placeholder="写清主体、动作、镜头、光线与声音。例如：一只橘猫在雨后的石板路上缓慢行走，低机位跟拍，路面倒映暖色灯光，远处有轻柔雨声。"></textarea>
          <p>Veo 会同时生成画面与音频。英文提示词经过完整评估，中文也可使用但效果可能波动。</p>
        </section>

        <section class="create-section parameters-section">
          <div class="section-heading"><div><small>输出参数</small><h2>尺寸与时长</h2></div></div>
          <div class="parameter-grid">
            <label class="field"><span>画面比例</span><select v-model="config.aspectRatio"><option value="16:9">16:9 横屏</option><option value="9:16">9:16 竖屏</option></select></label>
            <label class="field"><span>分辨率</span><select v-model="config.resolution"><option v-for="item in availableResolutions" :key="item" :value="item">{{ item }}</option></select></label>
            <label class="field"><span>时长</span><select v-model.number="config.durationSeconds" :disabled="mode === 'references' || mode === 'extension' || config.resolution !== '720p'"><option :value="4">4 秒</option><option :value="6">6 秒</option><option :value="8">8 秒</option></select></label>
            <label class="field"><span>Seed（可选）</span><input v-model="config.seed" inputmode="numeric" placeholder="随机"></label>
          </div>
          <div class="generation-note"><span>24 FPS</span><span>原生音频</span><span>单次 1 个</span><span>结果自动本地保存</span></div>
        </section>

        <button class="generate-button" type="button" :disabled="isSubmitting" @click="generateVideo">
          <span v-if="isSubmitting" class="spinner"></span><span>{{ isSubmitting ? '正在提交任务' : `生成视频 · ${estimatedCostText}` }}</span>
        </button>

        <section v-if="activeTasks.length" class="running-section">
          <div class="section-heading"><div><small>进行中的任务</small><h2>离开页面可在回来后继续查询</h2></div></div>
          <article v-for="task in activeTasks" :key="task.id" class="running-card">
            <div class="running-indicator"><span></span></div>
            <div class="task-copy"><strong>{{ taskStatusLabel(task.status) }}</strong><p>{{ task.params.prompt }}</p><small>{{ task.params.resolution }} · {{ task.params.durationSeconds }} 秒 · {{ taskModelLabel(task.params.model) }}</small></div>
            <button type="button" title="只停止本机查询，云端生成仍会继续" @click="pauseTask(task)">暂停查询</button>
          </article>
          <p class="running-note">暂停只会停止本机查询，不会取消 Google 云端已经提交的生成。</p>
        </section>
      </template>

      <template v-else>
        <section v-if="!tasks.length" class="empty-works">
          <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z"/></svg>
          <h2>还没有视频作品</h2><p>完成的生成任务会保存在本机，进行中的任务也可以在这里恢复。</p><button type="button" @click="activeTab = 'create'">开始创作</button>
        </section>
        <section v-else class="works-list">
          <article v-for="task in tasks" :key="task.id" class="work-card" :class="{ selected: selectedTask?.id === task.id }" @click="selectedTaskId = task.id">
            <div class="work-media" :class="task.params.aspectRatio === '9:16' ? 'portrait' : 'landscape'">
              <video v-if="videoUrls[task.id]" :src="videoUrls[task.id]" controls playsinline preload="metadata"></video>
              <div v-else class="work-placeholder"><span v-if="['generating', 'downloading', 'submitting'].includes(task.status)" class="spinner dark-spinner"></span><svg v-else viewBox="0 0 24 24"><path d="M12 8v5m0 3h.01"/><circle cx="12" cy="12" r="9"/></svg><strong>{{ taskStatusLabel(task.status) }}</strong></div>
              <span class="status-badge" :class="task.status">{{ taskStatusLabel(task.status) }}</span>
            </div>
            <div class="work-info">
              <div><strong>{{ task.params.prompt || '无描述视频' }}</strong><p>{{ formatTime(task.createdAt) }} · {{ modeLabel(task.params.mode) }} · {{ task.params.resolution }} · {{ task.params.durationSeconds }} 秒</p></div>
              <p v-if="task.error" class="task-error">{{ task.error }}</p>
              <div class="work-actions">
                <button v-if="task.status === 'completed' && (task.hasVideo || videoUrls[task.id])" type="button" @click.stop="downloadTask(task)">下载</button>
                <button v-if="task.status === 'completed' && (task.hasVideo || videoUrls[task.id]) && task.params.resolution === '720p' && Date.now() - task.createdAt < 2 * 86400000" type="button" @click.stop="useAsExtension(task)">续写</button>
                <button v-if="task.status === 'paused' || (task.status === 'failed' && task.operationName)" type="button" @click.stop="resumeTask(task)">继续查询</button>
                <button v-if="['generating', 'downloading'].includes(task.status)" type="button" @click.stop="pauseTask(task)">暂停</button>
                <button class="danger" type="button" @click.stop="pendingDelete = task">删除</button>
              </div>
            </div>
          </article>
        </section>
      </template>
    </main>

    <Transition name="sheet">
      <div v-if="pendingDelete" class="sheet-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-video-title" @click.self="pendingDelete = null">
        <section class="confirm-sheet"><div class="sheet-mark"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg></div><h2 id="delete-video-title">删除这条视频记录？</h2><p>本机保存的视频文件和任务信息都会移除。云端已经提交的生成任务无法通过删除记录取消。</p><div><button type="button" @click="pendingDelete = null">保留</button><button class="danger" type="button" @click="confirmDelete">删除</button></div></section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.video-hall{--vh-bg:#f7f7f5;--vh-surface:#fff;--vh-soft:#f0f0ed;--vh-text:#1d1d1f;--vh-sub:#777773;--vh-muted:#a0a09a;--vh-line:rgba(20,20,20,.08);--vh-accent:#171717;position:absolute;inset:0;z-index:1000;display:flex;flex-direction:column;overflow:hidden;background:var(--vh-bg);color:var(--vh-text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;-webkit-tap-highlight-color:transparent}.video-hall.dark{--vh-bg:#19191b;--vh-surface:#242426;--vh-soft:#2d2d30;--vh-text:#f5f5f2;--vh-sub:#aaa9a3;--vh-muted:#787875;--vh-line:rgba(255,255,255,.09);--vh-accent:#f1f1ed}.hall-header{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;min-height:58px;padding:12px 18px 8px;box-sizing:border-box}.header-copy{min-width:0;text-align:center;flex:1}.header-copy h1{margin:0;font-size:20px;line-height:1.15;font-weight:680;letter-spacing:-.5px}.header-copy p{overflow:hidden;margin:4px 0 0;color:var(--vh-sub);font-size:11px;line-height:1.2;white-space:nowrap;text-overflow:ellipsis}.header-spacer{width:34px;flex:0 0 auto}.icon-button{display:grid;flex:0 0 auto;width:34px;height:34px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--vh-text);place-items:center;cursor:pointer}.icon-button:active{background:var(--vh-soft)}.icon-button svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8}.hall-tabs{display:flex;flex:0 0 auto;gap:5px;margin:4px 18px 10px;padding:3px;border-radius:12px;background:var(--vh-soft)}.hall-tabs button{position:relative;display:flex;min-width:0;flex:1;align-items:center;justify-content:center;gap:5px;padding:8px 10px;border:0;border-radius:9px;background:transparent;color:var(--vh-sub);font-size:13px;font-weight:600;cursor:pointer}.hall-tabs button.active{background:var(--vh-surface);color:var(--vh-text);box-shadow:0 2px 9px rgba(0,0,0,.05)}.hall-tabs span{min-width:16px;padding:1px 4px;border-radius:10px;background:var(--vh-soft);font-size:9px}.hall-scroll{flex:1;min-height:0;overflow-y:auto;padding:0 18px calc(28px + env(safe-area-inset-bottom));box-sizing:border-box;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.page-message,.page-error{position:relative;margin:4px 0 10px;padding:9px 11px;border-radius:11px;font-size:11px;line-height:1.45}.page-message{background:#edf6ef;color:#397148}.page-error{background:#fff0f0;color:#b64242}.dark .page-message{background:#223429;color:#91c89f}.dark .page-error{background:#3b2527;color:#efaaaa}.settings-panel,.create-section,.running-section{margin-bottom:12px;border:1px solid var(--vh-line);border-radius:17px;background:var(--vh-surface)}.section-toggle{display:flex;width:100%;align-items:center;justify-content:space-between;padding:13px 14px;border:0;border-radius:17px;background:transparent;color:inherit;text-align:left;cursor:pointer}.section-toggle span{display:flex;min-width:0;flex-direction:column;gap:3px}.section-toggle small,.section-heading small{color:var(--vh-muted);font-size:9px;font-weight:650;letter-spacing:.8px}.section-toggle strong{overflow:hidden;font-size:12px;font-weight:620;white-space:nowrap;text-overflow:ellipsis}.section-toggle svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6;transition:transform .2s}.settings-panel.open .section-toggle svg{transform:rotate(180deg)}.settings-body{display:grid;gap:12px;padding:0 14px 15px;border-top:1px solid var(--vh-line);padding-top:13px}.field{display:flex;min-width:0;flex-direction:column;gap:6px}.field>span{color:var(--vh-sub);font-size:10px;font-weight:600}.field>small{color:var(--vh-muted);font-size:9px;line-height:1.4}.input-action{display:flex;min-width:0;gap:6px}.input-action input{min-width:0;flex:1}.input-action button,.work-actions button,.running-card>button{flex:0 0 auto;padding:0 11px;border:0;border-radius:10px;background:var(--vh-soft);color:var(--vh-text);font-size:10px;font-weight:600;cursor:pointer}.create-section,.running-section{padding:14px}.section-heading{display:flex;min-width:0;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:11px}.section-heading>div{min-width:0}.section-heading h2{overflow:hidden;margin:3px 0 0;font-size:14px;line-height:1.3;font-weight:660;white-space:nowrap;text-overflow:ellipsis}.cost-pill{flex:0 0 auto;padding:5px 8px;border-radius:10px;background:var(--vh-soft);color:var(--vh-sub);font-size:9px;font-weight:650}.model-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.model-grid button{min-width:0;padding:10px 5px;border:1px solid transparent;border-radius:12px;background:var(--vh-soft);color:var(--vh-text);text-align:center;cursor:pointer}.model-grid button.active{border-color:var(--vh-text);background:var(--vh-surface)}.model-grid strong,.model-grid small{display:block;overflow:hidden;text-overflow:ellipsis}.model-grid strong{font-size:11px;white-space:nowrap}.model-grid small{margin-top:4px;color:var(--vh-muted);font-size:8px;line-height:1.25}.mode-tabs{display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.mode-tabs::-webkit-scrollbar{display:none}.mode-tabs button{flex:0 0 auto;padding:7px 11px;border:0;border-radius:100px;background:var(--vh-soft);color:var(--vh-sub);font-size:10px;font-weight:620;cursor:pointer}.mode-tabs button.active{background:var(--vh-accent);color:var(--vh-bg)}.mode-tabs button.disabled{opacity:.36;cursor:not-allowed}.upload-grid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:11px}.upload-grid.double{grid-template-columns:repeat(2,minmax(0,1fr))}.upload-slot{position:relative;display:grid;min-width:0;min-height:126px;overflow:hidden;border:1px dashed var(--vh-line);border-radius:13px;background:var(--vh-soft);place-items:center}.upload-slot.filled{border-style:solid}.upload-slot img{width:100%;height:150px;object-fit:cover}.upload-slot label,.reference-add{display:flex;cursor:pointer;align-items:center;justify-content:center;flex-direction:column;color:var(--vh-sub)}.upload-slot input,.reference-add input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.upload-slot label svg,.reference-add svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.5}.upload-slot label span{margin-top:7px;font-size:10px;font-weight:650}.upload-slot label small{margin-top:3px;color:var(--vh-muted);font-size:8px}.upload-slot>button,.reference-thumb>button{position:absolute;top:6px;right:6px;display:grid;width:23px;height:23px;padding:0;border:0;border-radius:50%;background:rgba(20,20,20,.72);color:#fff;font-size:15px;line-height:1;place-items:center;cursor:pointer}.reference-upload{margin-top:11px}.reference-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.reference-thumb,.reference-add{position:relative;min-width:0;height:105px;overflow:hidden;border-radius:12px;background:var(--vh-soft)}.reference-thumb img{width:100%;height:100%;object-fit:cover}.reference-add{border:1px dashed var(--vh-line)}.reference-add span{margin-top:5px;font-size:9px}.reference-upload>p,.prompt-section>p{margin:8px 1px 0;color:var(--vh-muted);font-size:9px;line-height:1.45}.extension-picker{margin-top:11px}.prompt-section textarea{width:100%;min-height:128px;resize:vertical;padding:12px;border:0;border-radius:13px;box-sizing:border-box;background:var(--vh-soft);color:var(--vh-text);font:inherit;font-size:12px;line-height:1.65;outline:none}.prompt-section textarea:focus,input:focus,select:focus{box-shadow:inset 0 0 0 1px var(--vh-text)}.counter{flex:0 0 auto;color:var(--vh-muted);font-size:9px}input,select{width:100%;min-height:36px;padding:8px 10px;border:0;border-radius:10px;box-sizing:border-box;appearance:none;background:var(--vh-soft);color:var(--vh-text);font:inherit;font-size:11px;outline:none}select{padding-right:24px;background-image:linear-gradient(45deg,transparent 50%,var(--vh-sub) 50%),linear-gradient(135deg,var(--vh-sub) 50%,transparent 50%);background-position:calc(100% - 13px) 15px,calc(100% - 9px) 15px;background-repeat:no-repeat;background-size:4px 4px}.parameter-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 8px}.field select:disabled{opacity:.55}.generation-note{display:flex;flex-wrap:wrap;gap:5px;margin-top:11px}.generation-note span{padding:4px 7px;border-radius:8px;background:var(--vh-soft);color:var(--vh-muted);font-size:8px}.generate-button{display:flex;width:100%;align-items:center;justify-content:center;gap:8px;margin:2px 0 14px;padding:13px 14px;border:0;border-radius:14px;background:var(--vh-accent);color:var(--vh-bg);font-size:12px;font-weight:680;cursor:pointer}.generate-button:disabled{opacity:.45;cursor:not-allowed}.spinner{width:13px;height:13px;border:1.8px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite}.running-card{display:flex;min-width:0;align-items:center;gap:9px;padding:10px 0;border-top:1px solid var(--vh-line)}.running-indicator{display:grid;flex:0 0 auto;width:25px;height:25px;border-radius:50%;background:var(--vh-soft);place-items:center}.running-indicator span{width:7px;height:7px;border-radius:50%;background:#63a878;box-shadow:0 0 0 4px rgba(99,168,120,.15);animation:pulse 1.6s ease-in-out infinite}.task-copy{min-width:0;flex:1}.task-copy strong{font-size:10px}.task-copy p{overflow:hidden;margin:3px 0;color:var(--vh-sub);font-size:9px;white-space:nowrap;text-overflow:ellipsis}.task-copy small{color:var(--vh-muted);font-size:8px}.running-card>button{min-height:28px}.works-list{display:grid;gap:11px}.work-card{min-width:0;overflow:hidden;border:1px solid var(--vh-line);border-radius:17px;background:var(--vh-surface)}.work-media{position:relative;width:100%;overflow:hidden;background:#111}.work-media.landscape{aspect-ratio:16/9}.work-media.portrait{max-height:440px;aspect-ratio:9/16}.work-media video{width:100%;height:100%;object-fit:contain;background:#111}.work-placeholder{display:flex;width:100%;height:100%;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:#aaa}.work-placeholder svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.5}.work-placeholder strong{font-size:10px}.dark-spinner{color:#bbb}.status-badge{position:absolute;top:8px;left:8px;padding:4px 7px;border-radius:8px;background:rgba(20,20,20,.66);color:#fff;font-size:8px;backdrop-filter:blur(6px)}.status-badge.completed{background:rgba(45,112,67,.78)}.status-badge.failed{background:rgba(159,54,54,.78)}.work-info{padding:11px 12px}.work-info>div:first-child{min-width:0}.work-info strong{display:block;overflow:hidden;font-size:11px;line-height:1.4;white-space:nowrap;text-overflow:ellipsis}.work-info p{margin:4px 0 0;color:var(--vh-muted);font-size:8px;line-height:1.4}.work-info .task-error{color:#b84a4a;font-size:9px}.work-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.work-actions button{min-height:28px}.work-actions .danger{margin-left:auto;background:#fff0f0;color:#b74343}.dark .work-actions .danger{background:#3b2527;color:#efaaaa}.empty-works{display:flex;min-height:58vh;align-items:center;justify-content:center;flex-direction:column;text-align:center}.empty-works svg{width:42px;height:42px;fill:none;stroke:var(--vh-muted);stroke-width:1.2}.empty-works h2{margin:14px 0 5px;font-size:15px}.empty-works p{max-width:260px;margin:0;color:var(--vh-sub);font-size:10px;line-height:1.6}.empty-works button{margin-top:14px;padding:9px 15px;border:0;border-radius:11px;background:var(--vh-accent);color:var(--vh-bg);font-size:10px;font-weight:650;cursor:pointer}.sheet-overlay{position:fixed;inset:0;z-index:1200;display:flex;align-items:flex-end;justify-content:center;padding:12px;box-sizing:border-box;background:rgba(0,0,0,.3);backdrop-filter:blur(5px)}.confirm-sheet{width:min(100%,430px);padding:21px 18px calc(18px + env(safe-area-inset-bottom));border-radius:24px;background:var(--vh-surface);box-sizing:border-box;text-align:center}.sheet-mark{display:grid;width:38px;height:38px;margin:0 auto 11px;border-radius:50%;background:#fff0f0;color:#b74343;place-items:center}.dark .sheet-mark{background:#3b2527;color:#efaaaa}.sheet-mark svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.5}.confirm-sheet h2{margin:0;font-size:15px}.confirm-sheet p{margin:8px auto 17px;color:var(--vh-sub);font-size:10px;line-height:1.55}.confirm-sheet>div:last-child{display:grid;grid-template-columns:1fr 1fr;gap:8px}.confirm-sheet button{padding:11px;border:0;border-radius:12px;background:var(--vh-soft);color:var(--vh-text);font-size:11px;font-weight:650;cursor:pointer}.confirm-sheet button.danger{background:#c84b4b;color:#fff}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{50%{opacity:.45;transform:scale(.8)}}.message-enter-active,.message-leave-active{transition:opacity .2s,transform .2s}.message-enter-from,.message-leave-to{opacity:0;transform:translateY(-4px)}.sheet-enter-active,.sheet-leave-active{transition:opacity .22s}.sheet-enter-active .confirm-sheet,.sheet-leave-active .confirm-sheet{transition:transform .25s}.sheet-enter-from,.sheet-leave-to{opacity:0}.sheet-enter-from .confirm-sheet,.sheet-leave-to .confirm-sheet{transform:translateY(25px)}
@media(min-width:700px){.hall-header,.hall-tabs,.hall-scroll{width:min(100%,760px);margin-left:auto;margin-right:auto}.hall-tabs{width:min(calc(100% - 36px),724px)}.hall-scroll{padding-left:18px;padding-right:18px}.works-list{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.work-media.portrait{height:430px}.settings-body{grid-template-columns:1fr 1fr}.settings-body .field:first-child{grid-column:1/-1}}
@media(max-width:360px){.hall-header{padding-left:14px;padding-right:14px}.hall-tabs{margin-left:14px;margin-right:14px}.hall-scroll{padding-left:14px;padding-right:14px}.header-copy h1{font-size:21px}.model-grid small{display:none}.model-grid button{padding:9px 3px}.create-section,.running-section{padding:12px}.mode-tabs button{padding-left:10px;padding-right:10px}.upload-slot{min-height:110px}.upload-slot img{height:128px}.parameter-grid{gap:9px 6px}.input-action button{padding-left:9px;padding-right:9px}.generate-button{font-size:11px}}
.running-note{margin:3px 0 0;color:var(--vh-muted);font-size:8px;line-height:1.4}
</style>
