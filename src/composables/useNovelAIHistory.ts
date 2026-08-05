/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'

export interface NovelAIHistoryItem {
  id: string
  timestamp: number
  params: any
  imageBlob: Blob
}

export interface NovelAIHistoryMeta {
  id: string
  timestamp: number
  params: any
}

const historyStore = localforage.createInstance({
  name: 'app_novelai_history',
  storeName: 'history_items'
})

const historyItems = ref<NovelAIHistoryMeta[]>([])

const loadHistoryList = async () => {
  const keys = await historyStore.keys()
  const items: NovelAIHistoryMeta[] = []
  for (const key of keys) {
    const item: any = await historyStore.getItem(key)
    if (item) {
      items.push({
        id: item.id,
        timestamp: item.timestamp,
        params: item.params
      })
    }
  }
  items.sort((a, b) => b.timestamp - a.timestamp)
  historyItems.value = items
}

const addHistoryItem = async (params: any, blobUrl: string) => {
  try {
    const response = await fetch(blobUrl)
    const blob = await response.blob()
    
    const id = Date.now().toString() + '_' + Math.floor(Math.random() * 1000)
    const timestamp = Date.now()
    
    const item: NovelAIHistoryItem = {
      id,
      timestamp,
      params: JSON.parse(JSON.stringify(params)), // Deep copy params
      imageBlob: blob
    }
    
    await historyStore.setItem(id, item)
    
    await loadHistoryList()
    
    if (historyItems.value.length > 20) {
      const toDelete = historyItems.value.slice(20)
      for (const d of toDelete) {
        await historyStore.removeItem(d.id)
      }
      await loadHistoryList()
    }
  } catch (error) {
    console.error('Failed to save history item:', error)
  }
}

const deleteHistoryItems = async (ids: string[]) => {
  for (const id of ids) {
    await historyStore.removeItem(id)
  }
  await loadHistoryList()
}

const getHistoryImageBlobUrl = async (id: string): Promise<string | null> => {
  const item: NovelAIHistoryItem | null = await historyStore.getItem(id)
  if (item && item.imageBlob) {
    return URL.createObjectURL(item.imageBlob)
  }
  return null
}

// Initial load
loadHistoryList()

export function useNovelAIHistory() {
  return {
    historyItems,
    loadHistoryList,
    addHistoryItem,
    deleteHistoryItems,
    getHistoryImageBlobUrl
  }
}
