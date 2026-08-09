/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  currentProvider: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', value: string): void
}>()

const close = () => {
  emit('update:visible', false)
}

const handleSelect = (provider: string) => {
  emit('select', provider)
  close()
}

const providers = [
  { id: 'novelai', name: 'NovelAI' },
  { id: 'gpt', name: 'GPT Image' },
  { id: 'gemini', name: 'Gemini Image' },
  { id: 'flux', name: 'FLUX.2' },
  { id: 'niji', name: 'Niji 7（第三方）' },
  { id: 'seedream', name: 'Seedream 5.0' }
]
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10010;" @click.self="close">
    <div class="custom-confirm-modal" style="max-width: 320px; padding-bottom: 20px;">
      <div class="confirm-title" style="margin-bottom: 16px;">选择生图引擎</div>
      <div style="padding: 0 16px; display: flex; flex-direction: column; gap: 8px;">
        <div 
          v-for="opt in providers" 
          :key="opt.id" 
          class="memory-type-item"
          :class="{ active: currentProvider === opt.id }"
          @click="handleSelect(opt.id)"
          style="margin-bottom: 0;"
        >
          <div class="type-name" style="margin-bottom: 0;">{{ opt.name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';
</style>
