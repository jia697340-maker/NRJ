/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import { worldBooks } from '../store'
import { useChatState } from './useChatState'

const tokenStats = ref<any>(null)
const isCalculating = ref(false)

export function useChatTokenStats() {
  const { selectedChat, buildChatMessages } = useChatState()

  const estimateToken = (text: string) => Math.ceil((text || '').length * 1.2)

  const extractText = (content: any): string => {
    if (typeof content === 'string') return content
    if (!Array.isArray(content)) return ''
    return content
      .filter(item => item?.type === 'text' && typeof item.text === 'string')
      .map(item => item.text)
      .join('\n')
  }

  const estimateWorldBookTokens = (chat: any) => {
    let worldBookTokens = 0
    const boundBooks = chat.boundWorldBooks || []
    worldBooks
      .filter(book => boundBooks.includes(book.id) && book.enabled)
      .forEach(book => book.entries.forEach(entry => {
        if (entry.enabled) worldBookTokens += estimateToken(`${entry.title}: ${entry.content}`)
      }))
    return worldBookTokens
  }

  const estimateMemoryTokens = (chat: any) => {
    let memoryTokens = 0
    if (Array.isArray(chat.memoryBook)) {
      chat.memoryBook.forEach((m: any) => {
        memoryTokens += estimateToken(m.content)
      })
    }
    const structured = chat.memoryState
    if (structured) {
      for (const item of structured.events || []) memoryTokens += estimateToken(`${item.title || ''}${item.summary || ''}`)
      for (const item of structured.variables || []) memoryTokens += estimateToken(`${item.key || ''}${item.value || ''}`)
      for (const item of structured.tableRows || []) memoryTokens += estimateToken(`${item.title || ''}${item.value || ''}`)
      for (const item of structured.relations || []) memoryTokens += estimateToken(`${item.source || ''}${item.relation || ''}${item.target || ''}`)
    }
    return Math.min(memoryTokens, Number(chat.memoryTokenBudget || 1200))
  }

  const refreshTokenStats = async () => {
    const chat = selectedChat.value
    if (!chat || isCalculating.value) return

    isCalculating.value = true
    try {
      // 直接复用真实请求组装流程；统计时跳过 Base64，图片消耗仍由平台决定。
      const apiMessages = await buildChatMessages(chat, false, false, { includeMedia: false })
      const systemMessage = apiMessages[0]
      const systemTotalTokens = systemMessage ? estimateToken(extractText(systemMessage.content)) + 4 : 0
      const historyTokens = apiMessages.slice(1).reduce((total: number, message: any) => {
        return total + estimateToken(extractText(message.content)) + 4
      }, 0)

      // 世界书与记忆位于 system 消息内；先估算它们，再把剩余部分归入系统规则与人设。
      const worldBookTokens = Math.min(estimateWorldBookTokens(chat), systemTotalTokens)
      const memoryTokens = Math.min(estimateMemoryTokens(chat), Math.max(0, systemTotalTokens - worldBookTokens))
      const systemTokens = Math.max(0, systemTotalTokens - worldBookTokens - memoryTokens)

      tokenStats.value = {
        systemTokens,
        worldBookTokens,
        memoryTokens,
        historyTokens,
        totalTokens: systemTotalTokens + historyTokens,
        totalMsgCount: (chat.messages || []).length,
        activeMsgCount: Math.max(0, apiMessages.length - 1)
      }
    } catch (error) {
      console.error('Failed to estimate chat token usage', error)
      tokenStats.value = null
    } finally {
      isCalculating.value = false
    }
  }

  const getTokenPercentage = (val: number, total: number) => {
    if (total === 0) return 0
    return Math.round((val / total) * 100)
  }

  return {
    tokenStats,
    isCalculating,
    refreshTokenStats,
    getTokenPercentage
  }
}
