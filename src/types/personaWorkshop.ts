/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
export type PersonaWorkshopMode = 'prompt' | 'guided' | 'keywords' | 'interview' | 'dialogue' | 'inspiration'
export type PersonaKind = 'self' | 'roleplay'
export type PersonaDraftStatus = 'draft' | 'ready' | 'published'

export interface PersonaUnderstandingSample {
  scene: string
  likelyUnderstanding: string
  guardrail: string
}

export interface PersonaHealthIssue {
  category: string
  severity: 'low' | 'medium' | 'high'
  title: string
  detail: string
  suggestion: string
}

export interface PersonaHealthReport {
  createdAt: number
  score: number
  summary: string
  strengths: string[]
  issues: PersonaHealthIssue[]
}

export interface PersonaVersion {
  id: string
  createdAt: number
  label: string
  snapshot: Omit<PersonaDraft, 'versions'>
}

export interface PersonaDraft {
  id: string
  status: PersonaDraftStatus
  mode: PersonaWorkshopMode
  kind: PersonaKind
  name: string
  networkName: string
  tagline: string
  age: string
  pronouns: string
  identity: string
  world: string
  core: string
  values: string
  goals: string
  vulnerabilities: string
  contradiction: string
  lifestyle: string
  interests: string
  voice: string
  socialDistance: string
  carePreference: string
  conflictStyle: string
  boundaries: string
  sensitivities: string
  unknowns: string
  antiAssumptions: string
  keywords: string[]
  sourcePrompt: string
  lockedFields: string[]
  understandingSamples: PersonaUnderstandingSample[]
  healthReport: PersonaHealthReport | null
  completedGenerationStage: number
  createdAt: number
  updatedAt: number
  publishedPersonaId?: number
  versions: PersonaVersion[]
}

export interface PersonaGenerationInput {
  mode: PersonaWorkshopMode
  kind: PersonaKind
  prompt: string
  keywords: string[]
  dialogueText: string
  dialogueContext: string
  guided: {
    name: string
    age: string
    identity: string
    personality: string
    life: string
    boundaries: string
  }
  interview: {
    selfView: string
    importantThings: string
    dailyLife: string
    closeness: string
    conflict: string
    misunderstood: string
  }
}

export const createEmptyPersonaDraft = (mode: PersonaWorkshopMode = 'prompt', kind: PersonaKind = 'self'): PersonaDraft => {
  const now = Date.now()
  return {
    id: `persona_draft_${now}_${Math.random().toString(36).slice(2, 7)}`,
    status: 'draft', mode, kind, name: '', networkName: '', tagline: '', age: '', pronouns: '', identity: '', world: '',
    core: '', values: '', goals: '', vulnerabilities: '', contradiction: '', lifestyle: '', interests: '', voice: '',
    socialDistance: '', carePreference: '', conflictStyle: '', boundaries: '', sensitivities: '', unknowns: '', antiAssumptions: '',
    keywords: [], sourcePrompt: '', lockedFields: [], understandingSamples: [], healthReport: null,
    completedGenerationStage: 0, createdAt: now, updatedAt: now, versions: []
  }
}

export const normalizePersonaDraft = (raw: Partial<PersonaDraft>): PersonaDraft => {
  const base = createEmptyPersonaDraft(raw.mode || 'prompt', raw.kind || 'self')
  return {
    ...base,
    ...raw,
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
    lockedFields: Array.isArray(raw.lockedFields) ? raw.lockedFields : [],
    understandingSamples: Array.isArray(raw.understandingSamples) ? raw.understandingSamples : [],
    healthReport: raw.healthReport || null,
    completedGenerationStage: Math.max(0, Math.min(3, Number(raw.completedGenerationStage) || 0)),
    versions: Array.isArray(raw.versions) ? raw.versions : []
  }
}
