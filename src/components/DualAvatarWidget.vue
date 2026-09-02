/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<template>
  <div class="dual-avatar-widget">
    <div class="avatars-container">
      <div class="user-block">
        <div 
          class="avatar avatar-left" 
          :style="leftAvatar ? { backgroundImage: `url(${leftAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
          @click="openModal('left')"
        ></div>
        <span class="username editable-text" @click="openTextModal('leftName')">{{ leftName }}</span>
      </div>
      <div class="user-block">
        <div 
          class="avatar avatar-right" 
          :style="rightAvatar ? { backgroundImage: `url(${rightAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
          @click="openModal('right')"
        ></div>
        <span class="username editable-text" @click="openTextModal('rightName')">{{ rightName }}</span>
      </div>
    </div>
    
    <div class="text-container">
      <span class="typewriter-text editable-text" @click="openTextModal('slogan')">{{ slogan }}</span>
    </div>

    <!-- 挂载到 body 避免受到 Widget 本身层级或 overflow 影响 -->
    <Teleport to="body">
      <AvatarUploadModal 
        v-model:visible="modalVisible" 
        :current-avatar="editingAvatar === 'left' ? leftAvatar : rightAvatar"
        enable-crop
        @saved="handleAvatarSaved" 
      />
      
      <TextEditModal
        v-model:visible="textModalVisible"
        :title="currentTextEditConfig.title"
        :current-text="currentTextEditConfig.currentText"
        :default-text="currentTextEditConfig.defaultText"
        :placeholder="currentTextEditConfig.placeholder"
        @saved="handleTextSaved"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import AvatarUploadModal from './AvatarUploadModal.vue'
import TextEditModal from './TextEditModal.vue'
import { defaultWidgetConfig, useWidgetInstances, type DualAvatarWidgetConfig } from '../composables/useWidgetInstances'

const props = defineProps<{ instanceId: string; editing?: boolean }>()
const { records, updateConfig } = useWidgetInstances()
const defaults = defaultWidgetConfig('dual-avatar') as DualAvatarWidgetConfig
const config = computed(() => (records[props.instanceId]?.config as DualAvatarWidgetConfig | undefined) ?? defaults)
const leftAvatar = computed(() => config.value.leftAvatar)
const rightAvatar = computed(() => config.value.rightAvatar)
const leftName = computed(() => config.value.leftName)
const rightName = computed(() => config.value.rightName)
const slogan = computed(() => config.value.slogan)

// 弹窗状态
const modalVisible = ref(false)
const editingAvatar = ref<'left' | 'right'>('left')

// 文本弹窗状态
type TextEditType = 'leftName' | 'rightName' | 'slogan'
const textModalVisible = ref(false)
const editingTextType = ref<TextEditType>('leftName')

// 文本弹窗配置
const currentTextEditConfig = computed(() => {
  if (editingTextType.value === 'leftName') {
    return { title: '修改昵称', currentText: leftName.value, defaultText: '@UserA', placeholder: '输入左侧昵称' }
  } else if (editingTextType.value === 'rightName') {
    return { title: '修改昵称', currentText: rightName.value, defaultText: '@UserB', placeholder: '输入右侧昵称' }
  } else {
    return { title: '修改文案', currentText: slogan.value, defaultText: 'Custom   Slogan', placeholder: '输入底部文案' }
  }
})

const openTextModal = (type: TextEditType) => {
  if (props.editing) return
  editingTextType.value = type
  textModalVisible.value = true
}

const handleTextSaved = async (text: string) => {
  await updateConfig<DualAvatarWidgetConfig>(props.instanceId, { [editingTextType.value]: text })
}

// 打开弹窗
const openModal = (side: 'left' | 'right') => {
  if (props.editing) return
  editingAvatar.value = side
  modalVisible.value = true
}

// 保存头像
const handleAvatarSaved = async (url: string | null) => {
  await updateConfig<DualAvatarWidgetConfig>(props.instanceId, editingAvatar.value === 'left' ? { leftAvatar: url } : { rightAvatar: url })
}
</script>

<style scoped>
.dual-avatar-widget {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0;
  box-sizing: border-box;
}

.avatars-container {
  display: flex;
  gap: 16px; /* 头像间距再大一点 */
  margin-bottom: 18px;
}

.user-block {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar {
  width: 62px; /* 头像微调再大一点 */
  height: 62px;
  border-radius: 50%; /* 圆形头像 */
  background-color: #e5e7eb;
  margin-bottom: 8px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.avatar:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.avatar:active {
  transform: scale(0.95);
}

/* 用不同深度的灰色占位 */
.avatar-left {
  background-color: var(--text-tertiary);
}

.avatar-right {
  background-color: #d1d5db;
}

.username {
  font-size: 14px; /* 字号微调变大 */
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  letter-spacing: 0.2px;
  transition: color 0.3s;
}

.editable-text {
  cursor: pointer;
  transition: opacity 0.2s;
}
.editable-text:hover {
  opacity: 0.7;
}
.editable-text:active {
  opacity: 0.5;
}

.text-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 4px; /* 稍微增加一点顶部间距，让文字不至于太贴近上方 */
}

.typewriter-text {
  font-family: "Courier New", Courier, monospace; /* 打字机字体 */
  font-size: 13px; /* 字号微调变大 */
  color: var(--text-primary);
  letter-spacing: 0.5px;
  white-space: nowrap; /* 强制不换行，保持单行显示 */
  transition: color 0.3s;
}
</style>
