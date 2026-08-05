/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'

export function useChatRoomTransfer(
  selectedChat: any,
  myProfile: any,
  isMultiSelectMode: any,
  saveCustomContacts: () => void,
  scrollToBottom: () => Promise<void>
) {
  const activeTransferModalData = ref<any>(null)
  const showRedPacketOpenModal = ref(false)
  const showTransferConfirmModal = ref(false)
  const redPacketStatus = ref<'closed' | 'opening' | 'opened'>('closed')

  const handleLeftTransferClick = (msgId: number) => {
    if (isMultiSelectMode.value) return
    if (!selectedChat.value || !selectedChat.value.messages) return
    const msg = selectedChat.value.messages.find((m: any) => m.id === msgId)
    if (!msg || !msg.transferData || msg.transferData.status !== 'pending') return
    
    activeTransferModalData.value = { msgId, ...msg.transferData }
    
    if (msg.transferData.type === 'red_packet') {
      redPacketStatus.value = 'closed'
      showRedPacketOpenModal.value = true
    } else {
      showTransferConfirmModal.value = true
    }
  }

  const openLeftRedPacket = async () => {
    if (redPacketStatus.value !== 'closed' || !activeTransferModalData.value) return
    redPacketStatus.value = 'opening'
    
    // 模拟拆红包网络延迟
    setTimeout(async () => {
      redPacketStatus.value = 'opened'
      
      // 更新消息状态为已领取
      if (selectedChat.value && selectedChat.value.messages) {
         const msg = selectedChat.value.messages.find((m: any) => m.id === activeTransferModalData.value.msgId)
         if (msg && msg.transferData) {
           msg.transferData.status = 'claimed'
           // 添加系统旁白
           const myName = myProfile.value.name || '我'
           const aiName = selectedChat.value.name || '对方'
           selectedChat.value.messages.push({
             id: Date.now(),
             type: 'system',
             content: `${myName}领取了${aiName}的红包，金额为 ${msg.transferData.amount} 元`
           })
           saveCustomContacts()
           await scrollToBottom()
         }
      }
    }, 1200)
  }

  const rejectLeftRedPacket = async () => {
    if (redPacketStatus.value !== 'closed' || !activeTransferModalData.value) return
    if (selectedChat.value && selectedChat.value.messages) {
       const msg = selectedChat.value.messages.find((m: any) => m.id === activeTransferModalData.value.msgId)
       if (msg && msg.transferData) {
         msg.transferData.status = 'rejected'
         const myName = myProfile.value.name || '我'
         const aiName = selectedChat.value.name || '对方'
         selectedChat.value.messages.push({
           id: Date.now(),
           type: 'system',
           content: `${myName}退回了${aiName}的红包`
         })
         saveCustomContacts()
         await scrollToBottom()
       }
    }
    closeLeftRedPacket()
  }

  const closeLeftRedPacket = () => {
    showRedPacketOpenModal.value = false
    setTimeout(() => {
      redPacketStatus.value = 'closed'
      activeTransferModalData.value = null
    }, 300)
  }

  const confirmLeftTransfer = async () => {
    if (!activeTransferModalData.value) return
    if (selectedChat.value && selectedChat.value.messages) {
       const msg = selectedChat.value.messages.find((m: any) => m.id === activeTransferModalData.value.msgId)
       if (msg && msg.transferData) {
         msg.transferData.status = 'claimed'
         const myName = myProfile.value.name || '我'
         const aiName = selectedChat.value.name || '对方'
         selectedChat.value.messages.push({
           id: Date.now(),
           type: 'system',
           content: `${myName}确认收款了${aiName}的转账`
         })
         saveCustomContacts()
         await scrollToBottom()
       }
    }
    showTransferConfirmModal.value = false
    activeTransferModalData.value = null
  }

  const rejectLeftTransfer = async () => {
    if (!activeTransferModalData.value) return
    if (selectedChat.value && selectedChat.value.messages) {
       const msg = selectedChat.value.messages.find((m: any) => m.id === activeTransferModalData.value.msgId)
       if (msg && msg.transferData) {
         msg.transferData.status = 'rejected'
         const myName = myProfile.value.name || '我'
         const aiName = selectedChat.value.name || '对方'
         selectedChat.value.messages.push({
           id: Date.now(),
           type: 'system',
           content: `${myName}退回了${aiName}的转账`
         })
         saveCustomContacts()
         await scrollToBottom()
       }
    }
    showTransferConfirmModal.value = false
    activeTransferModalData.value = null
  }

  return {
    activeTransferModalData,
    showRedPacketOpenModal,
    showTransferConfirmModal,
    redPacketStatus,
    handleLeftTransferClick,
    openLeftRedPacket,
    rejectLeftRedPacket,
    closeLeftRedPacket,
    confirmLeftTransfer,
    rejectLeftTransfer
  }
}
