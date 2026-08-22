/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import ChatCallRecordsView from '../ChatCallRecordsView.vue'
import { getIdentityClockLabel } from '../../../services/conversationTime'

const props = defineProps<{
  selectedChat: any
  myProfile: any
  userCurrentTime: string
  getTimezoneLabel: (tz: string) => string
  matchSearch: (...keywords: (string | undefined | null)[]) => boolean
}>()

const emit = defineEmits<{
  (e: 'open-avatar-upload', target: 'me'): void
  (e: 'open-text-modal', title: string, text: string, defaultText: string, placeholder: string, target: string): void
  (e: 'open-long-text-modal', title: string, text: string, defaultText: string, placeholder: string, target: string): void
  (e: 'open-timezone-modal', target: 'user'): void
  (e: 'open-persona-select'): void
  (e: 'use-account-persona'): void
  (e: 'create-user-persona'): void
  (e: 'delete-call-records', ids: (string | number)[]): void
  (e: 'resummarize-call-record', id: string | number): void
  (e: 'show-identity-profile-modal', target: 'user'): void
}>()

const showCallRecordsView = ref(false)
</script>

<template>
  <div class="role-edit-section">
    <div class="user-avatar-action-box" style="margin-bottom: 24px;" v-show="matchSearch('当前时间', '人设库', '账号人设', '新建人设', '更换头像', '我')">
      <div class="action-column">
        <div class="action-btn" @click="emit('open-timezone-modal', 'user')">
          <span class="action-time-label">当前时间</span>
          <span class="action-time-value">{{ userCurrentTime }}</span>
        </div>
        <div class="action-btn" @click="emit('use-account-persona')">账号人设</div>
      </div>

      <div class="role-edit-avatar-box">
        <div class="role-edit-avatar" @click="emit('open-avatar-upload', 'me')" :style="myProfile.avatarUrl ? { backgroundImage: `url(${myProfile.avatarUrl})` } : {}">
          <span v-if="!myProfile.avatarUrl">{{ myProfile.name.charAt(0) || '我' }}</span>
          <div class="avatar-edit-overlay">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#fff" stroke-width="2" fill="none"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          </div>
        </div>
        <div class="role-edit-avatar-tip">点击更换头像</div>
      </div>

      <div class="action-column">
        <div class="action-btn" @click="emit('open-persona-select')">人设库选择</div>
        <div class="action-btn" @click="emit('create-user-persona')">新建人设</div>
      </div>
    </div>

    <div class="profile-source-hint">
      当前使用：{{ selectedChat?.userProfileSource?.name || '账号人设（自动跟随）' }}
      <span v-if="selectedChat?.userProfileSource?.hasLocalChanges">（当前聊天已修改）</span>
      <small>更换这里只会调整当前关系里的展示身份，不会清除聊天与记忆；若要完全重新认识，请创建“全新人设身份”账号。</small>
    </div>

    <div class="glass-panel" v-show="matchSearch('真名', '备注', '用户人设')">
      <div class="glass-list-item" v-show="matchSearch('真名')" @click="emit('open-text-modal', '编辑真名', myProfile.name, '', '请输入真名', 'myRealName')">
        <div class="item-label">真名</div>
        <div class="item-value"><span class="item-value-text">{{ myProfile.name || '未设置' }}</span><span class="arrow">></span></div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('备注')" @click="emit('open-text-modal', '编辑备注', myProfile.remark, '', '请输入备注', 'myRemark')">
        <div class="item-label">备注</div>
        <div class="item-value"><span class="item-value-text">{{ myProfile.remark || '未设置' }}</span><span class="arrow">></span></div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('用户人设')" @click="emit('open-long-text-modal', '编辑用户人设', myProfile.persona, '', '请详细描述用户的性格、背景、身份等设定...', 'myPersona')">
        <div class="item-label">用户人设</div>
        <div class="item-value"><span class="item-value-text">{{ myProfile.persona || '未设置' }}</span><span class="arrow">></span></div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('用户时间', '用户时区', '自定义时间')">
      <div class="glass-list-item" v-show="matchSearch('用户时间', '用户时区', '自定义时间')" :class="{ 'disabled-block': !selectedChat.timePerception }" @click="emit('open-timezone-modal', 'user')">
        <div class="item-label">我的独立时间</div>
        <div class="item-value"><span class="item-value-text">{{ getIdentityClockLabel(myProfile) }}</span><span class="arrow">></span></div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('我的固定形象', '用户形象', '合照', '情侣照')">
      <div class="glass-list-item" @click="emit('show-identity-profile-modal', 'user')">
        <div class="item-label">我的固定形象</div>
        <div class="item-value"><span class="item-value-text">用于合照、情侣照与约会画面</span><span class="arrow">></span></div>
      </div>
    </div>

    <!-- 通话总结记录入口 -->
    <div class="glass-panel" v-show="matchSearch('通话记录', '通话总结')">
      <div class="glass-list-item" @click="showCallRecordsView = true">
        <div class="item-label" style="display: flex; align-items: center; gap: 8px;">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          历史通话记录
        </div>
        <div class="item-value">
          <span class="item-value-text" style="color: var(--text-secondary); font-size: 13px;">共 {{ selectedChat.callSummaries?.length || 0 }} 条</span>
          <span class="arrow">></span>
        </div>
      </div>
    </div>

    <!-- 通话总结记录列表全屏视图 -->
    <transition name="fade">
      <ChatCallRecordsView 
        v-if="showCallRecordsView" 
        :records="selectedChat.callSummaries || []" 
        @close="showCallRecordsView = false" 
        @delete="ids => emit('delete-call-records', ids)"
        @resummarize="id => emit('resummarize-call-record', id)"
      />
    </transition>
  </div>
</template>

<style scoped>
@import './ChatSettingsStyles.css';

.user-avatar-action-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  width: 100%;
}

.action-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-btn {
  width: 80px;
  padding: 8px 0;
  border: 1px solid var(--border-color, #eee);
  border-radius: 16px;
  background: var(--sys-bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  cursor: pointer;
}

.role-edit-section {
  display: flex;
  width: 100%;
  margin-top: 24px;
  flex-direction: column;
  gap: 24px;
}

.role-edit-avatar-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.role-edit-avatar {
  position: relative;
  display: flex;
  width: 80px;
  height: 80px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  background: var(--sys-bg-primary);
  background-position: center;
  background-size: cover;
  color: var(--text-secondary);
  font-size: 28px;
  cursor: pointer;
}

.avatar-edit-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
}

.role-edit-avatar:hover .avatar-edit-overlay {
  opacity: 1;
}

.role-edit-avatar-tip {
  color: var(--text-tertiary);
  font-size: 12px;
}

.action-time-label {
  display: block;
  margin-bottom: 2px;
  font-size: 11px;
  opacity: 0.8;
}

.action-time-value {
  font-family: monospace;
  font-size: 15px;
}

.profile-source-hint {
  margin: -12px 4px 0;
  color: var(--text-tertiary);
  font-size: 12px;
  text-align: center;
}
.profile-source-hint small{display:block;max-width:430px;margin:6px auto 0;font-size:10px;line-height:1.55}
</style>
