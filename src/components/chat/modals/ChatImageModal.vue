/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'send', data: { file?: File, dataUrl?: string, text?: string }): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const previewUrl = ref('')
const selectedFile = ref<File | null>(null)
const text = ref('') // 保留输入框作为备用或额外描述，但主要是发真图

watch(() => props.visible, (val) => {
  if (val) {
    text.value = ''
    previewUrl.value = ''
    selectedFile.value = null
  }
})

const triggerFileSelect = () => {
  fileInput.value?.click()
}

const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    if (!file.type.startsWith('image/')) return
    selectedFile.value = file
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (ev.target?.result) {
        previewUrl.value = ev.target.result as string
      }
    }
    reader.readAsDataURL(file)
  }
}

const handleSend = () => {
  if (!selectedFile.value && !text.value.trim()) return
  emit('send', { 
    file: selectedFile.value || undefined, 
    dataUrl: previewUrl.value || undefined,
    text: text.value.trim() 
  })
}
</script>

<template>
  <transition name="folder-fade">
    <div v-if="visible" class="folder-modal-overlay" @click="emit('close')" @touchmove.prevent>
      <div class="voice-modal-card" @click.stop>
        <div class="vm-header">
          <h3>发送图片</h3>
        </div>
        <div class="vm-body">
          <div class="image-upload-area" @click="triggerFileSelect">
            <template v-if="!previewUrl">
              <svg viewBox="0 0 24 24" width="32" height="32" stroke="var(--text-tertiary, #999)" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <span style="font-size: 13px; color: var(--text-tertiary, #999); margin-top: 8px;">点击选择真实的图片</span>
              <span style="font-size: 11px; color: #FF4D4F; margin-top: 4px;">将安全存入本地缓存中</span>
            </template>
            <img v-else :src="previewUrl" class="image-preview" />
            <input type="file" accept="image/*" ref="fileInput" style="display: none;" @change="onFileChange" />
          </div>
          
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; padding-left: 4px;">或输入纯文字充当图片：</div>
          <textarea 
            v-model="text" 
            placeholder="如果不想发真实图片，可输入场景描述..." 
            class="vm-textarea"
            maxlength="200"
          ></textarea>
        </div>
        <div class="vm-footer">
          <button class="vm-btn cancel" @click="emit('close')">取消</button>
          <button class="vm-btn send" :disabled="!selectedFile && !text.trim()" @click="handleSend">发送</button>
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

.image-upload-area {
  width: 100%;
  height: 140px;
  border: 1px dashed var(--border-color, rgba(0,0,0,0.2));
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: var(--sys-bg-secondary, #f9f9f9);
  overflow: hidden;
  margin-bottom: 8px;
}
.is-dark .image-upload-area {
  background: rgba(0,0,0,0.1);
  border-color: rgba(255,255,255,0.1);
}

.image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.vm-textarea {
  width: 100%;
  height: 60px;
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
