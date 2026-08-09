/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'

export interface FluxImageHistoryItem {
  id: string
  timestamp: number
  params: any
  imageBlob?: Blob
}

export interface FluxImageHistoryMeta {
  id: string
  timestamp: number
  params: any
}

const historyStore = localforage.createInstance({
  name: 'app_flux_image_history',
  storeName: 'history_items'
})

const historyItems = ref<FluxImageHistoryMeta[]>([])

const loadHistoryList = async () => {
  const items: FluxImageHistoryMeta[] = []
  for (const key of await historyStore.keys()) {
    const item = await historyStore.getItem<FluxImageHistoryItem>(key)
    if (item) items.push({ id: item.id, timestamp: item.timestamp, params: item.params })
  }
  historyItems.value = items.sort((a, b) => b.timestamp - a.timestamp)
}

const addHistoryItem = async (params: any, image: string) => {
  const id = `${Date.now()}_${Math.floor(Math.random() * 1000)}`
  const response = await fetch(image)
  const item: FluxImageHistoryItem = {
    id,
    timestamp: Date.now(),
    params: JSON.parse(JSON.stringify(params)),
    imageBlob: await response.blob()
  }
  await historyStore.setItem(id, item)
  await loadHistoryList()
  if (historyItems.value.length > 30) {
    for (const oldItem of historyItems.value.slice(30)) await historyStore.removeItem(oldItem.id)
    await loadHistoryList()
  }
}

const deleteHistoryItem = async (id: string) => {
  await historyStore.removeItem(id)
  await loadHistoryList()
}

const getHistoryImageUrl = async (id: string) => {
  const item = await historyStore.getItem<FluxImageHistoryItem>(id)
  return item?.imageBlob ? URL.createObjectURL(item.imageBlob) : null
}

void loadHistoryList()

export function useFluxImageHistory() {
  return {
    historyItems,
    loadHistoryList,
    addHistoryItem,
    deleteHistoryItem,
    getHistoryImageUrl
  }
}
