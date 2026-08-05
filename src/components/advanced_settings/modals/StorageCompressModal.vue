/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  show: boolean
  modelValue: number // compressQuality
  isCompressing: boolean
  compressProgress: { current: number; total: number; text: string }
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
  (e: 'close'): void
  (e: 'start'): void
}>()

const quality = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

</script>

<template>
  <Transition name="fade">
    <div class="storage-modal-overlay" v-if="show" @click.self="!isCompressing && emit('close')">
      <div class="storage-modal-container compress-modal">
        <div class="storage-modal-header">
          <h3>压缩本地图片</h3>
          <button class="modal-close-btn" @click="emit('close')" :disabled="isCompressing">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div class="storage-modal-body">
          <div v-if="!isCompressing" class="compress-config-area">
            <div class="compress-info-card">
              <svg class="info-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>这将会遍历并重新编码应用内存储的所有头像、封面、聊天配图等，能在保留数据的前提下大幅减少空间占用。</span>
            </div>
            
            <div class="compress-slider-container">
              <div class="slider-header">
                <span class="slider-title">目标画质</span>
                <div class="slider-controls">
                  <button class="reset-btn" @click="quality = 70" title="重置为默认值">
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="1 4 1 10 7 10"></polyline>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                    重置
                  </button>
                  <div class="quality-input-wrapper">
                    <input 
                      type="number" 
                      v-model="quality" 
                      min="1" 
                      max="100"
                      class="quality-input"
                    />
                    <span class="percent-mark">%</span>
                  </div>
                </div>
              </div>
              
              <input 
                type="range" 
                v-model="quality" 
                min="1" 
                max="100" 
                class="modern-range"
              />
              
              <div class="quality-status">
                <span v-if="quality >= 90">画质极高，几乎无损，体积减小有限</span>
                <span v-else-if="quality >= 60">推荐平衡点，肉眼难辨损失，大幅省空间</span>
                <span v-else-if="quality >= 30">画质明显降低，适合极度缺乏空间的设备</span>
                <span v-else>画质将变得非常模糊，仅保留基础轮廓</span>
              </div>
            </div>
          </div>
          
          <div v-else class="compressing-state">
            <div class="modern-spinner"></div>
            <div class="progress-details">
              <div class="progress-text">{{ compressProgress.text }}</div>
              <div class="modern-progress-bg">
                <div class="modern-progress-fill" :style="{ width: (compressProgress.current / Math.max(1, compressProgress.total)) * 100 + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="storage-modal-footer">
          <button class="modern-btn ghost" @click="emit('close')" :disabled="isCompressing">取消</button>
          <button class="modern-btn primary" @click="emit('start')" :disabled="isCompressing">
            {{ isCompressing ? '处理中...' : '开始压缩' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.storage-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.storage-modal-container {
  background: var(--sys-bg-secondary);
  width: 90%;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.03);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
}

.compress-modal {
  max-width: 420px;
}

.storage-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
}

.storage-modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary);
}

.modal-close-btn {
  background: var(--sys-bg-tertiary);
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s;
}

.modal-close-btn:hover:not(:disabled) {
  background: var(--border-color);
  color: var(--text-secondary);
}

.modal-close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.storage-modal-body {
  padding: 0 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.compress-config-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.compress-info-card {
  display: flex;
  gap: 12px;
  background: var(--sys-bg-tertiary);
  padding: 16px;
  border-radius: 12px;
  color: var(--text-tertiary);
  font-size: 13px;
  line-height: 1.6;
}

.info-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--text-secondary);
}

.compress-slider-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.slider-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.slider-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  font-size: 12px;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.reset-btn:hover {
  background: var(--sys-bg-tertiary);
  color: var(--text-secondary);
}

.quality-input-wrapper {
  display: flex;
  align-items: center;
  background: var(--sys-bg-tertiary);
  border-radius: 8px;
  padding: 4px 10px;
}

.quality-input {
  width: 32px;
  border: none;
  background: transparent;
  text-align: right;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  outline: none;
  -moz-appearance: textfield;
}

.quality-input::-webkit-outer-spin-button,
.quality-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.percent-mark {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-left: 2px;
  font-weight: 500;
}

.modern-range {
  -webkit-appearance: none;
  width: 100%;
  height: 4px;
  background: var(--sys-bg-tertiary);
  border-radius: 2px;
  outline: none;
}

.modern-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--sys-bg-secondary);
  border: 2px solid var(--text-secondary);
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: transform 0.1s, background 0.2s;
}

.modern-range::-webkit-slider-thumb:active {
  transform: scale(1.1);
  background: var(--text-secondary);
}

.quality-status {
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
  min-height: 18px;
}

.compressing-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 32px 0;
}

.modern-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--sys-bg-tertiary);
  border-top-color: var(--text-secondary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.progress-details {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.progress-text {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.modern-progress-bg {
  width: 100%;
  height: 6px;
  background: var(--sys-bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
}

.modern-progress-fill {
  height: 100%;
  background: var(--text-secondary);
  border-radius: 3px;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.storage-modal-footer {
  display: flex;
  padding: 16px 24px;
  justify-content: flex-end;
  gap: 12px;
}

.modern-btn {
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.modern-btn.ghost {
  background: transparent;
  color: var(--text-tertiary);
}

.modern-btn.ghost:hover:not(:disabled) {
  background: var(--sys-bg-tertiary);
  color: var(--text-secondary);
}

.modern-btn.primary {
  background: var(--text-secondary);
  color: var(--sys-bg-secondary);
}

.modern-btn.primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.modern-btn.primary:active:not(:disabled) {
  transform: translateY(0);
}

.modern-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
