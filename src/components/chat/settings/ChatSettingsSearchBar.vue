/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'back'): void
}>()
</script>

<template>
  <div class="chat-settings-search-bar">
    <div class="cs-search-box">
      <div class="cs-star-btn" @click="emit('back')">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="#999" stroke-width="1.5" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
      </div>
      <input 
        type="text" 
        class="cs-search-input" 
        :value="modelValue"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        placeholder="搜索设置..." 
      />
      <div class="cs-search-btn">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="#666" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      </div>
    </div>
  </div>
</template>
