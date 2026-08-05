/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  memoryType: 'round' | 'count'
  initialValue: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', value: number | null): void
}>()

const tempMemoryValue = ref('')

watch(() => props.visible, (newVal) => {
  if (newVal) {
    tempMemoryValue.value = props.initialValue
  }
})

const close = () => {
  emit('update:visible', false)
}

const handleSave = () => {
  const val = parseInt(tempMemoryValue.value)
  emit('save', isNaN(val) ? null : val)
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10000;" @click.self="close">
    <div class="custom-confirm-modal">
      <div class="confirm-title" style="margin-bottom: 8px;">设置{{ memoryType === 'round' ? '记忆轮数' : '记忆条数' }}</div>
      <div class="confirm-desc" style="padding-top: 0;">
        设置AI在每次对话时，最多携带多少{{ memoryType === 'round' ? '轮' : '条' }}历史消息作为上下文。<br/>设置得太大可能会导致超出大模型的字数限制或消耗大量 Token。
      </div>
      <div style="padding: 0 24px 20px;">
        <input type="number" class="form-input" v-model="tempMemoryValue" placeholder="留空为不限制" style="margin-bottom: 0; width: 100%; box-sizing: border-box;" />
      </div>
      <div class="confirm-actions">
        <div class="confirm-btn cancel" @click="close">取消</div>
        <div class="confirm-btn danger" style="color: var(--text-primary);" @click="handleSave">确认</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';
</style>
