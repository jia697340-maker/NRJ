/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = defineProps<{
  categories: string[]
  activeCategory: string
}>()

const emit = defineEmits<{
  (e: 'change', category: string): void
}>()

const itemRefs = ref<Record<string, HTMLElement | null>>({})

const setItemRef = (el: any, cat: string) => {
  if (el) {
    itemRefs.value[cat] = el as HTMLElement
  }
}

const scrollTabIntoView = (cat: string) => {
  nextTick(() => {
    const el = itemRefs.value[cat]
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      })
    }
  })
}

const selectCategory = (cat: string) => {
  emit('change', cat)
  scrollTabIntoView(cat)
}

watch(
  () => props.activeCategory,
  (newCat) => {
    if (newCat) {
      scrollTabIntoView(newCat)
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="capsule-tab-container">
    <div class="capsule-tab-bar">
      <div 
        v-for="cat in categories" 
        :key="cat"
        :ref="(el) => setItemRef(el, cat)"
        class="capsule-tab-item"
        :class="{ active: activeCategory === cat }"
        @click="selectCategory(cat)"
      >
        {{ cat }}
      </div>
    </div>
  </div>
</template>
