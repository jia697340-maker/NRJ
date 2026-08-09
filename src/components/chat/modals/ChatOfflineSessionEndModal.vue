/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { OfflineCarryoverMode } from '../../../services/offlineSessions'

const props = defineProps<{
  visible: boolean
  messageCount: number
  isProcessing: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', value: { carryoverMode: OfflineCarryoverMode; recentMessageCount: number; summaryInstruction: string }): void
}>()

const carryoverMode = ref<OfflineCarryoverMode>('summary')
const recentMessageCount = ref(6)
const summaryInstruction = ref('')

watch(() => props.visible, visible => {
  if (!visible) return
  carryoverMode.value = 'summary'
  recentMessageCount.value = 6
  summaryInstruction.value = ''
})

const close = () => {
  if (!props.isProcessing) emit('close')
}

const confirm = () => {
  if (props.isProcessing) return
  emit('confirm', {
    carryoverMode: carryoverMode.value,
    recentMessageCount: recentMessageCount.value,
    summaryInstruction: summaryInstruction.value
  })
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay offline-session-overlay" @click.self="close">
    <div class="custom-confirm-modal offline-session-modal" @click.stop>
      <div class="confirm-title">结束本次线下见面</div>
      <div class="confirm-desc offline-session-desc">
        本次共记录 {{ messageCount }} 条内容。原文将始终保留在本地，下面只决定回到线上后模型如何承接。
      </div>

      <div class="offline-session-section-title">线上承接方式</div>
      <div class="offline-session-options">
        <div class="offline-session-option" :class="{ active: carryoverMode === 'summary' }" @click="carryoverMode = 'summary'">
          <div class="offline-session-option-main">仅使用摘要</div>
          <div class="offline-session-option-sub">通过总结节点生成档案，后续线上不发送线下原文</div>
        </div>
        <div class="offline-session-option" :class="{ active: carryoverMode === 'summary_recent' }" @click="carryoverMode = 'summary_recent'">
          <div class="offline-session-option-main">摘要加最近内容</div>
          <div class="offline-session-option-sub">使用摘要，同时保留结尾若干条原文帮助自然衔接</div>
        </div>
        <div class="offline-session-option" :class="{ active: carryoverMode === 'full' }" @click="carryoverMode = 'full'">
          <div class="offline-session-option-main">完整原文承接</div>
          <div class="offline-session-option-sub">线下原文继续进入线上上下文，同时生成档案摘要</div>
        </div>
        <div class="offline-session-option" :class="{ active: carryoverMode === 'none' }" @click="carryoverMode = 'none'">
          <div class="offline-session-option-main">暂不承接</div>
          <div class="offline-session-option-sub">仅保留本地原文，不调用总结节点，也不发送给线上模型</div>
        </div>
      </div>

      <div v-if="carryoverMode === 'summary_recent'" class="offline-session-field">
        <div class="offline-session-section-title">保留最近内容</div>
        <div class="offline-session-count-options">
          <div v-for="count in [4, 6, 10, 16]" :key="count" class="offline-session-count" :class="{ active: recentMessageCount === count }" @click="recentMessageCount = count">
            {{ count }} 条
          </div>
        </div>
      </div>

      <div v-if="carryoverMode !== 'none'" class="offline-session-field">
        <div class="offline-session-section-title">补充总结要求</div>
        <textarea
          v-model="summaryInstruction"
          class="offline-session-textarea"
          rows="3"
          maxlength="500"
          placeholder="可选，例如重点保留关系变化、某项承诺或未完成的事情"
        ></textarea>
        <div class="offline-session-counter">{{ summaryInstruction.length }}/500</div>
      </div>

      <div v-if="errorMessage" class="offline-session-error">{{ errorMessage }}</div>

      <div class="confirm-actions offline-session-actions">
        <div class="confirm-btn cancel" :class="{ disabled: isProcessing }" @click="close">继续见面</div>
        <div class="confirm-btn" :class="{ disabled: isProcessing }" @click="confirm">
          {{ isProcessing ? '正在整理记录' : '结束并返回线上' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';

.offline-session-overlay { z-index: 20020; }
.offline-session-modal { width: min(90vw, 380px); max-width: 380px; max-height: min(82vh, 680px); overflow-y: auto; text-align: left; }
.offline-session-desc { text-align: left; line-height: 1.65; margin-top: 8px; }
.offline-session-section-title { color: var(--text-secondary); font-size: 12px; font-weight: 600; margin: 18px 12px 8px; }
.offline-session-options { display: flex; flex-direction: column; gap: 8px; margin: 0 12px; }
.offline-session-option { padding: 11px 12px; border-radius: 12px; background: var(--bg-secondary); border: 1px solid transparent; cursor: pointer; transition: border-color .2s ease, background .2s ease; }
.offline-session-option.active { border-color: var(--text-primary); background: var(--bg-primary); }
.offline-session-option-main { color: var(--text-primary); font-size: 14px; font-weight: 500; }
.offline-session-option-sub { color: var(--text-tertiary); font-size: 11px; line-height: 1.5; margin-top: 3px; }
.offline-session-field { position: relative; margin: 0 12px; }
.offline-session-field .offline-session-section-title { margin-left: 0; margin-right: 0; }
.offline-session-count-options { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.offline-session-count { padding: 8px 4px; border-radius: 10px; background: var(--bg-secondary); color: var(--text-secondary); text-align: center; font-size: 12px; cursor: pointer; border: 1px solid transparent; }
.offline-session-count.active { color: var(--text-primary); background: var(--bg-primary); border-color: var(--text-primary); }
.offline-session-textarea { display: block; width: 100%; box-sizing: border-box; resize: none; min-height: 82px; padding: 11px 12px 24px; border: 1px solid var(--border-color); border-radius: 12px; outline: none; background: var(--bg-secondary); color: var(--text-primary); font: inherit; font-size: 13px; line-height: 1.55; transition: border-color .2s ease; }
.offline-session-textarea:focus { border-color: var(--text-secondary); }
.offline-session-textarea::placeholder { color: var(--text-tertiary); }
.offline-session-counter { position: absolute; right: 10px; bottom: 7px; color: var(--text-tertiary); font-size: 10px; }
.offline-session-error { margin: 12px 12px 0; padding: 9px 10px; border-radius: 10px; background: rgba(214, 72, 72, .08); color: #b64b4b; font-size: 12px; line-height: 1.5; }
.offline-session-actions { margin-top: 18px; }
.confirm-btn.disabled { opacity: .45; pointer-events: none; }
</style>
