/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useNovelAIHistory } from '../composables/useNovelAIHistory'

const emit = defineEmits(['close'])

const {
  historyItems,
  loadHistoryList,
  deleteHistoryItems,
  getHistoryImageBlobUrl
} = useNovelAIHistory()

const isSelectMode = ref(false)
const selectedIds = ref<string[]>([])

const detailItem = ref<any>(null)
const detailImageUrl = ref<string | null>(null)

// For display purposes, we need to load image blob URLs for the grid
const imageObjectUrls = ref<Record<string, string>>({})

const loadImages = async () => {
  for (const item of historyItems.value) {
    if (!imageObjectUrls.value[item.id]) {
      const url = await getHistoryImageBlobUrl(item.id)
      if (url) {
        imageObjectUrls.value[item.id] = url
      }
    }
  }
}

onMounted(async () => {
  await loadHistoryList()
  await loadImages()
})

onUnmounted(() => {
  for (const url of Object.values(imageObjectUrls.value)) {
    URL.revokeObjectURL(url)
  }
})

const toggleSelectMode = () => {
  isSelectMode.value = !isSelectMode.value
  selectedIds.value = []
}

const toggleSelectAll = () => {
  if (selectedIds.value.length === historyItems.value.length) {
    selectedIds.value = []
  } else {
    selectedIds.value = historyItems.value.map(item => item.id)
  }
}

const handleItemClick = async (item: any) => {
  if (isSelectMode.value) {
    const index = selectedIds.value.indexOf(item.id)
    if (index > -1) {
      selectedIds.value.splice(index, 1)
    } else {
      selectedIds.value.push(item.id)
    }
  } else {
    detailItem.value = item
    detailImageUrl.value = imageObjectUrls.value[item.id] || await getHistoryImageBlobUrl(item.id)
  }
}

const showConfirmModal = ref(false)
const confirmModalMessage = ref('')
const confirmModalAction = ref<(() => void) | null>(null)

const handleConfirm = (message: string, action: () => void) => {
  confirmModalMessage.value = message
  confirmModalAction.value = action
  showConfirmModal.value = true
}

const executeConfirm = () => {
  if (confirmModalAction.value) {
    confirmModalAction.value()
  }
  showConfirmModal.value = false
}

const cancelConfirm = () => {
  showConfirmModal.value = false
}

const handleDelete = async () => {
  if (selectedIds.value.length === 0) return
  handleConfirm(`确定要删除选中的 ${selectedIds.value.length} 条记录吗？`, async () => {
    await deleteHistoryItems(selectedIds.value)
    selectedIds.value = []
    isSelectMode.value = false
  })
}

const closeDetail = () => {
  detailItem.value = null
  // We keep the detailImageUrl in case it's in the grid, it's revoked on unmount
}

const downloadDetailImage = () => {
  if (!detailImageUrl.value) return
  const link = document.createElement('a')
  link.href = detailImageUrl.value
  link.download = `history_${detailItem.value.timestamp}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const formatDate = (timestamp: number) => {
  const d = new Date(timestamp)
  return `${d.getMonth() + 1}-${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="modal-overlay">
    <div class="modal-content">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-left">
          <button v-if="!isSelectMode" class="nav-icon-btn primary" @click="$emit('close')" title="返回">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <button v-else class="nav-icon-btn" @click="toggleSelectAll" :title="selectedIds.length === historyItems.length ? '取消全选' : '全选'">
            <svg v-if="selectedIds.length === historyItems.length" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="12" x2="15" y2="12"></line>
            </svg>
            <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <path d="M9 12l2 2 4-4"></path>
            </svg>
          </button>
        </div>
        <h2 class="modal-title">生成历史</h2>
        <div class="header-right">
          <button class="nav-icon-btn" @click="toggleSelectMode" :title="isSelectMode ? '取消' : '选择'">
            <svg v-if="isSelectMode" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <div v-if="historyItems.length === 0" class="empty-state">
          暂无生成历史
        </div>
        <div v-else class="history-grid">
          <div 
            v-for="item in historyItems" 
            :key="item.id" 
            class="grid-item"
            @click="handleItemClick(item)"
          >
            <img v-if="imageObjectUrls[item.id]" :src="imageObjectUrls[item.id]" class="item-img" />
            <div v-else class="item-placeholder">加载中...</div>
            
            <div class="item-overlay">
              <span class="item-time">{{ formatDate(item.timestamp) }}</span>
            </div>

            <div v-if="isSelectMode" class="select-indicator" :class="{ selected: selectedIds.includes(item.id) }">
              <div class="indicator-inner"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer for Select Mode -->
      <div v-if="isSelectMode" class="modal-footer">
        <button 
          class="delete-btn" 
          :disabled="selectedIds.length === 0"
          @click="handleDelete"
        >
          删除 ({{ selectedIds.length }})
        </button>
      </div>

      <!-- 通用确认弹窗 -->
      <Transition name="fade">
        <div class="simple-modal-overlay" v-if="showConfirmModal">
          <div class="simple-modal">
            <div class="simple-modal-title">提示</div>
            <div class="simple-modal-body" style="text-align: center; color: #666; font-size: 14px;">
              {{ confirmModalMessage }}
            </div>
            <div class="simple-modal-footer">
              <button class="simple-modal-btn cancel" @click="cancelConfirm">取消</button>
              <button class="simple-modal-btn confirm" style="color: #ff3b30;" @click="executeConfirm">确定</button>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Detail View -->
    <div v-if="detailItem" class="detail-overlay">
      <div class="detail-header">
        <div class="header-left">
          <button class="nav-icon-btn" @click="closeDetail" title="关闭">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <span class="detail-title">图片详情</span>
        <div class="header-right">
          <button class="nav-icon-btn primary" @click="downloadDetailImage" title="保存">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="detail-body">
        <div class="detail-img-container">
          <img :src="detailImageUrl" class="detail-img" />
        </div>
        
        <div class="detail-info">
          <div class="info-group">
            <div class="info-label">Prompt</div>
            <div class="info-value">{{ detailItem.params?.input }}</div>
          </div>
          <div class="info-group" v-if="detailItem.params?.negative_prompt">
            <div class="info-label">Negative Prompt</div>
            <div class="info-value">{{ detailItem.params?.negative_prompt }}</div>
          </div>
          
          <div class="info-row">
            <div class="info-col">
              <span class="info-label">Model:</span>
              <span class="info-value">{{ detailItem.params?.model }}</span>
            </div>
            <div class="info-col">
              <span class="info-label">Sampler:</span>
              <span class="info-value">{{ detailItem.params?.parameters?.sampler || detailItem.params?.sampler }}</span>
            </div>
          </div>
          
          <div class="info-row">
            <div class="info-col">
              <span class="info-label">Steps:</span>
              <span class="info-value">{{ detailItem.params?.parameters?.steps || detailItem.params?.steps }}</span>
            </div>
            <div class="info-col">
              <span class="info-label">Scale:</span>
              <span class="info-value">{{ detailItem.params?.parameters?.scale || detailItem.params?.scale }}</span>
            </div>
          </div>

          <div class="info-row">
            <div class="info-col">
              <span class="info-label">Size:</span>
              <span class="info-value">{{ detailItem.params?.parameters?.width || detailItem.params?.width }} x {{ detailItem.params?.parameters?.height || detailItem.params?.height }}</span>
            </div>
            <div class="info-col">
              <span class="info-label">Seed:</span>
              <span class="info-value">{{ detailItem.params?.parameters?.seed || detailItem.params?.seed || 'Random' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: #fff; z-index: 200; display: flex; flex-direction: column;
}

.modal-content {
  flex: 1; display: flex; flex-direction: column; height: 100%;
}

.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: calc(env(safe-area-inset-top) + 12px) 16px 12px;
  background: rgba(255,255,255,0.9); backdrop-filter: blur(10px);
  border-bottom: 1px solid #f0f0f0; z-index: 10;
}

.header-left, .header-right { width: 80px; display: flex; align-items: center; }
.header-right { justify-content: flex-end; }
.modal-title { font-size: 17px; font-weight: 600; margin: 0; color: #111; }

.text-btn { background: none; border: none; font-size: 16px; padding: 4px 0; color: #111; cursor: pointer; }
.text-btn-primary { color: #007aff; }
.nav-icon-btn {
  background: none; border: none; padding: 0; color: #111;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  border-radius: 50%; transition: background-color 0.2s; width: 32px; height: 32px;
}
.nav-icon-btn:hover { background-color: rgba(0,0,0,0.05); }
.nav-icon-btn.primary { color: #007aff; }

.modal-body {
  flex: 1; overflow-y: auto; padding: 16px;
}

.empty-state { text-align: center; color: #888; font-size: 15px; margin-top: 100px; }

.history-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
}

.grid-item {
  position: relative; width: 100%; aspect-ratio: 2 / 3; border-radius: 12px;
  overflow: hidden; background: #f0f0f5; cursor: pointer;
}

.item-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.item-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #999; font-size: 13px; }

.item-overlay {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.6));
  padding: 20px 8px 8px; color: #fff;
}
.item-time { font-size: 12px; }

.select-indicator {
  position: absolute; top: 8px; right: 8px; width: 24px; height: 24px;
  border-radius: 50%; border: 2px solid #fff; background: rgba(0,0,0,0.2);
  display: flex; align-items: center; justify-content: center;
}
.select-indicator.selected { background: #007aff; border-color: #007aff; }
.indicator-inner { width: 10px; height: 10px; border-radius: 50%; background: #fff; opacity: 0; }
.select-indicator.selected .indicator-inner { opacity: 1; }

.modal-footer {
  padding: 16px 20px calc(env(safe-area-inset-bottom) + 16px);
  background: #fff; border-top: 1px solid #f0f0f0;
}

.delete-btn {
  width: 100%; background: #ff3b30; color: #fff; border: none; padding: 14px;
  border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer;
}
.delete-btn:disabled { background: #ffcccc; cursor: not-allowed; }

/* Detail Overlay */
.detail-overlay {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: #f7f7f8; z-index: 300; display: flex; flex-direction: column;
}

.detail-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: calc(env(safe-area-inset-top) + 12px) 16px 12px;
  background: rgba(255,255,255,0.9); backdrop-filter: blur(10px);
  border-bottom: 1px solid #f0f0f0;
}

.detail-title { font-size: 17px; font-weight: 600; color: #111; }

.detail-body {
  flex: 1; overflow-y: auto; padding: 16px;
}

.detail-img-container {
  width: 100%; border-radius: 12px; overflow: hidden; background: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 20px;
}
.detail-img { width: 100%; display: block; }

.detail-info {
  background: #fff; border-radius: 12px; padding: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.info-group { margin-bottom: 16px; }
.info-row { display: flex; margin-bottom: 12px; }
.info-row:last-child { margin-bottom: 0; }
.info-col { flex: 1; display: flex; flex-direction: column; }

.info-label { font-size: 13px; color: #888; margin-bottom: 4px; }
.info-value { font-size: 14px; color: #111; word-break: break-all; }

/* --- 轻量级弹窗样式 --- */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.simple-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.simple-modal {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(25px) saturate(200%);
  -webkit-backdrop-filter: blur(25px) saturate(200%);
  width: 270px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  transform: translateY(-10%);
}

.simple-modal-title {
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  padding: 20px 16px 8px;
  color: #111;
}

.simple-modal-body {
  padding: 0 16px 20px;
}

.simple-modal-footer {
  display: flex;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.simple-modal-btn {
  flex: 1;
  background: transparent;
  border: none;
  padding: 12px 0;
  font-size: 16px;
  cursor: pointer;
  color: #007aff;
}

.simple-modal-btn.cancel {
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  font-weight: 400;
}

.simple-modal-btn.confirm {
  font-weight: 600;
}

.simple-modal-btn:active {
  background: rgba(0, 0, 0, 0.05);
}
</style>
