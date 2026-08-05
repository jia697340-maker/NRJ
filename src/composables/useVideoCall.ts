/* WARNING: 本项目专属"粘人精"，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import { sendChatMessage } from '../services/api'
import { taskPromptSettings } from '../store'

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended'

// 长视频通话的临时总结放在模块作用域
const currentVideoCallTempSummary = ref<string | null>(null)
let lastVideoSummarizedIndex = 0

export function useVideoCall() {
  const status = ref<CallStatus>('idle')
  const startTime = ref<number>(0)
  const durationStr = ref<string>('00:00')
  let timer: any = null
  let ringTimer: any = null
  let decisionAbortController: AbortController | null = null

  const startTimer = () => {
    startTime.value = Date.now()
    timer = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime.value) / 1000)
      const m = String(Math.floor(diff / 60)).padStart(2, '0')
      const s = String(diff % 60).padStart(2, '0')
      durationStr.value = `${m}:${s}`
    }, 1000)
  }

  const stopTimer = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  const clearRingTimer = () => {
    if (ringTimer) {
      clearTimeout(ringTimer)
      ringTimer = null
    }
  }

  const initiateCallDecision = async (chat: any, myProfile: any, currentMessages: any[]) => {
    status.value = 'calling'

    const charName = chat.name || 'AI'
    const userName = myProfile.name || '用户'
    const charPersona = chat.persona || '无设定'
    const userPersona = myProfile.persona || '无设定'
    const longTermMemory = chat.longTermMemory || '无'

    let textMessages = currentMessages.filter(m => !m.isVideoCallProcessMsg && !m.isVoiceCallProcessMsg && !m.isHidden && !m.isRecalled)

    let contextSize = 15
    if (chat.memoryType === 'count' && chat.memoryValue > 0) {
      contextSize = chat.memoryValue
    }
    textMessages = textMessages.slice(-contextSize)

    const shortTermMemory = textMessages.map(m => {
      const sender = m.type === 'left' ? charName : (m.type === 'right' ? userName : 'System')
      let content = m.content
      if (m.isEmoji) {
        content = m.emojiSummary ? `[发来表情包：${m.emojiSummary}]` : `[发送了表情包]`
      } else if (m.voiceData) {
        content = `[发送了语音，内容：${m.voiceData.text}]`
      } else if (m.imageData) {
        content = m.imageData.summary ? `[发送了图片：${m.imageData.summary}]` : `[发送了图片]`
      } else if (m.isCallRecord) {
        content = `[系统记录：${m.content}]`
      }
      return `${sender}: ${content}`
    }).join('\n')

    // 从配置中获取提示词，如果未启用或找不到，则使用回退的硬编码提示词
    const systemItem = taskPromptSettings.items.find(i => i.id === 'task_video_call_decision_system')
    const userItem = taskPromptSettings.items.find(i => i.id === 'task_video_call_decision_user')

    let systemPrompt = ''
    if (systemItem && systemItem.enabled) {
      systemPrompt = systemItem.content
        .replace(/\{\{char_name\}\}/g, charName)
        .replace(/\{\{char_persona\}\}/g, charPersona)
        .replace(/\{\{user_name\}\}/g, userName)
        .replace(/\{\{user_persona\}\}/g, userPersona)
        .replace(/\{\{long_term_memory\}\}/g, longTermMemory)
        .replace(/\{\{short_term_memory\}\}/g, shortTermMemory)
    } else {
      systemPrompt = `[系统指令]
你现在需要扮演【${charName}】，正在处理一个是否接听视频通话的决策。
这仅仅是一个简单的分类判定任务，请不要输出多余的解释、对话或表情符号。

【你的名字】：${charName}
【你的设定】：${charPersona}

【对方的名字】：${userName}
【对方的设定】：${userPersona}

【长期记忆】：
${longTermMemory}

【短期聊天记录】：
${shortTermMemory}`
    }

    let userPrompt = ''
    if (userItem && userItem.enabled) {
      userPrompt = userItem.content
        .replace(/\{\{char_name\}\}/g, charName)
        .replace(/\{\{char_persona\}\}/g, charPersona)
        .replace(/\{\{user_name\}\}/g, userName)
        .replace(/\{\{user_persona\}\}/g, userPersona)
    } else {
      userPrompt = `[当前事件]
${userName} 正在向 ${charName} 发起实时通话请求。
请完全根据上述 ${charName} 的设定、${userName} 的设定，以及最近的聊天记录上下文，自主判断 ${charName} 现在是否接听这个通话。

[输出格式要求]
请且仅请输出一段合法的 JSON，不要附带任何其他字符。
- 接听：返回 {"decision": "accept"}
- 挂断：返回 {"decision": "reject"}`
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    decisionAbortController = new AbortController()

    try {
      const result = await sendChatMessage(messages, decisionAbortController.signal, false, false)

      let content = ''
      if (typeof result === 'string') {
        content = result
      } else {
        content = result.content || ''
      }

      let decision = 'reject'

      if (content && content.trim() !== '') {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0])
            if (parsed.decision === 'accept') {
              decision = 'accept'
            }
          } catch {
            if (content.toLowerCase().includes('accept')) {
              decision = 'accept'
            }
          }
        } else if (content.toLowerCase().includes('accept') && !content.toLowerCase().includes('reject')) {
          decision = 'accept'
        }
      }

      if (decision === 'reject') {
        status.value = 'ended'
        return 'reject'
      } else {
        status.value = 'connected'
        startTimer()
        return 'accept'
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || (e.message && e.message.includes('abort'))) {
        status.value = 'ended'
        return 'abort'
      }
      status.value = 'ended'
      throw new Error(`视频通话决策请求失败: ${e.message}`)
    } finally {
      decisionAbortController = null
    }
  }

  const abortDecision = () => {
    if (decisionAbortController) {
      decisionAbortController.abort()
      decisionAbortController = null
    }
  }

  const endCall = () => {
    stopTimer()
    clearRingTimer()
    abortDecision()
    status.value = 'ended'
    return durationStr.value
  }

  const resetCall = () => {
    stopTimer()
    clearRingTimer()
    status.value = 'idle'
    durationStr.value = '00:00'
    currentVideoCallTempSummary.value = null
    lastVideoSummarizedIndex = 0
  }

  const checkAndGenerateTempSummary = async (callMessages: any[]) => {
    let threshold = 50
    const globalChatSettingsStr = localStorage.getItem('clingy_chat_settings')
    if (globalChatSettingsStr) {
      try {
        const settings = JSON.parse(globalChatSettingsStr)
        if (settings.videoSummaryThreshold && settings.videoSummaryThreshold > 0) {
          threshold = settings.videoSummaryThreshold
        }
      } catch (e) {}
    }

    const unsummarizedMsgs = callMessages.slice(lastVideoSummarizedIndex)

    if (unsummarizedMsgs.length >= threshold) {
      const msgsToSummarize = unsummarizedMsgs.slice(0, threshold)
      const messagesPayload = msgsToSummarize.map(m => {
        let prefix = m.type === 'left' ? 'AI: ' : '用户: '
        if (m.type === 'system') prefix = '系统: '
        return `${prefix}${m.content}`
      }).join('\n')

      let prompt = ''
      const tempSummaryItem = taskPromptSettings.items.find(i => i.id === 'task_video_call_temp_summary')
      
      let previousSummaryText = ''
      if (currentVideoCallTempSummary.value) {
        previousSummaryText = `【之前的提要】：\n${currentVideoCallTempSummary.value}\n\n请将上述【之前的提要】与以下【新的聊天记录】融合，生成一个新的整体提要。`
      }

      if (tempSummaryItem && tempSummaryItem.enabled) {
        prompt = tempSummaryItem.content
          .replace(/\{\{optional_previous_summary\}\}/g, previousSummaryText)
          .replace(/\{\{new_messages\}\}/g, messagesPayload)
      } else {
        prompt = `请你作为一个总结助手，对以下这部分通话记录进行简明扼要的提要总结。
要求：
1. 提炼出关键讨论点和当前进展。
2. 必须以第三人称客观视角书写。
3. 字数控制在50-150字以内。`

        if (previousSummaryText) {
          prompt += `\n\n${previousSummaryText}`
        }

        prompt += `\n\n【新的聊天记录】：\n${messagesPayload}`
      }

      try {
        const result = await sendChatMessage([{ role: 'user', content: prompt }], undefined, true, true)
        let summaryContent = ''
        if (typeof result === 'string') {
          summaryContent = result
        } else {
          summaryContent = result.content
        }

        summaryContent = summaryContent.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim() || summaryContent
        if (summaryContent) {
          currentVideoCallTempSummary.value = summaryContent
          lastVideoSummarizedIndex += threshold
        }
      } catch (e) {
        console.error('[视频通话] 生成临时总结失败', e)
      }
    }
  }

  const generateFinalCallSummary = async (callMessages: any[], charName: string, userName: string) => {
    const remainingMsgs = callMessages.slice(lastVideoSummarizedIndex)
    const remainingPayload = remainingMsgs.map(m => {
      let prefix = m.type === 'left' ? `${charName}: ` : `${userName}: `
      if (m.type === 'system') prefix = '系统: '
      return `${prefix}${m.content}`
    }).join('\n')

    if (!currentVideoCallTempSummary.value && remainingMsgs.length === 0) {
      return null
    }

    let prompt = ''
    const finalSummaryItem = taskPromptSettings.items.find(i => i.id === 'task_video_call_final_summary')

    let previousSummaryText = ''
    if (currentVideoCallTempSummary.value) {
      previousSummaryText = `【前半段通话提要】：\n${currentVideoCallTempSummary.value}`
    }

    let remainingText = remainingPayload 
      ? `【通话结尾的对话明细】：\n${remainingPayload}` 
      : `【通话结尾的对话明细】：(无额外对话，直接挂断)`

    if (finalSummaryItem && finalSummaryItem.enabled) {
      prompt = finalSummaryItem.content
        .replace(/\{\{char_name\}\}/g, charName)
        .replace(/\{\{user_name\}\}/g, userName)
        .replace(/\{\{optional_previous_summary\}\}/g, previousSummaryText)
        .replace(/\{\{remaining_messages\}\}/g, remainingText)
    } else {
      prompt = `你是一个专业的对话总结助手。刚刚完成了一段通话，请根据提供的【前半段通话提要】(如果有) 以及【通话结尾的对话明细】，为本次完整的通话生成一份第三人称的档案总结。
这份总结将被存入长期记忆库中。

要求：
1. 以第三人称客观视角书写（例如：${charName}和${userName}通过通话讨论了...）。
2. 提炼出本次通话的核心事件、作出的决定以及双方的情绪状态。
3. 语言精炼，作为档案记录，字数控制在100-300字以内。`

      if (previousSummaryText) {
        prompt += `\n\n${previousSummaryText}`
      }
      prompt += `\n\n${remainingText}`
    }

    try {
      const result = await sendChatMessage([{ role: 'user', content: prompt }], undefined, true, true)
      let summaryContent = ''
      if (typeof result === 'string') {
        summaryContent = result
      } else {
        summaryContent = result.content
      }

      summaryContent = summaryContent.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim() || summaryContent
      return summaryContent
    } catch (e) {
      console.error('[视频通话] 生成最终总结失败', e)
      return null
    }
  }

  return {
    status,
    durationStr,
    currentVideoCallTempSummary,
    lastVideoSummarizedIndex,
    initiateCallDecision,
    abortDecision,
    endCall,
    resetCall,
    checkAndGenerateTempSummary,
    generateFinalCallSummary
  }
}
