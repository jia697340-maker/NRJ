/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { globalSettings } from '../store'

defineProps<{
  isDark?: boolean
}>()

const currentTime = ref('')
const isExpanded = ref(false)
const notchRef = ref<HTMLElement | null>(null)
let timer: number

const batteryLevel = ref(100)
const isCharging = ref(false)

const batteryWidth = computed(() => {
  return (batteryLevel.value / 100) * 17
})

const batteryColor = computed(() => {
  if (isCharging.value) return '#4ade80'
  if (batteryLevel.value <= 20) return '#ef4444'
  return 'currentColor'
})

interface BatteryManager extends EventTarget {
  charging: boolean;
  level: number;
}
declare global {
  interface Navigator {
    getBattery?: () => Promise<BatteryManager>;
  }
}

const updateTime = () => {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  currentTime.value = `${hours}:${minutes}`
}

const handleClickOutside = (event: MouseEvent) => {
  if (isExpanded.value && notchRef.value && !notchRef.value.contains(event.target as Node)) {
    isExpanded.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  updateTime()
  timer = setInterval(updateTime, 1000)

  if (navigator.getBattery) {
    navigator.getBattery().then((battery) => {
      batteryLevel.value = battery.level * 100
      isCharging.value = battery.charging

      battery.addEventListener('levelchange', () => {
        batteryLevel.value = battery.level * 100
      })
      battery.addEventListener('chargingchange', () => {
        isCharging.value = battery.charging
      })
    }).catch(err => {
      console.log('Battery API not supported or accessible', err)
    })
  }
})

onUnmounted(() => {
  clearInterval(timer)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="status-bar" :class="{ 'dark-mode': isDark }">
    <div class="time">{{ currentTime }}</div>
    <div class="notch" ref="notchRef" :class="{ expanded: isExpanded }" v-if="globalSettings.showNotch" @click="isExpanded = !isExpanded">
      <div class="notch-content" :class="{ show: isExpanded }">
        <div class="content-left">
          <div class="music-cover">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zM12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
          </div>
          <span class="greeting">Love OS</span>
        </div>
        <div class="music-wave">
          <span></span><span></span><span></span><span></span>
        </div>
      </div>
      <div class="notch-sensor"></div>
      <div class="notch-camera"></div>
    </div>
    <div class="icons">
      <!-- 精细 WiFi (1:1 风格, 调整尺寸适应电池比例) -->
      <span class="icon svg-icon">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M12 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm4.56-4.56a6.43 6.43 0 0 0-9.12 0 .75.75 0 0 1-1.06-1.06 7.93 7.93 0 0 1 11.24 0 .75.75 0 0 1-1.06 1.06zm3.18-3.18a10.93 10.93 0 0 0-15.48 0 .75.75 0 1 1-1.06-1.06 12.43 12.43 0 0 1 17.6 0 .75.75 0 0 1-1.06 1.06z"/>
        </svg>
      </span>
      <!-- 1:1 电池 (带外边框和电量块) -->
      <span class="icon svg-icon battery-container">
        <!-- 外部充电闪电 -->
        <svg v-if="isCharging && !globalSettings.chargingBoltInside" class="charging-bolt" viewBox="0 0 24 24" width="12" height="12" fill="#4ade80" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 2L3 14h7v8l11-12h-7V2z"/>
        </svg>
        <div class="battery-wrapper">
          <svg viewBox="0 0 24 12" width="26" height="13" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0.5" y="0.5" width="20" height="11" rx="3.5" stroke="currentColor" stroke-width="1"/>
            <rect x="2" y="2" :width="batteryWidth" height="8" rx="1.5" :fill="batteryColor"/>
            <path d="M22 4.5C23 4.5 23 4.8 23 6C23 7.2 23 7.5 22 7.5V4.5Z" fill="currentColor"/>
          </svg>
          <!-- 内部充电闪电 -->
          <svg v-if="isCharging && globalSettings.chargingBoltInside" class="charging-bolt-inside" viewBox="0 0 24 24" width="10" height="10" fill="#fff" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 2L3 14h7v8l11-12h-7V2z"/>
          </svg>
        </div>
      </span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  height: 44px;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  font-size: 14px;
  font-weight: 600;
  z-index: 100;
  color: var(--text-primary);
  transition: color 0.3s ease;
  position: absolute;
  top: 0;
  left: 0;
}

.time {
  width: 60px;
}

/* 模拟刘海/灵动岛区域 */
.notch {
  width: 120px;
  height: 28px;
  background-color: #000000;
  border-radius: 14px;
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  box-shadow: 
    inset 0px 1px 2px rgba(255, 255, 255, 0.15),
    inset 0px -1px 2px rgba(255, 255, 255, 0.05);
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
  z-index: 1000;
}

.notch.expanded {
  width: 280px;
  height: 64px;
  border-radius: 32px;
  box-shadow: 
    inset 0px 1px 2px rgba(255, 255, 255, 0.15),
    inset 0px -1px 2px rgba(255, 255, 255, 0.05),
    0 10px 30px rgba(0,0,0,0.4);
}

.notch-sensor {
  position: absolute;
  top: 14px;
  left: calc(50% - 35px);
  transform: translateY(-50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle at center, #151515 0%, #000 80%);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05);
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.notch-camera {
  position: absolute;
  top: 14px;
  right: calc(50% - 50px);
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #1a1a24 0%, #000 70%);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.notch.expanded .notch-sensor,
.notch.expanded .notch-camera {
  opacity: 0;
}

.notch-camera::after {
  content: '';
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(50, 120, 255, 0.35);
  top: 25%;
  left: 25%;
  filter: blur(0.5px);
}

.notch-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  box-sizing: border-box;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.notch-content.show {
  opacity: 1;
  transition: opacity 0.3s ease 0.2s;
  pointer-events: auto;
}

.content-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.music-cover {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.greeting {
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.music-wave {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 16px;
}

.music-wave span {
  display: block;
  width: 3px;
  height: 4px;
  background-color: #32d74b;
  border-radius: 1.5px;
  animation: wave 1.2s ease-in-out infinite;
}

.music-wave span:nth-child(1) { animation-delay: 0.0s; }
.music-wave span:nth-child(2) { animation-delay: 0.2s; }
.music-wave span:nth-child(3) { animation-delay: 0.4s; }
.music-wave span:nth-child(4) { animation-delay: 0.6s; }

@keyframes wave {
  0%, 100% { height: 4px; }
  50% { height: 16px; }
}

.icons {
  display: flex;
  gap: 5px;
  align-items: center;
}

.icon {
  font-size: 12px;
  display: flex;
  align-items: center;
}

.svg-icon {
  display: flex;
  align-items: center;
}

.text-icon {
  font-size: 12px;
  font-weight: 700;
}

.battery-container {
  display: flex;
  align-items: center;
  gap: 2px;
}

.battery-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.charging-bolt {
  margin-right: -2px;
}

.charging-bolt-inside {
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}
</style>
