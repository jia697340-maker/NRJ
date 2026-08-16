<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { ref } from 'vue'
import type {
  GroupLevelTitleConfig,
  GroupAdminLog,
  GroupAiManagementMode,
  GroupUserPermissions
} from '../../../types/groupManagement'

const props = defineProps<{
  visible: boolean
  isWholeGroupMuted: boolean
  aiMode: GroupAiManagementMode
  levelTitles: GroupLevelTitleConfig[]
  logs: GroupAdminLog[]
  permissions: GroupUserPermissions
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'toggleWholeMute', enabled: boolean): void
  (e: 'changeAiMode', mode: GroupAiManagementMode): void
  (e: 'saveLevelTitles', titles: GroupLevelTitleConfig[]): void
  (e: 'refreshLogs'): void
  (e: 'deleteLogs', logIds: string[]): void
  (e: 'recoverOwnership'): void
}>()

const currentTab = ref<'settings' | 'titles' | 'logs'>('settings')
const showRecoverConfirm = ref(false)

// 管理日志多选状态
const isLogSelectMode = ref(false)
const selectedLogIds = ref<string[]>([])
const showDeleteLogsConfirm = ref(false)

const toggleLogSelectMode = () => {
  isLogSelectMode.value = !isLogSelectMode.value
  selectedLogIds.value = []
}

const toggleSelectLog = (id: string) => {
  if (!isLogSelectMode.value) return
  const index = selectedLogIds.value.indexOf(id)
  if (index > -1) {
    selectedLogIds.value.splice(index, 1)
  } else {
    selectedLogIds.value.push(id)
  }
}

const toggleSelectAllLogs = () => {
  if (selectedLogIds.value.length === props.logs.length) {
    selectedLogIds.value = []
  } else {
    selectedLogIds.value = props.logs.map(log => log.id)
  }
}

const triggerDeleteLogs = () => {
  if (selectedLogIds.value.length === 0) return
  showDeleteLogsConfirm.value = true
}

const confirmDeleteLogs = () => {
  emit('deleteLogs', [...selectedLogIds.value])
  selectedLogIds.value = []
  isLogSelectMode.value = false
  showDeleteLogsConfirm.value = false
}

// 本地头衔编辑状态
const editingTitles = ref<GroupLevelTitleConfig[]>(JSON.parse(JSON.stringify(props.levelTitles)))

const aiModes: { key: GroupAiManagementMode; label: string; desc: string }[] = [
  { key: 'off', label: '关闭', desc: 'AI仅作为普通成员发言，不执行任何管理职能' },
  { key: 'remind_only', label: '温和提醒', desc: '当出现违规发言时，AI进行友善的群规提醒' },
  { key: 'semi_auto', label: '半自动管理', desc: 'AI识别违规后生成处置建议，由群主/管理员二次确认' },
  { key: 'full_auto', label: '全自主智能管家', desc: 'AI管理员根据群聊氛围与规则自主执行禁言与提醒' }
]

const formatDate = (timestamp: number) => {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const saveTitles = () => {
  emit('saveLevelTitles', editingTitles.value)
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay admin-management-overlay" @click.self="emit('close')">
    <div class="custom-confirm-modal admin-management-modal">
      <div class="modal-top-bar">
        <div class="modal-title">群管理中心</div>
        <button class="modal-close-icon-btn" title="关闭" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- 顶部切换 Tab -->
      <div class="admin-tabs">
        <div
          class="tab-btn"
          :class="{ active: currentTab === 'settings' }"
          @click="currentTab = 'settings'"
        >
          群管设置
        </div>
        <div
          class="tab-btn"
          :class="{ active: currentTab === 'titles' }"
          @click="currentTab = 'titles'"
        >
          六级头衔
        </div>
        <div
          class="tab-btn"
          :class="{ active: currentTab === 'logs' }"
          @click="currentTab = 'logs'; emit('refreshLogs')"
        >
          管理日志
        </div>
      </div>

      <!-- Tab 1: 核心群管设置 -->
      <div v-if="currentTab === 'settings'" class="tab-panel-body scrollable-panel">
        <div class="setting-group">
          <div class="setting-row">
            <div>
              <div class="setting-label">全员禁言</div>
              <div class="setting-desc">开启后仅群主和管理员可以发言</div>
            </div>
            <label class="switch">
              <input
                :checked="isWholeGroupMuted"
                type="checkbox"
                :disabled="!permissions.canSetWholeGroupMute"
                @change="emit('toggleWholeMute', !isWholeGroupMuted)"
              />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div v-if="!permissions.isOwner" class="setting-group">
          <div class="setting-row">
            <div>
              <div class="setting-label">恢复群控制权</div>
              <div class="setting-desc">脱离群内剧情权限，重新将当前用户设为群主</div>
            </div>
            <div class="confirm-btn danger" @click="showRecoverConfirm = true">恢复</div>
          </div>
        </div>

        <div class="setting-group">
          <div class="group-title">AI 管理员模式</div>
          <div class="ai-mode-list">
            <div
              v-for="item in aiModes"
              :key="item.key"
              class="ai-mode-card"
              :class="{ active: aiMode === item.key }"
              @click="permissions.canSetAiManagement && emit('changeAiMode', item.key)"
            >
              <div class="mode-header">
                <span class="mode-name">{{ item.label }}</span>
                <span class="mode-radio" :class="{ selected: aiMode === item.key }"></span>
              </div>
              <div class="mode-desc">{{ item.desc }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 2: 六级头衔编辑 -->
      <div v-else-if="currentTab === 'titles'" class="tab-panel-body scrollable-panel">
        <div class="group-title">配置本群成员 1~6 级专属头衔</div>
        <div class="titles-edit-list">
          <div v-for="title in editingTitles" :key="title.level" class="title-edit-row">
            <span class="level-label">LV{{ title.level }}</span>
            <input
              v-model="title.name"
              class="title-name-input"
              maxlength="10"
              placeholder="头衔名称"
            />
            <div class="points-threshold">
              <span class="pts-text">需积分:</span>
              <input
                v-model.number="title.minPoints"
                type="number"
                class="points-input"
                min="0"
                step="50"
              />
            </div>
          </div>
        </div>
        <button
          v-if="permissions.canEditLevelTitles"
          class="save-titles-btn"
          @click="saveTitles"
        >
          保存头衔配置
        </button>
      </div>

      <!-- Tab 3: 管理日志 -->
      <div v-else class="tab-panel-body scrollable-panel">
        <div v-if="logs.length" class="logs-container">
          <div class="logs-toolbar">
            <div class="logs-toolbar-left">
              <template v-if="isLogSelectMode">
                <div class="select-all-box" @click="toggleSelectAllLogs">
                  <div class="log-checkbox" :class="{ checked: selectedLogIds.length > 0 && selectedLogIds.length === logs.length }">
                    <svg v-if="selectedLogIds.length > 0 && selectedLogIds.length === logs.length" viewBox="0 0 24 24" width="12" height="12" stroke="#fff" stroke-width="3" fill="none">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <span class="toolbar-text">全选</span>
                </div>
                <span class="selected-count-text">已选 {{ selectedLogIds.length }}/{{ logs.length }}</span>
              </template>
              <template v-else>
                <span class="logs-count-tip">共 {{ logs.length }} 条管理日志</span>
              </template>
            </div>
            <button class="logs-batch-btn" @click="toggleLogSelectMode">
              {{ isLogSelectMode ? '取消' : '批量管理' }}
            </button>
          </div>

          <div class="logs-list">
            <div
              v-for="log in logs"
              :key="log.id"
              class="log-card"
              :class="{ 'selectable-card': isLogSelectMode, 'is-selected': selectedLogIds.includes(log.id) }"
              @click="toggleSelectLog(log.id)"
            >
              <div v-if="isLogSelectMode" class="log-select-checkbox-wrapper">
                <div class="log-checkbox" :class="{ checked: selectedLogIds.includes(log.id) }">
                  <svg v-if="selectedLogIds.includes(log.id)" viewBox="0 0 24 24" width="12" height="12" stroke="#fff" stroke-width="3" fill="none">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>
              <div class="log-card-content">
                <div class="log-header">
                  <span class="log-op">{{ log.operatorName }}</span>
                  <span class="log-time">{{ formatDate(log.createdAt) }}</span>
                </div>
                <div class="log-detail">{{ log.detail }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-logs">
          <span>暂无管理操作日志</span>
        </div>
      </div>

      <div class="modal-bottom-actions">
        <template v-if="currentTab === 'logs' && isLogSelectMode">
          <button class="modal-secondary-btn" @click="toggleLogSelectMode">取消</button>
          <button
            class="modal-danger-btn"
            :disabled="selectedLogIds.length === 0"
            @click="triggerDeleteLogs"
          >
            删除 {{ selectedLogIds.length > 0 ? `(${selectedLogIds.length})` : '' }}
          </button>
        </template>
        <template v-else>
          <button class="modal-primary-btn" @click="emit('close')">完成</button>
        </template>
      </div>
    </div>
    <div v-if="showRecoverConfirm" class="wb-modal-overlay admin-nested-overlay" @click.self="showRecoverConfirm = false">
      <div class="custom-confirm-modal admin-confirm-modal">
        <div class="confirm-title">恢复群控制权？</div>
        <div class="confirm-desc">这是一项剧情外恢复操作。当前用户会重新成为群主，原群主调整为管理员。</div>
        <div class="confirm-actions"><div class="confirm-btn cancel" @click="showRecoverConfirm = false">取消</div><div class="confirm-btn danger" @click="emit('recoverOwnership'); showRecoverConfirm = false">恢复</div></div>
      </div>
    </div>
    <div v-if="showDeleteLogsConfirm" class="wb-modal-overlay admin-nested-overlay" @click.self="showDeleteLogsConfirm = false">
      <div class="custom-confirm-modal admin-confirm-modal">
        <div class="confirm-title">删除管理日志？</div>
        <div class="confirm-desc">确定要删除选中的 {{ selectedLogIds.length }} 条管理日志吗？删除后不可恢复。</div>
        <div class="confirm-actions">
          <div class="confirm-btn cancel" @click="showDeleteLogsConfirm = false">取消</div>
          <div class="confirm-btn danger" @click="confirmDeleteLogs">确认删除</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-management-overlay,
.admin-nested-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.admin-management-overlay {
  z-index: 10000;
}

.admin-nested-overlay {
  z-index: 10001;
}

.admin-confirm-modal {
  width: 80%;
  max-width: 320px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--sys-bg-secondary, #ffffff);
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
}

.admin-confirm-modal .confirm-title {
  margin-top: 24px;
  color: var(--text-primary, #2c3e50);
  font-size: 17px;
  font-weight: 600;
  text-align: center;
}

.admin-confirm-modal .confirm-desc {
  padding: 12px 24px 20px;
  color: var(--text-secondary, #636e72);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

.admin-confirm-modal .confirm-actions {
  display: flex;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
}

.admin-confirm-modal .confirm-btn {
  flex: 1;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  cursor: pointer;
  user-select: none;
}

.admin-confirm-modal .confirm-btn:active {
  background: var(--sys-bg-primary, #f5f6f7);
}

.admin-confirm-modal .confirm-btn.cancel {
  color: var(--text-primary, #2c3e50);
  border-right: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
}

.admin-confirm-modal .confirm-btn.danger {
  color: #ff4d4f;
  font-weight: 600;
}

.admin-management-modal {
  max-width: 380px;
  width: 92%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  padding: 18px;
  background: var(--sys-bg-secondary, #ffffff);
  border-radius: 16px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15);
}

.modal-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #2c3e50);
}

.modal-close-icon-btn {
  background: transparent;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary, #95a5a6);
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.modal-close-icon-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-primary, #2c3e50);
}

.modal-bottom-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.modal-primary-btn {
  width: 100%;
  height: 40px;
  background: var(--text-primary, #2c3e50);
  color: var(--sys-bg-primary, #ffffff);
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s, transform 0.1s;
}

.modal-primary-btn:active {
  opacity: 0.85;
  transform: scale(0.99);
}

.modal-secondary-btn {
  flex: 1;
  height: 40px;
  background: #f1f2f6;
  color: #2c3e50;
  border: 1px solid #dcdde1;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}

.modal-danger-btn {
  flex: 2;
  height: 40px;
  background: #e74c3c;
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s, transform 0.1s;
}

.modal-danger-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.modal-danger-btn:not(:disabled):active {
  opacity: 0.85;
  transform: scale(0.99);
}

.admin-tabs {
  display: flex;
  background: #f1f2f6;
  border-radius: 8px;
  padding: 3px;
  margin: 10px 0 14px 0;
}

.tab-btn {
  flex: 1;
  text-align: center;
  font-size: 12.5px;
  padding: 7px 0;
  color: #7f8c8d;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.tab-btn.active {
  background: #ffffff;
  color: #2c3e50;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.scrollable-panel {
  flex: 1;
  overflow-y: auto;
  max-height: 48vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 2px;
}

.setting-group {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 12px;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.setting-label {
  font-size: 13.5px;
  font-weight: 600;
  color: #2c3e50;
}

.setting-desc {
  font-size: 11px;
  color: #95a5a6;
  margin-top: 2px;
}

.group-title {
  font-size: 12.5px;
  font-weight: 600;
  color: #34495e;
  margin-bottom: 8px;
}

.ai-mode-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-mode-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-mode-card.active {
  border-color: #27ae60;
  background: #fdfefe;
}

.mode-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.mode-name {
  font-size: 13px;
  font-weight: 600;
  color: #2c3e50;
}

.mode-radio {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid #bdc3c7;
  position: relative;
}

.mode-radio.selected {
  border-color: #27ae60;
  background: #27ae60;
}

.mode-radio.selected::after {
  content: '';
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #fff;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.mode-desc {
  font-size: 11px;
  color: #7f8c8d;
  line-height: 1.4;
}

.titles-edit-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title-edit-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8f9fa;
  padding: 6px 10px;
  border-radius: 8px;
}

.level-label {
  font-size: 12px;
  font-weight: 700;
  color: #27ae60;
  width: 32px;
}

.title-name-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12.5px;
  outline: none;
}

.points-threshold {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pts-text {
  font-size: 10.5px;
  color: #95a5a6;
}

.points-input {
  width: 55px;
  padding: 5px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  outline: none;
}

.save-titles-btn {
  background: #27ae60;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 9px 0;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
}

.logs-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.logs-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 4px 6px 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.logs-toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.select-all-box {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.toolbar-text {
  font-size: 12.5px;
  color: #2c3e50;
  font-weight: 500;
}

.selected-count-text {
  font-size: 11.5px;
  color: #7f8c8d;
}

.logs-count-tip {
  font-size: 12px;
  color: #95a5a6;
}

.logs-batch-btn {
  background: transparent;
  border: 1px solid #dcdde1;
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 12px;
  color: #2c3e50;
  cursor: pointer;
  transition: all 0.2s;
}

.logs-batch-btn:hover {
  background: #f1f2f6;
  border-color: #bdc3c7;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.log-card.selectable-card {
  cursor: pointer;
}

.log-card.selectable-card:hover {
  background: #f1f2f6;
}

.log-card.selectable-card.is-selected {
  background: #f0f9f4;
  border-color: #27ae60;
}

.log-select-checkbox-wrapper {
  display: flex;
  align-items: center;
  padding-top: 2px;
}

.log-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid #bdc3c7;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  transition: all 0.2s;
}

.log-checkbox.checked {
  background: #27ae60;
  border-color: #27ae60;
}

.log-card-content {
  flex: 1;
  min-width: 0;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.log-op {
  font-size: 12.5px;
  font-weight: 600;
  color: #2c3e50;
}

.log-time {
  font-size: 10.5px;
  color: #95a5a6;
}

.log-detail {
  font-size: 12px;
  color: #636e72;
  line-height: 1.4;
}

.empty-logs {
  padding: 30px 0;
  text-align: center;
  font-size: 13px;
  color: #95a5a6;
}

/* Switch 开关样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 42px;
  height: 24px;
}
.switch input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #e2e8f0;
  transition: .3s;
  border-radius: 24px;
}
.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}
input:checked + .slider { background-color: #27ae60; }
input:checked + .slider:before { transform: translateX(18px); }
</style>
