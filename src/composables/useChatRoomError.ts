/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'

export function useChatRoomError() {
  const showErrorModal = ref(false)
  const errorMessage = ref('')
  const errorDetails = ref('')
  const activeErrorTab = ref<'info' | 'details'>('info')
  const copyButtonText = ref('一键复制')

  const closeErrorModal = () => {
    showErrorModal.value = false
    errorMessage.value = ''
    errorDetails.value = ''
    activeErrorTab.value = 'info'
  }

  const copyErrorDetails = async () => {
    try {
      await navigator.clipboard.writeText(errorDetails.value)
      copyButtonText.value = '复制成功！'
      setTimeout(() => {
        copyButtonText.value = '一键复制'
      }, 2000)
    } catch (err) {
      copyButtonText.value = '复制失败'
      setTimeout(() => {
        copyButtonText.value = '一键复制'
      }, 2000)
    }
  }

  const mountTestError = () => {
    ;(window as any).__testError = () => {
      errorMessage.value = "TypeError: Cannot read properties of undefined (reading 'data')\n\n这可能是一个模拟的网络断开或解析错误。"
      errorDetails.value = `Error: Simulate Fetch Failure
      at triggerAPI (ChatRoomView.vue:324:15)
      at async callNext (api.ts:45:9)
      at Runtime.processEvent (core.js:121:22)`
      activeErrorTab.value = 'info'
      showErrorModal.value = true
      console.log('[测试] 文件夹风格报错弹窗已唤起！')
    }
  }

  return {
    showErrorModal,
    errorMessage,
    errorDetails,
    activeErrorTab,
    copyButtonText,
    closeErrorModal,
    copyErrorDetails,
    mountTestError
  }
}
