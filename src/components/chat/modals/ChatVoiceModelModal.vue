/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  currentModel: string
  modelOptions: string[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', value: string): void
}>()

const close = () => {
  emit('update:visible', false)
}

const handleSelect = (model: string) => {
  emit('select', model)
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10010;" @click.self="close">
    <div class="custom-confirm-modal" style="max-width: 320px; padding-bottom: 20px;">
      <div class="confirm-title" style="margin-bottom: 16px;">选择语音模型</div>
      <div style="padding: 0 16px; display: flex; flex-direction: column; gap: 8px;">
        <div 
          v-for="opt in modelOptions" 
          :key="opt" 
          class="memory-type-item"
          :class="{ active: currentModel === opt }"
          @click="handleSelect(opt)"
          style="margin-bottom: 0;"
        >
          <div class="type-name" style="margin-bottom: 0;">{{ opt }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';
</style>
