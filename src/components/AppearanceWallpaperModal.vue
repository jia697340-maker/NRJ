/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import { globalSettings } from '../store'

const props = defineProps<{
  visible: boolean
  currentStyle: string
  target?: 'desktop' | 'lockscreen' | 'chatlist' // 新增 chatlist 支持
}>()

const emit = defineEmits(['update:visible'])

const wallpaperUrlInput = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const urlInputRef = ref<HTMLInputElement | null>(null)
const isUrlMode = ref(false)

const handleClose = () => {
  emit('update:visible', false)
  isUrlMode.value = false
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const onFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target?.result) {
        if (props.target === 'lockscreen') {
          globalSettings.lockScreenWallpaper = event.target.result as string
        } else if (props.target === 'chatlist') {
          globalSettings.chatListWallpaper = event.target.result as string
        } else {
          globalSettings.wallpaper = event.target.result as string
        }
      }
    }
    reader.readAsDataURL(file)
  }
}

const focusUrlInput = () => {
  urlInputRef.value?.focus()
}

const applyUrlWallpaper = () => {
  if (wallpaperUrlInput.value) {
    if (props.target === 'lockscreen') {
      globalSettings.lockScreenWallpaper = wallpaperUrlInput.value
    } else if (props.target === 'chatlist') {
      globalSettings.chatListWallpaper = wallpaperUrlInput.value
    } else {
      globalSettings.wallpaper = wallpaperUrlInput.value
    }
  }
}

const handleUrlMode = () => {
  isUrlMode.value = true
  setTimeout(focusUrlInput, 100)
}

const resetWallpaper = () => {
  if (props.target === 'lockscreen') {
    globalSettings.lockScreenWallpaper = 'default'
  } else if (props.target === 'chatlist') {
    globalSettings.chatListWallpaper = 'default'
  } else {
    globalSettings.wallpaper = 'default'
  }
  wallpaperUrlInput.value = ''
}

import { computed } from 'vue'
const currentWallpaper = computed(() => {
  if (props.target === 'lockscreen') return globalSettings.lockScreenWallpaper
  if (props.target === 'chatlist') return globalSettings.chatListWallpaper
  return globalSettings.wallpaper
})
</script>

<template>
  <Transition name="gallery-fade">
    <div class="theme-wallpaper-modal" v-if="visible" :class="[currentStyle, { 'is-dark': globalSettings.darkMode }]">
      <div class="wallpaper-backdrop" @click="handleClose"></div>
      
      <!-- INS风: 纯白留白卡片 -->
      <div v-if="currentStyle === 'ins'" class="wp-panel-ins">
        <button class="wp-close-ins" @click="handleClose">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div class="wp-preview-ins" :style="{ backgroundImage: currentWallpaper === 'default' ? 'none' : `url(${currentWallpaper})` }">
           <span v-if="currentWallpaper === 'default'" class="wp-default-text">壁纸预览</span>
        </div>
        <div class="wp-actions-ins">
          <template v-if="!isUrlMode">
            <div class="wp-btn-ins" @click="triggerFileInput">本地相册</div>
            <div class="wp-btn-ins" @click="handleUrlMode">URL链接</div>
            <div class="wp-btn-ins danger" @click="resetWallpaper">重置默认</div>
          </template>
          <template v-else>
             <input type="text" class="wp-input-ins" v-model="wallpaperUrlInput" @blur="applyUrlWallpaper; isUrlMode = false" @keyup.enter="applyUrlWallpaper; isUrlMode = false" ref="urlInputRef" placeholder="粘贴链接并回车" />
          </template>
        </div>
      </div>

      <!-- 极简风: 画廊展签 -->
      <div v-else-if="currentStyle === 'minimalist'" class="wp-panel-minimal">
        <button class="wp-close-minimal" @click="handleClose">
          <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" stroke-width="1" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div class="wp-preview-minimal" :style="{ backgroundImage: currentWallpaper === 'default' ? 'none' : `url(${currentWallpaper})` }"></div>
        <div class="wp-info-minimal">
          <h3 class="wp-title-minimal">壁纸</h3>
          <div class="wp-actions-minimal" v-if="!isUrlMode">
            <span @click="triggerFileInput">从相册选取</span>
            <span @click="handleUrlMode">输入链接</span>
            <span class="reset" @click="resetWallpaper">恢复默认</span>
          </div>
          <div class="wp-url-minimal" v-else>
             <input type="text" v-model="wallpaperUrlInput" @blur="applyUrlWallpaper; isUrlMode = false" @keyup.enter="applyUrlWallpaper; isUrlMode = false" ref="urlInputRef" placeholder="URL..." />
          </div>
        </div>
      </div>

      <!-- 现代iOS: 原生底部抽屉 -->
      <div v-else-if="currentStyle === 'modern_ios'" class="wp-panel-modern">
        <div class="wp-modern-sheet">
           <div class="wp-modern-handle"></div>
           <div class="wp-preview-modern" :style="{ backgroundImage: currentWallpaper === 'default' ? 'none' : `url(${currentWallpaper})` }">
             <span v-if="currentWallpaper === 'default'" class="wp-default-text">预览</span>
           </div>
           <div class="wp-modern-menu" v-if="!isUrlMode">
             <div class="wp-modern-item" @click="triggerFileInput">从相册选取</div>
             <div class="wp-modern-item" @click="handleUrlMode">输入网络链接</div>
             <div class="wp-modern-item danger" @click="resetWallpaper">恢复系统默认</div>
           </div>
           <div class="wp-modern-url" v-else>
             <input type="text" class="wp-input-modern" v-model="wallpaperUrlInput" @blur="applyUrlWallpaper; isUrlMode = false" @keyup.enter="applyUrlWallpaper; isUrlMode = false" ref="urlInputRef" placeholder="在此粘贴图片链接" />
           </div>
        </div>
        <div class="wp-modern-cancel-sheet" @click="handleClose">
          取消
        </div>
      </div>

      <!-- 古早iOS: 拟物复古相框 -->
      <div v-else-if="currentStyle === 'classic_ios'" class="wp-panel-classic">
        <button class="wp-close-classic" @click="handleClose">×</button>
        <div class="wp-classic-frame">
           <div class="wp-preview-classic" :style="{ backgroundImage: currentWallpaper === 'default' ? 'none' : `url(${currentWallpaper})` }">
             <div class="wp-classic-glass"></div>
           </div>
        </div>
        <div class="wp-actions-classic">
           <template v-if="!isUrlMode">
             <button class="wp-btn-classic" @click="triggerFileInput">相册选取</button>
             <button class="wp-btn-classic" @click="handleUrlMode">网络链接</button>
             <button class="wp-btn-classic red" @click="resetWallpaper">恢复默认</button>
           </template>
           <template v-else>
             <div class="wp-input-classic-wrap">
               <input type="text" class="wp-input-classic" v-model="wallpaperUrlInput" @blur="applyUrlWallpaper; isUrlMode = false" @keyup.enter="applyUrlWallpaper; isUrlMode = false" ref="urlInputRef" placeholder="http://..." />
             </div>
           </template>
        </div>
      </div>

      <!-- 隐藏的 input -->
      <input type="file" accept="image/*" class="hidden-file-input" ref="fileInputRef" @change="onFileChange" />
    </div>
  </Transition>
</template>

<style scoped>
/* ========== 沉浸式壁纸设置 (四大主题自适应) ========== */
.theme-wallpaper-modal {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  z-index: 200; display: flex; flex-direction: column; justify-content: center; align-items: center;
  overflow: hidden;
}
.wallpaper-backdrop {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.hidden-file-input { display: none; }

/* --- INS风 (纯白留白卡片) --- */
.theme-wallpaper-modal.ins .wallpaper-backdrop { background: rgba(0,0,0,0.4); }
.wp-panel-ins {
  position: relative; z-index: 10; width: 260px; background: var(--sys-bg-secondary);
  border-radius: 20px; padding: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.15);
  display: flex; flex-direction: column; gap: 16px;
}
.theme-wallpaper-modal.ins.is-dark .wp-panel-ins { background: #1a1a1a; }
.wp-preview-ins {
  width: 100%; aspect-ratio: 1/1; border-radius: 12px; background-color: var(--sys-bg-primary);
  background-size: cover; background-position: center; display: flex; justify-content: center; align-items: center;
}
.theme-wallpaper-modal.ins.is-dark .wp-preview-ins { background-color: #2a2a2a; }
.wp-default-text { color: var(--text-tertiary); font-size: 13px; letter-spacing: 2px; }
.wp-close-ins {
  position: absolute; top: 12px; right: 12px; width: 26px; height: 26px;
  border-radius: 50%; background: var(--sys-bg-primary); border: none; color: var(--text-secondary);
  display: flex; justify-content: center; align-items: center; cursor: pointer;
  z-index: 20; transition: background 0.2s;
}
.theme-wallpaper-modal.ins.is-dark .wp-close-ins { background: #333; color: var(--text-tertiary); }
.wp-close-ins:active { background: #e0e0e0; }
.theme-wallpaper-modal.ins.is-dark .wp-close-ins:active { background: #444; }
.wp-actions-ins { display: flex; flex-direction: column; gap: 4px; }
.wp-btn-ins {
  padding: 12px 0; text-align: center; font-size: 15px; font-weight: 600; color: #262626;
  cursor: pointer; border-radius: 10px; transition: background 0.2s;
}
.theme-wallpaper-modal.ins.is-dark .wp-btn-ins { color: #fff; }
.wp-btn-ins:active { background: var(--sys-bg-primary); }
.theme-wallpaper-modal.ins.is-dark .wp-btn-ins:active { background: #333; }
.wp-btn-ins.danger { color: #ed4956; font-weight: 400; }
.wp-input-ins {
  width: 100%; padding: 12px; box-sizing: border-box; background: var(--sys-bg-primary); border: none;
  border-radius: 10px; text-align: center; font-size: 14px; outline: none; color: #262626;
}
.theme-wallpaper-modal.ins.is-dark .wp-input-ins { background: #2a2a2a; color: #fff; }

/* --- 极简风 (黑白画廊展签) --- */
.theme-wallpaper-modal.minimalist .wallpaper-backdrop { background: var(--sys-bg-primary); backdrop-filter: none; }
.theme-wallpaper-modal.minimalist.is-dark .wallpaper-backdrop { background: #000; }
.wp-panel-minimal {
  position: relative; z-index: 10; width: 100%; height: 100%; display: flex; flex-direction: column; padding: 40px; box-sizing: border-box;
}
.wp-preview-minimal {
  width: 100%; flex: 1; border: 1px solid #111; background-color: var(--sys-bg-primary);
  background-size: cover; background-position: center; margin-bottom: 40px;
}
.theme-wallpaper-modal.minimalist.is-dark .wp-preview-minimal { border-color: #fff; background-color: var(--text-primary); }
.wp-close-minimal {
  position: absolute; top: 30px; right: 30px; background: transparent; border: none;
  color: var(--text-primary); cursor: pointer; transition: opacity 0.2s; z-index: 20; padding: 10px;
}
.theme-wallpaper-modal.minimalist.is-dark .wp-close-minimal { color: #fff; }
.wp-close-minimal:hover { opacity: 0.5; }
.wp-info-minimal { display: flex; flex-direction: column; gap: 20px; margin-bottom: 40px; }
.wp-title-minimal { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 4px; color: var(--text-primary); }
.theme-wallpaper-modal.minimalist.is-dark .wp-title-minimal { color: #fff; }
.wp-actions-minimal { display: flex; flex-direction: column; gap: 15px; }
.wp-actions-minimal span {
  font-size: 24px; font-weight: 300; letter-spacing: -0.5px; color: var(--text-primary); cursor: pointer; transition: opacity 0.2s;
}
.theme-wallpaper-modal.minimalist.is-dark .wp-actions-minimal span { color: #fff; }
.wp-actions-minimal span:hover { opacity: 0.5; }
.wp-actions-minimal span.reset { font-size: 14px; color: var(--text-tertiary); margin-top: 10px; }
.wp-url-minimal input {
  width: 100%; background: transparent; border: none; border-bottom: 2px solid #111;
  font-size: 20px; padding: 10px 0; outline: none; color: var(--text-primary); border-radius: 0;
}
.theme-wallpaper-modal.minimalist.is-dark .wp-url-minimal input { border-bottom-color: #fff; color: #fff; }

/* --- 现代iOS (底部毛玻璃抽屉) --- */
.theme-wallpaper-modal.modern_ios { justify-content: flex-end; }
.wp-panel-modern { width: 100%; position: relative; z-index: 10; padding: 10px; box-sizing: border-box; }
.wp-modern-sheet {
  background: rgba(255,255,255,0.8); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px);
  border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 16px;
}
.theme-wallpaper-modal.modern_ios.is-dark .wp-modern-sheet { background: rgba(30,30,30,0.8); }
.wp-modern-handle { width: 40px; height: 5px; border-radius: 3px; background: rgba(0,0,0,0.2); margin: 0 auto; }
.theme-wallpaper-modal.modern_ios.is-dark .wp-modern-handle { background: rgba(255,255,255,0.2); }
.wp-preview-modern {
  width: 100%; height: 180px; border-radius: 12px; background-color: #e5e5ea;
  background-size: cover; background-position: center; display: flex; justify-content: center; align-items: center;
}
.theme-wallpaper-modal.modern_ios.is-dark .wp-preview-modern { background-color: #2c2c2e; }
.wp-modern-menu { background: var(--sys-bg-secondary); border-radius: 14px; overflow: hidden; }
.theme-wallpaper-modal.modern_ios.is-dark .wp-modern-menu { background: #1c1c1e; }
.wp-modern-item {
  padding: 16px; text-align: center; font-size: 17px; font-weight: 400; color: #007aff;
  border-bottom: 0.5px solid var(--border-color); cursor: pointer;
}
.theme-wallpaper-modal.modern_ios.is-dark .wp-modern-item { border-bottom-color: rgba(255,255,255,0.1); }
.wp-modern-item:last-child { border-bottom: none; }
.wp-modern-item:active { background: #e5e5ea; }
.theme-wallpaper-modal.modern_ios.is-dark .wp-modern-item:active { background: #2c2c2e; }
.wp-modern-item.danger { color: #ff3b30; }
.wp-input-modern {
  width: 100%; padding: 16px; box-sizing: border-box; background: var(--sys-bg-secondary); border: none;
  border-radius: 14px; text-align: center; font-size: 17px; outline: none; color: var(--text-primary);
}
.theme-wallpaper-modal.modern_ios.is-dark .wp-input-modern { background: #1c1c1e; color: #fff; }
.wp-modern-cancel-sheet {
  margin-top: 8px; background: rgba(255,255,255,0.8); border-radius: 14px; padding: 16px;
  text-align: center; font-size: 17px; font-weight: 600; color: #007aff; cursor: pointer;
  backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px);
}
.theme-wallpaper-modal.modern_ios.is-dark .wp-modern-cancel-sheet { background: rgba(30,30,30,0.8); }
.wp-modern-cancel-sheet:active { background: #e5e5ea; }
.theme-wallpaper-modal.modern_ios.is-dark .wp-modern-cancel-sheet:active { background: #2c2c2e; }

/* --- 古早iOS (拟物复古相框) --- */
.theme-wallpaper-modal.classic_ios .wallpaper-backdrop {
  background-color: #2c3e50;
  background-image: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px);
  opacity: 0.9;
}
.wp-panel-classic {
  position: relative; z-index: 10; width: 280px; display: flex; flex-direction: column; gap: 30px; align-items: center;
}
.wp-classic-frame {
  width: 220px; height: 320px; padding: 12px; background: linear-gradient(180deg, #dcdcdc 0%, #b8b8b8 100%);
  border-radius: 8px; box-shadow: 0 10px 20px rgba(0,0,0,0.5), inset 0 1px 1px #fff;
  border: 1px solid #888;
}
.wp-preview-classic {
  width: 100%; height: 100%; background-color: #222; border: 2px solid #111;
  box-shadow: inset 0 5px 10px rgba(0,0,0,0.8); position: relative;
  background-size: cover; background-position: center;
}
.wp-classic-glass {
  position: absolute; top: 0; left: 0; width: 100%; height: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%);
  pointer-events: none;
}
.wp-close-classic {
  position: absolute; top: -15px; right: -15px; width: 36px; height: 36px;
  border-radius: 50%; background: linear-gradient(180deg, #fbfbfb 0%, #d8dde4 100%);
  border: 2px solid #fff; box-shadow: 0 4px 8px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(0,0,0,0.2);
  color: #3e5066; font-size: 24px; font-weight: bold; line-height: 1; text-shadow: 0 1px 0 #fff;
  cursor: pointer; z-index: 20; display: flex; justify-content: center; align-items: center;
}
.wp-close-classic:active {
  background: linear-gradient(180deg, #d8dde4 0%, #fbfbfb 100%);
  box-shadow: 0 2px 4px rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.2);
}
.wp-actions-classic { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.wp-btn-classic {
  background: linear-gradient(180deg, #fbfbfb 0%, #d8dde4 100%);
  border: 1px solid #7c8da5; box-shadow: 0 1px 0 rgba(255,255,255,0.8) inset, 0 2px 4px rgba(0,0,0,0.3);
  color: #3e5066; border-radius: 8px; padding: 12px; font-size: 16px; font-weight: bold;
  text-shadow: 0 1px 0 rgba(255,255,255,0.8); cursor: pointer;
}
.wp-btn-classic:active { background: linear-gradient(180deg, #d8dde4 0%, #fbfbfb 100%); box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); }
.wp-btn-classic.red {
  background: linear-gradient(180deg, #e74c3c 0%, #c0392b 100%); border-color: #922b21;
  color: #fff; text-shadow: 0 -1px 0 rgba(0,0,0,0.4); box-shadow: 0 1px 0 rgba(255,255,255,0.3) inset, 0 2px 4px rgba(0,0,0,0.3);
}
.wp-btn-classic.red:active { background: linear-gradient(180deg, #c0392b 0%, #e74c3c 100%); box-shadow: inset 0 2px 4px rgba(0,0,0,0.3); }
.wp-input-classic-wrap {
  background: var(--sys-bg-secondary); border: 2px solid #7c8da5; border-radius: 8px; padding: 4px;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.2), 0 1px 0 rgba(255,255,255,0.8);
}
.wp-input-classic {
  width: 100%; border: none; background: transparent; padding: 8px; font-size: 16px;
  color: var(--text-primary); outline: none; box-sizing: border-box; text-align: center;
}
</style>
