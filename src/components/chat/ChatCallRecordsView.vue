/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  records: any[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'delete', ids: (string | number)[]): void
  (e: 'resummarize', id: string | number): void
}>()

const searchQuery = ref('')
const isManageMode = ref(false)
const selectedIds = ref<(string | number)[]>([])
const sortType = ref<'timeDesc' | 'timeAsc' | 'durationDesc' | 'durationAsc'>('timeDesc')
const currentTypeTab = ref<'voice' | 'video'>('voice')
const currentPage = ref(1)
const pageSize = 10

// 当切换类型时，重置页码和选中状态
watch(currentTypeTab, () => {
  currentPage.value = 1
  selectedIds.value = []
})

// 解析时长 "mm:ss" 或 "hh:mm:ss" 为秒数
const parseDuration = (durationStr: string) => {
  if (!durationStr) return 0
  const parts = durationStr.split(':').map(Number)
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

const selectedRecord = ref<any>(null)
const showDetailModal = ref(false)

const openDetail = (record: any) => {
  selectedRecord.value = record
  showDetailModal.value = true
}

const activeTab = ref<'history' | 'summary'>('history')

const handleResummarize = () => {
  if (!selectedRecord.value) return
  emit('resummarize', selectedRecord.value.id)
}

const sortedRecords = computed(() => {
  if (!props.records) return []
  
  // 先根据语音/视频进行过滤
  let result = props.records.filter(r => {
    const isVideo = r.callType === 'video'
    if (currentTypeTab.value === 'video') return isVideo
    return !isVideo
  })
  
  // 排序
  result.sort((a, b) => {
    if (sortType.value === 'timeDesc') {
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    } else if (sortType.value === 'timeAsc') {
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    } else if (sortType.value === 'durationDesc') {
      return parseDuration(b.duration) - parseDuration(a.duration)
    } else if (sortType.value === 'durationAsc') {
      return parseDuration(a.duration) - parseDuration(b.duration)
    }
    return 0
  })
  
  return result
})

const totalPages = computed(() => Math.ceil(sortedRecords.value.length / pageSize) || 1)

// 删除后总页数可能变少，避免停留在已经不存在的空白页
watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages
})

// 不再依赖搜索框直接改变渲染列表，而是按页码切片
const pagedRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return sortedRecords.value.slice(start, end)
})

// 全局搜索匹配项
const searchResults = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  if (!keyword) return []
  
  return sortedRecords.value.filter(r => 
    (r.content && r.content.toLowerCase().includes(keyword)) ||
    (r.date && r.date.toLowerCase().includes(keyword))
  )
})

const jumpToRecord = (record: any) => {
  // 找到该记录在当前排序下位于全局的第几条
  const index = sortedRecords.value.findIndex(r => r === record)
  if (index !== -1) {
    // 计算出它所在的页码并跳转
    currentPage.value = Math.floor(index / pageSize) + 1
    // 清空搜索框并打开详情
    searchQuery.value = ''
    openDetail(record)
  }
}

const toggleManageMode = () => {
  isManageMode.value = !isManageMode.value
  if (!isManageMode.value) {
    selectedIds.value = [] // 退出管理模式时清空选择
  }
}

const toggleSelect = (id: string | number) => {
  const index = selectedIds.value.indexOf(id)
  if (index === -1) {
    selectedIds.value.push(id)
  } else {
    selectedIds.value.splice(index, 1)
  }
}

const toggleSelectAll = () => {
  // 这里全选是选中“当前所有过滤/排序后的记录”，而不是仅当前页
  if (selectedIds.value.length === sortedRecords.value.length) {
    selectedIds.value = []
  } else {
    selectedIds.value = sortedRecords.value.map(r => r.id)
  }
}

const handleDelete = () => {
  if (selectedIds.value.length === 0) return
  emit('delete', selectedIds.value)
  isManageMode.value = false
  selectedIds.value = []
}
</script>

<template>
  <div class="chat-call-records-overlay" @click="emit('close')">
  <div class="chat-call-records-view" @click.stop>
    <div class="header">
      <div class="back-btn" @click="emit('close')">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </div>
      <div class="title">{{ isManageMode ? '管理记录' : '历史通话记录' }}</div>
      <div class="header-right" @click="toggleManageMode" style="cursor: pointer; display: flex; align-items: center; justify-content: flex-end; width: 44px; font-size: 14px; color: #666;">
        <span v-if="isManageMode" style="color: var(--theme-color, #FFB6C1);">取消</span>
        <svg v-else viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
      </div>
    </div>
    
    <div class="toolbar">
      <div class="type-tabs">
        <div class="type-tab" :class="{ active: currentTypeTab === 'voice' }" @click="currentTypeTab = 'voice'">语音记录</div>
        <div class="type-tab" :class="{ active: currentTypeTab === 'video' }" @click="currentTypeTab = 'video'">视频记录</div>
      </div>

      <div class="search-box">
        <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="text" v-model="searchQuery" placeholder="全局搜索内容或日期..." />
        <svg v-if="searchQuery" class="clear-icon" @click="searchQuery = ''" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        
        <!-- 搜索结果悬浮面板 -->
        <div v-if="searchQuery && searchResults.length > 0" class="search-dropdown">
          <div v-for="result in searchResults" :key="result.id" class="search-result-item" @click="jumpToRecord(result)">
            <div class="result-date">{{ result.date }}</div>
            <div class="result-content">{{ result.content }}</div>
          </div>
        </div>
        <div v-if="searchQuery && searchResults.length === 0" class="search-dropdown empty">
          没有找到匹配的记录
        </div>
      </div>
      
      <div class="toolbar-bottom">
        <div class="pagination-controls">
          <button class="page-btn" :disabled="currentPage <= 1" @click="currentPage--">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
          <button class="page-btn" :disabled="currentPage >= totalPages" @click="currentPage++">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
        
        <div class="sort-options">
          <select v-model="sortType" class="sort-select">
            <option value="timeDesc">按时间 (从新到旧)</option>
            <option value="timeAsc">按时间 (从旧到新)</option>
            <option value="durationDesc">按时长 (从长到短)</option>
            <option value="durationAsc">按时长 (从短到长)</option>
          </select>
        </div>
      </div>
    </div>
    
    <div class="list-container" :style="{ paddingBottom: isManageMode ? '80px' : '16px' }">
      <div v-if="pagedRecords.length === 0" class="empty-state">
        暂无通话记录
      </div>
      
      <div v-else class="records-list">
        <div v-for="(record, index) in pagedRecords" :key="record.id || index" class="record-card" :class="{ 'selectable': isManageMode }" @click="isManageMode ? toggleSelect(record.id) : openDetail(record)">
          <div v-if="isManageMode" class="checkbox" :class="{ 'checked': selectedIds.includes(record.id) }">
            <svg v-if="selectedIds.includes(record.id)" viewBox="0 0 24 24" width="14" height="14" stroke="#fff" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div class="record-content-wrapper">
            <div class="record-header">
              <div class="record-date">
                <span class="record-direction" :class="[record.direction === 'in' ? 'is-in' : 'is-out', { 'is-missed': record.missed }]">
                  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <template v-if="record.callType === 'video'">
                      <polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </template>
                    <template v-else-if="record.direction === 'in'">
                      <line x1="19" y1="5" x2="10" y2="14"></line><polyline points="10 8 10 14 16 14"></polyline>
                    </template>
                    <template v-else>
                      <line x1="5" y1="19" x2="14" y2="10"></line><polyline points="14 16 14 10 8 10"></polyline>
                    </template>
                  </svg>
                  {{ record.callType === 'video' ? '视频' : (record.direction === 'in' ? '呼入' : '呼出') }}
                </span>
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                {{ record.date }}
              </div>
              <div class="record-duration" :class="{ 'is-missed': record.missed }">
                {{ record.missed ? record.duration : `时长: ${record.duration}` }}
              </div>
            </div>
            <div class="record-content line-clamp-3">
              {{ record.content }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 管理模式底栏 -->
    <transition name="slide-up">
      <div v-if="isManageMode" class="manage-bottom-bar">
        <div class="select-all-btn" @click="toggleSelectAll">
          <div class="checkbox" :class="{ 'checked': selectedIds.length > 0 && selectedIds.length === sortedRecords.length }">
            <svg v-if="selectedIds.length > 0 && selectedIds.length === sortedRecords.length" viewBox="0 0 24 24" width="14" height="14" stroke="#fff" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <span>全选</span>
        </div>
        <button class="delete-btn" :disabled="selectedIds.length === 0" @click="handleDelete">
          删除 {{ selectedIds.length > 0 ? `(${selectedIds.length})` : '' }}
        </button>
      </div>
    </transition>
  </div>

    <!-- 详情弹窗 -->
    <transition name="fade">
      <div v-if="showDetailModal" class="detail-modal-overlay" @click="showDetailModal = false">
        <div class="detail-modal-content" @click.stop>
          <div class="detail-header">
            <div class="detail-title">通话详情</div>
            <div class="close-btn" @click="showDetailModal = false">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
          </div>
          <div class="detail-meta">
            <span class="meta-date"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="margin-right:4px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>{{ selectedRecord?.date }}</span>
            <span class="meta-duration">{{ selectedRecord?.missed ? selectedRecord?.duration : `时长: ${selectedRecord?.duration}` }}</span>
          </div>
          
          <div class="detail-tabs">
            <div class="tab-item" :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">通话记录</div>
            <div class="tab-item" :class="{ active: activeTab === 'summary' }" @click="activeTab = 'summary'">内容总结</div>
          </div>

          <div class="detail-body">
            <template v-if="activeTab === 'history'">
              <div v-if="selectedRecord?.rawMessages && selectedRecord.rawMessages.length > 0" class="raw-messages-list">
                <div v-for="msg in selectedRecord.rawMessages" :key="msg.id" class="raw-message-item" :class="msg.type">
                  <div class="raw-message-sender">{{ msg.type === 'left' ? '对方' : (msg.type === 'right' ? '我' : '系统') }}</div>
                  <div class="raw-message-bubble">{{ msg.content }}</div>
                </div>
              </div>
              <div v-else class="empty-raw-messages">
                没有找到当时通话的具体聊天记录
              </div>
            </template>
            <template v-else>
              <div class="summary-content" :class="{ 'is-error': selectedRecord?.content?.includes('失败') }">
                {{ selectedRecord?.content }}
              </div>
              <!-- 未接来电没有通话原文，重新总结无从下手 -->
              <div class="summary-actions" v-if="!selectedRecord?.missed">
                <button class="resummarize-btn" @click="handleResummarize" :disabled="selectedRecord?.content === '正在生成总结...'">
                  {{ selectedRecord?.content === '正在生成总结...' ? '正在生成中...' : (selectedRecord?.content?.includes('失败') ? '点击重试生成' : '重新生成总结') }}
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.chat-call-records-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  background-color: #f7f7f8;
}

.chat-call-records-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #f7f7f8; /* 改为和底层一样的背景色 */
  flex-shrink: 0;
}

.back-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-left: -8px;
}

.title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #333);
}

.header-right {
  width: 32px;
}

.manage-bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: #fff;
  border-top: 1px solid rgba(0,0,0,0.05);
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.03);
  z-index: 20;
}

.select-all-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #666;
  font-size: 14px;
}

.delete-btn {
  background: #ff4d4f;
  color: #fff;
  border: none;
  border-radius: 20px;
  padding: 8px 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.delete-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.delete-btn:not(:disabled):active {
  opacity: 0.8;
}

.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.3s ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
}

.type-tabs {
  display: flex;
  background: #fff;
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.02);
}

.type-tab {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  font-size: 14px;
  color: #666;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.type-tab.active {
  background: #f7f7f8;
  color: #333;
  font-weight: 500;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}

.toolbar {
  padding: 0 16px 12px;
  background: #f7f7f8; /* 改为和底层一样的背景色，去除底边框 */
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: #999;
}

.search-box input {
  width: 100%;
  height: 36px;
  background: #fff; /* 背景色改为纯白，提升在灰色背景上的对比度 */
  border: none;
  border-radius: 18px;
  padding: 0 32px 0 36px;
  font-size: 14px;
  color: #333;
  outline: none;
  box-shadow: 0 2px 6px rgba(0,0,0,0.02);
}

.search-box input::placeholder {
  color: #999;
}

.clear-icon {
  position: absolute;
  right: 12px;
  color: #999;
  cursor: pointer;
  padding: 4px;
}

.search-dropdown {
  position: absolute;
  top: 44px;
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  max-height: 250px;
  overflow-y: auto;
  z-index: 10;
  padding: 8px 0;
}

.search-dropdown.empty {
  padding: 16px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

.search-result-item {
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(0,0,0,0.03);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover, .search-result-item:active {
  background: #f9f9f9;
}

.result-date {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.result-content {
  font-size: 13px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.02);
  overflow: hidden;
}

.page-btn {
  background: none;
  border: none;
  width: 32px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  cursor: pointer;
}

.page-btn:disabled {
  color: #ccc;
  cursor: not-allowed;
}

.page-info {
  font-size: 12px;
  color: #666;
  padding: 0 8px;
  font-weight: 500;
  min-width: 48px;
  text-align: center;
}

.sort-options {
  display: flex;
  justify-content: flex-end;
}

.sort-select {
  padding: 6px 12px;
  border-radius: 16px;
  border: none;
  background: #fff;
  font-size: 13px;
  color: #666;
  outline: none;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.02);
}

.list-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.empty-state {
  text-align: center;
  color: #999;
  padding: 40px 0;
  font-size: 14px;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 32px;
}

.record-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.record-card:active {
  transform: scale(0.98);
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.record-card.selectable {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-left: 12px;
}

.record-content-wrapper {
  flex: 1;
  min-width: 0;
}

.checkbox {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.checkbox.checked {
  background: var(--theme-color, #FFB6C1);
  border-color: var(--theme-color, #FFB6C1);
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed rgba(0,0,0,0.06);
}

.record-date {
  font-size: 12px;
  color: #999;
  display: flex;
  align-items: center;
  gap: 4px;
}

.record-duration {
  font-size: 12px;
  color: var(--theme-color, #FFB6C1);
  font-weight: 500;
  background: rgba(255,182,193,0.15);
  padding: 2px 8px;
  border-radius: 10px;
}

.record-duration.is-missed {
  color: #e26d5c;
  background: rgba(226, 109, 92, 0.12);
}

.record-direction {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 8px;
  margin-right: 2px;
}
.record-direction.is-in {
  color: #6b9080;
  background: rgba(107, 144, 128, 0.12);
}
.record-direction.is-out {
  color: #7b8794;
  background: rgba(123, 135, 148, 0.12);
}
.record-direction.is-missed {
  color: #e26d5c;
  background: rgba(226, 109, 92, 0.12);
}

.record-content {
  font-size: 14px;
  color: #333;
  line-height: 1.6;
  word-break: break-word;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #666; /* 预览文本颜色稍微调淡一点 */
}

/* 详情弹窗样式 */
.detail-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.detail-modal-content {
  background: #fff;
  width: 100%;
  max-width: 400px;
  max-height: 80vh;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.detail-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.close-btn {
  cursor: pointer;
  color: #999;
  padding: 4px;
  margin: -4px;
}

.detail-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 8px;
}

.meta-date {
  font-size: 13px;
  color: #999;
  display: flex;
  align-items: center;
}

.meta-duration {
  font-size: 12px;
  color: var(--theme-color, #FFB6C1);
  font-weight: 500;
  background: rgba(255,182,193,0.15);
  padding: 2px 8px;
  border-radius: 10px;
}

.detail-tabs {
  display: flex;
  background: #f7f7f8;
  border-radius: 8px;
  margin: 0 20px 12px;
  padding: 4px;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 6px 0;
  font-size: 14px;
  color: #666;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-item.active {
  background: #fff;
  color: #333;
  font-weight: 500;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}

.detail-body {
  padding: 8px 20px 24px;
  font-size: 15px;
  color: #333;
  line-height: 1.6;
  word-break: break-word;
  overflow-y: auto;
  white-space: pre-wrap;
}

/* 原始聊天记录气泡 */
.raw-messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.raw-message-item {
  display: flex;
  flex-direction: column;
  max-width: 85%;
}

.raw-message-sender {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.raw-message-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.raw-message-item.left {
  align-self: flex-start;
}
.raw-message-item.left .raw-message-sender {
  margin-left: 4px;
}
.raw-message-item.left .raw-message-bubble {
  background: #f7f7f8;
  border: 1px solid rgba(0,0,0,0.05);
  border-top-left-radius: 4px;
}

.raw-message-item.right {
  align-self: flex-end;
}
.raw-message-item.right .raw-message-sender {
  text-align: right;
  margin-right: 4px;
}
.raw-message-item.right .raw-message-bubble {
  background: var(--theme-color, #FFB6C1);
  color: #fff;
  border-top-right-radius: 4px;
}

.raw-message-item.system {
  align-self: center;
  max-width: 90%;
}
.raw-message-item.system .raw-message-sender {
  display: none;
}
.raw-message-item.system .raw-message-bubble {
  background: transparent;
  color: #999;
  font-size: 12px;
  text-align: center;
  box-shadow: none;
  padding: 4px 8px;
}

.empty-raw-messages {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 30px 0;
}

/* 总结内容区域 */
.summary-content {
  background: #f9f9f9;
  border-radius: 12px;
  padding: 16px;
  font-size: 14px;
  color: #444;
  line-height: 1.6;
}

.summary-content.is-error {
  color: #ff4d4f;
  background: rgba(255, 77, 79, 0.05);
}

.summary-actions {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.resummarize-btn {
  background: transparent;
  color: var(--theme-color, #FFB6C1);
  border: 1px solid var(--theme-color, #FFB6C1);
  padding: 8px 24px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.resummarize-btn:hover {
  background: rgba(255, 182, 193, 0.1);
}

.resummarize-btn:active {
  transform: scale(0.96);
}

.resummarize-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: transparent;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
