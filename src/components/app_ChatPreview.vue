/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import AvatarUploadModal from './AvatarUploadModal.vue'
import AppChatDiscover from './app_ChatDiscover.vue'
import AppChatContacts from './app_ChatContacts.vue'
import AppChatProfile from './app_ChatProfile.vue'
import ChatListView from './chat/ChatListView.vue'
import ChatRoomView from './chat/ChatRoomView.vue'
import ChatSettingsView from './chat/ChatSettingsView.vue'
import ChatOfflineMeetView from './chat/ChatOfflineMeetView.vue'
import ChatFriendRequestsView from './chat/ChatFriendRequestsView.vue'
import ChatRelationshipView from './chat/ChatRelationshipView.vue'
import CharacterAutonomyView from './chat/CharacterAutonomyView.vue'
import ChatAuthView from './chat/ChatAuthView.vue'
import { useChatState } from '../composables/useChatState'
import { useChatAuth } from '../composables/useChatAuth'
import { useChatSettingsSave } from '../composables/useChatSettingsSave'
import { processDueRelationshipTimers } from '../composables/useChatRelationship'
import { useRelationshipAdvance } from '../composables/useRelationshipAdvance'
import { persistAutonomyChat, runDueAutonomyChecks } from '../services/characterAutonomy'
import {
  applyUserProfileToChat,
  loadUserPersonas,
  personaToSnapshot
} from '../composables/useChatUserProfiles'

const props = withDefaults(defineProps<{
  isActive?: boolean
}>(), {
  isActive: false
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'voice-call-state-change', state: VoiceCallState): void
}>()

const {
  selectedChat,
  mockChats,
  myProfile,
  effectiveMyProfile,
  avatarStore,
  activeGroup,
  totalUnreadCount,
  setActiveChatContext,
  loadCustomContacts,
  loadMyProfile
} = useChatState()

type ViewType = 'list' | 'chat' | 'profile' | 'discover' | 'contacts' | 'friendRequests' | 'relationship' | 'autonomy' | 'createUserPersona' | 'personaLibrary' | 'chatSettings' | 'chatAppearance' | 'notificationSettings' | 'offlineMeet'
type VoiceCallState = {
  active: boolean
  minimized: boolean
  status: 'idle' | 'calling' | 'incoming' | 'connected' | 'ended'
  durationStr: string
  charName: string
  charAvatar: string
  chatId?: string | number
}

const currentView = ref<ViewType>('list')
const pageIsVisible = ref(document.visibilityState === 'visible')
const activeTab = ref('消息')
const tabs = ['消息', '联系人', '发现', '我的']

const previousView = ref<ViewType>('list')
const relationshipBackView = ref<ViewType>('chatSettings')
const hasOpenedChat = ref(false)
const chatRoomRef = ref<any>(null)
const voiceCallState = ref<VoiceCallState>({
  active: false,
  minimized: false,
  status: 'idle',
  durationStr: '00:00',
  charName: '未知联系人',
  charAvatar: ''
})

const { currentChatUserId } = useChatAuth()
const { saveCurrentChat } = useChatSettingsSave()
const { advanceRelationship: advanceScheduledRelationship } = useRelationshipAdvance()
let relationshipTimer: number | null = null
let autonomyTimer: number | null = null

const reconcileRelationshipTimers = () => {
  const due = processDueRelationshipTimers()
  const next = due[0]
  if (next) advanceScheduledRelationship(next, 'scheduled_review').catch(() => {})
}

const reconcileAutonomy = () => {
  pageIsVisible.value = document.visibilityState === 'visible'
  if (!pageIsVisible.value) return
  void runDueAutonomyChecks('resume')
}

const characterContextViews = new Set<ViewType>(['chat', 'chatSettings', 'autonomy', 'relationship', 'offlineMeet'])

watch(
  [() => props.isActive, pageIsVisible, currentView, () => selectedChat.value?.id, () => selectedChat.value?.unread],
  ([appActive, visible, view]) => {
    const inCharacterContext = Boolean(appActive && visible && characterContextViews.has(view as ViewType) && selectedChat.value)
    setActiveChatContext(inCharacterContext ? selectedChat.value.id : null)
    if (inCharacterContext && selectedChat.value.unread > 0) {
      selectedChat.value.unread = 0
      persistAutonomyChat(selectedChat.value)
    }
  },
  { immediate: true, flush: 'sync' }
)

const isGlobalCallWidgetVisible = computed(() => {
  return !!currentChatUserId.value && voiceCallState.value.active && currentView.value !== 'chat'
})

// 全局通话悬浮窗拖拽状态
const globalWidgetX = ref(typeof window !== 'undefined' ? window.innerWidth - 180 : 16)
const globalWidgetY = ref(64)
const isDraggingGlobalWidget = ref(false)
const globalWidgetHasMoved = ref(false)
let globalWidgetStartX = 0
let globalWidgetStartY = 0
let globalWidgetInitialX = 0
let globalWidgetInitialY = 0

const initGlobalCallWidgetPosition = () => {
  const widgetWidth = 140
  globalWidgetX.value = Math.max(16, window.innerWidth - widgetWidth - 16)
  globalWidgetY.value = Math.min(globalWidgetY.value || 64, Math.max(64, window.innerHeight - 56))
}

const globalCallWidgetStyle = computed(() => ({
  transform: `translate3d(${globalWidgetX.value}px, ${globalWidgetY.value}px, 0)`,
  transition: isDraggingGlobalWidget.value ? 'none' : 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  willChange: 'transform'
}))

const onGlobalWidgetPointerStart = (e: TouchEvent | MouseEvent) => {
  isDraggingGlobalWidget.value = true
  globalWidgetHasMoved.value = false
  const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
  globalWidgetStartX = clientX
  globalWidgetStartY = clientY
  globalWidgetInitialX = globalWidgetX.value
  globalWidgetInitialY = globalWidgetY.value
}

const onGlobalWidgetPointerMove = (e: TouchEvent | MouseEvent) => {
  if (!isDraggingGlobalWidget.value) return
  const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
  const deltaX = clientX - globalWidgetStartX
  const deltaY = clientY - globalWidgetStartY
  
  if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
    globalWidgetHasMoved.value = true
  }
  
  if (globalWidgetHasMoved.value) {
    if (e.cancelable) e.preventDefault()
    const target = e.currentTarget as HTMLElement
    const widgetWidth = target?.offsetWidth || 140
    const widgetHeight = target?.offsetHeight || 50
    const maxX = window.innerWidth - widgetWidth
    const maxY = window.innerHeight - widgetHeight
    
    globalWidgetX.value = Math.max(0, Math.min(globalWidgetInitialX + deltaX, maxX))
    globalWidgetY.value = Math.max(0, Math.min(globalWidgetInitialY + deltaY, maxY))
  }
}

const onGlobalWidgetPointerEnd = (e: TouchEvent | MouseEvent) => {
  if (!isDraggingGlobalWidget.value) return
  isDraggingGlobalWidget.value = false
  
  nextTick(() => {
    const target = e.currentTarget as HTMLElement
    const widgetWidth = target?.offsetWidth || 140
    const centerX = globalWidgetX.value + widgetWidth / 2
    globalWidgetX.value = centerX < window.innerWidth / 2 ? 16 : window.innerWidth - widgetWidth - 16
  })
}

const restoreGlobalVoiceCall = async () => {
  if (globalWidgetHasMoved.value) return
  currentView.value = 'chat'
  activeTab.value = '消息'
  await nextTick()
  chatRoomRef.value?.restoreVoiceCall?.()
}

const endGlobalVoiceCall = () => {
  chatRoomRef.value?.endVoiceCall?.()
}

const openChatFromOutside = async (contactId: string | number) => {
  await loadCustomContacts()
  const chat = mockChats.value.find((item: any) => String(item.id) === String(contactId))
  if (!chat) return false
  hasOpenedChat.value = true
  selectedChat.value = chat
  activeTab.value = '消息'
  currentView.value = 'chat'
  return true
}

const handleVoiceCallStateChange = (state: VoiceCallState) => {
  voiceCallState.value = state
  emit('voice-call-state-change', state)
}

defineExpose({
  restoreVoiceCallFromOutside: restoreGlobalVoiceCall,
  endVoiceCallFromOutside: endGlobalVoiceCall,
  openChatFromOutside
})

// 新建联系人状态
const createContactVisible = ref(false)
const newContactForm = ref({
  id: '',
  name: '',
  remark: '',
  persona: '',
  avatarKey: ''
})
const newContactAvatarUrl = ref<string | null>(null)

// 头像与人设弹窗状态
const avatarModalVisible = ref(false)
const avatarTarget = ref<'contact' | 'me'>('contact')
const personaSelectVisible = ref(false)
const savedPersonas = ref<any[]>([])

const currentAvatarForModal = computed(() => {
  if (currentView.value === 'chatSettings') {
    return avatarTarget.value === 'me' ? effectiveMyProfile.value.avatarUrl : selectedChat.value?.avatarUrl
  }
  return newContactAvatarUrl.value
})

const switchTab = (tab: string) => {
  activeTab.value = tab
  if (tab === '我的') {
    currentView.value = 'profile'
  } else if (tab === '消息') {
    currentView.value = 'list'
  } else if (tab === '发现') {
    currentView.value = 'discover'
  } else if (tab === '联系人') {
    currentView.value = 'contacts'
  }
}

const openOfflineMeet = () => {
  if (!selectedChat.value?.offlineMeetEnabled) return
  currentView.value = 'offlineMeet'
}

const openRelationship = (chat = selectedChat.value, backView: ViewType = currentView.value) => {
  if (!chat) return
  selectedChat.value = chat
  relationshipBackView.value = backView
  currentView.value = 'relationship'
}

const handleOfflineMeetBack = () => {
  currentView.value = 'chat'
}

const openChat = (chat: any) => {
  if (voiceCallState.value.active && voiceCallState.value.chatId !== undefined && chat.id !== voiceCallState.value.chatId) {
    currentView.value = 'chat'
    activeTab.value = '消息'
    nextTick(() => chatRoomRef.value?.restoreVoiceCall?.())
    return
  }
  hasOpenedChat.value = true
  selectedChat.value = chat
  currentView.value = 'chat'
}

const handleProfileViewUpdate = (newView: ViewType | 'profile_from_create_save' | 'profile_from_create_cancel') => {
  if (newView === 'profile_from_create_save' || newView === 'profile_from_create_cancel') {
    // 根据上一级状态决定去哪里
    if (previousView.value === 'chatSettings') {
      currentView.value = 'chatSettings'
      if (newView === 'profile_from_create_save') {
        loadMyProfile()
      }
    } else {
      currentView.value = 'profile'
    }
    return
  }
  currentView.value = newView as ViewType
}

// 事件处理器
const openCreateContact = () => {
  newContactForm.value = {
    id: 'contact_' + Date.now(),
    name: '',
    remark: '',
    persona: '',
    avatarKey: 'avatar_contact_' + Date.now()
  }
  newContactAvatarUrl.value = null
  createContactVisible.value = true
}

const cancelCreateContact = () => {
  createContactVisible.value = false
}

const saveContact = async () => {
  if (!newContactForm.value.name) return
  
  const actualId = newContactForm.value.id
  if (newContactAvatarUrl.value) {
    await avatarStore.setItem(`avatar_contact_${actualId}`, newContactAvatarUrl.value)
  } else {
    await avatarStore.removeItem(`avatar_contact_${actualId}`)
  }
  
  const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
  const savedStr = localStorage.getItem(contactsKey)
  const savedContacts = savedStr ? JSON.parse(savedStr) : []
  const initialGroups = activeGroup.value !== '全部' ? [activeGroup.value] : []
  savedContacts.push({ ...newContactForm.value, isPinned: false, groups: initialGroups })
  localStorage.setItem(contactsKey, JSON.stringify(savedContacts))
  
  await loadCustomContacts()
  createContactVisible.value = false
}

const handleAvatarSaved = async (url: string | null) => {
  if (currentView.value === 'chatSettings') {
    if (avatarTarget.value === 'me') {
      if (selectedChat.value) {
        const snapshot = {
          name: effectiveMyProfile.value.name || '',
          remark: effectiveMyProfile.value.remark || '',
          persona: effectiveMyProfile.value.persona || '',
          avatarUrl: url || ''
        }
        const source = selectedChat.value.userProfileSource || { type: 'custom', name: '独立人设' }
        applyUserProfileToChat(selectedChat.value, snapshot, {
          ...source,
          hasLocalChanges: source.type !== 'custom'
        })
        await saveCurrentChat()
      }
    } else if (avatarTarget.value === 'contact' && selectedChat.value) {
      selectedChat.value.avatarUrl = url || ''
      selectedChat.value.avatarText = url ? '' : ((selectedChat.value.realName || selectedChat.value.name).charAt(0) || '伴')
      
      // 不管原来有没有 avatarKey，统统使用统一的键名存储
      try {
        const key = `avatar_contact_${selectedChat.value.id}`
        if (url) {
          await avatarStore.setItem(key, url)
        } else {
          await avatarStore.removeItem(key)
        }
      } catch (e) {
        console.error('Failed to save avatar to IndexedDB', e)
      }
      
      // 更新 localStorage 数据同步名字和状态
      const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
      const savedStr = localStorage.getItem(contactsKey)
      if (savedStr) {
        let contacts = JSON.parse(savedStr)
        const c = contacts.find((x: any) => x.id === selectedChat.value.id)
        if (c) {
          c.avatarKey = `avatar_contact_${selectedChat.value.id}` // 为旧代码兜个底，加上这个字段
          localStorage.setItem(contactsKey, JSON.stringify(contacts))
        }
      }
    }
  } else {
    newContactAvatarUrl.value = url
  }
}

const openAvatarUpload = (target: 'contact' | 'me') => {
  avatarTarget.value = target
  avatarModalVisible.value = true
}

const openPersonaSelect = async () => {
  savedPersonas.value = await loadUserPersonas()
  personaSelectVisible.value = true
}

const selectPersona = async (p: any) => {
  if (!selectedChat.value) return
  const isAccountPersona = p.boundAccountId === currentChatUserId.value
  applyUserProfileToChat(selectedChat.value, personaToSnapshot(p), {
    type: isAccountPersona ? 'account' : 'library',
    personaId: p.id,
    name: p.name || p.networkName || '未命名人设'
  })
  await saveCurrentChat()
  personaSelectVisible.value = false
}

const useAccountPersona = async () => {
  const personas = await loadUserPersonas()
  const boundPersona = personas.find(item => item.boundAccountId === currentChatUserId.value)
  if (!boundPersona) {
    window.alert('当前账号还没有绑定人设，请先在“我的－人设库”中绑定。')
    return
  }
  await selectPersona(boundPersona)
}

const handleCreateUserPersona = () => {
  previousView.value = currentView.value
  currentView.value = 'createUserPersona'
}

const handleLoginSuccess = () => {
  loadCustomContacts()
  loadMyProfile()
  setTimeout(reconcileAutonomy, 800)
}

onMounted(async () => {
  initGlobalCallWidgetPosition()
  window.addEventListener('resize', initGlobalCallWidgetPosition)
  if (currentChatUserId.value) {
    await loadCustomContacts()
    loadMyProfile()
  }
  reconcileRelationshipTimers()
  relationshipTimer = window.setInterval(reconcileRelationshipTimers, 30000)
  document.addEventListener('visibilitychange', reconcileRelationshipTimers)
  autonomyTimer = window.setInterval(() => void runDueAutonomyChecks('scheduled'), 60000)
  document.addEventListener('visibilitychange', reconcileAutonomy)
  setTimeout(reconcileAutonomy, 500)
})

onUnmounted(() => {
  setActiveChatContext(null)
  window.removeEventListener('resize', initGlobalCallWidgetPosition)
  if (relationshipTimer) window.clearInterval(relationshipTimer)
  document.removeEventListener('visibilitychange', reconcileRelationshipTimers)
  if (autonomyTimer) window.clearInterval(autonomyTimer)
  document.removeEventListener('visibilitychange', reconcileAutonomy)
})
</script>

<template>
  <div class="app-chat-wrapper">
    <div class="global-texture"></div>

    <!-- 登录注册拦截 -->
    <ChatAuthView 
      v-if="!currentChatUserId" 
      @login-success="handleLoginSuccess" 
      @close="emit('close')" 
    />

    <template v-else>
      <!-- 底部 TabBar -->
    <footer v-show="!['chat', 'personaLibrary', 'createUserPersona', 'chatSettings', 'offlineMeet', 'friendRequests', 'relationship', 'autonomy'].includes(currentView)" class="floating-tabbar glass">
      <div 
        v-for="tab in tabs" 
        :key="tab"
        class="tab-item"
        :class="{ active: activeTab === tab }"
        @click="switchTab(tab)"
      >
        <span class="tab-text">{{ tab }}</span>
        <div class="tab-dot" v-if="activeTab === tab && (tab !== '消息' || totalUnreadCount === 0)"></div>
        <div class="tab-unread-dot" v-if="tab === '消息' && totalUnreadCount > 0">{{ totalUnreadCount > 99 ? '99+' : totalUnreadCount }}</div>
      </div>
    </footer>

    <!-- 1. 列表视图 -->
    <ChatListView 
      v-if="currentView === 'list'" 
      @close="emit('close')" 
      @open-create-contact="openCreateContact"
      @open-chat="openChat"
    />

    <!-- 2. 聊天视图 -->
    <ChatRoomView 
      v-if="hasOpenedChat"
      v-show="currentView === 'chat'"
      :is-visible="props.isActive && currentView === 'chat'"
      ref="chatRoomRef"
      @back="currentView = 'list'"
      @open-settings="currentView = 'chatSettings'"
      @open-relationship="openRelationship(selectedChat, 'chat')"
      @open-offline-meet="openOfflineMeet"
      @voice-call-state-change="handleVoiceCallStateChange"
    />

    <!-- 3. 设置视图 -->
    <ChatSettingsView 
      v-if="currentView === 'chatSettings'"
      @back="currentView = 'chat'"
      @open-avatar-upload="openAvatarUpload"
      @open-persona-select="openPersonaSelect"
      @use-account-persona="useAccountPersona"
      @create-user-persona="handleCreateUserPersona"
      @open-offline-meet="openOfflineMeet"
      @open-relationship="openRelationship(selectedChat, 'chatSettings')"
      @open-autonomy="currentView = 'autonomy'"
    />

    <CharacterAutonomyView
      v-if="currentView === 'autonomy' && selectedChat"
      :chat="selectedChat"
      @back="currentView = 'chatSettings'"
      @save="saveCurrentChat"
    />

    <ChatOfflineMeetView
      v-if="currentView === 'offlineMeet'"
      @back="handleOfflineMeetBack"
    />

    <!-- 4. 发现视图 -->
    <AppChatDiscover v-if="currentView === 'discover'" />

    <!-- 5. 联系人视图 -->
    <AppChatContacts v-if="currentView === 'contacts'" @close="emit('close')" @open-friend-requests="currentView = 'friendRequests'" />

    <ChatFriendRequestsView
      v-if="currentView === 'friendRequests'"
      @back="currentView = 'contacts'"
      @open-relationship="chat => openRelationship(chat, 'friendRequests')"
    />

    <ChatRelationshipView
      v-if="currentView === 'relationship' && selectedChat"
      :chat="selectedChat"
      @back="currentView = relationshipBackView"
    />

    <!-- 6. 我的及人设视图 -->
    <AppChatProfile 
      v-if="['profile', 'createUserPersona', 'personaLibrary', 'chatAppearance', 'notificationSettings'].includes(currentView)" 
      :current-view="currentView as 'profile' | 'createUserPersona' | 'personaLibrary' | 'chatAppearance' | 'notificationSettings'" 
      @update:current-view="handleProfileViewUpdate"
    />

    <!-- 全局语音通话悬浮窗：切到 App 其他界面时保持通话不中断 -->
    <transition name="fade">
      <div
        v-if="isGlobalCallWidgetVisible"
        class="global-call-widget"
        :style="globalCallWidgetStyle"
        @click="restoreGlobalVoiceCall"
        @touchstart="onGlobalWidgetPointerStart"
        @touchmove="onGlobalWidgetPointerMove"
        @touchend="onGlobalWidgetPointerEnd"
        @mousedown="onGlobalWidgetPointerStart"
        @mousemove="onGlobalWidgetPointerMove"
        @mouseup="onGlobalWidgetPointerEnd"
        @mouseleave="onGlobalWidgetPointerEnd"
      >
        <div class="gc-avatar" :style="{ backgroundImage: `url(${voiceCallState.charAvatar || ''})` }">
          <div class="gc-ripple"></div>
        </div>
        <div class="gc-info">
          <div class="gc-name">{{ voiceCallState.charName }}</div>
          <div class="gc-status" :class="{ calling: voiceCallState.status === 'calling' || voiceCallState.status === 'incoming' }">
            {{ voiceCallState.status === 'calling' ? '等待接听...' : (voiceCallState.status === 'incoming' ? '来电中...' : voiceCallState.durationStr) }}
          </div>
        </div>
        <div class="gc-end-btn" @click.stop="endGlobalVoiceCall">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(135deg);">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
        </div>
      </div>
    </transition>

    <!-- 无界档案画布创建页 (新建联系人) -->
    <div v-if="createContactVisible" class="canvas-modal-overlay" @click.self="cancelCreateContact">
      <div class="canvas-modal-content">
        
        <div class="canvas-meta-header">
          <div class="canvas-meta">
            <span>SEQ-{{ String(Date.now()).slice(-6) }}</span>
            <span>·</span>
            <span>角色档案建立</span>
          </div>
          <div class="canvas-close-btn" @click="cancelCreateContact">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </div>

        <div class="canvas-header">
          <div class="canvas-portrait" 
               :style="newContactAvatarUrl ? { backgroundImage: `url(${newContactAvatarUrl})` } : {}"
               @click="avatarModalVisible = true">
            <span v-if="!newContactAvatarUrl" class="portrait-placeholder">上传头像</span>
          </div>
          <div class="canvas-names">
            <input type="text" v-model="newContactForm.name" class="canvas-h1" placeholder="角色名称" />
            <input type="text" v-model="newContactForm.remark" class="canvas-sub" placeholder="备注 / 别名" />
          </div>
        </div>

        <div class="canvas-divider"></div>

        <div class="canvas-body">
          <div class="canvas-label">详细人设与背景</div>
          <textarea v-model="newContactForm.persona" class="canvas-textarea" placeholder="赋予这个角色灵魂..."></textarea>
        </div>

        <div class="canvas-fab" :class="{ 'disabled': !newContactForm.name }" @click="saveContact">
          保存档案
        </div>
      </div>
    </div>

    <!-- 人设库选择弹窗 -->
    <div v-if="personaSelectVisible" class="canvas-modal-overlay" @click.self="personaSelectVisible = false">
      <div class="canvas-modal-content" style="max-height: 400px; padding: 20px;">
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px; text-align: center;">选择人设</div>
        <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;">
          <div v-if="savedPersonas.length === 0" style="text-align: center; color: var(--text-tertiary); font-size: 13px; margin-top: 20px;">暂无人设，请先在“我的”页面创建</div>
          <div 
            v-for="p in savedPersonas" 
            :key="p.id" 
            style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--sys-bg-primary); border-radius: 8px; cursor: pointer;"
            @click="selectPersona(p)"
          >
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; background-size: cover; background-position: center;" :style="p.avatar ? { backgroundImage: `url(${p.avatar})` } : {}">{{ p.avatar ? '' : (p.name?.charAt(0) || '我') }}</div>
            <div style="flex: 1; font-size: 15px; font-weight: 500;">{{ p.name }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 头像上传弹窗 -->
      <Teleport to="body">
        <AvatarUploadModal 
          v-model:visible="avatarModalVisible" 
          :current-avatar="currentAvatarForModal"
          :shape="currentView === 'chatSettings' ? 'circle' : 'portrait'"
          @saved="handleAvatarSaved" 
        />
      </Teleport>
    </template>

  </div>
</template>

<style scoped>
@import './app_ChatPreview.css';

.tab-unread-dot {
  position: absolute;
  top: 6px;
  right: calc(50% - 24px);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #ff3b30;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  box-sizing: border-box;
}

.global-call-widget {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  width: 140px;
  height: 50px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 25px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
}

.gc-avatar {
  position: relative;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background-color: #e2e8f0;
  background-size: cover;
  background-position: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.gc-ripple {
  position: absolute;
  inset: -3px;
  border: 1px solid rgba(107, 144, 128, 0.45);
  border-radius: 50%;
  animation: gcRipple 1.8s infinite ease-out;
}

.gc-info {
  min-width: 0;
  flex: 1;
  margin-left: 8px;
}

.gc-name {
  overflow: hidden;
  color: #2d3748;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gc-status {
  margin-top: 2px;
  color: #6b9080;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.gc-status.calling {
  color: #e26d5c;
  font-size: 11px;
}

.gc-end-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-left: 6px;
  border-radius: 50%;
  background: #e26d5c;
  box-shadow: 0 4px 10px rgba(226, 109, 92, 0.28);
}

.gc-end-btn:active {
  transform: scale(0.92);
}

@keyframes gcRipple {
  0% {
    transform: scale(1);
    opacity: 0.75;
  }
  100% {
    transform: scale(1.35);
    opacity: 0;
  }
}
</style>
