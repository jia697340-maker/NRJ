/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { worldBooks, globalPromptSettings, chatSettings, getActivePromptItems, systemPromptItemIds } from '../../store'
import { getEffectiveUserProfile } from '../useChatUserProfiles'
import { myProfile } from './state'
import { buildOfflineMeetPrompt } from '../useOfflineMeetPrompt'
import { pushContextTrace, type ContextTraceCollector } from '../../services/contextTrace'
import { buildPresenceContext } from '../../services/presenceLifecycle'
import { resolvePromptVariables } from '../../services/promptVariables'
import { buildSocialProfilePrompt } from '../../services/characterSocialProfile'
import { useChatAuth } from '../useChatAuth'
import {
  buildEnglishCallFormatRules,
  buildEnglishFormatRules,
  buildEnglishMessageCountRule,
  buildEnglishRelationshipRules,
  buildEnglishStatusPanel,
  buildEnglishTimeContext,
  buildEnglishVoiceRules,
  englishBubbleNarrationRules,
  englishDialogueLanguageGuard,
  englishEmojiWarning,
  englishOfflineFormatRules
} from '../../services/promptRuntimeEnglish'

export const buildSystemPrompt = (
  chat: any,
  roleEmojisStr: string = '无',
  callMode: false | 'voice' | 'video' = false,
  offlineMeetMode: false | 'mixed' | 'separate' = false,
  trace?: ContextTraceCollector,
  runtimeMode: 'single' | 'group' = 'single'
) => {
  const charName = chat.name || '角色'
  const userProfile = getEffectiveUserProfile(chat, myProfile.value)
  const userName = userProfile.name || '我'
  const usesNaturalPromptV2 = globalPromptSettings.activePresetId === 'v2'
  const usesEnglishPrompt = globalPromptSettings.language === 'en'
  
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
    const userTime = now.toLocaleString('zh-CN', { timeZone: userProfile.timezone })
    const charTime = now.toLocaleString('zh-CN', { timeZone: chat.timezone || userProfile.timezone })
    timeContext = usesEnglishPrompt
      ? buildEnglishTimeContext(chat.timezone || userProfile.timezone, charTime, userProfile.timezone, userTime)
      : `\n【当前时间】\n你：${chat.timezone || userProfile.timezone} ${charTime}\n对方：${userProfile.timezone} ${userTime}`
    
    const charTimeRule = chat.sendCharacterTime !== false
      ? '- 你的历史消息也会用 <msg time="YYYY-MM-DD HH:mm"> 包裹，供你参考自己过去回复的时间。\n'
      : ''

    formatRules = `【对话格式与回复习惯】
- 对方的每条消息会用 <user_msg time="YYYY-MM-DD HH:mm"> 包裹，其中包含了发送的精确当地时间。
- 对方也有可能会发语音给你，用 <user_voice_msg seconds="时长秒数">[对方发来一段语音，转文字内容：xxxx]</user_voice_msg> 包裹。如果是语音，你可以表现出你是在“听”而不是在“看”文字。
- 对方可能会发图片给你，用 <user_image_msg>[对方发来一张图片，描述：xxxx]</user_image_msg> 包裹。你应该能“看”到图片里的内容。
${charTimeRule}- 请敏锐地感知时间信息。留意连续多条消息之间的时间间隔，以及你和对方发言的时间差（例如对方几个小时没理你，或者你隔了很久才回对方），并作出符合真实时间流逝的自然反应。
${usesNaturalPromptV2
? '- 根据内容自然决定发送一条或多条消息。每个气泡承载一个自然完整的表达，不为模拟真人而机械拆句。'
: '- 你发消息像真人一样，想到什么说什么，经常分成多条发。一条消息通常就一个表达。'}
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
${usesNaturalPromptV2
? '- 根据内容自然决定发送一条或多条消息。每个气泡承载一个自然完整的表达，不为模拟真人而机械拆句。'
: '- 你发消息像真人一样，想到什么说什么，经常分成多条发。一条消息通常就一个表达。'}
- 对方可能会发表情包给你，用 <user_emoji_msg name="表情包名称">[对方发来一个名为“表情包名称”的表情包]</user_emoji_msg> 包裹。如果视觉模型开启，你还能直接看到该表情包的图像画面。
- 你的每条回复必须用 <msg> 标签包裹。转账、红包、语音等特殊动作标签（如果可用的话）独立存在，不要包裹在 <msg> 内。
- 如果你想主动给对方发图片（包括照片、视频或GIF等任何视觉画面），请使用 <send_image>这里写出具体的画面描述</send_image> 标签。这也是独立存在的动作标签。
示例格式：
<msg>我刚忙完</msg>
<send_image>我正坐在靠窗的沙发上，窗外是晚霞，桌上放着一杯热气腾腾的咖啡。</send_image>
<msg>你看这晚霞好漂亮</msg>
- 记住，没有被相应标签包裹的内容不会被展示给对方。`
  }

  if (usesEnglishPrompt) {
    formatRules = buildEnglishFormatRules({
      timePerception: Boolean(chat.timePerception),
      usesNaturalPromptV2,
      includeCharacterTime: chat.sendCharacterTime !== false
    })
  }

  if (runtimeMode === 'group') {
    formatRules = `【群聊成员输入理解】\n你会收到带发送者身份、消息类型、引用和时间的群聊历史。结合这些信息自然反应；最终输出外层必须严格遵循群聊协调器给出的 group_msg / group_inner_thought 协议，不得使用单聊标签。`
  }


  if (offlineMeetMode) {
    formatRules = usesEnglishPrompt
      ? englishOfflineFormatRules
      : `【线下输出格式】\n当前是线下面对面互动，具体回复格式由线下预设约束。`
  } else if (!callMode && chat.bubbleNarrationEnabled) {
    formatRules += usesEnglishPrompt ? `\n\n${englishBubbleNarrationRules}` : `\n\n【气泡叙事模式】
- 这是线上气泡聊天与叙事描写结合的模式。角色真正说出口的话仍使用 <msg>...</msg>，每个 <msg> 会显示为角色气泡。
- 动作、神态、环境变化或必要的心理描写必须独立使用 <narration kind="action">...</narration>、<narration kind="scene">...</narration> 或 <narration kind="thought">...</narration>，它们会显示为气泡之间的无归属叙述块。
- <narration> 中必须使用第三人称或自然的镜头语言。涉及人物时，明确使用 ${charName}、${userName} 等姓名，不用“你”“我”等第一、第二人称代词；不要把对话放进叙述标签，也不要用括号、星号或 <msg> 气泡冒充动作描写。
- 只在能推动情绪、动作或场景时加入叙述，保持简洁自然；不要每条气泡后机械添加，不要替对方决定动作、感受或内心。
示例：
<msg>你怎么现在才回来？</msg>
<narration kind="action">${charName}靠在门边，语气听起来平静，目光却一直落在${userName}身上。</narration>
<msg>我等了你好久。</msg>`
  }

  if (chat.enableMsgCountLimit && !offlineMeetMode) {
    formatRules += usesEnglishPrompt
      ? `\n${buildEnglishMessageCountRule(chat.minMsgCount || 1, chat.maxMsgCount || 3)}`
      : `\n[强制约束：本次回复你必须精确输出 ${chat.minMsgCount || 1} 到 ${chat.maxMsgCount || 3} 条消息。即：在你的整个回复中，必须包含 ${chat.minMsgCount || 1} 到 ${chat.maxMsgCount || 3} 个完整的 <msg>...</msg> 标签，绝不可少于下限或多于上限！]`
  }

  // 沉浸式状态面板插槽
  let statusPanelContent = ''
  if (chat.enableImmersiveStatus) {
    if (usesEnglishPrompt) {
      statusPanelContent = buildEnglishStatusPanel(chat.statusText, userProfile.statusText)
    } else {
    let statusMsg = ''
    if (chat.statusText && chat.statusText !== 'none') {
      statusMsg += `你的公开状态：【${chat.statusText}】。`
    }
    if (userProfile.statusText) {
      statusMsg += `对方的公开状态：【${userProfile.statusText}】。`
    }
    if (statusMsg) {
      statusPanelContent = `\n[当前状态面板]\n${statusMsg}\n(注：这是你自己/对方当前公开的状态，请根据你的角色人设互动。)`
    }
    }
  }
  const presenceContext = chat.enableImmersiveStatus ? buildPresenceContext(chat, usesEnglishPrompt) : ''

  // 占位符替换字典
  const placeholders: Record<string, string> = {
    '{{char_name}}': charName,
    '{{user_name}}': userName,
    '{{char_persona}}': chat.persona || (usesEnglishPrompt ? '(No specific persona provided)' : '（无具体人设）'),
    '{{user_persona}}': userProfile.persona || (usesEnglishPrompt ? '(No specific profile provided)' : '（无具体人设）'),
    '{{world_book}}': worldBookContent || (usesEnglishPrompt ? '(No world setting provided)' : '（无世界设定）'),
    '{{time_context}}': timeContext,
    '{{role_emojis}}': roleEmojisStr,
    '{{format_rules}}': formatRules,
    '{{status_panel}}': statusPanelContent
  }

  // 长期记忆由 buildChatMessages 按当前话题与 Token 预算动态检索，禁止在这里全量注入。
  const memoryBookContext = ''

  // 从 globalPromptSettings 动态构建 Prompt
  let activePromptItems = getActivePromptItems().map((i: any) => ({ ...i })).filter((i: any) => {
    // 如果全局设置关掉了允许主动来电，则不发送对应规则，让角色彻底不知道自己能打电话
    if (i.id === 'prompt_voice_call_user_rules' && chatSettings.enableCharVoiceCall === false) {
      return false
    }
    if (i.id === 'prompt_video_call_user_rules' && chatSettings.enableCharVideoCall === false) {
      return false
    }
    return i.enabled
  })
  if (runtimeMode === 'group') {
    const unsupportedGroupItems = new Set([
      'prompt_recall_mechanism', 'prompt_quote_mechanism', 'prompt_transfer_mechanism',
      'prompt_voice_call_user_rules', 'prompt_video_call_user_rules', 'prompt_moment_rules',
      'prompt_immersive_status'
    ])
    activePromptItems = activePromptItems.filter((item: any) => !unsupportedGroupItems.has(item.id))
  }

  
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
    if (usesEnglishPrompt) {
      formatRules = buildEnglishCallFormatRules(chat.timePerception ? timeContext : '')
    } else {
      formatRules = `【通话格式要求】\n严格按照当前通话模式的要求使用纯文本进行口语化回复。`
      if (chat.timePerception) {
        formatRules += `\n${timeContext}\n- 请敏锐地感知时间信息。留意连续多条消息之间的时间间隔，以及你和对方发言的时间差（例如对方几个小时没理你，或者你隔了很久才回对方），并作出符合真实时间流逝的自然反应。`
      }
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
  const voiceRules = usesEnglishPrompt ? buildEnglishVoiceRules(usesNaturalPromptV2) : usesNaturalPromptV2 ? `【语音输出规则】
你的回复将直接用于语音合成（TTS）。只能输出角色真正说出口的纯文本，严禁加入动作描写、旁白、颜文字或表情符号。
保持符合人设的口语节奏：句子长短、停顿、语气词和措辞由角色性格、当下情绪与具体内容决定。不要为了制造“活人感”机械堆叠逗号、省略号、口癖或气声，也不要用书面总结、分点说教和过长从句。自然清楚地说完此刻真正要表达的内容。` : `【语音输出规则】
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

  const relationship = chat.relationship
  const disclosedAccounts = (relationship?.disclosedLinkedAccountIds || []).map((id: string) => {
    const account = useChatAuth().chatAccounts.value.find(item => item.id === id)
    return account ? `${account.name}（ID：${account.accountId}）` : id
  })
  let relationshipRules = ''
  if (!callMode && !offlineMeetMode && usesEnglishPrompt) {
    relationshipRules = buildEnglishRelationshipRules(relationship)
  } else if (!callMode && !offlineMeetMode && (!relationship || (relationship.friendship === 'friends' && relationship.blockedBy === 'none'))) {
    relationshipRules = `\n\n【好友关系自主行为】\n如果人物在当前情境下确实会主动拉黑或删除对方，可以使用以下后台动作。不要为了制造戏剧冲突而频繁使用，也不要提前向对方解释系统机制。\n- 拉黑对方：<block_user>简短的可观察原因</block_user>\n- 删除好友：<delete_friend>简短的可观察原因</delete_friend>\n如果拉黑对方，还可以紧跟 <relationship_plan>分钟数|exact、vague 或 hidden|后续打算</relationship_plan>。分钟数是系统内部真正重新考虑解除拉黑的时间；hidden 只代表不向用户公开。\n这些标签不会作为聊天文字显示。是否执行完全依据人物性格与当前关系。`
  } else if (relationship) {
    relationshipRules = `\n\n【当前好友关系】好友状态：${relationship.friendship}；拉黑状态：${relationship.blockedBy}。严格遵守当前关系的消息可见性，不得假装看见未送达的消息。`
  }
  if (disclosedAccounts.length) {
    relationshipRules += `\n【用户主动说明的账号关联】对方告诉你，${disclosedAccounts.join('、')}也是其本人使用的账号。你可以结合人设决定是否相信以及如何看待，但不得因此读取或假装知道那些账号的私聊内容。`
  }

  const transferStateGuard = usesEnglishPrompt
    ? `\n\n[Transfer state guard] Historical transfer tags are records, not new send commands. You may use <claim> or <reject> only for an item whose receiver="character" and status="pending". Never process your own, claimed, returned, or expired item again.`
    : `\n\n【转账状态保护】历史中的转账标签是已经发生的记录，不是新的发送指令。只有 receiver="character" 且 status="pending" 的款项可以用 <claim> 或 <reject> 处理；严禁再次处理自己发送、已领取、已退还或已过期的款项。`

  // 如果没有任何启用的设定，返回一个兜底
  if (activePromptItems.length === 0) {
    return usesEnglishPrompt
      ? `You are ${charName}.${memoryBookContext}${presenceContext}${transferStateGuard}${englishDialogueLanguageGuard}`
      : `你是${charName}。${memoryBookContext}${presenceContext}${transferStateGuard}`
  }

  // 拼接 UI 上所有的有效条目，并解析占位符
  const resolvedPrompts = activePromptItems.map((item: any) => {
    let content = item.content
    content = resolvePromptVariables(content, Object.fromEntries(
      Object.entries(placeholders).map(([key, value]) => [key.slice(2, -2), value])
    ))
    if (runtimeMode === 'group') {
      const senderId = String(chat.characterEntityId || chat.id || '')
      content = content
        .replace(/<msg(?:\s+[^>]*)?>/gi, `<group_msg sender="${senderId}" kind="text">`)
        .replace(/<\/msg>/gi, '</group_msg>')
        .replace(/<send_image(?:\s+[^>]*)?>/gi, `<group_msg sender="${senderId}" kind="image">`)
        .replace(/<\/send_image>/gi, '</group_msg>')
        .replace(/<send_voice(?:\s+[^>]*)?>/gi, `<group_msg sender="${senderId}" kind="voice">`)
        .replace(/<\/send_voice>/gi, '</group_msg>')
        .replace(/<send_emoji(?:\s+[^>]*)?>/gi, `<group_msg sender="${senderId}" kind="emoji">`)
        .replace(/<\/send_emoji>/gi, '</group_msg>')
        .replace(/<send_transfer(\s+[^>]*)?>/gi, `<group_msg sender="${senderId}" kind="transfer"$1>`)
        .replace(/<\/send_transfer>/gi, '</group_msg>')
        .replace(/<send_red_packet(\s+[^>]*)?>/gi, `<group_msg sender="${senderId}" kind="red_packet"$1>`)
        .replace(/<\/send_red_packet>/gi, '</group_msg>')
        .replace(/<inner_thought(?:\s+[^>]*)?>/gi, `<group_inner_thought sender="${senderId}">`)
        .replace(/<\/inner_thought>/gi, '</group_inner_thought>')
        .replace(/<narration(?:\s+[^>]*)?>/gi, `<group_msg sender="${senderId}" kind="narration">`)
        .replace(/<\/narration>/gi, '</group_msg>')
    }
    // 对于不属于新默认架构的自定义条目，加上名字作为小标题
    if (!systemPromptItemIds.has(item.id)) {
      return `[${item.name}]\n${content}`
    }
    
    // 【根源制止防瞎编规则】如果有表情包，强制追加严厉警告！
    if (item.id === 'prompt_send_emoji_rules' && roleEmojisStr !== '无') {
      content += usesEnglishPrompt
        ? `\n${englishEmojiWarning}`
        : `\n[严重警告：绝对、严禁捏造表情包名称！你只能发送上述列表中精确存在的表情包名称！如果没有合适的，绝对不要使用 <send_emoji> 标签！]`
    }
    
    return content
  })

  const groupForPrompt = (id: string) => {
    if (id === 'prompt_core_identity' || id === 'prompt_finalize') return '身份与收束'
    if (id === 'prompt_format_rules') return '输出格式与协议'
    if (id.includes('moment')) return '朋友圈能力'
    if (id.includes('voice_call') || id.includes('video_call')) return '通话能力'
    if (id.includes('voice')) return '语音能力'
    if (id.includes('emoji')) return '表情包能力'
    if (id.includes('transfer')) return '红包与转账'
    if (id.includes('recall') || id.includes('quote')) return '撤回与引用'
    if (id.includes('media')) return '图片与媒体'
    if (id.includes('thought')) return '心声规则'
    if (id.includes('status')) return '状态与离线'
    if (!id.startsWith('prompt_')) return '自定义提示词'
    return '行为与演绎规则'
  }

  resolvedPrompts.forEach((content, index) => {
    const item = activePromptItems[index]
    const base = { sourceId: item.id, reason: `已启用底层提示词「${item.name}」` }
    if (item.id === 'prompt_char_persona') {
      pushContextTrace(trace, { ...base, id: `${item.id}:persona`, category: 'system', group: '角色人设', label: '角色人设正文', text: String(chat.persona || '') })
      pushContextTrace(trace, { ...base, id: `${item.id}:wrapper`, category: 'system', group: '角色人设', label: '角色人设说明与标题', text: content.replace(String(chat.persona || ''), '') })
      return
    }
    if (item.id === 'prompt_user_persona') {
      pushContextTrace(trace, { ...base, id: `${item.id}:persona`, category: 'system', group: '用户人设', label: '用户人设正文', text: String(userProfile.persona || '') })
      pushContextTrace(trace, { ...base, id: `${item.id}:wrapper`, category: 'system', group: '用户人设', label: '用户人设说明与标题', text: content.replace(String(userProfile.persona || ''), '') })
      return
    }
    if (item.id === 'prompt_world_book') {
      pushContextTrace(trace, { ...base, id: `${item.id}:world`, category: 'world', group: '世界书正文', label: '本轮世界设定正文', text: worldBookContent })
      const boundBooks = worldBooks.filter((book: any) => chat.boundWorldBooks?.includes(book.id) && book.enabled)
      boundBooks.forEach((book: any) => (book.entries || []).filter((entry: any) => entry.enabled).forEach((entry: any) => {
        pushContextTrace(trace, {
          id: `world:${book.id}:${entry.id || entry.title}`,
          parentId: `${item.id}:world`,
          category: 'world',
          group: book.title || book.name || '世界书',
          label: entry.title || '未命名条目',
          text: `${entry.title || ''}: ${entry.content || ''}`,
          counted: false,
          reason: `关联并启用了世界书「${book.title || book.name || '未命名'}」`
        })
      }))
      pushContextTrace(trace, { ...base, id: `${item.id}:time`, category: 'system', group: '时间与状态', label: '当前时间上下文', text: timeContext })
      const wrapper = content.replace(worldBookContent || (usesEnglishPrompt ? '(No world setting provided)' : '（无世界设定）'), '').replace(timeContext, '')
      pushContextTrace(trace, { ...base, id: `${item.id}:wrapper`, category: 'system', group: '输出格式与协议', label: '世界设定标题与说明', text: wrapper })
      return
    }
    pushContextTrace(trace, {
      ...base,
      id: item.id,
      category: 'system',
      group: groupForPrompt(item.id),
      label: item.name,
      text: content
    })
  })

  const offlinePrompt = offlineMeetMode ? buildOfflineMeetPrompt(chat, offlineMeetMode, userProfile) : ''
  pushContextTrace(trace, { id: 'runtime:voice', category: 'system', group: '语音能力', label: '语音回复附加规则', text: finalVoiceRules, reason: '当前角色开启了语音回复' })
  pushContextTrace(trace, { id: 'runtime:relationship', category: 'system', group: '关系规则', label: '好友关系附加规则', text: relationshipRules, reason: '依据当前好友与拉黑状态生成' })
  pushContextTrace(trace, { id: 'runtime:offline', category: 'system', group: '线下模式', label: '线下互动规则', text: offlinePrompt, reason: '当前处于线下互动模式' })
  pushContextTrace(trace, { id: 'runtime:language', category: 'system', group: '输出格式与协议', label: '对白语言保护规则', text: usesEnglishPrompt ? englishDialogueLanguageGuard : '', reason: '当前使用英文底层提示词' })
  pushContextTrace(trace, { id: 'runtime:transfer-state', category: 'system', group: '红包与转账', label: '转账状态保护', text: transferStateGuard, reason: '确保历史转账不会被当作新动作或重复处理' })

  return resolvedPrompts.join('\n\n') + memoryBookContext + presenceContext + finalVoiceRules + relationshipRules + offlinePrompt + transferStateGuard + buildSocialProfilePrompt(chat, usesEnglishPrompt) + (usesEnglishPrompt ? englishDialogueLanguageGuard : '')
}
