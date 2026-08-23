<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import QRCode from 'qrcode'
import BubbleRangeControl from './bubble/BubbleRangeControl.vue'
import {
  DEFAULT_BUBBLE_CSS,
  DEFAULT_SIDE_STYLE,
  SYSTEM_BUBBLE_PRESET,
  bubbleAssetUrls,
  buildBubblePresetCss,
  createBubblePreset,
  createBubbleQrPayload,
  deleteBubblePreset,
  duplicateBubblePreset,
  exportBubblePresetBlob,
  getAllBubblePresets,
  getBubbleOrnamentStyle,
  getBubblePreset,
  hydrateBubblePresetAssets,
  importBubblePresetFile,
  importBubbleQrPayload,
  saveBubbleAsset,
  saveBubblePreset,
  setGlobalBubblePreset,
  validateBubbleCss,
  type BubbleAnchor,
  type BubbleExportFormat,
  type BubbleOrnament,
  type BubblePreset,
  type BubbleSideStyle
} from '../services/bubbleWorkshop'

const emit = defineEmits<{ close: [] }>()
const makeDraft = (): BubblePreset => ({ ...JSON.parse(JSON.stringify(SYSTEM_BUBBLE_PRESET)), id: `draft-${Date.now()}`, name: '未命名气泡', source: 'created' })
const currentId = ref('')
const draft = ref<BubblePreset>(makeDraft())
const savedSnapshot = ref(JSON.stringify(draft.value))
const activeSide = ref<'self' | 'other'>('self')
const activeTab = ref<'style' | 'image' | 'decor' | 'code'>('style')
const previewMode = ref<'light' | 'dark' | 'wallpaper'>('light')
const previewExpanded = ref(true)
const toast = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const importInput = ref<HTMLInputElement | null>(null)
const qrImageInput = ref<HTMLInputElement | null>(null)
const uploadTarget = ref<'background' | 'frame' | 'mask' | 'tail' | 'ornament'>('background')
const ornamentAnchor = ref<BubbleAnchor>('top-right')
const selectedOrnamentId = ref('')
const exportVisible = ref(false)
const importVisible = ref(false)
const deleteVisible = ref(false)
const exportFormat = ref<BubbleExportFormat>('nrjbubble')
const qrDataUrl = ref('')
const qrComplete = ref(true)
const shareCode = ref('')
const importCode = ref('')
const busy = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | undefined
const previewStyleId = 'bubble-workshop-preview-style'

const presets = computed(() => getAllBubblePresets())
const side = computed(() => draft.value[activeSide.value])
const isDirty = computed(() => JSON.stringify(draft.value) !== savedSnapshot.value)
const isDraft = computed(() => draft.value.id.startsWith('draft-') || draft.value.id === '__system__')
const cssError = computed(() => validateBubbleCss(draft.value.customCss))
const selectedOrnament = computed(() => side.value.ornaments.find(item => item.id === selectedOrnamentId.value) || null)

const notify = (message: string) => {
  toast.value = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.value = '' }, 2400)
}

const updatePreview = async () => {
  await hydrateBubblePresetAssets(draft.value)
  let style = document.getElementById(previewStyleId) as HTMLStyleElement | null
  if (!style) { style = document.createElement('style'); style.id = previewStyleId; document.head.appendChild(style) }
  style.textContent = buildBubblePresetCss(draft.value).replaceAll('.chat-bubble-theme', '.bw-preview-scope')
}
watch(draft, updatePreview, { deep: true })
onMounted(updatePreview)
onUnmounted(() => document.getElementById(previewStyleId)?.remove())

const choosePreset = async (id: string) => {
  currentId.value = id; draft.value = getBubblePreset(id); savedSnapshot.value = JSON.stringify(draft.value); selectedOrnamentId.value = ''
  await updatePreview()
}
const newWork = () => { currentId.value = ''; draft.value = makeDraft(); savedSnapshot.value = JSON.stringify(draft.value); selectedOrnamentId.value = ''; notify('已新建空白作品') }
const saveWork = () => {
  if (cssError.value) { activeTab.value = 'code'; notify(cssError.value); return null }
  if (isDraft.value) {
    const created = createBubblePreset(draft.value, draft.value.name || '我的气泡'); draft.value = created; currentId.value = created.id
  } else draft.value = saveBubblePreset(draft.value)
  savedSnapshot.value = JSON.stringify(draft.value); notify('作品已保存'); return draft.value
}
const applyWork = () => { const saved = saveWork(); if (!saved) return; setGlobalBubblePreset(saved.id); notify('已设为全局气泡') }
const copyWork = () => { const base = isDraft.value ? saveWork() : draft.value; if (!base) return; const copied = duplicateBubblePreset(base.id); choosePreset(copied.id); notify('已复制为新作品') }
const confirmDelete = () => { if (!isDraft.value) deleteBubblePreset(draft.value.id); deleteVisible.value = false; newWork(); notify('作品已删除') }

const resetValue = <K extends keyof BubbleSideStyle>(key: K) => { side.value[key] = JSON.parse(JSON.stringify(DEFAULT_SIDE_STYLE[key])) as BubbleSideStyle[K] }
const resetSide = () => { draft.value[activeSide.value] = JSON.parse(JSON.stringify(DEFAULT_SIDE_STYLE)); selectedOrnamentId.value = ''; notify('当前一侧已恢复系统参数') }
const copySide = () => { const target = activeSide.value === 'self' ? 'other' : 'self'; draft.value[target] = JSON.parse(JSON.stringify(side.value)); notify('已复制到另一侧') }

const triggerAsset = (target: typeof uploadTarget.value) => { uploadTarget.value = target; fileInput.value?.click() }
const handleAssetUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return
  try {
    busy.value = true; const asset = await saveBubbleAsset(file); const current = side.value
    if (uploadTarget.value === 'background') current.backgroundImageId = asset.id
    if (uploadTarget.value === 'frame') current.frameImageId = asset.id
    if (uploadTarget.value === 'mask') current.maskImageId = asset.id
    if (uploadTarget.value === 'tail') { current.tailImageId = asset.id; current.tailType = 'image' }
    if (uploadTarget.value === 'ornament') {
      const ornament: BubbleOrnament = { id: `ornament-${Date.now()}`, assetId: asset.id, name: file.name, anchor: ornamentAnchor.value, offsetX: -8, offsetY: -8, size: 44, rotation: 0, opacity: 1, zIndex: 2 }
      current.ornaments.push(ornament); selectedOrnamentId.value = ornament.id
    }
    await updatePreview(); notify('素材已加入当前气泡')
  } catch (error: any) { notify(error?.message || '素材导入失败') } finally { busy.value = false }
}
const clearAsset = (field: 'backgroundImageId' | 'frameImageId' | 'maskImageId' | 'tailImageId') => { side.value[field] = ''; if (field === 'tailImageId') side.value.tailType = 'none' }
const deleteOrnament = () => { if (!selectedOrnament.value) return; side.value.ornaments = side.value.ornaments.filter(item => item.id !== selectedOrnament.value?.id); selectedOrnamentId.value = '' }
const resetOrnament = <K extends keyof BubbleOrnament>(key: K, value: BubbleOrnament[K]) => { if (selectedOrnament.value) selectedOrnament.value[key] = value }
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
  item.anchor = 'top-right'; item.offsetX = -8; item.offsetY = -8
}

const assetStyle = (item: BubbleOrnament) => getBubbleOrnamentStyle(item)
const formatLabel: Record<BubbleExportFormat,string> = { nrjbubble: 'NRJ 完整方案', zip: '开放工程 ZIP', 'json-full': '完整 JSON', 'json-light': '轻量 JSON' }
const safeFilename = computed(() => (draft.value.name || '气泡方案').replace(/[\\/:*?"<>|]/g, '-'))
const downloadBlob = (blob: Blob, filename: string) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
const exportWork = async () => {
  try {
    busy.value = true; const blob = await exportBubblePresetBlob(draft.value, exportFormat.value)
    const ext = exportFormat.value === 'nrjbubble' ? 'nrjbubble' : exportFormat.value === 'zip' ? 'zip' : 'json'
    downloadBlob(blob, `${safeFilename.value}.${ext}`); notify(`已导出${formatLabel[exportFormat.value]}`)
  } catch (error: any) { notify(error?.message || '导出失败') } finally { busy.value = false }
}
const generateQr = async () => {
  try {
    busy.value = true; const result = await createBubbleQrPayload(draft.value); shareCode.value = result.payload; qrComplete.value = result.complete
    qrDataUrl.value = await QRCode.toDataURL(result.payload, { width: 320, margin: 2, errorCorrectionLevel: 'L', color: { dark: '#111827', light: '#ffffff' } })
  } catch (error: any) { notify(error?.message || '二维码生成失败') } finally { busy.value = false }
}
const saveQr = () => { if (!qrDataUrl.value) return; const a = document.createElement('a'); a.href = qrDataUrl.value; a.download = `${safeFilename.value}-分享二维码.png`; a.click() }
const copyShareCode = async () => { try { await navigator.clipboard.writeText(shareCode.value); notify('分享码已复制') } catch { notify('无法访问剪贴板') } }

const handleImportFile = async (event: Event) => {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return
  try { busy.value = true; const imported = await importBubblePresetFile(file); importVisible.value = false; if (imported[0]) await choosePreset(imported[0].id); notify(`已导入 ${imported.length} 个气泡方案`) }
  catch (error: any) { notify(error?.message || '方案导入失败') } finally { busy.value = false }
}
const importCodeNow = async () => {
  try { busy.value = true; const imported = await importBubbleQrPayload(importCode.value.trim()); importVisible.value = false; importCode.value = ''; if (imported[0]) await choosePreset(imported[0].id); notify('分享方案已导入') }
  catch (error: any) { notify(error?.message || '分享码无法识别') } finally { busy.value = false }
}
const readQrImage = async (event: Event) => {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return
  try {
    const Detector = (window as any).BarcodeDetector
    if (!Detector) throw new Error('当前浏览器不支持识别二维码图片，请粘贴分享码')
    const bitmap = await createImageBitmap(file); const results = await new Detector({ formats: ['qr_code'] }).detect(bitmap)
    if (!results[0]?.rawValue) throw new Error('图片中没有识别到气泡二维码')
    importCode.value = results[0].rawValue; await importCodeNow()
  } catch (error: any) { notify(error?.message || '二维码识别失败') }
}
</script>

<template>
  <div class="bw-app">
    <header class="bw-header">
      <button class="bw-icon" aria-label="返回" @click="emit('close')"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg></button>
      <div class="bw-title"><strong>气泡工坊</strong><span v-if="isDirty">未保存</span></div>
      <div class="bw-header-actions">
        <button class="bw-text-button" @click="importVisible = true">导入</button>
        <button class="bw-text-button" @click="exportVisible = true">分享</button>
        <button class="bw-text-button" @click="saveWork">保存</button>
        <button class="bw-primary" @click="applyWork">应用</button>
      </div>
    </header>

    <section class="bw-library">
      <div class="bw-library-title"><strong>我的气泡</strong><span>{{ presets.length }} 个作品</span><button @click="newWork">＋ 新建</button></div>
      <div v-if="presets.length" class="bw-preset-strip">
        <button v-for="preset in presets" :key="preset.id" :class="{ active: currentId === preset.id }" @click="choosePreset(preset.id)">
          <span><i></i><i></i></span><strong>{{ preset.name }}</strong><small>{{ preset.source === 'imported' ? '导入' : '创作' }}</small>
        </button>
      </div>
      <div v-else class="bw-empty-library"><span>还没有保存的气泡，创建或导入后会出现在这里。</span></div>
    </section>

    <main class="bw-main">
      <section class="bw-preview-column" :class="{ collapsed: !previewExpanded }">
        <div class="bw-preview-tools">
          <div><button :class="{ active: previewMode === 'light' }" @click="previewMode = 'light'">浅色</button><button :class="{ active: previewMode === 'dark' }" @click="previewMode = 'dark'">深色</button><button :class="{ active: previewMode === 'wallpaper' }" @click="previewMode = 'wallpaper'">壁纸</button></div>
          <button @click="previewExpanded = !previewExpanded">{{ previewExpanded ? '收起预览' : '展开预览' }}</button>
        </div>
        <div v-if="previewExpanded" class="bw-phone" :class="[`mode-${previewMode}`]">
          <div class="bw-phone-head"><span>‹</span><strong>气泡预览</strong><i>•••</i></div>
          <div class="bw-chat bw-preview-scope">
            <small class="bw-time">今天 21:08</small>
            <div class="bw-message other"><span class="bw-avatar">年</span><div><small>年年</small><p data-chat-bubble="other"><img v-for="item in draft.other.ornaments" :key="item.id" class="bubble-ornament" :src="bubbleAssetUrls[item.assetId]" :style="assetStyle(item)" />今天过得怎么样？</p></div></div>
            <div class="bw-message other"><span class="bw-avatar ghost"></span><div><p data-chat-bubble="other"><img v-for="item in draft.other.ornaments" :key="item.id" class="bubble-ornament" :src="bubbleAssetUrls[item.assetId]" :style="assetStyle(item)" />我刚刚看到一朵很像小云的花，想着你可能会喜欢。</p></div></div>
            <div class="bw-message self"><div><small>我</small><p data-chat-bubble="self"><img v-for="item in draft.self.ornaments" :key="item.id" class="bubble-ornament" :src="bubbleAssetUrls[item.assetId]" :style="assetStyle(item)" />听起来很可爱，拍给我看看。</p></div><span class="bw-avatar me">我</span></div>
            <div class="bw-message other"><span class="bw-avatar">年</span><div><small>年年</small><p data-chat-bubble="other"><img v-for="item in draft.other.ornaments" :key="item.id" class="bubble-ornament" :src="bubbleAssetUrls[item.assetId]" :style="assetStyle(item)" /><span class="bw-quote" data-bubble-part="quote">回复：拍给我看看</span>好呀，等我走近一点拍清楚。</p></div></div>
          </div>
        </div>
      </section>

      <section class="bw-editor">
        <div class="bw-work-head">
          <input v-model.trim="draft.name" maxlength="40" aria-label="作品名称" />
          <div><button @click="copyWork">复制</button><button @click="copySide">复制到另一侧</button><button @click="resetSide">重置当前侧</button><button v-if="!isDraft" class="danger" @click="deleteVisible = true">删除</button></div>
        </div>
        <div class="bw-side-tabs"><button :class="{ active: activeSide === 'other' }" @click="activeSide = 'other'; selectedOrnamentId = ''">对方气泡</button><button :class="{ active: activeSide === 'self' }" @click="activeSide = 'self'; selectedOrnamentId = ''">自己气泡</button></div>
        <nav class="bw-tabs"><button :class="{ active: activeTab === 'style' }" @click="activeTab = 'style'">外形与材质</button><button :class="{ active: activeTab === 'image' }" @click="activeTab = 'image'">图片与异形</button><button :class="{ active: activeTab === 'decor' }" @click="activeTab = 'decor'">挂件与尾巴</button><button :class="{ active: activeTab === 'code' }" @click="activeTab = 'code'">高级代码</button></nav>

        <div class="bw-editor-scroll">
          <template v-if="activeTab === 'style'">
            <div class="bw-section-title"><strong>颜色与表面</strong><span>每项都可以单独重置</span></div>
            <div class="bw-color-control"><label>背景颜色</label><input type="color" :value="side.background.startsWith('#') ? side.background : '#ffffff'" @input="side.background = ($event.target as HTMLInputElement).value" /><input v-model="side.background" /><button @click="resetValue('background')">重置</button></div>
            <div class="bw-color-control"><label>渐变颜色</label><input type="color" :value="side.gradientEnd || '#ffffff'" @input="side.gradientEnd = ($event.target as HTMLInputElement).value" /><input v-model="side.gradientEnd" placeholder="留空为纯色" /><button @click="resetValue('gradientEnd')">重置</button></div>
            <div class="bw-color-control"><label>文字颜色</label><input type="color" :value="side.textColor.startsWith('#') ? side.textColor : '#222222'" @input="side.textColor = ($event.target as HTMLInputElement).value" /><input v-model="side.textColor" /><button @click="resetValue('textColor')">重置</button></div>
            <div class="bw-color-control"><label>边框颜色</label><input type="color" :value="side.borderColor.startsWith('#') ? side.borderColor : '#bbbbbb'" @input="side.borderColor = ($event.target as HTMLInputElement).value" /><input v-model="side.borderColor" /><button @click="resetValue('borderColor')">重置</button></div>
            <div class="bw-color-control"><label>阴影颜色</label><input type="color" :value="side.shadowColor.startsWith('#') ? side.shadowColor : '#000000'" @input="side.shadowColor = ($event.target as HTMLInputElement).value" /><input v-model="side.shadowColor" /><button @click="resetValue('shadowColor')">重置</button></div>
            <BubbleRangeControl v-model="side.gradientAngle" label="渐变方向" :default-value="DEFAULT_SIDE_STYLE.gradientAngle" :min="0" :max="360" unit="°" @reset="resetValue('gradientAngle')" />
            <BubbleRangeControl v-model="side.blur" label="毛玻璃模糊" :default-value="DEFAULT_SIDE_STYLE.blur" :min="0" :max="30" unit="px" @reset="resetValue('blur')" />
            <BubbleRangeControl v-model="side.opacity" label="整体透明度" :default-value="DEFAULT_SIDE_STYLE.opacity" :min="0.2" :max="1" :step="0.05" @reset="resetValue('opacity')" />
            <div class="bw-section-title"><strong>轮廓与排版</strong></div>
            <div class="bw-choice-control"><label>气泡形状</label><div><button v-for="option in [{v:'rounded',n:'圆角'},{v:'capsule',n:'胶囊'},{v:'cloud',n:'云朵'},{v:'comic',n:'漫画'},{v:'ticket',n:'票券'},{v:'custom',n:'自定义'}]" :key="option.v" :class="{ active: side.shape === option.v }" @click="side.shape = option.v as any">{{ option.n }}</button></div><button @click="resetValue('shape')">重置</button></div>
            <BubbleRangeControl v-model="side.radius" label="整体圆角" :default-value="DEFAULT_SIDE_STYLE.radius" :min="0" :max="40" unit="px" @reset="resetValue('radius')" />
            <BubbleRangeControl v-model="side.corner" label="方向角" :default-value="DEFAULT_SIDE_STYLE.corner" :min="0" :max="40" unit="px" @reset="resetValue('corner')" />
            <BubbleRangeControl v-model="side.borderWidth" label="边框宽度" :default-value="DEFAULT_SIDE_STYLE.borderWidth" :min="0" :max="8" :step="0.5" unit="px" @reset="resetValue('borderWidth')" />
            <div class="bw-choice-control"><label>边框样式</label><div><button :class="{ active: side.borderStyle === 'solid' }" @click="side.borderStyle='solid'">实线</button><button :class="{ active: side.borderStyle === 'dashed' }" @click="side.borderStyle='dashed'">虚线</button><button :class="{ active: side.borderStyle === 'none' }" @click="side.borderStyle='none'">无</button></div><button @click="resetValue('borderStyle')">重置</button></div>
            <BubbleRangeControl v-model="side.paddingX" label="横向留白" :default-value="DEFAULT_SIDE_STYLE.paddingX" :min="2" :max="36" unit="px" @reset="resetValue('paddingX')" />
            <BubbleRangeControl v-model="side.paddingY" label="纵向留白" :default-value="DEFAULT_SIDE_STYLE.paddingY" :min="2" :max="30" unit="px" @reset="resetValue('paddingY')" />
            <BubbleRangeControl v-model="side.fontSize" label="文字大小" :default-value="DEFAULT_SIDE_STYLE.fontSize" :min="11" :max="24" unit="px" @reset="resetValue('fontSize')" />
            <BubbleRangeControl v-model="side.lineHeight" label="文字行高" :default-value="DEFAULT_SIDE_STYLE.lineHeight" :min="1" :max="2.2" :step="0.05" @reset="resetValue('lineHeight')" />
            <BubbleRangeControl v-model="side.maxWidth" label="可用宽度" :default-value="DEFAULT_SIDE_STYLE.maxWidth" :min="55" :max="100" unit="%" @reset="resetValue('maxWidth')" />
            <BubbleRangeControl v-model="side.shadowBlur" label="阴影柔和度" :default-value="DEFAULT_SIDE_STYLE.shadowBlur" :min="0" :max="60" unit="px" @reset="resetValue('shadowBlur')" />
            <BubbleRangeControl v-model="side.shadowY" label="阴影垂直距离" :default-value="DEFAULT_SIDE_STYLE.shadowY" :min="-20" :max="30" unit="px" @reset="resetValue('shadowY')" />
          </template>

          <template v-else-if="activeTab === 'image'">
            <div class="bw-section-title"><strong>图片背景</strong><span>支持 PNG、WebP、GIF、APNG、SVG</span></div>
            <div class="bw-asset-card"><div class="bw-asset-preview" :style="bubbleAssetUrls[side.backgroundImageId] ? { backgroundImage:`url(${bubbleAssetUrls[side.backgroundImageId]})` } : {}"><span v-if="!side.backgroundImageId">背景</span></div><div><strong>{{ side.backgroundImageId ? '已设置背景图片' : '上传背景图片' }}</strong><p>可覆盖、包含、拉伸或平铺。</p><button @click="triggerAsset('background')">{{ side.backgroundImageId ? '替换' : '选择图片' }}</button><button v-if="side.backgroundImageId" @click="clearAsset('backgroundImageId')">清除</button></div></div>
            <div v-if="side.backgroundImageId" class="bw-choice-control"><label>填充方式</label><div><button v-for="option in [{v:'cover',n:'覆盖'},{v:'contain',n:'包含'},{v:'stretch',n:'拉伸'},{v:'tile',n:'平铺'}]" :key="option.v" :class="{ active: side.backgroundFit === option.v }" @click="side.backgroundFit = option.v as any">{{ option.n }}</button></div><button @click="resetValue('backgroundFit')">重置</button></div>
            <BubbleRangeControl v-if="side.backgroundImageId" v-model="side.backgroundPositionX" label="背景水平位置" :default-value="DEFAULT_SIDE_STYLE.backgroundPositionX" :min="0" :max="100" unit="%" @reset="resetValue('backgroundPositionX')" />
            <BubbleRangeControl v-if="side.backgroundImageId" v-model="side.backgroundPositionY" label="背景垂直位置" :default-value="DEFAULT_SIDE_STYLE.backgroundPositionY" :min="0" :max="100" unit="%" @reset="resetValue('backgroundPositionY')" />
            <BubbleRangeControl v-if="side.backgroundImageId" v-model="side.backgroundOpacity" label="背景图片透明度" :default-value="DEFAULT_SIDE_STYLE.backgroundOpacity" :min="0" :max="1" :step="0.05" @reset="resetValue('backgroundOpacity')" />

            <div class="bw-section-title"><strong>九宫格框体</strong><span>边角保持原样，中间区域随文字拉伸</span></div>
            <div class="bw-asset-card"><div class="bw-asset-preview checker" :style="bubbleAssetUrls[side.frameImageId] ? { backgroundImage:`url(${bubbleAssetUrls[side.frameImageId]})` } : {}"><span v-if="!side.frameImageId">框体</span></div><div><strong>{{ side.frameImageId ? '已设置可拉伸框体' : '上传框体素材' }}</strong><p>导入 .9.png 或普通透明图片后调整切片线。</p><button @click="triggerAsset('frame')">{{ side.frameImageId ? '替换' : '选择图片' }}</button><button v-if="side.frameImageId" @click="clearAsset('frameImageId')">清除</button></div></div>
            <template v-if="side.frameImageId"><BubbleRangeControl v-model="side.frameSliceTop" label="顶部切片" :default-value="DEFAULT_SIDE_STYLE.frameSliceTop" :min="0" :max="100" unit="%" @reset="resetValue('frameSliceTop')" /><BubbleRangeControl v-model="side.frameSliceRight" label="右侧切片" :default-value="DEFAULT_SIDE_STYLE.frameSliceRight" :min="0" :max="100" unit="%" @reset="resetValue('frameSliceRight')" /><BubbleRangeControl v-model="side.frameSliceBottom" label="底部切片" :default-value="DEFAULT_SIDE_STYLE.frameSliceBottom" :min="0" :max="100" unit="%" @reset="resetValue('frameSliceBottom')" /><BubbleRangeControl v-model="side.frameSliceLeft" label="左侧切片" :default-value="DEFAULT_SIDE_STYLE.frameSliceLeft" :min="0" :max="100" unit="%" @reset="resetValue('frameSliceLeft')" /><BubbleRangeControl v-model="side.frameWidth" label="框体占用宽度" :default-value="DEFAULT_SIDE_STYLE.frameWidth" :min="1" :max="50" unit="px" @reset="resetValue('frameWidth')" /></template>

            <div class="bw-section-title"><strong>异形遮罩</strong><span>用透明图片决定气泡外轮廓</span></div>
            <div class="bw-asset-card"><div class="bw-asset-preview checker" :style="bubbleAssetUrls[side.maskImageId] ? { backgroundImage:`url(${bubbleAssetUrls[side.maskImageId]})` } : {}"><span v-if="!side.maskImageId">遮罩</span></div><div><strong>{{ side.maskImageId ? '已设置异形遮罩' : '上传遮罩图片' }}</strong><p>透明区域会裁掉气泡主体，外部挂件不受影响。</p><button @click="triggerAsset('mask')">{{ side.maskImageId ? '替换' : '选择图片' }}</button><button v-if="side.maskImageId" @click="clearAsset('maskImageId')">清除</button></div></div>
            <div v-if="side.shape === 'custom'" class="bw-field"><label>自定义裁切路径</label><textarea v-model="side.customClipPath" placeholder="polygon(...)、path(...) 或 ellipse(...)" /><button @click="resetValue('customClipPath')">重置</button></div>
          </template>

          <template v-else-if="activeTab === 'decor'">
            <div class="bw-section-title"><strong>气泡尾巴</strong></div>
            <div class="bw-choice-control"><label>尾巴类型</label><div><button :class="{ active: side.tailType === 'none' }" @click="side.tailType='none'">无</button><button :class="{ active: side.tailType === 'triangle' }" @click="side.tailType='triangle'">矢量</button><button :class="{ active: side.tailType === 'image' }" @click="triggerAsset('tail')">图片</button></div><button @click="resetValue('tailType')">重置</button></div>
            <div class="bw-choice-control"><label>尾巴位置</label><div><button v-for="option in [{v:'top',n:'顶部'},{v:'middle',n:'中部'},{v:'bottom',n:'底部'}]" :key="option.v" :class="{ active: side.tailPosition === option.v }" @click="side.tailPosition=option.v as any">{{ option.n }}</button></div><button @click="resetValue('tailPosition')">重置</button></div>
            <BubbleRangeControl v-model="side.tailSize" label="尾巴大小" :default-value="DEFAULT_SIDE_STYLE.tailSize" :min="4" :max="40" unit="px" @reset="resetValue('tailSize')" />
            <BubbleRangeControl v-model="side.tailOffset" label="尾巴偏移" :default-value="DEFAULT_SIDE_STYLE.tailOffset" :min="0" :max="60" unit="px" @reset="resetValue('tailOffset')" />

            <div class="bw-section-title"><strong>图片挂件</strong><span>四角锚定或自由定位</span></div>
            <div class="bw-anchor-picker"><button v-for="option in [{v:'top-left',n:'左上'},{v:'top-right',n:'右上'},{v:'bottom-left',n:'左下'},{v:'bottom-right',n:'右下'},{v:'free',n:'自由'}]" :key="option.v" :class="{ active: ornamentAnchor === option.v }" @click="ornamentAnchor=option.v as BubbleAnchor">{{ option.n }}</button><button class="add" @click="triggerAsset('ornament')">＋ 添加挂件</button></div>
            <div v-if="side.ornaments.length" class="bw-ornament-list"><button v-for="item in side.ornaments" :key="item.id" :class="{ active: selectedOrnamentId === item.id }" @click="selectedOrnamentId=item.id"><img :src="bubbleAssetUrls[item.assetId]" /><span>{{ item.name }}</span></button></div>
            <div v-if="selectedOrnament" class="bw-ornament-editor">
            <div class="bw-choice-control"><label>锚点</label><div><button v-for="option in [{v:'top-left',n:'左上'},{v:'top-right',n:'右上'},{v:'bottom-left',n:'左下'},{v:'bottom-right',n:'右下'},{v:'free',n:'自由'}]" :key="option.v" :class="{ active: selectedOrnament.anchor === option.v }" @click="setOrnamentAnchor(option.v as BubbleAnchor)">{{ option.n }}</button></div><button @click="resetOrnamentAnchor">重置</button></div>
              <BubbleRangeControl v-model="selectedOrnament.size" label="挂件大小" :default-value="44" :min="12" :max="180" unit="px" @reset="resetOrnament('size',44)" />
              <BubbleRangeControl v-model="selectedOrnament.offsetX" label="水平偏移" :default-value="-8" :min="-120" :max="120" unit="px" @reset="resetOrnament('offsetX',-8)" />
              <BubbleRangeControl v-model="selectedOrnament.offsetY" label="垂直偏移" :default-value="-8" :min="-120" :max="120" unit="px" @reset="resetOrnament('offsetY',-8)" />
              <BubbleRangeControl v-model="selectedOrnament.rotation" label="旋转角度" :default-value="0" :min="-180" :max="180" unit="°" @reset="resetOrnament('rotation',0)" />
              <BubbleRangeControl v-model="selectedOrnament.opacity" label="挂件透明度" :default-value="1" :min="0" :max="1" :step="0.05" @reset="resetOrnament('opacity',1)" />
              <button class="bw-danger-row" @click="deleteOrnament">删除这个挂件</button>
            </div>
            <div v-else class="bw-empty-section">上传图片后可分别调整锚点、大小、偏移、旋转和透明度。</div>
          </template>

          <template v-else>
            <div class="bw-section-title"><strong>补充 CSS</strong><span>字号和编辑区域按正常阅读尺寸显示</span></div>
            <p class="bw-code-help">使用 <code>[data-chat-bubble="self"]</code>、<code>[data-chat-bubble="other"]</code> 或 <code>[data-bubble-part="quote"]</code>。代码只作用于气泡。</p>
            <textarea v-model="draft.customCss" class="bw-code" spellcheck="false" placeholder=".chat-bubble-theme [data-chat-bubble=&quot;self&quot;] {
  letter-spacing: .02em;
}" />
            <div class="bw-code-status" :class="{ error: cssError }"><span>{{ cssError || '代码结构正常，预览已更新' }}</span><button @click="draft.customCss=''">清空补充代码</button></div>
            <details class="bw-default-code"><summary>查看系统原始气泡 CSS</summary><textarea :value="DEFAULT_BUBBLE_CSS" readonly /></details>
          </template>
        </div>
      </section>
    </main>

    <input ref="fileInput" hidden type="file" accept="image/png,image/webp,image/gif,image/apng,image/svg+xml,image/jpeg,.9.png" @change="handleAssetUpload" />
    <input ref="importInput" hidden type="file" accept=".nrjbubble,.json,.zip" @change="handleImportFile" />
    <input ref="qrImageInput" hidden type="file" accept="image/*" @change="readQrImage" />

    <div v-if="exportVisible" class="bw-modal-backdrop" @click.self="exportVisible=false">
      <div class="bw-modal wide">
        <header><div><strong>分享气泡方案</strong><span>导出的方案可以被其他用户重新导入和编辑。</span></div><button @click="exportVisible=false">×</button></header>
        <div class="bw-export-grid">
          <button v-for="format in (Object.keys(formatLabel) as BubbleExportFormat[])" :key="format" :class="{ active: exportFormat===format }" @click="exportFormat=format"><strong>{{ formatLabel[format] }}</strong><span>{{ format==='nrjbubble'?'完整保留素材与编辑结构':format==='zip'?'可解压查看，也可直接导入':format==='json-full'?'素材以 Base64 写入 JSON':'只包含参数和 CSS，不含图片' }}</span></button>
        </div>
        <button class="bw-modal-primary" :disabled="busy" @click="exportWork">导出 {{ formatLabel[exportFormat] }}</button>
        <div class="bw-qr-section"><div><strong>二维码分享</strong><p>小型方案可完整写入二维码；素材过大时生成不含图片的轻量二维码，并明确提示。</p></div><button @click="generateQr">生成二维码</button></div>
        <div v-if="qrDataUrl" class="bw-qr-result"><img :src="qrDataUrl" /><strong>{{ qrComplete ? '完整方案二维码' : '轻量方案二维码' }}</strong><span>{{ qrComplete ? '扫码后可完整恢复当前方案。' : '当前素材较大，二维码只包含参数与 CSS。' }}</span><div><button @click="saveQr">保存二维码</button><button @click="copyShareCode">复制分享码</button></div></div>
      </div>
    </div>

    <div v-if="importVisible" class="bw-modal-backdrop" @click.self="importVisible=false">
      <div class="bw-modal">
        <header><div><strong>导入气泡方案</strong><span>导入后会加入“我的气泡”，不会自动覆盖现有作品。</span></div><button @click="importVisible=false">×</button></header>
        <button class="bw-import-option" @click="importInput?.click()"><strong>从方案文件导入</strong><span>支持 .nrjbubble、完整或轻量 JSON、ZIP</span></button>
        <button class="bw-import-option" @click="qrImageInput?.click()"><strong>识别二维码图片</strong><span>从相册选择别人分享的气泡二维码</span></button>
        <label class="bw-code-import"><span>粘贴分享码</span><textarea v-model="importCode" placeholder="粘贴对方发来的气泡分享码" /></label>
        <button class="bw-modal-primary" :disabled="!importCode.trim() || busy" @click="importCodeNow">导入分享码</button>
      </div>
    </div>

    <div v-if="deleteVisible" class="bw-modal-backdrop" @click.self="deleteVisible=false"><div class="bw-modal compact"><header><div><strong>删除“{{ draft.name }}”</strong><span>使用该作品的聊天会恢复为系统或全局气泡。</span></div></header><div class="bw-confirm-actions"><button @click="deleteVisible=false">取消</button><button class="danger" @click="confirmDelete">删除作品</button></div></div></div>
    <Transition name="toast"><div v-if="toast" class="bw-toast">{{ toast }}</div></Transition>
    <div v-if="busy" class="bw-busy">处理中…</div>
  </div>
</template>

<style scoped src="./app_BubbleWorkshop.css"></style>
