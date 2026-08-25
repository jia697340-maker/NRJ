/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { sendChatMessage, type ForumApiPurpose } from './api'
import { assertNoDisabledSubjects, buildAllowedForumContext, sanitizeAllowedContext, type ForumContextRequest } from './forumPolicy'
import type { ForumSnapshot } from '../types/forum'
import { collectChatToForumBridgeMemories } from './forumMemoryBridge'

const extractJson = (text: string) => {
  const normalized = text.trim()
  if (!normalized) throw new Error('模型没有返回论坛内容，请重试或检查当前 API 节点。')

  const fenced = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const objectStart = normalized.indexOf('{')
  const objectEnd = normalized.lastIndexOf('}')
  const candidate = fenced || (objectStart >= 0 && objectEnd > objectStart
    ? normalized.slice(objectStart, objectEnd + 1)
    : '')

  if (!candidate) throw new Error('模型返回的论坛内容不是有效 JSON，请重试。')
  try {
    return JSON.parse(candidate)
  } catch {
    throw new Error('模型返回的论坛 JSON 不完整，请重试或提高最大输出长度。')
  }
}

export const requestForumJson = async <T>(snapshot: ForumSnapshot, request: ForumContextRequest, purpose: ForumApiPurpose, instruction: string, schemaHint: string): Promise<T> => {
  if (request.userInitiated !== true) throw new Error('论坛生成只能由用户手动操作触发')
  // This assertion sits immediately before the provider call. No caller can pass raw chat state.
  const bridgedMemories = collectChatToForumBridgeMemories(snapshot, request.involvedAccountIds || [])
  const contextSnapshot = bridgedMemories.length ? { ...snapshot, memories: [...snapshot.memories, ...bridgedMemories] } : snapshot
  const allowed = buildAllowedForumContext(contextSnapshot, request)
  assertNoDisabledSubjects(snapshot, allowed)
  const payload = sanitizeAllowedContext(allowed)
  const result = await sendChatMessage([
    { role: 'system', content: `你负责为 NRJ 的开放论坛内容世界生成自然内容。作者可能是只在本批次出现的轻量路人，也可能是用户指定的长期角色；只能使用 AllowedForumContext 中的信息，不得为轻量作者擅自创建复杂关系、作息或长期记忆，不得猜测匿名真实身份。人物资料只约束表达，不要求复述人设。世界书只提供事实背景，不决定谁能参与，也不要写成设定说明。若上下文包含 circle，circle.contentScope 是明确讨论范围，圈内内容必须自然符合范围和圈规。表达应有长短、语气和不完美感，允许普通、沉默、跑题和轻微分歧，避免公告、档案、工作汇报、百科介绍、客服式夸奖和整齐模板。只输出 JSON。\n输出结构：${schemaHint}` },
    { role: 'user', content: `${instruction}\nAllowedForumContext:\n${JSON.stringify(payload)}` }
  ], undefined, false, false, purpose, 'auto', undefined, false)
  const text = typeof result === 'string' ? result : String(result?.content || '')
  return extractJson(text) as T
}
