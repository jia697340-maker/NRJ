/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  useWatermark,
  type WatermarkType,
  type WatermarkLayout,
  type WatermarkPosition,
  type WatermarkEffect
} from '../composables/useWatermark'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits(['update:visible'])

const {
  config,
  localImageDataUrl,
  initialize,
  saveLocalImage,
  removeLocalImage,
  resetToDefault
} = useWatermark()

const fileInputRef = ref<HTMLInputElement | null>(null)
const urlInput = ref('')
const uploadError = ref('')
const isCompressing = ref(false)

watch(
  () => props.visible,
  async (val) => {
    if (val) {
      await initialize()
      urlInput.value = config.imageUrl || ''
      uploadError.value = ''
    }
  }
)

const close = () => {
  emit('update:visible', false)
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

// 本地图片选择并转为轻量 DataURL 存入 IndexedDB
const onFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploadError.value = ''
  isCompressing.value = true

  const reader = new FileReader()
  reader.onload = (event) => {
    const rawDataUrl = event.target?.result as string
    if (!rawDataUrl) {
      isCompressing.value = false
      return
    }

    // 缩放并压缩图片，保证轻量且高清
    const img = new Image()
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        const maxDim = 320
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          const compressed = canvas.toDataURL('image/png')
          await saveLocalImage(compressed)
          config.type = 'image'
          config.imageType = 'local'
        }
      } catch (err) {
        console.error('Failed to compress watermark image:', err)
        uploadError.value = '图片处理失败，请重试'
      } finally {
        isCompressing.value = false
      }
    }
    img.onerror = () => {
      uploadError.value = '图片加载失败'
      isCompressing.value = false
    }
    img.src = rawDataUrl
  }
  reader.readAsDataURL(file)
}

const applyUrlImage = () => {
  const url = urlInput.value.trim()
  if (url) {
    config.imageUrl = url
    config.type = 'image'
    config.imageType = 'url'
  }
}

const activeImageSrc = computed(() => {
  if (config.imageType === 'local') return localImageDataUrl.value
  return config.imageUrl || ''
})

const positionOptions: { id: WatermarkPosition; label: string }[] = [
  { id: 'top-left', label: '左上' },
  { id: 'top-right', label: '右上' },
  { id: 'center', label: '居中' },
  { id: 'bottom-left', label: '左下' },
  { id: 'bottom-right', label: '右下' }
]

const effectOptions: { id: WatermarkEffect; label: string }[] = [
  { id: 'embossed', label: '浮雕质感' },
  { id: 'shadow', label: '立体阴影' },
  { id: 'stroke', label: '描边轮廓' },
  { id: 'normal', label: '纯色平面' }
]

const blendOptions: { id: any; label: string }[] = [
  { id: 'normal', label: '正常' },
  { id: 'overlay', label: '叠加' },
  { id: 'soft-light', label: '柔光' },
  { id: 'multiply', label: '正片叠底' },
  { id: 'screen', label: '滤色' }
]

const presetColors = ['#ffffff', '#000000', '#f39c12', '#e74c3c', '#9b59b6', '#3498db', '#2ecc71']
</script>

<template>
  <Teleport to="body">
    <Transition name="soft-fade">
      <div v-if="visible" class="soft-modal-overlay wm-modal-overlay" @click.self="close">
        <section class="soft-modal-panel wm-modal-panel" @click.stop>
          <!-- 顶部标题栏 -->
          <div class="soft-modal-header wm-modal-header">
            <span class="title">界面截图水印</span>
            <button class="close-btn" type="button" @click="close">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <!-- 可滚动内容区 -->
          <div class="wm-scroll-content">
            <!-- 总开关卡片 -->
            <div class="wm-switch-card">
              <div class="wm-switch-info">
                <strong>启用界面截图水印</strong>
                <small>全局覆盖浮层，截图直接带水印，不影响任何点击触控</small>
              </div>
              <div
                class="soft-toggle"
                :class="{ 'is-active': config.enabled }"
                @click="config.enabled = !config.enabled"
              >
                <div class="soft-toggle-knob"></div>
              </div>
            </div>

            <!-- 水印类型切换：文字 vs 图片 -->
            <div class="wm-section-title">水印类型</div>
            <div class="wm-segmented">
              <button
                type="button"
                :class="{ active: config.type === 'text' }"
                @click="config.type = 'text'"
              >
                文字水印
              </button>
              <button
                type="button"
                :class="{ active: config.type === 'image' }"
                @click="config.type = 'image'"
              >
                图片水印
              </button>
            </div>

            <!-- 文字水印设置项 -->
            <template v-if="config.type === 'text'">
              <div class="wm-section-title">水印文本</div>
              <input
                type="text"
                v-model="config.text"
                class="soft-input wm-input"
                placeholder="输入水印文字内容"
              />

              <div class="wm-section-title">文字颜色</div>
              <div class="wm-color-row">
                <div
                  v-for="c in presetColors"
                  :key="c"
                  class="wm-color-dot"
                  :style="{ backgroundColor: c }"
                  :class="{ active: config.textColor === c }"
                  @click="config.textColor = c"
                ></div>
              </div>

              <div class="wm-slider-group">
                <div class="wm-slider-header">
                  <span>字体大小</span>
                  <div class="wm-slider-right">
                    <button type="button" class="wm-single-reset" @click="config.textSize = 16" title="重置字体大小">重置</button>
                    <span class="wm-slider-val">{{ config.textSize }}px</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="12"
                  max="36"
                  step="1"
                  v-model.number="config.textSize"
                  class="wm-slider"
                />
              </div>
            </template>

            <!-- 图片水印设置项 -->
            <template v-else>
              <div class="wm-section-title">图片来源</div>
              <div class="wm-sub-segmented">
                <button
                  type="button"
                  :class="{ active: config.imageType === 'local' }"
                  @click="config.imageType = 'local'"
                >
                  本地图片
                </button>
                <button
                  type="button"
                  :class="{ active: config.imageType === 'url' }"
                  @click="config.imageType = 'url'"
                >
                  URL 链接
                </button>
              </div>

              <input
                ref="fileInputRef"
                class="wm-hidden-input"
                type="file"
                accept="image/*"
                @change="onFileChange"
              />

              <!-- 本地上传卡片 -->
              <div v-if="config.imageType === 'local'" class="wm-upload-card" @click="triggerFileInput">
                <div v-if="localImageDataUrl" class="wm-preview-thumb">
                  <img :src="localImageDataUrl" alt="水印图" />
                </div>
                <div v-else class="wm-upload-placeholder">
                  <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.8" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  <span>{{ isCompressing ? '处理中...' : '点击选择本地图片' }}</span>
                </div>
                <button
                  v-if="localImageDataUrl"
                  type="button"
                  class="wm-thumb-delete"
                  @click.stop="removeLocalImage"
                  title="删除"
                >
                  ×
                </button>
              </div>

              <!-- URL 链接输入 -->
              <div v-else class="wm-url-group">
                <input
                  type="url"
                  v-model="urlInput"
                  class="soft-input wm-input"
                  placeholder="https://... 粘贴网络图片链接"
                  @blur="applyUrlImage"
                  @keyup.enter="applyUrlImage"
                />
                <button type="button" class="wm-apply-btn" @click="applyUrlImage">应用</button>
              </div>

              <div v-if="uploadError" class="wm-error-tip">{{ uploadError }}</div>
            </template>

            <!-- 排版布局：全屏平铺 vs 单图标注 -->
            <div class="wm-section-title">排版模式</div>
            <div class="wm-segmented">
              <button
                type="button"
                :class="{ active: config.layout === 'tiled' }"
                @click="config.layout = 'tiled'"
              >
                全屏平铺密铺
              </button>
              <button
                type="button"
                :class="{ active: config.layout === 'single' }"
                @click="config.layout = 'single'"
              >
                单图角落固定
              </button>
            </div>

            <!-- 单图位置 -->
            <template v-if="config.layout === 'single'">
              <div class="wm-section-title">固定位置</div>
              <div class="wm-tag-grid">
                <button
                  v-for="p in positionOptions"
                  :key="p.id"
                  type="button"
                  class="wm-tag-btn"
                  :class="{ active: config.position === p.id }"
                  @click="config.position = p.id"
                >
                  {{ p.label }}
                </button>
              </div>
            </template>

            <!-- 水印视觉风格与特效 -->
            <div class="wm-section-title">视觉质感</div>
            <div class="wm-tag-grid">
              <button
                v-for="eff in effectOptions"
                :key="eff.id"
                type="button"
                class="wm-tag-btn"
                :class="{ active: config.effect === eff.id }"
                @click="config.effect = eff.id"
              >
                {{ eff.label }}
              </button>
            </div>

            <div class="wm-section-title">混合模式</div>
            <div class="wm-tag-grid">
              <button
                v-for="b in blendOptions"
                :key="b.id"
                type="button"
                class="wm-tag-btn"
                :class="{ active: config.blendMode === b.id }"
                @click="config.blendMode = b.id"
              >
                {{ b.label }}
              </button>
            </div>

            <!-- 参数滑块群 -->
            <div class="wm-section-title">参数微调</div>

            <!-- 不透明度 -->
            <div class="wm-slider-group">
              <div class="wm-slider-header">
                <span>透明度</span>
                <div class="wm-slider-right">
                  <button type="button" class="wm-single-reset" @click="config.opacity = 0.25" title="重置透明度">重置</button>
                  <span class="wm-slider-val">{{ Math.round(config.opacity * 100) }}%</span>
                </div>
              </div>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.01"
                v-model.number="config.opacity"
                class="wm-slider"
              />
            </div>

            <!-- 旋转角度 -->
            <div class="wm-slider-group">
              <div class="wm-slider-header">
                <span>倾斜旋转</span>
                <div class="wm-slider-right">
                  <button type="button" class="wm-single-reset" @click="config.rotate = -25" title="重置旋转">重置</button>
                  <span class="wm-slider-val">{{ config.rotate }}°</span>
                </div>
              </div>
              <input
                type="range"
                min="-90"
                max="90"
                step="1"
                v-model.number="config.rotate"
                class="wm-slider"
              />
            </div>

            <!-- 缩放比例 -->
            <div class="wm-slider-group">
              <div class="wm-slider-header">
                <span>大小缩放</span>
                <div class="wm-slider-right">
                  <button type="button" class="wm-single-reset" @click="config.scale = 1" title="重置缩放">重置</button>
                  <span class="wm-slider-val">{{ Math.round(config.scale * 100) }}%</span>
                </div>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                v-model.number="config.scale"
                class="wm-slider"
              />
            </div>

            <!-- 平铺排版微调 -->
            <template v-if="config.layout === 'tiled'">
              <div class="wm-slider-group">
                <div class="wm-slider-header">
                  <span>横向列数（密度）</span>
                  <div class="wm-slider-right">
                    <button type="button" class="wm-single-reset" @click="config.columns = 2" title="重置列数">重置</button>
                    <span class="wm-slider-val">{{ config.columns ?? 2 }} 列</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  v-model.number="config.columns"
                  class="wm-slider"
                />
              </div>

              <div class="wm-slider-group">
                <div class="wm-slider-header">
                  <span>纵向行间距（密度）</span>
                  <div class="wm-slider-right">
                    <button type="button" class="wm-single-reset" @click="config.gapY = 100" title="重置纵向间距">重置</button>
                    <span class="wm-slider-val">{{ config.gapY ?? 100 }}px</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="30"
                  max="200"
                  step="5"
                  v-model.number="config.gapY"
                  class="wm-slider"
                />
              </div>
            </template>
          </div>

          <!-- 底部操作区 -->
          <div class="wm-bottom-actions">
            <button class="wm-secondary-btn" type="button" @click="resetToDefault">重置默认</button>
            <button class="wm-primary-btn" type="button" @click="close">完成</button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@import './AppearanceSettings.css';

.wm-modal-overlay {
  padding: 18px;
}

.wm-modal-panel {
  width: min(410px, calc(100% - 36px));
  height: min(720px, 88vh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wm-modal-header {
  flex: 0 0 auto;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 14px;
}

.wm-scroll-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 18px 20px;
  scrollbar-width: none;
}
.wm-scroll-content::-webkit-scrollbar {
  display: none;
}

.wm-switch-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid var(--border-color);
  margin-bottom: 16px;
}

.wm-switch-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.wm-switch-info strong {
  font-size: 14px;
  color: var(--text-primary);
}

.wm-switch-info small {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

.wm-section-title {
  margin: 16px 2px 8px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.wm-segmented {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 3px;
  border-radius: 13px;
  background: var(--sys-bg-tertiary);
  margin-bottom: 10px;
}

.wm-segmented button {
  border: none;
  border-radius: 10px;
  padding: 9px;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.wm-segmented button.active {
  background: var(--card-bg-solid);
  color: var(--text-primary);
  box-shadow: 0 2px 8px var(--shadow-color);
  font-weight: 600;
}

.wm-sub-segmented {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 2px;
  border-radius: 10px;
  background: var(--sys-bg-tertiary);
  margin-bottom: 10px;
}

.wm-sub-segmented button {
  border: none;
  border-radius: 8px;
  padding: 7px;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 11px;
  cursor: pointer;
}

.wm-sub-segmented button.active {
  background: var(--card-bg-solid);
  color: var(--text-primary);
  font-weight: 600;
}

.wm-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
}

.wm-color-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.wm-color-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
  transition: transform 0.15s;
}

.wm-color-dot.active {
  transform: scale(1.15);
  border-color: var(--accent-color, #007aff);
}

.wm-slider-group {
  margin-top: 14px;
  background: rgba(255, 255, 255, 0.25);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 10px 14px;
}

.wm-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.wm-slider-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wm-single-reset {
  border: none;
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-tertiary);
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.is-dark .wm-single-reset {
  background: rgba(255, 255, 255, 0.1);
}

.wm-single-reset:hover {
  background: var(--text-primary);
  color: var(--sys-bg-primary);
}

.wm-slider-val {
  font-weight: 600;
  color: var(--text-primary);
}

.wm-slider {
  width: 100%;
  height: 5px;
  border-radius: 3px;
  background: var(--sys-bg-tertiary);
  outline: none;
  cursor: pointer;
}

.wm-hidden-input {
  display: none;
}

.wm-upload-card {
  position: relative;
  width: 100%;
  height: 80px;
  border: 1.5px dashed var(--border-color);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.3);
  transition: border-color 0.2s;
}

.wm-upload-placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.wm-preview-thumb {
  height: 60px;
  display: flex;
  align-items: center;
}

.wm-preview-thumb img {
  max-height: 100%;
  max-width: 100px;
  object-fit: contain;
  border-radius: 6px;
}

.wm-thumb-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border: none;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wm-url-group {
  display: flex;
  gap: 8px;
}

.wm-apply-btn {
  padding: 0 14px;
  border-radius: 12px;
  border: none;
  background: var(--text-primary);
  color: var(--sys-bg-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.wm-tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.wm-tag-btn {
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.35);
  border-radius: 10px;
  padding: 7px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.wm-tag-btn.active {
  background: var(--card-bg-solid);
  color: var(--text-primary);
  font-weight: 600;
  border-color: var(--accent-color, #007aff);
}

.wm-error-tip {
  margin-top: 6px;
  color: #e74c3c;
  font-size: 11px;
}

.wm-bottom-actions {
  flex: 0 0 auto;
  display: flex;
  gap: 10px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.2);
}

.wm-primary-btn,
.wm-secondary-btn {
  min-height: 42px;
  border-radius: 14px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.wm-primary-btn {
  flex: 1.2;
  background: var(--text-primary);
  color: var(--sys-bg-primary);
}

.wm-secondary-btn {
  flex: 0.8;
  background: var(--sys-bg-tertiary);
  color: var(--text-secondary);
}
</style>
