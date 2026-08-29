<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { globalSettings } from '../../store/global'
import { getSecureValue, isNativeMobileApp, setSecureValue } from '../../services/mobileSecureStorage'
import { downloadWebVideo, type VideoConnectionMode } from '../../services/videoHttp'
import {
  AGNES_DEFAULT_BASE_URL, AGNES_FRAME_PRESETS, AGNES_MODES, AGNES_RATIOS, AGNES_VIDEO_MODEL,
  AgnesApiError, createAgnesVideo, downloadAgnesVideo, estimateAgnesSeconds, queryAgnesVideo,
  removeAgnesVideoFile, shareAgnesVideo, validateAgnesInput,
  type AgnesMode, type AgnesRatio, type AgnesResolution, type AgnesVideoInput
} from '../../services/agnesVideo'
import { useAgnesVideoHistory, type AgnesLocalTask } from '../../composables/useAgnesVideoHistory'

defineEmits<{ (event: 'back'): void }>()

const nativeApp = isNativeMobileApp()
const read = (key: string, fallback: string) => localStorage.getItem(key) || fallback
const readPromptLibrary = () => {
  try {
    const value = JSON.parse(read('app_agnes_prompt_library', '[]'))
    return Array.isArray(value) ? value.filter(item => item && typeof item.name === 'string' && typeof item.prompt === 'string') : []
  } catch { return [] }
}

const connectionMode = ref<VideoConnectionMode>((nativeApp ? read('app_agnes_connection_mode', 'app') : 'web') as VideoConnectionMode)
const rememberKey = ref(read('app_agnes_remember_key', 'false') === 'true')
const apiKey = ref(rememberKey.value ? read('app_agnes_web_api_key', '') : '')
const webSessionKey = ref(apiKey.value)
const keyReady = ref(false)
const showKey = ref(false)
const settingsOpen = ref(false)
const advancedOpen = ref(false)
const activeTab = ref<'create' | 'works' | 'ideas'>('create')
const busy = ref(false)
const notice = ref('')
const errorText = ref('')
const prompt = ref(read('app_agnes_prompt', ''))
const negativePrompt = ref(read('app_agnes_negative_prompt', ''))
const projectName = ref(read('app_agnes_project', '默认作品集'))
const projectFilter = ref('全部')
const mode = ref<AgnesMode>((read('app_agnes_mode', 'text') as AgnesMode))
const imageUrls = ref<string[]>(mode.value === 'keyframes' ? ['', ''] : mode.value === 'image' ? [''] : [])
const savedPrompts = ref<Array<{ name: string; prompt: string }>>(readPromptLibrary())
const deletingTask = ref<AgnesLocalTask | null>(null)
const pollers = new Map<string, AbortController>()

const config = reactive({
  baseUrl: read('app_agnes_base_url', AGNES_DEFAULT_BASE_URL),
  resolution: read('app_agnes_resolution', '720p') as AgnesResolution,
  ratio: read('app_agnes_ratio', '16:9') as AgnesRatio,
  numFrames: Number(read('app_agnes_num_frames', '121')),
  frameRate: Number(read('app_agnes_frame_rate', '24')),
  seed: read('app_agnes_seed', ''),
  inferenceSteps: read('app_agnes_inference_steps', '')
})

const templates = [
  { name: '人物微动', prompt: '近景拍摄人物自然呼吸并轻轻看向镜头，发丝随微风摆动，面部与服装保持稳定，柔和自然光，缓慢推进镜头，电影质感。' },
  { name: '产品展示', prompt: '产品位于简洁展台中央，镜头缓慢环绕，表面材质与品牌细节清晰稳定，柔和轮廓光，背景产生轻微层次变化，高级商业广告质感。' },
  { name: '动态封面', prompt: '主体保持画面中心，前景与背景形成细腻视差，环境光缓慢流动，镜头轻微推进，构图稳定，结尾自然定格为完整封面。' },
  { name: '关键帧转场', prompt: '在起始与结束画面之间生成连续、自然、符合物理规律的电影感过渡，保持主体身份、服装、色彩与空间关系一致，避免突然跳变。' }
]
const negativeTemplates = ['画面闪烁，身份漂移，面部变形，多余肢体，错误手指，文字乱码，突然跳切', '低清晰度，过度锐化，色彩断层，镜头抖动，物体穿模']

const { tasks, load, save, patch, get, remove } = useAgnesVideoHistory()
const input = computed<AgnesVideoInput>(() => ({
  prompt: prompt.value,
  negativePrompt: negativePrompt.value || undefined,
  mode: mode.value,
  resolution: config.resolution,
  ratio: config.ratio,
  numFrames: config.numFrames,
  frameRate: config.frameRate,
  imageUrls: imageUrls.value.map(url => url.trim()),
  seed: config.seed === '' ? undefined : Number(config.seed),
  inferenceSteps: config.inferenceSteps === '' ? undefined : Number(config.inferenceSteps)
}))
const estimatedSeconds = computed(() => estimateAgnesSeconds(config.numFrames, config.frameRate))
const activeTasks = computed(() => tasks.value.filter(task => ['submitting', 'queued', 'running'].includes(task.status)))
const projectNames = computed(() => Array.from(new Set(tasks.value.map(task => task.project || '默认作品集'))))
const visibleTasks = computed(() => projectFilter.value === '全部' ? tasks.value : tasks.value.filter(task => (task.project || '默认作品集') === projectFilter.value))
const canGenerate = computed(() => keyReady.value && Boolean(apiKey.value.trim()) && (connectionMode.value === 'web' || nativeApp) && !busy.value)
const modeDescription = computed(() => AGNES_MODES.find(item => item.value === mode.value)?.description || '')

watch(prompt, value => localStorage.setItem('app_agnes_prompt', value))
watch(negativePrompt, value => localStorage.setItem('app_agnes_negative_prompt', value))
watch(projectName, value => localStorage.setItem('app_agnes_project', value))
watch(mode, value => localStorage.setItem('app_agnes_mode', value))
watch(config, value => {
  localStorage.setItem('app_agnes_base_url', value.baseUrl)
  localStorage.setItem('app_agnes_resolution', value.resolution)
  localStorage.setItem('app_agnes_ratio', value.ratio)
  localStorage.setItem('app_agnes_num_frames', String(value.numFrames))
  localStorage.setItem('app_agnes_frame_rate', String(value.frameRate))
  localStorage.setItem('app_agnes_seed', String(value.seed))
  localStorage.setItem('app_agnes_inference_steps', String(value.inferenceSteps))
}, { deep: true })
watch([connectionMode, rememberKey], () => {
  localStorage.setItem('app_agnes_connection_mode', connectionMode.value)
  localStorage.setItem('app_agnes_remember_key', String(rememberKey.value))
  if (!rememberKey.value) localStorage.removeItem('app_agnes_web_api_key')
})
watch(apiKey, value => {
  if (connectionMode.value !== 'web') return
  webSessionKey.value = value
  if (rememberKey.value) localStorage.setItem('app_agnes_web_api_key', value)
})
watch(connectionMode, async value => {
  clearFeedback()
  try {
    apiKey.value = value === 'web'
      ? (rememberKey.value ? read('app_agnes_web_api_key', webSessionKey.value) : webSessionKey.value)
      : nativeApp ? (await getSecureValue('agnes_api_key')) || '' : ''
  } catch (error) { errorText.value = error instanceof Error ? error.message : '无法读取 Agnes API Key' }
})

const clearFeedback = () => { notice.value = ''; errorText.value = '' }
const client = () => ({ apiKey: apiKey.value, baseUrl: config.baseUrl, connectionMode: connectionMode.value })
const taskClient = (task: AgnesLocalTask) => ({ apiKey: apiKey.value, baseUrl: task.baseUrl, connectionMode: task.connectionMode })
const changeMode = (value: AgnesMode) => {
  if (mode.value === value) return
  mode.value = value
  imageUrls.value = value === 'text' ? [] : value === 'image' ? [''] : ['', '']
  clearFeedback()
}
const imageLabel = (index: number) => mode.value === 'keyframes' ? (index === 0 ? '起始图片' : '结束图片') : '参考图片'
const useTemplate = (value: string) => { prompt.value = value; activeTab.value = 'create'; notice.value = '已填入创作描述，可以继续修改。' }
const useNegativeTemplate = (value: string) => { negativePrompt.value = value; notice.value = '已填入负向提示词。' }
const savePrompt = () => {
  clearFeedback()
  if (!prompt.value.trim()) { errorText.value = '请先填写要保存的视频描述'; return }
  const next = { name: `创作方案 ${savedPrompts.value.length + 1}`, prompt: prompt.value.trim() }
  savedPrompts.value.push(next)
  localStorage.setItem('app_agnes_prompt_library', JSON.stringify(savedPrompts.value))
  notice.value = '已保存到灵感页。'
}
const removePrompt = (index: number) => {
  savedPrompts.value.splice(index, 1)
  localStorage.setItem('app_agnes_prompt_library', JSON.stringify(savedPrompts.value))
}
const randomizeSeed = () => {
  const value = new Uint32Array(1)
  crypto.getRandomValues(value)
  config.seed = String(value[0])
}
const selectFramePreset = (frames: number) => { config.numFrames = frames; config.frameRate = 24 }
const setTaskStatusFromRemote = async (localId: string, remote: Awaited<ReturnType<typeof queryAgnesVideo>>) => {
  if (remote.status === 'completed') {
    if (!remote.videoUrl) throw new Error('Agnes 已完成任务，但没有返回可播放的视频地址')
    await patch(localId, { status: 'completed', progress: 100, videoUrl: remote.videoUrl, actualSeconds: remote.seconds, actualSize: remote.size, sizeMapping: remote.sizeMapping, error: '' })
    return true
  }
  if (remote.status === 'failed') {
    await patch(localId, { status: 'failed', progress: remote.progress, error: remote.error || 'Agnes 视频生成失败', actualSeconds: remote.seconds, actualSize: remote.size, sizeMapping: remote.sizeMapping })
    return true
  }
  await patch(localId, { status: remote.status === 'queued' ? 'queued' : 'running', progress: remote.progress, actualSeconds: remote.seconds, actualSize: remote.size, sizeMapping: remote.sizeMapping, error: '' })
  return false
}
const wait = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException('已暂停', 'AbortError')); return }
  const timer = window.setTimeout(resolve, milliseconds)
  signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('已暂停', 'AbortError')) }, { once: true })
})
const poll = async (localId: string) => {
  if (pollers.has(localId)) return
  const controller = new AbortController()
  pollers.set(localId, controller)
  let attempts = 0
  try {
    const row = await get(localId)
    if (!row?.videoId) return
    if (row.connectionMode !== connectionMode.value) throw new Error(`请切换到${row.connectionMode === 'web' ? '网页直连' : 'App 直连'}后继续查询`)
    while (!controller.signal.aborted) {
      try {
        const remote = await queryAgnesVideo(taskClient(row), row.videoId)
        if (await setTaskStatusFromRemote(localId, remote)) return
        attempts += 1
        const delay = attempts < 10 ? 8000 : attempts < 30 ? 15000 : 30000
        await wait(delay, controller.signal)
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') throw error
        if (error instanceof AgnesApiError && (error.status === 429 || [500, 502, 503, 520].includes(error.status))) {
          const delay = Math.max((error.retryAfterSeconds || 0) * 1000, 15000)
          await patch(localId, { status: 'running', error: `${error.message}；将在 ${Math.round(delay / 1000)} 秒后自动重试。` })
          await wait(delay, controller.signal)
          continue
        }
        throw error
      }
    }
  } catch (error) {
    if ((error as Error)?.name !== 'AbortError') {
      const message = error instanceof Error ? error.message : '查询中断'
      await patch(localId, { status: 'paused', error: message }).catch(() => undefined)
      errorText.value = message
    }
  } finally { pollers.delete(localId) }
}
const submit = async () => {
  clearFeedback()
  if (connectionMode.value === 'app' && !nativeApp) { errorText.value = 'App 直连需要在安装后的 Android 或 iOS App 中使用'; return }
  const id = `agnes_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  busy.value = true
  try {
    validateAgnesInput(input.value)
    await save({ id, status: 'submitting', progress: 0, createdAt: Date.now(), updatedAt: Date.now(), baseUrl: config.baseUrl, connectionMode: connectionMode.value, project: projectName.value.trim() || '默认作品集', input: JSON.parse(JSON.stringify(input.value)) })
    const remote = await createAgnesVideo(client(), input.value)
    await patch(id, { taskId: remote.taskId, videoId: remote.videoId, status: remote.status === 'in_progress' ? 'running' : 'queued', progress: remote.progress, actualSeconds: remote.seconds, actualSize: remote.size, sizeMapping: remote.sizeMapping })
    notice.value = '任务已提交，可以离开页面；返回后会继续查询。'
    void poll(id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agnes 视频提交失败'
    await patch(id, { status: 'failed', error: message }).catch(() => undefined)
    errorText.value = message
  } finally { busy.value = false }
}
const pauseTask = async (task: AgnesLocalTask) => {
  pollers.get(task.id)?.abort()
  await patch(task.id, { status: 'paused', error: '仅暂停本机查询，Agnes 云端任务可能仍在继续生成。' })
  notice.value = '已暂停本机查询，没有取消 Agnes 云端任务。'
}
const resumeTask = (task: AgnesLocalTask) => {
  clearFeedback()
  if (task.connectionMode !== connectionMode.value) { errorText.value = `请先切换到${task.connectionMode === 'web' ? '网页直连' : 'App 直连'}`; return }
  if (!apiKey.value.trim()) { errorText.value = '请填写这个任务原来使用的 Agnes API Key'; return }
  void patch(task.id, { status: 'queued', error: '' }).then(() => poll(task.id))
}
const reuseTask = (task: AgnesLocalTask) => {
  prompt.value = task.input.prompt
  negativePrompt.value = task.input.negativePrompt || ''
  mode.value = task.input.mode
  imageUrls.value = [...task.input.imageUrls]
  Object.assign(config, { resolution: task.input.resolution, ratio: task.input.ratio, numFrames: task.input.numFrames, frameRate: task.input.frameRate, seed: task.input.seed === undefined ? '' : String(task.input.seed), inferenceSteps: task.input.inferenceSteps === undefined ? '' : String(task.input.inferenceSteps) })
  projectName.value = task.project || '默认作品集'
  activeTab.value = 'create'
  notice.value = '已带入原作品的描述、参数和图片地址。'
}
const downloadTask = async (task: AgnesLocalTask) => {
  clearFeedback()
  if (!task.videoUrl) return
  if (connectionMode.value === 'web') { downloadWebVideo(task.videoUrl, `${task.id}.mp4`); return }
  try {
    if (task.localFileUri) { await shareAgnesVideo(task.localFileUri); return }
    const file = await downloadAgnesVideo(task.id, task.videoUrl)
    await patch(task.id, { localFilePath: file.path, localFileUri: file.uri, localWebUrl: file.webUrl })
    await shareAgnesVideo(file.uri)
  } catch (error) { errorText.value = error instanceof Error ? error.message : '视频保存失败' }
}
const confirmDelete = async () => {
  if (!deletingTask.value) return
  pollers.get(deletingTask.value.id)?.abort()
  await removeAgnesVideoFile(deletingTask.value.localFilePath)
  await remove(deletingTask.value.id)
  deletingTask.value = null
  notice.value = '本地作品记录已删除；这不会删除 Agnes 云端任务或文件。'
}
const saveConnection = async () => {
  clearFeedback()
  try {
    if (connectionMode.value === 'app') {
      if (!nativeApp) throw new Error('请在安装后的 App 中保存系统密钥')
      await setSecureValue('agnes_api_key', apiKey.value.trim())
      notice.value = apiKey.value.trim() ? 'Agnes API Key 已保存到系统安全存储。' : '已移除系统中保存的 Agnes API Key。'
    } else {
      if (rememberKey.value) localStorage.setItem('app_agnes_web_api_key', apiKey.value.trim())
      notice.value = rememberKey.value ? '网页密钥已保存在当前浏览器。' : '网页密钥只在当前页面会话中使用。'
    }
  } catch (error) { errorText.value = error instanceof Error ? error.message : '连接设置保存失败' }
}
const statusLabel = (task: AgnesLocalTask) => ({ submitting: '提交中', queued: '排队中', running: '生成中', paused: '查询已暂停', completed: '已完成', failed: '失败' }[task.status])

onMounted(async () => {
  await load()
  if (nativeApp && connectionMode.value === 'app') apiKey.value = (await getSecureValue('agnes_api_key')) || ''
  keyReady.value = true
  for (const task of activeTasks.value) {
    if (task.connectionMode === connectionMode.value && task.videoId) void poll(task.id)
    else await patch(task.id, { status: 'paused', error: `切换到${task.connectionMode === 'web' ? '网页直连' : 'App 直连'}后可继续查询。` })
  }
})
onUnmounted(() => pollers.forEach(controller => controller.abort()))
</script>

<template>
  <div class="agnes-hall" :class="{ dark: globalSettings.darkMode }">
    <header class="hall-header">
      <button class="icon-button" type="button" aria-label="返回视频引擎" @click="$emit('back')"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button>
      <div class="header-copy"><h1>Agnes Video</h1><p>短视频、图片动画与关键帧过渡</p></div>
      <button class="icon-button" type="button" aria-label="连接设置" @click="settingsOpen = !settingsOpen"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.37.35.7.6 1 .3.3.68.45 1.1.45h.1v4h-.1A1.7 1.7 0 0 0 19.4 15Z"/></svg></button>
    </header>

    <nav class="hall-tabs"><button :class="{ active: activeTab === 'create' }" @click="activeTab = 'create'">创作</button><button :class="{ active: activeTab === 'works' }" @click="activeTab = 'works'">作品 <span v-if="tasks.length">{{ tasks.length }}</span></button><button :class="{ active: activeTab === 'ideas' }" @click="activeTab = 'ideas'">灵感</button></nav>

    <main class="hall-scroll">
      <p v-if="notice" class="page-message">{{ notice }}</p>
      <p v-if="errorText" class="page-error">{{ errorText }}</p>

      <section v-if="settingsOpen" class="panel settings-panel">
        <div class="section-heading"><div><small>连接设置</small><h2>Agnes API</h2></div><span class="model-pill">{{ AGNES_VIDEO_MODEL }}</span></div>
        <div class="connection-tabs"><button :class="{ active: connectionMode === 'web' }" @click="connectionMode = 'web'">网页直连</button><button :class="{ active: connectionMode === 'app' }" @click="connectionMode = 'app'">App 直连</button></div>
        <label class="field"><span>API 地址</span><input v-model.trim="config.baseUrl" inputmode="url" autocomplete="off" :placeholder="AGNES_DEFAULT_BASE_URL"><small>创建任务使用 /v1/videos，结果会按同一站点的 /agnesapi 查询。</small></label>
        <label class="field"><span>API Key</span><div class="input-action"><input v-model="apiKey" :type="showKey ? 'text' : 'password'" autocomplete="off" placeholder="填写 Agnes API Key"><button type="button" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button></div></label>
        <label v-if="connectionMode === 'web'" class="switch-row"><span><b>记住网页密钥</b><small>关闭时仅保留在当前页面会话</small></span><input v-model="rememberKey" type="checkbox"><i></i></label>
        <p class="privacy-note">{{ connectionMode === 'web' ? '浏览器会直接向 Agnes 发送密钥、提示词和图片地址；网页能否直连取决于接口 CORS。' : '密钥保存在 Android/iOS 系统安全存储中，请求由 App 直接发出。' }}</p>
        <button class="secondary-button" type="button" :disabled="!keyReady" @click="saveConnection">保存连接设置</button>
      </section>

      <template v-if="activeTab === 'create'">
        <section class="panel create-section">
          <div class="section-heading"><div><small>创作方式</small><h2>{{ modeDescription }}</h2></div><span class="model-pill">{{ estimatedSeconds }} 秒</span></div>
          <div class="mode-tabs"><button v-for="item in AGNES_MODES" :key="item.value" :class="{ active: mode === item.value }" @click="changeMode(item.value)">{{ item.label }}</button></div>
          <div v-if="mode !== 'text'" class="image-addresses">
            <label v-for="(_, index) in imageUrls" :key="index" class="field image-field"><span>{{ imageLabel(index) }}</span><input v-model.trim="imageUrls[index]" inputmode="url" placeholder="https://..."><small>需为 Agnes 可公开读取的 HTTPS 图片地址</small><img v-if="/^https:\/\//i.test(imageUrls[index])" :src="imageUrls[index]" :alt="imageLabel(index)" @error="($event.target as HTMLImageElement).style.display='none'" @load="($event.target as HTMLImageElement).style.display='block'"></label>
          </div>
        </section>

        <section class="panel create-section">
          <div class="section-heading"><div><small>视频描述</small><h2>主体、动作、场景、运镜、光线与风格</h2></div><span class="counter">{{ prompt.length }}/3000</span></div>
          <textarea v-model="prompt" maxlength="3000" rows="7" placeholder="描述你希望生成的视频。图生视频时说明哪些部分要动、哪些特征要保持稳定。"></textarea>
          <div class="chips"><button v-for="item in templates" :key="item.name" type="button" @click="useTemplate(item.prompt)">{{ item.name }}</button><button type="button" @click="savePrompt">保存方案</button></div>
        </section>

        <section class="panel create-section">
          <div class="section-heading"><div><small>输出参数</small><h2>画面规格与时长</h2></div><span class="model-pill">服务器可能标准化尺寸</span></div>
          <div class="parameter-grid"><label class="field"><span>分辨率</span><select v-model="config.resolution"><option>480p</option><option>720p</option><option>1080p</option></select></label><label class="field"><span>画面比例</span><select v-model="config.ratio"><option v-for="ratio in AGNES_RATIOS" :key="ratio">{{ ratio }}</option></select></label><label class="field full"><span>作品集</span><input v-model="projectName" maxlength="40" placeholder="默认作品集"></label></div>
          <div class="duration-grid"><button v-for="item in AGNES_FRAME_PRESETS" :key="item.frames" :class="{ active: config.numFrames === item.frames && config.frameRate === 24 }" @click="selectFramePreset(item.frames)"><strong>{{ item.label }}</strong><small>{{ item.frames }} 帧</small></button></div>
          <button class="advanced-toggle" type="button" @click="advancedOpen = !advancedOpen"><span>高级控制</span><svg viewBox="0 0 24 24" :class="{ open: advancedOpen }"><path d="m6 9 6 6 6-6"/></svg></button>
          <div v-if="advancedOpen" class="advanced-body">
            <label class="field full"><span>负向提示词</span><textarea v-model="negativePrompt" maxlength="3000" rows="4" placeholder="描述不希望出现的内容"></textarea><div class="chips compact"><button v-for="item in negativeTemplates" :key="item" type="button" @click="useNegativeTemplate(item)">使用建议</button></div></label>
            <div class="parameter-grid"><label class="field"><span>帧数</span><input v-model.number="config.numFrames" type="number" min="1" max="441" step="8"><small>不超过 441，且满足 8n+1</small></label><label class="field"><span>帧率</span><input v-model.number="config.frameRate" type="number" min="1" max="60" step="1"><small>1–60 FPS</small></label><label class="field"><span>Seed</span><div class="input-action"><input v-model="config.seed" type="number" min="0" step="1" placeholder="随机"><button type="button" @click="randomizeSeed">随机</button></div></label><label class="field"><span>推理步数</span><input v-model="config.inferenceSteps" type="number" min="1" step="1" placeholder="由服务决定"><small>留空使用 Agnes 默认值</small></label></div>
          </div>
          <div class="generation-note"><span>{{ config.resolution }}</span><span>{{ config.ratio }}</span><span>{{ config.numFrames }} 帧</span><span>{{ config.frameRate }} FPS</span><span>预计 {{ estimatedSeconds }} 秒</span></div>
        </section>

        <p v-if="keyReady && !apiKey.trim()" class="generate-hint">请先从右上角连接设置填写 Agnes API Key。</p>
        <p v-else-if="connectionMode === 'app' && !nativeApp" class="generate-hint">App 直连只能在安装后的 Android 或 iOS App 中使用。</p>
        <button class="generate-button" type="button" :disabled="!canGenerate" @click="submit"><i v-if="busy" class="spinner"></i>{{ busy ? '正在提交…' : '生成 Agnes 视频' }}</button>

        <section v-if="activeTasks.length" class="panel running-section"><div class="section-heading"><div><small>正在进行</small><h2>{{ activeTasks.length }} 个 Agnes 任务</h2></div></div><div v-for="task in activeTasks" :key="task.id" class="running-card"><div class="running-indicator"><span></span></div><div class="task-copy"><strong>{{ statusLabel(task) }} · {{ task.progress }}%</strong><p>{{ task.input.prompt }}</p><small>{{ task.actualSize || task.input.resolution }} · {{ task.actualSeconds || estimateAgnesSeconds(task.input.numFrames, task.input.frameRate) }} 秒</small></div><button type="button" @click="pauseTask(task)">暂停查询</button></div></section>
      </template>

      <section v-else-if="activeTab === 'ideas'" class="ideas-list">
        <article v-for="item in templates" :key="item.name" class="panel idea-card"><div><small>内置灵感</small><h2>{{ item.name }}</h2></div><p>{{ item.prompt }}</p><button type="button" @click="useTemplate(item.prompt)">使用</button></article>
        <article v-for="(item, index) in savedPrompts" :key="`${item.name}-${index}`" class="panel idea-card"><div><small>我的方案</small><h2>{{ item.name }}</h2></div><p>{{ item.prompt }}</p><div class="idea-actions"><button type="button" @click="useTemplate(item.prompt)">使用</button><button class="danger-text" type="button" @click="removePrompt(index)">删除</button></div></article>
        <div v-if="!savedPrompts.length" class="saved-hint"><p>创作页保存的视频描述会出现在这里。</p></div>
      </section>

      <section v-else class="works-list">
        <section v-if="tasks.length" class="panel filter-panel"><label class="field"><span>作品集</span><select v-model="projectFilter"><option>全部</option><option v-for="name in projectNames" :key="name">{{ name }}</option></select></label></section>
        <article v-for="task in visibleTasks" :key="task.id" class="work-card">
          <div class="work-media" :class="{ portrait: task.input.ratio === '9:16' || task.input.ratio === '3:4' }"><video v-if="task.videoUrl || task.localWebUrl" :src="task.localWebUrl || task.videoUrl" controls playsinline></video><div v-else class="work-placeholder"><i v-if="task.status === 'queued' || task.status === 'running'" class="spinner"></i><strong>{{ statusLabel(task) }}</strong><small>{{ task.progress }}%</small></div><span class="status-badge" :class="task.status">{{ statusLabel(task) }}</span></div>
          <div class="work-info"><strong>{{ task.input.prompt }}</strong><p>{{ task.project }} · {{ task.input.resolution }} · {{ task.input.ratio }} · 请求 {{ estimateAgnesSeconds(task.input.numFrames, task.input.frameRate) }} 秒</p><p v-if="task.actualSize || task.actualSeconds">实际输出 {{ task.actualSize || '未知尺寸' }} · {{ task.actualSeconds ?? '未知' }} 秒</p><p v-if="task.sizeMapping?.adjusted" class="mapping-note">Agnes 已将请求尺寸映射为 {{ task.sizeMapping.resolution || task.actualSize }}</p><p v-if="task.error" class="task-error">{{ task.error }}</p><div class="work-actions"><button v-if="task.videoUrl" @click="downloadTask(task)">{{ task.localFileUri ? '分享/保存' : '下载' }}</button><button v-if="['paused', 'queued', 'running'].includes(task.status)" @click="resumeTask(task)">继续查询</button><button @click="reuseTask(task)">复用参数</button><button class="danger" @click="deletingTask = task">删除</button></div></div>
        </article>
        <div v-if="!visibleTasks.length" class="empty-works"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4zM8 3v3m8-3v3M8 18v3m8-3v3"/></svg><h2>还没有 Agnes 作品</h2><p>从文字、公开图片或两张关键帧开始创作，提交后可以离开页面。</p><button type="button" @click="activeTab = 'create'">开始创作</button></div>
      </section>
    </main>

    <Transition name="sheet"><div v-if="deletingTask" class="sheet-overlay" @click.self="deletingTask = null"><section class="confirm-sheet"><h2>删除本地作品记录？</h2><p>会同时删除 App 内已下载的本地文件，但不会删除 Agnes 云端任务或远程视频。</p><div><button @click="deletingTask = null">保留</button><button class="danger" @click="confirmDelete">删除</button></div></section></div></Transition>
  </div>
</template>

<style scoped>
.agnes-hall{--bg:#f7f7f5;--surface:#fff;--soft:#efefec;--line:rgba(20,20,20,.08);--text:#1d1d1f;--sub:#777773;--muted:#a0a09a;--accent:#20201f;position:absolute;inset:0;z-index:1000;display:flex;min-width:0;overflow:hidden;flex-direction:column;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;-webkit-tap-highlight-color:transparent}.agnes-hall.dark{--bg:#19191b;--surface:#242426;--soft:#303033;--line:rgba(255,255,255,.09);--text:#f4f4f1;--sub:#aaa;--muted:#7f7f7b;--accent:#f2f2ee}.hall-header{display:flex;flex:0 0 auto;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top) + 12px) 18px 9px}.header-copy{min-width:0;flex:1;text-align:center}.header-copy h1{overflow:hidden;margin:0;font-size:20px;font-weight:680;letter-spacing:-.4px;white-space:nowrap;text-overflow:ellipsis}.header-copy p{overflow:hidden;margin:4px 0 0;color:var(--sub);font-size:10px;white-space:nowrap;text-overflow:ellipsis}.icon-button{display:grid;width:35px;height:35px;flex:0 0 auto;padding:0;border:0;border-radius:50%;background:transparent;color:inherit;place-items:center}.icon-button:active{background:var(--soft)}.icon-button svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.hall-tabs{display:flex;gap:5px;margin:2px 18px 10px;padding:3px;border-radius:12px;background:var(--soft)}.hall-tabs button{display:flex;min-width:0;flex:1;align-items:center;justify-content:center;gap:5px;padding:8px;border:0;border-radius:9px;background:transparent;color:var(--sub);font-size:12px;font-weight:600}.hall-tabs button.active{background:var(--surface);color:var(--text);box-shadow:0 2px 8px rgba(0,0,0,.05)}.hall-tabs span{min-width:15px;padding:1px 4px;border-radius:8px;background:var(--soft);font-size:8px}.hall-scroll{min-width:0;min-height:0;flex:1;overflow-y:auto;padding:0 18px calc(28px + env(safe-area-inset-bottom));box-sizing:border-box;overscroll-behavior:contain}.panel,.work-card{min-width:0;margin-bottom:12px;border:1px solid var(--line);border-radius:17px;background:var(--surface)}.settings-panel,.create-section,.running-section,.filter-panel,.idea-card{padding:14px}.page-message,.page-error{margin:3px 0 10px;padding:9px 11px;border-radius:11px;font-size:10px;line-height:1.45}.page-message{background:#eaf5ed;color:#397148}.page-error{background:#fff0f0;color:#b64242}.dark .page-message{background:#223429;color:#91c89f}.dark .page-error{background:#3b2527;color:#efaaaa}.section-heading{display:flex;min-width:0;align-items:flex-start;justify-content:space-between;gap:9px;margin-bottom:11px}.section-heading>div{min-width:0}.section-heading small,.idea-card small{color:var(--muted);font-size:8px;font-weight:650;letter-spacing:.7px}.section-heading h2,.idea-card h2{overflow:hidden;margin:3px 0 0;font-size:14px;line-height:1.3;font-weight:660;white-space:nowrap;text-overflow:ellipsis}.model-pill,.counter{flex:0 0 auto;max-width:42%;overflow:hidden;padding:5px 7px;border-radius:9px;background:var(--soft);color:var(--sub);font-size:8px;font-weight:650;white-space:nowrap;text-overflow:ellipsis}.connection-tabs,.mode-tabs{display:flex;gap:5px;margin-bottom:12px}.connection-tabs{padding:3px;border-radius:11px;background:var(--soft)}.connection-tabs button{flex:1;padding:8px;border:0;border-radius:8px;background:transparent;color:var(--sub);font-size:10px;font-weight:620}.connection-tabs button.active{background:var(--surface);color:var(--text)}.mode-tabs{overflow-x:auto;scrollbar-width:none}.mode-tabs button{flex:0 0 auto;padding:7px 12px;border:0;border-radius:100px;background:var(--soft);color:var(--sub);font-size:10px;font-weight:620}.mode-tabs button.active{background:var(--accent);color:var(--bg)}.field{display:flex;min-width:0;flex-direction:column;gap:5px;margin-top:10px}.field>span{color:var(--sub);font-size:9px;font-weight:620}.field>small{color:var(--muted);font-size:8px;line-height:1.4}input,select,textarea{width:100%;min-width:0;padding:9px 10px;border:0;border-radius:10px;box-sizing:border-box;appearance:none;background:var(--soft);color:var(--text);font:inherit;font-size:10px;outline:none}input,select{min-height:35px}select{padding-right:23px;background-image:linear-gradient(45deg,transparent 50%,var(--sub) 50%),linear-gradient(135deg,var(--sub) 50%,transparent 50%);background-position:calc(100% - 13px) 15px,calc(100% - 9px) 15px;background-repeat:no-repeat;background-size:4px 4px}textarea{resize:vertical;line-height:1.6}.create-section>textarea{min-height:125px;font-size:11px}.input-action{display:flex;min-width:0;gap:6px}.input-action input{flex:1}.input-action button,.secondary-button,.work-actions button,.running-card>button,.idea-card button{flex:0 0 auto;padding:8px 10px;border:0;border-radius:9px;background:var(--soft);color:var(--text);font-size:9px;font-weight:620}.switch-row{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px}.switch-row span{display:flex;min-width:0;flex-direction:column;gap:2px}.switch-row b{font-size:10px}.switch-row small,.privacy-note{color:var(--muted);font-size:8px;line-height:1.45}.switch-row input{position:absolute;right:0;width:38px;height:22px;opacity:0;cursor:pointer}.switch-row i{position:relative;width:38px;height:22px;flex:0 0 auto;border-radius:12px;background:var(--soft);transition:.2s;pointer-events:none}.switch-row i:after{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:var(--sub);content:"";transition:.2s}.switch-row input:checked+i{background:var(--accent)}.switch-row input:checked+i:after{transform:translateX(16px);background:var(--bg)}.privacy-note{margin:10px 0}.secondary-button{width:100%}.image-addresses{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.image-addresses .image-field:only-child{grid-column:1/-1}.image-field img{width:100%;height:125px;border-radius:11px;background:var(--soft);object-fit:cover}.chips{display:flex;gap:6px;overflow-x:auto;margin-top:8px;padding-bottom:2px;scrollbar-width:none}.chips button{flex:0 0 auto;padding:6px 9px;border:0;border-radius:9px;background:var(--soft);color:var(--sub);font-size:8px;font-weight:620}.chips.compact{margin-top:2px}.parameter-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 8px}.parameter-grid .full{grid-column:1/-1}.duration-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:12px}.duration-grid button{min-width:0;padding:8px 3px;border:1px solid transparent;border-radius:10px;background:var(--soft);color:var(--text)}.duration-grid button.active{border-color:var(--text);background:var(--surface)}.duration-grid strong,.duration-grid small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.duration-grid strong{font-size:9px}.duration-grid small{margin-top:3px;color:var(--muted);font-size:7px}.advanced-toggle{display:flex;width:100%;align-items:center;justify-content:space-between;margin-top:11px;padding:9px 1px;border:0;border-top:1px solid var(--line);background:transparent;color:var(--sub);font-size:9px}.advanced-toggle svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;transition:.2s}.advanced-toggle svg.open{transform:rotate(180deg)}.advanced-body{padding-top:1px}.generation-note{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.generation-note span{padding:4px 6px;border-radius:7px;background:var(--soft);color:var(--muted);font-size:7px}.generate-button{display:flex;width:100%;align-items:center;justify-content:center;gap:7px;margin-bottom:12px;padding:13px;border:0;border-radius:14px;background:var(--accent);color:var(--bg);font-size:11px;font-weight:680}.generate-button:disabled,.secondary-button:disabled{opacity:.42}.spinner{width:12px;height:12px;border:1.7px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite}.running-card{display:flex;min-width:0;align-items:center;gap:8px;padding:9px 0;border-top:1px solid var(--line)}.running-indicator{display:grid;width:24px;height:24px;flex:0 0 auto;border-radius:50%;background:var(--soft);place-items:center}.running-indicator span{width:7px;height:7px;border-radius:50%;background:#63a878;box-shadow:0 0 0 4px rgba(99,168,120,.15);animation:pulse 1.6s ease-in-out infinite}.task-copy{min-width:0;flex:1}.task-copy strong{font-size:9px}.task-copy p{overflow:hidden;margin:3px 0;color:var(--sub);font-size:8px;white-space:nowrap;text-overflow:ellipsis}.task-copy small{color:var(--muted);font-size:7px}.ideas-list,.works-list{display:grid;gap:0}.idea-card p{margin:8px 0;color:var(--sub);font-size:9px;line-height:1.55}.idea-card>button,.idea-actions{margin-top:4px}.idea-actions{display:flex;gap:6px}.idea-actions .danger-text{color:#b74343}.saved-hint{padding:4px 10px 20px;color:var(--muted);font-size:9px;text-align:center}.filter-panel{padding-top:5px}.work-card{overflow:hidden}.work-media{position:relative;display:flex;width:100%;aspect-ratio:16/9;align-items:center;justify-content:center;background:#111}.work-media.portrait{max-height:440px;aspect-ratio:9/16}.work-media video{width:100%;height:100%;object-fit:contain}.work-placeholder{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:#aaa;font-size:9px}.status-badge{position:absolute;top:8px;left:8px;padding:4px 7px;border-radius:8px;background:rgba(20,20,20,.68);color:#fff;font-size:7px}.status-badge.completed{background:rgba(45,112,67,.8)}.status-badge.failed{background:rgba(159,54,54,.8)}.work-info{padding:11px 12px}.work-info>strong{display:block;overflow:hidden;font-size:10px;line-height:1.4;white-space:nowrap;text-overflow:ellipsis}.work-info p{margin:4px 0 0;color:var(--muted);font-size:8px;line-height:1.4}.work-info .mapping-note{color:#7a6a3c}.work-info .task-error{color:#b84a4a;font-size:9px}.work-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.work-actions .danger{margin-left:auto;background:#fff0f0;color:#b74343}.dark .work-actions .danger{background:#3b2527;color:#efaaaa}.empty-works{display:flex;min-height:55vh;align-items:center;justify-content:center;flex-direction:column;text-align:center}.empty-works svg{width:40px;height:40px;fill:none;stroke:var(--muted);stroke-width:1.2}.empty-works h2{margin:13px 0 5px;font-size:14px}.empty-works p{max-width:250px;margin:0;color:var(--sub);font-size:9px;line-height:1.6}.empty-works button{margin-top:13px;padding:9px 14px;border:0;border-radius:10px;background:var(--accent);color:var(--bg);font-size:9px;font-weight:650}.sheet-overlay{position:fixed;inset:0;z-index:1200;display:flex;align-items:flex-end;justify-content:center;padding:12px;box-sizing:border-box;background:rgba(0,0,0,.3);backdrop-filter:blur(5px)}.confirm-sheet{width:min(100%,430px);padding:20px 18px calc(18px + env(safe-area-inset-bottom));border-radius:22px;background:var(--surface);box-sizing:border-box;text-align:center}.confirm-sheet h2{margin:0;font-size:14px}.confirm-sheet p{margin:8px auto 16px;color:var(--sub);font-size:9px;line-height:1.55}.confirm-sheet>div{display:grid;grid-template-columns:1fr 1fr;gap:8px}.confirm-sheet button{padding:10px;border:0;border-radius:11px;background:var(--soft);color:var(--text);font-size:10px;font-weight:650}.confirm-sheet button.danger{background:#c84b4b;color:#fff}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{50%{opacity:.45;transform:scale(.8)}}.sheet-enter-active,.sheet-leave-active{transition:opacity .2s}.sheet-enter-active .confirm-sheet,.sheet-leave-active .confirm-sheet{transition:transform .23s}.sheet-enter-from,.sheet-leave-to{opacity:0}.sheet-enter-from .confirm-sheet,.sheet-leave-to .confirm-sheet{transform:translateY(24px)}
input:focus,select:focus,textarea:focus{box-shadow:inset 0 0 0 1px var(--text)}.generate-hint{margin:0 2px 7px;color:var(--sub);font-size:8px;line-height:1.45;text-align:center}
@media(max-width:390px){.hall-header{padding-left:14px;padding-right:14px}.hall-tabs{margin-left:14px;margin-right:14px}.hall-scroll{padding-left:14px;padding-right:14px}.settings-panel,.create-section,.running-section,.idea-card{padding:12px}.duration-grid strong{font-size:8px}}
@media(max-width:340px){.header-copy p{max-width:190px;margin-left:auto;margin-right:auto}.hall-tabs button{padding-left:4px;padding-right:4px}.image-addresses{grid-template-columns:1fr}.image-addresses .image-field{grid-column:1}.duration-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.parameter-grid{grid-template-columns:1fr}.parameter-grid .full{grid-column:1}.running-card{align-items:flex-start}.running-card>button{padding-left:7px;padding-right:7px}}
</style>
