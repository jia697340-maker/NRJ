/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { globalPromptSettings, offlinePresetSettings } from '../store'
import { replacePromptVariables, resolveOfflinePresetSection } from '../services/offlinePresets'
import { getEnglishOfflinePreset } from '../services/offlinePresetEnglish'

const resolvePreset = (chat: any) => {
  const requestedId = chat?.offlinePresetId || offlinePresetSettings.currentPresetId || 'offline_default'
  const preset = offlinePresetSettings.presets.find(item => item.id === requestedId)
    || offlinePresetSettings.presets.find(item => item.id === 'offline_default')
    || offlinePresetSettings.presets[0]
  return preset && globalPromptSettings.language === 'en' ? getEnglishOfflinePreset(preset) : preset
}

const resolveValues = (chat: any, userProfile?: any) => ({
  char_name: chat?.name || '角色',
  user_name: userProfile?.name || '对方'
})

export function buildOfflineMeetPrompt(chat: any, mode: 'mixed' | 'separate', userProfile?: any): string {
  if (!chat?.offlineMeetEnabled) return ''
  const preset = resolvePreset(chat)
  if (!preset) return ''

  const values = resolveValues(chat, userProfile)
  const main = replacePromptVariables(resolveOfflinePresetSection(preset, 'main'), values)
  const modePrompt = replacePromptVariables(resolveOfflinePresetSection(preset, 'mode'), values)
  const pageContext = mode === 'separate'
    ? globalPromptSettings.language === 'en'
      ? '<offline_page>This page uses an independent offline record. Continue only the in-person interaction that occurred on this page.</offline_page>'
      : '<offline_page>当前使用独立线下记录，只延续本页面内已经发生的线下互动。</offline_page>'
    : globalPromptSettings.language === 'en'
      ? '<offline_page>This in-person interaction shares continuous context with the original chat.</offline_page>'
      : '<offline_page>当前线下互动与原聊天共享连续上下文。</offline_page>'
  const locationContext = chat?.offlineMeetLocationMode === 'continuous'
    ? globalPromptSettings.language === 'en'
      ? '<offline_location>Preserve any established meeting location and spatial relationship. If none has been established, do not invent one.</offline_location>'
      : '<offline_location>优先沿用历史中已经明确的见面地点与空间关系；若尚未明确，则不要凭空指定。</offline_location>'
    : globalPromptSettings.language === 'en'
      ? '<offline_location>Keep the location unspecified until the conversation establishes it. Never choose a concrete location for the user.</offline_location>'
      : '<offline_location>地点尚未由对话明确时保持模糊，不替用户擅自决定具体地点。</offline_location>'

  return `\n\n${main}\n\n${modePrompt}\n\n${pageContext}\n${locationContext}`
}

export function buildOfflinePostHistoryPrompt(chat: any, userProfile?: any): string {
  if (!chat?.offlineMeetEnabled) return ''
  const preset = resolvePreset(chat)
  return preset ? replacePromptVariables(resolveOfflinePresetSection(preset, 'postHistory'), resolveValues(chat, userProfile)) : ''
}
