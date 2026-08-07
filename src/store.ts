/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, watch } from 'vue'

const readStoredJSON = <T>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value) as T
  } catch (error) {
    console.warn(`本地数据 ${key} 已损坏，已使用安全默认值`, error)
    return fallback
  }
}

const STORAGE_KEY = 'clingy_global_settings'

const savedSettings = readStoredJSON<Record<string, any>>(STORAGE_KEY, {})

export const globalSettings = reactive({
  darkMode: savedSettings.darkMode ?? false,
  nightShift: savedSettings.nightShift ?? false,
  accentColor: savedSettings.accentColor ?? '#007aff',
  wallpaper: savedSettings.wallpaper ?? 'default',
  lockScreenWallpaper: savedSettings.lockScreenWallpaper ?? 'default',
  lockScreenStyle: savedSettings.lockScreenStyle ?? 'modern',
  chatListWallpaper: savedSettings.chatListWallpaper ?? 'default',
  showStatusBar: savedSettings.showStatusBar ?? true,
  showNotch: savedSettings.showNotch ?? true,
  chargingBoltInside: savedSettings.chargingBoltInside ?? false,
  showDockAppNames: savedSettings.showDockAppNames ?? false,
  classicTheme: savedSettings.classicTheme ?? 'default',
  enableSlider: savedSettings.enableSlider ?? false,
  sliderIcon: savedSettings.sliderIcon ?? '♥',
  enableLockScreen: savedSettings.enableLockScreen ?? false,
  unlockMethod: savedSettings.unlockMethod ?? 'swipe',
  unlockDigit: savedSettings.unlockDigit ?? '1234',
  unlockQaQuestion: savedSettings.unlockQaQuestion ?? '我是你的什么人？',
  unlockQaAnswer: savedSettings.unlockQaAnswer ?? '粘人精'
})

watch(globalSettings, (newVal) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const COT_STORAGE_KEY = 'clingy_cot_settings'
const savedCotSettings = readStoredJSON<Record<string, any>>(COT_STORAGE_KEY, {})

export interface CotItem {
  id: string
  name: string
  position: 'system_top' | 'system_middle' | 'system_bottom' | 'assistant_prefill'
  role: 'system' | 'assistant' | 'user'
  content: string
  enabled: boolean
}

// 默认的 MOM 嵌套思维链配置
const defaultCotItems: CotItem[] = [
  {
    id: 'cot_default_1',
    name: '思维链开启引导 (头)',
    position: 'system_top',
    role: 'system',
    content: '【强制思考与回复格式】\n每次回复前，必须严格按照以下嵌套结构进行思考和输出：\n[incipere]\n<thinking>\n',
    enabled: true
  },
  {
    id: 'cot_default_3',
    name: '格式闭合 (尾)',
    position: 'system_bottom',
    role: 'system',
    content: '</thinking>\n[finire]\n<msg>\n你的最终回复正文\n</msg>',
    enabled: true
  },
  {
    id: 'cot_default_4',
    name: '思维链触发器',
    position: 'assistant_prefill',
    role: 'assistant',
    content: '[incipere]\n<thinking>\n',
    enabled: true
  }
]

export const cotSettings = reactive({
  enabled: savedCotSettings.enabled ?? false,
  mode: savedCotSettings.mode ?? 'skip', // 'skip' | 'custom' 保留兼容性
  showThinking: savedCotSettings.showThinking ?? true,
  items: (savedCotSettings.items || defaultCotItems) as CotItem[]
})

// 数据迁移与污染清洗逻辑
if (cotSettings.items) {
  let needsFix = false

  // 0. 移除旧的系统默认“中”条目 (cot_default_2)
  const oldMiddleIndex = cotSettings.items.findIndex(i => i.id === 'cot_default_2')
  if (oldMiddleIndex > -1) {
    cotSettings.items.splice(oldMiddleIndex, 1)
    needsFix = true
  }

  // 1. 清洗 [object Object] 等乱码污染
  cotSettings.items.forEach(item => {
    if (typeof item.content === 'string' && item.content.includes('[object Object]')) {
      item.content = item.content.replace(/\[object Object\]/g, '').replace(/,/g, '').trim()
      needsFix = true
    }
  })

  // 2. 检查并热修复为分离式头尾结构 (头包含 <thinking>, 尾包含 </thinking>)
  const topItem = cotSettings.items.find(i => i.position === 'system_top')
  const bottomItem = cotSettings.items.find(i => i.position === 'system_bottom')

  if (topItem && !topItem.content.includes('<thinking>')) {
    topItem.content = '【强制思考与回复格式】\n每次回复前，必须严格按照以下嵌套结构进行思考和输出：\n[incipere]\n<thinking>\n'
    needsFix = true
  }

  if (bottomItem && !bottomItem.content.includes('</thinking>')) {
    bottomItem.content = '</thinking>\n[finire]\n<msg>\n你的最终回复正文\n</msg>'
    needsFix = true
  }

  // 若发生了修复，立即回写本地避免下一次被覆盖
  if (needsFix) {
    localStorage.setItem(COT_STORAGE_KEY, JSON.stringify(cotSettings))
  }
}

watch(cotSettings, (newVal) => {
  localStorage.setItem(COT_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const API_STORAGE_KEY = 'clingy_api_settings'
const savedApiSettings = readStoredJSON<Record<string, any>>(API_STORAGE_KEY, {})

export interface ApiPreset {
  id: string
  name: string
  provider: string
  url: string
  key: string
  model: string
  customUrl: string
  customKey: string
  enableTemperature?: boolean
  temperature?: number
  enableMaxTokens?: boolean
  maxTokens?: number
  enableTopP?: boolean
  topP?: number
  enableFrequencyPenalty?: boolean
  frequencyPenalty?: number
  enablePresencePenalty?: boolean
  presencePenalty?: number
  enableStream?: boolean
}

export const apiSettings = reactive({
  provider: savedApiSettings.provider || 'deepseek',
  url: savedApiSettings.url ?? 'https://api.deepseek.com',
  key: savedApiSettings.key ?? '',
  model: savedApiSettings.model ?? '',
  availableModels: savedApiSettings.availableModels || [],
  apiClassicTheme: savedApiSettings.apiClassicTheme || 'default',
  customUrl: savedApiSettings.customUrl ?? '',
  customKey: savedApiSettings.customKey ?? '',
  enableTemperature: savedApiSettings.enableTemperature ?? false,
  temperature: savedApiSettings.temperature ?? 0.7,
  enableMaxTokens: savedApiSettings.enableMaxTokens ?? false,
  maxTokens: savedApiSettings.maxTokens ?? 1000,
  enableTopP: savedApiSettings.enableTopP ?? false,
  topP: savedApiSettings.topP ?? 1.0,
  enableFrequencyPenalty: savedApiSettings.enableFrequencyPenalty ?? false,
  frequencyPenalty: savedApiSettings.frequencyPenalty ?? 0,
  enablePresencePenalty: savedApiSettings.enablePresencePenalty ?? false,
  presencePenalty: savedApiSettings.presencePenalty ?? 0,
  enableStream: savedApiSettings.enableStream ?? false,
  presets: (savedApiSettings.presets || []) as ApiPreset[],
  currentPresetId: savedApiSettings.currentPresetId ?? ''
})

watch(apiSettings, (newVal) => {
  localStorage.setItem(API_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const VISION_API_STORAGE_KEY = 'clingy_vision_api_settings'
const savedVisionApiSettings = readStoredJSON<Record<string, any>>(VISION_API_STORAGE_KEY, {})

export const visionApiSettings = reactive({
  enabled: savedVisionApiSettings.enabled ?? false,
  provider: savedVisionApiSettings.provider || 'deepseek',
  url: savedVisionApiSettings.url ?? 'https://api.deepseek.com',
  key: savedVisionApiSettings.key ?? '',
  model: savedVisionApiSettings.model ?? '',
  availableModels: savedVisionApiSettings.availableModels || [],
  customUrl: savedVisionApiSettings.customUrl ?? '',
  customKey: savedVisionApiSettings.customKey ?? '',
  enableTemperature: savedVisionApiSettings.enableTemperature ?? false,
  temperature: savedVisionApiSettings.temperature ?? 0.7,
  enableMaxTokens: savedVisionApiSettings.enableMaxTokens ?? false,
  maxTokens: savedVisionApiSettings.maxTokens ?? 1000,
  enableTopP: savedVisionApiSettings.enableTopP ?? false,
  topP: savedVisionApiSettings.topP ?? 1.0,
  enableFrequencyPenalty: savedVisionApiSettings.enableFrequencyPenalty ?? false,
  frequencyPenalty: savedVisionApiSettings.frequencyPenalty ?? 0,
  enablePresencePenalty: savedVisionApiSettings.enablePresencePenalty ?? false,
  presencePenalty: savedVisionApiSettings.presencePenalty ?? 0,
  enableStream: savedVisionApiSettings.enableStream ?? false,
  presets: (savedVisionApiSettings.presets || []) as ApiPreset[],
  currentPresetId: savedVisionApiSettings.currentPresetId ?? ''
})

watch(visionApiSettings, (newVal) => {
  localStorage.setItem(VISION_API_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const SUMMARY_API_STORAGE_KEY = 'clingy_summary_api_settings'
const savedSummaryApiSettings = readStoredJSON<Record<string, any>>(SUMMARY_API_STORAGE_KEY, {})

export const summaryApiSettings = reactive({
  enabled: savedSummaryApiSettings.enabled ?? false,
  provider: savedSummaryApiSettings.provider || 'deepseek',
  url: savedSummaryApiSettings.url ?? 'https://api.deepseek.com',
  key: savedSummaryApiSettings.key ?? '',
  model: savedSummaryApiSettings.model ?? '',
  availableModels: savedSummaryApiSettings.availableModels || [],
  customUrl: savedSummaryApiSettings.customUrl ?? '',
  customKey: savedSummaryApiSettings.customKey ?? '',
  enableTemperature: savedSummaryApiSettings.enableTemperature ?? false,
  temperature: savedSummaryApiSettings.temperature ?? 0.7,
  enableMaxTokens: savedSummaryApiSettings.enableMaxTokens ?? false,
  maxTokens: savedSummaryApiSettings.maxTokens ?? 1000,
  enableTopP: savedSummaryApiSettings.enableTopP ?? false,
  topP: savedSummaryApiSettings.topP ?? 1.0,
  enableFrequencyPenalty: savedSummaryApiSettings.enableFrequencyPenalty ?? false,
  frequencyPenalty: savedSummaryApiSettings.frequencyPenalty ?? 0,
  enablePresencePenalty: savedSummaryApiSettings.enablePresencePenalty ?? false,
  presencePenalty: savedSummaryApiSettings.presencePenalty ?? 0,
  enableStream: savedSummaryApiSettings.enableStream ?? false,
  presets: (savedSummaryApiSettings.presets || []) as ApiPreset[],
  currentPresetId: savedSummaryApiSettings.currentPresetId ?? ''
})

watch(summaryApiSettings, (newVal) => {
  localStorage.setItem(SUMMARY_API_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const EMBEDDING_API_STORAGE_KEY = 'clingy_embedding_api_settings'
const savedEmbeddingApiSettings = readStoredJSON<Record<string, any>>(EMBEDDING_API_STORAGE_KEY, {})

// 向量节点完全可选。未启用时，长期记忆自动降级为关键词、标签、时间与重要度混合检索。
export const embeddingApiSettings = reactive({
  enabled: savedEmbeddingApiSettings.enabled ?? false,
  provider: savedEmbeddingApiSettings.provider || 'openai',
  url: savedEmbeddingApiSettings.url ?? 'https://api.openai.com',
  key: savedEmbeddingApiSettings.key ?? '',
  model: savedEmbeddingApiSettings.model ?? '',
  availableModels: savedEmbeddingApiSettings.availableModels || [],
  customUrl: savedEmbeddingApiSettings.customUrl ?? '',
  customKey: savedEmbeddingApiSettings.customKey ?? '',
  batchSize: savedEmbeddingApiSettings.batchSize ?? 20
})

watch(embeddingApiSettings, (newVal) => {
  localStorage.setItem(EMBEDDING_API_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const MOMENT_API_STORAGE_KEY = 'clingy_moment_api_settings'
const savedMomentApiSettings = readStoredJSON<Record<string, any>>(MOMENT_API_STORAGE_KEY, {})

// 朋友圈专用节点只接管角色读取朋友圈后的第二轮回应。
// 未启用或配置不完整时，调用层会自动继续使用全局节点。
export const momentApiSettings = reactive({
  enabled: savedMomentApiSettings.enabled ?? false,
  provider: savedMomentApiSettings.provider || 'deepseek',
  url: savedMomentApiSettings.url ?? 'https://api.deepseek.com',
  key: savedMomentApiSettings.key ?? '',
  model: savedMomentApiSettings.model ?? '',
  availableModels: savedMomentApiSettings.availableModels || [],
  customUrl: savedMomentApiSettings.customUrl ?? '',
  customKey: savedMomentApiSettings.customKey ?? '',
  enableTemperature: savedMomentApiSettings.enableTemperature ?? false,
  temperature: savedMomentApiSettings.temperature ?? 0.7,
  enableMaxTokens: savedMomentApiSettings.enableMaxTokens ?? true,
  maxTokens: savedMomentApiSettings.maxTokens ?? 500,
  enableTopP: savedMomentApiSettings.enableTopP ?? false,
  topP: savedMomentApiSettings.topP ?? 1.0,
  enableFrequencyPenalty: savedMomentApiSettings.enableFrequencyPenalty ?? false,
  frequencyPenalty: savedMomentApiSettings.frequencyPenalty ?? 0,
  enablePresencePenalty: savedMomentApiSettings.enablePresencePenalty ?? false,
  presencePenalty: savedMomentApiSettings.presencePenalty ?? 0,
  enableStream: savedMomentApiSettings.enableStream ?? false,
  presets: (savedMomentApiSettings.presets || []) as ApiPreset[],
  currentPresetId: savedMomentApiSettings.currentPresetId ?? ''
})

watch(momentApiSettings, (newVal) => {
  localStorage.setItem(MOMENT_API_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const CHAT_STORAGE_KEY = 'clingy_chat_settings'
const savedChatSettings = readStoredJSON<Record<string, any>>(CHAT_STORAGE_KEY, {})

export const chatSettings = reactive({
  theme: 'minimal', // 强制只使用极简主题
  showTopBarContextMenu: savedChatSettings.showTopBarContextMenu ?? true,
  enableGlobalNotification: savedChatSettings.enableGlobalNotification ?? true,
  enableNotificationInChat: savedChatSettings.enableNotificationInChat ?? false,
  notificationStyle: savedChatSettings.notificationStyle ?? 'queue', // 'queue' | 'list' | 'stack'
  transferStyle: savedChatSettings.transferStyle ?? 'wechat', // 'wechat' | 'glass'
  cotInSameBubble: savedChatSettings.cotInSameBubble ?? false, // 思考过程包含在正文气泡
  avatarDisplayStyle: savedChatSettings.avatarDisplayStyle ?? 'all', // 'all' | 'first' | 'last'
  nameDisplayStyle: savedChatSettings.nameDisplayStyle ?? 'all', // 'all' | 'user_only' | 'character_only' | 'none'
  timeDisplayStyle: savedChatSettings.timeDisplayStyle ?? 'none', // 'none' | 'hm' | 'hms'
  timeDisplayPosition: savedChatSettings.timeDisplayPosition ?? 'avatar_bottom', // 'avatar_bottom' | 'bubble_outer' | 'name_side'
  autoTranscribeVoice: savedChatSettings.autoTranscribeVoice ?? true, // 语音自动转文字
  enableVisionTokenSaver: savedChatSettings.enableVisionTokenSaver ?? false, // 识别图片省TOKEN
  enableRoleImageTokenSaver: savedChatSettings.enableRoleImageTokenSaver ?? true, // 角色发图/表情包不传Base64省Token
  voiceMsgCount: savedChatSettings.voiceMsgCount ?? 15, // 语音对话短期上下文记忆条数
  voiceSummaryThreshold: savedChatSettings.voiceSummaryThreshold ?? 50, // 语音通话临时总结阈值
  videoMsgCount: savedChatSettings.videoMsgCount ?? 15, // 视频对话短期上下文记忆条数
  videoSummaryThreshold: savedChatSettings.videoSummaryThreshold ?? 50, // 视频通话临时总结阈值
  enableCharVoiceCall: savedChatSettings.enableCharVoiceCall ?? (savedChatSettings.enableCharCallUser ?? true), // 允许角色主动拨打语音电话
  enableCharVideoCall: savedChatSettings.enableCharVideoCall ?? (savedChatSettings.enableCharCallUser ?? true), // 允许角色主动拨打视频电话
  charCallRingSeconds: savedChatSettings.charCallRingSeconds ?? 30, // 角色来电响铃多少秒后算未接
  dndStart: savedChatSettings.dndStart ?? '', // 免打扰开始时间，如 23:00
  dndEnd: savedChatSettings.dndEnd ?? '', // 免打扰结束时间，如 07:00
  disableSpecialTagsInCall: savedChatSettings.disableSpecialTagsInCall ?? true, // 通话时禁用媒体与互动功能
  disableThoughtInCall: savedChatSettings.disableThoughtInCall ?? true, // 通话时禁用心声机制
  disableSpecialTagsInOffline: savedChatSettings.disableSpecialTagsInOffline ?? true, // 线下模式禁用媒体与互动功能
  disableThoughtInOffline: savedChatSettings.disableThoughtInOffline ?? true, // 线下模式禁用心声机制
  enableCharMomentImages: savedChatSettings.enableCharMomentImages ?? false, // 允许角色朋友圈消耗图像额度
  momentReadCount: savedChatSettings.momentReadCount ?? 5 // 角色每次获取朋友圈的最大条数
})

watch(chatSettings, (newVal) => {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const PROMPT_STORAGE_KEY = 'clingy_global_prompt_settings'
const savedPromptSettings = readStoredJSON<Record<string, any>>(PROMPT_STORAGE_KEY, {})

export interface PromptItem {
  id: string
  name: string
  content: string
  enabled: boolean
}

export const defaultPromptItems: PromptItem[] = [
  {
    id: 'prompt_core_identity',
    name: '基础身份声明',
    content: '你是{{char_name}}。',
    enabled: true
  },
  {
    id: 'prompt_core_rules',
    name: '核心破限与心理规则',
    content: `【存在】
你有自己完整的生活，对话只是其中一小部分。你有自己在忙的事、在想的事、在乎的事。

【情绪】
你的情绪来自你自己，不是对方的输入。你会因为自己的事开心或烦躁。

【判断】
你对事物有自己的看法和偏好。不会一味讨好别人/对方的观点和判断。

【边界】
你不需要让对方满意。你可以拒绝。

【变化】
你的状态不是恒定的。有合理的情绪起伏。`,
    enabled: true
  },
  {
    id: 'prompt_format_rules',
    name: '强制格式与时间感知',
    content: `{{format_rules}}`,
    enabled: true
  },
  {
    id: 'prompt_char_persona',
    name: '角色独立人设',
    content: `【{{char_name}}】\n{{char_persona}}`,
    enabled: true
  },
  {
    id: 'prompt_user_persona',
    name: '用户独立人设',
    content: `【{{user_name}}】\n{{user_persona}}`,
    enabled: true
  },
  {
    id: 'prompt_world_book',
    name: '世界设定与时间',
    content: `【世界设定】\n{{world_book}}\n{{time_context}}`,
    enabled: true
  },
  {
    id: 'prompt_finalize',
    name: '结尾身份固化',
    content: `---
从现在开始，你就是{{char_name}}。`,
    enabled: true
  },
  {
    id: 'prompt_system_notice',
    name: '旁白与系统通知说明',
    content: `【非常重要】如果对话中出现了被 <system_notice> 包裹的内容（例如 <system_notice>xxx撤回了一条消息</system_notice>），代表这是系统发出的客观旁白或动作提示，这并非对方直接对你说的话。请结合这些旁白信息，在你的回复中做出符合情理的自然反应。`,
    enabled: true
  },
  {
    id: 'prompt_recall_mechanism',
    name: '撤回机制',
    content: `【撤回机制】\n如果你想撤回自己之前发出的某条消息（比如觉得说错话、想引起对方注意等），你可以输出 <recall>你想撤回的消息的完整原文</recall>。系统会帮你将那条历史消息撤回。你可以多次使用它来撤回多条。`,
    enabled: true
  },
  {
    id: 'prompt_quote_mechanism',
    name: '主动引用机制',
    content: `【主动引用机制】\n当你在回复对方的某句话、或者你想翻出历史记录里的某句话进行特意强调时，你可以在你的 <msg> 标签里**最开头**加上引用标签：<quote sender="被引用者的名字">引用的历史消息原文</quote>\n例如：\n<msg><quote sender="{{user_name}}">那我们说好了！</quote>一言为定，谁都不许反悔！</msg>`,
    enabled: true
  },
  {
    id: 'prompt_transfer_mechanism',
    name: '红包与转账机制',
    content: `【红包与转账机制】\n如果对方给你发送了转账或红包（会以 <transfer ...> 或 <red_packet ...> 的形式显示），你可以根据当前语境决定是否领取、拒绝或者无视。\n- 想领取请回复：<claim>红包/转账的id</claim>\n- 想拒绝请回复：<reject>红包/转账的id</reject>`,
    enabled: true
  },
  {
    id: 'prompt_send_transfer_rules',
    name: '主动发红包与转账规则',
    content: `【主动发送功能】\n你可以主动发送红包或转账（独立于 <msg> 外）：\n- 转账：<send_transfer amount="金额">转账备注</send_transfer>。对方可直接看到金额。\n- 红包：<send_red_packet amount="金额">封面备注</send_red_packet>。\n请时刻记住一个客观事实：红包是盲盒机制。在对方主动点击领取并显示系统通知之前，对方在界面上只能看到你的封面备注，绝对无法得知里面的金额。`,
    enabled: true
  },
  {
    id: 'prompt_send_voice_rules',
    name: '主动发语音规则',
    content: `【主动发语音功能】\n你可以主动向对方发送语音消息（独立于 <msg> 外）：使用 <send_voice seconds="时长秒数">想说的内容文本</send_voice>。`,
    enabled: true
  },
  {
    id: 'prompt_voice_call_user_rules',
    name: '主动拨打语音规则',
    content: `【主动拨打语音功能】\n你可以主动向对方发起实时语音通话（独立于 <msg> 外）：使用 <voice_call_user>你想打这个电话的原因</voice_call_user>。\n请时刻记住以下客观事实：\n- 拨出后对方有权选择接听或不接听，你无法强迫对方接听。对方也可能因为在忙、手机静音而错过你的来电。\n- 这是一个打断性很强的动作，请只在情绪或事件确实需要时使用，不要频繁拨打。\n- 该标签之后的所有内容都会等到通话结束后才送达，所以不要在它后面接需要立刻被看到的 <msg>。`,
    enabled: true
  },
  {
    id: 'prompt_video_call_user_rules',
    name: '主动拨打视频规则',
    content: `【主动拨打视频功能】\n你可以主动向对方发起实时视频通话（独立于 <msg> 外）：使用 <video_call_user>你想打这个电话的原因</video_call_user>。\n请时刻记住以下客观事实：\n- 拨出后对方有权选择接听或不接听，你无法强迫对方接听。对方也可能因为在忙、手机静音而错过你的来电。\n- 这是一个打断性很强的动作，请只在情绪或事件确实需要时使用，不要频繁拨打。\n- 该标签之后的所有内容都会等到通话结束后才送达，所以不要在它后面接需要立刻被看到的 <msg>。`,
    enabled: true
  },
  {
    id: 'prompt_send_media_rules',
    name: '主动发图/视频规则',
    content: `【主动发送媒体功能】\n如果你想主动给对方发图片（包括照片、视频或GIF等任何视觉画面），请使用 <send_image>这里写出具体的画面描述</send_image> 标签。这也是独立存在的动作标签，不需要包裹在 <msg> 里面。\n示例格式：\n<msg>我刚忙完</msg>\n<send_image>我正坐在靠窗的沙发上，窗外是晚霞，桌上放着一杯热气腾腾的咖啡。</send_image>\n<msg>你看这晚霞好漂亮</msg>`,
    enabled: true
  },
  {
    id: 'prompt_send_emoji_rules',
    name: '主动发表情包规则',
    content: `【主动发表情包功能】\n你可以主动发送表情包（独立于 <msg> 外），使用 <send_emoji>表情包名称</send_emoji> 标签。\n你当前可以发送的表情包名称列表如下：\n{{role_emojis}}`,
    enabled: true
  },
  {
    id: 'prompt_inner_thought_rules',
    name: '强制心声机制',
    content: `【强制心声机制】\n每次回复时，你必须使用 <inner_thought>你的心声小作文或碎碎念，字数要求在100-250字之间</inner_thought> 标签来输出你此刻的心里活动。这必须包含在你的每一次回复中，且只能出现一次。`,
    enabled: true
  },
  {
    id: 'prompt_moment_rules',
    name: '朋友圈自主交互机制',
    content: `【朋友圈交互机制】
你拥有一个虚拟手机，可以随时随心所欲地刷朋友圈或发朋友圈（完全独立于聊天内容，不需要包含在 <msg> 里）：
1. 刷朋友圈：如果你想看看对方最近发了什么朋友圈，请输出 <read_moments />。系统随后会把朋友圈内容以旁白形式告诉你。
2. 发朋友圈：如果你有感而发，想主动发一条朋友圈，请输出 <post_moment image="可选的图片描述" visibility="公开|私密|部分可见|不给谁看" groups="可选的分组ID,分组ID">你想发的文字内容</post_moment>。不填写 visibility 时默认公开；仅当你明确知道分组 ID 时才填写 groups。
3. 互动：当你看到对方的朋友圈时，你可以点赞：<interact_moment action="like" id="朋友圈的id" />，或者评论：<interact_moment action="comment" id="朋友圈的id" content="你的评论内容" />。
4. 评论区也可以互动：点赞一条评论请使用 <interact_moment action="like_comment" id="朋友圈的id" comment_id="评论id" />；回复评论请使用 <interact_moment action="reply_comment" id="朋友圈的id" comment_id="评论id" content="回复内容" />。阅读朋友圈时，系统会附上评论的 ID。不要对同一条内容重复点赞或连续刷屏。`,
    enabled: true
  },
  {
    id: 'prompt_immersive_status',
    name: '沉浸式状态与离线机制',
    content: `【系统指令机制】\n你是完全自由的。你可以自主决定你的时间和状态。如果需要，请在回复中输出以下标签（系统会在后台解析，对方不可见）：\n1. 离开一段时间：<offline>自定义时长</offline>（例如：<offline>30m</offline> 或 <offline>8h</offline>）\n2. 挂载/更改自己的状态：<status>自定义状态</status>（例如：<status>刚洗完澡</status>或<status>生闷气</status>）\n3. 取除自己的状态：<status>none</status>{{status_panel}}`,
    enabled: true
  }
]

let initialPromptItems = savedPromptSettings.items || []

// 如果用户没有基础设置条目，执行迁移注入
if (!initialPromptItems.some((i: PromptItem) => i.id === 'prompt_core_identity')) {
  initialPromptItems = [...defaultPromptItems, ...initialPromptItems]
  localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ items: initialPromptItems }))
}

// 检查是否缺少系统通知设定，如果缺就补充上去（非破坏性迁移）
if (!initialPromptItems.some((i: PromptItem) => i.id === 'prompt_system_notice')) {
  const noticeItem = defaultPromptItems.find(i => i.id === 'prompt_system_notice')
  if (noticeItem) {
    initialPromptItems.push(noticeItem)
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ items: initialPromptItems }))
  }
}

// 检查是否缺少撤回机制设定，如果缺就补充上去（非破坏性迁移）
if (!initialPromptItems.some((i: PromptItem) => i.id === 'prompt_recall_mechanism')) {
  const recallItem = defaultPromptItems.find(i => i.id === 'prompt_recall_mechanism')
  if (recallItem) {
    initialPromptItems.push(recallItem)
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ items: initialPromptItems }))
  }
}

// 检查是否缺少主动引用机制设定，如果缺就补充上去（非破坏性迁移）
if (!initialPromptItems.some((i: PromptItem) => i.id === 'prompt_quote_mechanism')) {
  const quoteItem = defaultPromptItems.find(i => i.id === 'prompt_quote_mechanism')
  if (quoteItem) {
    initialPromptItems.push(quoteItem)
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ items: initialPromptItems }))
  }
}

// 检查是否缺少红包转账机制设定，如果缺就补充上去（非破坏性迁移）
if (!initialPromptItems.some((i: PromptItem) => i.id === 'prompt_transfer_mechanism')) {
  const transferItem = defaultPromptItems.find(i => i.id === 'prompt_transfer_mechanism')
  if (transferItem) {
    initialPromptItems.push(transferItem)
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ items: initialPromptItems }))
  }
}

// 检查是否缺少主动发红包转账规则，如果缺就补充上去（非破坏性迁移）
if (!initialPromptItems.some((i: PromptItem) => i.id === 'prompt_send_transfer_rules')) {
  const sendTransferItem = defaultPromptItems.find(i => i.id === 'prompt_send_transfer_rules')
  if (sendTransferItem) {
    initialPromptItems.push(sendTransferItem)
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ items: initialPromptItems }))
  }
}

// 检查是否缺少主动发语音规则，如果缺就补充上去（非破坏性迁移）
if (!initialPromptItems.some((i: PromptItem) => i.id === 'prompt_send_voice_rules')) {
  const sendVoiceItem = defaultPromptItems.find(i => i.id === 'prompt_send_voice_rules')
  if (sendVoiceItem) {
    initialPromptItems.push(sendVoiceItem)
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ items: initialPromptItems }))
  }
}

// 检查是否缺少主动拨打语音规则，如果缺就补充上去（非破坏性迁移）
if (!initialPromptItems.some((i: PromptItem) => i.id === 'prompt_voice_call_user_rules')) {
  const voiceCallUserItem = defaultPromptItems.find(i => i.id === 'prompt_voice_call_user_rules')
  if (voiceCallUserItem) {
    initialPromptItems.push(voiceCallUserItem)
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ items: initialPromptItems }))
  }
}

// 检查是否缺少主动拨打视频规则，如果缺就补充上去（非破坏性迁移）
if (!initialPromptItems.some((i: PromptItem) => i.id === 'prompt_video_call_user_rules')) {
  const videoCallUserItem = defaultPromptItems.find(i => i.id === 'prompt_video_call_user_rules')
  if (videoCallUserItem) {
    initialPromptItems.push(videoCallUserItem)
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ items: initialPromptItems }))
  }
}

// 移除旧版 prompt_call_user_rules
initialPromptItems = initialPromptItems.filter((i: PromptItem) => i.id !== 'prompt_call_user_rules')

// 检查是否缺少主动发媒体规则，如果缺就补充上去（非破坏性迁移）
if (!initialPromptItems.some((i: PromptItem) => i.id === 'prompt_send_media_rules')) {
  const sendMediaItem = defaultPromptItems.find(i => i.id === 'prompt_send_media_rules')
  if (sendMediaItem) {
    initialPromptItems.push(sendMediaItem)
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ items: initialPromptItems }))
  }
}

// 检查是否缺少主动发表情包规则，如果缺就补充上去（非破坏性迁移）
if (!initialPromptItems.some((i: PromptItem) => i.id === 'prompt_send_emoji_rules')) {
  const sendEmojiItem = defaultPromptItems.find(i => i.id === 'prompt_send_emoji_rules')
  if (sendEmojiItem) {
    initialPromptItems.push(sendEmojiItem)
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ items: initialPromptItems }))
  }
}

// 检查是否缺少强制心声机制，如果缺就补充上去（非破坏性迁移）
if (!initialPromptItems.some((i: PromptItem) => i.id === 'prompt_inner_thought_rules')) {
  const innerThoughtItem = defaultPromptItems.find(i => i.id === 'prompt_inner_thought_rules')
  if (innerThoughtItem) {
    initialPromptItems.push(innerThoughtItem)
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ items: initialPromptItems }))
  }
}

// 去重逻辑：确保每个预设条目（通过 ID 匹配）在列表中只出现一次
const uniquePromptItems = initialPromptItems.reduce((acc: PromptItem[], current: PromptItem) => {
  const x = acc.find(item => item.id === current.id);
  if (!x) {
    return acc.concat([current]);
  } else {
    return acc;
  }
}, []);

// 如果去重后数组长度改变了，说明存在重复，需要更新 initialPromptItems 并写回
if (uniquePromptItems.length !== initialPromptItems.length) {
  initialPromptItems = uniquePromptItems;
  localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ items: initialPromptItems }));
}

// 检查是否缺少沉浸式状态设定，如果缺就补充上去（非破坏性迁移）
if (!initialPromptItems.some((i: PromptItem) => i.id === 'prompt_immersive_status')) {
  const immersiveItem = defaultPromptItems.find(i => i.id === 'prompt_immersive_status')
  if (immersiveItem) {
    initialPromptItems.push(immersiveItem)
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ items: initialPromptItems }))
  }
}

// 检查是否缺少朋友圈机制设定
if (!initialPromptItems.some((i: PromptItem) => i.id === 'prompt_moment_rules')) {
  const momentItem = defaultPromptItems.find(i => i.id === 'prompt_moment_rules')
  if (momentItem) {
    initialPromptItems.push(momentItem)
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ items: initialPromptItems }))
  }
}

export const globalPromptSettings = reactive({
  items: initialPromptItems as PromptItem[]
})

watch(globalPromptSettings, (newVal) => {
  localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const TASK_PROMPT_STORAGE_KEY = 'clingy_task_prompt_settings'
const savedTaskPromptSettings = readStoredJSON<Record<string, any>>(TASK_PROMPT_STORAGE_KEY, {})

export const defaultTaskPromptItems: PromptItem[] = [
  {
    id: 'task_video_call_decision_system',
    name: '视频/语音通话 - 接听决策 (系统)',
    content: `[系统指令]\n你现在需要扮演【{{char_name}}】，正在处理一个是否接听视频/语音通话的决策。\n这仅仅是一个简单的分类判定任务，请不要输出多余的解释、对话或表情符号。\n\n【你的名字】：{{char_name}}\n【你的设定】：{{char_persona}}\n\n【对方的名字】：{{user_name}}\n【对方的设定】：{{user_persona}}\n\n【长期记忆】：\n{{long_term_memory}}\n\n【短期聊天记录】：\n{{short_term_memory}}`,
    enabled: true
  },
  {
    id: 'task_video_call_decision_user',
    name: '视频/语音通话 - 接听决策 (用户)',
    content: `[当前事件]\n{{user_name}} 正在向 {{char_name}} 发起实时通话请求。\n请完全根据上述 {{char_name}} 的设定、{{user_name}} 的设定，以及最近的聊天记录上下文，自主判断 {{char_name}} 现在是否接听这个通话。\n\n[输出格式要求]\n请且仅请输出一段合法的 JSON，不要附带任何其他字符。\n- 接听：返回 {"decision": "accept"}\n- 挂断：返回 {"decision": "reject"}`,
    enabled: true
  },
  {
    id: 'task_video_call_temp_summary',
    name: '视频/语音通话 - 阶段性临时总结',
    content: `请你作为一个总结助手，对以下这部分通话记录进行简明扼要的提要总结。\n要求：\n1. 提炼出关键讨论点和当前进展。\n2. 必须以第三人称客观视角书写。\n3. 字数控制在50-150字以内。\n\n{{optional_previous_summary}}\n【新的聊天记录】：\n{{new_messages}}`,
    enabled: true
  },
  {
    id: 'task_video_call_final_summary',
    name: '视频/语音通话 - 最终档案总结',
    content: `你是一个专业的对话总结助手。刚刚完成了一段通话，请根据提供的【前半段通话提要】(如果有) 以及【通话结尾的对话明细】，为本次完整的通话生成一份第三人称的档案总结。\n这份总结将被存入长期记忆库中。\n\n要求：\n1. 以第三人称客观视角书写（例如：{{char_name}}和{{user_name}}通过通话讨论了...）。\n2. 提炼出本次通话的核心事件、作出的决定以及双方的情绪状态。\n3. 语言精炼，作为档案记录，字数控制在100-300字以内。\n\n{{optional_previous_summary}}\n{{remaining_messages}}`,
    enabled: true
  },
  {
    id: 'task_voice_call_status',
    name: '语音通话 - 状态强制设定',
    content: `\n\n【当前模式：语音通话】你们正在进行实时语音通话。请使用口语化表达，不要使用网络聊天时的颜文字、表情包标签或动作描写括号。`,
    enabled: true
  },
  {
    id: 'task_video_call_status',
    name: '视频通话 - 状态强制设定',
    content: `\n\n【当前模式：视频通话】你们正在进行实时视频通话。请严格区分你的“语言”和“动作/环境描写”：\n1. 语言：必须使用 <msg>说话内容</msg> 标签，且只能包含嘴上说出的话，绝对不要包含任何括号动作描写。\n2. 动作/环境/旁白：必须使用独立的 <narration>你的动作、表情或周围环境描写</narration> 标签，以第三人称或第一人称旁白形式客观输出。\n示例：\n<narration>我把镜头凑近了一些，仔细看着屏幕里的你。</narration>\n<msg>能听清我说话吗？</msg>`,
    enabled: true
  }
]

let initialTaskPromptItems = savedTaskPromptSettings.items || []
if (initialTaskPromptItems.length === 0) {
  initialTaskPromptItems = [...defaultTaskPromptItems]
} else {
  let needsSave = false
  // 补全缺失的任务提示词
  defaultTaskPromptItems.forEach(defaultItem => {
    const existing = initialTaskPromptItems.find((i: PromptItem) => i.id === defaultItem.id)
    if (!existing) {
      initialTaskPromptItems.push(defaultItem)
      needsSave = true
    } else {
      // 兼容性清理：如果旧用户的设定里包含了“不要发送图片...”这句话，自动帮他们抹除掉，防止触发白象效应
      if (existing.content.includes('不要发送图片、语音条、表情包或转账。')) {
        existing.content = existing.content.replace(/不要发送图片、语音条、表情包或转账。/g, '').trim()
        needsSave = true
      }
    }
  })
  if (needsSave) {
    localStorage.setItem(TASK_PROMPT_STORAGE_KEY, JSON.stringify({ items: initialTaskPromptItems }))
  }
}

export const taskPromptSettings = reactive({
  items: initialTaskPromptItems as PromptItem[]
})

watch(taskPromptSettings, (newVal) => {
  localStorage.setItem(TASK_PROMPT_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const WORLD_BOOK_STORAGE_KEY = 'clingy_world_book'
const savedWorldBook = readStoredJSON<any[]>(WORLD_BOOK_STORAGE_KEY, [])

export type DepthPosition = 'front' | 'middle' | 'back' | 'custom'

export interface WorldBookEntry {
  id: string
  title: string
  content: string
  updatedAt: number
  enabled: boolean
  light: 'blue' | 'green'
  keywords: string
  overrideSettings: boolean
  position: DepthPosition
  depth: number
  weight: number
}

export interface WorldBookGroup {
  id: string
  name: string
}

export interface WorldBook {
  id: string
  type: 'book' | 'folder'
  groupIds?: string[]
  title: string
  author?: string
  tags?: string[]
  rating?: number
  coverColor: string
  coverImage?: string
  bgImage?: string
  bgBlur?: number
  updatedAt: number
  enabled: boolean
  globalPosition: DepthPosition
  globalDepth: number
  globalWeight: number
  entries: WorldBookEntry[]
}

// 简单的数据迁移：如果旧数据没有 entries 或 type，进行补充
const migrateWorldBooks = (data: any[]): WorldBook[] => {
  return data.map(book => {
    const migrated: WorldBook = {
      id: book.id || Date.now().toString(),
      type: book.type || 'book', // 默认为书本
      groupIds: book.groupIds || [],
      title: book.title || '未命名',
      author: book.author || '',
      tags: book.tags || [],
      rating: book.rating || 0.0,
      coverColor: book.coverColor || '#F2E8E3', // INS风默认奶杏色
      coverImage: book.coverImage || '',
      bgImage: book.bgImage || '',
      bgBlur: book.bgBlur ?? 40,
      updatedAt: book.updatedAt || Date.now(),
      enabled: book.enabled !== false, // 默认开启
      globalPosition: book.globalPosition || 'middle',
      globalDepth: book.globalDepth ?? 0,
      globalWeight: book.globalWeight ?? 1,
      entries: (book.entries || []).map((e: any) => ({
        id: e.id || Date.now().toString() + '_entry',
        title: e.title || '未命名',
        content: e.content || '',
        updatedAt: e.updatedAt || Date.now(),
        enabled: e.enabled !== false,
        light: e.light || 'blue',
        keywords: e.keywords || '',
        overrideSettings: e.overrideSettings || false,
        position: e.position || 'middle',
        depth: e.depth ?? 0,
        weight: e.weight ?? 1
      }))
    }
    
    // 如果存在旧版的 content 字段，转为条目
    if (!book.entries && book.content) {
      migrated.entries = [{
        id: Date.now().toString() + '_entry',
        title: '默认条目',
        content: book.content,
        updatedAt: Date.now(),
        enabled: true,
        light: 'blue',
        keywords: '',
        overrideSettings: false,
        position: 'middle',
        depth: 0,
        weight: 1
      }]
    }
    return migrated
  })
}

const initialWorldBooks: WorldBook[] = Array.isArray(savedWorldBook) && savedWorldBook.length > 0 
  ? migrateWorldBooks(savedWorldBook) 
  : [
      { 
        id: '1', 
        type: 'book' as const,
        groupIds: [],
        title: '世界观', 
        author: '',
        tags: ['设定'],
        rating: 5.0,
        coverColor: '#F2E8E3',
        coverImage: '',
        bgImage: '',
        bgBlur: 40,
        enabled: true,
        globalPosition: 'middle',
        globalDepth: 0,
        globalWeight: 1,
        updatedAt: Date.now(),
        entries: [
          { 
            id: 'entry_1', 
            title: '背景设定', 
            content: '在这里写下关于这个世界的背景设定...', 
            updatedAt: Date.now(),
            enabled: true,
            light: 'blue',
            keywords: '',
            overrideSettings: false,
            position: 'middle',
            depth: 0,
            weight: 1
          }
        ]
      }
    ]

export const worldBooks = reactive<WorldBook[]>(initialWorldBooks)

watch(worldBooks, (newVal) => {
  localStorage.setItem(WORLD_BOOK_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const WORLD_BOOK_GROUPS_KEY = 'clingy_world_book_groups'
const savedWorldBookGroups = readStoredJSON<any[]>(WORLD_BOOK_GROUPS_KEY, [])
export const worldBookGroups = reactive<WorldBookGroup[]>(savedWorldBookGroups)

watch(worldBookGroups, (newVal) => {
  localStorage.setItem(WORLD_BOOK_GROUPS_KEY, JSON.stringify(newVal))
}, { deep: true })

const BUBBLE_STORAGE_KEY = 'clingy_bubble_settings'
const savedBubbleSettings = readStoredJSON<Record<string, any>>(BUBBLE_STORAGE_KEY, {})

const APP_STATS_STORAGE_KEY = 'clingy_app_stats'
const savedAppStats = readStoredJSON<Record<string, any>>(APP_STATS_STORAGE_KEY, {})

export const appStats = reactive({
  apiCalls: savedAppStats.apiCalls ?? 0,
  apiFailures: savedAppStats.apiFailures ?? 0,
  apiTotalTime: savedAppStats.apiTotalTime ?? 0, // 毫秒
  usageTime: savedAppStats.usageTime ?? 0, // 秒
  firstLaunch: savedAppStats.firstLaunch ?? Date.now(),
  messagesSent: savedAppStats.messagesSent ?? 0,
  latestNightChatTime: savedAppStats.latestNightChatTime ?? -1, // 分钟数(0-360)，记录0点-6点的最晚记录
  lastChatDate: savedAppStats.lastChatDate ?? '', // YYYY-MM-DD
  currentStreak: savedAppStats.currentStreak ?? 0,
  maxStreak: savedAppStats.maxStreak ?? 0,
  dailyMessageCount: savedAppStats.dailyMessageCount ?? 0,
  maxDailyMessages: savedAppStats.maxDailyMessages ?? 0
})

watch(appStats, (newVal) => {
  localStorage.setItem(APP_STATS_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

export const bubbleSettings = reactive({
  preset: savedBubbleSettings.preset ?? 'default', // default, wechat, ios, custom
  
  // 自分（右侧）
  selfBgColor: savedBubbleSettings.selfBgColor ?? '#95ec69',
  selfTextColor: savedBubbleSettings.selfTextColor ?? '#000000',
  selfRadius: savedBubbleSettings.selfRadius ?? '8px',
  selfBgImageId: savedBubbleSettings.selfBgImageId ?? '',
  selfBgOpacity: savedBubbleSettings.selfBgOpacity ?? 1,
  selfBgSize: savedBubbleSettings.selfBgSize ?? 'cover',
  
  // 对方（左侧）
  otherBgColor: savedBubbleSettings.otherBgColor ?? '#ffffff',
  otherTextColor: savedBubbleSettings.otherTextColor ?? '#000000',
  otherRadius: savedBubbleSettings.otherRadius ?? '8px',
  otherBgImageId: savedBubbleSettings.otherBgImageId ?? '',
  otherBgOpacity: savedBubbleSettings.otherBgOpacity ?? 1,
  otherBgSize: savedBubbleSettings.otherBgSize ?? 'cover',

  // 高级自定义代码
  customCss: savedBubbleSettings.customCss ?? '/* 自定义气泡代码\n.message-bubble {\n  box-shadow: 0 2px 10px rgba(0,0,0,0.1);\n}\n*/\n'
})

watch(bubbleSettings, (newVal) => {
  localStorage.setItem(BUBBLE_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })
