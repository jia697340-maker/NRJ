/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, readonly } from 'vue'
import localforage from 'localforage'
import { DEFAULT_WIDGET_IDS, type DesktopWidgetEntry, type WidgetType } from './useDesktopLayout'

export interface DualAvatarWidgetConfig {
  leftAvatar: string | null
  rightAvatar: string | null
  leftName: string
  rightName: string
  slogan: string
}
export interface MomentCardWidgetConfig {
  bgLeftUrl: string | null
  bgRightUrl: string | null
  avatarUrl: string | null
  username: string
  contentText: string
  bgMainType: 'default' | 'image' | 'color'
  bgMainUrl: string | null
  bgMainColor: string
  bgMainBlur: number
  progressPercent: number
}
export interface CustomImageWidgetConfig {
  imageSourceType: 'local' | 'url' | null
  imageValue: string | null
  cachedImageValue: string | null
  objectFit: 'cover' | 'contain'
  objectPosition: string
  borderRadius: number
}
export type WidgetConfig = DualAvatarWidgetConfig | MomentCardWidgetConfig | CustomImageWidgetConfig
export interface WidgetInstanceRecord { id: string; widgetType: WidgetType; config: WidgetConfig; updatedAt: number }

const instanceStore = localforage.createInstance({ name: 'nrt-app', storeName: 'widgetInstances' })
const legacyAvatarStore = localforage.createInstance({ name: 'nrt-app', storeName: 'avatars' })
const records = reactive<Record<string, WidgetInstanceRecord>>({})
let loaded = false
let loading: Promise<void> | null = null

export const defaultWidgetConfig = (widgetType: WidgetType): WidgetConfig => {
  if (widgetType === 'dual-avatar') return { leftAvatar: null, rightAvatar: null, leftName: '@UserA', rightName: '@UserB', slogan: 'Custom   Slogan' }
  if (widgetType === 'moment-card') return {
    bgLeftUrl: null, bgRightUrl: null, avatarUrl: null, username: 'My Moment', contentText: 'This is a custom moment description...',
    bgMainType: 'default', bgMainUrl: null, bgMainColor: '#ffffff', bgMainBlur: 0, progressPercent: 38
  }
  return { imageSourceType: null, imageValue: null, cachedImageValue: null, objectFit: 'cover', objectPosition: '50% 50%', borderRadius: 22 }
}

const normalizeRecord = (value: unknown): WidgetInstanceRecord | null => {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<WidgetInstanceRecord>
  if (typeof record.id !== 'string' || !['dual-avatar', 'moment-card', 'custom-image'].includes(String(record.widgetType))) return null
  return { id: record.id, widgetType: record.widgetType as WidgetType, config: { ...defaultWidgetConfig(record.widgetType as WidgetType), ...(record.config as object ?? {}) } as WidgetConfig, updatedAt: Number(record.updatedAt) || Date.now() }
}
const load = async () => {
  if (loaded) return
  if (loading) return loading
  loading = (async () => {
    await instanceStore.iterate((value) => { const record = normalizeRecord(value); if (record) records[record.id] = record })
    loaded = true
  })().catch(error => { console.warn('小组件实例数据读取失败', error) }).finally(() => { loading = null })
  return loading
}
const persist = async (record: WidgetInstanceRecord) => {
  records[record.id] = record
  try { await instanceStore.setItem(record.id, JSON.parse(JSON.stringify(record))) } catch (error) { console.warn('小组件实例数据保存失败', error) }
}
const migrateLegacyConfig = async (entry: DesktopWidgetEntry) => {
  if (entry.id === DEFAULT_WIDGET_IDS.dualAvatar && entry.widgetType === 'dual-avatar') {
    const [leftAvatar, rightAvatar, leftName, rightName, slogan] = await Promise.all([
      legacyAvatarStore.getItem<string>('avatar-left'), legacyAvatarStore.getItem<string>('avatar-right'),
      legacyAvatarStore.getItem<string>('text-leftName'), legacyAvatarStore.getItem<string>('text-rightName'), legacyAvatarStore.getItem<string>('text-slogan')
    ])
    return { ...(defaultWidgetConfig('dual-avatar') as DualAvatarWidgetConfig), leftAvatar: leftAvatar ?? null, rightAvatar: rightAvatar ?? null, leftName: leftName || '@UserA', rightName: rightName || '@UserB', slogan: slogan || 'Custom   Slogan' }
  }
  if (entry.id === DEFAULT_WIDGET_IDS.moment && entry.widgetType === 'moment-card') {
    const legacy = await localforage.getItem<Partial<MomentCardWidgetConfig>>('momentCardData')
    return { ...(defaultWidgetConfig('moment-card') as MomentCardWidgetConfig), ...(legacy ?? {}) }
  }
  return defaultWidgetConfig(entry.widgetType)
}
const ensureInstance = async (entry: DesktopWidgetEntry) => {
  await load()
  if (records[entry.id]) return records[entry.id]
  const record: WidgetInstanceRecord = { id: entry.id, widgetType: entry.widgetType, config: await migrateLegacyConfig(entry), updatedAt: Date.now() }
  await persist(record)
  return record
}
const ensureInstances = async (entries: DesktopWidgetEntry[]) => { await load(); await Promise.all(entries.map(ensureInstance)) }
const updateConfig = async <T extends WidgetConfig>(id: string, patch: Partial<T>) => {
  await load()
  const current = records[id]
  if (!current) return false
  await persist({ ...current, config: { ...current.config, ...patch } as WidgetConfig, updatedAt: Date.now() })
  return true
}
const removeInstance = async (id: string) => {
  delete records[id]
  try { await instanceStore.removeItem(id) } catch (error) { console.warn('小组件实例数据清理失败', error) }
}

export const useWidgetInstances = () => ({ records: readonly(records), load, ensureInstance, ensureInstances, updateConfig, removeInstance })
