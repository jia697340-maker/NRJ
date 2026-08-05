/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'send', data: { text: string, seconds: number }): void
}>()

const text = ref('')

const seconds = computed(() => {
  const len = text.value.trim().length
  if (len === 0) return 0
  return Math.min(60, Math.max(1, Math.ceil(len / 4)))
})

watch(() => props.visible, (val) => {
  if (val) {
    text.value = ''
  }
})

const handleSend = () => {
  if (!text.value.trim()) return
  emit('send', { text: text.value.trim(), seconds: seconds.value })
}
</script>

<template>
  <transition name="folder-fade">
    <div v-if="visible" class="folder-modal-overlay" @click="emit('close')" @touchmove.prevent>
      <div class="voice-modal-card" @click.stop>
        <div class="vm-header">
          <h3>发送语音</h3>
        </div>
        <div class="vm-body">
          <textarea 
            v-model="text" 
            placeholder="输入你想说的内容，将自动换算成语音发送" 
            class="vm-textarea"
            maxlength="200"
          ></textarea>
          <div class="vm-seconds-hint">预计语音时长: {{ seconds }} 秒</div>
        </div>
        <div class="vm-footer">
          <button class="vm-btn cancel" @click="emit('close')">取消</button>
          <button class="vm-btn send" :disabled="!text.trim()" @click="handleSend">发送</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.folder-modal-overlay {
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

.voice-modal-card {
  width: 280px;
  background: var(--sys-bg-primary, #fff);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
}
.is-dark .voice-modal-card {
  background: var(--sys-bg-primary, #2c2c2c);
}

.vm-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.05));
}
.vm-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary, #333);
  text-align: center;
}
.is-dark .vm-header h3 {
  color: #eee;
}

.vm-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.vm-textarea {
  width: 100%;
  height: 80px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color, rgba(0,0,0,0.1));
  background: var(--sys-bg-secondary, #f5f5f5);
  color: var(--text-primary, #333);
  font-size: 14px;
  resize: none;
  box-sizing: border-box;
}
.vm-textarea:focus {
  outline: none;
  border-color: #1976d2;
}
.is-dark .vm-textarea {
  background: rgba(0,0,0,0.2);
  color: #eee;
}

.vm-seconds-hint {
  font-size: 12px;
  color: var(--text-secondary, #666);
  text-align: right;
}
.is-dark .vm-seconds-hint {
  color: #999;
}

.vm-footer {
  display: flex;
  border-top: 1px solid var(--border-color, rgba(0,0,0,0.05));
}

.vm-btn {
  flex: 1;
  height: 44px;
  background: transparent;
  border: none;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}
.vm-btn.cancel {
  border-right: 1px solid var(--border-color, rgba(0,0,0,0.05));
  color: var(--text-secondary, #666);
}
.is-dark .vm-btn.cancel {
  color: #999;
}
.vm-btn.send {
  color: #1976d2;
}
.vm-btn.send:disabled {
  opacity: 0.4;
  pointer-events: none;
}

/* 动画效果借用基础的 folder-fade */
.folder-fade-enter-active, .folder-fade-leave-active {
  transition: opacity 0.3s ease;
}
.folder-fade-enter-active .voice-modal-card {
  animation: folderPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1);
}
.folder-fade-leave-active .voice-modal-card {
  animation: folderPopOut 0.2s ease forwards;
}
.folder-fade-enter-from, .folder-fade-leave-to {
  opacity: 0;
}
@keyframes folderPopIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes folderPopOut {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(0.95); opacity: 0; }
}
</style>
