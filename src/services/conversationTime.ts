/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type IdentityClockMode = 'system' | 'timezone' | 'custom'

export type IdentityClockSnapshot = {
  clockMode: IdentityClockMode
  timezone: string
  clockAnchorRealAt: number
  clockAnchorTimeAt: number
}

export type ConversationHiddenWindow = {
  startedAt: number
  endedAt: number
  duration: number
}

export type ConversationTimeState = {
  paused: boolean
  pausedAt: number
  hiddenWindows: ConversationHiddenWindow[]
}

const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

const isTimezoneSupported = (timezone: string) => {
  try {
    new Intl.DateTimeFormat('zh-CN', { timeZone: timezone }).format(new Date())
    return true
  } catch {
    return false
  }
}

export const normalizeIdentityClock = (owner: any, fallbackTimezone = deviceTimezone()): IdentityClockSnapshot => {
  const safeOwner = owner && typeof owner === 'object' ? owner : {}
  const timezone = isTimezoneSupported(String(safeOwner.timezone || ''))
    ? String(safeOwner.timezone)
    : (isTimezoneSupported(fallbackTimezone) ? fallbackTimezone : deviceTimezone())
  const mode: IdentityClockMode = safeOwner.clockMode === 'custom'
    ? 'custom'
    : safeOwner.clockMode === 'timezone'
      ? 'timezone'
      : safeOwner.clockMode === 'system'
        ? 'system'
        : safeOwner.timezone
          ? 'timezone'
          : 'system'
  const now = Date.now()
  const clockAnchorRealAt = Number.isFinite(Number(safeOwner.clockAnchorRealAt))
    ? Number(safeOwner.clockAnchorRealAt)
    : now
  const clockAnchorTimeAt = Number.isFinite(Number(safeOwner.clockAnchorTimeAt))
    ? Number(safeOwner.clockAnchorTimeAt)
    : now
  return { clockMode: mode, timezone, clockAnchorRealAt, clockAnchorTimeAt }
}

export const applyIdentityClock = (owner: any, clock: IdentityClockSnapshot) => {
  if (!owner || typeof owner !== 'object') return
  owner.clockMode = clock.clockMode
  owner.timezone = clock.timezone
  owner.clockAnchorRealAt = clock.clockAnchorRealAt
  owner.clockAnchorTimeAt = clock.clockAnchorTimeAt
}

export const getIdentityTimestamp = (owner: any, realTimestamp = Date.now(), fallbackTimezone = deviceTimezone()) => {
  const clock = normalizeIdentityClock(owner, fallbackTimezone)
  if (clock.clockMode !== 'custom') return realTimestamp
  return clock.clockAnchorTimeAt + (realTimestamp - clock.clockAnchorRealAt)
}

const formatOptions: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
}

export const formatIdentityDateTime = (
  owner: any,
  realTimestamp = Date.now(),
  fallbackTimezone = deviceTimezone(),
  options: Intl.DateTimeFormatOptions = formatOptions
) => {
  const clock = normalizeIdentityClock(owner, fallbackTimezone)
  const timestamp = getIdentityTimestamp(clock, realTimestamp, fallbackTimezone)
  const timeZone = clock.clockMode === 'custom' ? 'UTC' : clock.clockMode === 'system' ? deviceTimezone() : clock.timezone
  return new Intl.DateTimeFormat('zh-CN', { ...options, timeZone }).format(new Date(timestamp))
}

export const formatIdentityClockTime = (owner: any, realTimestamp = Date.now(), fallbackTimezone = deviceTimezone()) => (
  formatIdentityDateTime(owner, realTimestamp, fallbackTimezone, {
    hour: '2-digit', minute: '2-digit', hour12: false
  })
)

export const getIdentityCalendarParts = (owner: any, realTimestamp = Date.now(), fallbackTimezone = deviceTimezone()) => {
  const clock = normalizeIdentityClock(owner, fallbackTimezone)
  const timestamp = getIdentityTimestamp(clock, realTimestamp, fallbackTimezone)
  const timeZone = clock.clockMode === 'custom' ? 'UTC' : clock.clockMode === 'system' ? deviceTimezone() : clock.timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
  }).formatToParts(new Date(timestamp))
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return { year: value.year, month: value.month, day: value.day, weekday: String(value.weekday || '').toUpperCase() }
}

export const getIdentityClockLabel = (owner: any, fallbackTimezone = deviceTimezone()) => {
  const clock = normalizeIdentityClock(owner, fallbackTimezone)
  if (clock.clockMode === 'custom') return '自定义时间'
  if (clock.clockMode === 'system') return `跟随设备 · ${deviceTimezone()}`
  return clock.timezone
}

export const toClockInputValue = (owner: any, realTimestamp = Date.now(), fallbackTimezone = deviceTimezone()) => {
  const clock = normalizeIdentityClock(owner, fallbackTimezone)
  const timestamp = getIdentityTimestamp(clock, realTimestamp, fallbackTimezone)
  const timeZone = clock.clockMode === 'custom' ? 'UTC' : clock.clockMode === 'system' ? deviceTimezone() : clock.timezone
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(timestamp))
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`
}

export const clockInputToTimestamp = (value: string) => {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return NaN
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]))
}

export const normalizeConversationTimeState = (chat: any): ConversationTimeState => {
  const raw = chat?.conversationTimeState
  const hiddenWindows = Array.isArray(raw?.hiddenWindows)
    ? raw.hiddenWindows
      .map((item: any) => ({
        startedAt: Number(item?.startedAt || 0),
        endedAt: Number(item?.endedAt || 0),
        duration: Math.max(0, Number(item?.duration || 0))
      }))
      .filter((item: ConversationHiddenWindow) => item.startedAt > 0 && item.endedAt >= item.startedAt && item.duration > 0)
      .slice(-100)
    : []
  return {
    paused: raw?.paused === true,
    pausedAt: Math.max(0, Number(raw?.pausedAt || 0)),
    hiddenWindows
  }
}

export const ensureConversationTimeState = (chat: any) => {
  const state = normalizeConversationTimeState(chat)
  if (chat && typeof chat === 'object') chat.conversationTimeState = state
  return state
}

export const isConversationTimePaused = (chat: any) => normalizeConversationTimeState(chat).paused

export const pauseConversationTime = (chat: any, now = Date.now()) => {
  const state = ensureConversationTimeState(chat)
  if (state.paused) return state
  state.paused = true
  state.pausedAt = now
  chat.conversationTimeState = state
  return state
}

export const resumeConversationTime = (chat: any, now = Date.now()) => {
  const state = ensureConversationTimeState(chat)
  if (!state.paused) return state
  const startedAt = state.pausedAt || now
  const duration = Math.max(0, now - startedAt)
  if (duration > 0) {
    state.hiddenWindows.push({ startedAt, endedAt: now, duration })
    state.hiddenWindows = state.hiddenWindows.slice(-100)
    const shiftTimestamp = (value: unknown) => {
      const timestamp = Number(value || 0)
      return timestamp > 0 ? timestamp + duration : timestamp
    }
    chat.autonomyLastRunAt = shiftTimestamp(chat.autonomyLastRunAt)
    chat.incomingCallLastAt = shiftTimestamp(chat.incomingCallLastAt)
    chat.autonomyLastMeaningfulActionAt = shiftTimestamp(chat.autonomyLastMeaningfulActionAt)
    chat.offlineUntil = shiftTimestamp(chat.offlineUntil)
    if (Array.isArray(chat.presenceSessions)) {
      chat.presenceSessions.forEach((session: any) => {
        if (session?.status === 'active') session.plannedEndAt = shiftTimestamp(session.plannedEndAt)
      })
    }
    if (chat.autonomyState && typeof chat.autonomyState === 'object') {
      chat.autonomyState.lastCheckedAt = shiftTimestamp(chat.autonomyState.lastCheckedAt)
      chat.autonomyState.nextCheckAt = shiftTimestamp(chat.autonomyState.nextCheckAt)
    }
  }
  state.paused = false
  state.pausedAt = 0
  chat.conversationTimeState = state
  return state
}

export const getConversationAdjustedTimestamp = (chat: any, realTimestamp: number) => {
  const state = normalizeConversationTimeState(chat)
  let adjusted = realTimestamp
  for (const window of state.hiddenWindows) {
    if (realTimestamp <= window.startedAt) adjusted += window.duration
  }
  if (state.paused && state.pausedAt > 0 && realTimestamp <= state.pausedAt) {
    adjusted += Math.max(0, Date.now() - state.pausedAt)
  }
  return adjusted
}

export const describeClockSeparation = (
  characterOwner: any,
  userOwner: any,
  realTimestamp = Date.now(),
  characterFallbackTimezone = deviceTimezone(),
  userFallbackTimezone = deviceTimezone()
) => {
  const characterClock = normalizeIdentityClock(characterOwner, characterFallbackTimezone)
  const userClock = normalizeIdentityClock(userOwner, userFallbackTimezone)
  const characterTime = formatIdentityDateTime(characterClock, realTimestamp, characterFallbackTimezone)
  const userTime = formatIdentityDateTime(userClock, realTimestamp, userFallbackTimezone)
  const characterPlace = characterClock.clockMode === 'custom' ? '自定义当地时间' : characterClock.clockMode === 'system' ? deviceTimezone() : characterClock.timezone
  const userPlace = userClock.clockMode === 'custom' ? '自定义当地时间' : userClock.clockMode === 'system' ? deviceTimezone() : userClock.timezone
  return { characterTime, userTime, characterPlace, userPlace }
}
