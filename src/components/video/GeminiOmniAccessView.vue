<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { globalSettings } from '../../store/global'
import {
  GEMINI_OMNI_DEFAULT_BASE_URL,
  createGeminiOmniInteraction,
  downloadGeminiOmniVideo,
  estimateGeminiOmniCost,
  getGeminiOmniInteraction,
  validateGeminiOmniInput,
  type GeminiOmniAspectRatio,
  type GeminiOmniDuration,
  type GeminiOmniInput,
  type GeminiOmniMode,
  type GeminiOmniResolution
} from '../../services/geminiOmniVideo'
import {
  useGeminiOmniHistory,
  type GeminiOmniTask,
  type GeminiOmniTaskMeta
} from '../../composables/useGeminiOmniHistory'

defineEmits<{ (event: 'back'): void }>()

const readStorage = (key: string, fallback: string) => localStorage.getItem(key) || fallback
const savedDuration = Number(readStorage('app_gemini_omni_duration', '6')) as GeminiOmniDuration
const config = reactive({
  apiKey: readStorage('app_gemini_omni_api_key', readStorage('app_veo_video_api_key', '')),
  baseUrl: readStorage('app_gemini_omni_base_url', readStorage('app_veo_video_base_url', GEMINI_OMNI_DEFAULT_BASE_URL)),
  aspectRatio: readStorage('app_gemini_omni_ratio', '16:9') as GeminiOmniAspectRatio,
  resolution: readStorage('app_gemini_omni_resolution', '360p') as GeminiOmniResolution,
  durationSeconds: ([3, 4, 5, 6, 7, 8, 9, 10].includes(savedDuration) ? savedDuration : 6) as GeminiOmniDuration
})

const activeTab = ref<'create' | 'director' | 'works'>('create')
const mode = ref<GeminiOmniMode>('text')
const prompt = ref(readStorage('app_gemini_omni_prompt', ''))
const directorPrompt = ref('')
const directorAction = ref<'edit' | 'extend'>('edit')
const showSettings = ref(!config.apiKey)
const showApiKey = ref(false)
const isSubmitting = ref(false)
const pageMessage = ref('')
const pageError = ref('')
const selectedTaskId = ref('')
const pendingDelete = ref<GeminiOmniTaskMeta | null>(null)
const firstFrame = ref<File | null>(null)
const lastFrame = ref<File | null>(null)
const referenceImages = ref<File[]>([])
const referenceVideos = ref<File[]>([])
const sourceVideo = ref<File | null>(null)
const firstFrameUrl = ref('')
const lastFrameUrl = ref('')
const referenceUrls = ref<string[]>([])
const referenceVideoUrls = ref<string[]>([])
const sourceVideoUrl = ref('')
const videoUrls = ref<Record<string, string>>({})
const volatileVideos = new Map<string, Blob>()
const pollingControllers = new Map<string, AbortController>()

const { tasks, loadGeminiOmniTasks, saveGeminiOmniTask, patchGeminiOmniTask, getGeminiOmniTask, removeGeminiOmniTask, getGeminiOmniVideoUrl } = useGeminiOmniHistory()

watch(config, value => {
  localStorage.setItem('app_gemini_omni_api_key', value.apiKey)
  localStorage.setItem('app_gemini_omni_base_url', value.baseUrl)
  localStorage.setItem('app_gemini_omni_ratio', value.aspectRatio)
  localStorage.setItem('app_gemini_omni_resolution', value.resolution)
  localStorage.setItem('app_gemini_omni_duration', String(value.durationSeconds))
}, { deep: true })
watch(prompt, value => localStorage.setItem('app_gemini_omni_prompt', value))

const modeOptions: Array<{ value: GeminiOmniMode; label: string; description: string }> = [
  { value: 'text', label: '文字', description: '文字生成原生音画' },
  { value: 'image', label: '图生', description: '从一张画面开始' },
  { value: 'interpolation', label: '首尾帧', description: '生成两幅画面间的过渡' },
  { value: 'references', label: '参考', description: '组合人物、物品与风格参考' },
  { value: 'edit', label: '修改', description: '用自然语言修改本机视频' },
  { value: 'extend', label: '延长', description: '从视频结尾继续场景' }
]
const modeInfo = computed(() => modeOptions.find(item => item.value === mode.value)!)
const estimatedCost = computed(() => estimateGeminiOmniCost(config.resolution, config.durationSeconds))
const estimatedCostText = computed(() => `最高预计 $${estimatedCost.value.toFixed(2)}`)
const activeTasks = computed(() => tasks.value.filter(task => ['uploading', 'generating', 'downloading'].includes(task.status)))
const selectedTask = computed(() => tasks.value.find(task => task.id === selectedTaskId.value) || null)
const selectedChildren = computed(() => selectedTask.value ? tasks.value.filter(task => task.parentId === selectedTask.value!.id).sort((a, b) => a.createdAt - b.createdAt) : [])
const selectedParent = computed(() => selectedTask.value?.parentId ? tasks.value.find(task => task.id === selectedTask.value!.parentId) || null : null)

const chooseMode = (value: GeminiOmniMode) => {
  mode.value = value
  pageMessage.value = modeOptions.find(item => item.value === value)?.description || ''
}

const replaceUrl = (target: typeof firstFrameUrl, file: File | null) => {
  if (target.value) URL.revokeObjectURL(target.value)
  target.value = file ? URL.createObjectURL(file) : ''
}

const validateImage = (file?: File) => {
  if (!file) return null
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件')
  if (file.size > 20 * 1024 * 1024) throw new Error('单张图片不能超过 20MB')
  return file
}

const selectFrame = (kind: 'first' | 'last', event: Event) => {
  pageError.value = ''
  const input = event.target as HTMLInputElement
  try {
    const file = validateImage(input.files?.[0])
    if (kind === 'first') { firstFrame.value = file; replaceUrl(firstFrameUrl, file) }
    else { lastFrame.value = file; replaceUrl(lastFrameUrl, file) }
  } catch (error) { pageError.value = error instanceof Error ? error.message : '图片读取失败' }
  input.value = ''
}

const selectReferences = (event: Event) => {
  pageError.value = ''
  const input = event.target as HTMLInputElement
  try {
    const incoming = Array.from(input.files || []).map(file => validateImage(file)!).filter(Boolean)
    if (referenceImages.value.length + incoming.length > 6) throw new Error('参考图最多六张')
    referenceImages.value.push(...incoming)
    referenceUrls.value.push(...incoming.map(file => URL.createObjectURL(file)))
  } catch (error) { pageError.value = error instanceof Error ? error.message : '参考图读取失败' }
  input.value = ''
}

const selectVideoReferences = async (event: Event) => {
  pageError.value = ''
  const input = event.target as HTMLInputElement
  const createdUrls: string[] = []
  try {
    const incoming = Array.from(input.files || [])
    if (referenceVideos.value.length + incoming.length > 3) throw new Error('参考视频最多三段')
    for (const file of incoming) {
      if (!file.type.startsWith('video/')) throw new Error('请选择视频文件')
      const duration = await readVideoDuration(file)
      if (!Number.isFinite(duration) || duration > 3.1) throw new Error('每段参考视频不能超过 3 秒')
      createdUrls.push(URL.createObjectURL(file))
    }
    referenceVideos.value.push(...incoming)
    referenceVideoUrls.value.push(...createdUrls)
  } catch (error) {
    createdUrls.forEach(url => URL.revokeObjectURL(url))
    pageError.value = error instanceof Error ? error.message : '参考视频读取失败'
  }
  input.value = ''
}

const readVideoDuration = (file: File) => new Promise<number>((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.onloadedmetadata = () => { const duration = video.duration; URL.revokeObjectURL(url); resolve(duration) }
  video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取视频时长')) }
  video.src = url
})

const selectVideo = async (event: Event) => {
  pageError.value = ''
  const input = event.target as HTMLInputElement
  try {
    const file = input.files?.[0]
    if (!file || !file.type.startsWith('video/')) throw new Error('请选择视频文件')
    const duration = await readVideoDuration(file)
    if (!Number.isFinite(duration) || duration > 10.1) throw new Error('待修改或延长的视频不能超过 10 秒')
    sourceVideo.value = file
    replaceUrl(sourceVideoUrl, file)
  } catch (error) { pageError.value = error instanceof Error ? error.message : '视频读取失败' }
  input.value = ''
}

const removeReference = (index: number) => {
  URL.revokeObjectURL(referenceUrls.value[index])
  referenceUrls.value.splice(index, 1)
  referenceImages.value.splice(index, 1)
}

const removeVideoReference = (index: number) => {
  URL.revokeObjectURL(referenceVideoUrls.value[index])
  referenceVideoUrls.value.splice(index, 1)
  referenceVideos.value.splice(index, 1)
}

const clearFrame = (kind: 'first' | 'last') => {
  if (kind === 'first') { firstFrame.value = null; replaceUrl(firstFrameUrl, null) }
  else { lastFrame.value = null; replaceUrl(lastFrameUrl, null) }
}

const clearVideo = () => { sourceVideo.value = null; replaceUrl(sourceVideoUrl, null) }

const taskStatusLabel = (status: GeminiOmniTaskMeta['status']) => ({
  uploading: '正在上传素材', generating: '生成中', paused: '已暂停查询', downloading: '正在保存', completed: '已完成', failed: '生成失败'
}[status])
const modeLabel = (value: GeminiOmniMode) => modeOptions.find(item => item.value === value)?.label || value
const formatTime = (value: number) => new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(value)

const refreshVideoUrl = async (id: string) => {
  const old = videoUrls.value[id]
  if (old) URL.revokeObjectURL(old)
  const volatile = volatileVideos.get(id)
  const url = volatile ? URL.createObjectURL(volatile) : await getGeminiOmniVideoUrl(id)
  if (url) videoUrls.value = { ...videoUrls.value, [id]: url }
}

const finishTask = async (id: string, interaction: Awaited<ReturnType<typeof getGeminiOmniInteraction>>, controller: AbortController) => {
  if (!interaction.video) throw new Error('任务已结束，但接口没有返回视频文件')
  await patchGeminiOmniTask(id, { status: 'downloading', remoteVideo: interaction.video, error: '' })
  const task = await getGeminiOmniTask(id)
  if (!task) throw new Error('本地任务记录已丢失')
  const videoBlob = await downloadGeminiOmniVideo({ apiKey: config.apiKey, baseUrl: task.baseUrl }, interaction.video, controller.signal)
  try {
    await saveGeminiOmniTask({ ...task, status: 'completed', remoteVideo: interaction.video, videoBlob, error: '' })
  } catch {
    volatileVideos.set(id, videoBlob)
    await saveGeminiOmniTask({ ...task, status: 'completed', remoteVideo: interaction.video, error: '本机存储空间不足，请立即下载视频' })
  }
  await refreshVideoUrl(id)
  selectedTaskId.value = id
  activeTab.value = 'director'
  pageMessage.value = '视频已生成并保存，可以继续用自然语言修改。'
}

const pollTask = async (id: string, initial?: Awaited<ReturnType<typeof createGeminiOmniInteraction>>) => {
  if (pollingControllers.has(id)) return
  const controller = new AbortController()
  pollingControllers.set(id, controller)
  try {
    let task = await getGeminiOmniTask(id)
    if (!task?.interactionId) throw new Error('任务缺少可恢复的 Interaction ID')
    const interactionId = task.interactionId
    if (!config.apiKey.trim()) { await patchGeminiOmniTask(id, { status: 'paused', error: '填写原 Gemini Auth Key 后可继续查询' }); return }
    let result = initial
    while (!controller.signal.aborted) {
      if (!result) result = await getGeminiOmniInteraction({ apiKey: config.apiKey, baseUrl: task.baseUrl }, interactionId, controller.signal)
      if (result.error || result.status === 'failed' || result.status === 'cancelled') throw new Error(result.error || 'Omni 视频生成失败')
      if (result.video || result.status === 'completed') { await finishTask(id, result, controller); return }
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, 5000)
        controller.signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
      })
      result = undefined
      task = (await getGeminiOmniTask(id)) || task
    }
  } catch (error: any) {
    if (error?.name !== 'AbortError') {
      await patchGeminiOmniTask(id, { status: 'failed', error: error?.message || 'Omni 视频生成失败' }).catch(() => undefined)
      pageError.value = error?.message || 'Omni 视频生成失败'
    }
  } finally { pollingControllers.delete(id) }
}

const submitInput = async (input: GeminiOmniInput, parent?: GeminiOmniTaskMeta) => {
  if (isSubmitting.value) return
  pageError.value = ''; pageMessage.value = ''; isSubmitting.value = true
  const id = `omni_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  try {
    if (!config.apiKey.trim()) throw new Error('请先填写 Gemini Auth Key')
    validateGeminiOmniInput(input)
    const inputNames = parent ? [] : [firstFrame.value?.name, lastFrame.value?.name, ...referenceImages.value.map(file => file.name), ...referenceVideos.value.map(file => file.name), sourceVideo.value?.name].filter(Boolean) as string[]
    const task: GeminiOmniTask = {
      id, parentId: parent?.id, rootId: parent?.rootId || id, createdAt: Date.now(), updatedAt: Date.now(), status: 'uploading', baseUrl: config.baseUrl,
      params: { prompt: input.prompt.trim(), mode: input.mode, aspectRatio: input.aspectRatio, resolution: input.resolution, durationSeconds: input.durationSeconds, inputNames }
    }
    await saveGeminiOmniTask(task)
    selectedTaskId.value = id
    const interaction = await createGeminiOmniInteraction({ apiKey: config.apiKey, baseUrl: config.baseUrl }, input)
    await patchGeminiOmniTask(id, { status: 'generating', interactionId: interaction.id, remoteVideo: interaction.video, error: '' })
    pageMessage.value = '任务已提交，可以离开页面，回来后继续查询。'
    void pollTask(id, interaction)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Omni 任务提交失败'
    pageError.value = message
    if (!config.apiKey.trim()) showSettings.value = true
    if (await getGeminiOmniTask(id)) await patchGeminiOmniTask(id, { status: 'failed', error: message })
  } finally { isSubmitting.value = false }
}

const generateVideo = () => submitInput({
  prompt: prompt.value, mode: mode.value, aspectRatio: config.aspectRatio, resolution: config.resolution, durationSeconds: config.durationSeconds,
  firstFrame: firstFrame.value || undefined, lastFrame: lastFrame.value || undefined, referenceImages: referenceImages.value,
  referenceVideos: referenceVideos.value,
  sourceVideo: sourceVideo.value || undefined
})

const directVideo = async () => {
  const parent = selectedTask.value
  if (!parent?.interactionId || parent.status !== 'completed') { pageError.value = '请选择已经完成的 Omni 作品'; return }
  await submitInput({
    prompt: directorPrompt.value,
    mode: directorAction.value,
    aspectRatio: parent.params.aspectRatio,
    resolution: config.resolution,
    durationSeconds: config.durationSeconds,
    previousInteractionId: parent.interactionId
  }, parent)
  if (!pageError.value) directorPrompt.value = ''
}

const openDirector = (task: GeminiOmniTaskMeta) => {
  selectedTaskId.value = task.id
  config.aspectRatio = task.params.aspectRatio
  config.resolution = task.params.resolution
  config.durationSeconds = task.params.durationSeconds
  activeTab.value = 'director'
  pageError.value = ''
}

const pauseTask = async (task: GeminiOmniTaskMeta) => { pollingControllers.get(task.id)?.abort(); await patchGeminiOmniTask(task.id, { status: 'paused', error: '' }) }
const resumeTask = async (task: GeminiOmniTaskMeta) => {
  pageError.value = ''
  if (!config.apiKey.trim()) { showSettings.value = true; pageError.value = '请先填写原 Gemini Auth Key'; activeTab.value = 'create'; return }
  await patchGeminiOmniTask(task.id, { status: 'generating', error: '' }); void pollTask(task.id)
}

const reuseTask = (task: GeminiOmniTaskMeta) => {
  mode.value = task.params.mode
  prompt.value = task.params.prompt
  config.aspectRatio = task.params.aspectRatio
  config.resolution = task.params.resolution
  config.durationSeconds = task.params.durationSeconds
  activeTab.value = 'create'
  pageMessage.value = task.params.inputNames.length ? '已恢复参数；请重新选择原素材后提交。' : '已恢复这项任务的创作参数。'
}

const downloadTask = async (task: GeminiOmniTaskMeta) => {
  const blob = volatileVideos.get(task.id) || (await getGeminiOmniTask(task.id))?.videoBlob
  if (!blob) { pageError.value = '本机没有可下载的视频文件'; return }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = `gemini_omni_${task.createdAt}.mp4`; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const confirmDelete = async () => {
  const task = pendingDelete.value
  if (!task) return
  pollingControllers.get(task.id)?.abort()
  const url = videoUrls.value[task.id]; if (url) URL.revokeObjectURL(url)
  volatileVideos.delete(task.id)
  await removeGeminiOmniTask(task.id)
  const next = { ...videoUrls.value }; delete next[task.id]; videoUrls.value = next
  if (selectedTaskId.value === task.id) { selectedTaskId.value = ''; activeTab.value = 'works' }
  pendingDelete.value = null
}

onMounted(async () => {
  await loadGeminiOmniTasks()
  for (const task of tasks.value) {
    if (task.status === 'completed' && task.hasVideo) await refreshVideoUrl(task.id)
    if (task.status === 'uploading' && !task.interactionId) await patchGeminiOmniTask(task.id, { status: 'failed', error: '页面在 Interaction ID 返回前中断，请重新提交' })
  }
  await loadGeminiOmniTasks()
  for (const task of tasks.value.filter(item => ['generating', 'downloading'].includes(item.status))) void pollTask(task.id)
})

onUnmounted(() => {
  pollingControllers.forEach(controller => controller.abort()); pollingControllers.clear()
  ;[firstFrameUrl.value, lastFrameUrl.value, sourceVideoUrl.value, ...referenceUrls.value, ...referenceVideoUrls.value, ...Object.values(videoUrls.value)].filter(Boolean).forEach(url => URL.revokeObjectURL(url))
})
</script>

<template>
  <div class="omni-hall" :class="{ dark: globalSettings.darkMode }">
    <header class="hall-header">
      <button class="icon-button" type="button" aria-label="返回视频引擎" @click="$emit('back')"><svg viewBox="0 0 24 24"><path d="m12 19-7-7 7-7M19 12H5"/></svg></button>
      <div class="header-copy"><h1>Gemini Omni</h1><p>对话生成、修改与延长</p></div><div class="header-spacer"></div>
    </header>

    <nav class="hall-tabs" aria-label="Gemini Omni 页面">
      <button :class="{ active: activeTab === 'create' }" type="button" @click="activeTab = 'create'">创作</button>
      <button :class="{ active: activeTab === 'director' }" type="button" @click="activeTab = 'director'">导演台</button>
      <button :class="{ active: activeTab === 'works' }" type="button" @click="activeTab = 'works'">作品<span v-if="tasks.length">{{ tasks.length }}</span></button>
    </nav>

    <main class="hall-scroll">
      <Transition name="message"><p v-if="pageMessage" class="page-message" role="status">{{ pageMessage }}</p></Transition>
      <Transition name="message"><p v-if="pageError" class="page-error" role="alert">{{ pageError }}</p></Transition>

      <template v-if="activeTab === 'create'">
        <section class="panel settings-panel" :class="{ open: showSettings }">
          <button class="section-toggle" type="button" @click="showSettings = !showSettings"><span><small>接入设置</small><strong>{{ config.apiKey ? 'Gemini Auth Key 已填写' : '填写 Gemini Auth Key' }}</strong></span><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg></button>
          <div v-if="showSettings" class="settings-body">
            <label class="field"><span>Auth Key</span><div class="input-action"><input v-model="config.apiKey" :type="showApiKey ? 'text' : 'password'" autocomplete="off" placeholder="Google AI Studio Auth Key"><button type="button" @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button></div><small>独立保存在当前设备；首次为空时使用已有 Veo 配置预填。</small></label>
            <label class="field"><span>Base URL</span><div class="input-action"><input v-model="config.baseUrl" inputmode="url"><button type="button" @click="config.baseUrl = GEMINI_OMNI_DEFAULT_BASE_URL">默认</button></div></label>
          </div>
        </section>

        <section class="panel create-section">
          <div class="section-heading"><div><small>创作方式</small><h2>{{ modeInfo.description }}</h2></div><span class="cost-pill">{{ estimatedCostText }}</span></div>
          <div class="mode-tabs"><button v-for="item in modeOptions" :key="item.value" type="button" :class="{ active: mode === item.value }" @click="chooseMode(item.value)">{{ item.label }}</button></div>

          <div v-if="mode === 'image' || mode === 'interpolation'" class="upload-grid" :class="{ double: mode === 'interpolation' }">
            <div class="upload-slot" :class="{ filled: firstFrameUrl }"><img v-if="firstFrameUrl" :src="firstFrameUrl" alt="起始画面"><label v-else><svg viewBox="0 0 24 24"><path d="M4 16l4-4 4 4 3-3 5 5M4 5h16v14H4z"/></svg><span>起始画面</span><small>图片不超过 20MB</small><input type="file" accept="image/*" @change="selectFrame('first', $event)"></label><button v-if="firstFrameUrl" type="button" aria-label="移除起始画面" @click="clearFrame('first')">×</button></div>
            <div v-if="mode === 'interpolation'" class="upload-slot" :class="{ filled: lastFrameUrl }"><img v-if="lastFrameUrl" :src="lastFrameUrl" alt="结束画面"><label v-else><svg viewBox="0 0 24 24"><path d="M4 16l4-4 4 4 3-3 5 5M4 5h16v14H4z"/></svg><span>结束画面</span><small>控制过渡终点</small><input type="file" accept="image/*" @change="selectFrame('last', $event)"></label><button v-if="lastFrameUrl" type="button" aria-label="移除结束画面" @click="clearFrame('last')">×</button></div>
          </div>

          <div v-if="mode === 'references'" class="reference-upload">
            <div class="reference-list"><div v-for="(url, index) in referenceUrls" :key="url" class="reference-thumb"><img :src="url" :alt="`参考图 ${index + 1}`"><button type="button" aria-label="移除参考图" @click="removeReference(index)">×</button></div><label v-if="referenceImages.length < 6" class="reference-add"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>添加参考</span><input type="file" multiple accept="image/*" @change="selectReferences"></label></div>
            <div v-if="referenceVideoUrls.length" class="video-reference-list"><div v-for="(url, index) in referenceVideoUrls" :key="url"><video :src="url" muted playsinline></video><span>视频参考 {{ index + 1 }}</span><button type="button" aria-label="移除参考视频" @click="removeVideoReference(index)">×</button></div></div>
            <label v-if="referenceVideos.length < 3" class="video-reference-add"><span>＋ 添加视频参考</span><small>最多三段，每段不超过 3 秒；声音会被忽略</small><input type="file" multiple accept="video/mp4,video/quicktime,.mp4,.mov" @change="selectVideoReferences"></label>
            <p>图片最多六张；可在描述中分别说明人物、物品或风格用途。</p>
          </div>

          <div v-if="mode === 'edit' || mode === 'extend'" class="video-upload">
            <video v-if="sourceVideoUrl" :src="sourceVideoUrl" controls playsinline></video>
            <label v-else><svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5z"/></svg><span>{{ mode === 'edit' ? '选择待修改视频' : '选择待延长视频' }}</span><small>MP4 / MOV，最长 10 秒</small><input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" @change="selectVideo"></label>
            <button v-if="sourceVideoUrl" type="button" @click="clearVideo">移除视频</button>
          </div>
        </section>

        <section class="panel prompt-section">
          <div class="section-heading"><div><small>导演描述</small><h2>告诉 Omni 画面如何发生</h2></div><span class="counter">{{ prompt.length }} 字</span></div>
          <textarea v-model="prompt" maxlength="12000" :placeholder="mode === 'edit' ? '例如：保留人物动作，把背景改成下雨的夜晚…' : mode === 'extend' ? '例如：镜头继续向前移动，人物走进灯光昏暗的房间…' : '描述主体、场景、动作、镜头、光线、台词、音乐与音效…'"></textarea>
          <p>英文提示经过完整评估；中文也可使用。延长只能添加在视频结尾，上传视频中的原有人声暂不能修改。</p>
        </section>

        <section class="panel parameter-section">
          <div class="section-heading"><div><small>画面输出</small><h2>比例、清晰度与目标时长</h2></div></div>
          <div class="parameter-grid"><label class="field"><span>画面比例</span><select v-model="config.aspectRatio"><option value="16:9">16:9 横屏</option><option value="9:16">9:16 竖屏</option></select></label><label class="field"><span>清晰度</span><select v-model="config.resolution"><option value="360p">360p 草稿</option><option value="720p">720p 标准</option><option value="1080p">1080p 放大</option><option value="4k">4K 放大</option></select></label><label class="field full"><span>目标时长</span><select v-model.number="config.durationSeconds"><option v-for="second in [3,4,5,6,7,8,9,10]" :key="second" :value="second">{{ second }} 秒</option></select><small>模型输出范围为 3–10 秒，实际长度可能随内容略有变化。</small></label></div>
          <div class="generation-note"><span>原生音画</span><span>24 FPS</span><span>SynthID</span><span v-if="config.resolution === '1080p' || config.resolution === '4k'">放大输出</span></div>
        </section>

        <button class="generate-button" type="button" :disabled="isSubmitting" @click="generateVideo"><span v-if="isSubmitting" class="spinner"></span>{{ isSubmitting ? '正在上传并提交…' : `生成视频 · ${estimatedCostText}` }}</button>
        <section v-if="activeTasks.length" class="panel running-section"><div class="section-heading"><div><small>后台任务</small><h2>{{ activeTasks.length }} 项正在处理</h2></div></div><div v-for="task in activeTasks" :key="task.id" class="running-card"><span class="running-indicator"><i></i></span><div><strong>{{ taskStatusLabel(task.status) }}</strong><p>{{ task.params.prompt }}</p></div><button v-if="task.status !== 'uploading'" type="button" @click="pauseTask(task)">暂停查询</button></div></section>
      </template>

      <template v-else-if="activeTab === 'director'">
        <section v-if="selectedTask" class="director-stage">
          <div class="stage-video" :class="selectedTask.params.aspectRatio === '9:16' ? 'portrait' : 'landscape'"><video v-if="videoUrls[selectedTask.id]" :src="videoUrls[selectedTask.id]" controls playsinline></video><div v-else class="work-placeholder"><span v-if="selectedTask.status === 'generating'" class="spinner"></span><strong>{{ taskStatusLabel(selectedTask.status) }}</strong></div></div>
          <div class="stage-info"><div><small>{{ formatTime(selectedTask.createdAt) }} · {{ selectedTask.params.resolution }} · {{ selectedTask.params.durationSeconds }} 秒</small><strong>{{ selectedTask.params.prompt }}</strong></div><button type="button" @click="downloadTask(selectedTask)">下载</button></div>
        </section>
        <section v-if="selectedTask?.status === 'completed'" class="panel director-panel">
          <div class="section-heading"><div><small>继续导演</small><h2>只描述想改变或继续的部分</h2></div><span class="cost-pill">{{ estimatedCostText }}</span></div>
          <div class="director-actions"><button type="button" :class="{ active: directorAction === 'edit' }" @click="directorAction = 'edit'">修改当前画面</button><button type="button" :class="{ active: directorAction === 'extend' }" @click="directorAction = 'extend'">从结尾继续</button></div>
          <div class="quick-prompts"><button v-for="item in ['改背景','改光线','改镜头','改动作','改风格','删除物体']" :key="item" type="button" @click="directorPrompt = directorPrompt ? `${directorPrompt}；${item}：` : `${item}：`">{{ item }}</button></div>
          <textarea v-model="directorPrompt" maxlength="12000" :placeholder="directorAction === 'edit' ? '例如：人物和动作保持不变，只把背景改成雨夜…' : '例如：继续场景，镜头跟随人物走出房间…'"></textarea>
          <div class="director-controls"><label class="field"><span>本次清晰度</span><select v-model="config.resolution"><option value="360p">360p 草稿</option><option value="720p">720p 标准</option><option value="1080p">1080p 放大</option><option value="4k">4K 放大</option></select></label><label class="field"><span>目标时长</span><select v-model.number="config.durationSeconds"><option v-for="second in [3,4,5,6,7,8,9,10]" :key="second" :value="second">{{ second }} 秒</option></select></label></div>
          <button class="generate-button compact" type="button" :disabled="isSubmitting || !directorPrompt.trim()" @click="directVideo"><span v-if="isSubmitting" class="spinner"></span>{{ isSubmitting ? '正在提交…' : directorAction === 'edit' ? '应用修改' : '延长场景' }}</button>
        </section>
        <section v-if="selectedTask && (selectedParent || selectedChildren.length)" class="panel branch-panel"><div class="section-heading"><div><small>创作轨迹</small><h2>从相关节点继续探索</h2></div></div><div class="branch-list"><button v-if="selectedParent" type="button" @click="openDirector(selectedParent)"><span>上一个节点</span><strong>{{ selectedParent.params.prompt }}</strong></button><button v-for="child in selectedChildren" :key="child.id" type="button" @click="openDirector(child)"><span>{{ child.status === 'completed' ? '衍生节点' : taskStatusLabel(child.status) }}</span><strong>{{ child.params.prompt }}</strong></button></div></section>
        <section v-if="!selectedTask" class="empty-works"><svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5z"/></svg><h2>还没有选中作品</h2><p>生成视频后会自动进入导演台，也可以从作品中选择一项继续修改。</p><button type="button" @click="activeTab = tasks.length ? 'works' : 'create'">{{ tasks.length ? '选择作品' : '开始创作' }}</button></section>
      </template>

      <template v-else>
        <div v-if="tasks.length" class="works-list"><article v-for="task in tasks" :key="task.id" class="work-card"><div class="work-media" :class="task.params.aspectRatio === '9:16' ? 'portrait' : 'landscape'"><video v-if="videoUrls[task.id]" :src="videoUrls[task.id]" controls playsinline preload="metadata"></video><div v-else class="work-placeholder"><span v-if="['uploading','generating','downloading'].includes(task.status)" class="spinner"></span><strong>{{ taskStatusLabel(task.status) }}</strong></div><span class="status-badge" :class="task.status">{{ taskStatusLabel(task.status) }}</span></div><div class="work-info"><strong>{{ task.params.prompt }}</strong><p>{{ formatTime(task.createdAt) }} · {{ modeLabel(task.params.mode) }} · {{ task.params.resolution }} · {{ task.params.durationSeconds }} 秒<span v-if="task.parentId"> · 衍生节点</span></p><p v-if="task.error" class="task-error">{{ task.error }}</p><div class="work-actions"><button v-if="task.status === 'completed'" type="button" @click="openDirector(task)">继续创作</button><button v-if="task.status === 'completed' && task.hasVideo" type="button" @click="downloadTask(task)">下载</button><button v-if="(task.status === 'paused' || task.status === 'failed') && task.interactionId" type="button" @click="resumeTask(task)">恢复查询</button><button v-if="task.status === 'failed' && !task.interactionId" type="button" @click="reuseTask(task)">重新创作</button><button v-if="['generating','downloading'].includes(task.status)" type="button" @click="pauseTask(task)">暂停查询</button><button class="danger" type="button" @click="pendingDelete = task">删除</button></div></div></article></div>
        <section v-else class="empty-works"><svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5z"/></svg><h2>还没有 Omni 作品</h2><p>完成的视频、对话修改和分支关系会保存在当前设备。</p><button type="button" @click="activeTab = 'create'">开始创作</button></section>
      </template>
    </main>

    <Transition name="sheet"><div v-if="pendingDelete" class="sheet-overlay" @click.self="pendingDelete = null"><section class="confirm-sheet"><div class="sheet-mark"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13"/></svg></div><h2>删除这个创作节点？</h2><p>本机视频与节点记录会移除，其他创作分支继续保留。云端生成和已经产生的费用不受影响。</p><div><button type="button" @click="pendingDelete = null">保留</button><button class="danger" type="button" @click="confirmDelete">删除</button></div></section></div></Transition>
  </div>
</template>

<style scoped>
.omni-hall{--bg:#f7f7f5;--surface:#fff;--soft:#f1f1ee;--line:#e8e8e3;--text:#151515;--sub:#666;--muted:#999;--accent:#191919;position:absolute;inset:0;z-index:101;display:flex;overflow:hidden;flex-direction:column;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}.omni-hall.dark{--bg:#111210;--surface:#1b1c19;--soft:#252622;--line:#30312c;--text:#f4f4f0;--sub:#bbb;--muted:#81827a;--accent:#f1f1ec}.hall-header{display:flex;flex:0 0 auto;align-items:center;padding:calc(env(safe-area-inset-top) + 17px) 18px 12px}.icon-button,.header-spacer{width:36px;height:36px;flex:0 0 auto}.icon-button{display:grid;padding:0;border:0;border-radius:50%;background:transparent;color:var(--text);place-items:center;cursor:pointer}.icon-button:active{background:var(--soft)}.icon-button svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.header-copy{min-width:0;flex:1;text-align:center}.header-copy h1{overflow:hidden;margin:0;font-size:21px;font-weight:680;letter-spacing:-.5px;white-space:nowrap;text-overflow:ellipsis}.header-copy p{overflow:hidden;margin:3px 0 0;color:var(--muted);font-size:9px;white-space:nowrap;text-overflow:ellipsis}.hall-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin:0 18px 12px;padding:4px;border-radius:13px;background:var(--soft)}.hall-tabs button{display:flex;min-width:0;align-items:center;justify-content:center;gap:4px;padding:8px;border:0;border-radius:10px;background:transparent;color:var(--sub);font-size:11px;font-weight:620;cursor:pointer}.hall-tabs button.active{background:var(--surface);color:var(--text);box-shadow:0 2px 8px rgba(0,0,0,.05)}.hall-tabs span{min-width:15px;padding:1px 4px;border-radius:9px;background:var(--soft);font-size:8px}.hall-scroll{flex:1;min-height:0;overflow-y:auto;padding:0 18px calc(28px + env(safe-area-inset-bottom));overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.page-message,.page-error{margin:3px 0 10px;padding:9px 11px;border-radius:11px;font-size:10px;line-height:1.5}.page-message{background:#eaf5ed;color:#397148}.page-error{background:#fff0f0;color:#b64242}.dark .page-message{background:#223429;color:#91c89f}.dark .page-error{background:#3b2527;color:#efaaaa}.panel{margin-bottom:12px;border:1px solid var(--line);border-radius:17px;background:var(--surface)}.section-toggle{display:flex;width:100%;align-items:center;justify-content:space-between;padding:13px 14px;border:0;border-radius:17px;background:transparent;color:inherit;text-align:left;cursor:pointer}.section-toggle span{display:flex;min-width:0;flex-direction:column;gap:3px}.section-toggle small,.section-heading small{color:var(--muted);font-size:9px;font-weight:650;letter-spacing:.7px}.section-toggle strong{overflow:hidden;font-size:12px;white-space:nowrap;text-overflow:ellipsis}.section-toggle svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6}.settings-panel.open .section-toggle svg{transform:rotate(180deg)}.settings-body{display:grid;gap:11px;padding:12px 14px 15px;border-top:1px solid var(--line)}.field{display:flex;min-width:0;flex-direction:column;gap:5px}.field>span{color:var(--sub);font-size:10px;font-weight:600}.field>small{color:var(--muted);font-size:8px;line-height:1.45}.input-action{display:flex;min-width:0;gap:6px}.input-action input{min-width:0;flex:1}.input-action button,.work-actions button,.running-card button,.stage-info button{flex:0 0 auto;padding:0 10px;border:0;border-radius:9px;background:var(--soft);color:var(--text);font-size:9px;font-weight:620;cursor:pointer}.create-section,.prompt-section,.parameter-section,.running-section,.director-panel,.branch-panel{padding:14px}.section-heading{display:flex;min-width:0;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:11px}.section-heading>div{min-width:0}.section-heading h2{overflow:hidden;margin:3px 0 0;font-size:14px;font-weight:660;white-space:nowrap;text-overflow:ellipsis}.cost-pill{flex:0 0 auto;padding:5px 7px;border-radius:9px;background:var(--soft);color:var(--sub);font-size:8px;font-weight:650}.mode-tabs{display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.mode-tabs::-webkit-scrollbar{display:none}.mode-tabs button{flex:0 0 auto;padding:7px 10px;border:0;border-radius:99px;background:var(--soft);color:var(--sub);font-size:10px;font-weight:620;cursor:pointer}.mode-tabs button.active{background:var(--accent);color:var(--bg)}.upload-grid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:11px}.upload-grid.double{grid-template-columns:repeat(2,minmax(0,1fr))}.upload-slot{position:relative;display:grid;min-width:0;min-height:120px;overflow:hidden;border:1px dashed var(--line);border-radius:13px;background:var(--soft);place-items:center}.upload-slot img{width:100%;height:142px;object-fit:cover}.upload-slot label,.reference-add,.video-upload label{display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--sub);cursor:pointer}.upload-slot input,.reference-add input,.video-upload input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.upload-slot svg,.reference-add svg,.video-upload svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.5}.upload-slot label span,.video-upload label span{margin-top:7px;font-size:10px;font-weight:650}.upload-slot label small,.video-upload label small{margin-top:3px;color:var(--muted);font-size:8px}.upload-slot>button,.reference-thumb>button{position:absolute;top:6px;right:6px;display:grid;width:23px;height:23px;padding:0;border:0;border-radius:50%;background:rgba(20,20,20,.72);color:#fff;font-size:15px;place-items:center;cursor:pointer}.reference-upload{margin-top:11px}.reference-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.reference-thumb,.reference-add{position:relative;min-width:0;height:102px;overflow:hidden;border-radius:12px;background:var(--soft)}.reference-thumb img{width:100%;height:100%;object-fit:cover}.reference-add{border:1px dashed var(--line)}.reference-add span{margin-top:5px;font-size:9px}.reference-upload p,.prompt-section p{margin:8px 1px 0;color:var(--muted);font-size:8px;line-height:1.5}.video-upload{position:relative;display:grid;min-height:150px;margin-top:11px;overflow:hidden;border:1px dashed var(--line);border-radius:13px;background:#111;place-items:center}.video-upload video{width:100%;max-height:300px}.video-upload>button{position:absolute;top:7px;right:7px;padding:6px 9px;border:0;border-radius:9px;background:rgba(20,20,20,.72);color:#fff;font-size:9px;cursor:pointer}.prompt-section textarea,.director-panel textarea{width:100%;min-height:125px;resize:vertical;padding:12px;border:0;border-radius:13px;box-sizing:border-box;background:var(--soft);color:var(--text);font:inherit;font-size:11px;line-height:1.65;outline:none}.counter{flex:0 0 auto;color:var(--muted);font-size:8px}input,select{width:100%;min-height:35px;padding:8px 10px;border:0;border-radius:10px;box-sizing:border-box;appearance:none;background:var(--soft);color:var(--text);font:inherit;font-size:10px;outline:none}textarea:focus,input:focus,select:focus{box-shadow:inset 0 0 0 1px var(--text)}select{padding-right:24px;background-image:linear-gradient(45deg,transparent 50%,var(--sub) 50%),linear-gradient(135deg,var(--sub) 50%,transparent 50%);background-position:calc(100% - 13px) 15px,calc(100% - 9px) 15px;background-repeat:no-repeat;background-size:4px 4px}.parameter-grid,.director-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 8px}.field.full{grid-column:1/-1}.generation-note{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.generation-note span{padding:4px 7px;border-radius:8px;background:var(--soft);color:var(--muted);font-size:8px}.generate-button{display:flex;width:100%;align-items:center;justify-content:center;gap:7px;margin:2px 0 14px;padding:13px;border:0;border-radius:14px;background:var(--accent);color:var(--bg);font-size:11px;font-weight:680;cursor:pointer}.generate-button:disabled{opacity:.45;cursor:not-allowed}.generate-button.compact{margin:11px 0 0}.spinner{display:inline-block;width:12px;height:12px;border:1.8px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite}.running-card{display:flex;min-width:0;align-items:center;gap:8px;padding:9px 0;border-top:1px solid var(--line)}.running-card>div{min-width:0;flex:1}.running-card strong{font-size:9px}.running-card p{overflow:hidden;margin:3px 0 0;color:var(--muted);font-size:8px;white-space:nowrap;text-overflow:ellipsis}.running-card button{min-height:27px}.running-indicator{display:grid;flex:0 0 auto;width:24px;height:24px;border-radius:50%;background:var(--soft);place-items:center}.running-indicator i{width:7px;height:7px;border-radius:50%;background:#63a878;animation:pulse 1.5s infinite}.director-stage{margin-bottom:12px;overflow:hidden;border:1px solid var(--line);border-radius:17px;background:var(--surface)}.stage-video{display:grid;width:100%;overflow:hidden;background:#111;place-items:center}.stage-video.landscape{aspect-ratio:16/9}.stage-video.portrait{max-height:58vh;aspect-ratio:9/16}.stage-video video{width:100%;height:100%;object-fit:contain}.stage-info{display:flex;min-width:0;align-items:center;gap:8px;padding:10px 11px}.stage-info>div{min-width:0;flex:1}.stage-info small{display:block;color:var(--muted);font-size:8px}.stage-info strong{display:block;overflow:hidden;margin-top:3px;font-size:10px;white-space:nowrap;text-overflow:ellipsis}.stage-info button{min-height:28px}.director-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px}.director-actions button,.quick-prompts button{border:0;border-radius:10px;background:var(--soft);color:var(--sub);font-size:9px;font-weight:620;cursor:pointer}.director-actions button{padding:8px}.director-actions button.active{background:var(--accent);color:var(--bg)}.quick-prompts{display:flex;gap:5px;overflow-x:auto;margin-bottom:8px;scrollbar-width:none}.quick-prompts button{flex:0 0 auto;padding:6px 8px}.director-controls{margin-top:9px}.branch-list{display:grid;gap:6px}.branch-list button{display:flex;min-width:0;align-items:center;gap:8px;padding:9px;border:0;border-radius:10px;background:var(--soft);color:var(--text);text-align:left;cursor:pointer}.branch-list span{flex:0 0 auto;color:var(--muted);font-size:8px}.branch-list strong{overflow:hidden;min-width:0;font-size:9px;white-space:nowrap;text-overflow:ellipsis}.works-list{display:grid;gap:11px}.work-card{min-width:0;overflow:hidden;border:1px solid var(--line);border-radius:17px;background:var(--surface)}.work-media{position:relative;display:grid;width:100%;overflow:hidden;background:#111;place-items:center}.work-media.landscape{aspect-ratio:16/9}.work-media.portrait{max-height:430px;aspect-ratio:9/16}.work-media video{width:100%;height:100%;object-fit:contain}.work-placeholder{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:#aaa}.work-placeholder strong{font-size:9px}.status-badge{position:absolute;top:7px;left:7px;padding:4px 7px;border-radius:8px;background:rgba(20,20,20,.7);color:#fff;font-size:8px}.status-badge.completed{background:rgba(45,112,67,.8)}.status-badge.failed{background:rgba(159,54,54,.8)}.work-info{padding:10px 11px}.work-info>strong{display:block;overflow:hidden;font-size:10px;white-space:nowrap;text-overflow:ellipsis}.work-info p{margin:4px 0 0;color:var(--muted);font-size:8px;line-height:1.45}.work-info .task-error{color:#b84a4a;font-size:9px}.work-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.work-actions button{min-height:27px}.work-actions .danger{margin-left:auto;background:#fff0f0;color:#b74343}.empty-works{display:flex;min-height:55vh;align-items:center;justify-content:center;flex-direction:column;text-align:center}.empty-works svg{width:40px;height:40px;fill:none;stroke:var(--muted);stroke-width:1.3}.empty-works h2{margin:13px 0 5px;font-size:14px}.empty-works p{max-width:260px;margin:0;color:var(--sub);font-size:9px;line-height:1.6}.empty-works button{margin-top:13px;padding:9px 14px;border:0;border-radius:11px;background:var(--accent);color:var(--bg);font-size:9px;font-weight:650;cursor:pointer}.sheet-overlay{position:fixed;inset:0;z-index:1200;display:flex;align-items:flex-end;justify-content:center;padding:12px;background:rgba(0,0,0,.3);backdrop-filter:blur(5px)}.confirm-sheet{width:min(100%,430px);padding:20px 18px calc(18px + env(safe-area-inset-bottom));border-radius:24px;background:var(--surface);text-align:center}.sheet-mark{display:grid;width:38px;height:38px;margin:0 auto 10px;border-radius:50%;background:#fff0f0;color:#b74343;place-items:center}.sheet-mark svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.5}.confirm-sheet h2{margin:0;font-size:14px}.confirm-sheet p{margin:8px auto 16px;color:var(--sub);font-size:9px;line-height:1.55}.confirm-sheet>div:last-child{display:grid;grid-template-columns:1fr 1fr;gap:8px}.confirm-sheet button{padding:10px;border:0;border-radius:11px;background:var(--soft);color:var(--text);font-size:10px;font-weight:650;cursor:pointer}.confirm-sheet button.danger{background:#c84b4b;color:#fff}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{50%{opacity:.45;transform:scale(.8)}}.message-enter-active,.message-leave-active{transition:opacity .2s}.message-enter-from,.message-leave-to{opacity:0}.sheet-enter-active,.sheet-leave-active{transition:opacity .2s}.sheet-enter-from,.sheet-leave-to{opacity:0}
.video-reference-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:7px}.video-reference-list>div{position:relative;min-width:0;overflow:hidden;border-radius:11px;background:#111}.video-reference-list video{display:block;width:100%;height:78px;object-fit:cover}.video-reference-list span{display:block;overflow:hidden;padding:5px 7px;color:#ddd;font-size:8px;white-space:nowrap;text-overflow:ellipsis}.video-reference-list button{position:absolute;top:5px;right:5px;display:grid;width:22px;height:22px;padding:0;border:0;border-radius:50%;background:rgba(20,20,20,.75);color:#fff;font-size:14px;place-items:center;cursor:pointer}.video-reference-add{position:relative;display:flex;min-width:0;align-items:flex-start;flex-direction:column;margin-top:7px;padding:8px 10px;border:1px dashed var(--line);border-radius:11px;color:var(--sub);cursor:pointer}.video-reference-add span{font-size:9px;font-weight:650}.video-reference-add small{margin-top:3px;color:var(--muted);font-size:8px}.video-reference-add input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
@media(min-width:700px){.hall-header,.hall-tabs,.hall-scroll{width:min(100%,760px);margin-left:auto;margin-right:auto}.hall-tabs{width:min(calc(100% - 36px),724px)}.works-list{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.settings-body{grid-template-columns:1fr 1fr}.settings-body .field:first-child{grid-column:1/-1}}
@media(max-width:360px){.hall-header{padding-left:14px;padding-right:14px}.hall-tabs{margin-left:14px;margin-right:14px}.hall-scroll{padding-left:14px;padding-right:14px}.header-copy h1{font-size:19px}.create-section,.prompt-section,.parameter-section,.running-section,.director-panel,.branch-panel{padding:12px}.mode-tabs button{padding-left:9px;padding-right:9px}.upload-slot{min-height:106px}.upload-slot img{height:125px}.cost-pill{max-width:92px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.generate-button{font-size:10px}}
</style>
