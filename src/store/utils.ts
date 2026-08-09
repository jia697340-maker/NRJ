/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export const readStoredJSON = <T>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value) as T
  } catch (error) {
    console.warn(`本地数据 ${key} 已损坏，已使用安全默认值`, error)
    return fallback
  }
}
