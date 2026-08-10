/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed, ref } from 'vue'
import { useChatAuth } from './useChatAuth'
import { loadCustomContacts } from './chatState/contacts'
import { worldBooks } from '../store'
import { compileCharacterPersona, generateCharacterByStages, refineCharacter } from '../services/characterGenerator'
import { planWorldBookEntries } from '../services/characterWorkshopFeatures'
import { createEmptyCharacterDraft, normalizeCharacterDraft, type CharacterDraft, type CharacterGenerationInput } from '../types/characterWorkshop'

const STORAGE_KEY = 'clingy_character_workshop_v1'
const drafts = ref<CharacterDraft[]>([])
let loaded = false

const cloneWithoutVersions = (draft: CharacterDraft): Omit<CharacterDraft, 'versions'> => {
  const copy = JSON.parse(JSON.stringify(draft))
  delete copy.versions
  return copy
}

const load = () => {
  if (loaded) return
  loaded = true
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    drafts.value = Array.isArray(parsed) ? parsed.map(normalizeCharacterDraft) : []
  } catch { drafts.value = [] }
}

const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.value))

export function useCharacterWorkshop() {
  load()
  const activeDraft = ref<CharacterDraft | null>(null)
  const isGenerating = ref(false)
  const generationStage = ref(0)
  const generationLabel = ref('')
  const errorMessage = ref('')
  const successMessage = ref('')

  const recentDrafts = computed(() => [...drafts.value].sort((a, b) => b.updatedAt - a.updatedAt))
  const publishedDrafts = computed(() => recentDrafts.value.filter(item => item.status === 'published'))

  const saveDraft = (draft: CharacterDraft, versionLabel = '') => {
    draft.updatedAt = Date.now()
    if (versionLabel) {
      draft.versions ||= []
      draft.versions.unshift({
        id: `version_${Date.now()}`,
        createdAt: Date.now(),
        label: versionLabel,
        snapshot: cloneWithoutVersions(draft)
      })
      draft.versions = draft.versions.slice(0, 20)
    }
    const index = drafts.value.findIndex(item => item.id === draft.id)
    if (index >= 0) drafts.value[index] = JSON.parse(JSON.stringify(draft))
    else drafts.value.unshift(JSON.parse(JSON.stringify(draft)))
    activeDraft.value = draft
    persist()
  }

  const createDraft = (mode: CharacterGenerationInput['mode']) => {
    const draft = createEmptyCharacterDraft(mode)
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

  const generate = async (input: CharacterGenerationInput) => {
    errorMessage.value = ''
    successMessage.value = ''
    const draft = activeDraft.value || createDraft(input.mode)
    draft.mode = input.mode
    if (input.mode === 'guided') {
      const guidedFields: Array<[keyof CharacterDraft, string]> = [
        ['name', input.guided.name], ['age', input.guided.age], ['identity', input.guided.identity],
        ['relationship', input.guided.relationship], ['core', input.guided.personality], ['boundaries', input.guided.boundaries]
      ]
      for (const [key, value] of guidedFields) {
        if (!value.trim()) continue
        ;(draft as any)[key] = value.trim()
        if (!draft.lockedFields.includes(key)) draft.lockedFields.push(key)
      }
    }
    isGenerating.value = true
    generationStage.value = 0
    try {
      await generateCharacterByStages(draft, input, (stage, label) => {
        generationStage.value = stage
        generationLabel.value = label
        saveDraft(draft)
      })
      saveDraft(draft, 'AI 生成完成')
      successMessage.value = '角色档案已完成，可以继续手写调整或进行试演。'
    } catch (error: any) {
      saveDraft(draft)
      errorMessage.value = error?.message || '角色生成失败，请检查 API 配置后重试。'
      throw error
    } finally {
      isGenerating.value = false
    }
  }

  const refine = async (instruction: string) => {
    if (!activeDraft.value || !instruction.trim()) return
    errorMessage.value = ''
    isGenerating.value = true
    generationLabel.value = '理解修改要求'
    try {
      saveDraft(activeDraft.value, 'AI 修改前')
      await refineCharacter(activeDraft.value, instruction.trim())
      saveDraft(activeDraft.value, 'AI 共创修改')
      successMessage.value = '修改已应用，锁定字段保持不变。'
    } catch (error: any) {
      errorMessage.value = error?.message || '修改失败，请稍后重试。'
      throw error
    } finally { isGenerating.value = false }
  }

  const restoreVersion = (versionId: string) => {
    if (!activeDraft.value) return
    const version = activeDraft.value.versions.find(item => item.id === versionId)
    if (!version) return
    const versions = activeDraft.value.versions
    const restored = { ...JSON.parse(JSON.stringify(version.snapshot)), versions } as CharacterDraft
    activeDraft.value = restored
    saveDraft(restored, '恢复历史版本')
  }

  const publish = async (options: { createWorldBook: boolean; autoSplitWorldBook?: boolean }) => {
    const draft = activeDraft.value
    if (!draft?.name.trim() || !draft.core.trim()) throw new Error('请至少填写角色姓名和人格内核。')
    const { currentChatUserId } = useChatAuth()
    const contactId = draft.publishedContactId || `contact_${Date.now()}`
    const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
    let contacts: any[] = []
    try { contacts = JSON.parse(localStorage.getItem(contactsKey) || '[]') } catch { contacts = [] }
    const existing = contacts.findIndex(item => item.id === contactId)
    const boundWorldBooks: string[] = existing >= 0 ? (contacts[existing].boundWorldBooks || []) : []
    if (options.createWorldBook && draft.world.trim()) {
      const worldBookId = `character_world_${draft.id}`
      const worldIndex = worldBooks.findIndex(book => book.id === worldBookId)
      let plannedEntries: Array<{ id: string; title: string; content: string; keywords: string; weight: number }> = []
      if (options.autoSplitWorldBook) {
        try { plannedEntries = await planWorldBookEntries(draft) } catch { plannedEntries = [] }
      }
      const sourceEntries = plannedEntries.length ? plannedEntries : [{ id: `${worldBookId}_entry`, title: '背景设定', content: draft.world, keywords: draft.keywords.join(','), weight: 5 }]
      const worldBook = {
        id: worldBookId, type: 'book' as const, groupIds: [], title: `${draft.name} · 世界设定`, author: '角色工坊', tags: ['角色工坊'],
        rating: 0, coverColor: '#e8e4de', coverImage: '', enabled: true, globalPosition: 'middle' as const, globalDepth: 0,
        globalWeight: 1, updatedAt: Date.now(), entries: sourceEntries.map(entry => ({ id: entry.id, title: entry.title, content: entry.content,
          updatedAt: Date.now(), enabled: true, light: 'blue' as const, keywords: entry.keywords, overrideSettings: false,
          position: 'middle' as const, depth: 0, weight: entry.weight }))
      }
      if (worldIndex >= 0) worldBooks[worldIndex] = worldBook
      else worldBooks.unshift(worldBook)
      if (!boundWorldBooks.includes(worldBookId)) boundWorldBooks.push(worldBookId)
    }
    const contact = {
      ...(existing >= 0 ? contacts[existing] : {}), id: contactId, name: draft.name.trim(), remark: '',
      persona: compileCharacterPersona(draft), avatarKey: '', isPinned: false, groups: [], boundWorldBooks,
      characterSourceId: draft.id, characterSourceVersion: draft.versions[0]?.id || '', characterOpeningLine: draft.openingLine,
      messages: existing >= 0 ? (contacts[existing].messages || []) : (draft.openingLine.trim() ? [{ id: Date.now(), type: 'left', content: draft.openingLine.trim() }] : [])
    }
    if (existing >= 0) contacts[existing] = contact
    else contacts.push(contact)
    localStorage.setItem(contactsKey, JSON.stringify(contacts))
    draft.publishedContactId = contactId
    draft.status = 'published'
    saveDraft(draft, existing >= 0 ? '同步到聊天' : '首次发布')
    await loadCustomContacts()
    successMessage.value = existing >= 0 ? '聊天角色已同步到最新版本。' : '角色已加入聊天列表。'
    return contactId
  }

  return { drafts, recentDrafts, publishedDrafts, activeDraft, isGenerating, generationStage, generationLabel,
    errorMessage, successMessage, createDraft, openDraft, deleteDraft, saveDraft, generate, refine, restoreVersion, publish }
}
