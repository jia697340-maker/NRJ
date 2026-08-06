/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { WebDAVConfig, WebDAVFile } from '../../../composables/useWebDAV'
import { useWebDAV } from '../../../composables/useWebDAV'
import { useDataBackup, type BackupModule } from '../../../composables/useDataBackup'

const props = defineProps<{
  show: boolean
  showConfirm: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const { isConnecting, checkConnection, listFiles, uploadFile, downloadFile, deleteFile } = useWebDAV()
const { generateBackupData, encryptData, decryptData, restoreBackupData } = useDataBackup()

// WebDAV 配置
const config = ref<WebDAVConfig>({
  url: '',
  username: '',
  password: '',
  enabled: false
})
const showConfig = ref(false)

// 备份文件列表
const backupFiles = ref<WebDAVFile[]>([])
const isLoadingFiles = ref(false)

// 上传/下载状态
const activeAction = ref('')
const actionProgress = ref('')

// 导出配置
const showExportConfig = ref(false)
const selectedModules = ref<BackupModule[]>(['settings', 'chats', 'worldbooks', 'images', 'history'])
const usePassword = ref(false)
const encryptPassword = ref('')
const confirmPassword = ref('')

// 导入配置
const showImportConfig = ref(false)
const selectedFileToImport = ref<WebDAVFile | null>(null)
const importPassword = ref('')
const importMode = ref<'overwrite' | 'merge'>('merge')

onMounted(() => {
  const saved = localStorage.getItem('webdav_config')
  if (saved) {
    try {
      config.value = JSON.parse(saved)
      if (config.value.enabled) {
        loadBackupFiles()
      }
    } catch(e) {}
  } else {
    showConfig.value = true
  }
})

const saveConfig = async () => {
  if (!config.value.url || !config.value.username || !config.value.password) {
    await props.showConfirm('请填写完整的 WebDAV 配置信息', '提示', false)
    return
  }
  
  const ok = await checkConnection(config.value)
  if (!ok) {
    await props.showConfirm('连接失败，请检查 URL 格式或账号密码是否正确。', '提示', false)
    return
  }

  config.value.enabled = true
  localStorage.setItem('webdav_config', JSON.stringify(config.value))
  showConfig.value = false
  await loadBackupFiles()
  await props.showConfirm('WebDAV 连接成功并已保存配置！', '提示', false)
}

const loadBackupFiles = async () => {
  if (!config.value.enabled) return
  isLoadingFiles.value = true
  try {
    const files = await listFiles(config.value)
    // 过滤出备份文件
    backupFiles.value = files.filter(f => f.name.startsWith('backup_') && (f.name.endsWith('.json') || f.name.endsWith('.clingybackup')))
  } catch(e) {
    console.error(e)
    await props.showConfirm('获取云端列表失败，请检查网络或配置', '提示', false)
  } finally {
    isLoadingFiles.value = false
  }
}

const toggleModule = (mod: BackupModule) => {
  const idx = selectedModules.value.indexOf(mod)
  if (idx > -1) {
    if (selectedModules.value.length > 1) selectedModules.value.splice(idx, 1)
  } else {
    selectedModules.value.push(mod)
  }
}

const startCloudBackup = async () => {
  if (usePassword.value) {
    if (!encryptPassword.value) {
      await props.showConfirm('请输入加密密码', '提示', false)
      return
    }
    if (encryptPassword.value !== confirmPassword.value) {
      await props.showConfirm('两次输入的密码不一致', '提示', false)
      return
    }
  }

  activeAction.value = 'upload'
  showExportConfig.value = false
  
  try {
    actionProgress.value = '正在收集并打包本地数据...'
    await new Promise(r => setTimeout(r, 100))
    const rawData = await generateBackupData(selectedModules.value)
    
    actionProgress.value = '正在加密并生成文件...'
    await new Promise(r => setTimeout(r, 100))
    const encryptedBuffer = await encryptData(rawData, usePassword.value ? encryptPassword.value : undefined)
    
    actionProgress.value = '正在上传到 WebDAV 云端...'
    const date = new Date()
    const dateStr = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours()}${date.getMinutes()}`
    const ext = usePassword.value ? '.clingybackup' : '.json'
    const filename = `backup_${dateStr}${ext}`
    
    const success = await uploadFile(config.value, filename, encryptedBuffer)
    
    if (success) {
      await loadBackupFiles()
      await props.showConfirm('已成功备份到云端！', '提示', false)
    } else {
      throw new Error('上传请求失败')
    }
  } catch (e) {
    console.error(e)
    await props.showConfirm('上传云端失败，请重试。', '提示', false)
  } finally {
    activeAction.value = ''
    actionProgress.value = ''
  }
}

const prepareRestore = (file: WebDAVFile) => {
  selectedFileToImport.value = file
  importPassword.value = ''
  showImportConfig.value = true
}

const startCloudRestore = async () => {
  if (!selectedFileToImport.value) return
  const requirePwd = selectedFileToImport.value.name.endsWith('.clingybackup')
  if (requirePwd && !importPassword.value) {
    await props.showConfirm('请输入解密密码', '提示', false)
    return
  }

  const confirmMsg = importMode.value === 'overwrite'
    ? '将从云端下载并【完全覆盖】本地数据，确定继续？'
    : '将从云端下载并【合并】到本地数据，确定继续？'
  
  const confirmed = await props.showConfirm(confirmMsg, '二次确认', true, importMode.value === 'overwrite' ? 'danger' : 'normal')
  if (!confirmed) return

  activeAction.value = 'download'
  showImportConfig.value = false
  
  try {
    actionProgress.value = `正在从云端下载 ${selectedFileToImport.value.name}...`
    const buffer = await downloadFile(config.value, selectedFileToImport.value.name)
    
    actionProgress.value = '正在解密并解析数据...'
    await new Promise(r => setTimeout(r, 100))
    const data = await decryptData(buffer, requirePwd ? importPassword.value : undefined)
    
    actionProgress.value = '正在写入本地存储...'
    await new Promise(r => setTimeout(r, 100))
    await restoreBackupData(data, importMode.value)
    
    emit('success')
    emit('close')
    await props.showConfirm('云端数据恢复成功！建议刷新页面。', '提示', false)
    window.location.reload()
  } catch (e: any) {
    console.error(e)
    await props.showConfirm(e.message || '恢复失败，可能是网络问题、密码错误或文件损坏。', '错误', false)
  } finally {
    activeAction.value = ''
    actionProgress.value = ''
  }
}

const deleteCloudFile = async (file: WebDAVFile) => {
  const confirmed = await props.showConfirm(`确定要从云端彻底删除备份文件 ${file.name} 吗？`, '删除确认', true, 'danger')
  if (!confirmed) return
  
  activeAction.value = 'delete'
  actionProgress.value = '正在删除云端文件...'
  try {
    const success = await deleteFile(config.value, file.name)
    if (success) {
      await loadBackupFiles()
    } else {
      throw new Error('删除失败')
    }
  } catch(e) {
    await props.showConfirm('删除云端文件失败', '提示', false)
  } finally {
    activeAction.value = ''
    actionProgress.value = ''
  }
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<template>
  <div v-if="show" class="gu-modal-mask" @click="!activeAction && emit('close')">
    <div class="gu-modal-container" @click.stop>
      
      <div class="gu-modal-header">
        <div class="gu-modal-title">
          <span>WebDAV 云端漫游</span>
          <div class="gu-seal">云</div>
        </div>
        <button class="gu-close-btn" @click="!activeAction && emit('close')" :disabled="!!activeAction">×</button>
      </div>

      <div class="gu-modal-body">
        
        <!-- 全局加载遮罩 -->
        <div v-if="activeAction" class="gu-action-overlay">
          <div class="gu-spinner"></div>
          <div class="gu-status-text">{{ actionProgress }}</div>
        </div>

        <!-- 配置界面 -->
        <div v-if="showConfig" class="gu-config-view">
          <div class="gu-section">
            <div class="gu-section-title">网盘地址 (URL)</div>
            <input type="text" class="gu-input" v-model="config.url" placeholder="例如: https://dav.jianguoyun.com/dav/">
          </div>
          <div class="gu-section">
            <div class="gu-section-title">账号 (Username)</div>
            <input type="text" class="gu-input" v-model="config.username" placeholder="网盘账号">
          </div>
          <div class="gu-section">
            <div class="gu-section-title">密码 / 应用密码 (Password)</div>
            <input type="password" class="gu-input" v-model="config.password" placeholder="建议使用网盘分配的应用专用密码">
          </div>
          
          <button class="gu-btn-confirm mt-4" @click="saveConfig" :disabled="isConnecting">
            {{ isConnecting ? '连接测试中...' : '连接并保存' }}
          </button>
          
          <button v-if="config.enabled" class="gu-btn-cancel mt-2" @click="showConfig = false">取消修改</button>
        </div>

        <!-- 导出参数配置弹窗 (模拟子弹窗) -->
        <div v-else-if="showExportConfig" class="gu-sub-view">
          <div class="gu-sub-header">上传新备份至云端</div>
          <div class="gu-checkbox-list">
            <label class="gu-checkbox-item">
              <input type="checkbox" :checked="selectedModules.includes('settings')" @change="toggleModule('settings')">
              <span class="gu-checkbox-text">应用设置与预设</span>
            </label>
            <label class="gu-checkbox-item">
              <input type="checkbox" :checked="selectedModules.includes('chats')" @change="toggleModule('chats')">
              <span class="gu-checkbox-text">角色与聊天记录</span>
            </label>
            <label class="gu-checkbox-item">
              <input type="checkbox" :checked="selectedModules.includes('worldbooks')" @change="toggleModule('worldbooks')">
              <span class="gu-checkbox-text">世界书文本</span>
            </label>
            <label class="gu-checkbox-item">
              <input type="checkbox" :checked="selectedModules.includes('images')" @change="toggleModule('images')">
              <span class="gu-checkbox-text">全量图片库 (较慢)</span>
            </label>
          </div>

          <div class="gu-section mt-4">
            <label class="gu-toggle-label">
              <input type="checkbox" v-model="usePassword">
              <span>使用 AES 加密保护云端文件</span>
            </label>
            <div class="gu-password-fields" v-if="usePassword">
              <input type="password" class="gu-input" v-model="encryptPassword" placeholder="设置加密密码">
              <input type="password" class="gu-input" v-model="confirmPassword" placeholder="再次确认密码">
            </div>
          </div>

          <div class="gu-actions-row mt-4">
            <button class="gu-btn-cancel" @click="showExportConfig = false">返回</button>
            <button class="gu-btn-confirm" @click="startCloudBackup">开始打包并上传</button>
          </div>
        </div>

        <!-- 导入参数配置弹窗 (模拟子弹窗) -->
        <div v-else-if="showImportConfig && selectedFileToImport" class="gu-sub-view">
          <div class="gu-sub-header">从云端恢复数据</div>
          <div class="gu-file-info-mini">
            <div class="gu-file-name-mini">{{ selectedFileToImport.name }}</div>
            <div class="gu-file-size-mini">{{ formatSize(selectedFileToImport.size) }}</div>
          </div>

          <div class="gu-section mt-4" v-if="selectedFileToImport.name.endsWith('.clingybackup')">
            <div class="gu-section-title">输入解密密码</div>
            <input type="password" class="gu-input" v-model="importPassword" placeholder="此文件已加密">
          </div>

          <div class="gu-section mt-4">
            <div class="gu-section-title">选择导入模式</div>
            <div class="gu-radio-group">
              <label class="gu-radio-label" :class="{ active: importMode === 'merge' }">
                <input type="radio" value="merge" v-model="importMode">
                <div class="gu-radio-text">
                  <div class="gu-radio-title">追加合并 (推荐)</div>
                </div>
              </label>
              <label class="gu-radio-label" :class="{ active: importMode === 'overwrite' }">
                <input type="radio" value="overwrite" v-model="importMode">
                <div class="gu-radio-text">
                  <div class="gu-radio-title">完全覆盖 (危险)</div>
                </div>
              </label>
            </div>
          </div>

          <div class="gu-actions-row mt-4">
            <button class="gu-btn-cancel" @click="showImportConfig = false">返回</button>
            <button class="gu-btn-confirm" @click="startCloudRestore">开始下载并恢复</button>
          </div>
        </div>

        <!-- 主界面：云端文件列表 -->
        <div v-else class="gu-main-view">
          <div class="gu-toolbar">
            <button class="gu-btn-action" @click="showExportConfig = true">
              <span class="icon">↑</span> 备份到云端
            </button>
            <button class="gu-btn-action" @click="loadBackupFiles" :disabled="isLoadingFiles">
              <span class="icon">↻</span> 刷新列表
            </button>
            <button class="gu-btn-action" @click="showConfig = true">
              <span class="icon">⚙</span> 配置
            </button>
          </div>

          <div class="gu-file-list">
            <div v-if="isLoadingFiles" class="gu-loading-mini">加载中...</div>
            <div v-else-if="backupFiles.length === 0" class="gu-empty-state">
              云端暂无备份文件
            </div>
            <div v-else class="gu-file-item" v-for="file in backupFiles" :key="file.name">
              <div class="gu-file-info">
                <div class="gu-file-name" :class="{ 'is-encrypted': file.name.endsWith('.clingybackup') }">
                  {{ file.name }}
                </div>
                <div class="gu-file-meta">
                  <span>{{ new Date(file.lastModified).toLocaleString() }}</span>
                  <span class="gu-divider">|</span>
                  <span>{{ formatSize(file.size) }}</span>
                </div>
              </div>
              <div class="gu-file-actions">
                <button class="gu-icon-btn" @click="prepareRestore(file)" title="下载并恢复">↓</button>
                <button class="gu-icon-btn gu-text-danger" @click="deleteCloudFile(file)" title="删除">×</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.gu-modal-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(5px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}

.gu-modal-container {
  width: 90%; max-width: 480px;
  background: #FFFFFF; border: 1px solid #E5E5E5;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  display: flex; flex-direction: column;
  position: relative;
  min-height: 400px;
}

.gu-modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 24px; border-bottom: 1px dashed #F0F0F0;
}

.gu-modal-title { display: flex; align-items: center; gap: 6px; }
.gu-modal-title span {
  font-family: "STSong", "SimSun", serif;
  font-size: 18px; font-weight: bold; color: #1A1A1A; letter-spacing: 2px;
}

.gu-seal {
  width: 14px; height: 14px; background-color: #0284c7; color: #FFF;
  font-family: "STFangsong", "FangSong", serif; font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 2px; margin-top: 2px;
}

.gu-close-btn {
  background: none; border: none; font-size: 24px; color: #999;
  cursor: pointer; padding: 0; line-height: 1; transition: color 0.2s;
}
.gu-close-btn:hover:not(:disabled) { color: #1A1A1A; }

.gu-modal-body {
  padding: 24px;
  display: flex; flex-direction: column;
  flex: 1; position: relative;
}

/* 遮罩 */
.gu-action-overlay {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 16px; z-index: 10;
}

.gu-spinner {
  width: 32px; height: 32px; border: 2px solid #F0F0F0;
  border-top-color: #0284c7; border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { 100% { transform: rotate(360deg); } }

.gu-status-text {
  font-family: "STSong", "SimSun", serif;
  font-size: 14px; color: #666; text-align: center;
}

/* 通用输入框 */
.gu-section { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.gu-section-title { font-size: 13px; font-weight: bold; color: #1A1A1A; }
.gu-input {
  width: 100%; padding: 10px 12px; background: #FAFAFA;
  border: 1px solid #E5E5E5; font-size: 14px; outline: none; transition: all 0.2s;
}
.gu-input:focus { border-color: #0284c7; background: #FFFFFF; }

.mt-4 { margin-top: 16px; }
.mt-2 { margin-top: 8px; }

/* 按钮 */
.gu-btn-confirm, .gu-btn-cancel, .gu-btn-action {
  width: 100%; padding: 12px; font-size: 14px; cursor: pointer; border: none; transition: all 0.2s;
}
.gu-btn-confirm { background: #1A1A1A; color: #FFF; }
.gu-btn-confirm:hover:not(:disabled) { background: #0284c7; }
.gu-btn-cancel { background: transparent; border: 1px solid #E5E5E5; color: #666; }
.gu-btn-cancel:hover { background: #F0F0F0; color: #1A1A1A; }

.gu-btn-action {
  background: #FAFAFA; border: 1px solid #E5E5E5; color: #1A1A1A;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.gu-btn-action:hover:not(:disabled) { background: #F0F0F0; }
.gu-btn-action:disabled, .gu-btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

.gu-actions-row { display: flex; gap: 12px; }

/* 列表视图 */
.gu-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.gu-toolbar .gu-btn-action { padding: 8px; font-size: 13px; }

.gu-file-list {
  display: flex; flex-direction: column; gap: 8px;
  max-height: 400px; overflow-y: auto; border-top: 1px solid #F0F0F0; padding-top: 12px;
}

.gu-empty-state, .gu-loading-mini {
  text-align: center; padding: 40px 0; color: #999; font-size: 13px;
}

.gu-file-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px; border: 1px solid #F0F0F0; background: #FAFAFA; transition: all 0.2s;
}
.gu-file-item:hover { border-color: #E5E5E5; background: #FFF; }

.gu-file-info { display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
.gu-file-name { font-size: 14px; font-weight: 500; color: #1A1A1A; word-break: break-all; }
.gu-file-name.is-encrypted::before { content: '🔒 '; color: #0284c7; }
.gu-file-meta { font-size: 12px; color: #999; display: flex; align-items: center; gap: 6px; }
.gu-divider { color: #E5E5E5; }

.gu-file-actions { display: flex; gap: 8px; }
.gu-icon-btn {
  background: transparent; border: 1px solid #E5E5E5; width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center; cursor: pointer; color: #666; transition: all 0.2s;
}
.gu-icon-btn:hover { background: #F0F0F0; color: #1A1A1A; }
.gu-text-danger:hover { color: #BE2A2A; border-color: #BE2A2A; background: #FFF0F0; }

/* 子视图公用 */
.gu-sub-header {
  font-family: "STSong", "SimSun", serif; font-size: 16px; font-weight: bold; color: #1A1A1A;
  margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px dashed #E5E5E5;
}
.gu-checkbox-list { display: flex; flex-direction: column; gap: 10px; }
.gu-checkbox-item { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.gu-checkbox-item input { accent-color: #1A1A1A; width: 16px; height: 16px; }
.gu-checkbox-text { font-size: 13px; color: #333; }

.gu-toggle-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #1A1A1A; cursor: pointer; }
.gu-password-fields { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; padding-left: 24px; border-left: 2px solid #F5F5F5; }

.gu-file-info-mini { background: #FAFAFA; padding: 12px; border: 1px solid #F0F0F0; }
.gu-file-name-mini { font-size: 14px; font-weight: bold; color: #0284c7; word-break: break-all; }
.gu-file-size-mini { font-size: 12px; color: #999; margin-top: 4px; }

.gu-radio-group { display: flex; flex-direction: column; gap: 8px; }
.gu-radio-label { display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid #E5E5E5; cursor: pointer; transition: all 0.2s; }
.gu-radio-label.active { border-color: #0284c7; background: #F0F9FF; }
.gu-radio-label input { accent-color: #0284c7; }
.gu-radio-title { font-size: 13px; font-weight: bold; color: #1A1A1A; }
</style>
