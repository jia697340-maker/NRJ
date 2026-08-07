<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
defineProps<{
  visible: boolean
  title: string
  currentValue: string
  options: { value: string; label: string; description?: string }[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', value: string): void
}>()

const close = () => emit('update:visible', false)
const select = (value: string) => {
  emit('select', value)
  close()
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10010;" @click.self="close">
    <div class="custom-confirm-modal" style="max-width: 320px; padding-bottom: 20px;">
      <div class="confirm-title" style="margin-bottom: 12px;">{{ title }}</div>
      <div style="padding: 0 16px; display: flex; flex-direction: column; gap: 8px;">
        <div
          v-for="option in options"
          :key="option.value"
          class="memory-type-item"
          :class="{ active: currentValue === option.value }"
          style="margin-bottom: 0;"
          @click="select(option.value)"
        >
          <div class="type-name" :style="option.description ? undefined : { marginBottom: '0' }">{{ option.label }}</div>
          <div v-if="option.description" class="type-desc">{{ option.description }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';
</style>
