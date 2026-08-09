/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import { apiSettings } from '../store'

export interface ApiLogEntry {
  id: string
  timestamp: number
  type: string
  model: string
  duration: number
  tokens?: number
  success: boolean
  errorMsg?: string
}

const logStore = localforage.createInstance({
  name: 'clingy_app',
  storeName: 'api_logs'
})

export const apiLogger = {
  async addLog(entry: Omit<ApiLogEntry, 'id' | 'timestamp'>) {
    if (!apiSettings.enableApiLogging) return

    const fullEntry: ApiLogEntry = {
      ...entry,
      id: Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9),
      timestamp: Date.now()
    }

    try {
      let logs: ApiLogEntry[] = await logStore.getItem('logs') || []
      logs.unshift(fullEntry) // 添加到最前面

      const maxCount = apiSettings.apiLogMaxCount || 1000
      if (logs.length > maxCount) {
        logs = logs.slice(0, maxCount)
      }

      await logStore.setItem('logs', logs)
    } catch (err) {
      console.error('保存 API 日志失败', err)
    }
  },

  async getLogs(): Promise<ApiLogEntry[]> {
    try {
      return await logStore.getItem('logs') || []
    } catch (err) {
      console.error('获取 API 日志失败', err)
      return []
    }
  },

  async clearLogs() {
    try {
      await logStore.removeItem('logs')
    } catch (err) {
      console.error('清除 API 日志失败', err)
    }
  }
}
