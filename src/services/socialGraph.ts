/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { sendChatMessage } from './api'

export type SocialCircleCategory = 'family' | 'friend' | 'work' | 'other'
export type SocialPrivacy = 'public' | 'limited' | 'private' | 'hidden'
export type SocialInteractionFrequency = 'high' | 'medium' | 'low'
export type SocialCircleManagementMode = 'readonly' | 'confirm' | 'autonomous'

export interface SocialCircleItem {
  id: string
  entityId: string
  name: string
  nickname: string
  socialId: string
  signature: string
  relation: string
  category: SocialCircleCategory
  persona: string
  avatarUrl?: string
  privacy: SocialPrivacy
  discoverable: boolean
  allowFriendRequests: boolean
  reciprocalVisible: boolean
  enableMoments: boolean
  allowMention: boolean
  interactionFrequency: SocialInteractionFrequency
  note?: string
  origin: 'manual' | 'ai' | 'directory'
  createdAt: number
  updatedAt: number
}

export interface SocialCircleSettings {
  enabled: boolean
  awarenessEnabled: boolean
  allowMentionInChat: boolean
  allowViewMoments: boolean
  allowInteractMoments: boolean
  allowPublishAboutCircle: boolean
  allowIncomingRequests: boolean
  managementMode: SocialCircleManagementMode
  generationCount: number
  updatedAt: number
}

export const defaultSocialCircleSettings = (): SocialCircleSettings => ({
  enabled: true,
  awarenessEnabled: true,
  allowMentionInChat: true,
  allowViewMoments: true,
  allowInteractMoments: true,
  allowPublishAboutCircle: true,
  allowIncomingRequests: true,
  managementMode: 'confirm',
  generationCount: 5,
  updatedAt: Date.now()
})

const cleanSocialId = (value: unknown, fallback: string) => {
  const cleaned = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)
  return cleaned.length >= 4 ? cleaned : fallback.slice(0, 20)
}

export const normalizeSocialCircleSettings = (chat: any): SocialCircleSettings => {
  const defaults = defaultSocialCircleSettings()
  const saved = chat?.socialCircleSettings && typeof chat.socialCircleSettings === 'object' ? chat.socialCircleSettings : {}
  const normalized: SocialCircleSettings = {
    ...defaults,
    ...saved,
    managementMode: ['readonly', 'confirm', 'autonomous'].includes(saved.managementMode) ? saved.managementMode : defaults.managementMode,
    generationCount: Math.min(10, Math.max(2, Number(saved.generationCount || defaults.generationCount))),
    updatedAt: Number(saved.updatedAt || defaults.updatedAt)
  }
  if (chat) chat.socialCircleSettings = normalized
  return normalized
}

export const normalizeSocialCircleItem = (raw: any, index = 0): SocialCircleItem => {
  const now = Date.now()
  const id = String(raw?.id || `sc_${now}_${index}_${Math.random().toString(36).slice(2, 6)}`)
  const entityId = String(raw?.entityId || `social_${id.replace(/[^a-zA-Z0-9_-]/g, '')}`)
  const name = String(raw?.name || '未命名人物').trim().slice(0, 30)
  const fallbackSocialId = `nrt_${entityId.replace(/[^a-zA-Z0-9]/g, '').slice(-10) || now.toString(36)}`
  return {
    id,
    entityId,
    name,
    nickname: String(raw?.nickname || name).trim().slice(0, 30),
    socialId: cleanSocialId(raw?.socialId, fallbackSocialId),
    signature: String(raw?.signature || '').trim().slice(0, 120),
    relation: String(raw?.relation || '生活中的熟人').trim().slice(0, 30),
    category: ['family', 'friend', 'work', 'other'].includes(raw?.category) ? raw.category : 'other',
    persona: String(raw?.persona || '').trim().slice(0, 4000),
    avatarUrl: String(raw?.avatarUrl || ''),
    privacy: ['public', 'limited', 'private', 'hidden'].includes(raw?.privacy) ? raw.privacy : 'public',
    discoverable: raw?.discoverable !== false,
    allowFriendRequests: raw?.allowFriendRequests !== false,
    reciprocalVisible: raw?.reciprocalVisible !== false,
    enableMoments: raw?.enableMoments !== false,
    allowMention: raw?.allowMention !== false,
    interactionFrequency: ['high', 'medium', 'low'].includes(raw?.interactionFrequency) ? raw.interactionFrequency : 'medium',
    note: String(raw?.note || '').slice(0, 500),
    origin: ['manual', 'ai', 'directory'].includes(raw?.origin) ? raw.origin : 'manual',
    createdAt: Number(raw?.createdAt || now),
    updatedAt: Number(raw?.updatedAt || now)
  }
}

export const ensureSocialCircle = (chat: any): SocialCircleItem[] => {
  const list = Array.isArray(chat?.socialCircle) ? chat.socialCircle : []
  const normalized = list.map(normalizeSocialCircleItem)
  if (chat) chat.socialCircle = normalized
  normalizeSocialCircleSettings(chat)
  return normalized
}

const extractJson = (raw: string) => {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const source = (fenced || raw).trim()
  const arrayStart = source.indexOf('[')
  const arrayEnd = source.lastIndexOf(']')
  if (arrayStart >= 0 && arrayEnd > arrayStart) return JSON.parse(source.slice(arrayStart, arrayEnd + 1))
  const objectStart = source.indexOf('{')
  const objectEnd = source.lastIndexOf('}')
  if (objectStart < 0 || objectEnd <= objectStart) throw new Error('AI 没有返回可读取的人脉草稿')
  const parsed = JSON.parse(source.slice(objectStart, objectEnd + 1))
  return parsed.people || parsed.contacts || []
}

export async function generateSocialCircleDraft(chat: any, count: number): Promise<SocialCircleItem[]> {
  const safeCount = Math.min(10, Math.max(2, Math.round(Number(count) || 5)))
  const existing = ensureSocialCircle(chat).map(item => `${item.name}（${item.relation}）`).join('、') || '无'
  const prompt = `你是一名角色世界观与社会关系编辑。请为角色生成真实、克制、彼此有区别的一层生活人脉，不要继续为这些人物递归生成人脉。\n角色姓名：${chat.realName || chat.name}\n角色设定：${String(chat.persona || '').slice(0, 9000)}\n已有的人脉：${existing}\n生成 ${safeCount} 人，覆盖符合该角色背景的家人、朋友、工作/学业与其他关系；不要为了凑分类破坏设定。允许存在疏远、竞争、旧识等复杂但合理的关系。部分人物应重视隐私，部分人物可以不接受陌生好友申请。不得把每个人都写成围绕用户生活，也不得虚构其与用户已有经历。\n只返回 JSON 数组，不要 Markdown。每项字段：name、nickname、socialId、signature、relation、category（family|friend|work|other）、persona（含身份、性格、说话方式、与主角色相处方式）、privacy（public|limited|private|hidden）、discoverable、allowFriendRequests、reciprocalVisible、enableMoments、allowMention、interactionFrequency（high|medium|low）。socialId 为 4～20 位字母数字下划线或短横线。`
  const response = await sendChatMessage([
    { role: 'system', content: prompt },
    { role: 'user', content: `生成 ${safeCount} 位与角色背景一致的生活人脉。` }
  ], undefined, false, false, 'moment-followup')
  const parsed = extractJson(typeof response === 'string' ? response : response.content)
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('没有生成有效的人脉人物')
  const stamp = Date.now()
  return parsed.slice(0, safeCount).map((item, index) => normalizeSocialCircleItem({
    ...item,
    id: `sc_ai_${stamp}_${index}_${Math.random().toString(36).slice(2, 5)}`,
    entityId: `social_${stamp}_${index}_${Math.random().toString(36).slice(2, 7)}`,
    origin: 'ai',
    createdAt: stamp,
    updatedAt: stamp
  }, index))
}

export const buildSocialCirclePrompt = (chat: any, english = false) => {
  const settings = normalizeSocialCircleSettings(chat)
  if (!settings.enabled || !settings.awarenessEnabled) return ''
  const people = ensureSocialCircle(chat)
    .filter(item => item.allowMention || item.privacy === 'hidden')
    .slice(0, 20)
    .map(item => `- ${item.name}：${item.relation}；${item.persona.slice(0, 260)}；朋友圈互动：${item.enableMoments ? item.interactionFrequency : '关闭'}；对外隐私：${item.privacy}`)
    .join('\n')
  if (!people) return ''
  if (english) return `\n\n[Your social circle]\n${people}\nThese are independent people, not extensions of you or the user. You may mention them only when natural. Mention in chat: ${settings.allowMentionInChat}; view their Moments: ${settings.allowViewMoments}; interact with their Moments: ${settings.allowInteractMoments}; post about them: ${settings.allowPublishAboutCircle}. Never reveal a hidden/private person's identifying details to the user without a clear in-story reason and permission. Do not decide another person's acceptance of a friend request.`
  return `\n\n【你的生活人脉】\n${people}\n这些人是有独立性格和选择的人，不是你或用户的附属。允许在聊天中自然提及：${settings.allowMentionInChat ? '是' : '否'}；查看其朋友圈：${settings.allowViewMoments ? '是' : '否'}；点赞评论：${settings.allowInteractMoments ? '是' : '否'}；发布涉及人脉的朋友圈：${settings.allowPublishAboutCircle ? '是' : '否'}。提及必须符合当前话题，不要机械报人名。未经合适的剧情理由和许可，不得向用户泄露私密或隐藏人物的身份信息。不能替其他人物决定是否同意好友申请。`
}

export const canDiscoverSocialContact = (item: SocialCircleItem) => item.privacy !== 'hidden' && item.discoverable
export const canViewSocialContactMoments = (item: SocialCircleItem, isFriend: boolean) => item.enableMoments && (item.privacy === 'public' || (item.privacy === 'limited' && isFriend))
