/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed, type Ref } from 'vue'
import { useVoiceCall } from './useVoiceCall'
import { useChatSummary } from './useChatSummary'
import { appendMissedIncomingCall, appendBusyLineNotice, buildIncomingCallAcceptedNotice, type MissedCallKind } from './useCallRecords'

export function useChatRoomVoiceCallUI(
  selectedChat: Ref<any>,
  myProfile: Ref<any>,
  isMultiSelectMode: Ref<boolean>,
  saveCustomContacts: () => void,
  scrollToBottom: () => Promise<void>,
  showToast: (msg: string) => void,
  triggerAPI: (callMode?: false | 'voice' | 'video') => void,
  handleStopCall: () => void
) {
  const { summarizeVoiceCall } = useChatSummary(selectedChat, saveCustomContacts, showToast)

  const { 
    status: callStatus, 
    durationStr, 
    currentCallTempSummary,
    initiateCallDecision, 
    receiveIncomingCall,
    acceptIncomingCall,
    endCall: handleVoiceCallEndInner, 
    resetCall, 
    checkAndGenerateTempSummary,
    generateFinalCallSummary 
  } = useVoiceCall()

  const showVoiceCallModal = ref(false)
  const isVoiceCallMinimized = ref(false)
  const callStartIndex = ref(0)
  const isCurrentCallIncoming = ref(false)
  const incomingCallReason = ref('')

  const isCallPanelActive = computed(() => showVoiceCallModal.value && !isVoiceCallMinimized.value)

  const voiceCallMessages = computed(() => {
    if (!selectedChat.value?.messages) return []
    return selectedChat.value.messages
      .slice(callStartIndex.value)
      .filter((m: any) => m.isVoiceCallProcessMsg && !m.isHidden)
  })

  const voiceCallStatePayload = computed(() => ({
    active: showVoiceCallModal.value,
    minimized: isVoiceCallMinimized.value,
    status: callStatus.value,
    durationStr: durationStr.value,
    charName: selectedChat.value?.name || '未知联系人',
    charAvatar: selectedChat.value?.avatarUrl || '',
    chatId: selectedChat.value?.id
  }))

  const restoreVoiceCall = () => {
    isVoiceCallMinimized.value = false
  }

  const minimizeVoiceCall = () => {
    isVoiceCallMinimized.value = true
  }

  const handleVoiceCallTriggerAPI = () => triggerAPI('voice')

  const startVoiceCall = async () => {
    if (isMultiSelectMode.value) return
    showVoiceCallModal.value = true
    isVoiceCallMinimized.value = false
    isCurrentCallIncoming.value = false
    callStartIndex.value = selectedChat.value?.messages?.length || 0
    
    const textMessages = (selectedChat.value?.messages || []).filter((m: any) => !m.isVoiceCallProcessMsg)
    const decisionResult = await initiateCallDecision(selectedChat.value, myProfile.value, textMessages)
    
    if (decisionResult === 'abort') {
      return
    }
    
    if (decisionResult === 'reject') {
      showToast('对方拒绝了接听')
      setTimeout(() => {
        showVoiceCallModal.value = false
        resetCall()
        
        if (selectedChat.value) {
          if (!selectedChat.value.messages) {
            selectedChat.value.messages = []
          }
          const rejectedRecordId = Date.now()
          selectedChat.value.messages.push({
            id: rejectedRecordId,
            type: 'right',
            content: `通话已拒绝`,
            isCallRecord: true,
            duration: '对方已拒绝',
            callData: {
              status: 'canceled',
              duration: '已拒绝',
              direction: 'out',
              callType: 'voice'
            }
          })
          selectedChat.value.messages.push({
            id: rejectedRecordId + 1,
            type: 'system',
            content: `${myProfile.value?.name || '对方'}给你打来语音电话，你没有接听。`,
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
        let notice = `电话已接通，${userName} 与 ${charName} 开始语音通话。接下来请使用符合电话交流的口语化表达，不要使用网络聊天时的颜文字、表情包或动作描写。${charName} 的回复应该像真人通电话一样自然、连贯。`
        if (charSpeaksFirst) {
          notice += `\n是 ${userName} 打给 ${charName} 的，${charName} 刚接起来，${userName} 还没说话，现在请 ${charName} 先开口说第一句。`
        }
        selectedChat.value.messages.push({
          id: Date.now(),
          type: 'system',
          content: notice,
          isHidden: true,
          isVoiceCallProcessMsg: true
        })
        saveCustomContacts()
        scrollToBottom()
        if (charSpeaksFirst) handleVoiceCallTriggerAPI()
      }
    }
  }

  let resumeAfterIncomingCall: (() => void) | null = null
  let isIncomingCallSettled = true

  const resumeActionQueue = () => {
    const resume = resumeAfterIncomingCall
    resumeAfterIncomingCall = null
    if (resume) resume()
  }

  const handleIncomingCall = (reason: string, resume: () => void, ringSeconds: number) => {
    if (showVoiceCallModal.value) {
      if (selectedChat.value) {
        appendBusyLineNotice(selectedChat.value, myProfile.value?.name || '对方', reason)
        saveCustomContacts()
      }
      resume()
      return
    }

    incomingCallReason.value = reason
    resumeAfterIncomingCall = resume
    isIncomingCallSettled = false
    showVoiceCallModal.value = true
    isVoiceCallMinimized.value = false
    callStartIndex.value = selectedChat.value?.messages?.length || 0

    receiveIncomingCall(() => handleIncomingCallMissed('timeout'), ringSeconds * 1000)
  }

  const handleIncomingCallMissed = async (kind: MissedCallKind) => {
    if (isIncomingCallSettled) return
    isIncomingCallSettled = true

    showVoiceCallModal.value = false
    isVoiceCallMinimized.value = false
    resetCall()

    if (selectedChat.value) {
      appendMissedIncomingCall(selectedChat.value, myProfile.value?.name || '对方', incomingCallReason.value, kind)
      saveCustomContacts()
      await scrollToBottom()
    }

    showToast(kind === 'declined' ? '已拒接' : '未接来电')
    resumeActionQueue()
  }

  const handleIncomingCallAccept = async () => {
    if (isIncomingCallSettled) return
    isIncomingCallSettled = true

    acceptIncomingCall()
    isCurrentCallIncoming.value = true
    callStartIndex.value = selectedChat.value?.messages?.length || 0

    const charSpeaksFirst = !!selectedChat.value?.charSpeaksFirstOnCall

    if (selectedChat.value) {
      if (!selectedChat.value.messages) {
        selectedChat.value.messages = []
      }
      selectedChat.value.messages.push({
        id: Date.now(),
        type: 'system',
        content: buildIncomingCallAcceptedNotice(selectedChat.value?.name || '角色', myProfile.value?.name || '用户', incomingCallReason.value, charSpeaksFirst),
        isHidden: true,
        isVoiceCallProcessMsg: true
      })
      saveCustomContacts()
      await scrollToBottom()
      if (charSpeaksFirst) handleVoiceCallTriggerAPI()
    }
  }

  const handleVoiceCallEnd = async () => {
    if (callStatus.value === 'incoming') {
      await handleIncomingCallMissed('declined')
      return
    }

    const duration = handleVoiceCallEndInner()
    showVoiceCallModal.value = false
    isVoiceCallMinimized.value = false
    resetCall()
    
    handleStopCall()
    
    if (selectedChat.value) {
      if (!selectedChat.value.messages) {
        selectedChat.value.messages = []
      }

      const callMsgs = voiceCallMessages.value
      
      if (callMsgs.length > 0) {
        const callMsgIds = new Set(callMsgs.map((m: any) => m.id))
        selectedChat.value.messages = selectedChat.value.messages.filter((m: any) => !callMsgIds.has(m.id))
      }

      const isCanceled = duration === '00:00'
      const recordContent = isCanceled ? '通话已取消' : `通话时长 ${duration}`
      const systemNoticeText = isCanceled ? '通话已取消。' : '通话已结束。'

      const callRecordMsgId = Date.now()
      const callDirection = isCurrentCallIncoming.value ? 'in' : 'out'
      selectedChat.value.messages.push({
        id: callRecordMsgId,
        type: isCurrentCallIncoming.value ? 'left' : 'right',
        content: recordContent,
        isCallRecord: true,
        duration: isCanceled ? '已取消' : duration,
        callData: {
          status: isCanceled ? 'canceled' : 'ended',
          duration: isCanceled ? '已取消' : duration,
          direction: callDirection,
          callType: 'voice'
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
        showToast('正在生成通话总结...')
        recordId = Date.now() + 2
        if (!selectedChat.value.callSummaries) {
          selectedChat.value.callSummaries = []
        }
        const newRecord: any = {
          id: recordId,
          date: new Date().toLocaleDateString('zh-CN') + ' ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          duration: duration,
          direction: callDirection,
          callType: 'voice',
          content: '正在生成总结...',
          rawMessages: JSON.parse(JSON.stringify(callMsgs))
        }
        selectedChat.value.callSummaries.push(newRecord)
      }

      isCurrentCallIncoming.value = false

      saveCustomContacts()
      await scrollToBottom()

      resumeActionQueue()

      if (callMsgs.length > 0 && recordId) {
        try {
          const charName = selectedChat.value.name || 'AI'
          const userName = myProfile.value?.name || '用户'
          
          let summaryContent = await generateFinalCallSummary(callMsgs, charName, userName)
          
          if (!summaryContent) {
            summaryContent = await summarizeVoiceCall(callMsgs, currentCallTempSummary.value)
          }

          const record = selectedChat.value.callSummaries.find((r: any) => r.id === recordId)
          if (record) {
            if (summaryContent) {
              record.content = summaryContent
              showToast('通话总结已生成')
            } else {
              record.content = '总结生成失败，您可在详情中重新总结'
              showToast('通话总结生成失败')
            }
            saveCustomContacts()
          }
        } catch (err: any) {
          console.error('总结生成过程抛出错误:', err)
          const record = selectedChat.value.callSummaries.find((r: any) => r.id === recordId)
          if (record) {
            record.content = '总结生成异常失败，您可在详情中重新总结'
            saveCustomContacts()
          }
          showToast('总结请求发生错误')
        }
      }
    }

    resumeActionQueue()
  }

  const handleResummarizeVoiceCall = async (recordId: string | number) => {
    if (!selectedChat.value?.callSummaries) return
    const record = selectedChat.value.callSummaries.find((r: any) => r.id === recordId)
    if (!record || !record.rawMessages || record.rawMessages.length === 0) {
      showToast('缺少原始通话记录，无法重新总结')
      return
    }
    showToast('正在重新生成通话总结...')
    record.content = '正在生成总结...'
    
    const summaryContent = await summarizeVoiceCall(record.rawMessages)
    if (summaryContent) {
      record.content = summaryContent
      saveCustomContacts()
      showToast('通话总结已重新生成')
    } else {
      record.content = '总结生成失败，点击右下角按钮重新总结'
      saveCustomContacts()
      showToast('通话总结生成失败')
    }
  }

  const checkUnfinishedCalls = async () => {
    if (!selectedChat.value || !selectedChat.value.messages) return
    
    const msgs = selectedChat.value.messages
    let unfinishedCallStartIndex = -1
    
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m.type === 'system' && m.isHidden) {
        if (m.content === '通话已结束。' || m.content === '通话已取消。' || m.content === '通话已异常中断。') {
          break
        }
        if (m.content.startsWith('电话已接通，双方开始语音通话')) {
          unfinishedCallStartIndex = i
          break
        }
      }
    }

    if (unfinishedCallStartIndex !== -1) {
      const callMsgs = msgs.slice(unfinishedCallStartIndex).filter((m: any) => m.isVoiceCallProcessMsg && !m.isHidden)
      
      if (callMsgs.length > 0) {
        const callMsgIds = new Set(callMsgs.map((m: any) => m.id))
        selectedChat.value.messages = selectedChat.value.messages.filter((m: any) => !callMsgIds.has(m.id))
      }

      const callRecordMsgId = Date.now()
      selectedChat.value.messages.push({
        id: callRecordMsgId,
        type: 'right',
        content: '通话已异常中断',
        isCallRecord: true,
        duration: '异常中断',
        callData: {
          status: 'ended',
          duration: '异常中断',
          callType: 'voice'
        }
      })

      selectedChat.value.messages.push({
        id: Date.now() + 1,
        type: 'system',
        content: '通话已异常中断。',
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
          callType: 'voice',
          content: '正在生成总结...',
          rawMessages: JSON.parse(JSON.stringify(callMsgs))
        }
        selectedChat.value.callSummaries.push(newRecord)
      }

      saveCustomContacts()
      await scrollToBottom()

      if (callMsgs.length > 0 && recordId) {
        try {
          const summaryContent = await summarizeVoiceCall(callMsgs, currentCallTempSummary.value)
          const record = selectedChat.value.callSummaries.find((r: any) => r.id === recordId)
          if (record) {
            if (summaryContent) {
              record.content = summaryContent
            } else {
              record.content = '总结生成失败，您可在详情中重新总结'
            }
            saveCustomContacts()
          }
        } catch (err: any) {
          console.error('总结生成过程抛出错误:', err)
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
    showVoiceCallModal,
    isVoiceCallMinimized,
    callStatus,
    durationStr,
    currentCallTempSummary,
    isCallPanelActive,
    voiceCallMessages,
    voiceCallStatePayload,
    startVoiceCall,
    restoreVoiceCall,
    minimizeVoiceCall,
    handleVoiceCallTriggerAPI,
    handleIncomingCall,
    handleIncomingCallMissed,
    handleIncomingCallAccept,
    handleVoiceCallEnd,
    handleResummarizeVoiceCall,
    checkUnfinishedCalls,
    checkAndGenerateTempSummary
  }
}
