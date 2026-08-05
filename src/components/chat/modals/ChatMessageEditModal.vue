/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  messageId?: number
  initialContent?: string
  initialType?: string // 'left', 'right', 'system'
  hasMedia?: boolean // 是否包含图片、语音等多媒体信息
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { messageId?: number, content: string, type: string, clearMedia: boolean }): void
}>()

const editContent = ref('')
const editType = ref('left') // 默认对方
const willClearMedia = ref(false)

watch(() => props.visible, (newVal) => {
  if (newVal) {
    editContent.value = props.initialContent || ''
    editType.value = props.initialType || 'left'
    willClearMedia.value = false // 每次打开重置状态
  }
})

const handleOverlayClick = () => {
  emit('close')
}

const handleSave = () => {
  emit('save', {
    messageId: props.messageId,
    content: editContent.value,
    type: editType.value,
    clearMedia: willClearMedia.value
  })
}

const handleClearMedia = () => {
  willClearMedia.value = true
  editContent.value = ''
}
</script>

<template>
  <transition name="journal-fade">
    <div v-if="visible" class="journal-modal-overlay" @click="handleOverlayClick" @touchmove.prevent>
      <div class="journal-modal-container" @click.stop>
        <!-- 装饰性纸胶带 -->
        <div class="washi-tape top-left"></div>
        <div class="washi-tape top-right"></div>

        <div class="close-btn" @click="handleOverlayClick">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>

        <h3 class="modal-title">编辑消息</h3>

        <div class="edit-form">
          <div class="form-group">
            <label class="form-label">发送者身份</label>
            <div class="role-selector">
              <div class="role-option" :class="{ 'active': editType === 'left' }" @click="editType = 'left'">对方</div>
              <div class="role-option" :class="{ 'active': editType === 'right' }" @click="editType = 'right'">我</div>
              <div class="role-option" :class="{ 'active': editType === 'system' }" @click="editType = 'system'">旁白/系统</div>
            </div>
          </div>

          <div class="form-group">
            <div class="label-with-action">
              <label class="form-label">消息内容</label>
              <button 
                v-if="props.hasMedia && !willClearMedia" 
                class="clear-media-btn" 
                @click="handleClearMedia"
              >
                清除图片并置空
              </button>
              <span v-if="willClearMedia" class="media-cleared-text">多媒体将在保存后清除</span>
            </div>
            <textarea 
              v-model="editContent" 
              class="edit-textarea" 
              placeholder="请输入消息内容..."
              rows="5"
            ></textarea>
          </div>
        </div>

        <div class="modal-actions">
          <button class="modal-btn cancel" @click="handleOverlayClick">取消</button>
          <button class="modal-btn save" @click="handleSave">保存</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.journal-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 10000;
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

.modal-title {
  margin: 0 0 20px;
  font-size: 18px;
  color: var(--text-primary);
  text-align: center;
  font-family: 'Comic Sans MS', 'Chalkboard SE', sans-serif;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.label-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.clear-media-btn {
  font-size: 12px;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 12px;
  padding: 2px 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-media-btn:active {
  background: rgba(239, 68, 68, 0.2);
}

.media-cleared-text {
  font-size: 12px;
  color: #ef4444;
  font-style: italic;
}

.role-selector {
  display: flex;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  padding: 4px;
}

.is-dark .role-selector {
  background: rgba(255, 255, 255, 0.05);
}

.role-option {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  font-size: 14px;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.role-option.active {
  background: #fff;
  color: var(--text-primary);
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  font-weight: 500;
}

.is-dark .role-option.active {
  background: #3a3836;
  color: var(--text-primary);
}

.edit-textarea {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: #fff;
  color: var(--text-primary);
  font-size: 14px;
  resize: none;
  outline: none;
  font-family: inherit;
  line-height: 1.5;
}

.is-dark .edit-textarea {
  background: #3a3836;
  border-color: rgba(255, 255, 255, 0.1);
}

.edit-textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.modal-btn {
  flex: 1;
  padding: 10px 0;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.modal-btn.cancel {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-secondary);
}

.modal-btn.cancel:active {
  background: rgba(0, 0, 0, 0.1);
}

.is-dark .modal-btn.cancel {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.modal-btn.save {
  background: #3b82f6;
  color: white;
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
}

.modal-btn.save:active {
  transform: translateY(2px);
  box-shadow: 0 2px 5px rgba(59, 130, 246, 0.3);
}

.modal-btn.save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

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
