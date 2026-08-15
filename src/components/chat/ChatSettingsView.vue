/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useChatState } from '../../composables/useChatState'
import { useChatTokenStats } from '../../composables/useChatTokenStats'
import ChatEmojiView from './ChatEmojiView.vue'
import { chatSettings } from '../../store'
import localforage from 'localforage'
import AvatarUploadModal from '../AvatarUploadModal.vue'
import TextEditModal from '../TextEditModal.vue'
import LongTextEditModal from '../LongTextEditModal.vue'
import ChatSummaryView from './ChatSummaryView.vue'
import ChatTimezoneModal from './modals/ChatTimezoneModal.vue'
import ChatTokenStatsModal from './modals/ChatTokenStatsModal.vue'
import ChatWorldBookBindModal from './modals/ChatWorldBookBindModal.vue'
import ChatTransferPreviewModal from './modals/ChatTransferPreviewModal.vue'
import { useTimezone } from '../../composables/useTimezone'
import { useChatAuth } from '../../composables/useChatAuth'
import ChatBubbleBeautifyModal from './modals/ChatBubbleBeautifyModal.vue'
import ChatAvatarDisplayModal from './modals/ChatAvatarDisplayModal.vue'
import ChatNameDisplayModal from './modals/ChatNameDisplayModal.vue'
import ChatTimeDisplayModal from './modals/ChatTimeDisplayModal.vue'
import {
  applyUserProfileToChat,
  updateStoredPersona,
  type ChatUserProfileSnapshot
} from '../../composables/useChatUserProfiles'

import { useChatSettingsSave } from '../../composables/useChatSettingsSave'
import { useChatSummary } from '../../composables/useChatSummary'
import ChatSettingsSearchBar from './settings/ChatSettingsSearchBar.vue'
import ChatSettingsTabs from './settings/ChatSettingsTabs.vue'
import ChatSettingsPanelDerived from './settings/ChatSettingsPanelDerived.vue'
import ChatSettingsPanelRole from './settings/ChatSettingsPanelRole.vue'
import ChatSettingsPanelAppearance from './settings/ChatSettingsPanelAppearance.vue'
import ChatSettingsPanelGeneral from './settings/ChatSettingsPanelGeneral.vue'
import ChatSettingsPanelUser from './settings/ChatSettingsPanelUser.vue'

import ChatMemoryTypeModal from './modals/ChatMemoryTypeModal.vue'
import ChatMemoryValueModal from './modals/ChatMemoryValueModal.vue'
import ChatMsgCountModal from './modals/ChatMsgCountModal.vue'
import ChatVoiceModelModal from './modals/ChatVoiceModelModal.vue'
import ChatVoiceDetailModal from './modals/ChatVoiceDetailModal.vue'
import ChatVoiceLanguageModal from './modals/ChatVoiceLanguageModal.vue'
import ChatVoiceEmotionModal from './modals/ChatVoiceEmotionModal.vue'
import ChatBilingualOptionModal from './modals/ChatBilingualOptionModal.vue'
import ChatDialogueLanguageModal from './modals/ChatDialogueLanguageModal.vue'
import ChatClearHistoryModal from './modals/ChatClearHistoryModal.vue'
import ChatNAIImageDetailModal from './modals/ChatNAIImageDetailModal.vue'
import ChatGptImageDetailModal from './modals/ChatGptImageDetailModal.vue'
import ChatGeminiImageDetailModal from './modals/ChatGeminiImageDetailModal.vue'
import ChatFluxImageDetailModal from './modals/ChatFluxImageDetailModal.vue'
import ChatNijiImageDetailModal from './modals/ChatNijiImageDetailModal.vue'
import ChatSeedreamImageDetailModal from './modals/ChatSeedreamImageDetailModal.vue'
import ChatImageProviderModal from './modals/ChatImageProviderModal.vue'
import ChatIdentityProfileModal from './modals/ChatIdentityProfileModal.vue'

const searchQuery = ref('')
const matchSearch = (...keywords: (string | undefined | null)[]) => {
  if (!searchQuery.value.trim()) return true
  const query = searchQuery.value.trim().toLowerCase()
  return keywords.some(k => k && String(k).toLowerCase().includes(query))
}

// 获取或者初始化 IndexedDB 存储
const wallpaperStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'chatWallpapers'
})

const mediaThumbStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'mediaThumbs'
})

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'open-avatar-upload', target: 'contact' | 'me'): void
  (e: 'open-persona-select'): void
  (e: 'use-account-persona'): void
  (e: 'create-user-persona'): void
  (e: 'open-offline-meet'): void
  (e: 'open-relationship'): void
  (e: 'open-autonomy'): void
  (e: 'open-character-profile'): void
}>()

const { selectedChat, myProfile, effectiveMyProfile, mockChats, loadMyProfile, saveMyProfile } = useChatState()
const { currentChatUserId } = useChatAuth()
const identityUserOwnerId = computed(() => selectedChat.value?.userProfileSource?.personaId
  ? `persona-${selectedChat.value.userProfileSource.personaId}`
  : (currentChatUserId.value || 'default-user'))
const { saveCurrentChat } = useChatSettingsSave()
const { tokenStats, refreshTokenStats } = useChatTokenStats()
const { getTimezoneLabel } = useTimezone()

// --- 时区相关逻辑 ---
const showTimezoneModal = ref(false)
const currentSelectingTarget = ref<'user' | 'character'>('user')

const openTimezoneModal = (target: 'user' | 'character') => {
  currentSelectingTarget.value = target
  showTimezoneModal.value = true
}

const handleSelectTimezone = (tzId: string) => {
  if (currentSelectingTarget.value === 'user') {
    myProfile.value.timezone = tzId
    saveMyProfile()
    updateCharacterTime()
  } else {
    if (selectedChat.value) {
      selectedChat.value.timezone = tzId
      saveCurrentChat()
    }
  }
  showTimezoneModal.value = false
}

// 实时计算角色当前时间
const characterCurrentTime = ref('')
const userCurrentTime = ref('')
let characterTimer: any = null

const updateCharacterTime = () => {
  if (!selectedChat.value) return
  const tz = selectedChat.value.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  try {
    const dtf = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    characterCurrentTime.value = dtf.format(new Date())
  } catch (e) {
    characterCurrentTime.value = '--:--'
  }

  const userTimezone = myProfile.value.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  try {
    userCurrentTime.value = new Intl.DateTimeFormat('zh-CN', {
      timeZone: userTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date())
  } catch {
    userCurrentTime.value = '--:--'
  }
}

onMounted(() => {
  updateCharacterTime()
  refreshTokenStats()
  characterTimer = setInterval(updateCharacterTime, 10000) // 每10秒更新一次
})

onUnmounted(() => {
  if (characterTimer) clearInterval(characterTimer)
})

const chatSettingCategories = ['角色', '用户', '通用', '美化', '衍生']
const activeChatSettingCategory = ref(localStorage.getItem('clingy_chat_setting_tab') || '角色')

const handleTabChange = (cat: string) => {
  activeChatSettingCategory.value = cat
  localStorage.setItem('clingy_chat_setting_tab', cat)
}

const currentChatWallpaper = ref<string | null>(null)
const showWallpaperModal = ref(false)

const showBubbleBeautifyModal = ref(false)
const showAvatarDisplayModal = ref(false)
const showNameDisplayModal = ref(false)
const showTimeDisplayModal = ref(false)

const showModelModal = ref(false)
const showVoiceModal = ref(false)
const showLanguageModal = ref(false)
const showEmotionModal = ref(false)
const showBilingualOptionModal = ref(false)
const bilingualOptionKind = ref<'mode' | 'display'>('mode')
const showBilingualLanguageModal = ref(false)
const bilingualLanguageKind = ref<'output' | 'translation'>('output')
const isFetchingVoices = ref(false)
const fetchedVoices = ref<{id: string, name: string}[]>([])

const modelOptions = [
  'speech-2.8-hd',
  'speech-2.8-turbo',
  'speech-2.6-hd',
  'speech-2.6-turbo',
  'speech-01-hd',
  'speech-01-turbo'
]

const showVoiceDetailModal = ref(false)
const showNAIImageDetailModal = ref(false)
const showGptImageDetailModal = ref(false)
const showGeminiImageDetailModal = ref(false)
const showFluxImageDetailModal = ref(false)
const showNijiImageDetailModal = ref(false)
const showSeedreamImageDetailModal = ref(false)
const showImageProviderModal = ref(false)
const showIdentityProfileModal = ref(false)
const identityProfileTarget = ref<'character' | 'user'>('character')
const openIdentityProfile = (target: 'character' | 'user') => {
  identityProfileTarget.value = target
  showIdentityProfileModal.value = true
}

const presetVoices = [
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

const selectLanguage = (val: string) => {
  if (selectedChat.value) {
    selectedChat.value.voiceLanguage = val
    saveCurrentChat()
  }
  showLanguageModal.value = false
}

const selectEmotion = (val: string) => {
  if (selectedChat.value) {
    selectedChat.value.voiceEmotion = val
    saveCurrentChat()
  }
  showEmotionModal.value = false
}

const bilingualOptionTitle = computed(() => bilingualOptionKind.value === 'mode' ? '选择语言控制模式' : '选择翻译显示方式')
const bilingualOptionValue = computed(() => bilingualOptionKind.value === 'mode'
  ? (selectedChat.value?.bilingualMode || 'auto')
  : (selectedChat.value?.translationDisplay || 'tap'))
const bilingualOptionChoices = computed(() => bilingualOptionKind.value === 'mode'
  ? [
      { value: 'auto', label: '智能判断', description: '根据角色人设和当前语境自然决定语言' },
      { value: 'forced', label: '强制指定', description: '始终使用指定的角色输出语言' },
      { value: 'follow_user', label: '跟随用户', description: '跟随用户最近一条消息的主要语言' }
    ]
  : [
      { value: 'tap', label: '点击后显示', description: '默认显示原文，点击后展开译文' },
      { value: 'always', label: '始终显示', description: '在原文下方始终展示译文' },
      { value: 'translated_only', label: '仅显示译文', description: '界面隐藏原文，但仍保留原文数据' },
      { value: 'original_only', label: '仅显示原文', description: '保留译文数据但不在气泡中显示' }
    ])

const openBilingualOptionModal = (kind: 'mode' | 'display') => {
  bilingualOptionKind.value = kind
  showBilingualOptionModal.value = true
}

const selectBilingualOption = (value: string) => {
  if (!selectedChat.value) return
  if (bilingualOptionKind.value === 'mode') {
    selectedChat.value.bilingualMode = value
    if (value === 'forced' && ['auto', 'follow_user'].includes(selectedChat.value.dialogueLanguage || 'auto')) {
      selectedChat.value.dialogueLanguage = 'en'
    }
  } else {
    selectedChat.value.translationDisplay = value
  }
  saveCurrentChat()
}

const openBilingualLanguageModal = (kind: 'output' | 'translation') => {
  bilingualLanguageKind.value = kind
  showBilingualLanguageModal.value = true
}

const selectBilingualLanguage = (payload: { value: string; customLanguage?: string }) => {
  if (!selectedChat.value) return
  if (bilingualLanguageKind.value === 'output') {
    selectedChat.value.dialogueLanguage = payload.value
    if (payload.customLanguage !== undefined) selectedChat.value.customDialogueLanguage = payload.customLanguage
    if (payload.value === 'auto') selectedChat.value.bilingualMode = 'auto'
    else if (payload.value === 'follow_user') selectedChat.value.bilingualMode = 'follow_user'
  } else {
    selectedChat.value.translationLanguage = payload.value
    if (payload.customLanguage !== undefined) selectedChat.value.customTranslationLanguage = payload.customLanguage
    if (payload.value === 'off' && selectedChat.value.translationDisplay === 'translated_only') {
      selectedChat.value.translationDisplay = 'original_only'
    }
  }
  saveCurrentChat()
}

const selectModel = (m: string) => {
  if (selectedChat.value) {
    selectedChat.value.voiceModel = m
    saveCurrentChat()
  }
  showModelModal.value = false
}

const selectVoice = (id: string) => {
  if (selectedChat.value) {
    selectedChat.value.voiceId = id
    saveCurrentChat()
  }
  showVoiceModal.value = false
}

const selectImageProvider = (provider: string) => {
  if (selectedChat.value) {
    selectedChat.value.imageGenProvider = provider
    saveCurrentChat()
  }
  showImageProviderModal.value = false
}

const fetchCustomVoices = async () => {
  const saved = localStorage.getItem('minimax_voice_config_v4')
  let apiKey = ''
  let region = 'global'
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      apiKey = parsed.apiKey || ''
      region = parsed.region || 'global'
    } catch(e) {}
  }

  if (!apiKey) {
    showToast('请先在应用主页右上角配置语音引擎的 API Key')
    return
  }
  isFetchingVoices.value = true
  try {
    const baseUrl = region === 'china' ? 'https://api.minimaxi.com' : 'https://api.minimax.io'
    const url = `${baseUrl}/v1/voice`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })
    if (!res.ok) {
      throw new Error(`获取失败 (${res.status})`)
    }
    const data = await res.json()
    if (data.voices && Array.isArray(data.voices)) {
      fetchedVoices.value = data.voices.map((v: any) => ({
        id: v.voice_id,
        name: v.voice_name || '自定义音色'
      }))
      if (fetchedVoices.value.length === 0) {
        showToast('当前账号暂无自定义音色')
      } else {
        showToast('获取成功')
      }
    } else {
      throw new Error('解析列表失败')
    }
  } catch (e: any) {
    showToast(e.message || '获取自定义音色失败')
  } finally {
    isFetchingVoices.value = false
  }
}

const currentMediaThumb = ref<string | null>(null)
const showMediaThumbModal = ref(false)

// 默认总结提示词
const defaultSummaryPrompt = `优先保留明确的时间、事件、人物、喜好、边界、承诺、情绪变化和关系发展。尤其注意【重要标记】，但不得把猜测写成事实。`

// 组件挂载时或者聊天对象改变时加载专属壁纸与缩略图
const loadAssets = async () => {
  if (selectedChat.value?.id) {
    if (!selectedChat.value.summaryPrompt) {
      selectedChat.value.summaryPrompt = defaultSummaryPrompt
    }
    try {
      const wallpaperStr = await wallpaperStore.getItem<string>(`wallpaper_${selectedChat.value.id}`)
      currentChatWallpaper.value = wallpaperStr || null
      
      const thumbStr = await mediaThumbStore.getItem<string>(`thumb_${selectedChat.value.id}`)
      currentMediaThumb.value = thumbStr || null
    } catch (e) {
      console.error('Failed to load assets', e)
    }
  }
}

// 初次加载和监听选中的聊天变化
loadAssets()

const triggerWallpaperUpload = () => {
  showWallpaperModal.value = true
}

const triggerMediaThumbUpload = () => {
  showMediaThumbModal.value = true
}

// --- Toast 相关 ---
const toastVisible = ref(false)
const toastMessage = ref('')
let toastTimer: any = null

function showToast(msg: string) {
  toastMessage.value = msg
  toastVisible.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastVisible.value = false
  }, 2000)
}

defineExpose({ showToast })

// --- 历史通话记录管理 ---
const { summarizeVoiceCall } = useChatSummary(selectedChat, saveCurrentChat, showToast)

const handleDeleteCallRecords = (recordIds: (string | number)[]) => {
  if (!selectedChat.value?.callSummaries || recordIds.length === 0) return
  const before = selectedChat.value.callSummaries.length
  selectedChat.value.callSummaries = selectedChat.value.callSummaries.filter(
    (r: any) => !recordIds.includes(r.id)
  )
  const removed = before - selectedChat.value.callSummaries.length
  if (removed > 0) {
    saveCurrentChat()
    showToast(`已删除 ${removed} 条通话记录`)
  }
}

const handleResummarizeCallRecord = async (recordId: string | number) => {
  if (!selectedChat.value?.callSummaries) return
  const record = selectedChat.value.callSummaries.find((r: any) => r.id === recordId)
  if (!record || !record.rawMessages || record.rawMessages.length === 0) {
    showToast('缺少原始通话记录，无法重新总结')
    return
  }
  showToast('正在重新生成通话总结...')
  record.content = '正在生成总结...'

  const summaryContent = await summarizeVoiceCall(record.rawMessages)
  record.content = summaryContent || '总结生成失败，您可在详情中重新总结'
  saveCurrentChat()
  showToast(summaryContent ? '通话总结已重新生成' : '通话总结生成失败')
}

const onWallpaperSaved = async (url: string | null) => {
  if (!selectedChat.value) return
  
  currentChatWallpaper.value = url
  try {
    if (url) {
      await wallpaperStore.setItem(`wallpaper_${selectedChat.value.id}`, url)
    } else {
      await wallpaperStore.removeItem(`wallpaper_${selectedChat.value.id}`)
    }
  } catch (err) {
    console.error('Failed to save wallpaper', err)
    showToast('壁纸保存失败')
  }
}

const clearWallpaper = async () => {
  if (!selectedChat.value) return
  currentChatWallpaper.value = null
  try {
    await wallpaperStore.removeItem(`wallpaper_${selectedChat.value.id}`)
  } catch (err) {
    console.error('Failed to remove wallpaper', err)
  }
}

const onMediaThumbSaved = async (url: string | null) => {
  if (!selectedChat.value) return
  currentMediaThumb.value = url
  try {
    if (url) {
      await mediaThumbStore.setItem(`thumb_${selectedChat.value.id}`, url)
    } else {
      await mediaThumbStore.removeItem(`thumb_${selectedChat.value.id}`)
    }
  } catch (err) {
    console.error('Failed to save media thumb', err)
    showToast('缩略图保存失败')
  }
}

const clearMediaThumb = async () => {
  if (!selectedChat.value) return
  currentMediaThumb.value = null
  try {
    await mediaThumbStore.removeItem(`thumb_${selectedChat.value.id}`)
  } catch (err) {
    console.error('Failed to remove media thumb', err)
  }
}

const showClearConfirmModal = ref(false)

const handleClearHistoryClick = () => {
  showClearConfirmModal.value = true
}

const confirmClearChatHistory = () => {
  if (selectedChat.value) {
    selectedChat.value.messages = []
    
    // 更新外部 mockChats 里的列表预览
    const targetChat = mockChats.value.find(c => c.id === selectedChat.value.id)
    if (targetChat) {
      targetChat.preview = '暂无消息'
    }

    saveCurrentChat()
    
    // 真正的持久化清空聊天记录
    if (selectedChat.value.id === 1) {
      localStorage.setItem('clingy_system_messages', '[]')
    } else {
      const { currentChatUserId } = useChatAuth()
      const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
      const savedStr = localStorage.getItem(contactsKey)
      if (savedStr) {
        const contacts = JSON.parse(savedStr)
        const idx = contacts.findIndex((c: any) => c.id === selectedChat.value.id)
        if (idx !== -1) {
          contacts[idx].messages = []
          contacts[idx].preview = '暂无消息'
          localStorage.setItem(contactsKey, JSON.stringify(contacts))
        }
      }
    }
  }
  showClearConfirmModal.value = false
}

const showWorldBookBindSelector = ref(false)

const showSummaryView = ref(false)
const showEmojiView = ref(false)
const showTokenStatsModal = ref(false)

// --- 统一的文本编辑弹窗 (短文本/组件使用) ---
const textModal = ref({
  visible: false,
  title: '',
  text: '',
  defaultText: '',
  placeholder: '',
  target: ''
})

const openTextModal = (title: string, text: string, defaultText: string, placeholder: string, target: string) => {
  textModal.value = {
    visible: true,
    title,
    text: text || '',
    defaultText,
    placeholder,
    target
  }
}

// --- 长文本编辑弹窗 (角色设定、总结提示词等使用) ---
const longTextModal = ref({
  visible: false,
  title: '',
  text: '',
  defaultText: '',
  placeholder: '',
  target: ''
})

const openLongTextModal = (title: string, text: string, defaultText: string, placeholder: string, target: string) => {
  longTextModal.value = {
    visible: true,
    title,
    text: text || '',
    defaultText,
    placeholder,
    target
  }
}

const showUserProfileSyncModal = ref(false)
const pendingUserProfile = ref<ChatUserProfileSnapshot | null>(null)

const saveUserProfileToCurrentChat = async (
  snapshot: ChatUserProfileSnapshot,
  updateSource = false
) => {
  if (!selectedChat.value) return
  const source = selectedChat.value.userProfileSource || {
    type: 'custom',
    name: '独立人设'
  }

  if (updateSource && source.personaId) {
    const updated = await updateStoredPersona(source.personaId, snapshot)
    if (updated) {
      applyUserProfileToChat(selectedChat.value, snapshot, {
        ...source,
        name: updated.name || source.name,
        hasLocalChanges: false
      })
      if (source.type === 'account') await loadMyProfile()
    } else {
      applyUserProfileToChat(selectedChat.value, snapshot, {
        type: 'custom',
        name: '独立人设',
        hasLocalChanges: false
      })
    }
  } else {
    applyUserProfileToChat(
      selectedChat.value,
      snapshot,
      source.type === 'account'
        ? { type: 'custom', name: '当前聊天独立人设', hasLocalChanges: false }
        : { ...source, hasLocalChanges: source.type !== 'custom' }
    )
  }

  await saveCurrentChat()
  pendingUserProfile.value = null
  showUserProfileSyncModal.value = false
}

const requestUserProfileSave = (snapshot: ChatUserProfileSnapshot) => {
  const source = selectedChat.value?.userProfileSource
  if (source?.personaId && source.type !== 'custom') {
    pendingUserProfile.value = snapshot
    showUserProfileSyncModal.value = true
    return
  }
  void saveUserProfileToCurrentChat(snapshot)
}

const createIndependentUserPersona = () => {
  if (!selectedChat.value) return
  const snapshot: ChatUserProfileSnapshot = {
    name: '',
    remark: '',
    persona: '',
    avatarUrl: ''
  }
  applyUserProfileToChat(selectedChat.value, snapshot, {
    type: 'custom',
    name: '独立人设',
    hasLocalChanges: false
  })
  void saveCurrentChat()
  openLongTextModal(
    '新建独立用户人设',
    '',
    '',
    '请详细描述用户的性格、背景、身份等设定...',
    'myPersona'
  )
}

const handleTextSave = (newText: string, target: string) => {
  if (!selectedChat.value) return

  if (target === 'realName') {
    selectedChat.value.realName = newText
  } else if (target === 'remark') {
    selectedChat.value.remark = newText
  } else if (target === 'persona') {
    selectedChat.value.persona = newText
  } else if (target === 'myRealName' || target === 'myRemark' || target === 'myPersona') {
    const snapshot: ChatUserProfileSnapshot = {
      name: effectiveMyProfile.value.name || '',
      remark: effectiveMyProfile.value.remark || '',
      persona: effectiveMyProfile.value.persona || '',
      avatarUrl: effectiveMyProfile.value.avatarUrl || ''
    }
    if (target === 'myRealName') snapshot.name = newText
    if (target === 'myRemark') snapshot.remark = newText
    if (target === 'myPersona') snapshot.persona = newText
    requestUserProfileSave(snapshot)
    return
  } else if (target === 'summaryPrompt') {
    selectedChat.value.summaryPrompt = newText
  } else if (target === 'autoSummaryThreshold') {
    selectedChat.value.autoSummaryThreshold = parseInt(newText) || null
  } else if (target === 'memoryValue') {
    selectedChat.value.memoryValue = parseInt(newText) || null
  }
  
  saveCurrentChat()
}

const onTextModalSaved = (newText: string) => {
  handleTextSave(newText, textModal.value.target)
}

const onLongTextModalSaved = (newText: string) => {
  handleTextSave(newText, longTextModal.value.target)
}

const showMemoryTypeModal = ref(false)
const showMemoryValueModal = ref(false)

const showMsgCountModal = ref(false)

const showTransferPreview = ref(false)

const openMemoryValueModal = () => {
  showMemoryValueModal.value = true
}

const openMsgCountModal = () => {
  showMsgCountModal.value = true
}

const setMemoryType = (type: 'round' | 'count') => {
  if (selectedChat.value) {
    selectedChat.value.memoryType = type
    saveCurrentChat()
  }
}

const saveMemoryValue = (val: number | null) => {
  if (!selectedChat.value) return
  selectedChat.value.memoryValue = val
  saveCurrentChat()
  showMemoryValueModal.value = false
}

const saveMsgCount = (minVal: number, maxVal: number) => {
  if (!selectedChat.value) return
  selectedChat.value.minMsgCount = minVal
  selectedChat.value.maxMsgCount = maxVal
  saveCurrentChat()
  showMsgCountModal.value = false
}

const handleSaveTransferStyle = (style: 'wechat' | 'ticket' | 'glass') => {
  chatSettings.transferStyle = style
}

const handleSaveAvatarDisplayStyle = (style: 'all' | 'user_only' | 'character_only' | 'none') => {
  chatSettings.avatarDisplayStyle = style
}

const handleSaveNameDisplayStyle = (style: 'all' | 'user_only' | 'character_only' | 'none') => {
  chatSettings.nameDisplayStyle = style
}

const handleSaveTimeDisplayStyle = (style: 'none' | 'hm' | 'hms', position: 'avatar_bottom' | 'bubble_outer' | 'name_side') => {
  chatSettings.timeDisplayStyle = style
  chatSettings.timeDisplayPosition = position
}
</script>

<template>
  <div class="view-container full-height chat-settings-base">
    <ChatSummaryView v-if="showSummaryView" @back="showSummaryView = false" />

    <ChatSettingsSearchBar
      v-model="searchQuery"
      @back="emit('back')"
    />

    <main class="settings-main-clean">
      
      <ChatSettingsTabs
        v-show="!searchQuery"
        :categories="chatSettingCategories"
        :active-category="activeChatSettingCategory"
        @change="handleTabChange"
      />

      <ChatSettingsPanelDerived
        v-show="activeChatSettingCategory === '衍生' || searchQuery"
        :selected-chat="selectedChat"
        :token-stats="tokenStats"
        :match-search="matchSearch"
        @show-summary-view="showSummaryView = true"
        @show-token-stats-modal="showTokenStatsModal = true"
      />

      <ChatSettingsPanelRole
        v-show="activeChatSettingCategory === '角色' || searchQuery"
        :selected-chat="selectedChat"
        :character-current-time="characterCurrentTime"
        :get-timezone-label="getTimezoneLabel"
        :match-search="matchSearch"
        @open-timezone-modal="openTimezoneModal"
        @open-avatar-upload="t => emit('open-avatar-upload', t)"
        @open-text-modal="openTextModal"
        @open-long-text-modal="openLongTextModal"
        @show-voice-detail-modal="showVoiceDetailModal = true"
        @show-nai-image-detail-modal="showNAIImageDetailModal = true"
        @show-gpt-image-detail-modal="showGptImageDetailModal = true"
        @show-gemini-image-detail-modal="showGeminiImageDetailModal = true"
        @show-flux-image-detail-modal="showFluxImageDetailModal = true"
        @show-niji-image-detail-modal="showNijiImageDetailModal = true"
        @show-seedream-image-detail-modal="showSeedreamImageDetailModal = true"
        @show-image-provider-modal="showImageProviderModal = true"
        @show-identity-profile-modal="openIdentityProfile"
        @show-world-book-bind-selector="showWorldBookBindSelector = true"
        @show-bilingual-option-modal="openBilingualOptionModal"
        @show-bilingual-language-modal="openBilingualLanguageModal"
        @open-character-profile="emit('open-character-profile')"
        @save="saveCurrentChat"
      />

      <ChatSettingsPanelAppearance
        v-show="activeChatSettingCategory === '美化' || searchQuery"
        :selected-chat="selectedChat"
        :current-chat-wallpaper="currentChatWallpaper"
        :match-search="matchSearch"
        @show-transfer-preview="showTransferPreview = true"
        @show-bubble-beautify-modal="showBubbleBeautifyModal = true"
        @show-avatar-display-modal="showAvatarDisplayModal = true"
        @show-name-display-modal="showNameDisplayModal = true"
        @show-time-display-modal="showTimeDisplayModal = true"
        @trigger-wallpaper-upload="triggerWallpaperUpload"
        @clear-wallpaper="clearWallpaper"
        @save="saveCurrentChat"
      />

      <ChatSettingsPanelGeneral
        v-show="activeChatSettingCategory === '通用' || searchQuery"
        :selected-chat="selectedChat"
        :current-media-thumb="currentMediaThumb"
        :match-search="matchSearch"
        @save="saveCurrentChat"
        @open-msg-count-modal="openMsgCountModal"
        @show-memory-type-modal="showMemoryTypeModal = true"
        @open-memory-value-modal="openMemoryValueModal"
        @show-emoji-view="showEmojiView = true"
        @trigger-media-thumb-upload="triggerMediaThumbUpload"
        @clear-media-thumb="clearMediaThumb"
        @handle-clear-history-click="handleClearHistoryClick"
        @open-offline-meet="emit('open-offline-meet')"
        @open-relationship="emit('open-relationship')"
        @open-autonomy="emit('open-autonomy')"
      />

      <ChatSettingsPanelUser
        v-show="activeChatSettingCategory === '用户' || searchQuery"
        :selected-chat="selectedChat"
        :my-profile="effectiveMyProfile"
        :user-current-time="userCurrentTime"
        :get-timezone-label="getTimezoneLabel"
        :match-search="matchSearch"
        @open-persona-select="emit('open-persona-select')"
        @use-account-persona="emit('use-account-persona')"
        @create-user-persona="createIndependentUserPersona"
        @open-avatar-upload="t => emit('open-avatar-upload', t)"
        @open-text-modal="openTextModal"
        @open-long-text-modal="openLongTextModal"
        @open-timezone-modal="openTimezoneModal"
        @delete-call-records="handleDeleteCallRecords"
        @resummarize-call-record="handleResummarizeCallRecord"
        @show-identity-profile-modal="openIdentityProfile"
      />

      <!-- 时区选择弹窗 -->
      <ChatTimezoneModal
        v-model:visible="showTimezoneModal"
        @select="handleSelectTimezone"
      />

      <!-- Token 统计弹窗 -->
      <ChatTokenStatsModal
        v-model:visible="showTokenStatsModal"
      />

      <!-- 关联设定管理弹窗 -->
      <ChatWorldBookBindModal
        v-model:visible="showWorldBookBindSelector"
        @save="saveCurrentChat"
      />

      <!-- 红包气泡风格小弹窗 -->
      <ChatTransferPreviewModal
        v-model:visible="showTransferPreview"
        :currentStyle="chatSettings.transferStyle || 'wechat'"
        @save="handleSaveTransferStyle"
      />

      <!-- 记忆计算方式弹窗 -->
      <ChatMemoryTypeModal
        v-model:visible="showMemoryTypeModal"
        :current-type="selectedChat.memoryType || 'count'"
        @select="setMemoryType"
      />

      <!-- 记忆长度弹窗 -->
      <ChatMemoryValueModal
        v-model:visible="showMemoryValueModal"
        :memory-type="selectedChat.memoryType || 'count'"
        :initial-value="selectedChat.memoryValue != null ? String(selectedChat.memoryValue) : ''"
        @save="saveMemoryValue"
      />

      <!-- 对话头像显示弹窗 -->
      <ChatAvatarDisplayModal 
        v-model:visible="showAvatarDisplayModal" 
        @save="handleSaveAvatarDisplayStyle" 
      />

      <!-- 对话昵称显示弹窗 -->
      <ChatNameDisplayModal 
        v-model:visible="showNameDisplayModal" 
        @save="handleSaveNameDisplayStyle" 
      />

      <!-- 对话时间显示弹窗 -->
      <ChatTimeDisplayModal
        :show="showTimeDisplayModal"
        :initial-style="(chatSettings.timeDisplayStyle as 'none' | 'hm' | 'hms') || 'none'"
        :initial-position="(chatSettings.timeDisplayPosition as 'avatar_bottom' | 'bubble_outer' | 'name_side') || 'avatar_bottom'"
        @close="showTimeDisplayModal = false"
        @save="handleSaveTimeDisplayStyle"
      />

      <!-- 回复条数控制弹窗 -->
      <ChatMsgCountModal
        v-model:visible="showMsgCountModal"
        :initial-min="selectedChat.minMsgCount || 1"
        :initial-max="selectedChat.maxMsgCount || 3"
        @save="saveMsgCount"
      />

      <!-- 模型选择弹窗 -->
      <ChatVoiceModelModal
        v-model:visible="showModelModal"
        :current-model="selectedChat.voiceModel || 'speech-2.6-turbo'"
        :model-options="modelOptions"
        @select="selectModel"
      />

      <!-- NAI 生图详细配置弹窗 -->
      <ChatNAIImageDetailModal
        v-model:visible="showNAIImageDetailModal"
        :chat="selectedChat"
        @save="saveCurrentChat"
      />

      <!-- GPT 生图详细配置弹窗 -->
      <ChatGptImageDetailModal
        v-model:visible="showGptImageDetailModal"
        :chat="selectedChat"
        @save="saveCurrentChat"
      />

      <ChatGeminiImageDetailModal
        v-model:visible="showGeminiImageDetailModal"
        :chat="selectedChat"
        @save="saveCurrentChat"
      />

      <ChatFluxImageDetailModal
        v-model:visible="showFluxImageDetailModal"
        :chat="selectedChat"
        @save="saveCurrentChat"
      />

      <ChatNijiImageDetailModal
        v-model:visible="showNijiImageDetailModal"
        :chat="selectedChat"
        @save="saveCurrentChat"
      />

      <ChatSeedreamImageDetailModal
        v-model:visible="showSeedreamImageDetailModal"
        :chat="selectedChat"
        @save="saveCurrentChat"
      />

      <!-- 生图引擎选择弹窗 -->
      <ChatImageProviderModal
        v-model:visible="showImageProviderModal"
        :current-provider="selectedChat.imageGenProvider || 'novelai'"
        @select="selectImageProvider"
      />

      <ChatIdentityProfileModal
        v-model:visible="showIdentityProfileModal"
        :owner-type="identityProfileTarget"
        :owner-id="identityProfileTarget === 'character' ? String(selectedChat.characterEntityId || selectedChat.id) : identityUserOwnerId"
        :owner-name="identityProfileTarget === 'character' ? (selectedChat.realName || selectedChat.name) : (effectiveMyProfile.name || '我')"
        :owner-avatar="identityProfileTarget === 'character' ? selectedChat.avatarUrl : effectiveMyProfile.avatarUrl"
        :provider="selectedChat.imageGenProvider || 'novelai'"
        :available-characters="mockChats"
      />

      <!-- 语音详细配置弹窗 -->
      <ChatVoiceDetailModal
        v-model:visible="showVoiceDetailModal"
        :selected-chat="selectedChat"
        @open-model-modal="showModelModal = true"
        @open-voice-modal="showVoiceModal = true"
        @open-language-modal="showLanguageModal = true"
        @open-emotion-modal="showEmotionModal = true"
        @save="saveCurrentChat"
      />

      <!-- 发音语言选择弹窗 -->
      <ChatVoiceLanguageModal
        v-model:visible="showLanguageModal"
        :current-language="selectedChat.voiceLanguage || ''"
        @select="selectLanguage"
      />

      <!-- 情感风格选择弹窗 -->
      <ChatVoiceEmotionModal
        v-model:visible="showEmotionModal"
        :current-emotion="selectedChat.voiceEmotion || ''"
        @select="selectEmotion"
      />

      <ChatBilingualOptionModal
        v-model:visible="showBilingualOptionModal"
        :title="bilingualOptionTitle"
        :current-value="bilingualOptionValue"
        :options="bilingualOptionChoices"
        @select="selectBilingualOption"
      />

      <ChatDialogueLanguageModal
        v-model:visible="showBilingualLanguageModal"
        :kind="bilingualLanguageKind"
        :current-language="bilingualLanguageKind === 'output' ? (selectedChat.dialogueLanguage || 'auto') : (selectedChat.translationLanguage || 'app')"
        :custom-language="bilingualLanguageKind === 'output' ? (selectedChat.customDialogueLanguage || '') : (selectedChat.customTranslationLanguage || '')"
        @select="selectBilingualLanguage"
      />

      <!-- 音色选择弹窗 -->
      <div v-if="showVoiceModal" class="wb-modal-overlay" style="z-index: 10001;" @click.self="showVoiceModal = false">
        <div class="custom-confirm-modal" style="max-width: 360px; padding-bottom: 20px; height: 80%; display: flex; flex-direction: column;">
          <div class="confirm-title" style="margin-bottom: 16px;">选择音色</div>
          <div style="padding: 0 16px; margin-bottom: 12px;">
            <button class="action-btn small-action-btn" @click="fetchCustomVoices" :disabled="isFetchingVoices" style="width: 100%; border: 1px solid var(--border-color); background: var(--sys-bg-primary); color: var(--text-primary); cursor: pointer; padding: 10px; border-radius: 8px;">
              {{ isFetchingVoices ? '获取中...' : '拉取云端自定义音色' }}
            </button>
          </div>
          <div style="flex: 1; overflow-y: auto; padding: 0 16px;">
            <div v-if="fetchedVoices.length > 0" style="margin-bottom: 20px;">
              <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">我的云端音色</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div v-for="v in fetchedVoices" :key="v.id" class="memory-type-item" :class="{ active: selectedChat.voiceId === v.id }" @click="selectVoice(v.id)" style="padding: 10px; margin-bottom: 0;">
                  <div class="type-name" style="font-size: 14px; margin-bottom: 4px;">{{ v.name }}</div>
                  <div class="type-desc" style="font-size: 11px; word-break: break-all;">{{ v.id }}</div>
                </div>
              </div>
            </div>
            
            <div>
              <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">官方预设音色</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div v-for="v in presetVoices" :key="v.id" class="memory-type-item" :class="{ active: selectedChat.voiceId === v.id }" @click="selectVoice(v.id)" style="padding: 10px; margin-bottom: 0;">
                  <div class="type-name" style="font-size: 14px; margin-bottom: 4px;">{{ v.name }}</div>
                  <div class="type-desc" style="font-size: 11px; word-break: break-all;">{{ v.id }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 自定义确认清空弹窗 -->
      <ChatClearHistoryModal
        v-model:visible="showClearConfirmModal"
        @confirm="confirmClearChatHistory"
      />

      <Teleport to="body">
        <transition name="toast-fade">
          <div v-if="toastVisible" class="settings-toast">
            {{ toastMessage }}
          </div>
        </transition>

        <AvatarUploadModal
          v-model:visible="showWallpaperModal"
          :current-avatar="currentChatWallpaper"
          shape="wallpaper"
          title="更换专属背景"
          @saved="onWallpaperSaved"
        />
        
        <AvatarUploadModal
          v-model:visible="showMediaThumbModal"
          :current-avatar="currentMediaThumb"
          shape="square"
          title="设置图片缩略图"
          @saved="onMediaThumbSaved"
        />

        <TextEditModal
          v-model:visible="textModal.visible"
          :title="textModal.title"
          :current-text="textModal.text"
          :default-text="textModal.defaultText"
          :placeholder="textModal.placeholder"
          @saved="onTextModalSaved"
        />
        
        <LongTextEditModal
          v-model:visible="longTextModal.visible"
          :title="longTextModal.title"
          :current-text="longTextModal.text"
          :default-text="longTextModal.defaultText"
          :placeholder="longTextModal.placeholder"
          @saved="onLongTextModalSaved"
        />

        <div
          v-if="showUserProfileSyncModal"
          class="wb-modal-overlay"
          @click.self="showUserProfileSyncModal = false"
        >
          <div class="custom-confirm-modal">
            <div class="confirm-title">保存用户人设修改</div>
            <div class="confirm-desc">
              当前资料来自「{{ selectedChat?.userProfileSource?.name || '人设库' }}」，请选择此次修改的保存位置。
            </div>
            <div class="user-profile-sync-actions">
              <button
                class="user-profile-sync-btn"
                @click="pendingUserProfile && saveUserProfileToCurrentChat(pendingUserProfile, false)"
              >
                仅保存到当前聊天
              </button>
              <button
                class="user-profile-sync-btn primary"
                @click="pendingUserProfile && saveUserProfileToCurrentChat(pendingUserProfile, true)"
              >
                同时更新原人设
              </button>
              <button
                class="user-profile-sync-btn cancel"
                @click="showUserProfileSyncModal = false; pendingUserProfile = null"
              >
                取消
              </button>
            </div>
          </div>
        </div>

        <transition name="zoom-fade">
          <ChatEmojiView
            v-if="showEmojiView"
            @close="showEmojiView = false"
          />
        </transition>

        <ChatBubbleBeautifyModal 
          v-if="showBubbleBeautifyModal" 
          @close="showBubbleBeautifyModal = false" 
        />
      </Teleport>
    </main>
  </div>
</template>

<style scoped>
@import '../app_ChatPreview.css';
@import './settings/ChatSettingsStyles.css';

.user-profile-sync-actions {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border-color);
}

.user-profile-sync-btn {
  height: 48px;
  border: 0;
  border-bottom: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  cursor: pointer;
}

.user-profile-sync-btn.primary {
  color: #3478f6;
  font-weight: 600;
}

.user-profile-sync-btn.cancel {
  color: var(--text-secondary);
  border-bottom: 0;
}
</style>
