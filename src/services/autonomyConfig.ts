/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export const AUTONOMY_INTERVAL_MINUTES_MIN = 1
export const AUTONOMY_INTERVAL_MINUTES_MAX = 7 * 24 * 60
export const AUTONOMY_HISTORY_LIMIT = 200
export const AUTONOMY_LEDGER_LIMIT = 40
export const AUTONOMY_DELIVERY_LIMIT = 80

export type AutonomyLedgerWindow = {
  id: string
  startedAt: number
  endedAt: number
  dueAt: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  completedAt?: number
  executed?: number
  summary?: string
  error?: string
}

export type AutonomyLedger = {
  lastRuntimeSeenAt: number
  lastResumeAt: number
  windows: AutonomyLedgerWindow[]
}

export const normalizeAutonomyIntervalMinutes = (value: unknown, fallback = 45) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(AUTONOMY_INTERVAL_MINUTES_MAX, Math.max(AUTONOMY_INTERVAL_MINUTES_MIN, Math.round(parsed)))
}

export const normalizeAutonomySilenceMinutes = (value: unknown, fallback = 12 * 60) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(30 * 24 * 60, Math.max(30, Math.round(parsed)))
}

export const ensureAutonomyLedger = (chat: any): AutonomyLedger => {
  const source = chat.autonomyLedger && typeof chat.autonomyLedger === 'object' ? chat.autonomyLedger : {}
  chat.autonomyLedger = {
    lastRuntimeSeenAt: Number(source.lastRuntimeSeenAt || 0),
    lastResumeAt: Number(source.lastResumeAt || 0),
    windows: Array.isArray(source.windows) ? source.windows.slice(-AUTONOMY_LEDGER_LIMIT) : []
  }
  return chat.autonomyLedger
}

export const ensureAutonomyPolicyDefaults = (chat: any) => {
  chat.autonomyMinIntervalMinutes = normalizeAutonomyIntervalMinutes(chat.autonomyMinIntervalMinutes)
  chat.autonomyGuaranteeContact ??= false
  chat.autonomyMaxSilenceMinutes = normalizeAutonomySilenceMinutes(chat.autonomyMaxSilenceMinutes)
  chat.autonomyEmotionMustDeliver ??= true
  const lastAutonomousMessage = Array.isArray(chat.messages)
    ? [...chat.messages].reverse().find((item: any) => item?.isAutonomous)
    : null
  chat.autonomyLastMeaningfulActionAt = Number(
    chat.autonomyLastMeaningfulActionAt
    || lastAutonomousMessage?.id
    || chat.autonomyState?.lastCheckedAt
    || Date.now()
  )
  chat.autonomyDeliveries = Array.isArray(chat.autonomyDeliveries)
    ? chat.autonomyDeliveries.slice(-AUTONOMY_DELIVERY_LIMIT)
    : []
  ensureAutonomyLedger(chat)
  return chat
}

export const createAutonomyLedgerWindow = (chat: any, endedAt = Date.now()) => {
  const ledger = ensureAutonomyLedger(chat)
  const intervalMs = normalizeAutonomyIntervalMinutes(chat.autonomyMinIntervalMinutes) * 60000
  const dueAt = Number(chat.autonomyState?.nextCheckAt || 0)
  const startedAt = Math.max(
    Number(ledger.lastRuntimeSeenAt || 0),
    Number(chat.autonomyState?.lastCheckedAt || 0)
  )
  if (!chat.autonomyEnabled || !chat.autonomyCatchup || !startedAt || endedAt - startedAt < intervalMs) return null
  if (dueAt > endedAt) return null

  const id = `resume_${startedAt}_${endedAt}`
  const existing = ledger.windows.find(item => item.id === id)
  if (existing) return existing
  const window: AutonomyLedgerWindow = {
    id,
    startedAt,
    endedAt,
    dueAt: dueAt || startedAt + intervalMs,
    status: 'pending',
    attempts: 0
  }
  ledger.windows.push(window)
  ledger.windows = ledger.windows.slice(-AUTONOMY_LEDGER_LIMIT)
  ledger.lastResumeAt = endedAt
  return window
}

export const pendingAutonomyLedgerWindow = (chat: any) => {
  const ledger = ensureAutonomyLedger(chat)
  return ledger.windows.find(item => item.status === 'pending' || item.status === 'failed') || null
}
