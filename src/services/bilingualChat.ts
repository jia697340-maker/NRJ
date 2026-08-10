/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { getLanguageInstructionName } from '../constants/chatLanguages'
import { globalPromptSettings } from '../store'

export type ParsedBilingualMessage = {
  content: string
  contentLanguage?: string
  translation?: string
  translationLanguage?: string
}

const readAttr = (attrs: string, name: string) => {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))
  return match?.[1]?.trim() || ''
}

export const parseBilingualMessage = (rawContent: string, msgAttrs = ''): ParsedBilingualMessage => {
  const textMatch = rawContent.match(/<text(?:\s+[^>]*)?>([\s\S]*?)<\/text>/i)
  const translationMatch = rawContent.match(/<translation(?:\s+([^>]*))?>([\s\S]*?)<\/translation>/i)
  if (!textMatch) return { content: rawContent.trim(), contentLanguage: readAttr(msgAttrs, 'lang') || undefined }

  const translationAttrs = translationMatch?.[1] || ''
  return {
    content: textMatch[1].trim(),
    contentLanguage: readAttr(msgAttrs, 'lang') || undefined,
    translation: translationMatch?.[2]?.trim() || undefined,
    translationLanguage: readAttr(translationAttrs, 'lang') || undefined
  }
}

const resolveAppLanguage = () => {
  const browserLanguage = typeof navigator !== 'undefined' ? navigator.language : 'zh-CN'
  return browserLanguage || 'zh-CN'
}

export const buildBilingualPrompt = (chat: any) => {
  if (!chat?.bilingualEnabled) return ''
  const usesEnglishPrompt = globalPromptSettings.language === 'en'

  const mode = chat.bilingualMode || 'auto'
  const outputCode = chat.dialogueLanguage || 'auto'
  const outputName = getLanguageInstructionName(outputCode, chat.customDialogueLanguage)
  const targetCode = chat.translationLanguage || 'app'
  const resolvedTargetCode = targetCode === 'app' ? resolveAppLanguage() : targetCode
  const targetName = getLanguageInstructionName(
    targetCode === 'app' ? resolvedTargetCode : targetCode,
    chat.customTranslationLanguage
  )

  let outputRule = usesEnglishPrompt
    ? 'Choose the language actually spoken by the character naturally from the persona, region, and current conversation context.'
    : '根据角色人设、所处地区和当前对话语境，自然决定角色实际说出的语言。'
  if (mode === 'follow_user') {
    outputRule = usesEnglishPrompt
      ? `The character's spoken dialogue must follow the primary language of the user's most recent message.`
      : '角色实际说出的对白应跟随用户最近一条消息所使用的主要语言。'
  } else if (mode === 'forced') {
    outputRule = usesEnglishPrompt
      ? `All dialogue actually spoken by the character must use ${outputName}. Do not change the dialogue language when the user writes in another language or asks you to switch; only an explicit system instruction may change it.`
      : `角色实际说出的所有对白必须使用${outputName}。即使用户使用其他语言或要求切换，也不要改变对白语言；只有系统明确要求时才能切换。`
  }

  const translationOff = targetCode === 'off'
  const translationRule = translationOff
    ? (usesEnglishPrompt ? 'Do not generate a translation node.' : '不要生成 translation 节点。')
    : usesEnglishPrompt
      ? `Every msg must include a natural, accurate ${targetName} translation. Preserve tone, nicknames, and emotion rather than translating word by word. The translation exists only for interface display and is not dialogue spoken by the character. If the source is already ${targetName}, omit translation instead of repeating the same sentence.`
      : `每个 msg 都必须提供自然、准确的${targetName}翻译。译文要保留语气、昵称和情感，不要逐字硬译；译文只供界面展示，不是角色实际说出的内容。若原文已经是${targetName}，translation 可省略，禁止重复同一句。`

  return usesEnglishPrompt ? `\n\n[Bilingual dialogue rules — system enforced]
${outputRule}
${translationRule}
Every ordinary text message must use this exact structure, with each consecutive message paired separately:
<msg lang="source language code"><text>the character's actual spoken words</text>${translationOff ? '' : `<translation lang="${resolvedTargetCode}">translation</translation>`}</msg>
Translate only natural language inside text. Never translate or rename the msg, text, or translation tags, and never place transfers, voice messages, images, stickers, calls, Moments, or other feature tags inside translation.` : `\n\n【双语对话规则（系统强制）】
${outputRule}
${translationRule}
普通文字消息必须严格使用以下结构，且每一条连续消息分别配对：
<msg lang="原文语言代码"><text>角色实际说出的原文</text>${translationOff ? '' : `<translation lang="${resolvedTargetCode}">译文</translation>`}</msg>
只翻译 text 中的自然语言。不得翻译或改写 msg、text、translation 标签名，也不得把转账、语音、图片、表情包、电话、朋友圈等功能标签放进 translation。`
}
