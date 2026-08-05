/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  show: boolean
  personaName: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm-keep'): void
  (e: 'confirm-unbind'): void
}>()
</script>

<template>
  <div v-if="show" class="modal-overlay" @click="emit('close')">
    <div class="modal-container pure-modal" @click.stop>
      <div class="modal-title">人设绑定冲突</div>
      
      <div class="modal-desc">
        你即将绑定的 <strong>{{ personaName }}</strong> 档案，目前已经被其他账号绑定。
      </div>
      <div class="modal-sub-desc">
        你想让两个账号共用这个身份，还是将其从原账号解绑并独占？
      </div>

      <div class="modal-actions">
        <!-- 保持共用 -->
        <div class="pure-btn default" @click="emit('confirm-keep')">保持共用</div>
        <!-- 独占绑定 -->
        <div class="pure-btn primary" @click="emit('confirm-unbind')">解绑原账号</div>
      </div>
      
      <!-- 右上角极简关闭按钮 -->
      <div class="pure-close-btn" @click="emit('close')">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255, 255, 255, 0.85); /* 极其干净的高斯模糊白底 */
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.pure-modal {
  width: 300px;
  background: #ffffff;
  border-radius: 20px; /* 大圆角 */
  padding: 32px 24px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.06);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid #f0f0f0;
}

.pure-close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999999;
  cursor: pointer;
  transition: all 0.2s;
}
.pure-close-btn:hover {
  background: #f5f5f5;
  color: #111111;
}

.modal-title {
  font-size: 18px;
  font-weight: 800;
  color: #111111;
  margin-bottom: 16px;
  text-align: center;
}

.modal-desc {
  font-size: 14px;
  color: #333333;
  text-align: center;
  line-height: 1.5;
  margin-bottom: 8px;
}
.modal-desc strong {
  font-weight: 700;
}

.modal-sub-desc {
  font-size: 13px;
  color: #888888;
  text-align: center;
  line-height: 1.5;
  margin-bottom: 28px;
}

.modal-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pure-btn {
  width: 100%;
  height: 44px;
  border-radius: 22px; /* 完全圆角按钮 */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.pure-btn.primary {
  background: #111111;
  color: #ffffff;
}
.pure-btn.primary:hover {
  background: #333333;
}

.pure-btn.default {
  background: #f5f5f5;
  color: #111111;
}
.pure-btn.default:hover {
  background: #e8e8e8;
}
</style>
