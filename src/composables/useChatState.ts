/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
export * from './chatState/state'
export * from './chatState/notifications'
export * from './chatState/contacts'
export * from './chatState/profile'
export * from './chatState/prompt'
export * from './chatState/messages'
export * from './chatState/transfers'

import { mockChats, selectedChat, myProfile, effectiveMyProfile, customGroups, activeGroup, isSidebarOpen, avatarStore, totalUnreadCount, switchChat, activeChatContextId, setActiveChatContext, isChatContextVisible } from './chatState/state'
import { globalNotifications, showNotification, dismissNotification } from './chatState/notifications'
import { sortChats, loadCustomContacts, deleteChats } from './chatState/contacts'
import { loadMyProfile, saveMyProfile } from './chatState/profile'
import { buildChatMessages } from './chatState/messages'
import { checkTransfersExpired } from './chatState/transfers'

export function useChatState() {
  return {
    mockChats,
    selectedChat,
    activeChatContextId,
    setActiveChatContext,
    isChatContextVisible,
    switchChat,
    checkTransfersExpired,
    myProfile,
    effectiveMyProfile,
    customGroups,
    activeGroup,
    isSidebarOpen,
    avatarStore,
    totalUnreadCount,
    globalNotifications,
    showNotification,
    dismissNotification,
    sortChats,
    loadCustomContacts,
    deleteChats,
    loadMyProfile,
    saveMyProfile,
    buildChatMessages
  }
}
