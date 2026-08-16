export type ReasoningMode = 'skip' | 'custom'
export type ReasoningEffort = 'low' | 'medium' | 'high'
export type ReasoningSource = 'native' | 'prompt' | 'none'

export interface ReasoningPolicy {
  enabled: boolean
  mode: ReasoningMode
  showThinking: boolean
  effort: ReasoningEffort
  geminiNativeEnabled: boolean
  claudeNativeEnabled: boolean
}

export interface ProviderReasoningState {
  provider: 'gemini' | 'claude' | 'openai' | 'glm'
  responseId?: string
  parts?: any[]
  blocks?: any[]
  reasoningContent?: string
}

export interface EmbeddedReasoningResult {
  content: string
  thinking: string
  found: boolean
}

export const shouldDisplayThinking = (
  settings: Pick<ReasoningPolicy, 'enabled' | 'mode' | 'showThinking'>,
  message: { type?: string; thinking?: string }
) => Boolean(
  settings.enabled &&
  settings.mode === 'custom' &&
  settings.showThinking &&
  message.type === 'left' &&
  message.thinking
)

export const mergeProviderReasoningState = (
  current: ProviderReasoningState | undefined,
  next: ProviderReasoningState
): ProviderReasoningState => {
  if (!current || current.provider !== next.provider) return JSON.parse(JSON.stringify(next))
  if (next.responseId) current.responseId = next.responseId
  if (next.provider === 'gemini' && next.parts?.length) current.parts = [...(current.parts || []), ...next.parts.map(part => ({ ...part }))]
  if (next.provider === 'claude' && next.blocks?.length) {
    const incoming = next.blocks[0]
    const existing = (current.blocks || []).find((block: any) => block.type === incoming.type)
    if (existing && incoming.type === 'thinking') {
      existing.thinking = `${existing.thinking || ''}${incoming.thinking || ''}`
      existing.signature = `${existing.signature || ''}${incoming.signature || ''}`
    } else {
      current.blocks = [...(current.blocks || []), ...next.blocks.map(block => ({ ...block }))]
    }
  }
  if (next.reasoningContent) current.reasoningContent = `${current.reasoningContent || ''}${next.reasoningContent}`
  return current
}

// 仅接受完整闭合的块。标签不完整时保留原文，避免流式截断或正文示例被误删。
export const extractEmbeddedReasoning = (input: string): EmbeddedReasoningResult => {
  const source = String(input || '')
  const startPattern = /(?:\[incipere\]\s*)?<thinking>/i
  const start = startPattern.exec(source)
  if (!start) return { content: source, thinking: '', found: false }
  const closeIndex = source.toLowerCase().indexOf('</thinking>', start.index + start[0].length)
  if (closeIndex < 0) return { content: source, thinking: '', found: false }

  const thinking = source.slice(start.index + start[0].length, closeIndex).trim()
  const before = source.slice(0, start.index)
  const after = source.slice(closeIndex + '</thinking>'.length)
    .replace(/^\s*\[finire\]\s*/i, '')
  return { content: `${before}${after}`.trim(), thinking, found: true }
}

export const isGeminiPrefillUnsupported = (model: string) => {
  const match = /gemini-3\.(\d+)/i.exec(model)
  return Boolean(match && Number(match[1]) >= 6)
}

export const isClaudeAdaptiveThinkingModel = (model: string) => {
  const key = model.toLowerCase()
  if (/claude-(?:opus|sonnet)-5/.test(key) || /claude-(?:fable|mythos)-5/.test(key)) return true
  const match = /claude-(?:opus|sonnet)-4[-.]?(\d+)/.exec(key)
  return Boolean(match && Number(match[1]) >= 6)
}

export const isOpenAIReasoningModel = (model: string) => /^(?:gpt-5|o[134](?:-|$))/i.test(model)
