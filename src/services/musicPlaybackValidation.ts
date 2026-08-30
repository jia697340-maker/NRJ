/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { MusicTrack } from '../types/music'

export interface MusicPlaybackProbe {
  valid: boolean
  duration: number
  trial: boolean
  reason: string
}

export const isTrialMusicDuration = (duration: number) => Number.isFinite(duration) && duration >= 28 && duration <= 32.5

const readUint32 = (bytes: Uint8Array, offset: number) => {
  if (offset < 0 || offset + 4 > bytes.length) return 0
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]
}

export const parseMp3Duration = (bytes: Uint8Array) => {
  for (let offset = 0; offset + 4 < bytes.length; offset += 1) {
    if (bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) continue
    const versionBits = (bytes[offset + 1] >> 3) & 0x03
    const layerBits = (bytes[offset + 1] >> 1) & 0x03
    if (versionBits === 1 || layerBits !== 1) continue
    const sampleRates = versionBits === 3 ? [44100, 48000, 32000] : versionBits === 2 ? [22050, 24000, 16000] : [11025, 12000, 8000]
    const sampleRate = sampleRates[(bytes[offset + 2] >> 2) & 0x03]
    if (!sampleRate) continue
    const channelMode = (bytes[offset + 3] >> 6) & 0x03
    const sideInfo = versionBits === 3 ? (channelMode === 3 ? 17 : 32) : (channelMode === 3 ? 9 : 17)
    const markerOffset = offset + 4 + sideInfo
    const marker = String.fromCharCode(...bytes.slice(markerOffset, markerOffset + 4))
    if (marker !== 'Xing' && marker !== 'Info') continue
    const flags = readUint32(bytes, markerOffset + 4)
    if ((flags & 1) === 0) continue
    const frames = readUint32(bytes, markerOffset + 8)
    const samplesPerFrame = versionBits === 3 ? 1152 : 576
    return frames > 0 ? frames * samplesPerFrame / sampleRate : 0
  }
  return 0
}

const probeWithAudioElement = (url: string, timeout: number) => new Promise<number>((resolve, reject) => {
  const element = document.createElement('audio')
  const timer = window.setTimeout(() => finish(new Error('音频验证超时')), timeout)
  const finish = (error?: Error) => {
    window.clearTimeout(timer)
    element.removeAttribute('src')
    element.load()
    if (error) reject(error)
    else resolve(Number.isFinite(element.duration) ? element.duration : 0)
  }
  element.preload = 'metadata'
  element.onloadedmetadata = () => finish()
  element.onerror = () => finish(new Error('音频地址无法加载'))
  element.src = url
  element.load()
})

const probeCache = new Map<string, { expiresAt: number; value: Promise<MusicPlaybackProbe> }>()

const probeMusicUrlUncached = async (url: string, timeout = 12000, credentials: RequestCredentials = 'omit'): Promise<MusicPlaybackProbe> => {
  if (!url || /(?:preview|trial|试听)/i.test(url)) return { valid: false, duration: 0, trial: true, reason: '30 秒试听地址' }
  let rangeDuration = 0
  try {
    const response = await fetch(url, { headers: { Range: 'bytes=0-4095' }, credentials, cache: 'no-store' })
    if (!response.ok && response.status !== 206) return { valid: false, duration: 0, trial: false, reason: `音频请求失败 (${response.status})` }
    const contentType = response.headers.get('content-type') || ''
    if (contentType && !/(?:audio|mpeg|mp3|octet-stream)/i.test(contentType)) return { valid: false, duration: 0, trial: false, reason: '返回内容不是音频' }
    rangeDuration = parseMp3Duration(new Uint8Array(await response.arrayBuffer()))
  } catch { rangeDuration = 0 }
  const duration = rangeDuration || await probeWithAudioElement(url, timeout).catch(() => 0)
  if (!duration) return { valid: false, duration: 0, trial: false, reason: '无法确认完整播放能力' }
  if (isTrialMusicDuration(duration)) return { valid: false, duration, trial: true, reason: '已识别为 30 秒试听' }
  return { valid: true, duration, trial: false, reason: '已验证完整播放' }
}

export const probeMusicUrl = (url: string, timeout = 12000, credentials: RequestCredentials = 'omit'): Promise<MusicPlaybackProbe> => {
  const cacheKey = `${credentials}:${url}`
  const cached = probeCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  const value = probeMusicUrlUncached(url, timeout, credentials)
  probeCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, value })
  void value.then(result => {
    if (!result.valid) probeCache.set(cacheKey, { expiresAt: Date.now() + 60_000, value: Promise.resolve(result) })
  }).catch(() => { probeCache.delete(cacheKey) })
  return value
}

export const verifiedEmbedTrack = (track: MusicTrack) => track.playbackType === 'embed' && Boolean(track.embedProvider && track.embedId)
