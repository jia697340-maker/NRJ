/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { useChatAuth } from '../useChatAuth'
import { getEffectiveUserProfile } from '../useChatUserProfiles'
import { mockChats, myProfile } from './state'
import { normalizeChatTransfers, resolveTransfer } from '../../services/transferLifecycle'

export const checkTransfersExpired = () => {
  const now = Date.now()
  let changed = false
  mockChats.value.forEach(chat => {
    if (normalizeChatTransfers(chat)) changed = true
    if (chat.messages) {
      ;[...chat.messages].forEach((m: any) => {
        if (m.transferData && m.transferData.status === 'pending') {
          if (now >= Number(m.transferData.expireAt || m.transferData.expireTime)) {
            const result = resolveTransfer({
              chat,
              transferId: m.transferData.id,
              action: 'expire',
              actor: 'system',
              userName: getEffectiveUserProfile(chat, myProfile.value).name || '用户'
            })
            if (result.ok) changed = true
          }
        }
      })
    }
  })
  if (changed) {
    const { currentChatUserId } = useChatAuth()
    const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
    const savedStr = localStorage.getItem(contactsKey)
    if (savedStr) {
      const contacts = JSON.parse(savedStr)
      mockChats.value.forEach(chat => {
        if (chat.id !== 1) {
          const index = contacts.findIndex((c: any) => c.id === chat.id)
          if (index !== -1) {
            contacts[index].messages = chat.messages
          }
        }
      })
      localStorage.setItem(contactsKey, JSON.stringify(contacts))
    }
  }
}
