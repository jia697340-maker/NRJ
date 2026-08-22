/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { reactive, watch } from 'vue'
import { appearanceCategories, type AppearanceCategoryId } from '../appearanceRegistry'
import { readStoredJSON } from './utils'

export type AppearanceSelection = Record<AppearanceCategoryId, string>

export interface AppearancePreset {
  id: string
  name: string
  selections: AppearanceSelection
  createdAt: number
}

interface AppearanceState {
  version: 1
  globalSelections: AppearanceSelection
  accountSelections: Record<string, Partial<AppearanceSelection>>
  presets: AppearancePreset[]
}

const STORAGE_KEY = 'clingy_appearance_wardrobe_v1'
const defaults = Object.fromEntries(appearanceCategories.map(category => [category.id, category.styles[0].id])) as AppearanceSelection
const saved = readStoredJSON<Partial<AppearanceState>>(STORAGE_KEY, {})

const normalizeSelection = (candidate?: Partial<AppearanceSelection>): AppearanceSelection => {
  const result = { ...defaults }
  appearanceCategories.forEach(category => {
    const requested = candidate?.[category.id as keyof AppearanceSelection]
    if (requested && category.styles.some(style => style.id === requested)) {
      result[category.id] = requested
    }
  })
  return result
}

export const appearanceState = reactive<AppearanceState>({
  version: 1,
  globalSelections: normalizeSelection(saved.globalSelections),
  accountSelections: saved.accountSelections && typeof saved.accountSelections === 'object' ? saved.accountSelections : {},
  presets: Array.isArray(saved.presets) ? saved.presets.map(preset => ({ ...preset, selections: normalizeSelection(preset.selections) })) : []
})

watch(appearanceState, value => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true })

export const getAppearanceSelections = (accountId?: string | null): AppearanceSelection => ({
  ...appearanceState.globalSelections,
  ...(accountId ? appearanceState.accountSelections[accountId] : {})
})

export const getAppearanceStyleId = (categoryId: AppearanceCategoryId, accountId?: string | null) => (
  (accountId && appearanceState.accountSelections[accountId]?.[categoryId]) || appearanceState.globalSelections[categoryId] || defaults[categoryId]
)

export const applyAppearanceStyle = (categoryId: AppearanceCategoryId, styleId: string, accountIds: string[] | null) => {
  if (!accountIds) {
    appearanceState.globalSelections[categoryId] = styleId
    Object.values(appearanceState.accountSelections).forEach(selection => delete selection[categoryId])
    return
  }
  accountIds.forEach(accountId => {
    appearanceState.accountSelections[accountId] ||= {}
    appearanceState.accountSelections[accountId][categoryId] = styleId
  })
}

export const saveAppearancePreset = (name: string, accountId?: string | null) => {
  const preset: AppearancePreset = {
    id: `appearance_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    selections: getAppearanceSelections(accountId),
    createdAt: Date.now()
  }
  appearanceState.presets.unshift(preset)
  return preset
}

export const applyAppearancePreset = (preset: AppearancePreset, accountIds: string[] | null) => {
  appearanceCategories.forEach(category => applyAppearanceStyle(category.id, preset.selections[category.id], accountIds))
}

export const deleteAppearancePreset = (presetId: string) => {
  appearanceState.presets = appearanceState.presets.filter(preset => preset.id !== presetId)
}
