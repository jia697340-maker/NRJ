/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { isForumApiReady, sendChatMessage, type ForumApiPurpose } from './api'
import { assertNoDisabledSubjects, buildAllowedForumContext, sanitizeAllowedContext, type ForumContextRequest } from './forumPolicy'
import type { ForumSnapshot } from '../types/forum'
import { collectChatToForumBridgeMemories } from './forumMemoryBridge'
import { forumPromptSettings } from '../store/forumPrompt'
import { forumApiSettings } from '../store/api'

const sendForumMessage = async (messages: Array<{ role: string; content: string }>, purpose: ForumApiPurpose) => {
  const usingDedicatedNode = isForumApiReady(purpose)
  try {
    return await sendChatMessage(messages, undefined, false, false, purpose, 'auto', undefined, false)
  } catch (cause) {
    if (!usingDedicatedNode || !forumApiSettings.fallbackToDefault) throw cause
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nrj:forum-api-fallback', { detail: { purpose, message: cause instanceof Error ? cause.message : String(cause) } }))
    return sendChatMessage(messages, undefined, false, false, 'default', 'auto', undefined, true)
  }
}

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
  const serializedPayload = purpose === 'forum-post'
    ? { ...payload, viewerAccount: { id: payload.viewerAccount.id, role: '仅为当前查看者，不是本批内容主题或默认参与者' } }
    : payload
  const result = await sendForumMessage([
    { role: 'system', content: `${forumPromptSettings.globalPrompt}\n\n你负责为 NRJ 的开放论坛内容世界生成自然内容。作者可能是只在本批次出现的轻量路人，也可能是用户指定的长期角色；只能使用 AllowedForumContext 中的信息，不得为轻量作者擅自创建复杂关系、作息或长期记忆，不得猜测匿名真实身份。人物资料只约束表达，不要求复述人设。世界书只提供事实背景，不决定谁能参与，也不要写成设定说明。若上下文包含 circle，circle.contentScope 是明确讨论范围，圈内内容必须自然符合范围和圈规。表达应有长短、语气和不完美感，允许普通、沉默、跑题和轻微分歧，避免公告、档案、工作汇报、百科介绍、客服式夸奖和整齐模板。只输出 JSON。\n输出结构：${schemaHint}` },
    { role: 'user', content: `${instruction}\nAllowedForumContext:\n${JSON.stringify(serializedPayload)}` }
  ], purpose)
  const text = typeof result === 'string' ? result : String(result?.content || '')
  return extractJson(text) as T
}

export const requestForumDmXml = async (snapshot: ForumSnapshot, input: { viewerAccountId: string; senderId: string; conversationId: string; timingInstruction: string }) => {
  const settings = snapshot.settings.dm
  const bridged = settings.context.chatSummaries ? collectChatToForumBridgeMemories(snapshot, [input.senderId]) : []
  const contextSnapshot = bridged.length ? { ...snapshot, memories: [...snapshot.memories, ...bridged] } : snapshot
  const allowed = sanitizeAllowedContext(buildAllowedForumContext(contextSnapshot, { userInitiated: true, viewerAccountId: input.viewerAccountId, involvedAccountIds: [input.senderId], observerAccountId: input.senderId }))
  assertNoDisabledSubjects(snapshot, allowed)
  if (!settings.context.publicPosts) allowed.recentPosts = []
  if (!settings.context.forumMemories) allowed.reachableMemories = []
  const conversation = snapshot.conversations.find(item => item.id === input.conversationId && item.participantAccountIds.includes(input.viewerAccountId) && item.participantAccountIds.includes(input.senderId))
  if (!conversation) throw new Error('论坛私聊会话不存在或当前账号无权读取。')
  const visibleMessages = snapshot.messages
    .filter(item => item.conversationId === conversation.id && (!item.revealAt || item.revealAt <= Date.now()))
    .slice(-Math.max(1, settings.contextMessageCount))
    .map(item => ({ senderId: item.senderId, content: item.content, createdAt: item.createdAt }))
  const comments = settings.context.publicComments
    ? snapshot.comments.filter(item => item.authorAccountId === input.senderId || item.replyToUser?.id === input.senderId).slice(-16).map(item => ({ postId: item.postId, authorAccountId: item.authorAccountId, content: item.content, createdAt: item.createdAt }))
    : []
  const interactions = settings.context.interactions
    ? snapshot.events.filter(item => item.actorAccountId === input.senderId || item.targetAccountIds.includes(input.senderId)).slice(-20).map(item => ({ type: item.type, actorAccountId: item.actorAccountId, entityId: item.entityId, createdAt: item.createdAt }))
    : []
  const featureInstructions = [
    settings.timeAware ? `当前本地时间：${new Date().toLocaleString('zh-CN')}。理解消息之间真实经过的时间。` : '',
    settings.bilingual ? `启用双语/翻译，沿用聊天 <msg> 的双语属性结构，目标翻译语言：${settings.translationLanguage}。` : '',
    input.timingInstruction,
    settings.maxBubbleMode === 'limit' ? `本轮最多输出 ${Math.max(1, settings.maxBubbles)} 个 <msg>。` : '消息气泡数量由自然聊天节奏决定。'
  ].filter(Boolean).join('\n')
  const result = await sendForumMessage([
    { role: 'system', content: `${forumPromptSettings.globalPrompt}\n\n${forumPromptSettings.dmPrompt}\n\n${featureInstructions}` },
    { role: 'user', content: `请只扮演 senderId=${input.senderId} 的当前论坛人物，回应这段私聊。\nAllowedForumContext:\n${JSON.stringify(allowed)}\n当前人物可见的论坛评论：\n${JSON.stringify(comments)}\n当前人物可见的双方互动：\n${JSON.stringify(interactions)}\n当前双方私聊（已按权限过滤，未揭示的延迟消息不在其中）：\n${JSON.stringify(visibleMessages)}` }
  ], 'forum-dm')
  return typeof result === 'string' ? result : String(result?.content || '')
}
