/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  messageId?: number
  initialContent?: string
  initialType?: string // 'left', 'right', 'system'
  hasMedia?: boolean // 是否包含图片、语音等多媒体信息
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { messageId?: number, content: string, type: string, clearMedia: boolean, action: 'replace' | 'insert_above' | 'insert_below' }): void
}>()

const editContent = ref('')
const editType = ref('left') // 默认对方
const willClearMedia = ref(false)

watch(() => props.visible, (newVal) => {
  if (newVal) {
    editContent.value = props.initialContent || ''
    editType.value = props.initialType || 'left'
    willClearMedia.value = false // 每次打开重置状态
  }
})

const handleOverlayClick = () => {
  emit('close')
}

const handleSave = (action: 'replace' | 'insert_above' | 'insert_below' = 'replace') => {
  emit('save', {
    messageId: props.messageId,
    content: editContent.value,
    type: editType.value,
    clearMedia: willClearMedia.value,
    action
  })
}

const handleClearMedia = () => {
  willClearMedia.value = true
  editContent.value = ''
}
</script>

<template>
  <transition name="ticket-fade">
    <div v-if="visible" class="ticket-modal-overlay" @click="handleOverlayClick" @touchmove.prevent>
      <div class="ticket-modal-container" @click.stop>
        
        <!-- 压凹印记/防伪线条 (极简) -->
        <div class="ticket-watermark">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4H8V6H4V4ZM16 4H20V6H16V4ZM4 18H8V20H4V18ZM16 18H20V20H16V18ZM10 10H14V14H10V10Z" fill="currentColor"/>
          </svg>
        </div>

        <!-- 顶部装饰虚线 -->
        <div class="ticket-perforation top-perf"></div>

        <!-- 关闭按钮 -->
        <div class="ticket-close-btn" @click="handleOverlayClick">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>

        <h3 class="info-title">编 辑 消 息</h3>
        <div class="info-divider"></div>

        <div class="edit-form">
          <div class="form-group">
            <label class="form-label">发送者身份</label>
            <div class="role-selector">
              <div class="role-option" :class="{ 'active': editType === 'left' }" @click="editType = 'left'">对方</div>
              <div class="role-option" :class="{ 'active': editType === 'right' }" @click="editType = 'right'">我</div>
              <div class="role-option" :class="{ 'active': editType === 'system' }" @click="editType = 'system'">旁白/系统</div>
            </div>
          </div>

          <div class="form-group">
            <div class="label-with-action">
              <label class="form-label">消息内容</label>
              <button 
                v-if="props.hasMedia && !willClearMedia" 
                class="clear-media-btn" 
                @click="handleClearMedia"
              >
                清除图片并置空
              </button>
              <span v-if="willClearMedia" class="media-cleared-text">多媒体将在保存后清除</span>
            </div>
            <textarea 
              v-model="editContent" 
              class="edit-textarea" 
              placeholder="请输入消息内容..."
              rows="5"
            ></textarea>
          </div>
        </div>

        <div class="info-actions-grid">
          <button class="info-btn cancel" @click="handleOverlayClick"><span class="btn-text">取 消</span></button>
          <button class="info-btn confirm" @click="handleSave('replace')"><span class="btn-text">替 换 覆 盖</span></button>
          <button class="info-btn insert" @click="handleSave('insert_above')"><span class="btn-text">向 上 插 入</span></button>
          <button class="info-btn insert" @click="handleSave('insert_below')"><span class="btn-text">向 下 插 入</span></button>
        </div>

        <!-- 底部打孔线 -->
        <div class="ticket-perforation bottom-perf"></div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.ticket-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.2);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.ticket-modal-container {
  position: relative;
  background: #ffffff;
  width: 85%;
  max-width: 320px;
  padding: 32px 24px 28px;
  box-shadow: 
    0 20px 40px -10px rgba(0, 0, 0, 0.08),
    0 0 1px rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.is-dark .ticket-modal-container {
  background: #1a1a1a;
  box-shadow: 
    0 20px 40px -10px rgba(0, 0, 0, 0.3),
    0 0 1px rgba(255, 255, 255, 0.1);
}

.ticket-watermark {
  position: absolute;
  top: 16px;
  right: 16px;
  color: #f4f4f4;
  opacity: 0.8;
  pointer-events: none;
}
.is-dark .ticket-watermark {
  color: #2a2a2a;
}

.ticket-perforation {
  position: absolute;
  left: 12px;
  right: 12px;
  height: 1px;
  background-image: linear-gradient(to right, #e8e8e8 40%, rgba(255,255,255,0) 20%);
  background-position: top;
  background-size: 5px 1px;
  background-repeat: repeat-x;
  opacity: 0.8;
}
.ticket-perforation.top-perf {
  top: 12px;
}
.ticket-perforation.bottom-perf {
  bottom: 12px;
}
.is-dark .ticket-perforation {
  background-image: linear-gradient(to right, #333 40%, rgba(255,255,255,0) 20%);
}

.ticket-close-btn {
  position: absolute;
  top: 16px;
  left: 16px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  cursor: pointer;
  z-index: 10;
  transition: color 0.2s ease;
}
.ticket-close-btn:hover, .ticket-close-btn:active {
  color: #333;
}
.is-dark .ticket-close-btn {
  color: #666;
}
.is-dark .ticket-close-btn:hover, .is-dark .ticket-close-btn:active {
  color: #ccc;
}

.info-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 500;
  color: #333;
  letter-spacing: 2px;
  text-align: center;
}
.is-dark .info-title {
  color: #eee;
}

.info-divider {
  width: 40px;
  height: 1px;
  background-color: #e0e0e0;
  margin-bottom: 20px;
}
.is-dark .info-divider {
  background-color: #333;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  margin-bottom: 28px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 12px;
  color: #777;
}
.is-dark .form-label {
  color: #999;
}

.label-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.clear-media-btn {
  font-size: 11px;
  color: #ef4444;
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.clear-media-btn:active {
  background: rgba(239, 68, 68, 0.1);
}

.media-cleared-text {
  font-size: 11px;
  color: #ef4444;
  font-style: italic;
}

.role-selector {
  display: flex;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 2px;
}
.is-dark .role-selector {
  border-color: #333;
}

.role-option {
  flex: 1;
  text-align: center;
  padding: 6px 0;
  font-size: 13px;
  color: #777;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.is-dark .role-option {
  color: #999;
}

.role-option.active {
  background: #f5f5f5;
  color: #333;
}
.is-dark .role-option.active {
  background: #333;
  color: #eee;
}

.edit-textarea {
  width: 100%;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #eee;
  background: transparent;
  color: #333;
  font-size: 13px;
  resize: none;
  outline: none;
  font-family: inherit;
  line-height: 1.5;
  transition: border-color 0.2s ease;
}
.is-dark .edit-textarea {
  border-color: #333;
  color: #eee;
}

.edit-textarea:focus {
  border-color: #ccc;
}
.is-dark .edit-textarea:focus {
  border-color: #555;
}

.info-actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
  width: 100%;
}

.info-btn {
  width: 100%;
  padding: 10px 0;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  position: relative;
  transition: all 0.2s ease;
  color: #555;
}

.info-btn::before, .info-btn::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 10px;
  border-left: 1px solid transparent;
  transition: all 0.2s ease;
}
.info-btn::before { left: 0; }
.info-btn::after { right: 0; }

.info-btn.cancel:active::before, .info-btn.cancel:active::after {
  border-color: #999;
  height: 14px;
}
.info-btn.confirm {
  color: #3b82f6;
}
.info-btn.confirm:active::before, .info-btn.confirm:active::after {
  border-color: #3b82f6;
  height: 14px;
}

.is-dark .info-btn {
  color: #aaa;
}
.is-dark .info-btn.confirm {
  color: #60a5fa;
}
.info-btn.insert {
  color: #10b981;
}
.info-btn.insert:active::before, .info-btn.insert:active::after {
  border-color: #10b981;
  height: 14px;
}
.is-dark .info-btn.insert {
  color: #34d399;
}

.ticket-fade-enter-active,
.ticket-fade-leave-active {
  transition: opacity 0.3s ease;
}
.ticket-fade-enter-active .ticket-modal-container {
  animation: ticketSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.ticket-fade-leave-active .ticket-modal-container {
  animation: ticketSlideDown 0.2s ease forwards;
}

.ticket-fade-enter-from,
.ticket-fade-leave-to {
  opacity: 0;
}

@keyframes ticketSlideUp {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes ticketSlideDown {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(10px); opacity: 0; }
}
</style>
