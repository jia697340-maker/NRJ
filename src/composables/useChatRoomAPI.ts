/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import { sendChatMessage, isMomentApiReady, type ChatApiPurpose } from '../services/api'
import { chatSettings, worldBooks } from '../store'
import { characterBlocksUser, deleteFriendByCharacter, setRelationshipPlan } from './useChatRelationship'
import localforage from 'localforage'
import { useNovelAI } from './useNovelAI'
import { useGptImage } from './useGptImage'
import { useGeminiImage } from './useGeminiImage'
import { useFluxImage } from './useFluxImage'
import { useNijiImage } from './useNijiImage'
import { useSeedreamImage } from './useSeedreamImage'
import { appendMissedIncomingCall, isInDoNotDisturb } from './useCallRecords'
import { parseBilingualMessage } from '../services/bilingualChat'
import { attachActiveOfflineSession } from '../services/offlineSessions'
import { beginOfflinePresence, reconcilePresence } from '../services/presenceLifecycle'
import { useVoicePlayer } from './useVoicePlayer'
import { createChatMessageId, createTransferData, resolveTransfer } from '../services/transferLifecycle'
import { useChatAuth } from './useChatAuth'
import { createIncomingWalletPayment } from '../services/walletService'

// 引入拆分的逻辑模块
import { useChatRoomError } from './useChatRoomError'
import { useChatRoomVision } from './useChatRoomVision'
import { useChatRoomImageGen } from './useChatRoomImageGen'
import { processMomentTags } from './useChatRoomMessage'

// 通话中禁止的动作
const CALL_BLOCKED_ACTIONS = new Set([
  'send_image',
  'send_voice',
  'send_emoji',
  'send_transfer',
  'send_red_packet'
])

const OFFLINE_BLOCKED_ACTIONS = new Set([
  'recall',
  'claim',
  'reject',
  'send_image',
  'send_voice',
  'send_emoji',
  'send_transfer',
  'send_red_packet',
  'voice_call_user',
  'video_call_user',
  'offline',
  'status'
])

type TriggerChatOptions = {
  turnId?: string
  currentUserThought?: string
  consumePendingThought?: boolean
}

export function useChatRoomAPI(
  mockChats: any, 
  selectedChat: any, 
  myProfile: any, 
  buildChatMessages: any, 
  showNotification: any,
  saveCustomContacts: (targetChat?: any) => void,
  scrollToBottom: () => Promise<void>,
  isRoomActive: any,
  // 角色主动来电：交给聊天室弹响铃界面，等用户接/拒之后再调 resume 继续剩余动作
  onIncomingCall?: (reason: string, resume: () => void) => void,
  getOfflineMeetMode?: () => false | 'mixed' | 'separate'
) {
  const { currentChatUserId } = useChatAuth()
  const isGenerating = ref(false)
  let abortController: AbortController | null = null
  const typingTimers: ReturnType<typeof setTimeout>[] = []
  const { generateImage: generateNovelImage, abortGeneration: abortNovelGeneration } = useNovelAI()
  const { generateImage: generateGptImage, abortGeneration: abortGptGeneration } = useGptImage()
  const { generateImage: generateGeminiImage, abortGeneration: abortGeminiGeneration } = useGeminiImage()
  const { generateImage: generateFluxImage, abortGeneration: abortFluxGeneration } = useFluxImage()
  const { generateImage: generateNijiImage, abortGeneration: abortNijiGeneration } = useNijiImage()
  const { generateImage: generateSeedreamImage, abortGeneration: abortSeedreamGeneration } = useSeedreamImage()

  // 1. 初始化错误处理模块
  const {
    showErrorModal,
    errorMessage,
    errorDetails,
    activeErrorTab,
    copyButtonText,
    closeErrorModal,
    copyErrorDetails,
    mountTestError
  } = useChatRoomError()

  // 2. 初始化视觉/识图降维模块
  const { reSummarizeImage, checkAndRunSilentCompression } = useChatRoomVision(
    selectedChat,
    saveCustomContacts,
    showNotification
  )

  // 3. 初始化生图与 LLM 模块
  const { handleAIImageGen } = useChatRoomImageGen(
    selectedChat,
    myProfile,
    generateNovelImage,
    generateGptImage,
    generateGeminiImage,
    generateFluxImage,
    generateNijiImage,
    generateSeedreamImage,
    saveCustomContacts,
    scrollToBottom
  )

  const handleStopCall = () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    abortNovelGeneration()
    abortGptGeneration()
    abortGeminiGeneration()
    abortFluxGeneration()
    abortNijiGeneration()
    abortSeedreamGeneration()
    
    typingTimers.forEach(clearTimeout)
    typingTimers.length = 0
    
    isGenerating.value = false
    
    const targetChat = mockChats.value.find((c: any) => c.id === selectedChat.value?.id)
    if (targetChat) targetChat.isTyping = false
  }

  const clearOfflineTimer = (chatId: string | number) => {
    if (!(window as any)._offlineTimers) (window as any)._offlineTimers = {}
    const timer = (window as any)._offlineTimers[chatId]
    if (timer) clearTimeout(timer)
    delete (window as any)._offlineTimers[chatId]
  }

  const scheduleOfflineReturn = (chat: any) => {
    if (!chat?.offlineUntil || chat.offlineUntil <= Date.now()) return
    clearOfflineTimer(chat.id)
    const waitTime = Math.max(0, chat.offlineUntil - Date.now())
    ;(window as any)._offlineTimers[chat.id] = setTimeout(async () => {
      clearOfflineTimer(chat.id)
      const result = reconcilePresence(chat)
      if (!result.changed) return
      const shouldResumeReply = chat.presencePendingReply === true
      if (result.becameOnline) chat.presencePendingReply = false
      saveCustomContacts(chat)
      if (selectedChat.value?.id === chat.id) await scrollToBottom()
      if (result.becameOnline && shouldResumeReply && selectedChat.value?.id === chat.id && !isGenerating.value) {
        await triggerAPI()
      }
    }, waitTime + 250)
  }

  const syncPresenceLifecycle = async (chat: any = selectedChat.value) => {
    if (!chat) return
    const result = reconcilePresence(chat)
    if (result.changed) {
      saveCustomContacts(chat)
      if (selectedChat.value?.id === chat.id) await scrollToBottom()
    }
    if (chat.offlineUntil > Date.now()) scheduleOfflineReturn(chat)
    else if (chat.presencePendingReply === true && selectedChat.value?.id === chat.id && !isGenerating.value) {
      chat.presencePendingReply = false
      saveCustomContacts(chat)
      await triggerAPI()
    }
    return result
  }

  const handleRegenerate = async (showExtensionPanel: any, showToast: any, callMode: false | 'voice' | 'video' = false) => {
    if (isGenerating.value || !selectedChat.value || selectedChat.value.id === 1) return
    
    const msgs = selectedChat.value.messages
    if (!msgs || msgs.length === 0) return

    const regenerateOfflineMode = getOfflineMeetMode?.() ?? false
    let removed = false
    const removedTurnIds = new Set<string>()
    while (
      msgs.length > 0 &&
      msgs[msgs.length - 1].type === 'left' &&
      (regenerateOfflineMode !== 'separate' || msgs[msgs.length - 1].isOfflineMeetMsg)
    ) {
      const removedMessage = msgs.pop()
      if (removedMessage?.turnId) removedTurnIds.add(removedMessage.turnId)
      removed = true
    }

    if (removed) {
      let regenerateTurnId = Array.from(removedTurnIds)[0] || ''
      if (removedTurnIds.size > 0) {
        selectedChat.value.innerThoughts = (selectedChat.value.innerThoughts || []).filter((item: any) => !removedTurnIds.has(item.turnId))
      } else if (selectedChat.value.innerThoughts?.length) {
        selectedChat.value.innerThoughts.shift()
      }
      if (!regenerateTurnId) regenerateTurnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const previousUserThought = (selectedChat.value.userInnerThoughts || []).find((item: any) => item.turnId === regenerateTurnId)?.content || ''
      saveCustomContacts()
      showExtensionPanel.value = false
      await triggerAPI(callMode, 'default', {
        turnId: regenerateTurnId,
        currentUserThought: previousUserThought,
        consumePendingThought: false
      })
    } else {
      showToast('没有可重新生成的回复')
    }
  }

  const triggerAPI = async (
    callMode: false | 'voice' | 'video' = false,
    apiPurpose: ChatApiPurpose = 'default',
    triggerOptions: TriggerChatOptions = {}
  ) => {
    if (!selectedChat.value || selectedChat.value.id === 1) return
    if (isGenerating.value) return
    
    isGenerating.value = true
    abortController = new AbortController()
    typingTimers.length = 0
    
    const currentChatId = selectedChat.value.id
    const targetChat = mockChats.value.find((c: any) => c.id === currentChatId)
    const turnId = triggerOptions.turnId || `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const shouldConsumePendingThought = triggerOptions.consumePendingThought ?? apiPurpose === 'default'
    const currentUserThought = String(
      triggerOptions.currentUserThought ?? (shouldConsumePendingThought ? targetChat?.pendingUserThought : '') ?? ''
    ).trim()

    if (targetChat) {
      const presenceResult = reconcilePresence(targetChat)
      if (targetChat.offlineUntil <= Date.now()) targetChat.presencePendingReply = false
      if (presenceResult.changed) saveCustomContacts(targetChat)
    }
    
    // --- 拦截离线积压逻辑 ---
    if (targetChat && targetChat.enableImmersiveStatus && targetChat.offlineUntil && targetChat.offlineUntil > Date.now()) {
      isGenerating.value = false
      const waitTime = targetChat.offlineUntil - Date.now()
      console.log(`[沉浸模式] 对方离线中，消息已积压。距离回归还有 ${Math.round(waitTime / 1000)} 秒`)
      targetChat.presencePendingReply = true
      
      scheduleOfflineReturn(targetChat)

      saveCustomContacts()
      return
    }

    // --- 调用视觉模块拦截并静默压缩 ---
    await checkAndRunSilentCompression(targetChat)

    const offlineMeetMode = getOfflineMeetMode?.() ?? false
    const pushMsg = (chat: any, msg: Record<string, any>) => {
      if (offlineMeetMode === 'separate') msg.isOfflineMeetMsg = true
      if (offlineMeetMode === 'mixed') attachActiveOfflineSession(chat, msg)
      chat.messages.push(msg)
    }

    // 组装 Prompt (此时变为异步)，传入当前是否是语音通话状态
    const apiMessages = await buildChatMessages(selectedChat.value, callMode, offlineMeetMode, {
      currentUserThought,
      currentTurnId: turnId
    })
    if (targetChat) {
      const relatedMessageIds: number[] = []
      for (let index = targetChat.messages.length - 1; index >= 0; index--) {
        const message = targetChat.messages[index]
        if (message.type === 'left') break
        if (message.type === 'right' && !message.isUndelivered) {
          message.turnId ||= turnId
          relatedMessageIds.unshift(message.id)
        }
      }
      if (currentUserThought && !(targetChat.userInnerThoughts || []).some((item: any) => item.turnId === turnId)) {
        targetChat.userInnerThoughts ||= []
        targetChat.userInnerThoughts.unshift({
          id: `user_thought_${Date.now()}`,
          content: currentUserThought,
          createdAt: Date.now(),
          turnId,
          relatedMessageIds,
          source: 'user'
        })
        const userThoughtStorageLimit = Math.max(1, Number(chatSettings.innerThoughtLimit) || 50)
        if (targetChat.userInnerThoughts.length > userThoughtStorageLimit) {
          targetChat.userInnerThoughts.splice(userThoughtStorageLimit)
        }
      }
      if (shouldConsumePendingThought) targetChat.pendingUserThought = ''
      saveCustomContacts(targetChat)
    }
    const boundBookIds = Array.isArray(selectedChat.value.boundWorldBooks) ? selectedChat.value.boundWorldBooks : []
    const diagnosticContext = {
      chatId: selectedChat.value.id,
      chatName: selectedChat.value.name,
      worldBookEntries: worldBooks
        .filter((book: any) => book.enabled && boundBookIds.includes(book.id))
        .flatMap((book: any) => (book.entries || [])
          .filter((entry: any) => entry.enabled)
          .map((entry: any) => `${book.name || book.title || '世界书'} · ${entry.title || '未命名条目'}`)),
      memoryEntries: [
        ...(selectedChat.value.memoryBook || []).map((item: any) => item.title || `叙事记忆 ${item.id || ''}`),
        ...(selectedChat.value.memoryState?.events || []).map((item: any) => `事件 · ${item.title || '未命名'}`),
        ...(selectedChat.value.memoryState?.variables || []).map((item: any) => `变量 · ${item.key || '未命名'}`),
        ...(selectedChat.value.memoryState?.relations || []).map((item: any) => `关系 · ${item.source || ''}${item.relation || ''}${item.target || ''}`)
      ]
    }
    
    if (targetChat) targetChat.isTyping = true
    
    await scrollToBottom()
    
    try {
      const startTime = Date.now()
      let result
      try {
        result = await sendChatMessage(
          apiMessages,
          abortController.signal,
          false,
          false,
          apiPurpose,
          offlineMeetMode ? (selectedChat.value.offlineModelProfile || 'auto') : 'auto',
          diagnosticContext
        )
      } catch (specializedError: any) {
        const shouldFallbackToGlobal = apiPurpose === 'moment-followup' && isMomentApiReady() && specializedError?.name !== 'AbortError'
        if (!shouldFallbackToGlobal) throw specializedError

        console.warn('[朋友圈] 专用节点调用失败，已自动回退全局节点', specializedError)
        result = await sendChatMessage(
          apiMessages,
          abortController.signal,
          false,
          false,
          'default',
          offlineMeetMode ? (selectedChat.value.offlineModelProfile || 'auto') : 'auto',
          diagnosticContext
        )
      }
      const costSeconds = ((Date.now() - startTime) / 1000).toFixed(1)
      
      let replyText = ''
      let thinkingText = ''
      
      if (typeof result === 'string') {
        replyText = result
      } else {
        replyText = result.content
        thinkingText = result.thinking || ''
      }
      
      // 优先拦截并处理朋友圈相关的特殊标签
      const processMomentRes = offlineMeetMode && chatSettings.disableSpecialTagsInOffline !== false
        ? { newContent: replyText, shouldTriggerAI: false, aiContext: '', handledMomentAction: false }
        : await processMomentTags(replyText, targetChat)
      replyText = processMomentRes.newContent
      // 第二轮再次出现读取标签时只移除标签，不继续递归请求，避免模型形成循环。
      const shouldTriggerAI = apiPurpose !== 'moment-followup' && processMomentRes.shouldTriggerAI
      const aiContext = processMomentRes.aiContext
      const handledMomentAction = Boolean(processMomentRes.handledMomentAction)

      // 提取被包裹在文本中的 thinking 内容（针对部分未原生分离 thinking 字段的模型）
      const embeddedThinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/i
      const embeddedThinkingMatch = replyText.match(embeddedThinkingRegex)
      if (embeddedThinkingMatch && !thinkingText) {
        thinkingText = embeddedThinkingMatch[1].trim()
      }
      
      // 清理思考过程与包裹标签，防止内部的格式示例被后续的正则错误解析为气泡
      replyText = replyText.replace(/\[incipere\][\s\S]*?\[finire\]/gi, '')
      replyText = replyText.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      
      // 独立提取心声标签 <inner_thought>
      const innerThoughtRegex = /<inner_thought>([\s\S]*?)<\/inner_thought>/i
      const thoughtMatch = replyText.match(innerThoughtRegex)
      if (thoughtMatch && thoughtMatch[1]) {
        const thoughtContent = thoughtMatch[1].trim()
        if (thoughtContent && targetChat) {
          if (!targetChat.innerThoughts) targetChat.innerThoughts = []
          
          const now = new Date()
          const timeStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.') + ' ' + now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
          
          targetChat.innerThoughts.unshift({
            id: Date.now(),
            time: timeStr,
            createdAt: Date.now(),
            turnId,
            source: 'character',
            hasImage: false,
            hasAudio: false,
            content: thoughtContent
          })
          
          if (targetChat.innerThoughts.length > chatSettings.innerThoughtLimit) {
            targetChat.innerThoughts.pop()
          }
        }
      }

      // 修改解析逻辑：按原文顺序提取标签
      const tokenRegex = /<(msg|recall|claim|reject|send_transfer|send_red_packet|send_voice|send_image|send_emoji|voice_call_user|video_call_user|offline|status|narration|block_user|delete_friend|relationship_plan)(\s+[^>]*)?>([\s\S]*?)<\/\1>/g
      const extractedActions: { type: string, content: string, amount?: number, quote?: { sender: string, content: string }, contentLanguage?: string, translation?: string, translationLanguage?: string, narrationKind?: 'action' | 'scene' | 'thought' }[] = []
      let match
      
      while ((match = tokenRegex.exec(replyText)) !== null) {
        const type = match[1]
        const attrs = match[2] || ''
        const amountStr = attrs.match(/\b(?:amount|seconds)\s*=\s*["']?([0-9.]+)["']?/i)?.[1]
        let content = match[3].trim()
        let quote = undefined
        let contentLanguage = undefined
        let translation = undefined
        let translationLanguage = undefined
        let narrationKind: 'action' | 'scene' | 'thought' | undefined = undefined
        
        if (type === 'msg') {
          const parsedMessage = parseBilingualMessage(content, attrs)
          content = parsedMessage.content
          contentLanguage = parsedMessage.contentLanguage
          translation = parsedMessage.translation
          translationLanguage = parsedMessage.translationLanguage
          const quoteRegex = /<quote\s+sender=(?:["'])?([^"'>]+)(?:["'])?\s*>([\s\S]*?)<\/quote>/i
          const quoteMatch = content.match(quoteRegex)
          if (quoteMatch) {
            quote = {
              sender: quoteMatch[1].trim(),
              content: quoteMatch[2].trim()
            }
            content = content.replace(quoteMatch[0], '').trim()
          }
        }

        if (type === 'narration') {
          const requestedKind = attrs.match(/\bkind\s*=\s*["']?(action|scene|thought)["']?/i)?.[1]?.toLowerCase()
          narrationKind = requestedKind === 'scene' || requestedKind === 'thought' ? requestedKind : 'action'
        }

        if (content || quote || type === 'send_transfer' || type === 'send_red_packet' || type === 'send_voice' || type === 'send_image' || type === 'send_emoji' || type === 'voice_call_user' || type === 'video_call_user' || type === 'offline' || type === 'status' || type === 'narration') {
          const amount = amountStr ? parseFloat(amountStr) : undefined
          extractedActions.push({ type, content, amount, quote, contentLanguage, translation, translationLanguage, narrationKind })
        }
      }
      
      // 如果没有解析出任何动作（比如模型只输出了 <read_moments /> 没有输出 msg），也需要保证后续的流程（比如追问）能继续
      // 降级处理
      if (extractedActions.length === 0 && !shouldTriggerAI && !handledMomentAction) {
        let fallbackText = replyText.replace(/<inner_thought>[\s\S]*?<\/inner_thought>/gi, '')
        fallbackText = fallbackText.replace(/<\/?(msg|recall)>/g, '').trim()
        if (fallbackText) {
          const parsedFallback = parseBilingualMessage(fallbackText)
          extractedActions.push({ type: 'msg', ...parsedFallback })
        } else {
          throw new Error('API 返回了空内容，请检查模型或 API 设置。')
        }
      }
      
      if (extractedActions.length > 0 || shouldTriggerAI || handledMomentAction) {
        // 模拟真人连发：通过递归/异步延迟逐条处理动作队列
        const processNextAction = async (index: number) => {
          const chatToUpdate = mockChats.value.find((c: any) => c.id === currentChatId)
          if (index >= extractedActions.length) {
            if (chatToUpdate) chatToUpdate.isTyping = false
            isGenerating.value = false

            // 当所有的动作解析都处理完毕后，如果刚才包含 <read_moments /> 操作，则静默插入系统旁白并追问大模型
            if (shouldTriggerAI && aiContext && chatToUpdate) {
              pushMsg(chatToUpdate, {
                id: Date.now(),
                type: 'system',
                content: aiContext,
                systemKind: 'moments_context',
                isHidden: true
              })
              saveCustomContacts()
              console.log(`[朋友圈] 已向上下文中注入系统旁白，准备发起追问`)
              return triggerAPI(callMode, 'moment-followup', {
                turnId,
                currentUserThought,
                consumePendingThought: false
              })
            }
            
            if (isRoomActive.value && selectedChat.value && selectedChat.value.id === currentChatId) {
               console.log(`[调试] 聊天结束，用户正在看着 ${chatToUpdate.name}，更新当前对话数据`)
               saveCustomContacts()
               await scrollToBottom()
             } else {
               console.log(`[调试] 聊天结束，用户已离开 ${chatToUpdate.name} 房间，准备将最新状态写入硬盘`)
               saveCustomContacts(chatToUpdate)
            }
            return
          }
          
          if (chatToUpdate) chatToUpdate.isTyping = true
          if (isRoomActive.value && selectedChat.value && selectedChat.value.id === currentChatId) await scrollToBottom()
          
          const action = extractedActions[index]

          if (action.type === 'block_user' || action.type === 'delete_friend') {
            if (chatToUpdate) {
              if (action.type === 'block_user') {
                characterBlocksUser(chatToUpdate, action.content)
                const hasExplicitPlan = extractedActions.slice(index + 1).some(item => item.type === 'relationship_plan')
                if (!hasExplicitPlan) setRelationshipPlan(chatToUpdate, { action: 'reconsider', summary: '对方暂时不愿透露后续打算', reviewAt: Date.now() + 60 * 60000, visibility: 'hidden' })
              }
              else deleteFriendByCharacter(chatToUpdate, action.content)
            }
            processNextAction(index + 1)
            return
          }

          if (action.type === 'relationship_plan') {
            if (chatToUpdate) {
              const [minutesRaw, visibilityRaw, ...summaryParts] = action.content.split('|')
              const minutes = Math.max(1, Number(minutesRaw) || 60)
              const visibility = ['exact', 'vague', 'hidden'].includes(visibilityRaw) ? visibilityRaw as 'exact' | 'vague' | 'hidden' : 'exact'
              setRelationshipPlan(chatToUpdate, { action: 'unblock_user', summary: summaryParts.join('|').trim() || '准备解除拉黑', executeAt: Date.now() + minutes * 60000, visibility })
            }
            processNextAction(index + 1)
            return
          }
          
          if (callMode && CALL_BLOCKED_ACTIONS.has(action.type)) {
            console.log(`[拦截] 通话中角色尝试执行「${action.type}」，已静默拦截以免穿帮。`)
            processNextAction(index + 1)
            return
          }

          if (offlineMeetMode && chatSettings.disableSpecialTagsInOffline !== false && OFFLINE_BLOCKED_ACTIONS.has(action.type)) {
            console.log(`[拦截] 线下模式中角色尝试执行「${action.type}」，已静默拦截。`)
            processNextAction(index + 1)
            return
          }

          // 处理视频通话中的旁白标签
          if (action.type === 'narration') {
            if (chatToUpdate) {
              const isBubbleNarration = !callMode && !offlineMeetMode && chatToUpdate.bubbleNarrationEnabled === true
              pushMsg(chatToUpdate,{
                id: Date.now() + index,
                type: isBubbleNarration ? 'narration' : 'system',
                content: action.content,
                narrationKind: isBubbleNarration ? (action.narrationKind || 'action') : undefined,
                isVoiceCallProcessMsg: callMode === 'voice',
                isVideoCallProcessMsg: callMode === 'video'
              })
              
              if (isRoomActive.value && selectedChat.value && selectedChat.value.id === currentChatId) {
                 await scrollToBottom()
              }
            }
            
            const timer2 = setTimeout(() => {
              processNextAction(index + 1)
            }, 300)
            typingTimers.push(timer2)
            return
          }
          
          if (action.type === 'offline') {
            if (!chatToUpdate?.enableImmersiveStatus) {
              console.log('[权限拦截] 沉浸式状态未开启，已忽略角色下线动作。')
              processNextAction(index + 1)
              return
            }
            const timeStr = action.content.trim()
            let addMs = 0
            if (timeStr.endsWith('h')) addMs = parseFloat(timeStr.replace('h', '')) * 3600 * 1000
            else if (timeStr.endsWith('m')) addMs = parseFloat(timeStr.replace('m', '')) * 60 * 1000
            else if (timeStr.endsWith('s')) addMs = parseFloat(timeStr.replace('s', '')) * 1000
            else if (!isNaN(parseFloat(timeStr))) addMs = parseFloat(timeStr) * 60 * 1000 // 默认分钟
            if (addMs > 0 && chatToUpdate) {
               const safeDurationMs = Math.min(addMs, 30 * 24 * 3600 * 1000)
               beginOfflinePresence(chatToUpdate, safeDurationMs, timeStr, Date.now(), 'chat')
               scheduleOfflineReturn(chatToUpdate)
               saveCustomContacts(chatToUpdate)
               console.log(`[沉浸模式] 角色决定下线时长：${timeStr}，折合 ${safeDurationMs} ms`)
            }
            processNextAction(index + 1)
            return
          }

          if (action.type === 'status') {
            if (!chatToUpdate?.enableImmersiveStatus) {
              console.log('[权限拦截] 沉浸式状态未开启，已忽略角色状态动作。')
              processNextAction(index + 1)
              return
            }
            const st = action.content.trim()
            if (chatToUpdate) {
               chatToUpdate.statusText = (st.toLowerCase() === 'none') ? '' : st
               chatToUpdate.statusSource = chatToUpdate.statusText ? 'chat' : ''
               chatToUpdate.statusSetAt = chatToUpdate.statusText ? Date.now() : 0
               console.log(`[沉浸模式] 角色更新自身状态：${chatToUpdate.statusText}`)
            }
            processNextAction(index + 1)
            return
          }

          if (action.type === 'voice_call_user' || action.type === 'video_call_user') {
            const reason = action.content.trim()
            const isVideo = action.type === 'video_call_user'
            const userIsWatching = isRoomActive.value && selectedChat.value && selectedChat.value.id === currentChatId
            const dnd = isInDoNotDisturb()
            
            let isEnabled = true
            if (isVideo) {
              isEnabled = chatSettings.enableCharVideoCall !== false
            } else {
              isEnabled = chatSettings.enableCharVoiceCall !== false
            }

            // 彻底关闭开关时：如果模型因幻觉仍然输出了打电话标签，应静默拦截丢弃，不留下任何记录和未接来电。
            if (!isEnabled) {
              console.log(`[拦截] 用户已关闭允许角色主动拨打${isVideo ? '视频' : '语音'}的开关，角色产生幻觉生成的来电标签已静默拦截。`)
              processNextAction(index + 1)
              return
            }
            
            const canRing = userIsWatching && !dnd && !!onIncomingCall

            if (!canRing) {
              console.log(`[角色来电] 无法响铃（在房间：${userIsWatching}，类型：${action.type}，免打扰：${dnd}），降级为未接来电`)
              if (chatToUpdate) {
                appendMissedIncomingCall(chatToUpdate, myProfile.value?.name || '对方', reason, 'blocked')
                chatToUpdate.preview = '[未接来电]'
                const now = new Date()
                chatToUpdate.time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                if (userIsWatching) {
                  await scrollToBottom()
                  if (chatSettings.enableNotificationInChat && chatSettings.enableGlobalNotification !== false) {
                    showNotification(chatToUpdate.name, chatToUpdate.avatarUrl, chatToUpdate.avatarText, '[未接来电]')
                  }
                } else {
                  chatToUpdate.unread = (chatToUpdate.unread || 0) + 1
                  if (chatSettings.enableGlobalNotification !== false) {
                    showNotification(chatToUpdate.name, chatToUpdate.avatarUrl, chatToUpdate.avatarText, '[未接来电]')
                  }
                }
              }
              processNextAction(index + 1)
              return
            }

            if (chatToUpdate) chatToUpdate.isTyping = false
            isGenerating.value = false
            let resumed = false
            // 目前 onIncomingCall 设计上可能只接受一个参数。如果要区分音视频，可以在这里传递前缀，但暂时沿用逻辑
            onIncomingCall((isVideo ? '[视频]' : '[语音]') + reason, () => {
              if (resumed) return
              resumed = true
              isGenerating.value = true
              processNextAction(index + 1)
            })
            return
          }

          if (action.type === 'recall') {
            if (chatToUpdate && chatToUpdate.messages) {
              for (let i = chatToUpdate.messages.length - 1; i >= 0; i--) {
                const m = chatToUpdate.messages[i]
                if (m.type === 'left' && !m.isRecalled && m.content.includes(action.content)) {
                  m.isRecalled = true
                  console.log(`[撤回机制] 成功撤回了一条消息: ${m.content}`)
                  break
                }
              }
            }
            if (isRoomActive.value && selectedChat.value && selectedChat.value.id === currentChatId) {
               await scrollToBottom()
            }
            processNextAction(index + 1)
            return
          }
          
          if (action.type === 'claim' || action.type === 'reject') {
             const transferIdStr = action.content.trim()
             if (transferIdStr && chatToUpdate && chatToUpdate.messages) {
                const targetMsg = chatToUpdate.messages.find((m: any) =>
                  m.transferData &&
                  String(m.transferData.id) === transferIdStr &&
                  m.transferData.status === 'pending' &&
                  (m.transferData.receiverType === 'character' || (!m.transferData.receiverType && m.type === 'right'))
                )
                 if (targetMsg) {
                    resolveTransfer({
                      chat: chatToUpdate,
                      transferId: targetMsg.transferData.id,
                      action: action.type === 'claim' ? 'claim' : 'reject',
                      actor: 'character',
                      userName: myProfile.value.name || '我',
                      pushEvent: event => pushMsg(chatToUpdate, event)
                    })
                   saveCustomContacts()
                   if (isRoomActive.value && selectedChat.value && selectedChat.value.id === currentChatId) {
                      await scrollToBottom()
                   }
                }
             }
             processNextAction(index + 1)
             return
          }

          // 处理 AI 主动发送图片 (提取到独立模块)
          if (action.type === 'send_image') {
            if (chatToUpdate) {
              const baseMessageId = Date.now() + index
              if (selectedChat.value?.enableNAIImageGen) {
                // 委托给 ImageGen 模块去异步处理所有逻辑
                handleAIImageGen(
                  chatToUpdate,
                  currentChatId,
                  baseMessageId,
                  action.content,
                  isRoomActive.value
                )
              } else {
                // 普通情况，仅保存文本
                pushMsg(chatToUpdate,{
                  id: baseMessageId,
                  type: 'left',
                  content: '[图片]',
                  imageData: { text: action.content }
                })
                chatToUpdate.preview = '[发来图片/视频]'
                const now = new Date()
                chatToUpdate.time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                if (isRoomActive.value && selectedChat.value && selectedChat.value.id === currentChatId) {
                  await scrollToBottom()
                  if (chatSettings.enableNotificationInChat && chatSettings.enableGlobalNotification !== false) {
                    showNotification(chatToUpdate.name, chatToUpdate.avatarUrl, chatToUpdate.avatarText, '[发来图片/视频]')
                  }
                } else {
                  chatToUpdate.unread = (chatToUpdate.unread || 0) + 1
                  if (chatSettings.enableGlobalNotification !== false) {
                    showNotification(chatToUpdate.name, chatToUpdate.avatarUrl, chatToUpdate.avatarText, '[发来图片/视频]')
                  }
                }
              }
            }
            const timer2 = setTimeout(() => {
              processNextAction(index + 1)
            }, 300)
            typingTimers.push(timer2)
            return
          }

          // 处理 AI 主动发送语音
          if (action.type === 'send_voice') {
            if (chatToUpdate) {
              const voiceSeconds = action.amount || Math.max(1, Math.ceil(action.content.length / 4))
              pushMsg(chatToUpdate,{
                id: Date.now() + index,
                type: 'left',
                content: '[发来一段语音]',
                voiceData: {
                  text: action.content,
                  seconds: voiceSeconds
                }
              })
              chatToUpdate.preview = '[发来一段语音]'
              const now = new Date()
              chatToUpdate.time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
              
              if (isRoomActive.value && selectedChat.value && selectedChat.value.id === currentChatId) {
                 await scrollToBottom()
                 if (chatSettings.enableNotificationInChat && chatSettings.enableGlobalNotification !== false) {
                   showNotification(chatToUpdate.name, chatToUpdate.avatarUrl, chatToUpdate.avatarText, '[发来一段语音]')
                 }
              } else {
                 chatToUpdate.unread = (chatToUpdate.unread || 0) + 1
                 if (chatSettings.enableGlobalNotification !== false) {
                   showNotification(chatToUpdate.name, chatToUpdate.avatarUrl, chatToUpdate.avatarText, '[发来一段语音]')
                 }
              }
            }
            const timer2 = setTimeout(() => {
              processNextAction(index + 1)
            }, 300)
            typingTimers.push(timer2)
            return
          }

          // 处理 AI 主动发送表情包
          if (action.type === 'send_emoji') {
            const requestedName = action.content.trim()
            
            const emojiStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatEmojis' })
            let matchedEmoji = null
            
            if (emojiStore && requestedName) {
              try {
                const allEmojis: any[] = []
                await emojiStore.iterate((value: any) => {
                  allEmojis.push(value)
                })
                matchedEmoji = allEmojis.find(e => 
                  e.name === requestedName && 
                  (e.category === 'global' || (e.category === 'role' && e.targetId === currentChatId))
                )
              } catch(e) {
                console.error('查询表情包失败', e)
              }
            }

            if (!matchedEmoji) {
              console.log(`[拦截] 角色尝试发送不存在的表情包：${requestedName}，已静默拦截以免穿帮。`)
              processNextAction(index + 1)
              return
            }

            if (chatToUpdate) {
              let urlToSave = ''
              if (matchedEmoji.type === 'url') {
                urlToSave = matchedEmoji.data
              } else if (matchedEmoji.type === 'local' && matchedEmoji.data instanceof Blob) {
                urlToSave = URL.createObjectURL(matchedEmoji.data)
              }
              
              pushMsg(chatToUpdate,{
                id: Date.now() + index,
                type: 'left',
                content: matchedEmoji.name || `[表情]`,
                isEmoji: true,
                emojiId: matchedEmoji.id,
                emojiUrl: urlToSave
              })
              
              chatToUpdate.preview = `[发来一个表情包]`
              const now = new Date()
              chatToUpdate.time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
              
              if (isRoomActive.value && selectedChat.value && selectedChat.value.id === currentChatId) {
                 await scrollToBottom()
                 if (chatSettings.enableNotificationInChat && chatSettings.enableGlobalNotification !== false) {
                   showNotification(chatToUpdate.name, chatToUpdate.avatarUrl, chatToUpdate.avatarText, '[发来一个表情包]')
                 }
              } else {
                 chatToUpdate.unread = (chatToUpdate.unread || 0) + 1
                 if (chatSettings.enableGlobalNotification !== false) {
                   showNotification(chatToUpdate.name, chatToUpdate.avatarUrl, chatToUpdate.avatarText, '[发来一个表情包]')
                 }
              }
            }
            
            const timer2 = setTimeout(() => {
              processNextAction(index + 1)
            }, 300)
            typingTimers.push(timer2)
            return
          }

          // 处理 AI 主动发送红包/转账
          if (action.type === 'send_transfer' || action.type === 'send_red_packet') {
            const typeMap = { 'send_transfer': 'transfer', 'send_red_packet': 'red_packet' } as const
            const text = action.type === 'send_red_packet' ? '[发来一个红包]' : '[发来一笔转账]'
            const tType = typeMap[action.type]
            if (chatToUpdate) {
              const walletAccountId = currentChatUserId.value || 'guest'
              const walletPayment = createIncomingWalletPayment(
                walletAccountId,
                Math.round((action.amount || 0) * 100),
                tType,
                action.content || (tType === 'red_packet' ? '恭喜发财，大吉大利' : '转账')
              )
              pushMsg(chatToUpdate,{
                id: createChatMessageId(),
                type: 'left',
                content: text,
                transferData: createTransferData({
                  type: tType,
                  amount: action.amount || 0,
                  remark: action.content || (tType === 'red_packet' ? '恭喜发财，大吉大利' : '转账'),
                  expireHours: 24,
                  sender: 'character',
                  walletPaymentId: walletPayment.id,
                  walletAccountId
                })
              })
              chatToUpdate.preview = text
              const now = new Date()
              chatToUpdate.time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
              
              if (isRoomActive.value && selectedChat.value && selectedChat.value.id === currentChatId) {
                 await scrollToBottom()
                 if (chatSettings.enableNotificationInChat && chatSettings.enableGlobalNotification !== false) {
                   showNotification(chatToUpdate.name, chatToUpdate.avatarUrl, chatToUpdate.avatarText, text)
                 }
              } else {
                 chatToUpdate.unread = (chatToUpdate.unread || 0) + 1
                 if (chatSettings.enableGlobalNotification !== false) {
                   showNotification(chatToUpdate.name, chatToUpdate.avatarUrl, chatToUpdate.avatarText, text)
                 }
              }
            }
            
            const timer2 = setTimeout(() => {
              processNextAction(index + 1)
            }, 300)
            typingTimers.push(timer2)
            return
          }
          
          const typingDelay = Math.min(2500, Math.max(600, action.content.length * 50))
          
          const timer1 = setTimeout(async () => {
            if (!chatToUpdate) return
            
            const isLastMsg = index === extractedActions.length - 1 || !extractedActions.slice(index + 1).some(a => a.type === 'msg')
            
            const thinking = index === 0 ? thinkingText : ''
            const msgContent = action.content
            pushMsg(chatToUpdate,{
              id: Date.now() + index,
              type: 'left',
              turnId,
              content: msgContent,
              contentLanguage: action.contentLanguage,
              translation: action.translation,
              translationLanguage: action.translationLanguage,
              translationStatus: action.translation ? 'ready' : undefined,
              thinking: thinking,
              costTime: isLastMsg ? costSeconds : undefined,
              quote: action.quote,
              isVoiceCallProcessMsg: callMode === 'voice',
              isVideoCallProcessMsg: callMode === 'video'
            })
            
            if (!callMode) {
              chatToUpdate.preview = msgContent
              const now = new Date()
              chatToUpdate.time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            }
            
            if (isRoomActive.value && selectedChat.value && selectedChat.value.id === currentChatId) {
               await scrollToBottom()
               if (!callMode && chatSettings.enableNotificationInChat && chatSettings.enableGlobalNotification !== false) {
                 showNotification(
                   chatToUpdate.name,
                   chatToUpdate.avatarUrl,
                   chatToUpdate.avatarText,
                   msgContent
                 )
               }
               if ((callMode === 'voice' && targetChat.enableVoiceCall) || (callMode === 'video' && targetChat.enableVideoCall)) {
                  useVoicePlayer().playVoice(chatToUpdate.messages[chatToUpdate.messages.length - 1].id, msgContent, targetChat).catch(err => {
                    console.error('通话中播放语音失败', err)
                  })
               }
            } else {
               chatToUpdate.unread = (chatToUpdate.unread || 0) + 1
               console.log(`[调试] 收到新消息！用户不在 ${chatToUpdate.name} 房间，未读数 +1，当前总未读：${chatToUpdate.unread}`)
               if (chatSettings.enableGlobalNotification !== false) {
                 showNotification(
                   chatToUpdate.name,
                   chatToUpdate.avatarUrl,
                   chatToUpdate.avatarText,
                   msgContent
                 )
               } else {
                 console.log(`[调试] 全局通知弹窗已被用户在设置中关闭`)
               }
            }
            
            const timer2 = setTimeout(() => {
              processNextAction(index + 1)
            }, 300)
            typingTimers.push(timer2)
            
          }, typingDelay)
          typingTimers.push(timer1)
        }
        
        processNextAction(0)
        return 
      }
      
    } catch (err: any) {
      if (targetChat && shouldConsumePendingThought && currentUserThought) {
        targetChat.pendingUserThought = currentUserThought
        targetChat.userInnerThoughts = (targetChat.userInnerThoughts || []).filter((item: any) => item.turnId !== turnId)
        saveCustomContacts(targetChat)
      }
      if (err.name === 'AbortError') {
        console.log('API 被主动中止')
        isGenerating.value = false
        return
      }
      if (selectedChat.value && selectedChat.value.id === currentChatId) {
        showErrorModal.value = true
        activeErrorTab.value = 'info'
        errorMessage.value = err.message || '网络请求或 API 调用失败'
        try {
          errorDetails.value = err.stack ? err.stack : JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
        } catch(e) {
          errorDetails.value = String(err)
        }
      }
    } 
    
    isGenerating.value = false
    const chatToUpdate = mockChats.value.find((c: any) => c.id === currentChatId)
    if (chatToUpdate) chatToUpdate.isTyping = false
    if (isRoomActive.value && selectedChat.value && selectedChat.value.id === currentChatId) {
      saveCustomContacts()
      await scrollToBottom()
    } else if (chatToUpdate) saveCustomContacts(chatToUpdate)
  }

  // 返回原有一致的签名结构，保证任何组件不会报错失联
  return {
    isGenerating,
    showErrorModal,
    errorMessage,
    errorDetails,
    activeErrorTab,
    copyButtonText,
    closeErrorModal,
    copyErrorDetails,
    handleStopCall,
    handleRegenerate,
    triggerAPI,
    syncPresenceLifecycle,
    reSummarizeImage,
    mountTestError
  }
}
