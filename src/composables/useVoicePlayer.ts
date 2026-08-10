/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'
import { generateSeedAudio, loadSeedAudioConfig } from './useSeedAudio'
import { generateGeminiVoice, loadGeminiVoiceConfig } from './useGeminiVoice'
import { generateElevenLabsVoice, loadElevenLabsVoiceConfig } from './useElevenLabsVoice'
import { generateMicrosoftMaiVoice, loadMicrosoftMaiVoiceConfig } from './useMicrosoftMaiVoice'
import { generateAliyunTts, loadAliyunTtsConfig } from './useAliyunTts'

let globalAudioInstance: HTMLAudioElement | null = null
const isPlaying = ref(false)
const isSynthesizing = ref(false)
const currentPlayingId = ref<number | null>(null)

interface VoiceTask { msgId: number; text: string; chatSettings: any; resolve: () => void; reject: (err: any) => void }
interface VoiceProfile {
  provider: 'minimax' | 'seed_audio' | 'gemini' | 'elevenlabs' | 'microsoft_mai' | 'aliyun_tts'
  model: string; voiceId: string; speed: number; pitch: number; volume: number
  language: string; emotion: string; format: 'mp3'; sampleRate: number; bitrate: number; channel: number
  seedAudioMode: 'speech' | 'scene'; seedAudioPromptPrefix: string; seedAudioReferenceUrls: string[]; seedAudioMultilingual: boolean
  geminiVoiceName: string; geminiVoicePrompt: string; geminiModel: string; geminiEndpoint: string
  elevenLabsVoiceId: string; elevenLabsModel: string; elevenLabsLanguage: string; elevenLabsStability: number
  elevenLabsSimilarity: number; elevenLabsStyle: number; elevenLabsSpeakerBoost: boolean; elevenLabsSpeed: number; elevenLabsEndpoint: string
  microsoftMaiVoiceName: string; microsoftMaiVoiceStyle: string; microsoftMaiStyleDegree: number; microsoftMaiEndpoint: string
  aliyunVoice: string; aliyunModel: string; aliyunLanguage: string; aliyunInstructions: string; aliyunOptimizeInstructions: boolean; aliyunEndpoint: string
}

const voiceQueue: VoiceTask[] = []
const inFlightSynthesis = new Map<string, Promise<string | Blob>>()
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
const profileFor = (settings: any): VoiceProfile => {
  const geminiConfig = loadGeminiVoiceConfig()
  const elevenLabsConfig = loadElevenLabsVoiceConfig()
  const microsoftMaiConfig = loadMicrosoftMaiVoiceConfig()
  const aliyunConfig = loadAliyunTtsConfig()
  return {
    provider: settings?.voiceProvider === 'seed_audio' || settings?.voiceProvider === 'gemini' || settings?.voiceProvider === 'elevenlabs' || settings?.voiceProvider === 'microsoft_mai' || settings?.voiceProvider === 'aliyun_tts'
      ? settings.voiceProvider
      : 'minimax',
    model: settings?.voiceModel || 'speech-2.6-turbo', voiceId: settings?.voiceId || 'female-yujie',
    speed: settings?.voiceSpeed ?? 1, pitch: settings?.voicePitch ?? 1, volume: settings?.voiceVolume ?? 1,
    language: languageMap[settings?.voiceLanguage || ''] || 'auto', emotion: settings?.voiceEmotion || '',
    format: 'mp3', sampleRate: 32000, bitrate: 128000, channel: 1,
    seedAudioMode: settings?.seedAudioMode === 'scene' ? 'scene' : 'speech',
    seedAudioPromptPrefix: settings?.seedAudioPromptPrefix || '',
    seedAudioReferenceUrls: Array.isArray(settings?.seedAudioReferenceUrls) ? settings.seedAudioReferenceUrls.filter(Boolean).slice(0, 3) : [],
    seedAudioMultilingual: settings?.seedAudioMultilingual ?? true,
    geminiVoiceName: settings?.geminiVoiceName || 'Kore',
    geminiVoicePrompt: settings?.geminiVoicePrompt || '',
    geminiModel: geminiConfig.model,
    geminiEndpoint: `${geminiConfig.transport}:${geminiConfig.protocol}:${geminiConfig.baseUrl}`,
    elevenLabsVoiceId: settings?.elevenLabsVoiceId || '',
    elevenLabsModel: settings?.elevenLabsModel || elevenLabsConfig.model,
    elevenLabsLanguage: settings?.elevenLabsLanguage || '',
    elevenLabsStability: settings?.elevenLabsStability ?? 0.5,
    elevenLabsSimilarity: settings?.elevenLabsSimilarity ?? 0.75,
    elevenLabsStyle: settings?.elevenLabsStyle ?? 0,
    elevenLabsSpeakerBoost: settings?.elevenLabsSpeakerBoost ?? true,
    elevenLabsSpeed: settings?.elevenLabsSpeed ?? 1,
    elevenLabsEndpoint: `${elevenLabsConfig.transport}:${elevenLabsConfig.protocol}:${elevenLabsConfig.baseUrl}:${elevenLabsConfig.outputFormat}`,
    microsoftMaiVoiceName: settings?.microsoftMaiVoiceName || 'zh-CN-Mei:MAI-Voice-2',
    microsoftMaiVoiceStyle: settings?.microsoftMaiVoiceStyle || '',
    microsoftMaiStyleDegree: settings?.microsoftMaiStyleDegree ?? 1,
    microsoftMaiEndpoint: `${microsoftMaiConfig.transport}:${microsoftMaiConfig.protocol}:${microsoftMaiConfig.region}:${microsoftMaiConfig.baseUrl}:${microsoftMaiConfig.model}`,
    aliyunVoice: settings?.aliyunVoice || 'Cherry',
    aliyunModel: settings?.aliyunModel || aliyunConfig.model,
    aliyunLanguage: settings?.aliyunLanguage || 'Auto',
    aliyunInstructions: settings?.aliyunInstructions || '',
    aliyunOptimizeInstructions: settings?.aliyunOptimizeInstructions ?? true,
    aliyunEndpoint: `${aliyunConfig.transport}:${aliyunConfig.protocol}:${aliyunConfig.region}:${aliyunConfig.baseUrl}:${aliyunConfig.model}`
  }
}
const cacheKeyFor = (msgId: number, text: string, profile: VoiceProfile) => `voice_v2_${msgId}_${hash(JSON.stringify({ text, profile }))}`

async function trimVoiceCache() {
  const entries: Array<{ key: string; size: number; updatedAt: number }> = []
  await voiceStore.iterate((value: unknown, key: string) => {
    if (key.startsWith('voice_') && (typeof value === 'string' || value instanceof Blob)) {
      entries.push({ key, size: typeof value === 'string' ? value.length / 2 : value.size, updatedAt: 0 })
    }
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

function playAudio(audio: string | Blob, msgId: number) {
  return new Promise<void>((resolve) => {
    const blobUrl = URL.createObjectURL(typeof audio === 'string' ? hexToBlob(audio) : audio)
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

const seedAudioPrompt = (text: string, profile: VoiceProfile) => {
  const reference = profile.seedAudioReferenceUrls.length ? '@Audio1 ' : ''
  const prefix = profile.seedAudioPromptPrefix.trim()
  if (profile.seedAudioMode === 'scene') return [prefix, text].filter(Boolean).join('\n')
  const direction = prefix || '使用自然、有表现力的角色声音，只生成干净人声，不要背景音乐或环境音。'
  return `${reference}${direction}\n请朗读：“${text}”`
}

async function synthesizeSeedAudio(text: string, profile: VoiceProfile) {
  const config = loadSeedAudioConfig()
  return generateSeedAudio(config, {
    text: seedAudioPrompt(text, profile),
    referenceUrls: profile.seedAudioReferenceUrls,
    multilingual: profile.seedAudioMultilingual,
    format: profile.format,
    sampleRate: 24000,
    speed: profile.speed,
    volume: profile.volume,
    pitch: profile.pitch
  })
}

async function synthesizeGeminiVoice(text: string, profile: VoiceProfile) {
  return generateGeminiVoice(loadGeminiVoiceConfig(), {
    text,
    voiceName: profile.geminiVoiceName,
    stylePrompt: profile.geminiVoicePrompt
  })
}

async function synthesizeElevenLabsVoice(text: string, profile: VoiceProfile) {
  return generateElevenLabsVoice(loadElevenLabsVoiceConfig(), {
    text,
    voiceId: profile.elevenLabsVoiceId,
    model: profile.elevenLabsModel,
    languageCode: profile.elevenLabsLanguage,
    stability: profile.elevenLabsStability,
    similarityBoost: profile.elevenLabsSimilarity,
    style: profile.elevenLabsStyle,
    useSpeakerBoost: profile.elevenLabsSpeakerBoost,
    speed: profile.elevenLabsSpeed
  })
}

async function synthesizeMicrosoftMaiVoice(text: string, profile: VoiceProfile) {
  return generateMicrosoftMaiVoice(loadMicrosoftMaiVoiceConfig(), {
    text,
    voiceName: profile.microsoftMaiVoiceName,
    style: profile.microsoftMaiVoiceStyle,
    styleDegree: profile.microsoftMaiStyleDegree
  })
}

async function synthesizeAliyunTts(text: string, profile: VoiceProfile) {
  const config = loadAliyunTtsConfig()
  return generateAliyunTts({ ...config, model: profile.aliyunModel || config.model }, {
    text,
    voice: profile.aliyunVoice,
    languageType: profile.aliyunLanguage,
    instructions: profile.aliyunInstructions,
    optimizeInstructions: profile.aliyunOptimizeInstructions
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

async function getAudio(cacheKey: string, text: string, profile: VoiceProfile, settings: any) {
  const cached = await voiceStore.getItem<string | Blob>(cacheKey)
  if (cached) { await voiceMetaStore.setItem(cacheKey, Date.now()); return cached }
  const pending = inFlightSynthesis.get(cacheKey)
  if (pending) return pending
  let request: Promise<string | Blob>
  if (profile.provider === 'seed_audio') {
    request = synthesizeSeedAudio(text, profile)
  } else if (profile.provider === 'gemini') {
    request = synthesizeGeminiVoice(text, profile)
  } else if (profile.provider === 'elevenlabs') {
    request = synthesizeElevenLabsVoice(text, profile)
  } else if (profile.provider === 'microsoft_mai') {
    request = synthesizeMicrosoftMaiVoice(text, profile)
  } else if (profile.provider === 'aliyun_tts') {
    request = synthesizeAliyunTts(text, profile)
  } else {
    const configString = localStorage.getItem('minimax_voice_config_v4')
    if (!configString) throw new Error('MISSING_API_KEY')
    let config: any
    try { config = JSON.parse(configString) } catch { throw new Error('MISSING_API_KEY') }
    if (!config.apiKey) throw new Error('MISSING_API_KEY')
    request = synthesize(text, profile, config.apiKey, config.region || 'global', Boolean(settings?.voiceStream))
  }
  request = request
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
    const audio = await getAudio(cacheKey, text, profile, settings)
    await playAudio(audio, msgId)
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
