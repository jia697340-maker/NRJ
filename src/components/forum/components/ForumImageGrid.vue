/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'
import type { ForumMediaItem } from '../../../types/forum'

const props = withDefaults(
  defineProps<{
    media: ForumMediaItem[]
  }>(),
  {
    media: () => []
  }
)

const emit = defineEmits<{
  (e: 'preview', index: number, media: ForumMediaItem[]): void
}>()

const gridClass = computed(() => {
  const count = props.media.length
  if (count === 1) return 'grid-single'
  if (count === 2) return 'grid-double'
  if (count === 3) return 'grid-triple'
  if (count === 4) return 'grid-four'
  return 'grid-multi'
})
</script>

<template>
  <div v-if="media && media.length > 0" class="forum-image-grid" :class="gridClass">
    <div
      v-for="(item, index) in media.slice(0, 9)"
      :key="item.id || index"
      class="grid-img-cell"
      @click.stop="emit('preview', index, media)"
    >
      <img
        :src="item.url"
        :alt="item.alt || '动态配图'"
        loading="lazy"
        class="img-element"
      />
      <div v-if="media.length > 9 && index === 8" class="more-overlay">
        +{{ media.length - 9 }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.forum-image-grid {
  display: grid;
  gap: 6px;
  width: 100%;
  margin-top: 8px;
  border-radius: 12px;
  overflow: hidden;
}

.grid-img-cell {
  position: relative;
  overflow: hidden;
  background-color: var(--sys-bg-tertiary, #ebebeb);
  cursor: pointer;
}

.grid-img-cell:active {
  opacity: 0.9;
}

.img-element {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 单图排版：保持自适应优雅比例 */
.grid-single {
  grid-template-columns: 1fr;
  max-width: 85%;
  max-height: 280px;
}

.grid-single .grid-img-cell {
  aspect-ratio: 4 / 3;
  border-radius: 12px;
}

/* 2 张图：双列对齐 */
.grid-double {
  grid-template-columns: 1fr 1fr;
}

.grid-double .grid-img-cell {
  aspect-ratio: 1;
}

/* 3 张图：三列对齐 */
.grid-triple {
  grid-template-columns: 1fr 1fr 1fr;
}

.grid-triple .grid-img-cell {
  aspect-ratio: 1;
}

/* 4 张图：2x2 经典网格 */
.grid-four {
  grid-template-columns: 1fr 1fr;
  max-width: 85%;
}

.grid-four .grid-img-cell {
  aspect-ratio: 1;
}

/* 5-9 张图：3列流式宫格 */
.grid-multi {
  grid-template-columns: repeat(3, 1fr);
}

.grid-multi .grid-img-cell {
  aspect-ratio: 1;
}

.more-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
}
</style>
