/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { sendChatMessage } from './api'
import type { SocialCoverStyle } from './characterSocialProfile'

export type SocialGenerationField = 'nickname' | 'socialId' | 'signature' | 'coverStyle' | 'moments'

export type SocialGenerationResult = {
  nickname?: string
  socialId?: string
  signature?: string
  coverStyle?: SocialCoverStyle
  moments?: string[]
}

const extractJson = (raw: string) => {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const source = (fenced || raw).trim()
  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('AI 没有返回可读取的资料')
  return JSON.parse(source.slice(start, end + 1))
}

const recentChatText = (chat: any, allowDetails: boolean) => {
  if (!allowDetails) {
    const summaries = Array.isArray(chat?.memoryBook) ? chat.memoryBook.slice(-5) : []
    return summaries.map((item: any) => String(item.content || item.summary || '')).filter(Boolean).join('\n').slice(0, 3000)
  }
  return (Array.isArray(chat?.messages) ? chat.messages.slice(-30) : [])
    .map((message: any) => `${message.type === 'right' ? '用户' : '角色'}：${String(message.content || '').slice(0, 300)}`)
    .join('\n')
    .slice(0, 6000)
}

export async function generateSocialProfileFields(options: {
  chat: any
  fields: SocialGenerationField[]
  momentCount: number
  includeRecentChat: boolean
  allowChatDetails: boolean
  existingMoments: any[]
}): Promise<SocialGenerationResult> {
  const { chat, fields } = options
  if (!fields.length) throw new Error('请至少选择一个要生成的项目')
  const requested = fields.map(field => field === 'moments' ? `moments（${Math.min(20, Math.max(1, options.momentCount))} 条字符串数组）` : field).join('、')
  const profile = chat.socialProfile || {}
  const chatContext = options.includeRecentChat ? recentChatText(chat, options.allowChatDetails) : ''
  const oldMoments = options.existingMoments.slice(0, 12).map(item => item.content).filter(Boolean).join('\n')
  const system = `你是一名克制、细腻的角色社交资料编辑。请根据角色人设生成用户指定的字段，只返回一个 JSON 对象，禁止 Markdown、解释和未请求字段。\n角色原名：${chat.realName || chat.name}\n角色人设：${String(chat.persona || '').slice(0, 8000)}\n当前资料：${JSON.stringify({ nickname: profile.nickname, socialId: profile.socialId, signature: profile.signature, coverStyle: profile.coverStyle })}\n允许的背景值仅为 dots、grid、stars、plain。socialId 只能包含英文字母、数字、下划线和短横线，长度 4～20。网名和签名要自然，避免模板腔。朋友圈应像同一个真实的人在不同时间发布，长短有变化，避免每条都抒情、都提到用户或重复句式。即使参考聊天，也不得泄露密码、地址、联系方式等隐私。\n已有朋友圈（用于去重）：\n${oldMoments || '无'}\n${chatContext ? `聊天参考：\n${chatContext}\n${options.allowChatDetails ? '允许谨慎提及非敏感聊天细节。' : '只吸收情绪与关系氛围，不得复述具体私聊内容。'}` : '不要参考最近聊天。'}\n仅生成这些字段：${requested}。`
  const response = await sendChatMessage([
    { role: 'system', content: system },
    { role: 'user', content: `生成所选资料字段：${requested}` }
  ], undefined, false, false, 'moment-followup')
  const parsed = extractJson(typeof response === 'string' ? response : response.content)
  const result: SocialGenerationResult = {}
  if (fields.includes('nickname') && typeof parsed.nickname === 'string' && parsed.nickname.trim()) result.nickname = parsed.nickname.trim().slice(0, 30)
  if (fields.includes('socialId') && typeof parsed.socialId === 'string') {
    const id = parsed.socialId.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)
    if (id.length >= 4) result.socialId = id
  }
  if (fields.includes('signature') && typeof parsed.signature === 'string' && parsed.signature.trim()) result.signature = parsed.signature.trim().slice(0, 120)
  if (fields.includes('coverStyle') && ['dots', 'grid', 'stars', 'plain'].includes(parsed.coverStyle)) result.coverStyle = parsed.coverStyle
  if (fields.includes('moments') && Array.isArray(parsed.moments)) {
    result.moments = parsed.moments.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, Math.min(20, Math.max(1, options.momentCount)))
  }
  return result
}
