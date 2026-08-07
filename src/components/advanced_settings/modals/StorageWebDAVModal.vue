/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'
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

const { isConnecting, lastError, checkConnection, listFiles, uploadFile, downloadFile, deleteFile } = useWebDAV()
const { createBackupFile, readBackupFile, saveSnapshot, restoreBackupData, getAutomationPlans, setAutomationPlan } = useDataBackup()

// WebDAV 配置
const config = ref<WebDAVConfig>({
  url: '',
  username: '',
  password: '',
    enabled: false,
    backupRetention: 10,
    backupPassword: ''
  })
const showConfig = ref(false)
const showTutorial = ref(false)
const tutorialTab = ref<'simple' | 'hardcore'>('simple')
const autoEnabled = ref(false)
const intervalDays = ref(7)

// 备份文件列表
const backupFiles = ref<WebDAVFile[]>([])
const isLoadingFiles = ref(false)

// 上传/下载状态
const activeAction = ref('')
const actionProgress = ref('')

// 导出配置
const showExportConfig = ref(false)
const selectedModules = ref<BackupModule[]>(['settings', 'chats', 'worldbooks', 'images', 'history'])
const encryptPassword = ref('')
const confirmPassword = ref('')

// 导入配置
const showImportConfig = ref(false)
const selectedFileToImport = ref<WebDAVFile | null>(null)
const importPassword = ref('')
const importMode = ref<'overwrite' | 'merge'>('merge')

const loadSavedConfig = () => {
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
  const plan = getAutomationPlans().find(item => item.destination === 'webdav')
  if (plan) { autoEnabled.value = plan.enabled; intervalDays.value = plan.intervalDays }
}

watch(() => props.show, visible => { if (visible) loadSavedConfig() })

const saveAutomation = () => setAutomationPlan({
  destination: 'webdav',
  enabled: autoEnabled.value,
  intervalDays: intervalDays.value,
  modules: selectedModules.value,
  lastRunAt: getAutomationPlans().find(item => item.destination === 'webdav')?.lastRunAt || 0
})

const toggleAutomation = async () => {
  if (!autoEnabled.value && !config.value.backupPassword) {
    await props.showConfirm('请先在配置中设置“自动备份加密密码”。该密码只保存在当前设备，恢复时仍需输入。', '需要加密密码', false)
    showConfig.value = true
    return
  }
  autoEnabled.value = !autoEnabled.value
  saveAutomation()
}

const openTutorial = () => { showConfig.value = false; showTutorial.value = true }
const closeTutorial = () => { showTutorial.value = false; if (!config.value.enabled) showConfig.value = true }

const saveConfig = async () => {
  if (!config.value.url || !config.value.username || !config.value.password) {
    await props.showConfirm('请填写完整的 WebDAV 配置信息', '提示', false)
    return
  }
  
  const ok = await checkConnection(config.value)
  if (!ok) {
    await props.showConfirm(lastError.value || '连接失败，请检查 URL 格式、账号密码或服务端跨域设置。', '提示', false)
    return
  }

  config.value.enabled = true
  localStorage.setItem('webdav_config', JSON.stringify(config.value))
  saveAutomation()
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
    backupFiles.value = files.filter(f => f.name.endsWith('.nrtbackup') || f.name.startsWith('backup_') && (f.name.endsWith('.json') || f.name.endsWith('.clingybackup')))
  } catch(e) {
    console.error(e)
    await props.showConfirm('获取云端列表失败，请检查网络或配置', '提示', false)
  } finally {
    isLoadingFiles.value = false
  }
}

const pruneCloudBackups = async () => {
  const limit = Math.max(1, config.value.backupRetention || 10)
  const files = await listFiles(config.value)
  const backups = files.filter(file => file.name.endsWith('.nrtbackup') || file.name.startsWith('backup_') && (file.name.endsWith('.json') || file.name.endsWith('.clingybackup')))
  await Promise.all(backups.slice(limit).map(file => deleteFile(config.value, file.name)))
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
  if (!encryptPassword.value) {
    await props.showConfirm('云端备份必须设置加密密码', '提示', false)
    return
  }
  if (encryptPassword.value !== confirmPassword.value) {
    await props.showConfirm('两次输入的密码不一致', '提示', false)
    return
  }

  activeAction.value = 'upload'
  showExportConfig.value = false
  
  try {
    actionProgress.value = '正在收集并打包本地数据...'
    await new Promise(r => setTimeout(r, 100))
    const backup = await createBackupFile(selectedModules.value, encryptPassword.value)
    
    actionProgress.value = '正在加密并生成文件...'
    await new Promise(r => setTimeout(r, 100))
    
    actionProgress.value = '正在上传到 WebDAV 云端...'
    const date = new Date()
    const dateStr = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours()}${date.getMinutes()}`
    const filename = `粘人精-云端备份-${dateStr}.nrtbackup`
    
    const success = await uploadFile(config.value, filename, backup.buffer)
    
    if (success) {
      await pruneCloudBackups()
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
    const { data } = await readBackupFile(buffer, importPassword.value || undefined)
    
    actionProgress.value = '正在写入本地存储...'
    await new Promise(r => setTimeout(r, 100))
    await saveSnapshot('云端恢复前自动恢复点')
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
          <div class="gu-section">
            <div class="gu-section-title">云端版本保留数量</div>
            <div class="gu-retention-row"><button v-for="count in [5, 10, 20]" :key="count" class="gu-retention-btn" :class="{ active: config.backupRetention === count }" @click="config.backupRetention = count">保留 {{ count }} 个</button></div>
          </div>
          <div class="gu-section">
            <div class="gu-section-title">自动备份加密密码</div>
            <input type="password" class="gu-input" v-model="config.backupPassword" placeholder="自动备份与换机恢复时使用">
            <div class="gu-note">密码只保存在当前设备且不会写入备份。忘记密码将无法恢复云端文件。</div>
          </div>
          <div class="gu-section">
            <div class="gu-section-title">应用打开时自动备份</div>
            <button class="gu-choice gu-auto-choice" :class="{ selected: autoEnabled }" @click="toggleAutomation"><span class="gu-check">{{ autoEnabled ? '✓' : '' }}</span><span><b>{{ autoEnabled ? '已开启' : '未开启' }}</b><small>到期后在应用打开或重新联网时执行</small></span></button>
            <div v-if="autoEnabled" class="gu-retention-row"><button v-for="day in [1, 7, 30]" :key="day" class="gu-retention-btn" :class="{ active: intervalDays === day }" @click="intervalDays = day; saveAutomation()">每 {{ day }} 天</button></div>
          </div>
          
          <button class="gu-btn-cancel mt-2" @click="openTutorial">不知道怎么配置？查看免费云主机教程</button>
          <button class="gu-btn-confirm mt-4" @click="saveConfig" :disabled="isConnecting">
            {{ isConnecting ? '连接测试中...' : '连接并保存' }}
          </button>
          
          <button v-if="config.enabled" class="gu-btn-cancel mt-2" @click="showConfig = false">取消修改</button>
        </div>

        <!-- 导出参数配置弹窗 (模拟子弹窗) -->
        <div v-else-if="showExportConfig" class="gu-sub-view">
          <div class="gu-sub-header">上传新备份至云端</div>
          <div class="gu-checkbox-list">
            <button class="gu-checkbox-item" :class="{ active: selectedModules.includes('settings') }" @click="toggleModule('settings')"><span class="gu-check">{{ selectedModules.includes('settings') ? '✓' : '' }}</span><span class="gu-checkbox-text">应用设置与预设</span></button>
            <button class="gu-checkbox-item" :class="{ active: selectedModules.includes('chats') }" @click="toggleModule('chats')"><span class="gu-check">{{ selectedModules.includes('chats') ? '✓' : '' }}</span><span class="gu-checkbox-text">角色与聊天记录</span></button>
            <button class="gu-checkbox-item" :class="{ active: selectedModules.includes('worldbooks') }" @click="toggleModule('worldbooks')"><span class="gu-check">{{ selectedModules.includes('worldbooks') ? '✓' : '' }}</span><span class="gu-checkbox-text">世界书文本</span></button>
            <button class="gu-checkbox-item" :class="{ active: selectedModules.includes('images') }" @click="toggleModule('images')"><span class="gu-check">{{ selectedModules.includes('images') ? '✓' : '' }}</span><span class="gu-checkbox-text">全量图片库 (较慢)</span></button>
          </div>

          <div class="gu-section mt-4">
            <div class="gu-choice selected gu-encryption-lock"><span class="gu-check">✓</span><span><b>强制加密云端文件</b><small>AES-GCM 加密后再上传</small></span></div>
            <div class="gu-password-fields">
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

          <div class="gu-section mt-4">
            <div class="gu-section-title">解密密码（如该备份已加密）</div>
            <input type="password" class="gu-input" v-model="importPassword" placeholder="未加密备份可留空">
          </div>

          <div class="gu-section mt-4">
            <div class="gu-section-title">选择导入模式</div>
            <div class="gu-radio-group">
              <button class="gu-radio-label" :class="{ active: importMode === 'merge' }" @click="importMode = 'merge'">
                <div class="gu-radio-text">
                  <div class="gu-radio-title">追加合并 (推荐)</div>
                </div>
              </button>
              <button class="gu-radio-label" :class="{ active: importMode === 'overwrite' }" @click="importMode = 'overwrite'">
                <div class="gu-radio-text">
                  <div class="gu-radio-title">完全覆盖 (危险)</div>
                </div>
              </button>
            </div>
          </div>

          <div class="gu-actions-row mt-4">
            <button class="gu-btn-cancel" @click="showImportConfig = false">返回</button>
            <button class="gu-btn-confirm" @click="startCloudRestore">开始下载并恢复</button>
          </div>
        </div>

        <!-- 内置教程：沿用现有摘要卡片与说明块 -->
        <div v-else-if="showTutorial" class="gu-sub-view">
          <div class="gu-sub-header" style="border-bottom:none; padding-bottom:0; margin-bottom:8px;">WebDAV 教程</div>
          
          <div class="gu-tabs-header" style="display:flex; gap:16px; margin-bottom:16px; border-bottom:1px solid #E5E5E5;">
            <button style="padding:8px 0; background:transparent; border:none; cursor:pointer; font-weight:bold; font-size:14px; border-bottom: 2px solid transparent; transition: all 0.2s;" :style="tutorialTab === 'simple' ? 'color:#1A1A1A; border-bottom-color:#1A1A1A;' : 'color:#999;'" @click="tutorialTab = 'simple'">通用网盘教程 (极简推荐)</button>
            <button style="padding:8px 0; background:transparent; border:none; cursor:pointer; font-weight:bold; font-size:14px; border-bottom: 2px solid transparent; transition: all 0.2s;" :style="tutorialTab === 'hardcore' ? 'color:#1A1A1A; border-bottom-color:#1A1A1A;' : 'color:#999;'" @click="tutorialTab = 'hardcore'">云主机自建教程 (硬核复杂)</button>
          </div>

          <div v-if="tutorialTab === 'simple'">
            <div class="gu-summary-card"><div class="gu-summary-mark">荐</div><div><b>使用现成支持 WebDAV 的网盘（无需代码）</b><small>最简单、最适合普通用户的方法，只需3步即可开启云端漫游。</small></div></div>
            <div class="gu-tutorial-step"><b>步骤一：注册/登录网盘</b><small>在搜索引擎查找“支持 WebDAV 的免费网盘”并注册账号。</small></div>
            <div class="gu-tutorial-step"><b>步骤二：获取应用密码</b><small>在网盘的“安全”或“设置”中心，开启 WebDAV 功能，并生成一个专用的“应用密码”或“授权码”（注意通常不是登录密码）。</small></div>
            <div class="gu-tutorial-step"><b>步骤三：一键连接</b><small>在应用配置中，填入网盘提供的 WebDAV 地址（URL）、账号以及刚生成的应用密码。点击保存即可使用！</small></div>
            <div class="gu-tutorial-step"><b>换机恢复</b><small>在新设备上填入同样的 URL、账号和密码，即可获取云端备份文件进行恢复。</small></div>
          </div>

          <div v-else-if="tutorialTab === 'hardcore'">
            <div class="gu-summary-card"><div class="gu-summary-mark">免</div><div><b>免费云主机自建</b><small>可选择带长期免费计算额度的云平台，创建 Ubuntu 主机。免费政策可能变化，创建前务必在费用估算中确认金额为 0。</small></div></div>
            <div class="gu-tutorial-step"><b>一、安装 WebDAV 服务</b><small>在主机安装 Docker，部署 SFTPGo 开源版，并为数据目录挂载持久磁盘。管理后台创建只用于当前应用备份的普通用户。</small></div>
            <div class="gu-tutorial-step"><b>二、启用 HTTPS 与跨域</b><small>为 WebDAV 绑定域名和有效 HTTPS 证书。在 SFTPGo 的 webdavd binding 中开启 CORS，仅允许当前网页来源，并允许 OPTIONS、PROPFIND、GET、PUT、DELETE及 Authorization、Depth、Content-Type 请求头。</small></div>
            <div class="gu-tutorial-step"><b>三、连接应用</b><small>网盘地址填写 https://你的域名/dav/，使用刚创建的普通账号，不要使用服务器管理员账号。设置自动备份密码后测试连接。</small></div>
            <div class="gu-tutorial-step"><b>四、换机恢复</b><small>新设备填写相同地址和账号，刷新云端列表，选择最新备份。优先使用“追加合并”；只有确认新设备无重要数据时才使用覆盖。</small></div>
            <div class="gu-note">自建服务必须同时满足 HTTPS、持久磁盘、定期更新和浏览器 CORS。若不熟悉服务器维护，强烈建议使用现成 WebDAV 网盘。</div>
          </div>

          <div class="gu-actions-row mt-4"><button class="gu-btn-cancel" @click="closeTutorial">{{ config.enabled ? '返回云端记录' : '返回连接配置' }}</button></div>
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
            <button class="gu-btn-action" @click="openTutorial">
              <span class="icon">?</span> 教程
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
  flex: 1; position: relative; max-height: 68vh; overflow-y: auto;
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
  appearance: none; box-sizing: border-box; width: 100%; padding: 10px 12px; background: #FAFAFA;
  border: 1px solid #E5E5E5; font-size: 14px; outline: none; transition: all 0.2s;
}
.gu-input:focus { border-color: #0284c7; background: #FFFFFF; }

.mt-4 { margin-top: 16px; }
.mt-2 { margin-top: 8px; }

/* 按钮 */
.gu-btn-confirm, .gu-btn-cancel, .gu-btn-action {
  appearance: none; width: 100%; padding: 12px; font-size: 14px; cursor: pointer; border: none; transition: all 0.2s;
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
.gu-toolbar { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px; }
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
.gu-checkbox-item { appearance:none; display: flex; align-items: center; gap: 8px; padding:8px 0; border:0; border-bottom:1px solid #F0F0F0; background:transparent; cursor: pointer; text-align:left; }
.gu-checkbox-text { font-size: 13px; color: #333; }

.gu-toggle-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #1A1A1A; cursor: pointer; }
.gu-password-fields { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; padding-left: 24px; border-left: 2px solid #F5F5F5; }

.gu-file-info-mini { background: #FAFAFA; padding: 12px; border: 1px solid #F0F0F0; }
.gu-file-name-mini { font-size: 14px; font-weight: bold; color: #0284c7; word-break: break-all; }
.gu-file-size-mini { font-size: 12px; color: #999; margin-top: 4px; }

.gu-radio-group { display: flex; flex-direction: column; gap: 8px; }
.gu-radio-label { appearance:none; display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid #E5E5E5; background:#FFF; cursor: pointer; transition: all 0.2s; text-align:left; }
.gu-radio-label.active { border-color: #0284c7; background: #F0F9FF; }
.gu-radio-title { font-size: 13px; font-weight: bold; color: #1A1A1A; }
.gu-retention-row { display:flex; gap:8px; }.gu-retention-btn { appearance:none; flex:1; padding:9px 0; border:1px solid #E5E5E5; background:#FFF; color:#666; font-size:12px; cursor:pointer; }.gu-retention-btn.active { border-color:#1A1A1A; background:#1A1A1A; color:#FFF; }
.gu-note { padding:12px; border:1px solid #F0F0F0; background:#FAFAFA; color:#777; font-size:12px; line-height:1.6; }
.gu-choice { appearance:none; display:flex; width:100%; align-items:flex-start; gap:10px; padding:11px; border:1px solid #E5E5E5; background:#FAFAFA; color:#1A1A1A; text-align:left; cursor:pointer; }
.gu-choice b,.gu-choice small { display:block; }.gu-choice b{font-size:13px}.gu-choice small{margin-top:3px;color:#777;font-size:11px;line-height:1.5}.gu-check{width:16px;height:16px;display:grid;place-items:center;flex:none;border:1px solid #CFCFCF;color:#FFF;font-size:11px}.gu-choice.selected .gu-check,.gu-checkbox-item.active .gu-check{background:#1A1A1A;border-color:#1A1A1A}.gu-auto-choice{padding:10px}.gu-encryption-lock{cursor:default}.gu-summary-card{display:flex;align-items:flex-start;gap:12px;padding:14px;border:1px solid #F0F0F0;background:#FAFAFA;margin-bottom:10px}.gu-summary-mark{width:30px;height:30px;display:grid;place-items:center;flex:none;background:#1A1A1A;color:#FFF;font-family:"STSong","SimSun",serif}.gu-summary-card b,.gu-summary-card small{display:block}.gu-summary-card b{font-size:14px;margin-bottom:3px}.gu-summary-card small{color:#777;font-size:12px;line-height:1.6}.gu-tutorial-step{padding:13px 0;border-bottom:1px dashed #E5E5E5}.gu-tutorial-step b,.gu-tutorial-step small{display:block}.gu-tutorial-step b{font-family:"STSong","SimSun",serif;font-size:14px}.gu-tutorial-step small{margin-top:5px;color:#777;font-size:12px;line-height:1.7}
</style>
