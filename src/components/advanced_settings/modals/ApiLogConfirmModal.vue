/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <Teleport defer to="#app">
    <Transition name="fade">
      <div v-if="show" class="modal-overlay" @click.self="emit('close')">
        <Transition name="scale">
          <div v-if="show" class="modal-content">
            <div class="modal-header">
              <h3>开启详细日志追踪</h3>
              <button class="close-btn" @click="emit('close')">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div class="modal-body">
              <div class="warning-icon">
                <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <p class="warning-text">开启该功能后，系统将在本地数据库中记录每一次 API 调用的详细信息（包括耗时、模型、Token 等）。</p>
              
              <ul class="info-list">
                <li>由于高频读写，在部分低端设备上可能会带来轻微性能开销。</li>
                <li>超出你设定的“最大保存条数”时，系统将<strong>自动清除</strong>最早的旧记录。</li>
                <li>当你再次关闭此开关时，系统也会<strong>自动清除</strong>当前保存的所有明细数据。</li>
              </ul>
              
              <p class="confirm-text">确定要开启吗？</p>
            </div>

            <div class="modal-footer">
              <button class="btn-cancel" @click="emit('close')">取消</button>
              <button class="btn-confirm" @click="emit('confirm')">确认开启</button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  background: var(--card-bg-solid);
  border-radius: 20px;
  width: 100%;
  max-width: 360px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.modal-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--sys-bg-tertiary);
  color: var(--text-primary);
}

.modal-body {
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.warning-icon {
  color: #ff9f43;
  margin-bottom: 16px;
}

.warning-text {
  font-size: 14px;
  color: var(--text-primary);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.info-list {
  text-align: left;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--sys-bg-secondary);
  padding: 12px 16px 12px 24px;
  border-radius: 12px;
  margin: 0 0 16px 0;
}

.info-list li {
  margin-bottom: 8px;
}

.info-list li:last-child {
  margin-bottom: 0;
}

.info-list strong {
  color: #ff6b6b;
}

.confirm-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
}

.modal-footer {
  padding: 16px 20px;
  display: flex;
  gap: 12px;
  border-top: 1px solid var(--border-color);
}

.btn-cancel, .btn-confirm {
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-cancel {
  background: var(--sys-bg-tertiary);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.btn-confirm {
  background: var(--primary-color, #007aff);
  color: white;
}

.btn-confirm:hover {
  filter: brightness(1.1);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}
</style>
