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
import { ref, onMounted, computed } from 'vue'
import localforage from 'localforage'
import AvatarUploadModal from './AvatarUploadModal.vue'
import TextEditModal from './TextEditModal.vue'

// 头像状态
const leftAvatar = ref<string | null>(null)
const rightAvatar = ref<string | null>(null)

// 弹窗状态
const modalVisible = ref(false)
const editingAvatar = ref<'left' | 'right'>('left')

// 初始化 localforage
const store = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'avatars'
})

// 文本状态
const leftName = ref('@yuha')
const rightName = ref('@bunny')
const slogan = ref('Limited   heartbeat') // 使用空格占位，展示打字机感

// 文本弹窗状态
type TextEditType = 'leftName' | 'rightName' | 'slogan'
const textModalVisible = ref(false)
const editingTextType = ref<TextEditType>('leftName')

// 加载持久化数据
onMounted(async () => {
  try {
    const left = await store.getItem<string>('avatar-left')
    const right = await store.getItem<string>('avatar-right')
    if (left) leftAvatar.value = left
    if (right) rightAvatar.value = right

    const lName = await store.getItem<string>('text-leftName')
    const rName = await store.getItem<string>('text-rightName')
    const slg = await store.getItem<string>('text-slogan')
    if (lName) leftName.value = lName
    if (rName) rightName.value = rName
    if (slg) slogan.value = slg
  } catch (e) {
    console.error('Failed to load local data', e)
  }
})

// 文本弹窗配置
const currentTextEditConfig = computed(() => {
  if (editingTextType.value === 'leftName') {
    return { title: '修改昵称', currentText: leftName.value, defaultText: '@yuha', placeholder: '输入左侧昵称' }
  } else if (editingTextType.value === 'rightName') {
    return { title: '修改昵称', currentText: rightName.value, defaultText: '@bunny', placeholder: '输入右侧昵称' }
  } else {
    return { title: '修改文案', currentText: slogan.value, defaultText: 'Limited   heartbeat', placeholder: '输入底部文案' }
  }
})

const openTextModal = (type: TextEditType) => {
  editingTextType.value = type
  textModalVisible.value = true
}

const handleTextSaved = async (text: string) => {
  try {
    if (editingTextType.value === 'leftName') {
      leftName.value = text
      await store.setItem('text-leftName', text)
    } else if (editingTextType.value === 'rightName') {
      rightName.value = text
      await store.setItem('text-rightName', text)
    } else {
      slogan.value = text
      await store.setItem('text-slogan', text)
    }
  } catch (e) {
    console.error('Failed to save text', e)
  }
}

// 打开弹窗
const openModal = (side: 'left' | 'right') => {
  editingAvatar.value = side
  modalVisible.value = true
}

// 保存头像
const handleAvatarSaved = async (url: string | null) => {
  try {
    if (editingAvatar.value === 'left') {
      leftAvatar.value = url
      if (url) {
        await store.setItem('avatar-left', url)
      } else {
        await store.removeItem('avatar-left')
      }
    } else {
      rightAvatar.value = url
      if (url) {
        await store.setItem('avatar-right', url)
      } else {
        await store.removeItem('avatar-right')
      }
    }
  } catch (e) {
    console.error('Failed to save avatar', e)
  }
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
