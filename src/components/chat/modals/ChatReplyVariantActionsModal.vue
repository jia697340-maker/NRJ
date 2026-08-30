<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ visible: boolean; count: number }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'delete-current'): void
  (e: 'keep-current'): void
}>()

const confirmation = ref<'delete' | 'keep' | null>(null)
watch(() => props.visible, visible => { if (!visible) confirmation.value = null })

const confirm = () => {
  if (confirmation.value === 'delete') emit('delete-current')
  if (confirmation.value === 'keep') emit('keep-current')
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay reply-variant-actions-overlay" @click.self="emit('close')">
    <div class="custom-confirm-modal reply-variant-actions-modal" @click.stop>
      <template v-if="!confirmation">
        <div class="confirm-title">管理回复版本</div>
        <p class="reply-variant-actions-copy">这一轮共有 {{ count }} 个回复版本。</p>
        <div class="reply-variant-action-list">
          <button type="button" @click="confirmation = 'delete'">
            <strong>删除当前版本</strong>
            <span>删除后自动显示相邻版本</span>
          </button>
          <button type="button" @click="confirmation = 'keep'">
            <strong>仅保留当前版本</strong>
            <span>清除这一轮的其他所有版本</span>
          </button>
        </div>
        <div class="confirm-actions reply-variant-actions-footer">
          <button class="confirm-btn cancel" type="button" @click="emit('close')">取消</button>
        </div>
      </template>
      <template v-else>
        <div class="confirm-title">{{ confirmation === 'delete' ? '删除当前版本？' : '仅保留当前版本？' }}</div>
        <p class="reply-variant-actions-copy">
          {{ confirmation === 'delete' ? '当前回复会被永久移除，并自动切换到相邻版本。' : '这一轮的其他回复会被永久清除，之后将无法切换查看。' }}
        </p>
        <div class="confirm-actions reply-variant-confirm-footer">
          <button class="confirm-btn cancel" type="button" @click="confirmation = null">返回</button>
          <button class="confirm-btn danger" type="button" @click="confirm">确认{{ confirmation === 'delete' ? '删除' : '清除' }}</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.reply-variant-actions-overlay { z-index: 3320; }
.reply-variant-actions-modal { width: min(88vw, 350px); padding: 22px 20px 18px; }
.reply-variant-actions-copy { margin: 10px 0 16px; color: var(--text-secondary, #777); font-size: 13px; line-height: 1.6; }
.reply-variant-action-list { display: flex; flex-direction: column; gap: 8px; }
.reply-variant-action-list button { display: flex; width: 100%; min-height: 58px; padding: 11px 13px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--sys-bg-primary); color: var(--text-primary); font: inherit; text-align: left; flex-direction: column; justify-content: center; cursor: pointer; }
.reply-variant-action-list button:active { transform: scale(.985); background: var(--sys-bg-tertiary); }
.reply-variant-action-list strong { font-size: 14px; font-weight: 600; }
.reply-variant-action-list span { margin-top: 4px; color: var(--text-tertiary); font-size: 11px; }
.reply-variant-actions-footer { margin-top: 14px; }
.reply-variant-actions-footer .confirm-btn { width: 100%; border-right: 0; }
.reply-variant-confirm-footer { gap: 8px; }
.reply-variant-confirm-footer .confirm-btn { min-width: 0; flex: 1; border: 0; border-radius: 10px; background: var(--sys-bg-tertiary); }
.reply-variant-confirm-footer .confirm-btn.danger { background: #d85f59; color: #fff; }
</style>
