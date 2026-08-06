/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed, watch } from 'vue'
import localforage from 'localforage'
import { worldBooks, globalPromptSettings, chatSettings } from '../store'
import { buildOfflineMeetPrompt } from './useOfflineMeetPrompt'
import { useChatAuth } from './useChatAuth'
import { getMomentBehavior } from '../services/moments'

// 全局共享状态（单例外置）
const mockChats = ref<any[]>([])
const selectedChat = ref<any | null>(null)
const myProfile = ref({
  name: '我',
  remark: '',
  persona: '',
  avatarUrl: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  statusText: ''
})

const savedGroupsStr = localStorage.getItem('clingy_chat_groups')
const customGroups = ref<string[]>(savedGroupsStr ? JSON.parse(savedGroupsStr) : [])
const activeGroup = ref('全部')
const SIDEBAR_OPEN_STORAGE_KEY = 'clingy_chat_sidebar_open'
const savedSidebarOpen = localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY)
const isSidebarOpen = ref(savedSidebarOpen === null ? true : savedSidebarOpen === '1')

watch(isSidebarOpen, (open) => {
  localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, open ? '1' : '0')
})

const avatarStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'avatars'
})

// 全局通知状态队列
export interface ChatNotification {
  id: number
  name: string
  avatarUrl: string | null
  avatarText: string
  content: string
}
const globalNotifications = ref<ChatNotification[]>([])
const pendingQueue = ref<ChatNotification[]>([])
let queueTimer: any = null

export function useChatState() {
  const processQueue = async () => {
    import('../store').then(({ chatSettings }) => {
      if (chatSettings.notificationStyle === 'queue') {
        // 排队模式：屏幕上只能同时有 1 条
        if (globalNotifications.value.length > 0) return // 当前还在显示
        if (pendingQueue.value.length === 0) return // 队列空了
        
        // 拿一条出来显示
        const nextNotif = pendingQueue.value.shift()
        if (nextNotif) {
          globalNotifications.value.push(nextNotif)
          
          if (queueTimer) clearTimeout(queueTimer)
          
          queueTimer = setTimeout(() => {
            // 时间到了，隐去
            globalNotifications.value = globalNotifications.value.filter(n => n.id !== nextNotif.id)
            // 等隐去动画结束再处理下一条
            setTimeout(() => {
              processQueue()
            }, 500)
          }, 4000)
        }
      } else {
        // 列表模式：推入并显示最多 3 条（避免太长挡住屏幕），自带 4 秒倒计时
        while (pendingQueue.value.length > 0) {
          const nextNotif = pendingQueue.value.shift()
          if (nextNotif) {
            if (globalNotifications.value.length >= 3) {
              globalNotifications.value.shift() // 挤掉最老的
            }
            globalNotifications.value.push(nextNotif)
            
            setTimeout(() => {
              globalNotifications.value = globalNotifications.value.filter(n => n.id !== nextNotif.id)
            }, 4000)
          }
        }
      }
    })
  }

  const showNotification = (name: string, avatarUrl: string | null, avatarText: string, content: string) => {
    pendingQueue.value.push({
      id: Date.now() + Math.random(),
      name,
      avatarUrl,
      avatarText,
      content
    })
    processQueue()
  }

  const dismissNotification = (id: number) => {
    globalNotifications.value = globalNotifications.value.filter(n => n.id !== id)
    // 被用户手动划走，如果是队列模式，提早处理下一条
    import('../store').then(({ chatSettings }) => {
      if (chatSettings.notificationStyle === 'queue') {
        if (queueTimer) clearTimeout(queueTimer)
        setTimeout(() => {
          processQueue()
        }, 500)
      }
    })
  }

  const sortChats = () => {
    mockChats.value.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return 0
    })
  }

  const loadCustomContacts = async () => {
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
        lastSummaryMsgId: c.lastSummaryMsgId || 0,
        messages: c.messages || [],
        innerThoughts: c.innerThoughts || [],
        enableAutoThought: c.enableAutoThought ?? false,
        thoughtWithImage: c.thoughtWithImage ?? false,
        thoughtWithAudio: c.thoughtWithAudio ?? false,
        enableNAIImageGen: c.enableNAIImageGen ?? false,
        naiConfig: c.naiConfig || null,
        naiImagePrompt: c.naiImagePrompt || '',
        naiImageNegativePrompt: c.naiImageNegativePrompt || '',
        naiImageResolution: c.naiImageResolution || '1024x1024',
        enableVoiceReply: c.enableVoiceReply ?? false,
        enableVoiceCall: c.enableVoiceCall ?? false,
        enableVideoCall: c.enableVideoCall ?? false,
        voiceModel: c.voiceModel || 'speech-2.6-turbo',
        voiceId: c.voiceId || '',
        voiceLanguage: c.voiceLanguage || '',
        voiceStream: c.voiceStream ?? true,
        voiceSpeed: c.voiceSpeed ?? 1.0,
        voicePitch: c.voicePitch ?? 1.0,
        voiceVolume: c.voiceVolume ?? 1.0,
        voiceEmotion: c.voiceEmotion || '',
        charSpeaksFirstOnCall: c.charSpeaksFirstOnCall ?? false,
        enableMsgCountLimit: c.enableMsgCountLimit ?? false,
        minMsgCount: c.minMsgCount || 1,
        maxMsgCount: c.maxMsgCount || 3,
        offlineMeetEnabled: c.offlineMeetEnabled ?? false,
        offlineMeetMode: c.offlineMeetMode || 'mixed',
        offlinePresetId: c.offlinePresetId || 'offline_preset_daily',
        offlineMeetLocationMode: c.offlineMeetLocationMode || 'vague',
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

  const deleteChats = async (ids: (string | number)[]) => {
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

  const loadMyProfile = () => {
    const { currentAccount } = useChatAuth()
    if (currentAccount.value) {
      // Account name is the network name. Do not use it as a fallback here: a
      // newly registered user has not provided a real name yet.
      myProfile.value.name = currentAccount.value.realName || ''
      myProfile.value.avatarUrl = currentAccount.value.avatarUrl
      myProfile.value.persona = currentAccount.value.persona
      const extraKey = `clingy_user_extra_${currentAccount.value.id}`
      const extraStr = localStorage.getItem(extraKey)
      if (extraStr) {
        try {
          const extra = JSON.parse(extraStr)
          myProfile.value.remark = extra.remark || ''
          myProfile.value.timezone = extra.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        } catch(e) {}
      } else {
        myProfile.value.remark = ''
        myProfile.value.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    }
  }

  const saveMyProfile = () => {
    const { currentChatUserId, updateAccount } = useChatAuth()
    if (currentChatUserId.value) {
      updateAccount(currentChatUserId.value, {
        realName: myProfile.value.name,
        avatarUrl: myProfile.value.avatarUrl,
        persona: myProfile.value.persona
      })
      const extraKey = `clingy_user_extra_${currentChatUserId.value}`
      localStorage.setItem(extraKey, JSON.stringify({
        remark: myProfile.value.remark,
        timezone: myProfile.value.timezone
      }))
    }
  }

  const buildSystemPrompt = (chat: any, roleEmojisStr: string = '无', callMode: false | 'voice' | 'video' = false, offlineMeetMode: false | 'mixed' | 'separate' = false) => {
    const charName = chat.name || '角色'
    const userName = myProfile.value.name || '我'
    
    // 构建世界书内容
    let worldBookContent = ''
    if (chat.boundWorldBooks && chat.boundWorldBooks.length > 0) {
      const boundBooks = worldBooks.filter((b: any) => chat.boundWorldBooks.includes(b.id) && b.enabled)
      const entries = []
      for (const book of boundBooks) {
        for (const entry of book.entries) {
          if (entry.enabled) {
            entries.push({
              title: entry.title,
              content: entry.content,
              weight: entry.overrideSettings ? entry.weight : book.globalWeight
            })
          }
        }
      }
      entries.sort((a, b) => a.weight - b.weight)
      if (entries.length > 0) {
        worldBookContent = entries.map(e => `${e.title}: ${e.content}`).join('\n')
      }
    }

    // 构建时间上下文与格式要求
    let timeContext = ''
    let formatRules = ''

    if (chat.timePerception) {
      const now = new Date()
      const userTime = now.toLocaleString('zh-CN', { timeZone: myProfile.value.timezone })
      const charTime = now.toLocaleString('zh-CN', { timeZone: chat.timezone || myProfile.value.timezone })
      timeContext = `\n【当前时间】\n你：${chat.timezone || myProfile.value.timezone} ${charTime}\n对方：${myProfile.value.timezone} ${userTime}`
      
      const charTimeRule = chat.sendCharacterTime !== false
        ? '- 你的历史消息也会用 <msg time="YYYY-MM-DD HH:mm"> 包裹，供你参考自己过去回复的时间。\n'
        : ''

      formatRules = `【对话格式与回复习惯】
- 对方的每条消息会用 <user_msg time="YYYY-MM-DD HH:mm"> 包裹，其中包含了发送的精确当地时间。
- 对方也有可能会发语音给你，用 <user_voice_msg seconds="时长秒数">[对方发来一段语音，转文字内容：xxxx]</user_voice_msg> 包裹。如果是语音，你可以表现出你是在“听”而不是在“看”文字。
- 对方可能会发图片给你，用 <user_image_msg>[对方发来一张图片，描述：xxxx]</user_image_msg> 包裹。你应该能“看”到图片里的内容。
${charTimeRule}- 请敏锐地感知时间信息。留意连续多条消息之间的时间间隔，以及你和对方发言的时间差（例如对方几个小时没理你，或者你隔了很久才回对方），并作出符合真实时间流逝的自然反应。
- 你发消息像真人一样，想到什么说什么，经常分成多条发。一条消息通常就一个表达。
- 对方可能会发表情包给你，用 <user_emoji_msg name="表情包名称">[对方发来一个名为“表情包名称”的表情包]</user_emoji_msg> 包裹。如果视觉模型开启，你还能直接看到该表情包的图像画面。
- 你的每条回复必须用 <msg> 标签包裹（你此刻的回复无需自己加时间，系统会自动处理）。转账、红包、语音等特殊动作标签（如果可用的话）独立存在，不要包裹在 <msg> 内。
- 如果你想主动给对方发图片（包括照片、视频或GIF等任何视觉画面），请使用 <send_image>这里写出具体的画面描述</send_image> 标签。这也是独立存在的动作标签。
  示例格式：
  <msg>我刚忙完</msg>
  <send_image>我正坐在靠窗的沙发上，窗外是晚霞，桌上放着一杯热气腾腾的咖啡。</send_image>
  <msg>你看这晚霞好漂亮</msg>
- 记住，没有被相应标签包裹的内容不会被展示给对方。`
    } else {
      formatRules = `【对话格式与回复习惯】
- 对方的每条消息会用 <user_msg> 包裹。对方可能会连续发送多段话（多个 <user_msg>），请结合它们的内容来理解。
- 对方也有可能会发语音给你，用 <user_voice_msg seconds="时长秒数">[对方发来一段语音，转文字内容：xxxx]</user_voice_msg> 包裹。如果是语音，你可以表现出你是在“听”而不是在“看”文字。
- 对方可能会发图片给你，用 <user_image_msg>[对方发来一张图片，描述：xxxx]</user_image_msg> 包裹。你应该能“看”到图片里的内容。
- 你发消息像真人一样，想到什么说什么，经常分成多条发。一条消息通常就一个表达。
- 对方可能会发表情包给你，用 <user_emoji_msg name="表情包名称">[对方发来一个名为“表情包名称”的表情包]</user_emoji_msg> 包裹。如果视觉模型开启，你还能直接看到该表情包的图像画面。
- 你的每条回复必须用 <msg> 标签包裹。转账、红包、语音等特殊动作标签（如果可用的话）独立存在，不要包裹在 <msg> 内。
- 如果你想主动给对方发图片（包括照片、视频或GIF等任何视觉画面），请使用 <send_image>这里写出具体的画面描述</send_image> 标签。这也是独立存在的动作标签。
  示例格式：
  <msg>我刚忙完</msg>
  <send_image>我正坐在靠窗的沙发上，窗外是晚霞，桌上放着一杯热气腾腾的咖啡。</send_image>
  <msg>你看这晚霞好漂亮</msg>
- 记住，没有被相应标签包裹的内容不会被展示给对方。`
    }

    if (chat.enableMsgCountLimit) {
      formatRules += `\n[强制约束：本次回复你必须精确输出 ${chat.minMsgCount || 1} 到 ${chat.maxMsgCount || 3} 条消息。即：在你的整个回复中，必须包含 ${chat.minMsgCount || 1} 到 ${chat.maxMsgCount || 3} 个完整的 <msg>...</msg> 标签，绝不可少于下限或多于上限！]`
    }

    // 沉浸式状态面板插槽
    let statusPanelContent = ''
    if (chat.enableImmersiveStatus) {
      let statusMsg = ''
      if (chat.statusText && chat.statusText !== 'none') {
        statusMsg += `你的公开状态：【${chat.statusText}】。`
      }
      if (myProfile.value.statusText) {
        statusMsg += `对方的公开状态：【${myProfile.value.statusText}】。`
      }
      if (statusMsg) {
        statusPanelContent = `\n[当前状态面板]\n${statusMsg}\n(注：这是你自己/对方当前公开的状态，请根据你的角色人设互动。)`
      }
    }

    // 占位符替换字典
    const placeholders: Record<string, string> = {
      '{{char_name}}': charName,
      '{{user_name}}': userName,
      '{{char_persona}}': chat.persona || '（无具体人设）',
      '{{user_persona}}': myProfile.value.persona || '（无具体人设）',
      '{{world_book}}': worldBookContent || '（无世界设定）',
      '{{time_context}}': timeContext,
      '{{role_emojis}}': roleEmojisStr,
      '{{format_rules}}': formatRules,
      '{{status_panel}}': statusPanelContent
    }

    // 把记忆书本内容注入
    let memoryBookContext = ''
    if (chat.memoryBook && chat.memoryBook.length > 0) {
      memoryBookContext = `\n\n【系统记忆大纲】\n这里记录了你与对方过去交流的重要记忆总结：\n`
      memoryBookContext += chat.memoryBook.map((m: any) => `- [${m.date}] ${m.content}`).join('\n')
    }

    // 从 globalPromptSettings 动态构建 Prompt
    let activePromptItems = globalPromptSettings.items.map((i: any) => ({ ...i })).filter((i: any) => {
      // 如果全局设置关掉了允许主动来电，则不发送对应规则，让角色彻底不知道自己能打电话
      if (i.id === 'prompt_voice_call_user_rules' && chatSettings.enableCharVoiceCall === false) {
        return false
      }
      if (i.id === 'prompt_video_call_user_rules' && chatSettings.enableCharVideoCall === false) {
        return false
      }
      return i.enabled
    })
    
    // 【根源制止防瞎编规则】如果没表情包，直接把这条规则从大模型视野里抹除掉！
    if (roleEmojisStr === '无') {
      activePromptItems = activePromptItems.filter((i: any) => i.id !== 'prompt_send_emoji_rules')
    }
    
    // 【强制心声规则控制】
    if (!chat.enableAutoThought) {
      activePromptItems = activePromptItems.filter((i: any) => i.id !== 'prompt_inner_thought_rules')
    }
    
    // 【通话模式下过滤特殊指令及心声】
    if (callMode === 'voice' || callMode === 'video') {
      const blockedInCall: string[] = []
      
      if (chatSettings.disableSpecialTagsInCall !== false) {
        blockedInCall.push(
          'prompt_recall_mechanism', 
          'prompt_quote_mechanism',
          'prompt_transfer_mechanism',
          'prompt_send_transfer_rules',
          'prompt_send_voice_rules',
          'prompt_voice_call_user_rules',
          'prompt_video_call_user_rules',
          'prompt_send_media_rules',
          'prompt_send_emoji_rules',
          'prompt_immersive_status'
        )
      }
      
      if (chatSettings.disableThoughtInCall !== false) {
        blockedInCall.push('prompt_inner_thought_rules')
      }
      
      if (blockedInCall.length > 0) {
        activePromptItems = activePromptItems.filter((i: any) => !blockedInCall.includes(i.id))
      }
      
      // 精简 formatRules，去除图片表情包说明，只保留基础时间线感知和要求
      formatRules = `【通话格式要求】\n严格按照当前通话模式的要求使用纯文本进行口语化回复。`
      if (chat.timePerception) {
        formatRules += `\n${timeContext}\n- 请敏锐地感知时间信息。留意连续多条消息之间的时间间隔，以及你和对方发言的时间差（例如对方几个小时没理你，或者你隔了很久才回对方），并作出符合真实时间流逝的自然反应。`
      }
    }

    // 【线下模式下过滤特殊指令及心声】
    if (!callMode && offlineMeetMode !== false) {
      const blockedInOffline: string[] = []
      
      if (chatSettings.disableSpecialTagsInOffline !== false) {
        blockedInOffline.push(
          'prompt_transfer_mechanism',
          'prompt_send_transfer_rules',
          'prompt_send_voice_rules',
          'prompt_voice_call_user_rules',
          'prompt_video_call_user_rules',
          'prompt_send_media_rules',
          'prompt_send_emoji_rules'
        )
      }
      
      if (chatSettings.disableThoughtInOffline !== false) {
        blockedInOffline.push('prompt_inner_thought_rules')
      }
      
      if (blockedInOffline.length > 0) {
        activePromptItems = activePromptItems.filter((i: any) => !blockedInOffline.includes(i.id))
      }
    }
    
    // 【沉浸式状态控制】只有当开关开启时才注入对应的全局提示词
    if (!chat.enableImmersiveStatus) {
      activePromptItems = activePromptItems.filter((i: any) => i.id !== 'prompt_immersive_status')
    }
    
    // 【强制语音输出规则控制】
    const voiceRules = `【语音输出规则】
你的回复将直接用于语音合成（TTS），请严格遵守以下要求以确保“活人感”：
纯对话输出（铁律）：严禁包含任何动作描写（如 *轻笑*、（叹气））、颜文字或表情符号。只能输出角色真正会“说出口”的纯文本。
符合人设的口语化：拒绝任何形式式的说教（如“首先、其次”）、拒绝书面语和过长的从句。请根据当前角色的性格与身份，把句子拆短，确保句子长度符合真人说话时的自然呼吸节奏。
自然的节奏与停顿：通过标点符号来引导语音节奏。多用逗号断句模拟换气；在思考、犹豫或转换话题时，使用省略号（……）来表现真实的停顿感。
贴合性格的语音微操：根据角色的具体性格特征，自然融入符合其人设的语气词或口癖。不要机械堆砌，一切以角色自然的情绪流露为准。`
    
    // 如果开启了角色语音，强制附加这段语音规则
    let finalVoiceRules = ''
    if (chat.enableVoiceReply) {
       finalVoiceRules = `\n\n${voiceRules}`
    }

    // 如果没有任何启用的设定，返回一个兜底
    if (activePromptItems.length === 0) {
      return `你是${charName}。${memoryBookContext}`
    }

    // 拼接 UI 上所有的有效条目，并解析占位符
    const resolvedPrompts = activePromptItems.map((item: any) => {
      let content = item.content
      // 循环替换所有占位符
      for (const [key, value] of Object.entries(placeholders)) {
        content = content.replace(new RegExp(key, 'g'), value)
      }
      // 对于不属于新默认架构的自定义条目，加上名字作为小标题
      if (!item.id.startsWith('prompt_')) {
        return `[${item.name}]\n${content}`
      }
      
      // 【根源制止防瞎编规则】如果有表情包，强制追加严厉警告！
      if (item.id === 'prompt_send_emoji_rules' && roleEmojisStr !== '无') {
        content += `\n[严重警告：绝对、严禁捏造表情包名称！你只能发送上述列表中精确存在的表情包名称！如果没有合适的，绝对不要使用 <send_emoji> 标签！]`
      }
      
      return content
    })

    return resolvedPrompts.join('\n\n') + memoryBookContext + finalVoiceRules + (offlineMeetMode ? buildOfflineMeetPrompt(chat, offlineMeetMode) : '')
  }

  const totalUnreadCount = computed(() => {
    return mockChats.value.reduce((sum, chat) => sum + (chat.unread || 0), 0)
  })

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

  const buildChatMessages = async (chat: any, callMode: false | 'voice' | 'video' = false, offlineMeetMode: false | 'mixed' | 'separate' = false) => {
    const messages: any[] = []
    
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
      const availableEmojis = allEmojis.filter(e => 
        e.category === 'global' || 
        (e.category === 'role' && e.targetId === chat.id)
      )
      
      if (availableEmojis.length > 0) {
        roleEmojisStr = availableEmojis.map(e => e.name).join('、')
        
        // 如果开启了主动发表情包的图形识别
        if (chat.enableRoleEmojiVision) {
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
      const { currentCallTempSummary } = await import('./useVoiceCall').then(m => m.useVoiceCall())
      if (currentCallTempSummary.value) {
        callTempSummaryContext = `\n\n【本次通话前半段提要】\n${currentCallTempSummary.value}\n(注：以上是本次通话前半段的总结，请结合它以及下方的最新明细进行回复。)`
      }
    } else if (callMode === 'video') {
      const { currentVideoCallTempSummary } = await import('./useVideoCall').then(m => m.useVideoCall())
      if (currentVideoCallTempSummary.value) {
        callTempSummaryContext = `\n\n【本次视频通话前半段提要】\n${currentVideoCallTempSummary.value}\n(注：以上是本次视频通话前半段的总结，请结合它以及下方的最新明细进行回复。)`
      }
    }

    // 视频/语音通话模式附加提示
    let callModePrompt = ''
    if (callMode === 'voice') {
      const { taskPromptSettings } = await import('../store')
      const voiceItem = taskPromptSettings.items.find((i: any) => i.id === 'task_voice_call_status')
      if (voiceItem && voiceItem.enabled) {
        callModePrompt = voiceItem.content
      } else {
        callModePrompt = `\n\n【当前模式：语音通话】你们正在进行实时语音通话。请使用口语化表达，不要使用颜文字、表情包标签或动作描写括号。不要发送图片、语音条、表情包或转账。`
      }
    } else if (callMode === 'video') {
      const { taskPromptSettings } = await import('../store')
      const videoItem = taskPromptSettings.items.find((i: any) => i.id === 'task_video_call_status')
      if (videoItem && videoItem.enabled) {
        callModePrompt = videoItem.content
      } else {
        callModePrompt = `\n\n【当前模式：视频通话】你们正在进行实时视频通话。请使用口语化表达，可以自然描述表情、视线和镜头内的动作，但不要使用颜文字、表情包标签或动作描写括号。不要发送图片、语音条、表情包或转账。`
      }
    }

    // 组装系统提示词并推送
    const momentBehavior = getMomentBehavior(chat)
    const momentBehaviorPrompt = chatSettings.enableCharMoments && momentBehavior.enabled
      ? `\n\n【你的朋友圈习惯】活跃时段：${momentBehavior.activeStart}:00-${momentBehavior.activeEnd}:00；文风：${momentBehavior.style}；默认受众：${momentBehavior.audience}。可以只点赞、只评论、两者都做或只看不互动；系统会执行冷却与概率控制。`
      : '\n\n【你的朋友圈习惯】当前不使用朋友圈，不要输出任何朋友圈标签。'
    const sysPrompt = buildSystemPrompt(chat, roleEmojisStr, callMode, offlineMeetMode) + momentBehaviorPrompt + callTempSummaryContext + callModePrompt
    
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
      let validHistory = chat.messages.filter((m: any) => m.type === 'left' || m.type === 'right' || m.type === 'system')
      
      // 【核心逻辑】：普通文字聊天时过滤掉所有通话内对话，防止挤占文字记忆
      if (!callMode) {
        validHistory = validHistory.filter((m: any) => !m.isVoiceCallProcessMsg && !m.isVideoCallProcessMsg)
        // 独立线下页面只保留线下见面消息
        if (offlineMeetMode === 'separate') {
          validHistory = validHistory.filter((m: any) => m.isOfflineMeetMsg)
        }
      } else if (callMode === 'voice') {
        validHistory = validHistory.filter((m: any) => !m.isVideoCallProcessMsg)
      } else if (callMode === 'video') {
        validHistory = validHistory.filter((m: any) => !m.isVoiceCallProcessMsg)
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
         }
      }

      for (const msg of historyToKeep) {
        let formattedContent = msg.content
        let isSystemNotice = false
        
        if (msg.isRecalled) {
          const recallerName = msg.type === 'left' ? (chat.name || '对方') : myProfile.value.name
          formattedContent = `${recallerName}撤回了一条消息，撤回内容为：${msg.content}`
          isSystemNotice = true
        } else if (msg.type === 'system') {
          // 处理系统旁白（例如领取/退回红包）
          formattedContent = msg.content
          isSystemNotice = true
        }

        // 处理引用 (quote)
        let quotePrefix = ''
        if (msg.quote) {
          quotePrefix = `[引用了 @${msg.quote.sender} 的消息: "${msg.quote.content}"]\n`
        }
        
        let isVoice = false
        let isImage = false
        let voiceSeconds = 0

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
          formattedContent = `[对方发来一段语音，转文字内容：${msg.voiceData.text}]`
        } else if (msg.transferData) {
          // 对转账红包的特殊解析渲染给AI
          const td = msg.transferData
          if (td.type === 'transfer') {
            formattedContent = `<transfer id="${td.id}" status="${td.status}" amount="${td.amount}" remark="${td.remark}">`
          } else if (td.type === 'red_packet') {
            if (msg.type === 'left') {
               formattedContent = `<red_packet id="${td.id}" status="${td.status}" amount="${td.amount}" remark="${td.remark}">`
            } else {
               formattedContent = `<red_packet id="${td.id}" status="${td.status}" remark="${td.remark}">` // 不透露金额
            }
          }
        }

        // 提取图片或表情包的 Base64 供未压缩时的视觉识别使用
        if (!isSummaryReplaced) {
          // 拦截：如果这是角色（左侧）发出的，并且开启了角色图片省 Token 选项，则强制跳过提取 Base64
          import('../store').then(({ chatSettings }) => {
            if (msg.type === 'left' && chatSettings.enableRoleImageTokenSaver) {
              return
            }
          })
          
          // 注意上述是异步导入，为了不破坏当前同步/异步流程结构，可以直接判断
          // 但由于 useChatState 是单例且在很多地方调用，最好用一个同步判断
          // 我们上面可以借用 store 的直接 import
          const { chatSettings } = await import('../store')
          
          if (!(msg.type === 'left' && chatSettings.enableRoleImageTokenSaver)) {
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
          const msgTime = new Date(msg.id > 1000000000000 ? msg.id : Date.now())
          const timeStr = msgTime.toLocaleString('zh-CN', { 
            timeZone: msg.type === 'left' ? (chat.timezone || myProfile.value.timezone) : myProfile.value.timezone,
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
          }).replace(/\//g, '-') // 格式化为 YYYY-MM-DD HH:mm
          
          if (isSystemNotice) {
            formattedContent = `<system_notice time="${timeStr}">${formattedContent}</system_notice>`
          } else if (isEmojiMessage && msg.type === 'right') {
            formattedContent = `<user_emoji_msg time="${timeStr}" name="${emojiName}">${quotePrefix}${formattedContent}</user_emoji_msg>`
          } else if (isVoice) {
            formattedContent = `<user_voice_msg time="${timeStr}" seconds="${voiceSeconds}">${quotePrefix}${formattedContent}</user_voice_msg>`
          } else if (isImage) {
            formattedContent = msg.type === 'right' ? `<user_image_msg time="${timeStr}">${quotePrefix}${formattedContent}</user_image_msg>` : `<msg time="${timeStr}">${quotePrefix}${formattedContent}</msg>`
          } else if (msg.type === 'right') {
            formattedContent = `<user_msg time="${timeStr}">${quotePrefix}${formattedContent}</user_msg>`
          } else if (msg.type === 'left' && chat.sendCharacterTime !== false) {
            formattedContent = `<msg time="${timeStr}">${quotePrefix}${formattedContent}</msg>`
          } else {
            formattedContent = `<msg>${quotePrefix}${formattedContent}</msg>`
          }
        } else {
          if (isSystemNotice) {
            formattedContent = `<system_notice>${formattedContent}</system_notice>`
          } else if (isEmojiMessage && msg.type === 'right') {
            formattedContent = `<user_emoji_msg name="${emojiName}">${quotePrefix}${formattedContent}</user_emoji_msg>`
          } else if (isVoice) {
            formattedContent = `<user_voice_msg seconds="${voiceSeconds}">${quotePrefix}${formattedContent}</user_voice_msg>`
          } else if (isImage) {
            formattedContent = msg.type === 'right' ? `<user_image_msg>${quotePrefix}${formattedContent}</user_image_msg>` : `<msg>${quotePrefix}${formattedContent}</msg>`
          } else if (msg.type === 'right') {
            formattedContent = `<user_msg>${quotePrefix}${formattedContent}</user_msg>`
          } else {
            formattedContent = `<msg>${quotePrefix}${formattedContent}</msg>`
          }
        }

        // 如果有多模态图片数据且未被压缩为文字，构造数组
        if (mediaBase64) {
          messages.push({
            role: msg.type === 'left' ? 'assistant' : 'user',
            content: [
              { type: 'text', text: formattedContent },
              { type: 'image_url', image_url: { url: mediaBase64 } }
            ]
          })
        } else {
          messages.push({
            role: msg.type === 'left' ? 'assistant' : 'user',
            content: formattedContent
          })
        }
      }
    }

    return messages
  }

  const checkTransfersExpired = () => {
    const now = Date.now()
    let changed = false
    mockChats.value.forEach(chat => {
      if (chat.messages) {
        chat.messages.forEach((m: any) => {
          if (m.transferData && m.transferData.status === 'pending') {
            if (now >= m.transferData.expireTime) {
              m.transferData.status = 'expired'
              changed = true
              
              if (m.type === 'left') {
                const noun = m.transferData.type === 'red_packet' ? '红包' : '转账'
                chat.messages.push({
                   id: Date.now() + Math.random(),
                   type: 'system',
                   content: `对方发送给你的${noun}超过24小时未被领取，已退回。`
                })
              } else {
                const noun = m.transferData.type === 'red_packet' ? '红包' : '转账'
                chat.messages.push({
                   id: Date.now() + Math.random(),
                   type: 'system',
                   content: `你发送给对方的${noun}超过24小时未被领取，已退回。`
                })
              }
            }
          }
        })
      }
    })
    if (changed) {
      const { currentChatUserId } = useChatAuth()
      const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
      const savedStr = localStorage.getItem(contactsKey)
      if (savedStr) {
        const contacts = JSON.parse(savedStr)
        mockChats.value.forEach(chat => {
          if (chat.id !== 1) {
            const index = contacts.findIndex((c: any) => c.id === chat.id)
            if (index !== -1) {
              contacts[index].messages = chat.messages
            }
          }
        })
        localStorage.setItem(contactsKey, JSON.stringify(contacts))
      }
    }
  }

  return {
    mockChats,
    selectedChat,
    checkTransfersExpired,
    myProfile,
    customGroups,
    activeGroup,
    isSidebarOpen,
    avatarStore,
    totalUnreadCount,
    globalNotifications,
    showNotification,
    dismissNotification,
    sortChats,
    loadCustomContacts,
    deleteChats,
    loadMyProfile,
    saveMyProfile,
    buildChatMessages
  }
}
