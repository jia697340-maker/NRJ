/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  messageId?: number
  messageObj?: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'multi-select', messageId?: number): void
  (e: 'recall-multi-select', messageId?: number): void
  (e: 'mark-message', messageId?: number): void
  (e: 'copy'): void
  (e: 'reply', messageId?: number): void
  (e: 'edit', messageId?: number): void
  (e: 'resummarize', messageId?: number): void
}>()

const showResummarizeInfo = ref(false)

// 当弹窗关闭时，重置状态
watch(() => props.visible, (newVal) => {
  if (!newVal) {
    showResummarizeInfo.value = false
  }
})

const handleOverlayClick = () => {
  emit('close')
}

const handleAction = (action: string) => {
  if (action === 'multi-select') {
    emit('multi-select', props.messageId)
  } else if (action === 'recall-multi-select') {
    emit('recall-multi-select', props.messageId)
  } else if (action === 'copy') {
    emit('copy')
  } else if (action === 'reply') {
    emit('reply', props.messageId)
  } else if (action === 'edit') {
    emit('edit', props.messageId)
  } else if (action === 'favorite') {
    emit('mark-message', props.messageId)
  } else if (action === 'forward') {
    // TODO: 实现具体的占位功能
    console.log(`[调试] 触发了功能: ${action}`)
  } else if (action === 'resummarize') {
    showResummarizeInfo.value = true
    return // 阻止弹窗关闭
  }
  emit('close')
}

const confirmResummarize = () => {
  emit('resummarize', props.messageId)
  emit('close')
}

const cancelResummarize = () => {
  showResummarizeInfo.value = false
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

        <!-- 返回/关闭按钮 -->
        <div v-if="showResummarizeInfo" class="ticket-close-btn back-btn" @click="cancelResummarize">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </div>
        <div v-else class="ticket-close-btn" @click="handleOverlayClick">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>
        
        <div v-if="showResummarizeInfo" class="resummarize-info-wrapper">
          <h3 class="info-title">重 新 识 图</h3>
          <div class="info-divider"></div>
          <div class="info-content">
            <p>由于连接异常，图像特征未成功解析。</p>
            <p>是否重新发起请求以生成记忆描述文本？</p>
          </div>
          <div class="info-actions">
            <button class="info-btn cancel" @click="cancelResummarize"><span class="btn-text">取 消</span></button>
            <button class="info-btn confirm" @click="confirmResummarize"><span class="btn-text">确 认 识 别</span></button>
          </div>
        </div>

        <div v-else class="ticket-actions-wrapper">
          <div class="ticket-actions-grid">
            
            <div class="action-item" @click="handleAction('recall-multi-select')">
              <div class="action-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="square" stroke-linejoin="miter">
                  <path d="M9 14L4 9l5-5" />
                  <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
                  <polyline points="14 4 18 8 14 12" opacity="0.3"></polyline>
                </svg>
              </div>
              <span class="action-label">多选撤回</span>
            </div>

            <div class="action-item" @click="handleAction('copy')">
              <div class="action-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="square" stroke-linejoin="miter">
                  <rect x="9" y="9" width="13" height="13"></rect>
                  <path d="M5 15H4V4h11v1"></path>
                </svg>
              </div>
              <span class="action-label">复 制</span>
            </div>

            <div class="action-item" @click="handleAction('edit')">
              <div class="action-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="square" stroke-linejoin="miter">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </div>
              <span class="action-label">编 辑</span>
            </div>

            <div class="action-item" @click="handleAction('multi-select')">
              <div class="action-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="square" stroke-linejoin="miter">
                  <polyline points="9 11 12 14 22 4"></polyline>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
              </div>
              <span class="action-label">多选删除</span>
            </div>

            <div class="action-item" @click="handleAction('reply')">
              <div class="action-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="square" stroke-linejoin="miter">
                  <polyline points="9 17 4 12 9 7"></polyline>
                  <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                </svg>
              </div>
              <span class="action-label">回 复</span>
            </div>

            <div class="action-item" @click="handleAction('forward')">
              <div class="action-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="square" stroke-linejoin="miter">
                  <polyline points="15 17 20 12 15 7"></polyline>
                  <path d="M4 18v-2a4 4 0 0 1 4-4h12"></path>
                </svg>
              </div>
              <span class="action-label">转 发</span>
            </div>

            <div class="action-item" @click="handleAction('favorite')">
              <div class="action-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="square" stroke-linejoin="miter">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </div>
              <span class="action-label">标记重要</span>
            </div>

            <div v-if="messageObj && ((messageObj.imageData && messageObj.imageData.imageId && !messageObj.imageData.summary) || (messageObj.isEmoji && !messageObj.emojiSummary))" class="action-item highlight" @click="handleAction('resummarize')">
              <div class="action-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="square" stroke-linejoin="miter">
                  <path d="M21 2v6h-6"></path>
                  <path d="M21 13a9 9 0 1 1-3-7.7L21 8"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </div>
              <span class="action-label">重新识图</span>
            </div>

          </div>
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
  /* 极度克制的高级阴影，纯白悬浮感 */
  box-shadow: 
    0 20px 40px -10px rgba(0, 0, 0, 0.08),
    0 0 1px rgba(0, 0, 0, 0.05);
  border-radius: 4px; /* 抛弃大圆角，采用稍微锋利的票据感 */
  overflow: hidden;
}

.is-dark .ticket-modal-container {
  background: #1a1a1a;
  box-shadow: 
    0 20px 40px -10px rgba(0, 0, 0, 0.3),
    0 0 1px rgba(255, 255, 255, 0.1);
}

/* 压凹印记/防伪线条 */
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

/* 打孔撕线 */
.ticket-perforation {
  position: absolute;
  left: 12px;
  right: 12px;
  height: 1px;
  /* 微小圆点虚线 */
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

/* 关闭按钮 */
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

/* 重新识图提示界面 */
.resummarize-info-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: ticketFadeIn 0.3s ease;
  padding-top: 8px;
}

.info-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 500;
  color: #333;
  letter-spacing: 2px;
}
.is-dark .info-title {
  color: #eee;
}

.info-divider {
  width: 40px;
  height: 1px;
  background-color: #e0e0e0;
  margin-bottom: 16px;
}
.is-dark .info-divider {
  background-color: #333;
}

.info-content {
  font-size: 13px;
  color: #777;
  line-height: 1.6;
  margin-bottom: 28px;
}
.info-content p {
  margin: 0 0 6px;
}
.is-dark .info-content {
  color: #999;
}

.info-actions {
  display: flex;
  gap: 16px;
  width: 100%;
}

.info-btn {
  flex: 1;
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

/* 按钮阵列 */
.ticket-actions-wrapper {
  width: 100%;
  margin-top: 8px;
}

.ticket-actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px 8px;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  position: relative;
  color: #666;
  transition: all 0.2s ease;
}

/* AVG风格悬停指示器 (左右细括号) */
.action-item::before, .action-item::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 0;
  border: 1px solid transparent;
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  opacity: 0;
}
.action-item::before {
  left: 0;
  border-right: none;
}
.action-item::after {
  right: 0;
  border-left: none;
}

.action-item:active {
  color: #333;
}
.action-item:active::before, .action-item:active::after {
  height: 24px;
  border-color: #d0d0d0;
  opacity: 1;
}
.is-dark .action-item:active {
  color: #eee;
}
.is-dark .action-item:active::before, .is-dark .action-item:active::after {
  border-color: #555;
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.action-item:active .action-icon {
  transform: scale(0.95);
}

.action-label {
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.5px;
}

/* 重新识图特殊高亮 */
.action-item.highlight {
  color: #3b82f6;
}
.action-item.highlight:active {
  color: #2563eb;
}
.action-item.highlight:active::before, .action-item.highlight:active::after {
  border-color: rgba(59, 130, 246, 0.4);
}
.is-dark .action-item.highlight {
  color: #60a5fa;
}

/* 动画 */
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

@keyframes ticketFadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
