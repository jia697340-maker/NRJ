/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import { chatSettings } from '../store'
import { showNotification } from './chatState/notifications'
import { acceptFriendRequest, rejectFriendRequest, type FriendRequestRecord } from './useChatRelationship'

export interface IncomingFriendRequestItem {
  chat: any
  request: FriendRequestRecord
}

export const activeIncomingPrompt = ref<IncomingFriendRequestItem | null>(null)

export const triggerFriendRequestNotification = (chat: any, request: FriendRequestRecord) => {
  if (chatSettings.enableFriendRequestNotification === false) return

  if (chatSettings.friendRequestNotificationStyle === 'modal') {
    activeIncomingPrompt.value = { chat, request }
  } else {
    // 方案 A: 顶部横幅
    const content = request.message ? `申请加你为好友：“${request.message}”` : '申请添加你为好友'
    showNotification(
      chat.realName || chat.name || '好友申请',
      chat.avatarUrl,
      chat.avatarText,
      `[好友申请] ${content}`,
      {
        chatId: chat.id,
        important: true,
        persistent: true
      }
    )
  }
}

export const closeIncomingPrompt = () => {
  activeIncomingPrompt.value = null
}

export const acceptIncomingPrompt = (item: IncomingFriendRequestItem) => {
  acceptFriendRequest(item.chat, item.request)
  closeIncomingPrompt()
}

export const rejectIncomingPrompt = (item: IncomingFriendRequestItem, reason = '') => {
  rejectFriendRequest(item.chat, item.request, reason)
  closeIncomingPrompt()
}
