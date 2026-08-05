/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<template>
  <div class="moment-card">
    <!-- 独立背景层，用于纯色/图片底图及模糊 -->
    <div 
      class="moment-card-bg editable"
      :class="{ 'default-bg': bgMainType === 'default' }"
      :style="bgStyle"
      @click="showBgModal = true"
    ></div>

    <!-- 内部内容区域，设置 z-index 保证在背景之上 -->
    <div class="moment-card-inner" @click="handleInnerClick">
    <!-- 顶部双背景图占位 -->
    <div class="header-images">
      <div 
        class="image-left editable"
        :style="bgLeftUrl ? { backgroundImage: `url(${bgLeftUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
        @click="openImageModal('left')"
      ></div>
      <div 
        class="image-right editable"
        :style="bgRightUrl ? { backgroundImage: `url(${bgRightUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
        @click="openImageModal('right')"
      ></div>
    </div>
    
    <!-- 头像与用户名 -->
    <div class="user-profile">
      <div class="avatar-container">
        <!-- 头像占位 -->
        <div 
          class="avatar editable"
          :style="avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
          @click="openImageModal('avatar')"
        ></div>
      </div>
      <div class="username-container">
        <span class="username editable-text" @click="openTextModal('username')">{{ username }}</span>
      </div>
    </div>

    <!-- 文本和进度条内容区 -->
    <div class="content">
      <p class="text editable-text" @click="openTextModal('content')">{{ contentText }}</p>

      <div class="progress-section">
        <div class="progress-bar-container" 
             ref="progressBarRef"
             @mousedown="handleSliderStart"
             @touchstart.passive="handleSliderStart">
          <!-- 底部灰色进度条 -->
          <div class="progress-bar-bg"></div>
          <!-- 当前黑色进度 -->
          <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
          <!-- 爱心滑块 -->
          <div class="progress-slider-heart" 
               :style="{ left: progressPercent + '%' }"
               :class="{ 'is-dragging': isDragging, 'interactive': globalSettings.enableSlider }"
          >{{ globalSettings.sliderIcon || '♥' }}</div>
        </div>
        <!-- 时间 -->
        <div class="time-labels">
          <span class="time-current">{{ formatTime(currentTime) }}</span>
          <span class="time-total">{{ formatTime(totalTime) }}</span>
        </div>
      </div>
    </div>

    <!-- 图片上传弹窗 -->
    <AvatarUploadModal
      v-model:visible="showImageModal"
      :currentAvatar="currentImageUrl"
      :shape="currentImageType === 'avatar' ? 'avatar' : currentImageType === 'left' ? 'bg-left' : 'bg-right'"
      @saved="saveImage"
    />

    <!-- 文本编辑弹窗 -->
    <TextEditModal
      v-model:visible="showTextModal"
      :title="textModalTitle"
      :currentText="currentEditingText"
      :defaultText="defaultText"
      @saved="saveText"
    />

    <!-- 底图设置弹窗 -->
    <BackgroundSettingModal
      v-model:visible="showBgModal"
      :currentType="bgMainType"
      :currentUrl="bgMainUrl"
      :currentColor="bgMainColor"
      :currentBlur="bgMainBlur"
      @saved="saveMainBg"
    />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import localforage from 'localforage'
import AvatarUploadModal from './AvatarUploadModal.vue'
import TextEditModal from './TextEditModal.vue'
import BackgroundSettingModal from './BackgroundSettingModal.vue'
import { globalSettings } from '../store'

// 响应式数据状态
const progressPercent = ref(38) // 默认 38%
const isDragging = ref(false)
const progressBarRef = ref<HTMLElement | null>(null)
const totalTime = ref(228) // 默认 3:48 = 228秒

const currentTime = computed(() => {
  return Math.floor((progressPercent.value / 100) * totalTime.value)
})

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// 拖拽逻辑
const handleSliderStart = (e: MouseEvent | TouchEvent) => {
  if (!globalSettings.enableSlider) return
  isDragging.value = true
  updateProgressFromEvent(e)

  window.addEventListener('mousemove', handleSliderMove)
  window.addEventListener('mouseup', handleSliderEnd)
  window.addEventListener('touchmove', handleSliderMove, { passive: false })
  window.addEventListener('touchend', handleSliderEnd)
}

const handleSliderMove = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value || !globalSettings.enableSlider) return
  if (e.type === 'touchmove') {
    e.preventDefault() // 防止页面滚动
  }
  updateProgressFromEvent(e)
}

const handleSliderEnd = () => {
  isDragging.value = false
  saveData()
  
  window.removeEventListener('mousemove', handleSliderMove)
  window.removeEventListener('mouseup', handleSliderEnd)
  window.removeEventListener('touchmove', handleSliderMove)
  window.removeEventListener('touchend', handleSliderEnd)
}

const updateProgressFromEvent = (e: MouseEvent | TouchEvent) => {
  if (!progressBarRef.value) return
  const rect = progressBarRef.value.getBoundingClientRect()
  
  let clientX = 0
  if (e instanceof MouseEvent) {
    clientX = e.clientX
  } else if (e instanceof TouchEvent) {
    clientX = e.touches[0].clientX
  }

  let x = clientX - rect.left
  let percent = (x / rect.width) * 100
  percent = Math.max(0, Math.min(100, percent)) // 限制在 0-100 之间
  progressPercent.value = percent
}

onUnmounted(() => {
  window.removeEventListener('mousemove', handleSliderMove)
  window.removeEventListener('mouseup', handleSliderEnd)
  window.removeEventListener('touchmove', handleSliderMove)
  window.removeEventListener('touchend', handleSliderEnd)
})

const bgMainType = ref<'default' | 'image' | 'color'>('default')
const bgMainUrl = ref<string | null>(null)
const bgMainColor = ref<string>('#ffffff')
const bgMainBlur = ref<number>(0)

const bgLeftUrl = ref<string | null>(null)
const bgRightUrl = ref<string | null>(null)
const avatarUrl = ref<string | null>(null)
const username = ref('in Mo3ent')
const contentText = ref('人間の少女が誤って天使の国に入った 3*☆°')

// 持久化存储
const saveData = async () => {
  try {
    await localforage.setItem('momentCardData', {
      bgLeftUrl: bgLeftUrl.value,
      bgRightUrl: bgRightUrl.value,
      avatarUrl: avatarUrl.value,
      username: username.value,
      contentText: contentText.value,
      bgMainType: bgMainType.value,
      bgMainUrl: bgMainUrl.value,
      bgMainColor: bgMainColor.value,
      bgMainBlur: bgMainBlur.value,
      progressPercent: progressPercent.value
    })
  } catch (err) {
    console.error('保存数据失败:', err)
  }
}

onMounted(async () => {
  try {
    const data: any = await localforage.getItem('momentCardData')
    if (data) {
      if (data.bgLeftUrl !== undefined) bgLeftUrl.value = data.bgLeftUrl
      if (data.bgRightUrl !== undefined) bgRightUrl.value = data.bgRightUrl
      if (data.avatarUrl !== undefined) avatarUrl.value = data.avatarUrl
      if (data.username !== undefined) username.value = data.username
      if (data.contentText !== undefined) contentText.value = data.contentText
      if (data.bgMainType !== undefined) bgMainType.value = data.bgMainType
      if (data.bgMainUrl !== undefined) bgMainUrl.value = data.bgMainUrl
      if (data.bgMainColor !== undefined) bgMainColor.value = data.bgMainColor
      if (data.bgMainBlur !== undefined) bgMainBlur.value = data.bgMainBlur
      if (data.progressPercent !== undefined) progressPercent.value = data.progressPercent
    }
  } catch (err) {
    console.error('读取数据失败:', err)
  }
})

// 图片弹窗状态与逻辑
const showImageModal = ref(false)
const currentImageType = ref<'left' | 'right' | 'avatar'>('avatar')
const currentImageUrl = ref<string | null>(null)

const openImageModal = (type: 'left' | 'right' | 'avatar') => {
  currentImageType.value = type
  currentImageUrl.value = type === 'left' ? bgLeftUrl.value 
                        : type === 'right' ? bgRightUrl.value 
                        : avatarUrl.value
  showImageModal.value = true
}

const saveImage = (url: string | null) => {
  if (currentImageType.value === 'left') bgLeftUrl.value = url
  else if (currentImageType.value === 'right') bgRightUrl.value = url
  else if (currentImageType.value === 'avatar') avatarUrl.value = url
  saveData()
}

// 文本弹窗状态与逻辑
const showTextModal = ref(false)
const currentTextType = ref<'username' | 'content'>('username')
const textModalTitle = ref('')
const currentEditingText = ref('')
const defaultText = ref('')

const openTextModal = (type: 'username' | 'content') => {
  currentTextType.value = type
  if (type === 'username') {
    textModalTitle.value = '修改用户名'
    currentEditingText.value = username.value
    defaultText.value = 'in Mo3ent'
  } else {
    textModalTitle.value = '修改内容'
    currentEditingText.value = contentText.value
    defaultText.value = '人間の少女が誤って天使の国に入った 3*☆°'
  }
  showTextModal.value = true
}

const saveText = (text: string) => {
  if (currentTextType.value === 'username') username.value = text
  else if (currentTextType.value === 'content') contentText.value = text
  saveData()
}

// 底图弹窗状态与逻辑
const showBgModal = ref(false)

const saveMainBg = (config: { type: 'default' | 'image' | 'color', url: string | null, color: string, blur: number }) => {
  bgMainType.value = config.type
  bgMainUrl.value = config.url
  bgMainColor.value = config.color
  bgMainBlur.value = config.blur
  saveData()
}

const bgStyle = computed(() => {
  const style: any = {
    filter: `blur(${bgMainBlur.value}px)`
  }
  if (bgMainType.value === 'image' && bgMainUrl.value) {
    style.backgroundImage = `url(${bgMainUrl.value})`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
    style.backgroundColor = 'transparent'
  } else if (bgMainType.value === 'color') {
    style.backgroundColor = bgMainColor.value
    style.backgroundImage = 'none'
  }
  return style
})

// 处理内部空白区域点击，将其透传给底层（如果未点在具体元素上）
const handleInnerClick = (e: MouseEvent) => {
  // 如果点击的直接是 moment-card-inner 或者 content，说明点在了空白处，呼出背景设置
  const target = e.target as HTMLElement
  if (target.classList.contains('moment-card-inner') || target.classList.contains('content') || target.classList.contains('user-profile') || target.classList.contains('header-images')) {
    showBgModal.value = true
  }
}
</script>

<style scoped>
.moment-card {
  width: 100%;
  max-width: 400px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px var(--shadow-color);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  transition: background-color 0.3s, box-shadow 0.3s;
  position: relative;
  background-color: var(--card-bg-solid);
}

.moment-card-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  transition: all 0.3s ease;
}

.moment-card-bg.default-bg {
  /* 默认波点背景 */
  background-image: radial-gradient(var(--border-color) 2px, transparent 2px);
  background-size: 24px 24px;
  background-position: -2px -2px;
}

.moment-card-inner {
  position: relative;
  z-index: 1;
  /* 确保整个区域可被点击，并将空白处点击交给 handleInnerClick 处理 */
  min-height: 100px;
}

.header-images {
  display: flex;
  height: 90px;
  width: 100%;
}

.image-left, .image-right {
  flex: 1;
}

.image-left {
  background-color: #e5e7eb; /* 浅灰色占位 */
}

.image-right {
  background-color: #d1d5db; /* 深一点的灰色占位 */
}

.user-profile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding-right: 16px;
}

.avatar-container {
  position: absolute;
  right: 16px;
  top: -21px; /* 向上偏移，压在背景图上 */
}

.avatar {
  width: 42px;
  height: 42px;
  background-color: var(--text-tertiary); /* 头像灰色占位 */
  border-radius: 14px;
  border: 2px solid var(--card-bg-solid); /* 边框跟随卡片底色 */
  box-sizing: border-box;
}

.username-container {
  margin-top: 24px; /* 为浮动的头像留出空间 */
  padding-bottom: 4px;
}

.username {
  font-weight: bold;
  font-size: 12px;
  color: var(--text-primary);
  transition: color 0.3s;
}

.content {
  padding: 0 12px 12px 12px;
}

.text {
  font-size: 12px;
  color: var(--text-primary);
  margin: 0 0 10px 0;
  line-height: 1.4;
  transition: color 0.3s;
}

.progress-section {
  margin-top: 10px;
}

.progress-bar-container {
  position: relative;
  height: 20px; /* 增加感应区域高度 */
  display: flex;
  align-items: center;
  cursor: default;
}

.progress-bar-bg {
  width: 100%;
  height: 4px;
  background-color: var(--border-color); /* 深色模式下进度条底色应变浅透明 */
  border-radius: 2px;
}

.progress-bar-fill {
  position: absolute;
  left: 0;
  height: 4px;
  background-color: var(--text-primary); /* 填充跟随文字主色 */
  border-radius: 2px;
}

.progress-slider-heart {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  color: var(--text-primary);
  font-size: 16px;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
  transition: transform 0.2s, font-size 0.2s;
  user-select: none;
}

.progress-slider-heart.interactive {
  cursor: grab;
}

.progress-slider-heart.is-dragging {
  cursor: grabbing;
  transform: translate(-50%, -50%) scale(1.3);
}

.progress-bar-fill {
  position: absolute;
  left: 0;
  height: 4px;
  background-color: var(--text-primary); /* 填充跟随文字主色 */
  border-radius: 2px;
  pointer-events: none;
}

.time-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}

.editable {
  cursor: pointer;
  transition: opacity 0.2s;
}

.editable:hover {
  opacity: 0.85;
}

.editable-text {
  cursor: pointer;
  border-bottom: 1px dashed transparent;
  transition: border-color 0.2s;
}

.editable-text:hover {
  border-bottom-color: var(--text-tertiary);
}
</style>
