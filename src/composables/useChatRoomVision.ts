/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { sendChatMessage } from '../services/api'
import { chatSettings } from '../store'
import localforage from 'localforage'

export function useChatRoomVision(
  selectedChat: any,
  saveCustomContacts: () => void,
  showNotification: any
) {
  // 重新识图（手动触发）
  const reSummarizeImage = async (msgId: number, showToast: any) => {
    if (!selectedChat.value) return
    const targetMsg = selectedChat.value.messages?.find((m: any) => m.id === msgId)
    if (!targetMsg) return

    let needCompress = false
    let base64ToCompress = ''
    let compressPrompt = ''

    if (targetMsg.isEmoji && !targetMsg.emojiSummary) {
      needCompress = true
      compressPrompt = '请简短客观地描述这个表情包的情绪或画面内容（无需带上主观评价，只需陈述）。'
      if (targetMsg.emojiId) {
        const emojiStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatEmojis' })
        try {
          const item = await emojiStore.getItem<any>(targetMsg.emojiId)
          if (item) {
            let rawData = ''
            if (item.type === 'local' && item.data instanceof Blob) {
              rawData = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => typeof reader.result === 'string' ? resolve(reader.result) : reject()
                reader.readAsDataURL(item.data)
              })
            } else if (item.type === 'url' && typeof item.data === 'string') {
              rawData = item.data
            }
            if (rawData) base64ToCompress = rawData
          }
        } catch(e) {}
      }
    } else if (targetMsg.imageData && targetMsg.imageData.imageId && !targetMsg.imageData.summary) {
      needCompress = true
      compressPrompt = '请简短客观地描述这张图片的内容，捕捉主要元素。'
      const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
      try {
        const base64Data = await imageStore.getItem<string>(targetMsg.imageData.imageId)
        if (base64Data) {
          base64ToCompress = base64Data
        }
      } catch(e) {}
    }

    if (needCompress && base64ToCompress) {
      showToast('正在重新识图，请稍候...')
      try {
        const compressRequest = [
          { role: 'user', content: [
            { type: 'text', text: compressPrompt },
            { type: 'image_url', image_url: { url: base64ToCompress } }
          ]}
        ]
        const res = await sendChatMessage(compressRequest, undefined, false, true)
        let summaryContent = typeof res === 'string' ? res : res.content
        summaryContent = summaryContent.trim()
        
        if (summaryContent) {
          if (targetMsg.isEmoji) {
            targetMsg.emojiSummary = summaryContent
          } else if (targetMsg.imageData) {
            targetMsg.imageData.summary = summaryContent
          }
          saveCustomContacts()
          showToast('重新识图成功！')
        } else {
          showToast('识图失败：返回结果为空')
        }
      } catch (err: any) {
        showToast(`识图失败：${err.message}`)
      }
    } else {
      showToast('无法读取图片数据，或该图片已存在描述')
    }
  }

  // 触发 API 时的静默后台压缩检查
  const checkAndRunSilentCompression = async (targetChat: any) => {
    if (chatSettings.enableVisionTokenSaver && targetChat && targetChat.messages && targetChat.messages.length > 0) {
      const lastMsg = targetChat.messages[targetChat.messages.length - 1]
      if (lastMsg.type === 'right' && !lastMsg.isRecalled) {
        let needCompress = false
        let base64ToCompress = ''
        let compressPrompt = ''

        // 拦截新发送的表情包
        if (lastMsg.isEmoji && !lastMsg.emojiSummary) {
           needCompress = true
           compressPrompt = '请简短客观地描述这个表情包的情绪或画面内容（无需带上主观评价，只需陈述）。'
           if (lastMsg.emojiId) {
             const emojiStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatEmojis' })
             try {
                const item = await emojiStore.getItem<any>(lastMsg.emojiId)
                if (item) {
                   let rawData = ''
                   if (item.type === 'local' && item.data instanceof Blob) {
                     rawData = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onloadend = () => typeof reader.result === 'string' ? resolve(reader.result) : reject()
                        reader.readAsDataURL(item.data)
                     })
                   } else if (item.type === 'url' && typeof item.data === 'string') {
                      rawData = item.data
                   }
                   if (rawData) base64ToCompress = rawData
                }
             } catch(e) {}
           }
        }
        // 拦截新发送的真实图片
        else if (lastMsg.imageData && lastMsg.imageData.imageId && !lastMsg.imageData.summary) {
           needCompress = true
           compressPrompt = '请简短客观地描述这张图片的内容，捕捉主要元素。'
           const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
           try {
             const base64Data = await imageStore.getItem<string>(lastMsg.imageData.imageId)
             if (base64Data) {
               base64ToCompress = base64Data
             }
           } catch(e) {}
        }

        // 执行静默后台压缩 (不阻塞正常的聊天流程)
        if (needCompress && base64ToCompress) {
           console.log('[静默压缩] 触发识图降维机制...')
           const compressRequest = [
             { role: 'user', content: [
               { type: 'text', text: compressPrompt },
               { type: 'image_url', image_url: { url: base64ToCompress } }
             ]}
           ]
           sendChatMessage(compressRequest, undefined, false, true).then(res => {
             let summaryContent = typeof res === 'string' ? res : res.content
             summaryContent = summaryContent.trim()
             if (summaryContent) {
                console.log(`[静默压缩] 成功！结果：${summaryContent}`)
                if (lastMsg.isEmoji) {
                  lastMsg.emojiSummary = summaryContent
                } else if (lastMsg.imageData) {
                  lastMsg.imageData.summary = summaryContent
                }
                saveCustomContacts()
             }
           }).catch(err => {
             console.error('[静默压缩] 失败：', err)
             showNotification(targetChat.name, targetChat.avatarUrl, targetChat.avatarText, `[系统警告] 图片/表情包省Token识别失败：${err.message}`)
           })
        }
      }
    }
  }

  return {
    reSummarizeImage,
    checkAndRunSilentCompression
  }
}
