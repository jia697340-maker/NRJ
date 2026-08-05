/* WARNING: 本项目专属"粘人精"，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
const OFFLINE_FORMAT_RULES = `【线下格式要求】
- 请使用大段的长文本描述。
- 将角色的语言、神态、动作、环境描写融合在一起，像写小说一样连贯输出。
- 统一使用 <msg>内容</msg> 标签包裹所有的文本，不再区分动作和对话。`

export function buildOfflineMeetPrompt(
  chat: any,
  mode: 'mixed' | 'separate'
): string {
  if (!chat?.offlineMeetEnabled) return ''

  if (mode === 'mixed') {
    return `\n\n【场景状态：正在转入线下见面】
当前你们正在或已经转入线下面对面的真实接触。
请完全根据你们的人设和当前氛围自由发挥、自然互动。
你可以随时通过动作、神态来表达情绪，不再只是对着手机发消息。
${OFFLINE_FORMAT_RULES}`
  }

  return `\n\n【场景状态：独立的面对面互动】
你们现在正处于线下真实的面对面接触场景。
请完全根据你们的人设和当前氛围自由发挥、自然互动，展现出面对面时特有的细节（如眼神、距离、细微动作）。
${OFFLINE_FORMAT_RULES}`
}
