/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import { resolveTransfer } from '../services/transferLifecycle'

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
           resolveTransfer({
             chat: selectedChat.value,
             transferId: msg.transferData.id,
             action: 'claim',
             actor: 'user',
             userName: myProfile.value.name || '我'
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
         resolveTransfer({
           chat: selectedChat.value,
           transferId: msg.transferData.id,
           action: 'reject',
           actor: 'user',
           userName: myProfile.value.name || '我'
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
         resolveTransfer({
           chat: selectedChat.value,
           transferId: msg.transferData.id,
           action: 'claim',
           actor: 'user',
           userName: myProfile.value.name || '我'
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
         resolveTransfer({
           chat: selectedChat.value,
           transferId: msg.transferData.id,
           action: 'reject',
           actor: 'user',
           userName: myProfile.value.name || '我'
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
