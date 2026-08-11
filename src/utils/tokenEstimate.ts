/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

/**
 * A deliberately conservative, provider-neutral estimate for text-only prompts.
 * Exact tokenization varies by model, so the UI always labels this value as approximate.
 */
export const estimateTextTokens = (text: string): number => {
  const value = String(text || '')
  if (!value) return 0

  const cjkCount = (value.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g) || []).length
  const latinWords = value.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []
  const latinTokens = latinWords.reduce((total, word) => total + Math.max(1, Math.ceil(word.length / 4)), 0)
  const numbers = value.match(/\d+(?:[.,:]\d+)*/g) || []
  const numberTokens = numbers.reduce((total, number) => total + Math.max(1, Math.ceil(number.length / 3)), 0)
  const coveredChars = cjkCount
    + latinWords.reduce((total, word) => total + word.length, 0)
    + numbers.reduce((total, number) => total + number.length, 0)
  const remainingTokens = Math.ceil(Math.max(0, value.length - coveredChars) / 3.5)

  return Math.max(1, Math.ceil(cjkCount * 1.05 + latinTokens + numberTokens + remainingTokens))
}

export const estimateMessageTokens = (text: string, framingTokens = 4): number => {
  if (!String(text || '')) return framingTokens
  return estimateTextTokens(text) + framingTokens
}

export const getTokenEstimateMethodLabel = (): string => '中英混合本地估算'

export const formatEstimatedTokens = (tokens: number): string => {
  if (tokens >= 1000) {
    const value = tokens >= 10000 ? Math.round(tokens / 1000) : Math.round(tokens / 100) / 10
    return `≈ ${value}K Tokens`
  }
  return `≈ ${tokens} Tokens`
}
