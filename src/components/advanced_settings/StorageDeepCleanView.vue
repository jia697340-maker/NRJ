/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  show: boolean
  initialTab: string
  isScanning: boolean
  deepScanResults: Array<{
    id: string
    type: string
    preview: string
    source: string
    key: string
    category: string
    size: number
    formattedSize: string
    storageFormat: string
    reclaimable: boolean
    protected: boolean
    status: 'normal' | 'legacy' | 'duplicate' | 'orphan' | 'system'
    description: string
  }>
  formatBytes: (bytes: number) => string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'delete', items: any[]): void
}>()

const selectedItems = ref<Set<string>>(new Set())
const isManageMode = ref(false)
const activeFilter = ref<'all' | 'large' | 'reclaimable' | 'legacy' | 'duplicate' | 'orphan'>('all')
const filters = [
  { id: 'all', name: '全部' }, { id: 'large', name: '大文件' }, { id: 'reclaimable', name: '可安全清理' },
  { id: 'legacy', name: '旧版格式' }, { id: 'duplicate', name: '重复' }, { id: 'orphan', name: '无引用' }
] as const

const currentCategory = computed(() => props.initialTab)

const filteredResults = computed(() => {
  let items = currentCategory.value === 'all'
    ? [...props.deepScanResults]
    : props.deepScanResults.filter(item => item.category === currentCategory.value || (currentCategory.value === 'others' && !item.category))
  if (activeFilter.value === 'large') items = items.filter(item => item.size >= 1024 * 1024)
  else if (activeFilter.value === 'reclaimable') items = items.filter(item => item.reclaimable)
  else if (activeFilter.value !== 'all') items = items.filter(item => item.status === activeFilter.value)
  return items.sort((a, b) => b.size - a.size)
})

const getCategoryName = (cat: string) => {
  const map: Record<string, string> = {
    avatars: '角色头像缓存',
    chat_images: '聊天配图 (收发)',
    chat_emojis: '聊天表情包',
    worldbook_covers: '世界书封面图片',
    wallpapers: '全局背景壁纸',
    media_thumbs: '媒体缩略图',
    chat_text: '聊天记录文本',
    personas: '角色核心设定数据',
    presets: '快捷回复预设',
    worldbook_text: '世界书文本数据',
    prompts: '提示词模板',
    ai_history: 'AI 生图历史记录',
    nai_vibe: 'NAI Vibe 缓存',
    theme_appearance: '主题与外观配色',
    voice_data: '语音合成缓存',
    cot_logs: '思维链 (CoT) 日志',
    error_logs: '控制台日志缓存',
    user_settings: '用户个人偏好设置',
    plugins: '插件与扩展数据',
    emoji_groups: '表情包分组设定',
    backup_data: '本机恢复点与待发送备份',
    offline_cache: '离线应用缓存',
    system_overhead: '数据库与浏览器开销',
    others: '其它可识别数据',
    all: '全部存储项目'
  }
  return map[cat] || cat || '其它数据'
}

const protectedKeys = new Set([
  'clingy_personas',
  'clingy_discover_active_persona',
  'clingy_theme',
  'clingy_appearance',
  'clingy_settings',
  'clingy_user_profile',
  'clingy_wallet',
  'clingy_presets',
  'clingy_emoji_groups'
])

const isProtected = (item: any) => {
  if (item.protected || item.status === 'system') return true
  if (protectedKeys.has(item.key)) return true
  if (item.key.startsWith('clingy_sys_')) return true
  return false
}

const filterDeletable = (items: any[]) => {
  return items.filter(i => !isProtected(i))
}

const toggleManageMode = () => {
  isManageMode.value = !isManageMode.value
  if (!isManageMode.value) {
    selectedItems.value.clear()
  }
}

const toggleSelection = (id: string) => {
  if (selectedItems.value.has(id)) {
    selectedItems.value.delete(id)
  } else {
    selectedItems.value.add(id)
  }
}

const selectAll = () => {
  const deletableItems = filterDeletable(filteredResults.value)
  if (selectedItems.value.size === deletableItems.length && deletableItems.length > 0) {
    selectedItems.value.clear()
  } else {
    deletableItems.forEach(item => selectedItems.value.add(item.id))
  }
}

const detailModalVisible = ref(false)
const currentDetailItem = ref<any>(null)

const openDetail = (item: any) => {
  currentDetailItem.value = item
  detailModalVisible.value = true
}

const closeDetail = () => {
  detailModalVisible.value = false
  currentDetailItem.value = null
}

const handleDelete = () => {
  if (selectedItems.value.size === 0) return
  const itemsToDelete = filteredResults.value.filter(item => selectedItems.value.has(item.id))
  emit('delete', itemsToDelete)
  selectedItems.value.clear()
}

const totalSelectedSize = computed(() => {
  let size = 0
  filteredResults.value.forEach(item => {
    if (selectedItems.value.has(item.id)) {
      size += item.size
    }
  })
  return props.formatBytes(size)
})

</script>

<template>
  <Teleport to="body">
    <Transition name="slide-left">
      <div class="deep-clean-view" v-if="show">
        <div class="view-header">
          <button class="back-btn" @click="emit('close')">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div class="header-info">
            <h2>{{ getCategoryName(currentCategory) }}</h2>
            <span class="header-subtitle">共 {{ filteredResults.length }} 个文件</span>
          </div>
          <div class="header-actions">
            <button v-if="isManageMode" class="text-action-btn" @click="selectAll">
              {{ selectedItems.size === filterDeletable(filteredResults).length && filterDeletable(filteredResults).length > 0 ? '取消全选' : '全选' }}
            </button>
            <button class="text-action-btn" @click="toggleManageMode">
              {{ isManageMode ? '完成' : '管理' }}
            </button>
          </div>
        </div>

      <div class="view-content">
        <div class="filter-strip" v-if="!isScanning">
          <button v-for="filter in filters" :key="filter.id" class="filter-chip" :class="{ active: activeFilter === filter.id }" @click="activeFilter = filter.id">
            {{ filter.name }}
          </button>
        </div>
        <div v-if="isScanning" class="loading-state">
          <div class="spinner"></div>
          <p>正在读取底层文件数据...</p>
        </div>
        
        <div v-else-if="filteredResults.length === 0" class="empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          </svg>
          <p>该分类下暂无任何缓存文件</p>
        </div>
        
        <div v-else class="file-list">
          <div 
            class="file-item" 
            v-for="item in filteredResults" 
            :key="item.id"
            :class="{ 'is-selected': selectedItems.has(item.id), 'is-protected': isProtected(item), 'manage-mode': isManageMode }"
            @click="isManageMode ? (!isProtected(item) && toggleSelection(item.id)) : openDetail(item)"
          >
            <div class="item-checkbox" v-if="isManageMode" :class="{ 'disabled-checkbox': isProtected(item) }">
              <div class="checkbox-inner" v-if="selectedItems.has(item.id)">
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <div class="checkbox-inner locked" v-else-if="isProtected(item)">
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </div>
            </div>
            
            <div class="item-preview">
              <img v-if="item.type === 'image' || item.type === 'video'" :src="item.preview" alt="preview" />
              <div v-else class="icon-preview">
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
            </div>
            
            <div class="item-info">
              <div class="item-key">{{ item.key }}</div>
              <div class="item-meta">
                <span class="item-source">{{ item.source }}</span>
                <span class="dot-divider">·</span>
                <span class="item-size">{{ item.formattedSize }}</span>
                <template v-if="item.status !== 'normal'">
                  <span class="dot-divider">·</span>
                  <span class="status-badge">{{ item.status === 'legacy' ? '旧版格式' : item.status === 'duplicate' ? '内容重复' : item.status === 'orphan' ? '无引用' : '系统项' }}</span>
                </template>
                <template v-if="isProtected(item)">
                  <span class="dot-divider">·</span>
                  <span class="protected-badge">系统内置</span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

        <div class="view-footer" :class="{ 'is-visible': isManageMode && selectedItems.size > 0 }">
          <div class="footer-info">
            <span class="selected-count">已选 {{ selectedItems.size }} 项</span>
            <span class="selected-size">释放 {{ totalSelectedSize }}</span>
          </div>
          <button class="delete-btn" @click="handleDelete">
            删除选项
          </button>
        </div>
      </div>
    </Transition>

    <!-- 详情查看弹窗 -->
    <Transition name="fade">
      <div v-if="detailModalVisible" class="detail-modal-overlay" @click="closeDetail">
        <div class="detail-modal-content" @click.stop>
          <div class="detail-header">
            <h3>{{ currentDetailItem?.key }}</h3>
            <button class="close-btn" @click="closeDetail">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div class="detail-body">
            <img v-if="currentDetailItem?.type === 'image' || currentDetailItem?.type === 'video'" :src="currentDetailItem?.preview" />
            <pre v-else class="text-content">{{ currentDetailItem?.preview }}</pre>
            <div class="detail-ledger" v-if="currentDetailItem">
              <div><span>占用</span><strong>{{ currentDetailItem.formattedSize }}</strong></div>
              <div><span>格式</span><strong>{{ currentDetailItem.storageFormat }}</strong></div>
              <div><span>来源</span><strong>{{ currentDetailItem.source }}</strong></div>
              <p>{{ currentDetailItem.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>

  </Teleport>
</template>

<style scoped>
.deep-clean-view {
  position: fixed; /* 强制基于浏览器视口全屏 */
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100vw;
  height: 100vh;
  background: var(--sys-bg-primary, #ffffff);
  z-index: 10000; /* 极致顶层，盖过 BreakdownModal 以及一切底栏顶栏 */
  display: flex;
  flex-direction: column;
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(100%);
}

.view-header {
  position: relative;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sys-bg-primary);
  border-bottom: 1px solid var(--sys-bg-tertiary);
  flex-shrink: 0;
}

.back-btn {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 50%;
  z-index: 10;
}

.back-btn:active {
  background: var(--sys-bg-secondary);
}

.header-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.header-info h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-subtitle {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.header-actions {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 8px;
  z-index: 10;
}

.text-action-btn {
  background: transparent;
  border: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 8px 12px;
}

.view-content {
  flex: 1;
  overflow-y: auto;
  background: var(--sys-bg-secondary, #f8f9fa);
  padding: 16px;
}

.loading-state, .empty-state {
  height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-tertiary);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--text-secondary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background: var(--sys-bg-primary);
  border-radius: 16px;
  gap: 16px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}

.file-item.is-selected {
  border-color: var(--text-secondary);
  background: var(--sys-bg-tertiary);
}

.item-checkbox {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.is-selected .item-checkbox {
  background: var(--text-secondary);
  border-color: var(--text-secondary);
  color: var(--sys-bg-primary);
}

.item-checkbox.disabled-checkbox {
  background: var(--sys-bg-secondary);
  border-color: var(--border-color);
  color: var(--text-tertiary);
  opacity: 0.6;
}

.item-preview {
  width: 52px;
  height: 52px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--sys-bg-tertiary);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon-preview {
  color: var(--text-tertiary);
  opacity: 0.7;
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-key {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.dot-divider {
  opacity: 0.5;
}

.item-size {
  font-weight: 600;
  color: var(--text-secondary);
}

.protected-badge {
  font-size: 10px;
  background: var(--sys-bg-tertiary);
  color: var(--text-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
}

.view-footer {
  height: 0;
  background: var(--sys-bg-primary);
  border-top: 1px solid var(--sys-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  overflow: hidden;
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.view-footer.is-visible {
  height: 80px;
}

.footer-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.selected-count {
  font-size: 13px;
  color: var(--text-tertiary);
}

.selected-size {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.delete-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.delete-btn:active {
  opacity: 0.8;
}

/* Detail Modal Styles */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.detail-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 10001; /* Above deep clean view */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.detail-modal-content {
  background: var(--sys-bg-primary);
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
}

.detail-header {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--sys-bg-tertiary);
}

.detail-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  padding-right: 16px;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--sys-bg-secondary);
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.detail-body img {
  width: 100%;
  height: auto;
  border-radius: 8px;
}

.text-content {
  margin: 0;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  background: var(--sys-bg-secondary);
  padding: 16px;
  border-radius: 8px;
}

.filter-strip {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;
  border-bottom: 1px solid var(--sys-separator);
  scrollbar-width: none;
}

.filter-strip::-webkit-scrollbar { display: none; }

.filter-chip {
  flex: 0 0 auto;
  padding: 7px 12px;
  border: 1px solid var(--sys-separator);
  border-radius: 16px;
  background: var(--sys-bg-primary);
  color: var(--text-tertiary);
  font: inherit;
  font-size: 12px;
}

.filter-chip.active {
  border-color: var(--text-primary);
  color: var(--text-primary);
}

.status-badge { color: #9a6a2e; font-size: 11px; }

.detail-ledger {
  display: flex;
  flex-direction: column;
  margin-top: 16px;
  border-top: 1px solid var(--sys-separator);
}

.detail-ledger > div {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 0;
  border-bottom: 1px solid var(--sys-separator);
  color: var(--text-tertiary);
  font-size: 12px;
}

.detail-ledger strong { color: var(--text-primary); font-weight: 500; text-align: right; }
.detail-ledger p { color: var(--text-tertiary); font-size: 12px; line-height: 1.7; }
</style>
