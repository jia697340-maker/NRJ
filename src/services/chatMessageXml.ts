/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { parseBilingualMessage } from './bilingualChat'

export interface ParsedChatXmlMessage {
  content: string
  contentLanguage?: string
  translation?: string
  translationLanguage?: string
}

export interface ParsedPersonaFact {
  field: string
  value: string
  confidence?: number
}

const decodeEntities = (value: string) => value
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&apos;/gi, "'")
  .replace(/&amp;/gi, '&')

export const parseChatMessageXml = (raw: string, maxBubbles?: number) => {
  const source = String(raw || '').trim()
  const messages: ParsedChatXmlMessage[] = []
  const messageRegex = /<msg(\s+[^>]*)?>([\s\S]*?)(?:<\/msg>|(?=<msg\b|<persona_updates\b|$))/gi
  let match: RegExpExecArray | null
  while ((match = messageRegex.exec(source)) !== null) {
    let attrs = match[1] || ''
    let body = match[2].trim()
    const contentLanguage = body.match(/<content\s+[^>]*\blanguage\s*=\s*["']([^"']+)["']/i)?.[1]
    if (contentLanguage && !/\blang\s*=/.test(attrs)) attrs += ` lang="${contentLanguage}"`
    body = body.replace(/<content(?:\s+[^>]*)?>/gi, '<text>').replace(/<\/content>/gi, '</text>')
    body = body.replace(/<translation(\s+[^>]*)\blanguage\s*=/gi, '<translation$1 lang=')
    if (/<text(?:\s+[^>]*)?>/i.test(body) && !/<\/text>/i.test(body)) body += '</text>'
    if (/<translation(?:\s+[^>]*)?>/i.test(body) && !/<\/translation>/i.test(body)) body += '</translation>'
    const parsed = parseBilingualMessage(decodeEntities(body), attrs)
    if (parsed.content || parsed.translation) messages.push(parsed)
  }

  const facts: ParsedPersonaFact[] = []
  const personaSection = source.match(/<persona_updates(?:\s+[^>]*)?>([\s\S]*?)<\/persona_updates>/i)?.[1] || ''
  const factRegex = /<fact\s+([^>]*)>([\s\S]*?)<\/fact>/gi
  while ((match = factRegex.exec(personaSection)) !== null) {
    const attrs = match[1]
    const field = attrs.match(/\bfield\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() || ''
    const confidenceRaw = attrs.match(/\bconfidence\s*=\s*["']?([0-9.]+)["']?/i)?.[1]
    const value = decodeEntities(match[2].trim())
    if (field && value) facts.push({ field, value, confidence: confidenceRaw ? Math.max(0, Math.min(1, Number(confidenceRaw))) : undefined })
  }

  if (!messages.length) {
    const fallback = source
      .replace(/<persona_updates(?:\s+[^>]*)?>[\s\S]*?<\/persona_updates>/gi, '')
      .replace(/<inner_thought(?:\s+[^>]*)?>[\s\S]*?<\/inner_thought>/gi, '')
      .replace(/<\/?msg(?:\s+[^>]*)?>/gi, '')
      .trim()
    if (fallback) messages.push(parseBilingualMessage(decodeEntities(fallback)))
  }

  if (maxBubbles && maxBubbles > 0 && messages.length > maxBubbles) {
    const kept = messages.slice(0, maxBubbles)
    const overflow = messages.slice(maxBubbles - 1)
    kept[maxBubbles - 1] = {
      ...kept[maxBubbles - 1],
      content: overflow.map(item => item.content).filter(Boolean).join('\n')
    }
    messages.splice(0, messages.length, ...kept)
  }
  return { messages, facts }
}
