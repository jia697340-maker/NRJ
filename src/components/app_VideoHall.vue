/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { App } from '@capacitor/app'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import VeoVideoAccessView from './video/VeoVideoAccessView.vue'
import KlingVideoAccessView from './video/KlingVideoAccessView.vue'
import WanVideoAccessView from './video/WanVideoAccessView.vue'

const emit = defineEmits<{
  (event: 'close'): void
}>()

const currentView = ref<'platforms' | 'veo' | 'kling' | 'wan'>('platforms')
const activeIndex = ref(0)
let backButtonHandle: PluginListenerHandle | null = null

const platforms = [
  {
    id: 'veo',
    name: 'Veo 3.1',
    desc: 'Google 原生画面与音频\n视频生成引擎',
    action: '进入配置',
    disabled: false
  },
  {
    id: 'kling',
    name: 'Kling 3.0',
    desc: '快手原生音画与多镜头\n移动端视频生成引擎',
    action: '进入配置',
    disabled: false
  },
  {
    id: 'wan',
    name: 'Wan 3.0',
    desc: '阿里云全模态原生音画\n最长 30 秒视频引擎',
    action: '进入配置',
    disabled: false
  }
]

const handlePrev = () => {
  if (activeIndex.value > 0) activeIndex.value--
}

const handleNext = () => {
  if (activeIndex.value < platforms.length - 1) activeIndex.value++
}

const handleSelect = (id: string, disabled: boolean) => {
  if (!disabled && (id === 'veo' || id === 'kling' || id === 'wan')) {
    currentView.value = id as typeof currentView.value
  }
}

const platformIconStyle = (id: string) => id === 'veo'
  ? 'background: linear-gradient(135deg,#1f1c2c,#928dab); color: #fff;'
  : id === 'wan'
    ? 'background: linear-gradient(135deg,#5433ff,#20bdff); color: #fff;'
    : 'background: linear-gradient(135deg,#111,#383838); color: #fff;'

onMounted(async () => {
  if (!Capacitor.isNativePlatform()) return
  backButtonHandle = await App.addListener('backButton', () => {
    if (currentView.value !== 'platforms') currentView.value = 'platforms'
    else emit('close')
  })
})

onUnmounted(() => { void backButtonHandle?.remove() })
</script>

<template>
  <div class="vh-wrapper">
    <!-- 极简无界顶栏 -->
    <div v-if="currentView === 'platforms'" class="header-minimal">
      <div class="header-titles">
        <h1 class="main-title">视频引擎</h1>
        <p class="sub-title">选择要接入的视频生成服务</p>
      </div>
      <button class="close-btn" @click="emit('close')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
      </button>
    </div>

    <!-- 纯白胶囊悬浮轮播（平台选择） -->
    <div v-if="currentView === 'platforms'" class="carousel-container">
      <button class="nav-btn prev-btn" :class="{ hidden: activeIndex === 0 }" @click="handlePrev">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>

      <div class="capsule-track">
        <div class="capsule-wrapper" :style="{ transform: `translateX(calc(-${activeIndex * 100}% - ${activeIndex * 40}px))` }">
          <div
            v-for="(item, index) in platforms"
            :key="item.id"
            class="capsule-item"
            :class="{ active: index === activeIndex, disabled: item.disabled }"
            @click="handleSelect(item.id, item.disabled)"
          >
            <div class="capsule-shape">
              <!-- 动态呼吸涟漪 (利用 transform 硬件加速) -->
              <div class="ripple-bg" v-if="index === activeIndex && !item.disabled">
                <div class="ripple r1"></div>
                <div class="ripple r2"></div>
              </div>

              <div
                class="capsule-icon"
                :style="platformIconStyle(item.id)"
              >
                <span v-if="item.id === 'veo'" style="font-weight: 800; font-size: 14px;">VEO</span>
                <span v-else-if="item.id === 'kling'" style="font-weight: 800; font-size: 12px; letter-spacing: -.4px;">KLING</span>
                <span v-else-if="item.id === 'wan'" style="font-weight: 800; font-size: 13px; letter-spacing: -.2px;">WAN</span>
              </div>

              <div class="capsule-text">
                <h3>{{ item.name }}</h3>
                <p v-html="item.desc.replace('\n', '<br>')"></p>
              </div>

              <div class="capsule-action">
                <span>{{ item.action }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button class="nav-btn next-btn" :class="{ hidden: activeIndex === platforms.length - 1 }" @click="handleNext">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>

    <!-- 子视图 -->
    <VeoVideoAccessView v-else-if="currentView === 'veo'" @back="currentView = 'platforms'" />
    <KlingVideoAccessView v-else-if="currentView === 'kling'" @back="currentView = 'platforms'" />
    <WanVideoAccessView v-else-if="currentView === 'wan'" @back="currentView = 'platforms'" />
  </div>
</template>

<style scoped>
/* Container & Resets */
.vh-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #ffffff;
  color: #111111;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 100;
}

/* Header */
.header-minimal {
  position: relative;
  padding: calc(env(safe-area-inset-top) + 24px) 24px 20px;
  text-align: center;
  flex-shrink: 0;
}
.header-titles {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.main-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #000;
  letter-spacing: 0.5px;
}
.sub-title {
  margin: 0;
  font-size: 13px;
  color: #888;
  font-weight: 400;
}
.close-btn {
  position: absolute;
  top: calc(env(safe-area-inset-top) + 20px);
  right: 20px;
  background: none;
  border: none;
  color: #000;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  transition: background 0.2s;
}
.close-btn:active {
  background: rgba(0,0,0,0.05);
}

/* Carousel */
.carousel-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #bbbbbb;
  cursor: pointer;
  z-index: 10;
  transition: opacity 0.3s, color 0.3s;
}
.nav-btn:active {
  color: #000;
}
.prev-btn {
  left: 16px;
}
.next-btn {
  right: 16px;
}
.nav-btn.hidden {
  opacity: 0;
  pointer-events: none;
}

.capsule-track {
  width: 250px;
  height: 460px;
  position: relative;
}
.capsule-wrapper {
  display: flex;
  gap: 40px;
  height: 100%;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}
.capsule-item {
  width: 250px;
  flex-shrink: 0;
  height: 100%;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s;
  will-change: transform, opacity;
  transform: scale(0.85);
  opacity: 0.3;
  display: flex;
  align-items: center;
  justify-content: center;
}
.capsule-item.active {
  transform: scale(1);
  opacity: 1;
}

/* The fluid pill/capsule shape */
.capsule-shape {
  width: 100%;
  height: 100%;
  border-radius: 125px; /* Fully rounded top and bottom */
  background: #ffffff;
  box-shadow: 0 20px 60px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.03);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 48px 24px 36px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  box-sizing: border-box;
}

.capsule-item.disabled .capsule-shape {
  background: #fbfbfb;
}

/* Hardware Accelerated Ripple */
.ripple-bg {
  position: absolute;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  width: 64px;
  height: 64px;
  z-index: 0;
  pointer-events: none;
}
.ripple {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.04);
  animation: rippleAnim 3.5s infinite cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
}
.ripple.r2 {
  animation-delay: 1.75s;
}
@keyframes rippleAnim {
  0% { transform: scale(0.6); opacity: 1; }
  100% { transform: scale(3.5); opacity: 0; }
}

.capsule-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 12px 28px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(0,0,0,0.03);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #111;
  z-index: 1;
  margin-top: 8px;
}
.capsule-item.disabled .capsule-icon {
  color: #ccc;
  box-shadow: none;
  background: transparent;
}

.capsule-text {
  text-align: center;
  z-index: 1;
  margin-top: 24px;
}
.capsule-text h3 {
  margin: 0 0 12px 0;
  font-size: 20px;
  font-weight: 600;
  color: #111;
}
.capsule-text p {
  margin: 0;
  font-size: 13px;
  color: #888;
  line-height: 1.6;
}

.capsule-action {
  z-index: 1;
  font-size: 14px;
  font-weight: 600;
  color: #000;
  padding: 14px 28px;
  border-radius: 100px;
  background: rgba(0,0,0,0.04);
  transition: background 0.2s;
}
.capsule-item.disabled .capsule-action {
  color: #aaa;
  background: transparent;
}
.capsule-item.active .capsule-action:active {
  background: rgba(0,0,0,0.08);
}
@media (max-width: 390px) {
  .nav-btn {
    width: 40px;
  }
  .prev-btn {
    left: 4px;
  }
  .next-btn {
    right: 4px;
  }
}
@media (max-width: 340px) {
  .nav-btn {
    width: 34px;
  }
  .prev-btn {
    left: 0;
  }
  .next-btn {
    right: 0;
  }
  .capsule-track,
  .capsule-item {
    width: 238px;
  }
}
</style>
