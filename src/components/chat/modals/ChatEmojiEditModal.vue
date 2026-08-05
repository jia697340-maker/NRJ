/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { EmojiItem } from '../../../composables/useChatEmoji'

const props = defineProps<{
  visible: boolean
  emoji: EmojiItem | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', id: string, updates: Partial<EmojiItem>): void
  (e: 'delete', id: string): void
}>()

const editName = ref('')
const editType = ref<'url' | 'local'>('url')
const editUrl = ref('')
const localFile = ref<File | null>(null)
const localPreviewUrl = ref('')

const handleClose = () => {
  emit('update:visible', false)
}

watch(() => props.visible, (val) => {
  if (val && props.emoji) {
    editName.value = props.emoji.name
    editType.value = props.emoji.type
    if (props.emoji.type === 'url') {
      editUrl.value = props.emoji.data as string
      localFile.value = null
      localPreviewUrl.value = ''
    } else {
      editUrl.value = ''
      localFile.value = props.emoji.data as File
      localPreviewUrl.value = props.emoji.previewUrl || ''
    }
  } else {
    // cleanup
    if (localPreviewUrl.value && editType.value === 'local' && !props.emoji) {
      URL.revokeObjectURL(localPreviewUrl.value)
    }
  }
})

const handleFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    const file = input.files[0]
    if (file.type.startsWith('image/')) {
      localFile.value = file
      if (localPreviewUrl.value && (!props.emoji || localPreviewUrl.value !== props.emoji.previewUrl)) {
        URL.revokeObjectURL(localPreviewUrl.value)
      }
      localPreviewUrl.value = URL.createObjectURL(file)
    } else {
      alert('请选择图片文件')
    }
  }
}

const currentPreview = computed(() => {
  if (editType.value === 'url') return editUrl.value
  return localPreviewUrl.value
})

const handleSave = () => {
  if (!props.emoji) return
  if (!editName.value.trim()) {
    alert('请输入表情包名称')
    return
  }
  
  const updates: Partial<EmojiItem> = {
    name: editName.value.trim(),
    type: editType.value
  }

  if (editType.value === 'url') {
    if (!editUrl.value.trim()) {
      alert('请输入图片 URL')
      return
    }
    updates.data = editUrl.value.trim()
  } else {
    if (!localFile.value) {
      alert('请选择本地图片')
      return
    }
    updates.data = localFile.value
  }

  emit('save', props.emoji.id, updates)
  handleClose()
}

const handleDelete = () => {
  if (!props.emoji) return
  if (confirm('确定要删除这个表情包吗？')) {
    emit('delete', props.emoji.id)
    handleClose()
  }
}
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="modal-overlay" @click.self="handleClose">
      <div class="modal-container">
        <header class="modal-header">
          <div class="header-left">
            <span class="close-btn" @click="handleClose">取消</span>
          </div>
          <div class="modal-title">编辑表情包</div>
          <div class="header-right">
            <span class="save-btn" @click="handleSave">保存</span>
          </div>
        </header>

        <div class="modal-content">
          <!-- 预览区域 -->
          <div class="preview-section">
            <div class="preview-box">
              <img v-if="currentPreview" :src="currentPreview" class="preview-img" />
              <div v-else class="preview-placeholder">无预览图</div>
            </div>
          </div>

          <!-- 表单区域 -->
          <div class="form-section">
            <div class="form-group">
              <label>名称</label>
              <input v-model="editName" type="text" class="input-field" placeholder="请输入名称" />
            </div>

            <div class="form-group">
              <label>来源</label>
              <div class="type-switch">
                <div 
                  class="type-tab" 
                  :class="{ active: editType === 'url' }"
                  @click="editType = 'url'"
                >网络 URL</div>
                <div 
                  class="type-tab" 
                  :class="{ active: editType === 'local' }"
                  @click="editType = 'local'"
                >本地图片</div>
              </div>
            </div>

            <div class="form-group" v-if="editType === 'url'">
              <input v-model="editUrl" type="text" class="input-field" placeholder="https://..." />
            </div>

            <div class="form-group" v-if="editType === 'local'">
              <div class="file-upload-btn">
                <input type="file" accept="image/*" @change="handleFileChange" class="file-input" />
                <div class="upload-text">{{ localFile ? '重新选择图片' : '选择图片文件' }}</div>
              </div>
            </div>
          </div>

          <!-- 底部删除按钮 -->
          <div class="delete-section">
            <button class="delete-btn" @click="handleDelete">删除此表情包</button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 10000;
  display: flex;
  align-items: flex-end;
}

.modal-container {
  width: 100%;
  height: 80%;
  background: #ffffff;
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.2);
}

.dark-theme .modal-container {
  background: #1e1e1e;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 56px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  font-size: 15px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 8px;
}

.save-btn {
  font-size: 15px;
  color: #3b82f6;
  cursor: pointer;
  padding: 8px;
  font-weight: 500;
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.preview-section {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.preview-box {
  width: 120px;
  height: 120px;
  border-radius: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-placeholder {
  color: var(--text-secondary);
  font-size: 14px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.input-field {
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s;
}

.input-field:focus {
  border-color: #3b82f6;
}

.type-switch {
  display: flex;
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 4px;
}

.type-tab {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  font-size: 14px;
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.type-tab.active {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.file-upload-btn {
  position: relative;
  padding: 12px;
  border-radius: 12px;
  border: 1px dashed var(--border-color);
  background: var(--bg-secondary);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.file-upload-btn:active {
  background: var(--border-color);
}

.file-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.upload-text {
  color: #3b82f6;
  font-size: 15px;
  font-weight: 500;
}

.delete-section {
  margin-top: 32px;
  padding-bottom: 20px;
}

.delete-btn {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  font-size: 16px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.delete-btn:active {
  background: rgba(239, 68, 68, 0.2);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
.fade-enter-active .modal-container {
  animation: slide-up-anim 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-leave-active .modal-container {
  animation: slide-up-anim 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse;
}

@keyframes slide-up-anim {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
</style>
