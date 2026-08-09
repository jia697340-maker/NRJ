/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { useChatAuth } from '../useChatAuth'
import { mockChats, customGroups, avatarStore } from './state'

export const sortChats = () => {
  mockChats.value.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return 0
  })
}

export const loadCustomContacts = async () => {
  const { currentChatUserId } = useChatAuth()
  const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
  const savedStr = localStorage.getItem(contactsKey)
  const savedContacts = savedStr ? JSON.parse(savedStr) : []
  
  const groupsKey = currentChatUserId.value ? `clingy_chat_groups_${currentChatUserId.value}` : 'clingy_chat_groups'
  const savedGroupsStr = localStorage.getItem(groupsKey)
  customGroups.value = savedGroupsStr ? JSON.parse(savedGroupsStr) : []

  const currentTypingState = new Map()
  if (mockChats.value) {
    mockChats.value.forEach(c => {
      if (c.isTyping) currentTypingState.set(c.id, true)
    })
  }
  
  const customChats = []
  for (const c of savedContacts) {
    let avatarUrl = null
    try {
      const storedAvatar = await avatarStore.getItem<string>(`avatar_contact_${c.id}`)
      if (storedAvatar) {
        avatarUrl = storedAvatar
      } else if (c.avatarKey && c.avatarKey.startsWith('localforage:')) {
        // 兼容极其古老的逻辑，万一以前存过
        const realAvatar = await avatarStore.getItem<string>(c.avatarKey.split(':')[1])
        if (realAvatar) avatarUrl = realAvatar
      } else if (c.avatarKey) {
        // 兼容中期的旧逻辑
        const realAvatar = await avatarStore.getItem<string>(c.avatarKey)
        if (realAvatar) avatarUrl = realAvatar
      }
    } catch (e) {
      console.error('Failed to load avatar from indexedDB for contact ' + c.id, e)
    }
    
    let previewText = '新角色已创建'
    let timeText = '刚刚'
    if (c.messages && c.messages.length > 0) {
      const lastMsg = c.messages[c.messages.length - 1]
      previewText = lastMsg.content
      const d = new Date(lastMsg.id > 1000000000000 ? lastMsg.id : Date.now())
      const now = new Date()
      if (d.toDateString() === now.toDateString()) {
        timeText = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      } else {
        timeText = `${d.getMonth() + 1}/${d.getDate()}`
      }
    }
    
    customChats.push({
      id: c.id,
      name: c.remark || c.name,
      realName: c.name,
      remark: c.remark,
      persona: c.persona,
      userProfile: c.userProfile || null,
      userProfileSource: c.userProfileSource || null,
      preview: previewText,
      time: timeText,
      unread: c.unread || 0,
      avatarText: c.name.charAt(0) || '新',
      avatarUrl: avatarUrl,
      isPinned: !!c.isPinned,
      groups: c.groups || [],
      boundWorldBooks: c.boundWorldBooks || [],
      boundWorldBookGroups: c.boundWorldBookGroups || [],
      memoryType: c.memoryType || 'count',
      memoryValue: c.memoryValue || null,
      timezone: c.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      enableEmojiVision: c.enableEmojiVision ?? false,
      enableRoleEmojiVision: c.enableRoleEmojiVision ?? false,
      timePerception: c.timePerception ?? false,
      sendCharacterTime: c.sendCharacterTime ?? true,
      memoryBook: c.memoryBook || [],
      callSummaries: c.callSummaries || [],
      autoSummaryEnabled: c.autoSummaryEnabled ?? false,
      autoSummaryThreshold: c.autoSummaryThreshold || 500,
      autoSummaryTokenThreshold: c.autoSummaryTokenThreshold || 6000,
      autoSummaryTrigger: c.autoSummaryTrigger || 'both',
      autoSummaryOnImportant: c.autoSummaryOnImportant ?? true,
      autoSummaryOnTopicChange: c.autoSummaryOnTopicChange ?? false,
      autoSummaryOnExit: c.autoSummaryOnExit ?? false,
      autoSummaryIdleMinutes: c.autoSummaryIdleMinutes || 0,
      memoryMode: c.memoryMode || 'hybrid',
      memoryBatchSize: c.memoryBatchSize || 150,
      memoryTokenBudget: c.memoryTokenBudget || 1200,
      autoMemoryConsolidation: c.autoMemoryConsolidation ?? true,
      memoryConsolidationThreshold: c.memoryConsolidationThreshold || 8,
      memoryState: c.memoryState || null,
      lastSummaryMsgId: c.lastSummaryMsgId || 0,
      messages: c.messages || [],
      innerThoughts: c.innerThoughts || [],
      enableAutoThought: c.enableAutoThought ?? false,
      thoughtWithImage: c.thoughtWithImage ?? false,
      thoughtWithAudio: c.thoughtWithAudio ?? false,
      enableNAIImageGen: c.enableNAIImageGen ?? false,
      imageGenProvider: c.imageGenProvider || 'novelai',
      naiConfig: c.naiConfig || null,
      gptImageConfig: c.gptImageConfig || null,
      geminiImageConfig: c.geminiImageConfig || null,
      fluxImageConfig: c.fluxImageConfig || null,
      nijiImageConfig: c.nijiImageConfig || null,
      seedreamImageConfig: c.seedreamImageConfig || null,
      naiImagePrompt: c.naiImagePrompt || '',
      naiImageNegativePrompt: c.naiImageNegativePrompt || '',
      naiImageResolution: c.naiImageResolution || '1024x1024',
      enableVoiceReply: c.enableVoiceReply ?? false,
      enableVoiceCall: c.enableVoiceCall ?? false,
      enableVideoCall: c.enableVideoCall ?? false,
      voiceProvider: c.voiceProvider === 'seed_audio' || c.voiceProvider === 'gemini' || c.voiceProvider === 'elevenlabs' ? c.voiceProvider : 'minimax',
      voiceModel: c.voiceModel || 'speech-2.6-turbo',
      voiceId: c.voiceId || '',
      voiceLanguage: c.voiceLanguage || '',
      voiceStream: c.voiceStream ?? true,
      voiceSpeed: c.voiceSpeed ?? 1.0,
      voicePitch: c.voicePitch ?? 1.0,
      voiceVolume: c.voiceVolume ?? 1.0,
      voiceEmotion: c.voiceEmotion || '',
      seedAudioMode: c.seedAudioMode === 'scene' ? 'scene' : 'speech',
      seedAudioPromptPrefix: c.seedAudioPromptPrefix || '',
      seedAudioReferenceUrls: Array.isArray(c.seedAudioReferenceUrls) ? c.seedAudioReferenceUrls : [],
      seedAudioMultilingual: c.seedAudioMultilingual ?? true,
      geminiVoiceName: c.geminiVoiceName || 'Kore',
      geminiVoicePrompt: c.geminiVoicePrompt || '',
      elevenLabsVoiceId: c.elevenLabsVoiceId || '',
      elevenLabsModel: c.elevenLabsModel || '',
      elevenLabsLanguage: c.elevenLabsLanguage || '',
      elevenLabsStability: c.elevenLabsStability ?? 0.5,
      elevenLabsSimilarity: c.elevenLabsSimilarity ?? 0.75,
      elevenLabsStyle: c.elevenLabsStyle ?? 0,
      elevenLabsSpeakerBoost: c.elevenLabsSpeakerBoost ?? true,
      elevenLabsSpeed: c.elevenLabsSpeed ?? 1,
      bilingualEnabled: c.bilingualEnabled ?? false,
      bilingualMode: c.bilingualMode || 'auto',
      dialogueLanguage: c.dialogueLanguage || 'auto',
      customDialogueLanguage: c.customDialogueLanguage || '',
      translationLanguage: c.translationLanguage || 'app',
      customTranslationLanguage: c.customTranslationLanguage || '',
      translationDisplay: c.translationDisplay || 'tap',
      charSpeaksFirstOnCall: c.charSpeaksFirstOnCall ?? false,
      enableMsgCountLimit: c.enableMsgCountLimit ?? false,
      minMsgCount: c.minMsgCount || 1,
      maxMsgCount: c.maxMsgCount || 3,
      offlineMeetEnabled: c.offlineMeetEnabled ?? false,
      offlineMeetMode: c.offlineMeetMode || 'mixed',
      offlinePresetId: c.offlinePresetId && c.offlinePresetId !== 'offline_preset_daily' ? c.offlinePresetId : 'offline_default',
      offlineModelProfile: c.offlineModelProfile || 'auto',
      offlineMeetLocationMode: c.offlineMeetLocationMode || 'vague',
      offlineMeetSessions: Array.isArray(c.offlineMeetSessions) ? c.offlineMeetSessions : [],
      activeOfflineSessionId: c.activeOfflineSessionId || null,
      enableImmersiveStatus: c.enableImmersiveStatus ?? false,
      statusText: c.statusText || '',
      offlineUntil: c.offlineUntil || 0,
      isTyping: currentTypingState.get(c.id) || false
    })
  }
  
  const sysPinned = localStorage.getItem('clingy_system_notice_pinned') === '1'
  const sysRead = localStorage.getItem('clingy_system_notice_read') === '1'
  
  let sysMessages = []
  try {
    const savedSysMsgs = localStorage.getItem('clingy_system_messages')
    if (savedSysMsgs) sysMessages = JSON.parse(savedSysMsgs)
  } catch(e) {}
  
  if (sysMessages.length === 0) {
    sysMessages = [{ id: 1, type: 'left', content: '欢迎使用，请创建你的专属陪伴。' }]
  }
  
  let sysPreview = '欢迎使用，请创建你的专属陪伴。'
  let sysTime = '刚刚'
  if (sysMessages.length > 0) {
    const lastMsg = sysMessages[sysMessages.length - 1]
    sysPreview = lastMsg.content
    const d = new Date(lastMsg.id > 1000000000000 ? lastMsg.id : Date.now())
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      sysTime = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } else {
      sysTime = `${d.getMonth() + 1}/${d.getDate()}`
    }
  }

  const baseMock = [
    { 
      id: 1, name: '系统通知', realName: '系统通知', remark: '', persona: '系统内置的通知助手。', preview: sysPreview, time: sysTime, unread: sysRead ? 0 : 1, avatarText: '通', isPinned: sysPinned,
      groups: [],
      messages: sysMessages,
      isTyping: currentTypingState.get(1) || false
    }
  ]
  
  mockChats.value = [...baseMock, ...customChats]
  sortChats()
}

export const deleteChats = async (ids: (string | number)[]) => {
  const idsToDelete = ids.filter(id => id !== 1) // 保护系统通知
  if (idsToDelete.length === 0) return
  
  const { currentChatUserId } = useChatAuth()
  const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
  const savedStr = localStorage.getItem(contactsKey)
  if (savedStr) {
    let contacts = JSON.parse(savedStr)
    const toDeleteContacts = contacts.filter((c: any) => idsToDelete.includes(c.id))
    
    for (const c of toDeleteContacts) {
      if (c.avatarKey) {
        await avatarStore.removeItem(c.avatarKey)
      }
    }
    
    contacts = contacts.filter((c: any) => !idsToDelete.includes(c.id))
    localStorage.setItem(contactsKey, JSON.stringify(contacts))
  }
  
  mockChats.value = mockChats.value.filter(c => !idsToDelete.includes(c.id))
}
