/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
export const formatForumTime = (value: number | string, nowTimestamp = Date.now()) => {
  if (value === '' || value === null || value === undefined) return ''
  if (typeof value === 'string' && !/^\d{10,}(?:\.\d+)?$/.test(value)) return value
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return String(value)
  const delta = Math.max(0, nowTimestamp - timestamp)
  if (delta < 60_000) return '刚刚'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`
  const time = new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (delta < 2 * 86_400_000) return `昨天 ${time}`
  if (delta < 3 * 86_400_000) return `前天 ${time}`
  if (delta < 7 * 86_400_000) return `${Math.floor(delta / 86_400_000)} 天前 ${time}`
  const date = new Date(timestamp)
  const now = new Date(nowTimestamp)
  return date.getFullYear() === now.getFullYear()
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}
