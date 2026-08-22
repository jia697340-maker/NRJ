<script setup lang="ts">
defineProps<{ visible: boolean; previewMessages?: any[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'fork'): void }>()
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay reply-variant-overlay" @click.self="emit('close')">
    <div class="custom-confirm-modal reply-variant-fork-modal" @click.stop>
      <div class="confirm-title">从这个回复继续</div>
      <p class="reply-variant-fork-copy">后面已经有新的聊天内容。切换这个回复会从这里创建另一条时间线，当前进度仍会完整保留。</p>
      <div v-if="previewMessages?.length" class="reply-variant-preview">
        <div v-for="message in previewMessages" :key="message.id" class="reply-variant-preview-line">{{ message.content || '[多媒体消息]' }}</div>
      </div>
      <div class="confirm-actions reply-variant-fork-actions">
        <div class="confirm-btn cancel" @click="emit('close')">取消</div>
        <div class="confirm-btn" @click="emit('fork')">从这里继续</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reply-variant-overlay { z-index: 3300; }
.reply-variant-fork-modal { width: min(88vw, 350px); padding: 22px 20px 18px; }
.reply-variant-fork-copy { margin: 12px 0 20px; color: var(--text-secondary, #777); font-size: 13px; line-height: 1.65; }
.reply-variant-preview { max-height: 150px; overflow-y: auto; margin: -6px 0 18px; padding: 10px 12px; border-radius: 12px; background: rgba(0,0,0,.035); }
.reply-variant-preview-line { color: var(--text-primary, #333); font-size: 13px; line-height: 1.55; }
.reply-variant-preview-line + .reply-variant-preview-line { margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(0,0,0,.05); }
:global(.is-dark) .reply-variant-preview { background: rgba(255,255,255,.055); }
:global(.is-dark) .reply-variant-preview-line + .reply-variant-preview-line { border-top-color: rgba(255,255,255,.06); }
.reply-variant-fork-actions { gap: 8px; }
.reply-variant-fork-actions .confirm-btn { min-width: 0; flex: 1; }
</style>
