/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
export type CharacterGenerationMode = 'instant' | 'prompt' | 'guided' | 'keywords' | 'fandom' | 'dialogue'
export type CharacterDraftStatus = 'draft' | 'ready' | 'published'

export interface CharacterDialogueSample {
  scene: string
  user: string
  character: string
}

export interface CharacterCanonAnchor {
  id: string
  type: 'fact' | 'timeline' | 'relationship' | 'voice'
  title: string
  content: string
}

export interface CharacterCandidate {
  id: string
  name: string
  tagline: string
  identity: string
  core: string
  contradiction: string
  voice: string
  relationship: string
}

export interface CharacterHealthIssue {
  category: string
  severity: 'low' | 'medium' | 'high'
  title: string
  detail: string
  suggestion: string
}

export interface CharacterHealthReport {
  createdAt: number
  score: number
  summary: string
  strengths: string[]
  issues: CharacterHealthIssue[]
}

export interface CharacterModelReview {
  id: string
  createdAt: number
  reviewer: string
  model: string
  score: number
  verdict: string
  dimensions: Array<{ name: string; score: number; note: string }>
  risks: string[]
}

export interface CharacterCanonAudit {
  createdAt: number
  score: number
  summary: string
  deviations: Array<{ anchor: string; severity: 'low' | 'medium' | 'high'; detail: string; fix: string }>
}

export interface CharacterTemplate {
  id: string
  name: string
  description: string
  createdAt: number
  updatedAt: number
  tags: string[]
  snapshot: Omit<CharacterDraft, 'id' | 'versions' | 'publishedContactId' | 'createdAt' | 'updatedAt'>
}

export interface CharacterVersion {
  id: string
  createdAt: number
  label: string
  snapshot: Omit<CharacterDraft, 'versions'>
}

export interface CharacterDraft {
  id: string
  status: CharacterDraftStatus
  mode: CharacterGenerationMode
  name: string
  tagline: string
  age: string
  identity: string
  world: string
  core: string
  desire: string
  fear: string
  contradiction: string
  lifestyle: string
  relationship: string
  conflictStyle: string
  careStyle: string
  independence: string
  voice: string
  verbalHabits: string
  antiPatterns: string
  boundaries: string
  knowledgeLimits: string
  openingLine: string
  samples: CharacterDialogueSample[]
  canonAnchors: CharacterCanonAnchor[]
  canonAudit: CharacterCanonAudit | null
  healthReport: CharacterHealthReport | null
  modelReviews: CharacterModelReview[]
  keywords: string[]
  sourcePrompt: string
  completedGenerationStage: number
  lockedFields: string[]
  createdAt: number
  updatedAt: number
  publishedContactId?: string
  originContactId?: string
  versions: CharacterVersion[]
}

export interface CharacterGenerationInput {
  mode: CharacterGenerationMode
  prompt: string
  keywords: string[]
  fandomSource: string
  fandomCharacter: string
  divergence: 'canon' | 'balanced' | 'free'
  canonText: string
  dialogueText: string
  dialogueContext: string
  candidateCount: 1 | 2 | 3
  guided: {
    name: string
    age: string
    identity: string
    relationship: string
    personality: string
    boundaries: string
  }
}

export const createEmptyCharacterDraft = (mode: CharacterGenerationMode = 'prompt'): CharacterDraft => {
  const now = Date.now()
  return {
    id: `character_${now}_${Math.random().toString(36).slice(2, 7)}`,
    status: 'draft', mode, name: '', tagline: '', age: '', identity: '', world: '', core: '', desire: '', fear: '',
    contradiction: '', lifestyle: '', relationship: '', conflictStyle: '', careStyle: '', independence: '', voice: '',
    verbalHabits: '', antiPatterns: '', boundaries: '', knowledgeLimits: '', openingLine: '', samples: [], keywords: [],
    sourcePrompt: '', completedGenerationStage: 0, lockedFields: [], canonAnchors: [], canonAudit: null, healthReport: null, modelReviews: [],
    createdAt: now, updatedAt: now, versions: []
  }
}

export const normalizeCharacterDraft = (raw: Partial<CharacterDraft>): CharacterDraft => {
  const base = createEmptyCharacterDraft(raw.mode || 'prompt')
  return {
    ...base, ...raw,
    samples: Array.isArray(raw.samples) ? raw.samples : [],
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
    lockedFields: Array.isArray(raw.lockedFields) ? raw.lockedFields : [],
    canonAnchors: Array.isArray(raw.canonAnchors) ? raw.canonAnchors : [],
    canonAudit: raw.canonAudit || null,
    healthReport: raw.healthReport || null,
    modelReviews: Array.isArray(raw.modelReviews) ? raw.modelReviews : [],
    completedGenerationStage: Math.max(0, Math.min(4, Number(raw.completedGenerationStage) || 0)),
    versions: Array.isArray(raw.versions) ? raw.versions : []
  }
}
