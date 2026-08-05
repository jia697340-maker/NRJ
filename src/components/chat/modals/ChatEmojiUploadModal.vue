/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatEmoji } from '../../../composables/useChatEmoji'
import type { PreviewEmojiItem } from '../../../composables/useChatEmoji'

const props = defineProps<{
  visible: boolean
  targetCategory: 'user' | 'role' | 'global'
  targetRoleId?: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'imported'): void
}>()

const {
  previewPool,
  isParsing,
  parseTextContent,
  parseLocalFiles,
  confirmImport,
  clearPreviewPool
} = useChatEmoji()

// URL 文本输入
const urlInputText = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

// 拖拽上传状态
const isDragging = ref(false)

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
}

const handleDrop = async (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    await parseLocalFiles(Array.from(e.dataTransfer.files))
  }
}

const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}

const handleFileSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    await parseLocalFiles(Array.from(target.files))
    target.value = '' // 清空 input 允许重复选择同文件
  }
}

const parseUrlText = () => {
  if (urlInputText.value.trim()) {
    parseTextContent(urlInputText.value)
    urlInputText.value = ''
  }
}

// 预览池全选/多选逻辑
const allSelected = computed({
  get: () => previewPool.value.length > 0 && previewPool.value.every(item => item.selected),
  set: (val: boolean) => {
    previewPool.value.forEach(item => { item.selected = val })
  }
})

const selectedCount = computed(() => previewPool.value.filter(item => item.selected).length)

const toggleSelection = (item: PreviewEmojiItem) => {
  item.selected = !item.selected
}

const removeSelectedFromPreview = () => {
  const toRemove = previewPool.value.filter(item => item.selected)
  // 如果是本地图片，需要释放 ObjectURL
  toRemove.forEach(item => {
    if (item.type === 'local' && item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl)
    }
  })
  previewPool.value = previewPool.value.filter(item => !item.selected)
}

const handleConfirmImport = async () => {
  if (selectedCount.value === 0) return
  const count = await confirmImport(props.targetCategory, props.targetRoleId)
  if (count > 0) {
    emit('imported')
    emit('close')
  }
}

const handleClose = () => {
  clearPreviewPool()
  urlInputText.value = ''
  emit('close')
}
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="upload-modal-overlay" @click="handleClose">
      <div class="upload-modal-container" @click.stop>
        
        <header class="um-header">
          <div class="um-title">导入表情包</div>
          <div class="um-close-btn" @click="handleClose">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
        </header>

        <div class="um-content">
          <!-- 阶段一：上传解析区 -->
          <div v-if="previewPool.length === 0" class="upload-zones">
            
            <div 
              class="drag-drop-zone" 
              :class="{ 'is-dragging': isDragging }"
              @dragover="handleDragOver"
              @dragleave="handleDragLeave"
              @drop="handleDrop"
              @click="triggerFileInput"
            >
              <input 
                type="file" 
                ref="fileInputRef" 
                style="display: none;" 
                multiple 
                accept="image/*,.zip,.txt,.md,.json,.world,.docx"
                @change="handleFileSelect"
              />
              <div v-if="isParsing" class="parsing-spinner"></div>
              <svg v-else viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="dd-icon">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <div class="dd-text">点击或拖拽文件到此处</div>
              <div class="dd-sub">支持图片、ZIP压缩包、文本(含docx)</div>
            </div>

            <div class="url-parse-zone">
              <div class="url-title">智能文本链接解析</div>
              <textarea 
                v-model="urlInputText" 
                placeholder="在此粘贴包含表情链接的文本，例如：&#10;开心 https://xxx.com/1.png&#10;https://xxx.com/2.gif 难过"
                class="url-textarea"
              ></textarea>
              <button class="parse-btn" :disabled="!urlInputText.trim()" @click="parseUrlText">解析链接</button>
            </div>
            
          </div>

          <!-- 阶段二：预览筛选区 -->
          <div v-else class="preview-zone">
            <div class="preview-toolbar">
              <label class="select-all-label">
                <input type="checkbox" v-model="allSelected" />
                <span>全选 (已选 {{ selectedCount }} / {{ previewPool.length }})</span>
              </label>
              
              <button class="delete-selected-btn" :disabled="selectedCount === 0" @click="removeSelectedFromPreview">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                删除选中
              </button>
            </div>

            <div class="preview-grid">
              <div 
                v-for="item in previewPool" 
                :key="item.id" 
                class="preview-item" 
                :class="{ 'is-selected': item.selected }"
                @click="toggleSelection(item)"
              >
                <div class="preview-img-box">
                  <img :src="item.previewUrl" :alt="item.name" class="preview-img" loading="lazy" />
                  <div class="checkbox-indicator">
                    <svg v-if="item.selected" viewBox="0 0 24 24" width="14" height="14" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                </div>
                <div class="preview-name" :title="item.name">{{ item.name }}</div>
                <div class="preview-type-badge">{{ item.type === 'local' ? '本地' : 'URL' }}</div>
              </div>
            </div>
          </div>
        </div>

        <footer class="um-footer" v-if="previewPool.length > 0">
          <button class="um-btn cancel" @click="handleClose">取消</button>
          <button class="um-btn confirm" :disabled="selectedCount === 0" @click="handleConfirmImport">
            确认导入 ({{ selectedCount }})
          </button>
        </footer>

      </div>
    </div>
  </transition>
</template>

<style scoped>
.upload-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dark-theme .upload-modal-overlay {
  background: rgba(0, 0, 0, 0.6);
}

.upload-modal-container {
  width: 90%;
  max-width: 500px;
  max-height: 85vh;
  background: var(--bg-primary);
  border-radius: 16px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modal-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid var(--border-color);
}

@keyframes modal-pop {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.um-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.um-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.um-close-btn {
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: background 0.2s;
}

.um-close-btn:active {
  background: var(--bg-secondary);
}

.um-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.upload-zones {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.drag-drop-zone {
  border: 2px dashed var(--border-color);
  border-radius: 12px;
  padding: 32px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--bg-secondary);
}

.drag-drop-zone:hover, .drag-drop-zone.is-dragging {
  border-color: var(--accent-color, #4f46e5);
  background: rgba(79, 70, 229, 0.05);
}

.dd-icon {
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.dd-text {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.dd-sub {
  font-size: 12px;
  color: var(--text-secondary);
}

.parsing-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-color, #4f46e5);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.url-parse-zone {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.url-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.url-textarea {
  width: 100%;
  height: 120px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  font-size: 13px;
  font-family: monospace;
  resize: vertical;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.url-textarea:focus {
  outline: none;
  border-color: var(--accent-color, #4f46e5);
}

.parse-btn {
  align-self: flex-end;
  padding: 8px 16px;
  background: var(--accent-color, #4f46e5);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.parse-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 预览区 */
.preview-zone {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.select-all-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
}

.delete-selected-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.delete-selected-btn:not(:disabled):active {
  background: rgba(239, 68, 68, 0.2);
}

.delete-selected-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 12px;
}

.preview-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  position: relative;
}

.preview-img-box {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.2s;
  background: var(--bg-secondary);
}

.preview-item.is-selected .preview-img-box {
  border-color: var(--accent-color, #4f46e5);
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.checkbox-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0,0,0,0.3);
  border: 1.5px solid white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.preview-item.is-selected .checkbox-indicator {
  background: var(--accent-color, #4f46e5);
  border-color: var(--accent-color, #4f46e5);
}

.preview-name {
  font-size: 11px;
  color: var(--text-primary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-type-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 9px;
  background: rgba(0,0,0,0.5);
  color: white;
  padding: 2px 4px;
  border-radius: 4px;
}

.um-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.um-btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.um-btn.cancel {
  background: transparent;
  color: var(--text-secondary);
}

.um-btn.confirm {
  background: var(--accent-color, #4f46e5);
  color: white;
}

.um-btn.confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
