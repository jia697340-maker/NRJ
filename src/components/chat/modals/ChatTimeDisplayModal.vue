/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  initialStyle: 'none' | 'hm' | 'hms'
  initialPosition: 'avatar_bottom' | 'bubble_outer' | 'name_side'
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', style: 'none' | 'hm' | 'hms', position: 'avatar_bottom' | 'bubble_outer' | 'name_side'): void
}>()

const selectedStyle = ref<'none' | 'hm' | 'hms'>(props.initialStyle)
const selectedPosition = ref<'avatar_bottom' | 'bubble_outer' | 'name_side'>(props.initialPosition)

watch(() => props.show, (newVal) => {
  if (newVal) {
    selectedStyle.value = props.initialStyle
    selectedPosition.value = props.initialPosition
  }
})

const handleSave = () => {
  emit('save', selectedStyle.value, selectedPosition.value)
  emit('close')
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>对话时间显示</h3>
        <button class="close-btn" @click="emit('close')">×</button>
      </div>
      <div class="modal-body">
        <div class="setting-group">
          <div class="setting-title">时间格式</div>
          <div class="radio-list">
            <label class="radio-item">
              <input type="radio" v-model="selectedStyle" value="none">
              <span class="radio-label">不显示</span>
            </label>
            <label class="radio-item">
              <input type="radio" v-model="selectedStyle" value="hm">
              <span class="radio-label">显示（时分）</span>
              <span class="radio-desc">例：12:30</span>
            </label>
            <label class="radio-item">
              <input type="radio" v-model="selectedStyle" value="hms">
              <span class="radio-label">显示（时分秒）</span>
              <span class="radio-desc">例：12:30:45</span>
            </label>
          </div>
        </div>

        <div class="setting-group" v-if="selectedStyle !== 'none'" style="margin-top: 24px;">
          <div class="setting-title">显示位置</div>
          <div class="radio-list">
            <label class="radio-item">
              <input type="radio" v-model="selectedPosition" value="avatar_bottom">
              <span class="radio-label">头像下方</span>
            </label>
            <label class="radio-item">
              <input type="radio" v-model="selectedPosition" value="bubble_outer">
              <span class="radio-label">气泡外侧</span>
            </label>
            <label class="radio-item">
              <input type="radio" v-model="selectedPosition" value="name_side">
              <span class="radio-label">昵称旁边</span>
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="cancel-btn" @click="emit('close')">取消</button>
        <button class="confirm-btn" @click="handleSave">确定</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: #fff;
  border-radius: 16px;
  width: 90%;
  max-width: 400px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}

.modal-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-title {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.radio-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 8px;
}

.radio-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.radio-item:hover {
  background: #fff;
}

.radio-item input[type="radio"] {
  margin: 0 12px 0 0;
  width: 18px;
  height: 18px;
  accent-color: #007aff;
}

.radio-label {
  font-size: 15px;
  color: #333;
  flex: 1;
}

.radio-desc {
  font-size: 13px;
  color: #999;
}

.modal-footer {
  padding: 16px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid #f0f0f0;
}

.cancel-btn, .confirm-btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  font-weight: 500;
  border: none;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
}

.confirm-btn {
  background: #007aff;
  color: #fff;
}

:global(body.dark-theme) .modal-content {
  background: #2c2c2e;
}
:global(body.dark-theme) .modal-header {
  border-bottom-color: #3a3a3c;
}
:global(body.dark-theme) .modal-header h3 {
  color: #fff;
}
:global(body.dark-theme) .radio-list {
  background: #1c1c1e;
}
:global(body.dark-theme) .radio-item:hover {
  background: #2c2c2e;
}
:global(body.dark-theme) .radio-label {
  color: #fff;
}
:global(body.dark-theme) .modal-footer {
  border-top-color: #3a3a3c;
}
:global(body.dark-theme) .cancel-btn {
  background: #3a3a3c;
  color: #fff;
}
</style>
