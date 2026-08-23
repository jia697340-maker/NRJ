import { loadForumSnapshot } from './forumRepository'
import type { ForumMemory, ForumSnapshot } from '../types/forum'

const readContacts = () => {
  const contacts: any[] = []
  if (typeof localStorage === 'undefined') return contacts
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key?.startsWith('clingy_custom_contacts')) continue
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]')
      if (Array.isArray(parsed)) contacts.push(...parsed)
    } catch {}
  }
  return contacts
}

const selectedTypes = (mode: string, configured: string[]) => {
  if (mode === 'selected') return new Set(configured)
  if (mode === 'summary') return new Set(['important-event'])
  if (mode === 'important') return new Set(['important-event', 'relationship'])
  if (mode === 'reachable-only') return new Set(['chat-daily', 'important-event', 'relationship'])
  return new Set(['chat-daily', 'chat-secret', 'important-event', 'relationship', 'image', 'voice'])
}

/** Forum memories visible to the same character in a one-to-one chat. */
export const buildForumToChatBridgeContext = async (characterEntityId: string) => {
  if (!characterEntityId) return ''
  const snapshot = await loadForumSnapshot()
  const subject = snapshot.subjects.find(item => item.kind === 'character' && item.sourceId === characterEntityId)
  if (!subject) return ''
  const participant = snapshot.participantPolicies.find(item => item.subjectId === subject.id)
  const bridge = snapshot.bridgePolicies.find(item => item.subjectId === subject.id)?.forumToChat
  if (!participant?.enabled || !bridge || bridge.mode === 'off') return ''
  const accountIds = new Set(snapshot.accounts.filter(item => item.subjectId === subject.id).map(item => item.id))
  const allowedTypes = selectedTypes(bridge.mode, bridge.memoryTypes)
  const items: string[] = []
  if (allowedTypes.has('post')) snapshot.posts.filter(item => accountIds.has(item.authorAccountId)).sort((a,b)=>Number(b.createdAt)-Number(a.createdAt)).slice(0,16).forEach(item => items.push(`自己在论坛发布：${item.content}`))
  if (allowedTypes.has('comment')) snapshot.comments.filter(item => accountIds.has(item.authorAccountId)).sort((a,b)=>Number(b.createdAt)-Number(a.createdAt)).slice(0,16).forEach(item => items.push(`自己在论坛评论：${item.content}`))
  if (allowedTypes.has('dm')) {
    const conversationIds = new Set(snapshot.conversations.filter(item => item.participantAccountIds.some(id => accountIds.has(id))).map(item => item.id))
    snapshot.messages.filter(item => item.conversationId && conversationIds.has(item.conversationId) && (accountIds.has(item.senderId) || item.receiverId && accountIds.has(item.receiverId))).sort((a,b)=>Number(b.createdAt)-Number(a.createdAt)).slice(0,20).reverse().forEach(item => items.push(`论坛私信：${item.content}`))
  }
  snapshot.memories.filter(item => item.subjectId === subject.id && allowedTypes.has(item.type)).sort((a,b)=>b.createdAt-a.createdAt).slice(0,20).forEach(item => items.push(item.summary))
  if (!items.length) return ''
  const body = bridge.mode === 'summary' ? items.slice(-8).join('；') : items.slice(-24).join('\n- ')
  return `\n\n【只属于当前角色的论坛记忆】\n- ${body}\n这些是当前角色经论坛合理获得的信息；不得据此推断匿名账号真实身份，也不得知道未参与论坛的角色。`
}

/** Chat memories are added only for a single forum subject, preventing cross-author leakage in a batch. */
export const collectChatToForumBridgeMemories = (snapshot: ForumSnapshot, involvedAccountIds: string[]): ForumMemory[] => {
  const subjectIds = [...new Set(snapshot.accounts.filter(item => involvedAccountIds.includes(item.id)).map(item => item.subjectId))]
  if (subjectIds.length !== 1) return []
  const subject = snapshot.subjects.find(item => item.id === subjectIds[0] && item.kind === 'character')
  if (!subject) return []
  const participant = snapshot.participantPolicies.find(item => item.subjectId === subject.id)
  const bridge = snapshot.bridgePolicies.find(item => item.subjectId === subject.id)?.chatToForum
  if (!participant?.enabled || !bridge || bridge.mode === 'off') return []
  const contact = readContacts().find(item => String(item.characterEntityId || item.id) === String(subject.sourceId))
  if (!contact) return []
  const allowed = selectedTypes(bridge.mode, bridge.memoryTypes)
  const records: Array<{ type: ForumMemory['type']; text: string; importance: number }> = []
  if (allowed.has('important-event')) (contact.memoryBook || []).filter((item: any) => item?.enabled !== false).slice(-12).forEach((item: any) => records.push({ type: 'important-event', text: String(item.content || item.summary || item.text || ''), importance: 8 }))
  if (allowed.has('relationship') && contact.relationship) {
    const relationship = contact.relationship
    const recentEvents = (relationship.events || []).slice(0, 6).map((item: any) => item.detail || item.title).filter(Boolean)
    records.push({ type: 'relationship', text: `关系状态：${relationship.friendship || '未知'}；屏蔽状态：${relationship.blockedBy || 'none'}${recentEvents.length ? `；近期事件：${recentEvents.join('、')}` : ''}`, importance: 7 })
  }
  if (allowed.has('chat-daily') || allowed.has('chat-secret')) (contact.messages || []).filter((item: any) => ['left', 'right'].includes(item.type) && item.content).slice(-(bridge.mode === 'summary' ? 8 : 24)).forEach((item: any) => records.push({ type: allowed.has('chat-secret') ? 'chat-secret' : 'chat-daily', text: `${item.type === 'left' ? subject.displayName : '用户'}：${String(item.content).slice(0, 500)}`, importance: 4 }))
  return records.filter(item => item.text.trim()).map((item, index) => ({ id: `chat_bridge_${subject.id}_${index}`, subjectId: subject.id, accountId: involvedAccountIds[0], type: item.type, summary: item.text, visibility: 'restricted', sourceEventIds: [], importance: item.importance, createdAt: Date.now() }))
}
