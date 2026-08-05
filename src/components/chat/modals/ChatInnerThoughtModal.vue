<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useChatState } from '../../../composables/useChatState'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { selectedChat } = useChatState()

const daysKnown = computed(() => {
  const messages = selectedChat.value?.messages
  if (!messages?.length) return 0
  const firstTime = messages[0].id > 1000000000000 ? messages[0].id : Date.now()
  return Math.floor(Math.max(0, Date.now() - firstTime) / (1000 * 60 * 60 * 24))
})

const currentIndex = ref(0)
const currentThought = computed(() => selectedChat.value?.innerThoughts?.[currentIndex.value] ?? null)
const thoughtCount = computed(() => selectedChat.value?.innerThoughts?.length ?? 0)
const hasPrevious = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value < thoughtCount.value - 1)

const nextThought = () => { if (hasNext.value) currentIndex.value++ }
const prevThought = () => { if (hasPrevious.value) currentIndex.value-- }

watch(() => props.visible, (visible) => { if (visible) currentIndex.value = 0 })
</script>

<template>
  <transition name="elegant-fade">
    <div v-if="visible" class="elegant-overlay" @click="emit('close')" @touchmove.prevent>
      <div class="modal-shell" @click.stop>
        <article class="thought-card">
          <div class="scrollable-content">
            <header v-if="selectedChat" class="profile-header">
              <div class="avatar-wrapper">
                <img v-if="selectedChat.avatarUrl" :src="selectedChat.avatarUrl" class="avatar-img" />
                <div v-else class="avatar-text-fallback">{{ selectedChat.avatarText || '?' }}</div>
              </div>
              <div class="profile-info">
                <div class="char-name">{{ selectedChat.remark || selectedChat.name }}</div>
                <div class="char-signature">相识第 {{ daysKnown }} 天 · 心声</div>
              </div>
            </header>

            <main class="thought-content-area">
              <div v-if="currentThought" class="text-content">{{ currentThought.content }}</div>
              <div v-else class="empty-thought-state">当前还没有任何心声</div>
            </main>

            <!-- Kept as the content-side attachment entry, separate from system controls. -->
            <div class="bottom-image-placeholder">
              <div class="placeholder-box" aria-label="心声图片占位">
                <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </div>
            </div>
          </div>
        </article>

        <!-- All system controls live outside the card so custom HTML themes can place them freely. -->
        <nav class="external-controls" aria-label="心声操作">
          <div v-if="currentThought && thoughtCount" class="page-controls">
            <button class="external-button icon-button" :disabled="!hasPrevious" aria-label="上一条心声" @click="prevThought">
              <svg viewBox="0 0 24 24" width="19" height="19" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <span class="page-number">{{ currentIndex + 1 }} / {{ thoughtCount }}</span>
            <button class="external-button icon-button" :disabled="!hasNext" aria-label="下一条心声" @click="nextThought">
              <svg viewBox="0 0 24 24" width="19" height="19" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
          <button class="external-button close-button" @click="emit('close')">关闭</button>
        </nav>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.elegant-fade-enter-active, .elegant-fade-leave-active { transition: opacity .25s ease; }
.elegant-fade-enter-from, .elegant-fade-leave-to { opacity: 0; }

.elegant-overlay {
  position: absolute;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(26, 26, 28, .54);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.modal-shell { width: min(100%, 400px); display: flex; flex-direction: column; gap: 14px; }
.thought-card {
  display: flex;
  flex-direction: column;
  max-height: 76vh;
  padding: 22px 24px;
  overflow: hidden;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 16px 42px rgba(0, 0, 0, .22);
}
.scrollable-content { overflow-y: auto; scrollbar-width: none; }
.scrollable-content::-webkit-scrollbar { display: none; }
.profile-header { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid #eeeeee; }
.avatar-wrapper { width: 56px; height: 56px; flex: 0 0 auto; overflow: hidden; display: grid; place-items: center; border-radius: 50%; background: #f5f5f5; border: 2px solid #fff; box-shadow: 0 2px 10px rgba(0, 0, 0, .05); }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-text-fallback { color: #999; font: 24px "STKaiti", "KaiTi", serif; }
.profile-info { display: grid; gap: 6px; }
.char-name { color: #333; font: 600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.char-signature { color: #888; font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: .5px; }
.thought-content-area { min-height: 136px; margin-bottom: 22px; }
.text-content { color: #404040; white-space: pre-wrap; text-align: justify; letter-spacing: 1px; font: 15px/1.8 "STKaiti", "KaiTi", "Songti SC", Georgia, serif; }
.empty-thought-state { display: grid; min-height: 136px; place-items: center; color: #a0a0a0; font: 16px "STKaiti", "KaiTi", serif; }
.bottom-image-placeholder { display: flex; justify-content: flex-start; }
.placeholder-box { width: 140px; height: 140px; display: grid; place-items: center; color: #d0d0d0; background: #f9f9f9; border: 1px dashed #e0e0e0; border-radius: 16px; }

.external-controls { display: flex; align-items: center; justify-content: space-between; min-height: 38px; padding: 0 2px; }
.page-controls { display: flex; align-items: center; gap: 8px; }
.external-button { display: grid; place-items: center; border: 0; color: #fff; background: rgba(255, 255, 255, .14); cursor: pointer; transition: background .18s ease, transform .18s ease; }
.external-button:hover:not(:disabled) { background: rgba(255, 255, 255, .25); }
.external-button:active:not(:disabled) { transform: scale(.95); }
.external-button:disabled { opacity: .35; cursor: default; }
.icon-button { width: 34px; height: 34px; border-radius: 50%; }
.page-number { min-width: 44px; color: rgba(255, 255, 255, .92); text-align: center; font: 14px Georgia, serif; letter-spacing: .5px; }
.close-button { min-width: 58px; height: 32px; border-radius: 16px; font-size: 13px; letter-spacing: 1px; }
</style>
