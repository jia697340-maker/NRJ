/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'
import { sendChatMessage } from '../services/api'

export function useChatRoomMultiSelect(
  selectedChat: any,
  isMultiSelectMode: any,
  selectedMessageIds: any,
  enterMultiSelectMode: any,
  exitMultiSelectMode: any,
  toggleMessageSelection: any,
  saveCustomContacts: () => void,
  updatePreviewAndTime: (content: string) => void,
  showToast: (msg: string) => void
) {
  const showActionModal = ref(false)
  const targetMessageId = ref<number | undefined>(undefined)
  const canRecallTarget = ref(false)
  let pressTimer: any = null

  const handleTouchStart = (msgId: number) => {
    if (isMultiSelectMode.value) return
    if (pressTimer) clearTimeout(pressTimer)
    pressTimer = setTimeout(() => {
      targetMessageId.value = msgId
      const msg = selectedChat.value?.messages?.find((m: any) => m.id === msgId)
      // 根据系统时间戳判断是否在5分钟内，仅对用户自己的消息(type='right')显示撤回
      if (msg && msg.type === 'right' && !msg.isRecalled && (Date.now() - msg.id <= 300000)) {
        canRecallTarget.value = true
      } else {
        canRecallTarget.value = false
      }
      showActionModal.value = true
    }, 500)
  }

  const handleTouchEnd = (e?: TouchEvent | MouseEvent) => {
    if (pressTimer) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  const handleTouchMove = () => {
    if (pressTimer) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  const handleMessageClick = (msgId: number) => {
    if (isMultiSelectMode.value) {
      toggleMessageSelection(msgId)
    }
  }

  const onModalMultiSelect = (msgId?: number) => {
    enterMultiSelectMode('general', msgId)
  }

  const onModalMarkMultiSelect = (msgId?: number) => {
    enterMultiSelectMode('mark', msgId || targetMessageId.value)
  }

  const onModalRecallMultiSelect = (msgId?: number) => {
    const targetId = msgId || targetMessageId.value
    if (targetId) {
      const msg = selectedChat.value?.messages?.find((m: any) => m.id === targetId)
      if (msg && msg.type === 'right' && !msg.isRecalled && (Date.now() - msg.id <= 300000)) {
        enterMultiSelectMode('recall', targetId)
      } else {
        showToast('已经超过5分钟了，不能撤回了。')
      }
    } else {
      enterMultiSelectMode('recall')
    }
  }

  const onModalCopy = async () => {
    const msg = selectedChat.value?.messages?.find((m: any) => m.id === targetMessageId.value)
    if (msg) {
      try {
        await navigator.clipboard.writeText(msg.content)
      } catch (e) {
        console.error('复制失败', e)
      }
    }
  }

  const handleResummarize = async (msgId?: number) => {
    const targetId = msgId || targetMessageId.value
    if (!targetId || !selectedChat.value) return
    const targetMsg = selectedChat.value.messages?.find((m: any) => m.id === targetId)
    if (!targetMsg) return

    showToast('正在重新总结...')

    let needCompress = false
    let base64ToCompress = ''
    let compressPrompt = ''

    if (targetMsg.isEmoji && !targetMsg.emojiSummary) {
       needCompress = true
       compressPrompt = '请简短客观地描述这个表情包的情绪或画面内容（无需带上主观评价，只需陈述）。'
       if (targetMsg.emojiId) {
         const emojiStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatEmojis' })
         try {
            const item = await emojiStore.getItem<any>(targetMsg.emojiId)
            if (item) {
               let rawData = ''
               if (item.type === 'local' && item.data instanceof Blob) {
                 rawData = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onloadend = () => typeof reader.result === 'string' ? resolve(reader.result) : reject()
                    reader.readAsDataURL(item.data)
                 })
               } else if (item.type === 'url' && typeof item.data === 'string') {
                  rawData = item.data
               }
               if (rawData) base64ToCompress = rawData
            }
         } catch(e) {}
       }
    } else if (targetMsg.imageData && targetMsg.imageData.imageId && !targetMsg.imageData.summary) {
       needCompress = true
       compressPrompt = '请简短客观地描述这张图片的内容，捕捉主要元素。'
       const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
       try {
         const base64Data = await imageStore.getItem<string>(targetMsg.imageData.imageId)
         if (base64Data) {
           base64ToCompress = base64Data
         }
       } catch(e) {}
    }

    if (needCompress && base64ToCompress) {
       const compressRequest = [
         { role: 'user', content: [
           { type: 'text', text: compressPrompt },
           { type: 'image_url', image_url: { url: base64ToCompress } }
         ]}
       ]
       try {
         const res = await sendChatMessage(compressRequest, undefined, false, true)
         let summaryContent = typeof res === 'string' ? res : res.content
         summaryContent = summaryContent.trim()
         if (summaryContent) {
            if (targetMsg.isEmoji) {
              targetMsg.emojiSummary = summaryContent
            } else if (targetMsg.imageData) {
              targetMsg.imageData.summary = summaryContent
            }
            saveCustomContacts()
            showToast('重新总结成功')
         } else {
            showToast('返回内容为空，重新总结失败')
         }
       } catch (err: any) {
         console.error('重新总结失败', err)
         showToast(`重新总结失败: ${err.message}`)
       }
    } else {
       showToast('无法提取图片数据，重新总结失败')
    }
  }

  const recallSelectedMessages = () => {
    if (!selectedChat.value || selectedMessageIds.value.size === 0) return
    
    const now = Date.now()
    let hasRecalled = false
    
    selectedChat.value.messages.forEach((m: any) => {
      if (selectedMessageIds.value.has(m.id) && m.type === 'right' && (now - m.id <= 300000) && !m.isRecalled) {
        m.isRecalled = true
        hasRecalled = true
      }
    })
    
    if (hasRecalled) {
      saveCustomContacts()
    }
    exitMultiSelectMode()
  }

  const showRecallContentModal = ref(false)
  const recallOriginalContent = ref('')

  const viewRecalledMessage = (content: string) => {
    recallOriginalContent.value = content
    showRecallContentModal.value = true
  }

  const justMarkedIds = ref<Set<number>>(new Set())

  const markSelectedMessages = (isMark: boolean) => {
    if (!selectedChat.value || selectedMessageIds.value.size === 0) return
    
    let processedCount = 0
    selectedChat.value.messages.forEach((m: any) => {
      if (selectedMessageIds.value.has(m.id)) {
        if (!!m.isMarked !== isMark) {
          m.isMarked = isMark
          processedCount++
          if (isMark) {
            justMarkedIds.value.add(m.id)
          }
        }
      }
    })
    
    saveCustomContacts()
    exitMultiSelectMode()
    showToast(`已${isMark ? '设为重要' : '取消标记'} ${processedCount} 条消息`)

    if (isMark) {
      setTimeout(() => {
        justMarkedIds.value.clear()
      }, 2500)
    }
  }

  const deleteSelectedMessages = () => {
    if (!selectedChat.value || selectedMessageIds.value.size === 0) return
    
    selectedChat.value.messages = selectedChat.value.messages.filter((m: any) => !selectedMessageIds.value.has(m.id))
    
    // 手动更新外部 mockChats 里的状态
    import('./useChatState').then(({ useChatState }) => {
      const { mockChats } = useChatState()
      const targetChat = mockChats.value.find(c => c.id === selectedChat.value.id)
      if (targetChat) {
        if (selectedChat.value.messages.length > 0) {
          const lastValidMsgs = selectedChat.value.messages.filter((m: any) => m.type === 'left' || m.type === 'right')
          if (lastValidMsgs.length > 0) {
            const lastMsg = lastValidMsgs[lastValidMsgs.length - 1]
            updatePreviewAndTime(lastMsg.content)
            // fallback force update if updatePreviewAndTime doesn't mutate mockChats
            targetChat.preview = lastMsg.content
          } else {
            updatePreviewAndTime('暂无消息')
            targetChat.preview = '暂无消息'
          }
        } else {
          updatePreviewAndTime('暂无消息')
          targetChat.preview = '暂无消息'
        }
      }
      saveCustomContacts()
      exitMultiSelectMode()
    })
  }

  return {
    showActionModal,
    targetMessageId,
    canRecallTarget,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
    handleMessageClick,
    onModalMultiSelect,
    onModalRecallMultiSelect,
    onModalCopy,
    recallSelectedMessages,
    showRecallContentModal,
    recallOriginalContent,
    viewRecalledMessage,
    deleteSelectedMessages,
    markSelectedMessages,
    onModalMarkMultiSelect,
    justMarkedIds,
    handleResummarize
  }
}
