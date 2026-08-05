/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'

export interface VibeImage {
  id: string
  base64: string // without prefix, to save space and for API
  addedAt: number
}

export interface VibeGroupItem {
  imageId: string
  strength: number
  extracted: number
}

export interface VibeGroup {
  id: string
  name: string
  items: VibeGroupItem[]
}

// Singleton state
const vibeImages = ref<VibeImage[]>([])
const vibeGroups = ref<VibeGroup[]>([])
const isLoaded = ref(false)

const store = localforage.createInstance({
  name: 'app_vibe_storage'
})

export function useNovelAIVibe() {
  const loadData = async () => {
    if (isLoaded.value) return
    try {
      const storedImages = await store.getItem<VibeImage[]>('vibeImages')
      const storedGroups = await store.getItem<VibeGroup[]>('vibeGroups')
      if (storedImages) vibeImages.value = storedImages
      if (storedGroups) vibeGroups.value = storedGroups
    } catch (e) {
      console.error('Failed to load vibe data', e)
    } finally {
      isLoaded.value = true
    }
  }

  const saveData = async () => {
    try {
      await store.setItem('vibeImages', JSON.parse(JSON.stringify(vibeImages.value)))
      await store.setItem('vibeGroups', JSON.parse(JSON.stringify(vibeGroups.value)))
    } catch (e) {
      console.error('Failed to save vibe data', e)
    }
  }

  const addImage = async (base64Data: string) => {
    // remove prefix if exists
    const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data
    const newImage: VibeImage = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      base64,
      addedAt: Date.now()
    }
    vibeImages.value.push(newImage)
    await saveData()
    return newImage
  }

  const removeImage = async (id: string) => {
    vibeImages.value = vibeImages.value.filter(img => img.id !== id)
    // also remove from all groups
    vibeGroups.value.forEach(group => {
      group.items = group.items.filter(item => item.imageId !== id)
    })
    await saveData()
  }

  const removeImages = async (ids: string[]) => {
    vibeImages.value = vibeImages.value.filter(img => !ids.includes(img.id))
    vibeGroups.value.forEach(group => {
      group.items = group.items.filter(item => !ids.includes(item.imageId))
    })
    await saveData()
  }

  const addGroup = async (name: string) => {
    const newGroup: VibeGroup = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      name,
      items: []
    }
    vibeGroups.value.push(newGroup)
    await saveData()
    return newGroup
  }

  const removeGroup = async (id: string) => {
    vibeGroups.value = vibeGroups.value.filter(g => g.id !== id)
    await saveData()
  }

  const removeGroups = async (ids: string[]) => {
    vibeGroups.value = vibeGroups.value.filter(g => !ids.includes(g.id))
    await saveData()
  }

  const updateGroup = async (group: VibeGroup) => {
    const index = vibeGroups.value.findIndex(g => g.id === group.id)
    if (index !== -1) {
      vibeGroups.value[index] = group
      await saveData()
    }
  }

  // Load immediately when composable is used
  loadData()

  return {
    vibeImages,
    vibeGroups,
    isLoaded,
    addImage,
    removeImage,
    removeImages,
    addGroup,
    removeGroup,
    removeGroups,
    updateGroup,
    saveData
  }
}
