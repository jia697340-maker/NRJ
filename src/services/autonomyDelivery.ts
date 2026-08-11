/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { isChatContextVisible } from '../composables/chatState/state'
import { showNotification } from '../composables/chatState/notifications'
import { AUTONOMY_DELIVERY_LIMIT } from './autonomyConfig'

export type AutonomyDelivery = {
  id: string
  messageId: number
  createdAt: number
  content: string
  importance: 'normal' | 'important'
  status: 'pending' | 'read'
  lastNotifiedAt: number
  notificationCount: number
  readAt?: number
}

const pendingDeliveries = (chat: any) => {
  chat.autonomyDeliveries = Array.isArray(chat.autonomyDeliveries) ? chat.autonomyDeliveries : []
  return chat.autonomyDeliveries.filter((item: AutonomyDelivery) => item?.status === 'pending') as AutonomyDelivery[]
}

export const queueAutonomyDelivery = (
  chat: any,
  messageId: number,
  content: string,
  createdAt: number,
  important = false
) => {
  chat.autonomyDeliveries = Array.isArray(chat.autonomyDeliveries) ? chat.autonomyDeliveries : []
  const delivery: AutonomyDelivery = {
    id: `delivery_${chat.id}_${messageId}`,
    messageId,
    createdAt,
    content,
    importance: important ? 'important' : 'normal',
    status: isChatContextVisible(chat.id) ? 'read' : 'pending',
    lastNotifiedAt: 0,
    notificationCount: 0,
    readAt: isChatContextVisible(chat.id) ? Date.now() : undefined
  }
  if (!chat.autonomyDeliveries.some((item: AutonomyDelivery) => item.id === delivery.id)) {
    chat.autonomyDeliveries.push(delivery)
    chat.autonomyDeliveries = chat.autonomyDeliveries.slice(-AUTONOMY_DELIVERY_LIMIT)
  }
  return delivery
}

export const flushAutonomyDeliveries = (chats: any[], forceVisibleSession = false) => {
  const now = Date.now()
  const changed: any[] = []
  for (const chat of chats) {
    if (!chat || isChatContextVisible(chat.id)) continue
    let didChange = false
    for (const delivery of pendingDeliveries(chat)) {
      const cooldown = delivery.importance === 'important' ? 3 * 60 * 60000 : 12 * 60 * 60000
      const shouldNotify = delivery.notificationCount === 0
        || (forceVisibleSession && now - Number(delivery.lastNotifiedAt || 0) >= 60000)
        || now - Number(delivery.lastNotifiedAt || 0) >= cooldown
      if (!shouldNotify) continue
      showNotification(chat.name, chat.avatarUrl, chat.avatarText, delivery.content, {
        chatId: chat.id,
        deliveryId: delivery.id,
        important: delivery.importance === 'important',
        persistent: delivery.importance === 'important'
      })
      delivery.lastNotifiedAt = now
      delivery.notificationCount = Number(delivery.notificationCount || 0) + 1
      didChange = true
    }
    if (didChange) changed.push(chat)
  }
  return changed
}

export const acknowledgeAutonomyDeliveries = (chat: any) => {
  const now = Date.now()
  let changed = false
  for (const delivery of pendingDeliveries(chat)) {
    delivery.status = 'read'
    delivery.readAt = now
    changed = true
  }
  return changed
}

export const getPendingAutonomyDeliveryCount = (chat: any) => pendingDeliveries(chat).length

