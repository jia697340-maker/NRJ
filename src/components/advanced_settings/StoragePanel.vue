/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { useAdvancedSettingsStorage } from '../../composables/useAdvancedSettingsStorage'
import { computed, onMounted, ref } from 'vue'
import StorageCompressModal from './modals/StorageCompressModal.vue'
import StorageDeepCleanView from './StorageDeepCleanView.vue'
import StorageBreakdownModal from './modals/StorageBreakdownModal.vue'
import StorageBackupModal from './modals/StorageBackupModal.vue'
import StorageImportModal from './modals/StorageImportModal.vue'
import StorageWebDAVModal from './modals/StorageWebDAVModal.vue'
import StorageBackupHistoryModal from './modals/StorageBackupHistoryModal.vue'
import StorageExternalBackupModal from './modals/StorageExternalBackupModal.vue'
import { useDataBackup } from '../../composables/useDataBackup'
import { useWebDAV, type WebDAVConfig } from '../../composables/useWebDAV'
import { useGitHubBackup, type GitHubBackupConfig } from '../../composables/useGitHubBackup'

const props = defineProps<{
  showConfirm: any
}>()

const {
  storageInfo,
  isPersisted,
  showBreakdownModal,
  showCompressModal,
  compressQuality,
  isCompressing,
  compressProgress,
  formatBytes,
  checkStorage,
  requestPersistence,
  startImageCompression,
  clearUnusedData,
  clearOfflineCache,
  clearAllData,
  deepScanResults,
  isScanning,
  deleteStorageItems
} = useAdvancedSettingsStorage(props.showConfirm)

const activeStorageView = ref<'user' | 'app'>('user')
const nonUserUsage = computed(() => Math.max(0, storageInfo.value.usage - storageInfo.value.userDataUsage))
const capacityRatio = computed(() => storageInfo.value.quota > 0
  ? Math.max(0, Math.min(100, storageInfo.value.usage / storageInfo.value.quota * 100))
  : 0)
const capacityStatus = computed(() => {
  if (!storageInfo.value.quota) return { label: '暂不可用', tone: 'muted' }
  if (capacityRatio.value >= 95) return { label: '容量告急', tone: 'danger' }
  if (capacityRatio.value >= 80) return { label: '接近上限', tone: 'danger' }
  if (capacityRatio.value >= 50) return { label: '需要留意', tone: 'caution' }
  return { label: '空间充足', tone: 'safe' }
})
const capacityCaption = computed(() => {
  if (!storageInfo.value.quota) return '浏览器未提供可用额度'
  const ratio = storageInfo.value.usage === 0
    ? '0%'
    : capacityRatio.value < 0.01
      ? '低于 0.01%'
      : `约 ${capacityRatio.value < 1 ? capacityRatio.value.toFixed(2) : capacityRatio.value.toFixed(1)}%`
  return `${ratio} · 估算额度 ${formatBytes(storageInfo.value.quota)}`
})

const showDeepCleanView = ref(false)
const activeCleanTab = ref('all')

const showBackupModal = ref(false)
const showImportModal = ref(false)
const showWebDAVModal = ref(false)
const showBackupHistoryModal = ref(false)
const showGitHubBackupModal = ref(false)
const showEmailBackupModal = ref(false)
const { runAutomaticBackupIfDue, createBackupFile, getAutomationPlans, isAutomationDue, markAutomationRun, savePendingEmailBackup } = useDataBackup()
const { uploadFile, listFiles, deleteFile } = useWebDAV()
const { uploadBackup } = useGitHubBackup()
const latestCloudBackupAt = ref(0)

const refreshBackupStatus = () => {
  latestCloudBackupAt.value = Math.max(0, ...getAutomationPlans()
    .filter(plan => plan.destination === 'webdav' || plan.destination === 'github')
    .map(plan => plan.lastRunAt || 0))
}

const backupStatus = computed(() => {
  if (!latestCloudBackupAt.value) return { label: '未检测到', caption: '可使用导出或云端备份', tone: 'caution' }
  const days = Math.floor((Date.now() - latestCloudBackupAt.value) / 86400000)
  if (days <= 0) return { label: '今天', caption: '已留有云端恢复保障', tone: 'safe' }
  if (days <= 7) return { label: `${days} 天前`, caption: '已有云端恢复保障', tone: 'safe' }
  return { label: `${days} 天前`, caption: '建议更新云端备份', tone: 'caution' }
})

const persistenceStatus = computed(() => {
  if (isPersisted.value === null) return { label: '状态未知', caption: '当前浏览器未提供保护状态', tone: 'muted' }
  if (isPersisted.value) return { label: '已开启', caption: '浏览器不会因空间紧张自动回收', tone: 'safe' }
  return { label: '未开启', caption: '可申请浏览器持久化保护', tone: 'caution' }
})

const syncAutomaticBackup = async () => {
  try {
    const plan = getAutomationPlans().find(item => item.destination === 'webdav')
    if (!plan || !isAutomationDue(plan)) return false
    const config = JSON.parse(localStorage.getItem('webdav_config') || '{}') as WebDAVConfig
    if (!config.enabled || !config.backupPassword) return false
    const backup = await createBackupFile(plan.modules, config.backupPassword)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const uploaded = await uploadFile(config, `粘人精-自动备份-${stamp}.nrtbackup`, backup.buffer)
    if (!uploaded) throw new Error('WebDAV 自动上传失败')
    const files = await listFiles(config)
    const backups = files.filter(file => file.name.endsWith('.nrtbackup'))
    for (const file of backups.slice(Math.max(1, config.backupRetention || 10))) await deleteFile(config, file.name)
    markAutomationRun('webdav')
    return true
  } catch (error) { console.warn('自动云端备份失败', error); return false }
}

const runExternalAutomation = async () => {
  let created = false
  const plans = getAutomationPlans()
  const githubPlan = plans.find(plan => plan.destination === 'github')
  if (githubPlan && isAutomationDue(githubPlan)) {
    try {
      const config = JSON.parse(localStorage.getItem('github_backup_config') || '{}') as GitHubBackupConfig
      if (config.token && config.repository && config.encryptionPassword) {
        const backup = await createBackupFile(githubPlan.modules, config.encryptionPassword)
        await uploadBackup(config, backup.buffer, `粘人精自动备份-${Date.now()}.nrtbackup`, () => {}, true)
        markAutomationRun('github')
        created = true
      }
    } catch (error) { console.warn('GitHub 自动备份失败', error) }
  }
  const emailPlan = plans.find(plan => plan.destination === 'email')
  if (emailPlan && isAutomationDue(emailPlan)) {
    try {
      const emailPassword = localStorage.getItem('email_backup_password') || ''
      if (!emailPassword) return
      const backup = await createBackupFile(emailPlan.modules, emailPassword)
        await savePendingEmailBackup(backup.buffer, emailPlan.modules, true)
        markAutomationRun('email')
        created = true
    } catch (error) { console.warn('邮箱待发送备份生成失败', error) }
  }
  return created
}

onMounted(async () => {
  await checkStorage()
  const localCreated = await runAutomaticBackupIfDue()
  const webdavCreated = await syncAutomaticBackup()
  const externalCreated = await runExternalAutomation()
  refreshBackupStatus()
  if (localCreated || webdavCreated || externalCreated) await checkStorage()
})

</script>

<template>
  <div class="gu-storage-panel">
    <!-- 古风标题 -->
    <div class="gu-panel-header">
      <div class="gu-panel-title">
        <span>本地存储状态</span>
        <div class="gu-seal">存</div>
      </div>
      <div class="gu-panel-desc">管理应用在当前设备占用的存储空间与缓存数据</div>
    </div>
    
    <!-- 默认只呈现用户数据；应用壳与缓存按需查看，避免把应用体积误读为个人数据。 -->
    <div class="gu-storage-switch" role="tablist" aria-label="存储占用类型">
      <button type="button" role="tab" :aria-selected="activeStorageView === 'user'" :class="{ active: activeStorageView === 'user' }" @click="activeStorageView = 'user'">我的数据</button>
      <button type="button" role="tab" :aria-selected="activeStorageView === 'app'" :class="{ active: activeStorageView === 'app' }" @click="activeStorageView = 'app'">应用占用</button>
    </div>

    <div class="gu-storage-focus" aria-live="polite">
      <span>{{ activeStorageView === 'user' ? '你的数据' : '应用与其他占用' }}</span>
      <strong>{{ formatBytes(activeStorageView === 'user' ? storageInfo.userDataUsage : nonUserUsage) }}</strong>
      <p v-if="activeStorageView === 'user'">聊天、头像、图片、人设和个人设置等内容</p>
      <p v-else>离线缓存 {{ formatBytes(storageInfo.cacheUsage) }} · 浏览器开销 {{ formatBytes(storageInfo.overheadUsage) }}<template v-if="storageInfo.backupUsage"> · 本机恢复点 {{ formatBytes(storageInfo.backupUsage) }}</template></p>
    </div>

    <div class="gu-safety-title"><span>数据安全状态</span><div class="gu-seal">护</div></div>
    <div class="gu-ledger-grid gu-safety-ledger">
      <div class="gu-ledger-item">
        <span class="gu-ledger-label">容量</span>
        <span class="gu-ledger-value" :class="`tone-${capacityStatus.tone}`">{{ capacityStatus.label }}</span>
      </div>
      <div class="gu-ledger-item">
        <span class="gu-ledger-label">浏览器保护</span>
        <span class="gu-ledger-value" :class="`tone-${persistenceStatus.tone}`">{{ persistenceStatus.label }}</span>
      </div>
      <div class="gu-ledger-item">
        <span class="gu-ledger-label">云端备份</span>
        <span class="gu-ledger-value" :class="`tone-${backupStatus.tone}`">{{ backupStatus.label }}</span>
      </div>
    </div>
    <div class="gu-storage-note">
      <span>{{ capacityCaption }}</span>
      <span>{{ persistenceStatus.caption }}</span>
      <span>{{ backupStatus.caption }}</span>
    </div>

    <!-- 功能列表（如书目一般） -->
    <div class="gu-feature-list">
      <!-- 深度占用明细 -->
      <div class="gu-feature-item" v-if="storageInfo.details.length > 0" @click="showBreakdownModal = true; checkStorage()">
        <div class="gu-feature-left">
          <span class="gu-feature-dot">·</span>
          <div class="gu-feature-text">
            <div class="gu-feature-name">深度占用明细</div>
            <div class="gu-feature-sub">排查最大的图片和文件</div>
          </div>
        </div>
        <div class="gu-feature-right">「 查阅 」</div>
      </div>

      <!-- 数据持久化保护 -->
      <div class="gu-feature-item" @click="requestPersistence" :class="{'is-disabled': isPersisted}">
        <div class="gu-feature-left">
          <span class="gu-feature-dot" :class="isPersisted ? 'text-safe' : 'text-caution'">·</span>
          <div class="gu-feature-text">
            <div class="gu-feature-name">
              数据持久化保护
              <span class="gu-status-seal" :class="isPersisted ? 'safe' : 'caution'">
                {{ isPersisted ? '已开启' : isPersisted === false ? '未开启' : '未知' }}
              </span>
            </div>
            <div class="gu-feature-sub">开启后可降低设备空间紧张时被浏览器自动清理的风险</div>
          </div>
        </div>
        <div class="gu-feature-right" v-if="!isPersisted">「 开启 」</div>
      </div>

      <!-- 数据导出备份 -->
      <div class="gu-feature-item" @click="showBackupModal = true">
        <div class="gu-feature-left">
          <span class="gu-feature-dot">·</span>
          <div class="gu-feature-text">
            <div class="gu-feature-name">本地导出备份</div>
            <div class="gu-feature-sub">将记录和设定导出为文件妥善保管</div>
          </div>
        </div>
        <div class="gu-feature-right">「 导出 」</div>
      </div>

      <!-- 数据导入恢复 -->
      <div class="gu-feature-item" @click="showImportModal = true">
        <div class="gu-feature-left">
          <span class="gu-feature-dot">·</span>
          <div class="gu-feature-text">
            <div class="gu-feature-name">从本地恢复数据</div>
            <div class="gu-feature-sub">从备份文件中恢复或合并数据</div>
          </div>
        </div>
        <div class="gu-feature-right">「 导入 」</div>
      </div>

      <div class="gu-feature-item" @click="clearOfflineCache">
        <div class="gu-feature-left">
          <span class="gu-feature-dot">·</span>
          <div class="gu-feature-text">
            <div class="gu-feature-name">离线应用缓存</div>
            <div class="gu-feature-sub">{{ formatBytes(storageInfo.cacheUsage) }} · 清除后联网时自动恢复，不影响用户内容</div>
          </div>
        </div>
        <div class="gu-feature-right">「 清除 」</div>
      </div>

      <div class="gu-feature-item" @click="showBackupHistoryModal = true">
        <div class="gu-feature-left">
          <span class="gu-feature-dot">·</span>
          <div class="gu-feature-text">
            <div class="gu-feature-name">备份记录与恢复点</div>
            <div class="gu-feature-sub">管理导入前快照与本机自动备份</div>
          </div>
        </div>
        <div class="gu-feature-right">「 管理 」</div>
      </div>

      <div class="gu-feature-item" @click="showGitHubBackupModal = true">
        <div class="gu-feature-left">
          <span class="gu-feature-dot" style="color: #BE2A2A">·</span>
          <div class="gu-feature-text">
            <div class="gu-feature-name">GitHub 私有仓库备份</div>
            <div class="gu-feature-sub">完整或分类备份，媒体较多时自动分卷上传</div>
          </div>
        </div>
        <div class="gu-feature-right"> 配置 </div>
      </div>

      <div class="gu-feature-item" @click="showEmailBackupModal = true">
        <div class="gu-feature-left">
          <span class="gu-feature-dot" style="color: #9a6a2e">·</span>
          <div class="gu-feature-text">
            <div class="gu-feature-name">邮箱备份</div>
            <div class="gu-feature-sub">完整或分类生成加密文件，再交由邮件应用发送</div>
          </div>
        </div>
        <div class="gu-feature-right"> 发送 </div>
      </div>

      <!-- WebDAV 云端漫游 -->
      <div class="gu-feature-item" @click="showWebDAVModal = true">
        <div class="gu-feature-left">
          <span class="gu-feature-dot" style="color: #0284c7">·</span>
          <div class="gu-feature-text">
            <div class="gu-feature-name">WebDAV 云端漫游</div>
            <div class="gu-feature-sub">跨设备备份恢复、自动版本管理与自建教程</div>
          </div>
        </div>
        <div class="gu-feature-right">「 配置 」</div>
      </div>
    </div>

    <!-- 操作按钮区 -->
    <div class="gu-action-area">
      <div class="gu-action-row">
        <button class="gu-text-btn" @click="checkStorage">「 刷新状态 」</button>
        <button class="gu-text-btn" @click="showCompressModal = true">「 压缩图片 」</button>
        <button class="gu-text-btn gu-text-danger" @click="clearUnusedData">「 清理无用 」</button>
      </div>
      
      <button class="gu-block-btn gu-block-danger" @click="clearAllData">
        彻底清除本应用所有数据 (恢复出厂设置)
      </button>
    </div>
  </div>

  <StorageCompressModal 
    :show="showCompressModal"
    v-model="compressQuality"
    :is-compressing="isCompressing"
    :compress-progress="compressProgress"
    @close="showCompressModal = false"
    @start="startImageCompression"
  />

  <StorageBreakdownModal
    :show="showBreakdownModal"
    :storage-info="storageInfo"
    :is-scanning="isScanning"
    :deep-scan-results="deepScanResults"
    :format-bytes="formatBytes"
    @close="showBreakdownModal = false"
    @open-deep-clean="(tabId: string) => { showDeepCleanView = true; activeCleanTab = tabId }"
  />

  <StorageDeepCleanView
    :show="showDeepCleanView"
    :initial-tab="activeCleanTab"
    :is-scanning="isScanning"
    :deep-scan-results="deepScanResults"
    :format-bytes="formatBytes"
    @close="showDeepCleanView = false"
    @delete="deleteStorageItems"
  />

  <StorageBackupModal
    :show="showBackupModal"
    :show-confirm="props.showConfirm"
    @close="showBackupModal = false"
  />

  <StorageImportModal
    :show="showImportModal"
    :show-confirm="props.showConfirm"
    @close="showImportModal = false"
    @success="checkStorage"
  />

  <StorageWebDAVModal
    :show="showWebDAVModal"
    :show-confirm="props.showConfirm"
    @close="showWebDAVModal = false"
    @success="checkStorage"
  />

  <StorageBackupHistoryModal
    :show="showBackupHistoryModal"
    :show-confirm="props.showConfirm"
    @close="showBackupHistoryModal = false"
  />

  <StorageExternalBackupModal
    :show="showGitHubBackupModal"
    :show-confirm="props.showConfirm"
    destination="github"
    @close="showGitHubBackupModal = false"
  />

  <StorageExternalBackupModal
    :show="showEmailBackupModal"
    :show-confirm="props.showConfirm"
    destination="email"
    @close="showEmailBackupModal = false"
  />
</template>

<style scoped>
.gu-storage-panel {
  display: flex;
  flex-direction: column;
  padding-bottom: 40px;
}

/* 头部 */
.gu-panel-header {
  margin-bottom: 30px;
}

.gu-panel-title {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 8px;
}

.gu-panel-title span {
  font-family: "STSong", "SimSun", "Songti SC", serif;
  font-size: 18px;
  font-weight: bold;
  color: #1A1A1A;
  letter-spacing: 2px;
}

.gu-seal {
  width: 14px;
  height: 14px;
  background-color: #BE2A2A;
  color: #FFFFFF;
  font-family: "STFangsong", "FangSong", "SimSun", serif;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  margin-top: 2px;
}

.gu-panel-desc {
  font-size: 13px;
  color: #666666;
  letter-spacing: 0.5px;
}

/* 与页内书目按钮一致的墨色分段切换，不使用浏览器默认控件外观。 */
.gu-storage-switch {
  align-self: center;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  width: min(280px, 100%);
  margin: 0 auto 22px;
  padding: 3px;
  border: 1px solid #E5E5E5;
  background: #FAFAFA;
}

.gu-storage-switch button {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 9px 12px;
  color: #777777;
  font-family: "STSong", "SimSun", "Songti SC", serif;
  font-size: 13px;
  letter-spacing: 1px;
  cursor: pointer;
}

.gu-storage-switch button.active {
  background: #1A1A1A;
  color: #FFFFFF;
}

.gu-storage-focus {
  min-height: 128px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 28px;
  border-top: 1px solid #F0F0F0;
  border-bottom: 1px solid #F0F0F0;
  text-align: center;
}

.gu-storage-focus > span {
  color: #777777;
  font-family: "STSong", "SimSun", "Songti SC", serif;
  font-size: 13px;
  letter-spacing: 2px;
}

.gu-storage-focus strong {
  margin-top: 9px;
  color: #1A1A1A;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 30px;
  line-height: 1;
  letter-spacing: -0.6px;
}

.gu-storage-focus p {
  max-width: 440px;
  margin: 11px 16px 0;
  color: #999999;
  font-size: 11px;
  line-height: 1.6;
}

.gu-safety-title {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 12px;
}

.gu-safety-title > span {
  font-family: "STSong", "SimSun", "Songti SC", serif;
  font-size: 15px;
  font-weight: bold;
  letter-spacing: 2px;
}

/* 古典账本数据呈现（天地线） */
.gu-ledger-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 20px 0;
  border-top: 1px solid #E5E5E5;
  border-bottom: 1px solid #E5E5E5;
  margin-bottom: 0;
}

.gu-storage-note {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 12px 0 24px;
  color: #999999;
  font-size: 11px;
  line-height: 1.6;
  text-align: center;
}

.tone-safe { color: #38785A !important; }
.tone-caution { color: #9A6A2E !important; }
.tone-danger { color: #BE2A2A !important; }
.tone-muted { color: #888888 !important; }

.gu-ledger-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  border-right: 1px dashed #F0F0F0;
}

.gu-ledger-item:last-child {
  border-right: none;
}

.gu-ledger-label {
  font-family: "STSong", "SimSun", serif;
  font-size: 13px;
  color: #666666;
  letter-spacing: 1px;
}

.gu-ledger-value {
  font-family: -apple-system, sans-serif;
  font-size: 15px;
  font-weight: 500;
  color: #1A1A1A;
}

/* 功能列表（书目式） */
.gu-feature-list {
  display: flex;
  flex-direction: column;
  margin-bottom: 30px;
}

.gu-feature-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 0;
  border-bottom: 1px solid #F5F5F5;
  cursor: pointer;
  transition: background-color 0.2s;
}

.gu-feature-item:active:not(.is-disabled) {
  background-color: #FAFAFA;
}

.gu-feature-item.is-disabled {
  cursor: default;
  opacity: 0.8;
}

.gu-feature-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.gu-feature-dot {
  font-family: "STSong", "SimSun", serif;
  font-size: 18px;
  color: #1A1A1A;
  margin-top: -2px;
}

.gu-feature-dot.text-safe { color: #059669; }
.gu-feature-dot.text-danger { color: #BE2A2A; }
.gu-feature-dot.text-caution { color: #9A6A2E; }

.gu-feature-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gu-feature-name {
  font-family: -apple-system, sans-serif;
  font-size: 15px;
  color: #1A1A1A;
  display: flex;
  align-items: center;
  gap: 8px;
}

.gu-status-seal {
  font-family: "STSong", "SimSun", serif;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 2px;
  letter-spacing: 1px;
}

.gu-status-seal.safe {
  border: 1px solid #059669;
  color: #059669;
}

.gu-status-seal.danger {
  border: 1px solid #BE2A2A;
  color: #BE2A2A;
}

.gu-status-seal.caution {
  border: 1px solid #9A6A2E;
  color: #9A6A2E;
}

.gu-feature-sub {
  font-size: 12px;
  color: #999999;
}

.gu-feature-right {
  font-family: "STSong", "SimSun", serif;
  font-size: 14px;
  color: #666666;
}

/* 操作区 */
.gu-action-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.gu-action-row {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.gu-text-btn {
  background: transparent;
  border: none;
  font-family: "STSong", "SimSun", serif;
  font-size: 14px;
  color: #1A1A1A;
  cursor: pointer;
  padding: 8px 12px;
  transition: all 0.2s;
  letter-spacing: 1px;
}

.gu-text-btn:active {
  background-color: #FAFAFA;
}

.gu-text-danger {
  color: #BE2A2A;
}

.gu-block-btn {
  width: 100%;
  padding: 16px;
  background: transparent;
  border: 1px solid #E5E5E5;
  font-family: -apple-system, sans-serif;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.gu-block-danger {
  color: #BE2A2A;
  border-color: rgba(190, 42, 42, 0.2);
}

.gu-block-danger:active {
  background-color: rgba(190, 42, 42, 0.02);
}
</style>
