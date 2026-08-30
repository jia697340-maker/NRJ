/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type ReplyVariantMode = 'single' | 'group'

export interface ReplyVariant {
  id: string
  createdAt: number
  turnId: string
  messages: any[]
  state: Record<string, any>
}

export interface ReplyVariantSet {
  id: string
  mode: ReplyVariantMode
  parentMessageId: string | number | null
  activeVariantId: string
  createdAt: number
  updatedAt: number
  variants: ReplyVariant[]
}

export interface ReplyRegenerationSession {
  setId: string
  previousVariantId: string
  turnId: string
  mode: ReplyVariantMode
  removedMessageIds: Array<string | number>
}

export interface ReplyReplacementSession {
  turnId: string
  mode: ReplyVariantMode
  removedMessageIds: Array<string | number>
  originalState: Record<string, any>
  existingSetId: string
  existingVariantId: string
}

const MAX_VARIANTS_PER_TURN = 5

// These fields can be changed by a model reply and must travel with the selected candidate.
// Timeline metadata and the candidate collection itself deliberately stay outside the snapshot.
const SNAPSHOT_FIELDS = [
  'messages', 'innerThoughts', 'userInnerThoughts', 'memberInnerThoughts',
  'memoryBook', 'memoryState', 'lastSummaryMsgId', 'callSummaries',
  'relationship', 'statusText', 'offlineUntil', 'statusSource', 'statusSetAt',
  'presenceSession', 'presenceHistory', 'presencePendingReply', 'contactState',
  'autonomyLedger', 'autonomyDeliveries', 'autonomyHistory', 'autonomyState',
  'autonomyLastMeaningfulActionAt', 'pendingAutonomyDirective',
  'announcements', 'membershipRequests', 'adminLogs', 'memberPoints', 'memberMutes',
  'memberActivityDaily', 'memberIds', 'memberSettings', 'memberNicknames', 'adminIds',
  'ownerId', 'name', 'context', 'preview', 'time', 'unread', 'pendingUserThought',
  'activeCallType', 'activeCallStartedAt', 'activeCallTemporarySummary'
] as const

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? null))
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

const captureState = (chat: any) => Object.fromEntries(
  SNAPSHOT_FIELDS.filter(field => chat?.[field] !== undefined).map(field => [field, clone(chat[field])])
)

const applyState = (chat: any, state: Record<string, any>) => {
  for (const field of SNAPSHOT_FIELDS) {
    if (state[field] !== undefined) chat[field] = clone(state[field])
  }
}

export const ensureReplyVariantSets = (chat: any): ReplyVariantSet[] => {
  if (!Array.isArray(chat.replyVariantSets)) chat.replyVariantSets = []
  chat.replyVariantSets = chat.replyVariantSets.filter((set: any) => set && typeof set === 'object')
  chat.replyVariantSets.forEach((set: any) => {
    if (!Array.isArray(set.variants)) set.variants = []
  })
  return chat.replyVariantSets
}

const variantMessagesAtTail = (chat: any, variant: ReplyVariant) => {
  const ids = new Set(variant.messages.map(message => String(message.id)))
  const lastIndex = Math.max(-1, ...(chat.messages || []).map((message: any, index: number) => ids.has(String(message.id)) ? index : -1))
  return lastIndex === (chat.messages?.length || 0) - 1
}

const trailingReplyMessages = (chat: any, mode: ReplyVariantMode, offlineMode: false | 'mixed' | 'separate' = false) => {
  const messages = chat.messages || []
  let start = messages.length
  while (start > 0) {
    const message = messages[start - 1]
    const isReply = mode === 'group'
      ? message.type !== 'right'
      : message.type === 'left' && (offlineMode !== 'separate' || message.isOfflineMeetMsg)
    if (!isReply) break
    start--
  }
  return { start, messages: messages.slice(start) }
}

const parentMessageBefore = (chat: any, start: number) => {
  for (let index = start - 1; index >= 0; index--) {
    if (chat.messages[index]?.type === 'right') return chat.messages[index]
  }
  return null
}

const markVariantMessages = (messages: any[], setId: string, variantId: string) => {
  messages.forEach(message => {
    message.replyVariantSetId = setId
    message.replyVariantId = variantId
  })
}

const clearVariantMessageMarks = (messages: any[], setId?: string) => {
  messages.forEach(message => {
    if (setId && String(message.replyVariantSetId || '') !== String(setId)) return
    delete message.replyVariantSetId
    delete message.replyVariantId
  })
}

const replaceMessageReferences = (messages: any[], setId: string, variantId: string | null, replacement: any[], keepMarks: boolean) => {
  const indexes = messages
    .map((message: any, index: number) => {
      const matchesSet = String(message.replyVariantSetId || '') === setId
      const matchesVariant = variantId === null || String(message.replyVariantId || '') === variantId
      return matchesSet && matchesVariant ? index : -1
    })
    .filter((index: number) => index >= 0)
  if (!indexes.length) return
  const nextMessages = clone(replacement)
  if (keepMarks) {
    const replacementVariantId = String(nextMessages[0]?.replyVariantId || '')
    if (replacementVariantId) markVariantMessages(nextMessages, setId, replacementVariantId)
  } else clearVariantMessageMarks(nextMessages)
  messages.splice(indexes[0], indexes.length, ...nextMessages)
}

const scrubStoredVariantReferences = (chat: any, setId: string, variantId: string | null, replacement: any[], keepMarks: boolean) => {
  for (const candidateSet of ensureReplyVariantSets(chat)) {
    for (const candidate of candidateSet.variants || []) {
      if (Array.isArray(candidate.state?.messages)) replaceMessageReferences(candidate.state.messages, setId, variantId, replacement, keepMarks)
    }
  }
}

const setPendingReplacement = (chat: any, session: ReplyReplacementSession) => {
  Object.defineProperty(chat, '_pendingReplyReplacement', {
    value: session,
    configurable: true,
    enumerable: false,
    writable: true
  })
}

const clearPendingReplacement = (chat: any, session?: ReplyReplacementSession) => {
  if (!session || chat?._pendingReplyReplacement === session) delete chat._pendingReplyReplacement
}

export const hasPendingReplyReplacement = (chat: any) => Boolean(chat?._pendingReplyReplacement)

const removeTurnThoughts = (chat: any, turnId: string, mode: ReplyVariantMode) => {
  if (turnId) chat.innerThoughts = (chat.innerThoughts || []).filter((item: any) => item.turnId !== turnId)
  if (mode === 'group' && chat.memberInnerThoughts) {
    for (const memberId of Object.keys(chat.memberInnerThoughts)) {
      chat.memberInnerThoughts[memberId] = (chat.memberInnerThoughts[memberId] || []).filter((item: any) => item.turnId !== turnId)
    }
  }
}

export const prepareReplyRegeneration = (
  chat: any,
  mode: ReplyVariantMode,
  offlineMode: false | 'mixed' | 'separate' = false
): ReplyRegenerationSession | null => {
  const trailing = trailingReplyMessages(chat, mode, offlineMode)
  if (!trailing.messages.length) return null

  const sets = ensureReplyVariantSets(chat)
  const existingSetId = trailing.messages.find((message: any) => message.replyVariantSetId)?.replyVariantSetId
  let set = existingSetId ? sets.find(item => item.id === existingSetId) : undefined
  let active = set?.variants.find(item => item.id === set!.activeVariantId)
  const turnId = String(trailing.messages.find((message: any) => message.turnId)?.turnId || uid(mode === 'group' ? 'group_turn' : 'turn'))

  if (!set) {
    const setId = uid('reply_set')
    const variantId = uid('reply_variant')
    markVariantMessages(trailing.messages, setId, variantId)
    active = { id: variantId, createdAt: Date.now(), turnId, messages: clone(trailing.messages), state: captureState(chat) }
    set = {
      id: setId,
      mode,
      parentMessageId: parentMessageBefore(chat, trailing.start)?.id ?? null,
      activeVariantId: variantId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      variants: [active]
    }
    sets.push(set)
  } else if (active) {
    markVariantMessages(trailing.messages, set.id, active.id)
    active.messages = clone(trailing.messages)
    active.state = captureState(chat)
  }

  if (!set || !active) return null
  chat.messages.splice(trailing.start)
  removeTurnThoughts(chat, turnId, mode)
  chat.pendingReplyVariantSetId = set.id

  return { setId: set.id, previousVariantId: active.id, turnId, mode, removedMessageIds: trailing.messages.map((message: any) => message.id) }
}

export const completeReplyRegeneration = (chat: any, session: ReplyRegenerationSession) => {
  const set = ensureReplyVariantSets(chat).find(item => item.id === session.setId)
  if (!set) return false
  const newMessages = (chat.messages || []).filter((message: any) => String(message.turnId || '') === session.turnId)
  if (!newMessages.length) {
    restoreReplyVariant(chat, session.setId, session.previousVariantId, true)
    return false
  }

  const variantId = uid('reply_variant')
  markVariantMessages(newMessages, set.id, variantId)
  set.activeVariantId = variantId
  set.updatedAt = Date.now()
  set.variants.push({ id: variantId, createdAt: Date.now(), turnId: session.turnId, messages: clone(newMessages), state: captureState(chat) })
  if (set.variants.length > MAX_VARIANTS_PER_TURN) {
    const removable = set.variants.find(item => item.id !== set.activeVariantId)
    if (removable) set.variants.splice(set.variants.indexOf(removable), 1)
  }
  delete chat.pendingReplyVariantSetId
  return true
}

// Replacement mode deliberately never creates a variant container. The original state only
// lives on the in-memory chat object, and persistence callers pause while this session exists.
export const prepareReplyReplacement = (
  chat: any,
  mode: ReplyVariantMode,
  offlineMode: false | 'mixed' | 'separate' = false
): ReplyReplacementSession | null => {
  if (hasPendingReplyReplacement(chat)) return null
  const trailing = trailingReplyMessages(chat, mode, offlineMode)
  if (!trailing.messages.length) return null

  const existingSetId = String(trailing.messages.find((message: any) => message.replyVariantSetId)?.replyVariantSetId || '')
  const set = existingSetId ? ensureReplyVariantSets(chat).find(item => item.id === existingSetId) : undefined
  const active = set?.variants.find(item => item.id === set.activeVariantId)
  const turnId = String(trailing.messages.find((message: any) => message.turnId)?.turnId || uid(mode === 'group' ? 'group_turn' : 'turn'))
  const session: ReplyReplacementSession = {
    turnId,
    mode,
    removedMessageIds: trailing.messages.map((message: any) => message.id),
    originalState: captureState(chat),
    existingSetId: set && active ? set.id : '',
    existingVariantId: active?.id || ''
  }

  setPendingReplacement(chat, session)
  chat.messages.splice(trailing.start)
  removeTurnThoughts(chat, turnId, mode)
  return session
}

export const completeReplyReplacement = (chat: any, session: ReplyReplacementSession) => {
  const newMessages = (chat.messages || []).filter((message: any) => String(message.turnId || '') === session.turnId)
  if (!newMessages.length) {
    restoreReplyAfterReplacementFailure(chat, session)
    return false
  }

  const set = session.existingSetId
    ? ensureReplyVariantSets(chat).find(item => item.id === session.existingSetId)
    : undefined
  const active = set?.variants.find(item => item.id === session.existingVariantId)
  if (set && active) {
    markVariantMessages(newMessages, set.id, active.id)
    scrubStoredVariantReferences(chat, set.id, active.id, newMessages, true)
    set.activeVariantId = active.id
    set.updatedAt = Date.now()
    active.messages = clone(newMessages)
    active.state = captureState(chat)
  } else {
    clearVariantMessageMarks(newMessages)
  }
  clearPendingReplacement(chat, session)
  return true
}

export const restoreReplyAfterReplacementFailure = (chat: any, session: ReplyReplacementSession) => {
  applyState(chat, session.originalState)
  clearPendingReplacement(chat, session)
  return { ok: true, needsTimeline: false }
}

export const restoreReplyVariant = (chat: any, setId: string, variantId: string, force = false) => {
  const set = ensureReplyVariantSets(chat).find(item => item.id === setId)
  const variant = set?.variants.find(item => item.id === variantId)
  const active = set?.variants.find(item => item.id === set.activeVariantId)
  if (!set || !variant || !active) return { ok: false, needsTimeline: false }
  if (!force && !variantMessagesAtTail(chat, active)) return { ok: false, needsTimeline: true, parentMessageId: set.parentMessageId }

  applyState(chat, variant.state)
  set.activeVariantId = variant.id
  set.updatedAt = Date.now()
  markVariantMessages(variant.messages, set.id, variant.id)
  return { ok: true, needsTimeline: false }
}

export const restorePreviousReplyAfterFailure = (chat: any, session: ReplyRegenerationSession) => {
  const result = restoreReplyVariant(chat, session.setId, session.previousVariantId, true)
  if (chat.pendingReplyVariantSetId === session.setId) delete chat.pendingReplyVariantSetId
  return result
}

export const recoverInterruptedReplyRegeneration = (chat: any) => {
  const setId = String(chat?.pendingReplyVariantSetId || '')
  if (!setId) return false
  const set = ensureReplyVariantSets(chat).find(item => item.id === setId)
  const active = set?.variants.find(item => item.id === set.activeVariantId)
  if (!set || !active) {
    delete chat.pendingReplyVariantSetId
    return false
  }
  restoreReplyVariant(chat, set.id, active.id, true)
  delete chat.pendingReplyVariantSetId
  return true
}

export const replyVariantControlForMessage = (chat: any, messageId: string | number) => {
  for (const set of ensureReplyVariantSets(chat)) {
    if (!Array.isArray(set.variants) || set.variants.length < 2) continue
    const activeIndex = set.variants.findIndex(item => item.id === set.activeVariantId)
    const active = set.variants[activeIndex]
    if (!active) continue
    const visibleIds = active.messages.map(message => String(message.id))
    if (visibleIds[visibleIds.length - 1] !== String(messageId)) continue
    return { set, active, activeIndex, count: set.variants.length, isTail: variantMessagesAtTail(chat, active) }
  }
  return null
}

const replaceVisibleVariantMessages = (chat: any, set: ReplyVariantSet, fromVariantId: string, variant: ReplyVariant) => {
  const indexes = (chat.messages || [])
    .map((message: any, index: number) => String(message.replyVariantSetId || '') === set.id && String(message.replyVariantId || '') === fromVariantId ? index : -1)
    .filter((index: number) => index >= 0)
  if (!indexes.length) return false
  const replacement = clone(variant.messages)
  markVariantMessages(replacement, set.id, variant.id)
  chat.messages.splice(indexes[0], indexes.length, ...replacement)
  return true
}

const collapseReplyVariantSet = (chat: any, set: ReplyVariantSet, active: ReplyVariant) => {
  scrubStoredVariantReferences(chat, set.id, null, active.messages, false)
  clearVariantMessageMarks(chat.messages || [], set.id)
  chat.replyVariantSets = ensureReplyVariantSets(chat).filter(item => item.id !== set.id)
  if (String(chat.pendingReplyVariantSetId || '') === set.id) delete chat.pendingReplyVariantSetId
}

export const deleteActiveReplyVariant = (chat: any, setId: string) => {
  const set = ensureReplyVariantSets(chat).find(item => item.id === setId)
  if (!set || !Array.isArray(set.variants) || set.variants.length < 2 || chat.pendingReplyVariantSetId === set.id) return { ok: false, count: set?.variants?.length || 0 }
  const activeIndex = set.variants.findIndex(item => item.id === set.activeVariantId)
  if (activeIndex < 0) return { ok: false, count: set.variants.length }
  const active = set.variants[activeIndex]
  const wasTail = variantMessagesAtTail(chat, active)
  set.variants.splice(activeIndex, 1)
  const next = set.variants[Math.min(activeIndex, set.variants.length - 1)]
  if (!next) return { ok: false, count: 0 }

  if (wasTail) applyState(chat, next.state)
  else replaceVisibleVariantMessages(chat, set, active.id, next)
  scrubStoredVariantReferences(chat, set.id, active.id, next.messages, true)
  set.activeVariantId = next.id
  set.updatedAt = Date.now()
  markVariantMessages(next.messages, set.id, next.id)
  if (set.variants.length === 1) collapseReplyVariantSet(chat, set, next)
  return { ok: true, count: set.variants.length }
}

export const keepOnlyActiveReplyVariant = (chat: any, setId: string) => {
  const set = ensureReplyVariantSets(chat).find(item => item.id === setId)
  const active = set?.variants.find(item => item.id === set.activeVariantId)
  if (!set || !active || set.variants.length < 2 || chat.pendingReplyVariantSetId === set.id) return { ok: false, count: set?.variants?.length || 0 }
  collapseReplyVariantSet(chat, set, active)
  return { ok: true, count: 1 }
}

export const getReplyVariant = (chat: any, setId: string, variantId: string) => {
  const set = ensureReplyVariantSets(chat).find(item => item.id === setId)
  return set?.variants.find(item => item.id === variantId) || null
}

export const adjacentReplyVariantId = (chat: any, setId: string, direction: -1 | 1) => {
  const set = ensureReplyVariantSets(chat).find(item => item.id === setId)
  if (!set) return null
  const index = set.variants.findIndex(item => item.id === set.activeVariantId)
  const next = index + direction
  return next >= 0 && next < set.variants.length ? set.variants[next].id : null
}
