/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, reactive } from 'vue'
import localforage from 'localforage'

export interface AppIconPreset {
  id: string
  name: string
  icons: Record<string, string> // appId -> url/base64
}

const store = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'appIcons'
})

const customIcons = reactive<Record<string, string>>({})
const presets = ref<AppIconPreset[]>([])

let isLoaded = false

export const useAppIcons = () => {
  const loadData = async () => {
    if (isLoaded) return
    try {
      const storedIcons = await store.getItem<Record<string, string>>('current_icons')
      if (storedIcons) {
        Object.assign(customIcons, storedIcons)
      }
      
      const storedPresets = await store.getItem<AppIconPreset[]>('icon_presets')
      if (storedPresets) {
        presets.value = storedPresets
      }
      isLoaded = true
    } catch (e) {
      console.error('Failed to load app icons', e)
    }
  }

  const saveCurrentIcons = async () => {
    try {
      const plainIcons = { ...customIcons }
      await store.setItem('current_icons', plainIcons)
    } catch (e) {
      console.error('Failed to save app icons', e)
    }
  }

  const setIcon = async (appId: string, url: string | null) => {
    if (url) {
      customIcons[appId] = url
    } else {
      delete customIcons[appId]
    }
    await saveCurrentIcons()
  }

  const savePreset = async (name: string) => {
    const newPreset: AppIconPreset = {
      id: Date.now().toString(),
      name,
      icons: { ...customIcons }
    }
    presets.value.push(newPreset)
    await store.setItem('icon_presets', presets.value)
  }

  const applyPreset = async (presetId: string) => {
    const preset = presets.value.find(p => p.id === presetId)
    if (preset) {
      // Clear current icons
      Object.keys(customIcons).forEach(key => delete customIcons[key])
      // Apply new icons
      Object.assign(customIcons, preset.icons)
      await saveCurrentIcons()
    }
  }

  const deletePreset = async (presetId: string) => {
    presets.value = presets.value.filter(p => p.id !== presetId)
    await store.setItem('icon_presets', presets.value)
  }

  return {
    customIcons,
    presets,
    loadData,
    setIcon,
    savePreset,
    applyPreset,
    deletePreset
  }
}
