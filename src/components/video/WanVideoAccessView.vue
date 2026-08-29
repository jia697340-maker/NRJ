<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { App } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'
import { globalSettings } from '../../store/global'
import { getSecureValue, isNativeMobileApp, setSecureValue } from '../../services/mobileSecureStorage'
import {
  WAN_MODELS,
  WAN_REGIONS,
  buildWanBaseUrl,
  downloadWanVideo,
  estimateWanCost,
  queryWanTask,
  removeWanVideoFile,
  resolveWanVideoUrl,
  shareWanVideo,
  submitWanGeneration,
  uploadWanFile,
  validateWanInput,
  type WanDuration,
  type WanGenerationInput,
  type WanMedia,
  type WanMediaType,
  type WanMode,
  type WanModel,
  type WanRatio,
  type WanResolution
} from '../../services/wanVideo'
import { useWanVideoHistory, type WanTaskStatus, type WanVideoTask } from '../../composables/useWanVideoHistory'

defineEmits<{ (event: 'back'): void }>()

interface ImageAsset {
  id: string
  file: File
  previewUrl: string
  dataUrl: string
}

interface UrlAsset {
  id: string
  type: 'reference_image' | 'reference_video' | 'reference_audio'
  url: string
}

interface LocalAsset {
  id: string
  type: 'reference_video' | 'reference_audio' | 'file'
  file: File
  duration?: number
}

const storage = (key: string, fallback: string) => localStorage.getItem(key) || fallback
const appInstalled = isNativeMobileApp()
const connectionMode = ref<'web' | 'app'>((appInstalled ? storage('app_wan_connection_mode', 'app') : 'web') as 'web' | 'app')
const savedDuration = Number(storage('app_wan_video_duration', '5'))
const config = reactive({
  workspaceId: storage('app_wan_video_workspace', ''),
  region: storage('app_wan_video_region', 'cn-beijing'),
  model: storage('app_wan_video_model', 'wan3.0-video') as WanModel,
  resolution: storage('app_wan_video_resolution', '720P') as WanResolution,
  ratio: storage('app_wan_video_ratio', 'adaptive') as WanRatio,
  duration: (savedDuration === -1 || (savedDuration >= 2 && savedDuration <= 30) ? savedDuration : 5) as WanDuration,
  audio: storage('app_wan_video_audio', 'true') !== 'false',
  seed: storage('app_wan_video_seed', ''),
  promptExtend: storage('app_wan_video_prompt_extend', 'true') !== 'false',
  watermark: storage('app_wan_video_watermark', 'false') === 'true'
})

const apiKey = ref('')
const savedApiKey = ref('')
const keyReady = ref(false)
const keySaving = ref(false)
const prompt = ref(storage('app_wan_video_prompt', ''))
const mode = ref<WanMode>('text')
const activeTab = ref<'create' | 'works'>('create')
const showSettings = ref(false)
const showApiKey = ref(false)
const isSubmitting = ref(false)
const pageMessage = ref('')
const pageError = ref('')
const pendingDelete = ref<WanVideoTask | null>(null)
const firstFrame = ref<ImageAsset | null>(null)
const lastFrame = ref<ImageAsset | null>(null)
const referenceImages = ref<ImageAsset[]>([])
const urlAssets = ref<UrlAsset[]>([])
const localReferences = ref<LocalAsset[]>([])
const fileUrl = ref('')
const fileAsset = ref<LocalAsset | null>(null)
const linkUrl = ref('')
const editVideoUrl = ref('')
const editVideoFile = ref<LocalAsset | null>(null)
const extensionVideoUrl = ref('')
const extensionVideoFile = ref<LocalAsset | null>(null)
const pollingControllers = new Map<string, AbortController>()
let appStateHandle: PluginListenerHandle | null = null

const { tasks, loadWanTasks, saveWanTask, patchWanTask, getWanTask, removeWanTask } = useWanVideoHistory()

watch(config, value => {
  localStorage.setItem('app_wan_video_workspace', value.workspaceId)
  localStorage.setItem('app_wan_video_region', value.region)
  localStorage.setItem('app_wan_video_model', value.model)
  localStorage.setItem('app_wan_video_resolution', value.resolution)
  localStorage.setItem('app_wan_video_ratio', value.ratio)
  localStorage.setItem('app_wan_video_duration', String(value.duration))
  localStorage.setItem('app_wan_video_audio', String(value.audio))
  localStorage.setItem('app_wan_video_seed', value.seed)
  localStorage.setItem('app_wan_video_prompt_extend', String(value.promptExtend))
  localStorage.setItem('app_wan_video_watermark', String(value.watermark))
}, { deep: true })
watch(prompt, value => localStorage.setItem('app_wan_video_prompt', value))
watch(connectionMode, async value => {
  localStorage.setItem('app_wan_connection_mode', value)
  try {
    apiKey.value = value === 'web' ? localStorage.getItem('app_wan_web_api_key') || '' : appInstalled ? (await getSecureValue('wan_api_key')) || '' : ''
    savedApiKey.value = apiKey.value
  } catch (error) { pageError.value = error instanceof Error ? error.message : '无法读取 API Key' }
})

const baseUrl = computed(() => buildWanBaseUrl(config.workspaceId, config.region))
const estimatedCost = computed(() => estimateWanCost(config.model, config.resolution, config.duration, config.region))
const estimatedCostText = computed(() => estimatedCost.value === null ? '智能时长 · 按实际计费' : `预计 ¥${estimatedCost.value.toFixed(2)}`)
const activeTasks = computed(() => tasks.value.filter(task => ['submitting', 'pending', 'running', 'downloading'].includes(task.status)))
const apiKeyStored = computed(() => Boolean(savedApiKey.value) && apiKey.value === savedApiKey.value)
const canGenerate = computed(() => (connectionMode.value === 'web' || appInstalled) && keyReady.value && Boolean(apiKey.value.trim()) && Boolean(config.workspaceId.trim()) && !isSubmitting.value)

const modeOptions: Array<{ value: WanMode; label: string; description: string }> = [
  { value: 'text', label: '文字', description: '最长 30 秒原生音画与多镜头叙事' },
  { value: 'image', label: '首帧', description: '严格从指定图片开始生成' },
  { value: 'interpolation', label: '首尾帧', description: '控制视频的开始与结束画面' },
  { value: 'references', label: '全模态参考', description: '组合图片、视频与音频参考' },
  { value: 'file', label: '文件', description: '理解文档内容并生成视频' },
  { value: 'link', label: '网页', description: '理解公开网页内容并生成视频' },
  { value: 'edit', label: '编辑', description: '按指令修改现有视频' },
  { value: 'extension', label: '延长', description: '向前、向后或双向续写视频' }
]

const modeLabel = (value: WanMode) => modeOptions.find(item => item.value === value)?.label || value
const modelLabel = (value: WanModel) => WAN_MODELS.find(item => item.value === value)?.shortLabel || value
const formatTime = (value: number) => new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(value)
const videoUrl = (task: WanVideoTask) => resolveWanVideoUrl(task.localFileUri)
const statusLabel = (status: WanTaskStatus) => ({
  submitting: '提交中', pending: '排队中', running: '生成中', paused: '已暂停', downloading: '保存中',
  completed: '已完成', failed: '失败', canceled: '已取消', expired: '已过期'
}[status])

const chooseMode = (value: WanMode) => {
  mode.value = value
  if (value === 'extension') {
    config.ratio = 'adaptive'
    config.duration = -1
  }
}

const saveApiKey = async () => {
  if (connectionMode.value === 'web') { localStorage.setItem('app_wan_web_api_key', apiKey.value.trim()); savedApiKey.value = apiKey.value.trim(); pageMessage.value = '网页密钥已保存在当前浏览器。'; return }
  if (!appInstalled) { pageError.value = 'App 直连需要在安装后的 App 中使用'; return }
  keySaving.value = true
  pageError.value = ''
  try {
    await setSecureValue('wan_api_key', apiKey.value.trim())
    savedApiKey.value = apiKey.value.trim()
    pageMessage.value = apiKey.value.trim() ? 'API Key 已保存到系统安全存储。' : '已移除保存的 API Key。'
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : 'API Key 保存失败'
  } finally {
    keySaving.value = false
  }
}

const readImage = (file: File) => new Promise<{ width: number; height: number; source: HTMLImageElement }>((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight, source: image }); URL.revokeObjectURL(url) }
  image.onerror = () => { reject(new Error('无法读取这张图片')); URL.revokeObjectURL(url) }
  image.src = url
})

const fileToDataUrl = (file: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('图片读取失败'))
  reader.readAsDataURL(file)
})

const prepareImage = async (file?: File): Promise<ImageAsset> => {
  if (!file) throw new Error('没有选择图片')
  if (!['image/jpeg', 'image/png', 'image/bmp', 'image/webp'].includes(file.type)) throw new Error('图片仅支持 JPG、PNG、BMP 或 WEBP')
  if (file.size > 20 * 1024 * 1024) throw new Error('单张图片不能超过 20MB')
  const image = await readImage(file)
  if (image.width < 240 || image.height < 240 || image.width > 8000 || image.height > 8000) throw new Error('图片单边尺寸需在 240 到 8000 像素之间')
  if (Math.max(image.width / image.height, image.height / image.width) > 8) throw new Error('图片长宽比不能超过 8:1')
  let dataUrl = await fileToDataUrl(file)
  if (file.type === 'image/png' || file.type === 'image/webp') {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前设备无法处理图片')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, image.width, image.height)
    context.drawImage(image.source, 0, 0)
    dataUrl = canvas.toDataURL('image/jpeg', 0.95)
  }
  return { id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, file, previewUrl: URL.createObjectURL(file), dataUrl }
}

const selectFrame = async (kind: 'first' | 'last', event: Event) => {
  pageError.value = ''
  const input = event.target as HTMLInputElement
  try {
    const asset = await prepareImage(input.files?.[0])
    const target = kind === 'first' ? firstFrame : lastFrame
    if (target.value?.previewUrl) URL.revokeObjectURL(target.value.previewUrl)
    target.value = asset
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : '图片选择失败'
  } finally {
    input.value = ''
  }
}

const clearFrame = (kind: 'first' | 'last') => {
  const target = kind === 'first' ? firstFrame : lastFrame
  if (target.value?.previewUrl) URL.revokeObjectURL(target.value.previewUrl)
  target.value = null
}

const selectReferenceImages = async (event: Event) => {
  pageError.value = ''
  const input = event.target as HTMLInputElement
  try {
    const files = Array.from(input.files || [])
    if (referenceImages.value.length + files.length + urlAssets.value.filter(item => item.type === 'reference_image').length > 10) throw new Error('参考图片最多 10 张')
    const prepared: ImageAsset[] = []
    for (const file of files) prepared.push(await prepareImage(file))
    referenceImages.value = [...referenceImages.value, ...prepared]
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : '参考图片选择失败'
  } finally {
    input.value = ''
  }
}

const removeReferenceImage = (index: number) => {
  URL.revokeObjectURL(referenceImages.value[index].previewUrl)
  referenceImages.value.splice(index, 1)
}

const readMediaDuration = (file: File, kind: 'video' | 'audio') => new Promise<number>((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const media = document.createElement(kind)
  media.preload = 'metadata'
  media.onloadedmetadata = () => {
    const duration = media.duration
    URL.revokeObjectURL(url)
    if (!Number.isFinite(duration)) reject(new Error('无法读取素材时长'))
    else resolve(duration)
  }
  media.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取这个媒体文件')) }
  media.src = url
})

const prepareLocalAsset = async (file: File | undefined, type: LocalAsset['type']) => {
  if (!file) throw new Error('没有选择文件')
  if (type === 'reference_video') {
    if (!['video/mp4', 'video/quicktime'].includes(file.type) && !/\.(mp4|mov)$/i.test(file.name)) throw new Error('视频仅支持 MP4 或 MOV')
    if (file.size > 100 * 1024 * 1024) throw new Error('单个视频不能超过 100MB')
    const duration = await readMediaDuration(file, 'video')
    if (duration < 1 || duration > 15.05) throw new Error('单个参考视频时长需在 1 到 15 秒之间')
    return { id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type, file, duration }
  }
  if (type === 'reference_audio') {
    if (!['audio/mpeg', 'audio/wav', 'audio/x-wav'].includes(file.type) && !/\.(mp3|wav)$/i.test(file.name)) throw new Error('音频仅支持 MP3 或 WAV')
    if (file.size > 15 * 1024 * 1024) throw new Error('单个音频不能超过 15MB')
    const duration = await readMediaDuration(file, 'audio')
    if (duration < 1 || duration > 15.05) throw new Error('单个参考音频时长需在 1 到 15 秒之间')
    return { id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type, file, duration }
  }
  const allowed = /\.(docx?|xlsx?|pptx?|pdf|txt|key|pages|numbers|md)$/i
  if (!allowed.test(file.name)) throw new Error('文件格式不受支持')
  if (file.size > 100 * 1024 * 1024) throw new Error('参考文件不能超过 100MB')
  return { id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type, file }
}

const selectLocalReference = async (type: 'reference_video' | 'reference_audio', event: Event) => {
  pageError.value = ''
  const input = event.target as HTMLInputElement
  try {
    const files = Array.from(input.files || [])
    const current = localReferences.value.filter(item => item.type === type).length + urlAssets.value.filter(item => item.type === type).length
    if (current + files.length > 5) throw new Error(type === 'reference_video' ? '参考视频最多 5 段' : '参考音频最多 5 段')
    const prepared: LocalAsset[] = []
    for (const file of files) prepared.push(await prepareLocalAsset(file, type))
    const totalDuration = [...localReferences.value.filter(item => item.type === type), ...prepared].reduce((sum, item) => sum + (item.duration || 0), 0)
    if (totalDuration > 15.05) throw new Error(type === 'reference_video' ? '本机参考视频总时长不能超过 15 秒' : '本机参考音频总时长不能超过 15 秒')
    localReferences.value = [...localReferences.value, ...prepared]
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : '素材选择失败'
  } finally {
    input.value = ''
  }
}

const removeLocalReference = (id: string) => { localReferences.value = localReferences.value.filter(item => item.id !== id) }

const selectSingleFile = async (target: 'file' | 'edit' | 'extension', event: Event) => {
  pageError.value = ''
  const input = event.target as HTMLInputElement
  try {
    const type: LocalAsset['type'] = target === 'file' ? 'file' : 'reference_video'
    const asset = await prepareLocalAsset(input.files?.[0], type)
    if (target === 'file') fileAsset.value = asset
    else if (target === 'edit') editVideoFile.value = asset
    else extensionVideoFile.value = asset
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : '文件选择失败'
  } finally {
    input.value = ''
  }
}

const addUrlAsset = (type: UrlAsset['type']) => {
  const typeCount = urlAssets.value.filter(item => item.type === type).length
  const limit = type === 'reference_image' ? 10 - referenceImages.value.length : 5
  if (typeCount >= limit) { pageError.value = type === 'reference_image' ? '参考图片最多 10 张' : type === 'reference_video' ? '参考视频最多 5 段' : '参考音频最多 5 段'; return }
  urlAssets.value.push({ id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type, url: '' })
}

const assetTypeLabel = (type: UrlAsset['type']) => type === 'reference_image' ? '图片地址' : type === 'reference_video' ? '视频地址' : '音频地址'
const removeUrlAsset = (index: number) => urlAssets.value.splice(index, 1)

const assetReferences = computed(() => {
  const items: Array<{ label: string; text: string }> = []
  let imageIndex = 0
  let videoIndex = 0
  let audioIndex = 0
  for (const asset of referenceImages.value) {
    imageIndex++
    items.push({ label: asset.file.name, text: `图${imageIndex}` })
  }
  for (const asset of urlAssets.value) {
    if (asset.type === 'reference_image') { imageIndex++; items.push({ label: asset.url || '未填写图片', text: `图${imageIndex}` }) }
    if (asset.type === 'reference_video') { videoIndex++; items.push({ label: asset.url || '未填写视频', text: `视频${videoIndex}` }) }
    if (asset.type === 'reference_audio') { audioIndex++; items.push({ label: asset.url || '未填写音频', text: `音频${audioIndex}` }) }
  }
  for (const asset of localReferences.value) {
    if (asset.type === 'reference_video') { videoIndex++; items.push({ label: asset.file.name, text: `视频${videoIndex}` }) }
    if (asset.type === 'reference_audio') { audioIndex++; items.push({ label: asset.file.name, text: `音频${audioIndex}` }) }
  }
  return items
})

const insertReference = (text: string) => {
  const spacer = prompt.value && !/\s$/.test(prompt.value) ? ' ' : ''
  prompt.value += `${spacer}${text}`
}

const pendingUrl = (id: string) => `https://upload.pending/${encodeURIComponent(id)}`

const makeMediaDraft = (): Array<WanMedia & { localAsset?: LocalAsset }> => {
  if (mode.value === 'image') return firstFrame.value ? [{ type: 'first_frame', url: firstFrame.value.dataUrl, label: firstFrame.value.file.name }] : []
  if (mode.value === 'interpolation') return [
    ...(firstFrame.value ? [{ type: 'first_frame' as const, url: firstFrame.value.dataUrl, label: firstFrame.value.file.name }] : []),
    ...(lastFrame.value ? [{ type: 'last_frame' as const, url: lastFrame.value.dataUrl, label: lastFrame.value.file.name }] : [])
  ]
  if (mode.value === 'references') return [
    ...referenceImages.value.map(asset => ({ type: 'reference_image' as const, url: asset.dataUrl, label: asset.file.name })),
    ...urlAssets.value.filter(asset => asset.url.trim()).map(asset => ({ type: asset.type as WanMediaType, url: asset.url.trim(), label: assetTypeLabel(asset.type) })),
    ...localReferences.value.map(asset => ({ type: asset.type, url: pendingUrl(asset.id), label: asset.file.name, localAsset: asset }))
  ]
  if (mode.value === 'file') return fileAsset.value
    ? [{ type: 'file', url: pendingUrl(fileAsset.value.id), label: fileAsset.value.file.name, localAsset: fileAsset.value }]
    : fileUrl.value.trim() ? [{ type: 'file', url: fileUrl.value.trim(), label: '参考文件' }] : []
  if (mode.value === 'link') return linkUrl.value.trim() ? [{ type: 'link', url: linkUrl.value.trim(), label: '公开网页' }] : []
  if (mode.value === 'edit') return editVideoFile.value
    ? [{ type: 'reference_video', url: pendingUrl(editVideoFile.value.id), label: editVideoFile.value.file.name, localAsset: editVideoFile.value }]
    : editVideoUrl.value.trim() ? [{ type: 'reference_video', url: editVideoUrl.value.trim(), label: '待编辑视频' }] : []
  if (mode.value === 'extension') return extensionVideoFile.value
    ? [{ type: 'reference_video', url: pendingUrl(extensionVideoFile.value.id), label: extensionVideoFile.value.file.name, localAsset: extensionVideoFile.value }]
    : extensionVideoUrl.value.trim() ? [{ type: 'reference_video', url: extensionVideoUrl.value.trim(), label: '待延长视频' }] : []
  return []
}

const buildInput = async (): Promise<WanGenerationInput> => {
  if (connectionMode.value === 'app' && !appInstalled) throw new Error('请安装 App 或切换网页直连')
  if (!apiKey.value.trim()) throw new Error('请先填写阿里云百炼 API Key')
  if (!config.workspaceId.trim()) throw new Error('请填写业务空间 ID')
  const seed = config.seed.trim() === '' ? undefined : Number(config.seed)
  const draftMedia = makeMediaDraft()
  const localVideoDuration = draftMedia.reduce((sum, item) => sum + (item.localAsset?.type === 'reference_video' ? item.localAsset.duration || 0 : 0), 0)
  if (config.duration !== -1 && localVideoDuration + config.duration > 30.05) throw new Error('输入视频总时长与输出时长之和不能超过 30 秒')
  const input: WanGenerationInput = {
    prompt: prompt.value,
    model: config.model,
    mode: mode.value,
    resolution: config.resolution,
    ratio: mode.value === 'extension' ? 'adaptive' : config.ratio,
    duration: config.duration,
    audio: config.audio,
    seed,
    promptExtend: config.promptExtend,
    watermark: config.watermark,
    media: draftMedia.map(({ localAsset: _localAsset, ...item }) => item)
  }
  validateWanInput(input)
  if (draftMedia.some(item => item.localAsset)) {
    pageMessage.value = '正在把本机素材上传到百炼临时存储，请保持页面打开。'
    input.media = []
    for (const item of draftMedia) {
      const url = item.localAsset
        ? await uploadWanFile({ apiKey: apiKey.value, baseUrl: baseUrl.value, connectionMode: connectionMode.value }, config.model, item.localAsset.file)
        : item.url
      input.media.push({ type: item.type, url, label: item.label })
    }
  }
  return input
}

const waitFor = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(resolve, milliseconds)
  signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
})

const finishTask = async (task: WanVideoTask, remote: Awaited<ReturnType<typeof queryWanTask>>, controller: AbortController) => {
  if (!remote.videoUrl) throw new Error('任务已完成，但没有返回视频地址')
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000
  await patchWanTask(task.id, {
    status: 'downloading', requestId: remote.requestId || task.requestId, originalPrompt: remote.originalPrompt,
    usage: remote.usage, remoteVideoUrl: remote.videoUrl, remoteVideoExpiresAt: expiresAt, error: ''
  })
  if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
  if (connectionMode.value === 'web') { await patchWanTask(task.id, { status: 'completed', error: '' }); pageMessage.value = '视频已生成，可在作品中播放和下载。'; return }
  try {
    const local = await downloadWanVideo(task.remoteTaskId!, remote.videoUrl)
    await patchWanTask(task.id, { status: 'completed', localFilePath: local.path, localFileUri: local.uri, error: '' })
    pageMessage.value = '视频已生成并保存到本机作品。'
  } catch (error) {
    await patchWanTask(task.id, { status: 'paused', error: `视频已生成，但保存失败：${error instanceof Error ? error.message : '请立即重试下载'}` })
    throw error
  }
}

const pollTask = async (id: string) => {
  if ((connectionMode.value === 'app' && !appInstalled) || pollingControllers.has(id)) return
  const controller = new AbortController()
  pollingControllers.set(id, controller)
  let failures = 0
  try {
    let task = await getWanTask(id)
    if (!task) return
    if (!task.remoteTaskId) throw new Error('任务提交中断，缺少可恢复的任务编号')
    const remoteTaskId = task.remoteTaskId
    if (!apiKey.value.trim()) { await patchWanTask(id, { status: 'paused', error: '填写原 API Key 后可继续查询' }); return }
    while (!controller.signal.aborted) {
      try {
        const remote = await queryWanTask({ apiKey: apiKey.value, baseUrl: task.baseUrl, connectionMode: connectionMode.value }, remoteTaskId)
        failures = 0
        if (remote.status === 'SUCCEEDED') { await finishTask(task, remote, controller); return }
        if (remote.status === 'FAILED') { await patchWanTask(id, { status: 'failed', requestId: remote.requestId, errorCode: remote.code, error: remote.message || 'Wan 视频生成失败' }); return }
        if (remote.status === 'CANCELED') { await patchWanTask(id, { status: 'canceled', requestId: remote.requestId, error: remote.message || '云端任务已取消' }); return }
        if (remote.status === 'UNKNOWN') { await patchWanTask(id, { status: 'expired', requestId: remote.requestId, error: '任务编号已过期，无法继续查询' }); return }
        await patchWanTask(id, { status: remote.status === 'PENDING' ? 'pending' : 'running', requestId: remote.requestId || task.requestId, error: '' })
        task = (await getWanTask(id)) || task
        await waitFor(15000, controller.signal)
      } catch (error: any) {
        if (error?.name === 'AbortError') throw error
        failures++
        if (failures >= 5) throw error
        await waitFor(Math.min(30000, 3000 * 2 ** (failures - 1)), controller.signal)
      }
    }
  } catch (error: any) {
    if (error?.name !== 'AbortError') {
      const message = error?.message || '任务查询暂时中断'
      const current = await getWanTask(id)
      if (current && !['completed', 'failed', 'canceled', 'expired'].includes(current.status)) await patchWanTask(id, { status: 'paused', error: message }).catch(() => undefined)
      pageError.value = message
    }
  } finally {
    pollingControllers.delete(id)
  }
}

const generateVideo = async () => {
  if (isSubmitting.value) return
  pageError.value = ''
  pageMessage.value = ''
  isSubmitting.value = true
  let localId = ''
  try {
    const input = await buildInput()
    localId = `wan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const task: WanVideoTask = {
      id: localId,
      createdAt: Date.now(), updatedAt: Date.now(), status: 'submitting', baseUrl: baseUrl.value,
      params: {
        prompt: input.prompt.trim(), model: input.model, mode: input.mode, resolution: input.resolution,
        ratio: input.ratio, duration: input.duration, audio: input.audio, seed: input.seed,
        promptExtend: input.promptExtend, watermark: input.watermark,
        media: input.media.map(item => ({ type: item.type, label: item.label }))
      }
    }
    await saveWanTask(task)
    const remote = await submitWanGeneration({ apiKey: apiKey.value, baseUrl: baseUrl.value, connectionMode: connectionMode.value }, input)
    await patchWanTask(localId, { status: 'pending', remoteTaskId: remote.taskId, requestId: remote.requestId, error: '' })
    pageMessage.value = '任务已提交，可以离开页面；回来后会自动继续查询。'
    void pollTask(localId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Wan 任务提交失败'
    pageError.value = message
    if (!apiKey.value.trim() || !config.workspaceId.trim()) showSettings.value = true
    if (localId) {
      const task = await getWanTask(localId)
      if (task) await patchWanTask(localId, { status: task.remoteTaskId ? 'paused' : 'failed', error: message })
    }
  } finally {
    isSubmitting.value = false
  }
}

const pauseTask = async (task: WanVideoTask) => {
  pollingControllers.get(task.id)?.abort()
  await patchWanTask(task.id, { status: 'paused', error: '' })
}

const resumeTask = async (task: WanVideoTask) => {
  pageError.value = ''
  if (!apiKey.value.trim()) { showSettings.value = true; pageError.value = '请先填写原阿里云百炼 API Key'; return }
  if (!task.remoteTaskId) { pageError.value = '这个任务没有云端任务编号，不能安全地重新提交'; return }
  await patchWanTask(task.id, { status: 'running', error: '' })
  void pollTask(task.id)
}

const retryDownload = async (task: WanVideoTask) => {
  pageError.value = ''
  try {
    if (!task.remoteVideoUrl || (task.remoteVideoExpiresAt && task.remoteVideoExpiresAt <= Date.now())) throw new Error('云端视频地址已经过期')
    await patchWanTask(task.id, { status: 'downloading', error: '' })
    const local = await downloadWanVideo(task.remoteTaskId || task.id, task.remoteVideoUrl)
    await patchWanTask(task.id, { status: 'completed', localFilePath: local.path, localFileUri: local.uri, error: '' })
  } catch (error) {
    const message = error instanceof Error ? error.message : '视频保存失败'
    await patchWanTask(task.id, { status: 'paused', error: message })
    pageError.value = message
  }
}

const shareTask = async (task: WanVideoTask) => {
  pageError.value = ''
  try {
    if (!task.localFileUri) throw new Error('本机没有可分享的视频文件')
    await shareWanVideo(task.localFileUri)
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : '视频分享失败'
  }
}

const reuseTask = (task: WanVideoTask) => {
  config.model = task.params.model
  config.resolution = task.params.resolution
  config.ratio = task.params.ratio
  config.duration = task.params.duration
  config.audio = task.params.audio
  config.seed = task.params.seed === undefined ? '' : String(task.params.seed)
  config.promptExtend = task.params.promptExtend
  config.watermark = task.params.watermark
  prompt.value = task.params.prompt
  chooseMode(task.params.mode)
  activeTab.value = 'create'
  pageMessage.value = task.params.media.length ? '已复用参数和提示词；出于隐私与有效期考虑，请重新添加原素材。' : '已复用这项作品的参数和提示词。'
}

const confirmDelete = async () => {
  const task = pendingDelete.value
  if (!task) return
  pollingControllers.get(task.id)?.abort()
  await removeWanVideoFile(task.localFilePath)
  await removeWanTask(task.id)
  pendingDelete.value = null
}

const recoverTasks = async () => {
  await loadWanTasks()
  if ((connectionMode.value === 'app' && !appInstalled) || !apiKey.value.trim()) return
  for (const task of tasks.value.filter(item => ['pending', 'running', 'downloading'].includes(item.status))) void pollTask(task.id)
}

onMounted(async () => {
  await loadWanTasks()
  if (connectionMode.value === 'web') { apiKey.value = localStorage.getItem('app_wan_web_api_key') || ''; savedApiKey.value = apiKey.value }
  if (appInstalled && connectionMode.value === 'app') {
    try {
      apiKey.value = (await getSecureValue('wan_api_key')) || ''
      savedApiKey.value = apiKey.value
    } catch (error) {
      pageError.value = error instanceof Error ? error.message : '无法读取本机 API Key'
    }
    appStateHandle = await App.addListener('appStateChange', ({ isActive }) => { if (isActive) void recoverTasks() })
  }
  keyReady.value = true
  showSettings.value = !apiKey.value || !config.workspaceId
  await recoverTasks()
})

onUnmounted(() => {
  pollingControllers.forEach(controller => controller.abort())
  pollingControllers.clear()
  void appStateHandle?.remove()
  if (firstFrame.value) URL.revokeObjectURL(firstFrame.value.previewUrl)
  if (lastFrame.value) URL.revokeObjectURL(lastFrame.value.previewUrl)
  referenceImages.value.forEach(asset => URL.revokeObjectURL(asset.previewUrl))
})
</script>

<template>
  <div class="wan-hall" :class="{ dark: globalSettings.darkMode }">
    <header class="hall-header">
      <button class="icon-button" type="button" aria-label="返回视频引擎" @click="$emit('back')">
        <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <div class="header-copy"><h1>Wan 3.0</h1><p>阿里云百炼全模态原生音画生成</p></div>
      <span class="app-badge" :class="{ ready: appInstalled }">{{ appInstalled ? 'APP' : '需 APP' }}</span>
    </header>

    <nav class="hall-tabs" aria-label="Wan 页面">
      <button type="button" :class="{ active: activeTab === 'create' }" @click="activeTab = 'create'">创作</button>
      <button type="button" :class="{ active: activeTab === 'works' }" @click="activeTab = 'works'">作品<span v-if="tasks.length">{{ tasks.length }}</span></button>
    </nav>

    <main class="hall-scroll">
      <Transition name="message"><p v-if="pageMessage" class="page-message" role="status">{{ pageMessage }}</p></Transition>
      <Transition name="message"><p v-if="pageError" class="page-error" role="alert">{{ pageError }}</p></Transition>

      <section v-if="connectionMode === 'app' && !appInstalled" class="install-note">
        <strong>App 直连需要安装应用</strong>
        <p>也可以在连接设置中切换为网页直连。</p>
      </section>

      <template v-if="activeTab === 'create'">
        <section class="settings-panel" :class="{ open: showSettings }">
          <button class="section-toggle" type="button" @click="showSettings = !showSettings">
            <span><small>连接设置</small><strong>{{ config.workspaceId ? `${WAN_REGIONS.find(item => item.value === config.region)?.label} · ${config.workspaceId}` : '填写百炼业务空间与密钥' }}</strong></span>
            <svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div v-if="showSettings" class="settings-body">
            <div class="mode-tabs"><button type="button" :class="{ active: connectionMode === 'web' }" @click="connectionMode = 'web'">网页直连</button><button type="button" :class="{ active: connectionMode === 'app' }" @click="connectionMode = 'app'">App 直连</button></div>
            <label class="field"><span>地域</span><select v-model="config.region"><option v-for="item in WAN_REGIONS" :key="item.value" :value="item.value">{{ item.label }}</option></select><small>地域必须与 API Key、模型和业务空间一致。</small></label>
            <label class="field"><span>业务空间 ID</span><input v-model.trim="config.workspaceId" autocomplete="off" placeholder="例如 llm-xxxxxxxx"><small>从百炼控制台的 API Host 中复制域名前缀。</small></label>
            <label class="field key-field"><span>API Key</span><div class="input-action"><input v-model="apiKey" :type="showApiKey ? 'text' : 'password'" autocomplete="off" placeholder="sk-..."><button type="button" @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button></div><small>仅写入 Android/iOS 系统安全存储，不进入网页存储或备份。</small></label>
            <button class="save-key" type="button" :disabled="keySaving || apiKeyStored || (connectionMode === 'app' && !appInstalled)" @click="saveApiKey">{{ keySaving ? '保存中…' : apiKeyStored ? '已保存' : '保存 API Key' }}</button>
          </div>
        </section>

        <section class="create-section">
          <div class="section-heading"><div><small>生成引擎</small><h2>标准速度或 Prime 高速生成</h2></div><span class="cost-pill">{{ estimatedCostText }}</span></div>
          <div class="model-grid">
            <button v-for="item in WAN_MODELS" :key="item.value" type="button" :class="{ active: config.model === item.value }" @click="config.model = item.value">
              <strong>{{ item.label }}</strong><small>{{ item.description }}</small>
            </button>
          </div>
        </section>

        <section class="create-section">
          <div class="section-heading"><div><small>生成方式</small><h2>{{ modeOptions.find(item => item.value === mode)?.description }}</h2></div></div>
          <div class="mode-tabs"><button v-for="item in modeOptions" :key="item.value" type="button" :class="{ active: mode === item.value }" @click="chooseMode(item.value)">{{ item.label }}</button></div>

          <div v-if="mode === 'image' || mode === 'interpolation'" class="upload-grid" :class="{ double: mode === 'interpolation' }">
            <div class="upload-slot" :class="{ filled: firstFrame }">
              <img v-if="firstFrame" :src="firstFrame.previewUrl" alt="首帧预览">
              <label v-else><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5"/></svg><span>添加首帧</span><small>JPG / PNG / BMP / WEBP</small><input type="file" accept="image/jpeg,image/png,image/bmp,image/webp" @change="selectFrame('first', $event)"></label>
              <button v-if="firstFrame" type="button" aria-label="移除首帧" @click="clearFrame('first')">×</button>
            </div>
            <div v-if="mode === 'interpolation'" class="upload-slot" :class="{ filled: lastFrame }">
              <img v-if="lastFrame" :src="lastFrame.previewUrl" alt="尾帧预览">
              <label v-else><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5"/></svg><span>添加尾帧</span><small>与首帧保持接近比例</small><input type="file" accept="image/jpeg,image/png,image/bmp,image/webp" @change="selectFrame('last', $event)"></label>
              <button v-if="lastFrame" type="button" aria-label="移除尾帧" @click="clearFrame('last')">×</button>
            </div>
          </div>

          <div v-if="mode === 'references'" class="reference-editor">
            <div class="reference-grid">
              <div v-for="(asset, index) in referenceImages" :key="asset.id" class="reference-thumb"><img :src="asset.previewUrl" :alt="`参考图 ${index + 1}`"><span>图{{ index + 1 }}</span><button type="button" aria-label="移除参考图" @click="removeReferenceImage(index)">×</button></div>
              <label v-if="referenceImages.length + urlAssets.filter(item => item.type === 'reference_image').length < 10" class="reference-add"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>本机图片</span><input type="file" multiple accept="image/jpeg,image/png,image/bmp,image/webp" @change="selectReferenceImages"></label>
            </div>
            <div class="asset-actions">
              <label>本机视频<input type="file" multiple accept="video/mp4,video/quicktime,.mp4,.mov" @change="selectLocalReference('reference_video', $event)"></label>
              <label>本机音频<input type="file" multiple accept="audio/mpeg,audio/wav,.mp3,.wav" @change="selectLocalReference('reference_audio', $event)"></label>
              <button type="button" @click="addUrlAsset('reference_image')">图片地址</button><button type="button" @click="addUrlAsset('reference_video')">视频地址</button><button type="button" @click="addUrlAsset('reference_audio')">音频地址</button>
            </div>
            <div v-if="localReferences.length" class="local-assets"><div v-for="asset in localReferences" :key="asset.id"><span>{{ asset.type === 'reference_video' ? '视频' : '音频' }} · {{ asset.file.name }} · {{ asset.duration?.toFixed(1) }} 秒</span><button type="button" aria-label="移除本机素材" @click="removeLocalReference(asset.id)">×</button></div></div>
            <div v-if="urlAssets.length" class="url-assets">
              <div v-for="(asset, index) in urlAssets" :key="asset.id" class="url-row"><span>{{ assetTypeLabel(asset.type) }}</span><input v-model.trim="asset.url" inputmode="url" :placeholder="asset.type === 'reference_audio' ? 'https://...mp3 或 oss://...' : asset.type === 'reference_video' ? 'https://...mp4 或 oss://...' : 'https://...jpg 或 oss://...'"><button type="button" aria-label="移除素材地址" @click="removeUrlAsset(index)">×</button></div>
            </div>
            <div v-if="assetReferences.length" class="reference-chips"><button v-for="item in assetReferences" :key="`${item.text}_${item.label}`" type="button" :title="item.label" @click="insertReference(item.text)">{{ item.text }}</button></div>
            <p>本机图片会在设备内处理；视频、音频使用公网或百炼临时 OSS 地址。参考视频和音频各最多 5 段、各自总时长不超过 15 秒。</p>
          </div>

          <div v-if="mode === 'file'" class="source-mode">
            <label class="source-file"><span>{{ fileAsset ? fileAsset.file.name : '选择本机文件' }}</span><input type="file" accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.txt,.key,.pages,.numbers,.md" @change="selectSingleFile('file', $event)"></label>
            <button v-if="fileAsset" type="button" @click="fileAsset = null">移除本机文件</button>
            <label class="field"><span>或填写参考文件地址</span><input v-model.trim="fileUrl" inputmode="url" placeholder="https://...pdf 或 oss://..."><small>支持 PDF、Word、PPT、Excel、TXT、Markdown 等，最多一个、100MB；部分格式最多 50 页。</small></label>
          </div>
          <label v-if="mode === 'link'" class="field url-mode"><span>公开网页地址</span><input v-model.trim="linkUrl" inputmode="url" placeholder="https://example.com/article"><small>网页必须无需登录且可公开访问。</small></label>
          <div v-if="mode === 'edit'" class="source-mode">
            <label class="source-file"><span>{{ editVideoFile ? editVideoFile.file.name : '选择本机待编辑视频' }}</span><input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" @change="selectSingleFile('edit', $event)"></label><button v-if="editVideoFile" type="button" @click="editVideoFile = null">移除本机视频</button>
            <label class="field"><span>或填写待编辑视频地址</span><input v-model.trim="editVideoUrl" inputmode="url" placeholder="https://...mp4 或 oss://..."><small>在提示词中明确写出删除、替换、增加、改风格或修改台词等编辑意图。</small></label>
          </div>
          <div v-if="mode === 'extension'" class="source-mode">
            <label class="source-file"><span>{{ extensionVideoFile ? extensionVideoFile.file.name : '选择本机待延长视频' }}</span><input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" @change="selectSingleFile('extension', $event)"></label><button v-if="extensionVideoFile" type="button" @click="extensionVideoFile = null">移除本机视频</button>
            <label class="field"><span>或填写待延长视频地址</span><input v-model.trim="extensionVideoUrl" inputmode="url" placeholder="https://...mp4 或 oss://..."><small>在提示词中说明向前、向后或双向延长；比例固定为自适应。</small></label>
          </div>
        </section>

        <section class="create-section prompt-section">
          <div class="section-heading"><div><small>创作描述</small><h2>画面、动作、镜头、台词与声音</h2></div><span class="counter">{{ prompt.length }} / 20000</span></div>
          <textarea v-model="prompt" maxlength="20000" :placeholder="mode === 'edit' ? '例如：将整个画面转换为黏土风格，保留人物动作与台词…' : mode === 'extension' ? '例如：将视频1向后延长，镜头继续跟随人物走向门外…' : '描述主体、场景、动作、运镜、光影、台词、BGM 与音效；多镜头可使用时间戳。'"></textarea>
        </section>

        <section class="create-section">
          <div class="section-heading"><div><small>输出参数</small><h2>分辨率、比例、时长与声音</h2></div></div>
          <div class="parameter-grid">
            <label class="field"><span>分辨率</span><select v-model="config.resolution"><option value="480P">480P</option><option value="720P">720P</option><option value="1080P">1080P</option></select></label>
            <label class="field"><span>画面比例</span><select v-model="config.ratio" :disabled="mode === 'extension'"><option value="adaptive">自适应</option><option value="16:9">16:9</option><option value="4:3">4:3</option><option value="1:1">1:1</option><option value="3:4">3:4</option><option value="9:16">9:16</option></select></label>
            <label class="field"><span>视频时长</span><select v-model.number="config.duration"><option :value="-1">智能时长</option><option v-for="second in 29" :key="second + 1" :value="second + 1">{{ second + 1 }} 秒</option></select></label>
            <label class="field"><span>Seed</span><input v-model.trim="config.seed" inputmode="numeric" placeholder="留空随机"></label>
          </div>
          <div class="switch-list">
            <label><span><strong>生成声音</strong><small>原生台词、BGM 与音效；关闭不降低价格</small></span><input v-model="config.audio" type="checkbox"><i></i></label>
            <label><span><strong>智能改写</strong><small>优化较短提示词，可能增加生成耗时</small></span><input v-model="config.promptExtend" type="checkbox"><i></i></label>
            <label><span><strong>添加水印</strong><small>在生成视频中加入平台水印标识</small></span><input v-model="config.watermark" type="checkbox"><i></i></label>
          </div>
          <div class="generation-note"><span>30 fps</span><span>MP4</span><span>结果地址保留 24 小时</span><span>最多 5 个并发任务</span></div>
        </section>

        <button class="generate-button" type="button" :disabled="!canGenerate" @click="generateVideo"><span v-if="isSubmitting" class="spinner"></span>{{ isSubmitting ? '正在提交…' : connectionMode === 'app' && !appInstalled ? '请安装 App 或切换网页直连' : !apiKey.trim() || !config.workspaceId.trim() ? '请完成连接设置' : `生成视频 · ${estimatedCostText}` }}</button>

        <section v-if="activeTasks.length" class="running-section">
          <div class="section-heading"><div><small>进行中的任务</small><h2>{{ activeTasks.length }} 项正在处理</h2></div></div>
          <div v-for="task in activeTasks" :key="task.id" class="running-card"><div class="running-indicator"><span></span></div><div class="task-copy"><strong>{{ modelLabel(task.params.model) }} · {{ statusLabel(task.status) }}</strong><p>{{ task.params.prompt || task.params.media.map(item => item.label).filter(Boolean).join('、') || '素材生成' }}</p><small>{{ task.params.resolution }} · {{ task.params.duration === -1 ? '智能时长' : `${task.params.duration} 秒` }}</small></div><button type="button" @click="pauseTask(task)">暂停查询</button></div>
        </section>
      </template>

      <template v-else>
        <div v-if="!tasks.length" class="empty-works"><svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z"/></svg><h2>还没有 Wan 作品</h2><p>完成的视频会立即保存到本机，并在这里保留任务参数与使用量。</p><button type="button" @click="activeTab = 'create'">开始创作</button></div>
        <div v-else class="works-list">
          <article v-for="task in tasks" :key="task.id" class="work-card">
            <div class="work-media" :class="task.params.ratio === '9:16' || task.params.ratio === '3:4' ? 'portrait' : 'landscape'">
              <video v-if="task.localFileUri || task.remoteVideoUrl" :src="task.localFileUri ? videoUrl(task) : task.remoteVideoUrl" controls playsinline preload="metadata"></video>
              <div v-else class="work-placeholder"><span v-if="['submitting','pending','running','downloading'].includes(task.status)" class="spinner"></span><svg v-else viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z"/></svg><strong>{{ statusLabel(task.status) }}</strong></div>
              <span class="status-badge" :class="task.status">{{ statusLabel(task.status) }}</span>
            </div>
            <div class="work-info"><div><strong>{{ task.params.prompt || task.params.media.map(item => item.label).filter(Boolean).join('、') || '素材生成' }}</strong><p>{{ modelLabel(task.params.model) }} · {{ modeLabel(task.params.mode) }} · {{ task.params.resolution }} · {{ task.usage?.output_video_duration || (task.params.duration === -1 ? '智能' : task.params.duration) }} 秒 · {{ formatTime(task.createdAt) }}</p><p v-if="task.requestId">Request ID：{{ task.requestId }}</p><p v-if="task.error" class="task-error">{{ task.error }}</p></div>
              <div class="work-actions"><a v-if="!task.localFileUri && task.remoteVideoUrl" :href="task.remoteVideoUrl" :download="`${task.id}.mp4`" target="_blank" rel="noopener">下载</a><button v-if="task.status === 'paused' && task.remoteVideoUrl && connectionMode === 'app'" type="button" @click="retryDownload(task)">重试保存</button><button v-else-if="task.status === 'paused' && task.remoteTaskId" type="button" @click="resumeTask(task)">继续查询</button><button v-if="task.localFileUri" type="button" @click="shareTask(task)">分享/保存</button><button type="button" @click="reuseTask(task)">复用参数</button><button class="danger" type="button" @click="pendingDelete = task">删除</button></div>
            </div>
          </article>
        </div>
      </template>
    </main>

    <Transition name="sheet"><div v-if="pendingDelete" class="sheet-overlay" @click.self="pendingDelete = null"><section class="confirm-sheet"><div class="sheet-mark"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5"/></svg></div><h2>删除这项 Wan 作品？</h2><p>本机视频文件和任务记录都会删除，云端任务与已产生费用不受影响。</p><div><button type="button" @click="pendingDelete = null">取消</button><button class="danger" type="button" @click="confirmDelete">确认删除</button></div></section></div></Transition>
  </div>
</template>

<style scoped>
.wan-hall{--vh-bg:#f7f7f5;--vh-surface:#fff;--vh-soft:#f0f0ed;--vh-text:#1d1d1f;--vh-sub:#777773;--vh-muted:#a0a09a;--vh-line:rgba(20,20,20,.08);--vh-accent:#171717;position:absolute;inset:0;z-index:1000;display:flex;flex-direction:column;overflow:hidden;background:var(--vh-bg);color:var(--vh-text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;-webkit-tap-highlight-color:transparent}.wan-hall.dark{--vh-bg:#19191b;--vh-surface:#242426;--vh-soft:#2d2d30;--vh-text:#f5f5f2;--vh-sub:#aaa9a3;--vh-muted:#787875;--vh-line:rgba(255,255,255,.09);--vh-accent:#f1f1ed}
.hall-header{display:flex;min-height:58px;flex:0 0 auto;align-items:center;justify-content:space-between;padding:12px 18px 8px;box-sizing:border-box}.header-copy{min-width:0;flex:1;text-align:center}.header-copy h1{margin:0;font-size:20px;font-weight:680;line-height:1.15;letter-spacing:-.5px}.header-copy p{overflow:hidden;margin:4px 0 0;color:var(--vh-sub);font-size:11px;line-height:1.2;white-space:nowrap;text-overflow:ellipsis}.app-badge{display:inline-flex;align-items:center;gap:4px;margin-top:5px;padding:3px 7px;border-radius:8px;background:#fff0f0;color:#b74343;font-size:8px;font-weight:650}.app-badge.ready{background:#edf6ef;color:#397148}.dark .app-badge{background:#3b2527;color:#efaaaa}.dark .app-badge.ready{background:#223429;color:#91c89f}.icon-button{display:grid;width:34px;height:34px;flex:0 0 auto;padding:0;border:0;border-radius:50%;background:transparent;color:var(--vh-text);cursor:pointer;place-items:center}.icon-button:active{background:var(--vh-soft)}.icon-button svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8}
.hall-tabs{display:flex;flex:0 0 auto;gap:5px;margin:4px 18px 10px;padding:3px;border-radius:12px;background:var(--vh-soft)}.hall-tabs button{display:flex;min-width:0;flex:1;align-items:center;justify-content:center;gap:5px;padding:8px 10px;border:0;border-radius:9px;background:transparent;color:var(--vh-sub);font-size:13px;font-weight:600;cursor:pointer}.hall-tabs button.active{background:var(--vh-surface);color:var(--vh-text);box-shadow:0 2px 9px rgba(0,0,0,.05)}.hall-tabs span{min-width:16px;padding:1px 4px;border-radius:10px;background:var(--vh-soft);font-size:9px}.hall-scroll{flex:1;min-height:0;overflow-y:auto;padding:0 18px calc(28px + env(safe-area-inset-bottom));box-sizing:border-box;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.page-message,.page-error,.install-note{margin:4px 0 10px;padding:9px 11px;border-radius:11px;font-size:11px;line-height:1.45}.page-message{background:#edf6ef;color:#397148}.page-error,.install-note{background:#fff0f0;color:#b64242}.dark .page-message{background:#223429;color:#91c89f}.dark .page-error,.dark .install-note{background:#3b2527;color:#efaaaa}.install-note strong{display:block;margin-bottom:2px}.install-note p{margin:0}
.settings-panel,.create-section,.running-section{margin-bottom:12px;border:1px solid var(--vh-line);border-radius:17px;background:var(--vh-surface)}.section-toggle{display:flex;width:100%;align-items:center;justify-content:space-between;padding:13px 14px;border:0;border-radius:17px;background:transparent;color:inherit;text-align:left;cursor:pointer}.section-toggle span{display:flex;min-width:0;flex-direction:column;gap:3px}.section-toggle small,.section-heading small{color:var(--vh-muted);font-size:9px;font-weight:650;letter-spacing:.8px}.section-toggle strong{overflow:hidden;font-size:12px;font-weight:620;white-space:nowrap;text-overflow:ellipsis}.section-toggle svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6;transition:transform .2s}.settings-panel.open .section-toggle svg{transform:rotate(180deg)}.settings-body{display:grid;gap:12px;padding:13px 14px 15px;border-top:1px solid var(--vh-line)}
.field{display:flex;min-width:0;flex-direction:column;gap:6px}.field>span{color:var(--vh-sub);font-size:10px;font-weight:600}.field>small{color:var(--vh-muted);font-size:9px;line-height:1.4}.input-action{display:flex;min-width:0;gap:6px}.input-action input{min-width:0;flex:1}.input-action button,.save-key,.work-actions button,.running-card>button{flex:0 0 auto;padding:0 11px;border:0;border-radius:10px;background:var(--vh-soft);color:var(--vh-text);font-size:10px;font-weight:600;cursor:pointer}.save-key{min-height:36px}
.create-section,.running-section{padding:14px}.section-heading{display:flex;min-width:0;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:11px}.section-heading>div{min-width:0}.section-heading h2{overflow:hidden;margin:3px 0 0;font-size:14px;font-weight:660;line-height:1.3;white-space:nowrap;text-overflow:ellipsis}.cost-pill{flex:0 0 auto;padding:5px 8px;border-radius:10px;background:var(--vh-soft);color:var(--vh-sub);font-size:9px;font-weight:650}.model-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.model-grid button{min-width:0;padding:10px 6px;border:1px solid transparent;border-radius:12px;background:var(--vh-soft);color:var(--vh-text);text-align:center;cursor:pointer}.model-grid button.active{border-color:var(--vh-text);background:var(--vh-surface)}.model-grid strong,.model-grid small{display:block;overflow:hidden;text-overflow:ellipsis}.model-grid strong{font-size:11px;white-space:nowrap}.model-grid small{margin-top:4px;color:var(--vh-muted);font-size:8px;line-height:1.25}
.mode-tabs{display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.mode-tabs::-webkit-scrollbar{display:none}.mode-tabs button{flex:0 0 auto;padding:7px 11px;border:0;border-radius:100px;background:var(--vh-soft);color:var(--vh-sub);font-size:10px;font-weight:620;cursor:pointer}.mode-tabs button.active{background:var(--vh-accent);color:var(--vh-bg)}.upload-grid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:11px}.upload-grid.double{grid-template-columns:repeat(2,minmax(0,1fr))}.upload-slot{position:relative;display:grid;min-width:0;min-height:126px;overflow:hidden;border:1px dashed var(--vh-line);border-radius:13px;background:var(--vh-soft);place-items:center}.upload-slot.filled{border-style:solid}.upload-slot img{width:100%;height:150px;object-fit:cover}.upload-slot label,.reference-add{display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--vh-sub);cursor:pointer}.upload-slot input,.reference-add input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.upload-slot label svg,.reference-add svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.5}.upload-slot label span{margin-top:7px;font-size:10px;font-weight:650}.upload-slot label small{margin-top:3px;color:var(--vh-muted);font-size:8px}.upload-slot>button,.reference-thumb>button{position:absolute;top:6px;right:6px;display:grid;width:23px;height:23px;padding:0;border:0;border-radius:50%;background:rgba(20,20,20,.72);color:#fff;font-size:15px;cursor:pointer;place-items:center}
.reference-editor{margin-top:11px}.reference-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.reference-thumb,.reference-add{position:relative;min-width:0;height:105px;overflow:hidden;border-radius:12px;background:var(--vh-soft)}.reference-thumb img{width:100%;height:100%;object-fit:cover}.reference-add{border:1px dashed var(--vh-line)}.reference-add span{margin-top:5px;font-size:9px}.url-assets{display:grid;gap:6px;margin-top:9px}.url-row{display:grid;grid-template-columns:62px minmax(0,1fr) 28px;gap:6px}.url-row select,.url-row input{min-width:0}.url-row button{padding:0;border:0;border-radius:9px;background:var(--vh-soft);color:var(--vh-sub);font-size:14px}.reference-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.reference-chips span{padding:4px 7px;border-radius:8px;background:var(--vh-soft);color:var(--vh-muted);font-size:8px}
.prompt-section textarea{width:100%;min-height:128px;resize:vertical;padding:12px;border:0;border-radius:13px;box-sizing:border-box;background:var(--vh-soft);color:var(--vh-text);font:inherit;font-size:12px;line-height:1.65;outline:none}.prompt-section>p{margin:8px 1px 0;color:var(--vh-muted);font-size:9px;line-height:1.45}.prompt-section textarea:focus,input:focus,select:focus{box-shadow:inset 0 0 0 1px var(--vh-text)}.counter{flex:0 0 auto;color:var(--vh-muted);font-size:9px}input,select{width:100%;min-height:36px;padding:8px 10px;border:0;border-radius:10px;box-sizing:border-box;appearance:none;background:var(--vh-soft);color:var(--vh-text);font:inherit;font-size:11px;outline:none}select{padding-right:24px;background-image:linear-gradient(45deg,transparent 50%,var(--vh-sub) 50%),linear-gradient(135deg,var(--vh-sub) 50%,transparent 50%);background-position:calc(100% - 13px) 15px,calc(100% - 9px) 15px;background-repeat:no-repeat;background-size:4px 4px}.parameter-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 8px}.switch-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:11px}.switch-list label{display:flex;min-width:0;align-items:center;gap:7px;padding:8px;border-radius:10px;background:var(--vh-soft);color:var(--vh-sub);font-size:9px}.switch-list input{width:14px;min-height:14px;accent-color:var(--vh-accent)}.generation-note{display:flex;flex-wrap:wrap;gap:5px;margin-top:11px}.generation-note span{padding:4px 7px;border-radius:8px;background:var(--vh-soft);color:var(--vh-muted);font-size:8px}
.generate-button{display:flex;width:100%;align-items:center;justify-content:center;gap:8px;margin:2px 0 14px;padding:13px 14px;border:0;border-radius:14px;background:var(--vh-accent);color:var(--vh-bg);font-size:12px;font-weight:680;cursor:pointer}.generate-button:disabled{opacity:.45;cursor:not-allowed}.spinner{width:13px;height:13px;border:1.8px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite}.running-card{display:flex;min-width:0;align-items:center;gap:9px;padding:10px 0;border-top:1px solid var(--vh-line)}.running-indicator{display:grid;width:25px;height:25px;flex:0 0 auto;border-radius:50%;background:var(--vh-soft);place-items:center}.running-indicator span{width:7px;height:7px;border-radius:50%;background:#63a878;box-shadow:0 0 0 4px rgba(99,168,120,.15);animation:pulse 1.6s ease-in-out infinite}.task-copy{min-width:0;flex:1}.task-copy strong{font-size:10px}.task-copy p{overflow:hidden;margin:3px 0;color:var(--vh-sub);font-size:9px;white-space:nowrap;text-overflow:ellipsis}.task-copy small{color:var(--vh-muted);font-size:8px}.running-card>button{min-height:28px}
.works-list{display:grid;gap:11px}.work-card{min-width:0;overflow:hidden;border:1px solid var(--vh-line);border-radius:17px;background:var(--vh-surface)}.work-media{position:relative;width:100%;overflow:hidden;background:#111}.work-media.landscape{aspect-ratio:16/9}.work-media.portrait{max-height:440px;aspect-ratio:9/16}.work-media video{width:100%;height:100%;object-fit:contain;background:#111}.work-placeholder{display:flex;width:100%;height:100%;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:#aaa}.work-placeholder svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.5}.work-placeholder strong{font-size:10px}.status-badge{position:absolute;top:8px;left:8px;padding:4px 7px;border-radius:8px;background:rgba(20,20,20,.66);color:#fff;font-size:8px;backdrop-filter:blur(6px)}.status-badge.completed{background:rgba(45,112,67,.78)}.status-badge.failed{background:rgba(159,54,54,.78)}.work-info{padding:11px 12px}.work-info strong{display:block;overflow:hidden;font-size:11px;line-height:1.4;white-space:nowrap;text-overflow:ellipsis}.work-info p{margin:4px 0 0;color:var(--vh-muted);font-size:8px;line-height:1.4}.work-info .task-error{color:#b84a4a;font-size:9px}.work-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.work-actions button{min-height:28px}.work-actions .danger{margin-left:auto;background:#fff0f0;color:#b74343}.dark .work-actions .danger{background:#3b2527;color:#efaaaa}
.empty-works{display:flex;min-height:58vh;align-items:center;justify-content:center;flex-direction:column;text-align:center}.empty-works svg{width:42px;height:42px;fill:none;stroke:var(--vh-muted);stroke-width:1.2}.empty-works h2{margin:14px 0 5px;font-size:15px}.empty-works p{max-width:260px;margin:0;color:var(--vh-sub);font-size:10px;line-height:1.6}.empty-works button{margin-top:14px;padding:9px 15px;border:0;border-radius:11px;background:var(--vh-accent);color:var(--vh-bg);font-size:10px;font-weight:650;cursor:pointer}.sheet-overlay{position:fixed;inset:0;z-index:1200;display:flex;align-items:flex-end;justify-content:center;padding:12px;box-sizing:border-box;background:rgba(0,0,0,.3);backdrop-filter:blur(5px)}.confirm-sheet{width:min(100%,430px);padding:21px 18px calc(18px + env(safe-area-inset-bottom));border-radius:24px;background:var(--vh-surface);box-sizing:border-box;text-align:center}.sheet-mark{display:grid;width:38px;height:38px;margin:0 auto 11px;border-radius:50%;background:#fff0f0;color:#b74343;place-items:center}.dark .sheet-mark{background:#3b2527;color:#efaaaa}.sheet-mark svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.5}.confirm-sheet h2{margin:0;font-size:15px}.confirm-sheet p{margin:8px auto 17px;color:var(--vh-sub);font-size:10px;line-height:1.55}.confirm-sheet>div:last-child{display:grid;grid-template-columns:1fr 1fr;gap:8px}.confirm-sheet button{padding:11px;border:0;border-radius:12px;background:var(--vh-soft);color:var(--vh-text);font-size:11px;font-weight:650;cursor:pointer}.confirm-sheet button.danger{background:#c84b4b;color:#fff}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{50%{opacity:.45;transform:scale(.8)}}.sheet-enter-active,.sheet-leave-active{transition:opacity .22s}.sheet-enter-active .confirm-sheet,.sheet-leave-active .confirm-sheet{transition:transform .25s}.sheet-enter-from,.sheet-leave-to{opacity:0}.sheet-enter-from .confirm-sheet,.sheet-leave-to .confirm-sheet{transform:translateY(25px)}
.asset-actions{flex-wrap:wrap}.asset-actions button,.asset-actions label{display:flex;min-width:78px;min-height:30px;flex:1;align-items:center;justify-content:center;padding:0 8px;border:0;border-radius:10px;box-sizing:border-box;background:var(--vh-soft);color:var(--vh-text);font-size:9px;font-weight:600;cursor:pointer}.asset-actions label input,.source-file input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.local-assets{display:grid;gap:6px;margin-top:9px}.local-assets>div{display:flex;min-width:0;align-items:center;gap:7px;padding:7px 8px;border-radius:10px;background:var(--vh-soft)}.local-assets span{overflow:hidden;min-width:0;flex:1;color:var(--vh-sub);font-size:9px;white-space:nowrap;text-overflow:ellipsis}.local-assets button{flex:0 0 auto;width:24px;height:24px;padding:0;border:0;border-radius:8px;background:var(--vh-surface);color:var(--vh-sub);font-size:14px}.source-mode{display:grid;gap:8px;margin-top:12px}.source-file{display:flex;min-width:0;min-height:38px;align-items:center;justify-content:center;padding:0 10px;border:1px dashed var(--vh-line);border-radius:11px;background:var(--vh-soft);color:var(--vh-sub);font-size:10px;font-weight:620;cursor:pointer}.source-file span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.source-mode>button{justify-self:start;padding:6px 9px;border:0;border-radius:9px;background:#fff0f0;color:#b74343;font-size:9px}.dark .source-mode>button{background:#3b2527;color:#efaaaa}
@media(min-width:700px){.hall-header,.hall-tabs,.hall-scroll{width:min(100%,760px);margin-left:auto;margin-right:auto}.hall-tabs{width:min(calc(100% - 36px),724px)}.hall-scroll{padding-left:18px;padding-right:18px}.works-list{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.work-media.portrait{height:430px}.settings-body{grid-template-columns:1fr 1fr}.settings-body .key-field,.settings-body .save-key{grid-column:1/-1}}
@media(max-width:360px){.hall-header{padding-left:14px;padding-right:14px}.hall-tabs{margin-left:14px;margin-right:14px}.hall-scroll{padding-left:14px;padding-right:14px}.header-copy h1{font-size:19px}.header-copy p{font-size:10px}.create-section,.running-section{padding:12px}.mode-tabs button{padding-left:10px;padding-right:10px}.upload-slot{min-height:110px}.upload-slot img{height:128px}.parameter-grid{gap:9px 6px}.input-action button{padding-left:9px;padding-right:9px}.generate-button{font-size:11px}.url-row{grid-template-columns:52px minmax(0,1fr) 26px}.asset-actions button{padding:0 6px;font-size:9px}}
</style>
