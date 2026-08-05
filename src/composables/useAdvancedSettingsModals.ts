/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'

export function useAdvancedSettingsModals() {
  const confirmModal = ref({
    visible: false,
    title: '提示',
    message: '',
    showCancel: true,
    type: 'normal' as 'normal' | 'danger',
    onConfirm: null as (() => void) | null,
    onCancel: null as (() => void) | null
  })

  const showConfirm = (message: string, title = '提示', showCancel = true, type: 'normal' | 'danger' = 'normal') => {
    return new Promise<boolean>((resolve) => {
      confirmModal.value = {
        visible: true,
        title,
        message,
        showCancel,
        type,
        onConfirm: () => {
          confirmModal.value.visible = false
          resolve(true)
        },
        onCancel: () => {
          confirmModal.value.visible = false
          resolve(false)
        }
      }
    })
  }

  const closeConfirmModal = () => {
    if (confirmModal.value.onCancel) {
      confirmModal.value.onCancel()
    } else {
      confirmModal.value.visible = false
    }
  }

  const handleConfirm = () => {
    if (confirmModal.value.onConfirm) {
      confirmModal.value.onConfirm()
    } else {
      confirmModal.value.visible = false
    }
  }

  return {
    confirmModal,
    showConfirm,
    closeConfirmModal,
    handleConfirm
  }
}
