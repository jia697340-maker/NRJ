<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { GroupAnnouncement } from '../../../types/groupManagement'

const props = defineProps<{
  visible: boolean
  announcement?: GroupAnnouncement | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', data: { title: string; content: string; isPinned: boolean; needConfirm: boolean }): void
}>()

const title = ref('')
const content = ref('')
const isPinned = ref(false)
const needConfirm = ref(false)
const errorText = ref('')

watch(() => props.visible, (val) => {
  if (val) {
    if (props.announcement) {
      title.value = props.announcement.title
      content.value = props.announcement.content
      isPinned.value = !!props.announcement.isPinned
      needConfirm.value = !!props.announcement.needConfirm
    } else {
      title.value = ''
      content.value = ''
      isPinned.value = false
      needConfirm.value = false
    }
    errorText.value = ''
  }
})

const handleSave = () => {
  if (!title.value.trim()) {
    errorText.value = '请输入公告标题'
    return
  }
  if (!content.value.trim()) {
    errorText.value = '请输入公告正文'
    return
  }
  emit('save', {
    title: title.value.trim(),
    content: content.value.trim(),
    isPinned: isPinned.value,
    needConfirm: needConfirm.value
  })
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" @click.self="emit('close')">
    <div class="custom-confirm-modal announcement-edit-modal">
      <div class="confirm-title">{{ announcement ? '编辑群公告' : '发布新公告' }}</div>

      <div class="modal-form-content">
        <label class="form-item">
          <span class="item-label">公告标题</span>
          <input
            v-model="title"
            type="text"
            class="form-input"
            placeholder="例如：本周群活动说明"
            maxlength="40"
          />
        </label>

        <label class="form-item">
          <span class="item-label">公告正文</span>
          <textarea
            v-model="content"
            class="form-textarea"
            rows="6"
            placeholder="请在此输入公告的具体内容..."
          ></textarea>
        </label>

        <div class="form-switches">
          <div class="switch-row">
            <span class="switch-label">置顶此公告</span>
            <label class="switch">
              <input v-model="isPinned" type="checkbox">
              <span class="slider"></span>
            </label>
          </div>

          <div class="switch-row">
            <span class="switch-label">需要成员确认收到</span>
            <label class="switch">
              <input v-model="needConfirm" type="checkbox">
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div v-if="errorText" class="error-tip">{{ errorText }}</div>
      </div>

      <div class="confirm-actions">
        <div class="confirm-btn cancel" @click="emit('close')">取消</div>
        <div class="confirm-btn" @click="handleSave">发布</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.announcement-edit-modal {
  max-width: 380px;
  width: 90%;
  padding: 20px;
  background: #ffffff;
  border-radius: 16px;
}

.modal-form-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 14px 0 16px 0;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-label {
  font-size: 12px;
  font-weight: 600;
  color: #4a5568;
}

.form-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13.5px;
  outline: none;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #27ae60;
}

.form-textarea {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13.5px;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
}

.form-textarea:focus {
  border-color: #27ae60;
}

.form-switches {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.switch-label {
  font-size: 13px;
  color: #2c3e50;
}

.error-tip {
  font-size: 12px;
  color: #e74c3c;
  text-align: center;
}

/* 开关样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 42px;
  height: 24px;
}
.switch input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #e2e8f0;
  transition: .3s;
  border-radius: 24px;
}
.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}
input:checked + .slider { background-color: #27ae60; }
input:checked + .slider:before { transform: translateX(18px); }
</style>
