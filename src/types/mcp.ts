/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type DoubanTriggerMode = 'auto' | 'character' | 'confirm'
export type DoubanReadDepth = 'light' | 'standard' | 'full'
export type DoubanPageType = 'group_post' | 'movie' | 'book' | 'music' | 'review' | 'short_review' | 'unknown'
export type CapabilityExecutionStatus = 'detected' | 'awaiting_confirmation' | 'loading' | 'success' | 'partial' | 'error' | 'cancelled' | 'skipped'

export interface DoubanCapabilitySettings {
  enabled: boolean
  readPostBody: boolean
  readSubjectInfo: boolean
  readComments: boolean
  readShortReviews: boolean
  readLongReviews: boolean
  readRatingAndTags: boolean
  readAuthorPublicInfo: boolean
  readRelatedItems: boolean
  triggerMode: DoubanTriggerMode
  depth: DoubanReadDepth
  showCapabilityCard: boolean
}

export interface McpSettings {
  schemaVersion: 2
  enabled: boolean
  jinaApiKey: string
  douban: DoubanCapabilitySettings
}

export interface DoubanComment {
  author?: string
  content: string
  rating?: string
}

export interface DoubanExtractedContent {
  source: 'douban'
  sourceUrl: string
  normalizedUrl: string
  pageType: DoubanPageType
  title: string
  content: string
  subjectInfo: string
  comments: DoubanComment[]
  shortReviews: DoubanComment[]
  longReviews: DoubanComment[]
  rating: string
  tags: string[]
  authorPublicInfo: string
  relatedItems: string[]
  unavailableFields: string[]
  extractedAt: number
  parserVersion: number
}

export interface DoubanPermissionSnapshot {
  readPostBody: boolean
  readSubjectInfo: boolean
  readComments: boolean
  readShortReviews: boolean
  readLongReviews: boolean
  readRatingAndTags: boolean
  readAuthorPublicInfo: boolean
  readRelatedItems: boolean
}

export interface CapabilityExecutionState {
  id: string
  capability: 'douban'
  sourceMessageId: string | number
  sourceUrl: string
  normalizedUrl: string
  status: CapabilityExecutionStatus
  title: string
  pageType: DoubanPageType
  summary: string
  successfulFields: string[]
  unavailableFields: string[]
  errorKind?: 'timeout' | 'rate_limit' | 'restricted' | 'deleted' | 'network' | 'unsupported' | 'parse' | 'unknown'
  errorMessage?: string
  result?: DoubanExtractedContent
  permissions: DoubanPermissionSnapshot
  depth: DoubanReadDepth
  fromCache: boolean
  retryCount: number
  createdAt: number
  updatedAt: number
  consumedTurnIds: string[]
}

export interface CapabilityMessage {
  id: string
  timestamp: number
  type: 'capability'
  messageType: 'capability'
  capabilityExecution: CapabilityExecutionState
  isOfflineMeetMsg?: boolean
}

export interface McpModelTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpModelToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface McpToolExecutionResult {
  content: string
  isError?: boolean
}
