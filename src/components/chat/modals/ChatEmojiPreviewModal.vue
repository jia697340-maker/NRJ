/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  emojiUrl: string
  emojiName: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="emoji-preview-overlay" @click="emit('close')" @touchmove.prevent>
      <div class="emoji-preview-card" @click.stop>
        <div class="preview-img-wrapper">
          <img :src="emojiUrl" class="preview-img" />
        </div>
        <div class="preview-name" v-if="emojiName">
          {{ emojiName }}
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.emoji-preview-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.emoji-preview-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  max-width: 80%;
}

.preview-img-wrapper {
  width: 240px;
  height: 240px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

.is-dark .preview-img-wrapper {
  background: rgba(40, 40, 40, 0.8);
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-name {
  color: #fff;
  font-size: 18px;
  font-weight: 500;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
  text-align: center;
  background: rgba(0,0,0,0.4);
  padding: 8px 20px;
  border-radius: 20px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-active .emoji-preview-card {
  animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.fade-leave-active .emoji-preview-card {
  animation: popOut 0.2s ease forwards;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
@keyframes popIn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes popOut {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(0.9); opacity: 0; }
}
</style>
