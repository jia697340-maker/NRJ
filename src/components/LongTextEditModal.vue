/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<template>
  <div class="modal-overlay" v-if="visible" @click.self="close">
    <div class="modal-content">
      <!-- 顶部导航栏 -->
      <div class="modal-header">
        <button class="nav-btn cancel-btn" @click="close">取消</button>
        <span class="nav-title">{{ title }}</span>
        <div style="display: flex; align-items: center; gap: 16px;">
          <!-- 纯净的搜索图标 -->
          <svg @click="toggleSearch" viewBox="0 0 24 24" width="20" height="20" stroke="var(--text-primary)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="cursor: pointer; opacity: 0.8;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <button class="nav-btn done-btn" @click="saveText">完成</button>
        </div>
      </div>

      <!-- 极简搜索栏 -->
      <transition name="slide-down">
        <div v-if="searchVisible" class="search-toolbar">
          <input 
            ref="searchInputRef"
            type="text" 
            class="search-input" 
            placeholder="在文本中查找..." 
            v-model="searchKeyword"
            @keydown.enter="findNext"
            @input="resetSearch"
          />
          <div class="search-actions">
            <span class="search-count" v-if="searchKeyword">{{ currentMatchIndex + 1 }} / {{ matchCount }}</span>
            <button class="search-btn" @click="findPrev" :disabled="!matchCount"><</button>
            <button class="search-btn" @click="findNext" :disabled="!matchCount">></button>
            <button class="search-btn close-search" @click="toggleSearch">×</button>
          </div>
        </div>
      </transition>
      
      <!-- 长文本编辑区 -->
      <div class="modal-body">
        <textarea 
          ref="textareaRef"
          v-model="inputText" 
          :placeholder="placeholder"
          class="canvas-textarea"
          spellcheck="false"
        ></textarea>
        
        <!-- 底部字数与重置工具栏 -->
        <div class="modal-footer-toolbar">
          <button 
            class="subtle-reset-btn" 
            @click="resetText"
            :class="{ invisible: inputText === defaultText }"
          >
            恢复默认
          </button>
          
          <div class="word-count">
            {{ textLength }} 字
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, watch, computed, nextTick } from 'vue'

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

// 查找功能相关状态
const searchVisible = ref(false)
const searchKeyword = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const matchIndices = ref<number[]>([])
const currentMatchIndex = ref(-1)

const textLength = computed(() => {
  return inputText.value.length
})

watch(() => props.visible, (newVal) => {
  if (newVal) {
    inputText.value = props.currentText || ''
    searchVisible.value = false
    searchKeyword.value = ''
    resetSearch()
    nextTick(() => {
      if (textareaRef.value) {
        textareaRef.value.focus()
      }
    })
  }
})

// 查找逻辑：利用 textarea 的 selectionStart/End 实现原生光标选中定位
const resetSearch = () => {
  matchIndices.value = []
  currentMatchIndex.value = -1
  if (!searchKeyword.value || !inputText.value) return
  
  const keyword = searchKeyword.value.toLowerCase()
  const text = inputText.value.toLowerCase()
  let startIndex = 0
  let index
  
  while ((index = text.indexOf(keyword, startIndex)) > -1) {
    matchIndices.value.push(index)
    startIndex = index + keyword.length
  }
}

const scrollToMatch = () => {
  if (matchIndices.value.length === 0 || !textareaRef.value) return
  
  const index = matchIndices.value[currentMatchIndex.value]
  const el = textareaRef.value
  
  // 设置光标选中
  el.focus()
  el.setSelectionRange(index, index + searchKeyword.value.length)
  
  // 简易的滚动定位：基于字符比例估算高度
  const ratio = index / inputText.value.length
  el.scrollTop = el.scrollHeight * ratio - el.clientHeight / 2
}

const findNext = () => {
  if (!searchKeyword.value) return
  if (matchIndices.value.length === 0) resetSearch()
  if (matchIndices.value.length === 0) return
  
  currentMatchIndex.value = (currentMatchIndex.value + 1) % matchIndices.value.length
  scrollToMatch()
}

const findPrev = () => {
  if (!searchKeyword.value) return
  if (matchIndices.value.length === 0) resetSearch()
  if (matchIndices.value.length === 0) return
  
  currentMatchIndex.value = (currentMatchIndex.value - 1 + matchIndices.value.length) % matchIndices.value.length
  scrollToMatch()
}

const matchCount = computed(() => matchIndices.value.length)

const toggleSearch = () => {
  searchVisible.value = !searchVisible.value
  if (searchVisible.value) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  } else {
    searchKeyword.value = ''
    resetSearch()
    textareaRef.value?.focus()
  }
}

const close = () => {
  emit('update:visible', false)
}

const resetText = () => {
  inputText.value = props.defaultText || ''
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
  /* 极致轻盈的纯色半透明遮罩，彻底移除耗能的 backdrop-filter */
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: center;
  align-items: center; /* 悬浮居中 */
  z-index: 10000;
  animation: fadeIn 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  /* 开启硬件加速 */
  transform: translateZ(0);
  will-change: opacity;
}

.is-dark .modal-overlay {
  background: rgba(0, 0, 0, 0.7);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  /* 浑然一体的纯净背景，彻底抛弃顶栏色块拼接感 */
  background: #f8f9fa;
  width: 92%;
  max-width: 600px;
  height: 85vh; /* 给予极大的编辑空间 */
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: scaleUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  transform: translateZ(0);
  will-change: transform, opacity;
}

.is-dark .modal-content {
  background: #1c1c1e;
  box-shadow: 0 20px 50px rgba(0,0,0,0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

@keyframes scaleUp {
  from { transform: scale(0.95) translateY(10px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  /* 去除生硬边框，融入整体 */
  background: transparent;
  flex-shrink: 0;
}

.nav-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 8px 4px;
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
  color: var(--theme-color, #007aff); /* 使用高级点缀色 */
  font-weight: 600;
}
.is-dark .done-btn {
  color: #0a84ff;
}

.nav-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}

/* 极简查找栏样式 */
.search-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.03);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
}
.is-dark .search-toolbar {
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 15px;
  color: var(--text-primary);
  padding: 0;
}

.search-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-count {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: monospace;
}

.search-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  font-family: monospace;
}
.search-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.close-search {
  font-size: 22px;
  line-height: 1;
  margin-left: 8px;
  color: var(--text-primary);
}

.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.2s ease-out;
}
.slide-down-enter-from, .slide-down-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

.modal-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 24px 16px; /* 优化边缘呼吸感 */
  overflow: hidden;
}

.canvas-textarea {
  flex: 1;
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 16px;
  font-weight: 400;
  color: var(--text-primary);
  text-align: left;
  padding: 0;
  resize: none;
  line-height: 1.7; /* 更优雅的阅读行高 */
  letter-spacing: 0.5px;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  transform: translateZ(0); /* 长文本滚动硬件加速，杜绝卡顿 */
}

/* 隐藏长文本编辑器的原生丑陋滚动条 */
.canvas-textarea::-webkit-scrollbar {
  display: none;
}
.canvas-textarea {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}

.canvas-textarea::placeholder {
  color: var(--text-tertiary);
  font-weight: 300;
}

.modal-footer-toolbar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.05); /* 极细柔和分割线 */
  margin-top: 12px;
}
.is-dark .modal-footer-toolbar {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.subtle-reset-btn {
  background: none;
  border: none;
  color: var(--text-tertiary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 0;
  transition: all 0.2s;
}

.subtle-reset-btn:active {
  color: var(--text-primary);
}

.invisible {
  opacity: 0;
  pointer-events: none;
}

.word-count {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: monospace;
  background: rgba(0, 0, 0, 0.04);
  padding: 6px 12px;
  border-radius: 16px;
  letter-spacing: 0.5px;
}
.is-dark .word-count {
  background: rgba(255, 255, 255, 0.08);
}
</style>
