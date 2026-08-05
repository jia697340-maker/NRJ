/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<template>
  <div class="modal-overlay" v-if="visible" @click.self="close">
    <div class="modal-content">
      <!-- 顶部导航栏式排版 -->
      <div class="modal-header">
        <button class="nav-btn cancel-btn" @click="close">取消</button>
        <span class="nav-title">{{ title }}</span>
        <button class="nav-btn done-btn" @click="saveText">完成</button>
      </div>
      
      <!-- 沉浸式排版输入区 -->
      <div class="modal-body">
        <div class="canvas-wrapper">
          <span class="quote-mark">“</span>
          <textarea 
            ref="textareaRef"
            v-model="inputText" 
            :placeholder="placeholder"
            class="canvas-textarea"
            spellcheck="false"
            @input="autoResize"
          ></textarea>
        </div>
        
        <!-- 极简重置操作 -->
        <button 
          class="subtle-reset-btn" 
          @click="resetText"
          :class="{ invisible: inputText === defaultText }"
        >
          恢复默认
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  visible: boolean
  title: string
  currentText: string
  defaultText: string
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'saved', text: string): void
}>()

const inputText = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const autoResize = () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = textareaRef.value.scrollHeight + 'px'
  }
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    inputText.value = props.currentText
    nextTick(() => {
      autoResize()
    })
  }
})

watch(() => inputText.value, () => {
  nextTick(() => {
    autoResize()
  })
})

const close = () => {
  emit('update:visible', false)
}

const resetText = () => {
  inputText.value = props.defaultText
}

const saveText = () => {
  const finalVal = inputText.value.trim() !== '' ? inputText.value.trim() : props.defaultText
  emit('saved', finalVal)
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
  border-radius: 20px;
  width: 85%;
  max-width: 320px;
  box-shadow: 0 24px 48px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
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
  border-bottom: 1px solid var(--border-color);
}

.nav-btn {
  background: none;
  border: none;
  font-size: 15px;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.2s;
}

.nav-btn:active {
  opacity: 0.5;
}

.cancel-btn {
  color: var(--text-tertiary);
  font-weight: 400;
}

.done-btn {
  color: var(--text-primary);
  font-weight: 600;
}

.nav-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.3px;
}

.modal-body {
  padding: 30px 24px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
  max-height: 60vh;
  overflow-y: auto;
}

.modal-body::-webkit-scrollbar {
  display: none; /* 隐藏主区域滚动条，保持纯净 */
}

.canvas-wrapper {
  position: relative;
  width: 100%;
  padding-left: 12px;
  border-left: 2px solid var(--border-color); /* 左侧优雅装饰线 */
}

.quote-mark {
  position: absolute;
  top: -15px;
  left: -8px;
  font-size: 40px;
  color: #e5e5e5;
  font-family: Georgia, serif;
  user-select: none;
  line-height: 1;
}

.canvas-textarea {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 17px;
  font-weight: 400;
  color: #2c2c2e; /* 高级石墨灰 */
  text-align: left;
  padding: 0;
  resize: none;
  line-height: 1.8;
  letter-spacing: 0.6px;
  min-height: 40px;
  overflow: hidden; /* 彻底消灭内部滚动条 */
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  box-sizing: border-box;
}

.canvas-textarea::placeholder {
  color: #d1d1d6;
  font-weight: 300;
}

.subtle-reset-btn {
  background: none;
  border: none;
  color: #a1a1aa;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 12px;
  transition: all 0.2s;
  letter-spacing: 0.5px;
}

.subtle-reset-btn:hover {
  color: var(--text-primary);
}

.invisible {
  opacity: 0;
  pointer-events: none;
}
</style>
