/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive } from 'vue'
import localforage from 'localforage'

export type KeepAliveAudioSource = 'silent' | 'soft' | 'upload' | 'url'
export type KeepAliveStrategy = 'wakeLock' | 'audio' | 'worker' | 'webrtc' | 'titlePulse' | 'multiTab'

export interface KeepAliveConfig {
  enabled: boolean
  wakeLock: boolean
  audio: boolean
  worker: boolean
  webrtc: boolean
  titlePulse: boolean
  multiTab: boolean
  audioSource: KeepAliveAudioSource
  audioUrl: string
  audioVolume: number
  customCode: string
}

export interface KeepAliveLog {
  id: string
  time: number
  level: 'info' | 'success' | 'warning' | 'error'
  text: string
}

const CONFIG_KEY = 'nianrenji-keep-alive-config-v1'
const CHECKPOINT_KEY = 'nianrenji-keep-alive-checkpoint-v1'
const LOG_KEY = 'nianrenji-keep-alive-log-v1'
const UPLOAD_KEY = 'keep-alive-audio-file-v1'
const MAX_LOGS = 80

const defaultConfig = (): KeepAliveConfig => ({
  enabled: false,
  wakeLock: true,
  audio: true,
  worker: true,
  webrtc: false,
  titlePulse: false,
  multiTab: true,
  audioSource: 'silent',
  audioUrl: '',
  audioVolume: 0.02,
  customCode: `let count = 0\nsetInterval(() => {\n  count += 1\n  heartbeat({ count, time: Date.now() })\n}, 1000)`,
})

const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isKeepAliveLog = (value: unknown): value is KeepAliveLog =>
  isRecord(value)
  && typeof value.id === 'string'
  && typeof value.time === 'number'
  && ['info', 'success', 'warning', 'error'].includes(String(value.level))
  && typeof value.text === 'string'

const storedConfig = readJson(CONFIG_KEY)
const initialConfig = isRecord(storedConfig)
  ? { ...defaultConfig(), ...storedConfig } as KeepAliveConfig
  : defaultConfig()

const storedLogs = readJson(LOG_KEY)
const savedLogs = (Array.isArray(storedLogs) ? storedLogs : []).filter(isKeepAliveLog)

export const keepAliveConfig = reactive<KeepAliveConfig>(initialConfig)
export const keepAliveState = reactive({
  initialized: false,
  running: false,
  visibility: typeof document === 'undefined' ? 'visible' : document.visibilityState,
  lifecycle: 'active',
  wakeLock: 'idle' as 'idle' | 'active' | 'released' | 'unsupported' | 'error',
  audio: 'idle' as 'idle' | 'loading' | 'playing' | 'paused' | 'unsupported' | 'error',
  audioName: '内置无声音频',
  worker: 'idle' as 'idle' | 'active' | 'stalled' | 'unsupported' | 'error',
  workerTicks: 0,
  workerLagMs: 0,
  lastWorkerAt: 0,
  webrtc: 'idle' as 'idle' | 'connecting' | 'active' | 'error' | 'unsupported',
  pip: 'idle' as 'idle' | 'active' | 'unsupported' | 'error',
  mediaSession: 'mediaSession' in navigator ? 'ready' : 'unsupported',
  serviceWorker: 'serviceWorker' in navigator ? 'checking' : 'unsupported',
  backgroundSync: 'checking' as 'checking' | 'supported' | 'unsupported' | 'registered' | 'error',
  standalone: false,
  pageWasDiscarded: Boolean((document as Document & { wasDiscarded?: boolean }).wasDiscarded),
  hiddenAt: 0,
  lastHiddenDurationMs: 0,
  longestGapMs: 0,
  lastHeartbeatAt: 0,
  peers: 0,
  isLeader: true,
  networkProbe: 'idle' as 'idle' | 'running' | 'success' | 'error',
  networkProbeMs: 0,
  testStartedAt: 0,
  testDurationSeconds: 60,
  testStatus: 'idle' as 'idle' | 'running' | 'complete',
  testHiddenAt: 0,
  testHiddenDurationMs: 0,
  testWorkerTicksAtStart: 0,
  testWorkerTicks: 0,
  customWorker: 'idle' as 'idle' | 'active' | 'error',
  customWorkerMessages: 0,
  customWorkerLastMessage: '',
  uploadReady: false,
  uploadName: '',
  logs: savedLogs.slice(0, MAX_LOGS),
})

let wakeLockSentinel: WakeLockSentinel | null = null
let audioElement: HTMLAudioElement | null = null
let audioObjectUrl = ''
let generatedAudioUrl = ''
let worker: Worker | null = null
let workerMonitor = 0
let titleTimer = 0
let originalTitle = ''
let rtcTimer = 0
let rtcLocal: RTCPeerConnection | null = null
let rtcRemote: RTCPeerConnection | null = null
let rtcChannel: RTCDataChannel | null = null
let pipCanvas: HTMLCanvasElement | null = null
let pipVideo: HTMLVideoElement | null = null
let pipStream: MediaStream | null = null
let pipDrawTimer = 0
let channel: BroadcastChannel | null = null
let channelTimer = 0
let peerCleanupTimer = 0
const peerId = `keep_alive_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const peerSeen = new Map<string, number>()
let customWorker: Worker | null = null
let initialized = false

const persistConfig = () => localStorage.setItem(CONFIG_KEY, JSON.stringify(keepAliveConfig))
const persistLogs = () => localStorage.setItem(LOG_KEY, JSON.stringify(keepAliveState.logs.slice(0, MAX_LOGS)))

const addLog = (text: string, level: KeepAliveLog['level'] = 'info') => {
  const previous = keepAliveState.logs[0]
  if (previous?.text === text && Date.now() - previous.time < 1500) return
  keepAliveState.logs.unshift({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, time: Date.now(), level, text })
  if (keepAliveState.logs.length > MAX_LOGS) keepAliveState.logs.splice(MAX_LOGS)
  persistLogs()
}

const saveCheckpoint = (reason: string) => {
  localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({
    savedAt: Date.now(),
    reason,
    running: keepAliveState.running,
    visibility: document.visibilityState,
    workerTicks: keepAliveState.workerTicks,
    audio: keepAliveState.audio,
    lifecycle: keepAliveState.lifecycle,
    testStartedAt: keepAliveState.testStartedAt,
  }))
}

const createWaveBlob = (soft: boolean) => {
  const sampleRate = 8000
  const seconds = 2
  const samples = sampleRate * seconds
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  const write = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))
  write(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); write(8, 'WAVE')
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  write(36, 'data'); view.setUint32(40, samples * 2, true)
  for (let index = 0; index < samples; index++) {
    const value = soft ? Math.round(Math.sin(index / sampleRate * Math.PI * 2 * 174) * 10) : 0
    view.setInt16(44 + index * 2, value, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

const clearAudioUrl = () => {
  if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl)
  if (generatedAudioUrl) URL.revokeObjectURL(generatedAudioUrl)
  audioObjectUrl = ''
  generatedAudioUrl = ''
}

const resolveAudioSource = async () => {
  clearAudioUrl()
  if (keepAliveConfig.audioSource === 'url') {
    const value = keepAliveConfig.audioUrl.trim()
    if (!/^https:\/\//i.test(value)) throw new Error('音频 URL 必须使用 HTTPS')
    keepAliveState.audioName = 'URL 音频'
    return value
  }
  if (keepAliveConfig.audioSource === 'upload') {
    const stored = await localforage.getItem<Blob>(UPLOAD_KEY)
    if (!stored) throw new Error('尚未选择本地音频')
    audioObjectUrl = URL.createObjectURL(stored)
    keepAliveState.audioName = keepAliveState.uploadName || '本地音频'
    return audioObjectUrl
  }
  generatedAudioUrl = URL.createObjectURL(createWaveBlob(keepAliveConfig.audioSource === 'soft'))
  keepAliveState.audioName = keepAliveConfig.audioSource === 'soft' ? '内置极低音量' : '内置无声音频'
  return generatedAudioUrl
}

const setupMediaSession = () => {
  if (!('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: '应用保活中',
      artist: 'Clingy OS',
      album: keepAliveState.audioName,
      artwork: [{ src: '/pwa-icon.jpg', sizes: '512x512', type: 'image/jpeg' }],
    })
    navigator.mediaSession.playbackState = keepAliveState.audio === 'playing' ? 'playing' : 'paused'
    navigator.mediaSession.setActionHandler('play', () => { void audioElement?.play() })
    navigator.mediaSession.setActionHandler('pause', () => audioElement?.pause())
    navigator.mediaSession.setActionHandler('stop', () => { void stopAudio() })
    keepAliveState.mediaSession = 'active'
  } catch {
    keepAliveState.mediaSession = 'ready'
  }
}

const clearMediaSession = () => {
  if (!('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.playbackState = 'none'
    navigator.mediaSession.metadata = null
    for (const action of ['play', 'pause', 'stop'] as MediaSessionAction[]) navigator.mediaSession.setActionHandler(action, null)
    keepAliveState.mediaSession = 'ready'
  } catch { /* 部分浏览器不允许清除未支持的动作。 */ }
}

export const startAudio = async () => {
  keepAliveState.audio = 'loading'
  try {
    if (!audioElement) {
      audioElement = document.createElement('audio')
      audioElement.loop = true
      audioElement.preload = 'auto'
      audioElement.setAttribute('playsinline', '')
      audioElement.style.display = 'none'
      audioElement.addEventListener('playing', () => { keepAliveState.audio = 'playing'; setupMediaSession() })
      audioElement.addEventListener('pause', () => { if (keepAliveState.audio !== 'idle') keepAliveState.audio = 'paused'; setupMediaSession() })
      audioElement.addEventListener('error', () => { keepAliveState.audio = 'error'; addLog('保活音频播放失败，请检查格式或 URL', 'error') })
      document.body.appendChild(audioElement)
    }
    audioElement.src = await resolveAudioSource()
    audioElement.volume = Math.max(0, Math.min(1, keepAliveConfig.audioVolume))
    await audioElement.play()
    keepAliveState.audio = 'playing'
    setupMediaSession()
    addLog(`${keepAliveState.audioName}已开始循环`, 'success')
  } catch (error) {
    keepAliveState.audio = 'error'
    addLog(error instanceof Error ? error.message : '保活音频无法播放', 'error')
    throw error
  }
}

export const stopAudio = async () => {
  if (audioElement) {
    audioElement.pause()
    audioElement.removeAttribute('src')
    audioElement.load()
  }
  clearAudioUrl()
  clearMediaSession()
  keepAliveState.audio = 'idle'
}

export const updateAudioVolume = (value: number) => {
  keepAliveConfig.audioVolume = Math.max(0, Math.min(1, value))
  if (audioElement) audioElement.volume = keepAliveConfig.audioVolume
  persistConfig()
}

export const saveUploadedAudio = async (file: File) => {
  if (!file.type.startsWith('audio/')) throw new Error('请选择音频文件')
  if (file.size > 80 * 1024 * 1024) throw new Error('音频文件不能超过 80 MB')
  await localforage.setItem(UPLOAD_KEY, file)
  keepAliveState.uploadReady = true
  keepAliveState.uploadName = file.name
  keepAliveConfig.audioSource = 'upload'
  persistConfig()
  addLog(`已保存本地音频：${file.name}`, 'success')
  if (keepAliveState.audio === 'playing') await startAudio()
}

export const removeUploadedAudio = async () => {
  await localforage.removeItem(UPLOAD_KEY)
  keepAliveState.uploadReady = false
  keepAliveState.uploadName = ''
  if (keepAliveConfig.audioSource === 'upload') keepAliveConfig.audioSource = 'silent'
  persistConfig()
  if (keepAliveState.audio === 'playing') await startAudio()
}

export const requestWakeLock = async () => {
  if (!('wakeLock' in navigator)) {
    keepAliveState.wakeLock = 'unsupported'
    return
  }
  if (document.visibilityState !== 'visible') {
    keepAliveState.wakeLock = 'released'
    return
  }
  try {
    await wakeLockSentinel?.release().catch(() => undefined)
    wakeLockSentinel = await navigator.wakeLock.request('screen')
    keepAliveState.wakeLock = 'active'
    wakeLockSentinel.addEventListener('release', () => { keepAliveState.wakeLock = 'released' })
    addLog('屏幕常亮已启用', 'success')
  } catch {
    keepAliveState.wakeLock = 'error'
    addLog('系统拒绝了屏幕常亮请求', 'warning')
  }
}

export const releaseWakeLock = async () => {
  await wakeLockSentinel?.release().catch(() => undefined)
  wakeLockSentinel = null
  keepAliveState.wakeLock = 'idle'
}

const startWorker = () => {
  if (worker) return
  if (!('Worker' in window)) { keepAliveState.worker = 'unsupported'; return }
  const source = `let count=0;setInterval(()=>postMessage({time:Date.now(),count:++count}),1000)`
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  worker = new Worker(url)
  URL.revokeObjectURL(url)
  keepAliveState.worker = 'active'
  worker.onmessage = event => {
    const now = Date.now()
    const previous = keepAliveState.lastWorkerAt
    keepAliveState.workerTicks = Number(event.data?.count || keepAliveState.workerTicks + 1)
    keepAliveState.workerLagMs = previous ? Math.max(0, now - previous - 1000) : 0
    keepAliveState.longestGapMs = Math.max(keepAliveState.longestGapMs, previous ? now - previous : 0)
    keepAliveState.lastWorkerAt = now
    keepAliveState.lastHeartbeatAt = now
    keepAliveState.worker = 'active'
  }
  worker.onerror = () => { keepAliveState.worker = 'error'; addLog('Worker 心跳发生错误', 'error') }
  window.clearInterval(workerMonitor)
  workerMonitor = window.setInterval(() => {
    if (keepAliveState.lastWorkerAt && Date.now() - keepAliveState.lastWorkerAt > 5000) keepAliveState.worker = 'stalled'
  }, 2000)
  addLog('Worker 心跳已启动', 'success')
}

const stopWorker = () => {
  worker?.terminate(); worker = null
  window.clearInterval(workerMonitor); workerMonitor = 0
  keepAliveState.worker = 'idle'
}

const startTitlePulse = () => {
  if (titleTimer) return
  originalTitle = document.title
  let lit = false
  titleTimer = window.setInterval(() => {
    lit = !lit
    document.title = `${lit ? '●' : '○'} 保活中 · ${originalTitle}`
  }, 2000)
  addLog('标题活动提示已启动')
}

const stopTitlePulse = () => {
  window.clearInterval(titleTimer); titleTimer = 0
  if (originalTitle) document.title = originalTitle
  originalTitle = ''
}

const startWebRtc = async () => {
  if (!('RTCPeerConnection' in window)) { keepAliveState.webrtc = 'unsupported'; return }
  if (rtcLocal || rtcRemote) return
  keepAliveState.webrtc = 'connecting'
  try {
    rtcLocal = new RTCPeerConnection({ iceServers: [] })
    rtcRemote = new RTCPeerConnection({ iceServers: [] })
    rtcLocal.onicecandidate = event => { if (event.candidate) void rtcRemote?.addIceCandidate(event.candidate) }
    rtcRemote.onicecandidate = event => { if (event.candidate) void rtcLocal?.addIceCandidate(event.candidate) }
    rtcRemote.ondatachannel = event => { event.channel.onmessage = () => undefined }
    rtcChannel = rtcLocal.createDataChannel('keep-alive')
    rtcChannel.onopen = () => {
      keepAliveState.webrtc = 'active'
      window.clearInterval(rtcTimer)
      rtcTimer = window.setInterval(() => {
        if (rtcChannel?.readyState === 'open') rtcChannel.send(String(Date.now()))
      }, 4000)
      addLog('WebRTC 本机回环已连接', 'success')
    }
    rtcChannel.onerror = () => { keepAliveState.webrtc = 'error' }
    const offer = await rtcLocal.createOffer()
    await rtcLocal.setLocalDescription(offer)
    await rtcRemote.setRemoteDescription(offer)
    const answer = await rtcRemote.createAnswer()
    await rtcRemote.setLocalDescription(answer)
    await rtcLocal.setRemoteDescription(answer)
  } catch {
    stopWebRtc()
    keepAliveState.webrtc = 'error'
    addLog('WebRTC 回环无法建立', 'error')
  }
}

const stopWebRtc = () => {
  window.clearInterval(rtcTimer); rtcTimer = 0
  rtcChannel?.close(); rtcChannel = null
  rtcLocal?.close(); rtcRemote?.close(); rtcLocal = null; rtcRemote = null
  keepAliveState.webrtc = 'idle'
}

const drawPip = () => {
  if (!pipCanvas) return
  const context = pipCanvas.getContext('2d')
  if (!context) return
  const dark = document.documentElement.classList.contains('is-dark')
  context.fillStyle = dark ? '#171b19' : '#f3f7f4'
  context.fillRect(0, 0, pipCanvas.width, pipCanvas.height)
  context.fillStyle = '#5f7f70'
  context.beginPath(); context.arc(34, 34, 8, 0, Math.PI * 2); context.fill()
  context.fillStyle = dark ? '#f4f5f4' : '#243029'
  context.font = '600 24px sans-serif'
  context.fillText('应用保活中', 54, 42)
  context.fillStyle = dark ? '#aab4ae' : '#718078'
  context.font = '14px sans-serif'
  context.fillText(new Date().toLocaleTimeString('zh-CN', { hour12: false }), 24, 92)
  context.fillText(`Worker ${keepAliveState.workerTicks} · ${keepAliveState.visibility}`, 24, 121)
  context.fillText('返回应用可查看完整状态', 24, 151)
}

export const enterPictureInPicture = async () => {
  try {
    if (!pipCanvas) {
      pipCanvas = document.createElement('canvas')
      pipCanvas.width = 320; pipCanvas.height = 180
      pipCanvas.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:320px;height:180px;pointer-events:none'
      document.body.appendChild(pipCanvas)
    }
    if (!pipVideo) {
      pipVideo = document.createElement('video')
      pipVideo.muted = true; pipVideo.loop = true; pipVideo.playsInline = true
      pipVideo.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:320px;height:180px;pointer-events:none'
      pipVideo.addEventListener('leavepictureinpicture', () => {
        window.clearInterval(pipDrawTimer); pipDrawTimer = 0
        pipStream?.getTracks().forEach(track => track.stop()); pipStream = null
        if (pipVideo) { pipVideo.pause(); pipVideo.srcObject = null }
        keepAliveState.pip = 'idle'
        addLog('画中画已退出')
      })
      document.body.appendChild(pipVideo)
    }
    const capture = (pipCanvas as HTMLCanvasElement & { captureStream?: (rate?: number) => MediaStream }).captureStream
    if (!capture) throw new Error('当前浏览器不支持动态画中画')
    drawPip()
    window.clearInterval(pipDrawTimer)
    pipDrawTimer = window.setInterval(drawPip, 1000)
    pipStream?.getTracks().forEach(track => track.stop())
    pipStream = capture.call(pipCanvas, 1)
    pipVideo.srcObject = pipStream
    await pipVideo.play()
    if ('requestPictureInPicture' in pipVideo) {
      await pipVideo.requestPictureInPicture()
    } else if ('webkitSetPresentationMode' in pipVideo) {
      ;(pipVideo as HTMLVideoElement & { webkitSetPresentationMode: (mode: string) => void }).webkitSetPresentationMode('picture-in-picture')
    } else throw new Error('当前浏览器不支持画中画')
    keepAliveState.pip = 'active'
    addLog('动态状态画中画已开启', 'success')
  } catch (error) {
    keepAliveState.pip = 'error'
    addLog(error instanceof Error ? error.message : '画中画开启失败', 'error')
  }
}

export const exitPictureInPicture = async () => {
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture()
    if (pipVideo && 'webkitSetPresentationMode' in pipVideo) {
      ;(pipVideo as HTMLVideoElement & { webkitSetPresentationMode: (mode: string) => void }).webkitSetPresentationMode('inline')
    }
  } catch { /* 浏览器可能已经主动退出。 */ }
  window.clearInterval(pipDrawTimer); pipDrawTimer = 0
  pipStream?.getTracks().forEach(track => track.stop()); pipStream = null
  if (pipVideo) { pipVideo.pause(); pipVideo.srcObject = null }
  keepAliveState.pip = 'idle'
}

const startMultiTab = () => {
  if (!('BroadcastChannel' in window)) return
  if (channel) return
  channel = new BroadcastChannel('nianrenji-keep-alive')
  channel.onmessage = event => {
    if (!event.data?.id || event.data.id === peerId) return
    peerSeen.set(String(event.data.id), Date.now())
  }
  const announce = () => channel?.postMessage({ id: peerId, time: Date.now(), running: keepAliveState.running })
  announce()
  channelTimer = window.setInterval(announce, 3000)
  peerCleanupTimer = window.setInterval(() => {
    const now = Date.now()
    for (const [id, seenAt] of peerSeen) if (now - seenAt > 9000) peerSeen.delete(id)
    const ids = [peerId, ...peerSeen.keys()].sort()
    keepAliveState.peers = peerSeen.size
    keepAliveState.isLeader = ids[0] === peerId
  }, 3000)
}

const stopMultiTab = () => {
  window.clearInterval(channelTimer); window.clearInterval(peerCleanupTimer); channelTimer = 0; peerCleanupTimer = 0
  channel?.close(); channel = null; peerSeen.clear()
  keepAliveState.peers = 0; keepAliveState.isLeader = true
}

export const setStrategy = async (strategy: KeepAliveStrategy, enabled: boolean) => {
  keepAliveConfig[strategy] = enabled
  persistConfig()
  if (!keepAliveState.running) return
  if (strategy === 'wakeLock') enabled ? await requestWakeLock() : await releaseWakeLock()
  if (strategy === 'audio') enabled ? await startAudio() : await stopAudio()
  if (strategy === 'worker') enabled ? startWorker() : stopWorker()
  if (strategy === 'webrtc') enabled ? await startWebRtc() : stopWebRtc()
  if (strategy === 'titlePulse') enabled ? startTitlePulse() : stopTitlePulse()
  if (strategy === 'multiTab') enabled ? startMultiTab() : stopMultiTab()
}

export const startKeepAlive = async () => {
  keepAliveConfig.enabled = true
  keepAliveState.running = true
  persistConfig()
  saveCheckpoint('start')
  const failures: string[] = []
  if (keepAliveConfig.wakeLock) await requestWakeLock()
  if (keepAliveConfig.worker) startWorker()
  if (keepAliveConfig.multiTab) startMultiTab()
  if (keepAliveConfig.titlePulse) startTitlePulse()
  if (keepAliveConfig.webrtc) await startWebRtc()
  if (keepAliveConfig.audio) {
    try { await startAudio() } catch { failures.push('音频') }
  }
  addLog(failures.length ? `保活已启动，但${failures.join('、')}未能启用` : '保活工具箱已启动', failures.length ? 'warning' : 'success')
}

export const stopKeepAlive = async () => {
  keepAliveConfig.enabled = false
  keepAliveState.running = false
  persistConfig()
  await releaseWakeLock()
  await stopAudio()
  stopWorker(); stopWebRtc(); stopTitlePulse(); stopMultiTab()
  await exitPictureInPicture()
  stopCustomWorker()
  saveCheckpoint('stop')
  addLog('全部保活能力已停止')
}

export const runNetworkProbe = async () => {
  keepAliveState.networkProbe = 'running'
  const startedAt = performance.now()
  try {
    const response = await fetch(`/pwa-icon.jpg?keep_alive_probe=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await response.blob()
    keepAliveState.networkProbeMs = Math.round(performance.now() - startedAt)
    keepAliveState.networkProbe = 'success'
    addLog(`网络探针完成：${keepAliveState.networkProbeMs}ms`, 'success')
  } catch {
    keepAliveState.networkProbe = 'error'
    addLog('网络探针失败', 'error')
  }
}

export const registerBackgroundSyncProbe = async () => {
  try {
    const registration = await navigator.serviceWorker?.ready
    const sync = registration && (registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync
    if (!sync) { keepAliveState.backgroundSync = 'unsupported'; return }
    await sync.register('nianrenji-keep-alive-probe')
    keepAliveState.backgroundSync = 'registered'
    addLog('后台同步探针已登记；执行时间由浏览器决定', 'success')
  } catch {
    keepAliveState.backgroundSync = 'error'
    addLog('后台同步探针登记失败', 'error')
  }
}

export const startBackgroundTest = (seconds: number) => {
  keepAliveState.testDurationSeconds = seconds
  keepAliveState.testStartedAt = Date.now()
  keepAliveState.testHiddenAt = 0
  keepAliveState.testHiddenDurationMs = 0
  keepAliveState.testWorkerTicksAtStart = keepAliveState.workerTicks
  keepAliveState.testWorkerTicks = 0
  keepAliveState.testStatus = 'running'
  saveCheckpoint('test-start')
  addLog(`已开始 ${seconds} 秒后台体检，请正常离开应用后再返回`)
}

export const stopBackgroundTest = () => {
  if (keepAliveState.testStatus !== 'running') return
  keepAliveState.testWorkerTicks = keepAliveState.workerTicks - keepAliveState.testWorkerTicksAtStart
  keepAliveState.testStatus = 'complete'
  addLog('后台体检已结束', 'success')
  saveCheckpoint('test-complete')
}

export const runCustomWorker = (code: string) => {
  stopCustomWorker()
  keepAliveConfig.customCode = code
  persistConfig()
  const wrapper = `
    self.fetch=undefined;self.XMLHttpRequest=undefined;self.WebSocket=undefined;self.EventSource=undefined;self.importScripts=undefined;self.indexedDB=undefined;self.caches=undefined;
    const heartbeat=(value={})=>postMessage({type:'heartbeat',value,time:Date.now()});
    try { ${code}\n } catch(error) { postMessage({type:'error',message:error&&error.message?error.message:String(error)}) }
  `
  try {
    const url = URL.createObjectURL(new Blob([wrapper], { type: 'text/javascript' }))
    customWorker = new Worker(url)
    URL.revokeObjectURL(url)
    keepAliveState.customWorker = 'active'
    keepAliveState.customWorkerMessages = 0
    customWorker.onmessage = event => {
      if (event.data?.type === 'error') {
        keepAliveState.customWorker = 'error'
        keepAliveState.customWorkerLastMessage = String(event.data.message || '代码执行错误')
      } else {
        keepAliveState.customWorkerMessages += 1
        keepAliveState.customWorkerLastMessage = JSON.stringify(event.data?.value ?? {}).slice(0, 160)
      }
    }
    customWorker.onerror = event => {
      keepAliveState.customWorker = 'error'
      keepAliveState.customWorkerLastMessage = event.message || '代码执行错误'
    }
    addLog('隔离代码 Worker 已启动', 'success')
  } catch (error) {
    keepAliveState.customWorker = 'error'
    keepAliveState.customWorkerLastMessage = error instanceof Error ? error.message : '代码无法启动'
  }
}

export function stopCustomWorker() {
  customWorker?.terminate(); customWorker = null
  keepAliveState.customWorker = 'idle'
}

export const clearKeepAliveLogs = () => {
  keepAliveState.logs.splice(0)
  localStorage.removeItem(LOG_KEY)
}

export const resetKeepAlive = async () => {
  await stopKeepAlive()
  await localforage.removeItem(UPLOAD_KEY)
  Object.assign(keepAliveConfig, defaultConfig())
  keepAliveState.uploadReady = false
  keepAliveState.uploadName = ''
  keepAliveState.workerTicks = 0
  keepAliveState.workerLagMs = 0
  keepAliveState.longestGapMs = 0
  keepAliveState.testStatus = 'idle'
  keepAliveState.testStartedAt = 0
  keepAliveState.customWorkerMessages = 0
  keepAliveState.customWorkerLastMessage = ''
  localStorage.removeItem(CONFIG_KEY)
  localStorage.removeItem(CHECKPOINT_KEY)
  clearKeepAliveLogs()
  addLog('保活设置已恢复默认值', 'success')
}

const handleVisibility = () => {
  keepAliveState.visibility = document.visibilityState
  if (document.visibilityState === 'hidden') {
    keepAliveState.hiddenAt = Date.now()
    keepAliveState.lifecycle = 'hidden'
    if (keepAliveState.testStatus === 'running' && !keepAliveState.testHiddenAt) keepAliveState.testHiddenAt = Date.now()
    saveCheckpoint('hidden')
  } else {
    if (keepAliveState.hiddenAt) keepAliveState.lastHiddenDurationMs = Date.now() - keepAliveState.hiddenAt
    keepAliveState.hiddenAt = 0
    keepAliveState.lifecycle = 'active'
    if (keepAliveState.testStatus === 'running' && keepAliveState.testHiddenAt) {
      keepAliveState.testHiddenDurationMs += Date.now() - keepAliveState.testHiddenAt
      keepAliveState.testHiddenAt = 0
      if (Date.now() - keepAliveState.testStartedAt >= keepAliveState.testDurationSeconds * 1000) stopBackgroundTest()
    }
    if (keepAliveState.running && keepAliveConfig.wakeLock) void requestWakeLock()
    if (keepAliveState.running && keepAliveConfig.audio && audioElement?.paused) {
      keepAliveState.audio = 'paused'
      addLog('返回前台后发现音频已暂停，可点击重新启动', 'warning')
    }
    saveCheckpoint('visible')
  }
}

const handleFreeze = () => { keepAliveState.lifecycle = 'frozen'; saveCheckpoint('freeze') }
const handleResume = () => { keepAliveState.lifecycle = document.hidden ? 'hidden' : 'active'; saveCheckpoint('resume') }
const handlePageHide = () => { saveCheckpoint('pagehide') }
const handlePageShow = (event: PageTransitionEvent) => {
  keepAliveState.lifecycle = document.hidden ? 'hidden' : 'active'
  if (event.persisted) addLog('页面已从浏览器往返缓存恢复', 'success')
}

export const initializeKeepAliveRuntime = async () => {
  if (initialized) return
  initialized = true
  keepAliveState.initialized = true
  keepAliveState.standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  const upload = await localforage.getItem<Blob>(UPLOAD_KEY).catch(() => null)
  keepAliveState.uploadReady = Boolean(upload)
  if (upload && !keepAliveState.uploadName) keepAliveState.uploadName = (upload as File).name || '已保存的本地音频'
  document.addEventListener('visibilitychange', handleVisibility)
  document.addEventListener('freeze', handleFreeze)
  document.addEventListener('resume', handleResume)
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('pageshow', handlePageShow)
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined)
    keepAliveState.serviceWorker = registration ? 'active' : 'inactive'
    keepAliveState.backgroundSync = registration && 'sync' in registration ? 'supported' : 'unsupported'
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'keep-alive-sync') addLog('浏览器执行了后台同步探针', 'success')
    })
  }
  if (keepAliveState.pageWasDiscarded) addLog('检测到上次页面曾被浏览器回收，已恢复本地设置', 'warning')
  if (keepAliveConfig.enabled) {
    keepAliveConfig.enabled = false
    persistConfig()
    addLog('上次保活在页面关闭前仍处于开启状态，请点击重新启动', 'warning')
  }
  if (keepAliveState.running && keepAliveConfig.multiTab) startMultiTab()
}
