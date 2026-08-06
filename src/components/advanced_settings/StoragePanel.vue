/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { useAdvancedSettingsStorage } from '../../composables/useAdvancedSettingsStorage'
import { onMounted, ref } from 'vue'
import StorageCompressModal from './modals/StorageCompressModal.vue'
import StorageDeepCleanView from './StorageDeepCleanView.vue'
import StorageBreakdownModal from './modals/StorageBreakdownModal.vue'
import StorageBackupModal from './modals/StorageBackupModal.vue'
import StorageImportModal from './modals/StorageImportModal.vue'
import StorageWebDAVModal from './modals/StorageWebDAVModal.vue'

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
  clearAllData,
  deepScanResults,
  isScanning,
  scanAllStorageDetails,
  deleteStorageItems
} = useAdvancedSettingsStorage(props.showConfirm)

const showDeepCleanView = ref(false)
const activeCleanTab = ref('all')

const showBackupModal = ref(false)
const showImportModal = ref(false)
const showWebDAVModal = ref(false)

onMounted(() => {
  checkStorage()
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
    
    <!-- 极简墨圈进度 -->
    <div class="gu-ink-ring-container">
      <svg viewBox="0 0 100 100" class="gu-ink-ring">
        <!-- 极淡的底环（未沾墨的纸线） -->
        <circle cx="50" cy="50" r="46" fill="none" stroke="#F5F5F5" stroke-width="1.5" />
        <!-- 进度环（浓墨晕染） -->
        <circle 
          cx="50" cy="50" r="46" 
          fill="none" 
          stroke="#1A1A1A" 
          stroke-width="2" 
          stroke-linecap="round"
          class="gu-ink-fill"
          :stroke-dasharray="`${storageInfo.percentage * 2.89}, 289`" 
        />
      </svg>
      <div class="gu-ring-center">
        <div class="gu-ring-num">{{ storageInfo.percentage }}<span class="gu-ring-pct">%</span></div>
        <div class="gu-ring-label">已使用</div>
      </div>
    </div>

    <!-- 古典账本式数据呈现 -->
    <div class="gu-ledger-grid">
      <div class="gu-ledger-item">
        <span class="gu-ledger-label">已使用</span>
        <span class="gu-ledger-value">{{ formatBytes(storageInfo.usage) }}</span>
      </div>
      <div class="gu-ledger-item">
        <span class="gu-ledger-label">剩余可用</span>
        <span class="gu-ledger-value">{{ formatBytes(Math.max(0, storageInfo.quota - storageInfo.usage)) }}</span>
      </div>
      <div class="gu-ledger-item">
        <span class="gu-ledger-label">总配额</span>
        <span class="gu-ledger-value">{{ formatBytes(storageInfo.quota) }}</span>
      </div>
    </div>

    <!-- 功能列表（如书目一般） -->
    <div class="gu-feature-list">
      <!-- 深度占用明细 -->
      <div class="gu-feature-item" v-if="storageInfo.details.length > 0" @click="showBreakdownModal = true; scanAllStorageDetails()">
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
          <span class="gu-feature-dot" :class="isPersisted ? 'text-safe' : 'text-danger'">·</span>
          <div class="gu-feature-text">
            <div class="gu-feature-name">
              数据持久化保护
              <span class="gu-status-seal" :class="isPersisted ? 'safe' : 'danger'">
                {{ isPersisted ? '已护' : '裸奔' }}
              </span>
            </div>
            <div class="gu-feature-sub">防止浏览器空间不足时静默清空</div>
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

      <!-- WebDAV 云端漫游 -->
      <div class="gu-feature-item" @click="showWebDAVModal = true">
        <div class="gu-feature-left">
          <span class="gu-feature-dot" style="color: #0284c7">·</span>
          <div class="gu-feature-text">
            <div class="gu-feature-name">WebDAV 云端漫游</div>
            <div class="gu-feature-sub">跨设备自动同步与云端备份管理</div>
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

/* 极简墨圈进度 */
.gu-ink-ring-container {
  position: relative;
  width: 180px;
  height: 180px;
  margin: 0 auto 30px auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gu-ink-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.gu-ink-fill {
  transition: stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1);
}

.gu-ring-center {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.gu-ring-num {
  font-family: -apple-system, sans-serif;
  font-size: 36px;
  font-weight: bold;
  color: #1A1A1A;
  line-height: 1;
}

.gu-ring-pct {
  font-size: 16px;
  color: #999999;
  font-weight: normal;
  margin-left: 2px;
}

.gu-ring-label {
  font-family: "STSong", "SimSun", serif;
  font-size: 13px;
  color: #666666;
  letter-spacing: 2px;
}

/* 古典账本数据呈现（天地线） */
.gu-ledger-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 20px 0;
  border-top: 1px solid #E5E5E5;
  border-bottom: 1px solid #E5E5E5;
  margin-bottom: 30px;
}

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
