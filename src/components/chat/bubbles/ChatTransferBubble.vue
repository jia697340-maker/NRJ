/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  msg: any
  direction: 'left' | 'right'
  transferStyle: 'wechat' | 'ticket' | 'glass'
}>()

const emit = defineEmits<{
  (e: 'click-bubble', msgId: number): void
  (e: 'touch-start', msgId: number): void
  (e: 'touch-end'): void
  (e: 'touch-move'): void
}>()

const handleClick = () => {
  if (props.msg.transferData.status === 'pending') {
    emit('click-bubble', props.msg.id)
  }
}
</script>

<template>
  <!-- 方案1: 微信原版复刻 -->
  <div v-if="transferStyle === 'wechat'" class="wc-bubble-real" :class="[direction, { 'active': msg.transferData.status === 'pending', 'inactive': msg.transferData.status !== 'pending' }]" @touchstart="emit('touch-start', msg.id)" @touchend="emit('touch-end')" @touchmove="emit('touch-move')" @contextmenu.prevent @click="handleClick">
    <div class="wc-body-real">
      <!-- 红包图标 -->
      <div v-if="msg.transferData.type === 'red_packet'" class="wc-rp-icon" :class="{ 'inactive': msg.transferData.status !== 'pending' }">
        <div class="wc-rp-top" :class="{ 'inactive': msg.transferData.status !== 'pending' }"></div>
        <div class="wc-rp-coin" :class="{ 'inactive': msg.transferData.status !== 'pending' }"></div>
      </div>
      <!-- 转账图标 -->
      <div v-else class="wc-tf-icon" :class="{ 'active': msg.transferData.status === 'pending', 'inactive': msg.transferData.status !== 'pending' }">
        <svg v-if="msg.transferData.status === 'pending'" viewBox="0 0 24 24" stroke="currentColor" fill="none">
          <polyline points="17 8 21 8 21 12"></polyline>
          <path d="M3 8h18"></path>
          <polyline points="7 16 3 16 3 12"></polyline>
          <path d="M21 16H3"></path>
        </svg>
        <svg v-else viewBox="0 0 24 24" stroke="currentColor" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      </div>

      <div class="wc-text-group">
        <div v-if="msg.transferData.type === 'red_packet'" class="wc-title-real">{{ msg.transferData.remark || '恭喜发财，大吉大利' }}</div>
        <div v-else class="wc-title-real">¥{{ msg.transferData.amount }}</div>

        <!-- 状态小字 -->
        <div v-if="msg.transferData.type === 'transfer' && msg.transferData.status === 'pending'" class="wc-sub-real">转账给{{ direction === 'left' ? '你' : '对方' }}</div>
        <div v-if="msg.transferData.status === 'claimed'" class="wc-sub-real">{{ msg.transferData.type === 'transfer' ? '已被接收' : '已领取' }}</div>
        <div v-if="msg.transferData.status === 'rejected'" class="wc-sub-real">已退回</div>
        <div v-if="msg.transferData.status === 'expired'" class="wc-sub-real">{{ msg.transferData.type === 'transfer' ? '已退还' : '已超过24小时，红包已过期' }}</div>
      </div>
    </div>
    <div class="wc-foot-real">{{ msg.transferData.type === 'red_packet' ? '微信红包' : '微信转账' }}</div>
  </div>

  <!-- 方案3: 现代毛玻璃流体 -->
  <div v-else class="glass-card" :class="[direction, { 'disabled': msg.transferData.status !== 'pending' }]" @touchstart="emit('touch-start', msg.id)" @touchend="emit('touch-end')" @touchmove="emit('touch-move')" @contextmenu.prevent @click="handleClick">
    <div v-if="msg.transferData.status === 'pending'" class="glass-glow" :class="{ 'blue': msg.transferData.type === 'transfer' }"></div>
    <div class="glass-content">
      <div class="glass-top">
        <span class="glass-badge" :class="{ 'highlight': msg.transferData.type === 'red_packet' && msg.transferData.status === 'pending', 'blue-highlight': msg.transferData.type === 'transfer' && msg.transferData.status === 'pending' }">{{ msg.transferData.type === 'red_packet' ? 'RED PACKET' : 'TRANSFER' }}</span>
        <div class="glass-indicator" :class="{ 'pulse-green': msg.transferData.type === 'red_packet' && msg.transferData.status === 'pending', 'pulse-blue': msg.transferData.type === 'transfer' && msg.transferData.status === 'pending', 'static-gray': msg.transferData.status !== 'pending' }"></div>
      </div>
      <div class="glass-main">
        <h3 v-if="msg.transferData.type === 'transfer'" class="glass-amount">¥ {{ msg.transferData.amount }}</h3>
        <h3 v-else class="glass-title">{{ msg.transferData.remark || '恭喜发财，大吉大利' }}</h3>

        <div v-if="msg.transferData.type === 'transfer' && msg.transferData.status === 'pending'" class="glass-remark">转账给{{ direction === 'left' ? '你' : '对方' }}</div>
        <div v-if="msg.transferData.status === 'claimed'" class="glass-sub">已被接收</div>
        <div v-if="msg.transferData.status === 'rejected'" class="glass-sub">已被退回</div>
        <div v-if="msg.transferData.status === 'expired'" class="glass-sub">已过期失效</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../../app_ChatPreview.css';
</style>
