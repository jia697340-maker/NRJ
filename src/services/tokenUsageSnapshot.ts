/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
const STORAGE_KEY = 'clingy_latest_token_usage_v1'

export interface TokenUsageSnapshot {
  chatId?: string | number
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  createdAt: number
}

export const saveTokenUsageSnapshot = (snapshot: TokenUsageSnapshot) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)) } catch {}
}

export const getTokenUsageSnapshot = (chatId?: string | number): TokenUsageSnapshot | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!parsed || !Number.isFinite(parsed.totalTokens)) return null
    if (chatId != null && parsed.chatId != null && String(parsed.chatId) !== String(chatId)) return null
    return parsed
  } catch { return null }
}
