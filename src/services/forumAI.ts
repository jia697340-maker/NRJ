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
  // This assertion sits immediately before the provider call. No caller can pass raw chat state.
  const bridgedMemories = collectChatToForumBridgeMemories(snapshot, request.involvedAccountIds || [])
  const contextSnapshot = bridgedMemories.length ? { ...snapshot, memories: [...snapshot.memories, ...bridgedMemories] } : snapshot
  const allowed = buildAllowedForumContext(contextSnapshot, request)
  assertNoDisabledSubjects(snapshot, allowed)
  const payload = sanitizeAllowedContext(allowed)
  const result = await sendChatMessage([
    { role: 'system', content: `你负责模拟 NRJ 社区中彼此独立、长期存在的普通居民。只能使用 AllowedForumContext 中的信息；未出现的人物对社区不存在；不得猜测匿名真实身份。人物资料用于约束性格与经历，不是要求复述的人设标签。世界书只提供事实背景，不决定谁能参与，也不要把背景写成设定说明。若上下文包含 circle，circle.contentScope 是该圈明确的讨论范围，圈内帖子必须自然符合它及圈规；circle.description 只是公开简介。让表达保留个人动机、语气和不完美感，允许沉默和不行动，避免公告、档案、工作汇报、百科介绍和整齐重复的模板。只输出 JSON。\n输出结构：${schemaHint}` },
    { role: 'user', content: `${instruction}\nAllowedForumContext:\n${JSON.stringify(payload)}` }
  ], undefined, false, false, purpose, 'auto', undefined, false)
  const text = typeof result === 'string' ? result : String(result?.content || '')
  return extractJson(text) as T
}
