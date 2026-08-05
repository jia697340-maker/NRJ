/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'manual-create'): void
  (e: 'import-create'): void
  (e: 'import-doc-create'): void
}>()
</script>

<template>
  <div class="canvas-modal-overlay create-choice-overlay" @click.self="emit('close')">
    <div class="create-choice-modal">
      <div class="ccm-header">
        <div class="ccm-header-titles">
          <span class="ccm-en-title">NEW CONNECTION</span>
          <h3 class="ccm-zh-title">选择新建方式</h3>
        </div>
        <div class="ccm-close" @click="emit('close')">
          <span>CLOSE</span>
        </div>
      </div>
      
      <div class="ccm-options">
        <div class="ccm-option-card" @click="emit('manual-create')">
          <div class="ccm-number">01</div>
          <div class="ccm-info">
            <h4>手动新建</h4>
            <p>从零开始创建专属联系人</p>
          </div>
        </div>
        
        <div class="ccm-option-card" @click="emit('import-create')">
          <div class="ccm-number">02</div>
          <div class="ccm-info">
            <h4>导入角色卡</h4>
            <p>支持 SillyTavern JSON/PNG</p>
          </div>
        </div>

        <div class="ccm-option-card" @click="emit('import-doc-create')">
          <div class="ccm-number">03</div>
          <div class="ccm-info">
            <h4>导入文档</h4>
            <p>支持 TXT / MD / DOCX 解析</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.canvas-modal-overlay {
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 极简风遮罩背景 */
.create-choice-overlay {
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  background: rgba(0, 0, 0, 0.2);
}

.create-choice-modal {
  width: 90%;
  max-width: 380px;
  background: var(--sys-bg-primary, #ffffff);
  border-radius: 20px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  padding: 32px 24px;
  animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.ccm-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
}

.ccm-header-titles {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ccm-en-title {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--text-tertiary, #999);
  font-weight: 700;
  font-family: "Helvetica Neue", Arial, sans-serif;
}

.ccm-zh-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary, #333);
  letter-spacing: 1px;
}

/* 文字关闭按钮 */
.ccm-close {
  cursor: pointer;
  padding: 6px 12px;
  border: 1px solid var(--border-color, #eee);
  border-radius: 20px;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.ccm-close span {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, #666);
  letter-spacing: 1px;
  font-family: "Helvetica Neue", Arial, sans-serif;
}

.ccm-close:hover {
  background: var(--text-primary, #333);
  border-color: var(--text-primary, #333);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.ccm-close:hover span {
  color: var(--sys-bg-primary, #fff);
}

.ccm-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 选项卡片设计 */
.ccm-option-card {
  position: relative;
  display: flex;
  align-items: center;
  padding: 24px 20px;
  border: 1px solid var(--border-color, #eee);
  border-radius: 16px;
  cursor: pointer;
  background: var(--sys-bg-secondary, #fafafa);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.ccm-option-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.06);
  background: var(--sys-bg-primary, #fff);
  border-color: var(--text-primary, #333);
}

/* 左侧大数字 */
.ccm-number {
  font-size: 36px;
  font-weight: 300;
  color: var(--border-color, #e0e0e0);
  font-family: "Helvetica Neue", Arial, sans-serif;
  margin-right: 20px;
  transition: all 0.4s ease;
}

.ccm-option-card:hover .ccm-number {
  color: var(--text-primary, #333);
  transform: scale(1.05);
}

.ccm-info {
  flex: 1;
  z-index: 1;
}

.ccm-info h4 {
  margin: 0 0 6px 0;
  font-size: 16px;
  color: var(--text-primary, #333);
  font-weight: 600;
  letter-spacing: 0.5px;
}

.ccm-info p {
  margin: 0;
  font-size: 12px;
  color: var(--text-tertiary, #999);
  line-height: 1.4;
}

/* 适配暗黑模式的变量兼容 */
@media (prefers-color-scheme: dark) {
  .create-choice-overlay {
    background: rgba(0, 0, 0, 0.4);
  }
}

@keyframes slideUpFade {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
