/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed, watch } from 'vue'
import localforage from 'localforage'
import { getEffectiveUserProfile } from '../useChatUserProfiles'

// 全局共享状态（单例外置）
export const mockChats = ref<any[]>([])
export const selectedChat = ref<any | null>(null)
export const activeChatContextId = ref<string | number | null>(null)

export const setActiveChatContext = (id: string | number | null) => {
  activeChatContextId.value = id
}

export const isChatContextVisible = (id: string | number) => (
  activeChatContextId.value !== null && String(activeChatContextId.value) === String(id)
)

export const myProfile = ref({
  name: '我',
  remark: '',
  persona: '',
  avatarUrl: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  clockMode: 'system' as 'system' | 'timezone' | 'custom',
  clockAnchorRealAt: Date.now(),
  clockAnchorTimeAt: Date.now(),
  statusText: ''
})

export const effectiveMyProfile = computed(() => getEffectiveUserProfile(selectedChat.value, myProfile.value))

const savedGroupsStr = localStorage.getItem('clingy_chat_groups')
export const customGroups = ref<string[]>(savedGroupsStr ? JSON.parse(savedGroupsStr) : [])
export const activeGroup = ref('全部')

const SIDEBAR_OPEN_STORAGE_KEY = 'clingy_chat_sidebar_open'
const savedSidebarOpen = localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY)
export const isSidebarOpen = ref(savedSidebarOpen === null ? true : savedSidebarOpen === '1')

watch(isSidebarOpen, (open) => {
  localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, open ? '1' : '0')
})

export const avatarStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'avatars'
})

export const totalUnreadCount = computed(() => {
  return mockChats.value.reduce((sum, chat) => sum + (chat.unread || 0), 0)
})

export const switchChat = (id: string | number) => {
  selectedChat.value = mockChats.value.find(chat => chat.id === id) ?? null
}
