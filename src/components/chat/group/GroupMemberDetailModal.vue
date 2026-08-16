<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GroupMemberItemViewModel, GroupUserPermissions } from '../../../types/groupManagement'
import GroupMemberBadge from './GroupMemberBadge.vue'

const props = defineProps<{
  visible: boolean
  member: GroupMemberItemViewModel | null
  permissions: GroupUserPermissions
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'promote', memberId: string): void
  (e: 'demote', memberId: string): void
  (e: 'transfer', memberId: string): void
  (e: 'mute', payload: { memberId: string; durationSeconds: number; reason: string }): void
  (e: 'unmute', memberId: string): void
  (e: 'kick', memberId: string): void
  (e: 'updateNickname', payload: { memberId: string; nickname: string }): void
}>()

const isEditingNickname = ref(false)
const newNickname = ref('')
const showMuteOptions = ref(false)
const customMuteSeconds = ref(600)
const muteReason = ref('')
const showConfirmDanger = ref(false)
const dangerActionType = ref<'transfer' | 'kick' | 'promote' | 'demote'>('kick')

const mutePresets = [
  { label: '10分钟', seconds: 600 },
  { label: '1小时', seconds: 3600 },
  { label: '1天', seconds: 86400 },
  { label: '7天', seconds: 604800 },
  { label: '30天', seconds: 2592000 }
]

const startEditNickname = () => {
  if (!props.member) return
  newNickname.value = props.member.nickname
  isEditingNickname.value = true
}

const saveNickname = () => {
  if (!props.member) return
  emit('updateNickname', { memberId: props.member.id, nickname: newNickname.value })
  isEditingNickname.value = false
}

const executeMute = (seconds: number) => {
  if (!props.member) return
  emit('mute', {
    memberId: props.member.id,
    durationSeconds: seconds,
    reason: muteReason.value.trim() || '违反群聊规则'
  })
  showMuteOptions.value = false
  muteReason.value = ''
}

const handleUnmute = () => {
  if (!props.member) return
  emit('unmute', props.member.id)
}

const triggerDangerAction = (type: 'transfer' | 'kick' | 'promote' | 'demote') => {
  dangerActionType.value = type
  showConfirmDanger.value = true
}

const confirmDangerAction = () => {
  if (!props.member) return
  if (dangerActionType.value === 'kick') emit('kick', props.member.id)
  else if (dangerActionType.value === 'transfer') emit('transfer', props.member.id)
  else if (dangerActionType.value === 'promote') emit('promote', props.member.id)
  else if (dangerActionType.value === 'demote') emit('demote', props.member.id)
  showConfirmDanger.value = false
}

const dangerConfirmTitle = computed(() => {
  if (dangerActionType.value === 'transfer') return '转让群主身份？'
  if (dangerActionType.value === 'kick') return '移出群聊？'
  if (dangerActionType.value === 'promote') return '设为管理员？'
  return '取消管理员身份？'
})

const dangerConfirmDesc = computed(() => {
  if (!props.member) return ''
  if (dangerActionType.value === 'transfer') return `确定将群主转让给 ${props.member.nickname} 吗？转让后你将变为普通成员。`
  if (dangerActionType.value === 'kick') return `确定将 ${props.member.nickname} 移出本群吗？`
  if (dangerActionType.value === 'promote') return `将 ${props.member.nickname} 设为管理员后，TA 将拥有成员禁言、公告发布等管理权限。`
  return `确定取消 ${props.member.nickname} 的管理员身份吗？`
})
</script>

<template>
  <div v-if="visible && member" class="wb-modal-overlay" @click.self="emit('close')">
    <div class="custom-confirm-modal member-detail-modal">
      <!-- 头部个人名片 -->
      <div class="member-detail-top-bar">
        <div class="member-profile-header">
          <div class="avatar-col">
            <div class="member-avatar" :style="member.avatarUrl ? { backgroundImage: `url(${member.avatarUrl})` } : {}">
              <span v-if="!member.avatarUrl">{{ member.avatarText }}</span>
            </div>
          </div>
          <div class="info-col">
            <div class="name-line">
              <span class="member-main-name">{{ member.nickname }}</span>
              <GroupMemberBadge
                :badge-type="member.badgeType"
                :level="member.level"
                :level-title="member.levelTitle"
                :role="member.role"
              />
            </div>
            <div class="sub-info-line">
              <span class="member-type-tag">{{ member.isAi ? 'AI 伴侣' : '群成员' }}</span>
              <span class="points-text">积分: {{ member.points }}</span>
            </div>
          </div>
        </div>
        <button class="modal-close-icon-btn" title="关闭" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- 等级成长进度条 -->
      <div class="level-progress-section">
        <div class="progress-info">
          <span>等级头衔：LV{{ member.level }} {{ member.levelTitle }}</span>
          <span>{{ member.pointsProgress }}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" :style="{ width: `${member.pointsProgress}%` }"></div>
        </div>
      </div>

      <!-- 禁言状态标签 -->
      <div v-if="member.isMuted" class="mute-status-banner">
        <span class="mute-title">当前处于禁言状态</span>
        <span class="mute-time">剩余：{{ member.muteRemainingText }}</span>
      </div>

      <!-- 操作列表 -->
      <div class="member-action-list scrollable-actions">
        <!-- 修改群昵称 -->
        <div class="action-item" @click="startEditNickname">
          <span class="action-label">群昵称</span>
          <div class="action-value">
            <span>{{ member.nickname }}</span>
            <span class="arrow">›</span>
          </div>
        </div>

        <!-- 设为/取消管理员 -->
        <div
          v-if="member.canBePromoted"
          class="action-item"
          @click="triggerDangerAction('promote')"
        >
          <span class="action-label">设为管理员</span>
          <span class="arrow">›</span>
        </div>
        <div
          v-if="member.canBeDemoted"
          class="action-item"
          @click="triggerDangerAction('demote')"
        >
          <span class="action-label danger-text">取消管理员</span>
          <span class="arrow">›</span>
        </div>

        <!-- 转让群主 -->
        <div
          v-if="member.canTransferTo"
          class="action-item"
          @click="triggerDangerAction('transfer')"
        >
          <span class="action-label warn-text">转让群主</span>
          <span class="arrow">›</span>
        </div>

        <!-- 禁言与解禁 -->
        <template v-if="member.canBeMuted">
          <div v-if="!member.isMuted" class="action-item" @click="showMuteOptions = true">
            <span class="action-label">设置禁言</span>
            <span class="arrow">›</span>
          </div>
          <div v-else class="action-item" @click="handleUnmute">
            <span class="action-label success-text">解除禁言</span>
            <span class="arrow">›</span>
          </div>
        </template>

        <!-- 移出群聊 -->
        <div
          v-if="member.canBeKicked"
          class="action-item danger-item"
          @click="triggerDangerAction('kick')"
        >
          <span class="action-label danger-text">移出本群</span>
          <span class="arrow">›</span>
        </div>
      </div>

      <div class="modal-bottom-actions">
        <button class="modal-primary-btn" @click="emit('close')">完成</button>
      </div>
    </div>

    <!-- 禁言时长选择弹窗 -->
    <div v-if="showMuteOptions" class="wb-modal-overlay" @click.self="showMuteOptions = false">
      <div class="custom-confirm-modal mute-options-sheet">
        <div class="confirm-title">设置禁言时长</div>
        <div class="mute-preset-list">
          <div
            v-for="preset in mutePresets"
            :key="preset.seconds"
            class="mute-preset-btn"
            @click="executeMute(preset.seconds)"
          >
            {{ preset.label }}
          </div>
        </div>
        <label class="form-item" style="margin-top: 10px;">
          <span class="item-label">禁言理由 (可选)</span>
          <input v-model="muteReason" class="form-input" placeholder="例如：发表不当内容" />
        </label>
        <div class="confirm-actions">
          <div class="confirm-btn cancel" @click="showMuteOptions = false">取消</div>
        </div>
      </div>
    </div>

    <!-- 昵称编辑弹窗 -->
    <div v-if="isEditingNickname" class="wb-modal-overlay" @click.self="isEditingNickname = false">
      <div class="custom-confirm-modal">
        <div class="confirm-title">修改群昵称</div>
        <input v-model="newNickname" class="form-input" maxlength="20" placeholder="请输入新的群昵称" style="margin: 14px 0;" />
        <div class="confirm-actions">
          <div class="confirm-btn cancel" @click="isEditingNickname = false">取消</div>
          <div class="confirm-btn" @click="saveNickname">保存</div>
        </div>
      </div>
    </div>

    <!-- 危险操作二次确认 -->
    <div v-if="showConfirmDanger" class="wb-modal-overlay" @click.self="showConfirmDanger = false">
      <div class="custom-confirm-modal">
        <div class="confirm-title">{{ dangerConfirmTitle }}</div>
        <div class="confirm-desc">{{ dangerConfirmDesc }}</div>
        <div class="confirm-actions">
          <div class="confirm-btn cancel" @click="showConfirmDanger = false">取消</div>
          <div class="confirm-btn danger" @click="confirmDangerAction">确定</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.member-detail-modal {
  max-width: 360px;
  width: 90%;
  padding: 20px;
  background: var(--sys-bg-secondary, #ffffff);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15);
}

.member-detail-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;
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
  flex-shrink: 0;
}

.modal-close-icon-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-primary, #2c3e50);
}

.modal-bottom-actions {
  display: flex;
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

.member-profile-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex: 1;
}

.member-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #dfe6e9;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
}

.info-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.member-main-name {
  font-size: 15px;
  font-weight: 700;
  color: #2c3e50;
}

.sub-info-line {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: #95a5a6;
}

.member-type-tag {
  background: #f1f2f6;
  padding: 1px 5px;
  border-radius: 3px;
  color: #57606f;
}

.level-progress-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #7f8c8d;
  margin-bottom: 6px;
}

.progress-bar-bg {
  width: 100%;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: #27ae60;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.mute-status-banner {
  background: #fff5f5;
  border: 0.5px solid rgba(231, 76, 60, 0.2);
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 11.5px;
  color: #e74c3c;
  font-weight: 600;
}

.scrollable-actions {
  max-height: 40vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.action-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 11px 12px;
  background: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-item:active {
  background: #f1f2f6;
}

.action-label {
  font-size: 13px;
  color: #2c3e50;
  font-weight: 500;
}

.action-value {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: #7f8c8d;
}

.arrow {
  color: #bdc3c7;
  font-size: 14px;
}

.danger-text { color: #e74c3c; font-weight: 600; }
.warn-text { color: #e67e22; font-weight: 600; }
.success-text { color: #27ae60; font-weight: 600; }

.mute-options-sheet {
  max-width: 340px;
  width: 88%;
  padding: 18px;
  background: #fff;
  border-radius: 16px;
}

.mute-preset-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 10px;
}

.mute-preset-btn {
  background: #f8f9fa;
  border: 0.5px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 0;
  text-align: center;
  font-size: 13px;
  color: #2c3e50;
  cursor: pointer;
}

.mute-preset-btn:active {
  background: #eafaf1;
  color: #27ae60;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  box-sizing: border-box;
}
</style>
