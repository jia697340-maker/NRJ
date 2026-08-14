/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'

export interface VibeImage {
  id: string
  base64: string // without prefix, to save space and for API
  mimeType?: string
  previewBase64?: string
  previewMimeType?: string
  name?: string
  externalId?: string
  sourceFilename?: string
  encodings?: VibeEncoding[]
  addedAt: number
}

export interface VibeEncoding {
  model: string
  informationExtracted: number
  encoding: string
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

export interface VibeImportItem {
  image: Omit<VibeImage, 'id' | 'addedAt'>
  strength: number
  extracted: number
}

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export const novelAIModelToVibeKey = (model: string): string => {
  switch (model) {
    case 'nai-diffusion-4-curated-preview': return 'v4curated'
    case 'nai-diffusion-4-full': return 'v4full'
    case 'nai-diffusion-4-5-curated': return 'v4-5curated'
    case 'nai-diffusion-4-5-full': return 'v4-5full'
    default: return model
  }
}

export const findVibeEncoding = (
  image: Pick<VibeImage, 'encodings'>,
  model: string,
  informationExtracted: number
): string | null => {
  const expectedModel = novelAIModelToVibeKey(model).toLowerCase()
  const match = image.encodings?.find(item => (
    novelAIModelToVibeKey(item.model).toLowerCase() === expectedModel
    && Math.abs(item.informationExtracted - informationExtracted) < 0.000001
  ))
  return match?.encoding || null
}

export interface NovelAIVibeReferencePayload {
  images: string[]
  encodings: Array<string | null>
  strengths: number[]
  informationExtracted: number[]
}

export const buildNovelAIVibeReferences = (
  groups: VibeGroup[],
  images: VibeImage[],
  groupIds: string[],
  model: string
): NovelAIVibeReferencePayload => {
  const result: NovelAIVibeReferencePayload = {
    images: [],
    encodings: [],
    strengths: [],
    informationExtracted: []
  }

  for (const groupId of groupIds) {
    const group = groups.find(item => item.id === groupId)
    if (!group) continue
    for (const item of group.items) {
      const image = images.find(candidate => candidate.id === item.imageId)
      if (!image) continue
      result.images.push(image.base64 || '')
      result.encodings.push(findVibeEncoding(image, model, item.extracted))
      result.strengths.push(item.strength)
      result.informationExtracted.push(item.extracted)
    }
  }

  return result
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
      id: createId('vibe-image'),
      base64,
      mimeType: 'image/jpeg',
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
      id: createId('vibe-group'),
      name,
      items: []
    }
    vibeGroups.value.push(newGroup)
    await saveData()
    return newGroup
  }

  const addImportedGroup = async (name: string, items: VibeImportItem[]) => {
    if (items.length === 0) throw new Error('没有可导入的氛围')
    const now = Date.now()
    const importedImages = items.map((item, index): VibeImage => ({
      ...item.image,
      id: createId('vibe-image'),
      addedAt: now + index
    }))
    const newGroup: VibeGroup = {
      id: createId('vibe-group'),
      name,
      items: importedImages.map((image, index) => ({
        imageId: image.id,
        strength: items[index].strength,
        extracted: items[index].extracted
      }))
    }
    vibeImages.value.push(...importedImages)
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
    addImportedGroup,
    removeGroup,
    removeGroups,
    updateGroup,
    saveData
  }
}
