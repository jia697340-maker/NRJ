/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed } from 'vue'
import localforage from 'localforage'
import { chatSettings, visionApiSettings } from '../store'
import { sendChatMessage } from '../services/api'
import { useChatAuth } from './useChatAuth'
import { generateMomentImage } from './useMomentImageGen'
import { canViewMoment, canPerformMomentAction, recordMomentAction, addMomentNotification, getMomentBehavior } from '../services/moments'

// 初始化 discover_moments
const discoverStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'discover_moments'
})

const getMomentStorageKey = () => {
  const { currentChatUserId } = useChatAuth()
  return currentChatUserId.value ? `moments_list_${currentChatUserId.value}` : 'moments_list'
}

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
export async function processMomentTags(content: string, selectedChat: any): Promise<{ newContent: string, shouldTriggerAI: boolean, aiContext?: string, handledMomentAction?: boolean }> {
  let newContent = content
  let shouldTriggerAI = false
  let aiContext = ''
  let handledMomentAction = false

  // 如果开关关闭，直接返回
  if (!selectedChat.__forceMomentAction && selectedChat.enableCharMoments === false) {
    return { newContent, shouldTriggerAI, aiContext, handledMomentAction }
  }

  // 处理 <read_moments />
  const readRegex = /<read_moments\s*\/>/g
  if (readRegex.test(newContent)) {
    newContent = newContent.replace(readRegex, '')
    try {
      const moments = await discoverStore.getItem<any[]>(getMomentStorageKey()) || []
      // 简单筛选出设定数量的用户公开或当前角色可见的朋友圈
      const visibleMoments = moments
        .filter(m => canViewMoment(m, { id: selectedChat.id, name: selectedChat.name || '对方', groups: selectedChat.groups, groupIds: selectedChat.groupIds }))
        .filter(m => String(m.authorId ?? '') !== String(selectedChat.id) && m.author !== (selectedChat.name || '对方'))
        .sort((a, b) => Number((b.mentions || []).some((person: any) => String(person.id) === String(selectedChat.id))) - Number((a.mentions || []).some((person: any) => String(person.id) === String(selectedChat.id))) || Number(b.time) - Number(a.time))
        .slice(0, chatSettings.momentReadCount ?? 5)

      if (visibleMoments.length > 0) {
        const charName = selectedChat.name || '角色'
        const behavior = getMomentBehavior(selectedChat)
        const behaviorHint = behavior.mode === 'custom'
          ? `请让${charName}遵循用户设置的表达偏好“${behavior.style || `符合${charName}自己的人设`}”。`
          : `请只依据${charName}自己的人设、当下情绪、与作者的关系和动态内容自然反应；${charName}可以只看，也可以点赞、评论、回复或在聊天中提起，不必为了互动而互动。`
        aiContext = `【系统旁白：${charName}打开了朋友圈。${behaviorHint}${charName}看到了以下最新动态：\n`
        
        // 如果开启了视觉 API 和图片省 Token 机制，进行静默识图
        const shouldSummarizeImages = visionApiSettings.enabled && chatSettings.enableVisionTokenSaver

        for (let m of visibleMoments) {
          aiContext += `[动态ID：${m.id}] ${m.author}：${m.content}\n`
          if (m.images && m.images.length) {
            let imageInfos = []
            for (let i = 0; i < m.images.length; i++) {
              let img = m.images[i]
              // 兼容老数据：如果是纯字符串或新格式
              let url = typeof img === 'string' ? img : img.url
              let summary = typeof img === 'object' && img.summary ? img.summary : null
              
              if (url && !summary && shouldSummarizeImages && url.startsWith('data:image')) {
                try {
                   console.log(`[朋友圈识图] 正在识别动态 ${m.id} 的第 ${i+1} 张图片...`)
                   const compressRequest = [
                     { role: 'user', content: [
                       { type: 'text', text: '请简短客观地描述这张图片的内容，捕捉主要元素。' },
                       { type: 'image_url', image_url: { url } }
                     ]}
                   ]
                   const res = await sendChatMessage(compressRequest, undefined, false, true)
                   let summaryContent = typeof res === 'string' ? res : res.content
                   summaryContent = summaryContent.trim()
                   if (summaryContent) {
                     summary = summaryContent
                     // 更新内存和本地存储
                     if (typeof img === 'string') {
                       m.images[i] = { url, summary }
                     } else {
                       m.images[i].summary = summary
                     }
                     // 回写本地存储
                     const allMoments = await discoverStore.getItem<any[]>(getMomentStorageKey()) || []
                     const targetMoment = allMoments.find((am: any) => am.id === m.id)
                     if (targetMoment) {
                       targetMoment.images = m.images
                       await discoverStore.setItem(getMomentStorageKey(), allMoments)
                     }
                   }
                } catch (e) {
                   console.error('[朋友圈识图] 失败：', e)
                }
              }
              if (summary) {
                imageInfos.push(`画面内容：${summary}`)
              } else {
                imageInfos.push(`未识别的图片`)
              }
            }
            aiContext += `(附带了${m.images.length}张图片，其中：${imageInfos.join('；')})\n`
          }
          if (m.comments?.length) {
            m.comments.forEach((c: any) => {
              aiContext += `[评论ID：${c.id || 'legacy'}] ${c.author}：${c.content}\n`
            })
          }
        }
        aiContext += `${charName}可以使用 <interact_moment action="like|comment" id="动态ID" content="评论内容" /> 来进行点赞或评论；也可对评论用 like_comment 或 reply_comment 标签互动，或者直接在聊天中讨论此事。】`
      } else {
        const charName = selectedChat.name || '角色'
        aiContext = `【系统旁白：${charName}打开了朋友圈，但最近没有任何新动态。】`
      }
      shouldTriggerAI = true
    } catch(e) {}
  }

  // 处理 <post_moment>...</post_moment>
  const postRegex = /<post_moment([^>]*)>([\s\S]*?)<\/post_moment>/g
  let postMatch
  while ((postMatch = postRegex.exec(newContent)) !== null) {
    handledMomentAction = true
    const attrs = postMatch[1] || ''
    const attrValue = (name: string) => attrs.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] || ''
    const imgDesc = attrValue('image')
    const visibility = attrValue('visibility')
    const visibilityGroups = attrValue('groups').split(',').map(v => v.trim()).filter(Boolean)
    const textContent = postMatch[2].trim()
    if (!selectedChat.__forceMomentAction && !canPerformMomentAction(selectedChat, 'post')) continue
    try {
      const moments = await discoverStore.getItem<any[]>(getMomentStorageKey()) || []
      const newMoment = {
        id: Date.now().toString(),
        author: selectedChat.name || '对方',
        authorId: selectedChat.id,
        avatar: selectedChat.avatarUrl || selectedChat.avatar || '',
        content: textContent,
        images: [], // 文字图或占位
        time: Date.now(),
        visibility: ['公开', '私密', '部分可见', '不给谁看'].includes(visibility) ? visibility : (getMomentBehavior(selectedChat).mode === 'custom' ? getMomentBehavior(selectedChat).audience : '公开'),
        visibilityGroups: visibilityGroups.length ? visibilityGroups : (getMomentBehavior(selectedChat).mode === 'custom' ? getMomentBehavior(selectedChat).audienceGroupIds : []),
        isOwn: false,
        likes: [],
        comments: [],
        imagePrompt: imgDesc || '',
        isGeneratingImage: Boolean(imgDesc)
      }
      moments.unshift(newMoment)
      recordMomentAction(selectedChat, 'post')
      await discoverStore.setItem(getMomentStorageKey(), moments)
      window.dispatchEvent(new CustomEvent('clingy:moments-updated'))
      const behavior = getMomentBehavior(selectedChat)
      const shouldGenerateImage = behavior.mode !== 'custom' || Math.random() * 100 < behavior.imageProbability
      if (imgDesc && chatSettings.enableCharMomentImages && shouldGenerateImage) {
        generateMomentImage(imgDesc, selectedChat)
          .then(async image => {
            const latest = await discoverStore.getItem<any[]>(getMomentStorageKey()) || []
            const posted = latest.find(m => m.id === newMoment.id)
            if (posted) {
              posted.images = [image]
              posted.isGeneratingImage = false
              await discoverStore.setItem(getMomentStorageKey(), latest)
              window.dispatchEvent(new CustomEvent('clingy:moments-updated'))
            }
          })
          .catch(async error => {
            const latest = await discoverStore.getItem<any[]>(getMomentStorageKey()) || []
            const posted = latest.find(m => m.id === newMoment.id)
            if (posted) {
              posted.isGeneratingImage = false
              posted.imageError = error?.message || '图片生成失败'
              await discoverStore.setItem(getMomentStorageKey(), latest)
              window.dispatchEvent(new CustomEvent('clingy:moments-updated'))
            }
          })
      } else {
        newMoment.isGeneratingImage = false
        await discoverStore.setItem(getMomentStorageKey(), moments)
        window.dispatchEvent(new CustomEvent('clingy:moments-updated'))
      }
    } catch(e) {}
  }
  newContent = newContent.replace(postRegex, '')

  // 处理点赞动态、评论、点赞评论和回复评论。
  // comment_id 固定放在 content 前，避免内容包含空格时的脆弱解析。
  const interactRegex = /<interact_moment\s+action="([^"]+)"\s+id="([^"]+)"(?:\s+comment_id="([^"]*)")?(?:\s+content="([^"]*)")?\s*\/>/g
  let interactMatch
  while ((interactMatch = interactRegex.exec(newContent)) !== null) {
    handledMomentAction = true
    const action = interactMatch[1]
    const mId = interactMatch[2]
    const commentId = interactMatch[3]
    const commentContent = interactMatch[4]
    try {
      const moments = await discoverStore.getItem<any[]>(getMomentStorageKey()) || []
      const target = moments.find(m => m.id === mId)
      if (target) {
        target.likes ||= []
        target.comments ||= []
        const forced = Boolean(selectedChat.__forceMomentAction)
        if (action === 'like' && (forced || canPerformMomentAction(selectedChat, 'like')) && !target.likes.includes(selectedChat.name || '对方')) {
          target.likes.push(selectedChat.name || '对方')
          recordMomentAction(selectedChat, 'like')
          if (target.isOwn) addMomentNotification(target, { id: selectedChat.id, name: selectedChat.name || '对方' }, 'like')
        } else if (action === 'comment' && commentContent && !target.comments.some((c: any) => c.authorId === selectedChat.id && c.content === commentContent) && (forced || canPerformMomentAction(selectedChat, 'comment'))) {
          target.comments.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            author: selectedChat.name || '对方',
            authorId: selectedChat.id,
            content: commentContent,
            likes: [],
            createdAt: Date.now()
          })
          recordMomentAction(selectedChat, 'comment')
          if (target.isOwn) addMomentNotification(target, { id: selectedChat.id, name: selectedChat.name || '对方' }, 'comment', commentContent)
        } else if (action === 'like_comment' && commentId && (forced || canPerformMomentAction(selectedChat, 'like'))) {
          const comment = target.comments.find((c: any) => c.id === commentId)
          if (comment) {
            comment.likes ||= []
            if (!comment.likes.includes(selectedChat.name || '对方')) comment.likes.push(selectedChat.name || '对方')
            recordMomentAction(selectedChat, 'like')
            if (target.isOwn) addMomentNotification(target, { id: selectedChat.id, name: selectedChat.name || '对方' }, 'like_comment', comment.content)
          }
        } else if (action === 'reply_comment' && commentId && commentContent && (forced || canPerformMomentAction(selectedChat, 'comment'))) {
          const parent = target.comments.find((c: any) => c.id === commentId)
          const alreadyReplied = target.comments.some((c: any) => c.authorId === selectedChat.id && c.replyTo === commentId && c.content === commentContent)
          if (!parent || alreadyReplied) continue
          target.comments.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            author: selectedChat.name || '对方',
            authorId: selectedChat.id,
            content: commentContent,
            replyTo: commentId,
            replyToAuthor: parent?.author || '',
            likes: [],
            createdAt: Date.now()
          })
          recordMomentAction(selectedChat, 'comment')
          if (target.isOwn) addMomentNotification(target, { id: selectedChat.id, name: selectedChat.name || '对方' }, 'reply', commentContent)
        }
        await discoverStore.setItem(getMomentStorageKey(), moments)
        window.dispatchEvent(new CustomEvent('clingy:moments-updated'))
      }
    } catch(e) {}
  }
  newContent = newContent.replace(interactRegex, '')

  return { newContent: newContent.trim(), shouldTriggerAI, aiContext, handledMomentAction }
}
