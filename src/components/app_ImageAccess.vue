/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'

import NovelAIImageAccessView from './image/NovelAIImageAccessView.vue'
import GptImageAccessView from './image/GptImageAccessView.vue'
import GeminiImageAccessView from './image/GeminiImageAccessView.vue'
import FluxImageAccessView from './image/FluxImageAccessView.vue'
import NijiImageAccessView from './image/NijiImageAccessView.vue'
import SeedreamImageAccessView from './image/SeedreamImageAccessView.vue'
import IdentityProfileLibraryView from './image/IdentityProfileLibraryView.vue'

const emit = defineEmits(['close'])

const currentView = ref<'platforms' | 'identity' | 'novelai' | 'gptimage' | 'gemini' | 'flux' | 'niji' | 'seedream'>('platforms')

const activeIndex = ref(0)
const platforms = [
  { id: 'identity', name: '固定形象库', desc: '跨引擎管理角色形象、\n版本与参考素材', action: '进入管理', disabled: false },
  { id: 'novelai', name: 'NovelAI', desc: '二次元及丰富画风的\n图像生成引擎', action: '进入配置', disabled: false },
  { id: 'gptimage', name: 'GPT Image', desc: '支持最新与兼容模型的\n图像生成与编辑', action: '进入配置', disabled: false },
  { id: 'gemini', name: 'Gemini Image', desc: 'Nano Banana 2\n原生生图与多图编辑', action: '进入配置', disabled: false },
  { id: 'flux', name: 'FLUX.2', desc: 'Black Forest Labs\nPro / Max 独立接入', action: '进入配置', disabled: false },
  { id: 'niji', name: 'Niji 7', desc: 'Midjourney 动漫模型\n第三方中转独立接入', action: '进入配置', disabled: false },
  { id: 'seedream', name: 'Seedream', desc: '字节跳动 5.0 系列\n火山方舟独立接入', action: '进入配置', disabled: false }
]

const handlePrev = () => {
  if (activeIndex.value > 0) activeIndex.value--
}
const handleNext = () => {
  if (activeIndex.value < platforms.length - 1) activeIndex.value++
}
const handleSelect = (id: string, disabled: boolean) => {
  if (!disabled && (id === 'identity' || id === 'novelai' || id === 'gptimage' || id === 'gemini' || id === 'flux' || id === 'niji' || id === 'seedream')) {
    currentView.value = id as 'identity' | 'novelai' | 'gptimage' | 'gemini' | 'flux' | 'niji' | 'seedream'
  }
}
</script>

<template>
  <div class="ia-wrapper">
    <!-- 极简无界顶栏 -->
    <div v-if="currentView === 'platforms'" class="header-minimal">
      <div class="header-titles">
        <h1 class="main-title">图像引擎</h1>
        <p class="sub-title">选择要接入的图像生成服务</p>
      </div>
      <button class="close-btn" @click="$emit('close')">
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
          
          <div v-for="(item, index) in platforms" :key="item.id" 
               class="capsule-item" 
               :class="{ active: index === activeIndex, disabled: item.disabled }"
               @click="handleSelect(item.id, item.disabled)">
            
            <div class="capsule-shape">
              <!-- 动态呼吸涟漪 (利用 transform 硬件加速) -->
              <div class="ripple-bg" v-if="index === activeIndex && !item.disabled">
                <div class="ripple r1"></div>
                <div class="ripple r2"></div>
              </div>
              
              <div class="capsule-icon" :style="item.id === 'identity' ? 'background: linear-gradient(135deg,#176b42,#64a47f); color: #fff;' : item.id === 'novelai' ? 'background: #111; color: #fff;' : item.id === 'gptimage' ? 'background: #555a61; color: #fff;' : item.id === 'gemini' ? 'background: linear-gradient(135deg,#4285f4,#a142f4); color: #fff;' : item.id === 'flux' ? 'background: linear-gradient(135deg,#111,#287a50); color: #fff;' : item.id === 'niji' ? 'background: linear-gradient(135deg,#27213e,#765e9b); color: #fff;' : item.id === 'seedream' ? 'background: linear-gradient(135deg,#1c3570,#3566a8); color: #fff;' : ''">
                <span v-if="item.id === 'identity'" style="font-weight: 800; font-size: 16px;">ID</span>
                <span v-else-if="item.id === 'novelai'" style="font-weight: 800; font-style: italic; font-size: 16px;">NAI</span>
                <span v-else-if="item.id === 'gptimage'" style="font-weight: 800; font-size: 13px;">GPT</span>
                <span v-else-if="item.id === 'gemini'" style="font-weight: 800; font-size: 12px;">GEM</span>
                <span v-else-if="item.id === 'flux'" style="font-weight: 800; font-size: 12px;">FLX</span>
                <span v-else-if="item.id === 'niji'" style="font-weight: 800; font-size: 12px;">N7</span>
                <span v-else-if="item.id === 'seedream'" style="font-weight: 800; font-size: 11px;">SDR</span>
                <svg v-else viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
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
    <IdentityProfileLibraryView v-else-if="currentView === 'identity'" @back="currentView = 'platforms'" />
    <NovelAIImageAccessView v-else-if="currentView === 'novelai'" @back="currentView = 'platforms'" />
    <GptImageAccessView v-else-if="currentView === 'gptimage'" @back="currentView = 'platforms'" />
    <GeminiImageAccessView v-else-if="currentView === 'gemini'" @back="currentView = 'platforms'" />
    <FluxImageAccessView v-else-if="currentView === 'flux'" @back="currentView = 'platforms'" />
    <NijiImageAccessView v-else-if="currentView === 'niji'" @back="currentView = 'platforms'" />
    <SeedreamImageAccessView v-else-if="currentView === 'seedream'" @back="currentView = 'platforms'" />

  </div>
</template>

<style scoped src="./app_ImageAccess.css"></style>
