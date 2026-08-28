<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { App } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'
import { globalSettings } from '../../store/global'
import { getSecureValue, isNativeMobileApp, setSecureValue } from '../../services/mobileSecureStorage'
import {
  SEEDANCE_DEFAULT_BASE_URL,
  SEEDANCE_MODEL,
  SEEDANCE_MODES,
  downloadSeedanceVideo,
  querySeedanceTask,
  removeSeedanceVideoFile,
  resolveSeedanceVideoUrl,
  shareSeedanceVideo,
  submitSeedanceGeneration,
  validateSeedanceInput,
  type SeedanceGenerationInput,
  type SeedanceMedia,
  type SeedanceMediaRole,
  type SeedanceMode,
  type SeedanceRatio,
  type SeedanceResolution
} from '../../services/seedanceVideo'
import { useSeedanceVideoHistory, type SeedanceTaskStatus, type SeedanceVideoTask } from '../../composables/useSeedanceVideoHistory'

defineEmits<{ (event: 'back'): void }>()

interface ImageAsset {
  id: string
  file: File
  previewUrl: string
  dataUrl: string
}

interface AudioAsset {
  id: string
  file: File
  dataUrl: string
  duration: number
}

interface UrlAsset {
  id: string
  role: 'reference_image' | 'reference_video' | 'reference_audio'
  url: string
}

const storage = (key: string, fallback: string) => localStorage.getItem(key) || fallback
const nativeApp = isNativeMobileApp()
const storedDuration = Number(storage('app_seedance_video_duration', '10'))
const config = reactive({
  baseUrl: storage('app_seedance_video_base_url', SEEDANCE_DEFAULT_BASE_URL),
  resolution: storage('app_seedance_video_resolution', '720p') as SeedanceResolution,
  ratio: storage('app_seedance_video_ratio', '16:9') as SeedanceRatio,
  duration: Number.isInteger(storedDuration) && storedDuration >= 4 && storedDuration <= 30 ? storedDuration : 10,
  generateAudio: storage('app_seedance_video_audio', 'true') !== 'false',
  watermark: storage('app_seedance_video_watermark', 'false') === 'true',
  returnLastFrame: storage('app_seedance_video_last_frame', 'true') !== 'false',
  seed: storage('app_seedance_video_seed', '')
})

const apiKey = ref('')
const savedApiKey = ref('')
const keyReady = ref(false)
const keySaving = ref(false)
const prompt = ref(storage('app_seedance_video_prompt', ''))
const mode = ref<SeedanceMode>('text')
const activeTab = ref<'create' | 'works'>('create')
const showSettings = ref(false)
const showApiKey = ref(false)
const isSubmitting = ref(false)
const pageMessage = ref('')
const pageError = ref('')
const firstFrame = ref<ImageAsset | null>(null)
const lastFrame = ref<ImageAsset | null>(null)
const referenceImages = ref<ImageAsset[]>([])
const referenceAudios = ref<AudioAsset[]>([])
const urlAssets = ref<UrlAsset[]>([])
const editVideoUrl = ref('')
const extensionVideoUrl = ref('')
const pendingDelete = ref<SeedanceVideoTask | null>(null)
const pollingControllers = new Map<string, AbortController>()
let appStateHandle: PluginListenerHandle | null = null

const { tasks, loadSeedanceTasks, saveSeedanceTask, patchSeedanceTask, getSeedanceTask, removeSeedanceTask } = useSeedanceVideoHistory()

watch(config, value => {
  localStorage.setItem('app_seedance_video_base_url', value.baseUrl)
  localStorage.setItem('app_seedance_video_resolution', value.resolution)
  localStorage.setItem('app_seedance_video_ratio', value.ratio)
  localStorage.setItem('app_seedance_video_duration', String(value.duration))
  localStorage.setItem('app_seedance_video_audio', String(value.generateAudio))
  localStorage.setItem('app_seedance_video_watermark', String(value.watermark))
  localStorage.setItem('app_seedance_video_last_frame', String(value.returnLastFrame))
  localStorage.setItem('app_seedance_video_seed', value.seed)
}, { deep: true })
watch(prompt, value => localStorage.setItem('app_seedance_video_prompt', value))

const activeTasks = computed(() => tasks.value.filter(task => ['submitting', 'queued', 'running', 'downloading'].includes(task.status)))
const apiKeyStored = computed(() => Boolean(savedApiKey.value) && apiKey.value.trim() === savedApiKey.value)
const canGenerate = computed(() => nativeApp && keyReady.value && Boolean(apiKey.value.trim()) && !isSubmitting.value)
const promptCount = computed(() => prompt.value.length)
const isRatioLocked = computed(() => mode.value === 'edit' || mode.value === 'extension')
const selectedMode = computed(() => SEEDANCE_MODES.find(item => item.value === mode.value)!)
const visibleUrlAssets = computed(() => mode.value === 'audio'
  ? urlAssets.value.filter(item => item.role === 'reference_audio')
  : urlAssets.value)

const modeLabel = (value: SeedanceMode) => SEEDANCE_MODES.find(item => item.value === value)?.label || value
const statusLabel = (status: SeedanceTaskStatus) => ({
  submitting: '提交中', queued: '排队中', running: '生成中', paused: '已暂停', downloading: '保存中',
  completed: '已完成', failed: '失败', cancelled: '已取消', expired: '已过期'
}[status])
const formatTime = (value: number) => new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(value)
const videoUrl = (task: SeedanceVideoTask) => resolveSeedanceVideoUrl(task.localFileUri)
const isPortrait = (ratio?: SeedanceRatio) => ratio === '9:16' || ratio === '3:4'

const clearNotice = () => { pageMessage.value = ''; pageError.value = '' }

const chooseMode = (value: SeedanceMode) => {
  clearNotice()
  mode.value = value
  if (value === 'edit' || value === 'extension') config.ratio = 'adaptive'
}

const saveApiKey = async () => {
  if (!nativeApp) return
  keySaving.value = true
  clearNotice()
  try {
    await setSecureValue('seedance_ark_api_key', apiKey.value.trim())
    savedApiKey.value = apiKey.value.trim()
    pageMessage.value = apiKey.value.trim() ? 'API Key 已保存到系统安全存储。' : '已移除保存的 API Key。'
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'API Key 保存失败'
  } finally {
    keySaving.value = false
  }
}

const fileToDataUrl = (file: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('素材读取失败'))
  reader.readAsDataURL(file)
})

const readImageSize = (file: File) => new Promise<{ width: number; height: number }>((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(url) }
  image.onerror = () => { reject(new Error('无法读取这张图片')); URL.revokeObjectURL(url) }
  image.src = url
})

const prepareImage = async (file?: File): Promise<ImageAsset> => {
  if (!file) throw new Error('没有选择图片')
  const allowed = /\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name) || ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif'].includes(file.type)
  if (!allowed) throw new Error('图片支持 JPG、PNG、WEBP、BMP 或 GIF')
  if (file.size > 30 * 1024 * 1024) throw new Error('单张图片不能超过 30MB')
  const { width, height } = await readImageSize(file)
  if (width < 300 || height < 300 || width > 6000 || height > 6000) throw new Error('图片宽高需在 300 到 6000 像素之间')
  const ratio = width / height
  if (ratio < 0.4 || ratio > 2.5) throw new Error('图片宽高比需在 0.4 到 2.5 之间')
  return {
    id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    dataUrl: await fileToDataUrl(file)
  }
}

const readAudioDuration = (file: File) => new Promise<number>((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const audio = document.createElement('audio')
  audio.preload = 'metadata'
  audio.onloadedmetadata = () => { const value = audio.duration; URL.revokeObjectURL(url); Number.isFinite(value) ? resolve(value) : reject(new Error('无法读取音频时长')) }
  audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取这个音频文件')) }
  audio.src = url
})

const prepareAudio = async (file?: File): Promise<AudioAsset> => {
  if (!file) throw new Error('没有选择音频')
  if (!/\.(mp3|wav)$/i.test(file.name) && !['audio/mpeg', 'audio/wav', 'audio/x-wav'].includes(file.type)) throw new Error('音频仅支持 MP3 或 WAV')
  if (file.size > 15 * 1024 * 1024) throw new Error('单个音频不能超过 15MB')
  const duration = await readAudioDuration(file)
  if (duration < 2 || duration > 30.05) throw new Error('单个音频时长需在 2 到 30 秒之间')
  const rawDataUrl = await fileToDataUrl(file)
  const mimeType = /\.wav$/i.test(file.name) ? 'audio/wav' : 'audio/mpeg'
  const dataUrl = rawDataUrl.replace(/^data:[^;]+;/i, `data:${mimeType};`)
  return { id: `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, file, duration, dataUrl }
}

const selectFrame = async (kind: 'first' | 'last', event: Event) => {
  clearNotice()
  const input = event.target as HTMLInputElement
  try {
    const asset = await prepareImage(input.files?.[0])
    const target = kind === 'first' ? firstFrame : lastFrame
    if (target.value) URL.revokeObjectURL(target.value.previewUrl)
    target.value = asset
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : '图片选择失败'
  } finally { input.value = '' }
}

const clearFrame = (kind: 'first' | 'last') => {
  const target = kind === 'first' ? firstFrame : lastFrame
  if (target.value) URL.revokeObjectURL(target.value.previewUrl)
  target.value = null
}

const selectReferenceImages = async (event: Event) => {
  clearNotice()
  const input = event.target as HTMLInputElement
  try {
    const files = Array.from(input.files || [])
    const remoteCount = urlAssets.value.filter(item => item.role === 'reference_image').length
    if (referenceImages.value.length + remoteCount + files.length > 30) throw new Error('参考图片最多 30 张')
    const added: ImageAsset[] = []
    for (const file of files) added.push(await prepareImage(file))
    referenceImages.value = [...referenceImages.value, ...added]
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : '图片选择失败'
  } finally { input.value = '' }
}

const selectReferenceAudios = async (event: Event) => {
  clearNotice()
  const input = event.target as HTMLInputElement
  try {
    const files = Array.from(input.files || [])
    const remoteCount = urlAssets.value.filter(item => item.role === 'reference_audio').length
    if (referenceAudios.value.length + remoteCount + files.length > 10) throw new Error('参考音频最多 10 段')
    const added: AudioAsset[] = []
    for (const file of files) added.push(await prepareAudio(file))
    referenceAudios.value = [...referenceAudios.value, ...added]
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : '音频选择失败'
  } finally { input.value = '' }
}

const removeReferenceImage = (index: number) => {
  URL.revokeObjectURL(referenceImages.value[index].previewUrl)
  referenceImages.value.splice(index, 1)
}
const removeReferenceAudio = (id: string) => { referenceAudios.value = referenceAudios.value.filter(item => item.id !== id) }

const roleLabel = (role: UrlAsset['role']) => role === 'reference_image' ? '图片' : role === 'reference_video' ? '视频' : '音频'
const addUrlAsset = (role: UrlAsset['role']) => {
  clearNotice()
  const localCount = role === 'reference_image' ? referenceImages.value.length : role === 'reference_audio' ? referenceAudios.value.length : 0
  const current = localCount + urlAssets.value.filter(item => item.role === role).length
  const limit = role === 'reference_image' ? 30 : 10
  if (current >= limit) { pageError.value = `${roleLabel(role)}素材最多 ${limit} 项`; return }
  urlAssets.value.push({ id: `url_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, role, url: '' })
}
const removeUrlAsset = (id: string) => { urlAssets.value = urlAssets.value.filter(item => item.id !== id) }

const referenceChips = computed(() => {
  const chips: Array<{ label: string; token: string }> = []
  let image = 0; let video = 0; let audio = 0
  if (mode.value !== 'audio') for (const item of referenceImages.value) chips.push({ label: item.file.name, token: `@图片${++image}` })
  for (const item of urlAssets.value) {
    if (mode.value !== 'audio' && item.role === 'reference_image') chips.push({ label: item.url || '未填写图片地址', token: `@图片${++image}` })
    if (mode.value !== 'audio' && item.role === 'reference_video') chips.push({ label: item.url || '未填写视频地址', token: `@视频${++video}` })
    if (item.role === 'reference_audio') chips.push({ label: item.url || '未填写音频地址', token: `@音频${++audio}` })
  }
  for (const item of referenceAudios.value) chips.push({ label: item.file.name, token: `@音频${++audio}` })
  return chips
})

const insertReference = (token: string) => {
  prompt.value += `${prompt.value && !/\s$/.test(prompt.value) ? ' ' : ''}${token}`
}

const buildMedia = (): SeedanceMedia[] => {
  if (mode.value === 'image') return firstFrame.value ? [{ role: 'first_frame', url: firstFrame.value.dataUrl, label: firstFrame.value.file.name }] : []
  if (mode.value === 'interpolation') return [
    ...(firstFrame.value ? [{ role: 'first_frame' as const, url: firstFrame.value.dataUrl, label: firstFrame.value.file.name }] : []),
    ...(lastFrame.value ? [{ role: 'last_frame' as const, url: lastFrame.value.dataUrl, label: lastFrame.value.file.name }] : [])
  ]
  if (mode.value === 'references') return [
    ...referenceImages.value.map(item => ({ role: 'reference_image' as const, url: item.dataUrl, label: item.file.name })),
    ...urlAssets.value.filter(item => item.url.trim()).map(item => ({ role: item.role as SeedanceMediaRole, url: item.url.trim(), label: `${roleLabel(item.role)}地址` })),
    ...referenceAudios.value.map(item => ({ role: 'reference_audio' as const, url: item.dataUrl, label: item.file.name }))
  ]
  if (mode.value === 'audio') return [
    ...urlAssets.value.filter(item => item.role === 'reference_audio' && item.url.trim()).map(item => ({ role: 'reference_audio' as const, url: item.url.trim(), label: '音频地址' })),
    ...referenceAudios.value.map(item => ({ role: 'reference_audio' as const, url: item.dataUrl, label: item.file.name }))
  ]
  if (mode.value === 'edit') return editVideoUrl.value.trim() ? [{ role: 'reference_video', url: editVideoUrl.value.trim(), label: '待编辑视频' }] : []
  if (mode.value === 'extension') return extensionVideoUrl.value.trim() ? [{ role: 'reference_video', url: extensionVideoUrl.value.trim(), label: '待延长视频' }] : []
  return []
}

const buildInput = (): SeedanceGenerationInput => {
  if (!nativeApp) throw new Error('请安装 Android 或 iOS App 后使用 Seedance 官方接入')
  if (!apiKey.value.trim()) throw new Error('请先填写火山方舟 API Key')
  const seed = config.seed.trim() === '' ? undefined : Number(config.seed)
  const input: SeedanceGenerationInput = {
    prompt: prompt.value,
    model: SEEDANCE_MODEL,
    mode: mode.value,
    resolution: config.resolution,
    ratio: config.ratio,
    duration: config.duration,
    generateAudio: config.generateAudio,
    watermark: config.watermark,
    returnLastFrame: config.returnLastFrame,
    seed,
    media: buildMedia()
  }
  validateSeedanceInput(input)
  return input
}

const wait = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException('已暂停', 'AbortError')); return }
  const timer = window.setTimeout(resolve, milliseconds)
  signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('已暂停', 'AbortError')) }, { once: true })
})

const completeTask = async (task: SeedanceVideoTask, remote: Awaited<ReturnType<typeof querySeedanceTask>>) => {
  if (!remote.videoUrl) throw new Error('任务已完成，但没有返回视频地址')
  await patchSeedanceTask(task.id, {
    status: 'downloading',
    remoteVideoUrl: remote.videoUrl,
    remoteVideoExpiresAt: Date.now() + 23 * 60 * 60 * 1000,
    lastFrameUrl: remote.lastFrameUrl,
    actualSeed: remote.seed,
    actualResolution: remote.resolution,
    actualRatio: remote.ratio,
    actualDuration: remote.duration,
    framesPerSecond: remote.framesPerSecond,
    usage: remote.usage,
    error: ''
  })
  try {
    const local = await downloadSeedanceVideo(task.remoteTaskId || task.id, remote.videoUrl)
    await patchSeedanceTask(task.id, { status: 'completed', localFilePath: local.path, localFileUri: local.uri, error: '' })
  } catch (error) {
    await patchSeedanceTask(task.id, { status: 'paused', error: `视频已生成，但保存失败：${error instanceof Error ? error.message : '请立即重试保存'}` })
  }
}

const pollTask = async (id: string) => {
  if (!nativeApp || pollingControllers.has(id)) return
  const controller = new AbortController()
  pollingControllers.set(id, controller)
  let transientFailures = 0
  let delay = 4000
  try {
    let task = await getSeedanceTask(id)
    if (!task?.remoteTaskId) return
    const remoteTaskId = task.remoteTaskId
    if (!apiKey.value.trim()) { await patchSeedanceTask(id, { status: 'paused', error: '填写原火山方舟 API Key 后可继续查询' }); return }
    while (!controller.signal.aborted) {
      try {
        const remote = await querySeedanceTask({ apiKey: apiKey.value, baseUrl: task.baseUrl }, remoteTaskId)
        transientFailures = 0
        if (remote.status === 'succeeded') { await completeTask(task, remote); return }
        if (remote.status === 'failed') { await patchSeedanceTask(id, { status: 'failed', errorCode: remote.errorCode, error: remote.errorMessage || 'Seedance 视频生成失败' }); return }
        if (remote.status === 'cancelled') { await patchSeedanceTask(id, { status: 'cancelled', error: '云端任务已取消' }); return }
        if (remote.status === 'expired') { await patchSeedanceTask(id, { status: 'expired', error: '云端任务已超时' }); return }
        await patchSeedanceTask(id, { status: remote.status === 'queued' ? 'queued' : 'running', error: '' })
        task = (await getSeedanceTask(id)) || task
        delay = Math.min(delay + 1000, 10000)
        await wait(delay, controller.signal)
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') throw error
        transientFailures++
        if (transientFailures >= 3) throw error
        await wait(Math.min(5000 * transientFailures, 10000), controller.signal)
      }
    }
  } catch (error) {
    if ((error as Error)?.name !== 'AbortError') {
      const message = error instanceof Error ? error.message : '任务查询中断'
      const current = await getSeedanceTask(id)
      if (current && !['completed', 'failed', 'cancelled', 'expired'].includes(current.status)) await patchSeedanceTask(id, { status: 'paused', error: message }).catch(() => undefined)
      pageError.value = message
    }
  } finally {
    pollingControllers.delete(id)
  }
}

const generateVideo = async () => {
  clearNotice()
  isSubmitting.value = true
  let localId = ''
  try {
    const input = buildInput()
    localId = globalThis.crypto?.randomUUID?.() || `seedance_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const now = Date.now()
    await saveSeedanceTask({
      id: localId,
      createdAt: now,
      updatedAt: now,
      status: 'submitting',
      baseUrl: config.baseUrl.trim().replace(/\/+$/, '') || SEEDANCE_DEFAULT_BASE_URL,
      params: {
        prompt: input.prompt.trim(), model: input.model, mode: input.mode, resolution: input.resolution, ratio: input.ratio,
        duration: input.duration, generateAudio: input.generateAudio, watermark: input.watermark, returnLastFrame: input.returnLastFrame,
        seed: input.seed, media: input.media.map(item => ({ role: item.role, label: item.label }))
      }
    })
    const remoteTaskId = await submitSeedanceGeneration({ apiKey: apiKey.value, baseUrl: config.baseUrl }, input)
    await patchSeedanceTask(localId, { status: 'queued', remoteTaskId, error: '' })
    pageMessage.value = '任务已提交。可以离开页面，回来后会继续查询。'
    void pollTask(localId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Seedance 任务提交失败'
    pageError.value = message
    if (localId) {
      const task = await getSeedanceTask(localId)
      if (task) await patchSeedanceTask(localId, { status: task.remoteTaskId ? 'paused' : 'failed', error: message })
    }
    if (!apiKey.value.trim()) showSettings.value = true
  } finally { isSubmitting.value = false }
}

const pauseTask = async (task: SeedanceVideoTask) => {
  pollingControllers.get(task.id)?.abort()
  await patchSeedanceTask(task.id, { status: 'paused', error: '' })
}

const resumeTask = async (task: SeedanceVideoTask) => {
  clearNotice()
  if (!apiKey.value.trim()) { showSettings.value = true; pageError.value = '请先填写原火山方舟 API Key'; return }
  await patchSeedanceTask(task.id, { status: 'running', error: '' })
  void pollTask(task.id)
}

const retryDownload = async (task: SeedanceVideoTask) => {
  clearNotice()
  if (!task.remoteVideoUrl || (task.remoteVideoExpiresAt && task.remoteVideoExpiresAt <= Date.now())) {
    pageError.value = '原视频地址已过期，请尝试继续查询任务获取新地址'
    return
  }
  try {
    await patchSeedanceTask(task.id, { status: 'downloading', error: '' })
    const local = await downloadSeedanceVideo(task.remoteTaskId || task.id, task.remoteVideoUrl)
    await patchSeedanceTask(task.id, { status: 'completed', localFilePath: local.path, localFileUri: local.uri, error: '' })
  } catch (error) {
    await patchSeedanceTask(task.id, { status: 'paused', error: error instanceof Error ? error.message : '视频保存失败' })
  }
}

const remoteUrlUsable = (task: SeedanceVideoTask) => Boolean(task.remoteVideoUrl && (!task.remoteVideoExpiresAt || task.remoteVideoExpiresAt > Date.now()))

const shareTask = async (task: SeedanceVideoTask) => {
  clearNotice()
  try { if (task.localFileUri) await shareSeedanceVideo(task.localFileUri) } catch (error) { pageError.value = error instanceof Error ? error.message : '分享失败' }
}

const reuseTask = (task: SeedanceVideoTask) => {
  prompt.value = task.params.prompt
  config.resolution = task.params.resolution
  config.ratio = task.params.ratio
  config.duration = task.params.duration
  config.generateAudio = task.params.generateAudio
  config.watermark = task.params.watermark
  config.returnLastFrame = task.params.returnLastFrame
  config.seed = task.params.seed === undefined ? '' : String(task.params.seed)
  chooseMode(task.params.mode)
  activeTab.value = 'create'
  pageMessage.value = task.params.media.length ? '参数和描述已复用；出于隐私与体积考虑，请重新添加原参考素材。' : '参数和描述已复用。'
}

const useRemoteVideo = (task: SeedanceVideoTask, target: 'edit' | 'extension') => {
  clearNotice()
  if (!task.remoteVideoUrl || (task.remoteVideoExpiresAt && task.remoteVideoExpiresAt <= Date.now())) {
    pageError.value = '这项作品的临时云端地址已过期，无法直接用于编辑或延长'
    return
  }
  chooseMode(target)
  if (target === 'edit') editVideoUrl.value = task.remoteVideoUrl
  else extensionVideoUrl.value = task.remoteVideoUrl
  prompt.value = target === 'extension' ? '延长视频，保持人物、场景、镜头语言与声音连续。' : ''
  activeTab.value = 'create'
  pageMessage.value = target === 'extension' ? '已带入作品，请补充延长后的剧情。' : '已带入作品，请描述需要修改的时间段和内容。'
}

const confirmDelete = async () => {
  const task = pendingDelete.value
  if (!task) return
  pollingControllers.get(task.id)?.abort()
  await removeSeedanceVideoFile(task.localFilePath)
  await removeSeedanceTask(task.id)
  pendingDelete.value = null
}

const resumeActiveTasks = async () => {
  await loadSeedanceTasks()
  if (!nativeApp || !apiKey.value.trim()) return
  for (const task of tasks.value.filter(item => ['queued', 'running', 'downloading'].includes(item.status))) void pollTask(task.id)
}

onMounted(async () => {
  await loadSeedanceTasks()
  if (nativeApp) {
    try { apiKey.value = (await getSecureValue('seedance_ark_api_key')) || ''; savedApiKey.value = apiKey.value } catch (error) { pageError.value = error instanceof Error ? error.message : '无法读取安全存储' }
  }
  keyReady.value = true
  for (const task of tasks.value.filter(item => item.status === 'submitting' && !item.remoteTaskId)) {
    await patchSeedanceTask(task.id, { status: 'failed', error: '页面在任务编号返回前中断，请确认方舟控制台后再决定是否重新提交' })
  }
  await resumeActiveTasks()
  showSettings.value = nativeApp && !apiKey.value
  if (nativeApp) appStateHandle = await App.addListener('appStateChange', state => { if (state.isActive) void resumeActiveTasks() })
})

onUnmounted(() => {
  pollingControllers.forEach(controller => controller.abort())
  pollingControllers.clear()
  void appStateHandle?.remove()
  if (firstFrame.value) URL.revokeObjectURL(firstFrame.value.previewUrl)
  if (lastFrame.value) URL.revokeObjectURL(lastFrame.value.previewUrl)
  referenceImages.value.forEach(item => URL.revokeObjectURL(item.previewUrl))
})
</script>

<template>
  <div class="seedance-hall" :class="{ dark: globalSettings.darkMode }">
    <header class="hall-header">
      <button class="icon-button" type="button" aria-label="返回视频引擎" @click="$emit('back')"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button>
      <div class="header-copy"><h1>Seedance 2.5</h1><p>字节跳动长叙事与全模态音画创作</p><span class="app-badge" :class="{ ready: nativeApp }">{{ nativeApp ? 'App 官方直连' : '需安装移动端 App' }}</span></div>
      <button class="icon-button" type="button" aria-label="连接设置" @click="showSettings = !showSettings"><svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg></button>
    </header>

    <nav class="hall-tabs" aria-label="Seedance 页面">
      <button type="button" :class="{ active: activeTab === 'create' }" @click="activeTab = 'create'">创作<span v-if="activeTasks.length">{{ activeTasks.length }}</span></button>
      <button type="button" :class="{ active: activeTab === 'works' }" @click="activeTab = 'works'">作品<span v-if="tasks.length">{{ tasks.length }}</span></button>
    </nav>

    <main class="hall-scroll">
      <div v-if="pageMessage" class="page-message">{{ pageMessage }}</div>
      <div v-if="pageError" class="page-error">{{ pageError }}</div>
      <div v-if="!nativeApp" class="install-note"><strong>网页中不开放密钥直连</strong><p>请安装 Android 或 iOS App。这样可使用系统安全存储和原生网络请求，不会把 API Key 写入网页存储。</p></div>

      <template v-if="activeTab === 'create'">
        <section class="settings-panel" :class="{ open: showSettings }">
          <button class="section-toggle" type="button" @click="showSettings = !showSettings"><span><small>连接设置</small><strong>{{ apiKeyStored ? '火山方舟已连接' : '填写自己的方舟 API Key' }}</strong></span><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>
          <div v-if="showSettings" class="settings-body">
            <label class="field key-field"><span>火山方舟 API Key</span><div class="input-action"><input v-model="apiKey" :type="showApiKey ? 'text' : 'password'" autocomplete="off" placeholder="填写方舟 API Key"><button type="button" @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button></div><small>仅写入 Android/iOS 系统安全存储，不进入网页存储或数据备份。</small></label>
            <label class="field"><span>Base URL</span><input v-model="config.baseUrl" inputmode="url" placeholder="https://ark.cn-beijing.volces.com"><small>国内火山方舟默认地址；代理地址须完整兼容官方 API。</small></label>
            <button class="save-key" type="button" :disabled="!nativeApp || keySaving || apiKeyStored" @click="saveApiKey">{{ keySaving ? '保存中…' : apiKeyStored ? '已安全保存' : '保存 API Key' }}</button>
          </div>
        </section>

        <section class="create-section">
          <div class="section-heading"><div><small>生成引擎</small><h2>Doubao Seedance 2.5</h2></div><span class="cost-pill">费用以方舟结算为准</span></div>
          <div class="mode-tabs" role="tablist" aria-label="创作方式"><button v-for="item in SEEDANCE_MODES" :key="item.value" type="button" :class="{ active: mode === item.value }" @click="chooseMode(item.value)">{{ item.label }}</button></div>
          <p class="mode-description">{{ selectedMode.description }}</p>

          <div v-if="mode === 'image' || mode === 'interpolation'" class="upload-grid" :class="{ double: mode === 'interpolation' }">
            <div class="upload-slot" :class="{ filled: firstFrame }">
              <img v-if="firstFrame" :src="firstFrame.previewUrl" alt="首帧预览">
              <label v-else><input type="file" accept="image/jpeg,image/png,image/webp,image/bmp,image/gif" @change="selectFrame('first', $event)"><svg viewBox="0 0 24 24"><path d="M4 16l4-4 4 4 3-3 5 5M14 8h.01M5 4h14a1 1 0 0 1 1 1v14H4V5a1 1 0 0 1 1-1Z"/></svg><span>选择首帧</span><small>300–6000px · 最大 30MB</small></label>
              <button v-if="firstFrame" type="button" aria-label="移除首帧" @click="clearFrame('first')">×</button>
            </div>
            <div v-if="mode === 'interpolation'" class="upload-slot" :class="{ filled: lastFrame }">
              <img v-if="lastFrame" :src="lastFrame.previewUrl" alt="尾帧预览">
              <label v-else><input type="file" accept="image/jpeg,image/png,image/webp,image/bmp,image/gif" @change="selectFrame('last', $event)"><svg viewBox="0 0 24 24"><path d="M4 16l4-4 4 4 3-3 5 5M14 8h.01M5 4h14a1 1 0 0 1 1 1v14H4V5a1 1 0 0 1 1-1Z"/></svg><span>选择尾帧</span><small>控制结束画面</small></label>
              <button v-if="lastFrame" type="button" aria-label="移除尾帧" @click="clearFrame('last')">×</button>
            </div>
          </div>

          <div v-if="mode === 'references' || mode === 'audio'" class="reference-editor">
            <div v-if="mode === 'references'" class="reference-grid">
              <div v-for="(item, index) in referenceImages" :key="item.id" class="reference-thumb"><img :src="item.previewUrl" :alt="item.file.name"><button type="button" aria-label="移除图片" @click="removeReferenceImage(index)">×</button></div>
              <label class="reference-add"><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/bmp,image/gif" @change="selectReferenceImages"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>本地图片</span></label>
            </div>
            <div class="asset-actions">
              <button v-if="mode === 'references'" type="button" @click="addUrlAsset('reference_image')">图片地址</button>
              <button v-if="mode === 'references'" type="button" @click="addUrlAsset('reference_video')">视频地址</button>
              <button type="button" @click="addUrlAsset('reference_audio')">音频地址</button>
              <label><input type="file" multiple accept="audio/mpeg,audio/wav,.mp3,.wav" @change="selectReferenceAudios">本地音频</label>
            </div>
            <div v-if="visibleUrlAssets.length" class="url-assets">
              <div v-for="item in visibleUrlAssets" :key="item.id" class="url-row"><span>{{ roleLabel(item.role) }}</span><input v-model="item.url" inputmode="url" placeholder="HTTPS 或 asset:// 地址"><button type="button" :aria-label="`移除${roleLabel(item.role)}地址`" @click="removeUrlAsset(item.id)">×</button></div>
            </div>
            <div v-if="referenceAudios.length" class="local-assets"><div v-for="item in referenceAudios" :key="item.id"><span>{{ item.file.name }} · {{ item.duration.toFixed(1) }} 秒</span><button type="button" aria-label="移除音频" @click="removeReferenceAudio(item.id)">×</button></div></div>
            <p class="asset-note">本地图片和音频可直接提交；参考视频需使用公开 HTTPS 地址或方舟 Asset ID。含真人脸素材需先按方舟要求完成授权入库。</p>
          </div>

          <div v-if="mode === 'edit' || mode === 'extension'" class="source-mode">
            <label class="field"><span>{{ mode === 'edit' ? '待编辑视频' : '待延长视频' }}</span><input v-if="mode === 'edit'" v-model="editVideoUrl" inputmode="url" placeholder="公开 HTTPS 地址或 asset:// Asset ID"><input v-else v-model="extensionVideoUrl" inputmode="url" placeholder="公开 HTTPS 地址或 asset:// Asset ID"><small>手机本地视频地址无法被方舟读取。可从作品页带入仍在有效期内的生成视频。</small></label>
          </div>

          <div class="prompt-section">
            <div class="section-heading compact"><div><small>创作描述</small><h2>{{ mode === 'edit' ? '描述修改位置与内容' : mode === 'extension' ? '描述延长后的剧情' : '描述画面、镜头与声音' }}</h2></div><span class="counter">{{ promptCount }}/20000</span></div>
            <div v-if="referenceChips.length && (mode === 'references' || mode === 'audio')" class="reference-chips"><button v-for="item in referenceChips" :key="`${item.token}-${item.label}`" type="button" :title="item.label" @click="insertReference(item.token)">{{ item.token }}</button></div>
            <textarea v-model="prompt" maxlength="20000" :placeholder="mode === 'text' ? '例如：16:9 电影质感。0–5 秒，镜头穿过雨幕靠近咖啡馆；6–10 秒，女孩推门进入，室内暖光与街道冷色形成对比，同时生成雨声和开门铃声。' : '说明各项素材的用途；需要精确节奏时可按 0–5 秒、6–10 秒分段描述。'"></textarea>
            <p>对白建议使用引号；长叙事请写清时间段、主体、动作、镜头、环境和声音，避免只堆叠风格词。</p>
          </div>

          <div class="parameter-grid">
            <label class="field"><span>分辨率</span><select v-model="config.resolution"><option value="480p">480P</option><option value="720p">720P</option><option value="1080p">1080P · 10bit</option></select><small>1080P 需账号与当前地域已开放。</small></label>
            <label class="field"><span>画面比例</span><select v-model="config.ratio" :disabled="isRatioLocked"><option value="adaptive">自适应</option><option value="16:9">16:9</option><option value="4:3">4:3</option><option value="1:1">1:1</option><option value="3:4">3:4</option><option value="9:16">9:16</option><option value="21:9">21:9</option></select><small>{{ isRatioLocked ? '编辑和延长自动沿用原视频比例。' : '自适应会根据描述和素材选择。' }}</small></label>
            <label class="field"><span>时长</span><input v-model.number="config.duration" type="number" min="4" max="30" step="1" inputmode="numeric"><small>4 到 30 秒整数。</small></label>
            <label class="field"><span>Seed</span><input v-model="config.seed" type="number" min="-1" max="4294967295" step="1" inputmode="numeric" placeholder="留空为随机"><small>相同 Seed 也不保证完全一致。</small></label>
          </div>
          <div class="switch-list">
            <label><input v-model="config.generateAudio" type="checkbox"><span>生成同步音频</span></label>
            <label><input v-model="config.returnLastFrame" type="checkbox"><span>返回尾帧</span></label>
            <label><input v-model="config.watermark" type="checkbox"><span>添加可见水印</span></label>
          </div>
          <div class="generation-note"><span>模型：{{ SEEDANCE_MODEL }}</span><span>24 FPS</span><span>任务记录约保留 7 天</span><span>云端视频地址约 24 小时有效</span></div>
        </section>

        <button class="generate-button" type="button" :disabled="!canGenerate" @click="generateVideo"><span v-if="isSubmitting" class="spinner"></span>{{ isSubmitting ? '正在提交…' : !nativeApp ? '请安装 App 使用' : !apiKey.trim() ? '请完成连接设置' : '生成 Seedance 视频' }}</button>

        <section v-if="activeTasks.length" class="running-section"><div class="section-heading"><div><small>正在处理</small><h2>{{ activeTasks.length }} 项任务</h2></div></div><div v-for="task in activeTasks" :key="task.id" class="running-card"><div class="running-indicator"><span></span></div><div class="task-copy"><strong>{{ statusLabel(task.status) }}</strong><p>{{ task.params.prompt || modeLabel(task.params.mode) }}</p><small>{{ task.remoteTaskId || '正在获取任务编号' }}</small></div><button v-if="['queued','running'].includes(task.status) && task.remoteTaskId" type="button" @click="pauseTask(task)">暂停查询</button></div></section>
      </template>

      <template v-else>
        <div v-if="!tasks.length" class="empty-works"><svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z"/></svg><h2>还没有 Seedance 作品</h2><p>任务编号、参数和用量会保存在本机；成功视频会立即下载，避免临时云端地址过期。</p><button type="button" @click="activeTab = 'create'">开始创作</button></div>
        <div v-else class="works-list">
          <article v-for="task in tasks" :key="task.id" class="work-card">
            <div class="work-media" :class="isPortrait(task.actualRatio || task.params.ratio) ? 'portrait' : 'landscape'">
              <video v-if="task.localFileUri" :src="videoUrl(task)" controls playsinline preload="metadata"></video>
              <div v-else class="work-placeholder"><span v-if="['submitting','queued','running','downloading'].includes(task.status)" class="spinner"></span><svg v-else viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z"/></svg><strong>{{ statusLabel(task.status) }}</strong></div>
              <span class="status-badge" :class="task.status">{{ statusLabel(task.status) }}</span>
            </div>
            <div class="work-info"><div><strong>{{ task.params.prompt || task.params.media.map(item => item.label).filter(Boolean).join('、') || '素材生成' }}</strong><p>{{ modeLabel(task.params.mode) }} · {{ task.actualResolution || task.params.resolution }} · {{ task.actualRatio || task.params.ratio }} · {{ task.actualDuration || task.params.duration }} 秒 · {{ formatTime(task.createdAt) }}</p><p v-if="task.remoteTaskId">任务：{{ task.remoteTaskId }}</p><p v-if="task.usage?.completion_tokens">用量：{{ task.usage.completion_tokens.toLocaleString() }} tokens</p><p v-if="task.error" class="task-error">{{ task.error }}</p></div>
              <div class="work-actions"><button v-if="['queued','running'].includes(task.status) && task.remoteTaskId" type="button" @click="pauseTask(task)">暂停查询</button><button v-else-if="task.status === 'paused' && remoteUrlUsable(task)" type="button" @click="retryDownload(task)">重试保存</button><button v-else-if="task.status === 'paused' && task.remoteTaskId" type="button" @click="resumeTask(task)">继续查询</button><button v-if="task.localFileUri" type="button" @click="shareTask(task)">分享/保存</button><button v-if="task.status === 'completed' && remoteUrlUsable(task)" type="button" @click="useRemoteVideo(task, 'extension')">延长</button><button v-if="task.status === 'completed' && remoteUrlUsable(task)" type="button" @click="useRemoteVideo(task, 'edit')">编辑</button><button type="button" @click="reuseTask(task)">复用参数</button><button class="danger" type="button" @click="pendingDelete = task">删除</button></div>
            </div>
          </article>
        </div>
      </template>
    </main>

    <Transition name="sheet"><div v-if="pendingDelete" class="sheet-overlay" @click.self="pendingDelete = null"><section class="confirm-sheet"><div class="sheet-mark"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5"/></svg></div><h2>删除这项 Seedance 作品？</h2><p>本机视频文件和任务记录都会删除，云端任务与已产生费用不受影响。</p><div><button type="button" @click="pendingDelete = null">取消</button><button class="danger" type="button" @click="confirmDelete">确认删除</button></div></section></div></Transition>
  </div>
</template>

<style scoped>
.seedance-hall{--vh-bg:#f7f7f5;--vh-surface:#fff;--vh-soft:#f0f0ed;--vh-text:#1d1d1f;--vh-sub:#777773;--vh-muted:#a0a09a;--vh-line:rgba(20,20,20,.08);--vh-accent:#171717;position:absolute;inset:0;z-index:1000;display:flex;flex-direction:column;overflow:hidden;background:var(--vh-bg);color:var(--vh-text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;-webkit-tap-highlight-color:transparent}.seedance-hall.dark{--vh-bg:#19191b;--vh-surface:#242426;--vh-soft:#2d2d30;--vh-text:#f5f5f2;--vh-sub:#aaa9a3;--vh-muted:#787875;--vh-line:rgba(255,255,255,.09);--vh-accent:#f1f1ed}
.hall-header{display:flex;min-height:58px;flex:0 0 auto;align-items:center;justify-content:space-between;padding:12px 18px 8px;box-sizing:border-box}.header-copy{min-width:0;flex:1;text-align:center}.header-copy h1{margin:0;font-size:20px;font-weight:680;line-height:1.15;letter-spacing:-.5px}.header-copy p{overflow:hidden;margin:4px 0 0;color:var(--vh-sub);font-size:11px;line-height:1.2;white-space:nowrap;text-overflow:ellipsis}.app-badge{display:inline-flex;align-items:center;margin-top:5px;padding:3px 7px;border-radius:8px;background:#fff0f0;color:#b74343;font-size:8px;font-weight:650}.app-badge.ready{background:#edf6ef;color:#397148}.dark .app-badge{background:#3b2527;color:#efaaaa}.dark .app-badge.ready{background:#223429;color:#91c89f}.icon-button{display:grid;width:34px;height:34px;flex:0 0 auto;padding:0;border:0;border-radius:50%;background:transparent;color:var(--vh-text);cursor:pointer;place-items:center}.icon-button:active{background:var(--vh-soft)}.icon-button svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8}
.hall-tabs{display:flex;flex:0 0 auto;gap:5px;margin:4px 18px 10px;padding:3px;border-radius:12px;background:var(--vh-soft)}.hall-tabs button{display:flex;min-width:0;flex:1;align-items:center;justify-content:center;gap:5px;padding:8px 10px;border:0;border-radius:9px;background:transparent;color:var(--vh-sub);font-size:13px;font-weight:600;cursor:pointer}.hall-tabs button.active{background:var(--vh-surface);color:var(--vh-text);box-shadow:0 2px 9px rgba(0,0,0,.05)}.hall-tabs span{min-width:16px;padding:1px 4px;border-radius:10px;background:var(--vh-soft);font-size:9px}.hall-scroll{flex:1;min-height:0;overflow-y:auto;padding:0 18px calc(28px + env(safe-area-inset-bottom));box-sizing:border-box;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.page-message,.page-error,.install-note{margin:4px 0 10px;padding:9px 11px;border-radius:11px;font-size:11px;line-height:1.45}.page-message{background:#edf6ef;color:#397148}.page-error,.install-note{background:#fff0f0;color:#b64242}.dark .page-message{background:#223429;color:#91c89f}.dark .page-error,.dark .install-note{background:#3b2527;color:#efaaaa}.install-note strong{display:block;margin-bottom:2px}.install-note p{margin:0}
.settings-panel,.create-section,.running-section{margin-bottom:12px;border:1px solid var(--vh-line);border-radius:17px;background:var(--vh-surface)}.section-toggle{display:flex;width:100%;align-items:center;justify-content:space-between;padding:13px 14px;border:0;border-radius:17px;background:transparent;color:inherit;text-align:left;cursor:pointer}.section-toggle span{display:flex;min-width:0;flex-direction:column;gap:3px}.section-toggle small,.section-heading small{color:var(--vh-muted);font-size:9px;font-weight:650;letter-spacing:.8px}.section-toggle strong{overflow:hidden;font-size:12px;font-weight:620;white-space:nowrap;text-overflow:ellipsis}.section-toggle svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6;transition:transform .2s}.settings-panel.open .section-toggle svg{transform:rotate(180deg)}.settings-body{display:grid;gap:12px;padding:13px 14px 15px;border-top:1px solid var(--vh-line)}
.field{display:flex;min-width:0;flex-direction:column;gap:6px}.field>span{color:var(--vh-sub);font-size:10px;font-weight:600}.field>small{color:var(--vh-muted);font-size:9px;line-height:1.4}.input-action{display:flex;min-width:0;gap:6px}.input-action input{min-width:0;flex:1}.input-action button,.save-key,.work-actions button,.running-card>button{flex:0 0 auto;padding:0 11px;border:0;border-radius:10px;background:var(--vh-soft);color:var(--vh-text);font-size:10px;font-weight:600;cursor:pointer}.save-key{min-height:36px}.save-key:disabled{opacity:.55}
.create-section,.running-section{padding:14px}.section-heading{display:flex;min-width:0;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:11px}.section-heading.compact{margin-top:12px;margin-bottom:7px}.section-heading>div{min-width:0}.section-heading h2{overflow:hidden;margin:3px 0 0;font-size:14px;font-weight:660;line-height:1.3;white-space:nowrap;text-overflow:ellipsis}.cost-pill{flex:0 0 auto;max-width:42%;overflow:hidden;padding:5px 8px;border-radius:10px;background:var(--vh-soft);color:var(--vh-sub);font-size:9px;font-weight:650;white-space:nowrap;text-overflow:ellipsis}.mode-tabs{display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.mode-tabs::-webkit-scrollbar{display:none}.mode-tabs button{flex:0 0 auto;padding:7px 11px;border:0;border-radius:100px;background:var(--vh-soft);color:var(--vh-sub);font-size:10px;font-weight:620;cursor:pointer}.mode-tabs button.active{background:var(--vh-accent);color:var(--vh-bg)}.mode-description{margin:7px 1px 0;color:var(--vh-muted);font-size:9px;line-height:1.4}
.upload-grid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:11px}.upload-grid.double{grid-template-columns:repeat(2,minmax(0,1fr))}.upload-slot{position:relative;display:grid;min-width:0;min-height:126px;overflow:hidden;border:1px dashed var(--vh-line);border-radius:13px;background:var(--vh-soft);place-items:center}.upload-slot.filled{border-style:solid}.upload-slot img{width:100%;height:150px;object-fit:cover}.upload-slot label,.reference-add{display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--vh-sub);cursor:pointer}.upload-slot input,.reference-add input,.asset-actions input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.upload-slot label svg,.reference-add svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.5}.upload-slot label span{margin-top:7px;font-size:10px;font-weight:650}.upload-slot label small{margin-top:3px;color:var(--vh-muted);font-size:8px}.upload-slot>button,.reference-thumb>button{position:absolute;top:6px;right:6px;display:grid;width:23px;height:23px;padding:0;border:0;border-radius:50%;background:rgba(20,20,20,.72);color:#fff;font-size:15px;cursor:pointer;place-items:center}
.reference-editor{margin-top:11px}.reference-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.reference-thumb,.reference-add{position:relative;min-width:0;height:105px;overflow:hidden;border-radius:12px;background:var(--vh-soft)}.reference-thumb img{width:100%;height:100%;object-fit:cover}.reference-add{border:1px dashed var(--vh-line)}.reference-add span{margin-top:5px;font-size:9px}.asset-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.asset-actions button,.asset-actions label{display:flex;min-width:72px;min-height:30px;flex:1;align-items:center;justify-content:center;padding:0 8px;border:0;border-radius:10px;box-sizing:border-box;background:var(--vh-soft);color:var(--vh-text);font-size:9px;font-weight:600;cursor:pointer}.url-assets,.local-assets{display:grid;gap:6px;margin-top:9px}.url-row{display:grid;grid-template-columns:34px minmax(0,1fr) 28px;align-items:center;gap:6px}.url-row>span{color:var(--vh-sub);font-size:9px}.url-row button,.local-assets button{padding:0;border:0;border-radius:9px;background:var(--vh-soft);color:var(--vh-sub);font-size:14px}.local-assets>div{display:flex;min-width:0;align-items:center;gap:7px;padding:7px 8px;border-radius:10px;background:var(--vh-soft)}.local-assets span{overflow:hidden;min-width:0;flex:1;color:var(--vh-sub);font-size:9px;white-space:nowrap;text-overflow:ellipsis}.local-assets button{flex:0 0 auto;width:24px;height:24px;background:var(--vh-surface)}.asset-note{margin:8px 1px 0;color:var(--vh-muted);font-size:9px;line-height:1.5}.source-mode{margin-top:12px}
.reference-chips{display:flex;gap:5px;overflow-x:auto;margin-bottom:7px;padding-bottom:2px;scrollbar-width:none}.reference-chips::-webkit-scrollbar{display:none}.reference-chips button{max-width:110px;overflow:hidden;flex:0 0 auto;padding:4px 7px;border:0;border-radius:8px;background:var(--vh-soft);color:var(--vh-sub);font-size:8px;white-space:nowrap;text-overflow:ellipsis}.prompt-section textarea{width:100%;min-height:128px;resize:vertical;padding:12px;border:0;border-radius:13px;box-sizing:border-box;background:var(--vh-soft);color:var(--vh-text);font:inherit;font-size:12px;line-height:1.65;outline:none}.prompt-section>p{margin:8px 1px 0;color:var(--vh-muted);font-size:9px;line-height:1.45}.prompt-section textarea:focus,input:focus,select:focus{box-shadow:inset 0 0 0 1px var(--vh-text)}.counter{flex:0 0 auto;color:var(--vh-muted);font-size:9px}input,select{width:100%;min-height:36px;padding:8px 10px;border:0;border-radius:10px;box-sizing:border-box;appearance:none;background:var(--vh-soft);color:var(--vh-text);font:inherit;font-size:11px;outline:none}select{padding-right:24px;background-image:linear-gradient(45deg,transparent 50%,var(--vh-sub) 50%),linear-gradient(135deg,var(--vh-sub) 50%,transparent 50%);background-position:calc(100% - 13px) 15px,calc(100% - 9px) 15px;background-repeat:no-repeat;background-size:4px 4px}select:disabled{opacity:.62}.parameter-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 8px;margin-top:12px}.switch-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:11px}.switch-list label{display:flex;min-width:0;align-items:center;gap:7px;padding:8px;border-radius:10px;background:var(--vh-soft);color:var(--vh-sub);font-size:9px}.switch-list input{width:14px;min-height:14px;accent-color:var(--vh-accent)}.generation-note{display:flex;flex-wrap:wrap;gap:5px;margin-top:11px}.generation-note span{padding:4px 7px;border-radius:8px;background:var(--vh-soft);color:var(--vh-muted);font-size:8px}
.generate-button{display:flex;width:100%;align-items:center;justify-content:center;gap:8px;margin:2px 0 14px;padding:13px 14px;border:0;border-radius:14px;background:var(--vh-accent);color:var(--vh-bg);font-size:12px;font-weight:680;cursor:pointer}.generate-button:disabled{opacity:.45;cursor:not-allowed}.spinner{width:13px;height:13px;border:1.8px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite}.running-card{display:flex;min-width:0;align-items:center;gap:9px;padding:10px 0;border-top:1px solid var(--vh-line)}.running-indicator{display:grid;width:25px;height:25px;flex:0 0 auto;border-radius:50%;background:var(--vh-soft);place-items:center}.running-indicator span{width:7px;height:7px;border-radius:50%;background:#63a878;box-shadow:0 0 0 4px rgba(99,168,120,.15);animation:pulse 1.6s ease-in-out infinite}.task-copy{min-width:0;flex:1}.task-copy strong{font-size:10px}.task-copy p{overflow:hidden;margin:3px 0;color:var(--vh-sub);font-size:9px;white-space:nowrap;text-overflow:ellipsis}.task-copy small{display:block;overflow:hidden;color:var(--vh-muted);font-size:8px;white-space:nowrap;text-overflow:ellipsis}.running-card>button{min-height:28px}
.works-list{display:grid;gap:11px}.work-card{min-width:0;overflow:hidden;border:1px solid var(--vh-line);border-radius:17px;background:var(--vh-surface)}.work-media{position:relative;width:100%;overflow:hidden;background:#111}.work-media.landscape{aspect-ratio:16/9}.work-media.portrait{max-height:440px;aspect-ratio:9/16}.work-media video{width:100%;height:100%;object-fit:contain;background:#111}.work-placeholder{display:flex;width:100%;height:100%;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:#aaa}.work-placeholder svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.5}.work-placeholder strong{font-size:10px}.status-badge{position:absolute;top:8px;left:8px;padding:4px 7px;border-radius:8px;background:rgba(20,20,20,.66);color:#fff;font-size:8px;backdrop-filter:blur(6px)}.status-badge.completed{background:rgba(45,112,67,.78)}.status-badge.failed{background:rgba(159,54,54,.78)}.work-info{padding:11px 12px}.work-info strong{display:block;overflow:hidden;font-size:11px;line-height:1.4;white-space:nowrap;text-overflow:ellipsis}.work-info p{overflow:hidden;margin:4px 0 0;color:var(--vh-muted);font-size:8px;line-height:1.4;white-space:nowrap;text-overflow:ellipsis}.work-info .task-error{color:#b84a4a;font-size:9px;white-space:normal}.work-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.work-actions button{min-height:28px}.work-actions .danger{margin-left:auto;background:#fff0f0;color:#b74343}.dark .work-actions .danger{background:#3b2527;color:#efaaaa}
.empty-works{display:flex;min-height:58vh;align-items:center;justify-content:center;flex-direction:column;text-align:center}.empty-works svg{width:42px;height:42px;fill:none;stroke:var(--vh-muted);stroke-width:1.2}.empty-works h2{margin:14px 0 5px;font-size:15px}.empty-works p{max-width:260px;margin:0;color:var(--vh-sub);font-size:10px;line-height:1.6}.empty-works button{margin-top:14px;padding:9px 15px;border:0;border-radius:11px;background:var(--vh-accent);color:var(--vh-bg);font-size:10px;font-weight:650;cursor:pointer}.sheet-overlay{position:fixed;inset:0;z-index:1200;display:flex;align-items:flex-end;justify-content:center;padding:12px;box-sizing:border-box;background:rgba(0,0,0,.3);backdrop-filter:blur(5px)}.confirm-sheet{width:min(100%,430px);padding:21px 18px calc(18px + env(safe-area-inset-bottom));border-radius:24px;background:var(--vh-surface);box-sizing:border-box;text-align:center}.sheet-mark{display:grid;width:38px;height:38px;margin:0 auto 11px;border-radius:50%;background:#fff0f0;color:#b74343;place-items:center}.dark .sheet-mark{background:#3b2527;color:#efaaaa}.sheet-mark svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.5}.confirm-sheet h2{margin:0;font-size:15px}.confirm-sheet p{margin:8px auto 17px;color:var(--vh-sub);font-size:10px;line-height:1.55}.confirm-sheet>div:last-child{display:grid;grid-template-columns:1fr 1fr;gap:8px}.confirm-sheet button{padding:11px;border:0;border-radius:12px;background:var(--vh-soft);color:var(--vh-text);font-size:11px;font-weight:650;cursor:pointer}.confirm-sheet button.danger{background:#c84b4b;color:#fff}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{50%{opacity:.45;transform:scale(.8)}}.sheet-enter-active,.sheet-leave-active{transition:opacity .22s}.sheet-enter-active .confirm-sheet,.sheet-leave-active .confirm-sheet{transition:transform .25s}.sheet-enter-from,.sheet-leave-to{opacity:0}.sheet-enter-from .confirm-sheet,.sheet-leave-to .confirm-sheet{transform:translateY(25px)}
@media(min-width:700px){.hall-header,.hall-scroll{width:min(100%,760px);margin-left:auto;margin-right:auto}.hall-tabs{width:min(calc(100% - 36px),724px);margin-left:auto;margin-right:auto}.works-list{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.settings-body{grid-template-columns:1fr 1fr}.settings-body .key-field{grid-column:1/-1}.settings-body .save-key{align-self:end}.work-media.portrait{height:430px}}
@media(max-width:360px){.hall-header{padding-left:14px;padding-right:14px}.hall-tabs{margin-left:14px;margin-right:14px}.hall-scroll{padding-left:14px;padding-right:14px}.header-copy h1{font-size:19px}.header-copy p{font-size:10px}.create-section,.running-section{padding:12px}.mode-tabs button{padding-left:10px;padding-right:10px}.upload-slot{min-height:110px}.upload-slot img{height:128px}.parameter-grid{gap:9px 6px}.input-action button{padding-left:9px;padding-right:9px}.generate-button{font-size:11px}.cost-pill{max-width:39%;padding-left:6px;padding-right:6px}.asset-actions button,.asset-actions label{min-width:64px;padding:0 6px}.url-row{grid-template-columns:30px minmax(0,1fr) 26px}}
</style>
