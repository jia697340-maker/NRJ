/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed } from 'vue'
import localforage from 'localforage'
import { worldBooks } from '../store'

export function useWorldBookCovers() {
  const store = localforage.createInstance({
    name: 'nrt-app',
    storeName: 'avatars'
  })

  const bookCovers = ref<Record<string, string>>({})
  const bookBackgrounds = ref<Record<string, string>>({})
  const modalVisible = ref(false)
  const bgModalVisible = ref(false)
  const editingBookId = ref<string | null>(null)

  const currentEditAvatar = computed(() => {
    if (!editingBookId.value) return null
    return bookCovers.value[editingBookId.value] || null
  })

  const currentEditBg = computed(() => {
    if (!editingBookId.value) return null
    return bookBackgrounds.value[editingBookId.value] || null
  })

  const loadCovers = async () => {
    try {
      for (const book of worldBooks) {
        const cover = await store.getItem<string>(`wb-cover-${book.id}`)
        if (cover) {
          bookCovers.value[book.id] = cover
        }
        const bg = await store.getItem<string>(`wb-bg-${book.id}`)
        if (bg) {
          bookBackgrounds.value[book.id] = bg
        }
      }
    } catch (e) {
      console.error('Failed to load covers and backgrounds', e)
    }
  }

  const openCoverModal = (id: string, event?: Event) => {
    if (event) event.stopPropagation()
    editingBookId.value = id
    modalVisible.value = true
  }

  const handleCoverSaved = async (url: string | null) => {
    try {
      if (!editingBookId.value) return
      const id = editingBookId.value
      
      if (url) {
        bookCovers.value[id] = url
        await store.setItem(`wb-cover-${id}`, url)
      } else {
        delete bookCovers.value[id]
        await store.removeItem(`wb-cover-${id}`)
      }
    } catch (e) {
      console.error('Failed to save cover', e)
    }
  }

  const handleBgSaved = async (url: string | null) => {
    try {
      if (!editingBookId.value) return
      const id = editingBookId.value
      
      if (url) {
        bookBackgrounds.value[id] = url
        await store.setItem(`wb-bg-${id}`, url)
      } else {
        delete bookBackgrounds.value[id]
        await store.removeItem(`wb-bg-${id}`)
      }
    } catch (e) {
      console.error('Failed to save background', e)
    }
  }
  
  const removeBookCoverAndBg = async (id: string) => {
    await store.removeItem(`wb-cover-${id}`)
    await store.removeItem(`wb-bg-${id}`)
    delete bookCovers.value[id]
    delete bookBackgrounds.value[id]
  }

  return {
    bookCovers,
    bookBackgrounds,
    modalVisible,
    bgModalVisible,
    editingBookId,
    currentEditAvatar,
    currentEditBg,
    loadCovers,
    openCoverModal,
    handleCoverSaved,
    handleBgSaved,
    removeBookCoverAndBg
  }
}
