/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
defineProps<{
  app: {
    id: string
    name: string
    icon: string
    color: string
    customImage?: string | null
  }
  badge?: number
  editing?: boolean
  hideDelete?: boolean
}>()

defineEmits<{
  delete: []
}>()
</script>

<template>
  <div class="app-icon-wrapper" :class="{ editing }">
    <button v-if="editing && !hideDelete" class="delete-app" type="button" aria-label="从桌面移除" @pointerdown.stop @click.stop="$emit('delete')">−</button>
    <div class="icon-box-container">
      <div 
        class="icon-box" 
        :class="{ 'has-custom-bg': !!app.customImage }"
        :style="app.customImage ? { backgroundImage: `url(${app.customImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
      >
        <!-- 只有没有自定义图片时才渲染默认的 html 图标 -->
        <template v-if="!app.customImage">
          <div v-html="app.icon"></div>
        </template>
      </div>
      <div v-if="badge && badge > 0" class="badge">{{ badge > 99 ? '99+' : badge }}</div>
    </div>
    <span class="app-name">{{ app.name }}</span>
  </div>
</template>

<style scoped>
.app-icon-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%; /* 填满由 grid 划分的空间 */
  position: relative;
  user-select: none;
  -webkit-user-select: none;
  /* 移除 cursor: pointer 和 transition 以作为纯静态 UI */
}

.app-icon-wrapper.editing { animation: app-wiggle 0.17s ease-in-out infinite alternate; }

.delete-app {
  position: absolute;
  z-index: 20;
  top: -7px;
  left: calc(50% - 7.25vw - 7px);
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(88, 88, 92, .92);
  box-shadow: 0 2px 6px rgba(0,0,0,.24);
  font-size: 20px;
  line-height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes app-wiggle { from { transform: rotate(-1deg); } to { transform: rotate(1deg); } }

.icon-box-container {
  position: relative;
  display: inline-block; /* 紧紧包裹住内部图标 */
}

.icon-box {
  width: 14.5vw; /* 固定宽度，不再依赖父级 100% */
  aspect-ratio: 1 / 1; /* 保持正方形 */
  border-radius: 22%; /* 使用百分比，这样圆角会根据图标尺寸动态缩放 */
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--card-bg-solid); /* 引用全局 CSS 变量 */
  box-shadow: 0 0.5vh 1.5vh var(--shadow-color); /* 阴影改为响应式 */
  margin-bottom: 0.7vh; /* 响应式底部间距回调 */
  transform: translateZ(0); /* 开启硬件加速 */
  will-change: transform;
  transition: background-color 0.3s, box-shadow 0.3s;
}

/* 为文字图标提供高级排版样式 */
.icon-box :deep(.text-icon) {
  font-size: clamp(20px, 6vw, 36px); /* 响应式文字大小 */
  font-weight: 500;
  color: var(--text-primary);
  font-family: "Noto Serif SC", STZhongsong, "Microsoft YaHei", serif; /* 使用衬线字体增加文艺/高级感 */
  letter-spacing: 0;
  user-select: none;
  transition: color 0.3s;
}

/* 如果有自定义背景，去掉默认的卡片背景色以免透过半透明图片 */
.icon-box.has-custom-bg {
  background-color: transparent;
}

.app-name {
  font-size: calc(9.5px + 0.4vw); /* 响应式字体大小略微放大 */
  color: var(--text-primary); /* 引用全局 CSS 变量 */
  font-weight: 500; /* 字重也减小一点显得秀气 */
  text-shadow: var(--icon-text-shadow); /* 引用全局描边变量 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: center;
  letter-spacing: 0.5px;
  transition: color 0.3s, text-shadow 0.3s;
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background-color: #ff3b30;
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 0 5px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  z-index: 10;
  box-sizing: border-box;
}

/* PC 端宽屏适配 */
@media (min-width: 768px) {
  .delete-app { left: calc(50% - 39px); }
  .icon-box {
    width: 64px; /* 物理固定宽度 */
    border-radius: 14px; /* 固定圆角 */
    margin-bottom: 8px; /* 固定下方间距 */
  }
  
  .icon-box :deep(.text-icon) {
    font-size: 28px; /* 调整内部字号比例 */
  }

  .app-name {
    font-size: 13px; /* 限制应用名字体大小 */
  }
}

@media (prefers-reduced-motion: reduce) { .app-icon-wrapper.editing { animation: none; } }
</style>
