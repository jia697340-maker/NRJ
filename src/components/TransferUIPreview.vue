/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { chatSettings } from '../store'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const selectStyle = (styleName: string) => {
  chatSettings.transferStyle = styleName
  emit('close')
}
</script>

<template>
  <div class="ui-preview-container">
    <header class="preview-header glass-header">
      <div class="back-btn" @click="emit('close')">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        返回
      </div>
      <h2 class="title">主题预览与选择</h2>
      <div style="width: 60px;"></div>
    </header>

    <main class="preview-scroll-area">

      <!-- ==============================================
           主题 1：仿微信 (WeChat Original) 
           ============================================== -->
      <section class="style-section">
        <div class="section-header">
          <div class="section-title">主题 1：仿微信</div>
          <button class="select-btn" :class="{ active: chatSettings.transferStyle === 'wechat' }" @click="selectStyle('wechat')">
            {{ chatSettings.transferStyle === 'wechat' ? '使用中' : '选择此主题' }}
          </button>
        </div>
        <div class="chat-mock-bg wechat-bg" @click="selectStyle('wechat')">
          
          <div class="chat-label">红包状态</div>
          
          <!-- 微信红包 - 待领取 -->
          <div class="msg-row right">
            <div class="wc-bubble-real active">
              <div class="wc-body-real">
                <div class="wc-rp-icon">
                  <div class="wc-rp-top"></div>
                  <div class="wc-rp-coin"></div>
                </div>
                <div class="wc-text-group">
                  <div class="wc-title-real">恭喜发财，大吉大利</div>
                </div>
              </div>
              <div class="wc-foot-real">微信红包</div>
            </div>
            <div class="avatar">我</div>
          </div>
          
          <!-- 微信红包 - 已领取 -->
          <div class="msg-row right">
            <div class="wc-bubble-real inactive">
              <div class="wc-body-real">
                <div class="wc-rp-icon inactive">
                  <div class="wc-rp-top inactive"></div>
                  <div class="wc-rp-coin inactive"></div>
                </div>
                <div class="wc-text-group">
                  <div class="wc-title-real">恭喜发财，大吉大利</div>
                  <div class="wc-sub-real">已领取</div>
                </div>
              </div>
              <div class="wc-foot-real">微信红包</div>
            </div>
            <div class="avatar">我</div>
          </div>

          <!-- 微信红包 - 已退回 -->
          <div class="msg-row right">
            <div class="wc-bubble-real inactive">
              <div class="wc-body-real">
                <div class="wc-rp-icon inactive">
                  <div class="wc-rp-top inactive"></div>
                  <div class="wc-rp-coin inactive"></div>
                </div>
                <div class="wc-text-group">
                  <div class="wc-title-real">恭喜发财，大吉大利</div>
                  <div class="wc-sub-real">已退回</div>
                </div>
              </div>
              <div class="wc-foot-real">微信红包</div>
            </div>
            <div class="avatar">我</div>
          </div>

          <!-- 微信红包 - 已过期 -->
          <div class="msg-row right">
            <div class="wc-bubble-real inactive">
              <div class="wc-body-real">
                <div class="wc-rp-icon inactive">
                  <div class="wc-rp-top inactive"></div>
                  <div class="wc-rp-coin inactive"></div>
                </div>
                <div class="wc-text-group">
                  <div class="wc-title-real">恭喜发财，大吉大利</div>
                  <div class="wc-sub-real">已超过24小时，红包已过期</div>
                </div>
              </div>
              <div class="wc-foot-real">微信红包</div>
            </div>
            <div class="avatar">我</div>
          </div>

          <div class="chat-label" style="margin-top: 24px;">转账状态</div>

          <!-- 微信转账 - 待收款 -->
          <div class="msg-row right">
            <div class="wc-bubble-real active">
              <div class="wc-body-real">
                <div class="wc-tf-icon active">
                  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none">
                    <polyline points="17 8 21 8 21 12"></polyline>
                    <path d="M3 8h18"></path>
                    <polyline points="7 16 3 16 3 12"></polyline>
                    <path d="M21 16H3"></path>
                  </svg>
                </div>
                <div class="wc-text-group">
                  <div class="wc-title-real">¥520.00</div>
                  <div class="wc-sub-real">转账给对方</div>
                </div>
              </div>
              <div class="wc-foot-real">微信转账</div>
            </div>
            <div class="avatar">我</div>
          </div>

          <!-- 微信转账 - 已收款 -->
          <div class="msg-row right">
            <div class="wc-bubble-real inactive">
              <div class="wc-body-real">
                <div class="wc-tf-icon inactive">
                  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div class="wc-text-group">
                  <div class="wc-title-real">¥520.00</div>
                  <div class="wc-sub-real">已被接收</div>
                </div>
              </div>
              <div class="wc-foot-real">微信转账</div>
            </div>
            <div class="avatar">我</div>
          </div>

          <!-- 微信转账 - 已退回 -->
          <div class="msg-row right">
            <div class="wc-bubble-real inactive">
              <div class="wc-body-real">
                <div class="wc-tf-icon inactive">
                  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
                </div>
                <div class="wc-text-group">
                  <div class="wc-title-real">¥520.00</div>
                  <div class="wc-sub-real">已退回</div>
                </div>
              </div>
              <div class="wc-foot-real">微信转账</div>
            </div>
            <div class="avatar">我</div>
          </div>

          <!-- 微信转账 - 已过期 -->
          <div class="msg-row right">
            <div class="wc-bubble-real inactive">
              <div class="wc-body-real">
                <div class="wc-tf-icon inactive">
                  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-15v6h5v-2h-3V7h-2z"/></svg>
                </div>
                <div class="wc-text-group">
                  <div class="wc-title-real">¥520.00</div>
                  <div class="wc-sub-real">已退还</div>
                </div>
              </div>
              <div class="wc-foot-real">微信转账</div>
            </div>
            <div class="avatar">我</div>
          </div>
        </div>
      </section>

      <!-- ==============================================
           主题 2：立式票据凭证风格 (Ticket Receipt) 
           ============================================== -->
      <section class="style-section">
        <div class="section-header">
          <div class="section-title">主题 2：立式票据凭证 (Ticket)</div>
          <button class="select-btn" :class="{ active: chatSettings.transferStyle === 'ticket' }" @click="selectStyle('ticket')">
            {{ chatSettings.transferStyle === 'ticket' ? '使用中' : '选择此主题' }}
          </button>
        </div>
        <div class="chat-mock-bg ticket-bg" @click="selectStyle('ticket')">
          
          <div class="chat-label" style="color: #666;">红包状态</div>

          <div class="ticket-grid">
            <!-- 票据红包 - 待领取 -->
            <div class="ticket-card active">
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

            <!-- 票据红包 - 已领取 -->
            <div class="ticket-card inactive">
              <div class="ticket-header">
                <span class="ticket-type">RED PACKET</span>
                <div class="ticket-status-dot claimed"></div>
              </div>
              <div class="ticket-body">
                <div class="ticket-amount">GIFT</div>
                <div class="ticket-remark">恭喜发财，大吉大利</div>
              </div>
              <div class="ticket-divider"></div>
              <div class="ticket-footer">
                <span class="ticket-id">STATUS</span>
                <span class="ticket-status-text">已领取 CLAIMED</span>
              </div>
            </div>

            <!-- 票据红包 - 已退回 -->
            <div class="ticket-card inactive">
              <div class="ticket-header">
                <span class="ticket-type">RED PACKET</span>
                <div class="ticket-status-dot returned"></div>
              </div>
              <div class="ticket-body">
                <div class="ticket-amount">GIFT</div>
                <div class="ticket-remark">恭喜发财，大吉大利</div>
              </div>
              <div class="ticket-divider"></div>
              <div class="ticket-footer">
                <span class="ticket-id">STATUS</span>
                <span class="ticket-status-text">已退回 RETURNED</span>
              </div>
            </div>

            <!-- 票据红包 - 已过期 -->
            <div class="ticket-card inactive">
              <div class="ticket-header">
                <span class="ticket-type">RED PACKET</span>
                <div class="ticket-status-dot expired"></div>
              </div>
              <div class="ticket-body">
                <div class="ticket-amount">GIFT</div>
                <div class="ticket-remark">恭喜发财，大吉大利</div>
              </div>
              <div class="ticket-divider"></div>
              <div class="ticket-footer">
                <span class="ticket-id">STATUS</span>
                <span class="ticket-status-text">已过期 EXPIRED</span>
              </div>
            </div>
          </div>

          <div class="chat-label" style="color: #666; margin-top: 24px;">转账状态</div>

          <div class="ticket-grid">
            <!-- 票据转账 - 待收款 -->
            <div class="ticket-card active">
              <div class="ticket-header">
                <span class="ticket-type">TRANSFER</span>
                <div class="ticket-status-dot pending"></div>
              </div>
              <div class="ticket-body">
                <div class="ticket-amount">¥ 520.00</div>
                <div class="ticket-remark">转账给对方</div>
              </div>
              <div class="ticket-divider"></div>
              <div class="ticket-footer">
                <span class="ticket-id">STATUS</span>
                <span class="ticket-status-text highlight">待收款 PENDING</span>
              </div>
            </div>

            <!-- 票据转账 - 已收款 -->
            <div class="ticket-card inactive">
              <div class="ticket-header">
                <span class="ticket-type">TRANSFER</span>
                <div class="ticket-status-dot claimed"></div>
              </div>
              <div class="ticket-body">
                <div class="ticket-amount">¥ 520.00</div>
                <div class="ticket-remark">已被接收</div>
              </div>
              <div class="ticket-divider"></div>
              <div class="ticket-footer">
                <span class="ticket-id">STATUS</span>
                <span class="ticket-status-text">已收款 RECEIVED</span>
              </div>
            </div>

            <!-- 票据转账 - 已退回 -->
            <div class="ticket-card inactive">
              <div class="ticket-header">
                <span class="ticket-type">TRANSFER</span>
                <div class="ticket-status-dot returned"></div>
              </div>
              <div class="ticket-body">
                <div class="ticket-amount">¥ 520.00</div>
                <div class="ticket-remark">已退回</div>
              </div>
              <div class="ticket-divider"></div>
              <div class="ticket-footer">
                <span class="ticket-id">STATUS</span>
                <span class="ticket-status-text">已退回 RETURNED</span>
              </div>
            </div>

            <!-- 票据转账 - 已过期 -->
            <div class="ticket-card inactive">
              <div class="ticket-header">
                <span class="ticket-type">TRANSFER</span>
                <div class="ticket-status-dot expired"></div>
              </div>
              <div class="ticket-body">
                <div class="ticket-amount">¥ 520.00</div>
                <div class="ticket-remark">已过期</div>
              </div>
              <div class="ticket-divider"></div>
              <div class="ticket-footer">
                <span class="ticket-id">STATUS</span>
                <span class="ticket-status-text">已过期 EXPIRED</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      <!-- ==============================================
           主题 3：毛玻璃悬浮流体卡片 (Glassmorphism) 
           ============================================== -->
      <section class="style-section">
        <div class="section-header">
          <div class="section-title">主题 3：现代毛玻璃流体 (Glass)</div>
          <button class="select-btn" :class="{ active: chatSettings.transferStyle === 'glass' }" @click="selectStyle('glass')">
            {{ chatSettings.transferStyle === 'glass' ? '使用中' : '选择此主题' }}
          </button>
        </div>
        <div class="chat-mock-bg glass-bg" @click="selectStyle('glass')">
          
          <div class="chat-label" style="color: rgba(255,255,255,0.7);">红包状态</div>

          <!-- 毛玻璃红包 - 待领取 -->
          <div class="msg-row right">
            <div class="glass-card">
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

          <!-- 毛玻璃红包 - 已领取 -->
          <div class="msg-row right">
            <div class="glass-card disabled">
              <div class="glass-content">
                <div class="glass-top">
                  <span class="glass-badge">RED PACKET</span>
                  <div class="glass-indicator static-gray"></div>
                </div>
                <div class="glass-main">
                  <h3 class="glass-title">恭喜发财，大吉大利</h3>
                  <div class="glass-sub">✓ 已被领取</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 毛玻璃红包 - 已退回 -->
          <div class="msg-row right">
            <div class="glass-card disabled">
              <div class="glass-content">
                <div class="glass-top">
                  <span class="glass-badge">RED PACKET</span>
                  <div class="glass-indicator static-gray"></div>
                </div>
                <div class="glass-main">
                  <h3 class="glass-title">恭喜发财，大吉大利</h3>
                  <div class="glass-sub">↩ 已被退回</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 毛玻璃红包 - 已过期 -->
          <div class="msg-row right">
            <div class="glass-card disabled">
              <div class="glass-content">
                <div class="glass-top">
                  <span class="glass-badge">RED PACKET</span>
                  <div class="glass-indicator static-gray"></div>
                </div>
                <div class="glass-main">
                  <h3 class="glass-title">恭喜发财，大吉大利</h3>
                  <div class="glass-sub">✕ 已过期失效</div>
                </div>
              </div>
            </div>
          </div>

          <div class="chat-label" style="color: rgba(255,255,255,0.7); margin-top: 24px;">转账状态</div>

          <!-- 毛玻璃转账 - 待收款 -->
          <div class="msg-row right">
            <div class="glass-card">
              <div class="glass-glow blue"></div>
              <div class="glass-content">
                <div class="glass-top">
                  <span class="glass-badge blue-highlight">TRANSFER</span>
                  <div class="glass-indicator pulse-blue"></div>
                </div>
                <div class="glass-main">
                  <h3 class="glass-amount">¥ 520.00</h3>
                  <div class="glass-remark">转账给对方</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 毛玻璃转账 - 已收款 -->
          <div class="msg-row right">
            <div class="glass-card disabled">
              <div class="glass-content">
                <div class="glass-top">
                  <span class="glass-badge">TRANSFER</span>
                  <div class="glass-indicator static-gray"></div>
                </div>
                <div class="glass-main">
                  <h3 class="glass-amount">¥ 520.00</h3>
                  <div class="glass-sub">✓ 已被接收</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 毛玻璃转账 - 已退回 -->
          <div class="msg-row right">
            <div class="glass-card disabled">
              <div class="glass-content">
                <div class="glass-top">
                  <span class="glass-badge">TRANSFER</span>
                  <div class="glass-indicator static-gray"></div>
                </div>
                <div class="glass-main">
                  <h3 class="glass-amount">¥ 520.00</h3>
                  <div class="glass-sub">↩ 已退回</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 毛玻璃转账 - 已过期 -->
          <div class="msg-row right">
            <div class="glass-card disabled">
              <div class="glass-content">
                <div class="glass-top">
                  <span class="glass-badge">TRANSFER</span>
                  <div class="glass-indicator static-gray"></div>
                </div>
                <div class="glass-main">
                  <h3 class="glass-amount">¥ 520.00</h3>
                  <div class="glass-sub">✕ 已过期退还</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <div style="height: 60px;"></div>
    </main>
  </div>
</template>

<style scoped>
.ui-preview-container {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: var(--sys-bg-primary, #f5f5f5);
  z-index: 99999;
  display: flex;
  flex-direction: column;
}
.is-dark .ui-preview-container {
  background: #1e1e1e;
}

.preview-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  z-index: 10;
}
.is-dark .preview-header {
  background: rgba(30, 30, 30, 0.8);
  border-bottom-color: rgba(255, 255, 255, 0.05);
}
.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  color: var(--text-primary);
}
.title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.preview-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.style-section {
  margin-bottom: 50px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  padding-left: 8px;
  border-left: 4px solid #1976d2;
}

.select-btn {
  background: var(--sys-bg-secondary);
  color: var(--theme-color, #1890ff);
  border: 1px solid var(--theme-color, #1890ff);
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.select-btn:active {
  background: rgba(0,0,0,0.05);
}
.is-dark .select-btn:active {
  background: rgba(255,255,255,0.05);
}
.select-btn.active {
  background: var(--theme-color, #1890ff);
  color: #fff;
  border-color: var(--theme-color, #1890ff);
}

.chat-mock-bg {
  border-radius: 16px;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: inset 0 2px 8px rgba(0,0,0,0.05);
}

.chat-label {
  text-align: center;
  font-size: 12px;
  margin: 8px 0;
}

.msg-row {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 12px;
}
.avatar {
  width: 40px;
  height: 40px;
  background: #fff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: #666;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  flex-shrink: 0;
}


/* ========================================================
   主题 1：仿微信 (WeChat Original)
   背景色：#ededed，气泡无阴影，纯正浅橙色
======================================================== */
.wechat-bg {
  background: #ebebeb;
}
.is-dark .wechat-bg { background: #222; }

/* 气泡本体 */
.wc-bubble-real {
  width: 236px;
  border-radius: 6px;
  position: relative;
  display: flex;
  flex-direction: column;
}
/* 颜色区分：待处理颜色稍微饱满一点点，失效颜色非常淡 */
.wc-bubble-real.active { background: #f89c36; }
.wc-bubble-real.inactive { background: #fcd2a9; }
.is-dark .wc-bubble-real.active { background: #d07d24; }
.is-dark .wc-bubble-real.inactive { background: rgba(252, 210, 169, 0.3); }

/* 小尾巴 */
.wc-bubble-real::after {
  content: "";
  position: absolute;
  top: 14px;
  right: -5px;
  border-width: 5px 0 5px 6px;
  border-style: solid;
}
.wc-bubble-real.active::after { border-color: transparent transparent transparent #f89c36; }
.wc-bubble-real.inactive::after { border-color: transparent transparent transparent #fcd2a9; }
.is-dark .wc-bubble-real.active::after { border-color: transparent transparent transparent #d07d24; }
.is-dark .wc-bubble-real.inactive::after { border-color: transparent transparent transparent rgba(252, 210, 169, 0.3); }

.wc-body-real {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 红包图标 (贴图复刻) */
.wc-rp-icon {
  width: 32px; height: 38px;
  background: #f04e3b;
  border-radius: 3px;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}
.wc-rp-icon.inactive { background: #f8c9b3; }

.wc-rp-top {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 16px;
  background: #ee4833;
  border-radius: 3px 3px 0 0;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}
.wc-rp-top.inactive { background: #f4bba0; }

.wc-rp-coin {
  position: absolute;
  top: 10px; left: 50%;
  transform: translateX(-50%);
  width: 12px; height: 12px;
  background: #f1cf5b;
  border-radius: 50%;
  border: 1px solid #d8aa32;
}
.wc-rp-coin.inactive { background: #fdf5d6; border-color: transparent; }

/* 转账图标 (细边圈) */
.wc-tf-icon {
  width: 36px; height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wc-tf-icon.active {
  border: 1.5px solid #fff;
  background: rgba(255,255,255,0.25);
  color: #fff;
}
.wc-tf-icon.inactive {
  border: 1.5px solid #fff;
  background: rgba(255,255,255,0.4);
  color: #fff;
}
.wc-tf-icon svg {
  width: 20px; height: 20px;
  stroke-width: 2.5;
}

/* 文字组 */
.wc-text-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.wc-title-real {
  color: #fff;
  font-size: 15px;
  line-height: 1.3;
  font-weight: 500;
  /* 微信是纯白字无阴影 */
}
.wc-sub-real {
  color: rgba(255,255,255,0.9);
  font-size: 12px;
  margin-top: 2px;
}

/* 底部脚注 */
.wc-foot-real {
  color: rgba(255,255,255,0.6);
  font-size: 10px;
  padding: 0 14px 6px 14px;
}


/* ========================================================
   主题 2：立式票据凭证风格 (Ticket Receipt)
   背景色：冷灰或米白
======================================================== */
.ticket-bg {
  background: #f0f0f3;
}
.is-dark .ticket-bg { background: #1a1a1a; }

.ticket-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}

.ticket-card {
  background: #fff;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 6px 16px rgba(0,0,0,0.06);
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.03);
}
.is-dark .ticket-card {
  background: #2a2a2a;
  border-color: rgba(255,255,255,0.05);
}

.ticket-header {
  padding: 12px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fafafa;
  border-bottom: 1px solid rgba(0,0,0,0.04);
}
.is-dark .ticket-header { background: #333; border-bottom-color: rgba(255,255,255,0.05); }

.ticket-type {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #999;
}

.ticket-status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
}
.ticket-status-dot.pending { background: #2ecc71; box-shadow: 0 0 8px rgba(46, 204, 113, 0.4); }
.ticket-status-dot.claimed { background: #bdc3c7; }
.ticket-status-dot.returned { background: #f39c12; }
.ticket-status-dot.expired { background: #e74c3c; }

.ticket-body {
  padding: 24px 14px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ticket-amount {
  font-size: 22px;
  font-weight: 800;
  color: #111;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  letter-spacing: -0.5px;
}
.is-dark .ticket-amount { color: #fff; }

.ticket-remark {
  font-size: 12px;
  color: #777;
}

/* 票据打孔虚线 */
.ticket-divider {
  height: 0;
  border-top: 1.5px dashed #e0e0e0;
  margin: 0 14px;
  position: relative;
}
.is-dark .ticket-divider { border-top-color: #444; }
.ticket-divider::before, .ticket-divider::after {
  content: "";
  position: absolute;
  top: -6px;
  width: 12px; height: 12px;
  background: #f0f0f3;
  border-radius: 50%;
}
.is-dark .ticket-divider::before, .is-dark .ticket-divider::after { background: #1a1a1a; }
.ticket-divider::before { left: -20px; }
.ticket-divider::after { right: -20px; }

.ticket-footer {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ticket-id {
  font-size: 9px;
  color: #aaa;
}
.ticket-status-text {
  font-size: 11px;
  font-weight: 600;
  color: #888;
}
.ticket-status-text.highlight { color: #111; }
.is-dark .ticket-status-text.highlight { color: #fff; }


/* ========================================================
   主题 3：毛玻璃悬浮流体卡片 (Glassmorphism)
   背景色：深邃带渐变的梦幻色彩
======================================================== */
.glass-bg {
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
  position: relative;
  overflow: hidden;
}
.is-dark .glass-bg {
  background: linear-gradient(135deg, #1f1c2c 0%, #928DAB 100%);
}
/* 增加背景流体圆块点缀 */
.glass-bg::before {
  content: ""; position: absolute;
  top: -20px; left: -20px; width: 100px; height: 100px;
  background: rgba(255,255,255,0.4); border-radius: 50%; filter: blur(30px);
}
.is-dark .glass-bg::before { background: rgba(255,255,255,0.1); }

.glass-card {
  width: 240px;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  padding: 16px 20px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
}
.is-dark .glass-card {
  background: rgba(30, 30, 30, 0.4);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.glass-card.disabled {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.is-dark .glass-card.disabled { background: rgba(30, 30, 30, 0.2); }

/* 内部流体微光 */
.glass-glow {
  position: absolute;
  top: -20px; right: -20px; width: 80px; height: 80px;
  background: radial-gradient(circle, rgba(255,77,79,0.3) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}
.glass-glow.blue { background: radial-gradient(circle, rgba(22,119,255,0.3) 0%, transparent 70%); }
.glass-card.disabled .glass-glow { display: none; }

.glass-content {
  position: relative;
  z-index: 1;
}

.glass-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.glass-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(0,0,0,0.05);
  color: rgba(0,0,0,0.6);
  letter-spacing: 0.5px;
}
.is-dark .glass-badge { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
.glass-badge.highlight { background: rgba(255,77,79,0.1); color: #ff4d4f; }
.glass-badge.blue-highlight { background: rgba(22,119,255,0.1); color: #1677ff; }

.glass-indicator {
  width: 6px; height: 6px;
  border-radius: 50%;
}
.pulse-green {
  background: #52c41a;
  box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.4);
  animation: pulseGreen 2s infinite;
}
.pulse-blue {
  background: #1677ff;
  box-shadow: 0 0 0 0 rgba(22, 119, 255, 0.4);
  animation: pulseBlue 2s infinite;
}
.static-gray { background: #bfbfbf; }

@keyframes pulseGreen {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(82, 196, 26, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(82, 196, 26, 0); }
}
@keyframes pulseBlue {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(22, 119, 255, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(22, 119, 255, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(22, 119, 255, 0); }
}

.glass-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.glass-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #222;
}
.glass-amount {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: #222;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.is-dark .glass-title, .is-dark .glass-amount { color: #fff; }

.glass-remark, .glass-sub {
  font-size: 12px;
  color: rgba(0,0,0,0.5);
}
.is-dark .glass-remark, .is-dark .glass-sub { color: rgba(255,255,255,0.5); }
.glass-card.disabled .glass-title, .glass-card.disabled .glass-amount {
  color: rgba(0,0,0,0.4);
}
.is-dark .glass-card.disabled .glass-title, .is-dark .glass-card.disabled .glass-amount {
  color: rgba(255,255,255,0.4);
}
</style>
