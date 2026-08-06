/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import type { BackupData } from '../../../composables/useDataBackup'
import { useDataBackup } from '../../../composables/useDataBackup'

const props = defineProps<{
  show: boolean
  showConfirm: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const { decryptData, restoreBackupData } = useDataBackup()

const isImporting = ref(false)
const selectedFile = ref<File | null>(null)
const requirePassword = ref(false)
const password = ref('')
const previewData = ref<BackupData | null>(null)
const importMode = ref<'overwrite' | 'merge'>('merge')
const statusText = ref('')
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}

const processFile = (file: File) => {
  selectedFile.value = file
  previewData.value = null
  requirePassword.value = file.name.endsWith('.clingybackup')
}

const handleDrop = (e: DragEvent) => {
  isDragging.value = false
  if (isImporting.value) return
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0]
    if (file.name.endsWith('.json') || file.name.endsWith('.clingybackup')) {
      processFile(file)
    } else {
      props.showConfirm('仅支持 .json 或 .clingybackup 格式的备份文件', '格式错误', false)
    }
  }
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    processFile(target.files[0])
  }
}

const handlePreview = async () => {
  if (!selectedFile.value) return
  
  if (requirePassword.value && !password.value) {
    await props.showConfirm('请输入解密密码', '提示', false)
    return
  }

  isImporting.value = true
  statusText.value = '正在读取文件...'
  
  try {
    const arrayBuffer = await selectedFile.value.arrayBuffer()
    statusText.value = '正在解密并解析数据...'
    
    // 稍微延迟渲染UI
    await new Promise(r => setTimeout(r, 100))
    
    const data = await decryptData(arrayBuffer, requirePassword.value ? password.value : undefined)
    
    if (!data || !data.meta) {
      throw new Error('无效的备份文件格式')
    }
    
    previewData.value = data
    isImporting.value = false
    statusText.value = ''
  } catch (e: any) {
    console.error(e)
    isImporting.value = false
    statusText.value = ''
    await props.showConfirm(e.message || '文件解析失败，可能是密码错误或文件损坏', '读取失败', false)
  }
}

const handleImport = async () => {
  if (!previewData.value) return

  const confirmMsg = importMode.value === 'overwrite' 
    ? '您选择了【覆盖模式】，这将会清空当前设备上的所有数据并被备份文件替换，且无法撤销！\n\n确定要继续吗？'
    : '您选择了【合并模式】，这会将备份数据追加到当前设备中（可能会产生重复数据）。\n\n确定要继续吗？'

  const confirmed = await props.showConfirm(confirmMsg, '二次确认', true, importMode.value === 'overwrite' ? 'danger' : 'normal')
  if (!confirmed) return

  isImporting.value = true
  statusText.value = '正在写入数据...'
  
  try {
    await new Promise(r => setTimeout(r, 100))
    await restoreBackupData(previewData.value, importMode.value)
    
    isImporting.value = false
    statusText.value = ''
    emit('success')
    emit('close')
    
    await props.showConfirm('数据导入成功！为了确保稳定，建议刷新页面。', '导入成功', false)
    window.location.reload()
  } catch (e) {
    console.error(e)
    isImporting.value = false
    statusText.value = ''
    await props.showConfirm('写入数据时发生错误', '提示', false)
  }
}

const formatTime = (ts: number) => {
  return new Date(ts).toLocaleString()
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<template>
  <div v-if="show" class="gu-modal-mask" @click="!isImporting && emit('close')">
    <div class="gu-modal-container" @click.stop>
      <div class="gu-modal-header">
        <div class="gu-modal-title">
          <span>恢复数据</span>
          <div class="gu-seal">存</div>
        </div>
        <button class="gu-close-btn" @click="!isImporting && emit('close')" :disabled="isImporting">×</button>
      </div>

      <div class="gu-modal-body">
        
        <!-- 第一步：选择文件与密码 -->
        <div v-if="!previewData" class="gu-step">
          <div class="gu-section">
            <div class="gu-section-title">选择备份文件</div>
            
            <div 
              class="gu-file-drop-area" 
              :class="{ 'is-active': isDragging, 'has-file': !!selectedFile }"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="handleDrop"
              @click="triggerFileInput"
            >
              <input 
                type="file" 
                ref="fileInputRef"
                class="gu-hidden-input" 
                accept=".json,.clingybackup" 
                @change="handleFileSelect" 
                :disabled="isImporting"
              >
              
              <div v-if="!selectedFile" class="gu-drop-content">
                <div class="gu-drop-icon">卷</div>
                <div class="gu-drop-text">点击或将备份文件拖拽至此处</div>
                <div class="gu-drop-sub">支持 .json 或加密的 .clingybackup 格式</div>
              </div>
              
              <div v-else class="gu-selected-content">
                <div class="gu-file-icon">册</div>
                <div class="gu-file-details">
                  <div class="gu-file-name" :class="{ 'is-encrypted': requirePassword }">{{ selectedFile.name }}</div>
                  <div class="gu-file-size">{{ formatSize(selectedFile.size) }}</div>
                </div>
                <button class="gu-btn-reselect" @click.stop="triggerFileInput" :disabled="isImporting">重新选择</button>
              </div>
            </div>
          </div>

          <div class="gu-section" v-if="requirePassword">
            <div class="gu-section-title">该文件已加密，需要密码</div>
            <input type="password" class="gu-input" v-model="password" placeholder="请输入密码" :disabled="isImporting">
          </div>

          <button class="gu-btn-action" v-if="selectedFile" @click="handlePreview" :disabled="isImporting">
            解析并预览文件内容
          </button>
        </div>

        <!-- 第二步：预览与导入 -->
        <div v-else class="gu-step">
          <div class="gu-preview-card">
            <div class="gu-preview-title">备份文件信息</div>
            <div class="gu-preview-row">
              <span class="gu-preview-label">生成时间：</span>
              <span class="gu-preview-val">{{ formatTime(previewData.meta.timestamp) }}</span>
            </div>
            <div class="gu-preview-row">
              <span class="gu-preview-label">包含模块：</span>
              <span class="gu-preview-val">{{ previewData.meta.modules.join(', ') }}</span>
            </div>
            <div class="gu-preview-row">
              <span class="gu-preview-label">角色与对话：</span>
              <span class="gu-preview-val">{{ previewData.meta.chatCount || 0 }} 个</span>
            </div>
            <div class="gu-preview-row">
              <span class="gu-preview-label">世界书：</span>
              <span class="gu-preview-val">{{ previewData.meta.worldbookCount || 0 }} 册</span>
            </div>
            <div class="gu-preview-row">
              <span class="gu-preview-label">图片与缓存：</span>
              <span class="gu-preview-val">{{ previewData.meta.imageCount || 0 }} 张</span>
            </div>
          </div>

          <div class="gu-section">
            <div class="gu-section-title">选择导入模式</div>
            <div class="gu-radio-group">
              <label class="gu-radio-label" :class="{ active: importMode === 'merge' }">
                <input type="radio" value="merge" v-model="importMode" :disabled="isImporting">
                <div class="gu-radio-text">
                  <div class="gu-radio-title">追加合并模式 (推荐)</div>
                  <div class="gu-radio-desc">将备份中的数据追加到当前设备，不丢失现有进度</div>
                </div>
              </label>
              <label class="gu-radio-label" :class="{ active: importMode === 'overwrite' }">
                <input type="radio" value="overwrite" v-model="importMode" :disabled="isImporting">
                <div class="gu-radio-text">
                  <div class="gu-radio-title">完全覆盖模式 (危险)</div>
                  <div class="gu-radio-desc">清空当前设备上的所有数据，使其与备份完全一致</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div v-if="isImporting" class="gu-loading-area">
          <div class="gu-spinner"></div>
          <div class="gu-status-text">{{ statusText }}</div>
        </div>
      </div>

      <div class="gu-modal-footer">
        <button class="gu-btn-cancel" @click="emit('close')" :disabled="isImporting">取消</button>
        <button class="gu-btn-confirm" v-if="previewData" @click="handleImport" :disabled="isImporting">
          {{ isImporting ? '处理中...' : '确认导入数据' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gu-modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.gu-modal-container {
  width: 90%;
  max-width: 420px;
  background: #FFFFFF;
  border: 1px solid #E5E5E5;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
}

.gu-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px dashed #F0F0F0;
}

.gu-modal-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.gu-modal-title span {
  font-family: "STSong", "SimSun", serif;
  font-size: 18px;
  font-weight: bold;
  color: #1A1A1A;
  letter-spacing: 2px;
}

.gu-seal {
  width: 14px; height: 14px;
  background-color: #BE2A2A; color: #FFF;
  font-family: "STFangsong", "FangSong", serif;
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 2px; margin-top: 2px;
}

.gu-close-btn {
  background: none; border: none;
  font-size: 24px; color: #999;
  cursor: pointer; padding: 0;
  line-height: 1; transition: color 0.2s;
}

.gu-close-btn:hover:not(:disabled) { color: #1A1A1A; }
.gu-close-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.gu-modal-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-height: 70vh;
  overflow-y: auto;
}

.gu-step {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.gu-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gu-section-title {
  font-family: -apple-system, sans-serif;
  font-size: 14px;
  font-weight: bold;
  color: #1A1A1A;
  margin-bottom: 4px;
}

/* 拖拽上传区域样式 */
.gu-file-drop-area {
  border: 2px dashed #E5E5E5;
  border-radius: 8px;
  padding: 32px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #FAFAFA;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.gu-file-drop-area:hover {
  border-color: #1A1A1A;
  background: #F8F8F8;
}

.gu-file-drop-area.is-active {
  border-color: #1A1A1A;
  background: #F0F0F0;
}

.gu-file-drop-area.has-file {
  padding: 20px;
  border-style: solid;
}

.gu-hidden-input {
  display: none;
}

.gu-drop-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.gu-drop-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #1A1A1A;
  color: #FFF;
  font-family: "STSong", "SimSun", serif;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.gu-drop-text {
  font-size: 15px;
  font-weight: 500;
  color: #1A1A1A;
}

.gu-drop-sub {
  font-size: 12px;
  color: #999;
}

.gu-selected-content {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 16px;
}

.gu-file-icon {
  width: 48px;
  height: 48px;
  background: #1A1A1A;
  color: #FFF;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "STSong", "SimSun", serif;
  font-size: 24px;
  flex-shrink: 0;
}

.gu-file-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.gu-file-name {
  font-size: 14px;
  font-weight: bold;
  color: #1A1A1A;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gu-file-name.is-encrypted::before {
  content: '🔒 ';
  font-size: 12px;
}

.gu-file-size {
  font-size: 12px;
  color: #666;
}

.gu-btn-reselect {
  background: transparent;
  border: 1px solid #E5E5E5;
  padding: 6px 12px;
  font-size: 12px;
  color: #1A1A1A;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.gu-btn-reselect:hover {
  background: #1A1A1A;
  color: #FFF;
  border-color: #1A1A1A;
}


.gu-input {
  width: 100%;
  padding: 10px 12px;
  background: #FAFAFA;
  border: 1px solid #E5E5E5;
  font-size: 14px;
  color: #1A1A1A;
  transition: all 0.2s;
  outline: none;
}

.gu-input:focus {
  border-color: #1A1A1A;
  background: #FFFFFF;
}

.gu-btn-action {
  width: 100%;
  padding: 12px;
  background: #FAFAFA;
  border: 1px solid #E5E5E5;
  font-size: 14px;
  color: #1A1A1A;
  cursor: pointer;
  transition: all 0.2s;
}

.gu-btn-action:hover:not(:disabled) {
  background: #F0F0F0;
}

.gu-preview-card {
  background: #FAFAFA;
  border: 1px solid #F0F0F0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gu-preview-title {
  font-family: "STSong", "SimSun", serif;
  font-size: 15px;
  font-weight: bold;
  color: #1A1A1A;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #E5E5E5;
}

.gu-preview-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.gu-preview-label {
  color: #666;
}

.gu-preview-val {
  color: #1A1A1A;
  font-weight: 500;
}

.gu-radio-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gu-radio-label {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid #E5E5E5;
  cursor: pointer;
  transition: all 0.2s;
}

.gu-radio-label.active {
  border-color: #1A1A1A;
  background: #FAFAFA;
}

.gu-radio-label input[type="radio"] {
  margin-top: 2px;
  accent-color: #1A1A1A;
}

.gu-radio-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gu-radio-title {
  font-size: 14px;
  font-weight: bold;
  color: #1A1A1A;
}

.gu-radio-desc {
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

.gu-loading-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px 0;
}

.gu-spinner {
  width: 24px; height: 24px;
  border: 2px solid #F0F0F0;
  border-top-color: #1A1A1A;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { 100% { transform: rotate(360deg); } }

.gu-status-text {
  font-family: "STSong", "SimSun", serif;
  font-size: 14px;
  color: #666;
}

.gu-modal-footer {
  display: flex;
  padding: 20px 24px;
  gap: 12px;
  background: #FAFAFA;
  border-top: 1px solid #E5E5E5;
}

.gu-btn-cancel, .gu-btn-confirm {
  flex: 1;
  padding: 12px 0;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.gu-btn-cancel {
  background: transparent;
  color: #666;
  border: 1px solid #E5E5E5;
}

.gu-btn-cancel:hover:not(:disabled) {
  background: #E5E5E5;
  color: #1A1A1A;
}

.gu-btn-confirm {
  background: #1A1A1A;
  color: #FFF;
}

.gu-btn-confirm:hover:not(:disabled) {
  background: #000;
}

.gu-btn-cancel:disabled, .gu-btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
