/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'

const props = defineProps<{
  visible: boolean
  presetKey: string
  currentText: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'apply', text: string): void
  (e: 'save-current', text: string): void
  (e: 'reset-default'): void
}>()

const savedPresets = ref<{id: string, name: string, text: string}[]>([])

// 自定义弹窗状态
const promptModal = ref({
  visible: false,
  title: '',
  value: '',
  placeholder: '',
  type: 'text', // text, textarea
  onConfirm: (val: string) => {},
})

const loadPresets = () => {
  if (!props.presetKey) return
  const data = localStorage.getItem(`clingy_${props.presetKey}`)
  if (data) {
    try {
      savedPresets.value = JSON.parse(data)
    } catch(e) {
      savedPresets.value = []
    }
  } else {
    savedPresets.value = []
  }
}

const savePresets = () => {
  if (!props.presetKey) return
  localStorage.setItem(`clingy_${props.presetKey}`, JSON.stringify(savedPresets.value))
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadPresets()
  }
})

const close = () => {
  emit('update:visible', false)
}

const showPrompt = (title: string, placeholder: string, type: 'text'|'textarea', onConfirm: (val: string) => void) => {
  promptModal.value = {
    visible: true,
    title,
    value: '',
    placeholder,
    type,
    onConfirm
  }
}

const closePrompt = () => {
  promptModal.value.visible = false
}

const confirmPrompt = () => {
  if (!promptModal.value.value.trim()) {
    closePrompt()
    return
  }
  promptModal.value.onConfirm(promptModal.value.value)
  closePrompt()
}

const addNewPreset = () => {
  if (!props.currentText.trim()) {
    showToast('当前提示词为空，无法保存')
    return
  }
  showPrompt('存为新预设', '请输入预设名称', 'text', (name) => {
    savedPresets.value.push({
      id: Date.now().toString(),
      name,
      text: props.currentText
    })
    savePresets()
    showToast('保存成功')
  })
}

const applyPreset = (text: string) => {
  emit('apply', text)
  close()
}

const deletePreset = (id: string, event: Event) => {
  event.stopPropagation()
  savedPresets.value = savedPresets.value.filter(p => p.id !== id)
  savePresets()
}

const exportPresets = () => {
  const data = JSON.stringify(savedPresets.value)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(data).then(() => {
      showToast('已复制到剪贴板，您可以将其保存为文本文件。')
    }).catch(() => {
      showPrompt('导出预设', '复制以下内容', 'textarea', () => {})
      promptModal.value.value = data
    })
  } else {
    showPrompt('导出预设', '复制以下内容', 'textarea', () => {})
    promptModal.value.value = data
  }
}

const importPresets = () => {
  showPrompt('导入预设', '请粘贴预设数据 (JSON格式)', 'textarea', (data) => {
    try {
      const parsed = JSON.parse(data)
      if (Array.isArray(parsed)) {
        savedPresets.value = parsed
        savePresets()
        showToast('导入成功')
      } else {
        showToast('格式错误')
      }
    } catch(e) {
      showToast('导入失败，请检查数据格式。')
    }
  })
}

const resetDefault = () => {
  emit('reset-default')
  close()
}

// 简易的 Toast
const toast = ref({ visible: false, message: '' })
let toastTimer: any = null
const showToast = (msg: string) => {
  toast.value = { visible: true, message: msg }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value.visible = false
  }, 2000)
}
</script>

<template>
  <div class="modal-overlay" v-if="visible" @click.self="close">
    <div class="modal-content preset-modal">
      <div class="modal-header">
        <span class="nav-title">提示词预设</span>
        <button class="close-btn" @click="close">×</button>
      </div>

      <div class="preset-actions-bar">
        <button class="action-btn" @click="importPresets">导入</button>
        <button class="action-btn" @click="exportPresets">导出</button>
        <button class="action-btn primary" @click="addNewPreset">将当前保存为新预设</button>
      </div>

      <div class="preset-list">
        <div class="preset-item" v-for="preset in savedPresets" :key="preset.id" @click="applyPreset(preset.text)">
          <div class="preset-info">
            <span class="preset-name">{{ preset.name }}</span>
            <span class="preset-preview">{{ preset.text }}</span>
          </div>
          <button class="del-btn" @click.stop="deletePreset(preset.id, $event)">删除</button>
        </div>
        <div class="preset-empty" v-if="savedPresets.length === 0">
          暂无保存的预设方案
        </div>
      </div>

      <div class="modal-footer">
        <button class="reset-btn" @click="resetDefault">一键重置为系统默认提示词</button>
      </div>
    </div>

    <!-- 自定义输入/确认弹窗 -->
    <div class="custom-prompt-overlay" v-if="promptModal.visible" @click.self="closePrompt">
      <div class="custom-prompt-box">
        <div class="prompt-title">{{ promptModal.title }}</div>
        <div class="prompt-body">
          <input 
            v-if="promptModal.type === 'text'"
            type="text" 
            class="prompt-input" 
            v-model="promptModal.value" 
            :placeholder="promptModal.placeholder"
            @keyup.enter="confirmPrompt"
          >
          <textarea 
            v-else
            class="prompt-textarea" 
            v-model="promptModal.value" 
            :placeholder="promptModal.placeholder"
          ></textarea>
        </div>
        <div class="prompt-actions">
          <button class="p-btn cancel" @click="closePrompt">取消</button>
          <button class="p-btn confirm" @click="confirmPrompt">确定</button>
        </div>
      </div>
    </div>

    <transition name="toast-fade">
      <div v-if="toast.visible" class="preset-toast">{{ toast.message }}</div>
    </transition>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10001;
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.preset-modal {
  background: var(--sys-bg-secondary, #fff);
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  animation: slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.is-dark .preset-modal {
  background: #1c1c1e;
  border: 1px solid rgba(255,255,255,0.1);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.is-dark .modal-header {
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.nav-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0;
}

.preset-actions-bar {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  background: var(--sys-bg-primary, #f7f8fa);
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.is-dark .preset-actions-bar {
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.action-btn {
  background: rgba(0,0,0,0.05);
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}

.is-dark .action-btn {
  background: rgba(255,255,255,0.08);
}

.action-btn.primary {
  background: var(--theme-color, #5b8def);
  color: #fff;
  flex: 1;
}

.preset-list {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.preset-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(0,0,0,0.03);
  cursor: pointer;
  transition: background 0.2s;
}

.is-dark .preset-item {
  border-bottom: 1px solid rgba(255,255,255,0.03);
}

.preset-item:active {
  background: rgba(0,0,0,0.03);
}

.preset-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-right: 12px;
}

.preset-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.preset-preview {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.del-btn {
  background: none;
  border: none;
  color: #ff3b30;
  font-size: 13px;
  cursor: pointer;
  padding: 8px;
}

.preset-empty {
  padding: 30px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
}

.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid rgba(0,0,0,0.05);
}

.is-dark .modal-footer {
  border-top: 1px solid rgba(255,255,255,0.05);
}

.reset-btn {
  width: 100%;
  background: rgba(0,0,0,0.03);
  border: none;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
}

.is-dark .reset-btn {
  background: rgba(255,255,255,0.05);
}

/* 自定义弹窗样式 */
.custom-prompt-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10002;
}

.custom-prompt-box {
  background: var(--sys-bg-secondary, #fff);
  width: 80%;
  max-width: 320px;
  border-radius: 16px;
  overflow: hidden;
  animation: scaleUp 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.is-dark .custom-prompt-box {
  background: #2c2c2e;
}

.prompt-title {
  font-size: 17px;
  font-weight: 600;
  text-align: center;
  padding: 20px 20px 10px;
  color: var(--text-primary);
}

.prompt-body {
  padding: 0 20px 20px;
}

.prompt-input, .prompt-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #e5e5e5);
  border-radius: 8px;
  font-size: 15px;
  background: var(--sys-bg-primary, #f7f8fa);
  color: var(--text-primary);
  outline: none;
}

.is-dark .prompt-input, .is-dark .prompt-textarea {
  border-color: rgba(255,255,255,0.1);
  background: #1c1c1e;
}

.prompt-textarea {
  height: 120px;
  resize: none;
}

.prompt-actions {
  display: flex;
  border-top: 1px solid rgba(0,0,0,0.05);
}

.is-dark .prompt-actions {
  border-top: 1px solid rgba(255,255,255,0.05);
}

.p-btn {
  flex: 1;
  background: none;
  border: none;
  padding: 14px;
  font-size: 16px;
  cursor: pointer;
}

.p-btn.cancel {
  color: var(--text-secondary);
  border-right: 1px solid rgba(0,0,0,0.05);
}

.is-dark .p-btn.cancel {
  border-right: 1px solid rgba(255,255,255,0.05);
}

.p-btn.confirm {
  color: var(--theme-color, #5b8def);
  font-weight: 600;
}

.preset-toast {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.75);
  color: #fff;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 10003;
}

.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.2s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }
</style>
