/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
export type ChatLanguageOption = { value: string; label: string }

export const chatLanguageOptions: ChatLanguageOption[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁体中文' },
  { value: 'en', label: '英语 (English)' },
  { value: 'ja', label: '日语 (Japanese)' },
  { value: 'ko', label: '韩语 (Korean)' },
  { value: 'fr', label: '法语 (French)' },
  { value: 'de', label: '德语 (German)' },
  { value: 'es', label: '西班牙语 (Spanish)' },
  { value: 'it', label: '意大利语 (Italian)' },
  { value: 'ru', label: '俄语 (Russian)' },
  { value: 'pt', label: '葡萄牙语 (Portuguese)' },
  { value: 'ar', label: '阿拉伯语 (Arabic)' },
  { value: 'hi', label: '印地语 (Hindi)' },
  { value: 'bn', label: '孟加拉语 (Bengali)' },
  { value: 'id', label: '印尼语 (Indonesian)' },
  { value: 'vi', label: '越南语 (Vietnamese)' },
  { value: 'th', label: '泰语 (Thai)' },
  { value: 'tr', label: '土耳其语 (Turkish)' },
  { value: 'fa', label: '波斯语 (Persian)' },
  { value: 'pl', label: '波兰语 (Polish)' },
  { value: 'uk', label: '乌克兰语 (Ukrainian)' },
  { value: 'nl', label: '荷兰语 (Dutch)' },
  { value: 'ro', label: '罗马尼亚语 (Romanian)' },
  { value: 'hu', label: '匈牙利语 (Hungarian)' },
  { value: 'cs', label: '捷克语 (Czech)' },
  { value: 'el', label: '希腊语 (Greek)' },
  { value: 'sv', label: '瑞典语 (Swedish)' },
  { value: 'fi', label: '芬兰语 (Finnish)' },
  { value: 'da', label: '丹麦语 (Danish)' },
  { value: 'no', label: '挪威语 (Norwegian)' },
  { value: 'he', label: '希伯来语 (Hebrew)' },
  { value: 'ms', label: '马来语 (Malay)' },
  { value: 'tl', label: '他加禄语 (Tagalog)' },
  { value: 'ur', label: '乌尔都语 (Urdu)' },
  { value: 'ta', label: '泰米尔语 (Tamil)' },
  { value: 'te', label: '泰卢固语 (Telugu)' },
  { value: 'ml', label: '马拉雅拉姆语 (Malayalam)' },
  { value: 'gu', label: '古吉拉特语 (Gujarati)' },
  { value: 'kn', label: '卡纳达语 (Kannada)' },
  { value: 'mr', label: '马拉地语 (Marathi)' }
]

export const getChatLanguageLabel = (value: string, customLanguage = '') => {
  if (value === 'auto') return '跟随人设'
  if (value === 'follow_user') return '跟随用户'
  if (value === 'app') return '跟随应用语言'
  if (value === 'off') return '不翻译'
  if (value === 'custom') return customLanguage || '自定义语言'
  return chatLanguageOptions.find(option => option.value === value)?.label || value || '未设置'
}

export const getLanguageInstructionName = (value: string, customLanguage = '') =>
  getChatLanguageLabel(value, customLanguage).replace(/\s*\([^)]*\)\s*$/, '')
