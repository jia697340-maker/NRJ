/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import localforage from 'localforage'
import TextEditModal from './TextEditModal.vue'
import DiscoverPublish from './app_DiscoverPublish.vue'
import { useChatAuth } from '../composables/useChatAuth'
import { useChatState } from '../composables/useChatState'
import { sendChatMessage } from '../services/api'
import { processMomentTags } from '../composables/useChatRoomMessage'
import { addMomentNotification, canViewMoment, defaultMomentBehavior, getMomentBehavior } from '../services/moments'

const { currentChatUserId } = useChatAuth()
const { mockChats, loadCustomContacts } = useChatState()
const groups = computed(() => {
  const key = currentChatUserId.value ? `clingy_chat_groups_${currentChatUserId.value}` : 'clingy_chat_groups'
  return (JSON.parse(localStorage.getItem(key) || '[]') as string[]).map(name => ({ id: name, name }))
})
const getKey = (base: string) => currentChatUserId.value ? `${base}_${currentChatUserId.value}` : base

const mockMoments = ref<any[]>([])

const discoverStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'discover_moments'
})

const avatarStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'avatars'
})

const personas = ref<any[]>([])
const showPublishView = ref(false)
const activePersonaIndex = ref<number>(0)
const showPlayerControls = ref(true)
const activeSignature = ref('写点什么吧...')
const showActionMenu = ref(false)
const showSignModal = ref(false)
const activeActionMomentId = ref<string | null>(null)
const commentDraft = ref('')
const replyTarget = ref<{ id: string, author: string } | null>(null)
const previewImage = ref('')
const editingMoment = ref<any | null>(null)
const showMomentEditModal = ref(false)
const detailMoment = ref<any | null>(null)
const showNotifications = ref(false)
const showCharacterPicker = ref(false)
const showBehaviorSettings = ref(false)
const showAudienceGroupPicker = ref(false)
const activeMomentMenuId = ref<string | null>(null)
const pendingDeleteMoment = ref<any | null>(null)
const manualMoment = ref<any | null>(null)
const selectedBehaviorChatId = ref<string | number | null>(null)
const behaviorDraft = ref<any>(defaultMomentBehavior())
watch(() => behaviorDraft.value.audience, value => { if (['部分可见', '不给谁看'].includes(value)) showAudienceGroupPicker.value = true })
const manualViewLoading = ref(false)

const resolvedAvatars = ref<Record<string, string>>({})
const availableCharacters = computed(() => mockChats.value.filter((chat: any) => chat.id !== 1 && !chat.isCreate))
const manualEligibleCharacters = computed(() => availableCharacters.value.filter((chat: any) => !manualMoment.value || canViewMoment(manualMoment.value, { id: chat.id, name: chat.name, groups: chat.groups, groupIds: chat.groupIds })))
const allNotifications = computed(() => mockMoments.value.flatMap(moment => (moment.notifications || []).map((notice: any) => ({ ...notice, momentId: moment.id, momentContent: moment.content }))).sort((a, b) => b.createdAt - a.createdAt))
const unreadNotificationCount = computed(() => allNotifications.value.filter(n => !n.read).length)

const isSelectionMode = ref(false)
const selectedIds = ref<string[]>([])
const showBatchDeleteModal = ref(false)

const enterSelectionMode = () => {
  isSelectionMode.value = true
  selectedIds.value = []
  closeActionMenu()
}

const exitSelectionMode = () => {
  isSelectionMode.value = false
  selectedIds.value = []
}

const toggleSelection = (id: string) => {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter(i => i !== id)
  } else {
    selectedIds.value.push(id)
  }
}

const isAllSelected = computed(() => {
  return mockMoments.value.length > 0 && selectedIds.value.length === mockMoments.value.length
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = mockMoments.value.map(m => m.id)
  }
}

const requestBatchDelete = () => {
  if (selectedIds.value.length > 0) {
    showBatchDeleteModal.value = true
  }
}

const confirmBatchDelete = async () => {
  if (selectedIds.value.length === 0) return
  mockMoments.value = mockMoments.value.filter(m => !selectedIds.value.includes(m.id))
  try {
    const plainMoments = JSON.parse(JSON.stringify(mockMoments.value))
    await discoverStore.setItem(getKey('moments_list'), plainMoments)
  } catch(e) {
    console.error('Failed to save after batch delete', e)
  }
  showBatchDeleteModal.value = false
  exitSelectionMode()
}

const loadPersonas = async () => {
  const saved = localStorage.getItem(getKey('app_chat_personas'))
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        personas.value = parsed.filter(p => !p.isCreate)
        // 解析可能存在 localforage 中的头像
        for (let i = 0; i < personas.value.length; i++) {
          const p = personas.value[i]
          if (p.avatar && p.avatar.startsWith('localforage:')) {
            const key = p.avatar.split(':')[1]
            try {
              const realAvatar = await avatarStore.getItem<string>(key)
              if (realAvatar) {
                personas.value[i].avatar = realAvatar
              }
            } catch (e) {
              console.error('Failed to load avatar from localforage', e)
            }
          }
        }
      }
    } catch(e) {}
  }
}

const activePersona = computed(() => {
  return personas.value[activePersonaIndex.value] || personas.value[0]
})

const activeAvatar = computed(() => activePersona.value?.avatar || '')

const loadSignature = () => {
  if (activePersona.value) {
    // 读取该角色身上的 customText（也就是资料卡里的自定义文案）
    activeSignature.value = activePersona.value.customText || '点击设置自定义文案...'
  } else {
    activeSignature.value = '写点什么吧...'
  }
}

watch(activePersonaIndex, () => {
  loadSignature()
})

watch(currentChatUserId, () => {
  resolvedAvatars.value = {}
  refreshData()
})

const loadActiveIndex = () => {
  const savedIndex = localStorage.getItem(getKey('app_chat_active_persona_index'))
  if (savedIndex !== null) {
    const idx = parseInt(savedIndex, 10)
    if (idx >= 0 && idx < personas.value.length) {
      activePersonaIndex.value = idx
    } else {
      activePersonaIndex.value = 0
    }
  } else {
    activePersonaIndex.value = 0
  }
}

const refreshData = async () => {
  await loadPersonas()
  loadActiveIndex()
  
  const savedShowControls = localStorage.getItem('clingy_discover_show_controls')
  if (savedShowControls !== null) {
    showPlayerControls.value = savedShowControls === 'true'
  }
  
  loadSignature()
  loadMoments()
}

onMounted(() => {
  loadCustomContacts()
  refreshData()

  // 监听来自其他页面 (比如资料卡设置) 对 localStorage 的修改
  window.addEventListener('storage', (e) => {
    if (e.key === getKey('app_chat_personas')) {
      loadPersonas().then(() => loadSignature())
    }
    if (e.key === getKey('app_chat_active_persona_index')) {
      loadActiveIndex()
      loadSignature()
    }
  })
  window.addEventListener('clingy:moments-updated', loadMoments)
})
onUnmounted(() => window.removeEventListener('clingy:moments-updated', loadMoments))

const loadMoments = async () => {
  try {
    // 朋友圈与登录身份隔离；保留旧 key 迁移，避免已有动态丢失。
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

      // 解析 localforage 头像
      for (const m of saved) {
        if (m.avatar && m.avatar.startsWith('localforage:')) {
          const key = m.avatar.split(':')[1]
          avatarStore.getItem<string>(key).then(realAvatar => {
            if (realAvatar) {
              resolvedAvatars.value[m.id] = realAvatar
            }
          }).catch(() => {})
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

const openCommentBox = (moment: any, target: any = null) => {
  detailMoment.value = null
  activeActionMomentId.value = moment.id
  replyTarget.value = target ? { id: target.id, author: target.author } : null
  commentDraft.value = ''
}

const submitComment = async () => {
  const moment = mockMoments.value.find(m => m.id === activeActionMomentId.value)
  const content = commentDraft.value.trim()
  if (!moment || !content) return
  moment.comments ||= []
  moment.comments.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    author: currentActor.value.name,
    authorId: currentActor.value.id,
    content,
    replyTo: replyTarget.value?.id || '',
    replyToAuthor: replyTarget.value?.author || '',
    likes: [],
    createdAt: Date.now()
  })
  await saveMoments()
  commentDraft.value = ''
  replyTarget.value = null
  activeActionMomentId.value = null
}

const deleteComment = async (moment: any, comment: any) => {
  if (comment.authorId !== currentActor.value.id && comment.author !== currentActor.value.name) return
  moment.comments = moment.comments.filter((c: any) => c.id !== comment.id)
  await saveMoments()
}

const closeCommentBox = () => {
  activeActionMomentId.value = null
  replyTarget.value = null
  commentDraft.value = ''
}

// 供模板使用的头像提取方法
const getAvatarUrl = (moment: any) => {
  if (resolvedAvatars.value[moment.id]) {
    return resolvedAvatars.value[moment.id]
  }
  if (!moment.avatar) return ''
  const url = moment.avatar
  if (url.startsWith('data:image') || url.startsWith('http') || url.startsWith('blob:') || url.startsWith('/') || url.startsWith('./')) {
    return url
  }
  return ''
}

const getAvatarText = (moment: any) => {
  if (moment.avatar && !moment.avatar.startsWith('localforage:') && !getAvatarUrl(moment)) {
    return moment.avatar
  }
  return moment.author ? moment.author.charAt(0) : '我'
}

// 格式化时间戳为“刚刚/x分钟前”的流式文字
const formatTime = (timestamp: number | string) => {
  const time = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp
  if (isNaN(time)) return timestamp // 如果是旧数据存的字面量（如"刚刚"），直接返回

  const now = Date.now()
  const diff = now - time
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 172800000) return '昨天'
  
  const date = new Date(time)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

const handleDeleteMoment = async (id: string) => {
  mockMoments.value = mockMoments.value.filter(m => m.id !== id)
  try {
    const plainMoments = JSON.parse(JSON.stringify(mockMoments.value))
    await discoverStore.setItem(getKey('moments_list'), plainMoments)
  } catch(e) {
    console.error('Failed to save after delete', e)
  }
}
const confirmDeleteMoment = async () => { if (!pendingDeleteMoment.value) return; await handleDeleteMoment(pendingDeleteMoment.value.id); if (detailMoment.value?.id === pendingDeleteMoment.value.id) detailMoment.value = null; pendingDeleteMoment.value = null }
const togglePinned = async (moment: any) => { moment.pinned = !moment.pinned; mockMoments.value.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || Number(b.time) - Number(a.time)); await saveMoments() }
const openMomentEdit = (moment: any) => { editingMoment.value = moment; showMomentEditModal.value = true }
const saveMomentEdit = async (content: string) => { if (editingMoment.value) { editingMoment.value.content = content.trim(); editingMoment.value.updatedAt = Date.now(); await saveMoments() }; showMomentEditModal.value = false }

const openDetail = (moment: any) => { activeMomentMenuId.value = null; if (!isSelectionMode.value) detailMoment.value = moment }
const prepareDetailComment = (moment: any, target: any = null) => { activeActionMomentId.value = moment.id; replyTarget.value = target ? { id: target.id, author: target.author } : null; commentDraft.value = '' }
const openManualViewer = (moment: any) => { manualMoment.value = moment; showCharacterPicker.value = true }
const requestCharacterView = async (chat: any) => {
  if (!manualMoment.value || manualViewLoading.value) return
  manualViewLoading.value = true
  try {
    const moment = manualMoment.value
    const request = [
      { role: 'system', content: `你是${chat.name}。请阅读指定朋友圈并按照性格决定点赞、评论、两者都做或不互动。只输出朋友圈互动标签，不要输出聊天消息。动态ID：${moment.id}；作者：${moment.author}；内容：${moment.content}；评论：${(moment.comments || []).map((c: any) => `[${c.id}]${c.author}:${c.content}`).join('；') || '无'}` },
      { role: 'user', content: '请看看这条朋友圈。' }
    ]
    let result
    try { result = await sendChatMessage(request, undefined, false, false, 'moment-followup') }
    catch { result = await sendChatMessage(request) }
    chat.__forceMomentAction = true
    try { await processMomentTags(typeof result === 'string' ? result : result.content, chat) } finally { delete chat.__forceMomentAction }
    await loadMoments()
    const viewed = mockMoments.value.find(m => m.id === moment.id)
    if (viewed) {
      viewed.views ||= []
      if (!viewed.views.some((person: any) => String(person.id) === String(chat.id))) viewed.views.push({ id: chat.id, name: chat.name, viewedAt: Date.now() })
      if (viewed.isOwn) addMomentNotification(viewed, { id: chat.id, name: chat.name }, 'view')
      await saveMoments()
    }
  } catch (error: any) {
    window.alert(`角色查看失败：${error?.message || '请检查 API 配置'}`)
  } finally {
    manualViewLoading.value = false
    showCharacterPicker.value = false
  }
}
const markNotificationsRead = async () => { mockMoments.value.forEach(m => (m.notifications || []).forEach((n: any) => n.read = true)); await saveMoments() }
const openNotificationMoment = async (notice: any) => { const moment = mockMoments.value.find(m => m.id === notice.momentId); if (!moment) return; const original = (moment.notifications || []).find((n: any) => n.id === notice.id); if (original) original.read = true; await saveMoments(); showNotifications.value = false; detailMoment.value = moment }
const openBehavior = (chat: any) => { selectedBehaviorChatId.value = chat.id; behaviorDraft.value = JSON.parse(JSON.stringify(getMomentBehavior(chat))) }
const saveBehavior = () => {
  const chat = availableCharacters.value.find((item: any) => item.id === selectedBehaviorChatId.value)
  if (!chat) return
  chat.momentBehavior = JSON.parse(JSON.stringify(behaviorDraft.value))
  const key = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
  const saved = JSON.parse(localStorage.getItem(key) || '[]')
  const target = saved.find((item: any) => item.id === chat.id)
  if (target) target.momentBehavior = chat.momentBehavior
  localStorage.setItem(key, JSON.stringify(saved))
}

const handlePublish = async (data: { text: string, images: string[], visibility: string, groupIds?: string[], location?: string, mentions?: { id: string | number, name: string }[] }) => {
  // 如果当前有人设，则使用当前人设的名字和头像
  const currentName = activePersona.value?.name || '我'
  const currentAvatar = activePersona.value?.avatar || ''

  const newMoment = {
    id: Date.now().toString(),
    author: currentName,
    avatar: currentAvatar, 
    content: data.text,
    images: data.images,
    time: Date.now(), // 存入真实时间戳
    visibility: data.visibility,
    visibilityGroups: data.groupIds || [],
    location: data.location || '',
    mentions: data.mentions || [],
    isOwn: true, // 标记是自己发布的动态
    likes: [] as string[],
    comments: [] as { author: string, content: string }[]
  }
  
  const firstUnpinned = mockMoments.value.findIndex(m => !m.pinned)
  mockMoments.value.splice(firstUnpinned < 0 ? mockMoments.value.length : firstUnpinned, 0, newMoment)
  showPublishView.value = false
  
  try {
    // 将 Vue 的 Proxy 响应式对象深拷贝解构为普通数组，避免 localforage 的 DataCloneError
    const plainMoments = JSON.parse(JSON.stringify(mockMoments.value))
    await discoverStore.setItem(getKey('moments_list'), plainMoments)
  } catch(e) {
    console.error('Failed to save moments', e)
  }
}

const toggleActionMenu = () => {
  showActionMenu.value = !showActionMenu.value
}
const closeActionMenu = () => {
  showActionMenu.value = false
}

const togglePlayerControls = () => {
  showPlayerControls.value = !showPlayerControls.value
  localStorage.setItem('clingy_discover_show_controls', String(showPlayerControls.value))
  closeActionMenu()
}

const openSignModal = () => {
  showSignModal.value = true
}

const handleSignSave = (text: string) => {
  activeSignature.value = text
  if (activePersona.value) {
    // 保存回 app_chat_personas，实现两边同步
    const saved = localStorage.getItem(getKey('app_chat_personas'))
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const target = parsed.find((p: any) => p.id === activePersona.value.id)
        if (target) {
          target.customText = text
          localStorage.setItem(getKey('app_chat_personas'), JSON.stringify(parsed))
          
          // 同时更新当前内存中的 activePersona
          const pIndex = personas.value.findIndex(p => p.id === activePersona.value.id)
          if (pIndex !== -1) {
            personas.value[pIndex].customText = text
          }
        }
      } catch(e) {}
    }
  }
}
</script>

<template>
  <div class="view-container with-tabbar discover-view">
    <!-- 渐变竖条纹背景 -->
    <div class="discover-bg"></div>

    <main class="discover-main">
      <!-- 顶部悬浮操作栏 -->
      <div class="discover-top-actions">
        <template v-if="!isSelectionMode">
          <div style="position: relative;">
            <!-- 左上角星星 -->
            <svg @click="toggleActionMenu" viewBox="0 0 24 24" width="22" height="22" stroke="#555" stroke-width="2" fill="none" class="top-action-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <span v-if="unreadNotificationCount" class="moment-unread-badge">{{ unreadNotificationCount > 99 ? '99+' : unreadNotificationCount }}</span>
            
            <div v-if="showActionMenu" class="dropdown-overlay" @click.stop="closeActionMenu"></div>
            <div v-if="showActionMenu" class="action-dropdown">
              <div class="action-item" @click.stop="togglePlayerControls">
                {{ showPlayerControls ? '隐藏播放条' : '显示播放条' }}
              </div>
              <div class="action-item" @click.stop="enterSelectionMode">
                批量删除
              </div>
              <div class="action-item" @click.stop="showNotifications = true; closeActionMenu()">
                互动消息<span v-if="unreadNotificationCount">（{{ unreadNotificationCount }}）</span>
              </div>
              <div class="action-item" @click.stop="showBehaviorSettings = true; closeActionMenu()">
                角色朋友圈设置
              </div>
            </div>
          </div>
          <!-- 右上角相机 -->
          <svg @click="showPublishView = true" viewBox="0 0 24 24" width="22" height="22" stroke="#555" stroke-width="2" fill="none" class="top-action-icon"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
        </template>
        <template v-else>
          <div class="selection-action-btn" @click="exitSelectionMode">取消</div>
          <div class="selection-action-btn" @click="toggleSelectAll">{{ isAllSelected ? '取消全选' : '全选' }}</div>
        </template>
      </div>

      <!-- 头部区域 (背景之上) -->
      <div class="discover-header-section">
        <!-- 头像 -->
        <div class="discover-avatar-wrapper">
          <div class="discover-avatar-placeholder" v-if="!activeAvatar"></div>
          <img v-else :src="activeAvatar" class="discover-avatar-img" />
        </div>
        
        <!-- 播放器区域 -->
        <div class="discover-player">
          <div class="player-pill" @click="openSignModal">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#999" stroke-width="2" fill="none" class="heart-icon"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <div class="signature-text">{{ activeSignature }}</div>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#555" stroke-width="2" fill="#555" class="heart-icon"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          </div>
          
          <div class="progress-bar-container" v-if="showPlayerControls">
            <div class="progress-track"><div class="progress-fill"></div></div>
          </div>
          
          <div class="player-controls" v-if="showPlayerControls">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="#888" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#888" stroke-width="2" fill="#888" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
            <div class="play-btn">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="#fff" stroke-width="2" fill="#fff" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            </div>
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#888" stroke-width="2" fill="#888" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="#888" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
          </div>
        </div>
      </div>

      <!-- 动态信息流区域 -->
      <div class="discover-moments-section">
        <div v-for="moment in mockMoments" :key="moment.id" class="moment-item" :class="{'is-selection-mode': isSelectionMode}" @click="isSelectionMode ? toggleSelection(moment.id) : openDetail(moment)">
          <div v-if="isSelectionMode" class="moment-checkbox">
            <div class="checkbox-circle" :class="{'is-checked': selectedIds.includes(moment.id)}">
              <svg v-if="selectedIds.includes(moment.id)" viewBox="0 0 24 24" width="14" height="14" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
          </div>
          <div class="moment-avatar">
            <img v-if="getAvatarUrl(moment)" :src="getAvatarUrl(moment)" style="width: 100%; height: 100%; border-radius: 8px; object-fit: cover;" />
            <span v-else>{{ getAvatarText(moment) }}</span>
          </div>
          <div class="moment-content-wrap">
            <div class="moment-author"><span v-if="moment.pinned" class="pinned-mark">置顶</span>{{ moment.author }}</div>
            <div class="moment-content">{{ moment.content }}</div>
            <div v-if="moment.location" class="moment-meta">⌖ {{ moment.location }}</div>
            <div v-if="moment.mentions?.length" class="moment-meta">@{{ moment.mentions.map((person: any) => person.name).join(' @') }}</div>
            <div class="moment-images" v-if="moment.images && moment.images.length">
              <img v-for="(img, idx) in moment.images" :key="idx" :src="img" class="moment-img" @click.stop="previewImage = img" />
            </div>
            <div v-if="moment.isGeneratingImage" class="moment-image-status">正在生成配图…</div>
            <div v-else-if="moment.imageError" class="moment-image-status is-error">配图生成失败，已发布文字动态</div>
            
            <div class="moment-footer">
              <div class="moment-time-wrap">
                <span class="moment-time">{{ formatTime(moment.time) }}</span>
                <!-- 仅当非公开时显示人群小图标 -->
                <svg v-if="moment.visibility && moment.visibility !== '公开'" viewBox="0 0 24 24" width="14" height="14" stroke="#888" stroke-width="2" fill="none" class="visibility-icon"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <div v-if="moment.isOwn && !isSelectionMode" class="own-moment-menu-wrap"><button class="own-moment-more" @click.stop="activeMomentMenuId = activeMomentMenuId === moment.id ? null : moment.id">•••</button><div v-if="activeMomentMenuId === moment.id" class="own-moment-menu"><button @click.stop="openMomentEdit(moment); activeMomentMenuId = null">编辑</button><button @click.stop="togglePinned(moment); activeMomentMenuId = null">{{ moment.pinned ? '取消置顶' : '置顶' }}</button><button class="danger" @click.stop="pendingDeleteMoment = moment; activeMomentMenuId = null">删除</button></div></div>
              </div>
              <div class="moment-actions" v-if="!isSelectionMode">
                <button class="moment-action-btn" title="让角色看看" @click.stop="openManualViewer(moment)">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path></svg>
                </button>
                <button class="moment-action-btn" :class="{ active: isLikedByMe(moment) }" :title="isLikedByMe(moment) ? '取消点赞' : '点赞'" @click.stop="toggleMomentLike(moment)">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" :fill="isLikedByMe(moment) ? 'currentColor' : 'none'"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </button>
                <button class="moment-action-btn" title="评论" aria-label="评论" @click.stop="openCommentBox(moment)">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                </button>
              </div>
            </div>

            <!-- 点赞和评论展示区 -->
            <div class="moment-interactions" v-if="(moment.likes && moment.likes.length) || (moment.comments && moment.comments.length)">
              <div class="moment-likes" v-if="moment.likes && moment.likes.length">
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="#576b95" stroke-width="2" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <span class="like-names">{{ moment.likes.join(', ') }}</span>
              </div>
              <div class="moment-comments" v-if="moment.comments && moment.comments.length">
                <div v-for="(comment, cIdx) in moment.comments" :key="comment.id || cIdx" class="comment-item">
                  <div class="comment-main" @click.stop="openCommentBox(moment, comment)">
                    <span class="comment-author">{{ comment.author }}</span>
                    <span v-if="comment.replyToAuthor" class="comment-reply">回复 {{ comment.replyToAuthor }}</span>:
                    <span class="comment-text">{{ comment.content }}</span>
                  </div>
                  <div class="comment-tools">
                    <button title="赞这条评论" aria-label="赞这条评论" @click.stop="toggleCommentLike(comment)" :class="{ active: comment.likes?.includes(currentActor.name) }">
                      <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                      <span v-if="comment.likes?.length">{{ comment.likes.length }}</span>
                    </button>
                    <button v-if="comment.authorId === currentActor.id || comment.author === currentActor.name" title="删除评论" aria-label="删除评论" @click.stop="deleteComment(moment, comment)">
                      <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6m3 0V4h8v2"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="activeActionMomentId === moment.id" class="comment-composer" @click.stop>
              <span v-if="replyTarget" class="reply-hint">回复 {{ replyTarget.author }}</span>
              <input v-model="commentDraft" maxlength="200" :placeholder="replyTarget ? `回复 ${replyTarget.author}…` : '说点什么…'" @keyup.enter="submitComment" />
              <button :disabled="!commentDraft.trim()" @click="submitComment">发送</button>
              <button class="cancel-comment" @click="closeCommentBox">取消</button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 文本编辑弹窗 -->
    <TextEditModal
      v-model:visible="showSignModal"
      title="自定义文案"
      :current-text="activeSignature"
      default-text="点击设置自定义文案..."
      placeholder="输入自定义文案"
      @saved="handleSignSave"
    />
    <TextEditModal v-model:visible="showMomentEditModal" title="编辑朋友圈" :current-text="editingMoment?.content || ''" default-text="" placeholder="这一刻的想法" @saved="saveMomentEdit" />
    
    <!-- 全屏发布界面 (通过 Teleport 挂载到 body 以遮挡底栏) -->
    <Teleport to="body">
      <div v-if="detailMoment" class="moment-modal-overlay" @click.self="detailMoment = null">
        <div class="moment-detail-modal">
          <header><button @click="detailMoment = null">‹</button><strong>详情</strong><span></span></header>
          <section><div class="detail-author">{{ detailMoment.author }}</div><p>{{ detailMoment.content }}</p><div class="detail-meta-row"><span>{{ formatTime(detailMoment.time) }}</span><span>{{ detailMoment.visibility || '公开' }}</span><span v-if="detailMoment.updatedAt">已编辑</span></div><div v-if="detailMoment.location" class="moment-meta">⌖ {{ detailMoment.location }}</div><div v-if="detailMoment.mentions?.length" class="moment-meta">@{{ detailMoment.mentions.map((person: any) => person.name).join(' @') }}</div>
            <div class="detail-grid" :class="`count-${Math.min(detailMoment.images?.length || 0, 9)}`"><img v-for="(img, index) in detailMoment.images || []" :key="index" :src="img" @click="previewImage = img" /></div>
            <div class="detail-like-list" v-if="detailMoment.likes?.length">♡ {{ detailMoment.likes.join('、') }}</div><div class="detail-like-list" v-if="detailMoment.views?.length">浏览：{{ detailMoment.views.map((person: any) => person.name).join('、') }}</div>
            <div class="detail-comment-list"><div v-for="comment in detailMoment.comments || []" :key="comment.id" @click="prepareDetailComment(detailMoment, comment)"><b>{{ comment.author }}</b><span v-if="comment.replyToAuthor"> 回复 <b>{{ comment.replyToAuthor }}</b></span>：{{ comment.content }} <button @click.stop="toggleCommentLike(comment)">♡{{ comment.likes?.length || '' }}</button></div></div>
            <div class="detail-composer"><span v-if="replyTarget">回复 {{ replyTarget.author }}</span><input v-model="commentDraft" :placeholder="replyTarget ? `回复 ${replyTarget.author}` : '写评论…'" @keyup.enter="submitComment"/><button :disabled="!commentDraft.trim()" @click="submitComment">发送</button></div>
          </section>
        </div>
      </div>
      <div v-if="previewImage" class="image-preview-overlay" @click="previewImage = ''"><img :src="previewImage" @click.stop /><a :href="previewImage" download="moment-image.png" @click.stop>保存图片</a></div>
      <div v-if="showCharacterPicker" class="moment-modal-overlay" @click.self="showCharacterPicker = false"><div class="moment-sheet"><h3>让谁看看这条</h3><button v-for="chat in manualEligibleCharacters" :key="chat.id" :disabled="manualViewLoading" @click="requestCharacterView(chat)">{{ chat.name }}</button><div v-if="!manualEligibleCharacters.length" class="empty-note">没有角色拥有这条动态的查看权限</div><button @click="showCharacterPicker = false">取消</button></div></div>
      <div v-if="showNotifications" class="moment-modal-overlay" @click.self="showNotifications = false"><div class="moment-sheet notification-sheet"><h3>互动消息</h3><div v-if="!allNotifications.length" class="empty-note">还没有新互动</div><div v-for="notice in allNotifications" :key="notice.id" class="notice-item" :class="{ unread: !notice.read }" @click="openNotificationMoment(notice)"><b>{{ notice.actorName }}</b> {{ notice.type === 'like' ? '赞了你的动态' : notice.type === 'comment' ? `评论：${notice.content}` : notice.type === 'reply' ? `回复：${notice.content}` : notice.type === 'view' ? '查看了这条动态' : '赞了你的评论' }}<small>{{ formatTime(notice.createdAt) }}</small></div><button @click="markNotificationsRead">全部已读</button><button @click="showNotifications = false">关闭</button></div></div>
      <div v-if="showBehaviorSettings" class="moment-modal-overlay" @click.self="showBehaviorSettings = false"><div class="behavior-panel"><header><button @click="showBehaviorSettings = false">‹</button><strong>角色朋友圈设置</strong><span></span></header><div class="behavior-characters"><button v-for="chat in availableCharacters" :key="chat.id" :class="{ active: selectedBehaviorChatId === chat.id }" @click="openBehavior(chat)">{{ chat.name }}</button></div><div v-if="selectedBehaviorChatId" class="behavior-form"><label>允许使用朋友圈<input type="checkbox" v-model="behaviorDraft.enabled" /></label><label>活跃开始<input type="number" min="0" max="23" v-model.number="behaviorDraft.activeStart" /></label><label>活跃结束<input type="number" min="0" max="23" v-model.number="behaviorDraft.activeEnd" /></label><label>发帖冷却（分钟）<input type="number" min="0" v-model.number="behaviorDraft.postCooldownMinutes" /></label><label>互动冷却（分钟）<input type="number" min="0" v-model.number="behaviorDraft.interactCooldownMinutes" /></label><label>点赞概率 %<input type="range" min="0" max="100" v-model.number="behaviorDraft.likeProbability" /><span>{{ behaviorDraft.likeProbability }}</span></label><label>评论概率 %<input type="range" min="0" max="100" v-model.number="behaviorDraft.commentProbability" /><span>{{ behaviorDraft.commentProbability }}</span></label><label>发图概率 %<input type="range" min="0" max="100" v-model.number="behaviorDraft.imageProbability" /><span>{{ behaviorDraft.imageProbability }}</span></label><label>朋友圈文风<textarea v-model="behaviorDraft.style"></textarea></label><label>默认受众<select v-model="behaviorDraft.audience"><option>公开</option><option>私密</option><option>部分可见</option><option>不给谁看</option></select></label><button class="behavior-save" @click="saveBehavior">保存设置</button></div></div></div>
      <div v-if="showAudienceGroupPicker" class="moment-modal-overlay audience-picker-overlay" @click.self="showAudienceGroupPicker = false"><div class="moment-sheet"><h3>{{ behaviorDraft.audience }}的分组</h3><label v-for="group in groups" :key="group.id" class="audience-check"><span>{{ group.name }}</span><input type="checkbox" :value="group.id" v-model="behaviorDraft.audienceGroupIds" /></label><div v-if="!groups.length" class="empty-note">请先在联系人中创建分组</div><button @click="showAudienceGroupPicker = false">确定</button></div></div>
      <div v-if="pendingDeleteMoment" class="moment-modal-overlay" @click.self="pendingDeleteMoment = null"><div class="moment-sheet"><h3>删除朋友圈</h3><div class="empty-note">删除后无法恢复，确定继续吗？</div><button class="danger-text" @click="confirmDeleteMoment">删除</button><button @click="pendingDeleteMoment = null">取消</button></div></div>
      <Transition name="zoom-fade">
        <DiscoverPublish 
          v-if="showPublishView" 
          @close="showPublishView = false"
          @publish="handlePublish"
        />
      </Transition>
    </Teleport>

    <!-- 底部批量删除栏 (同样通过 Teleport 覆盖底栏) -->
    <Teleport to="body">
      <div v-if="isSelectionMode" class="batch-delete-bar">
        <div class="batch-delete-info">已选 {{ selectedIds.length }} 项</div>
        <button class="batch-delete-btn" :disabled="selectedIds.length === 0" @click="requestBatchDelete">删除</button>
      </div>

      <!-- 自定义批量删除确认弹窗 -->
      <div v-if="showBatchDeleteModal" class="custom-modal-overlay" @click.self="showBatchDeleteModal = false">
        <div class="custom-modal">
          <div class="custom-modal-title">提示</div>
          <div class="custom-modal-content">确定要删除选中的 {{ selectedIds.length }} 条朋友圈吗？</div>
          <div class="custom-modal-actions">
            <div class="custom-modal-btn cancel-btn" @click="showBatchDeleteModal = false">取消</div>
            <div class="custom-modal-btn confirm-btn" @click="confirmBatchDelete">确定</div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.view-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; z-index: 1; }
.with-tabbar { height: 100%; padding-bottom: 90px; }
/* ================= 发现页 (Discover) ================= */
.selection-action-btn {
  font-size: 15px;
  color: #555;
  cursor: pointer;
  padding: 4px 8px;
}
.discover-view {
  background-color: var(--sys-bg-primary);
  overflow: hidden;
}

.discover-bg {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 400px;
  background-color: var(--sys-bg-secondary);
  background-image: radial-gradient(#e8e8e8 15%, transparent 16%), radial-gradient(#e8e8e8 15%, transparent 16%);
  background-size: 24px 24px;
  background-position: 0 0, 12px 12px;
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%);
  mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%);
  z-index: 0;
}

.discover-main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
}

.discover-top-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 0;
  position: relative;
  z-index: 2;
}

.top-action-icon {
  cursor: pointer;
}
.moment-unread-badge{position:absolute;left:14px;top:-8px;min-width:15px;height:15px;padding:0 3px;border-radius:8px;background:#e5484d;color:#fff;font-size:9px;line-height:15px;text-align:center;pointer-events:none}

.discover-header-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 20px 20px;
  gap: 20px;
}

.discover-avatar-wrapper {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  padding: 4px;
  background: var(--sys-bg-secondary);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.discover-avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--sys-bg-primary);
}

.discover-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.signature-text {
  flex: 1;
  text-align: center;
  font-size: 13px;
  color: #555;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 10px;
}

.skeleton-text-bar {
  width: 140px;
  height: 14px;
  background: #ebebeb;
  border-radius: 7px;
}

.discover-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 280px;
  gap: 12px;
}

.player-pill {
  background: rgba(235, 235, 235, 0.8);
  backdrop-filter: blur(4px);
  border-radius: 20px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  box-sizing: border-box;
  cursor: pointer;
}

.player-text {
  font-family: monospace, -apple-system, sans-serif;
  font-size: 13px;
  color: #777;
  letter-spacing: 0.5px;
}
.player-text .date {
  font-weight: 600;
  color: var(--text-secondary);
  margin-left: 4px;
}

.progress-bar-container {
  width: 100%;
  padding: 0 4px;
}

.progress-track {
  width: 100%;
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  width: 35%;
  height: 100%;
  background: #888;
  border-radius: 2px;
}

.player-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 8px;
}

.play-btn {
  width: 40px;
  height: 40px;
  background: #b0b0b0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  cursor: pointer;
}

.discover-moments-section {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-bottom: 40px;
}

.moment-item {
  display: flex;
  gap: 12px;
  transition: background-color 0.2s;
  border-radius: 8px;
}
.moment-item.is-selection-mode {
  cursor: pointer;
  padding: 8px;
  margin: -8px; /* 补偿 padding 使得视觉上不偏移 */
}
.moment-item.is-selection-mode:active {
  background-color: rgba(0, 0, 0, 0.05);
}

.moment-checkbox {
  display: flex;
  align-items: flex-start;
  padding-top: 8px;
}
.checkbox-circle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  transition: all 0.2s;
}
.checkbox-circle.is-checked {
  background-color: var(--sys-color-primary, #07c160);
  border-color: var(--sys-color-primary, #07c160);
}

.moment-avatar {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.moment-content-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.moment-author {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.moment-content {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}
.moment-meta { color: #576b95; font-size: 12px; line-height: 1.4; }

.moment-images {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 4px;
}

.moment-img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 4px;
}
.pinned-mark { display:inline-block; margin-right:6px; padding:1px 4px; border-radius:3px; background:#576b95; color:#fff; font-size:9px; vertical-align:2px; }
.moment-modal-overlay { position:fixed; inset:0; z-index:12000; background:rgba(0,0,0,.48); display:flex; align-items:flex-end; justify-content:center; }
.moment-detail-modal,.behavior-panel { width:min(100%,520px); max-height:92vh; overflow:auto; background:var(--sys-bg-primary,#fff); border-radius:16px 16px 0 0; color:var(--text-primary,#222); }
.moment-detail-modal header,.behavior-panel header { position:sticky; top:0; z-index:2; display:flex; justify-content:space-between; align-items:center; padding:15px 18px; background:inherit; border-bottom:1px solid var(--border-color,#eee); }
.moment-detail-modal header button,.behavior-panel header button { border:0; background:none; font-size:28px; color:inherit; }
.moment-detail-modal section { padding:20px; }.detail-author { color:#576b95;font-weight:600}.detail-meta-row{display:flex;gap:10px;color:#999;font-size:11px;margin:8px 0}.detail-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:14px 0}.detail-grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px}.detail-like-list,.detail-comment-list{padding:10px;background:var(--sys-bg-secondary,#f6f6f6);font-size:13px}.detail-comment-list div{padding:5px 0}.detail-comment-list b{color:#576b95}.detail-comment-list button{float:right;border:0;background:none;color:#8994a7}.detail-composer{display:flex;gap:7px;align-items:center;margin-top:12px;padding:8px;background:var(--sys-bg-secondary,#f6f6f6);border-radius:7px}.detail-composer span{font-size:11px;color:#576b95}.detail-composer input{flex:1;min-width:0;border:0;outline:0;background:none}.detail-composer button{border:0;background:#576b95;color:#fff;border-radius:5px;padding:5px 9px}.detail-composer button:disabled{opacity:.4}
.image-preview-overlay{position:fixed;inset:0;z-index:13000;background:#050505;display:flex;align-items:center;justify-content:center}.image-preview-overlay img{max-width:100%;max-height:90%;object-fit:contain}.image-preview-overlay a{position:absolute;right:20px;bottom:28px;color:#fff;text-decoration:none;padding:8px 12px;border:1px solid rgba(255,255,255,.5);border-radius:18px}
.moment-sheet{width:min(100%,480px);max-height:75vh;overflow:auto;background:var(--sys-bg-primary,#fff);border-radius:16px 16px 0 0;padding:16px;display:flex;flex-direction:column}.moment-sheet h3{text-align:center;margin:0 0 12px}.moment-sheet>button{padding:13px;border:0;border-top:1px solid var(--border-color,#eee);background:none;color:var(--text-primary,#333);font-size:15px}.notice-item{position:relative;padding:12px 4px;border-bottom:1px solid var(--border-color,#eee);font-size:13px;cursor:pointer}.notice-item.unread:before{content:'';position:absolute;left:-8px;top:17px;width:5px;height:5px;border-radius:50%;background:#e5484d}.notice-item small{display:block;color:#999;margin-top:4px}.empty-note{text-align:center;color:#999;padding:30px}
.behavior-characters{display:flex;gap:8px;overflow:auto;padding:12px}.behavior-characters button{white-space:nowrap;border:1px solid #ddd;background:none;border-radius:16px;padding:6px 12px}.behavior-characters button.active{background:#576b95;color:#fff;border-color:#576b95}.behavior-form{padding:0 18px 24px}.behavior-form label{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-color,#eee);font-size:13px}.behavior-form input[type=number],.behavior-form select{width:90px}.behavior-form textarea{width:55%;min-height:55px}.behavior-save{width:100%;margin-top:18px;padding:11px;border:0;border-radius:8px;background:#576b95;color:#fff}
.audience-picker-overlay{z-index:12500}.audience-check{display:flex;justify-content:space-between;padding:12px;border-bottom:1px solid var(--border-color,#eee)}.audience-check input{width:18px;height:18px;accent-color:#576b95}
.own-moment-menu-wrap{position:relative}.own-moment-more{border:0;background:none;color:#576b95;font-size:12px}.own-moment-menu{position:absolute;left:0;top:20px;z-index:8;display:flex;background:#4b4b4b;border-radius:5px;overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,.2)}.own-moment-menu button{white-space:nowrap;border:0;border-right:1px solid rgba(255,255,255,.15);background:none;color:#fff;padding:7px 10px;font-size:11px}.own-moment-menu button.danger{color:#ffb4b4}.danger-text{color:#e5484d!important}

.moment-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.moment-interactions {
  margin-top: 10px;
  background: var(--sys-bg-secondary);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.moment-likes {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: #576b95;
  font-weight: 500;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  padding-bottom: 6px;
}
.moment-likes:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.like-names {
  flex: 1;
  line-height: 1.4;
}

.moment-comments {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.comment-item {
  line-height: 1.4;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.moment-image-status { margin-top: 8px; padding: 8px 10px; border-radius: 5px; color: #888; font-size: 12px; background: var(--sys-bg-secondary, #f5f5f5); }
.moment-image-status.is-error { color: #b07d55; }
.comment-main { cursor: pointer; min-width: 0; }
.comment-reply { color: #576b95; margin-left: 3px; }
.comment-tools { flex-shrink: 0; display: flex; gap: 5px; opacity: .72; }
.comment-tools button, .moment-action-btn { border: 0; background: transparent; color: #8994a7; padding: 0; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 2px; }
.comment-tools button.active, .moment-action-btn.active { color: #576b95; }
.comment-composer { display: flex; align-items: center; gap: 7px; margin-top: 10px; padding: 8px; background: var(--sys-bg-secondary, #f5f5f5); border-radius: 6px; flex-wrap: wrap; }
.comment-composer input { flex: 1; min-width: 130px; border: 0; outline: 0; background: transparent; font-size: 13px; color: var(--text-primary, #333); }
.comment-composer button { border: 0; border-radius: 4px; padding: 4px 8px; color: #fff; background: #576b95; font-size: 12px; cursor: pointer; }
.comment-composer button:disabled { opacity: .45; cursor: default; }
.comment-composer .cancel-comment { background: transparent; color: #888; }
.reply-hint { width: 100%; color: #576b95; font-size: 12px; }
.comment-author {
  color: #576b95;
  font-weight: 500;
}
.comment-text {
  color: var(--text-primary);
}

.moment-time-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.moment-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.visibility-icon {
  margin-top: -1px;
}

.delete-moment-btn {
  font-size: 12px;
  color: #576b95;
  cursor: pointer;
  margin-left: 2px;
}

.moment-actions {
  display: flex;
  gap: 16px;
  color: var(--text-tertiary);
}
.moment-action-btn { width: 18px; height: 18px; justify-content: center; }

/* Dropdown */
.dropdown-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 10;
}
.action-dropdown {
  position: absolute;
  top: 30px;
  left: 0;
  background: var(--sys-bg-primary, #fff);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 11;
  min-width: 120px;
  overflow: hidden;
}
.action-item {
  padding: 12px 16px;
  font-size: 14px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color, #eee);
  cursor: pointer;
  white-space: nowrap;
}
.action-item:last-child {
  border-bottom: none;
}
.action-item:active {
  background: rgba(0,0,0,0.05);
}

/* 居中缩放淡入动画 */
.zoom-fade-enter-active,
.zoom-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.zoom-fade-enter-from,
.zoom-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* 批量删除栏 */
.batch-delete-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 90px;
  padding-bottom: 30px; /* 模拟 tabbar 的高度和安全区 */
  background: var(--sys-bg-primary, #fff);
  border-top: 1px solid var(--border-color, #eee);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-left: 20px;
  padding-right: 20px;
  z-index: 9999;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
  box-sizing: border-box;
}
.batch-delete-info {
  font-size: 15px;
  color: #333;
}
.batch-delete-btn {
  background: #ff4d4f;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 20px;
  font-size: 15px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.batch-delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.batch-delete-btn:not(:disabled):active {
  opacity: 0.8;
}

/* 自定义确认弹窗 */
.custom-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.custom-modal {
  width: 280px;
  background: var(--sys-bg-primary, #fff);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.custom-modal-title {
  font-size: 17px;
  font-weight: 600;
  text-align: center;
  padding: 20px 20px 10px;
  color: var(--text-primary, #333);
}
.custom-modal-content {
  font-size: 15px;
  color: var(--text-secondary, #666);
  text-align: center;
  padding: 0 20px 20px;
}
.custom-modal-actions {
  display: flex;
  border-top: 1px solid var(--border-color, #eee);
}
.custom-modal-btn {
  flex: 1;
  text-align: center;
  padding: 14px 0;
  font-size: 16px;
  cursor: pointer;
}
.custom-modal-btn:active {
  background: rgba(0,0,0,0.05);
}
.cancel-btn {
  color: var(--text-primary, #333);
  border-right: 1px solid var(--border-color, #eee);
}
.confirm-btn {
  color: #ff4d4f;
  font-weight: 600;
}
</style>
