/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'

export type GeminiReferenceKind = 'character' | 'object' | 'style' | 'scene'

export interface GeminiReferenceImage {
  id: string
  name: string
  dataUrl: string
  addedAt: number
}

export interface GeminiReferenceGroup {
  id: string
  name: string
  description: string
  kind: GeminiReferenceKind
  imageIds: string[]
}

const referenceImages = ref<GeminiReferenceImage[]>([])
const referenceGroups = ref<GeminiReferenceGroup[]>([])
const isLoaded = ref(false)
const store = localforage.createInstance({
  name: 'app_gemini_image_references',
  storeName: 'reference_data'
})

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export function useGeminiImageReference() {
  const loadData = async () => {
    if (isLoaded.value) return
    try {
      referenceImages.value = await store.getItem<GeminiReferenceImage[]>('images') || []
      referenceGroups.value = (await store.getItem<GeminiReferenceGroup[]>('groups') || [])
        .map(group => ({ ...group, kind: group.kind || 'character' }))
    } finally {
      isLoaded.value = true
    }
  }

  const saveData = async () => {
    await store.setItem('images', clone(referenceImages.value))
    await store.setItem('groups', clone(referenceGroups.value))
  }

  const addImage = async (name: string, dataUrl: string) => {
    const image: GeminiReferenceImage = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: name || '参考图',
      dataUrl,
      addedAt: Date.now()
    }
    referenceImages.value.push(image)
    await saveData()
    return image
  }

  const removeImage = async (id: string) => {
    referenceImages.value = referenceImages.value.filter(image => image.id !== id)
    referenceGroups.value.forEach(group => {
      group.imageIds = group.imageIds.filter(imageId => imageId !== id)
    })
    await saveData()
  }

  const addGroup = async (name: string, description = '', kind: GeminiReferenceKind = 'character') => {
    const group: GeminiReferenceGroup = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: name || '新参考组',
      description,
      kind,
      imageIds: []
    }
    referenceGroups.value.push(group)
    await saveData()
    return group
  }

  const updateGroup = async (group: GeminiReferenceGroup) => {
    const index = referenceGroups.value.findIndex(item => item.id === group.id)
    if (index !== -1) {
      referenceGroups.value[index] = clone(group)
      await saveData()
    }
  }

  const removeGroup = async (id: string) => {
    referenceGroups.value = referenceGroups.value.filter(group => group.id !== id)
    await saveData()
  }

  const getImagesForGroups = (groupIds: string[]) => {
    const imageIds = new Set(
      referenceGroups.value
        .filter(group => groupIds.includes(group.id))
        .flatMap(group => group.imageIds)
    )
    return referenceImages.value.filter(image => imageIds.has(image.id))
  }

  void loadData()
  return {
    referenceImages,
    referenceGroups,
    isLoaded,
    loadData,
    addImage,
    removeImage,
    addGroup,
    updateGroup,
    removeGroup,
    getImagesForGroups
  }
}
