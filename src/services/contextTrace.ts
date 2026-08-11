/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type ContextTraceCategory = 'system' | 'world' | 'memory' | 'history' | 'media'

export interface ContextTraceFragment {
  id: string
  category: ContextTraceCategory
  group: string
  label: string
  text: string
  sourceId?: string
  parentId?: string
  messageRole?: string
  messageId?: string | number
  counted?: boolean
  reason?: string
}

export type ContextTraceCollector = (fragment: ContextTraceFragment) => void

export const pushContextTrace = (
  collector: ContextTraceCollector | undefined,
  fragment: ContextTraceFragment
) => {
  if (!collector || !fragment.text) return
  collector({ counted: true, ...fragment })
}
