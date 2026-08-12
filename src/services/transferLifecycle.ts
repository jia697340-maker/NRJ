/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { resolveWalletPayment } from './walletService'

export type TransferKind = 'transfer' | 'red_packet'
export type TransferStatus = 'pending' | 'claimed' | 'rejected' | 'expired'
export type TransferActor = 'user' | 'character' | 'system'
export type TransferAction = 'claim' | 'reject' | 'expire'

let lastGeneratedMessageId = 0

export const createChatMessageId = () => {
  const now = Date.now()
  lastGeneratedMessageId = Math.max(now, lastGeneratedMessageId + 1)
  return lastGeneratedMessageId
}

export const createTransferData = (input: {
  type: TransferKind
  amount: number
  remark: string
  expireHours?: number
  sender: 'user' | 'character'
  walletPaymentId?: string
  walletAccountId?: string
}) => {
  const createdAt = Date.now()
  const expireHours = Number.isFinite(input.expireHours) && Number(input.expireHours) > 0
    ? Number(input.expireHours)
    : 24
  return {
    id: createChatMessageId(),
    type: input.type,
    amount: Number(input.amount) || 0,
    remark: input.remark || (input.type === 'red_packet' ? '恭喜发财，大吉大利' : '转账'),
    status: 'pending' as TransferStatus,
    senderType: input.sender,
    receiverType: input.sender === 'user' ? 'character' : 'user',
    walletPaymentId: input.walletPaymentId,
    walletAccountId: input.walletAccountId,
    createdAt,
    expireHours,
    expireAt: createdAt + expireHours * 3600 * 1000,
    // 兼容旧代码与已经落盘的数据。
    expireTime: createdAt + expireHours * 3600 * 1000
  }
}

const actionToStatus: Record<TransferAction, Exclude<TransferStatus, 'pending'>> = {
  claim: 'claimed',
  reject: 'rejected',
  expire: 'expired'
}

const getEventContent = (chat: any, userName: string, transfer: any, action: TransferAction, actor: TransferActor) => {
  const characterName = chat?.name || chat?.realName || '对方'
  const effectiveUserName = userName || '我'
  const actorName = actor === 'character' ? characterName : actor === 'user' ? effectiveUserName : '系统'
  const noun = transfer.type === 'red_packet' ? '红包' : '转账'

  if (action === 'expire') {
    const senderName = transfer.senderType === 'character' ? characterName : effectiveUserName
    const hours = Number(transfer.expireHours) || Math.max(1, Math.round((Number(transfer.expireAt || transfer.expireTime) - Number(transfer.createdAt)) / 3600000)) || 24
    return `${senderName}发送的${noun}超过${hours}小时未被领取，已原路退回。`
  }
  if (action === 'claim') {
    const amountText = transfer.type === 'red_packet' ? `，金额为 ${transfer.amount} 元` : ''
    return `${actorName}${transfer.type === 'transfer' ? '确认收款' : '领取'}了${transfer.senderType === 'character' ? characterName : effectiveUserName}的${noun}${amountText}`
  }
  return `${actorName}退回了${transfer.senderType === 'character' ? characterName : effectiveUserName}的${noun}`
}

export const resolveTransfer = (input: {
  chat: any
  transferId: string | number
  action: TransferAction
  actor: TransferActor
  userName: string
  pushEvent?: (event: Record<string, any>) => void
}) => {
  const messages = input.chat?.messages
  if (!Array.isArray(messages)) return { ok: false as const, reason: 'missing_chat' }
  const targetMessage = messages.find((message: any) =>
    message?.transferData && String(message.transferData.id) === String(input.transferId)
  )
  if (!targetMessage?.transferData) return { ok: false as const, reason: 'missing_transfer' }
  if (targetMessage.transferData.status !== 'pending') return { ok: false as const, reason: 'already_resolved', targetMessage }

  const transfer = targetMessage.transferData
  const nextStatus = actionToStatus[input.action]
  if (transfer.walletPaymentId && transfer.walletAccountId) {
    const walletResult = resolveWalletPayment(transfer.walletAccountId, transfer.walletPaymentId, nextStatus)
    if (!walletResult.ok && walletResult.reason !== 'already_resolved' && walletResult.reason !== 'missing_payment') {
      return { ok: false as const, reason: 'wallet_resolution_failed', targetMessage }
    }
  }
  const resolvedAt = Date.now()
  transfer.status = nextStatus
  transfer.resolvedAt = resolvedAt
  transfer.resolvedBy = input.actor
  transfer.resolveReason = nextStatus

  const event = {
    id: createChatMessageId(),
    timestamp: resolvedAt,
    type: 'system',
    systemKind: 'transfer_event',
    transferId: transfer.id,
    transferMessageId: targetMessage.id,
    transferStatus: nextStatus,
    transferEventType: input.action,
    transferActor: input.actor,
    content: getEventContent(input.chat, input.userName, transfer, input.action, input.actor)
  }
  if (input.pushEvent) input.pushEvent(event)
  else messages.push(event)
  input.chat.preview = `[${transfer.type === 'red_packet' ? '红包' : '转账'}${nextStatus === 'claimed' ? (transfer.type === 'red_packet' ? '已领取' : '已收款') : nextStatus === 'rejected' ? '已退还' : '已过期'}]`
  input.chat.time = new Date(resolvedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return { ok: true as const, targetMessage, event }
}

const inferLegacyEventStatus = (content: string): TransferStatus | null => {
  if (/超过.+小时|过期/.test(content)) return 'expired'
  if (/退回|退还/.test(content)) return 'rejected'
  if (/领取|收款|接收/.test(content)) return 'claimed'
  return null
}

export const normalizeChatTransfers = (chat: any) => {
  if (!Array.isArray(chat?.messages)) return false
  let changed = false
  const transfers: any[] = []

  chat.messages.forEach((message: any) => {
    const transfer = message?.transferData
    if (!transfer) return
    transfers.push(message)
    const createdAt = Number(transfer.createdAt) || Number(message.timestamp) || Number(message.id) || Date.now()
    const expireAt = Number(transfer.expireAt || transfer.expireTime) || createdAt + 24 * 3600 * 1000
    const expireHours = Number(transfer.expireHours) || Math.max(1, Math.round((expireAt - createdAt) / 3600000)) || 24
    const senderType = transfer.senderType || (message.type === 'left' ? 'character' : 'user')
    const normalized = {
      senderType,
      receiverType: transfer.receiverType || (senderType === 'character' ? 'user' : 'character'),
      createdAt,
      expireAt,
      expireTime: expireAt,
      expireHours
    }
    Object.entries(normalized).forEach(([key, value]) => {
      if (transfer[key] !== value) {
        transfer[key] = value
        changed = true
      }
    })
  })

  chat.messages.forEach((message: any, index: number) => {
    if (message?.type !== 'system' || String(message.systemKind || '').startsWith('transfer_event')) return
    const content = String(message.content || '')
    const status = inferLegacyEventStatus(content)
    if (!status || !/(转账|红包)/.test(content)) return
    const kind: TransferKind = content.includes('红包') ? 'red_packet' : 'transfer'
    const candidate = [...transfers]
      .reverse()
      .find((item: any) => {
        const itemIndex = chat.messages.indexOf(item)
        return itemIndex < index && item.transferData?.type === kind && (item.transferData?.status === status || item.transferData?.status === 'pending')
      })
    if (!candidate) {
      message.systemKind = 'transfer_event_orphan'
      message.transferStatus = status
      message.transferEventType = status === 'claimed' ? 'claim' : status === 'expired' ? 'expire' : 'reject'
      if (!content.includes('历史转账记录不完整')) message.content = `${content}（历史转账记录不完整）`
      changed = true
      return
    }
    if (candidate.transferData.status === 'pending') {
      candidate.transferData.status = status
      candidate.transferData.resolveReason = status
      candidate.transferData.resolvedAt = Number(message.timestamp) || Number(message.id) || Date.now()
    }
    message.systemKind = 'transfer_event'
    message.transferId = candidate.transferData.id
    message.transferMessageId = candidate.id
    message.transferStatus = status
    message.transferEventType = status === 'claimed' ? 'claim' : status === 'expired' ? 'expire' : 'reject'
    changed = true
  })
  return changed
}

export const formatTransferForContext = (message: any) => {
  const transfer = message.transferData
  const tag = transfer.type === 'red_packet' ? 'red_packet' : 'transfer'
  const sender = transfer.senderType || (message.type === 'left' ? 'character' : 'user')
  const receiver = transfer.receiverType || (sender === 'character' ? 'user' : 'character')
  const amount = transfer.type === 'red_packet' && sender === 'user' && transfer.status === 'pending'
    ? ''
    : ` amount="${Number(transfer.amount) || 0}"`
  return `<${tag} id="${transfer.id}" sender="${sender}" receiver="${receiver}" status="${transfer.status}"${amount} remark="${String(transfer.remark || '').replace(/"/g, '&quot;')}" />`
}
