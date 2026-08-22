/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import { selectRoleAvailableEmojis } from '../../services/chatEmojiScope'
import { filterOnlineHistoryByOfflineSessions } from '../../services/offlineSessions'
import { buildMemoryPacket, normalizeMemoryMode } from '../../services/memoryEngine'
import { buildBilingualPrompt } from '../../services/bilingualChat'
import { getMomentBehavior } from '../../services/moments'
import { getEffectiveUserProfile } from '../useChatUserProfiles'
import { myProfile } from './state'
import { buildSystemPrompt } from './prompt'
import { buildOfflinePostHistoryPrompt } from '../useOfflineMeetPrompt'
import { useVoiceCall } from '../useVoiceCall'
import { useVideoCall } from '../useVideoCall'
import { chatSettings, globalPromptSettings, taskPromptSettings } from '../../store'
import { pushContextTrace, type ContextTraceCollector } from '../../services/contextTrace'
import { buildInnerThoughtContext } from '../../services/innerThoughtContext'
import { formatTransferForContext } from '../../services/transferLifecycle'
import { readGroupChats } from '../../services/groupChat'
import { buildGroupToSingleBridgeContext } from '../../services/memoryBridge'
import { useChatAuth } from '../useChatAuth'
import { buildChatModelRulesPrompt } from '../../services/modelCommunication'
import { formatIdentityDateTime, getConversationAdjustedTimestamp } from '../../services/conversationTime'

// 将 Blob 转为 Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to convert blob to base64'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// 获取 GIF 第一帧的 Base64
const extractFirstFrameFromGif = async (urlOrBase64: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        // 转换为普通的 JPEG/PNG base64
        resolve(canvas.toDataURL('image/jpeg', 0.9))
      } else {
        reject(new Error('Canvas context not available'))
      }
    }
    img.onerror = () => reject(new Error('Failed to load image for frame extraction'))
    img.src = urlOrBase64
  })
}

type BuildChatMessagesOptions = {
  includeMedia?: boolean
  allowExternalMemoryLookup?: boolean
  trace?: ContextTraceCollector
  currentUserThought?: string
  currentTurnId?: string
}

export const buildChatMessages = async (
  chat: any,
  callMode: false | 'voice' | 'video' = false,
  offlineMeetMode: false | 'mixed' | 'separate' = false,
  options: BuildChatMessagesOptions = {}
) => {
  const messages: any[] = []
  const userProfile = getEffectiveUserProfile(chat, myProfile.value)
  const characterName = String(chat?.realName || chat?.name || '当前角色')
  const userName = String(userProfile?.name || '当前用户')
  const usesEnglishPrompt = globalPromptSettings.language === 'en'
  
  // --- 处理可用表情包 (主动发表情包功能) ---
  const emojiStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatEmojis' })
  let roleEmojisStr = '无'
  const roleEmojiImages: string[] = [] // 如果启用了视觉识别，这里将存放 Base64
  
  try {
    const allEmojis: any[] = []
    await emojiStore.iterate((value: any, _key: string) => {
      allEmojis.push(value)
    })
    // 过滤出该角色可用的：全局(global) + 专属(role, 且 targetId 匹配)
    const availableEmojis = selectRoleAvailableEmojis(allEmojis, String(chat.characterEntityId || chat.id))
    
    if (availableEmojis.length > 0) {
      roleEmojisStr = availableEmojis.map(e => e.name).join('、')
      
      // 如果开启了主动发表情包的图形识别
      if (chat.enableRoleEmojiVision && options.includeMedia !== false) {
        for (const e of availableEmojis) {
          let rawData = ''
          if (e.type === 'local' && e.data instanceof Blob) {
             rawData = await blobToBase64(e.data)
          } else if (e.type === 'url' && typeof e.data === 'string') {
             rawData = e.data
          }
          if (rawData) {
             try {
               // 提取第一帧作为静态参考
               const base64 = await extractFirstFrameFromGif(rawData)
               roleEmojiImages.push(base64)
             } catch(err) {
               roleEmojiImages.push(rawData)
             }
          }
        }
      }
    }
  } catch(err) {
    console.error('Failed to load available emojis for role', err)
  }

  // --- 拦截：通话临时总结 ---
  let callTempSummaryContext = ''
  if (callMode === 'voice') {
    const { currentCallTempSummary } = useVoiceCall()
    if (currentCallTempSummary.value) {
      callTempSummaryContext = usesEnglishPrompt
        ? `\n\n[Summary of the earlier part of this call]\n${currentCallTempSummary.value}\n(Use this summary together with the latest transcript below when responding.)`
        : `\n\n【本次通话前半段提要】\n${currentCallTempSummary.value}\n(注：以上是本次通话前半段的总结，请结合它以及下方的最新明细进行回复。)`
    }
  } else if (callMode === 'video') {
    const { currentVideoCallTempSummary } = useVideoCall()
    if (currentVideoCallTempSummary.value) {
      callTempSummaryContext = usesEnglishPrompt
        ? `\n\n[Summary of the earlier part of this video call]\n${currentVideoCallTempSummary.value}\n(Use this summary together with the latest transcript below when responding.)`
        : `\n\n【本次视频通话前半段提要】\n${currentVideoCallTempSummary.value}\n(注：以上是本次视频通话前半段的总结，请结合它以及下方的最新明细进行回复。)`
    }
  }

  // 视频/语音通话模式附加提示
  let callModePrompt = ''
  if (callMode === 'voice') {
    const voiceItem = taskPromptSettings.items.find((i: any) => i.id === 'task_voice_call_status')
    if (voiceItem && voiceItem.enabled) {
      callModePrompt = voiceItem.content
    } else {
      callModePrompt = usesEnglishPrompt
        ? `\n\n[Current mode: voice call] Use natural spoken language. Do not use kaomoji, sticker tags, parenthetical actions, images, voice-message tags, stickers, or transfers.`
        : `\n\n【当前模式：语音通话】角色${characterName}与用户${userName}正在实时通话。角色${characterName}使用自然口语，不使用颜文字、表情包标签或动作描写括号。`
    }
  } else if (callMode === 'video') {
    const videoItem = taskPromptSettings.items.find((i: any) => i.id === 'task_video_call_status')
    if (videoItem && videoItem.enabled) {
      callModePrompt = videoItem.content
    } else {
      callModePrompt = usesEnglishPrompt
        ? `\n\n[Current mode: video call] Use natural spoken language and describe visible expressions, gaze, and camera-frame actions naturally. Do not use kaomoji, sticker tags, parenthetical actions, images, voice-message tags, stickers, or transfers.`
        : `\n\n【当前模式：视频通话】角色${characterName}与用户${userName}正在实时视频通话。角色${characterName}使用自然口语，可以描述镜头内可见的表情、视线和动作。`
    }
  }

  // 组装系统提示词并推送
  const momentBehavior = getMomentBehavior(chat)
  const momentBehaviorPrompt = chat.enableCharMoments !== false
    ? momentBehavior.mode === 'custom'
      ? usesEnglishPrompt
        ? `\n\n[Manual Moments rules for ${characterName}] Active hours: ${momentBehavior.activeStart}:00–${momentBehavior.activeEnd}:00; expression preference: ${momentBehavior.style || `${characterName}'s persona`}; default audience: ${momentBehavior.audience}. ${characterName} decides from context whether to post, browse, like, or comment; the system applies the user's cooldown settings.`
        : `\n\n【角色${characterName}的朋友圈习惯】活跃时段：${momentBehavior.activeStart}:00-${momentBehavior.activeEnd}:00；表达偏好：${momentBehavior.style || `遵循${characterName}的人设`}；默认受众：${momentBehavior.audience}。角色${characterName}根据当下情境决定发帖、浏览、点赞或评论；系统负责执行用户设置的冷却与概率限制。`
      : usesEnglishPrompt
        ? `\n\n[${characterName}'s autonomy on Moments] Moments are part of ${characterName}'s life. Browsing, posting, images, likes, comments, and replies arise naturally from the character's persona, experiences, emotions, relationship, and current content—not from a need to demonstrate the feature.`
        : `\n\n【角色${characterName}的朋友圈自主权】朋友圈是角色${characterName}生活的一部分。查看、发帖、配图、点赞、评论和回复均从该角色的人设、经历、情绪、关系与具体内容自然产生，不为展示功能而机械行动。`
    : usesEnglishPrompt
      ? '\n\n[Moments usage] Moments are disabled. Do not output any Moments-related tags.'
      : `\n\n【角色${characterName}的朋友圈习惯】角色${characterName}当前不使用朋友圈，不输出朋友圈标签。`
  const memoryQueryMessages = offlineMeetMode === 'separate'
    ? (chat.messages || []).filter((item: any) => item.isOfflineMeetMsg)
    : offlineMeetMode === false
      ? filterOnlineHistoryByOfflineSessions(chat, (chat.messages || []).filter((item: any) => !item.isOfflineMeetMsg))
      : (chat.messages || [])
  const latestMemoryQuery = [...memoryQueryMessages].reverse().find((item: any) =>
      (item?.type === 'left' || item?.type === 'right' || item?.type === 'system' || item?.type === 'narration') && !item?.isUndelivered
  )?.content || ''
  const memoryPacket = await buildMemoryPacket(chat, String(latestMemoryQuery), chat.memoryTokenBudget, {
    allowEmbedding: options.allowExternalMemoryLookup !== false
  })
  const { currentChatUserId } = useChatAuth()
  const groupMemoryBridge = await buildGroupToSingleBridgeContext(
    readGroupChats(currentChatUserId.value),
    String(chat.characterEntityId || chat.id || ''),
    String(latestMemoryQuery)
  )
  const baseSystemPrompt = buildSystemPrompt(chat, roleEmojisStr, callMode, offlineMeetMode, options.trace)
  const bilingualPrompt = buildBilingualPrompt(chat)
  const thoughtContext = buildInnerThoughtContext(chat, options.currentUserThought, options.currentTurnId, options.trace)
  const modelCommunicationRulesPrompt = buildChatModelRulesPrompt(chat)
  const sysPrompt = baseSystemPrompt + bilingualPrompt + memoryPacket + groupMemoryBridge + thoughtContext + momentBehaviorPrompt + callTempSummaryContext + callModePrompt + modelCommunicationRulesPrompt
  pushContextTrace(options.trace, { id: 'runtime:bilingual', category: 'system', group: '输出格式与协议', label: '双语对话规则', text: bilingualPrompt, reason: '当前聊天开启了双语输出' })
  const memoryMode = normalizeMemoryMode(chat.memoryMode)
  pushContextTrace(options.trace, {
    id: 'runtime:memory', category: 'memory', group: '本轮召回',
    label: memoryMode === 'long_text' ? '完整长文本记忆' : memoryMode === 'structured' ? '完整结构化记忆' : '向量召回记忆',
    text: memoryPacket,
    reason: memoryMode === 'vector' ? '按当前语义通过 Embedding 召回' : '读取当前模式的全部启用记忆'
  })
  pushContextTrace(options.trace, { id: 'runtime:group-memory-bridge', category: 'memory', group: '跨会话记忆', label: '群聊与单聊互通记忆', text: groupMemoryBridge, reason: '该角色已与一个或多个群聊开启记忆互通' })
  pushContextTrace(options.trace, { id: 'runtime:moments', category: 'system', group: '朋友圈能力', label: '朋友圈当前行为规则', text: momentBehaviorPrompt, reason: chat.enableCharMoments === false ? '朋友圈已关闭，注入禁用说明' : '依据当前朋友圈模式生成' })
  pushContextTrace(options.trace, { id: 'runtime:call-summary', category: 'memory', group: '通话临时记忆', label: '本次通话前半段提要', text: callTempSummaryContext, reason: '当前通话存在临时总结' })
  pushContextTrace(options.trace, { id: 'runtime:call-mode', category: 'system', group: '通话能力', label: '当前通话模式规则', text: callModePrompt, reason: '当前处于语音或视频通话' })
  pushContextTrace(options.trace, { id: 'runtime:model-communication-rules', category: 'system', group: '行为与演绎规则', label: '当前聊天纠正规则', text: modelCommunicationRulesPrompt, reason: '用户通过与模型直接沟通保存并启用了当前聊天规则' })
  
  if (chat.enableRoleEmojiVision && roleEmojiImages.length > 0) {
    const contentArr: any[] = [{ type: 'text', text: sysPrompt }]
    for (const imgBase64 of roleEmojiImages) {
      contentArr.push({ type: 'image_url', image_url: { url: imgBase64 } })
    }
    messages.push({ role: 'system', content: contentArr })
  } else {
    messages.push({ role: 'system', content: sysPrompt })
  }

  if (chat.messages && chat.messages.length > 0) {
    // 截取历史消息，过滤掉 time 类型的本地提示
  let validHistory = chat.messages.filter((m: any) => (m.type === 'left' || m.type === 'right' || m.type === 'system' || m.type === 'narration') && !m.isUndelivered)
    
    // 【核心逻辑】：普通文字聊天时过滤掉所有通话内对话，防止挤占文字记忆
    if (!callMode) {
      validHistory = validHistory.filter((m: any) => !m.isVoiceCallProcessMsg && !m.isVideoCallProcessMsg)
      // 独立线下页面只保留线下见面消息
      if (offlineMeetMode === 'separate') {
        validHistory = validHistory.filter((m: any) => m.isOfflineMeetMsg)
      } else if (offlineMeetMode === false) {
        validHistory = validHistory.filter((m: any) => !m.isOfflineMeetMsg)
        validHistory = filterOnlineHistoryByOfflineSessions(chat, validHistory)
      }
    } else if (callMode === 'voice') {
      validHistory = validHistory.filter((m: any) => !m.isVideoCallProcessMsg && !m.isOfflineMeetMsg)
      validHistory = filterOnlineHistoryByOfflineSessions(chat, validHistory)
    } else if (callMode === 'video') {
      validHistory = validHistory.filter((m: any) => !m.isVoiceCallProcessMsg && !m.isOfflineMeetMsg)
      validHistory = filterOnlineHistoryByOfflineSessions(chat, validHistory)
    }
    
    let historyToKeep = validHistory
    
    // 根据当前模式使用不同的配置进行切片
    if (callMode === 'voice' || callMode === 'video') {
       const globalChatSettingsStr = localStorage.getItem('clingy_chat_settings')
       let callCount = 15
       if (globalChatSettingsStr) {
         try {
           const settings = JSON.parse(globalChatSettingsStr)
           callCount = callMode === 'video'
             ? (settings.videoMsgCount ?? 15)
             : (settings.voiceMsgCount ?? 15)
         } catch(e) {}
       }
       historyToKeep = validHistory.slice(-callCount)
    } else {
       if (chat.memoryType === 'count' && chat.memoryValue > 0) {
         historyToKeep = validHistory.slice(-chat.memoryValue)
       } else if (chat.memoryType === 'round' && chat.memoryValue > 0) {
         const userMessageIndexes = validHistory
           .map((item: any, index: number) => item.type === 'right' ? index : -1)
           .filter((index: number) => index >= 0)
         const firstRoundIndex = userMessageIndexes[Math.max(0, userMessageIndexes.length - Number(chat.memoryValue))]
         historyToKeep = typeof firstRoundIndex === 'number' ? validHistory.slice(firstRoundIndex) : validHistory
       }
    }

    for (const msg of historyToKeep) {
      let formattedContent = msg.content
      let isSystemNotice = false
      
      if (msg.isRecalled) {
        const recallerName = msg.type === 'left' ? (chat.name || '对方') : userProfile.name
        formattedContent = `${recallerName}撤回了一条消息，撤回内容为：${msg.content}`
        isSystemNotice = true
      } else if (msg.type === 'system') {
        // 处理系统旁白（例如领取/退回红包）
        formattedContent = msg.content
        isSystemNotice = true
      } else if (msg.type === 'narration') {
        const kind = msg.narrationKind === 'scene' || msg.narrationKind === 'thought' ? msg.narrationKind : 'action'
        formattedContent = `<narration kind="${kind}">${msg.content}</narration>`
      }

      // 处理引用 (quote)
      let quotePrefix = ''
      if (msg.quote) {
        quotePrefix = `[引用了 @${msg.quote.sender} 的消息: "${msg.quote.content}"]\n`
      }
      
      let isVoice = false
      let isImage = false
      let isTransferMessage = false
      let voiceSeconds = 0
      let imageDescription = ''

      let isEmojiMessage = false
      let emojiName = ''
      let mediaBase64 = '' // 统一用作表情包或真实图片的 Base64 容器
      let isSummaryReplaced = false

      if (msg.isEmoji) {
        isEmojiMessage = true
        emojiName = msg.content === '[表情]' ? '未知名称' : msg.content
        
        if (msg.emojiSummary) {
          formattedContent = `[对方发来一个表情包，表情包内容是：${msg.emojiSummary}]`
          isSummaryReplaced = true
        } else {
          formattedContent = `[对方发来一个名为“${emojiName}”的表情包]`
        }
      } else if (msg.imageData) {
        isImage = true
        imageDescription = msg.imageData.text || msg.imageData.summary || msg.content || '图片'
        const prefix = msg.type === 'left' ? '我' : '对方'
        const verb = msg.type === 'left' ? '发送了' : '发来'
        
        if (msg.imageData.summary) {
          formattedContent = `[${prefix}${verb}一张图片，图片内容是：${msg.imageData.summary}]`
          isSummaryReplaced = true
        } else {
          formattedContent = `[${prefix}${verb}图片/视频/GIF，画面描述：${msg.imageData.text}]`
        }
      } else if (msg.voiceData) {
        // 如果是一条语音消息，给AI特殊的XML标签解析
        isVoice = true
        voiceSeconds = msg.voiceData.seconds
        formattedContent = msg.type === 'left'
          ? `[我发送了一段语音，内容：${msg.voiceData.text}]`
          : `[对方发来一段语音，转文字内容：${msg.voiceData.text}]`
      } else if (msg.transferData) {
        // 对转账红包的特殊解析渲染给AI
        isTransferMessage = true
        formattedContent = formatTransferForContext(msg)
      }

      // 提取图片或表情包的 Base64 供未压缩时的视觉识别使用
      if (!isSummaryReplaced) {
        // 角色图片省 Token 开启时，不读取角色侧图片的 Base64。
        if (options.includeMedia !== false && !(msg.type === 'left' && chatSettings.enableRoleImageTokenSaver)) {
          if (isEmojiMessage) {
            if (chat.enableEmojiVision && msg.emojiId) {
               const emojiStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatEmojis' })
             try {
                const item = await emojiStore.getItem<any>(msg.emojiId)
                if (item) {
                   let rawData = ''
                   if (item.type === 'local' && item.data instanceof Blob) {
                      rawData = await blobToBase64(item.data)
                   } else if (item.type === 'url' && typeof item.data === 'string') {
                      rawData = item.data
                   }
                   
                   if (rawData) {
                     try {
                       mediaBase64 = await extractFirstFrameFromGif(rawData)
                     } catch(err) {
                       console.warn('提取表情包帧失败，降级发送原图/原链接', err)
                       mediaBase64 = rawData
                     }
                   }
                }
             } catch(e) {
                console.error('Failed to get emoji data for vision', e)
             }
            }
          } else if (isImage && msg.imageData.imageId) {
            // 当不是已总结状态，且有真实的图片缓存ID，我们需要提取出 Base64 给大模型看
            const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
            try {
              const base64Data = await imageStore.getItem<string>(msg.imageData.imageId)
              if (base64Data) {
                mediaBase64 = base64Data
              }
            } catch(e) {
              console.error('Failed to get image data for vision', e)
            }
          }
        }
      }

      if (chat.timePerception) {
        // 尝试根据 msg.id 获取时间，如果 id 不是有效的时间戳，使用当前时间作为兜底
        const rawTimestamp = Number(msg.timestamp || (msg.id > 1000000000000 ? msg.id : Date.now()))
        const adjustedTimestamp = getConversationAdjustedTimestamp(chat, rawTimestamp)
        const senderClock = msg.type === 'left' || msg.type === 'narration' ? chat : userProfile
        const timeStr = formatIdentityDateTime(senderClock, adjustedTimestamp).replace(/\//g, '-')
        const timeAttrs = `time="${timeStr}" timeline_at="${new Date(adjustedTimestamp).toISOString()}"`
        
        if (msg.type === 'narration') {
          formattedContent = formattedContent.replace('<narration ', `<narration ${timeAttrs} `)
        } else if (isSystemNotice) {
          formattedContent = `<system_notice ${timeAttrs}>${formattedContent}</system_notice>`
        } else if (isEmojiMessage) {
          formattedContent = msg.type === 'right'
            ? `<user_emoji_msg ${timeAttrs} name="${emojiName}">${quotePrefix}${formattedContent}</user_emoji_msg>`
            : `<send_emoji ${timeAttrs}>${emojiName}</send_emoji>`
        } else if (isVoice) {
          formattedContent = msg.type === 'right'
            ? `<user_voice_msg ${timeAttrs} seconds="${voiceSeconds}">${quotePrefix}${formattedContent}</user_voice_msg>`
            : `<send_voice ${timeAttrs} seconds="${voiceSeconds}">${msg.voiceData.text}</send_voice>`
        } else if (isImage) {
          formattedContent = msg.type === 'right'
            ? `<user_image_msg ${timeAttrs}>${quotePrefix}${formattedContent}</user_image_msg>`
            : `<send_image ${timeAttrs}>${imageDescription}</send_image>`
        } else if (isTransferMessage) {
          formattedContent = formattedContent.replace(/^<([a-z_]+)/, `<$1 ${timeAttrs}`)
        } else if (msg.type === 'right') {
          formattedContent = `<user_msg ${timeAttrs}>${quotePrefix}${formattedContent}</user_msg>`
        } else if (msg.type === 'left' && chat.sendCharacterTime !== false) {
          formattedContent = `<msg ${timeAttrs}>${quotePrefix}${formattedContent}</msg>`
        } else {
          formattedContent = `<msg>${quotePrefix}${formattedContent}</msg>`
        }
      } else {
        if (msg.type === 'narration') {
          // 已在上方恢复为结构化叙述标签，保持原样进入上下文。
        } else if (isSystemNotice) {
          formattedContent = `<system_notice>${formattedContent}</system_notice>`
        } else if (isEmojiMessage) {
          formattedContent = msg.type === 'right'
            ? `<user_emoji_msg name="${emojiName}">${quotePrefix}${formattedContent}</user_emoji_msg>`
            : `<send_emoji>${emojiName}</send_emoji>`
        } else if (isVoice) {
          formattedContent = msg.type === 'right'
            ? `<user_voice_msg seconds="${voiceSeconds}">${quotePrefix}${formattedContent}</user_voice_msg>`
            : `<send_voice seconds="${voiceSeconds}">${msg.voiceData.text}</send_voice>`
        } else if (isImage) {
          formattedContent = msg.type === 'right'
            ? `<user_image_msg>${quotePrefix}${formattedContent}</user_image_msg>`
            : `<send_image>${imageDescription}</send_image>`
        } else if (isTransferMessage) {
          // 转账和红包已经在上方恢复为原始动作标签，保持原样进入上下文。
        } else if (msg.type === 'right') {
          formattedContent = `<user_msg>${quotePrefix}${formattedContent}</user_msg>`
        } else {
          formattedContent = `<msg>${quotePrefix}${formattedContent}</msg>`
        }
      }

      // 如果有多模态图片数据且未被压缩为文字，构造数组
      if (mediaBase64) {
        messages.push({
          role: msg.type === 'left' || msg.type === 'narration' ? 'assistant' : 'user',
          content: [
            { type: 'text', text: formattedContent },
            { type: 'image_url', image_url: { url: mediaBase64 } }
          ],
          _turnId: msg.turnId,
          _providerState: msg.providerState
        })
      } else {
        messages.push({
          role: msg.type === 'left' || msg.type === 'narration' ? 'assistant' : 'user',
          content: formattedContent,
          _turnId: msg.turnId,
          _providerState: msg.providerState
        })
      }
      pushContextTrace(options.trace, {
        id: `history:${msg.id}`,
        category: 'history',
        group: msg.type === 'right' ? '用户消息' : msg.type === 'left' ? '角色消息' : msg.type === 'narration' ? '旁白' : '系统通知',
        label: `${msg.type === 'right' ? userProfile.name || '用户' : msg.type === 'left' ? chat.name || '角色' : msg.type === 'narration' ? '旁白' : '系统通知'} · ${String(formattedContent).slice(0, 30) || '空消息'}`,
        text: String(formattedContent || ''),
        messageRole: msg.type === 'left' || msg.type === 'narration' ? 'assistant' : 'user',
        messageId: msg.id,
        reason: '位于当前历史消息保留范围内'
      })
      if (mediaBase64) {
        pushContextTrace(options.trace, {
          id: `media:${msg.id}`,
          category: 'media',
          group: isEmojiMessage ? '表情包图像' : '聊天图片',
          label: isEmojiMessage ? emojiName || '表情包' : imageDescription || '图片',
          text: '[图片内容由模型平台按尺寸另行计费]',
          messageId: msg.id,
          reason: '该媒体未被文字总结替代'
        })
      }
    }
  }

  if (offlineMeetMode) {
    const postHistoryPrompt = buildOfflinePostHistoryPrompt(chat, userProfile)
    if (postHistoryPrompt) messages.push({ role: 'system', content: postHistoryPrompt })
    pushContextTrace(options.trace, { id: 'runtime:offline-history', category: 'system', group: '线下模式', label: '线下结束后历史规则', text: postHistoryPrompt, reason: '当前处于线下互动模式' })
  }

  return messages
}
