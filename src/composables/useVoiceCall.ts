/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import { sendChatMessage } from '../services/api'
import { buildMemoryPacket } from '../services/memoryEngine'

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended'

// 长通话的临时总结放在模块作用域：组装通话提示词时 useChatState 会另开一个实例来读它，
// 如果挂在实例上，那边永远只能读到一个空的新 ref
const currentCallTempSummary = ref<string | null>(null)
let lastSummarizedIndex = 0

export function useVoiceCall() {
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

  // 角色主动来电：不需要走接听决策，角色已经决定拨打了，这里只负责响铃与超时未接
  const receiveIncomingCall = (onTimeout: () => void, timeoutMs: number) => {
    clearRingTimer()
    status.value = 'incoming'
    ringTimer = setTimeout(() => {
      ringTimer = null
      onTimeout()
    }, timeoutMs)
  }

  const acceptIncomingCall = () => {
    clearRingTimer()
    status.value = 'connected'
    startTimer()
  }

  // 发起呼叫决策请求
  const initiateCallDecision = async (chat: any, myProfile: any, currentMessages: any[]) => {
    status.value = 'calling'
    
    const charName = chat.name || 'AI'
    const userName = myProfile.name || '用户'
    const charPersona = chat.persona || '无设定'
    const userPersona = myProfile.persona || '无设定'
    let longTermMemory = '无'
    
    // 提取短期记忆 (这里需要按照普通文字聊天的规则进行过滤和截取，以防止带入太多冗余或者通话明细)
    // 1. 过滤掉通话内消息
    let textMessages = currentMessages.filter(m => !m.isVoiceCallProcessMsg && !m.isHidden && !m.isRecalled)
    
    // 2. 截取最近的 N 条（使用用户设置里的 memoryValue 或者默认 15 条）
    let contextSize = 15
    const globalChatSettingsStr = localStorage.getItem('clingy_chat_settings')
    if (globalChatSettingsStr) {
      try {
        JSON.parse(globalChatSettingsStr) // 验证 JSON 合法性，但不强制使用
        // 回退兼容：如果开启了全局覆盖限制，且有值，则用它
        if (chat.memoryType === 'count' && chat.memoryValue > 0) {
           contextSize = chat.memoryValue
        }
      } catch(e) {}
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
    longTermMemory = (await buildMemoryPacket(chat, shortTermMemory, chat.memoryTokenBudget)) || '无'

    // 重写系统提示词，移除所有主观情绪预设，全量塞入客观背景
    const systemPrompt = `[系统指令]
判断角色${charName}是否会接听用户${userName}此刻发起的语音通话。只进行这次选择，不续写对话，也不输出解释或表情符号。

【角色】：${charName}
【角色设定】：${charPersona}

【用户】：${userName}
【用户资料】：${userPersona}

【长期记忆】：
${longTermMemory}

【短期聊天记录】：
${shortTermMemory}`

    const userPrompt = `[当前事件]
${userName} 正在向 ${charName} 发起实时语音通话请求。
请完全根据上述 ${charName} 的设定、${userName} 的设定，以及最近的聊天记录上下文，自主判断 ${charName} 现在是否接听这个电话。

[输出格式要求]
请且仅请输出一段合法的 JSON，不要附带任何其他字符。
- 接听：返回 {"decision": "accept"}
- 挂断：返回 {"decision": "reject"}`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    decisionAbortController = new AbortController()

    try {
      // 彻底接入官方封装的 sendChatMessage，不再用原生 fetch
      const result = await sendChatMessage(messages, decisionAbortController.signal, false, false)
      
      let content = ''
      if (typeof result === 'string') {
        content = result
      } else {
        content = result.content || ''
      }
      
      console.groupCollapsed('[语音通话决策]')
      console.log('1. System Prompt:\n', systemPrompt)
      console.log('2. User Prompt:\n', userPrompt)
      console.log('3. AI 原始返回文本:\n', content)
      
      // 默认改为挂断 (reject)，除非明确解析到 accept
      let decision = 'reject' 
      
      if (!content || content.trim() === '') {
        console.warn('AI 返回内容为空，已默认挂断。')
      } else {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0])
            if (parsed.decision === 'accept') {
              decision = 'accept'
            }
          } catch (err) {
            console.warn('JSON 解析失败，尝试暴力正则判断。', err)
            if (content.toLowerCase().includes('accept')) {
              decision = 'accept'
            }
          }
        } else {
          // 如果没有大括号，直接查字符串
          if (content.toLowerCase().includes('accept') && !content.toLowerCase().includes('reject')) {
            decision = 'accept'
          }
        }
      }

      console.log('4. 最终解析出的决策:', decision)
      console.groupEnd()

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
         console.log('[语音通话决策] 用户主动取消了呼叫。')
         status.value = 'ended'
         return 'abort'
      }
      console.error('[语音通话决策] 请求失败，默认挂断:', e)
      status.value = 'ended'
      // 把真实错误抛出去，让外面如果有 toast 能弹出来
      throw new Error(`通话决策请求失败: ${e.message}`)
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
    currentCallTempSummary.value = null
    lastSummarizedIndex = 0
  }

  // 检查是否需要临时总结 (例如每超过 N 条总结一次)
  const checkAndGenerateTempSummary = async (callMessages: any[]) => {
    let threshold = 50
    const globalChatSettingsStr = localStorage.getItem('clingy_chat_settings')
    if (globalChatSettingsStr) {
      try {
        const settings = JSON.parse(globalChatSettingsStr)
        if (settings.voiceSummaryThreshold && settings.voiceSummaryThreshold > 0) {
           threshold = settings.voiceSummaryThreshold
        }
      } catch(e) {}
    }

    const unsummarizedMsgs = callMessages.slice(lastSummarizedIndex)
    
    if (unsummarizedMsgs.length >= threshold) {
      const msgsToSummarize = unsummarizedMsgs.slice(0, threshold)
      const messagesPayload = msgsToSummarize.map(m => {
        let prefix = m.type === 'left' ? 'AI: ' : '用户: '
        if (m.type === 'system') prefix = '系统: '
        return `${prefix}${m.content}`
      }).join('\n')

      let prompt = `【语音通话阶段提要】
将以下通话记录整理成简明提要：
要求：
1. 提炼出关键讨论点和当前进展。
2. 必须以第三人称客观视角书写。
3. 字数控制在50-150字以内。`

      // 如果之前已经有总结了，带上之前的总结一起迭代
      if (currentCallTempSummary.value) {
         prompt += `\n\n【之前的提要】：\n${currentCallTempSummary.value}`
         prompt += `\n\n请将上述【之前的提要】与以下【新的聊天记录】融合，生成一个新的整体提要。`
      }

      prompt += `\n\n【新的聊天记录】：\n${messagesPayload}`

      try {
        const result = await sendChatMessage([{ role: 'user', content: prompt }], undefined, true, true) // 使用 true, true 可能是后台静默
        let summaryContent = ''
        if (typeof result === 'string') {
          summaryContent = result
        } else {
          summaryContent = result.content
        }

        summaryContent = summaryContent.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim() || summaryContent
        if (summaryContent) {
           currentCallTempSummary.value = summaryContent
           lastSummarizedIndex += threshold
           console.log('[语音通话] 临时总结已更新:', currentCallTempSummary.value)
        }
      } catch (e) {
        console.error('[语音通话] 生成临时总结失败', e)
      }
    }
  }

  // 生成最终总结档案 (用于挂断后存入长记/通话记录)
  const generateFinalCallSummary = async (callMessages: any[], charName: string, userName: string) => {
    // 提取所有还未被总结的剩余消息
    const remainingMsgs = callMessages.slice(lastSummarizedIndex)
    let remainingPayload = remainingMsgs.map(m => {
      let prefix = m.type === 'left' ? `${charName}: ` : `${userName}: `
      if (m.type === 'system') prefix = '系统: '
      return `${prefix}${m.content}`
    }).join('\n')
    
    // 如果没有任何通话记录，且没有临时总结，则不需要生成
    if (!currentCallTempSummary.value && remainingMsgs.length === 0) {
      return null
    }

    let prompt = `【完整语音通话档案】
根据【前半段通话提要】（如有）与【通话结尾的对话明细】，生成本次完整通话的第三人称档案总结。该总结将存入长期记忆。

要求：
1. 以第三人称客观视角书写（例如：${charName}和${userName}讨论了...）。
2. 提炼出本次通话的核心事件、作出的决定以及双方的情绪状态。
3. 语言精炼，作为档案记录，字数控制在100-300字以内。`

    if (currentCallTempSummary.value) {
      prompt += `\n\n【前半段通话提要】：\n${currentCallTempSummary.value}`
    }
    
    if (remainingPayload) {
      prompt += `\n\n【通话结尾的对话明细】：\n${remainingPayload}`
    } else {
      prompt += `\n\n【通话结尾的对话明细】：(无额外对话，直接挂断)`
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
      console.log('[语音通话] 最终通话档案生成成功:', summaryContent)
      return summaryContent
    } catch (e) {
      console.error('[语音通话] 生成最终总结失败', e)
      return null
    }
  }

  return {
    status,
    durationStr,
    currentCallTempSummary,
    lastSummarizedIndex,
    initiateCallDecision,
    receiveIncomingCall,
    acceptIncomingCall,
    abortDecision,
    endCall,
    resetCall,
    checkAndGenerateTempSummary,
    generateFinalCallSummary
  }
}
