/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import ChatCallRecordsView from '../ChatCallRecordsView.vue'

const props = defineProps<{
  selectedChat: any
  myProfile: any
  getTimezoneLabel: (tz: string) => string
  matchSearch: (...keywords: (string | undefined | null)[]) => boolean
}>()

const emit = defineEmits<{
  (e: 'open-avatar-upload', target: 'me'): void
  (e: 'open-text-modal', title: string, text: string, defaultText: string, placeholder: string, target: string): void
  (e: 'open-long-text-modal', title: string, text: string, defaultText: string, placeholder: string, target: string): void
  (e: 'open-timezone-modal', target: 'user'): void
  (e: 'delete-call-records', ids: (string | number)[]): void
  (e: 'resummarize-call-record', id: string | number): void
}>()

const showCallRecordsView = ref(false)
</script>

<template>
  <div class="role-edit-section">
    <div class="user-avatar-action-box" style="margin-bottom: 24px; justify-content: center;" v-show="matchSearch('更换头像', '我')">
      <div class="role-edit-avatar-box">
        <div class="role-edit-avatar" @click="emit('open-avatar-upload', 'me')" :style="myProfile.avatarUrl ? { backgroundImage: `url(${myProfile.avatarUrl})` } : {}">
          <span v-if="!myProfile.avatarUrl">{{ myProfile.name.charAt(0) || '我' }}</span>
          <div class="avatar-edit-overlay">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#fff" stroke-width="2" fill="none"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          </div>
        </div>
        <div class="role-edit-avatar-tip">点击更换头像</div>
      </div>
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

    <div class="glass-panel" v-show="matchSearch('用户时区')">
      <div class="glass-list-item" v-show="matchSearch('用户时区')" :class="{ 'disabled-block': !selectedChat.timePerception }" @click="emit('open-timezone-modal', 'user')">
        <div class="item-label">用户时区</div>
        <div class="item-value"><span class="item-value-text">{{ getTimezoneLabel(myProfile.timezone) || '默认' }}</span><span class="arrow">></span></div>
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
</style>
