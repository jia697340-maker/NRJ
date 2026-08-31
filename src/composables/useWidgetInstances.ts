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
export interface FolderWidgetConfig {
  imageSourceType: 'local' | 'url' | null
  imageValue: string | null
  cachedImageValue: string | null
  objectFit: 'cover' | 'contain'
  objectPosition: string
  borderRadius: number
  heartPink: boolean
}
export interface DualFrameWidgetConfig {
  title: string
  leftImage: string | null
  rightImage: string | null
  leftCachedImage: string | null
  rightCachedImage: string | null
  buttonText: string
  borderRadius: number
}
export interface CircleAvatarWidgetConfig {
  avatarImage: string | null
  cachedAvatarImage: string | null
  title: string
  subtitle: string
}
export interface RectangleImageWidgetConfig {
  imageSourceType: 'local' | 'url' | null
  imageValue: string | null
  cachedImageValue: string | null
  objectFit: 'cover' | 'contain'
  objectPosition: string
  borderRadius: number
}
export interface ProfileCardWidgetConfig {
  coverImage: string | null
  cachedCoverImage: string | null
  avatarImage: string | null
  cachedAvatarImage: string | null
  name: string
  handle: string
  bio: string
  location: string
}
export interface AboutUsWidgetConfig {
  avatarImage: string | null
  cachedAvatarImage: string | null
  cardImage: string | null
  cachedCardImage: string | null
  title: string
  tag1: string
  tag2: string
  slogan: string
}
export type WidgetConfig = DualAvatarWidgetConfig | MomentCardWidgetConfig | CustomImageWidgetConfig | FolderWidgetConfig | DualFrameWidgetConfig | CircleAvatarWidgetConfig | RectangleImageWidgetConfig | ProfileCardWidgetConfig | AboutUsWidgetConfig
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
  if (widgetType === 'folder-widget') {
    return { imageSourceType: null, imageValue: null, cachedImageValue: null, objectFit: 'cover', objectPosition: '50% 50%', borderRadius: 16, heartPink: false }
  }
  if (widgetType === 'dual-frame') {
    return { title: '선택해 주십시오.', leftImage: null, rightImage: null, leftCachedImage: null, rightCachedImage: null, buttonText: '사용', borderRadius: 14 }
  }
  if (widgetType === 'circle-avatar-widget') {
    return { avatarImage: null, cachedAvatarImage: null, title: '主文案占位', subtitle: '胶囊占位' }
  }
  if (widgetType === 'rectangle-image') {
    return { imageSourceType: null, imageValue: null, cachedImageValue: null, objectFit: 'cover', objectPosition: '50% 50%', borderRadius: 16 }
  }
  if (widgetType === 'profile-card-widget') {
    return { coverImage: null, cachedCoverImage: null, avatarImage: null, cachedAvatarImage: null, name: '名片昵称', handle: '@用户名或状态', bio: '点击编辑个性签名', location: '城市' }
  }
  if (widgetType === 'about-us-widget') {
    return { avatarImage: null, cachedAvatarImage: null, cardImage: null, cachedCardImage: null, title: '标题占位', tag1: '#标签一', tag2: '#标签二', slogan: '☆⁺底部签名占位文案⁺☆' }
  }
  return { imageSourceType: null, imageValue: null, cachedImageValue: null, objectFit: 'cover', objectPosition: '50% 50%', borderRadius: 22 }
}

const normalizeRecord = (value: unknown): WidgetInstanceRecord | null => {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<WidgetInstanceRecord>
  if (typeof record.id !== 'string' || !['dual-avatar', 'moment-card', 'custom-image', 'folder-widget', 'dual-frame', 'circle-avatar-widget', 'rectangle-image', 'profile-card-widget', 'about-us-widget'].includes(String(record.widgetType))) return null
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
