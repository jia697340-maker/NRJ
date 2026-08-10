/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { apiSettings, characterApiSettings } from '../store'
import { compileCharacterPersona, runCharacterJson } from './characterGenerator'
import type {
  CharacterCandidate, CharacterCanonAudit, CharacterDraft, CharacterGenerationInput,
  CharacterHealthReport, CharacterModelReview
} from '../types/characterWorkshop'

const boundedScore = (value: unknown) => Math.max(0, Math.min(100, Number(value) || 0))
const asStrings = (value: unknown) => Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : []

export async function generateCharacterCandidates(input: CharacterGenerationInput): Promise<CharacterCandidate[]> {
  const result = await runCharacterJson(`为这份角色需求设计 ${input.candidateCount} 个方向明显不同的候选骨架：${JSON.stringify(input)}
不要只改职业或姓名；候选在价值观、矛盾来源、表达节奏和关系处理上都应有实质区别。
返回 {"candidates":[{"name":"","tagline":"","identity":"","core":"","contradiction":"","voice":"","relationship":""}]}。`)
  const list = Array.isArray(result.candidates) ? result.candidates : []
  return list.slice(0, input.candidateCount).map((item: any, index: number) => ({
    id: `candidate_${Date.now()}_${index}`, name: String(item.name || `候选 ${index + 1}`), tagline: String(item.tagline || ''),
    identity: String(item.identity || ''), core: String(item.core || ''), contradiction: String(item.contradiction || ''),
    voice: String(item.voice || ''), relationship: String(item.relationship || '')
  }))
}

export async function structureExistingPersona(name: string, persona: string): Promise<Partial<CharacterDraft>> {
  return runCharacterJson(`把以下现有人设整理为角色工坊结构。只提取原文可以支持的内容，不擅自增加恋爱关系、创伤或隐藏秘密。
角色名：${name}
原始人设：${persona}
返回字段 name,tagline,age,identity,world,core,desire,fear,contradiction,lifestyle,relationship,conflictStyle,careStyle,independence,voice,verbalHabits,antiPatterns,boundaries,knowledgeLimits,openingLine,samples。samples 最多 4 项。`)
}

export async function inspectCharacter(draft: CharacterDraft): Promise<CharacterHealthReport> {
  const result = await runCharacterJson(`体检以下角色档案：${JSON.stringify({ ...draft, versions: undefined, modelReviews: undefined })}
重点检查模板化、内部矛盾、关系越级、生活缺失、知识越界、机器式口语、固定反问、万能安慰和设定无法落地。
返回 {"score":0-100,"summary":"","strengths":[""],"issues":[{"category":"","severity":"low|medium|high","title":"","detail":"","suggestion":""}]}。评分严格，不因文字长而加分。`)
  return {
    createdAt: Date.now(), score: boundedScore(result.score), summary: String(result.summary || ''),
    strengths: asStrings(result.strengths).slice(0, 6),
    issues: (Array.isArray(result.issues) ? result.issues : []).slice(0, 10).map((item: any) => ({
      category: String(item.category || '综合'), severity: ['low', 'medium', 'high'].includes(item.severity) ? item.severity : 'medium',
      title: String(item.title || '待优化项'), detail: String(item.detail || ''), suggestion: String(item.suggestion || '')
    }))
  }
}

const reviewWith = async (draft: CharacterDraft, purpose: 'character-generation' | 'character-review-global', reviewer: string, model: string): Promise<CharacterModelReview> => {
  const result = await runCharacterJson(`作为独立评审，不改写角色，只评价这份最终聊天人设：${compileCharacterPersona(draft)}
返回 {"score":0-100,"verdict":"","dimensions":[{"name":"人设稳定性|自然表达|关系合理性|长期可演绎性|具体性","score":0-100,"note":""}],"risks":[""]}。不要因人设文字多而给高分。`, purpose)
  return {
    id: `review_${Date.now()}_${purpose}`, createdAt: Date.now(), reviewer, model: model || '未命名模型',
    score: boundedScore(result.score), verdict: String(result.verdict || ''), risks: asStrings(result.risks).slice(0, 8),
    dimensions: (Array.isArray(result.dimensions) ? result.dimensions : []).slice(0, 7).map((item: any) => ({
      name: String(item.name || '综合'), score: boundedScore(item.score), note: String(item.note || '')
    }))
  }
}

export async function reviewCharacterWithModels(draft: CharacterDraft): Promise<CharacterModelReview[]> {
  const isReady = (settings: { provider: string; customUrl: string; url: string; customKey: string; key: string; model: string }) => Boolean(
    (settings.provider === 'custom' ? settings.customUrl : settings.url) &&
    (settings.provider === 'custom' ? settings.customKey : settings.key) && settings.model
  )
  const characterReady = characterApiSettings.enabled && isReady(characterApiSettings)
  const globalReady = isReady(apiSettings)
  const tasks: Promise<CharacterModelReview>[] = characterReady
    ? [reviewWith(draft, 'character-generation', '角色生成节点', characterApiSettings.model)]
    : [reviewWith(draft, 'character-review-global', '全局聊天节点', apiSettings.model)]
  if (characterReady && globalReady) tasks.push(reviewWith(draft, 'character-review-global', '全局聊天节点', apiSettings.model))
  return Promise.all(tasks)
}

export async function auditCanonConsistency(draft: CharacterDraft): Promise<CharacterCanonAudit> {
  if (!draft.canonAnchors.length) throw new Error('请先添加至少一个原作锚点。')
  const result = await runCharacterJson(`检查角色档案是否偏离原作锚点。锚点：${JSON.stringify(draft.canonAnchors)}
角色档案：${compileCharacterPersona(draft)}
区分明确冲突、无法验证与允许的二次创作，不把资料空白误判为冲突。
返回 {"score":0-100,"summary":"","deviations":[{"anchor":"","severity":"low|medium|high","detail":"","fix":""}]}。`)
  return {
    createdAt: Date.now(), score: boundedScore(result.score), summary: String(result.summary || ''),
    deviations: (Array.isArray(result.deviations) ? result.deviations : []).slice(0, 12).map((item: any) => ({
      anchor: String(item.anchor || ''), severity: ['low', 'medium', 'high'].includes(item.severity) ? item.severity : 'medium',
      detail: String(item.detail || ''), fix: String(item.fix || '')
    }))
  }
}

export async function planWorldBookEntries(draft: CharacterDraft) {
  const result = await runCharacterJson(`把以下客观世界资料拆成可检索的世界书条目：${draft.world}
角色身份仅用于判断上下文：${draft.identity}。不要把角色性格、用户关系或对白习惯放入世界书。
合并重复事实，按地点、组织、规则、时代、事件或重要人物拆分。返回 {"entries":[{"title":"","content":"","keywords":"关键词1,关键词2","weight":1-10}]}，最多 10 项。`)
  return (Array.isArray(result.entries) ? result.entries : []).slice(0, 10).map((item: any, index: number) => ({
    id: `world_${Date.now()}_${index}`, title: String(item.title || `设定 ${index + 1}`), content: String(item.content || ''),
    keywords: String(item.keywords || ''), weight: Math.max(1, Math.min(10, Number(item.weight) || 5))
  })).filter((item: any) => item.content.trim())
}
