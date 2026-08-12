/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export const buildEnglishTimeContext = (charZone: string, charTime: string, userZone: string, userTime: string) => (
  `\n[Current time]\nYou: ${charZone} ${charTime}\nOther person: ${userZone} ${userTime}`
)

export const buildEnglishFormatRules = (options: {
  timePerception: boolean
  usesNaturalPromptV2: boolean
  includeCharacterTime: boolean
}) => {
  const userTag = options.timePerception
    ? '<user_msg time="YYYY-MM-DD HH:mm">'
    : '<user_msg>'
  const characterTimeRule = options.timePerception && options.includeCharacterTime
    ? '- Your historical messages are also wrapped in <msg time="YYYY-MM-DD HH:mm"> so you can interpret the timing of your past replies.\n'
    : ''
  const timingRule = options.timePerception
    ? '- Pay close attention to time: gaps between consecutive messages and delays between each person’s replies should affect your response naturally.\n'
    : ''
  const messageStyle = options.usesNaturalPromptV2
    ? '- Choose naturally between one message and several. Each bubble should carry one coherent expression; never split sentences mechanically merely to imitate a person.'
    : '- Message like a real person: thoughts may naturally arrive across several bubbles, usually with one expression per message.'

  return `[Conversation format and reply behavior]
- Each message from the other person is wrapped in ${userTag}. They may send several consecutive messages; understand them together.
- A voice message appears as <user_voice_msg seconds="duration">[The other person sent a voice message. Transcript: xxxx]</user_voice_msg>. Treat it as something you hear rather than text you see.
- An image appears as <user_image_msg>[The other person sent an image. Description: xxxx]</user_image_msg>. You can see the described content.
${characterTimeRule}${timingRule}${messageStyle}
- A sticker appears as <user_emoji_msg name="sticker name">[The other person sent a sticker named “sticker name”]</user_emoji_msg>. When visual input is enabled, you can also see the sticker image.
- Wrap every ordinary text reply in <msg>. Do not add a time attribute to your current reply; the system handles it. Special actions such as transfers, red packets, voice messages, and calls remain outside <msg>.
- To send any visual media, use the standalone <send_image>a concrete description of the visual scene</send_image>.
Example:
<msg>I just finished what I was doing.</msg>
<send_image>I'm sitting on the sofa beside the window. Sunset fills the view, and a steaming cup of coffee rests on the table.</send_image>
<msg>Look at that sunset. It's beautiful.</msg>
- Content outside a recognized tag is not shown to the other person.`
}

export const englishOfflineFormatRules = `[Offline output format]\nThis is an in-person interaction. The active offline preset defines the exact response format.`

export const englishBubbleNarrationRules = `[Bubble narration mode]
- This mode combines online message bubbles with narrative description. Words actually spoken by the character still use <msg>...</msg>; each <msg> appears as a character bubble.
- Actions, expressions, environmental changes, or necessary private description use a standalone <narration kind="action">...</narration>, <narration kind="scene">...</narration>, or <narration kind="thought">...</narration>. These appear as unattributed narrative blocks between bubbles.
- Use third-person or natural camera-like prose inside <narration>. Refer to everyone by name or an unambiguous third-person noun; never use first- or second-person pronouns such as “I” or “you” in narration. Do not put dialogue there, and do not imitate actions with parentheses, asterisks, or <msg> bubbles.
- Add narration only when it advances emotion, action, or scene. Keep it concise and natural; do not attach it mechanically after every bubble, and never decide the other person's actions, feelings, or thoughts.
Example:
<msg>Why are you only getting back now?</msg>
<narration kind="action">The character leans against the doorway. The character's voice sounds calm, but their gaze never leaves the other person.</narration>
<msg>I've been waiting for ages.</msg>`

export const buildEnglishMessageCountRule = (minimum: number, maximum: number) => (
  `[Hard constraint: this response must contain exactly ${minimum}–${maximum} complete <msg>...</msg> tags—never fewer than ${minimum} or more than ${maximum}.]`
)

export const buildEnglishStatusPanel = (characterStatus: string, userStatus: string) => {
  const lines = [
    characterStatus && characterStatus !== 'none' ? `Your public status: [${characterStatus}].` : '',
    userStatus ? `The other person's public status: [${userStatus}].` : ''
  ].filter(Boolean)
  return lines.length
    ? `\n[Current status panel]\n${lines.join('')}\n(Note: these are public statuses. Respond according to your persona.)`
    : ''
}

export const buildEnglishCallFormatRules = (timeContext = '') => (
  `[Call format]\nFollow the active call mode and respond in natural spoken language.${timeContext ? `\n${timeContext}\n- Notice timing and reply delays, and react naturally to the passage of time.` : ''}`
)

export const buildEnglishVoiceRules = (usesNaturalPromptV2: boolean) => usesNaturalPromptV2
  ? `[Voice output rules]
Your response is sent directly to text-to-speech. Output only words the character genuinely says aloud. Never include actions, narration, kaomoji, or emoji.
Use a spoken rhythm that fits the persona: sentence length, pauses, filler words, and diction should follow the character, current emotion, and concrete subject. Do not mechanically pile up commas, ellipses, catchphrases, or breathy sounds to simulate realism. Avoid written summaries, numbered lecturing, and unwieldy clauses. Say clearly and naturally what the character actually wants to express now.`
  : `[Voice output rules]
Your response is sent directly to text-to-speech. Output only words the character genuinely says aloud. Never include actions, narration, kaomoji, or emoji.
Use natural spoken language that fits the persona. Avoid lecturing structures, formal prose, and overly long clauses. Keep sentence length compatible with ordinary breathing and use punctuation for natural pauses. Character-specific filler words or verbal habits may appear when they arise naturally, but never stack them mechanically.`

export const buildEnglishRelationshipRules = (relationship?: any) => {
  if (!relationship || (relationship.friendship === 'friends' && relationship.blockedBy === 'none')) {
    return `\n\n[Autonomous friendship actions]
If this person would genuinely block or remove the other person in the current situation, you may use these background actions. Do not use them frequently merely to manufacture drama, and do not explain the system mechanic in advance.
- Block: <block_user>a short observable reason</block_user>
- Remove friend: <delete_friend>a short observable reason</delete_friend>
After blocking, you may add <relationship_plan>minutes|exact, vague, or hidden|later intention</relationship_plan>. The minutes are the actual internal time before reconsidering the block; hidden only means the user is not told.
These tags are not displayed as chat text. Whether to act depends entirely on the persona and current relationship.`
  }
  return `\n\n[Current friendship state]\nFriendship: ${relationship.friendship}; blocked by: ${relationship.blockedBy}. Respect message visibility under this state and never pretend to see an undelivered message.`
}

export const englishEmojiWarning = `[Strict warning: never invent a sticker name. You may use only an exact name from the available list above. If no sticker fits, do not output <send_emoji>.]`

export const englishDialogueLanguageGuard = `\n\n[Dialogue language]\nThe language of these system instructions does not determine the character's spoken language. Follow the configured dialogue-language rules when present; otherwise reply in the primary language of the current conversation. For a Chinese conversation, produce idiomatic Simplified Chinese rather than translating the system instructions into visible English.`

export const englishRuntimeEstimateCorpus = [
  buildEnglishFormatRules({ timePerception: true, usesNaturalPromptV2: true, includeCharacterTime: true }),
  englishBubbleNarrationRules,
  buildEnglishVoiceRules(true),
  buildEnglishRelationshipRules(),
  englishDialogueLanguageGuard
].join('\n\n')

export const chineseRuntimeEstimateCorpus = `【对话格式与回复习惯】
- 对方的消息会用 <user_msg time="YYYY-MM-DD HH:mm"> 包裹；语音使用 <user_voice_msg>，图片使用 <user_image_msg>，表情包使用 <user_emoji_msg>。
- 结合连续消息理解内容，并敏锐感知消息间隔、回复延迟与真实时间流逝。
- 根据内容自然决定一条或多条消息，每个气泡承载一个自然完整的表达，不机械拆句。
- 每条普通回复必须用 <msg> 包裹；转账、红包、语音、图片、表情包、电话等功能标签独立存在。
- 主动发送视觉媒体使用 <send_image>具体画面描述</send_image>。没有被相应标签包裹的内容不会展示。

【气泡叙事模式】
动作、神态、环境或必要心理描写使用独立的 <narration kind="action|scene|thought">，不替对方决定动作、感受或内心，不机械添加。

【语音输出规则】
语音合成时只输出真正说出口的纯文本，严禁动作、旁白、颜文字和表情符号。口语节奏、句长、停顿和措辞应符合人设、情绪与具体内容，不机械堆叠口癖或标点。

【好友关系自主行为】
拉黑、删除好友等后台动作只在人设与当前关系确实支持时使用，不为制造冲突而频繁触发，并严格遵守消息可见性。`
