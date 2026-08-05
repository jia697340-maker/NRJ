/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { chatSettings } from '../../../store'

const props = defineProps<{
  tempPinBgUrl: string
  tempPinBgPosition: string
  tempPinBgBlur: number
  tempPinSvg: string
  selectedPresetIndex: string | number
  defaultPresetSvgs: any[]
  customPresetSvgs: any[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save'): void
  (e: 'open-bg-upload'): void
  (e: 'add-preset'): void
  (e: 'trigger-import'): void
  (e: 'export'): void
  (e: 'open-manage'): void
  (e: 'update:tempPinBgPosition', val: string): void
  (e: 'update:tempPinBgBlur', val: number): void
  (e: 'update:selectedPresetIndex', val: string | number): void
  (e: 'update:tempPinSvg', val: string): void
}>()

const handleSelectChange = (e: Event) => {
  const target = e.target as HTMLSelectElement
  const val = target.value === '' ? '' : Number(target.value)
  emit('update:selectedPresetIndex', val)
}

const handleSvgInput = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  emit('update:tempPinSvg', target.value)
}
</script>

<template>
  <div class="canvas-modal-overlay" style="z-index: 9990;" @click.self="emit('close')">
    <div class="beautify-modal">
      <div class="bm-header">
        <h3>顶栏美化</h3>
      </div>
      <div class="bm-body">
        <div class="bm-section">
          <label>顶栏背景</label>
          <div class="bm-input-group" style="align-items: center;">
            <div class="preview-bg-box" style="position: relative; overflow: hidden;">
              <div v-if="tempPinBgUrl" :style="{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: `url(${tempPinBgUrl})`, backgroundSize: 'cover', backgroundPosition: tempPinBgPosition, zIndex: 0 }"></div>
              <div v-if="tempPinBgUrl" :style="{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.4)', backdropFilter: `blur(${tempPinBgBlur}px)`, WebkitBackdropFilter: `blur(${tempPinBgBlur}px)`, zIndex: 1 }"></div>
              <span v-if="!tempPinBgUrl" style="color: var(--text-tertiary); font-size: 12px; z-index: 2; position: relative;">未设置</span>
            </div>
            <button class="bm-action-btn" style="flex: 1; padding: 10px;" @click="emit('open-bg-upload')">更换背景</button>
          </div>

          <div v-if="tempPinBgUrl" style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px;">
              <span style="color: var(--text-secondary);">图片位置</span>
              <select :value="tempPinBgPosition" @change="emit('update:tempPinBgPosition', ($event.target as HTMLSelectElement).value)" class="bm-select" style="width: auto; padding: 4px 8px; font-size: 13px;">
                <option value="top">顶部 (偏头)</option>
                <option value="center 20%">偏上 (脸部)</option>
                <option value="center">居中 (默认)</option>
                <option value="center 80%">偏下 (身体)</option>
                <option value="bottom">底部</option>
              </select>
            </div>
            
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px;">
              <span style="color: var(--text-secondary);">模糊程度 ({{ tempPinBgBlur }}px)</span>
              <input type="range" min="0" max="20" :value="tempPinBgBlur" @input="emit('update:tempPinBgBlur', Number(($event.target as HTMLInputElement).value))" style="flex: 1; margin-left: 12px;" />
            </div>
          </div>
        </div>
        
        <div class="bm-section" style="margin-top: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label style="margin-bottom: 0;">置顶图标设置</label>
            <div style="display: flex; gap: 8px;">
              <button class="bm-text-btn" @click="emit('add-preset')">存为预设</button>
              <button class="bm-text-btn" @click="emit('trigger-import')">导入</button>
              <button class="bm-text-btn" @click="emit('export')">导出</button>
              <button class="bm-text-btn" @click="emit('open-manage')">管理</button>
            </div>
          </div>
          
          <select :value="selectedPresetIndex" @change="handleSelectChange" class="bm-select">
            <option value="">-- 选择预设图标 (或在下方手动输入) --</option>
            <optgroup label="系统预设">
              <option v-for="(p, index) in defaultPresetSvgs" :key="'d-'+index" :value="index">{{ p.name }}</option>
            </optgroup>
            <optgroup label="自定义预设" v-if="customPresetSvgs.length > 0">
              <option v-for="(p, index) in customPresetSvgs" :key="'c-'+index" :value="defaultPresetSvgs.length + index">{{ p.name }}</option>
            </optgroup>
          </select>

          <textarea :value="tempPinSvg" @input="handleSvgInput" class="bm-textarea" placeholder="在此输入或编辑SVG代码..." style="margin-top: 12px;"></textarea>
        </div>
      </div>
      <div class="bm-footer">
        <div class="bm-btn cancel" @click="emit('close')">取消</div>
        <div class="bm-btn confirm" @click="emit('save')">保存</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 顶栏美化弹窗样式 */
.beautify-modal {
  width: 90%;
  max-width: 380px;
  background: var(--sys-bg-secondary);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(0,0,0,0.15);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}
.bm-header {
  padding: 18px 20px;
  background: transparent;
  border-bottom: 1px solid var(--border-color);
  text-align: center;
}
.bm-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}
.bm-body {
  padding: 24px 20px;
  background: transparent;
  max-height: 60vh;
  overflow-y: auto;
}
.bm-section label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.bm-input-group {
  display: flex;
  gap: 8px;
}
.bm-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--sys-bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  min-width: 0;
}
.bm-input:focus, .bm-textarea:focus {
  border-color: #007aff;
}
.bm-action-btn {
  padding: 0 12px;
  background: var(--sys-bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}
.bm-action-btn:active {
  background: #e0e0e0;
}
.bm-action-btn.danger {
  color: #ff3b30;
}
.bm-text-btn {
  background: transparent;
  border: none;
  color: #007aff;
  font-size: 13px;
  padding: 0;
  cursor: pointer;
}
.bm-text-btn:active {
  opacity: 0.6;
}
.bm-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--sys-bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  appearance: none;
}
.bm-select:focus {
  border-color: #007aff;
}
.preview-bg-box {
  width: 100px;
  height: 40px;
  border-radius: 8px;
  background-color: var(--sys-bg-secondary);
  border: 1px solid var(--border-color);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
}
.bm-textarea {
  width: 100%;
  height: 80px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--sys-bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  resize: none;
  font-family: monospace;
  box-sizing: border-box;
}
.bm-footer {
  display: flex;
  background: transparent;
  border-top: 1px solid var(--border-color);
}
.bm-btn {
  flex: 1;
  padding: 14px 0;
  text-align: center;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}
.bm-btn:active {
  background: rgba(0,0,0,0.05);
}
.bm-btn.cancel {
  color: var(--text-secondary);
  border-right: 1px solid var(--border-color);
  font-weight: 500;
}
.bm-btn.confirm {
  color: #007aff;
  font-weight: 600;
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.canvas-modal-overlay {
  z-index: 9999;
}
</style>
