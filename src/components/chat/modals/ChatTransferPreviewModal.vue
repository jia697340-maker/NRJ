/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  visible: boolean
  currentStyle: 'wechat' | 'ticket' | 'glass'
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', style: 'wechat' | 'ticket' | 'glass'): void
}>()

const tempStyle = ref<'wechat' | 'ticket' | 'glass'>(props.currentStyle || 'wechat')

const closeModal = () => {
  emit('update:visible', false)
}

const saveStyle = () => {
  emit('save', tempStyle.value)
  closeModal()
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10000;" @click.self="closeModal">
    <div class="custom-confirm-modal" style="width: 90%; max-width: 360px;">
      <div class="confirm-title" style="margin-bottom: 12px; font-size: 16px;">选择红包/转账风格</div>
      
      <!-- 迷你预览区 -->
      <div class="mini-preview-area" :class="'preview-' + tempStyle">
        <!-- 微信原版预览 -->
        <div v-if="tempStyle === 'wechat'" class="mini-bubble-wrap wechat-bubble">
          <div class="wc-body-real">
            <div class="wc-rp-icon"><div class="wc-rp-top"></div><div class="wc-rp-coin"></div></div>
            <div class="wc-text-group">
              <div class="wc-title-real">恭喜发财，大吉大利</div>
            </div>
          </div>
          <div class="wc-foot-real">微信红包</div>
        </div>
        
        <!-- 票据预览 -->
        <div v-else-if="tempStyle === 'ticket'" class="mini-bubble-wrap ticket-card active">
          <div class="ticket-header">
            <span class="ticket-type">RED PACKET</span>
            <div class="ticket-status-dot pending"></div>
          </div>
          <div class="ticket-body">
            <div class="ticket-amount">GIFT</div>
            <div class="ticket-remark">恭喜发财，大吉大利</div>
          </div>
          <div class="ticket-divider"></div>
          <div class="ticket-footer">
            <span class="ticket-id">STATUS</span>
            <span class="ticket-status-text highlight">待领取 PENDING</span>
          </div>
        </div>
        
        <!-- 毛玻璃预览 -->
        <div v-else-if="tempStyle === 'glass'" class="mini-bubble-wrap glass-card">
          <div class="glass-glow"></div>
          <div class="glass-content">
            <div class="glass-top">
              <span class="glass-badge highlight">RED PACKET</span>
              <div class="glass-indicator pulse-green"></div>
            </div>
            <div class="glass-main">
              <h3 class="glass-title">恭喜发财，大吉大利</h3>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 选项列表 -->
      <div class="memory-type-options" style="padding: 0 16px 20px;">
        <div class="memory-type-item" :class="{ active: tempStyle === 'wechat' }" @click="tempStyle = 'wechat'" style="padding: 10px;">
          <div class="type-name" style="margin-bottom: 0;">仿微信</div>
        </div>
        <div class="memory-type-item" :class="{ active: tempStyle === 'ticket' }" @click="tempStyle = 'ticket'" style="padding: 10px;">
          <div class="type-name" style="margin-bottom: 0;">立式票据凭证 (Ticket)</div>
        </div>
        <div class="memory-type-item" :class="{ active: tempStyle === 'glass' }" @click="tempStyle = 'glass'" style="padding: 10px;">
          <div class="type-name" style="margin-bottom: 0;">现代毛玻璃流体 (Glass)</div>
        </div>
      </div>
      
      <div class="confirm-actions">
        <div class="confirm-btn cancel" @click="closeModal">取消</div>
        <div class="confirm-btn danger" style="color: var(--text-primary);" @click="saveStyle">确认</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wb-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-confirm-modal {
  background: var(--sys-bg-secondary);
  width: 80%;
  max-width: 320px;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  animation: modalScaleIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes modalScaleIn {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.confirm-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  margin-top: 24px;
}

.confirm-actions {
  display: flex;
  border-top: 1px solid var(--border-color);
}

.confirm-btn {
  flex: 1;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.confirm-btn:active {
  background: var(--sys-bg-primary);
}

.confirm-btn.cancel {
  color: var(--text-primary);
  border-right: 1px solid var(--border-color);
}

/* Memory Type Options */
.memory-type-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.memory-type-item {
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}
.memory-type-item.active {
  border-color: var(--text-primary);
  background: rgba(0,0,0,0.03);
}
.is-dark .memory-type-item.active {
  background: rgba(255,255,255,0.05);
}
.type-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

/* 迷你预览区样式 */
.mini-preview-area {
  height: 140px;
  margin: 0 16px 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s ease;
  overflow: hidden;
  position: relative;
}
.preview-wechat {
  background: #ebebeb;
}
.is-dark .preview-wechat { background: #222; }

.preview-ticket {
  background: #f0f0f3;
}
.is-dark .preview-ticket { background: #1a1a1a; }

.preview-glass {
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
}
.is-dark .preview-glass {
  background: linear-gradient(135deg, #1f1c2c 0%, #928DAB 100%);
}
.preview-glass::before {
  content: ""; position: absolute;
  top: -20px; left: -20px; width: 100px; height: 100px;
  background: rgba(255,255,255,0.4); border-radius: 50%; filter: blur(30px);
}
.is-dark .preview-glass::before { background: rgba(255,255,255,0.1); }

.mini-bubble-wrap {
  transform: scale(0.85); /* 整体缩小一点适应小弹窗 */
  transform-origin: center;
}

/* 微信原版复刻样式 */
.wechat-bubble {
  width: 236px;
  border-radius: 6px;
  position: relative;
  display: flex;
  flex-direction: column;
  background: #f89c36;
}
.is-dark .wechat-bubble { background: #d07d24; }
.wechat-bubble::after {
  content: ""; position: absolute; top: 14px; right: -5px;
  border-width: 5px 0 5px 6px; border-style: solid; border-color: transparent transparent transparent #f89c36;
}
.is-dark .wechat-bubble::after { border-color: transparent transparent transparent #d07d24; }
.wc-body-real { padding: 12px 14px; display: flex; align-items: center; gap: 10px; }
.wc-rp-icon { width: 32px; height: 38px; background: #f04e3b; border-radius: 3px; position: relative; overflow: hidden; flex-shrink: 0; }
.wc-rp-top { position: absolute; top: 0; left: 0; width: 100%; height: 16px; background: #ee4833; border-radius: 3px 3px 0 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
.wc-rp-coin { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: 12px; height: 12px; background: #f1cf5b; border-radius: 50%; border: 1px solid #d8aa32; }
.wc-text-group { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.wc-title-real { color: #fff; font-size: 15px; line-height: 1.3; font-weight: 500; }
.wc-foot-real { color: rgba(255,255,255,0.6); font-size: 10px; padding: 0 14px 6px 14px; }

/* 票据样式 */
.ticket-card {
  width: 140px; background: #fff; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 6px 16px rgba(0,0,0,0.06); position: relative; border: 1px solid rgba(0,0,0,0.03);
}
.is-dark .ticket-card { background: #2a2a2a; border-color: rgba(255,255,255,0.05); }
.ticket-header { padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; background: #fafafa; border-bottom: 1px solid rgba(0,0,0,0.04); }
.is-dark .ticket-header { background: #333; border-bottom-color: rgba(255,255,255,0.05); }
.ticket-type { font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #999; }
.ticket-status-dot.pending { width: 6px; height: 6px; border-radius: 50%; background: #2ecc71; box-shadow: 0 0 6px rgba(46, 204, 113, 0.4); }
.ticket-body { padding: 16px 10px; text-align: center; display: flex; flex-direction: column; gap: 4px; }
.ticket-amount { font-size: 16px; font-weight: 800; color: #111; font-family: sans-serif; letter-spacing: -0.5px; }
.is-dark .ticket-amount { color: #fff; }
.ticket-remark { font-size: 10px; color: #777; }
.ticket-divider { height: 0; border-top: 1.5px dashed #e0e0e0; margin: 0 10px; position: relative; }
.is-dark .ticket-divider { border-top-color: #444; }
.ticket-divider::before, .ticket-divider::after { content: ""; position: absolute; top: -5px; width: 10px; height: 10px; background: #f0f0f3; border-radius: 50%; }
.is-dark .ticket-divider::before, .is-dark .ticket-divider::after { background: #1a1a1a; }
.ticket-divider::before { left: -15px; }
.ticket-divider::after { right: -15px; }
.ticket-footer { padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
.ticket-id { font-size: 8px; color: #aaa; }
.ticket-status-text { font-size: 9px; font-weight: 600; color: #888; }
.ticket-status-text.highlight { color: #111; }
.is-dark .ticket-status-text.highlight { color: #fff; }

/* 毛玻璃样式 */
.glass-card {
  width: 200px; background: rgba(255, 255, 255, 0.25); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.4); padding: 12px 16px; position: relative; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
}
.is-dark .glass-card { background: rgba(30, 30, 30, 0.4); border-color: rgba(255, 255, 255, 0.1); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2); }
.glass-glow { position: absolute; top: -20px; right: -20px; width: 60px; height: 60px; background: radial-gradient(circle, rgba(255,77,79,0.3) 0%, transparent 70%); border-radius: 50%; pointer-events: none; }
.glass-content { position: relative; z-index: 1; }
.glass-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.glass-badge { font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 10px; background: rgba(0,0,0,0.05); color: rgba(0,0,0,0.6); }
.is-dark .glass-badge { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
.glass-badge.highlight { background: rgba(255,77,79,0.1); color: #ff4d4f; }
.glass-indicator { width: 5px; height: 5px; border-radius: 50%; }
.pulse-green { background: #52c41a; box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.4); animation: pulseGreen 2s infinite; }
@keyframes pulseGreen { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(82, 196, 26, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(82, 196, 26, 0); } }
.glass-main { display: flex; flex-direction: column; gap: 4px; }
.glass-title { margin: 0; font-size: 13px; font-weight: 600; color: #222; }
.is-dark .glass-title { color: #fff; }
</style>
