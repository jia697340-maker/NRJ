/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { mockChats, myProfile } from '../composables/chatState/state'
import { useChatAuth } from '../composables/useChatAuth'
import { runDueGroupAutonomyChecks } from './groupAutonomyRuntime'
import { createAutonomyLedgerWindow, ensureAutonomyLedger, pendingAutonomyLedgerWindow } from './autonomyConfig'
import { flushAutonomyDeliveries } from './autonomyDelivery'
import { ensureAutonomyDefaults, persistAutonomyChat, runDueAutonomyChecks } from './characterAutonomy'
import { isConversationTimePaused } from './conversationTime'

let runtimeTimer: number | null = null
let runtimeBusy = false
let visibilityHandler: (() => void) | null = null
let pageHideHandler: (() => void) | null = null

const { currentChatUserId } = useChatAuth()
const activeChats = () => mockChats.value.filter(chat => chat?.id !== 1 && chat?.chatType !== 'group')
const autonomousChats = () => activeChats().filter(chat => !isConversationTimePaused(chat))

const persistRuntimeSeenAt = (seenAt = Date.now()) => {
  for (const chat of activeChats()) {
    ensureAutonomyDefaults(chat)
    ensureAutonomyLedger(chat).lastRuntimeSeenAt = seenAt
    persistAutonomyChat(chat)
  }
}

const processVisibleRuntime = async (resume = false) => {
  if (runtimeBusy || document.visibilityState !== 'visible') return
  runtimeBusy = true
  const now = Date.now()
  try {
    if (resume) {
      for (const chat of activeChats()) {
        ensureAutonomyDefaults(chat)
        if (isConversationTimePaused(chat)) {
          ensureAutonomyLedger(chat).lastRuntimeSeenAt = now
          persistAutonomyChat(chat)
          continue
        }
        if (createAutonomyLedgerWindow(chat, now)) persistAutonomyChat(chat)
      }
    }
    const hasPendingCatchup = autonomousChats().some(chat => Boolean(pendingAutonomyLedgerWindow(chat)))
    await runDueAutonomyChecks(resume || hasPendingCatchup ? 'resume' : 'scheduled')
    await runDueGroupAutonomyChecks(mockChats.value, myProfile.value, currentChatUserId.value)
    flushAutonomyDeliveries(autonomousChats(), resume).forEach(persistAutonomyChat)
    persistRuntimeSeenAt(Date.now())
  } finally {
    runtimeBusy = false
  }
}

export const startAutonomyRuntime = () => {
  if (runtimeTimer !== null) return
  visibilityHandler = () => {
    if (document.visibilityState === 'visible') void processVisibleRuntime(true)
    else persistRuntimeSeenAt()
  }
  pageHideHandler = () => persistRuntimeSeenAt()
  document.addEventListener('visibilitychange', visibilityHandler)
  window.addEventListener('pagehide', pageHideHandler)
  runtimeTimer = window.setInterval(() => void processVisibleRuntime(false), 30000)
  void processVisibleRuntime(true)
}

export const stopAutonomyRuntime = () => {
  if (runtimeTimer !== null) window.clearInterval(runtimeTimer)
  runtimeTimer = null
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
  if (pageHideHandler) window.removeEventListener('pagehide', pageHideHandler)
  visibilityHandler = null
  pageHideHandler = null
  persistRuntimeSeenAt()
}
