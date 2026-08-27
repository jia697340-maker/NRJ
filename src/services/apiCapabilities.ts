/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type ApiCapabilityId =
  | 'chat'
  | 'chat-auxiliary'
  | 'vision-understanding'
  | 'image-prompt'
  | 'summary'
  | 'character-workshop'
  | 'moment-interaction'
  | 'social-generation'
  | 'prompt-assistant'
  | 'forum-content'
  | 'forum-interaction'
  | 'forum-dm'
  | 'embedding'

export type ApiCapabilityFallback = 'default-node' | 'default-if-compatible' | 'local-non-vector' | 'default-only'

export interface ApiCapabilityDefinition {
  id: ApiCapabilityId
  name: string
  description: string
  group: 'default' | 'image' | 'content' | 'forum' | 'special'
  assignable: boolean
  fallback: ApiCapabilityFallback
  fallbackOnRequestError: boolean
  supportsParameterOverrides: boolean
}

export const apiCapabilityRegistry: Record<ApiCapabilityId, ApiCapabilityDefinition> = {
  chat: { id: 'chat', name: '默认聊天', description: '单聊、群聊、语音与视频通话', group: 'default', assignable: false, fallback: 'default-only', fallbackOnRequestError: false, supportsParameterOverrides: false },
  'chat-auxiliary': { id: 'chat-auxiliary', name: '聊天辅助判断', description: '关系推进、自主行为、钱包与时间线等内部判断', group: 'default', assignable: false, fallback: 'default-only', fallbackOnRequestError: false, supportsParameterOverrides: false },
  'vision-understanding': { id: 'vision-understanding', name: '识图与内容理解', description: '理解图片、表情和参考图内容', group: 'image', assignable: true, fallback: 'default-if-compatible', fallbackOnRequestError: false, supportsParameterOverrides: true },
  'image-prompt': { id: 'image-prompt', name: '生图提示词辅助', description: '整理画面描述、翻译和生成生图提示词', group: 'image', assignable: true, fallback: 'default-node', fallbackOnRequestError: false, supportsParameterOverrides: true },
  summary: { id: 'summary', name: '总结', description: '聊天、通话、线下会面与记忆总结', group: 'content', assignable: true, fallback: 'default-node', fallbackOnRequestError: false, supportsParameterOverrides: true },
  'character-workshop': { id: 'character-workshop', name: '角色与人设工坊', description: '角色、用户人设的生成、补全与审核', group: 'content', assignable: true, fallback: 'default-node', fallbackOnRequestError: false, supportsParameterOverrides: true },
  'moment-interaction': { id: 'moment-interaction', name: '朋友圈互动', description: '查看动态、点赞、评论和后续回应', group: 'content', assignable: true, fallback: 'default-node', fallbackOnRequestError: true, supportsParameterOverrides: true },
  'social-generation': { id: 'social-generation', name: '社交资料生成', description: '角色社交资料、朋友圈草稿与生活人脉', group: 'content', assignable: true, fallback: 'default-node', fallbackOnRequestError: false, supportsParameterOverrides: true },
  'prompt-assistant': { id: 'prompt-assistant', name: 'AI 辅助创作', description: '提示词方案、聊天纠正规则和头像构想', group: 'content', assignable: true, fallback: 'default-node', fallbackOnRequestError: false, supportsParameterOverrides: true },
  'forum-content': { id: 'forum-content', name: '论坛内容', description: '论坛帖子批次、随帖评论、NPC 和新圈子', group: 'forum', assignable: true, fallback: 'default-node', fallbackOnRequestError: true, supportsParameterOverrides: true },
  'forum-interaction': { id: 'forum-interaction', name: '论坛互动', description: '论坛评论回应和帖子互动', group: 'forum', assignable: true, fallback: 'default-node', fallbackOnRequestError: true, supportsParameterOverrides: true },
  'forum-dm': { id: 'forum-dm', name: '论坛私聊', description: '论坛私聊回复和好友决定', group: 'forum', assignable: true, fallback: 'default-node', fallbackOnRequestError: true, supportsParameterOverrides: true },
  embedding: { id: 'embedding', name: '向量记忆', description: '长期记忆向量生成与检索', group: 'special', assignable: true, fallback: 'local-non-vector', fallbackOnRequestError: false, supportsParameterOverrides: false }
}

export const assignableApiCapabilities = Object.values(apiCapabilityRegistry).filter(item => item.assignable)

export const apiCapabilityGroups = [
  { id: 'image', name: '图像辅助' },
  { id: 'content', name: '内容与角色' },
  { id: 'forum', name: '论坛' },
  { id: 'special', name: '特殊能力' }
] as const

