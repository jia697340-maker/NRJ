/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, watch } from 'vue'
import { readStoredJSON } from './utils'
import { loadOfflinePresetSettings, OFFLINE_PRESET_STORAGE_KEY, serializeOfflinePresetSettings } from '../services/offlinePresets'

const CHAT_STORAGE_KEY = 'clingy_chat_settings'
const savedChatSettings = readStoredJSON<Record<string, any>>(CHAT_STORAGE_KEY, {})

export const chatSettings = reactive({
  theme: 'minimal', // 强制只使用极简主题
  showTopBarContextMenu: savedChatSettings.showTopBarContextMenu ?? true,
  enableGlobalNotification: savedChatSettings.enableGlobalNotification ?? true,
  enableNotificationInChat: savedChatSettings.enableNotificationInChat ?? false,
  notificationStyle: savedChatSettings.notificationStyle ?? 'queue', // 'queue' | 'list' | 'stack'
  enableFriendRequestNotification: savedChatSettings.enableFriendRequestNotification ?? true, // 是否开启好友申请通知
  friendRequestNotificationStyle: savedChatSettings.friendRequestNotificationStyle ?? 'modal', // 'banner' (方案A: 顶部横幅) | 'modal' (方案B: 居中弹窗)
  transferStyle: savedChatSettings.transferStyle ?? 'wechat', // 'wechat' | 'ticket' | 'glass'
  cotInSameBubble: savedChatSettings.cotInSameBubble ?? false, // 思考过程包含在正文气泡
  avatarDisplayStyle: savedChatSettings.avatarDisplayStyle ?? 'all', // 'all' | 'first' | 'last'
  nameDisplayStyle: savedChatSettings.nameDisplayStyle ?? 'all', // 'all' | 'user_only' | 'character_only' | 'none'
  timeDisplayStyle: savedChatSettings.timeDisplayStyle ?? 'none', // 'none' | 'hm' | 'hms'
  timeDisplayPosition: savedChatSettings.timeDisplayPosition ?? 'avatar_bottom', // 'avatar_bottom' | 'bubble_outer' | 'name_side'
  showSystemNarration: savedChatSettings.showSystemNarration ?? false, // 显示仅供模型衔接上下文的系统内部旁白
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
  innerThoughtLimit: savedChatSettings.innerThoughtLimit ?? 50, // 心声存储上限
  enableCharMomentImages: savedChatSettings.enableCharMomentImages ?? false, // 允许角色朋友圈消耗图像额度
  momentReadCount: savedChatSettings.momentReadCount ?? 5 // 角色每次获取朋友圈的最大条数
})

watch(chatSettings, (newVal) => {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const initialOfflinePresetSettings = loadOfflinePresetSettings()

export const offlinePresetSettings = reactive(initialOfflinePresetSettings)

watch(offlinePresetSettings, (newVal) => {
  localStorage.setItem(OFFLINE_PRESET_STORAGE_KEY, JSON.stringify(serializeOfflinePresetSettings(newVal)))
}, { deep: true })

const BUBBLE_STORAGE_KEY = 'clingy_bubble_settings'
const savedBubbleSettings = readStoredJSON<Record<string, any>>(BUBBLE_STORAGE_KEY, {})

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
