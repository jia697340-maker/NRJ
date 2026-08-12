/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed } from 'vue'
import localforage from 'localforage'
import { chatSettings } from '../store'

const isInternalSystemNarration = (msg: any) => {
  if (msg?.type !== 'system') return false
  if (msg.isHidden === true) return true
  if (msg.systemKind === 'moments_context' || msg.systemKind === 'call_context') return true

  // 兼容已经存入本地、尚未带 systemKind 的朋友圈上下文。
  return /^【系统旁白：你打开了朋友圈[。 ，,]/.test(String(msg.content || '').trim())
}

export function useChatRoomDisplay(selectedChat: any) {
  // 友好的时间格式化
  const formatTimeFriendly = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    
    const isToday = date.toDateString() === now.toDateString()
    
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday = date.toDateString() === yesterday.toDateString()
    
    const isSameYear = date.getFullYear() === now.getFullYear()
    
    const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    
    if (isToday) {
      return timeStr
    } else if (isYesterday) {
      return `昨天 ${timeStr}`
    } else if (isSameYear) {
      return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`
    } else {
      return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`
    }
  }

  // 动态计算带有时间戳的消息列表
  const displayMessages = computed(() => {
    const msgs = selectedChat.value?.messages || []
    const result: any[] = []
    const groupedTransferEvents = new Map<string, any[]>()
    for (const message of msgs) {
      if (message?.systemKind !== 'transfer_event' || message.transferMessageId === undefined) continue
      const key = String(message.transferMessageId)
      const events = groupedTransferEvents.get(key) || []
      events.push(message)
      groupedTransferEvents.set(key, events)
    }
    let lastTime = 0
    
    for (const msg of msgs) {
      if (msg.type === 'time') continue
      // 转账事件在视觉上固定跟随原卡片，避免被角色连发消息拆散。
      // 数据数组仍保留真实发生顺序，供上下文和持久化使用。
      if (msg.systemKind === 'transfer_event' && msg.transferMessageId !== undefined) continue
      
      // 通话内的对话只属于通话界面。挂断时的剔除是事后清理，
      // 通话中途最小化、或者中途刷新页面都会赶在剔除之前，所以这里必须按标记实时过滤
      if (msg.isVoiceCallProcessMsg || msg.isVideoCallProcessMsg) continue

      // 独立线下见面产生的消息只在线下界面显示，普通聊天框隐藏
      if (msg.isOfflineMeetMsg) continue

      // 内部旁白保留在历史与模型上下文中，只控制聊天界面的可见性。
      if (!chatSettings.showSystemNarration && isInternalSystemNarration(msg)) continue
      
      // msg.id 必须是一个合法的时间戳，做兜底兼容
      const msgTime = (msg.id > 1000000000000) ? msg.id : Date.now()
      
      // 如果与上一条消息相差超过 5 分钟 (300000 毫秒)
      if (msgTime - lastTime > 300000) {
        result.push({
          id: `time_${msgTime}`,
          type: 'time',
          content: formatTimeFriendly(msgTime)
        })
        lastTime = msgTime
      }
      
      // 检查是否有真实图片ID但未加载Base64的，触发异步加载
      if (msg.imageData && msg.imageData.imageId && !msg._localImageUrl) {
        // 先给个标记防止重复请求
        msg._localImageUrl = '' // 占位
        const imageStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatImages' })
        imageStore.getItem<string>(msg.imageData.imageId).then(base64 => {
          if (base64) {
             msg._localImageUrl = base64
          }
        }).catch(err => {
          console.error('加载图片失败', err)
        })
      }

      result.push(msg)
      const transferEvents = groupedTransferEvents.get(String(msg.id)) || []
      result.push(...transferEvents)
    }
    
    return result
  })

  return {
    formatTimeFriendly,
    displayMessages
  }
}
