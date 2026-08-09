/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'

export interface ChatNotification {
  id: number
  name: string
  avatarUrl: string | null
  avatarText: string
  content: string
}

export const globalNotifications = ref<ChatNotification[]>([])
const pendingQueue = ref<ChatNotification[]>([])
let queueTimer: any = null

export const processQueue = async () => {
  import('../../store').then(({ chatSettings }) => {
    if (chatSettings.notificationStyle === 'queue') {
      // 排队模式：屏幕上只能同时有 1 条
      if (globalNotifications.value.length > 0) return // 当前还在显示
      if (pendingQueue.value.length === 0) return // 队列空了
      
      // 拿一条出来显示
      const nextNotif = pendingQueue.value.shift()
      if (nextNotif) {
        globalNotifications.value.push(nextNotif)
        
        if (queueTimer) clearTimeout(queueTimer)
        
        queueTimer = setTimeout(() => {
          // 时间到了，隐去
          globalNotifications.value = globalNotifications.value.filter(n => n.id !== nextNotif.id)
          // 等隐去动画结束再处理下一条
          setTimeout(() => {
            processQueue()
          }, 500)
        }, 4000)
      }
    } else {
      // 列表模式：推入并显示最多 3 条（避免太长挡住屏幕），自带 4 秒倒计时
      while (pendingQueue.value.length > 0) {
        const nextNotif = pendingQueue.value.shift()
        if (nextNotif) {
          if (globalNotifications.value.length >= 3) {
            globalNotifications.value.shift() // 挤掉最老的
          }
          globalNotifications.value.push(nextNotif)
          
          setTimeout(() => {
            globalNotifications.value = globalNotifications.value.filter(n => n.id !== nextNotif.id)
          }, 4000)
        }
      }
    }
  })
}

export const showNotification = (name: string, avatarUrl: string | null, avatarText: string, content: string) => {
  pendingQueue.value.push({
    id: Date.now() + Math.random(),
    name,
    avatarUrl,
    avatarText,
    content
  })
  processQueue()
}

export const dismissNotification = (id: number) => {
  globalNotifications.value = globalNotifications.value.filter(n => n.id !== id)
  // 被用户手动划走，如果是队列模式，提早处理下一条
  import('../../store').then(({ chatSettings }) => {
    if (chatSettings.notificationStyle === 'queue') {
      if (queueTimer) clearTimeout(queueTimer)
      setTimeout(() => {
        processQueue()
      }, 500)
    }
  })
}
