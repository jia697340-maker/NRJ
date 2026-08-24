<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import BubbleRangeControl from './bubble/BubbleRangeControl.vue'
import BubblePresetModal from './bubble/modals/BubblePresetModal.vue'
import BubbleExportModal from './bubble/modals/BubbleExportModal.vue'
import BubbleImportModal from './bubble/modals/BubbleImportModal.vue'
import {
  DEFAULT_BUBBLE_CSS,
  DEFAULT_SIDE_STYLE,
  SYSTEM_BUBBLE_PRESET,
  bubbleAssetUrls,
  bubbleWorkshopState,
  buildBubblePresetCss,
  createBubblePreset,
  getBubbleOrnamentStyle,
  getBubblePreset,
  hydrateBubblePresetAssets,
  saveBubbleAsset,
  saveBubblePreset,
  setGlobalBubblePreset,
  validateBubbleCss,
  type BubbleAnchor,
  type BubbleOrnament,
  type BubblePreset,
  type BubbleSideStyle
} from '../services/bubbleWorkshop'

const emit = defineEmits<{ close: [] }>()

const makeDraft = (): BubblePreset => ({
  ...JSON.parse(JSON.stringify(SYSTEM_BUBBLE_PRESET)),
  id: `draft-${Date.now()}`,
  name: '未命名气泡',
  source: 'created'
})

const currentId = ref('')
const draft = ref<BubblePreset>(makeDraft())
const savedSnapshot = ref(JSON.stringify(draft.value))
const activeSide = ref<'self' | 'other'>('self')
const activeTab = ref<'style' | 'image' | 'decor' | 'code'>('style')
const previewMode = ref<'light' | 'dark' | 'wallpaper'>('light')
const currentViewMode = ref<'edit' | 'preview'>('edit')
const toast = ref('')

const presetModalVisible = ref(false)
const exportModalVisible = ref(false)
const importModalVisible = ref(false)

const fileInput = ref<HTMLInputElement | null>(null)
const uploadTarget = ref<'background' | 'frame' | 'mask' | 'tail' | 'ornament'>('background')
const ornamentAnchor = ref<BubbleAnchor>('top-right')
const selectedOrnamentId = ref('')
const busy = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | undefined
const previewStyleId = 'bubble-workshop-preview-style'

const side = computed(() => draft.value[activeSide.value])
const isDirty = computed(() => JSON.stringify(draft.value) !== savedSnapshot.value)
const isDraft = computed(() => draft.value.id.startsWith('draft-') || draft.value.id === '__system__')
const isGlobal = computed(() => bubbleWorkshopState.globalPresetId === draft.value.id)
const cssError = computed(() => validateBubbleCss(draft.value.customCss))
const selectedOrnament = computed(() => side.value.ornaments.find(item => item.id === selectedOrnamentId.value) || null)

const notify = (message: string) => {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2400)
}

const updatePreview = async () => {
  await hydrateBubblePresetAssets(draft.value)
  let style = document.getElementById(previewStyleId) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = previewStyleId
    document.head.appendChild(style)
  }
  style.textContent = buildBubblePresetCss(draft.value).replaceAll('.chat-bubble-theme', '.bw-preview-scope')
}

watch(draft, updatePreview, { deep: true })

onMounted(async () => {
  if (bubbleWorkshopState.presets.length > 0) {
    const target = bubbleWorkshopState.presets.find(p => p.id === bubbleWorkshopState.globalPresetId) || bubbleWorkshopState.presets[0]
    await choosePreset(target.id)
  } else {
    await updatePreview()
  }
})

onUnmounted(() => document.getElementById(previewStyleId)?.remove())

const choosePreset = async (id: string) => {
  currentId.value = id
  draft.value = getBubblePreset(id)
  savedSnapshot.value = JSON.stringify(draft.value)
  selectedOrnamentId.value = ''
  await updatePreview()
}

const handlePresetSelected = async (preset: BubblePreset) => {
  await choosePreset(preset.id)
  notify(`已载入「${preset.name}」`)
}

const newWork = () => {
  currentId.value = ''
  draft.value = makeDraft()
  savedSnapshot.value = JSON.stringify(draft.value)
  selectedOrnamentId.value = ''
  notify('已新建空白作品')
}

const saveWork = () => {
  if (cssError.value) {
    activeTab.value = 'code'
    notify(cssError.value)
    return null
  }
  if (isDraft.value) {
    const created = createBubblePreset(draft.value, draft.value.name || '我的气泡')
    draft.value = created
    currentId.value = created.id
  } else {
    draft.value = saveBubblePreset(draft.value)
  }
  savedSnapshot.value = JSON.stringify(draft.value)
  notify('方案已保存')
  return draft.value
}

const applyWork = () => {
  const saved = saveWork()
  if (!saved) return
  setGlobalBubblePreset(saved.id)
  notify('已设为全局气泡')
}

const copySide = () => {
  const target = activeSide.value === 'self' ? 'other' : 'self'
  draft.value[target] = JSON.parse(JSON.stringify(side.value))
  notify(`已复制${activeSide.value === 'self' ? '自己' : '对方'}的设置到另一侧`)
}

const resetSide = () => {
  draft.value[activeSide.value] = JSON.parse(JSON.stringify(DEFAULT_SIDE_STYLE))
  selectedOrnamentId.value = ''
  notify('当前一侧已重置为默认')
}

const resetValue = <K extends keyof BubbleSideStyle>(key: K) => {
  side.value[key] = JSON.parse(JSON.stringify(DEFAULT_SIDE_STYLE[key])) as BubbleSideStyle[K]
}

const triggerAsset = (target: typeof uploadTarget.value) => {
  uploadTarget.value = target
  fileInput.value?.click()
}

const handleAssetUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    busy.value = true
    const asset = await saveBubbleAsset(file)
    const current = side.value
    if (uploadTarget.value === 'background') current.backgroundImageId = asset.id
    if (uploadTarget.value === 'frame') current.frameImageId = asset.id
    if (uploadTarget.value === 'mask') current.maskImageId = asset.id
    if (uploadTarget.value === 'tail') {
      current.tailImageId = asset.id
      current.tailType = 'image'
    }
    if (uploadTarget.value === 'ornament') {
      const ornament: BubbleOrnament = {
        id: `ornament-${Date.now()}`,
        assetId: asset.id,
        name: file.name,
        anchor: ornamentAnchor.value,
        offsetX: -8,
        offsetY: -8,
        size: 44,
        rotation: 0,
        opacity: 1,
        zIndex: 2
      }
      current.ornaments.push(ornament)
      selectedOrnamentId.value = ornament.id
    }
    await updatePreview()
    notify('素材已应用到当前气泡')
  } catch (error: any) {
    notify(error?.message || '素材导入失败')
  } finally {
    busy.value = false
  }
}

const clearAsset = (field: 'backgroundImageId' | 'frameImageId' | 'maskImageId' | 'tailImageId') => {
  side.value[field] = ''
  if (field === 'tailImageId') side.value.tailType = 'none'
}

const deleteOrnament = () => {
  if (!selectedOrnament.value) return
  side.value.ornaments = side.value.ornaments.filter(item => item.id !== selectedOrnament.value?.id)
  selectedOrnamentId.value = ''
}

const resetOrnament = <K extends keyof BubbleOrnament>(key: K, value: BubbleOrnament[K]) => {
  if (selectedOrnament.value) selectedOrnament.value[key] = value
}

const setOrnamentAnchor = (anchor: BubbleAnchor) => {
  const item = selectedOrnament.value
  if (!item || item.anchor === anchor) return
  if (anchor === 'free') { item.offsetX = 50; item.offsetY = 50 }
  else if (item.anchor === 'free') { item.offsetX = -8; item.offsetY = -8 }
  item.anchor = anchor
}

const resetOrnamentAnchor = () => {
  const item = selectedOrnament.value
  if (!item) return
  item.anchor = 'top-right'
  item.offsetX = -8
  item.offsetY = -8
}

const assetStyle = (item: BubbleOrnament) => getBubbleOrnamentStyle(item)

const handleImportSuccess = (imported: BubblePreset[]) => {
  if (imported[0]) {
    choosePreset(imported[0].id)
  }
}
</script>

<template>
  <div class="bw-app">
    <!-- 顶部纯白导航 Header -->
    <header class="bw-header">
      <div class="bw-header-left">
        <button class="bw-nav-btn back" aria-label="返回" @click="emit('close')">
          <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        </button>
        <div class="bw-title-wrapper" @click="presetModalVisible = true">
          <div class="bw-title-line">
            <h2 class="bw-main-title">{{ draft.name || '未命名气泡' }}</h2>
            <svg class="bw-title-arrow" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
            <span v-if="isDirty" class="bw-tag tag-dirty">未保存</span>
            <span v-if="isGlobal" class="bw-tag tag-global">当前全局</span>
          </div>
          <p class="bw-subtitle">方案管理 ({{ bubbleWorkshopState.presets.length }})</p>
        </div>
      </div>

      <!-- 顶栏右侧核心操作 -->
      <div class="bw-header-right">
        <!-- 移动端视图切换 Tab -->
        <div class="bw-mobile-view-tabs">
          <button :class="{ active: currentViewMode === 'edit' }" @click="currentViewMode = 'edit'">编辑</button>
          <button :class="{ active: currentViewMode === 'preview' }" @click="currentViewMode = 'preview'">预览</button>
        </div>

        <div class="bw-action-group">
          <button class="bw-btn-light" title="方案管理" @click="presetModalVisible = true">
            <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <span class="btn-text">方案库</span>
          </button>
          <button class="bw-btn-light" title="导入方案" @click="importModalVisible = true">
            <svg viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
            <span class="btn-text">导入</span>
          </button>
          <button class="bw-btn-light" title="分享方案" @click="exportModalVisible = true">
            <svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8m-4-6l-4-4-4 4m4-4v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
            <span class="btn-text">分享</span>
          </button>
          <button class="bw-btn-light btn-save" title="保存方案" @click="saveWork">
            <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" fill="none"/><polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" stroke-width="2" fill="none"/></svg>
            <span class="btn-text">保存</span>
          </button>
          <button class="bw-btn-primary" title="应用为全局气泡" @click="applyWork">
            应用
          </button>
        </div>
      </div>
    </header>

    <!-- 工作台主内容区：左右分栏（大屏）/ Tab 切换（小屏） -->
    <main class="bw-layout" :class="[`mobile-${currentViewMode}`]">
      
      <!-- 预览画布区域 -->
      <section class="bw-preview-column">
        <!-- 预览模式切换栏 -->
        <div class="bw-preview-header">
          <div class="bw-theme-tabs">
            <button :class="{ active: previewMode === 'light' }" @click="previewMode = 'light'">浅色模式</button>
            <button :class="{ active: previewMode === 'dark' }" @click="previewMode = 'dark'">深色模式</button>
            <button :class="{ active: previewMode === 'wallpaper' }" @click="previewMode = 'wallpaper'">壁纸模式</button>
          </div>
          <span class="bw-preview-hint">点击消息切换编辑目标</span>
        </div>

        <!-- 手机真机模拟容器 -->
        <div class="bw-device-frame" :class="[`theme-${previewMode}`]">
          <div class="bw-device-header">
            <span class="bw-device-back">
              <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
              聊天
            </span>
            <strong class="bw-device-title">气泡工坊预览</strong>
            <span class="bw-device-more">
              <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg>
            </span>
          </div>

          <div class="bw-chat-flow bw-preview-scope">
            <div class="bw-chat-timestamp">14:20</div>

            <!-- 对方消息 1 -->
            <div class="bw-row other" :class="{ selected: activeSide === 'other' }" @click="activeSide = 'other'">
              <div class="bw-user-avatar">年</div>
              <div class="bw-content-wrapper">
                <div class="bw-sender-label">年年</div>
                <div class="bw-bubble-box" data-chat-bubble="other">
                  <img v-for="item in draft.other.ornaments" :key="item.id" class="bubble-ornament" :src="bubbleAssetUrls[item.assetId]" :style="assetStyle(item)" />
                  今天过得怎么样？我正在调新的气泡样式呢。
                </div>
              </div>
            </div>

            <!-- 对方消息 2 (带引用) -->
            <div class="bw-row other" :class="{ selected: activeSide === 'other' }" @click="activeSide = 'other'">
              <div class="bw-user-avatar placeholder" />
              <div class="bw-content-wrapper">
                <div class="bw-bubble-box" data-chat-bubble="other">
                  <img v-for="item in draft.other.ornaments" :key="item.id" class="bubble-ornament" :src="bubbleAssetUrls[item.assetId]" :style="assetStyle(item)" />
                  <div class="bw-quote-card" data-bubble-part="quote">引用：听起来很可爱，拍给我看看。</div>
                  快看，这朵云真的很像一只小猫！
                </div>
              </div>
            </div>

            <!-- 自己消息 -->
            <div class="bw-row self" :class="{ selected: activeSide === 'self' }" @click="activeSide = 'self'">
              <div class="bw-content-wrapper">
                <div class="bw-bubble-box" data-chat-bubble="self">
                  <img v-for="item in draft.self.ornaments" :key="item.id" class="bubble-ornament" :src="bubbleAssetUrls[item.assetId]" :style="assetStyle(item)" />
                  真的耶！配色看起来非常柔和自然。
                </div>
              </div>
              <div class="bw-user-avatar self">我</div>
            </div>
          </div>

          <div class="bw-device-indicator" />
        </div>
      </section>

      <!-- 属性配置编辑区域 -->
      <section class="bw-config-column">
        
        <!-- 方案元信息与左右侧切换条 -->
        <div class="bw-top-meta-panel">
          <div class="bw-meta-name-row">
            <input v-model.trim="draft.name" class="bw-name-input" placeholder="输入方案名称..." maxlength="40" />
            <button class="bw-meta-btn" @click="newWork">新建空白</button>
          </div>

          <!-- 对方 / 我 左右大胶囊切换 -->
          <div class="bw-side-selector">
            <button :class="{ active: activeSide === 'other' }" @click="activeSide = 'other'; selectedOrnamentId = ''">
              <span class="side-indicator" />
              对方气泡 (Other)
            </button>
            <button :class="{ active: activeSide === 'self' }" @click="activeSide = 'self'; selectedOrnamentId = ''">
              <span class="side-indicator" />
              自己气泡 (Self)
            </button>
          </div>

          <!-- 双侧辅助快捷按钮 -->
          <div class="bw-side-tools-row">
            <button class="bw-tool-btn" @click="copySide">
              <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2" fill="none"/></svg>
              复制到另一侧
            </button>
            <button class="bw-tool-btn" @click="resetSide">
              <svg viewBox="0 0 24 24"><path d="M4 10a8 8 0 1 1 2.3 7.7M4 4v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
              重置当前侧
            </button>
          </div>
        </div>

        <!-- 细分类别导航 Tab -->
        <nav class="bw-nav-tabs">
          <button :class="{ active: activeTab === 'style' }" @click="activeTab = 'style'">
            色彩与轮廓
          </button>
          <button :class="{ active: activeTab === 'image' }" @click="activeTab = 'image'">
            图片与异形
          </button>
          <button :class="{ active: activeTab === 'decor' }" @click="activeTab = 'decor'">
            指示角与挂件
          </button>
          <button :class="{ active: activeTab === 'code' }" @click="activeTab = 'code'">
            CSS 拓展
          </button>
        </nav>

        <!-- 属性编辑滚动内容 -->
        <div class="bw-scroll-body">
          
          <!-- Tab 1: 色彩与轮廓 -->
          <template v-if="activeTab === 'style'">
            <div class="bw-card">
              <div class="bw-card-header">色彩与填充</div>
              
              <div class="bw-field-row">
                <label>背景底色</label>
                <div class="bw-color-input-box">
                  <input type="color" :value="side.background.startsWith('#') ? side.background : '#ffffff'" @input="side.background = ($event.target as HTMLInputElement).value" />
                  <input v-model="side.background" placeholder="#HEX 或 transparent" />
                </div>
                <button class="bw-btn-revert" @click="resetValue('background')">重置</button>
              </div>

              <div class="bw-field-row">
                <label>渐变终止色</label>
                <div class="bw-color-input-box">
                  <input type="color" :value="side.gradientEnd || '#ffffff'" @input="side.gradientEnd = ($event.target as HTMLInputElement).value" />
                  <input v-model="side.gradientEnd" placeholder="留空为纯色" />
                </div>
                <button class="bw-btn-revert" @click="resetValue('gradientEnd')">重置</button>
              </div>

              <BubbleRangeControl v-if="side.gradientEnd" v-model="side.gradientAngle" label="渐变角度" :default-value="DEFAULT_SIDE_STYLE.gradientAngle" :min="0" :max="360" unit="°" @reset="resetValue('gradientAngle')" />

              <div class="bw-field-row">
                <label>文字颜色</label>
                <div class="bw-color-input-box">
                  <input type="color" :value="side.textColor.startsWith('#') ? side.textColor : '#222222'" @input="side.textColor = ($event.target as HTMLInputElement).value" />
                  <input v-model="side.textColor" placeholder="#HEX" />
                </div>
                <button class="bw-btn-revert" @click="resetValue('textColor')">重置</button>
              </div>

              <div class="bw-field-row">
                <label>边框颜色</label>
                <div class="bw-color-input-box">
                  <input type="color" :value="side.borderColor.startsWith('#') ? side.borderColor : '#bbbbbb'" @input="side.borderColor = ($event.target as HTMLInputElement).value" />
                  <input v-model="side.borderColor" placeholder="#HEX" />
                </div>
                <button class="bw-btn-revert" @click="resetValue('borderColor')">重置</button>
              </div>

              <div class="bw-field-row">
                <label>阴影颜色</label>
                <div class="bw-color-input-box">
                  <input type="color" :value="side.shadowColor.startsWith('#') ? side.shadowColor : '#000000'" @input="side.shadowColor = ($event.target as HTMLInputElement).value" />
                  <input v-model="side.shadowColor" placeholder="rgba(0,0,0,0.1)" />
                </div>
                <button class="bw-btn-revert" @click="resetValue('shadowColor')">重置</button>
              </div>

              <BubbleRangeControl v-model="side.opacity" label="气泡不透明度" :default-value="DEFAULT_SIDE_STYLE.opacity" :min="0.1" :max="1" :step="0.05" @reset="resetValue('opacity')" />
              <BubbleRangeControl v-model="side.blur" label="毛玻璃模糊度" :default-value="DEFAULT_SIDE_STYLE.blur" :min="0" :max="40" unit="px" @reset="resetValue('blur')" />
            </div>

            <div class="bw-card">
              <div class="bw-card-header">形状与尺寸留白</div>
              
              <div class="bw-field-row align-start">
                <label>预设外形</label>
                <div class="bw-choice-grid">
                  <button v-for="opt in [{v:'rounded',n:'圆角卡片'},{v:'capsule',n:'胶囊椭圆'},{v:'cloud',n:'柔和云朵'},{v:'comic',n:'漫画尖角'},{v:'ticket',n:'票券凹角'},{v:'custom',n:'自定义裁切'}]" :key="opt.v" :class="{ active: side.shape === opt.v }" @click="side.shape = opt.v as any">{{ opt.n }}</button>
                </div>
              </div>

              <BubbleRangeControl v-model="side.radius" label="基础圆角" :default-value="DEFAULT_SIDE_STYLE.radius" :min="0" :max="40" unit="px" @reset="resetValue('radius')" />
              <BubbleRangeControl v-model="side.corner" label="出泡尖角圆角" :default-value="DEFAULT_SIDE_STYLE.corner" :min="0" :max="40" unit="px" @reset="resetValue('corner')" />
              <BubbleRangeControl v-model="side.borderWidth" label="边框粗细" :default-value="DEFAULT_SIDE_STYLE.borderWidth" :min="0" :max="8" :step="0.5" unit="px" @reset="resetValue('borderWidth')" />

              <div class="bw-field-row">
                <label>边框线型</label>
                <div class="bw-choice-row">
                  <button :class="{ active: side.borderStyle === 'solid' }" @click="side.borderStyle = 'solid'">实线</button>
                  <button :class="{ active: side.borderStyle === 'dashed' }" @click="side.borderStyle = 'dashed'">虚线</button>
                  <button :class="{ active: side.borderStyle === 'none' }" @click="side.borderStyle = 'none'">无边框</button>
                </div>
              </div>

              <BubbleRangeControl v-model="side.paddingX" label="横向内边距" :default-value="DEFAULT_SIDE_STYLE.paddingX" :min="4" :max="40" unit="px" @reset="resetValue('paddingX')" />
              <BubbleRangeControl v-model="side.paddingY" label="纵向内边距" :default-value="DEFAULT_SIDE_STYLE.paddingY" :min="4" :max="32" unit="px" @reset="resetValue('paddingY')" />
              <BubbleRangeControl v-model="side.fontSize" label="正文字号" :default-value="DEFAULT_SIDE_STYLE.fontSize" :min="11" :max="24" unit="px" @reset="resetValue('fontSize')" />
              <BubbleRangeControl v-model="side.lineHeight" label="文本行高" :default-value="DEFAULT_SIDE_STYLE.lineHeight" :min="1.1" :max="2.4" :step="0.05" @reset="resetValue('lineHeight')" />
              <BubbleRangeControl v-model="side.maxWidth" label="最大宽度限制" :default-value="DEFAULT_SIDE_STYLE.maxWidth" :min="50" :max="100" unit="%" @reset="resetValue('maxWidth')" />
              <BubbleRangeControl v-model="side.shadowBlur" label="阴影扩散" :default-value="DEFAULT_SIDE_STYLE.shadowBlur" :min="0" :max="50" unit="px" @reset="resetValue('shadowBlur')" />
              <BubbleRangeControl v-model="side.shadowY" label="阴影纵向位移" :default-value="DEFAULT_SIDE_STYLE.shadowY" :min="-15" :max="25" unit="px" @reset="resetValue('shadowY')" />
            </div>
          </template>

          <!-- Tab 2: 图片与异形 -->
          <template v-else-if="activeTab === 'image'">
            <div class="bw-card">
              <div class="bw-card-header">气泡背景图</div>
              <div class="bw-upload-block">
                <div class="bw-thumb-box" :style="bubbleAssetUrls[side.backgroundImageId] ? { backgroundImage: `url(${bubbleAssetUrls[side.backgroundImageId]})` } : {}">
                  <span v-if="!side.backgroundImageId">无素材</span>
                </div>
                <div class="bw-upload-info">
                  <strong>{{ side.backgroundImageId ? '已应用背景图片' : '上传自定义背景图' }}</strong>
                  <p>支持 PNG、WebP、JPG、GIF 动图与矢量 SVG</p>
                  <div class="bw-upload-btns">
                    <button class="bw-btn-accent" @click="triggerAsset('background')">{{ side.backgroundImageId ? '更换素材' : '选择图片' }}</button>
                    <button v-if="side.backgroundImageId" class="bw-btn-delete" @click="clearAsset('backgroundImageId')">移除</button>
                  </div>
                </div>
              </div>

              <template v-if="side.backgroundImageId">
                <div class="bw-field-row align-start">
                  <label>适配方式</label>
                  <div class="bw-choice-grid">
                    <button v-for="opt in [{v:'cover',n:'覆盖(Cover)'},{v:'contain',n:'包含(Contain)'},{v:'stretch',n:'自适应拉伸'},{v:'tile',n:'平铺(Tile)'}]" :key="opt.v" :class="{ active: side.backgroundFit === opt.v }" @click="side.backgroundFit = opt.v as any">{{ opt.n }}</button>
                  </div>
                </div>
                <BubbleRangeControl v-model="side.backgroundPositionX" label="水平对齐位置" :default-value="DEFAULT_SIDE_STYLE.backgroundPositionX" :min="0" :max="100" unit="%" @reset="resetValue('backgroundPositionX')" />
                <BubbleRangeControl v-model="side.backgroundPositionY" label="垂直对齐位置" :default-value="DEFAULT_SIDE_STYLE.backgroundPositionY" :min="0" :max="100" unit="%" @reset="resetValue('backgroundPositionY')" />
                <BubbleRangeControl v-model="side.backgroundOpacity" label="图片透明度" :default-value="DEFAULT_SIDE_STYLE.backgroundOpacity" :min="0" :max="1" :step="0.05" @reset="resetValue('backgroundOpacity')" />
              </template>
            </div>

            <div class="bw-card">
              <div class="bw-card-header">九宫格框体 (.9.png)</div>
              <div class="bw-upload-block">
                <div class="bw-thumb-box checker" :style="bubbleAssetUrls[side.frameImageId] ? { backgroundImage: `url(${bubbleAssetUrls[side.frameImageId]})` } : {}">
                  <span v-if="!side.frameImageId">无素材</span>
                </div>
                <div class="bw-upload-info">
                  <strong>{{ side.frameImageId ? '已应用九宫格框体' : '上传九宫格框体素材' }}</strong>
                  <p>四角保持原样，中间区域随文字长短自适应拉伸</p>
                  <div class="bw-upload-btns">
                    <button class="bw-btn-accent" @click="triggerAsset('frame')">{{ side.frameImageId ? '更换框体' : '选择素材' }}</button>
                    <button v-if="side.frameImageId" class="bw-btn-delete" @click="clearAsset('frameImageId')">移除</button>
                  </div>
                </div>
              </div>

              <template v-if="side.frameImageId">
                <BubbleRangeControl v-model="side.frameSliceTop" label="顶部切片" :default-value="DEFAULT_SIDE_STYLE.frameSliceTop" :min="0" :max="100" unit="%" @reset="resetValue('frameSliceTop')" />
                <BubbleRangeControl v-model="side.frameSliceRight" label="右侧切片" :default-value="DEFAULT_SIDE_STYLE.frameSliceRight" :min="0" :max="100" unit="%" @reset="resetValue('frameSliceRight')" />
                <BubbleRangeControl v-model="side.frameSliceBottom" label="底部切片" :default-value="DEFAULT_SIDE_STYLE.frameSliceBottom" :min="0" :max="100" unit="%" @reset="resetValue('frameSliceBottom')" />
                <BubbleRangeControl v-model="side.frameSliceLeft" label="左侧切片" :default-value="DEFAULT_SIDE_STYLE.frameSliceLeft" :min="0" :max="100" unit="%" @reset="resetValue('frameSliceLeft')" />
                <BubbleRangeControl v-model="side.frameWidth" label="边框渲染宽度" :default-value="DEFAULT_SIDE_STYLE.frameWidth" :min="1" :max="50" unit="px" @reset="resetValue('frameWidth')" />
              </template>
            </div>

            <div class="bw-card">
              <div class="bw-card-header">异形遮罩与裁切 (Mask)</div>
              <div class="bw-upload-block">
                <div class="bw-thumb-box checker" :style="bubbleAssetUrls[side.maskImageId] ? { backgroundImage: `url(${bubbleAssetUrls[side.maskImageId]})` } : {}">
                  <span v-if="!side.maskImageId">无素材</span>
                </div>
                <div class="bw-upload-info">
                  <strong>{{ side.maskImageId ? '已应用透明遮罩' : '上传透明通道遮罩图' }}</strong>
                  <p>利用透明遮罩图片裁切气泡整体轮廓</p>
                  <div class="bw-upload-btns">
                    <button class="bw-btn-accent" @click="triggerAsset('mask')">{{ side.maskImageId ? '更换遮罩' : '选择图片' }}</button>
                    <button v-if="side.maskImageId" class="bw-btn-delete" @click="clearAsset('maskImageId')">移除</button>
                  </div>
                </div>
              </div>

              <div v-if="side.shape === 'custom'" class="bw-custom-clip-field">
                <label>自定义 clip-path CSS 代码</label>
                <textarea v-model="side.customClipPath" placeholder="例如 polygon(0 0, 100% 0, 95% 100%, 0 100%)" />
              </div>
            </div>
          </template>

          <!-- Tab 3: 指示角与挂件 -->
          <template v-else-if="activeTab === 'decor'">
            <div class="bw-card">
              <div class="bw-card-header">气泡指示角 (Tail)</div>
              
              <div class="bw-field-row">
                <label>指示角类型</label>
                <div class="bw-choice-row">
                  <button :class="{ active: side.tailType === 'none' }" @click="side.tailType = 'none'">无指示角</button>
                  <button :class="{ active: side.tailType === 'triangle' }" @click="side.tailType = 'triangle'">经典角</button>
                  <button :class="{ active: side.tailType === 'image' }" @click="triggerAsset('tail')">自定义图片</button>
                </div>
              </div>

              <template v-if="side.tailType !== 'none'">
                <div class="bw-field-row">
                  <label>垂直对齐</label>
                  <div class="bw-choice-row">
                    <button :class="{ active: side.tailPosition === 'top' }" @click="side.tailPosition = 'top'">顶部</button>
                    <button :class="{ active: side.tailPosition === 'middle' }" @click="side.tailPosition = 'middle'">居中</button>
                    <button :class="{ active: side.tailPosition === 'bottom' }" @click="side.tailPosition = 'bottom'">底部</button>
                  </div>
                </div>
                <BubbleRangeControl v-model="side.tailSize" label="指示角大小" :default-value="DEFAULT_SIDE_STYLE.tailSize" :min="4" :max="40" unit="px" @reset="resetValue('tailSize')" />
                <BubbleRangeControl v-if="side.tailPosition !== 'middle'" v-model="side.tailOffset" label="纵向偏移" :default-value="DEFAULT_SIDE_STYLE.tailOffset" :min="0" :max="60" unit="px" @reset="resetValue('tailOffset')" />
              </template>
            </div>

            <div class="bw-card">
              <div class="bw-card-header flex-between">
                <span>外挂装饰部件 (Ornaments)</span>
                <button class="bw-btn-add" @click="triggerAsset('ornament')">添加挂件</button>
              </div>

              <div v-if="side.ornaments.length" class="bw-ornament-list">
                <div
                  v-for="item in side.ornaments"
                  :key="item.id"
                  class="bw-ornament-tag"
                  :class="{ active: selectedOrnamentId === item.id }"
                  @click="selectedOrnamentId = item.id"
                >
                  <img :src="bubbleAssetUrls[item.assetId]" />
                  <span>{{ item.name }}</span>
                </div>
              </div>

              <div v-if="selectedOrnament" class="bw-ornament-editor">
                <div class="bw-field-row align-start">
                  <label>固定锚点</label>
                  <div class="bw-choice-grid">
                    <button v-for="opt in [{v:'top-left',n:'左上角'},{v:'top-right',n:'右上角'},{v:'bottom-left',n:'左下角'},{v:'bottom-right',n:'右下角'},{v:'free',n:'自由定位'}]" :key="opt.v" :class="{ active: selectedOrnament.anchor === opt.v }" @click="setOrnamentAnchor(opt.v as BubbleAnchor)">{{ opt.n }}</button>
                  </div>
                </div>

                <BubbleRangeControl v-model="selectedOrnament.size" label="挂件尺寸" :default-value="44" :min="12" :max="200" unit="px" @reset="resetOrnament('size', 44)" />
                <BubbleRangeControl v-model="selectedOrnament.offsetX" label="水平偏移 (X)" :default-value="-8" :min="-120" :max="120" unit="px" @reset="resetOrnament('offsetX', -8)" />
                <BubbleRangeControl v-model="selectedOrnament.offsetY" label="垂直偏移 (Y)" :default-value="-8" :min="-120" :max="120" unit="px" @reset="resetOrnament('offsetY', -8)" />
                <BubbleRangeControl v-model="selectedOrnament.rotation" label="旋转角度" :default-value="0" :min="-180" :max="180" unit="°" @reset="resetOrnament('rotation', 0)" />
                <BubbleRangeControl v-model="selectedOrnament.opacity" label="挂件不透明度" :default-value="1" :min="0" :max="1" :step="0.05" @reset="resetOrnament('opacity', 1)" />
                
                <button class="bw-btn-remove-full" @click="deleteOrnament">移除当前挂件</button>
              </div>

              <div v-else class="bw-empty-tip">
                点击上方「添加挂件」上传装饰图，可随意定位在气泡四个角或自由坐标。
              </div>
            </div>
          </template>

          <!-- Tab 4: CSS 定制 -->
          <template v-else>
            <div class="bw-card">
              <div class="bw-card-header">自定义补充 CSS</div>
              <p class="bw-tip-text">代码作用于当前气泡独立作用域内，支持 <code>[data-chat-bubble="self"]</code>、<code>[data-chat-bubble="other"]</code> 与 <code>[data-bubble-part="quote"]</code> 选择器。</p>
              <textarea v-model="draft.customCss" class="bw-css-editor" spellcheck="false" placeholder="/* 在此输入补充 CSS 样式 */&#10;.chat-bubble-theme [data-chat-bubble='self'] {&#10;  letter-spacing: 0.05em;&#10;}" />
              <div class="bw-css-status" :class="{ has_error: Boolean(cssError) }">
                <span>{{ cssError || 'CSS 语法结构正确，实时预览已同步' }}</span>
                <button v-if="draft.customCss" class="bw-btn-clear" @click="draft.customCss = ''">清空代码</button>
              </div>
            </div>

            <details class="bw-ref-accordion">
              <summary>查看系统内置原始 CSS 参考</summary>
              <pre><code>{{ DEFAULT_BUBBLE_CSS }}</code></pre>
            </details>
          </template>

        </div>
      </section>
    </main>

    <!-- 隐藏上传 input -->
    <input ref="fileInput" type="file" accept="image/png,image/webp,image/gif,image/apng,image/svg+xml,image/jpeg,.9.png" hidden @change="handleAssetUpload" />

    <!-- 方案管理弹窗 -->
    <BubblePresetModal
      v-model:visible="presetModalVisible"
      :current-id="currentId"
      @select="handlePresetSelected"
      @create="newWork"
    />

    <!-- 分享导出弹窗 -->
    <BubbleExportModal
      v-model:visible="exportModalVisible"
      :preset="draft"
      @toast="notify"
    />

    <!-- 导入方案弹窗 -->
    <BubbleImportModal
      v-model:visible="importModalVisible"
      @imported="handleImportSuccess"
      @toast="notify"
    />

    <!-- 全局纯净 Toast 提示 -->
    <Transition name="bw-fade">
      <div v-if="toast" class="bw-toast">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped src="./app_BubbleWorkshop.css"></style>
