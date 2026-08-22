/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export const buildEnglishTimeContext = (charZone: string, charTime: string, userZone: string, userTime: string) => (
  `\n[Current time]\nCurrent character: ${charZone} ${charTime}\nCurrent user: ${userZone} ${userTime}`
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
    ? '- The current character\'s historical messages are wrapped in <msg time="YYYY-MM-DD HH:mm">.\n'
    : ''
  const timingRule = options.timePerception
    ? '- Message gaps and reply delays affect the current character naturally.\n'
    : ''
  const messageStyle = options.usesNaturalPromptV2
    ? '- Choose naturally between one message and several. Each bubble should carry one coherent expression; never split sentences mechanically merely to imitate a person.'
    : '- Message like a real person: thoughts may naturally arrive across several bubbles, usually with one expression per message.'

  return `[Conversation format and reply behavior]
- Each message from the current user is wrapped in ${userTag}. Several consecutive user messages belong to the same turn and are understood together.
- A voice message appears as <user_voice_msg seconds="duration">[The current user sent a voice message. Transcript: xxxx]</user_voice_msg>; the current character treats it as heard speech.
- An image appears as <user_image_msg>[The current user sent an image. Description: xxxx]</user_image_msg>; the current character can see the described content.
${characterTimeRule}${timingRule}${messageStyle}
- A sticker appears as <user_emoji_msg name="sticker name">[The current user sent a sticker named “sticker name”]</user_emoji_msg>; visual input may also show its image.
- Every ordinary reply by the current character uses <msg>; the system handles its time attribute. Special actions remain outside <msg>.
- To send any visual media, use the standalone <send_image>a concrete description of the visual scene</send_image>.
Example:
<msg>I just finished what I was doing.</msg>
<send_image>I'm sitting on the sofa beside the window. Sunset fills the view, and a steaming cup of coffee rests on the table.</send_image>
<msg>Look at that sunset. It's beautiful.</msg>
- Content outside a recognized tag is not shown to the current user.`
}

export const englishOfflineFormatRules = `[Offline output format]\nThis is an in-person interaction. The active offline preset defines the exact response format.`

export const englishBubbleNarrationRules = `[Bubble narration mode]
- This mode combines online message bubbles with narrative description. Words actually spoken by the character still use <msg>...</msg>; each <msg> appears as a character bubble.
- Actions, expressions, environmental changes, or necessary private description use a standalone <narration kind="action">...</narration>, <narration kind="scene">...</narration>, or <narration kind="thought">...</narration>. These appear as unattributed narrative blocks between bubbles.
- Use third-person or natural camera-like prose inside <narration>. Refer to everyone by name or an unambiguous third-person noun; never use first- or second-person pronouns such as “I” or “you” in narration. Do not put dialogue there, and do not imitate actions with parentheses, asterisks, or <msg> bubbles.
- Add narration only when it advances emotion, action, or scene. Keep it concise and natural; do not attach it mechanically after every bubble, and never decide the current user's actions, feelings, or thoughts.
Example:
<msg>Why are you only getting back now?</msg>
<narration kind="action">The character leans against the doorway. The character's voice sounds calm, but their gaze never leaves the current user.</narration>
<msg>I've been waiting for ages.</msg>`

export const buildEnglishMessageCountRule = (minimum: number, maximum: number) => (
  `[Hard constraint: this response must contain exactly ${minimum}–${maximum} complete <msg>...</msg> tags—never fewer than ${minimum} or more than ${maximum}.]`
)

export const buildEnglishStatusPanel = (characterStatus: string, userStatus: string) => {
  const lines = [
    characterStatus && characterStatus !== 'none' ? `Current character's public status: [${characterStatus}].` : '',
    userStatus ? `Current user's public status: [${userStatus}].` : ''
  ].filter(Boolean)
  return lines.length
    ? `\n[Current status panel]\n${lines.join('')}\nThe current character responds according to the character's persona.`
    : ''
}

export const buildEnglishCallFormatRules = (timeContext = '') => (
  `[Call format]\nFollow the active call mode and respond in natural spoken language.${timeContext ? `\n${timeContext}\n- Notice timing and reply delays, and react naturally to the passage of time.` : ''}`
)

export const buildEnglishVoiceRules = (usesNaturalPromptV2: boolean) => usesNaturalPromptV2
  ? `[Voice output rules]
The current character's response is sent directly to text-to-speech. Output only words the character genuinely says aloud, without actions, narration, kaomoji, or emoji.
Use a spoken rhythm that fits the persona: sentence length, pauses, filler words, and diction should follow the character, current emotion, and concrete subject. Do not mechanically pile up commas, ellipses, catchphrases, or breathy sounds to simulate realism. Avoid written summaries, numbered lecturing, and unwieldy clauses. Say clearly and naturally what the character actually wants to express now.`
  : `[Voice output rules]
The current character's response is sent directly to text-to-speech. Output only words the character genuinely says aloud, without actions, narration, kaomoji, or emoji.
Use natural spoken language that fits the persona. Avoid lecturing structures, formal prose, and overly long clauses. Keep sentence length compatible with ordinary breathing and use punctuation for natural pauses. Character-specific filler words or verbal habits may appear when they arise naturally, but never stack them mechanically.`

export const buildEnglishRelationshipRules = (relationship?: any) => {
  if (!relationship || (relationship.friendship === 'friends' && relationship.blockedBy === 'none')) {
    return `\n\n[Autonomous friendship actions]
If the current character would genuinely block or remove the current user, the corresponding background action may be used. It does not occur merely to manufacture drama.
- Block: <block_user>a short observable reason</block_user>
- Remove friend: <delete_friend>a short observable reason</delete_friend>
After blocking, the current character may add <relationship_plan>minutes|exact, vague, or hidden|later intention</relationship_plan>. The minutes are the internal reconsideration time; hidden means the current user is not told.
These tags are not displayed as chat text. Whether to act depends entirely on the persona and current relationship.`
  }
  return `\n\n[Current friendship state]\nFriendship: ${relationship.friendship}; blocked by: ${relationship.blockedBy}. Respect message visibility under this state and never pretend to see an undelivered message.`
}

export const englishEmojiWarning = `[Strict warning: the current character uses only exact sticker names from the available list. If none fits, omit <send_emoji>.]`

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
