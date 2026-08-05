/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
}>()

const close = () => {
  emit('update:visible', false)
}

const handleConfirm = () => {
  emit('confirm')
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10000;" @click.self="close">
    <div class="custom-confirm-modal">
      <div class="confirm-title">清空聊天记录</div>
      <div class="confirm-desc">确定要清空与该角色的所有聊天记录吗？<br/>此操作不可恢复。</div>
      <div class="confirm-actions">
        <div class="confirm-btn cancel" @click="close">取消</div>
        <div class="confirm-btn danger" @click="handleConfirm">确认清空</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';
</style>
