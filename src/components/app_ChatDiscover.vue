/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import localforage from 'localforage'
import TextEditModal from './TextEditModal.vue'
import DiscoverPublish from './app_DiscoverPublish.vue'
import { useChatAuth } from '../composables/useChatAuth'

const { currentChatUserId } = useChatAuth()
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

const resolvedAvatars = ref<Record<string, string>>({})

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
    await discoverStore.setItem('moments_list', plainMoments)
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
})

const loadMoments = async () => {
  try {
    const saved = await discoverStore.getItem<any[]>('moments_list')
    if (saved && Array.isArray(saved)) {
      mockMoments.value = saved

      // 解析 localforage 头像
      for (const m of saved) {
        if (m.avatar && m.avatar.startsWith('localforage:')) {
          const key = m.avatar.split(':')[1]
          avatarStore.getItem<string>(key).then(realAvatar => {
            if (realAvatar) {
              resolvedAvatars.value[m.id] = realAvatar
            }
          }).catch(e => {})
        }
      }
    }
  } catch(e) {
    console.error('Failed to load moments', e)
  }
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
    await discoverStore.setItem('moments_list', plainMoments)
  } catch(e) {
    console.error('Failed to save after delete', e)
  }
}

const handlePublish = async (data: { text: string, images: string[], visibility: string, groupIds?: string[] }) => {
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
    isOwn: true, // 标记是自己发布的动态
    likes: [] as string[],
    comments: [] as { author: string, content: string }[]
  }
  
  mockMoments.value.unshift(newMoment)
  showPublishView.value = false
  
  try {
    // 将 Vue 的 Proxy 响应式对象深拷贝解构为普通数组，避免 localforage 的 DataCloneError
    const plainMoments = JSON.parse(JSON.stringify(mockMoments.value))
    await discoverStore.setItem('moments_list', plainMoments)
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
            
            <div v-if="showActionMenu" class="dropdown-overlay" @click.stop="closeActionMenu"></div>
            <div v-if="showActionMenu" class="action-dropdown">
              <div class="action-item" @click.stop="togglePlayerControls">
                {{ showPlayerControls ? '隐藏播放条' : '显示播放条' }}
              </div>
              <div class="action-item" @click.stop="enterSelectionMode">
                批量删除
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
        <div v-for="moment in mockMoments" :key="moment.id" class="moment-item" :class="{'is-selection-mode': isSelectionMode}" @click="isSelectionMode && toggleSelection(moment.id)">
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
            <div class="moment-author">{{ moment.author }}</div>
            <div class="moment-content">{{ moment.content }}</div>
            <div class="moment-images" v-if="moment.images && moment.images.length">
              <img v-for="(img, idx) in moment.images" :key="idx" :src="img" class="moment-img" />
            </div>
            
            <!-- 点赞和评论展示区 -->
            <div class="moment-interactions" v-if="(moment.likes && moment.likes.length) || (moment.comments && moment.comments.length)">
              <div class="moment-likes" v-if="moment.likes && moment.likes.length">
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="#576b95" stroke-width="2" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <span class="like-names">{{ moment.likes.join(', ') }}</span>
              </div>
              <div class="moment-comments" v-if="moment.comments && moment.comments.length">
                <div v-for="(comment, cIdx) in moment.comments" :key="cIdx" class="comment-item">
                  <span class="comment-author">{{ comment.author }}</span>: <span class="comment-text">{{ comment.content }}</span>
                </div>
              </div>
            </div>

            <div class="moment-footer">
              <div class="moment-time-wrap">
                <span class="moment-time">{{ formatTime(moment.time) }}</span>
                <!-- 仅当非公开时显示人群小图标 -->
                <svg v-if="moment.visibility && moment.visibility !== '公开'" viewBox="0 0 24 24" width="14" height="14" stroke="#888" stroke-width="2" fill="none" class="visibility-icon"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <!-- 删除按钮 -->
                <div v-if="moment.isOwn && !isSelectionMode" class="delete-moment-btn" @click.stop="handleDeleteMoment(moment.id)">删除</div>
              </div>
              <div class="moment-actions">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              </div>
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
    
    <!-- 全屏发布界面 (通过 Teleport 挂载到 body 以遮挡底栏) -->
    <Teleport to="body">
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

.moment-images {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.moment-img {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 4px;
}

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
}
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
