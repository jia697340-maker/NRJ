/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'

let globalAudioInstance: HTMLAudioElement | null = null
const isPlaying = ref(false)
const isSynthesizing = ref(false)
const currentPlayingId = ref<number | null>(null)

interface VoiceTask { msgId: number; text: string; chatSettings: any; resolve: () => void; reject: (err: any) => void }
interface VoiceProfile {
  model: string; voiceId: string; speed: number; pitch: number; volume: number
  language: string; emotion: string; format: 'mp3'; sampleRate: number; bitrate: number; channel: number
}

const voiceQueue: VoiceTask[] = []
const inFlightSynthesis = new Map<string, Promise<string>>()
const voiceStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatVoices' })
const voiceMetaStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatVoiceMeta' })
const MAX_CACHE_BYTES = 300 * 1024 * 1024
const MAX_CACHE_ITEMS = 500
let isQueueProcessing = false

const languageMap: Record<string, string> = {
  zh: 'Chinese', en: 'English', ja: 'Japanese', ko: 'Korean', fr: 'French', de: 'German', es: 'Spanish',
  it: 'Italian', ru: 'Russian', pt: 'Portuguese', ar: 'Arabic', hi: 'Hindi', id: 'Indonesian', vi: 'Vietnamese',
  th: 'Thai', tr: 'Turkish', fa: 'Persian', pl: 'Polish', uk: 'Ukrainian', nl: 'Dutch', ro: 'Romanian',
  el: 'Greek', sv: 'Swedish', fi: 'Finnish', da: 'Danish', no: 'Norwegian', he: 'Hebrew', ms: 'Malay', ta: 'Tamil'
}
const emotionModels = new Set(['speech-02-hd', 'speech-02-turbo', 'speech-01-hd', 'speech-01-turbo', 'speech-2.6-hd', 'speech-2.6-turbo'])

const cleanVoiceText = (text: string) => text.replace(/\*.*?\*/g, '').replace(/[\(（].*?[\)）]/g, '').replace(/<[^>]*>/g, '').trim()
const hexToBlob = (hex: string) => {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2))
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  return new Blob([bytes], { type: 'audio/mp3' })
}
const hash = (value: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(36)
}
const profileFor = (settings: any): VoiceProfile => ({
  model: settings?.voiceModel || 'speech-2.6-turbo', voiceId: settings?.voiceId || 'female-yujie',
  speed: settings?.voiceSpeed ?? 1, pitch: settings?.voicePitch ?? 1, volume: settings?.voiceVolume ?? 1,
  language: languageMap[settings?.voiceLanguage || ''] || 'auto', emotion: settings?.voiceEmotion || '',
  format: 'mp3', sampleRate: 32000, bitrate: 128000, channel: 1
})
const cacheKeyFor = (msgId: number, text: string, profile: VoiceProfile) => `voice_v2_${msgId}_${hash(JSON.stringify({ text, profile }))}`

async function trimVoiceCache() {
  const entries: Array<{ key: string; size: number; updatedAt: number }> = []
  await voiceStore.iterate((value: unknown, key: string) => {
    if (typeof value === 'string' && key.startsWith('voice_')) entries.push({ key, size: value.length / 2, updatedAt: 0 })
  })
  await Promise.all(entries.map(async entry => { entry.updatedAt = (await voiceMetaStore.getItem<number>(entry.key)) || 0 }))
  let total = entries.reduce((sum, entry) => sum + entry.size, 0)
  entries.sort((a, b) => a.updatedAt - b.updatedAt)
  while (entries.length > MAX_CACHE_ITEMS || total > MAX_CACHE_BYTES) {
    const oldest = entries.shift()
    if (!oldest) break
    await Promise.all([voiceStore.removeItem(oldest.key), voiceMetaStore.removeItem(oldest.key)])
    total -= oldest.size
  }
}

function playAudioHex(hex: string, msgId: number) {
  return new Promise<void>((resolve) => {
    const blobUrl = URL.createObjectURL(hexToBlob(hex))
    globalAudioInstance = new Audio(blobUrl)
    const finish = () => {
      URL.revokeObjectURL(blobUrl)
      if (currentPlayingId.value === msgId) { isPlaying.value = false; currentPlayingId.value = null }
      resolve()
    }
    globalAudioInstance.onended = finish
    globalAudioInstance.onpause = finish
    globalAudioInstance.onerror = finish
    globalAudioInstance.play().then(() => { isPlaying.value = true }).catch(finish)
  })
}

async function synthesize(text: string, profile: VoiceProfile, apiKey: string, region: string, stream: boolean) {
  const baseUrl = region === 'china' ? 'https://api.minimaxi.com' : 'https://api.minimax.io'
  const voiceSetting: Record<string, unknown> = { voice_id: profile.voiceId, speed: profile.speed, pitch: profile.pitch, vol: profile.volume }
  // MiniMax only documents explicit emotion for the 01/02 and 2.6 model families.
  if (profile.emotion && emotionModels.has(profile.model)) voiceSetting.emotion = profile.emotion
  const response = await fetch(`${baseUrl}/v1/t2a_v2`, {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: profile.model, text, stream, language_boost: profile.language, output_format: 'hex', voice_setting: voiceSetting, audio_setting: { format: profile.format, sample_rate: profile.sampleRate, bitrate: profile.bitrate, channel: profile.channel } })
  })
  if (!response.ok) throw new Error(`语音合成请求失败 (状态码: ${response.status})`)
  const data = await response.json()
  if (data.base_resp?.status_code !== 0) throw new Error(data.base_resp?.status_msg || '语音合成失败')
  if (!data.data?.audio) throw new Error('未接收到有效音频流')
  return data.data.audio as string
}

async function getAudioHex(cacheKey: string, text: string, profile: VoiceProfile, settings: any) {
  const cached = await voiceStore.getItem<string>(cacheKey)
  if (cached) { await voiceMetaStore.setItem(cacheKey, Date.now()); return cached }
  const pending = inFlightSynthesis.get(cacheKey)
  if (pending) return pending
  const configString = localStorage.getItem('minimax_voice_config_v4')
  if (!configString) throw new Error('MISSING_API_KEY')
  let config: any
  try { config = JSON.parse(configString) } catch { throw new Error('MISSING_API_KEY') }
  if (!config.apiKey) throw new Error('MISSING_API_KEY')
  const request = synthesize(text, profile, config.apiKey, config.region || 'global', Boolean(settings?.voiceStream))
    .then(async audio => {
      await Promise.all([voiceStore.setItem(cacheKey, audio), voiceMetaStore.setItem(cacheKey, Date.now())])
      void trimVoiceCache()
      return audio
    }).finally(() => inFlightSynthesis.delete(cacheKey))
  inFlightSynthesis.set(cacheKey, request)
  return request
}

async function executePlayVoice(msgId: number, rawText: string, settings: any) {
  currentPlayingId.value = msgId
  const text = cleanVoiceText(rawText)
  if (!text) { currentPlayingId.value = null; return }
  const profile = profileFor(settings)
  const cacheKey = cacheKeyFor(msgId, text, profile)
  try {
    isSynthesizing.value = true
    const audio = await getAudioHex(cacheKey, text, profile, settings)
    await playAudioHex(audio, msgId)
  } finally { isSynthesizing.value = false }
}

async function processQueue() {
  if (isQueueProcessing || voiceQueue.length === 0) return
  isQueueProcessing = true
  while (voiceQueue.length) {
    const task = voiceQueue.shift()!
    try {
      if (globalAudioInstance) { globalAudioInstance.pause(); globalAudioInstance = null }
      await executePlayVoice(task.msgId, task.text, task.chatSettings)
      task.resolve()
    } catch (error) { currentPlayingId.value = null; task.reject(error) }
  }
  isQueueProcessing = false
}

export function useVoicePlayer() {
  const playVoice = (msgId: number, text: string, chatSettings: any) => {
    if (currentPlayingId.value === msgId && isPlaying.value && voiceQueue.length === 0) { stopVoice(); return Promise.resolve() }
    return new Promise<void>((resolve, reject) => { voiceQueue.push({ msgId, text, chatSettings, resolve, reject }); void processQueue() })
  }
  const stopVoice = () => {
    voiceQueue.length = 0
    if (globalAudioInstance) { globalAudioInstance.pause(); globalAudioInstance = null }
    isPlaying.value = false; currentPlayingId.value = null; isQueueProcessing = false
  }
  return { playVoice, stopVoice, isPlaying, isSynthesizing, currentPlayingId }
}
