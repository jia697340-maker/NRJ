<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import localforage from 'localforage'
import { chatSettings, worldBooks, worldBookGroups } from '../../store'
import { deleteGroupChat, saveGroupChat, type GroupChatRecord } from '../../services/groupChat'
import { useChatAuth } from '../../composables/useChatAuth'
import ChatSettingsSearchBar from './settings/ChatSettingsSearchBar.vue'
import ChatSettingsTabs from './settings/ChatSettingsTabs.vue'
import ChatSummaryView from './ChatSummaryView.vue'
import ChatMemoryTypeModal from './modals/ChatMemoryTypeModal.vue'
import ChatMemoryValueModal from './modals/ChatMemoryValueModal.vue'
import AvatarUploadModal from '../AvatarUploadModal.vue'
import { clearChatVectors, ensureMemoryState } from '../../services/memoryEngine'
import ChatBilingualOptionModal from './modals/ChatBilingualOptionModal.vue'
import ChatDialogueLanguageModal from './modals/ChatDialogueLanguageModal.vue'
import ChatTimezoneModal from './modals/ChatTimezoneModal.vue'
import ChatMsgCountModal from './modals/ChatMsgCountModal.vue'
import ChatOfflinePresetModal from './modals/ChatOfflinePresetModal.vue'
import ChatTokenStatsModal from './modals/ChatTokenStatsModal.vue'
import ChatTransferPreviewModal from './modals/ChatTransferPreviewModal.vue'
import ChatBubbleBeautifyModal from './modals/ChatBubbleBeautifyModal.vue'
import ChatAvatarDisplayModal from './modals/ChatAvatarDisplayModal.vue'
import ChatNameDisplayModal from './modals/ChatNameDisplayModal.vue'
import ChatTimeDisplayModal from './modals/ChatTimeDisplayModal.vue'
import ChatSettingsPanelAppearance from './settings/ChatSettingsPanelAppearance.vue'
import ChatCallRecordsView from './ChatCallRecordsView.vue'
import ChatEmojiView from './ChatEmojiView.vue'
import ChatIdentityProfileModal from './modals/ChatIdentityProfileModal.vue'
import GroupChatCapabilityPanel from './GroupChatCapabilityPanel.vue'
import { getChatLanguageLabel } from '../../constants/chatLanguages'
import { useTimezone } from '../../composables/useTimezone'
import { useChatEmoji } from '../../composables/useChatEmoji'
import { useGroupManagement } from '../../composables/useGroupManagement'
import GroupMemberListModal from './group/GroupMemberListModal.vue'
import GroupMemberDetailModal from './group/GroupMemberDetailModal.vue'
import GroupAdminManagementModal from './group/GroupAdminManagementModal.vue'
import GroupAnnouncementListModal from './group/GroupAnnouncementListModal.vue'
import GroupAnnouncementDetailModal from './group/GroupAnnouncementDetailModal.vue'
import GroupAnnouncementEditModal from './group/GroupAnnouncementEditModal.vue'

const props = defineProps<{ group: GroupChatRecord; chats: any[] }>()
const emit = defineEmits<{ (e: 'back'): void; (e: 'deleted'): void; (e: 'open-member-settings', memberId: string): void }>()
const { currentChatUserId } = useChatAuth()
const searchQuery = ref('')
const categories = ['群聊', '成员', '记忆', '通用', '能力', '美化', '衍生']
const activeCategory = ref(localStorage.getItem('clingy_group_setting_tab') || '群聊')
const showAddMembers = ref(false)
const showWorldBookModal = ref(false)
const editingMemberId = ref('')
const showClearConfirm = ref(false)
const showDeleteConfirm = ref(false)
const showMemoryTypeModal = ref(false)
const showMemoryValueModal = ref(false)
const showSummaryView = ref(false)
const showSyncConfirm = ref(false)
const showBilingualOptionModal = ref(false)
const bilingualOptionKind = ref<'mode' | 'display'>('mode')
const showBilingualLanguageModal = ref(false)
const bilingualLanguageKind = ref<'output' | 'translation'>('output')
const showTimezoneModal = ref(false)
const timezoneTarget = ref<'user' | 'member'>('user')
const showMsgCountModal = ref(false)
const showOfflinePresetModal = ref(false)
const showGroupOptionModal = ref(false)
const showTokenStatsModal = ref(false)
const showTransferPreview = ref(false)
const showBubbleBeautifyModal = ref(false)
const showAvatarDisplayModal = ref(false)
const showNameDisplayModal = ref(false)
const showTimeDisplayModal = ref(false)
const showCallRecordsView = ref(false)
const showEmojiView = ref(false)
const showIdentityProfileModal = ref(false)
const deleteGroupEmojiData = ref(true)
const groupOptionKind = ref<'offlineMode' | 'offlineLocation'>('offlineMode')
const showUserEditor = ref(false)
const showUserSyncConfirm = ref(false)
const userAvatarInput = ref<HTMLInputElement | null>(null)
const editingUser = ref({ name: '', persona: '', avatarUrl: '' })
const userAvatarData = ref<string | null>(null)
const userAvatarChanged = ref(false)
const loadedUserAvatar = ref<string | null>(null)
const syncMemberId = ref('')
const syncPersonaContent = ref('')
const syncAvatarChanged = ref(false)
const syncAvatarUrl = ref('')
const avatarInput = ref<HTMLInputElement | null>(null)
const customAvatarData = ref<string | null>(null)
const wallpaperInput = ref<HTMLInputElement | null>(null)
const currentChatWallpaper = ref<string | null>(null)
const wallpaperStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatWallpapers' })
const groupAvatarsStore = localforage.createInstance({ name: 'nrt-app', storeName: 'groupMemberAvatars' })
const groupMainAvatarStore = localforage.createInstance({ name: 'nrt-app', storeName: 'groupMainAvatars' })
const identityUserOwnerId = computed(() => props.group.userProfileSource?.personaId
  ? `persona-${props.group.userProfileSource.personaId}`
  : (currentChatUserId.value || 'default-user'))
const groupIdentityProvider = computed(() => members.value.find(member => member.enableNAIImageGen)?.imageGenProvider || 'gpt')

const save = () => saveGroupChat(currentChatUserId.value, props.group)
const { getTimezoneLabel } = useTimezone()
const { emojis: emojiItems, groups: emojiGroups, deleteEmoji, deleteGroups: deleteEmojiGroups, loadEmojis } = useChatEmoji()
const bilingualModeLabel = computed(() => ({ auto: '智能判断', forced: '强制指定', follow_user: '跟随用户' } as Record<string, string>)[props.group.bilingualMode || 'auto'])
const translationDisplayLabel = computed(() => ({ tap: '点击后显示', always: '始终显示', translated_only: '仅显示译文', original_only: '仅显示原文' } as Record<string, string>)[props.group.translationDisplay || 'tap'])
const bilingualOptionTitle = computed(() => bilingualOptionKind.value === 'mode' ? '选择语言控制模式' : '选择翻译显示方式')
const bilingualOptionValue = computed(() => bilingualOptionKind.value === 'mode' ? props.group.bilingualMode : props.group.translationDisplay)
const bilingualOptionChoices = computed(() => bilingualOptionKind.value === 'mode'
  ? [
      { value: 'auto', label: '智能判断', description: '依据每位成员人设与群聊语境自然选择语言' },
      { value: 'follow_user', label: '跟随用户', description: '群成员对白跟随用户最近消息的主要语言' },
      { value: 'forced', label: '强制指定', description: '所有群成员对白使用指定输出语言' }
    ]
  : [
      { value: 'tap', label: '点击后显示' },
      { value: 'always', label: '始终显示' },
      { value: 'translated_only', label: '仅显示译文' },
      { value: 'original_only', label: '仅显示原文' }
    ])
const openBilingualOption = (kind: 'mode' | 'display') => { bilingualOptionKind.value = kind; showBilingualOptionModal.value = true }
const selectBilingualOption = (value: string) => {
  if (bilingualOptionKind.value === 'mode') {
    props.group.bilingualMode = value as GroupChatRecord['bilingualMode']
    if (value === 'forced' && ['auto', 'follow_user'].includes(props.group.dialogueLanguage || 'auto')) props.group.dialogueLanguage = 'en'
  } else props.group.translationDisplay = value
  save()
}
const openBilingualLanguage = (kind: 'output' | 'translation') => { bilingualLanguageKind.value = kind; showBilingualLanguageModal.value = true }
const selectBilingualLanguage = (payload: { value: string; customLanguage?: string }) => {
  if (bilingualLanguageKind.value === 'output') {
    props.group.dialogueLanguage = payload.value
    if (payload.customLanguage !== undefined) props.group.customDialogueLanguage = payload.customLanguage
    if (payload.value === 'auto') props.group.bilingualMode = 'auto'
    else if (payload.value === 'follow_user') props.group.bilingualMode = 'follow_user'
  } else {
    props.group.translationLanguage = payload.value
    if (payload.customLanguage !== undefined) props.group.customTranslationLanguage = payload.customLanguage
    if (payload.value === 'off' && props.group.translationDisplay === 'translated_only') props.group.translationDisplay = 'original_only'
  }
  save()
}
const openTimezone = (target: 'user' | 'member') => { timezoneTarget.value = target; showTimezoneModal.value = true }
const selectTimezone = (timezone: string) => {
  if (timezoneTarget.value === 'user') {
    props.group.userProfile ||= {}
    props.group.userProfile.timezone = timezone
  } else if (editingMemberId.value) {
    props.group.memberTimezones ||= {}
    props.group.memberTimezones[editingMemberId.value] = timezone
  }
  save()
  showTimezoneModal.value = false
}
const saveMsgCount = (min: number, max: number) => { props.group.minMsgCount = min; props.group.maxMsgCount = max; save(); showMsgCountModal.value = false }
const groupOptionTitle = computed(() => groupOptionKind.value === 'offlineMode' ? '线下表现形式' : '地点处理')
const groupOptionValue = computed(() => groupOptionKind.value === 'offlineMode' ? (props.group.offlineMeetMode || 'mixed') : (props.group.offlineMeetLocationMode || 'vague'))
const groupOptionChoices = computed(() => groupOptionKind.value === 'offlineMode'
  ? [{ value: 'mixed', label: '与线上共用页面', description: '在当前群聊中切换群体线下现场' }, { value: 'separate', label: '独立线下页面', description: '保留独立模式配置并使用线下专属协议' }]
  : [{ value: 'vague', label: '未确定时保持模糊' }, { value: 'continuous', label: '保持场景连续' }])
const openGroupOption = (kind: 'offlineMode' | 'offlineLocation') => { groupOptionKind.value = kind; showGroupOptionModal.value = true }
const selectGroupOption = (value: string) => {
  if (groupOptionKind.value === 'offlineMode') props.group.offlineMeetMode = value as 'mixed' | 'separate'
  else props.group.offlineMeetLocationMode = value as 'vague' | 'continuous'
  save()
}
const saveSummary = () => { save() }
const setCategory = (value: string) => { activeCategory.value = value; localStorage.setItem('clingy_group_setting_tab', value) }
const match = (...values: (string | undefined | null)[]) => !searchQuery.value.trim() || values.some(value => String(value || '').toLowerCase().includes(searchQuery.value.trim().toLowerCase()))
const allContacts = computed(() => props.chats.filter(chat => chat.id !== 1 && chat.chatType !== 'group' && chat.contactState !== 'candidate'))
const members = ref<any[]>([])
const loadedAvatars = ref<Record<string, string>>({})
const customGroupAvatar = ref<string | null>(null)
const showGroupAvatarModal = ref(false)

// 群管理与公告视图模型绑定
const groupRef = computed(() => props.group)
const groupMgmt = useGroupManagement(groupRef, undefined, computed(() => props.chats))
const showMemberListModal = ref(false)
const showMemberDetailModal = ref(false)
const selectedMemberForDetail = ref<any>(null)
const showAdminManagementModal = ref(false)
const showAnnouncementListModal = ref(false)
const showAnnouncementDetailModal = ref(false)
const showAnnouncementEditModal = ref(false)
const selectedAnnouncement = ref<any>(null)

const loadGroupAvatar = async () => {
  if (props.group.hasCustomAvatar) {
    const saved = await groupMainAvatarStore.getItem<string>(props.group.id)
    if (saved) customGroupAvatar.value = saved
  }
}

const triggerGroupAvatarUpload = () => { showGroupAvatarModal.value = true }
const handleGroupAvatarSaved = async (url: string | null) => {
  if (url) {
    customGroupAvatar.value = url
    props.group.avatarUrl = url
    props.group.hasCustomAvatar = true
    await groupMainAvatarStore.setItem(props.group.id, url)
  } else {
    customGroupAvatar.value = null
    props.group.avatarUrl = ''
    props.group.hasCustomAvatar = false
    await groupMainAvatarStore.removeItem(props.group.id)
  }
  save()
}

const loadGroupMembers = async () => {
  await loadGroupAvatar()
  const list = props.group.memberIds.map(id => allContacts.value.find(chat => String(chat.characterEntityId || chat.id) === id)).filter(Boolean)
  for (const id of props.group.memberIds) {
    if (props.group.memberHasCustomAvatar?.[id]) {
      const saved = await groupAvatarsStore.getItem<string>(`${props.group.id}_${id}`)
      if (saved) loadedAvatars.value[id] = saved
    }
  }
  const savedUserAvatar = await groupAvatarsStore.getItem<string>(`${props.group.id}_user`)
  if (savedUserAvatar) loadedUserAvatar.value = savedUserAvatar

  members.value = list
}

const openEditingUser = () => {
  editingUser.value = {
    name: props.group.userProfile?.name || '我',
    persona: props.group.userProfile?.persona || '',
    avatarUrl: props.group.userProfile?.avatarUrl || ''
  }
  userAvatarData.value = loadedUserAvatar.value
  userAvatarChanged.value = false
  showUserEditor.value = true
}

const triggerUserAvatarUpload = () => userAvatarInput.value?.click()
const handleUserAvatarUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    userAvatarData.value = reader.result as string
    userAvatarChanged.value = true
    ;(event.target as HTMLInputElement).value = ''
  }
  reader.readAsDataURL(file)
}
const resetUserAvatar = () => {
  userAvatarData.value = null
  userAvatarChanged.value = true
}

const handleSaveUser = () => {
  if (userAvatarChanged.value || editingUser.value.name !== props.group.userProfile.name || editingUser.value.persona !== props.group.userProfile.persona) {
    showUserSyncConfirm.value = true
    showUserEditor.value = false
  } else {
    showUserEditor.value = false
  }
}

const confirmSaveUser = async (sync: boolean) => {
  props.group.userProfile.name = editingUser.value.name
  props.group.userProfile.persona = editingUser.value.persona
  
  if (userAvatarChanged.value) {
    if (userAvatarData.value) {
      await groupAvatarsStore.setItem(`${props.group.id}_user`, userAvatarData.value)
      loadedUserAvatar.value = userAvatarData.value
      props.group.userProfile.avatarUrl = userAvatarData.value
    } else {
      await groupAvatarsStore.removeItem(`${props.group.id}_user`)
      loadedUserAvatar.value = null
      props.group.userProfile.avatarUrl = ''
    }
  }
  
  if (sync) {
    const userProfileKey = currentChatUserId.value ? `clingy_user_profile_${currentChatUserId.value}` : 'clingy_user_profile'
    const savedStr = localStorage.getItem(userProfileKey)
    if (savedStr) {
       let p = JSON.parse(savedStr)
       p.name = editingUser.value.name
       p.persona = editingUser.value.persona
       localStorage.setItem(userProfileKey, JSON.stringify(p))
    } else {
       localStorage.setItem(userProfileKey, JSON.stringify({ name: editingUser.value.name, persona: editingUser.value.persona }))
    }
  }
  
  save()
  showUserSyncConfirm.value = false
}

const userAvatarStyle = computed(() => {
  const custom = loadedUserAvatar.value
  return custom ? { backgroundImage: `url(${custom})` } : (props.group.userProfile?.avatarUrl ? { backgroundImage: `url(${props.group.userProfile.avatarUrl})` } : {})
})
const userAvatarText = computed(() => {
  if (loadedUserAvatar.value || props.group.userProfile?.avatarUrl) return ''
  return props.group.userProfile?.name?.charAt(0) || '我'
})
onMounted(() => { props.group.userProfile ||= {}; void loadGroupMembers() })
const candidates = computed(() => allContacts.value.filter(chat => !props.group.memberIds.includes(String(chat.characterEntityId || chat.id))))
const editingMember = computed(() => members.value.find(member => String(member.characterEntityId || member.id) === editingMemberId.value))

const openEditingMember = async (member: any) => {
  const id = memberId(member)
  editingMemberId.value = id
  props.group.memberSettings ||= {}
  props.group.memberSettings[id] ||= {
    enableVoiceReply: !!member.enableVoiceReply,
    enableVoiceCall: !!member.enableVoiceCall,
    enableVideoCall: !!member.enableVideoCall,
    allowIncomingGroupCall: !!(member.enableVoiceCall || member.enableVideoCall),
    enableNAIImageGen: !!member.enableNAIImageGen,
    enableEmojiVision: !!member.enableEmojiVision,
    enableRoleEmojiVision: !!member.enableRoleEmojiVision,
    enableImmersiveStatus: !!member.enableImmersiveStatus
  }
  if (props.group.memberEmojiLibraryEnabled[id] === undefined) props.group.memberEmojiLibraryEnabled[id] = true
  customAvatarData.value = loadedAvatars.value[id] || null
  if (props.group.memberNotes[id] === undefined) {
    props.group.memberNotes[id] = member.persona || ''
  }
}

const triggerAvatarUpload = () => avatarInput.value?.click()
const handleAvatarUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    customAvatarData.value = reader.result as string
    syncAvatarChanged.value = true
    syncAvatarUrl.value = reader.result as string
    ;(event.target as HTMLInputElement).value = ''
  }
  reader.readAsDataURL(file)
}
const resetAvatar = () => {
  customAvatarData.value = null
  syncAvatarChanged.value = true
  syncAvatarUrl.value = ''
}

const handleSaveMember = async () => {
  const id = editingMemberId.value
  const newPersona = props.group.memberNotes[id] || ''
  const basePersona = editingMember.value?.persona || ''
  
  if (syncAvatarChanged.value) {
    props.group.memberHasCustomAvatar ||= {}
    if (customAvatarData.value) {
      props.group.memberHasCustomAvatar[id] = true
      await groupAvatarsStore.setItem(`${props.group.id}_${id}`, customAvatarData.value)
      loadedAvatars.value[id] = customAvatarData.value
    } else {
      delete props.group.memberHasCustomAvatar[id]
      await groupAvatarsStore.removeItem(`${props.group.id}_${id}`)
      delete loadedAvatars.value[id]
    }
  }

  if ((newPersona && newPersona !== basePersona) || syncAvatarChanged.value) {
    syncMemberId.value = id
    syncPersonaContent.value = newPersona
    showSyncConfirm.value = true
    editingMemberId.value = ''
  } else {
    save()
    editingMemberId.value = ''
  }
}

const confirmSaveMember = async (sync: boolean) => {
  showSyncConfirm.value = false
  save()
  if (sync && syncMemberId.value) {
    const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
    const savedStr = localStorage.getItem(contactsKey)
    if (savedStr) {
      let contacts = JSON.parse(savedStr)
      const idx = contacts.findIndex((c: any) => String(c.characterEntityId || c.id) === syncMemberId.value)
      if (idx !== -1) {
        contacts[idx].persona = syncPersonaContent.value
        localStorage.setItem(contactsKey, JSON.stringify(contacts))
        const chatIdx = props.chats.findIndex(c => String(c.characterEntityId || c.id) === syncMemberId.value)
        if (chatIdx !== -1) {
          if (syncPersonaContent.value) props.chats[chatIdx].persona = syncPersonaContent.value
          if (syncAvatarChanged.value) {
             if (syncAvatarUrl.value) {
               contacts[idx].avatarUrl = syncAvatarUrl.value
               props.chats[chatIdx].avatarUrl = syncAvatarUrl.value
             } else if (!customAvatarData.value) {
               contacts[idx].avatarUrl = ''
               props.chats[chatIdx].avatarUrl = ''
             }
          }
        }
        localStorage.setItem(contactsKey, JSON.stringify(contacts))
      }
    }
  }
  syncMemberId.value = ''
  syncPersonaContent.value = ''
  syncAvatarChanged.value = false
  syncAvatarUrl.value = ''
}

const bookItems = computed(() => worldBooks.filter(item => item.type === 'book'))
const notificationLabel = computed(() => ({ all: '全部消息', mention: '仅提到我', mute: '消息免打扰' }[props.group.notificationMode]))

const memberId = (member: any) => String(member.characterEntityId || member.id)
const avatarStyle = (member: any) => {
  const custom = loadedAvatars.value[memberId(member)]
  return custom ? { backgroundImage: `url(${custom})` } : (member.avatarUrl ? { backgroundImage: `url(${member.avatarUrl})` } : {})
}
const addMember = async (member: any) => {
  const id = memberId(member)
  props.group.memoryMemberNames ||= {}
  props.group.memoryMemberNames[id] = member.name || id
  const result = await groupMgmt.addMember(id)
  if (result) await loadGroupMembers()
}
const removeMember = async (id: string) => {
  if (props.group.memberIds.length <= 2) return
  const result = await groupMgmt.removeMember(id)
  if (!result) return
  await loadGroupMembers()
  editingMemberId.value = ''
}
const toggleBook = (id: string) => {
  props.group.boundWorldBooks = props.group.boundWorldBooks.includes(id)
    ? props.group.boundWorldBooks.filter(item => item !== id)
    : [...props.group.boundWorldBooks, id]
  save()
}
const toggleBookGroup = (id: string) => {
  props.group.boundWorldBookGroups = props.group.boundWorldBookGroups.includes(id)
    ? props.group.boundWorldBookGroups.filter(item => item !== id)
    : [...props.group.boundWorldBookGroups, id]
  save()
}
const chooseNotification = (value: GroupChatRecord['notificationMode']) => { props.group.notificationMode = value; save() }
const clearHistory = () => { props.group.messages = []; props.group.memoryBook = []; props.group.memberMemories = {}; props.group.memoryState = null; props.group.lastSummaryMsgId = 0; ensureMemoryState(props.group); void clearChatVectors(props.group.id); save(); showClearConfirm.value = false }
const removeGroup = async () => { if (!groupMgmt.currentUserPermissions.value.isOwner) return; if (deleteGroupEmojiData.value) { await Promise.all(emojiItems.value.filter(item => item.category === 'group' && String(item.groupId || '') === String(props.group.id)).map(item => deleteEmoji(item.id))); await deleteEmojiGroups(emojiGroups.value.filter(item => item.category === 'group' && String(item.groupId || '') === String(props.group.id)).map(item => item.id)) } void clearChatVectors(props.group.id); deleteGroupChat(currentChatUserId.value, props.group.id); showDeleteConfirm.value = false; emit('deleted') }
const chooseWallpaper = () => wallpaperInput.value?.click()
const uploadWallpaper = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => { currentChatWallpaper.value = reader.result as string; await wallpaperStore.setItem(`wallpaper_${props.group.id}`, reader.result); (event.target as HTMLInputElement).value = '' }
  reader.readAsDataURL(file)
}
const clearWallpaper = async () => { currentChatWallpaper.value = null; await wallpaperStore.removeItem(`wallpaper_${props.group.id}`) }
const handleSaveTransferStyle = (style: 'wechat' | 'ticket' | 'glass') => { chatSettings.transferStyle = style }
const handleSaveAvatarDisplayStyle = (style: 'all' | 'user_only' | 'character_only' | 'none') => { chatSettings.avatarDisplayStyle = style }
const handleSaveNameDisplayStyle = (style: 'all' | 'user_only' | 'character_only' | 'none') => { chatSettings.nameDisplayStyle = style }
const handleSaveTimeDisplayStyle = (style: 'none' | 'hm' | 'hms', position: 'avatar_bottom' | 'bubble_outer' | 'name_side') => { chatSettings.timeDisplayStyle = style; chatSettings.timeDisplayPosition = position }
const deleteGroupCallRecords = (ids: (string | number)[]) => { props.group.callSummaries = (props.group.callSummaries || []).filter(item => !ids.includes(item.id)); save() }
const resummarizeGroupCallRecord = (id: string | number) => {
  const record = (props.group.callSummaries || []).find(item => item.id === id)
  if (!record) return
  record.content = (record.rawMessages || []).map((message: any) => `${message.type === 'right' ? (props.group.userProfile?.name || '我') : (props.group.memberNicknames?.[String(message.senderId || '')] || message.senderNameSnapshot || '群成员')}：${message.content}`).join('\n') || '本次群通话无文字记录'
  save()
}
onMounted(async () => { if (!categories.includes(activeCategory.value)) activeCategory.value = '群聊'; await loadEmojis(); currentChatWallpaper.value = await wallpaperStore.getItem<string>(`wallpaper_${props.group.id}`); if ((props.group as any).openEmojiManagerRequested) { (props.group as any).openEmojiManagerRequested = false; showEmojiView.value = true } })
</script>

<template>
  <ChatSummaryView v-if="showSummaryView" :chat="group" :save-chat="saveSummary" @back="showSummaryView = false" />
  <div v-else class="view-container full-height chat-settings-base group-settings-view">
    <ChatSettingsSearchBar v-model="searchQuery" @back="emit('back')" />
    <main class="settings-main-clean">
      <ChatSettingsTabs v-show="!searchQuery" :categories="categories" :active-category="activeCategory" @change="setCategory" />

      <section v-show="searchQuery || activeCategory === '群聊'" class="role-edit-section">
        <div class="user-avatar-action-box" style="margin-bottom: 24px;" v-show="match('群头像', '待开发')">
          <div class="action-column">
            <div class="action-btn placeholder">待开发</div>
            <div class="action-btn placeholder">待开发</div>
          </div>

          <div class="role-edit-avatar-box">
            <div class="role-edit-avatar" @click="triggerGroupAvatarUpload" :style="customGroupAvatar ? { backgroundImage: `url(${customGroupAvatar})` } : {}">
              <span v-if="!customGroupAvatar">{{ group.avatarText || '群' }}</span>
              <div class="avatar-edit-overlay">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="#fff" stroke-width="2" fill="none"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              </div>
            </div>
            <div class="role-edit-avatar-tip">点击更换头像</div>
          </div>

          <div class="action-column">
            <div class="action-btn placeholder">待开发</div>
            <div class="action-btn placeholder">待开发</div>
          </div>
        </div>

        <div v-show="match('群名称', '背景', '设定')" class="glass-panel group-form-panel">
          <label class="group-field"><span class="item-label">群名称</span><input v-model="group.name" class="group-settings-input" maxlength="30" :disabled="!groupMgmt.currentUserPermissions.value.canManageMembers" @change="save"></label>
          <label class="group-field"><span class="item-label">群背景 <small>可选</small></span><textarea v-model="group.groupContext" class="group-settings-textarea" rows="5" placeholder="不填写时，不会向模型发送群背景提示词" :disabled="!groupMgmt.currentUserPermissions.value.canManageMembers" @change="save"></textarea></label>
        </div>
        <div v-show="match('群公告', '公告', '通知')" class="glass-panel">
          <div class="glass-list-item" @click="showAnnouncementListModal = true">
            <div>
              <div class="item-label">群公告</div>
              <div class="group-item-desc">查看最新公告、未读通知与确认情况</div>
            </div>
            <div class="item-value">
              <span class="item-value-text">{{ groupMgmt.unreadAnnouncementsCount.value ? `${groupMgmt.unreadAnnouncementsCount.value} 条未读` : '查看' }}</span>
              <span class="arrow">›</span>
            </div>
          </div>
        </div>

        <div v-show="match('世界书', '群资料')" class="glass-panel">
          <div class="glass-list-item" @click="showWorldBookModal = true">
            <span class="item-label">群聊世界书</span>
            <div class="item-value">
              <span>已绑定 {{ group.boundWorldBooks.length + group.boundWorldBookGroups.length }} 项</span>
              <span class="arrow">›</span>
            </div>
          </div>
        </div>
        <div v-show="match('表情包管理库', '本群共用表情')" class="glass-panel">
          <div class="glass-list-item" @click="showEmojiView = true"><div><div class="item-label">表情包管理库</div><div class="group-item-desc">管理本群共用、用户与全局角色表情</div></div><div class="item-value"><span class="item-value-text">进入</span><span class="arrow">›</span></div></div>
        </div>
      </section>

      <section v-show="searchQuery || activeCategory === '成员'" class="role-edit-section">
        <div v-show="match('群内用户资料', '用户名称', '用户人设', '群内身份', '我在本群的身份')" class="glass-panel">
          <div class="glass-list-item" @click="openEditingUser">
            <div class="group-member-line"><span class="group-member-avatar" :style="userAvatarStyle">{{ userAvatarText }}</span><span class="item-label">{{ group.userProfile?.name || '我' }}</span></div><div class="item-value"><span class="item-value-text">我在本群的身份</span><span class="arrow">›</span></div>
          </div>
          <div class="glass-list-item" @click="showIdentityProfileModal = true"><div><div class="item-label">我的固定形象</div><div class="group-item-desc">供群合照与角色生图引用</div></div><div class="item-value"><span class="item-value-text">配置</span><span class="arrow">›</span></div></div>
        </div>

        <div v-show="match('群管理', '全员禁言', 'AI管理', '六级头衔')" class="glass-panel">
          <div class="glass-list-item" @click="showAdminManagementModal = true">
            <div>
              <div class="item-label">群管理中心</div>
              <div class="group-item-desc">全员禁言、AI管理模式、六级头衔及管理日志</div>
            </div>
            <div class="item-value">
              <span class="item-value-text">管理</span>
              <span class="arrow">›</span>
            </div>
          </div>
        </div>

        <div v-show="match('成员列表', '等级', '头衔', '禁言')" class="glass-panel">
          <div class="glass-list-item" @click="showMemberListModal = true">
            <div>
              <div class="item-label">查看群成员列表与等级</div>
              <div class="group-item-desc">支持筛选群主/管理员/普通成员、查看积分头衔与禁言</div>
            </div>
            <div class="item-value">
              <span class="item-value-text">{{ groupMgmt.membersViewModel.value.length }} 人</span>
              <span class="arrow">›</span>
            </div>
          </div>
        </div>

        <div v-show="match('成员', '昵称', '群内身份')" class="glass-panel">
          <div v-for="member in members" :key="memberId(member)" class="glass-list-item" @click="openEditingMember(member)">
            <div class="group-member-line"><span class="group-member-avatar" :style="avatarStyle(member)">{{ member.avatarUrl ? '' : member.avatarText }}</span><span class="item-label">{{ group.memberNicknames[memberId(member)] || member.name }}</span></div><div class="item-value"><span class="item-value-text">群内资料</span><span class="arrow">›</span></div>
          </div>
          <div class="glass-list-item" @click="showAddMembers = true"><span class="item-label">添加成员</span><div class="item-value"><span>{{ candidates.length ? '选择角色' : '暂无可添加角色' }}</span><span class="arrow">›</span></div></div>
        </div>
      </section>

      <section v-show="searchQuery || activeCategory === '记忆'" class="role-edit-section">
        <div v-show="match('记忆计算方式', '携带前文记忆', '记忆类型', '短期记忆', '上下文')" class="glass-panel">
          <div class="glass-list-item" v-show="match('记忆计算方式', '记忆类型')" @click="showMemoryTypeModal = true">
            <span class="item-label">记忆计算方式</span>
            <div class="item-value">
              <span>{{ group.memoryType === 'round' ? '按对话轮数' : '按消息条数' }}</span>
              <span class="arrow">›</span>
            </div>
          </div>

          <div class="glass-list-item" v-show="match('携带前文记忆', '短期记忆', '上下文')" @click="showMemoryValueModal = true">
            <span class="item-label">携带前文记忆</span>
            <div class="item-value">
              <span>{{ group.memoryValue }}{{ group.memoryType === 'round' ? '轮' : '条' }}</span>
              <span class="arrow">›</span>
            </div>
          </div>
        </div>

        <div v-show="match('自动总结', '沉淀', '长期记忆')" class="glass-panel">
          <div class="group-section-title">长期记忆沉淀</div>
          <div class="glass-list-item" @click="showSummaryView = true">
            <div><div class="item-label">总结与长期记忆</div><div class="group-item-desc">自动触发、手动区间、结构化记忆与智能召回</div></div>
            <div class="item-value"><span class="item-value-text">已生成 {{ group.memoryBook.length }} 条</span><span class="arrow">›</span></div>
          </div>
          <div class="group-explain">使用与聊天一致的完整记忆体系；是否自动整理、何时触发及每次处理范围均可单独配置。</div>
        </div>

        <div v-show="match('清空', '聊天记录', '群记忆')" class="glass-panel"><div class="glass-list-item danger-row" @click="showClearConfirm = true">清空群聊记录与群记忆</div></div>
      </section>

      <section v-show="searchQuery || activeCategory === '通用'" class="role-edit-section">
        <div v-show="match('通知', '时间感知', '双语')" class="glass-panel">
          <div class="group-section-title">消息通知</div>
          <div v-for="option in [{ value: 'all', label: '全部消息' }, { value: 'mention', label: '仅提到我' }, { value: 'mute', label: '消息免打扰' }]" :key="option.value" class="glass-list-item" @click="chooseNotification(option.value as GroupChatRecord['notificationMode'])"><span class="item-label">{{ option.label }}</span><span class="group-radio" :class="{ active: group.notificationMode === option.value }"></span></div>
          <div class="group-current-value">当前：{{ notificationLabel }}</div>
        </div>
        <div v-show="match('时间感知', '时区', '发送角色时间戳')" class="glass-panel">
          <div class="glass-list-item"><span class="item-label">时间感知</span><label class="switch"><input v-model="group.timePerception" type="checkbox" @change="save"><span class="slider"></span></label></div>
          <template v-if="group.timePerception">
            <div class="glass-list-item" @click="openTimezone('user')"><span class="item-label bilingual-child-label">└ 用户时区</span><div class="item-value"><span class="item-value-text">{{ getTimezoneLabel(group.userProfile?.timezone) || '跟随设备' }}</span><span class="arrow">›</span></div></div>
            <div class="glass-list-item"><span class="item-label bilingual-child-label">└ 发送成员历史时间戳</span><label class="switch"><input v-model="group.sendCharacterTime" type="checkbox" @change="save"><span class="slider"></span></label></div>
          </template>
        </div>
        <div v-show="match('双语', '语言控制模式', '输出语言', '翻译目标语言', '翻译显示方式')" class="glass-panel">
          <div class="glass-list-item"><span class="item-label">双语模式</span><label class="switch"><input v-model="group.bilingualEnabled" type="checkbox" @change="save"><span class="slider"></span></label></div>
          <template v-if="group.bilingualEnabled">
            <div class="glass-list-item" @click="openBilingualOption('mode')"><span class="item-label bilingual-child-label">└ 语言控制模式</span><div class="item-value"><span class="item-value-text">{{ bilingualModeLabel }}</span><span class="arrow">›</span></div></div>
            <div class="glass-list-item" @click="openBilingualLanguage('output')"><span class="item-label bilingual-child-label">└ 群成员输出语言</span><div class="item-value"><span class="item-value-text">{{ getChatLanguageLabel(group.dialogueLanguage || 'auto', group.customDialogueLanguage) }}</span><span class="arrow">›</span></div></div>
            <div class="glass-list-item" @click="openBilingualLanguage('translation')"><span class="item-label bilingual-child-label">└ 翻译目标语言</span><div class="item-value"><span class="item-value-text">{{ getChatLanguageLabel(group.translationLanguage || 'app', group.customTranslationLanguage) }}</span><span class="arrow">›</span></div></div>
            <div class="glass-list-item" @click="openBilingualOption('display')"><span class="item-label bilingual-child-label">└ 翻译显示方式</span><div class="item-value"><span class="item-value-text">{{ translationDisplayLabel }}</span><span class="arrow">›</span></div></div>
          </template>
        </div>
        <div v-show="match('气泡叙事', '回复条数', '线下见面', '思维', '心声')" class="glass-panel">
          <div class="glass-list-item"><div><div class="item-label">气泡叙事</div><div class="group-item-desc">按成员身份显示群聊中的动作、心理与环境描写</div></div><label class="switch"><input v-model="group.bubbleNarrationEnabled" type="checkbox" @change="save"><span class="slider"></span></label></div>
          <div class="glass-list-item"><span class="item-label">控制回复条数</span><label class="switch"><input v-model="group.enableMsgCountLimit" type="checkbox" @change="save"><span class="slider"></span></label></div>
          <div v-if="group.enableMsgCountLimit" class="glass-list-item" @click="showMsgCountModal = true"><span class="item-label bilingual-child-label">└ 群消息总量范围</span><div class="item-value"><span class="item-value-text">{{ group.minMsgCount }} ~ {{ group.maxMsgCount }} 条</span><span class="arrow">›</span></div></div>
          <div class="glass-list-item"><div><div class="item-label">允许角色内心活动</div><div class="group-item-desc">沿用各成员单聊思维设定，并按成员隔离保存</div></div><label class="switch"><input v-model="group.enableAutoThought" type="checkbox" @change="save"><span class="slider"></span></label></div>
          <template v-if="group.enableAutoThought">
            <div class="glass-list-item"><span class="item-label bilingual-child-label">└ 心声存储上限</span><div class="item-value"><input v-model.number="group.innerThoughtLimit" class="group-inline-number" type="number" min="1" max="1000" @change="save"><span class="item-value-text">条</span></div></div>
            <div class="glass-list-item"><span class="item-label bilingual-child-label">└ 读取成员自己的历史心声</span><label class="switch"><input v-model="group.enableRoleThoughtHistory" type="checkbox" @change="save"><span class="slider"></span></label></div>
            <div v-if="group.enableRoleThoughtHistory" class="glass-list-item"><span class="item-label bilingual-child-label">　└ 最近成员心声</span><div class="item-value"><input v-model.number="group.roleThoughtHistoryCount" class="group-inline-number" type="number" min="1" max="999" @change="save"><span class="item-value-text">条</span></div></div>
          </template>
          <div class="glass-list-item"><span class="item-label">读取用户历史心声</span><label class="switch"><input v-model="group.enableUserThoughtHistory" type="checkbox" @change="save"><span class="slider"></span></label></div>
          <div v-if="group.enableUserThoughtHistory" class="glass-list-item"><span class="item-label bilingual-child-label">└ 最近用户心声</span><div class="item-value"><input v-model.number="group.userThoughtHistoryCount" class="group-inline-number" type="number" min="1" max="999" @change="save"><span class="item-value-text">条</span></div></div>
          <div class="glass-list-item"><div><div class="item-label">线下见面模式</div><div class="group-item-desc">在输入栏中可随时开始或结束群体线下现场</div></div><label class="switch"><input v-model="group.offlineMeetEnabled" type="checkbox" @change="save"><span class="slider"></span></label></div>
          <template v-if="group.offlineMeetEnabled">
            <div class="glass-list-item" @click="openGroupOption('offlineMode')"><span class="item-label bilingual-child-label">└ 线下表现形式</span><div class="item-value"><span class="item-value-text">{{ group.offlineMeetMode === 'separate' ? '独立线下页面' : '与线上共用页面' }}</span><span class="arrow">›</span></div></div>
            <div class="glass-list-item" @click="showOfflinePresetModal = true"><span class="item-label bilingual-child-label">├ 线下预设与模型适配</span><div class="item-value"><span class="item-value-text">配置</span><span class="arrow">›</span></div></div>
            <div class="glass-list-item" @click="openGroupOption('offlineLocation')"><span class="item-label bilingual-child-label">└ 地点处理</span><div class="item-value"><span class="item-value-text">{{ group.offlineMeetLocationMode === 'continuous' ? '保持场景连续' : '未确定时保持模糊' }}</span><span class="arrow">›</span></div></div>
          </template>
        </div>
      </section>

      <GroupChatCapabilityPanel v-show="searchQuery || activeCategory === '能力'" :group="group" :match="match" @save="save" />

      <section v-show="searchQuery || activeCategory === '美化'" class="role-edit-section">
        <div v-show="match('群成员头像', '群成员昵称', '群消息时间')" class="glass-panel">
          <div class="glass-list-item"><span class="item-label">显示成员头像</span><label class="switch"><input v-model="group.showMemberAvatars" type="checkbox" @change="save"><span class="slider"></span></label></div>
          <div class="glass-list-item"><span class="item-label">显示成员昵称</span><label class="switch"><input v-model="group.showMemberNames" type="checkbox" @change="save"><span class="slider"></span></label></div>
          <div class="glass-list-item"><span class="item-label">显示消息时间</span><label class="switch"><input v-model="group.showMessageTime" type="checkbox" @change="save"><span class="slider"></span></label></div>
        </div>
        <ChatSettingsPanelAppearance
          :selected-chat="group"
          :current-chat-wallpaper="currentChatWallpaper"
          :match-search="match"
          @show-transfer-preview="showTransferPreview = true"
          @show-bubble-beautify-modal="showBubbleBeautifyModal = true"
          @show-avatar-display-modal="showAvatarDisplayModal = true"
          @show-name-display-modal="showNameDisplayModal = true"
          @show-time-display-modal="showTimeDisplayModal = true"
          @trigger-wallpaper-upload="chooseWallpaper"
          @clear-wallpaper="clearWallpaper"
          @save="save"
        />
        <input ref="wallpaperInput" class="group-hidden-file" type="file" accept="image/*" @change="uploadWallpaper">
        <div v-show="groupMgmt.currentUserPermissions.value.isOwner && match('删除群聊')" class="glass-panel"><div class="glass-list-item danger-row" @click="showDeleteConfirm = true">删除群聊</div></div>
      </section>

      <section v-show="searchQuery || activeCategory === '衍生'" class="role-edit-section">
        <div v-show="match('总结', '当前聊天条数', '上下文用量统计', 'Token')" class="glass-panel">
          <div class="glass-list-item" @click="showSummaryView = true"><span class="item-label">总结</span><div class="item-value"><span class="item-value-text">{{ group.autoSummaryEnabled ? '自动已开启' : '管理总结' }}</span><span class="arrow">›</span></div></div>
          <div class="glass-list-item"><span class="item-label">当前聊天条数</span><div class="item-value"><span class="item-value-text">{{ group.messages.length }} 条</span></div></div>
          <div class="glass-list-item" @click="showTokenStatsModal = true"><span class="item-label">上下文用量统计</span><div class="item-value"><span class="item-value-text">查看</span><span class="arrow">›</span></div></div>
          <div class="glass-list-item" @click="showCallRecordsView = true"><span class="item-label">群通话记录</span><div class="item-value"><span class="item-value-text">共 {{ group.callSummaries?.length || 0 }} 条</span><span class="arrow">›</span></div></div>
        </div>
      </section>
    </main>

    <div v-if="showWorldBookModal" class="wb-modal-overlay" @click.self="showWorldBookModal = false"><div class="custom-confirm-modal group-sheet"><div class="confirm-title">群聊世界书</div><div class="group-sheet-list"><div class="group-section-title">世界书分组</div><div v-for="bookGroup in worldBookGroups" :key="bookGroup.id" class="glass-list-item" @click="toggleBookGroup(bookGroup.id)"><span class="item-label">{{ bookGroup.name }}</span><span class="group-check" :class="{ active: group.boundWorldBookGroups.includes(bookGroup.id) }">✓</span></div><div v-if="!worldBookGroups.length" class="group-empty-row">暂无世界书分组</div><div class="group-section-title">单本世界书</div><div v-if="bookItems.length"><div v-for="book in bookItems" :key="book.id" class="glass-list-item" @click="toggleBook(book.id)"><span class="item-label">{{ book.title }}</span><span class="group-check" :class="{ active: group.boundWorldBooks.includes(book.id) }">✓</span></div></div><div v-else class="group-empty-row">暂无世界书</div></div><div class="confirm-actions"><div class="confirm-btn" @click="showWorldBookModal = false">完成</div></div></div></div>

    <div v-if="showAddMembers" class="wb-modal-overlay" @click.self="showAddMembers = false"><div class="custom-confirm-modal group-sheet"><div class="confirm-title">添加群成员</div><div class="group-sheet-list"><div v-for="member in candidates" :key="memberId(member)" class="glass-list-item" @click="addMember(member)"><div class="group-member-line"><span class="group-member-avatar" :style="avatarStyle(member)">{{ member.avatarUrl ? '' : member.avatarText }}</span><span>{{ member.name }}</span></div><span class="group-add-mark">＋</span></div><div v-if="!candidates.length" class="group-empty-row">没有可添加的角色</div></div><div class="confirm-actions"><div class="confirm-btn" @click="showAddMembers = false">完成</div></div></div></div>

    <div v-if="editingMember" class="wb-modal-overlay" @click.self="editingMemberId = ''">
      <div class="custom-confirm-modal group-member-editor">
        <div class="confirm-title">{{ editingMember.name }} · 群内资料</div>
        <div class="group-modal-fields scrollable-fields">
          <div class="group-field avatar-edit-field">
            <span>群内专属头像</span>
            <div class="avatar-edit-actions">
              <div class="avatar-preview-box" @click="triggerAvatarUpload" :style="customAvatarData ? { backgroundImage: `url(${customAvatarData})` } : (editingMember.avatarUrl ? { backgroundImage: `url(${editingMember.avatarUrl})` } : {})">
                <span v-if="!customAvatarData && !editingMember.avatarUrl">{{ editingMember.avatarText }}</span>
                <div class="avatar-edit-mask">更换</div>
              </div>
              <div class="avatar-reset-btn" v-if="customAvatarData" @click="resetAvatar">恢复默认</div>
            </div>
            <input ref="avatarInput" type="file" accept="image/*" class="group-hidden-file" @change="handleAvatarUpload">
          </div>
          <label class="group-field"><span>群内昵称</span><input v-model="group.memberNicknames[editingMemberId]" class="group-settings-input" :placeholder="editingMember.name"></label>
          <div class="group-field group-field-action" @click="openTimezone('member')"><span>群内角色时区</span><div class="item-value"><span class="item-value-text">{{ getTimezoneLabel(group.memberTimezones?.[editingMemberId] || editingMember.timezone) || '跟随私聊' }}</span><span class="arrow">›</span></div></div>
          <label class="group-field"><span>群内独立人设</span><textarea v-model="group.memberNotes[editingMemberId]" class="group-settings-textarea" rows="7" placeholder="此人设完全替换该成员在私聊中的原人设，仅在本群生效。"></textarea></label>
          <div class="group-section-title">群内能力覆盖（详细参数沿用私聊）</div>
          <div class="glass-list-item"><span class="item-label">群内语音消息接入</span><label class="switch"><input v-model="group.memberSettings[editingMemberId].enableVoiceReply" type="checkbox"><span class="slider"></span></label></div>
          <div class="glass-list-item"><span class="item-label">群内语音通话接入</span><label class="switch"><input v-model="group.memberSettings[editingMemberId].enableVoiceCall" type="checkbox"><span class="slider"></span></label></div>
          <div class="glass-list-item"><span class="item-label">群内视频通话接入</span><label class="switch"><input v-model="group.memberSettings[editingMemberId].enableVideoCall" type="checkbox"><span class="slider"></span></label></div>
          <div class="glass-list-item"><span class="item-label">允许该成员主动发起群通话</span><label class="switch"><input v-model="group.memberSettings[editingMemberId].allowIncomingGroupCall" type="checkbox"><span class="slider"></span></label></div>
          <div class="glass-list-item"><span class="item-label">群内角色真实生图</span><label class="switch"><input v-model="group.memberSettings[editingMemberId].enableNAIImageGen" type="checkbox"><span class="slider"></span></label></div>
          <div class="glass-list-item"><span class="item-label">允许查看表情包图像</span><label class="switch"><input v-model="group.memberSettings[editingMemberId].enableEmojiVision" type="checkbox"><span class="slider"></span></label></div>
          <div class="glass-list-item"><span class="item-label">根据表情包图形发送</span><label class="switch"><input v-model="group.memberSettings[editingMemberId].enableRoleEmojiVision" type="checkbox"><span class="slider"></span></label></div>
          <div class="glass-list-item"><span class="item-label">引用该成员单人表情包</span><label class="switch"><input v-model="group.memberEmojiLibraryEnabled[editingMemberId]" type="checkbox" :disabled="!group.referenceMemberEmojiLibraries"><span class="slider"></span></label></div>
          <div class="glass-list-item"><span class="item-label">沉浸式状态与时间流逝</span><label class="switch"><input v-model="group.memberSettings[editingMemberId].enableImmersiveStatus" type="checkbox"><span class="slider"></span></label></div>
          <div class="glass-list-item" @click="emit('open-member-settings', editingMemberId)"><div><div class="item-label">语音与生图详细配置</div><div class="group-item-desc">参数继承自该成员单聊设置</div></div><div class="item-value"><span class="item-value-text">前往私聊配置</span><span class="arrow">›</span></div></div>
        </div>
        <div class="group-remove-member" :class="{ disabled: group.memberIds.length <= 2 }" @click="removeMember(editingMemberId)">移出群聊</div>
        <div class="confirm-actions"><div class="confirm-btn cancel" @click="editingMemberId = ''">取消</div><div class="confirm-btn" @click="handleSaveMember">保存</div></div>
      </div>
    </div>

    <div v-if="showUserEditor" class="wb-modal-overlay" @click.self="showUserEditor = false">
      <div class="custom-confirm-modal group-member-editor">
        <div class="confirm-title">我在本群的身份</div>
        <div class="group-modal-fields scrollable-fields">
          <div class="group-field avatar-edit-field">
            <span>本群专属头像</span>
            <div class="avatar-edit-actions">
              <div class="avatar-preview-box" @click="triggerUserAvatarUpload" :style="userAvatarData ? { backgroundImage: `url(${userAvatarData})` } : (editingUser.avatarUrl ? { backgroundImage: `url(${editingUser.avatarUrl})` } : {})">
                <span v-if="!userAvatarData && !editingUser.avatarUrl">{{ editingUser.name?.charAt(0) || '我' }}</span>
                <div class="avatar-edit-mask">更换</div>
              </div>
              <div class="avatar-reset-btn" v-if="userAvatarData" @click="resetUserAvatar">恢复默认</div>
            </div>
            <input ref="userAvatarInput" type="file" accept="image/*" class="group-hidden-file" @change="handleUserAvatarUpload">
          </div>
          <label class="group-field"><span>本群昵称</span><input v-model="editingUser.name" class="group-settings-input" placeholder="输入本群称呼"></label>
          <label class="group-field"><span>本群独立人设</span><textarea v-model="editingUser.persona" class="group-settings-textarea" rows="7" placeholder="此人设完全替换全局的基础人设，仅在本群生效。"></textarea></label>
        </div>
        <div class="confirm-actions"><div class="confirm-btn cancel" @click="showUserEditor = false">取消</div><div class="confirm-btn" @click="handleSaveUser">保存</div></div>
      </div>
    </div>

    <div v-if="showUserSyncConfirm" class="wb-modal-overlay" @click.self="confirmSaveUser(false)">
      <div class="custom-confirm-modal">
        <div class="confirm-title">是否同步全局用户资料？</div>
        <div class="confirm-desc">你修改了“我”的群内人设或头像。是否需要将这份新的设定同步覆盖全局的基础资料？（注意：用户全局头像暂不支持在群聊同步更新）</div>
        <div class="confirm-actions" style="flex-direction: column; gap: 8px;">
          <div class="confirm-btn cancel" style="width: 100%; border-right: none;" @click="confirmSaveUser(true)">同时同步全局基础资料</div>
          <div class="confirm-btn" style="width: 100%;" @click="confirmSaveUser(false)">仅在本群生效</div>
        </div>
      </div>
    </div>

    <div v-if="showSyncConfirm" class="wb-modal-overlay" @click.self="confirmSaveMember(false)">
      <div class="custom-confirm-modal">
        <div class="confirm-title">是否同步到私聊？</div>
        <div class="confirm-desc">你修改了该角色的群内人设或头像。是否需要将这份新的设定同步覆盖他原本的私聊基础资料？</div>
        <div class="confirm-actions" style="flex-direction: column; gap: 8px;">
          <div class="confirm-btn" style="width: 100%; border-right: none;" @click="confirmSaveMember(false)">仅在本群生效</div>
          <div class="confirm-btn cancel" style="width: 100%;" @click="confirmSaveMember(true)">同时同步到私聊</div>
        </div>
      </div>
    </div>

    <div v-if="showClearConfirm" class="wb-modal-overlay" @click.self="showClearConfirm = false"><div class="custom-confirm-modal"><div class="confirm-title">清空群聊？</div><div class="confirm-desc">聊天记录和本群独立记忆将被删除，角色私聊记忆不会被清空。</div><div class="confirm-actions"><div class="confirm-btn cancel" @click="showClearConfirm = false">取消</div><div class="confirm-btn danger" @click="clearHistory">清空</div></div></div></div>
    <div v-if="showDeleteConfirm" class="wb-modal-overlay" @click.self="showDeleteConfirm = false"><div class="custom-confirm-modal"><div class="confirm-title">删除群聊？</div><div class="confirm-desc">此操作会删除群聊记录和本群记忆，不会删除任何角色。</div><div class="glass-list-item"><span class="item-label">同时删除本群共用表情包</span><label class="switch"><input v-model="deleteGroupEmojiData" type="checkbox"><span class="slider"></span></label></div><div class="confirm-actions"><div class="confirm-btn cancel" @click="showDeleteConfirm = false">取消</div><div class="confirm-btn danger" @click="removeGroup">删除</div></div></div></div>

    <ChatMemoryTypeModal
      v-model:visible="showMemoryTypeModal"
      :current-type="group.memoryType"
      @select="(type: 'round'|'count') => { group.memoryType = type; save(); showMemoryTypeModal = false }"
    />

    <ChatMemoryValueModal
      v-model:visible="showMemoryValueModal"
      :memory-type="group.memoryType"
      :initial-value="String(group.memoryValue || '')"
      @save="(val: number | null) => { group.memoryValue = val || 60; save(); showMemoryValueModal = false }"
    />

    <AvatarUploadModal
      v-model:visible="showGroupAvatarModal"
      :current-avatar="customGroupAvatar"
      shape="circle"
      title="更换群头像"
      @saved="handleGroupAvatarSaved"
    />
    <ChatBilingualOptionModal v-model:visible="showBilingualOptionModal" :title="bilingualOptionTitle" :current-value="bilingualOptionValue" :options="bilingualOptionChoices" @select="selectBilingualOption" />
    <ChatDialogueLanguageModal v-model:visible="showBilingualLanguageModal" :kind="bilingualLanguageKind" :current-language="bilingualLanguageKind === 'output' ? group.dialogueLanguage : group.translationLanguage" :custom-language="bilingualLanguageKind === 'output' ? group.customDialogueLanguage : group.customTranslationLanguage" @select="selectBilingualLanguage" />
    <ChatTimezoneModal v-model:visible="showTimezoneModal" @select="selectTimezone" />
    <ChatMsgCountModal v-model:visible="showMsgCountModal" :initial-min="group.minMsgCount || 1" :initial-max="group.maxMsgCount || 3" @save="saveMsgCount" />
    <ChatOfflinePresetModal :visible="showOfflinePresetModal" :selected-chat="group" @close="showOfflinePresetModal = false" @save="save" />
    <ChatBilingualOptionModal v-model:visible="showGroupOptionModal" :title="groupOptionTitle" :current-value="groupOptionValue" :options="groupOptionChoices" @select="selectGroupOption" />
    <ChatTokenStatsModal v-model:visible="showTokenStatsModal" />
    <ChatTransferPreviewModal v-model:visible="showTransferPreview" :current-style="chatSettings.transferStyle || 'wechat'" @save="handleSaveTransferStyle" />
    <ChatAvatarDisplayModal v-model:visible="showAvatarDisplayModal" @save="handleSaveAvatarDisplayStyle" />
    <ChatNameDisplayModal v-model:visible="showNameDisplayModal" @save="handleSaveNameDisplayStyle" />
    <ChatTimeDisplayModal :show="showTimeDisplayModal" :initial-style="(chatSettings.timeDisplayStyle as 'none' | 'hm' | 'hms') || 'none'" :initial-position="(chatSettings.timeDisplayPosition as 'avatar_bottom' | 'bubble_outer' | 'name_side') || 'avatar_bottom'" @close="showTimeDisplayModal = false" @save="handleSaveTimeDisplayStyle" />
    <Teleport to="body"><ChatBubbleBeautifyModal v-if="showBubbleBeautifyModal" @close="showBubbleBeautifyModal = false" /></Teleport>
    <transition name="fade"><ChatCallRecordsView v-if="showCallRecordsView" :records="group.callSummaries || []" @close="showCallRecordsView = false" @delete="deleteGroupCallRecords" @resummarize="resummarizeGroupCallRecord" /></transition>
    <ChatEmojiView v-if="showEmojiView" mode="group" :group-id="group.id" @close="showEmojiView = false" />
    <ChatIdentityProfileModal v-model:visible="showIdentityProfileModal" owner-type="user" :owner-id="identityUserOwnerId" :owner-name="group.userProfile?.name || '我'" :owner-avatar="group.userProfile?.avatarUrl || ''" :provider="groupIdentityProvider" :available-characters="chats" />

    <!-- 群管理、头衔、成员与公告弹窗组件 -->
    <GroupMemberListModal
      :visible="showMemberListModal"
      :members="groupMgmt.membersViewModel.value"
      :permissions="groupMgmt.currentUserPermissions.value"
      @close="showMemberListModal = false"
      @select-member="(m) => { selectedMemberForDetail = m; showMemberDetailModal = true }"
      @add-members="showMemberListModal = false; showAddMembers = true"
    />

    <GroupMemberDetailModal
      :visible="showMemberDetailModal"
      :member="selectedMemberForDetail"
      :permissions="groupMgmt.currentUserPermissions.value"
      @close="showMemberDetailModal = false"
      @promote="groupMgmt.promoteMember"
      @demote="groupMgmt.demoteAdmin"
      @transfer="groupMgmt.transferOwnership"
      @mute="({ memberId, durationSeconds, reason }) => groupMgmt.muteMember(memberId, durationSeconds, reason)"
      @unmute="groupMgmt.unmuteMember"
      @kick="groupMgmt.removeMember"
      @update-nickname="({ memberId, nickname }) => groupMgmt.updateMyGroupNickname(memberId, nickname)"
    />

    <GroupAdminManagementModal
      :visible="showAdminManagementModal"
      :is-whole-group-muted="Boolean(group.isWholeGroupMuted)"
      :ai-mode="group.aiManagementMode || 'off'"
      :level-titles="groupMgmt.levelTitleConfigs.value"
      :logs="groupMgmt.adminLogs.value"
      :permissions="groupMgmt.currentUserPermissions.value"
      @close="showAdminManagementModal = false"
      @toggle-whole-mute="groupMgmt.setWholeGroupMute"
      @change-ai-mode="groupMgmt.setAiManagementMode"
      @save-level-titles="groupMgmt.updateLevelTitles"
      @refresh-logs="groupMgmt.loadAdminLogs"
      @delete-logs="groupMgmt.deleteAdminLogs"
      @recover-ownership="groupMgmt.recoverOwnership"
    />

    <GroupAnnouncementListModal
      :visible="showAnnouncementListModal"
      :announcements="groupMgmt.announcementsViewModel.value"
      :permissions="groupMgmt.currentUserPermissions.value"
      :is-loading="groupMgmt.isLoading.value"
      @close="showAnnouncementListModal = false"
      @select="(a) => { selectedAnnouncement = a; showAnnouncementDetailModal = true; groupMgmt.markAnnouncementRead(a.id) }"
      @create="showAnnouncementEditModal = true"
    />

    <GroupAnnouncementDetailModal
      :visible="showAnnouncementDetailModal"
      :announcement="selectedAnnouncement"
      :permissions="groupMgmt.currentUserPermissions.value"
      @close="showAnnouncementDetailModal = false"
      @confirm="groupMgmt.confirmAnnouncement"
      @edit="(a) => { selectedAnnouncement = a; showAnnouncementDetailModal = false; showAnnouncementEditModal = true }"
      @delete="(id) => { groupMgmt.deleteAnnouncement(id); showAnnouncementDetailModal = false }"
    />

    <GroupAnnouncementEditModal
      :visible="showAnnouncementEditModal"
      :announcement="selectedAnnouncement"
      @close="showAnnouncementEditModal = false; selectedAnnouncement = null"
      @save="(payload) => { selectedAnnouncement ? groupMgmt.updateAnnouncement(selectedAnnouncement.id, payload) : groupMgmt.publishAnnouncement(payload); showAnnouncementEditModal = false; selectedAnnouncement = null }"
    />
    <transition name="toast-fade"><div v-if="groupMgmt.errorMessage.value || groupMgmt.toastMessage.value" class="settings-toast">{{ groupMgmt.errorMessage.value || groupMgmt.toastMessage.value }}</div></transition>
  </div>
</template>

<style scoped src="./GroupChatSettingsView.css"></style>
