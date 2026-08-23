/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed, ref } from 'vue'
import { useChatAuth } from './useChatAuth'
import { applyUserProfileToChat, getPersonaStorageKey, loadUserPersonas, type UserPersonaRecord } from './useChatUserProfiles'
import { loadCustomContacts } from './chatState/contacts'
import { mockChats } from './chatState/state'
import { saveGroupChat } from '../services/groupChat'
import { compilePersona, generatePersonaByStages, inspectPersona, refinePersona, simulatePersonaUnderstanding } from '../services/personaGenerator'
import { createEmptyPersonaDraft, normalizePersonaDraft, type PersonaDraft, type PersonaGenerationInput } from '../types/personaWorkshop'

const STORAGE_KEY = 'clingy_persona_workshop_v1'
const drafts = ref<PersonaDraft[]>([])
let loaded = false

const cloneWithoutVersions = (draft: PersonaDraft): Omit<PersonaDraft, 'versions'> => {
  const copy = JSON.parse(JSON.stringify(draft))
  delete copy.versions
  return copy
}

const load = () => {
  if (loaded) return
  loaded = true
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    drafts.value = Array.isArray(parsed) ? parsed.map(normalizePersonaDraft) : []
  } catch { drafts.value = [] }
}

const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.value))

export function usePersonaWorkshop() {
  load()
  const activeDraft = ref<PersonaDraft | null>(null)
  const isWorking = ref(false)
  const workLabel = ref('')
  const generationStage = ref(0)
  const errorMessage = ref('')
  const successMessage = ref('')
  let controller: AbortController | null = null

  const recentDrafts = computed(() => [...drafts.value].sort((a, b) => b.updatedAt - a.updatedAt))

  const saveDraft = (draft: PersonaDraft, versionLabel = '') => {
    draft.updatedAt = Date.now()
    if (versionLabel) {
      draft.versions ||= []
      draft.versions.unshift({ id: `persona_version_${Date.now()}`, createdAt: Date.now(), label: versionLabel, snapshot: cloneWithoutVersions(draft) })
      draft.versions = draft.versions.slice(0, 20)
    }
    const index = drafts.value.findIndex(item => item.id === draft.id)
    if (index >= 0) drafts.value[index] = JSON.parse(JSON.stringify(draft))
    else drafts.value.unshift(JSON.parse(JSON.stringify(draft)))
    activeDraft.value = draft
    persist()
  }

  const createDraft = (mode: PersonaGenerationInput['mode'], kind: PersonaGenerationInput['kind']) => {
    const draft = createEmptyPersonaDraft(mode, kind)
    activeDraft.value = draft
    saveDraft(draft)
    return draft
  }

  const openDraft = (id: string) => {
    const stored = drafts.value.find(item => item.id === id)
    activeDraft.value = stored ? JSON.parse(JSON.stringify(stored)) : null
    return activeDraft.value
  }

  const deleteDraft = (id: string) => {
    drafts.value = drafts.value.filter(item => item.id !== id)
    if (activeDraft.value?.id === id) activeDraft.value = null
    persist()
  }

  const stop = () => controller?.abort()

  const generate = async (input: PersonaGenerationInput) => {
    const draft = activeDraft.value || createDraft(input.mode, input.kind)
    if (input.mode === 'guided') {
      const fields: Array<[keyof PersonaDraft, string]> = [['name', input.guided.name], ['age', input.guided.age], ['identity', input.guided.identity], ['core', input.guided.personality], ['lifestyle', input.guided.life], ['boundaries', input.guided.boundaries]]
      for (const [key, value] of fields) if (value.trim()) { (draft as any)[key] = value.trim(); if (!draft.lockedFields.includes(key)) draft.lockedFields.push(key) }
    }
    errorMessage.value = ''
    successMessage.value = ''
    isWorking.value = true
    controller = new AbortController()
    try {
      await generatePersonaByStages(draft, input, (stage, label) => { generationStage.value = stage; workLabel.value = label; saveDraft(draft) }, controller.signal)
      saveDraft(draft, 'AI 整理完成')
      successMessage.value = '人设档案已整理完成，可以继续校准或发布。'
    } catch (error: any) {
      saveDraft(draft)
      if (error?.name === 'AbortError') successMessage.value = '已暂停，完成的内容已经保存。'
      else errorMessage.value = error?.message || '人设生成失败，请检查 API 配置。'
      throw error
    } finally { isWorking.value = false; controller = null }
  }

  const refine = async (instruction: string) => {
    if (!activeDraft.value || !instruction.trim()) return
    isWorking.value = true
    workLabel.value = '理解修改要求'
    controller = new AbortController()
    try {
      saveDraft(activeDraft.value, 'AI 修改前')
      await refinePersona(activeDraft.value, instruction.trim(), controller.signal)
      saveDraft(activeDraft.value, 'AI 共创修改')
      successMessage.value = '修改已应用，锁定字段保持不变。'
    } catch (error: any) {
      errorMessage.value = error?.message || '修改失败，请稍后重试。'
      throw error
    } finally { isWorking.value = false; controller = null }
  }

  const inspect = async () => {
    if (!activeDraft.value) return
    isWorking.value = true
    workLabel.value = '检查可能的误读风险'
    controller = new AbortController()
    try {
      activeDraft.value.healthReport = await inspectPersona(activeDraft.value, controller.signal)
      saveDraft(activeDraft.value, '人设体检')
    } finally { isWorking.value = false; controller = null }
  }

  const simulate = async () => {
    if (!activeDraft.value) return
    isWorking.value = true
    workLabel.value = '模拟角色如何理解你'
    controller = new AbortController()
    try {
      activeDraft.value.understandingSamples = await simulatePersonaUnderstanding(activeDraft.value, controller.signal)
      saveDraft(activeDraft.value, '理解试演')
    } finally { isWorking.value = false; controller = null }
  }

  const restoreVersion = (versionId: string) => {
    if (!activeDraft.value) return
    const version = activeDraft.value.versions.find(item => item.id === versionId)
    if (!version) return
    const restored: PersonaDraft = { ...JSON.parse(JSON.stringify(version.snapshot)), versions: activeDraft.value.versions }
    activeDraft.value = restored
    saveDraft(restored, '恢复历史版本')
  }

  const importPersona = (persona: UserPersonaRecord) => {
    const draft = createEmptyPersonaDraft('prompt', 'self')
    draft.name = persona.name || ''
    draft.networkName = persona.networkName || ''
    draft.sourcePrompt = persona.signature || ''
    draft.core = persona.signature || ''
    draft.publishedPersonaId = persona.id
    draft.status = 'ready'
    saveDraft(draft, '从人设库导入')
    return draft
  }

  const publish = async (options: { bindAccount: boolean; targetChatIds: Array<string | number> }) => {
    const draft = activeDraft.value
    if (!draft?.name.trim() || !draft.core.trim()) throw new Error('请至少填写称呼和稳定人格。')
    const personaText = compilePersona(draft)
    const storageKey = getPersonaStorageKey()
    let personas: UserPersonaRecord[] = []
    try { personas = JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { personas = [] }
    let index = draft.publishedPersonaId ? personas.findIndex(item => item.id === draft.publishedPersonaId) : -1
    const personaId = index >= 0 ? personas[index].id : Date.now()
    const previous = index >= 0 ? personas[index] : null
    const currentAccountId = useChatAuth().currentChatUserId.value || undefined
    const record: UserPersonaRecord = {
      ...(previous || {}), id: personaId, name: draft.name.trim(), networkName: draft.networkName.trim(), signature: personaText,
      customText: previous?.customText || draft.tagline || '', avatar: previous?.avatar || '', isCreate: false,
      boundAccountId: options.bindAccount && currentAccountId ? currentAccountId : undefined
    }
    if (options.bindAccount) personas.forEach(item => { if (item.boundAccountId === useChatAuth().currentChatUserId.value) item.boundAccountId = undefined })
    if (index >= 0) personas[index] = record
    else personas.push(record)
    localStorage.setItem(storageKey, JSON.stringify(personas))

    const snapshot = { name: record.name, remark: record.customText || '', persona: record.signature, avatarUrl: record.avatar || '' }
    if (options.bindAccount && currentAccountId) {
      const account = useChatAuth().currentAccount.value
      useChatAuth().updateAccount(currentAccountId, { name: record.networkName || account?.name || '', realName: record.name, persona: record.signature, avatarUrl: record.avatar || '' })
    }

    const targetIds = new Set(options.targetChatIds.map(String))
    if (targetIds.size) {
      const accountId = useChatAuth().currentChatUserId.value
      const contactsKey = accountId ? `clingy_custom_contacts_${accountId}` : 'clingy_custom_contacts'
      let contacts: any[] = []
      try { contacts = JSON.parse(localStorage.getItem(contactsKey) || '[]') } catch { contacts = [] }
      for (const chat of mockChats.value.filter(item => targetIds.has(String(item.id)) && item.id !== 1)) {
        applyUserProfileToChat(chat, snapshot, { type: 'library', personaId, name: record.name })
        if (chat.chatType === 'group') saveGroupChat(accountId, chat)
        else {
          const contactIndex = contacts.findIndex(item => String(item.id) === String(chat.id))
          if (contactIndex >= 0) {
            contacts[contactIndex].userProfile = { ...snapshot }
            contacts[contactIndex].userProfileSource = { type: 'library', personaId, name: record.name, hasLocalChanges: false }
          }
        }
      }
      localStorage.setItem(contactsKey, JSON.stringify(contacts))
      await loadCustomContacts()
    }

    draft.publishedPersonaId = personaId
    draft.status = 'published'
    saveDraft(draft, index >= 0 ? '更新人设库' : '发布到人设库')
    successMessage.value = options.bindAccount || targetIds.size ? '已保存到人设库，并应用所选设置。' : '已保存到人设库。'
    return personaId
  }

  return { drafts, recentDrafts, activeDraft, isWorking, workLabel, generationStage, errorMessage, successMessage, saveDraft, createDraft, openDraft, deleteDraft, stop, generate, refine, inspect, simulate, restoreVersion, importPersona, publish, loadUserPersonas }
}
