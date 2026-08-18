/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useWatermark } from '../composables/useWatermark'

const { config, localImageDataUrl, initialize } = useWatermark()

onMounted(async () => {
  await initialize()
})

const activeImageSrc = computed(() => {
  if (config.type !== 'image') return ''
  if (config.imageType === 'local') return localImageDataUrl.value
  return config.imageUrl || ''
})

// 水印滤镜/浮雕/阴影效果类与样式
const effectStyle = computed(() => {
  if (config.type === 'text') {
    switch (config.effect) {
      case 'embossed':
        return {
          color: config.textColor,
          textShadow: '1px 1px 1px rgba(255,255,255,0.7), -1px -1px 1px rgba(0,0,0,0.4)',
          filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.15))'
        }
      case 'shadow':
        return {
          color: config.textColor,
          textShadow: '0 2px 4px rgba(0,0,0,0.4)'
        }
      case 'stroke':
        return {
          color: config.textColor,
          WebkitTextStroke: '0.6px rgba(0,0,0,0.6)',
          textShadow: '0 1px 2px rgba(255,255,255,0.4)'
        }
      default:
        return {
          color: config.textColor
        }
    }
  } else {
    // 图片效果
    switch (config.effect) {
      case 'embossed':
        return {
          filter: 'drop-shadow(1px 1px 1px rgba(255,255,255,0.6)) drop-shadow(-1px -1px 1px rgba(0,0,0,0.35))'
        }
      case 'shadow':
        return {
          filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))'
        }
      case 'stroke':
        return {
          filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.8))'
        }
      default:
        return {}
    }
  }
})

// 容器层级混合模式与透明度
const overlayStyle = computed(() => ({
  opacity: config.opacity,
  mixBlendMode: config.blendMode
}))

// 单个水印项样式
const itemTransformStyle = computed(() => ({
  transform: `rotate(${config.rotate}deg) scale(${config.scale})`,
  transformOrigin: 'center center'
}))

// 单图模式位置
const singlePosClass = computed(() => {
  return `pos-${config.position}`
})

// 动态 Canvas 背景纹理生成：确保无缝平铺全屏，无论几列几行都绝不偏、绝不挤爆
const tiledPatternUrl = ref('')

const renderPattern = () => {
  if (!config.enabled || config.layout !== 'tiled') return

  const cols = Math.max(1, config.columns || 3)
  // 根据视口宽度与列数动态计算网格单元大小
  const screenW = typeof window !== 'undefined' ? window.innerWidth : 400
  const cellW = Math.max(60, Math.floor(screenW / cols))
  const cellH = Math.max(40, Number(config.gapY) || 50)

  const canvas = document.createElement('canvas')
  // 提高分辨率以保证清晰度
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 2, 2) : 2
  canvas.width = cellW * dpr
  canvas.height = cellH * dpr

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.scale(dpr, dpr)
  ctx.save()
  ctx.translate(cellW / 2, cellH / 2)
  ctx.rotate((Number(config.rotate) * Math.PI) / 180)
  ctx.scale(Number(config.scale) || 1, Number(config.scale) || 1)

  if (config.type === 'text') {
    const fontSize = Number(config.textSize) || 16
    ctx.font = `700 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // 根据视觉质感绘制阴影/浮雕
    if (config.effect === 'embossed') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.fillText(config.text || '', 1, 1)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
      ctx.fillText(config.text || '', -1, -1)
    } else if (config.effect === 'shadow') {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetY = 2
    } else if (config.effect === 'stroke') {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.lineWidth = 1.2
      ctx.strokeText(config.text || '', 0, 0)
    }

    ctx.fillStyle = config.textColor || '#ffffff'
    ctx.fillText(config.text || '', 0, 0)
    ctx.restore()

    tiledPatternUrl.value = canvas.toDataURL('image/png')
  } else {
    // 图片水印
    const imgSrc = activeImageSrc.value
    if (!imgSrc) {
      ctx.restore()
      tiledPatternUrl.value = ''
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const maxDim = Math.min(cellW * 0.75, cellH * 0.75, 80)
      let w = img.width
      let h = img.height
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w)
          w = maxDim
        } else {
          w = Math.round((w * maxDim) / h)
          h = maxDim
        }
      }
      ctx.drawImage(img, -w / 2, -h / 2, w, h)
      ctx.restore()
      tiledPatternUrl.value = canvas.toDataURL('image/png')
    }
    img.src = imgSrc
  }
}

watch(
  [
    () => config.enabled,
    () => config.type,
    () => config.text,
    () => config.textColor,
    () => config.textSize,
    () => config.columns,
    () => config.gapY,
    () => config.rotate,
    () => config.scale,
    () => config.effect,
    () => config.layout,
    () => activeImageSrc.value
  ],
  () => {
    renderPattern()
  },
  { immediate: true, deep: true }
)
</script>

<template>
  <div
    v-if="config.enabled"
    class="watermark-overlay-container"
    :style="overlayStyle"
    aria-hidden="true"
  >
    <!-- 全屏平铺密铺模式：使用 Canvas 背景无缝无死角铺满 -->
    <template v-if="config.layout === 'tiled'">
      <div
        class="watermark-tiled-canvas-layer"
        :style="{
          backgroundImage: tiledPatternUrl ? `url(${tiledPatternUrl})` : 'none'
        }"
      ></div>
    </template>

    <!-- 单图/固定角落模式 -->
    <template v-else>
      <div class="watermark-single-wrap" :class="singlePosClass">
        <div class="watermark-content" :style="itemTransformStyle">
          <template v-if="config.type === 'text'">
            <span
              class="watermark-text"
              :style="[
                { fontSize: `${config.textSize}px` },
                effectStyle
              ]"
            >
              {{ config.text }}
            </span>
          </template>
          <template v-else-if="activeImageSrc">
            <img
              :src="activeImageSrc"
              class="watermark-image"
              :style="effectStyle"
              alt=""
            />
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.watermark-overlay-container {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 99999; /* 保证覆盖全屏幕与所有弹窗，截图直接带水印，不影响任何点击触控 */
  overflow: hidden;
  user-select: none;
}

/* 原生无缝平铺层：无论怎么缩放、旋转、几列几行，全屏 100% 铺满且对称不偏移 */
.watermark-tiled-canvas-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background-repeat: repeat;
  background-position: center center;
  pointer-events: none;
}

.watermark-content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.watermark-text {
  font-weight: 700;
  letter-spacing: 1.5px;
  line-height: 1;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.watermark-image {
  max-width: 90px;
  max-height: 90px;
  object-fit: contain;
  display: block;
}

/* 单标位置 */
.watermark-single-wrap {
  position: absolute;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.watermark-single-wrap.pos-bottom-right {
  bottom: 16px;
  right: 16px;
}

.watermark-single-wrap.pos-bottom-left {
  bottom: 16px;
  left: 16px;
}

.watermark-single-wrap.pos-top-right {
  top: 50px;
  right: 16px;
}

.watermark-single-wrap.pos-top-left {
  top: 50px;
  left: 16px;
}

.watermark-single-wrap.pos-center {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
