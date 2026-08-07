/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed } from 'vue'
import { worldBooks } from '../store'
import { useChatState } from './useChatState'

export function useChatTokenStats() {
  const { selectedChat, myProfile } = useChatState()

  const estimateToken = (text: string) => Math.ceil((text || '').length * 1.2)

  const tokenStats = computed(() => {
    if (!selectedChat.value) return null
    
    // 1. 系统与人设 (包含角色的 persona 和用户的 persona)
    const rolePersona = selectedChat.value.persona || ''
    const myPersona = myProfile.value.persona || ''
    const systemTokens = estimateToken(rolePersona) + estimateToken(myPersona)
    
    // 2. 世界设定
    let worldBookTokens = 0
    const boundBooks = selectedChat.value.boundWorldBooks || []
    const boundGroups = selectedChat.value.boundWorldBookGroups || []
    
    const processBook = (bookId: string) => {
      const book = worldBooks.find(b => b.id === bookId)
      if (book && book.enabled) {
        book.entries.forEach(e => {
          if (e.enabled) {
            worldBookTokens += estimateToken(e.content)
          }
        })
      }
    }
    
    boundBooks.forEach(processBook)
    boundGroups.forEach((gId: string) => {
      worldBooks.filter(b => b.groupIds?.includes(gId)).forEach(b => processBook(b.id))
    })
    
    // 3. 记忆与总结
    let memoryTokens = 0
    if (selectedChat.value.memoryBook && Array.isArray(selectedChat.value.memoryBook)) {
      selectedChat.value.memoryBook.forEach((m: any) => {
        memoryTokens += estimateToken(m.content)
      })
    }
    const structured = selectedChat.value.memoryState
    if (structured) {
      for (const item of structured.events || []) memoryTokens += estimateToken(`${item.title || ''}${item.summary || ''}`)
      for (const item of structured.variables || []) memoryTokens += estimateToken(`${item.key || ''}${item.value || ''}`)
      for (const item of structured.tableRows || []) memoryTokens += estimateToken(`${item.title || ''}${item.value || ''}`)
      for (const item of structured.relations || []) memoryTokens += estimateToken(`${item.source || ''}${item.relation || ''}${item.target || ''}`)
    }
    // 实际请求只会注入预算范围内的相关记忆，不再统计整座记忆库。
    memoryTokens = Math.min(memoryTokens, Number(selectedChat.value.memoryTokenBudget || 1200))
    
    // 4. 当前上下文记录
    let historyTokens = 0
    const msgs = selectedChat.value.messages || []
    const memoryType = selectedChat.value.memoryType || 'count'
    const memoryValue = selectedChat.value.memoryValue
    let activeMsgCount = msgs.length
    
    let validMsgs = []
    if (memoryValue) {
      if (memoryType === 'count') {
        validMsgs = msgs.slice(-memoryValue)
        activeMsgCount = validMsgs.length
      } else if (memoryType === 'round') {
        let roundCount = 0
        let i = msgs.length - 1
        while (i >= 0 && roundCount < memoryValue) {
          if (msgs[i].type === 'right') {
            roundCount++
          }
          validMsgs.unshift(msgs[i])
          i--
        }
        activeMsgCount = validMsgs.length
      }
    } else {
      validMsgs = [...msgs]
    }
    
    validMsgs.forEach((m: any) => {
      if (m.type !== 'system' && !m.isRecalled) {
        let content = m.content || ''
        if (m.isEmoji && m.emojiSummary) content += ` ${m.emojiSummary}`
        if (m.imageData && m.imageData.summary) content += ` ${m.imageData.summary}`
        historyTokens += estimateToken(content)
      }
    })
    
    const totalTokens = systemTokens + worldBookTokens + memoryTokens + historyTokens
    const totalMsgCount = msgs.length
    
    return {
      systemTokens,
      worldBookTokens,
      memoryTokens,
      historyTokens,
      totalTokens,
      totalMsgCount,
      activeMsgCount
    }
  })

  const getTokenPercentage = (val: number, total: number) => {
    if (total === 0) return 0
    return Math.round((val / total) * 100)
  }

  return {
    tokenStats,
    getTokenPercentage
  }
}
