/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed } from 'vue'
import localforage from 'localforage'
import { useChatAuth } from './useChatAuth'
import { useChatState } from './useChatState'
import { sendChatMessage } from '../services/api'
import { processMomentTags } from './useChatRoomMessage'
import { addMomentNotification, canViewMoment, defaultMomentBehavior, getMomentBehavior } from '../services/moments'

const discoverStore = localforage.createInstance({ name: 'nrt-app', storeName: 'discover_moments' })
const avatarStore = localforage.createInstance({ name: 'nrt-app', storeName: 'avatars' })

export function useChatDiscover() {
  const { currentChatUserId, chatAccounts } = useChatAuth()
  const { mockChats, loadCustomContacts } = useChatState()

  const groups = computed(() => {
    const key = currentChatUserId.value ? `clingy_chat_groups_${currentChatUserId.value}` : 'clingy_chat_groups'
    return (JSON.parse(localStorage.getItem(key) || '[]') as string[]).map(name => ({ id: name, name }))
  })
  const getKey = (base: string) => currentChatUserId.value ? `${base}_${currentChatUserId.value}` : base

  const mockMoments = ref<any[]>([])
  const personas = ref<any[]>([])
  const activePersonaIndex = ref<number>(0)
  const activeSignature = ref('写点什么吧...')
  const showPlayerControls = ref(true)

  const resolvedAvatars = ref<Record<string, string>>({})
  const resolveAccountAvatar = (avatar: unknown) => {
    if (typeof avatar !== 'string' || !avatar.startsWith('account-avatar:')) return ''
    const accountId = avatar.slice('account-avatar:'.length)
    return chatAccounts.value.find(account => account.id === accountId)?.avatarUrl || ''
  }
  const availableCharacters = computed(() => mockChats.value.filter((chat: any) => chat.id !== 1 && !chat.isCreate))
  
  const allNotifications = computed(() => mockMoments.value.flatMap(moment => (moment.notifications || []).map((notice: any) => ({ ...notice, momentId: moment.id, momentContent: moment.content }))).sort((a, b) => b.createdAt - a.createdAt))
  const unreadNotificationCount = computed(() => allNotifications.value.filter(n => !n.read).length)

  const loadPersonas = async () => {
    const saved = localStorage.getItem(getKey('app_chat_personas'))
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          personas.value = parsed.filter(p => !p.isCreate)
          for (let i = 0; i < personas.value.length; i++) {
            const p = personas.value[i]
            if (p.avatar && p.avatar.startsWith('localforage:')) {
              const key = p.avatar.split(':')[1]
              try {
                const realAvatar = await avatarStore.getItem<string>(key)
                if (realAvatar) personas.value[i].avatar = realAvatar
              } catch (e) {
                console.error('Failed to load avatar from localforage', e)
              }
            } else if (p.avatar && p.avatar.startsWith('account-avatar:')) {
              personas.value[i].avatar = resolveAccountAvatar(p.avatar)
            }
          }
        }
      } catch(e) {}
    }
  }

  const activePersona = computed(() => personas.value[activePersonaIndex.value] || personas.value[0])
  const activeAvatar = computed(() => activePersona.value?.avatar || '')

  const loadSignature = () => {
    if (activePersona.value) {
      activeSignature.value = activePersona.value.customText || '点击设置自定义文案...'
    } else {
      activeSignature.value = '写点什么吧...'
    }
  }

  const loadActiveIndex = () => {
    const savedIndex = localStorage.getItem(getKey('app_chat_active_persona_index'))
    if (savedIndex !== null) {
      const idx = parseInt(savedIndex, 10)
      if (idx >= 0 && idx < personas.value.length) activePersonaIndex.value = idx
      else activePersonaIndex.value = 0
    } else {
      activePersonaIndex.value = 0
    }
  }

  const loadMoments = async () => {
    try {
      const userKey = getKey('moments_list')
      let saved = await discoverStore.getItem<any[]>(userKey)
      if (!saved && currentChatUserId.value) {
        const migrationOwnerKey = 'clingy_moments_legacy_owner'
        const migrationOwner = localStorage.getItem(migrationOwnerKey)
        if (!migrationOwner) {
          const legacy = await discoverStore.getItem<any[]>('moments_list')
          if (legacy?.length) {
            saved = legacy
            await discoverStore.setItem(userKey, legacy)
          }
          localStorage.setItem(migrationOwnerKey, String(currentChatUserId.value))
        }
      }
      if (saved && Array.isArray(saved)) {
        mockMoments.value = saved.map(m => ({
          ...m,
          likes: Array.isArray(m.likes) ? m.likes : [],
          comments: Array.isArray(m.comments) ? m.comments.map((c: any) => ({
            id: c.id || `${m.id}_${c.author}_${c.content}`,
            likes: Array.isArray(c.likes) ? c.likes : [],
            createdAt: c.createdAt || m.time,
            ...c
          })) : []
        })).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || Number(b.time) - Number(a.time))

        for (const m of saved) {
          if (m.avatar && m.avatar.startsWith('localforage:')) {
            const key = m.avatar.split(':')[1]
            avatarStore.getItem<string>(key).then(realAvatar => {
              if (realAvatar) resolvedAvatars.value[m.id] = realAvatar
            }).catch(() => {})
          } else {
            const accountAvatar = resolveAccountAvatar(m.avatar)
            if (accountAvatar) resolvedAvatars.value[m.id] = accountAvatar
          }
        }
      } else {
        mockMoments.value = []
      }
    } catch(e) {
      console.error('Failed to load moments', e)
    }
  }

  const saveMoments = async () => {
    await discoverStore.setItem(getKey('moments_list'), JSON.parse(JSON.stringify(mockMoments.value)))
  }

  const refreshData = async () => {
    await loadPersonas()
    loadActiveIndex()
    const savedShowControls = localStorage.getItem('clingy_discover_show_controls')
    if (savedShowControls !== null) showPlayerControls.value = savedShowControls === 'true'
    loadSignature()
    loadMoments()
  }

  const currentActor = computed(() => ({
    id: activePersona.value?.id || 'me',
    name: activePersona.value?.name || '我'
  }))

  const isLikedByMe = (moment: any) => moment.likes?.includes(currentActor.value.name)
  const toggleMomentLike = async (moment: any) => {
    moment.likes ||= []
    const index = moment.likes.indexOf(currentActor.value.name)
    if (index >= 0) moment.likes.splice(index, 1)
    else moment.likes.push(currentActor.value.name)
    await saveMoments()
  }

  const toggleCommentLike = async (comment: any) => {
    comment.likes ||= []
    const index = comment.likes.indexOf(currentActor.value.name)
    if (index >= 0) comment.likes.splice(index, 1)
    else comment.likes.push(currentActor.value.name)
    await saveMoments()
  }

  const formatTime = (timestamp: number | string): string => {
    const time = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp
    if (isNaN(time)) return String(timestamp)
    const now = Date.now()
    const diff = now - time
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
    if (diff < 172800000) return '昨天'
    const date = new Date(time)
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  return {
    currentChatUserId,
    mockMoments,
    groups,
    personas,
    activePersonaIndex,
    activePersona,
    activeAvatar,
    activeSignature,
    showPlayerControls,
    resolvedAvatars,
    availableCharacters,
    allNotifications,
    unreadNotificationCount,
    currentActor,
    getKey,
    loadPersonas,
    loadActiveIndex,
    loadSignature,
    loadMoments,
    saveMoments,
    refreshData,
    isLikedByMe,
    toggleMomentLike,
    toggleCommentLike,
    formatTime,
    discoverStore,
    loadCustomContacts
  }
}
