/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<template>
  <Teleport to="body">
    <div class="nrt-text-edit-overlay" v-if="visible" @click.self="close">
      <div class="nrt-text-edit-content">
        <!-- 绝对稳定的头部导航栏 -->
        <div class="nrt-text-edit-header">
          <div class="nrt-text-btn-left" @click="close">取消</div>
          <div class="nrt-text-title">{{ title }}</div>
          <div class="nrt-text-btn-right" @click="saveText">完成</div>
        </div>
        
        <!-- 沉浸式排版输入区 -->
        <div class="nrt-text-edit-body">
          <div class="nrt-canvas-wrapper">
            <span class="nrt-quote-mark">“</span>
            <textarea 
              ref="textareaRef"
              v-model="inputText" 
              :placeholder="placeholder"
              class="nrt-canvas-textarea"
              spellcheck="false"
              @input="autoResize"
            ></textarea>
          </div>
          
          <!-- 极简重置操作 -->
          <button 
            class="nrt-subtle-reset-btn" 
            @click="resetText"
            :class="{ invisible: inputText === defaultText }"
          >
            恢复默认
          </button>
        </div>
      </div>
    </div>
  </Teleport>
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
/* 隔离所有样式，重写最坚固的排版 */
.nrt-text-edit-overlay * {
  box-sizing: border-box;
}

.nrt-text-edit-overlay {
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
  z-index: 9999;
  animation: nrtFadeIn 0.2s ease-out;
}

@keyframes nrtFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.nrt-text-edit-content {
  background: var(--sys-bg-secondary);
  border-radius: 20px;
  width: 85%;
  max-width: 320px;
  box-shadow: 0 24px 48px rgba(0,0,0,0.15);
  display: block; /* 放弃 flex 列布局，直接用 block */
  overflow: hidden;
  animation: nrtSlideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes nrtSlideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* 最核心的头部排版：绝对定位法 */
.nrt-text-edit-header {
  position: relative;
  height: 52px;
  border-bottom: 1px solid var(--border-color);
  width: 100%;
}

.nrt-text-btn-left,
.nrt-text-btn-right {
  position: absolute;
  top: 0;
  height: 52px;
  line-height: 52px;
  padding: 0 20px;
  font-size: 15px;
  cursor: pointer;
  white-space: nowrap; /* 绝对禁止换行 */
}

.nrt-text-btn-left {
  left: 0;
  color: var(--text-tertiary);
  font-weight: 400;
}

.nrt-text-btn-right {
  right: 0;
  color: var(--text-primary);
  font-weight: 600;
}

.nrt-text-btn-left:active,
.nrt-text-btn-right:active {
  opacity: 0.5;
}

.nrt-text-title {
  position: absolute;
  top: 0;
  left: 80px; /* 避开左按钮 */
  right: 80px; /* 避开右按钮 */
  height: 52px;
  line-height: 52px;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nrt-text-edit-body {
  padding: 30px 24px 40px;
  max-height: 60vh;
  overflow-y: auto;
  display: block;
}

.nrt-text-edit-body::-webkit-scrollbar {
  display: none;
}

.nrt-canvas-wrapper {
  position: relative;
  width: 100%;
  padding-left: 12px;
  border-left: 2px solid var(--border-color);
  margin-bottom: 30px;
}

.nrt-quote-mark {
  position: absolute;
  top: -15px;
  left: -8px;
  font-size: 40px;
  color: #e5e5e5;
  font-family: Georgia, serif;
  user-select: none;
  line-height: 1;
}

.nrt-canvas-textarea {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 17px;
  font-weight: 400;
  color: #2c2c2e;
  text-align: left;
  padding: 0;
  resize: none;
  line-height: 1.8;
  letter-spacing: 0.6px;
  min-height: 40px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  display: block;
}

.nrt-canvas-textarea::placeholder {
  color: #d1d1d6;
  font-weight: 300;
}

.nrt-subtle-reset-btn {
  background: none;
  border: none;
  color: #a1a1aa;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 12px;
  display: block;
  margin: 0 auto;
  transition: all 0.2s;
  letter-spacing: 0.5px;
}

.nrt-subtle-reset-btn:hover {
  color: var(--text-primary);
}

.invisible {
  opacity: 0;
  pointer-events: none;
}
</style>
