/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatState } from '../../composables/useChatState'
import { globalSettings } from '../../store'
import PersonaImportModal from '../PersonaImportModal.vue'

// -- 拆分出的 Composable --
import { useChatListMultiSelect } from '../../composables/useChatListMultiSelect'
import { useChatListGroups } from '../../composables/useChatListGroups'
import { useChatAuth } from '../../composables/useChatAuth'

// -- 拆分出的 Modals --
import ChatListActionMenuModal from './modals/ChatListActionMenuModal.vue'
import ChatListGroupManageModal from './modals/ChatListGroupManageModal.vue'
import ChatListAssignGroupModal from './modals/ChatListAssignGroupModal.vue'
import ChatListCreateChoiceModal from './modals/ChatListCreateChoiceModal.vue'
import ChatAccountSwitchModal from './modals/ChatAccountSwitchModal.vue'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-create-contact'): void
  (e: 'open-chat', chat: any): void
}>()

const { 
  mockChats, 
  customGroups, 
  activeGroup, 
  sortChats, 
  deleteChats,
  loadCustomContacts,
  avatarStore
} = useChatState()

const groups = computed(() => ['全部', ...customGroups.value])
type SidebarFilter = 'all' | 'unread' | 'pinned' | 'recent'
const activeSidebarFilter = ref<SidebarFilter>('all')

const groupFilteredChats = computed(() => {
  if (activeGroup.value === '全部') return mockChats.value
  return mockChats.value.filter(c => c.groups && c.groups.includes(activeGroup.value))
})

const lastInteractionTime = (chat: any) => {
  const messages = Array.isArray(chat.messages) ? chat.messages : []
  const lastMessage = messages[messages.length - 1]
  return typeof lastMessage?.id === 'number' ? lastMessage.id : 0
}

const filteredChats = computed(() => {
  const chats = groupFilteredChats.value
  if (activeSidebarFilter.value === 'unread') return chats.filter(c => c.unread > 0)
  if (activeSidebarFilter.value === 'pinned') return chats.filter(c => c.isPinned)
  if (activeSidebarFilter.value === 'recent') {
    return chats
      .filter(c => Array.isArray(c.messages) && c.messages.length > 0)
      .slice()
      .sort((a, b) => lastInteractionTime(b) - lastInteractionTime(a))
  }
  return chats
})
const pinnedChats = computed(() => activeSidebarFilter.value === 'all' ? groupFilteredChats.value.filter(c => c.isPinned) : [])
const regularChats = computed(() => activeSidebarFilter.value === 'all' ? filteredChats.value.filter(c => !c.isPinned) : filteredChats.value)
const unreadChatCount = computed(() => mockChats.value.filter(c => c.unread > 0).length)
const pinnedChatCount = computed(() => mockChats.value.filter(c => c.isPinned).length)
const filterEmptyText = computed(() => ({
  unread: '暂无未读消息',
  pinned: '暂无置顶消息',
  recent: '暂无最近互动',
  all: '暂无消息'
}[activeSidebarFilter.value]))

const handleSidebarFilter = (filter: SidebarFilter) => {
  activeSidebarFilter.value = filter
  activeGroup.value = '全部'
}

// === 全局 Dialog ===
const customDialog = ref({
  visible: false,
  title: '',
  content: '',
  showInput: false,
  inputValue: '',
  inputPlaceholder: '',
  showCancel: true,
  confirmText: '确定',
  cancelText: '取消',
  onConfirm: (_val?: string) => {},
  onCancel: () => {}
})

const showDialog = (options: any) => {
  customDialog.value = {
    visible: true,
    title: options.title || '',
    content: options.content,
    showInput: options.showInput || false,
    inputValue: options.inputValue || '',
    inputPlaceholder: options.inputPlaceholder || '',
    showCancel: options.showCancel !== false,
    confirmText: options.confirmText || '确定',
    cancelText: options.cancelText || '取消',
    onConfirm: options.onConfirm || (() => {}),
    onCancel: options.onCancel || (() => {})
  }
}
const handleDialogConfirm = () => { customDialog.value.onConfirm(customDialog.value.inputValue); customDialog.value.visible = false }
const handleDialogCancel = () => { customDialog.value.onCancel(); customDialog.value.visible = false }

// === 逻辑 Hooks 引入 ===
const {
  isMultiSelectMode,
  selectedChatIds,
  enterMultiSelectMode,
  exitMultiSelectMode,
  toggleSelectChat,
  toggleSelectAll,
  deleteSelectedChats
} = useChatListMultiSelect(mockChats, deleteChats)

const {
  showAddGroupDialog,
  showRenameGroupDialog,
  deleteGroup,
  confirmAssignGroups,
  deleteSelectedGroups,
  mergeSelectedGroups
} = useChatListGroups(customGroups, activeGroup, loadCustomContacts)

const { currentChatUserId, currentAccount } = useChatAuth()
const getContactsKey = () => currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'

// === 侧边栏状态 ===
const { isSidebarOpen } = useChatState()

// === 联系人长按与点击 ===
const activeMenuChat = ref<any | null>(null)
let longPressTimer: any = null
let isLongPressTriggered = false
let touchStartY = 0, touchStartX = 0

const startLongPress = (e: MouseEvent | TouchEvent, chat: any) => {
  if (isMultiSelectMode.value) return
  isLongPressTriggered = false
  if (e.type === 'touchstart') {
    touchStartX = (e as TouchEvent).touches[0].clientX
    touchStartY = (e as TouchEvent).touches[0].clientY
  }
  longPressTimer = setTimeout(() => {
    isLongPressTriggered = true
    activeMenuChat.value = chat
  }, 600)
}
const clearLongPress = (e?: MouseEvent | TouchEvent) => {
  if (e?.type === 'touchmove') {
    const cy = (e as TouchEvent).touches[0].clientY, cx = (e as TouchEvent).touches[0].clientX
    if (Math.abs(cy - touchStartY) > 10 || Math.abs(cx - touchStartX) > 10) {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
    }
    return
  }
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
}
const handleChatClick = (chat: any) => {
  if (isMultiSelectMode.value) { toggleSelectChat(chat.id); return }
  if (isLongPressTriggered) { isLongPressTriggered = false; return }
  if (chat.unread > 0) {
    chat.unread = 0
    if (chat.id === 1) localStorage.setItem('clingy_system_notice_read', '1')
    else {
      const saved = localStorage.getItem(getContactsKey())
      if (saved) {
        let contacts = JSON.parse(saved)
        const idx = contacts.findIndex((c: any) => c.id === chat.id)
        if (idx !== -1) { contacts[idx].unread = 0; localStorage.setItem(getContactsKey(), JSON.stringify(contacts)) }
      }
    }
  }
  emit('open-chat', chat)
}

const toggleUnread = (chat: any) => {
  chat.unread = chat.unread > 0 ? 0 : 1
  if (chat.id !== 1) {
    const saved = localStorage.getItem(getContactsKey())
    if (saved) {
      let contacts = JSON.parse(saved)
      const idx = contacts.findIndex((c: any) => c.id === chat.id)
      if (idx !== -1) { contacts[idx].unread = chat.unread; localStorage.setItem(getContactsKey(), JSON.stringify(contacts)) }
    }
  } else localStorage.setItem('clingy_system_notice_read', chat.unread > 0 ? '0' : '1')
  activeMenuChat.value = null
}
const togglePin = (chat: any) => {
  chat.isPinned = !chat.isPinned
  if (chat.id !== 1) {
    const saved = localStorage.getItem(getContactsKey())
    if (saved) {
      let contacts = JSON.parse(saved)
      const idx = contacts.findIndex((c: any) => c.id === chat.id)
      if (idx !== -1) { contacts[idx].isPinned = chat.isPinned; localStorage.setItem(getContactsKey(), JSON.stringify(contacts)) }
    }
  } else localStorage.setItem('clingy_system_notice_pinned', chat.isPinned ? '1' : '0')
  activeMenuChat.value = null
  sortChats()
}
const deleteSingleChat = async (chat: any) => {
  if (chat.id === 1) { showDialog({ content: '系统通知无法删除', showCancel: false }); activeMenuChat.value = null; return }
  showDialog({
    title: '删除角色', content: `确定要删除角色"${chat.name}"吗？`, confirmText: '删除',
    onConfirm: async () => { await deleteChats([chat.id]); activeMenuChat.value = null },
    onCancel: () => { activeMenuChat.value = null }
  })
}

// === 分组长按与点击 ===
const groupActionMenuVisible = ref(false)
const activeMenuGroup = ref<string | null>(null)
let groupTimer: any = null
let gTouchStartX = 0, gTouchStartY = 0
let isGLongPress = false

const startGroupLongPress = (e: MouseEvent | TouchEvent, group: string) => {
  isGLongPress = false
  if (e.type === 'touchstart') { gTouchStartX = (e as TouchEvent).touches[0].clientX; gTouchStartY = (e as TouchEvent).touches[0].clientY }
  groupTimer = setTimeout(() => { isGLongPress = true; activeMenuGroup.value = group }, 600)
}
const clearGroupLongPress = (e?: MouseEvent | TouchEvent) => {
  if (e?.type === 'touchmove') {
    const cy = (e as TouchEvent).touches[0].clientY, cx = (e as TouchEvent).touches[0].clientX
    if (Math.abs(cy - gTouchStartY) > 10 || Math.abs(cx - gTouchStartX) > 10) {
      if (groupTimer) { clearTimeout(groupTimer); groupTimer = null }
    }
    return
  }
  if (groupTimer) { clearTimeout(groupTimer); groupTimer = null }
}
const handleGroupClick = (g: string) => {
  if (isGLongPress) { isGLongPress = false; return }
  activeSidebarFilter.value = 'all'
  activeGroup.value = g
}

// === 弹窗状态管理 ===
const groupManageModalVisible = ref(false)
const selectedManageGroups = ref<Set<string>>(new Set())

const assignGroupModalVisible = ref(false)
const tempSelectedGroups = ref<Set<string>>(new Set())

const createChoiceModalVisible = ref(false)
const importModalVisible = ref(false)
const importModalMode = ref<'card'|'doc'>('card')

const accountSwitchModalVisible = ref(false)

// === UI 行为 ===
const resolveImportedAvatar = async (avatar: unknown) => {
  if (typeof avatar !== 'string' || !avatar.trim()) return null

  const value = avatar.trim()
  if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value

  const storageKey = value.startsWith('localforage:') ? value.slice('localforage:'.length) : value
  return await avatarStore.getItem<string>(storageKey)
}

const handleImportComplete = async (personas: any[]) => {
  const savedStr = localStorage.getItem(getContactsKey())
  let contacts = savedStr ? JSON.parse(savedStr) : []

  for (const p of personas) {
    const id = `contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const avatarKey = `avatar_contact_${id}`

    try {
      const avatarData = await resolveImportedAvatar(p.avatar)
      if (avatarData) await avatarStore.setItem(avatarKey, avatarData)
    } catch (error) {
      console.error(`Failed to persist imported avatar for contact ${id}`, error)
    }

    contacts.push({
      id, name: p.name, remark: '', persona: p.signature,
      avatarKey, isPinned: false, groups: [], boundWorldBooks: p.boundWorldBooks || [],
      boundWorldBookGroups: [], messages: []
    })
  }

  localStorage.setItem(getContactsKey(), JSON.stringify(contacts))
  await loadCustomContacts()
}

</script>

<template>
  <div class="view-container chat-list-view" :class="{ 'with-tabbar': !isMultiSelectMode, 'with-multi-bar': isMultiSelectMode, 'has-sidebar': !isMultiSelectMode }">
    <header class="navbar glass-header chat-normal-header" :class="{ 'with-wallpaper': globalSettings.chatListWallpaper !== 'default' }">
      <template v-if="!isMultiSelectMode">
        <div class="nav-left chat-normal-left">
          <svg class="nav-back-btn" @click="emit('close')" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <Transition name="fade">
            <div v-if="!isSidebarOpen" class="header-mini-avatar" :style="currentAccount?.avatarUrl ? { backgroundImage: `url(${currentAccount.avatarUrl})` } : {}" @click="isSidebarOpen = true">
              <template v-if="!currentAccount?.avatarUrl">{{ currentAccount?.name?.charAt(0) || 'Me' }}</template>
            </div>
          </Transition>
        </div>
        <div class="nav-center chat-normal-title">
          <span>Messages</span>
        </div>
        <div class="nav-right">
          <button class="chat-normal-add" type="button" aria-label="新建角色" @click="createChoiceModalVisible = true">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="1.8" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
        </div>
      </template>
      <template v-else>
        <div class="nav-left" style="width: 80px; justify-content: flex-start;">
          <span class="nav-btn" @click="exitMultiSelectMode">取消</span>
        </div>
        <div class="nav-center">
          <span class="title-main" style="font-size: 15px;">已选 {{ selectedChatIds.size }} 项</span>
        </div>
        <div class="nav-right" style="width: 80px;">
          <span class="nav-btn" @click="toggleSelectAll(filteredChats)">全选</span>
        </div>
      </template>
    </header>

    <div class="chat-list-body">
      <Transition name="slide-sidebar">
        <aside v-if="!isMultiSelectMode && isSidebarOpen" class="chat-sidebar glass-sidebar" :class="{ 'with-wallpaper': globalSettings.chatListWallpaper !== 'default' }">
          <div class="sidebar-top">
            <div class="sidebar-avatar-wrapper" @click="isSidebarOpen = false" style="cursor: pointer;" title="收起侧边栏">
              <div class="sidebar-avatar" :style="currentAccount?.avatarUrl ? { backgroundImage: `url(${currentAccount.avatarUrl})` } : {}">
                <template v-if="!currentAccount?.avatarUrl">{{ currentAccount?.name?.charAt(0) || 'Me' }}</template>
              </div>
            </div>
            <div class="sidebar-name">{{ currentAccount?.name || '未登录' }}</div>
          </div>
        
        <div class="sidebar-account-switch" @click="accountSwitchModalVisible = true">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>
        </div>

        <div class="sidebar-shortcuts" aria-label="消息筛选">
          <div class="sidebar-shortcut" :class="{ active: activeSidebarFilter === 'all' }" @click="handleSidebarFilter('all')">
            <div class="sidebar-shortcut-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.8" fill="none"><path d="M4 5h16v11H8l-4 3V5Z"></path><line x1="8" y1="9" x2="16" y2="9"></line><line x1="8" y1="13" x2="13" y2="13"></line></svg>
            </div>
            <span class="sidebar-shortcut-name">全部</span>
          </div>
          <div class="sidebar-shortcut" :class="{ active: activeSidebarFilter === 'unread' }" @click="handleSidebarFilter('unread')">
            <div class="sidebar-shortcut-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.8" fill="none"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>
              <span v-if="unreadChatCount > 0" class="sidebar-shortcut-badge">{{ unreadChatCount > 99 ? '99+' : unreadChatCount }}</span>
            </div>
            <span class="sidebar-shortcut-name">未读</span>
          </div>
          <div class="sidebar-shortcut" :class="{ active: activeSidebarFilter === 'pinned' }" @click="handleSidebarFilter('pinned')">
            <div class="sidebar-shortcut-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.8" fill="none"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-6 0v4.68a2 2 0 0 1-1.11 1.87l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
              <span v-if="pinnedChatCount > 0" class="sidebar-shortcut-count">{{ pinnedChatCount }}</span>
            </div>
            <span class="sidebar-shortcut-name">置顶</span>
          </div>
          <div class="sidebar-shortcut" :class="{ active: activeSidebarFilter === 'recent' }" @click="handleSidebarFilter('recent')">
            <div class="sidebar-shortcut-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.8" fill="none"><circle cx="12" cy="12" r="8"></circle><polyline points="12 8 12 12 15 14"></polyline></svg>
            </div>
            <span class="sidebar-shortcut-name">最近</span>
          </div>
        </div>
      </aside>
      </Transition>

      <div class="chat-main-content">
        <main class="list-main">
      <div v-if="!isMultiSelectMode && pinnedChats.length > 0" class="pinned-strip">
        <div
          v-for="chat in pinnedChats"
          :key="chat.id"
          class="pinned-contact"
          :id="`chat-item-${chat.id}`"
          @mousedown="startLongPress($event, chat)"
          @touchstart="startLongPress($event, chat)"
          @mouseup="clearLongPress"
          @touchend="clearLongPress"
          @mouseleave="clearLongPress"
          @touchmove="clearLongPress"
          @click="handleChatClick(chat)"
        >
          <div class="pinned-avatar-ring">
            <div class="pinned-avatar" :style="chat.avatarUrl ? { backgroundImage: `url(${chat.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : {}">{{ chat.avatarText }}</div>
            <div v-if="chat.unread > 0" class="pinned-unread-dot">{{ chat.unread > 99 ? '99+' : chat.unread }}</div>
          </div>
          <div class="pinned-name">{{ chat.name }}</div>
        </div>
      </div>

      <div class="search-section" v-show="!isMultiSelectMode">
        <div class="group-tabs-container" style="position: static; padding: 12px 16px 8px;">
          <div class="group-tabs-scroll">
            <div v-for="g in groups" :key="g" class="group-tab" :class="{ active: activeGroup === g }"
              @mousedown="g !== '全部' ? startGroupLongPress($event, g) : null"
              @touchstart="g !== '全部' ? startGroupLongPress($event, g) : null"
              @mouseup="clearGroupLongPress" @touchend="clearGroupLongPress" @mouseleave="clearGroupLongPress" @touchmove="clearGroupLongPress"
              @click="handleGroupClick(g)">{{ g }}</div>
          </div>
          <div class="group-action-wrapper" style="position: relative;">
            <div class="group-tab-add" @click="groupActionMenuVisible = true">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            
            <Teleport to="body">
              <div v-if="groupActionMenuVisible" class="canvas-modal-overlay designer-menu-overlay" @click.self="groupActionMenuVisible = false">
                <div class="designer-menu-container">
                  <div class="designer-menu-content">
                    <div class="designer-menu-item" @click="() => { groupActionMenuVisible = false; showAddGroupDialog(showDialog) }">
                      <span class="dm-cn">新建分组</span>
                    </div>
                    <div class="dm-divider"></div>
                    <div class="designer-menu-item" @click="() => { groupActionMenuVisible = false; selectedManageGroups.clear(); groupManageModalVisible = true }">
                      <span class="dm-cn">管理分组</span>
                    </div>
                  </div>
                  <div class="designer-menu-close" @click="groupActionMenuVisible = false">
                    <span class="dm-close-text">关闭</span>
                  </div>
                </div>
              </div>
            </Teleport>
          </div>
        </div>
      </div>

      <div class="chat-list">
        <div v-if="!isMultiSelectMode && regularChats.length === 0 && pinnedChats.length === 0" class="chat-list-empty">{{ filterEmptyText }}</div>
        <div v-for="chat in (isMultiSelectMode ? filteredChats : regularChats)" :key="chat.id" class="chat-item-wrapper" :id="`chat-item-${chat.id}`">
          <div v-if="isMultiSelectMode" class="checkbox-container" @click="toggleSelectChat(chat.id)">
            <div class="checkbox" :class="{ checked: selectedChatIds.has(chat.id) }">
              <svg v-if="selectedChatIds.has(chat.id)" viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
          </div>

          <div class="chat-item" :class="{ 'is-pinned': chat.isPinned }" @mousedown="startLongPress($event, chat)" @touchstart="startLongPress($event, chat)" @mouseup="clearLongPress" @touchend="clearLongPress" @mouseleave="clearLongPress" @touchmove="clearLongPress" @click="handleChatClick(chat)">
            <div class="chat-avatar-wrapper">
              <div class="chat-avatar" :style="chat.avatarUrl ? { backgroundImage: `url(${chat.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : {}">{{ chat.avatarText }}</div>
              <div v-if="chat.isTyping" class="typing-dots-indicator">
                <span class="tdot"></span><span class="tdot"></span><span class="tdot"></span>
              </div>
            </div>
            <div class="chat-content">
              <div class="chat-row-top">
                <div class="name-area">
                  <span class="chat-name">{{ chat.name }}</span>
                  <svg v-if="chat.isPinned" class="pin-icon" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.87l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
                </div>
                <span class="chat-time">{{ chat.time }}</span>
              </div>
              <div class="chat-row-bottom">
                <span class="chat-preview">{{ chat.preview }}</span>
                <div v-if="chat.unread > 0" class="unread-dot">{{ chat.unread > 99 ? '99+' : chat.unread }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
      </div>
    </div>

    <!-- Multi-Select Bottom Bar -->
    <Teleport to="body">
      <div v-show="isMultiSelectMode" class="multi-select-bottom-bar glass" :class="{ 'with-wallpaper': globalSettings.chatListWallpaper !== 'default' }">
        <div class="bottom-btn secondary" :class="{ disabled: selectedChatIds.size === 0 }" @click="() => { tempSelectedGroups.clear(); assignGroupModalVisible = true }">移动分组</div>
        <div class="bottom-btn danger" :class="{ disabled: selectedChatIds.size === 0 }" @click="deleteSelectedChats(showDialog)">删除 ({{ selectedChatIds.size }})</div>
      </div>
    </Teleport>

    <!-- UI Modals Component Group -->
    <Teleport to="body">
      <ChatListActionMenuModal v-if="activeMenuChat" :activeMenuChat="activeMenuChat" @close="activeMenuChat = null" @toggle-unread="toggleUnread" @toggle-pin="togglePin" @enter-multi-select="() => { enterMultiSelectMode(activeMenuChat.id); activeMenuChat = null }" @delete="deleteSingleChat" />
      
      <div v-if="activeMenuGroup" class="canvas-modal-overlay designer-menu-overlay" @click.self="activeMenuGroup = null" @contextmenu.prevent>
        <div class="designer-menu-container">
          <div class="designer-menu-content">
            <div class="designer-menu-item" style="cursor: default; padding-bottom: 8px;">
              <span class="dm-en" style="margin-bottom: 2px;">已选中</span>
              <span class="dm-cn" style="font-size: 14px; color: #666;">{{ activeMenuGroup }}</span>
            </div>
            <div class="dm-divider"></div>
            <div class="designer-menu-item" @click="showRenameGroupDialog(showDialog, activeMenuGroup, () => { activeMenuGroup = null })">
              <span class="dm-cn">重命名分组</span>
            </div>
            <div class="dm-divider"></div>
            <div class="designer-menu-item" @click="deleteGroup(showDialog, activeMenuGroup, () => { activeMenuGroup = null })">
              <span class="dm-cn" style="color: #ff3b30;">删除分组</span>
            </div>
          </div>
          <div class="designer-menu-close" @click="activeMenuGroup = null">
            <span class="dm-close-text">关闭</span>
          </div>
        </div>
      </div>

      <ChatListAssignGroupModal v-if="assignGroupModalVisible" :customGroups="customGroups" :tempSelectedGroups="tempSelectedGroups" @close="assignGroupModalVisible = false" @toggle-group="(g) => { if(tempSelectedGroups.has(g)) tempSelectedGroups.delete(g); else tempSelectedGroups.add(g) }" @confirm="confirmAssignGroups(tempSelectedGroups, selectedChatIds, () => { assignGroupModalVisible = false; exitMultiSelectMode() })" />
      <ChatListGroupManageModal v-if="groupManageModalVisible" :customGroups="customGroups" :selectedManageGroups="selectedManageGroups" @close="groupManageModalVisible = false" @toggle-all="() => { if(selectedManageGroups.size === customGroups.length) selectedManageGroups.clear(); else selectedManageGroups = new Set(customGroups) }" @toggle-group="(g) => { if(selectedManageGroups.has(g)) selectedManageGroups.delete(g); else selectedManageGroups.add(g) }" @rename-group="(g) => { showRenameGroupDialog(showDialog, g, () => {}) }" @delete-selected="deleteSelectedGroups(showDialog, selectedManageGroups, () => { groupManageModalVisible = false })" @merge-selected="mergeSelectedGroups(showDialog, selectedManageGroups, () => { groupManageModalVisible = false })" />
      <ChatListCreateChoiceModal v-if="createChoiceModalVisible" @close="createChoiceModalVisible = false" @manual-create="() => { createChoiceModalVisible = false; emit('open-create-contact') }" @import-create="() => { createChoiceModalVisible = false; importModalMode = 'card'; importModalVisible = true }" @import-doc-create="() => { createChoiceModalVisible = false; importModalMode = 'doc'; importModalVisible = true }" />
      
      <ChatAccountSwitchModal v-if="accountSwitchModalVisible" @close="accountSwitchModalVisible = false" />

      <!-- Native / Upload Modals -->
      <PersonaImportModal v-model:visible="importModalVisible" :mode="importModalMode" @import="handleImportComplete" />

      <!-- Custom System Dialog (Designer Style) -->
      <div v-if="customDialog.visible" class="canvas-modal-overlay designer-overlay" style="z-index: 10010;" @click.self="handleDialogCancel">
        <div class="designer-dialog">
          <div v-if="customDialog.title" class="dd-title">{{ customDialog.title }}</div>
          <div v-if="customDialog.content" class="dd-content">{{ customDialog.content }}</div>
          <div v-if="customDialog.showInput" class="dd-input-wrap">
            <input type="text" class="dd-input" v-model="customDialog.inputValue" :placeholder="customDialog.inputPlaceholder" autofocus @keydown.enter="handleDialogConfirm" />
          </div>
          <div class="dd-actions">
            <div class="dd-btn confirm" :class="{ 'danger': customDialog.confirmText === '删除' }" @click="handleDialogConfirm">{{ customDialog.confirmText }}</div>
            <div v-if="customDialog.showCancel" class="dd-btn cancel" @click="handleDialogCancel">{{ customDialog.cancelText }}</div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped src="./ChatListView.css"></style>
