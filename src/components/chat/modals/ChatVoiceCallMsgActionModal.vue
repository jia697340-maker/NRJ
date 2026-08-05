/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  messageId?: number
  previewContent?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'edit', messageId?: number): void
  (e: 'delete', messageId?: number): void
}>()

const showDeleteConfirm = ref(false)

watch(() => props.visible, (newVal) => {
  if (!newVal) {
    showDeleteConfirm.value = false
  }
})

const handleOverlayClick = () => {
  emit('close')
}

const handleEdit = () => {
  emit('edit', props.messageId)
  emit('close')
}

const confirmDelete = () => {
  emit('delete', props.messageId)
  emit('close')
}
</script>

<template>
  <transition name="journal-fade">
    <div v-if="visible" class="journal-modal-overlay" @click="handleOverlayClick" @touchmove.prevent>
      <div class="journal-modal-container" @click.stop>
        <!-- 装饰性纸胶带 -->
        <div class="washi-tape top-left"></div>
        <div class="washi-tape top-right"></div>

        <!-- 返回/关闭按钮 -->
        <div v-if="showDeleteConfirm" class="close-btn back-btn" @click="showDeleteConfirm = false">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </div>
        <div v-else class="close-btn" @click="handleOverlayClick">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>

        <!-- 删除二次确认 -->
        <div v-if="showDeleteConfirm" class="delete-info-wrapper">
          <h3 class="info-title">删除这条通话内容</h3>
          <div class="info-content">
            <p v-if="previewContent" class="preview-text">“{{ previewContent }}”</p>
            <p>删除后这句话不会再出现在本次通话里，也不会进入挂断后生成的通话总结。</p>
          </div>
          <div class="info-actions">
            <button class="info-btn cancel" @click="showDeleteConfirm = false">再想想</button>
            <button class="info-btn danger" @click="confirmDelete">确认删除</button>
          </div>
        </div>

        <div v-else class="journal-actions-grid-wrapper">
          <div class="journal-actions-grid">
            <!-- 修改 -->
            <div class="action-sticker" @click="handleEdit">
              <div class="sticker-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </div>
              <span class="sticker-label">修改</span>
            </div>

            <!-- 删除 -->
            <div class="action-sticker" @click="showDeleteConfirm = true">
              <div class="sticker-icon danger-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                  <path d="M10 11v6M14 11v6"></path>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                </svg>
              </div>
              <span class="sticker-label">删除</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.journal-modal-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.journal-modal-container {
  position: relative;
  background: #faf8f5;
  border-radius: 16px;
  padding: 32px 20px 24px;
  width: 85%;
  max-width: 360px;
  box-shadow: 
    0 10px 25px rgba(0,0,0,0.1),
    inset 0 0 0 1px rgba(255,255,255,0.6),
    inset 0 0 20px rgba(0,0,0,0.02);
  background-image: url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noiseFilter)" opacity="0.04"/></svg>');
}

.is-dark .journal-modal-container {
  background: #2a2826;
  box-shadow: 
    0 10px 25px rgba(0,0,0,0.3),
    inset 0 0 0 1px rgba(255,255,255,0.05);
}

/* 装饰性纸胶带 */
.washi-tape {
  position: absolute;
  width: 60px;
  height: 18px;
  background-color: rgba(220, 200, 180, 0.6);
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  opacity: 0.8;
  backdrop-filter: blur(2px);
  z-index: 2;
  border-radius: 2px;
}
.washi-tape.top-left {
  top: -8px;
  left: 10px;
  transform: rotate(-3deg);
  background-color: rgba(240, 190, 180, 0.7);
}
.washi-tape.top-right {
  top: -6px;
  right: 15px;
  transform: rotate(5deg);
  background-color: rgba(180, 210, 220, 0.7);
}
.is-dark .washi-tape {
  background-color: rgba(255, 255, 255, 0.1);
}

/* 关闭按钮 */
.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  cursor: pointer;
  z-index: 10;
  transition: background 0.2s ease;
}
.close-btn:active {
  background: rgba(0, 0, 0, 0.1);
}
.is-dark .close-btn {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}
.is-dark .close-btn:active {
  background: rgba(255, 255, 255, 0.1);
}
.close-btn.back-btn {
  left: 10px;
  right: auto;
}

/* 删除确认界面 */
.delete-info-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
  text-align: center;
  animation: fadeIn 0.2s ease;
}

.info-title {
  margin: 0 0 12px;
  font-size: 18px;
  color: var(--text-primary);
  font-family: 'Comic Sans MS', 'Chalkboard SE', sans-serif;
}

.info-content {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 24px;
  background: rgba(226, 109, 92, 0.05);
  border-radius: 8px;
  padding: 12px;
  border: 1px dashed rgba(226, 109, 92, 0.25);
}

.info-content p {
  margin: 0 0 8px;
}
.info-content p:last-child {
  margin: 0;
}

.preview-text {
  color: var(--text-primary);
  font-weight: 500;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.is-dark .info-content {
  background: rgba(226, 109, 92, 0.12);
  border-color: rgba(226, 109, 92, 0.35);
}

.info-actions {
  display: flex;
  gap: 12px;
  width: 100%;
}

.info-btn {
  flex: 1;
  padding: 10px 0;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.info-btn.cancel {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-secondary);
}

.info-btn.cancel:active {
  background: rgba(0, 0, 0, 0.1);
}

.is-dark .info-btn.cancel {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.info-btn.danger {
  background: #e26d5c;
  color: white;
  box-shadow: 0 4px 10px rgba(226, 109, 92, 0.3);
}

.info-btn.danger:active {
  transform: translateY(2px);
  box-shadow: 0 2px 5px rgba(226, 109, 92, 0.3);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.journal-actions-grid-wrapper {
  width: 100%;
}

.journal-actions-grid {
  display: flex;
  justify-content: center;
  gap: 40px;
  padding: 4px 4px 8px;
}

/* 贴纸风格的按钮 */
.action-sticker {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.action-sticker:active {
  transform: scale(0.9);
}

.sticker-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  box-shadow: 
    0 3px 6px rgba(0,0,0,0.06),
    inset 0 -2px 0 rgba(0,0,0,0.02);
  border: 1px solid rgba(0,0,0,0.03);
  position: relative;
}

.sticker-icon.danger-icon {
  color: #e26d5c;
}

.sticker-icon::after {
  content: '';
  position: absolute;
  top: -2px; left: -2px; right: -2px; bottom: -2px;
  border: 1px dashed rgba(0,0,0,0.1);
  border-radius: 50%;
  pointer-events: none;
}

.is-dark .sticker-icon {
  background: #3a3836;
  color: var(--text-primary);
  box-shadow: 0 3px 6px rgba(0,0,0,0.2);
  border-color: rgba(255,255,255,0.05);
}
.is-dark .sticker-icon.danger-icon {
  color: #e26d5c;
}
.is-dark .sticker-icon::after {
  border-color: rgba(255,255,255,0.1);
}

.sticker-label {
  font-size: 12px;
  color: #666;
  font-weight: 600;
  font-family: 'Comic Sans MS', 'Chalkboard SE', sans-serif;
  letter-spacing: 0.5px;
}
.is-dark .sticker-label {
  color: #aaa;
}

/* 动画 */
.journal-fade-enter-active,
.journal-fade-leave-active {
  transition: opacity 0.25s ease;
}
.journal-fade-enter-active .journal-modal-container {
  animation: popIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.journal-fade-leave-active .journal-modal-container {
  animation: popOut 0.25s ease forwards;
}

.journal-fade-enter-from,
.journal-fade-leave-to {
  opacity: 0;
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.8) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes popOut {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(0.9); opacity: 0; }
}
</style>
