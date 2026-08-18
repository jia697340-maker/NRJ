/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMusicLibrary } from '../../../composables/useMusicLibrary'
import { useMusicPlayer } from '../../../composables/useMusicPlayer'
import type { MusicTrack } from '../../../types/music'

const props = defineProps<{
  visible: boolean
  defaultTab?: 'records' | 'edit'
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const {
  history,
  customTrackCount,
  customTotalMinutes,
  deleteHistoryTracks,
  clearAllHistory,
  setCustomTrackCount,
  setCustomTotalMinutes,
  setMessage
} = useMusicLibrary()

const { playTracks } = useMusicPlayer()

const activeTab = ref<'records' | 'edit'>('records')
const isSelectionMode = ref(false)
const selectedTrackIds = ref<string[]>([])
const showClearConfirm = ref(false)

const trackCountInput = ref<string>('')
const totalMinutesInput = ref<string>('')

// 实际物理计算统计
const actualTrackCount = computed(() => history.value.length)
const actualTotalMinutes = computed(() =>
  Math.round(history.value.reduce((sum, item) => sum + (item.duration || 0) * (item.playCount || 1), 0) / 60)
)

// 同步编辑表单数据
watch(
  () => props.visible,
  (val) => {
    if (val) {
      if (props.defaultTab) activeTab.value = props.defaultTab
      isSelectionMode.value = false
      selectedTrackIds.value = []
      showClearConfirm.value = false
      trackCountInput.value = customTrackCount.value !== null ? String(customTrackCount.value) : ''
      totalMinutesInput.value = customTotalMinutes.value !== null ? String(customTotalMinutes.value) : ''
    }
  },
  { immediate: true }
)

const isAllSelected = computed(() => {
  if (!history.value.length) return false
  return selectedTrackIds.value.length === history.value.length
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedTrackIds.value = []
  } else {
    selectedTrackIds.value = history.value.map(t => t.id)
  }
}

const toggleSelectTrack = (id: string) => {
  if (selectedTrackIds.value.includes(id)) {
    selectedTrackIds.value = selectedTrackIds.value.filter(i => i !== id)
  } else {
    selectedTrackIds.value.push(id)
  }
}

const handleTrackClick = (track: MusicTrack) => {
  if (isSelectionMode.value) {
    toggleSelectTrack(track.id)
  } else {
    void playTracks([track])
  }
}

const handleDeleteSelected = () => {
  if (!selectedTrackIds.value.length) return
  deleteHistoryTracks(selectedTrackIds.value)
  selectedTrackIds.value = []
}

const handleConfirmClearAll = () => {
  clearAllHistory()
  showClearConfirm.value = false
  selectedTrackIds.value = []
  isSelectionMode.value = false
}

const handleSaveCustomStats = () => {
  const parsedCount = trackCountInput.value.trim() === '' ? null : Math.max(0, parseInt(trackCountInput.value.trim(), 10) || 0)
  const parsedMinutes = totalMinutesInput.value.trim() === '' ? null : Math.max(0, parseInt(totalMinutesInput.value.trim(), 10) || 0)

  setCustomTrackCount(parsedCount)
  setCustomTotalMinutes(parsedMinutes)
  setMessage('歌曲记录与统计设置已保存')
  emit('close')
}

const handleResetTrackCount = () => {
  trackCountInput.value = ''
  setCustomTrackCount(null)
  setMessage('第几首已重置为实际数量')
}

const handleResetTotalMinutes = () => {
  totalMinutesInput.value = ''
  setCustomTotalMinutes(null)
  setMessage('分钟数已重置为实际计算')
}
</script>

<template>
  <div v-if="visible" class="history-mask" @click="emit('close')">
    <section class="history-sheet" @click.stop>
      <!-- 头部导航与操作 -->
      <header class="history-header">
        <div class="header-left">
          <div class="history-title">歌曲记录与统计</div>
          <div class="history-subtitle">管理历史播放、多选删除及自定义数据</div>
        </div>
        <button class="history-close-btn" @click="emit('close')">×</button>
      </header>

      <!-- 顶部标签切换 -->
      <div class="tab-pill-bar">
        <button
          class="tab-pill-btn"
          :class="{ active: activeTab === 'records' }"
          @click="activeTab = 'records'"
        >
          歌曲记录 ({{ history.length }})
        </button>
        <button
          class="tab-pill-btn"
          :class="{ active: activeTab === 'edit' }"
          @click="activeTab = 'edit'"
        >
          自定义统计 / 重置
        </button>
      </div>

      <!-- 歌曲记录 Tab -->
      <div v-if="activeTab === 'records'" class="history-tab-content">
        <!-- 记录工具栏 -->
        <div class="history-action-bar">
          <div class="bar-left">
            <button
              class="sub-action-btn"
              @click="isSelectionMode = !isSelectionMode; selectedTrackIds = []"
            >
              {{ isSelectionMode ? '退出多选' : '批量管理' }}
            </button>
            <button
              v-if="isSelectionMode && history.length"
              class="sub-action-btn"
              @click="toggleSelectAll"
            >
              {{ isAllSelected ? '取消全选' : '全选' }}
            </button>
          </div>

          <div class="bar-right">
            <button
              v-if="isSelectionMode && selectedTrackIds.length"
              class="sub-action-btn danger"
              @click="handleDeleteSelected"
            >
              删除所选 ({{ selectedTrackIds.length }})
            </button>
            <button
              v-else-if="history.length"
              class="sub-action-btn text-danger"
              @click="showClearConfirm = true"
            >
              清空记录
            </button>
          </div>
        </div>

        <!-- 历史列表 -->
        <div class="history-list-view">
          <div v-if="!history.length" class="empty-state">
            <div class="empty-icon">🎵</div>
            <p>暂无播放历史记录</p>
          </div>

          <div
            v-for="(track, index) in history"
            :key="track.id"
            class="history-track-card"
            :class="{ selected: selectedTrackIds.includes(track.id) }"
            @click="handleTrackClick(track)"
          >
            <!-- 多选勾选框 -->
            <div v-if="isSelectionMode" class="select-checkbox" @click.stop="toggleSelectTrack(track.id)">
              <div class="custom-chk" :class="{ checked: selectedTrackIds.includes(track.id) }">
                <span v-if="selectedTrackIds.includes(track.id)">✓</span>
              </div>
            </div>

            <span v-else class="track-seq">{{ index + 1 }}</span>

            <div class="track-info">
              <div class="track-title">{{ track.title }}</div>
              <div class="track-meta">{{ track.artist }} · 播放 {{ track.playCount || 1 }} 次</div>
            </div>

            <div v-if="!isSelectionMode" class="track-play-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <polygon points="6 3 20 12 6 21 6 3"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- 自定义统计 / 重置 Tab -->
      <div v-else class="history-tab-content edit-tab-content">
        <div class="edit-card">
          <div class="edit-card-header">
            <strong>歌曲首数</strong>
            <small>当前实际历史记录为 {{ actualTrackCount }} 首</small>
          </div>
          <div class="input-row">
            <input
              v-model="trackCountInput"
              type="number"
              class="stat-input"
              placeholder="留空则按实际数量显示"
            />
            <button class="reset-btn" @click="handleResetTrackCount">重置为实际</button>
          </div>
          <div class="input-hint">可随意编写第几首展示的数字。点击“重置为实际”可清除自定义并恢复真实数据。</div>
        </div>

        <div class="edit-card">
          <div class="edit-card-header">
            <strong>累计听歌分钟数</strong>
            <small>当前实际播放计算为 {{ actualTotalMinutes }} 分钟</small>
          </div>
          <div class="input-row">
            <input
              v-model="totalMinutesInput"
              type="number"
              class="stat-input"
              placeholder="留空则按实际时长计算"
            />
            <button class="reset-btn" @click="handleResetTotalMinutes">重置为实际</button>
          </div>
          <div class="input-hint">可随意编写听歌分钟数。点击“重置为实际”可恢复实际累计计算。</div>
        </div>

        <div class="save-btn-row">
          <button class="save-custom-btn" @click="handleSaveCustomStats">保存更改</button>
        </div>
      </div>

      <!-- 清空确认弹窗 -->
      <div v-if="showClearConfirm" class="confirm-dialog-overlay" @click.stop>
        <div class="confirm-box">
          <div class="confirm-title">确认清空记录？</div>
          <div class="confirm-desc">这将清除全部歌曲播放历史，此操作无法恢复。</div>
          <div class="confirm-actions">
            <button class="btn-cancel" @click="showClearConfirm = false">取消</button>
            <button class="btn-danger" @click="handleConfirmClearAll">确认清空</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.history-mask {
  position: absolute;
  inset: 0;
  z-index: 85;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
}

.history-sheet {
  width: 100%;
  max-height: 82%;
  min-height: 55%;
  border: 1px solid var(--music-card-border);
  border-radius: 20px 20px 0 0;
  background: var(--music-card-bg);
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 12px;
  border-bottom: 1px solid var(--music-divider);
}

.history-title {
  font-size: 17px;
  font-weight: 750;
  color: var(--music-text);
}

.history-subtitle {
  margin-top: 3px;
  color: var(--music-text-sub);
  font-size: 11px;
}

.history-close-btn {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: var(--music-pill-bg);
  color: var(--music-text);
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.tab-pill-bar {
  display: flex;
  gap: 8px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--music-divider);
}

.tab-pill-btn {
  flex: 1;
  padding: 7px 0;
  border: 1px solid var(--music-card-border);
  border-radius: 20px;
  background: var(--music-secondary-bg);
  color: var(--music-text-sub);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-pill-btn.active {
  background: var(--music-text);
  color: var(--music-bg);
  border-color: var(--music-text);
}

.history-tab-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 12px 20px calc(24px + env(safe-area-inset-bottom));
}

.history-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.bar-left, .bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sub-action-btn {
  padding: 5px 12px;
  border: 1px solid var(--music-card-border);
  border-radius: 8px;
  background: var(--music-secondary-bg);
  color: var(--music-text);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.sub-action-btn.danger {
  background: #ef4444;
  color: #ffffff;
  border-color: #ef4444;
}

.sub-action-btn.text-danger {
  color: #ef4444;
}

.sub-action-btn:active {
  opacity: 0.8;
}

.history-list-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: var(--music-text-sub);
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.history-track-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--music-card-border);
  border-radius: 12px;
  background: var(--music-secondary-bg);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.history-track-card.selected {
  border-color: var(--music-text);
  background: var(--music-pill-bg);
}

.select-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-chk {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 1.5px solid var(--music-text-sub);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
  background: transparent;
  transition: all 0.2s;
}

.custom-chk.checked {
  background: var(--music-text);
  border-color: var(--music-text);
  color: var(--music-bg);
}

.track-seq {
  font-size: 13px;
  font-weight: 600;
  color: var(--music-text-sub);
  width: 20px;
  text-align: center;
}

.track-info {
  flex: 1;
  min-width: 0;
}

.track-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--music-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.track-meta {
  font-size: 11px;
  color: var(--music-text-sub);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-play-btn {
  color: var(--music-text-sub);
  display: flex;
  align-items: center;
}

.edit-tab-content {
  gap: 16px;
}

.edit-card {
  padding: 14px;
  border: 1px solid var(--music-card-border);
  border-radius: 14px;
  background: var(--music-secondary-bg);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.edit-card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.edit-card-header strong {
  font-size: 14px;
  color: var(--music-text);
}

.edit-card-header small {
  font-size: 11px;
  color: var(--music-text-sub);
}

.input-row {
  display: flex;
  gap: 8px;
}

.stat-input {
  flex: 1;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--music-card-border);
  border-radius: 10px;
  background: var(--music-card-bg);
  color: var(--music-text);
  font-size: 14px;
  outline: none;
}

.reset-btn {
  padding: 0 14px;
  border: 1px solid var(--music-card-border);
  border-radius: 10px;
  background: var(--music-card-bg);
  color: var(--music-text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.input-hint {
  font-size: 11px;
  color: var(--music-text-sub);
  line-height: 1.5;
}

.save-btn-row {
  margin-top: 8px;
}

.save-custom-btn {
  width: 100%;
  height: 42px;
  border: none;
  border-radius: 12px;
  background: var(--music-text);
  color: var(--music-bg);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}

.save-custom-btn:active {
  opacity: 0.85;
}

.confirm-dialog-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.confirm-box {
  background: var(--music-card-bg);
  border: 1px solid var(--music-card-border);
  border-radius: 16px;
  padding: 20px;
  width: 100%;
  max-width: 300px;
  text-align: center;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
}

.confirm-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--music-text);
  margin-bottom: 8px;
}

.confirm-desc {
  font-size: 12px;
  color: var(--music-text-sub);
  margin-bottom: 18px;
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: 10px;
}

.btn-cancel, .btn-danger {
  flex: 1;
  height: 36px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-cancel {
  border: 1px solid var(--music-card-border);
  background: var(--music-secondary-bg);
  color: var(--music-text);
}

.btn-danger {
  border: none;
  background: #ef4444;
  color: #ffffff;
}
</style>
