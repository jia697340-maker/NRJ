/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  msg: any
  expandedImageIds: Set<number>
  currentMediaThumb: string | null
}>()

const emit = defineEmits<{
  (e: 'toggle-image-text', msgId: number): void
  (e: 'touch-start', msgId: number): void
  (e: 'touch-end'): void
  (e: 'touch-move'): void
}>()
</script>

<template>
  <!-- 有真实图片ID时渲染真实图片 -->
  <div v-if="msg.imageData.imageId || (msg.imageData.history && msg.imageData.history.length > 0)" class="emoji-message-container" @click="emit('toggle-image-text', msg.id)" @touchstart="emit('touch-start', msg.id)" @touchend="emit('touch-end')" @touchmove="emit('touch-move')" @contextmenu.prevent>
    <img v-if="msg._localImageUrl" :src="msg._localImageUrl" class="emoji-message-img" style="border-radius: 8px; max-width: 200px; object-fit: contain;" loading="lazy" />
    <div v-else style="padding: 12px; color: #999;">[图片加载中...]</div>
    <span v-if="msg.imageData.identityProfileIds?.length" class="identity-badge">已使用固定形象</span>
  </div>
  <!-- 只有文字描述时渲染占位符 -->
  <div v-else class="image-message-placeholder" :style="currentMediaThumb ? { backgroundImage: `url(${currentMediaThumb})`, backgroundSize: 'cover', backgroundPosition: 'center', border: 'none' } : {}" @click="emit('toggle-image-text', msg.id)" @touchstart="emit('touch-start', msg.id)" @touchend="emit('touch-end')" @touchmove="emit('touch-move')" @contextmenu.prevent>
    <svg v-if="!expandedImageIds.has(msg.id) && !currentMediaThumb" class="image-placeholder-icon" viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
    <div v-else-if="expandedImageIds.has(msg.id)" class="image-text-overlay">
      <span>{{ msg.imageData.text }}</span>
    </div>
  </div>
</template>

<style scoped>
@import '../../app_ChatPreview.css';
.emoji-message-container{position:relative}.identity-badge{position:absolute;left:7px;bottom:7px;padding:3px 7px;border-radius:8px;background:rgba(20,20,20,.55);backdrop-filter:blur(4px);color:#fff;font-size:9px;line-height:1.2;pointer-events:none}
</style>
