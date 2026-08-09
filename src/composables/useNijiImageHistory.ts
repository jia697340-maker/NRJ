/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'

interface NijiImageHistoryItem { id: string; timestamp: number; params: any; imageBlob?: Blob; imageUrl?: string }
interface NijiImageHistoryMeta { id: string; timestamp: number; params: any }

const historyStore = localforage.createInstance({ name: 'app_niji_image_history', storeName: 'history_items' })
const historyItems = ref<NijiImageHistoryMeta[]>([])

const loadHistoryList = async () => {
  const items: NijiImageHistoryMeta[] = []
  for (const key of await historyStore.keys()) {
    const item = await historyStore.getItem<NijiImageHistoryItem>(key)
    if (item) items.push({ id: item.id, timestamp: item.timestamp, params: item.params })
  }
  historyItems.value = items.sort((a, b) => b.timestamp - a.timestamp)
}

const addHistoryItem = async (params: any, image: string) => {
  const id = `${Date.now()}_${Math.floor(Math.random() * 1000)}`
  const item: NijiImageHistoryItem = { id, timestamp: Date.now(), params: JSON.parse(JSON.stringify(params)) }
  try {
    const response = await fetch(image)
    if (!response.ok) throw new Error('图片下载失败')
    item.imageBlob = await response.blob()
  } catch {
    item.imageUrl = image
  }
  await historyStore.setItem(id, item)
  await loadHistoryList()
  for (const oldItem of historyItems.value.slice(30)) await historyStore.removeItem(oldItem.id)
  if (historyItems.value.length > 30) await loadHistoryList()
}

const deleteHistoryItem = async (id: string) => { await historyStore.removeItem(id); await loadHistoryList() }
const getHistoryImageUrl = async (id: string) => {
  const item = await historyStore.getItem<NijiImageHistoryItem>(id)
  return item?.imageBlob ? URL.createObjectURL(item.imageBlob) : (item?.imageUrl || null)
}

void loadHistoryList()
export function useNijiImageHistory() { return { historyItems, loadHistoryList, addHistoryItem, deleteHistoryItem, getHistoryImageUrl } }
