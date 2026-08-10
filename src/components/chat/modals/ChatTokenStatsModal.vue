/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { watch } from 'vue'
import { useChatTokenStats } from '../../../composables/useChatTokenStats'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const { tokenStats, isCalculating, refreshTokenStats, getTokenPercentage } = useChatTokenStats()

watch(() => props.visible, visible => {
  if (visible) refreshTokenStats()
})

const closeModal = () => {
  emit('update:visible', false)
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10000;" @click.self="closeModal">
    <div class="custom-confirm-modal token-stats-modal">
      <div class="confirm-title">上下文用量估算</div>

      <div class="token-stats-content">
        <div v-if="isCalculating && !tokenStats" class="token-stats-loading">正在计算本轮上下文…</div>
        <template v-else-if="tokenStats">
          <div class="token-total-card">
            <div class="token-total-label">预计输入 Tokens</div>
            <div class="token-total-value">{{ tokenStats.totalTokens }}</div>
            <div class="token-message-count">本轮有效 {{ tokenStats.activeMsgCount }} 条 · 当前共 {{ tokenStats.totalMsgCount }} 条</div>
          </div>

          <div class="token-category-list">
            <div v-for="item in [
              { label: '人设与系统', value: tokenStats.systemTokens, color: '#FF6B6B' },
              { label: '世界设定', value: tokenStats.worldBookTokens, color: '#339AF0' },
              { label: '长效记忆', value: tokenStats.memoryTokens, color: '#FCC419' },
              { label: '历史对话', value: tokenStats.historyTokens, color: '#51CF66' }
            ]" :key="item.label" class="token-category-item">
              <div class="token-category-heading">
                <div class="token-category-name">
                  <span class="token-color-dot" :style="{ background: item.color }"></span>
                  <span>{{ item.label }}</span>
                </div>
                <div class="token-category-value">{{ item.value }} <span>{{ getTokenPercentage(item.value, tokenStats.totalTokens) }}%</span></div>
              </div>
              <div class="token-category-track">
                <div class="token-category-fill" :style="{ width: getTokenPercentage(item.value, tokenStats.totalTokens) + '%', background: item.color }"></div>
              </div>
            </div>
          </div>

          <div class="token-stats-note">
            本地按本轮实际组装的文本请求粗略估算，不包含图片识别额外消耗，最终用量以模型平台为准。
          </div>
        </template>
      </div>

      <div class="confirm-actions">
        <div class="confirm-btn cancel token-confirm-btn" @click="closeModal">确定</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';

.token-stats-modal { width: 90%; max-width: 360px; }
.token-stats-content { padding: 16px 20px 20px; }
.token-stats-loading { min-height: 260px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); font-size: 13px; }
.token-total-card { padding: 16px; text-align: center; background: var(--sys-bg-primary); border-radius: 12px; }
.token-total-label { color: var(--text-tertiary); font-size: 12px; }
.token-total-value { margin: 4px 0; color: var(--text-primary); font-family: monospace; font-size: 30px; font-weight: 800; line-height: 1.2; }
.token-message-count { color: var(--text-secondary); font-size: 11px; }
.token-category-list { display: flex; flex-direction: column; gap: 13px; margin-top: 18px; }
.token-category-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
.token-category-name { display: flex; align-items: center; gap: 7px; color: var(--text-secondary); }
.token-color-dot { width: 9px; height: 9px; flex: 0 0 auto; border-radius: 3px; }
.token-category-value { color: var(--text-primary); font-family: monospace; font-weight: 600; }
.token-category-value span { margin-left: 3px; color: var(--text-tertiary); font-size: 11px; font-weight: normal; }
.token-category-track { height: 4px; overflow: hidden; background: rgba(0, 0, 0, 0.05); border-radius: 2px; }
.token-category-fill { height: 100%; min-width: 0; border-radius: 2px; }
.token-stats-note { margin-top: 18px; padding: 10px; color: var(--text-tertiary); background: rgba(0, 0, 0, 0.02); border-radius: 6px; font-size: 11px; line-height: 1.5; }
.token-confirm-btn { border-right: none !important; color: var(--theme-color, #1890ff) !important; font-weight: bold; }
</style>
