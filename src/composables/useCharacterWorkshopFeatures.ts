/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed, ref } from 'vue'
import { useChatAuth } from './useChatAuth'
import { refineCharacter } from '../services/characterGenerator'
import {
  auditCanonConsistency, generateCharacterCandidates, inspectCharacter, reviewCharacterWithModels, structureExistingPersona
} from '../services/characterWorkshopFeatures'
import {
  createEmptyCharacterDraft, normalizeCharacterDraft, type CharacterCandidate, type CharacterDraft,
  type CharacterGenerationInput, type CharacterTemplate
} from '../types/characterWorkshop'

const TEMPLATE_KEY = 'clingy_character_templates_v1'
const templates = ref<CharacterTemplate[]>([])
let templatesLoaded = false

const loadTemplates = () => {
  if (templatesLoaded) return
  templatesLoaded = true
  try { templates.value = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]') } catch { templates.value = [] }
}
const saveTemplates = () => localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates.value))

export function useCharacterWorkshopFeatures() {
  loadTemplates()
  const candidates = ref<CharacterCandidate[]>([])
  const isFeatureLoading = ref(false)
  const featureLabel = ref('')
  const { currentChatUserId } = useChatAuth()

  const contacts = computed<any[]>(() => {
    const key = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
    try { return JSON.parse(localStorage.getItem(key) || '[]').filter((item: any) => item.id !== 1) } catch { return [] }
  })

  const buildCandidates = async (input: CharacterGenerationInput) => {
    isFeatureLoading.value = true
    featureLabel.value = '正在设计差异化候选'
    try { candidates.value = await generateCharacterCandidates(input); return candidates.value }
    finally { isFeatureLoading.value = false }
  }

  const applyCandidate = (draft: CharacterDraft, candidate: CharacterCandidate) => {
    for (const key of ['name', 'tagline', 'identity', 'core', 'contradiction', 'voice', 'relationship'] as const) draft[key] = candidate[key]
    draft.sourcePrompt = `${draft.sourcePrompt}\n已选择候选方向：${JSON.stringify(candidate)}`.trim()
  }

  const inspect = async (draft: CharacterDraft) => {
    isFeatureLoading.value = true; featureLabel.value = '正在进行角色体检'
    try { draft.healthReport = await inspectCharacter(draft); draft.updatedAt = Date.now(); return draft.healthReport }
    finally { isFeatureLoading.value = false }
  }

  const optimizeByReport = async (draft: CharacterDraft) => {
    if (!draft.healthReport?.issues.length) throw new Error('当前没有可用于优化的体检问题。')
    isFeatureLoading.value = true; featureLabel.value = '正在按体检报告优化'
    try {
      const instructions = draft.healthReport.issues.map(item => `${item.title}：${item.suggestion}`).join('\n')
      await refineCharacter(draft, `根据以下体检问题进行克制的结构优化。保留所有已锁定事实，不通过增加创伤或戏剧冲突解决问题：\n${instructions}`)
      draft.healthReport = await inspectCharacter(draft)
      return draft
    } finally { isFeatureLoading.value = false }
  }

  const review = async (draft: CharacterDraft) => {
    isFeatureLoading.value = true; featureLabel.value = '两个节点正在独立评审'
    try { draft.modelReviews = await reviewCharacterWithModels(draft); draft.updatedAt = Date.now(); return draft.modelReviews }
    finally { isFeatureLoading.value = false }
  }

  const auditCanon = async (draft: CharacterDraft) => {
    isFeatureLoading.value = true; featureLabel.value = '正在核对原作锚点'
    try { draft.canonAudit = await auditCanonConsistency(draft); draft.updatedAt = Date.now(); return draft.canonAudit }
    finally { isFeatureLoading.value = false }
  }

  const importContactForInspection = async (contact: any) => {
    isFeatureLoading.value = true; featureLabel.value = '正在整理现有人设'
    try {
      const structured = await structureExistingPersona(contact.name || contact.realName || '未命名角色', contact.persona || '')
      const draft = normalizeCharacterDraft({ ...createEmptyCharacterDraft('guided'), ...structured, originContactId: String(contact.id), sourcePrompt: '从现有聊天联系人导入', status: 'ready' })
      draft.healthReport = await inspectCharacter(draft)
      return draft
    } finally { isFeatureLoading.value = false }
  }

  const saveAsTemplate = (draft: CharacterDraft, name = '') => {
    const snapshot: any = JSON.parse(JSON.stringify(draft))
    delete snapshot.id; delete snapshot.versions; delete snapshot.publishedContactId; delete snapshot.createdAt; delete snapshot.updatedAt
    const now = Date.now()
    const template: CharacterTemplate = {
      id: `template_${now}`, name: name.trim() || `${draft.name || '未命名'}模板`, description: draft.tagline || draft.core.slice(0, 80),
      tags: [...draft.keywords], createdAt: now, updatedAt: now, snapshot
    }
    templates.value.unshift(template); saveTemplates(); return template
  }

  const createFromTemplate = (template: CharacterTemplate) => {
    const now = Date.now()
    return normalizeCharacterDraft({ ...JSON.parse(JSON.stringify(template.snapshot)), id: `character_${now}`, status: 'draft', createdAt: now, updatedAt: now, versions: [], publishedContactId: undefined })
  }

  const deleteTemplate = (id: string) => { templates.value = templates.value.filter(item => item.id !== id); saveTemplates() }

  const exportDraft = (draft: CharacterDraft) => {
    const payload = { format: 'clingy-character-v2', exportedAt: Date.now(), character: draft }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${draft.name || '角色档案'}.character.json`; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const importDraftFile = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) throw new Error('角色文件不能超过 4MB。')
    const data = JSON.parse(await file.text())
    const raw = data.format === 'clingy-character-v2' ? data.character : data
    if (!raw || typeof raw !== 'object') throw new Error('无法识别这个角色文件。')
    const draft = normalizeCharacterDraft(raw)
    draft.id = `character_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    draft.status = 'draft'; draft.publishedContactId = undefined; draft.createdAt = Date.now(); draft.updatedAt = Date.now(); draft.versions = []
    return draft
  }

  return { templates, contacts, candidates, isFeatureLoading, featureLabel, buildCandidates, applyCandidate, inspect,
    optimizeByReport, review, auditCanon, importContactForInspection, saveAsTemplate, createFromTemplate, deleteTemplate,
    exportDraft, importDraftFile }
}
