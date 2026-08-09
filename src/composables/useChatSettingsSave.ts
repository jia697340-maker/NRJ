/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { useChatState } from './useChatState'
import { useChatAuth } from './useChatAuth'

export function useChatSettingsSave() {
  const { selectedChat, myProfile, mockChats } = useChatState()

  const saveCurrentChat = async () => {
    if (!selectedChat.value) return
    const { currentChatUserId } = useChatAuth()
    const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
    const savedStr = localStorage.getItem(contactsKey)
    if (savedStr) {
      let contacts = JSON.parse(savedStr)
      const idx = contacts.findIndex((c: any) => c.id === selectedChat.value.id)
      if (idx !== -1) {
        contacts[idx].name = selectedChat.value.realName
        contacts[idx].remark = selectedChat.value.remark
        contacts[idx].persona = selectedChat.value.persona
        contacts[idx].userProfile = selectedChat.value.userProfile || null
        contacts[idx].userProfileSource = selectedChat.value.userProfileSource || null
        contacts[idx].boundWorldBooks = selectedChat.value.boundWorldBooks || []
        contacts[idx].boundWorldBookGroups = selectedChat.value.boundWorldBookGroups || []
        contacts[idx].memoryType = selectedChat.value.memoryType || 'count'
        contacts[idx].memoryValue = selectedChat.value.memoryValue || null
        contacts[idx].timezone = selectedChat.value.timezone || myProfile.value.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        contacts[idx].enableEmojiVision = selectedChat.value.enableEmojiVision ?? false
        contacts[idx].enableRoleEmojiVision = selectedChat.value.enableRoleEmojiVision ?? false
        contacts[idx].timePerception = selectedChat.value.timePerception ?? false
        contacts[idx].sendCharacterTime = selectedChat.value.sendCharacterTime ?? true
        contacts[idx].showCostTime = selectedChat.value.showCostTime ?? true
        contacts[idx].memoryBook = selectedChat.value.memoryBook || []
        contacts[idx].callSummaries = selectedChat.value.callSummaries || []
        contacts[idx].autoSummaryEnabled = selectedChat.value.autoSummaryEnabled ?? false
        contacts[idx].autoSummaryThreshold = selectedChat.value.autoSummaryThreshold || null
        contacts[idx].autoSummaryTokenThreshold = selectedChat.value.autoSummaryTokenThreshold || 6000
        contacts[idx].autoSummaryTrigger = selectedChat.value.autoSummaryTrigger || 'both'
        contacts[idx].autoSummaryOnImportant = selectedChat.value.autoSummaryOnImportant ?? true
        contacts[idx].autoSummaryOnTopicChange = selectedChat.value.autoSummaryOnTopicChange ?? false
        contacts[idx].autoSummaryOnExit = selectedChat.value.autoSummaryOnExit ?? false
        contacts[idx].autoSummaryIdleMinutes = selectedChat.value.autoSummaryIdleMinutes || 0
        contacts[idx].memoryMode = selectedChat.value.memoryMode || 'hybrid'
        contacts[idx].memoryBatchSize = selectedChat.value.memoryBatchSize || 150
        contacts[idx].memoryTokenBudget = selectedChat.value.memoryTokenBudget || 1200
        contacts[idx].autoMemoryConsolidation = selectedChat.value.autoMemoryConsolidation ?? true
        contacts[idx].memoryConsolidationThreshold = selectedChat.value.memoryConsolidationThreshold || 8
        contacts[idx].memoryState = selectedChat.value.memoryState || null
        contacts[idx].summaryPrompt = selectedChat.value.summaryPrompt || ''
        contacts[idx].lastSummaryMsgId = selectedChat.value.lastSummaryMsgId || 0
        // 删除 contacts[idx].messages = selectedChat.value.messages || [] 避免 QuotaExceededError，聊天记录应由单独存储管理

        // 心声设置持久化
        contacts[idx].enableAutoThought = selectedChat.value.enableAutoThought ?? false
        contacts[idx].thoughtWithImage = selectedChat.value.thoughtWithImage ?? false
        contacts[idx].thoughtWithAudio = selectedChat.value.thoughtWithAudio ?? false
        
        // NAI生图设置持久化
        contacts[idx].enableNAIImageGen = selectedChat.value.enableNAIImageGen ?? false
        contacts[idx].imageGenProvider = selectedChat.value.imageGenProvider || 'novelai'
        contacts[idx].naiImagePrompt = selectedChat.value.naiImagePrompt || ''
        contacts[idx].naiImageNegativePrompt = selectedChat.value.naiImageNegativePrompt || ''
        contacts[idx].naiImageResolution = selectedChat.value.naiImageResolution || '1024x1024'
        
        // 过滤 naiConfig 中可能导致体积过大的 base64 数据
        let cleanNaiConfig = null
        if (selectedChat.value.naiConfig) {
          cleanNaiConfig = { ...selectedChat.value.naiConfig }
          // 如果这里面含有任何类似 reference_image_multiple 等带 base64 的参数，将其剔除
          if (cleanNaiConfig.reference_image_multiple) delete cleanNaiConfig.reference_image_multiple
          if (cleanNaiConfig.reference_image) delete cleanNaiConfig.reference_image
        }
        contacts[idx].naiConfig = cleanNaiConfig
        contacts[idx].gptImageConfig = selectedChat.value.gptImageConfig
          ? JSON.parse(JSON.stringify(selectedChat.value.gptImageConfig))
          : null
        contacts[idx].geminiImageConfig = selectedChat.value.geminiImageConfig
          ? JSON.parse(JSON.stringify(selectedChat.value.geminiImageConfig))
          : null
        contacts[idx].fluxImageConfig = selectedChat.value.fluxImageConfig
          ? JSON.parse(JSON.stringify(selectedChat.value.fluxImageConfig))
          : null

        // 语音设置持久化
        contacts[idx].enableVoiceReply = selectedChat.value.enableVoiceReply ?? false
        contacts[idx].enableVoiceCall = selectedChat.value.enableVoiceCall ?? false
        contacts[idx].enableVideoCall = selectedChat.value.enableVideoCall ?? false
        contacts[idx].voiceModel = selectedChat.value.voiceModel || 'speech-2.6-turbo'
        contacts[idx].voiceId = selectedChat.value.voiceId || ''
        contacts[idx].voiceLanguage = selectedChat.value.voiceLanguage || ''
        contacts[idx].voiceStream = selectedChat.value.voiceStream ?? true
        contacts[idx].voiceSpeed = selectedChat.value.voiceSpeed ?? 1.0
        contacts[idx].voicePitch = selectedChat.value.voicePitch ?? 1.0
        contacts[idx].voiceVolume = selectedChat.value.voiceVolume ?? 1.0
        contacts[idx].voiceEmotion = selectedChat.value.voiceEmotion || ''
        contacts[idx].bilingualEnabled = selectedChat.value.bilingualEnabled ?? false
        contacts[idx].bilingualMode = selectedChat.value.bilingualMode || 'auto'
        contacts[idx].dialogueLanguage = selectedChat.value.dialogueLanguage || 'auto'
        contacts[idx].customDialogueLanguage = selectedChat.value.customDialogueLanguage || ''
        contacts[idx].translationLanguage = selectedChat.value.translationLanguage || 'app'
        contacts[idx].customTranslationLanguage = selectedChat.value.customTranslationLanguage || ''
        contacts[idx].translationDisplay = selectedChat.value.translationDisplay || 'tap'
        contacts[idx].charSpeaksFirstOnCall = selectedChat.value.charSpeaksFirstOnCall ?? false

        // 回复条数控制持久化
        contacts[idx].enableMsgCountLimit = selectedChat.value.enableMsgCountLimit ?? false
        contacts[idx].minMsgCount = selectedChat.value.minMsgCount || 1
        contacts[idx].maxMsgCount = selectedChat.value.maxMsgCount || 3

        // 线下见面设置持久化
        contacts[idx].offlineMeetEnabled = selectedChat.value.offlineMeetEnabled ?? false
        contacts[idx].offlineMeetMode = selectedChat.value.offlineMeetMode || 'mixed'
        contacts[idx].offlinePresetId = selectedChat.value.offlinePresetId || 'offline_default'
        contacts[idx].offlineModelProfile = selectedChat.value.offlineModelProfile || 'auto'
        contacts[idx].offlineMeetLocationMode = selectedChat.value.offlineMeetLocationMode || 'vague'
        contacts[idx].offlineMeetSessions = selectedChat.value.offlineMeetSessions || []
        contacts[idx].activeOfflineSessionId = selectedChat.value.activeOfflineSessionId || null
        
        selectedChat.value.name = selectedChat.value.remark || selectedChat.value.realName
        selectedChat.value.avatarText = selectedChat.value.avatarUrl ? '' : ((selectedChat.value.realName || selectedChat.value.name).charAt(0) || '伴')
        
        localStorage.setItem(contactsKey, JSON.stringify(contacts))
        
        const listIdx = mockChats.value.findIndex(c => c.id === selectedChat.value.id)
        if(listIdx !== -1) {
          mockChats.value[listIdx].name = selectedChat.value.name
          mockChats.value[listIdx].avatarText = selectedChat.value.avatarText
        }
      }
    }
  }

  const saveMyProfileLocal = () => {
    const personasStr = localStorage.getItem('app_chat_personas')
    const activeIndex = localStorage.getItem('app_chat_active_persona_index') || '0'
    if (personasStr) {
      try {
        let personas = JSON.parse(personasStr)
        let p = personas[parseInt(activeIndex)]
        if (p) {
          p.name = myProfile.value.name
          p.signature = myProfile.value.persona
          p.customText = myProfile.value.remark
          p.avatar = myProfile.value.avatarUrl
          localStorage.setItem('app_chat_personas', JSON.stringify(personas))
        }
      } catch(e) {}
    }
  }

  return {
    saveCurrentChat,
    saveMyProfileLocal
  }
}
