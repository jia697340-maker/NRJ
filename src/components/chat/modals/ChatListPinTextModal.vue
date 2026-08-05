/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  tempPinText: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save'): void
  (e: 'update:tempPinText', val: string): void
}>()

const handleInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('update:tempPinText', target.value)
}
</script>

<template>
  <div class="canvas-modal-overlay" style="z-index: 10001;" @click.self="emit('close')">
    <div class="pin-text-edit-modal">
      <div class="ptem-header">
        <h3>修改置顶提醒</h3>
      </div>
      <div class="ptem-body">
        <input type="text" :value="tempPinText" @input="handleInput" class="ptem-input" placeholder="请输入置顶提醒文案" autofocus @keyup.enter="emit('save')" />
      </div>
      <div class="ptem-footer">
        <div class="ptem-btn cancel" @click="emit('close')">取消</div>
        <div class="ptem-btn confirm" @click="emit('save')">保存</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 置顶文案编辑弹窗 */
.pin-text-edit-modal {
  width: 320px;
  background: var(--sys-bg-secondary);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(0,0,0,0.15);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}
.ptem-header {
  padding: 18px 20px;
  background: transparent;
  border-bottom: 1px solid var(--border-color);
  text-align: center;
}
.ptem-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}
.ptem-body {
  padding: 24px 20px;
  background: transparent;
}
.ptem-input {
  width: 100%;
  padding: 14px 16px;
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  background: var(--sys-bg-secondary);
  color: var(--text-primary);
  font-size: 15px;
  outline: none;
  transition: all 0.2s ease;
  box-sizing: border-box;
}
.ptem-input:focus {
  border-color: #007aff;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
}
.ptem-footer {
  display: flex;
  border-top: 1px solid var(--border-color);
  background: transparent;
}
.ptem-btn {
  flex: 1;
  padding: 16px 0;
  text-align: center;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}
.ptem-btn:active {
  background: rgba(0,0,0,0.05);
}
.ptem-btn.cancel {
  color: var(--text-secondary);
  border-right: 1px solid var(--border-color);
  font-weight: 500;
}
.ptem-btn.confirm {
  color: #007aff;
  font-weight: 600;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.canvas-modal-overlay {
  z-index: 10001;
}
</style>
