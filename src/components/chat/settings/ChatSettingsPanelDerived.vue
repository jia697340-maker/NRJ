/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  selectedChat: any
  tokenStats: any
  matchSearch: (...keywords: (string | undefined | null)[]) => boolean
}>()

const emit = defineEmits<{
  (e: 'show-summary-view'): void
  (e: 'show-token-stats-modal'): void
}>()
</script>

<template>
  <div class="role-edit-section">
    <div class="glass-panel" v-show="matchSearch('总结', '自动已开启', '管理总结')">
      <div class="glass-list-item" v-show="matchSearch('总结', '自动已开启', '管理总结')" @click="emit('show-summary-view')">
        <div class="item-label">总结</div>
        <div class="item-value">
          <span class="item-value-text">{{ selectedChat?.autoSummaryEnabled ? '自动已开启' : '管理总结' }}</span>
          <span class="arrow">></span>
        </div>
      </div>
    </div>
    <div class="glass-panel" v-show="matchSearch('当前聊天条数', '上下文用量统计', 'token')">
      <div class="glass-list-item" v-show="matchSearch('当前聊天条数')" style="cursor: default;">
        <div class="item-label">当前聊天条数</div>
        <div class="item-value">
          <span class="item-value-text">{{ tokenStats?.totalMsgCount || 0 }} 条</span>
        </div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('上下文用量统计', 'token')" @click="emit('show-token-stats-modal')">
        <div class="item-label">上下文用量统计</div>
        <div class="item-value">
          <span class="item-value-text">{{ tokenStats?.totalTokens || 0 }} Tokens</span>
          <span class="arrow">></span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './ChatSettingsStyles.css';
</style>
