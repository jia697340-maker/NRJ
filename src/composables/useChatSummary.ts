/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import { sendChatMessage } from '../services/api'
import { globalPromptSettings } from '../store'
import {
  applyMemoryExtraction,
  applyVectorExtraction,
  assertEmbeddingReady,
  buildExtractionPrompt,
  clearChatVectors,
  ensureMemoryState,
  estimateMessageTokens,
  detectTopicBoundary,
  getUncoveredMessages,
  getMemoryExportItems,
  isMemoryMessage,
  markMemoryCoverage,
  normalizeMemoryMode,
  parseMemoryExtraction,
  replaceLongTextMemories,
  resetStructuredMemory,
  writeVectorMemoryTexts,
  type MemoryMode
} from '../services/memoryEngine'

export function useChatSummary(selectedChat: any, saveCustomContacts: () => void, showToast: (msg: string) => void) {
  const isSummarizing = ref(false)
  const isConvertingMemory = ref(false)
  const summaryModalVisible = ref(false)

  const generateSummary = async (messagesToSummarize: any[], isAuto = false, requestedMode?: MemoryMode) => {
    if (isSummarizing.value || messagesToSummarize.length === 0) return

    isSummarizing.value = true
    try {
      const chat = selectedChat.value
      ensureMemoryState(chat)
      const mode = requestedMode || normalizeMemoryMode(chat.memoryMode)
      const batchSize = Math.max(20, Math.min(500, Number(chat.memoryBatchSize || 150)))
      const batches: any[][] = []
      for (let offset = 0; offset < messagesToSummarize.length; offset += batchSize) {
        batches.push(messagesToSummarize.slice(offset, offset + batchSize))
      }

      let completed = 0
      for (const batch of batches) {
        const groupContext = chat.chatType === 'group'
          ? {
              name: chat.name,
              members: (chat.memberIds || []).map((id: string) => ({ id: String(id), name: chat.memberNicknames?.[id] || chat.memoryMemberNames?.[id] || String(id) }))
            }
          : undefined
        const prompt = buildExtractionPrompt(batch, mode, chat.summaryPrompt?.trim() || '', groupContext)
        const maxAttempts = Math.max(1, Math.min(4, Number(chat.memorySummaryRetryCount || 2)))
        let extraction: any = null
        let lastError: any = null
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const result = await sendChatMessage([{ role: 'user', content: prompt }], undefined, true)
            const rawContent = typeof result === 'string' ? result : result.content
            if (!rawContent) throw new Error('总结生成内容为空')
            extraction = parseMemoryExtraction(rawContent)
            const hasModeResult = mode === 'long_text'
              ? Boolean(extraction.narrative || extraction.subjective || Object.keys(extraction.memberMemories || {}).length)
              : mode === 'vector'
                ? Boolean((extraction.vectorMemories || []).length)
                : Boolean((extraction.events || []).length || (extraction.variables || []).length || (extraction.tableRows || []).length || (extraction.relations || []).length)
            if (!hasModeResult) {
              throw new Error('总结未返回可保存的记忆')
            }
            break
          } catch (error) {
            lastError = error
          }
        }
        if (!extraction) throw lastError || new Error('总结失败')
        if (mode === 'vector') await applyVectorExtraction(chat, extraction, batch)
        else applyMemoryExtraction(chat, extraction, batch, mode)
        completed++
        saveCustomContacts()
      }

      saveCustomContacts()

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
    const validMsgs = slicedMsgs.filter((m: any) => isMemoryMessage(m) && !m.isRecalled && !m.isUndelivered)

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

      let prompt = globalPromptSettings.language === 'en' ? `Create a concise final archival summary of this voice call.
Requirements:
1. Extract key discussion points, both sides' emotional states, and final decisions or conclusions.
2. Use an objective third-person perspective.
3. Write one coherent paragraph of no more than 150 words.` : `请你作为一个总结助手，对这通语音通话进行简明扼要的最终档案总结。
要求：
1. 提炼出关键讨论点、双方的情感状态以及最终的决定或结论。
2. 必须以第三人称客观视角书写。
3. 字数控制在150字以内，作为一段连贯的文本输出。`

      if (tempSummary) {
         prompt += globalPromptSettings.language === 'en' ? `\n\n[Earlier call digest]:\n${tempSummary}` : `\n\n【通话前半段提要】：\n${tempSummary}`
      }
      
      if (messagesPayload) {
         prompt += globalPromptSettings.language === 'en' ? `\n\n[Later or complete call transcript]:\n${messagesPayload}` : `\n\n【通话后半段（或全部）详细记录】：\n${messagesPayload}`
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

      let prompt = globalPromptSettings.language === 'en' ? `Create a concise final archival summary of this video call.
Requirements:
1. Extract key discussion points, both sides' emotional states, and final decisions or conclusions.
2. Use an objective third-person perspective.
3. Write one coherent paragraph of no more than 150 words.` : `请你作为一个总结助手，对这通视频通话进行简明扼要的最终档案总结。
要求：
1. 提炼出关键讨论点、双方的情感状态以及最终的决定或结论。
2. 必须以第三人称客观视角书写。
3. 字数控制在150字以内，作为一段连贯的文本输出。`

      if (tempSummary) {
         prompt += globalPromptSettings.language === 'en' ? `\n\n[Earlier call digest]:\n${tempSummary}` : `\n\n【通话前半段提要】：\n${tempSummary}`
      }
      
      if (messagesPayload) {
         prompt += globalPromptSettings.language === 'en' ? `\n\n[Later or complete call transcript]:\n${messagesPayload}` : `\n\n【通话后半段（或全部）详细记录】：\n${messagesPayload}`
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
      const orderedMemories = [...memoriesToSummarize].sort((left, right) =>
        Number(left.fromMsgId || left.createdAt || left.id || 0) - Number(right.fromMsgId || right.createdAt || right.id || 0)
      )
      const memoriesPayload = orderedMemories.map((m, index) => {
        const evidenceIds = Array.isArray(m.evidenceMessageIds) ? m.evidenceMessageIds.join(',') : ''
        return `[记忆 ${index + 1}｜${m.date || '日期未知'}｜原始消息ID:${evidenceIds || '无'}]:\n${m.content}`
      }).join('\n\n')

      const prompt = globalPromptSettings.language === 'en'
        ? `Refresh these chronological long-form memories into one concise, currently valid, conflict-free long-form memory. Newer explicit changes, cancellations, or replacements override older states. Preserve important events, promises, boundaries, relationships, and meaningful changes; remove repetition and obsolete details; add no facts. Use an objective third-person perspective and 100-300 words. Output valid JSON only: {"narrative":"refreshed long-form memory"}\n\nMemories:\n${memoriesPayload}`
        : `你是长文本记忆刷新助手。以下记忆已按从旧到新排列，请把它们精简为一份当前有效、不冲突的长文本记忆。后面的明确修改、取消或替代必须覆盖旧状态；保留重要事件、承诺、边界、人物关系及其变化，删除重复和失效内容，不得补写不存在的事实。使用第三人称客观视角，控制在100-300字。只输出合法 JSON：{"narrative":"刷新后的长文本记忆"}\n\n历史记忆：\n${memoriesPayload}`

      const result = await sendChatMessage([{ role: 'user', content: prompt }], undefined, true)
      
      const rawContent = typeof result === 'string' ? result : result.content
      if (!rawContent) throw new Error('刷新生成的记忆内容为空')
      const extraction = parseMemoryExtraction(rawContent)
      if (!extraction.narrative) throw new Error('刷新生成的记忆内容为空')
      return extraction
    } catch (err: any) {
      console.error('刷新记忆失败:', err)
      showToast(`刷新失败: ${err.message}`)
      return null
    } finally {
      isSummarizing.value = false
    }
  }

  const convertMemoryMode = async (targetMode: MemoryMode) => {
    const chat = selectedChat.value
    if (!chat || isSummarizing.value || isConvertingMemory.value) return false
    const sourceMode = normalizeMemoryMode(chat.memoryMode)
    if (sourceMode === targetMode) return true
    isConvertingMemory.value = true
    try {
      const sourceItems = await getMemoryExportItems(chat, sourceMode)
      if (targetMode === 'vector') {
        if (sourceItems.length > 0) {
          await writeVectorMemoryTexts(chat, sourceItems, { replace: true })
        } else {
          // 即使暂无记忆，也必须实测向量节点后才能进入向量模式。
          await assertEmbeddingReady()
          await clearChatVectors(chat.id)
        }
      } else if (targetMode === 'long_text') {
        replaceLongTextMemories(chat, sourceItems)
      } else {
        const extractions: Array<{ extraction: any; messages: any[] }> = []
        const batchSize = Math.max(10, Math.min(100, Number(chat.memoryBatchSize || 50)))
        for (let offset = 0; offset < sourceItems.length; offset += batchSize) {
          const batch = sourceItems.slice(offset, offset + batchSize)
          const messages = batch.map((item: any, index: number) => ({
            id: item.evidenceMessageIds?.[0] ?? `${item.id}_${index}`,
            type: 'system',
            content: item.text
          }))
          const prompt = buildExtractionPrompt(messages, 'structured', chat.summaryPrompt?.trim() || '')
          const response = await sendChatMessage([{ role: 'user', content: prompt }], undefined, true)
          const extraction = parseMemoryExtraction(typeof response === 'string' ? response : response.content)
          if (!(extraction.events.length || extraction.variables.length || extraction.tableRows.length || extraction.relations.length)) {
            throw new Error('转换没有生成有效的结构化记忆')
          }
          extractions.push({ extraction, messages })
        }
        resetStructuredMemory(chat)
        for (const item of extractions) {
          applyMemoryExtraction(chat, item.extraction, item.messages, 'structured', { includeNarrative: false, addCoverage: false })
        }
      }
      chat.memoryMode = targetMode
      saveCustomContacts()
      return true
    } catch (error: any) {
      console.error('记忆模式转换失败:', error)
      showToast(`转换失败：${error?.message || '未知错误'}`)
      return false
    } finally {
      isConvertingMemory.value = false
    }
  }

  const storeExternalMemory = async (
    sourceMessages: any[],
    summaryText: string,
    metadata: Record<string, any> = {}
  ) => {
    const chat = selectedChat.value
    if (!chat || !summaryText.trim()) return false
    const mode = normalizeMemoryMode(chat.memoryMode)
    if (mode === 'long_text') {
      if (!Array.isArray(chat.memoryBook)) chat.memoryBook = []
      const now = Date.now()
      chat.memoryBook.push({
        id: now,
        date: new Date().toLocaleDateString('zh-CN'),
        content: summaryText.trim(),
        messageCount: sourceMessages.length,
        fromMsgId: sourceMessages[0]?.id,
        toMsgId: sourceMessages[sourceMessages.length - 1]?.id,
        evidenceMessageIds: sourceMessages.map(item => item.id).filter((id: any) => id !== undefined),
        memoryLevel: 1,
        memoryMode: 'long_text',
        version: 3,
        createdAt: now,
        updatedAt: now,
        enabled: true,
        ...metadata
      })
    } else if (mode === 'vector') {
      await writeVectorMemoryTexts(chat, [{
        text: summaryText.trim(),
        evidenceMessageIds: sourceMessages.map(item => item.id).filter((id: any) => id !== undefined),
        importance: 4
      }])
    } else {
      const prompt = buildExtractionPrompt(sourceMessages.length ? sourceMessages : [{ id: Date.now(), type: 'system', content: summaryText }], 'structured', chat.summaryPrompt?.trim() || '')
      const response = await sendChatMessage([{ role: 'user', content: prompt }], undefined, true)
      const extraction = parseMemoryExtraction(typeof response === 'string' ? response : response.content)
      if (!(extraction.events.length || extraction.variables.length || extraction.tableRows.length || extraction.relations.length)) {
        throw new Error('没有生成可保存的结构化记忆')
      }
      applyMemoryExtraction(chat, extraction, sourceMessages, 'structured', { includeNarrative: false, addCoverage: false })
    }
    markMemoryCoverage(chat, sourceMessages, mode)
    saveCustomContacts()
    return true
  }

  return {
    isSummarizing,
    isConvertingMemory,
    summaryModalVisible,
    generateSummary,
    handleAutoSummary,
    handleManualSummaryLatest,
    handleManualSummaryRange,
    getUnsummarizedCount,
    summarizeMemories,
    convertMemoryMode,
    storeExternalMemory,
    summarizeVoiceCall,
    summarizeVideoCall
  }
}
