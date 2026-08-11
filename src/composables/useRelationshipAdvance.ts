/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import { sendChatMessage } from '../services/api'
import { globalPromptSettings } from '../store'
import {
  acceptFriendRequest,
  appendRelationshipEvent,
  characterBlocksUser,
  characterUnblocksUser,
  createFriendRequest,
  deleteFriendByCharacter,
  ensureRelationship,
  deliverCharacterMessage,
  formatRecentRelationshipHistory,
  markRequestViewed,
  markRelationshipPlanRetry,
  persistRelationship,
  rejectFriendRequest,
  setRelationshipPlan,
  type FriendRequestRecord,
  type RelationPlanAction
} from './useChatRelationship'

type AdvanceTrigger =
  | 'user_blocked_character'
  | 'user_unblocked_character'
  | 'user_deleted_friend'
  | 'user_sent_request'
  | 'user_rejected_request'
  | 'manual_advance'
  | 'scheduled_review'

type RelationshipDecision = {
  observableReaction?: string
  message?: string
  action?: 'none' | 'send_request' | 'block_user' | 'unblock_user' | 'delete_friend' | 'accept_request' | 'reject_request'
  requestMessage?: string
  rejectionReason?: string
  delayMinutes?: number
  reconsiderMinutes?: number
  visibility?: 'exact' | 'vague' | 'hidden'
  planSummary?: string
}

const parseDecision = (raw: any): RelationshipDecision => {
  const content = typeof raw === 'string' ? raw : raw?.content || ''
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1) throw new Error('角色没有返回有效的关系决定')
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1))
}

const recentChatText = (chat: any) => (chat.messages || [])
  .filter((message: any) => ['left', 'right'].includes(message.type))
  .slice(-12)
  .map((message: any) => `${message.type === 'left' ? chat.name : '用户'}：${message.content}`)
  .join('\n')

export function useRelationshipAdvance() {
  const isAdvancing = ref(false)
  const relationshipError = ref('')

  const advanceRelationship = async (
    chat: any,
    trigger: AdvanceTrigger = 'manual_advance',
    relatedRequest?: FriendRequestRecord
  ) => {
    if (!chat || isAdvancing.value) return null
    isAdvancing.value = true
    relationshipError.value = ''
    const relationship = ensureRelationship(chat)
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - Number(relationship.stateChangedAt || relationship.changedAt)) / 60000))
    const relationshipHistory = formatRecentRelationshipHistory(chat)

    const chinesePrompt = `你正在扮演“${chat.realName || chat.name}”，人物设定如下：\n${chat.persona || '无额外设定'}\n\n` +
      `这是一次好友关系事件，不是普通聊天续写。请按照人物性格自主决定下一步，不要讨好用户，也不要默认一定会复合。\n` +
      `当前好友关系：${relationship.friendship}；拉黑状态：${relationship.blockedBy}；当前状态已经持续约 ${elapsedMinutes} 分钟。\n` +
      (relationshipHistory ? `最近的重要关系经历：\n${relationshipHistory}\n` : '') +
      `本次触发：${trigger}。\n` +
      (relatedRequest ? `相关申请：${relatedRequest.message}；状态：${relatedRequest.status}；拒绝理由：${relatedRequest.rejectionReason || '无'}。\n` : '') +
      `最近对话：\n${recentChatText(chat) || '暂无'}\n\n` +
      `只输出一个 JSON 对象，不要输出 markdown。字段：\n` +
      `observableReaction：用户能够观察到的简短反应，不写分析过程；\n` +
      `message：角色在当前情境真正尝试发出的消息，可为空；\n` +
      `action：none、send_request、block_user、unblock_user、delete_friend、accept_request、reject_request 之一；\n` +
      `requestMessage：申请文案；rejectionReason：拒绝理由；\n` +
      `delayMinutes：计划多少分钟后执行 action，0 表示立即；\n` +
      `reconsiderMinutes：如果暂不行动，多少分钟后重新考虑；\n` +
      `visibility：exact、vague、hidden；planSummary：一句话描述后续打算。`
    const prompt = globalPromptSettings.language === 'en'
      ? `You are portraying “${chat.realName || chat.name}”. Persona:\n${chat.persona || 'No additional persona provided'}\n\nThis is a friendship-state event, not an ordinary chat continuation. Independently choose the next step according to the persona. Do not appease the user or assume reconciliation is inevitable.\nCurrent friendship: ${relationship.friendship}; blocked by: ${relationship.blockedBy}; this state has lasted about ${elapsedMinutes} minutes.\n${relationshipHistory ? `Recent important relationship history:\n${relationshipHistory}\n` : ''}Trigger: ${trigger}.\n${relatedRequest ? `Related request: ${relatedRequest.message}; status: ${relatedRequest.status}; rejection reason: ${relatedRequest.rejectionReason || 'none'}.\n` : ''}Recent conversation:\n${recentChatText(chat) || 'None'}\n\nOutput exactly one JSON object with no Markdown. Natural-language fields must use the conversation's primary language. Fields:\nobservableReaction: a brief externally observable reaction, never analysis;\nmessage: a message the character genuinely attempts to send now, or an empty string;\naction: one of none, send_request, block_user, unblock_user, delete_friend, accept_request, reject_request;\nrequestMessage; rejectionReason;\ndelayMinutes: minutes before executing action, where 0 means immediate;\nreconsiderMinutes: minutes before reconsidering when taking no action now;\nvisibility: exact, vague, or hidden; planSummary: one sentence describing the later intention.`
      : chinesePrompt

    try {
      const result = await sendChatMessage([{ role: 'system', content: prompt }])
      const decision = parseDecision(result)
      if (trigger === 'user_sent_request' && relatedRequest?.direction === 'user_to_character' && relatedRequest.status === 'pending') {
        markRequestViewed(chat, relatedRequest)
      }
      const delay = Math.max(0, Number(decision.delayMinutes || 0))
      const reconsider = Math.max(0, Number(decision.reconsiderMinutes || 0))
      const executeAt = delay > 0 ? Date.now() + delay * 60000 : undefined
      const reviewAt = reconsider > 0 ? Date.now() + reconsider * 60000 : undefined

      if (decision.observableReaction) {
        appendRelationshipEvent(chat, 'character_reaction', '对方有了新的反应', decision.observableReaction)
      }

      let deliveryStatus: 'none' | 'blocked' | 'timeline' | 'delivered' | 'suppressed' = 'none'
      if (decision.message) deliveryStatus = deliverCharacterMessage(chat, decision.message, 'relationship')

      const action = decision.action || 'none'
      if (delay === 0) {
        if (action === 'send_request' && relationship.friendship !== 'friends') {
          createFriendRequest(chat, 'character_to_user', decision.requestMessage || '想重新加你为好友')
        } else if (action === 'block_user') {
          characterBlocksUser(chat, decision.observableReaction || '')
        } else if (action === 'unblock_user') {
          characterUnblocksUser(chat)
        } else if (action === 'delete_friend') {
          deleteFriendByCharacter(chat, decision.observableReaction || '')
        } else if (action === 'accept_request' && relatedRequest) {
          acceptFriendRequest(chat, relatedRequest)
        } else if (action === 'reject_request' && relatedRequest) {
          rejectFriendRequest(chat, relatedRequest, decision.rejectionReason || '')
        }
      }

      const scheduledAction = delay > 0 ? action as RelationPlanAction : (reviewAt ? 'reconsider' : 'none')
      setRelationshipPlan(chat, {
        action: scheduledAction,
        summary: decision.planSummary || (scheduledAction === 'none' ? '目前没有新的打算' : '对方已经决定下一步'),
        executeAt: delay > 0 ? executeAt : undefined,
        reviewAt: reviewAt,
        visibility: decision.visibility || 'exact',
        status: (delay > 0 || reviewAt) ? 'active' : 'completed',
        requestId: relatedRequest?.id,
        requestMessage: decision.requestMessage,
        rejectionReason: decision.rejectionReason
      })
      persistRelationship(chat)
      return { ...decision, deliveryStatus }
    } catch (error: any) {
      relationshipError.value = error?.message || '关系推进失败，请稍后重试'
      if (trigger === 'scheduled_review') markRelationshipPlanRetry(chat, relationshipError.value)
      appendRelationshipEvent(chat, 'advance_error', '关系推进暂时失败', relationshipError.value)
      throw error
    } finally {
      isAdvancing.value = false
    }
  }

  return { isAdvancing, relationshipError, advanceRelationship }
}
