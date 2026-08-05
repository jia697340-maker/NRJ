/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed } from 'vue'
import localforage from 'localforage'
import { chatSettings } from '../store'

// 初始化 discover_moments
const discoverStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'discover_moments'
})

export function useChatRoomMessage(
  selectedChat: any,
  myProfile: any,
  isMultiSelectMode: any,
  saveCustomContacts: () => void,
  scrollToBottom: () => Promise<void>,
  updatePreviewAndTime: (content: string) => void
) {
  const showImageModal = ref(false)
  const expandedImageIds = ref<Set<number>>(new Set())

  const toggleImageText = (msgId: number) => {
    if (isMultiSelectMode.value) return
    if (expandedImageIds.value.has(msgId)) {
      expandedImageIds.value.delete(msgId)
    } else {
      expandedImageIds.value.add(msgId)
    }
  }

  const handleSendImage = async (data: { file?: File, dataUrl?: string, text?: string }, showExtensionPanel: any) => {
    if (!selectedChat.value) return
    
    if (!selectedChat.value.messages) {
      selectedChat.value.messages = []
    }

    const msgId = Date.now()
    const imageStoreId = `chat_img_${msgId}`

    if (data.file && data.dataUrl) {
      // 安全存储真实图片到 localforage
      import('localforage').then((localforage) => {
        const imageStore = localforage.default.createInstance({
          name: 'nrt-app',
          storeName: 'chatImages'
        })
        imageStore.setItem(imageStoreId, data.dataUrl)
      })
    }

    selectedChat.value.messages.push({
      id: msgId,
      type: 'right',
      content: '[图片]',
      imageData: {
        text: data.text || '', // 可选的文字说明
        imageId: data.file ? imageStoreId : undefined,
        summary: '' // 留给后台预总结使用
      }
    })
    
    showImageModal.value = false
    showExtensionPanel.value = false
    updatePreviewAndTime('[图片]')
    saveCustomContacts()
    await scrollToBottom()
  }

  const showVoiceModal = ref(false)
  const handleSendVoice = async (data: { text: string, seconds: number }, showExtensionPanel: any) => {
    if (!selectedChat.value) return
    
    if (!selectedChat.value.messages) {
      selectedChat.value.messages = []
    }

    selectedChat.value.messages.push({
      id: Date.now(),
      type: 'right',
      content: '[语音消息]',
      voiceData: {
        text: data.text,
        seconds: data.seconds
      }
    })
    
    showVoiceModal.value = false
    showExtensionPanel.value = false
    updatePreviewAndTime('[语音消息]')
    saveCustomContacts()
    await scrollToBottom()
  }

  const showTransferModal = ref(false)
  const handleSendTransfer = async (data: { type: 'red_packet' | 'transfer', amount: number, remark: string, expireHours: number }, showExtensionPanel: any) => {
    const text = data.type === 'red_packet' ? '[发来一个红包]' : '[发来一笔转账]'
    if (!selectedChat.value) return
    
    if (!selectedChat.value.messages) {
      selectedChat.value.messages = []
    }

    const transferId = Date.now() + Math.floor(Math.random() * 1000)

    selectedChat.value.messages.push({
      id: Date.now(),
      type: 'right',
      content: text,
      transferData: {
        id: transferId,
        type: data.type,
        amount: data.amount,
        remark: data.remark,
        status: 'pending',
        expireTime: Date.now() + data.expireHours * 3600 * 1000
      }
    })
    
    showTransferModal.value = false
    showExtensionPanel.value = false
    updatePreviewAndTime(text)
    saveCustomContacts()
    await scrollToBottom()
  }

  const replyTargetId = ref<number | undefined>(undefined)

  const replyTargetMessage = computed(() => {
    if (replyTargetId.value === undefined || !selectedChat.value) return null
    const msg = selectedChat.value.messages?.find((m: any) => m.id === replyTargetId.value)
    if (!msg) return null
    return {
      id: msg.id,
      content: msg.content,
      sender: msg.type === 'left' ? (selectedChat.value.name || '对方') : myProfile.value.name
    }
  })

  const cancelReply = () => {
    replyTargetId.value = undefined
  }

  return {
    showImageModal,
    expandedImageIds,
    toggleImageText,
    handleSendImage,
    showVoiceModal,
    handleSendVoice,
    showTransferModal,
    handleSendTransfer,
    replyTargetId,
    replyTargetMessage,
    cancelReply
  }
}

// 供 useChatRoomAPI 调用的特殊标签处理器
export async function processMomentTags(content: string, selectedChat: any): Promise<{ newContent: string, shouldTriggerAI: boolean, aiContext?: string }> {
  let newContent = content
  let shouldTriggerAI = false
  let aiContext = ''

  // 如果开关关闭，直接返回
  if (!chatSettings.enableCharMoments) {
    return { newContent, shouldTriggerAI, aiContext }
  }

  // 处理 <read_moments />
  const readRegex = /<read_moments\s*\/>/g
  if (readRegex.test(newContent)) {
    newContent = newContent.replace(readRegex, '')
    try {
      const moments = await discoverStore.getItem<any[]>('moments_list') || []
      // 简单筛选出前 5 条用户公开或当前角色可见的朋友圈
      const visibleMoments = moments.filter(m => {
        if (m.author === (selectedChat.name || '对方')) return false // 不看自己的
        if (m.visibility === '公开') return true
        if (m.visibility === '部分可见' && m.visibilityGroups && selectedChat.groupIds) {
          // 检查交集
          return m.visibilityGroups.some((gId: string) => selectedChat.groupIds.includes(gId))
        }
        return false
      }).slice(0, 5)

      if (visibleMoments.length > 0) {
        aiContext = `【系统旁白：你打开了朋友圈，看到了以下最新动态：\n`
        visibleMoments.forEach(m => {
          aiContext += `[动态ID：${m.id}] ${m.author}：${m.content}\n`
          if (m.images && m.images.length) aiContext += `(附带了${m.images.length}张图片)\n`
        })
        aiContext += `你可以使用 <interact_moment action="like|comment" id="动态ID" content="评论内容" /> 来进行点赞或评论，或者直接在聊天中讨论此事。】`
      } else {
        aiContext = `【系统旁白：你打开了朋友圈，但最近没有任何新动态。】`
      }
      shouldTriggerAI = true
    } catch(e) {}
  }

  // 处理 <post_moment>...</post_moment>
  const postRegex = /<post_moment(?:\s+image="([^"]*)")?>([\s\S]*?)<\/post_moment>/g
  let postMatch
  while ((postMatch = postRegex.exec(newContent)) !== null) {
    const imgDesc = postMatch[1]
    const textContent = postMatch[2].trim()
    try {
      const moments = await discoverStore.getItem<any[]>('moments_list') || []
      moments.unshift({
        id: Date.now().toString(),
        author: selectedChat.name || '对方',
        avatar: selectedChat.avatarUrl || selectedChat.avatar || '',
        content: textContent,
        images: [], // 文字图或占位
        time: Date.now(),
        visibility: '公开',
        visibilityGroups: [],
        isOwn: false,
        likes: [],
        comments: []
      })
      await discoverStore.setItem('moments_list', moments)
    } catch(e) {}
  }
  newContent = newContent.replace(postRegex, '')

  // 处理 <interact_moment action="..." id="..." content="..." />
  const interactRegex = /<interact_moment\s+action="([^"]+)"\s+id="([^"]+)"(?:\s+content="([^"]*)")?\s*\/>/g
  let interactMatch
  while ((interactMatch = interactRegex.exec(newContent)) !== null) {
    const action = interactMatch[1]
    const mId = interactMatch[2]
    const commentContent = interactMatch[3]
    try {
      const moments = await discoverStore.getItem<any[]>('moments_list') || []
      const target = moments.find(m => m.id === mId)
      if (target) {
        if (action === 'like' && !target.likes.includes(selectedChat.name || '对方')) {
          target.likes.push(selectedChat.name || '对方')
        } else if (action === 'comment' && commentContent) {
          target.comments.push({
            author: selectedChat.name || '对方',
            content: commentContent
          })
        }
        await discoverStore.setItem('moments_list', moments)
      }
    } catch(e) {}
  }
  newContent = newContent.replace(interactRegex, '')

  return { newContent: newContent.trim(), shouldTriggerAI, aiContext }
}
