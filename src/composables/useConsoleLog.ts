/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'

export interface LogItem {
  id: string
  type: 'log' | 'warn' | 'error'
  timestamp: number
  content: string
}

const logs = ref<LogItem[]>([])
const MAX_LOGS = 1000

const formatArg = (arg: any): string => {
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg, null, 2)
    } catch (e) {
      return String(arg)
    }
  }
  return String(arg)
}

// 立即执行拦截
const originalLog = console.log
const originalWarn = console.warn
const originalError = console.error

const addLog = (type: 'log' | 'warn' | 'error', args: any[]) => {
  const content = args.map(formatArg).join(' ')
  logs.value.push({
    id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
    type,
    timestamp: Date.now(),
    content
  })
  if (logs.value.length > MAX_LOGS) {
    logs.value.shift()
  }
}

console.log = function (...args) {
  addLog('log', args)
  originalLog.apply(console, args)
}

console.warn = function (...args) {
  addLog('warn', args)
  originalWarn.apply(console, args)
}

console.error = function (...args) {
  addLog('error', args)
  originalError.apply(console, args)
}

export function useConsoleLog() {
  const clearLogs = () => {
    logs.value = []
  }

  return {
    logs,
    clearLogs
  }
}
