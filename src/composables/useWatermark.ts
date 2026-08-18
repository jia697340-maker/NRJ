/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, ref, watch } from 'vue'
import localforage from 'localforage'

export type WatermarkType = 'text' | 'image'
export type WatermarkLayout = 'tiled' | 'single'
export type WatermarkPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center'
export type WatermarkEffect = 'normal' | 'embossed' | 'shadow' | 'stroke'

export interface WatermarkConfig {
  enabled: boolean
  type: WatermarkType
  text: string
  textColor: string
  textSize: number
  imageType: 'url' | 'local'
  imageUrl: string
  layout: WatermarkLayout
  position: WatermarkPosition
  opacity: number
  scale: number
  rotate: number
  gapX: number
  gapY: number
  columns: number
  tileCount: number
  effect: WatermarkEffect
  blendMode: 'normal' | 'overlay' | 'multiply' | 'screen' | 'soft-light'
}

const SETTINGS_STORAGE_KEY = 'clingy_watermark_settings'
const IMAGE_STORE_KEY = 'clingy_watermark_image'

const watermarkStorage = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'appWatermarks'
})

const defaultSettings: WatermarkConfig = {
  enabled: false,
  type: 'text',
  text: '粘人精专属',
  textColor: '#ffffff',
  textSize: 16,
  imageType: 'local',
  imageUrl: '',
  layout: 'tiled',
  position: 'bottom-right',
  opacity: 0.25,
  scale: 1,
  rotate: -25,
  gapX: 20,
  gapY: 100,
  columns: 2,
  tileCount: 32,
  effect: 'embossed',
  blendMode: 'normal'
}

const loadStoredConfig = (): WatermarkConfig => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (raw) {
      return { ...defaultSettings, ...JSON.parse(raw) }
    }
  } catch (e) {
    console.error('Failed to load watermark config:', e)
  }
  return { ...defaultSettings }
}

export const watermarkConfig = reactive<WatermarkConfig>(loadStoredConfig())
export const localImageDataUrl = ref<string>('')

// 监听并保存非图片体积的纯配置到 localStorage
watch(
  watermarkConfig,
  (val) => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(val))
    } catch (e) {
      console.error('Failed to save watermark config:', e)
    }
  },
  { deep: true }
)

let isInitialized = false

export function useWatermark() {
  const initialize = async () => {
    if (isInitialized) return
    isInitialized = true
    try {
      const storedImage = await watermarkStorage.getItem<string>(IMAGE_STORE_KEY)
      if (storedImage) {
        localImageDataUrl.value = storedImage
      }
    } catch (e) {
      console.error('Failed to initialize local watermark image:', e)
    }
  }

  const saveLocalImage = async (dataUrl: string) => {
    try {
      localImageDataUrl.value = dataUrl
      await watermarkStorage.setItem(IMAGE_STORE_KEY, dataUrl)
    } catch (e) {
      console.error('Failed to save local watermark image to IndexedDB:', e)
      throw e
    }
  }

  const removeLocalImage = async () => {
    try {
      localImageDataUrl.value = ''
      await watermarkStorage.removeItem(IMAGE_STORE_KEY)
    } catch (e) {
      console.error('Failed to remove local watermark image from IndexedDB:', e)
    }
  }

  const resetToDefault = () => {
    Object.assign(watermarkConfig, defaultSettings)
  }

  return {
    config: watermarkConfig,
    localImageDataUrl,
    initialize,
    saveLocalImage,
    removeLocalImage,
    resetToDefault
  }
}
