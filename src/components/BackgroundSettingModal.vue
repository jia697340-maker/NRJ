/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<template>
  <div class="modal-overlay" v-if="visible" @click.self="close">
    <div class="modal-content">
      <button class="close-btn" @click="close" aria-label="关闭">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      
      <h2 class="modal-title">设置底图</h2>

      <div class="tabs">
        <button class="tab-btn" :class="{ active: activeTab === 'image' }" @click="activeTab = 'image'">图片</button>
        <button class="tab-btn" :class="{ active: activeTab === 'color' }" @click="activeTab = 'color'">纯色</button>
      </div>
      
      <div v-show="activeTab === 'image'" class="tab-content">
        <div class="avatar-preview">
          <div style="width: 100%; height: 120px; border-radius: 12px; overflow: hidden; position: relative;">
            <img v-if="previewUrl" :src="previewUrl" class="bg-img" :style="{ filter: `blur(${blurValue}px)` }" />
            <div v-else class="bg-placeholder">无图片</div>
          </div>
        </div>

        <div class="upload-options">
          <div class="option-group">
            <label class="custom-file-upload">
              <input type="file" accept="image/*" @change="handleFileChange" class="hidden-file-input" />
              <span class="upload-btn-text">📁 点击选择本地图片</span>
            </label>
          </div>
          
          <div class="option-divider">或</div>
          
          <div class="option-group url-group">
            <label>🔗 网络URL：</label>
            <div class="url-input-wrap">
              <input type="text" v-model="inputUrl" placeholder="输入图片链接..." />
              <button @click="applyUrl" class="btn btn-small">应用</button>
            </div>
          </div>
        </div>

        <div class="slider-group">
          <label>模糊度: {{ blurValue }}px</label>
          <input type="range" min="0" max="20" v-model.number="blurValue" class="range-slider" />
        </div>
      </div>

      <div v-show="activeTab === 'color'" class="tab-content">
         <div class="color-preview" :style="{ backgroundColor: colorValue }"></div>
         <div class="color-options">
           <label>选择颜色：</label>
           <div class="color-input-wrap">
             <input type="color" v-model="colorValue" class="color-picker" />
             <input type="text" v-model="colorValue" class="color-text" />
           </div>
         </div>
      </div>
      
      <div class="modal-actions">
        <button @click="resetBg" class="btn btn-secondary">重置默认</button>
        <button @click="saveBg" class="btn btn-primary">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  currentType: 'default' | 'image' | 'color'
  currentUrl: string | null
  currentColor: string
  currentBlur: number
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'saved', config: { type: 'default' | 'image' | 'color', url: string | null, color: string, blur: number }): void
}>()

const activeTab = ref<'image' | 'color'>('image')
const previewUrl = ref<string | null>(null)
const inputUrl = ref('')
const colorValue = ref('#ffffff')
const blurValue = ref(0)
const isReset = ref(false)

watch(() => props.visible, (newVal) => {
  if (newVal) {
    activeTab.value = props.currentType === 'color' ? 'color' : 'image'
    previewUrl.value = props.currentUrl
    colorValue.value = props.currentColor || '#ffffff'
    blurValue.value = props.currentBlur || 0
    inputUrl.value = ''
    isReset.value = false
  }
})

const close = () => {
  emit('update:visible', false)
}

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      previewUrl.value = e.target?.result as string
      isReset.value = false
    }
    reader.readAsDataURL(file)
  }
}

const applyUrl = () => {
  if (inputUrl.value.trim()) {
    previewUrl.value = inputUrl.value.trim()
    isReset.value = false
  }
}

const resetBg = () => {
  isReset.value = true
  previewUrl.value = null
  inputUrl.value = ''
  colorValue.value = '#ffffff'
  blurValue.value = 0
}

const saveBg = () => {
  let type: 'default' | 'image' | 'color' = 'default'
  if (!isReset.value) {
    type = activeTab.value
  }
  emit('saved', {
    type,
    url: previewUrl.value,
    color: colorValue.value,
    blur: blurValue.value
  })
  close()
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: var(--sys-bg-secondary);
  border-radius: 24px;
  padding: 24px;
  width: 85%;
  max-width: 320px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  position: relative;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--sys-bg-primary);
  color: var(--text-secondary);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal-title {
  margin: 0;
  font-size: 18px;
  text-align: center;
  color: var(--text-primary);
  font-weight: 600;
}

.tabs {
  display: flex;
  gap: 8px;
  background: var(--sys-bg-primary);
  padding: 4px;
  border-radius: 12px;
}

.tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  padding: 8px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: var(--sys-bg-secondary);
  color: var(--text-primary);
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.avatar-preview {
  display: flex;
  justify-content: center;
}

.bg-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bg-placeholder {
  width: 100%;
  height: 100%;
  background: var(--sys-bg-primary);
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--text-tertiary);
  font-size: 14px;
  font-weight: 500;
}

.color-preview {
  width: 100%;
  height: 120px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.color-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.color-input-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-picker {
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: transparent;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker::-webkit-color-swatch {
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.color-text {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}

.color-text:focus {
  border-color: #3b82f6;
}

.upload-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #f9fafb;
  padding: 16px;
  border-radius: 16px;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.hidden-file-input {
  display: none;
}

.custom-file-upload {
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--sys-bg-secondary);
  border: 1px dashed var(--border-color);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.custom-file-upload:hover {
  background: var(--sys-bg-primary);
  border-color: var(--text-tertiary);
}

.option-divider {
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
  position: relative;
}

.option-divider::before,
.option-divider::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 40%;
  height: 1px;
  background: #e5e7eb;
}

.option-divider::before { left: 0; }
.option-divider::after { right: 0; }

.url-input-wrap {
  display: flex;
  gap: 8px;
}

.url-input-wrap input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  outline: none;
  font-size: 12px;
  width: 100%;
  min-width: 0;
}

.url-input-wrap input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.range-slider {
  width: 100%;
  accent-color: var(--text-primary);
}

.btn {
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  display: flex;
  justify-content: center;
  align-items: center;
}

.btn-small {
  padding: 0 12px;
  font-size: 12px;
  background: #e5e7eb;
  color: var(--text-secondary);
  border-radius: 8px;
  white-space: nowrap;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.btn-primary {
  background: #333333;
  color: white;
  flex: 1.5;
  padding: 12px;
  font-size: 14px;
}

.btn-secondary {
  background: var(--sys-bg-primary);
  color: var(--text-secondary);
  flex: 1;
  padding: 12px;
  font-size: 14px;
}
</style>
