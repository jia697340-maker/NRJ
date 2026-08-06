/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import type { BackupModule } from '../../../composables/useDataBackup'
import { useDataBackup } from '../../../composables/useDataBackup'

const props = defineProps<{
  show: boolean
  showConfirm: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { generateBackupData, encryptData } = useDataBackup()

const isExporting = ref(false)
const selectedModules = ref<BackupModule[]>(['settings', 'chats', 'worldbooks', 'images', 'history'])
const usePassword = ref(false)
const password = ref('')
const confirmPassword = ref('')
const statusText = ref('')

const toggleModule = (mod: BackupModule) => {
  const idx = selectedModules.value.indexOf(mod)
  if (idx > -1) {
    // 至少保留一个
    if (selectedModules.value.length > 1) {
      selectedModules.value.splice(idx, 1)
    }
  } else {
    selectedModules.value.push(mod)
  }
}

const handleExport = async () => {
  if (usePassword.value) {
    if (!password.value) {
      await props.showConfirm('请输入加密密码', '提示', false)
      return
    }
    if (password.value !== confirmPassword.value) {
      await props.showConfirm('两次输入的密码不一致', '提示', false)
      return
    }
  }

  isExporting.value = true
  try {
    statusText.value = '正在收集并打包数据...'
    // 稍微延迟以渲染UI
    await new Promise(r => setTimeout(r, 100))
    
    const rawData = await generateBackupData(selectedModules.value)
    
    statusText.value = '正在加密并生成文件...'
    await new Promise(r => setTimeout(r, 100))

    const encryptedBuffer = await encryptData(rawData, usePassword.value ? password.value : undefined)
    
    // 触发下载
    const blob = new Blob([encryptedBuffer], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    const date = new Date()
    const dateStr = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`
    const ext = usePassword.value ? '.clingybackup' : '.json'
    a.download = `backup_${dateStr}${ext}`
    
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    isExporting.value = false
    statusText.value = ''
    emit('close')
    await props.showConfirm('备份文件导出成功！请妥善保管。', '导出成功', false)
  } catch (e) {
    console.error(e)
    isExporting.value = false
    statusText.value = ''
    await props.showConfirm('导出过程中发生错误', '提示', false)
  }
}
</script>

<template>
  <div v-if="show" class="gu-modal-mask" @click="!isExporting && emit('close')">
    <div class="gu-modal-container" @click.stop>
      <div class="gu-modal-header">
        <div class="gu-modal-title">
          <span>导出备份</span>
          <div class="gu-seal">存</div>
        </div>
        <button class="gu-close-btn" @click="!isExporting && emit('close')" :disabled="isExporting">×</button>
      </div>

      <div class="gu-modal-body">
        <div class="gu-section">
          <div class="gu-section-title">选择要备份的内容</div>
          <div class="gu-checkbox-list">
            <label class="gu-checkbox-item">
              <input type="checkbox" :checked="selectedModules.includes('settings')" @change="toggleModule('settings')" :disabled="isExporting">
              <span class="gu-checkbox-text">应用设置与预设 (体积小)</span>
            </label>
            <label class="gu-checkbox-item">
              <input type="checkbox" :checked="selectedModules.includes('chats')" @change="toggleModule('chats')" :disabled="isExporting">
              <span class="gu-checkbox-text">角色与聊天记录文本 (体积较小)</span>
            </label>
            <label class="gu-checkbox-item">
              <input type="checkbox" :checked="selectedModules.includes('worldbooks')" @change="toggleModule('worldbooks')" :disabled="isExporting">
              <span class="gu-checkbox-text">世界书文本设定 (体积小)</span>
            </label>
            <label class="gu-checkbox-item">
              <input type="checkbox" :checked="selectedModules.includes('images')" @change="toggleModule('images')" :disabled="isExporting">
              <span class="gu-checkbox-text">全量图片库 (头像/壁纸/聊天配图，体积极大)</span>
            </label>
            <label class="gu-checkbox-item">
              <input type="checkbox" :checked="selectedModules.includes('history')" @change="toggleModule('history')" :disabled="isExporting">
              <span class="gu-checkbox-text">AI 生图与运行历史 (体积中)</span>
            </label>
          </div>
        </div>

        <div class="gu-section">
          <div class="gu-section-title">安全选项</div>
          <label class="gu-toggle-label">
            <input type="checkbox" v-model="usePassword" :disabled="isExporting">
            <span>使用 AES 加密保护备份文件</span>
          </label>
          
          <div class="gu-password-fields" v-if="usePassword">
            <input type="password" class="gu-input" v-model="password" placeholder="设置加密密码" :disabled="isExporting">
            <input type="password" class="gu-input" v-model="confirmPassword" placeholder="再次确认密码" :disabled="isExporting">
            <div class="gu-hint">警告：如果您忘记了此密码，该备份文件将永远无法解开。</div>
          </div>
        </div>

        <div v-if="isExporting" class="gu-loading-area">
          <div class="gu-spinner"></div>
          <div class="gu-status-text">{{ statusText }}</div>
        </div>
      </div>

      <div class="gu-modal-footer">
        <button class="gu-btn-cancel" @click="emit('close')" :disabled="isExporting">取消</button>
        <button class="gu-btn-confirm" @click="handleExport" :disabled="isExporting">
          {{ isExporting ? '打包中...' : '生成备份文件' }}
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
  max-width: 400px;
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
  max-height: 60vh;
  overflow-y: auto;
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

.gu-checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gu-checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.gu-checkbox-item input[type="checkbox"] {
  accent-color: #1A1A1A;
  width: 16px; height: 16px;
}

.gu-checkbox-text {
  font-size: 14px;
  color: #333;
}

.gu-toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #1A1A1A;
  cursor: pointer;
}

.gu-password-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
  padding-left: 24px;
  border-left: 2px solid #F5F5F5;
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

.gu-hint {
  font-size: 12px;
  color: #BE2A2A;
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
