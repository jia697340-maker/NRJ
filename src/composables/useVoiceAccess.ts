/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, onMounted, watch } from 'vue'
import localforage from 'localforage'
import { defaultSeedAudioBaseUrl, generateSeedAudio, loadSeedAudioConfig, SEED_AUDIO_CONFIG_KEY, type SeedAudioProtocol, type SeedAudioTransport } from './useSeedAudio'
import { defaultGeminiVoiceBaseUrl, generateGeminiVoice, loadGeminiVoiceConfig, GEMINI_VOICE_CONFIG_KEY, type GeminiVoiceAuthMode, type GeminiVoiceProtocol, type GeminiVoiceTransport } from './useGeminiVoice'
import { defaultElevenLabsVoiceBaseUrl, generateElevenLabsVoice, loadElevenLabsVoiceConfig, ELEVENLABS_VOICE_CONFIG_KEY, type ElevenLabsVoiceOutputFormat, type ElevenLabsVoiceProtocol, type ElevenLabsVoiceTransport } from './useElevenLabsVoice'
import { defaultMicrosoftMaiVoiceBaseUrl, generateMicrosoftMaiVoice, loadMicrosoftMaiVoiceConfig, MICROSOFT_MAI_VOICE_CONFIG_KEY, type MicrosoftMaiVoiceProtocol, type MicrosoftMaiVoiceTransport } from './useMicrosoftMaiVoice'
import { defaultAliyunTtsBaseUrl, generateAliyunTts, loadAliyunTtsConfig, ALIYUN_TTS_CONFIG_KEY, type AliyunTtsProtocol, type AliyunTtsRegion, type AliyunTtsTransport } from './useAliyunTts'

export function useVoiceAccess() {


  const currentView = ref<'platforms' | 'minimax' | 'seed_audio' | 'gemini' | 'elevenlabs' | 'microsoft_mai' | 'aliyun_tts'>('platforms')

  const activeIndex = ref(0)
  const platforms = [
    { id: 'minimax', name: 'MiniMax 语音', desc: '高保真、超低时延的\n语音合成服务', action: '进入配置', disabled: false },
    { id: 'seed_audio', name: 'Seed Audio 1.0', desc: '高表现力角色语音与\n完整场景音频生成', action: '进入配置', disabled: false },
    { id: 'gemini', name: 'Google Gemini', desc: '自然可控、富有表现力的\n角色语音合成', action: '进入配置', disabled: false },
    { id: 'elevenlabs', name: 'ElevenLabs', desc: '自然细腻、支持多语种的\n高表现力角色语音', action: '进入配置', disabled: false },
    { id: 'microsoft_mai', name: 'Microsoft MAI Voice', desc: '自然流畅、情绪丰富的\n多语言角色语音', action: '进入配置', disabled: false },
    { id: 'aliyun_tts', name: '阿里云 TTS', desc: '千问新一代自然可控的\n多语言角色语音', action: '进入配置', disabled: false },
    { id: 'more', name: '更多平台', desc: '敬请期待更多\n优秀语音引擎接入', action: '即将开放', disabled: true }
  ]

  const handlePrev = () => {
    if (activeIndex.value > 0) activeIndex.value--
  }
  const handleNext = () => {
    if (activeIndex.value < platforms.length - 1) activeIndex.value++
  }
  const handleSelect = (id: string, disabled: boolean) => {
    if (!disabled && (id === 'minimax' || id === 'seed_audio' || id === 'gemini' || id === 'elevenlabs' || id === 'microsoft_mai' || id === 'aliyun_tts')) currentView.value = id
  }

  const viewTitle = () => {
    if (currentView.value === 'minimax') return 'MiniMax 接入'
    if (currentView.value === 'seed_audio') return 'Seed Audio 接入'
    if (currentView.value === 'gemini') return 'Gemini TTS 接入'
    if (currentView.value === 'elevenlabs') return 'ElevenLabs 接入'
    if (currentView.value === 'microsoft_mai') return 'Microsoft MAI Voice 接入'
    if (currentView.value === 'aliyun_tts') return '阿里云 TTS 接入'
    return '语音引擎'
  }

  const seedTransport = ref<SeedAudioTransport>('byteplus')
  const seedCustomProtocol = ref<SeedAudioProtocol>('byteplus')
  const seedApiKey = ref('')
  const seedBaseUrl = ref('')
  const seedModel = ref('seed-audio-1.0')
  const seedTestText = ref('请用温柔、自然、亲密的语气说：“今天也很想你。”')
  const seedTestMode = ref<'speech' | 'scene'>('speech')
  const seedTestFormat = ref<'mp3' | 'wav'>('mp3')
  const seedIsLoading = ref(false)
  const seedErrorMsg = ref('')

  const selectSeedTransport = (transport: SeedAudioTransport) => {
    const previousDefault = defaultSeedAudioBaseUrl(seedTransport.value)
    seedTransport.value = transport
    if (!seedBaseUrl.value || seedBaseUrl.value === previousDefault) seedBaseUrl.value = defaultSeedAudioBaseUrl(transport)
  }

  const geminiTransport = ref<GeminiVoiceTransport>('official')
  const geminiProtocol = ref<GeminiVoiceProtocol>('interactions')
  const geminiAuthMode = ref<GeminiVoiceAuthMode>('x_goog_api_key')
  const geminiApiKey = ref('')
  const geminiBaseUrl = ref(defaultGeminiVoiceBaseUrl())
  const geminiModel = ref('gemini-3.1-flash-tts-preview')
  const geminiTestVoice = ref('Kore')
  const geminiTestStyle = ref('温柔、自然、亲密，语速舒缓，像在和最亲近的人说话。')
  const geminiTestText = ref('今天也很想你。')
  const geminiIsLoading = ref(false)
  const geminiErrorMsg = ref('')

  const selectGeminiTransport = (transport: GeminiVoiceTransport) => {
    geminiTransport.value = transport
    if (transport === 'official') {
      geminiBaseUrl.value = defaultGeminiVoiceBaseUrl()
      geminiProtocol.value = 'interactions'
      geminiAuthMode.value = 'x_goog_api_key'
    }
  }

  const elevenLabsTransport = ref<ElevenLabsVoiceTransport>('official')
  const elevenLabsProtocol = ref<ElevenLabsVoiceProtocol>('elevenlabs')
  const elevenLabsApiKey = ref('')
  const elevenLabsBaseUrl = ref(defaultElevenLabsVoiceBaseUrl())
  const elevenLabsModel = ref('eleven_multilingual_v2')
  const elevenLabsOutputFormat = ref<ElevenLabsVoiceOutputFormat>('mp3_44100_128')
  const elevenLabsTestVoiceId = ref('')
  const elevenLabsTestText = ref('今天也很想你。')
  const elevenLabsIsLoading = ref(false)
  const elevenLabsErrorMsg = ref('')

  const selectElevenLabsTransport = (transport: ElevenLabsVoiceTransport) => {
    elevenLabsTransport.value = transport
    if (transport === 'official') {
      elevenLabsBaseUrl.value = defaultElevenLabsVoiceBaseUrl()
      elevenLabsProtocol.value = 'elevenlabs'
    }
  }

  const microsoftMaiTransport = ref<MicrosoftMaiVoiceTransport>('official')
  const microsoftMaiProtocol = ref<MicrosoftMaiVoiceProtocol>('azure')
  const microsoftMaiApiKey = ref('')
  const microsoftMaiRegion = ref('eastus')
  const microsoftMaiBaseUrl = ref(defaultMicrosoftMaiVoiceBaseUrl())
  const microsoftMaiModel = ref('microsoft/mai-voice-2')
  const microsoftMaiTestVoice = ref('zh-CN-Mei:MAI-Voice-2')
  const microsoftMaiTestStyle = ref('')
  const microsoftMaiTestStyleDegree = ref(1)
  const microsoftMaiTestText = ref('今天也很想你。')
  const microsoftMaiIsLoading = ref(false)
  const microsoftMaiErrorMsg = ref('')

  const selectMicrosoftMaiTransport = (transport: MicrosoftMaiVoiceTransport) => {
    microsoftMaiTransport.value = transport
    if (transport === 'official') {
      microsoftMaiProtocol.value = 'azure'
      microsoftMaiBaseUrl.value = defaultMicrosoftMaiVoiceBaseUrl(microsoftMaiRegion.value)
    }
  }

  const aliyunTransport = ref<AliyunTtsTransport>('official')
  const aliyunProtocol = ref<AliyunTtsProtocol>('dashscope')
  const aliyunRegion = ref<AliyunTtsRegion>('china')
  const aliyunApiKey = ref('')
  const aliyunBaseUrl = ref(defaultAliyunTtsBaseUrl())
  const aliyunModel = ref('qwen3-tts-instruct-flash')
  const aliyunTestVoice = ref('Cherry')
  const aliyunTestLanguage = ref('Chinese')
  const aliyunTestInstructions = ref('年轻温柔的声音，亲密自然，语速舒缓。')
  const aliyunOptimizeInstructions = ref(true)
  const aliyunTestText = ref('今天也很想你。')
  const aliyunIsLoading = ref(false)
  const aliyunErrorMsg = ref('')

  const selectAliyunTransport = (transport: AliyunTtsTransport) => {
    aliyunTransport.value = transport
    if (transport === 'official') {
      aliyunProtocol.value = 'dashscope'
      aliyunBaseUrl.value = defaultAliyunTtsBaseUrl(aliyunRegion.value)
    }
  }

  const selectAliyunRegion = (regionValue: AliyunTtsRegion) => {
    const previousDefault = defaultAliyunTtsBaseUrl(aliyunRegion.value)
    aliyunRegion.value = regionValue
    if (aliyunTransport.value === 'official' || !aliyunBaseUrl.value || aliyunBaseUrl.value === previousDefault) {
      aliyunBaseUrl.value = defaultAliyunTtsBaseUrl(regionValue)
    }
  }

  const region = ref('global')
  const apiKey = ref('')
  const testText = ref('这是一段语音合成测试文本。')
  const testModel = ref('speech-2.6-turbo')
  const testVoiceId = ref('female-yujie')
  const isLoading = ref(false)

  const testVoiceOptions = [
    { id: 'female-yujie', name: '温柔御姐' },
    { id: 'female-tianmei', name: '甜美少女' },
    { id: 'female-shaonv', name: '青春少女' },
    { id: 'male-qn-qingse', name: '青涩青年' },
    { id: 'male-qn-jingying', name: '精英沉稳' },
    { id: 'female-huopo', name: '活泼开朗' },
    { id: 'female-wenrou', name: '知性温柔' },
    { id: 'audiobook_male_1', name: '有声书男声 1' },
    { id: 'audiobook_male_2', name: '有声书男声 2' },
    { id: 'audiobook_female_1', name: '有声书女声 1' },
    { id: 'audiobook_female_2', name: '有声书女声 2' },
    { id: 'male-shangwu', name: '商务男声' },
    { id: 'female-chengshu', name: '成熟女声' },
    { id: 'male-boy', name: '阳光男孩' },
    { id: 'female-girl', name: '乖巧女孩' }
  ]
  const errorMsg = ref('')

  const isCheckingBalance = ref(false)
  const balanceMsg = ref('')
  const hasTokenPlan = ref<boolean | null>(null)

  const showKeyPresetModal = ref(false)

  const testModelOptions = [
    'speech-2.6-turbo',
    'speech-2.8-turbo',
    'speech-01-turbo'
  ]

  // Key Presets
  interface KeyPreset {
    id: string
    name: string
    key: string
    region: string
  }
  const keyPresets = ref<KeyPreset[]>([])
  const newPresetName = ref('')

  onMounted(() => {
    const saved = localStorage.getItem('minimax_voice_config_v4')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.region) region.value = parsed.region
        if (parsed.apiKey) apiKey.value = parsed.apiKey
        if (parsed.testText) testText.value = parsed.testText
        if (parsed.testModel) testModel.value = parsed.testModel
        if (parsed.testVoiceId) testVoiceId.value = parsed.testVoiceId
        if (parsed.keyPresets) keyPresets.value = parsed.keyPresets
      } catch(e) {}
    }
    const seedConfig = loadSeedAudioConfig()
    seedTransport.value = seedConfig.transport
    seedCustomProtocol.value = seedConfig.customProtocol
    seedApiKey.value = seedConfig.apiKey
    seedBaseUrl.value = seedConfig.baseUrl
    seedModel.value = seedConfig.model
    try {
      const savedSeed = JSON.parse(localStorage.getItem(SEED_AUDIO_CONFIG_KEY) || '{}')
      if (savedSeed.testText) seedTestText.value = savedSeed.testText
      if (savedSeed.testMode === 'scene') seedTestMode.value = 'scene'
      if (savedSeed.testFormat === 'wav') seedTestFormat.value = 'wav'
    } catch {}
    const geminiConfig = loadGeminiVoiceConfig()
    geminiTransport.value = geminiConfig.transport
    geminiProtocol.value = geminiConfig.protocol
    geminiAuthMode.value = geminiConfig.authMode
    geminiApiKey.value = geminiConfig.apiKey
    geminiBaseUrl.value = geminiConfig.baseUrl
    geminiModel.value = geminiConfig.model
    try {
      const savedGemini = JSON.parse(localStorage.getItem(GEMINI_VOICE_CONFIG_KEY) || '{}')
      if (savedGemini.testVoice) geminiTestVoice.value = savedGemini.testVoice
      if (savedGemini.testStyle) geminiTestStyle.value = savedGemini.testStyle
      if (savedGemini.testText) geminiTestText.value = savedGemini.testText
    } catch {}
    const elevenLabsConfig = loadElevenLabsVoiceConfig()
    elevenLabsTransport.value = elevenLabsConfig.transport
    elevenLabsProtocol.value = elevenLabsConfig.protocol
    elevenLabsApiKey.value = elevenLabsConfig.apiKey
    elevenLabsBaseUrl.value = elevenLabsConfig.baseUrl
    elevenLabsModel.value = elevenLabsConfig.model
    elevenLabsOutputFormat.value = elevenLabsConfig.outputFormat
    try {
      const savedElevenLabs = JSON.parse(localStorage.getItem(ELEVENLABS_VOICE_CONFIG_KEY) || '{}')
      if (savedElevenLabs.testVoiceId) elevenLabsTestVoiceId.value = savedElevenLabs.testVoiceId
      if (savedElevenLabs.testText) elevenLabsTestText.value = savedElevenLabs.testText
    } catch {}
    const microsoftMaiConfig = loadMicrosoftMaiVoiceConfig()
    microsoftMaiTransport.value = microsoftMaiConfig.transport
    microsoftMaiProtocol.value = microsoftMaiConfig.protocol
    microsoftMaiApiKey.value = microsoftMaiConfig.apiKey
    microsoftMaiRegion.value = microsoftMaiConfig.region
    microsoftMaiBaseUrl.value = microsoftMaiConfig.baseUrl
    microsoftMaiModel.value = microsoftMaiConfig.model
    try {
      const savedMicrosoftMai = JSON.parse(localStorage.getItem(MICROSOFT_MAI_VOICE_CONFIG_KEY) || '{}')
      if (savedMicrosoftMai.testVoice) microsoftMaiTestVoice.value = savedMicrosoftMai.testVoice
      if (typeof savedMicrosoftMai.testStyle === 'string') microsoftMaiTestStyle.value = savedMicrosoftMai.testStyle
      if (Number.isFinite(savedMicrosoftMai.testStyleDegree)) microsoftMaiTestStyleDegree.value = savedMicrosoftMai.testStyleDegree
      if (savedMicrosoftMai.testText) microsoftMaiTestText.value = savedMicrosoftMai.testText
    } catch {}
    const aliyunConfig = loadAliyunTtsConfig()
    aliyunTransport.value = aliyunConfig.transport
    aliyunProtocol.value = aliyunConfig.protocol
    aliyunRegion.value = aliyunConfig.region
    aliyunApiKey.value = aliyunConfig.apiKey
    aliyunBaseUrl.value = aliyunConfig.baseUrl
    aliyunModel.value = aliyunConfig.model
    try {
      const savedAliyun = JSON.parse(localStorage.getItem(ALIYUN_TTS_CONFIG_KEY) || '{}')
      if (savedAliyun.testVoice) aliyunTestVoice.value = savedAliyun.testVoice
      if (savedAliyun.testLanguage) aliyunTestLanguage.value = savedAliyun.testLanguage
      if (typeof savedAliyun.testInstructions === 'string') aliyunTestInstructions.value = savedAliyun.testInstructions
      if (typeof savedAliyun.optimizeInstructions === 'boolean') aliyunOptimizeInstructions.value = savedAliyun.optimizeInstructions
      if (savedAliyun.testText) aliyunTestText.value = savedAliyun.testText
    } catch {}
  })

  watch([region, apiKey, testText, testModel, testVoiceId, keyPresets], () => {
    const saved = localStorage.getItem('minimax_voice_config_v4')
    let parsed = {}
    try { if (saved) parsed = JSON.parse(saved) } catch(e) {}
    
    localStorage.setItem('minimax_voice_config_v4', JSON.stringify({
      ...parsed,
      region: region.value,
      apiKey: apiKey.value,
      testText: testText.value,
      testModel: testModel.value,
      testVoiceId: testVoiceId.value,
      keyPresets: keyPresets.value
    }))
  }, { deep: true })

  watch([seedTransport, seedCustomProtocol, seedApiKey, seedBaseUrl, seedModel, seedTestText, seedTestMode, seedTestFormat], () => {
    localStorage.setItem(SEED_AUDIO_CONFIG_KEY, JSON.stringify({
      transport: seedTransport.value,
      customProtocol: seedCustomProtocol.value,
      apiKey: seedApiKey.value,
      baseUrl: seedBaseUrl.value,
      model: seedModel.value || 'seed-audio-1.0',
      testText: seedTestText.value,
      testMode: seedTestMode.value,
      testFormat: seedTestFormat.value
    }))
  })

  watch([geminiTransport, geminiProtocol, geminiAuthMode, geminiApiKey, geminiBaseUrl, geminiModel, geminiTestVoice, geminiTestStyle, geminiTestText], () => {
    localStorage.setItem(GEMINI_VOICE_CONFIG_KEY, JSON.stringify({
      transport: geminiTransport.value,
      protocol: geminiProtocol.value,
      authMode: geminiAuthMode.value,
      apiKey: geminiApiKey.value,
      baseUrl: geminiBaseUrl.value,
      model: geminiModel.value || 'gemini-3.1-flash-tts-preview',
      testVoice: geminiTestVoice.value,
      testStyle: geminiTestStyle.value,
      testText: geminiTestText.value
    }))
  })

  watch([elevenLabsTransport, elevenLabsProtocol, elevenLabsApiKey, elevenLabsBaseUrl, elevenLabsModel, elevenLabsOutputFormat, elevenLabsTestVoiceId, elevenLabsTestText], () => {
    localStorage.setItem(ELEVENLABS_VOICE_CONFIG_KEY, JSON.stringify({
      transport: elevenLabsTransport.value,
      protocol: elevenLabsProtocol.value,
      apiKey: elevenLabsApiKey.value,
      baseUrl: elevenLabsBaseUrl.value,
      model: elevenLabsModel.value || 'eleven_multilingual_v2',
      outputFormat: elevenLabsOutputFormat.value,
      testVoiceId: elevenLabsTestVoiceId.value,
      testText: elevenLabsTestText.value
    }))
  })

  watch([microsoftMaiTransport, microsoftMaiProtocol, microsoftMaiApiKey, microsoftMaiRegion, microsoftMaiBaseUrl, microsoftMaiModel, microsoftMaiTestVoice, microsoftMaiTestStyle, microsoftMaiTestStyleDegree, microsoftMaiTestText], () => {
    localStorage.setItem(MICROSOFT_MAI_VOICE_CONFIG_KEY, JSON.stringify({
      transport: microsoftMaiTransport.value,
      protocol: microsoftMaiProtocol.value,
      apiKey: microsoftMaiApiKey.value,
      region: microsoftMaiRegion.value || 'eastus',
      baseUrl: microsoftMaiBaseUrl.value,
      model: microsoftMaiModel.value || 'microsoft/mai-voice-2',
      testVoice: microsoftMaiTestVoice.value,
      testStyle: microsoftMaiTestStyle.value,
      testStyleDegree: microsoftMaiTestStyleDegree.value,
      testText: microsoftMaiTestText.value
    }))
  })

  watch([aliyunTransport, aliyunProtocol, aliyunRegion, aliyunApiKey, aliyunBaseUrl, aliyunModel, aliyunTestVoice, aliyunTestLanguage, aliyunTestInstructions, aliyunOptimizeInstructions, aliyunTestText], () => {
    localStorage.setItem(ALIYUN_TTS_CONFIG_KEY, JSON.stringify({
      transport: aliyunTransport.value,
      protocol: aliyunProtocol.value,
      region: aliyunRegion.value,
      apiKey: aliyunApiKey.value,
      baseUrl: aliyunBaseUrl.value,
      model: aliyunModel.value || 'qwen3-tts-instruct-flash',
      testVoice: aliyunTestVoice.value,
      testLanguage: aliyunTestLanguage.value,
      testInstructions: aliyunTestInstructions.value,
      optimizeInstructions: aliyunOptimizeInstructions.value,
      testText: aliyunTestText.value
    }))
  })

  let audioInstance: HTMLAudioElement | null = null
  const testVoiceStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatVoices' })
  const testVoiceMetaStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatVoiceMeta' })
  const pendingTests = new Map<string, Promise<string>>()
  const MAX_TEST_CACHE_ITEMS = 20

  const hash = (value: string) => {
    let h = 0x811c9dc5
    for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 0x01000193) }
    return (h >>> 0).toString(36)
  }

  const hexToBlob = (hexString: string, mimeType: string) => {
    const bytes = new Uint8Array(Math.ceil(hexString.length / 2))
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hexString.substr(i * 2, 2), 16)
    }
    return new Blob([bytes], { type: mimeType })
  }

  const getBaseUrl = () => {
    return region.value === 'china' ? 'https://api.minimaxi.com' : 'https://api.minimax.io'
  }

  const trimTestCache = async () => {
    const entries: Array<{ key: string, timestamp: number }> = []
    await testVoiceStore.iterate((_: unknown, key: string) => {
      if (key.startsWith('voice_test_v1_')) entries.push({ key, timestamp: 0 })
    })
    await Promise.all(entries.map(async item => { item.timestamp = (await testVoiceMetaStore.getItem<number>(item.key)) || 0 }))
    entries.sort((a, b) => a.timestamp - b.timestamp)
    while (entries.length > MAX_TEST_CACHE_ITEMS) {
      const oldest = entries.shift()
      if (oldest) await Promise.all([testVoiceStore.removeItem(oldest.key), testVoiceMetaStore.removeItem(oldest.key)])
    }
  }

  const savePreset = () => {
    if (!apiKey.value) {
      alert('请先填写当前要保存的 API Key')
      return
    }
    if (!newPresetName.value.trim()) {
      alert('请输入预设名称')
      return
    }
    keyPresets.value.push({
      id: Date.now().toString(),
      name: newPresetName.value.trim(),
      key: apiKey.value,
      region: region.value
    })
    newPresetName.value = ''
  }

  const applyPreset = (preset: KeyPreset) => {
    apiKey.value = preset.key
    region.value = preset.region
    showKeyPresetModal.value = false
  }

  const deletePreset = (id: string) => {
    keyPresets.value = keyPresets.value.filter(p => p.id !== id)
  }

  const checkBalance = async () => {
    if (!apiKey.value) {
      balanceMsg.value = '请先填写接口密钥'
      hasTokenPlan.value = null
      return
    }
    
    isCheckingBalance.value = true
    balanceMsg.value = ''
    hasTokenPlan.value = null
    
    try {
      const res = await fetch(`${getBaseUrl()}/v1/token_plan/remains`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.value}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!res.ok) {
        if (res.status === 401) throw new Error('鉴权失败：密钥错误或区域不匹配')
        throw new Error(`服务异常 (状态码: ${res.status})`)
      }
      
      const data = await res.json()
      if (data.base_resp && data.base_resp.status_code !== 0) {
        if (data.base_resp.status_msg && data.base_resp.status_msg.includes('plan')) {
          hasTokenPlan.value = false
          return
        }
        throw new Error(data.base_resp.status_msg || '查询失败')
      }
      
      if (data.remains !== undefined && data.remains !== null) {
        hasTokenPlan.value = true
        balanceMsg.value = `剩余额度：¥ ${data.remains}`
      } else {
        hasTokenPlan.value = false
      }
    } catch (err: any) {
      balanceMsg.value = err.message || '查询失败'
      hasTokenPlan.value = null
    } finally {
      isCheckingBalance.value = false
    }
  }

  const openBalancePage = () => {
    const url = region.value === 'china' 
      ? 'https://platform.minimaxi.com/user-center/payment/balance'
      : 'https://platform.minimax.io/user-center/payment/balance'
    window.open(url, '_blank')
  }

  const playTest = async () => {
    if (!apiKey.value) {
      errorMsg.value = '请填写接口密钥'
      return
    }
    if (!testText.value) {
      errorMsg.value = '请填写测试文本'
      return
    }
    
    isLoading.value = true
    errorMsg.value = ''
    
    if (audioInstance) {
      audioInstance.pause()
      audioInstance = null
    }

    const voiceSetting: any = {
      voice_id: testVoiceId.value || 'female-yujie',
      speed: 1.0,
      pitch: 1.0,
      vol: 1.0
    }

    const cacheKey = `voice_test_v1_${hash(JSON.stringify({ text: testText.value, model: testModel.value || 'speech-2.6-turbo', voiceSetting, region: region.value, format: 'mp3', sampleRate: 32000, bitrate: 128000 }))}`

    try {
      let audioHex = await testVoiceStore.getItem<string>(cacheKey)
      if (audioHex) {
        void testVoiceMetaStore.setItem(cacheKey, Date.now())
      } else {
        let request = pendingTests.get(cacheKey)
        if (!request) {
          request = (async () => {
            const res = await fetch(`${getBaseUrl()}/v1/t2a_v2`, {
              method: 'POST', headers: { 'Authorization': `Bearer ${apiKey.value}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: testModel.value || 'speech-2.6-turbo', text: testText.value, stream: false, language_boost: 'auto', output_format: 'hex', voice_setting: voiceSetting, audio_setting: { format: 'mp3', sample_rate: 32000, bitrate: 128000, channel: 1 } })
            })
            if (!res.ok) {
              if (res.status === 401) throw new Error('鉴权失败：密钥错误或区域不匹配')
              if (res.status === 429) throw new Error('请求超限：并发过高或余额不足')
              throw new Error(`服务异常 (状态码: ${res.status})`)
            }
            const data = await res.json()
            if (data.base_resp?.status_code !== 0) throw new Error(data.base_resp?.status_msg || '合成失败')
            if (!data.data?.audio) throw new Error('未接收到有效音频流')
            await Promise.all([testVoiceStore.setItem(cacheKey, data.data.audio), testVoiceMetaStore.setItem(cacheKey, Date.now())])
            void trimTestCache()
            return data.data.audio as string
          })().finally(() => pendingTests.delete(cacheKey))
          pendingTests.set(cacheKey, request)
        }
        audioHex = await request
      }
      if (audioHex) {
        const blob = hexToBlob(audioHex, 'audio/mp3')
        const blobUrl = URL.createObjectURL(blob)
        audioInstance = new Audio(blobUrl)
        audioInstance.play()
      } else {
        throw new Error('未接收到有效音频流')
      }
    } catch (err: any) {
      errorMsg.value = err.message || '未知错误'
    } finally {
      isLoading.value = false
    }
  }

  const playSeedTest = async () => {
    if (!seedApiKey.value.trim()) { seedErrorMsg.value = '请填写 Seed Audio 接口密钥'; return }
    if (!seedTestText.value.trim()) { seedErrorMsg.value = '请填写测试文本'; return }
    if (!seedBaseUrl.value.trim()) { seedErrorMsg.value = '请填写接口地址'; return }
    seedIsLoading.value = true
    seedErrorMsg.value = ''
    if (audioInstance) { audioInstance.pause(); audioInstance = null }
    try {
      const prompt = seedTestMode.value === 'speech'
        ? `使用自然、有表现力的角色声音，只生成干净人声，不要背景音乐或环境音。\n${seedTestText.value}`
        : seedTestText.value
      const audio = await generateSeedAudio({
        transport: seedTransport.value,
        customProtocol: seedCustomProtocol.value,
        apiKey: seedApiKey.value,
        baseUrl: seedBaseUrl.value,
        model: seedModel.value || 'seed-audio-1.0'
      }, { text: prompt, format: seedTestFormat.value, multilingual: true })
      const blobUrl = URL.createObjectURL(audio)
      audioInstance = new Audio(blobUrl)
      audioInstance.onended = () => URL.revokeObjectURL(blobUrl)
      audioInstance.onerror = () => URL.revokeObjectURL(blobUrl)
      await audioInstance.play()
    } catch (err: any) {
      seedErrorMsg.value = err?.message === 'MISSING_SEED_AUDIO_API_KEY' ? '请填写 Seed Audio 接口密钥' : (err?.message || 'Seed Audio 合成失败')
    } finally {
      seedIsLoading.value = false
    }
  }

  const playGeminiTest = async () => {
    if (!geminiApiKey.value.trim()) { geminiErrorMsg.value = '请填写 Gemini TTS 接口密钥'; return }
    if (!geminiBaseUrl.value.trim()) { geminiErrorMsg.value = '请填写 Gemini TTS 接口地址'; return }
    if (!geminiTestText.value.trim()) { geminiErrorMsg.value = '请填写测试文本'; return }
    geminiIsLoading.value = true
    geminiErrorMsg.value = ''
    if (audioInstance) { audioInstance.pause(); audioInstance = null }
    try {
      const audio = await generateGeminiVoice({
        transport: geminiTransport.value,
        protocol: geminiProtocol.value,
        authMode: geminiAuthMode.value,
        apiKey: geminiApiKey.value,
        baseUrl: geminiBaseUrl.value,
        model: geminiModel.value || 'gemini-3.1-flash-tts-preview'
      }, {
        text: geminiTestText.value,
        voiceName: geminiTestVoice.value,
        stylePrompt: geminiTestStyle.value
      })
      const blobUrl = URL.createObjectURL(audio)
      audioInstance = new Audio(blobUrl)
      audioInstance.onended = () => URL.revokeObjectURL(blobUrl)
      audioInstance.onerror = () => URL.revokeObjectURL(blobUrl)
      await audioInstance.play()
    } catch (err: any) {
      geminiErrorMsg.value = err?.message === 'MISSING_GEMINI_VOICE_API_KEY' ? '请填写 Gemini TTS 接口密钥' : (err?.message || 'Gemini TTS 合成失败')
    } finally {
      geminiIsLoading.value = false
    }
  }

  const playElevenLabsTest = async () => {
    if (!elevenLabsApiKey.value.trim()) { elevenLabsErrorMsg.value = '请填写 ElevenLabs 接口密钥'; return }
    if (!elevenLabsBaseUrl.value.trim()) { elevenLabsErrorMsg.value = '请填写 ElevenLabs 接口地址'; return }
    if (!elevenLabsTestVoiceId.value.trim()) { elevenLabsErrorMsg.value = '请填写 ElevenLabs 音色 ID'; return }
    if (!elevenLabsTestText.value.trim()) { elevenLabsErrorMsg.value = '请填写测试文本'; return }
    elevenLabsIsLoading.value = true
    elevenLabsErrorMsg.value = ''
    if (audioInstance) { audioInstance.pause(); audioInstance = null }
    try {
      const audio = await generateElevenLabsVoice({
        transport: elevenLabsTransport.value,
        protocol: elevenLabsProtocol.value,
        apiKey: elevenLabsApiKey.value,
        baseUrl: elevenLabsBaseUrl.value,
        model: elevenLabsModel.value || 'eleven_multilingual_v2',
        outputFormat: elevenLabsOutputFormat.value
      }, {
        text: elevenLabsTestText.value,
        voiceId: elevenLabsTestVoiceId.value,
        model: elevenLabsModel.value || 'eleven_multilingual_v2'
      })
      const blobUrl = URL.createObjectURL(audio)
      audioInstance = new Audio(blobUrl)
      audioInstance.onended = () => URL.revokeObjectURL(blobUrl)
      audioInstance.onerror = () => URL.revokeObjectURL(blobUrl)
      await audioInstance.play()
    } catch (err: any) {
      elevenLabsErrorMsg.value = err?.message === 'MISSING_ELEVENLABS_VOICE_API_KEY'
        ? '请填写 ElevenLabs 接口密钥'
        : (err?.message || 'ElevenLabs 合成失败')
    } finally {
      elevenLabsIsLoading.value = false
    }
  }

  const playMicrosoftMaiTest = async () => {
    if (!microsoftMaiApiKey.value.trim()) { microsoftMaiErrorMsg.value = '请填写 Microsoft MAI Voice 接口密钥'; return }
    if (microsoftMaiTransport.value === 'official' && !microsoftMaiRegion.value.trim()) { microsoftMaiErrorMsg.value = '请填写 Azure Speech 区域'; return }
    if (microsoftMaiTransport.value === 'custom' && !microsoftMaiBaseUrl.value.trim()) { microsoftMaiErrorMsg.value = '请填写中转地址'; return }
    if (!microsoftMaiTestVoice.value.trim()) { microsoftMaiErrorMsg.value = '请填写 MAI Voice 音色名称'; return }
    if (!microsoftMaiTestText.value.trim()) { microsoftMaiErrorMsg.value = '请填写测试文本'; return }
    microsoftMaiIsLoading.value = true
    microsoftMaiErrorMsg.value = ''
    if (audioInstance) { audioInstance.pause(); audioInstance = null }
    try {
      const audio = await generateMicrosoftMaiVoice({
        transport: microsoftMaiTransport.value,
        protocol: microsoftMaiProtocol.value,
        apiKey: microsoftMaiApiKey.value,
        region: microsoftMaiRegion.value || 'eastus',
        baseUrl: microsoftMaiBaseUrl.value,
        model: microsoftMaiModel.value || 'microsoft/mai-voice-2'
      }, {
        text: microsoftMaiTestText.value,
        voiceName: microsoftMaiTestVoice.value,
        style: microsoftMaiTestStyle.value,
        styleDegree: microsoftMaiTestStyleDegree.value
      })
      const blobUrl = URL.createObjectURL(audio)
      audioInstance = new Audio(blobUrl)
      audioInstance.onended = () => URL.revokeObjectURL(blobUrl)
      audioInstance.onerror = () => URL.revokeObjectURL(blobUrl)
      await audioInstance.play()
    } catch (err: any) {
      microsoftMaiErrorMsg.value = err?.message === 'MISSING_MICROSOFT_MAI_VOICE_API_KEY'
        ? '请填写 Microsoft MAI Voice 接口密钥'
        : (err?.message || 'Microsoft MAI Voice 合成失败')
    } finally {
      microsoftMaiIsLoading.value = false
    }
  }

  const playAliyunTest = async () => {
    if (!aliyunApiKey.value.trim()) { aliyunErrorMsg.value = '请填写阿里云 TTS 接口密钥'; return }
    if (aliyunTransport.value === 'custom' && !aliyunBaseUrl.value.trim()) { aliyunErrorMsg.value = '请填写阿里云 TTS 中转地址'; return }
    if (!aliyunTestVoice.value.trim()) { aliyunErrorMsg.value = '请填写阿里云 TTS 音色名称'; return }
    if (!aliyunTestText.value.trim()) { aliyunErrorMsg.value = '请填写测试文本'; return }
    aliyunIsLoading.value = true
    aliyunErrorMsg.value = ''
    if (audioInstance) { audioInstance.pause(); audioInstance = null }
    try {
      const audio = await generateAliyunTts({
        transport: aliyunTransport.value,
        protocol: aliyunProtocol.value,
        region: aliyunRegion.value,
        apiKey: aliyunApiKey.value,
        baseUrl: aliyunBaseUrl.value,
        model: aliyunModel.value || 'qwen3-tts-instruct-flash'
      }, {
        text: aliyunTestText.value,
        voice: aliyunTestVoice.value,
        languageType: aliyunTestLanguage.value,
        instructions: aliyunTestInstructions.value,
        optimizeInstructions: aliyunOptimizeInstructions.value
      })
      const blobUrl = URL.createObjectURL(audio)
      audioInstance = new Audio(blobUrl)
      audioInstance.onended = () => URL.revokeObjectURL(blobUrl)
      audioInstance.onerror = () => URL.revokeObjectURL(blobUrl)
      await audioInstance.play()
    } catch (err: any) {
      aliyunErrorMsg.value = err?.message === 'MISSING_ALIYUN_TTS_API_KEY'
        ? '请填写阿里云 TTS 接口密钥'
        : (err?.message || '阿里云 TTS 合成失败')
    } finally {
      aliyunIsLoading.value = false
    }
  }

  return {
    currentView,
    activeIndex,
    platforms,
    handlePrev,
    handleNext,
    handleSelect,
    viewTitle,
    seedTransport,
    seedCustomProtocol,
    seedApiKey,
    seedBaseUrl,
    seedModel,
    seedTestText,
    seedTestMode,
    seedTestFormat,
    seedIsLoading,
    seedErrorMsg,
    selectSeedTransport,
    geminiTransport,
    geminiProtocol,
    geminiAuthMode,
    geminiApiKey,
    geminiBaseUrl,
    geminiModel,
    geminiTestVoice,
    geminiTestStyle,
    geminiTestText,
    geminiIsLoading,
    geminiErrorMsg,
    selectGeminiTransport,
    elevenLabsTransport,
    elevenLabsProtocol,
    elevenLabsApiKey,
    elevenLabsBaseUrl,
    elevenLabsModel,
    elevenLabsOutputFormat,
    elevenLabsTestVoiceId,
    elevenLabsTestText,
    elevenLabsIsLoading,
    elevenLabsErrorMsg,
    selectElevenLabsTransport,
    microsoftMaiTransport,
    microsoftMaiProtocol,
    microsoftMaiApiKey,
    microsoftMaiRegion,
    microsoftMaiBaseUrl,
    microsoftMaiModel,
    microsoftMaiTestVoice,
    microsoftMaiTestStyle,
    microsoftMaiTestStyleDegree,
    microsoftMaiTestText,
    microsoftMaiIsLoading,
    microsoftMaiErrorMsg,
    selectMicrosoftMaiTransport,
    aliyunTransport,
    aliyunProtocol,
    aliyunRegion,
    aliyunApiKey,
    aliyunBaseUrl,
    aliyunModel,
    aliyunTestVoice,
    aliyunTestLanguage,
    aliyunTestInstructions,
    aliyunOptimizeInstructions,
    aliyunTestText,
    aliyunIsLoading,
    aliyunErrorMsg,
    selectAliyunTransport,
    selectAliyunRegion,
    region,
    apiKey,
    testText,
    testModel,
    testVoiceId,
    isLoading,
    testVoiceOptions,
    errorMsg,
    isCheckingBalance,
    balanceMsg,
    hasTokenPlan,
    showKeyPresetModal,
    testModelOptions,
    keyPresets,
    newPresetName,
    audioInstance,
    testVoiceStore,
    testVoiceMetaStore,
    pendingTests,
    MAX_TEST_CACHE_ITEMS,
    hash,
    hexToBlob,
    getBaseUrl,
    trimTestCache,
    savePreset,
    applyPreset,
    deletePreset,
    checkBalance,
    openBalancePage,
    playTest,
    playSeedTest,
    playGeminiTest,
    playElevenLabsTest,
    playMicrosoftMaiTest,
    playAliyunTest,
  }
}
