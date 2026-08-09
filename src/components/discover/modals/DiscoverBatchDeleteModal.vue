/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
defineProps<{
  visible: boolean
  count: number
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="custom-modal-overlay" @click.self="emit('update:visible', false)">
      <div class="custom-modal">
        <div class="custom-modal-title">提示</div>
        <div class="custom-modal-content">确定要删除选中的 {{ count }} 条朋友圈吗？</div>
        <div class="custom-modal-actions">
          <div class="custom-modal-btn cancel-btn" @click="emit('update:visible', false)">取消</div>
          <div class="custom-modal-btn confirm-btn" @click="emit('confirm')">确定</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@import '../../app_ChatDiscover.css';
</style>
