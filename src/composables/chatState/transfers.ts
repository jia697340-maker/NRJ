/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { useChatAuth } from '../useChatAuth'
import { getEffectiveUserProfile } from '../useChatUserProfiles'
import { mockChats, myProfile } from './state'

export const checkTransfersExpired = () => {
  const now = Date.now()
  let changed = false
  mockChats.value.forEach(chat => {
    if (chat.messages) {
      chat.messages.forEach((m: any) => {
        if (m.transferData && m.transferData.status === 'pending') {
          if (now >= m.transferData.expireTime) {
            m.transferData.status = 'expired'
            changed = true
            const charName = chat.name || chat.realName || '角色'
            const userName = getEffectiveUserProfile(chat, myProfile.value).name || '用户'
            const noun = m.transferData.type === 'red_packet' ? '红包' : '转账'
            
            if (m.type === 'left') {
              chat.messages.push({
                 id: Date.now() + Math.random(),
                 type: 'system',
                 content: `${charName}发送给${userName}的${noun}超过24小时未被领取，已退回给${charName}。`
              })
            } else {
              chat.messages.push({
                 id: Date.now() + Math.random(),
                 type: 'system',
                 content: `${userName}发送给${charName}的${noun}超过24小时未被领取，已退回给${userName}。`
              })
            }
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
