/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import localforage from 'localforage'
import AvatarUploadModal from '../../AvatarUploadModal.vue'

// IndexedDB 用于存储封面图片和样式
const memoryCoverStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'memoryCovers'
})

const memoryStyleStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'memoryStyles'
})

const props = defineProps<{
  visible: boolean
  memories: any[]
  isSummarizing?: boolean
  messages?: any[]
}>()

const getMemoryIndexRangeStr = (mem: any) => {
  if (mem.isCondensed) {
    return '多段记忆归纳精华'
  }
  
  if (!mem.fromMsgId || !mem.toMsgId || !props.messages || props.messages.length === 0) {
    return `包含 ${mem.messageCount || '多'} 条聊天记录`
  }

  // 过滤出真正有效计入总结的消息（排除 time 类型）
  const validMsgs = props.messages.filter(m => m.type === 'left' || m.type === 'right' || m.type === 'system')
  
  const startIndex = validMsgs.findIndex(m => m.id === mem.fromMsgId)
  const endIndex = validMsgs.findIndex(m => m.id === mem.toMsgId)

  if (startIndex !== -1 && endIndex !== -1) {
    return `包含第 ${startIndex + 1} 条 到 第 ${endIndex + 1} 条的聊天记录`
  }

  return `包含 ${mem.messageCount || '多'} 条聊天记录`
}

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update-memories', memories: any[]): void
  (e: 'summarize-memories', selectedIds: number[], strategy: 'replace' | 'archive'): void
}>()

const isMultiSelectMode = ref(false)
const selectedIds = ref<number[]>([])

const toggleMultiSelect = () => {
  isMultiSelectMode.value = !isMultiSelectMode.value
  if (!isMultiSelectMode.value) {
    selectedIds.value = []
  }
}

const toggleSelection = (id: number) => {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

const selectAll = () => {
  if (selectedIds.value.length === props.memories.length) {
    selectedIds.value = []
  } else {
    selectedIds.value = props.memories.map(m => m.id)
  }
}

const showDeleteConfirm = ref(false)
const showRefreshOptions = ref(false)

const triggerDeleteSelected = () => {
  if (selectedIds.value.length === 0) return
  showDeleteConfirm.value = true
}

const confirmDeleteSelected = () => {
  const newMemories = props.memories.filter(m => !selectedIds.value.includes(m.id))
  emit('update-memories', newMemories)
  selectedIds.value = []
  isMultiSelectMode.value = false
  showDeleteConfirm.value = false
}

// Toast logic
const toastVisible = ref(false)
const toastMessage = ref('')
let toastTimer: any = null

const showToast = (msg: string) => {
  toastMessage.value = msg
  toastVisible.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastVisible.value = false
  }, 2000)
}

const condenseSelected = () => {
  if (selectedIds.value.length === 0) {
    showToast('请先选择要刷新的记忆')
    return
  }
  showRefreshOptions.value = true
}

const confirmRefresh = (strategy: 'replace' | 'archive') => {
  emit('summarize-memories', [...selectedIds.value], strategy)
  showRefreshOptions.value = false
  selectedIds.value = []
  isMultiSelectMode.value = false
}

// 详情/编辑模式
const detailMemory = ref<any>(null)
const editMode = ref(false)
const editingContent = ref('')

const openDetail = (mem: any) => {
  if (isMultiSelectMode.value) {
    toggleSelection(mem.id)
    return
  }
  detailMemory.value = mem
  editingContent.value = mem.content
  editMode.value = false
}

const closeDetail = () => {
  detailMemory.value = null
  editMode.value = false
}

const startEdit = () => {
  editMode.value = true
}

const saveEdit = () => {
  if (detailMemory.value) {
    const updatedMemories = props.memories.map(m => {
      if (m.id === detailMemory.value.id) {
        return { ...m, content: editingContent.value }
      }
      return m
    })
    emit('update-memories', updatedMemories)
    detailMemory.value.content = editingContent.value
    editMode.value = false
  }
}

const getBookColor = (index: number) => {
  const colors = ['#E8F3D6', '#FDEEE9', '#EBF5FB', '#F4F1FA', '#FEF5E7']
  return colors[index % colors.length]
}

const getBookTitleColor = (index: number) => {
  const colors = ['#558B2F', '#D35400', '#2874A6', '#6C3483', '#B9770E']
  return colors[index % colors.length]
}

// 封面、样式与长按逻辑
const memoryCovers = ref<Record<number, string>>({})
const memoryStyles = ref<Record<number, any>>({})
const showStyleModal = ref(false)
const targetMemoryIdForStyle = ref<number | null>(null)
let longPressTimer: any = null
let preventClick = false

const loadAssets = async () => {
  if (!props.memories) return
  for (const mem of props.memories) {
    try {
      const coverUrl = await memoryCoverStore.getItem<string>(`cover_${mem.id}`)
      if (coverUrl) memoryCovers.value[mem.id] = coverUrl
      
      const styleConfig = await memoryStyleStore.getItem<any>(`style_${mem.id}`)
      if (styleConfig) memoryStyles.value[mem.id] = styleConfig
    } catch (e) {
      console.error('Failed to load memory assets', e)
    }
  }
}

onMounted(() => {
  loadAssets()
})

watch(() => props.memories, () => {
  loadAssets()
}, { deep: true })

// ===== 自定义样式面板状态 =====
const styleForm = ref({
  coverUrl: '' as string | null,
  coverBlur: 0,
  bgColor: '#E8F3D6',
  spineColor: '#558B2F',
  showText: true,
  textColor: '#558B2F',
  showBadge: true,
  badgeBgColor: 'rgba(255,255,255,0.6)',
  badgeTextColor: '#333333',
  badgeRadius: 10
})

const activeTab = ref<'cover' | 'style'>('cover')
const coverInputUrl = ref('')

const handleTouchStart = (mem: any, index: number) => {
  if (isMultiSelectMode.value) return
  preventClick = false
  longPressTimer = setTimeout(() => {
    preventClick = true
    openStyleModal(mem, index)
  }, 600)
}

const handleTouchEnd = () => {
  if (longPressTimer) clearTimeout(longPressTimer)
}

const handleContextMenu = (e: Event, mem: any, index: number) => {
  if (isMultiSelectMode.value) return
  e.preventDefault()
  openStyleModal(mem, index)
}

const openStyleModal = (mem: any, index: number) => {
  targetMemoryIdForStyle.value = mem.id
  activeTab.value = 'cover'
  coverInputUrl.value = ''
  
  // 加载已有配置或设置默认值
  const existingStyle = memoryStyles.value[mem.id] || {}
  const existingCover = memoryCovers.value[mem.id] || null
  
  styleForm.value = {
    coverUrl: existingCover,
    coverBlur: existingStyle.coverBlur ?? 0,
    bgColor: existingStyle.bgColor || getBookColor(index),
    spineColor: existingStyle.spineColor || getBookTitleColor(index),
    showText: existingStyle.showText ?? true,
    textColor: existingStyle.textColor || getBookTitleColor(index),
    showBadge: existingStyle.showBadge ?? true,
    badgeBgColor: existingStyle.badgeBgColor || 'rgba(255,255,255,0.6)',
    badgeTextColor: existingStyle.badgeTextColor || '#333333',
    badgeRadius: existingStyle.badgeRadius ?? 10
  }
  showStyleModal.value = true
}

const closeStyleModal = () => {
  showStyleModal.value = false
  targetMemoryIdForStyle.value = null
}

const handleCoverFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      styleForm.value.coverUrl = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

const applyCoverUrl = () => {
  if (coverInputUrl.value.trim()) {
    styleForm.value.coverUrl = coverInputUrl.value.trim()
  }
}

const resetCover = () => {
  styleForm.value.coverUrl = null
  coverInputUrl.value = ''
}

const saveStyleAndCover = async () => {
  const mId = targetMemoryIdForStyle.value
  if (mId === null) return
  
  try {
    // 保存封面
    if (styleForm.value.coverUrl) {
      memoryCovers.value[mId] = styleForm.value.coverUrl
      await memoryCoverStore.setItem(`cover_${mId}`, styleForm.value.coverUrl)
    } else {
      delete memoryCovers.value[mId]
      await memoryCoverStore.removeItem(`cover_${mId}`)
    }
    
    // 保存样式
    const styleData = {
      coverBlur: styleForm.value.coverBlur,
      bgColor: styleForm.value.bgColor,
      spineColor: styleForm.value.spineColor,
      showText: styleForm.value.showText,
      textColor: styleForm.value.textColor,
      showBadge: styleForm.value.showBadge,
      badgeBgColor: styleForm.value.badgeBgColor,
      badgeTextColor: styleForm.value.badgeTextColor,
      badgeRadius: styleForm.value.badgeRadius
    }
    memoryStyles.value[mId] = styleData
    await memoryStyleStore.setItem(`style_${mId}`, styleData)
    
    showToast('外观设置已保存')
    closeStyleModal()
  } catch (err) {
    console.error('Failed to save memory styles', err)
    showToast('保存失败')
  }
}

const handleBookClick = (mem: any) => {
  if (preventClick) return
  openDetail(mem)
}

</script>

<template>
  <transition name="folder-fade">
    <div v-if="visible" class="folder-modal-overlay" @click="emit('close')">
      
      <!-- 主列表界面 -->
      <div v-if="!detailMemory" class="memory-modal-content" @click.stop>
        <div class="memory-header">
          <div class="memory-title">记忆书架</div>
          
          <div style="display: flex; gap: 8px;">
            <div v-if="memories.length > 0" class="header-action-btn" @click="toggleMultiSelect">
              {{ isMultiSelectMode ? '取消' : '管理' }}
            </div>
            <div class="memory-close" @click="emit('close')">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
          </div>
        </div>
        
        <div class="memory-body bookshelf-body">
          <div v-if="memories.length === 0" class="empty-memory">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
              </svg>
            </div>
            <div style="margin-top: 12px;">书架空空如也</div>
            <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px;">多聊聊天，让它帮你记住点滴吧</div>
          </div>
          
          <div class="bookshelf-grid" v-else>
            <div 
              v-for="(mem, index) in memories" 
              :key="mem.id" 
              class="book-item"
              @click="handleBookClick(mem)"
              @touchstart="handleTouchStart(mem, index)"
              @touchend="handleTouchEnd"
              @touchmove="handleTouchEnd"
              @contextmenu="(e) => handleContextMenu(e, mem, index)"
            >
              <div class="book-cover" :style="{ 
                backgroundColor: memoryStyles[mem.id]?.bgColor || getBookColor(index)
              }">
                <div 
                  v-if="memoryCovers[mem.id]" 
                  class="book-bg-img" 
                  :style="{ 
                    backgroundImage: `url(${memoryCovers[mem.id]})`,
                    filter: `blur(${memoryStyles[mem.id]?.coverBlur || 0}px)`
                  }"
                ></div>
                
                <div class="book-spine" :style="{ backgroundColor: memoryStyles[mem.id]?.spineColor || getBookTitleColor(index) }"></div>
                
                <div class="book-title" v-if="memoryStyles[mem.id]?.showText !== false" :style="{ color: memoryStyles[mem.id]?.textColor || getBookTitleColor(index) }">
                  {{ mem.date }}
                </div>
                
                <div class="book-badge" v-if="(mem.messageCount || mem.archived) && memoryStyles[mem.id]?.showBadge !== false" :style="{
                  backgroundColor: memoryStyles[mem.id]?.badgeBgColor || 'rgba(255,255,255,0.6)',
                  color: memoryStyles[mem.id]?.badgeTextColor || '#333333',
                  borderRadius: `${memoryStyles[mem.id]?.badgeRadius ?? 10}px`
                }">
                  {{ mem.archived ? '历史版本' : `${mem.messageCount}条记录` }}
                </div>
                
                <!-- 多选遮罩 -->
                <div v-if="isMultiSelectMode" class="book-select-overlay" :class="{ 'is-selected': selectedIds.includes(mem.id) }">
                  <div class="select-check">
                    <svg v-if="selectedIds.includes(mem.id)" viewBox="0 0 24 24" width="16" height="16" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部管理栏 -->
        <transition name="slide-up">
          <div v-if="isMultiSelectMode" class="memory-bottom-bar">
            <div class="bar-btn" @click="selectAll">全选</div>
            <div class="bar-btn primary" :class="{ disabled: selectedIds.length === 0 || isSummarizing }" @click="condenseSelected">
              {{ isSummarizing ? '刷新中...' : '刷新总结' }}
            </div>
            <div class="bar-btn danger" :class="{ disabled: selectedIds.length === 0 }" @click="triggerDeleteSelected">删除</div>
          </div>
        </transition>

        <!-- 自定义确认删除弹窗 -->
        <transition name="folder-fade">
          <div v-if="showDeleteConfirm" class="confirm-modal-overlay" @click.stop="showDeleteConfirm = false">
            <div class="custom-confirm-modal" @click.stop>
              <div class="confirm-title">删除记忆</div>
              <div class="confirm-desc">确定要删除选中的 {{ selectedIds.length }} 条记忆书吗？<br/>删除后无法恢复。</div>
              <div class="confirm-actions">
                <div class="confirm-btn cancel" @click="showDeleteConfirm = false">取消</div>
                <div class="confirm-btn danger" @click="confirmDeleteSelected">确认删除</div>
              </div>
            </div>
          </div>
        </transition>

        <!-- 刷新方式：复用相邻总结设置页的选择列表结构 -->
        <transition name="folder-fade">
          <div v-if="showRefreshOptions" class="confirm-modal-overlay" @click.self="showRefreshOptions = false">
            <div class="choice-modal" @click.stop>
              <div class="choice-title">怎样保存刷新结果？</div>
              <div class="choice-intro">系统会按先后顺序合并所选记忆；较新的明确修改会替代旧内容。</div>
              <div class="choice-list">
                <div class="choice-item" @click="confirmRefresh('replace')">
                  <div>
                    <div class="choice-name">覆盖所选记忆（推荐）</div>
                    <div class="choice-desc">删除所选旧总结，只保留刷新后的当前版本，最节省记忆空间。</div>
                  </div>
                  <div class="choice-arrow">›</div>
                </div>
                <div class="choice-item" @click="confirmRefresh('archive')">
                  <div>
                    <div class="choice-name">保留历史版本</div>
                    <div class="choice-desc">旧总结仍留在书架，但不再参与聊天记忆；同时生成新的当前版本。</div>
                  </div>
                  <div class="choice-arrow">›</div>
                </div>
              </div>
              <div class="choice-cancel" @click="showRefreshOptions = false">取消</div>
            </div>
          </div>
        </transition>
      </div>

      <!-- 单本记忆详情界面 -->
      <div v-else class="memory-modal-content detail-mode" @click.stop>
        <div class="memory-header">
          <div class="memory-back" @click="closeDetail">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </div>
          <div class="memory-title" style="flex: 1; text-align: center;">{{ detailMemory.date }} 的记忆</div>
          <div class="header-action-btn" @click="editMode ? saveEdit() : startEdit()">
            {{ editMode ? '保存' : '编辑' }}
          </div>
        </div>

        <div class="memory-body detail-body">
          <div class="detail-meta">
            {{ detailMemory.archived ? '历史版本 · 不参与后续聊天记忆' : getMemoryIndexRangeStr(detailMemory) }}
          </div>
          
          <div v-if="!editMode" class="detail-content-view">
            {{ detailMemory.content }}
          </div>
          <textarea 
            v-else 
            v-model="editingContent" 
            class="detail-content-edit" 
            placeholder="记忆内容..."
          ></textarea>
        </div>
      </div>

      
      <!-- Toast -->
      <transition name="toast-fade">
        <div v-if="toastVisible" class="memory-toast">
          {{ toastMessage }}
        </div>
      </transition>

      <!-- 样式与封面定制弹窗 -->
      <transition name="folder-fade">
        <div v-if="showStyleModal" class="confirm-modal-overlay" style="z-index: 10005;" @click.self="closeStyleModal">
          <div class="style-modal-content" @click.stop>
            <div class="style-header">
              <div class="memory-title">定制书本外观</div>
              <div class="memory-close" @click="closeStyleModal">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </div>
            </div>

            <!-- 实时预览区 -->
            <div class="style-preview-area">
              <div class="book-item preview-book">
                <div class="book-cover" :style="{ backgroundColor: styleForm.bgColor }">
                  <div 
                    v-if="styleForm.coverUrl" 
                    class="book-bg-img" 
                    :style="{ 
                      backgroundImage: `url(${styleForm.coverUrl})`,
                      filter: `blur(${styleForm.coverBlur}px)`
                    }"
                  ></div>
                  <div class="book-spine" :style="{ backgroundColor: styleForm.spineColor }"></div>
                  <div class="book-title" v-if="styleForm.showText" :style="{ color: styleForm.textColor }">
                    2026/7/16
                  </div>
                  <div class="book-badge" v-if="styleForm.showBadge" :style="{ 
                    backgroundColor: styleForm.badgeBgColor,
                    color: styleForm.badgeTextColor,
                    borderRadius: `${styleForm.badgeRadius}px`
                  }">
                    5条记录
                  </div>
                </div>
              </div>
            </div>

            <!-- 选项卡切换 -->
            <div class="style-tabs">
              <div class="s-tab" :class="{ active: activeTab === 'cover' }" @click="activeTab = 'cover'">背景图</div>
              <div class="s-tab" :class="{ active: activeTab === 'style' }" @click="activeTab = 'style'">色彩排版</div>
            </div>

            <div class="style-body">
              <!-- 背景图设置 -->
              <div v-if="activeTab === 'cover'" class="style-panel">
                <div class="upload-options">
                  <label class="custom-file-upload">
                    <input type="file" accept="image/*" @change="handleCoverFileChange" class="hidden-file-input" />
                    <span class="upload-btn-text">📁 点击上传本地图片</span>
                  </label>
                  
                  <div class="url-input-wrap" style="margin-top: 8px;">
                    <input type="text" v-model="coverInputUrl" placeholder="或输入网络图片URL..." />
                    <button @click="applyCoverUrl" class="btn-small">应用</button>
                  </div>
                  
                  <div style="display: flex; justify-content: flex-end; margin-top: 6px;">
                    <span class="reset-link" @click="resetCover">清空图片</span>
                  </div>
                </div>

                <div class="form-item" style="margin-top: 8px;" :class="{ disabled: !styleForm.coverUrl }">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label style="margin: 0;">图片模糊程度: {{ styleForm.coverBlur }}px</label>
                    <div class="reset-icon" @click="styleForm.coverBlur = 0" title="重置">↺</div>
                  </div>
                  <input type="range" min="0" max="20" step="1" v-model.number="styleForm.coverBlur" class="range-slider">
                </div>
              </div>

              <!-- 色彩与排版设置 -->
              <div v-if="activeTab === 'style'" class="style-panel compact-panel">
                <div class="form-row">
                  <label>书本底色</label>
                  <input type="color" v-model="styleForm.bgColor">
                </div>
                <div class="form-row">
                  <label>书脊颜色</label>
                  <input type="color" v-model="styleForm.spineColor">
                </div>
                
                <div class="divider"></div>
                
                <div class="form-row">
                  <label>显示日期标题</label>
                  <label class="switch">
                    <input type="checkbox" v-model="styleForm.showText">
                    <span class="slider"></span>
                  </label>
                </div>
                <div class="form-row" :class="{ disabled: !styleForm.showText }">
                  <label>标题颜色</label>
                  <input type="color" v-model="styleForm.textColor">
                </div>
                
                <div class="divider"></div>

                <div class="form-row">
                  <label>显示记录胶囊</label>
                  <label class="switch">
                    <input type="checkbox" v-model="styleForm.showBadge">
                    <span class="slider"></span>
                  </label>
                </div>

                <div class="form-item-group" :class="{ disabled: !styleForm.showBadge }">
                  <div class="form-row">
                    <label>胶囊文字</label>
                    <input type="color" v-model="styleForm.badgeTextColor">
                  </div>
                  <div class="form-item">
                    <label>胶囊底色 (支持 rgba)</label>
                    <input type="text" v-model="styleForm.badgeBgColor" class="text-input" placeholder="例如: rgba(255,255,255,0.6)">
                  </div>
                  <div class="form-item" style="margin-top: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <label style="margin: 0;">胶囊圆角: {{ styleForm.badgeRadius }}px</label>
                      <div class="reset-icon" @click="styleForm.badgeRadius = 10" title="重置">↺</div>
                    </div>
                    <input type="range" min="0" max="20" step="1" v-model.number="styleForm.badgeRadius" class="range-slider">
                  </div>
                </div>
              </div>
            </div>

            <div class="style-actions">
              <div class="confirm-btn primary" @click="saveStyleAndCover" style="border-radius: 0 0 16px 16px;">确认保存</div>
            </div>
          </div>
        </div>
      </transition>

    </div>
  </transition>
</template>

<style scoped>
.folder-modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.4);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.memory-modal-content {
  background: var(--sys-bg-secondary);
  width: 90%;
  max-width: 420px;
  height: 70vh;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.memory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 12px;
  background: var(--sys-bg-secondary);
  z-index: 10;
}

.memory-title {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
}

.memory-close, .memory-back {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 50%;
  color: var(--text-secondary);
  transition: background 0.2s;
}
.memory-close:hover, .memory-back:hover {
  background: var(--sys-bg-primary);
}

.header-action-btn {
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}
.header-action-btn:hover {
  background: var(--sys-bg-primary);
  color: var(--text-primary);
}

.memory-body {
  overflow-y: auto;
  flex: 1;
  background: var(--sys-bg-primary);
}

.bookshelf-body {
  padding: 20px;
}

.empty-memory {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 14px;
  height: 100%;
}
.empty-icon {
  opacity: 0.3;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 书架网格布局 */
.bookshelf-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px 16px;
}

.book-item {
  aspect-ratio: 3 / 4;
  cursor: pointer;
  perspective: 1000px;
}

.book-cover {
  width: 100%;
  height: 100%;
  border-radius: 4px 8px 8px 4px;
  position: relative;
  box-shadow: 2px 4px 8px rgba(0,0,0,0.1), inset -2px 0 4px rgba(0,0,0,0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px;
  overflow: hidden;
}

.book-bg-img {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background-size: cover;
  background-position: center;
  border-radius: inherit;
  z-index: 0;
  /* 解决模糊边缘溢出问题 */
  transform: scale(1.1); 
}

.book-title, .book-badge {
  z-index: 1;
}

.book-item:hover .book-cover {
  transform: translateY(-4px) rotateY(-5deg);
  box-shadow: 4px 8px 12px rgba(0,0,0,0.15), inset -2px 0 4px rgba(0,0,0,0.05);
}

.book-spine {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 8px;
  opacity: 0.8;
  border-radius: 4px 0 0 4px;
  box-shadow: inset -1px 0 2px rgba(0,0,0,0.2);
}

.book-title {
  font-size: 13px;
  font-weight: bold;
  text-align: center;
  line-height: 1.3;
  word-break: break-all;
}

.book-badge {
  position: absolute;
  bottom: 8px;
  font-size: 10px;
  background: rgba(255,255,255,0.6);
  padding: 2px 6px;
  border-radius: 10px;
  color: #333;
}

/* 多选遮罩 */
.book-select-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.1);
  border-radius: inherit;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 6px;
  transition: all 0.2s;
}

.book-select-overlay.is-selected {
  background: rgba(0,0,0,0.3);
  box-shadow: inset 0 0 0 2px var(--text-primary);
}

.select-check {
  width: 20px; height: 20px;
  border-radius: 50%;
  border: 1.5px solid #fff;
  background: rgba(0,0,0,0.2);
  display: flex; align-items: center; justify-content: center;
}

.is-selected .select-check {
  background: var(--text-primary);
  border-color: var(--text-primary);
}

/* 底部操作栏 */
.memory-bottom-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: var(--sys-bg-secondary);
  border-top: 1px solid var(--border-color);
  display: flex;
  padding: 12px 16px;
  gap: 12px;
  z-index: 20;
}

.bar-btn {
  flex: 1;
  height: 36px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  border-radius: 6px;
  background: var(--sys-bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.bar-btn.primary {
  background: var(--text-primary);
  color: var(--sys-bg-primary);
}

.bar-btn.danger {
  background: #FFF1F0;
  color: #FF4D4F;
}

.bar-btn.disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* 详情模式 */
.detail-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.detail-meta {
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
  margin-bottom: 16px;
}

.detail-content-view {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
  flex: 1;
  overflow-y: auto;
}

.detail-content-edit {
  flex: 1;
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--sys-bg-secondary);
  padding: 12px;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;
  color: var(--text-primary);
}

.folder-fade-enter-active, .folder-fade-leave-active {
  transition: opacity 0.2s;
}
.folder-fade-enter-from, .folder-fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.3s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
}

/* Custom Confirm Modal */
.confirm-modal-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  border-radius: 16px;
}

.custom-confirm-modal {
  background: var(--sys-bg-secondary);
  width: 80%;
  max-width: 280px;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  animation: modalScaleIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes modalScaleIn {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.confirm-title {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
  text-align: center;
  margin-top: 20px;
}

.confirm-desc {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  padding: 12px 20px 20px;
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  border-top: 1px solid var(--border-color);
}

.confirm-btn {
  flex: 1;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.confirm-btn:active {
  background: var(--sys-bg-primary);
}

.confirm-btn.cancel {
  color: var(--text-primary);
  border-right: 1px solid var(--border-color);
}

.confirm-btn.danger {
  color: #FF4D4F;
  font-weight: bold;
}

/* 与“总结设置”的选择弹窗保持同一视觉结构 */
.choice-modal {
  width: 88%;
  max-width: 380px;
  overflow: hidden;
  border-radius: 18px;
  background: var(--sys-bg-secondary);
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  animation: modalScaleIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.choice-title { padding: 18px 20px 8px; font-size: 17px; font-weight: 600; color: var(--text-primary); }
.choice-intro { padding: 0 20px 10px; color: var(--text-tertiary); font-size: 11px; line-height: 1.55; }
.choice-list { padding: 0 10px 12px; }
.choice-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 10px; border-radius: 11px; cursor: pointer; }
.choice-item:active { background: var(--sys-bg-primary); }
.choice-name { font-size: 14px; color: var(--text-primary); }
.choice-desc { margin-top: 3px; font-size: 11px; line-height: 1.4; color: var(--text-tertiary); }
.choice-arrow { flex: none; color: var(--text-tertiary); font-size: 22px; line-height: 1; }
.choice-cancel { height: 44px; display: flex; align-items: center; justify-content: center; border-top: 1px solid var(--border-color); color: var(--text-secondary); font-size: 14px; cursor: pointer; }
.choice-cancel:active { background: var(--sys-bg-primary); }

/* Toast */
.memory-toast {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 200;
  pointer-events: none;
}
.toast-fade-enter-active, .toast-fade-leave-active {
  transition: opacity 0.3s;
}
.toast-fade-enter-from, .toast-fade-leave-to {
  opacity: 0;
}

/* 外观定制弹窗 */
.style-modal-content {
  background: var(--sys-bg-secondary);
  width: 85%;
  max-width: 300px;
  max-height: 85vh; /* 严格限制最大高度 */
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.style-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.style-preview-area {
  display: flex;
  justify-content: center;
  padding: 12px;
  background: var(--sys-bg-primary);
  flex-shrink: 0;
}

.preview-book {
  width: 90px; /* 进一步缩小预览图的高度占用 */
  pointer-events: none;
}

.style-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background: var(--sys-bg-primary);
}

.s-tab {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.s-tab.active {
  color: var(--text-primary);
  font-weight: bold;
  border-bottom-color: var(--text-primary);
}

.style-body {
  padding: 12px 16px;
  flex: 1;
  overflow-y: auto;
  /* 隐藏滚动条但保留功能 */
  scrollbar-width: none;
}
.style-body::-webkit-scrollbar {
  display: none;
}

.style-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.compact-panel {
  gap: 8px;
}

.form-item-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reset-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s;
  background: var(--sys-bg-secondary);
}
.reset-icon:hover {
  background: #e0e0e0;
  color: var(--text-primary);
}

/* Switch 开关样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #ddd;
  transition: .3s;
  border-radius: 20px;
}
.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
input:checked + .slider {
  background-color: var(--text-primary);
}
input:checked + .slider:before {
  transform: translateX(16px);
}


.form-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-secondary);
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.form-item.disabled, .form-row.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

.hidden-file-input { display: none; }

.custom-file-upload {
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--sys-bg-secondary);
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
}

.url-input-wrap { display: flex; gap: 8px; }
.url-input-wrap input {
  flex: 1; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 12px;
  background: transparent; color: var(--text-primary);
}
.btn-small {
  padding: 0 12px; font-size: 12px; background: var(--text-primary); color: var(--sys-bg-primary);
  border: none; border-radius: 6px; cursor: pointer;
}
.reset-link {
  font-size: 12px; color: #FF4D4F; cursor: pointer; text-decoration: underline;
}

.text-input {
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
}

.range-slider {
  width: 100%;
  accent-color: var(--text-primary);
}

.style-actions {
  display: flex;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}
.confirm-btn.primary {
  background: var(--text-primary);
  color: var(--sys-bg-primary);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>
