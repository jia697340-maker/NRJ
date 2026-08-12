/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { globalSettings } from '../store'
import localforage from 'localforage'
import AppearanceWallpaperModal from './AppearanceWallpaperModal.vue'
import AppearanceAppIconModal from './AppearanceAppIconModal.vue'
import AppearanceFontModal from './AppearanceFontModal.vue'
import AvatarUploadModal from './AvatarUploadModal.vue'
import { useCustomFonts } from '../composables/useCustomFonts'

const emit = defineEmits(['close'])
const { records: customFonts, initialize: initializeFonts } = useCustomFonts()


// 全局聊天背景
const showGlobalWallpaperModal = ref(false)
const globalChatWallpaper = ref<string | null>(null)
const wallpaperStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'chatWallpapers'
})

// 加载全局聊天背景
onMounted(async () => {
  await initializeFonts()
  try {
    const globalWp = await wallpaperStore.getItem<string>('wallpaper_global')
    globalChatWallpaper.value = globalWp || null
  } catch (e) {
    console.error('Failed to load global wallpaper', e)
  }
})

const handleGlobalWallpaperSaved = async (url: string | null) => {
  try {
    globalChatWallpaper.value = url
    if (url) {
      await wallpaperStore.setItem('wallpaper_global', url)
    } else {
      await wallpaperStore.removeItem('wallpaper_global')
    }
  } catch (e) {
    console.error('Failed to save global wallpaper', e)
  }
}

const activeTab = ref('all') // 'all', 'display', 'personalize', 'lockscreen'

const allSettingsData = computed(() => {
  const wallpaperItems: any[] = [
    { 
      id: 'wallpaper', 
      type: 'link', 
      label: '桌面壁纸', 
      valueText: '默认'
    },
    { 
      id: 'chatListWallpaper', 
      type: 'link', 
      label: '聊天列表壁纸', 
      valueText: '默认'
    },
    {
      id: 'globalChatWallpaper',
      type: 'link',
      label: '全局聊天室背景',
      valueText: globalChatWallpaper.value ? '已设置' : '默认'
    }
  ]

  const personalizeItems: any[] = [
    { 
      id: 'accent_color', 
      type: 'color', 
      label: '系统强调色', 
      colorValue: globalSettings.accentColor
    },
    {
      id: 'app_icons',
      type: 'link',
      label: '自定义应用图标',
      valueText: '设置'
    },
    {
      id: 'custom_fonts',
      type: 'link',
      label: '自定义字体',
      valueText: customFonts.filter(font => font.enabled).length
        ? `已启用 ${customFonts.filter(font => font.enabled).length} 个`
        : '默认'
    },
    {
      id: 'enableSlider',
      type: 'toggle',
      label: '侧边栏可拖拽',
      value: globalSettings.enableSlider
    },
    {
      id: 'sliderIcon',
      type: 'link',
      label: '侧边栏拖拽图标',
      valueText: globalSettings.sliderIcon
    }
  ]

  const lockScreenItems: any[] = [
    {
      id: 'enableLockScreen',
      type: 'toggle',
      label: '启用锁屏',
      value: globalSettings.enableLockScreen
    }
  ]

  if (globalSettings.enableLockScreen) {
    wallpaperItems.push({
      id: 'lockScreenWallpaper',
      type: 'link',
      label: '锁屏壁纸',
      valueText: '默认'
    })

    const unlockMethodNames: Record<string, string> = {
      swipe: '滑动解锁',
      digit: '数字密码',
      qa: '私密问答'
    }
    lockScreenItems.push({
      id: 'unlockMethod',
      type: 'link',
      label: '解锁方式',
      valueText: unlockMethodNames[globalSettings.unlockMethod] || '滑动解锁'
    })

    if (globalSettings.unlockMethod === 'digit') {
      lockScreenItems.push({
        id: 'unlockDigit',
        type: 'link',
        label: '数字密码',
        valueText: globalSettings.unlockDigit ? '已设置' : '未设置'
      })
    }

    if (globalSettings.unlockMethod === 'qa') {
      lockScreenItems.push({
        id: 'unlockQaQuestion',
        type: 'link',
        label: '专属问题',
        valueText: globalSettings.unlockQaQuestion || '未设置'
      })
      lockScreenItems.push({
        id: 'unlockQaAnswer',
        type: 'link',
        label: '正确答案',
        valueText: globalSettings.unlockQaAnswer ? '已隐藏' : '未设置'
      })
    }
  }

  return [
    {
      id: 'display',
      title: '显示',
      items: [
        { 
          id: 'darkMode', 
          type: 'toggle', 
          label: '夜间模式', 
          value: globalSettings.darkMode
        },
        { 
          id: 'nightShift', 
          type: 'toggle', 
          label: '护眼模式', 
          value: globalSettings.nightShift
        },
        {
          id: 'showStatusBar',
          type: 'toggle',
          label: '显示状态栏',
          value: globalSettings.showStatusBar
        },
        {
          id: 'showNotch',
          type: 'toggle',
          label: '灵动岛',
          value: globalSettings.showNotch
        },
        {
          id: 'showDockAppNames',
          type: 'toggle',
          label: 'Dock应用名',
          value: globalSettings.showDockAppNames
        }
      ]
    },
    {
      id: 'personalize',
      title: '个性化',
      items: personalizeItems
    },
    {
      id: 'wallpapers',
      title: '壁纸与背景',
      items: wallpaperItems
    },
    {
      id: 'lockscreen',
      title: '锁屏',
      items: lockScreenItems
    }
  ]
})

const displayedSettingsData = computed(() => {
  if (activeTab.value === 'all') return allSettingsData.value
  return allSettingsData.value.filter(group => group.id === activeTab.value)
})

// === 弹窗状态与逻辑 ===

// 壁纸
const showWallpaperModal = ref(false)
const wallpaperTarget = ref<'desktop' | 'lockscreen' | 'chatlist'>('desktop')

// 自定义应用图标
const showAppIconModal = ref(false)
const showFontModal = ref(false)

// 强调色 (极简黑白灰阶)
const showColorModal = ref(false)
const colorOptions = [
  '#000000', // 纯黑
  '#1a1a1a', // 深黑
  '#333333', // 深灰
  '#666666', // 中灰
  '#999999', // 浅灰
  '#bbbbbb', // 亮灰
  '#dddddd', // 银灰
  '#f0f0f0'  // 近白
]
const applyAccentColor = (color: string) => {
  globalSettings.accentColor = color
  showColorModal.value = false
}

// 解锁方式
const showUnlockMethodModal = ref(false)
const unlockMethodOptions = [
  { id: 'swipe', name: '滑动解锁' },
  { id: 'digit', name: '数字密码' },
  { id: 'qa', name: '私密问答' }
]
const applyUnlockMethod = (methodId: string) => {
  globalSettings.unlockMethod = methodId
  showUnlockMethodModal.value = false
}

// 滑块图标
const showSliderIconModal = ref(false)
const sliderIconOptions = ['⚬', '・', '✦', '✧', '⊹', '♡', '☁', '✐']
const applySliderIcon = (icon: string) => {
  globalSettings.sliderIcon = icon
  showSliderIconModal.value = false
}

// 输入弹窗
const showInputModal = ref(false)
const inputModalTitle = ref('')
const inputModalValue = ref('')
const inputModalTarget = ref('') // 'digit', 'qa_q', 'qa_a', 'idName', 'idDesc'
const inputModalError = ref('')

const openInputModal = (target: string, title: string, currentValue: string) => {
  inputModalTarget.value = target
  inputModalTitle.value = title
  inputModalValue.value = currentValue
  inputModalError.value = ''
  showInputModal.value = true
}

const handleInputModalSubmit = async () => {
  if (inputModalTarget.value === 'digit') {
    if (!inputModalValue.value) {
      inputModalError.value = '不可以为空哦'
      return
    }
    if (!/^\d+$/.test(inputModalValue.value)) {
      inputModalError.value = '只能填写数字'
      return
    }
    globalSettings.unlockDigit = inputModalValue.value
  } else if (inputModalTarget.value === 'qa_q') {
    if (!inputModalValue.value.trim()) {
      inputModalError.value = '不可以为空哦'
      return
    }
    globalSettings.unlockQaQuestion = inputModalValue.value.trim()
  } else if (inputModalTarget.value === 'qa_a') {
    if (!inputModalValue.value.trim()) {
      inputModalError.value = '不可以为空哦'
      return
    }
    globalSettings.unlockQaAnswer = inputModalValue.value.trim()
  }
  showInputModal.value = false
}


// 点击项目分发
const handleItemClick = (item: any) => {
  if (item.type === 'toggle') {
    if (['darkMode', 'nightShift', 'showStatusBar', 'showNotch', 'chargingBoltInside', 'enableSlider', 'showDockAppNames', 'enableLockScreen'].includes(item.id)) {
      (globalSettings as any)[item.id] = !item.value
    }
  } else if (item.id === 'wallpaper') {
    wallpaperTarget.value = 'desktop'
    showWallpaperModal.value = true
  } else if (item.id === 'chatListWallpaper') {
    wallpaperTarget.value = 'chatlist'
    showWallpaperModal.value = true
  } else if (item.id === 'globalChatWallpaper') {
    showGlobalWallpaperModal.value = true
  } else if (item.id === 'lockScreenWallpaper') {
    wallpaperTarget.value = 'lockscreen'
    showWallpaperModal.value = true
  } else if (item.id === 'accent_color') {
    showColorModal.value = true
  } else if (item.id === 'app_icons') {
    showAppIconModal.value = true
  } else if (item.id === 'custom_fonts') {
    showFontModal.value = true
  } else if (item.id === 'sliderIcon') {
    showSliderIconModal.value = true
  } else if (item.id === 'unlockMethod') {
    showUnlockMethodModal.value = true
  } else if (item.id === 'unlockDigit') {
    openInputModal('digit', '设置密码', globalSettings.unlockDigit)
  } else if (item.id === 'unlockQaQuestion') {
    openInputModal('qa_q', '提个问题', globalSettings.unlockQaQuestion)
  } else if (item.id === 'unlockQaAnswer') {
    openInputModal('qa_a', '正确答案', globalSettings.unlockQaAnswer)
  }
}
</script>

<template>
  <div class="soft-appearance-container">
    <!-- 独立的装饰层（手账素材） -->
    <div class="deco-layer">
      <div class="deco-bg"></div>
      
      <!-- 弥散渐变水蓝背景层 -->
      <div class="gradient-overlay"></div>

      <!-- 装饰性返回视觉 (解耦了真正的点击) -->
      <div class="deco-back-visual">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        <span class="back-text">RETURN</span>
      </div>

    </div>

    <!-- 交互与内容层 -->
    <div class="interactive-layer">
      <!-- 真实的不可见返回触控区 -->
      <div class="back-touch-zone" @click="emit('close')"></div>

      <div class="fixed-header-container">
        
        <!-- 页面标题：强化高级排版 -->
        <div class="page-title-area">
          <div class="title-deco-line"></div>
          <h1 class="page-title">外观设置</h1>
          <p class="page-subtitle">Appearance / Settings</p>
        </div>

        <!-- 书签导航 Tab -->
        <div class="sticky-tab-container">
          <div class="book-tabs">
            <div class="book-tab-item" :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">全部</div>
            <div class="book-tab-item" :class="{ active: activeTab === 'display' }" @click="activeTab = 'display'">显示</div>
            <div class="book-tab-item" :class="{ active: activeTab === 'personalize' }" @click="activeTab = 'personalize'">个性化</div>
            <div class="book-tab-item" :class="{ active: activeTab === 'wallpapers' }" @click="activeTab = 'wallpapers'">壁纸</div>
            <div class="book-tab-item" :class="{ active: activeTab === 'lockscreen' }" @click="activeTab = 'lockscreen'">锁屏</div>
          </div>
        </div>
      </div>

      <div class="scroll-container">
        <div class="settings-card book-style" v-for="group in displayedSettingsData" :key="group.id">
          <div class="card-header">
            <span class="card-title-text">{{ group.title }}</span>
            <div class="card-title-line"></div>
          </div>
          <div class="settings-list">
            <div class="setting-item" v-for="item in group.items" :key="item.id" @click="handleItemClick(item)">
              <span class="item-label">{{ item.label }}</span>
              <div class="item-control">
                <template v-if="item.type === 'toggle'">
                  <div class="soft-toggle" :class="{ 'is-active': item.value }">
                    <div class="soft-toggle-knob"></div>
                  </div>
                </template>
                <template v-else-if="item.type === 'link'">
                  <span class="soft-value">{{ item.valueText }}</span>
                </template>
                <template v-else-if="item.type === 'color'">
                  <div class="soft-color-preview">
                    <div class="color-dot" :style="{ background: item.colorValue }"></div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
        
        <div class="bottom-spacer"></div>
      </div>
    </div>

    <!-- 自定义图标弹窗 -->
    <AppearanceAppIconModal
      v-model:visible="showAppIconModal"
    />

    <AppearanceFontModal
      v-model:visible="showFontModal"
    />

    <!-- 壁纸弹窗 (保持复用) -->
    <AppearanceWallpaperModal
      v-model:visible="showWallpaperModal"
      current-style="ins"
      :target="wallpaperTarget"
    />

    <!-- 毛玻璃颜色选择弹窗 -->
    <Transition name="soft-fade">
      <div class="soft-modal-overlay" v-if="showColorModal" @click="showColorModal = false">
        <div class="soft-modal-panel" @click.stop>
          <div class="soft-modal-header">
            <span class="title">选择强调色</span>
            <button class="close-btn" @click="showColorModal = false">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="soft-color-grid">
            <div 
              class="soft-color-item" 
              v-for="color in colorOptions" 
              :key="color"
              :style="{ backgroundColor: color }"
              :class="{ active: globalSettings.accentColor === color }"
              @click="applyAccentColor(color)"
            ></div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 毛玻璃解锁方式弹窗 -->
    <Transition name="soft-fade">
      <div class="soft-modal-overlay" v-if="showUnlockMethodModal" @click="showUnlockMethodModal = false">
        <div class="soft-modal-panel" @click.stop>
          <div class="soft-modal-header">
            <span class="title">解锁方式</span>
            <button class="close-btn" @click="showUnlockMethodModal = false">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="soft-list">
            <div 
              class="soft-list-item" 
              v-for="method in unlockMethodOptions" 
              :key="method.id"
              @click="applyUnlockMethod(method.id)"
            >
              <span :class="{ 'is-selected': globalSettings.unlockMethod === method.id }">{{ method.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 毛玻璃滑块图标弹窗 -->
    <Transition name="soft-fade">
      <div class="soft-modal-overlay" v-if="showSliderIconModal" @click="showSliderIconModal = false">
        <div class="soft-modal-panel" @click.stop>
          <div class="soft-modal-header">
            <span class="title">侧边栏拖拽图标</span>
            <button class="close-btn" @click="showSliderIconModal = false">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="soft-icon-grid">
            <div 
              class="soft-icon-item" 
              v-for="icon in sliderIconOptions" 
              :key="icon"
              :class="{ active: globalSettings.sliderIcon === icon }"
              @click="applySliderIcon(icon)"
            >
              {{ icon }}
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 毛玻璃输入弹窗 -->
    <Transition name="soft-fade">
      <div class="soft-modal-overlay" v-if="showInputModal" @click="showInputModal = false">
        <div class="soft-modal-panel" @click.stop>
          <div class="soft-modal-header">
            <span class="title">{{ inputModalTitle }}</span>
            <button class="close-btn" @click="showInputModal = false">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="soft-input-wrap">
            <input 
              type="text" 
              v-model="inputModalValue" 
              class="soft-input"
              :placeholder="inputModalTarget === 'digit' ? '填写数字' : '填写内容'"
              @keyup.enter="handleInputModalSubmit"
              @input="inputModalError = ''"
              autofocus
            />
            <div class="soft-error" v-if="inputModalError">{{ inputModalError }}</div>
          </div>
          <div class="soft-modal-actions">
            <button class="soft-btn-cancel" @click="showInputModal = false">取消</button>
            <button class="soft-btn-confirm" @click="handleInputModalSubmit">确认</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 头像上传弹窗：挂载到 body -->
    <Teleport to="body">
      <AvatarUploadModal
        v-model:visible="showGlobalWallpaperModal"
        :current-avatar="globalChatWallpaper"
        shape="wallpaper"
        title="设置全局聊天背景"
        @saved="handleGlobalWallpaperSaved"
      />
    </Teleport>

  </div>
</template>

<style scoped>
@import './AppearanceSettings.css';
</style>
