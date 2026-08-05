/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed, watch } from 'vue'
import { useChatAuth } from './useChatAuth'

export function useChatListBeautify(showDialog: any) {
  const { currentChatUserId } = useChatAuth()
  
  const getStorageKey = (baseKey: string) => {
    return currentChatUserId.value ? `${baseKey}_${currentChatUserId.value}` : baseKey
  }

  const beautifyModalVisible = ref(false)
  const pinBgUrl = ref(localStorage.getItem(getStorageKey('clingy_pin_bg_url')) || '')
  const pinBgPosition = ref(localStorage.getItem(getStorageKey('clingy_pin_bg_pos')) || 'center')
  const pinBgBlur = ref(Number(localStorage.getItem(getStorageKey('clingy_pin_bg_blur')) ?? 4))
  const pinSvg = ref(localStorage.getItem(getStorageKey('clingy_pin_svg')) || '')

  const tempPinBgUrl = ref('')
  const tempPinBgPosition = ref('center')
  const tempPinBgBlur = ref(4)
  const tempPinSvg = ref('')

  const openBeautifyModal = () => {
    tempPinBgUrl.value = pinBgUrl.value
    tempPinBgPosition.value = pinBgPosition.value
    tempPinBgBlur.value = pinBgBlur.value
    tempPinSvg.value = pinSvg.value
    beautifyModalVisible.value = true
  }

  const saveBeautify = () => {
    pinBgUrl.value = tempPinBgUrl.value
    localStorage.setItem(getStorageKey('clingy_pin_bg_url'), tempPinBgUrl.value)
    
    pinBgPosition.value = tempPinBgPosition.value
    localStorage.setItem(getStorageKey('clingy_pin_bg_pos'), tempPinBgPosition.value)
    
    pinBgBlur.value = tempPinBgBlur.value
    localStorage.setItem(getStorageKey('clingy_pin_bg_blur'), String(tempPinBgBlur.value))
    
    pinSvg.value = tempPinSvg.value
    localStorage.setItem(getStorageKey('clingy_pin_svg'), tempPinSvg.value)
    
    beautifyModalVisible.value = false
  }

  const handlePinBgSaved = (url: string | null) => {
    tempPinBgUrl.value = url || ''
  }

  // SVG 预设逻辑
  const defaultPresetSvgs = [
    { name: '星星', svg: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>' },
    { name: '气泡', svg: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>' },
    { name: '方块', svg: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>' }
  ]

  const customPresetSvgs = ref<{name: string, svg: string}[]>([])
  try {
    const saved = localStorage.getItem(getStorageKey('clingy_svg_presets'))
    if (saved) {
      customPresetSvgs.value = JSON.parse(saved)
    }
  } catch (e) {}

  const combinedPresetSvgs = computed(() => {
    return [...defaultPresetSvgs, ...customPresetSvgs.value]
  })

  const selectedPresetIndex = ref<number | string>('')

  watch(selectedPresetIndex, (val) => {
    if (val === '') {
      tempPinSvg.value = ''
    } else if (typeof val === 'number') {
      tempPinSvg.value = combinedPresetSvgs.value[val].svg
    }
  })

  const addCurrentToPreset = () => {
    const val = tempPinSvg.value.trim()
    if (!val) {
      showDialog({ content: '请先输入一段 SVG 代码', showCancel: false })
      return
    }
    showDialog({
      title: '新增预设',
      content: '为这个图标起个名字：',
      showInput: true,
      inputPlaceholder: '例如：小心心',
      onConfirm: (nameVal?: string) => {
        const name = nameVal?.trim() || '自定义'
        customPresetSvgs.value.push({ name, svg: val })
        localStorage.setItem(getStorageKey('clingy_svg_presets'), JSON.stringify(customPresetSvgs.value))
      }
    })
  }

  const exportPresets = () => {
    if (customPresetSvgs.value.length === 0) {
      showDialog({ content: '暂无自定义预设可导出', showCancel: false })
      return
    }
    const data = JSON.stringify(customPresetSvgs.value)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clingy_svg_presets_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportPresets = (e: Event) => {
    const target = e.target as HTMLInputElement
    if (target.files && target.files.length > 0) {
      const file = target.files[0]
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const json = JSON.parse(ev.target?.result as string)
          if (Array.isArray(json)) {
            customPresetSvgs.value = [...customPresetSvgs.value, ...json]
            localStorage.setItem(getStorageKey('clingy_svg_presets'), JSON.stringify(customPresetSvgs.value))
            showDialog({ content: '导入成功', showCancel: false })
          }
        } catch (err) {
          showDialog({ content: '导入失败，格式错误', showCancel: false })
        }
        target.value = ''
      }
      reader.readAsText(file)
    }
  }

  const deleteSelectedPresets = (selectedManagePresets: Set<number>, onSuccess: () => void) => {
    if (selectedManagePresets.size === 0) return
    showDialog({
      title: '批量删除预设',
      content: `确定要删除选中的 ${selectedManagePresets.size} 个预设吗？`,
      confirmText: '删除',
      onConfirm: () => {
        const toDelete = Array.from(selectedManagePresets).sort((a, b) => b - a)
        toDelete.forEach(idx => {
          customPresetSvgs.value.splice(idx, 1)
        })
        localStorage.setItem(getStorageKey('clingy_svg_presets'), JSON.stringify(customPresetSvgs.value))
        onSuccess()
      }
    })
  }

  return {
    beautifyModalVisible,
    pinBgUrl,
    pinBgPosition,
    pinBgBlur,
    pinSvg,
    tempPinBgUrl,
    tempPinBgPosition,
    tempPinBgBlur,
    tempPinSvg,
    defaultPresetSvgs,
    customPresetSvgs,
    combinedPresetSvgs,
    selectedPresetIndex,
    openBeautifyModal,
    saveBeautify,
    handlePinBgSaved,
    addCurrentToPreset,
    exportPresets,
    handleImportPresets,
    deleteSelectedPresets
  }
}
