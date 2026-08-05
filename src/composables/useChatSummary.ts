/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import { sendChatMessage } from '../services/api'
import { apiSettings, summaryApiSettings } from '../store'

export function useChatSummary(selectedChat: any, saveCustomContacts: () => void, showToast: (msg: string) => void) {
  const isSummarizing = ref(false)
  const summaryModalVisible = ref(false)

  // 这里的 api 同样要发送系统提示词等内容
  const generateSummary = async (messagesToSummarize: any[], isAuto = false) => {
    if (isSummarizing.value || messagesToSummarize.length === 0) return

    isSummarizing.value = true
    try {
      const messagesPayload = messagesToSummarize.map(m => {
        let prefix = m.type === 'left' ? 'AI: ' : '用户: '
        if (m.type === 'system') prefix = '系统: '
        // 如果消息被标记（着重），我们在这里加强提示
        const markedNotice = m.isMarked ? '【重要标记】' : ''
        return `${prefix}${markedNotice}${m.content}`
      }).join('\n')

      const customPrompt = selectedChat.value.summaryPrompt?.trim()
      const defaultPrompt = `请你作为一个记忆整理助手，对以下历史聊天记录进行简明扼要的总结归纳。
要求：
1. 提炼出关键事件、情感变化以及核心讨论点。
2. 尤其注意标有【重要标记】的内容，这是必须要着重注意和保留的信息。
3. 总结必须以第三人称客观视角书写。
4. 字数控制在100-300字以内。`
      
      const basePrompt = customPrompt || defaultPrompt

      const prompt = `${basePrompt}

聊天记录：
${messagesPayload}`

      const result = await sendChatMessage([{ role: 'user', content: prompt }], undefined, true)
      
      let summaryContent = ''
      if (typeof result === 'string') {
        summaryContent = result
      } else {
        summaryContent = result.content
      }

      // 提取纯文本内容，去掉可能存在的思维链标签
      summaryContent = summaryContent.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim() || summaryContent

      if (!summaryContent) throw new Error('总结生成内容为空')

      // 写入记忆书本
      if (!selectedChat.value.memoryBook) {
        selectedChat.value.memoryBook = []
      }
      
      const newMemory = {
        id: Date.now(),
        date: new Date().toLocaleDateString('zh-CN'),
        content: summaryContent,
        messageCount: messagesToSummarize.length,
        fromMsgId: messagesToSummarize[0].id,
        toMsgId: messagesToSummarize[messagesToSummarize.length - 1].id
      }
      
      selectedChat.value.memoryBook.push(newMemory)
      
      // 更新 lastSummaryMsgId (仅当新的消息ID更大时才更新，防止自定义区间总结倒退最新总结标记)
      const lastMsgId = messagesToSummarize[messagesToSummarize.length - 1].id
      if (!selectedChat.value.lastSummaryMsgId || lastMsgId > selectedChat.value.lastSummaryMsgId) {
        selectedChat.value.lastSummaryMsgId = lastMsgId
      }
      
      saveCustomContacts()
      
      if (!isAuto) {
        showToast('总结成功并已存入记忆书本')
      }

    } catch (err: any) {
      console.error('总结失败:', err)
      if (!isAuto) {
         showToast(`总结失败: ${err.message}`)
      } else {
         // 自动总结失败，弹窗提醒（这里用 toast 简易替代，也可设计一个专门弹窗）
         alert(`后台自动总结失败: ${err.message}`)
      }
    } finally {
      isSummarizing.value = false
    }
  }

  const handleAutoSummary = async () => {
    if (!selectedChat.value?.autoSummaryEnabled) return
    const msgs = selectedChat.value.messages || []
    if (msgs.length === 0) return

    const lastId = selectedChat.value.lastSummaryMsgId || 0
    const unsummarizedMsgs = msgs.filter((m: any) => m.id > lastId && (m.type === 'left' || m.type === 'right' || m.type === 'system'))

    if (unsummarizedMsgs.length >= selectedChat.value.autoSummaryThreshold) {
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

    const lastId = selectedChat.value.lastSummaryMsgId || 0
    const unsummarizedMsgs = msgs.filter((m: any) => m.id > lastId && (m.type === 'left' || m.type === 'right' || m.type === 'system'))

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
    const msgs = selectedChat.value.messages || []
    const lastId = selectedChat.value.lastSummaryMsgId || 0
    return msgs.filter((m: any) => m.id > lastId && (m.type === 'left' || m.type === 'right' || m.type === 'system')).length
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
