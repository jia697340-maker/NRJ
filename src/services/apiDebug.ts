/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { getDiagnosticSettings } from './diagnosticTrace'

const SENSITIVE_KEY = /^(?:authorization|x-api-key|x-goog-api-key|api[_-]?key|token|access[_-]?token|signature|thoughtSignature)$/i

const redactUrl = (value: string) => {
  try {
    const url = new URL(value)
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:key|api[_-]?key|token)$/i.test(key)) url.searchParams.set(key, '[已脱敏]')
    }
    return url.toString()
  } catch {
    return value.replace(/([?&](?:key|api_key|apikey|token)=)[^&\s]+/gi, '$1[已脱敏]')
  }
}

export const redactApiDebugValue = (value: unknown, key = ''): unknown => {
  if (SENSITIVE_KEY.test(key)) return '[已脱敏]'
  if (Array.isArray(value)) return value.map(item => redactApiDebugValue(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => (
      [entryKey, redactApiDebugValue(entryValue, entryKey)]
    )))
  }
  if (typeof value === 'string' && /url|endpoint/i.test(key)) return redactUrl(value)
  return value
}

export const isRawApiConsoleLoggingEnabled = () => getDiagnosticSettings().rawConsoleLogging

export const logApiRequest = (input: { endpoint: string; protocol: string; headers: Record<string, string>; body: unknown }) => {
  if (!isRawApiConsoleLoggingEnabled()) return
  console.groupCollapsed(`[API 调试] 请求 · ${input.protocol}`)
  console.log('Endpoint:', redactUrl(input.endpoint))
  console.log('Headers:', redactApiDebugValue(input.headers))
  console.log('Body:', redactApiDebugValue(input.body))
  console.groupEnd()
}

export const logApiResponse = (input: { protocol: string; status: number; raw: unknown; parsed?: unknown }) => {
  if (!isRawApiConsoleLoggingEnabled()) return
  console.groupCollapsed(`[API 调试] 返回 · ${input.protocol} · ${input.status}`)
  console.log('Raw:', redactApiDebugValue(input.raw))
  if (input.parsed !== undefined) console.log('Parsed:', redactApiDebugValue(input.parsed))
  console.groupEnd()
}

export const logApiFallback = (from: string, to: string, status: number) => {
  if (!isRawApiConsoleLoggingEnabled()) return
  console.warn(`[API 调试] ${from} 返回 ${status}，已回退到 ${to}`)
}
