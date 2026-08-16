/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import { embeddingApiSettings, globalPromptSettings } from '../store'
import { estimateTextTokens } from '../utils/tokenEstimate'

export type MemoryMode = 'narrative' | 'subjective' | 'event' | 'variable' | 'table' | 'hybrid'

export interface MemoryEvidence {
  messageIds: Array<number | string>
  excerpt?: string
}

export interface MemoryEvent {
  id: string
  title: string
  summary: string
  startTime?: string
  endTime?: string
  participants: string[]
  location?: string
  result?: string
  decisions: string[]
  unresolved: string[]
  tags: string[]
  importance: number
  emotionBefore?: string
  emotionAfter?: string
  relationshipChange?: string
  evidence: MemoryEvidence
  createdAt: number
  updatedAt: number
  enabled: boolean
}

export interface MemoryVariable {
  id: string
  category: string
  key: string
  value: string
  previousValues: Array<{ value: string; replacedAt: number }>
  confidence: number
  firstSeenAt: number
  lastConfirmedAt: number
  validFrom?: string
  validTo?: string
  status: 'active' | 'superseded' | 'uncertain'
  locked: boolean
  evidence: MemoryEvidence
}

export interface MemoryTableRow {
  id: string
  table: 'people' | 'preferences' | 'events' | 'commitments' | 'gifts' | 'relationships' | 'timeline' | 'conflicts' | 'places'
  title: string
  value: string
  status: string
  time?: string
  tags: string[]
  importance: number
  evidence: MemoryEvidence
  createdAt: number
  updatedAt: number
}

export interface MemoryRelation {
  id: string
  source: string
  target: string
  relation: string
  startTime?: string
  endTime?: string
  status: 'active' | 'superseded' | 'uncertain'
  confidence: number
  evidence: MemoryEvidence
  createdAt: number
  updatedAt: number
}

export interface MemoryCoverage {
  fromMsgId: number
  toMsgId: number
  summarizedAt: number
  mode: MemoryMode
}

export interface StructuredMemoryState {
  version: 2
  events: MemoryEvent[]
  variables: MemoryVariable[]
  tableRows: MemoryTableRow[]
  relations: MemoryRelation[]
  coverage: MemoryCoverage[]
  lastConsolidatedAt: number
}

export interface MemoryExtractionResult {
  narrative: string
  subjective: string
  memberMemories: Record<string, string>
  events: Array<Partial<MemoryEvent>>
  variables: Array<Partial<MemoryVariable>>
  tableRows: Array<Partial<MemoryTableRow>>
  relations: Array<Partial<MemoryRelation>>
}

interface VectorRecord {
  id: string
  chatId: string
  sourceType: 'narrative' | 'event' | 'variable' | 'table' | 'relation'
  sourceId: string
  text: string
  vector: number[]
  model: string
  dimensions: number
  createdAt: number
}

const vectorStore = localforage.createInstance({ name: 'nrt-app', storeName: 'memoryVectors' })

const defaultState = (): StructuredMemoryState => ({
  version: 2,
  events: [],
  variables: [],
  tableRows: [],
  relations: [],
  coverage: [],
  lastConsolidatedAt: 0
})

export const ensureMemoryState = (chat: any): StructuredMemoryState => {
  if (!chat.memoryState || chat.memoryState.version !== 2) {
    const previous = chat.memoryState || {}
    chat.memoryState = {
      ...defaultState(),
      events: Array.isArray(previous.events) ? previous.events : [],
      variables: Array.isArray(previous.variables) ? previous.variables : [],
      tableRows: Array.isArray(previous.tableRows) ? previous.tableRows : [],
      relations: Array.isArray(previous.relations) ? previous.relations : [],
      coverage: Array.isArray(previous.coverage) ? previous.coverage : [],
      lastConsolidatedAt: previous.lastConsolidatedAt || 0
    }
  }
  if (!Array.isArray(chat.memoryState.events)) chat.memoryState.events = []
  if (!Array.isArray(chat.memoryState.variables)) chat.memoryState.variables = []
  if (!Array.isArray(chat.memoryState.tableRows)) chat.memoryState.tableRows = []
  if (!Array.isArray(chat.memoryState.relations)) chat.memoryState.relations = []
  if (!Array.isArray(chat.memoryState.coverage)) chat.memoryState.coverage = []
  if (!Array.isArray(chat.memoryBook)) chat.memoryBook = []

  // 兼容旧版单游标：只在没有新区间数据时迁移一次。
  if (chat.memoryState.coverage.length === 0 && chat.lastSummaryMsgId) {
    const valid = (chat.messages || []).filter(isMemoryMessage)
    const first = valid[0]?.id
    if (typeof first === 'number') {
      chat.memoryState.coverage.push({
        fromMsgId: first,
        toMsgId: Number(chat.lastSummaryMsgId),
        summarizedAt: Date.now(),
        mode: 'narrative'
      })
    }
  }
  return chat.memoryState
}

export const isMemoryMessage = (message: any) =>
  Boolean(message && (message.type === 'left' || message.type === 'right' || message.type === 'system' || message.type === 'narration'))

const isCovered = (id: number, coverage: MemoryCoverage[]) =>
  coverage.some(range => id >= range.fromMsgId && id <= range.toMsgId)

export const getUncoveredMessages = (chat: any) => {
  const state = ensureMemoryState(chat)
  return (chat.messages || []).filter((message: any) =>
    isMemoryMessage(message) &&
    message.isRecalled !== true &&
    message.isUndelivered !== true &&
    message.excludeFromGeneralMemory !== true &&
    typeof message.id === 'number' &&
    !isCovered(message.id, state.coverage)
  )
}

export const addCoverage = (chat: any, messages: any[], mode: MemoryMode) => {
  const state = ensureMemoryState(chat)
  const ids = messages.map(item => Number(item.id)).filter(Number.isFinite).sort((a, b) => a - b)
  if (ids.length === 0) return
  state.coverage.push({ fromMsgId: ids[0], toMsgId: ids[ids.length - 1], summarizedAt: Date.now(), mode })
  state.coverage.sort((a, b) => a.fromMsgId - b.fromMsgId)
  const merged: MemoryCoverage[] = []
  for (const current of state.coverage) {
    const previous = merged[merged.length - 1]
    if (previous && current.fromMsgId <= previous.toMsgId + 1) {
      previous.toMsgId = Math.max(previous.toMsgId, current.toMsgId)
      previous.summarizedAt = Math.max(previous.summarizedAt, current.summarizedAt)
    } else {
      merged.push({ ...current })
    }
  }
  state.coverage = merged
  chat.lastSummaryMsgId = Math.max(Number(chat.lastSummaryMsgId || 0), ids[ids.length - 1])
}

const safeId = (prefix: string, seed = '') => `${prefix}_${Date.now()}_${Math.abs(hashText(seed || Math.random().toString()))}`

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

const evidenceFrom = (value: any, fallbackIds: Array<number | string>): MemoryEvidence => ({
  messageIds: Array.isArray(value?.messageIds) && value.messageIds.length > 0 ? value.messageIds : fallbackIds,
  excerpt: typeof value?.excerpt === 'string' ? value.excerpt.slice(0, 240) : ''
})

export const applyMemoryExtraction = (
  chat: any,
  result: MemoryExtractionResult,
  sourceMessages: any[],
  mode: MemoryMode,
  options: { includeNarrative?: boolean; addCoverage?: boolean } = {}
) => {
  const state = ensureMemoryState(chat)
  const now = Date.now()
  const evidenceIds = sourceMessages.map(item => item.id).filter((id: any) => id !== undefined)

  const narrativeContent = chat.chatType === 'group'
    ? result.narrative
    : (mode === 'subjective' && result.subjective ? result.subjective : (result.narrative || result.subjective))
  if (options.includeNarrative !== false && narrativeContent) {
    const content = narrativeContent
    chat.memoryBook.push({
      id: now,
      date: new Date().toLocaleDateString('zh-CN'),
      content,
      subjectiveContent: result.subjective || '',
      memoryMode: mode,
      messageCount: sourceMessages.length,
      fromMsgId: sourceMessages[0]?.id,
      toMsgId: sourceMessages[sourceMessages.length - 1]?.id,
      evidenceMessageIds: evidenceIds,
      version: 2,
      createdAt: now,
      updatedAt: now,
      enabled: true
    })
  }

  if (chat.chatType === 'group' && result.memberMemories && typeof result.memberMemories === 'object') {
    if (!chat.memberMemories || typeof chat.memberMemories !== 'object') chat.memberMemories = {}
    for (const [memberId, rawContent] of Object.entries(result.memberMemories)) {
      const content = String(rawContent || '').trim()
      if (!content || !Array.isArray(chat.memberIds) || !chat.memberIds.map(String).includes(String(memberId))) continue
      if (!Array.isArray(chat.memberMemories[memberId])) chat.memberMemories[memberId] = []
      chat.memberMemories[memberId].push({
        id: safeId(`member_${memberId}`, content), date: new Date().toLocaleDateString('zh-CN'), content,
        memoryMode: mode, messageCount: sourceMessages.length,
        fromMsgId: sourceMessages[0]?.id, toMsgId: sourceMessages[sourceMessages.length - 1]?.id,
        evidenceMessageIds: evidenceIds, sourceGroupId: chat.id, version: 2,
        createdAt: now, updatedAt: now, enabled: true
      })
    }
  }

  for (const raw of result.events || []) {
    if (!raw.title && !raw.summary) continue
    const title = String(raw.title || '未命名事件').slice(0, 80)
    const summary = String(raw.summary || '').slice(0, 800)
    const duplicate = state.events.find(item => item.title === title && item.summary === summary)
    if (duplicate) {
      duplicate.updatedAt = now
      duplicate.evidence = evidenceFrom(raw.evidence, evidenceIds)
      continue
    }
    state.events.push({
      id: String(raw.id || safeId('event', title + summary)),
      title,
      summary,
      startTime: raw.startTime || '', endTime: raw.endTime || '',
      participants: Array.isArray(raw.participants) ? raw.participants.map(String) : [],
      location: raw.location || '', result: raw.result || '',
      decisions: Array.isArray(raw.decisions) ? raw.decisions.map(String) : [],
      unresolved: Array.isArray(raw.unresolved) ? raw.unresolved.map(String) : [],
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
      importance: clamp(raw.importance, 1, 5, 3),
      emotionBefore: raw.emotionBefore || '', emotionAfter: raw.emotionAfter || '',
      relationshipChange: raw.relationshipChange || '',
      evidence: evidenceFrom(raw.evidence, evidenceIds),
      createdAt: now, updatedAt: now, enabled: raw.enabled !== false
    })
  }

  for (const raw of result.variables || []) {
    const key = String(raw.key || '').trim()
    const value = String(raw.value || '').trim()
    if (!key || !value) continue
    const category = String(raw.category || '其他')
    const existing = state.variables.find(item => item.category === category && item.key === key && item.status === 'active')
    if (existing) {
      if (!existing.locked && existing.value !== value) {
        existing.previousValues = existing.previousValues || []
        existing.previousValues.push({ value: existing.value, replacedAt: now })
        existing.value = value
      }
      existing.lastConfirmedAt = now
      existing.confidence = clamp(raw.confidence, 0, 1, existing.confidence || 0.7)
      existing.evidence = evidenceFrom(raw.evidence, evidenceIds)
      existing.validFrom = raw.validFrom || existing.validFrom
      existing.validTo = raw.validTo || existing.validTo
    } else {
      state.variables.push({
        id: String(raw.id || safeId('variable', category + key)), category, key, value,
        previousValues: [], confidence: clamp(raw.confidence, 0, 1, 0.7),
        firstSeenAt: now, lastConfirmedAt: now,
        validFrom: raw.validFrom || '', validTo: raw.validTo || '',
        status: raw.status === 'uncertain' ? 'uncertain' : 'active',
        locked: Boolean(raw.locked), evidence: evidenceFrom(raw.evidence, evidenceIds)
      })
    }
  }

  const allowedTables = new Set(['people', 'preferences', 'events', 'commitments', 'gifts', 'relationships', 'timeline', 'conflicts', 'places'])
  for (const raw of result.tableRows || []) {
    const title = String(raw.title || '').trim()
    const value = String(raw.value || '').trim()
    if (!title || !value) continue
    const table = allowedTables.has(String(raw.table)) ? raw.table as MemoryTableRow['table'] : 'events'
    const existing = state.tableRows.find(item => item.table === table && item.title === title && item.status !== 'archived')
    if (existing) {
      existing.value = value
      existing.status = String(raw.status || existing.status || '有效')
      existing.time = raw.time || existing.time
      existing.tags = Array.isArray(raw.tags) ? raw.tags.map(String) : existing.tags
      existing.importance = clamp(raw.importance, 1, 5, existing.importance || 3)
      existing.evidence = evidenceFrom(raw.evidence, evidenceIds)
      existing.updatedAt = now
    } else {
      state.tableRows.push({
        id: String(raw.id || safeId('row', String(table) + title)), table, title, value,
        status: String(raw.status || '有效'), time: raw.time || '',
        tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
        importance: clamp(raw.importance, 1, 5, 3),
        evidence: evidenceFrom(raw.evidence, evidenceIds), createdAt: now, updatedAt: now
      })
    }
  }
  for (const raw of result.relations || []) {
    const source = String(raw.source || '').trim()
    const target = String(raw.target || '').trim()
    const relation = String(raw.relation || '').trim()
    if (!source || !target || !relation) continue
    const existing = state.relations.find(item => item.source === source && item.target === target && item.relation === relation && item.status === 'active')
    if (existing) {
      existing.startTime = raw.startTime || existing.startTime
      existing.endTime = raw.endTime || existing.endTime
      existing.confidence = clamp(raw.confidence, 0, 1, existing.confidence)
      existing.evidence = evidenceFrom(raw.evidence, evidenceIds)
      existing.updatedAt = now
    } else {
      state.relations.push({
        id: String(raw.id || safeId('relation', source + target + relation)), source, target, relation,
        startTime: raw.startTime || '', endTime: raw.endTime || '',
        status: raw.status === 'uncertain' ? 'uncertain' : 'active',
        confidence: clamp(raw.confidence, 0, 1, 0.75), evidence: evidenceFrom(raw.evidence, evidenceIds),
        createdAt: now, updatedAt: now
      })
    }
  }
  state.lastConsolidatedAt = now
  if (options.addCoverage !== false) addCoverage(chat, sourceMessages, mode)
}

const evidenceOverlaps = (evidence: MemoryEvidence | undefined, ids: Set<number | string>) =>
  Boolean(evidence?.messageIds?.some(id => ids.has(id) || ids.has(Number(id)) || ids.has(String(id))))

export const replaceStructuredMemoriesForEvidence = (
  chat: any,
  result: MemoryExtractionResult,
  sourceMessages: any[],
  mode: MemoryMode
) => {
  const state = ensureMemoryState(chat)
  const evidenceIds = new Set<number | string>(sourceMessages.flatMap(item =>
    Array.isArray(item?.evidenceMessageIds) ? item.evidenceMessageIds : []
  ))

  if (evidenceIds.size > 0) {
    state.events = state.events.filter(item => !evidenceOverlaps(item.evidence, evidenceIds))
    state.variables = state.variables.filter(item => !evidenceOverlaps(item.evidence, evidenceIds))
    state.tableRows = state.tableRows.filter(item => !evidenceOverlaps(item.evidence, evidenceIds))
    state.relations = state.relations.filter(item => !evidenceOverlaps(item.evidence, evidenceIds))
  }

  const evidenceMessages = sourceMessages.flatMap(item =>
    (item.evidenceMessageIds || []).map((id: number | string) => ({ id }))
  )
  applyMemoryExtraction(chat, result, evidenceMessages, mode, { includeNarrative: false, addCoverage: false })
}

export const formatMessagesForMemory = (messages: any[]) => messages.map(message => {
  const english = globalPromptSettings.language === 'en'
  const groupSpeaker = message.senderNameSnapshot || message.senderName || message.senderId
  const speaker = message.type === 'left'
    ? (groupSpeaker ? String(groupSpeaker) : (english ? 'Character' : '角色'))
    : message.type === 'right' ? (english ? 'User' : '用户') : (english ? 'System' : '系统')
  const marked = message.isMarked ? (english ? '[Important] ' : '【重要标记】') : ''
  const time = message.timestamp || message.time || ''
  const media = message.imageData?.summary ? ` [${english ? 'Image' : '图片'}: ${message.imageData.summary}]`
    : message.voiceData?.text ? ` [${english ? 'Voice' : '语音'}: ${message.voiceData.text}]`
      : message.emojiSummary ? ` [${english ? 'Sticker' : '表情'}: ${message.emojiSummary}]`
        : message.isCallRecord ? ` [${english ? 'Call record' : '通话记录'}: ${message.content || ''}]` : ''
  return `[${english ? 'Message ID' : '消息ID'}:${message.id}${time ? ` ${english ? 'Time' : '时间'}:${time}` : ''}] ${speaker}: ${marked}${String(message.content || '')}${media}`
}).join('\n')

export const buildExtractionPrompt = (
  messages: any[],
  mode: MemoryMode,
  customPrompt = '',
  groupContext?: { name?: string; members?: Array<{ id: string; name: string }> }
) => {
  const groupRules = groupContext
    ? `\n这是群聊“${groupContext.name || '未命名群聊'}”。成员清单：${(groupContext.members || []).map(item => `${item.name}(ID:${item.id})`).join('、')}。\n群聊附加要求：客观记忆必须保留真实发言者和参与者。JSON 顶层额外输出 memberMemories 对象，键只能使用成员 ID，值为该成员的第一人称主观记忆。只记录该成员亲历、听见或被明确告知的内容，不得让成员知道其未接触的信息；没有内容的成员不要生成键。`
    : ''
  if (globalPromptSettings.language === 'en') {
    const modeInstruction: Record<MemoryMode, string> = {
      narrative: 'Prioritize an objective narrative summary. Extract events, variables, and table rows only when explicit and important.',
      subjective: 'Prioritize the character’s first-person subjective memory. Never present subjective feelings as objective facts.',
      event: 'Prioritize separate event cards with time, participants, causality, result, unresolved matters, and evidence.',
      variable: 'Prioritize updatable user/character profile variables, preferences, boundaries, relationship states, and commitments.',
      table: 'Prioritize records suitable for table management and assign the specified table category.',
      hybrid: 'Produce a short narrative, character-subjective memory, event cards, variable updates, and table rows together.'
    }
    return `You are a long-term memory organization engine. Build memory only from the original conversation and never add facts absent from the source.\n${modeInstruction[mode]}${groupRules}\n${customPrompt ? `Additional user requirements:\n${customPrompt}\n` : ''}
Requirements:
1. Leave unclear times blank. Any uncertain fact must have confidence below 0.7.
2. Never turn a temporary emotion into a permanent personality trait.
3. Preserve evidence.messageIds for every item.
4. Output valid JSON only—no Markdown, explanation, or reasoning.
5. Return [] for empty arrays and an empty string for absent text.
6. Write natural-language memory content in Simplified Chinese when the source conversation is Chinese; preserve the source language otherwise.

JSON schema:
{"narrative":"100–300 Chinese characters of objective summary","subjective":"character's first-person subjective memory","events":[{"title":"","summary":"","startTime":"","endTime":"","participants":[],"location":"","result":"","decisions":[],"unresolved":[],"tags":[],"importance":1,"emotionBefore":"","emotionAfter":"","relationshipChange":"","evidence":{"messageIds":[],"excerpt":""}}],"variables":[{"category":"身份/称呼/日期/喜好/禁忌/习惯/人物/工作学校/位置/关系/计划/承诺/矛盾/状态/其他","key":"","value":"","confidence":0.8,"validFrom":"","validTo":"","evidence":{"messageIds":[],"excerpt":""}}],"tableRows":[{"table":"people/preferences/events/commitments/gifts/relationships/timeline/conflicts/places","title":"","value":"","status":"有效","time":"","tags":[],"importance":1,"evidence":{"messageIds":[],"excerpt":""}}],"relations":[{"source":"person or entity","target":"person or entity","relation":"relationship or effect","startTime":"","endTime":"","confidence":0.8,"evidence":{"messageIds":[],"excerpt":""}}]}

Conversation:
${formatMessagesForMemory(messages)}`
  }
  const modeInstruction: Record<MemoryMode, string> = {
    narrative: '重点生成客观叙事摘要；事件、变量和表格只提取明确且重要的内容。',
    subjective: '重点生成角色第一人称的主观记忆；主观感受不得冒充客观事实。',
    event: '重点拆分独立事件卡，保留时间、人物、因果、结果、未完成事项和证据。',
    variable: '重点提取可更新的用户/角色档案变量、喜好、边界、关系状态和承诺。',
    table: '重点生成适合表格管理的记录行，按指定 table 分类。',
    hybrid: '同时生成简短叙事、角色主观记忆、事件卡、变量更新和表格行。'
  }
  return `你是长期记忆整理引擎。只能依据聊天原文建立记忆，不得补写原文不存在的事实。\n${modeInstruction[mode]}${groupRules}\n${customPrompt ? `用户补充要求：\n${customPrompt}\n` : ''}
要求：\n1. 时间不明确就留空；不确定事实的 confidence 必须低于 0.7。\n2. 临时情绪不得写成永久性格。\n3. 每项都保留 evidence.messageIds。\n4. 只输出合法 JSON，不要 Markdown、解释或思维过程。\n5. 没有内容的数组返回 []，没有文本返回空字符串。\n\nJSON 结构：\n{"narrative":"100-300字客观摘要","subjective":"角色第一人称主观记忆","events":[{"title":"","summary":"","startTime":"","endTime":"","participants":[],"location":"","result":"","decisions":[],"unresolved":[],"tags":[],"importance":1,"emotionBefore":"","emotionAfter":"","relationshipChange":"","evidence":{"messageIds":[],"excerpt":""}}],"variables":[{"category":"身份/称呼/日期/喜好/禁忌/习惯/人物/工作学校/位置/关系/计划/承诺/矛盾/状态/其他","key":"","value":"","confidence":0.8,"validFrom":"","validTo":"","evidence":{"messageIds":[],"excerpt":""}}],"tableRows":[{"table":"people/preferences/events/commitments/gifts/relationships/timeline/conflicts/places","title":"","value":"","status":"有效","time":"","tags":[],"importance":1,"evidence":{"messageIds":[],"excerpt":""}}],"relations":[{"source":"人物或实体","target":"人物或实体","relation":"关系或作用","startTime":"","endTime":"","confidence":0.8,"evidence":{"messageIds":[],"excerpt":""}}]}\n\n聊天记录：\n${formatMessagesForMemory(messages)}`
}

export const parseMemoryExtraction = (raw: string): MemoryExtractionResult => {
  const cleaned = String(raw || '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').replace(/\[incipere\][\s\S]*?\[finire\]/gi, '').trim()
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = fenced || cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1)
  try {
    const parsed = JSON.parse(candidate)
    return {
      narrative: typeof parsed.narrative === 'string' ? parsed.narrative.trim() : '',
      subjective: typeof parsed.subjective === 'string' ? parsed.subjective.trim() : '',
      memberMemories: parsed.memberMemories && typeof parsed.memberMemories === 'object' && !Array.isArray(parsed.memberMemories) ? parsed.memberMemories : {},
      events: Array.isArray(parsed.events) ? parsed.events : [],
      variables: Array.isArray(parsed.variables) ? parsed.variables : [],
      tableRows: Array.isArray(parsed.tableRows) ? parsed.tableRows : [],
      relations: Array.isArray(parsed.relations) ? parsed.relations : []
    }
  } catch {
    return { narrative: cleaned, subjective: '', memberMemories: {}, events: [], variables: [], tableRows: [], relations: [] }
  }
}

const resolveEmbeddingEndpoint = () => {
  const base = (embeddingApiSettings.provider === 'custom' ? embeddingApiSettings.customUrl : embeddingApiSettings.url).replace(/\/+$/, '')
  if (base.endsWith('/embeddings')) return base
  return `${base}${base.includes('/v1') ? '' : '/v1'}/embeddings`
}

export const isEmbeddingReady = () => Boolean(
  embeddingApiSettings.enabled &&
  (embeddingApiSettings.provider === 'custom' ? embeddingApiSettings.customUrl : embeddingApiSettings.url) &&
  (embeddingApiSettings.provider === 'custom' ? embeddingApiSettings.customKey : embeddingApiSettings.key) &&
  embeddingApiSettings.model
)

export const createEmbeddings = async (texts: string[]): Promise<number[][]> => {
  if (!isEmbeddingReady() || texts.length === 0) return []
  const key = embeddingApiSettings.provider === 'custom' ? embeddingApiSettings.customKey : embeddingApiSettings.key
  const response = await fetch(resolveEmbeddingEndpoint(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: embeddingApiSettings.model, input: texts })
  })
  if (!response.ok) throw new Error(`Embedding 请求失败（HTTP ${response.status}）`)
  const data = await response.json()
  if (!Array.isArray(data?.data)) throw new Error('Embedding 接口未返回标准 data 数组')
  return data.data.sort((a: any, b: any) => a.index - b.index).map((item: any) => item.embedding)
}

export const indexChatMemories = async (chat: any) => {
  if (!isEmbeddingReady()) return { indexed: 0, skipped: true }
  const state = ensureMemoryState(chat)
  const sources: Array<{ sourceType: VectorRecord['sourceType']; sourceId: string; text: string }> = []
  for (const item of chat.memoryBook || []) if (item.enabled !== false && !item.archived && item.content) sources.push({ sourceType: 'narrative', sourceId: String(item.id), text: item.content })
  for (const item of state.events) if (item.enabled !== false) sources.push({ sourceType: 'event', sourceId: item.id, text: `${item.title}\n${item.summary}\n${item.tags.join(' ')}` })
  for (const item of state.variables) if (item.status === 'active') sources.push({ sourceType: 'variable', sourceId: item.id, text: `${item.category} ${item.key}: ${item.value}` })
  for (const item of state.tableRows) sources.push({ sourceType: 'table', sourceId: item.id, text: `${item.table} ${item.title}: ${item.value}` })
  for (const item of state.relations) if (item.status === 'active') sources.push({ sourceType: 'relation', sourceId: item.id, text: `${item.source} ${item.relation} ${item.target}` })

  const validKeys = new Set(sources.map(source => `${chat.id}:${source.sourceType}:${source.sourceId}`))
  const staleKeys: string[] = []
  await vectorStore.iterate<VectorRecord, void>((record, key) => {
    if (record.chatId === String(chat.id) && !validKeys.has(key)) staleKeys.push(key)
  })
  await Promise.all(staleKeys.map(key => vectorStore.removeItem(key)))

  let indexed = 0
  const batchSize = Math.max(1, Math.min(100, Number(embeddingApiSettings.batchSize || 20)))
  for (let offset = 0; offset < sources.length; offset += batchSize) {
    const batch = sources.slice(offset, offset + batchSize)
    const missing: typeof batch = []
    for (const source of batch) {
      const key = `${chat.id}:${source.sourceType}:${source.sourceId}`
      const existing = await vectorStore.getItem<VectorRecord>(key)
      if (!existing || existing.model !== embeddingApiSettings.model || existing.text !== source.text) missing.push(source)
    }
    if (missing.length === 0) continue
    const vectors = await createEmbeddings(missing.map(item => item.text))
    for (let index = 0; index < missing.length; index++) {
      const source = missing[index]
      const vector = vectors[index]
      if (!Array.isArray(vector)) continue
      const record: VectorRecord = {
        id: `${chat.id}:${source.sourceType}:${source.sourceId}`, chatId: String(chat.id),
        ...source, vector, model: embeddingApiSettings.model, dimensions: vector.length, createdAt: Date.now()
      }
      await vectorStore.setItem(record.id, record)
      indexed++
    }
  }
  return { indexed, skipped: false }
}

const cosine = (a: number[], b: number[]) => {
  if (!a.length || a.length !== b.length) return 0
  let dot = 0, left = 0, right = 0
  for (let index = 0; index < a.length; index++) {
    dot += a[index] * b[index]
    left += a[index] * a[index]
    right += b[index] * b[index]
  }
  return left && right ? dot / Math.sqrt(left * right) : 0
}

const hashText = (text: string) => {
  let hash = 0
  for (let index = 0; index < text.length; index++) hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0
  return hash
}

const terms = (text: string) => {
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')
  const result = new Set(normalized.split(/\s+/).filter(Boolean))
  const chinese = normalized.replace(/[^\u4e00-\u9fff]/g, '')
  for (let index = 0; index < chinese.length - 1; index++) result.add(chinese.slice(index, index + 2))
  return result
}

const lexicalScore = (query: string, text: string) => {
  const queryTerms = terms(query)
  const textTerms = terms(text)
  if (!queryTerms.size) return 0
  let matches = 0
  queryTerms.forEach(term => { if (textTerms.has(term)) matches++ })
  return matches / queryTerms.size
}

const collectCandidates = (chat: any) => {
  const state = ensureMemoryState(chat)
  return [
    ...(chat.memoryBook || []).filter((item: any) => item.enabled !== false && !item.archived).map((item: any) => ({ type: '叙事', id: String(item.id), text: item.content, importance: item.isMarked ? 5 : item.memoryLevel > 1 ? 4 : 3, updatedAt: item.updatedAt || item.id || 0 })),
    ...state.events.filter(item => item.enabled !== false).map(item => ({ type: '事件', id: item.id, text: `${item.title}：${item.summary}${item.unresolved.length ? `；未完成：${item.unresolved.join('、')}` : ''}`, importance: item.importance, updatedAt: item.updatedAt })),
    ...state.variables.filter(item => item.status === 'active').map(item => ({ type: '变量', id: item.id, text: `${item.category}/${item.key}：${item.value}`, importance: item.locked ? 5 : 4, updatedAt: item.lastConfirmedAt })),
    ...state.tableRows.map(item => ({ type: '表格', id: item.id, text: `${item.title}：${item.value}（${item.status}）`, importance: item.importance, updatedAt: item.updatedAt })),
    ...state.relations.filter(item => item.status === 'active').map(item => ({ type: '关系', id: item.id, text: `${item.source} —${item.relation}→ ${item.target}`, importance: 4, updatedAt: item.updatedAt }))
  ]
}

export const buildMemoryPacket = async (
  chat: any,
  query: string,
  tokenBudget?: number,
  options: { allowEmbedding?: boolean } = {}
) => {
  const candidates = collectCandidates(chat)
  if (candidates.length === 0) return ''
  const now = Date.now()
  const vectorScores = new Map<string, number>()
  if (options.allowEmbedding !== false && isEmbeddingReady() && query.trim()) {
    try {
      const [queryVector] = await createEmbeddings([query])
      await vectorStore.iterate<VectorRecord, void>((record) => {
        if (record.chatId === String(chat.id) && record.model === embeddingApiSettings.model) {
          vectorScores.set(`${record.sourceType}:${record.sourceId}`, cosine(queryVector, record.vector))
        }
      })
    } catch (error) {
      console.warn('向量召回失败，已降级为本地混合检索', error)
    }
  }
  const typeMap: Record<string, string> = { '叙事': 'narrative', '事件': 'event', '变量': 'variable', '表格': 'table', '关系': 'relation' }
  const ranked = candidates.map(item => {
    const vector = vectorScores.get(`${typeMap[item.type]}:${item.id}`) || 0
    const lexical = lexicalScore(query, item.text)
    const recency = Math.max(0, 1 - (now - item.updatedAt) / (1000 * 60 * 60 * 24 * 180))
    const score = vector * 0.55 + lexical * 0.25 + (item.importance / 5) * 0.15 + recency * 0.05
    return { ...item, score }
  }).sort((a, b) => b.score - a.score)

  const budget = Math.max(200, Number(tokenBudget || chat.memoryTokenBudget || 1200))
  const selected: typeof ranked = []
  let used = 0
  for (const item of ranked) {
    const lineSize = estimateTextTokens(`- [${item.type}] ${item.text}\n`)
    if (selected.length > 0 && used + lineSize > budget) continue
    selected.push(item)
    used += lineSize
    if (selected.length >= 16) break
  }
  if (!selected.length) return ''
  return globalPromptSettings.language === 'en'
    ? `\n\n[Relevant long-term memory]\nThe system selected these memories by current topic, importance, and recency. If they conflict with the latest conversation, follow the latest explicit statement.\n${selected.map(item => `- [${item.type}] ${item.text}`).join('\n')}`
    : `\n\n【按需长期记忆】\n以下记忆由系统按当前话题、重要度和时间筛选；若与最新对话冲突，以最新明确表达为准。\n${selected.map(item => `- [${item.type}] ${item.text}`).join('\n')}`
}

export const invalidateMemoriesForMessages = (chat: any, messageIds: Array<number | string>) => {
  if (!chat || messageIds.length === 0) return { narratives: 0, structured: 0, memberMemories: 0 }
  const ids = new Set<number | string>(messageIds.flatMap(id => [id, String(id), Number(id)]))
  const overlaps = (values: any[] | undefined) => Boolean(values?.some(id => ids.has(id) || ids.has(String(id)) || ids.has(Number(id))))
  const state = ensureMemoryState(chat)
  const beforeStructured = state.events.length + state.variables.length + state.tableRows.length + state.relations.length
  state.events = state.events.filter(item => !overlaps(item.evidence?.messageIds))
  state.variables = state.variables.filter(item => !overlaps(item.evidence?.messageIds))
  state.tableRows = state.tableRows.filter(item => !overlaps(item.evidence?.messageIds))
  state.relations = state.relations.filter(item => !overlaps(item.evidence?.messageIds))
  state.coverage = state.coverage.filter(range => !messageIds.some(id => Number(id) >= range.fromMsgId && Number(id) <= range.toMsgId))

  const beforeNarratives = Array.isArray(chat.memoryBook) ? chat.memoryBook.length : 0
  const isUnverifiableLegacy = (item: any) => chat.chatType === 'group' && item?.version !== 2 && (!Array.isArray(item?.evidenceMessageIds) || item.evidenceMessageIds.length === 0)
  chat.memoryBook = (chat.memoryBook || []).filter((item: any) => !overlaps(item.evidenceMessageIds) && !isUnverifiableLegacy(item))
  let removedMemberMemories = 0
  if (chat.memberMemories && typeof chat.memberMemories === 'object') {
    for (const memberId of Object.keys(chat.memberMemories)) {
      const list = Array.isArray(chat.memberMemories[memberId]) ? chat.memberMemories[memberId] : []
      const next = list.filter((item: any) => !overlaps(item.evidenceMessageIds) && !isUnverifiableLegacy(item))
      removedMemberMemories += list.length - next.length
      chat.memberMemories[memberId] = next
    }
  }
  chat.lastSummaryMsgId = Math.max(0, ...state.coverage.map(range => range.toMsgId))
  return {
    narratives: beforeNarratives - chat.memoryBook.length,
    structured: beforeStructured - (state.events.length + state.variables.length + state.tableRows.length + state.relations.length),
    memberMemories: removedMemberMemories
  }
}

export const clearChatVectors = async (chatId: string | number) => {
  const keys: string[] = []
  await vectorStore.iterate<VectorRecord, void>((record, key) => {
    if (record.chatId === String(chatId)) keys.push(key)
  })
  await Promise.all(keys.map(key => vectorStore.removeItem(key)))
  return keys.length
}

export const estimateMessageTokens = (messages: any[]) => Math.ceil(formatMessagesForMemory(messages).length / 2)

export const detectTopicBoundary = (messages: any[]) => {
  if (messages.length < 12) return false
  const recentText = messages.slice(-3).map(item => item.content || '').join(' ')
  const previousText = messages.slice(-12, -3).map(item => item.content || '').join(' ')
  const recentTerms = terms(recentText)
  const previousTerms = terms(previousText)
  if (recentTerms.size < 3 || previousTerms.size < 6) return false
  let overlap = 0
  recentTerms.forEach(term => { if (previousTerms.has(term)) overlap++ })
  return overlap / recentTerms.size < 0.08
}
