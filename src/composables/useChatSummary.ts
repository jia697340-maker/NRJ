/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import { sendChatMessage } from '../services/api'
import {
  applyMemoryExtraction,
  buildExtractionPrompt,
  ensureMemoryState,
  estimateMessageTokens,
  detectTopicBoundary,
  getUncoveredMessages,
  indexChatMemories,
  parseMemoryExtraction,
  type MemoryMode
} from '../services/memoryEngine'

export function useChatSummary(selectedChat: any, saveCustomContacts: () => void, showToast: (msg: string) => void) {
  const isSummarizing = ref(false)
  const summaryModalVisible = ref(false)

  const consolidateNarrativeHierarchy = async (chat: any) => {
    if (chat.autoMemoryConsolidation === false) return
    const threshold = Math.max(4, Math.min(20, Number(chat.memoryConsolidationThreshold || 8)))
    const candidates = (chat.memoryBook || []).filter((item: any) => item.enabled !== false && !item.archived && !item.isCondensed)
    if (candidates.length < threshold) return
    const children = candidates.slice(0, threshold)
    const prompt = `你是长期记忆分层巩固助手。请把以下同一人物关系中的阶段摘要压缩成一条更高层长期记忆，保留时间变化、重要事件、承诺、边界与关系发展，不得添加新事实。只输出 JSON：{"narrative":"100-300字巩固摘要"}\n\n${children.map((item: any, index: number) => `[${index + 1}] ${item.date || ''} ${item.content || ''}`).join('\n')}`
    const response = await sendChatMessage([{ role: 'user', content: prompt }], undefined, true)
    const extraction = parseMemoryExtraction(typeof response === 'string' ? response : response.content)
    if (!extraction.narrative) return
    children.forEach((item: any) => { item.archived = true })
    const evidenceMessageIds = children.flatMap((item: any) => item.evidenceMessageIds || [])
    chat.memoryBook.push({
      id: Date.now() + 1, date: new Date().toLocaleDateString('zh-CN'), content: extraction.narrative,
      messageCount: children.reduce((total: number, item: any) => total + Number(item.messageCount || 0), 0),
      fromMsgId: children.map((item: any) => item.fromMsgId).filter(Boolean).sort((a: number, b: number) => a - b)[0],
      toMsgId: children.map((item: any) => item.toMsgId).filter(Boolean).sort((a: number, b: number) => b - a)[0],
      evidenceMessageIds, childMemoryIds: children.map((item: any) => item.id),
      isCondensed: true, memoryLevel: 2, memoryMode: 'narrative', version: 2,
      createdAt: Date.now(), updatedAt: Date.now(), enabled: true
    })
  }

  const generateSummary = async (messagesToSummarize: any[], isAuto = false, requestedMode?: MemoryMode) => {
    if (isSummarizing.value || messagesToSummarize.length === 0) return

    isSummarizing.value = true
    try {
      const chat = selectedChat.value
      ensureMemoryState(chat)
      const mode = requestedMode || (chat.memoryMode as MemoryMode) || 'hybrid'
      const batchSize = Math.max(20, Math.min(500, Number(chat.memoryBatchSize || 150)))
      const batches: any[][] = []
      for (let offset = 0; offset < messagesToSummarize.length; offset += batchSize) {
        batches.push(messagesToSummarize.slice(offset, offset + batchSize))
      }

      let completed = 0
      for (const batch of batches) {
        const prompt = buildExtractionPrompt(batch, mode, chat.summaryPrompt?.trim() || '')
        const result = await sendChatMessage([{ role: 'user', content: prompt }], undefined, true)
        const rawContent = typeof result === 'string' ? result : result.content
        if (!rawContent) throw new Error('总结生成内容为空')
        const extraction = parseMemoryExtraction(rawContent)
        applyMemoryExtraction(chat, extraction, batch, mode)
        completed++
        saveCustomContacts()
      }

      await consolidateNarrativeHierarchy(chat)
      saveCustomContacts()

      try {
        await indexChatMemories(chat)
      } catch (embeddingError) {
        console.warn('记忆已保存，但向量索引未完成', embeddingError)
      }

      if (!isAuto) {
        showToast(batches.length > 1 ? `已分 ${completed} 批完成记忆整理` : '记忆整理成功')
      }

    } catch (err: any) {
      console.error('总结失败:', err)
      if (!isAuto) {
         showToast(`总结失败: ${err.message}`)
      } else {
         showToast(`后台记忆整理失败: ${err.message}`)
      }
    } finally {
      isSummarizing.value = false
    }
  }

  const handleAutoSummary = async (force = false) => {
    if (!selectedChat.value?.autoSummaryEnabled) return
    const unsummarizedMsgs = getUncoveredMessages(selectedChat.value)
    if (unsummarizedMsgs.length === 0) return
    const countReached = unsummarizedMsgs.length >= Number(selectedChat.value.autoSummaryThreshold || 500)
    const tokenReached = estimateMessageTokens(unsummarizedMsgs) >= Number(selectedChat.value.autoSummaryTokenThreshold || 6000)
    const importantReached = selectedChat.value.autoSummaryOnImportant !== false && unsummarizedMsgs.some((message: any) => message.isMarked)
    const topicReached = selectedChat.value.autoSummaryOnTopicChange === true && detectTopicBoundary(unsummarizedMsgs)
    const trigger = selectedChat.value.autoSummaryTrigger || 'both'
    const shouldRun = force || topicReached || (trigger === 'count' ? countReached || importantReached
      : trigger === 'token' ? tokenReached || importantReached
      : countReached || tokenReached || importantReached)
    if (shouldRun) {
      await generateSummary(unsummarizedMsgs, true)
    }
  }

  const handleManualSummaryRange = async (startCount: number, endCount: number) => {
    const msgs = selectedChat.value.messages || []
    if (msgs.length === 0) {
      showToast('没有可总结的消息')
      return
    }

    if (startCount < 1) startCount = 1
    if (endCount > msgs.length) endCount = msgs.length
    if (startCount > endCount) {
      showToast('区间设置有误')
      return
    }

    const slicedMsgs = msgs.slice(startCount - 1, endCount)
    const validMsgs = slicedMsgs.filter((m: any) => m.type === 'left' || m.type === 'right' || m.type === 'system')

    if (validMsgs.length === 0) {
      showToast('选定区间内没有有效的聊天记录')
      return
    }

    await generateSummary(validMsgs, false)
  }

  const handleManualSummaryLatest = async () => {
    const msgs = selectedChat.value.messages || []
    if (msgs.length === 0) {
      showToast('没有可总结的消息')
      return
    }

    const unsummarizedMsgs = getUncoveredMessages(selectedChat.value)

    if (unsummarizedMsgs.length === 0) {
      showToast('目前没有新的未总结消息')
      return
    }

    await generateSummary(unsummarizedMsgs, false)
  }

  const summarizeVoiceCall = async (callMessages: any[], tempSummary?: string | null) => {
    if (callMessages.length === 0 && !tempSummary) return null
    try {
      const messagesPayload = callMessages.map(m => {
        let prefix = m.type === 'left' ? 'AI: ' : '用户: '
        if (m.type === 'system') prefix = '系统: '
        return `${prefix}${m.content}`
      }).join('\n')

      let prompt = `请你作为一个总结助手，对这通语音通话进行简明扼要的最终档案总结。
要求：
1. 提炼出关键讨论点、双方的情感状态以及最终的决定或结论。
2. 必须以第三人称客观视角书写。
3. 字数控制在150字以内，作为一段连贯的文本输出。`

      if (tempSummary) {
         prompt += `\n\n【通话前半段提要】：\n${tempSummary}`
      }
      
      if (messagesPayload) {
         prompt += `\n\n【通话后半段（或全部）详细记录】：\n${messagesPayload}`
      }

      const result = await sendChatMessage([{ role: 'user', content: prompt }], undefined, true)
      
      let summaryContent = ''
      if (typeof result === 'string') {
        summaryContent = result
      } else {
        summaryContent = result.content
      }

      summaryContent = summaryContent.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim() || summaryContent

      if (!summaryContent) return null
      return summaryContent
    } catch (err: any) {
      console.error('语音通话总结失败:', err)
      return null
    }
  }

  const summarizeVideoCall = async (callMessages: any[], tempSummary?: string | null) => {
    if (callMessages.length === 0 && !tempSummary) return null
    try {
      const messagesPayload = callMessages.map(m => {
        let prefix = m.type === 'left' ? 'AI: ' : '用户: '
        if (m.type === 'system') prefix = '系统: '
        return `${prefix}${m.content}`
      }).join('\n')

      let prompt = `请你作为一个总结助手，对这通视频通话进行简明扼要的最终档案总结。
要求：
1. 提炼出关键讨论点、双方的情感状态以及最终的决定或结论。
2. 必须以第三人称客观视角书写。
3. 字数控制在150字以内，作为一段连贯的文本输出。`

      if (tempSummary) {
         prompt += `\n\n【通话前半段提要】：\n${tempSummary}`
      }
      
      if (messagesPayload) {
         prompt += `\n\n【通话后半段（或全部）详细记录】：\n${messagesPayload}`
      }

      const result = await sendChatMessage([{ role: 'user', content: prompt }], undefined, true)
      
      let summaryContent = ''
      if (typeof result === 'string') {
        summaryContent = result
      } else {
        summaryContent = result.content
      }

      summaryContent = summaryContent.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim() || summaryContent

      if (!summaryContent) return null
      return summaryContent
    } catch (err: any) {
      console.error('视频通话总结失败:', err)
      return null
    }
  }

  const getUnsummarizedCount = () => {
    if (!selectedChat.value) return 0
    return getUncoveredMessages(selectedChat.value).length
  }

  const summarizeMemories = async (memoriesToSummarize: any[]) => {
    if (isSummarizing.value || memoriesToSummarize.length === 0) return null

    isSummarizing.value = true
    try {
      const memoriesPayload = memoriesToSummarize.map((m, index) => {
        return `[记忆 ${index + 1} - ${m.date}]:\n${m.content}`
      }).join('\n\n')

      const prompt = `请你作为一个记忆整理助手，将以下多条零散的历史记忆，融合成一段精简、连贯的长期记忆。
要求：
1. 提炼并保留核心事件、重要设定和人物关系的发展。
2. 剔除重复啰嗦的细节，将内容高度浓缩。
3. 必须以第三人称客观视角书写。
4. 字数控制在100-300字以内，作为一段连贯的文本输出。

历史记忆：
${memoriesPayload}`

      const result = await sendChatMessage([{ role: 'user', content: prompt }], undefined, true)
      
      let summaryContent = ''
      if (typeof result === 'string') {
        summaryContent = result
      } else {
        summaryContent = result.content
      }

      summaryContent = summaryContent.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim() || summaryContent

      if (!summaryContent) throw new Error('精简生成的记忆内容为空')
      return summaryContent
    } catch (err: any) {
      console.error('精简记忆失败:', err)
      showToast(`精简失败: ${err.message}`)
      return null
    } finally {
      isSummarizing.value = false
    }
  }

  return {
    isSummarizing,
    summaryModalVisible,
    generateSummary,
    handleAutoSummary,
    handleManualSummaryLatest,
    handleManualSummaryRange,
    getUnsummarizedCount,
    summarizeMemories,
    summarizeVoiceCall,
    summarizeVideoCall
  }
}
