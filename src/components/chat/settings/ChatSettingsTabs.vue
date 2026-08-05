/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  categories: string[]
  activeCategory: string
}>()

const emit = defineEmits<{
  (e: 'change', category: string): void
}>()
</script>

<template>
  <div class="capsule-tab-container">
    <div class="capsule-tab-bar">
      <div 
        v-for="cat in categories" 
        :key="cat"
        class="capsule-tab-item"
        :class="{ active: activeCategory === cat }"
        @click="emit('change', cat)"
      >
        {{ cat }}
      </div>
    </div>
  </div>
</template>
