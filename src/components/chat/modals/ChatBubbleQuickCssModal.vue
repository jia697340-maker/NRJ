<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  createBubblePreset,
  saveBubblePreset,
  validateBubbleCss,
  DEFAULT_BUBBLE_CSS,
  type BubblePreset
} from '../../../services/bubbleWorkshop'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: [preset: BubblePreset]
  toast: [msg: string]
}>()

const presetName = ref('自定义CSS气泡')
const customCss = ref(DEFAULT_BUBBLE_CSS)
const errorMsg = ref('')

const handleSave = () => {
  const name = presetName.value.trim() || '自定义CSS气泡'
  const css = customCss.value.trim()

  const err = validateBubbleCss(css)
  if (err) {
    errorMsg.value = err
    return
  }

  errorMsg.value = ''
  const preset = createBubblePreset(undefined, name)
  preset.customCss = css
  const saved = saveBubblePreset(preset)

  emit('saved', saved)
  emit('update:visible', false)
  emit('toast', `已成功创建「${name}」并应用`)
}
</script>

<template>
  <div v-if="visible" class="qc-backdrop" @click.self="emit('update:visible', false)">
    <div class="qc-modal">
      <header class="qc-header">
        <div>
          <h3>直接应用气泡 CSS</h3>
          <span>编写或粘贴 CSS 样式，即时保存为方案并应用</span>
        </div>
        <button class="qc-close" @click="emit('update:visible', false)">×</button>
      </header>

      <div class="qc-body">
        <div class="qc-field">
          <label>方案名称</label>
          <input v-model="presetName" class="qc-input" placeholder="输入气泡方案名称" maxlength="30" />
        </div>

        <div class="qc-field full">
          <div class="qc-field-head">
            <label>自定义 CSS 代码</label>
            <small>可使用 [data-chat-bubble="self"] 与 [data-chat-bubble="other"]</small>
          </div>
          <textarea
            v-model="customCss"
            class="qc-textarea"
            placeholder="在此输入或粘贴自定义 CSS..."
            rows="10"
            spellcheck="false"
          />
          <span v-if="errorMsg" class="qc-error">{{ errorMsg }}</span>
        </div>
      </div>

      <footer class="qc-footer">
        <button class="qc-btn-cancel" @click="emit('update:visible', false)">取消</button>
        <button class="qc-btn-save" @click="handleSave">保存并立即应用</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.qc-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(8px);
  padding: 16px;
  animation: qcFadeIn 0.2s ease-out;
}
.qc-modal {
  width: min(560px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--sys-bg-secondary, #ffffff);
  border-radius: 20px;
  box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
}
.qc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}
.qc-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
}
.qc-header span {
  font-size: 12px;
  color: var(--text-tertiary, #94a3b8);
  margin-top: 3px;
  display: block;
}
.qc-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--sys-bg-primary, #f1f5f9);
  color: var(--text-secondary, #64748b);
  border: none;
  font-size: 18px;
  cursor: pointer;
}
.qc-body {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}
.qc-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.qc-field-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.qc-field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #475569);
}
.qc-field small {
  font-size: 11px;
  color: var(--text-tertiary, #94a3b8);
}
.qc-input {
  height: 38px;
  padding: 0 12px;
  background: var(--sys-bg-primary, #f8fafc);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  border-radius: 10px;
  font-size: 14px;
  color: var(--text-primary, #1e293b);
  outline: none;
}
.qc-input:focus, .qc-textarea:focus {
  border-color: var(--theme-color, #4f7cff);
  background: #fff;
}
.qc-textarea {
  width: 100%;
  padding: 12px;
  background: var(--sys-bg-primary, #f8fafc);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  font-size: 12.5px;
  font-family: Consolas, Monaco, monospace;
  line-height: 1.5;
  color: var(--text-primary, #1e293b);
  outline: none;
  resize: vertical;
}
.qc-error {
  font-size: 12px;
  color: #ef4444;
}
.qc-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}
.qc-btn-cancel, .qc-btn-save {
  height: 38px;
  padding: 0 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.qc-btn-cancel {
  background: var(--sys-bg-primary, #f1f5f9);
  color: var(--text-secondary, #64748b);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
}
.qc-btn-save {
  background: var(--theme-color, #4f7cff);
  color: #fff;
  border: none;
}
@keyframes qcFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
</style>
