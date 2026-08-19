/* WARNING: 本项目专属"粘人精"，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed, type Ref } from 'vue'
import { useVideoCall } from './useVideoCall'
import { useChatSummary } from './useChatSummary'

export function useChatRoomVideoCallUI(
  selectedChat: Ref<any>,
  myProfile: Ref<any>,
  isMultiSelectMode: Ref<boolean>,
  saveCustomContacts: () => void,
  scrollToBottom: () => Promise<void>,
  showToast: (msg: string) => void,
  triggerAPI: (callMode?: false | 'voice' | 'video') => void,
  handleStopCall: () => void
) {
  const { summarizeVideoCall, storeExternalMemory } = useChatSummary(selectedChat, saveCustomContacts, showToast)

  const storeCallMemory = async (callMessages: any[], summary: string, recordId: string | number) => {
    try {
      await storeExternalMemory(callMessages, summary, { callType: 'video', callRecordId: recordId })
    } catch (error) {
      console.warn('视频通话总结已保存，但长期记忆写入失败', error)
      showToast('视频总结已保存，但长期记忆写入失败')
    }
  }

  const {
    status: videoCallStatus,
    durationStr: videoDurationStr,
    currentVideoCallTempSummary,
    initiateCallDecision,
    endCall: handleVideoCallEndInner,
    resetCall,
    checkAndGenerateTempSummary,
    generateFinalCallSummary
  } = useVideoCall()

  const showVideoCallModal = ref(false)
  const isVideoCallMinimized = ref(false)
  const callStartIndex = ref(0)

  const isVideoCallPanelActive = computed(() => showVideoCallModal.value && !isVideoCallMinimized.value)

  const videoCallMessages = computed(() => {
    if (!selectedChat.value?.messages) return []
    return selectedChat.value.messages
      .slice(callStartIndex.value)
      .filter((m: any) => m.isVideoCallProcessMsg && !m.isHidden)
  })

  const startVideoCall = async () => {
    if (isMultiSelectMode.value) return
    showVideoCallModal.value = true
    callStartIndex.value = selectedChat.value?.messages?.length || 0

    const textMessages = (selectedChat.value?.messages || []).filter(
      (m: any) => !m.isVideoCallProcessMsg && !m.isVoiceCallProcessMsg
    )
    const decisionResult = await initiateCallDecision(selectedChat.value, myProfile.value, textMessages)

    if (decisionResult === 'abort') {
      return
    }

    if (decisionResult === 'reject') {
      showToast('对方拒绝了接听')
      setTimeout(() => {
        showVideoCallModal.value = false
        resetCall()

        if (selectedChat.value) {
          if (!selectedChat.value.messages) {
            selectedChat.value.messages = []
          }
          const rejectedRecordId = Date.now()
          selectedChat.value.messages.push({
            id: rejectedRecordId,
            type: 'right',
            content: '视频通话已拒绝',
            isCallRecord: true,
            duration: '对方已拒绝',
            callData: {
              status: 'canceled',
              duration: '已拒绝',
              direction: 'out',
              callType: 'video'
            }
          })
          selectedChat.value.messages.push({
            id: rejectedRecordId + 1,
            type: 'system',
            content: `${myProfile.value?.name || '用户'}给${selectedChat.value.name || '角色'}打来视频通话，${selectedChat.value.name || '角色'}没有接听。`,
            isHidden: true
          })
          saveCustomContacts()
          scrollToBottom()
        }
      }, 2000)
    } else if (decisionResult === 'accept') {
      if (selectedChat.value) {
        if (!selectedChat.value.messages) {
          selectedChat.value.messages = []
        }
        const charSpeaksFirst = !!selectedChat.value.charSpeaksFirstOnCall
        const charName = selectedChat.value.name || '角色'
        const userName = myProfile.value?.name || '用户'
        let notice = `视频已接通，${userName} 与 ${charName} 开始视频通话。接下来请使用符合视频交流的口语化表达，可以自然描述表情、视线和镜头内的动作，但不要使用网络聊天时的颜文字、表情包标签或动作描写括号。${charName} 的回复应该像真人在视频通话中一样自然、连贯。`
        if (charSpeaksFirst) {
          notice += `\n是 ${userName} 打给 ${charName} 的，${charName} 刚接起来，${userName} 还没说话，现在请 ${charName} 先开口说第一句。`
        }
        selectedChat.value.messages.push({
          id: Date.now(),
          type: 'system',
          content: notice,
          isHidden: true,
          isVideoCallProcessMsg: true
        })
        saveCustomContacts()
        scrollToBottom()
        if (charSpeaksFirst) triggerAPI('video')
      }
    }
  }

  const handleVideoCallTriggerAPI = () => triggerAPI('video')

  const handleVideoCallEnd = async () => {
    const duration = handleVideoCallEndInner()
    showVideoCallModal.value = false
    isVideoCallMinimized.value = false
    resetCall()

    handleStopCall()

    if (selectedChat.value) {
      if (!selectedChat.value.messages) {
        selectedChat.value.messages = []
      }

      const callMsgs = videoCallMessages.value

      if (callMsgs.length > 0) {
        const callMsgIds = new Set(callMsgs.map((m: any) => m.id))
        selectedChat.value.messages = selectedChat.value.messages.filter((m: any) => !callMsgIds.has(m.id))
      }

      const isCanceled = duration === '00:00'
      const recordContent = isCanceled ? '视频通话已取消' : `视频通话 ${duration}`
      const systemNoticeText = isCanceled ? '视频通话已取消。' : '视频通话已结束。'

      const callRecordMsgId = Date.now()
      selectedChat.value.messages.push({
        id: callRecordMsgId,
        type: 'right',
        content: recordContent,
        isCallRecord: true,
        duration: isCanceled ? '已取消' : duration,
        callData: {
          status: isCanceled ? 'canceled' : 'ended',
          duration: isCanceled ? '已取消' : duration,
          direction: 'out',
          callType: 'video'
        }
      })
      selectedChat.value.messages.push({
        id: Date.now() + 1,
        type: 'system',
        content: systemNoticeText,
        isHidden: true
      })

      let recordId: number | null = null
      if (callMsgs.length > 0) {
        showToast('正在生成视频通话总结...')
        recordId = Date.now() + 2
        if (!selectedChat.value.callSummaries) {
          selectedChat.value.callSummaries = []
        }
        const newRecord: any = {
          id: recordId,
          date: new Date().toLocaleDateString('zh-CN') + ' ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          duration: duration,
          direction: 'out',
          callType: 'video',
          content: '正在生成总结...',
          rawMessages: JSON.parse(JSON.stringify(callMsgs))
        }
        selectedChat.value.callSummaries.push(newRecord)
      }

      saveCustomContacts()
      await scrollToBottom()

      if (callMsgs.length > 0 && recordId) {
        try {
          const charName = selectedChat.value.name || 'AI'
          const userName = myProfile.value?.name || '用户'

          let summaryContent = await generateFinalCallSummary(callMsgs, charName, userName)

          if (!summaryContent) {
            summaryContent = await summarizeVideoCall(callMsgs, currentVideoCallTempSummary.value)
          }

          const record = selectedChat.value.callSummaries.find((r: any) => r.id === recordId)
          if (record) {
            if (summaryContent) {
              record.content = summaryContent
              await storeCallMemory(callMsgs, summaryContent, recordId)
              showToast('视频通话总结已生成')
            } else {
              record.content = '总结生成失败，您可在详情中重新总结'
              showToast('视频通话总结生成失败')
            }
            saveCustomContacts()
          }
        } catch (err: any) {
          console.error('视频总结生成过程抛出错误:', err)
          const record = selectedChat.value.callSummaries.find((r: any) => r.id === recordId)
          if (record) {
            record.content = '总结生成异常失败，您可在详情中重新总结'
            saveCustomContacts()
          }
          showToast('总结请求发生错误')
        }
      }
    }
  }

  const handleResummarizeVideoCall = async (recordId: string | number) => {
    if (!selectedChat.value?.callSummaries) return
    const record = selectedChat.value.callSummaries.find((r: any) => r.id === recordId)
    if (!record || !record.rawMessages || record.rawMessages.length === 0) {
      showToast('缺少原始通话记录，无法重新总结')
      return
    }
    showToast('正在重新生成视频通话总结...')
    record.content = '正在生成总结...'

    const summaryContent = await summarizeVideoCall(record.rawMessages)
    if (summaryContent) {
      record.content = summaryContent
      saveCustomContacts()
      showToast('视频通话总结已重新生成')
    } else {
      record.content = '总结生成失败，点击右下角按钮重新总结'
      saveCustomContacts()
      showToast('视频通话总结生成失败')
    }
  }

  const restoreVideoCall = () => {
    isVideoCallMinimized.value = false
  }

  const minimizeVideoCall = () => {
    isVideoCallMinimized.value = true
  }

  const checkUnfinishedVideoCalls = async () => {
    if (!selectedChat.value || !selectedChat.value.messages) return

    const msgs = selectedChat.value.messages
    let unfinishedCallStartIndex = -1

    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m.type === 'system' && m.isHidden) {
        if (m.content === '视频通话已结束。' || m.content === '视频通话已取消。' || m.content === '视频通话已异常中断。') {
          break
        }
        if (m.content.startsWith('视频已接通')) {
          unfinishedCallStartIndex = i
          break
        }
      }
    }

    if (unfinishedCallStartIndex !== -1) {
      const callMsgs = msgs.slice(unfinishedCallStartIndex).filter((m: any) => m.isVideoCallProcessMsg && !m.isHidden)

      if (callMsgs.length > 0) {
        const callMsgIds = new Set(callMsgs.map((m: any) => m.id))
        selectedChat.value.messages = selectedChat.value.messages.filter((m: any) => !callMsgIds.has(m.id))
      }

      const callRecordMsgId = Date.now()
      selectedChat.value.messages.push({
        id: callRecordMsgId,
        type: 'right',
        content: '视频通话已异常中断',
        isCallRecord: true,
        duration: '异常中断',
        callData: {
          status: 'ended',
          duration: '异常中断',
          callType: 'video'
        }
      })

      selectedChat.value.messages.push({
        id: Date.now() + 1,
        type: 'system',
        content: '视频通话已异常中断。',
        isHidden: true
      })

      let recordId: number | null = null
      if (callMsgs.length > 0) {
        recordId = Date.now() + 2
        if (!selectedChat.value.callSummaries) {
          selectedChat.value.callSummaries = []
        }
        const newRecord: any = {
          id: recordId,
          date: new Date().toLocaleDateString('zh-CN') + ' ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          duration: '异常中断',
          callType: 'video',
          content: '正在生成总结...',
          rawMessages: JSON.parse(JSON.stringify(callMsgs))
        }
        selectedChat.value.callSummaries.push(newRecord)
      }

      saveCustomContacts()
      await scrollToBottom()

      if (callMsgs.length > 0 && recordId) {
        try {
          const summaryContent = await summarizeVideoCall(callMsgs, currentVideoCallTempSummary.value)
          const record = selectedChat.value.callSummaries.find((r: any) => r.id === recordId)
          if (record) {
            record.content = summaryContent || '总结生成失败，您可在详情中重新总结'
            if (summaryContent) await storeCallMemory(callMsgs, summaryContent, recordId)
            saveCustomContacts()
          }
        } catch {
          const record = selectedChat.value.callSummaries.find((r: any) => r.id === recordId)
          if (record) {
            record.content = '总结生成异常失败，您可在详情中重新总结'
            saveCustomContacts()
          }
        }
      }
    }
  }

  return {
    showVideoCallModal,
    isVideoCallMinimized,
    videoCallStatus,
    videoDurationStr,
    currentVideoCallTempSummary,
    isVideoCallPanelActive,
    videoCallMessages,
    startVideoCall,
    restoreVideoCall,
    minimizeVideoCall,
    handleVideoCallTriggerAPI,
    handleVideoCallEnd,
    handleResummarizeVideoCall,
    checkUnfinishedVideoCalls,
    checkAndGenerateVideoTempSummary: checkAndGenerateTempSummary
  }
}
