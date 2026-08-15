/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'

export type IdentityOwnerType = 'character' | 'user'
export type IdentityAssetKind = 'face' | 'full_body' | 'hair' | 'outfit' | 'style'
export type IdentityStrength = 'natural' | 'stable' | 'strong'

export interface IdentityAsset {
  id: string
  name: string
  kind: IdentityAssetKind
  dataUrl: string
  addedAt: number
  width?: number
  height?: number
  qualityNotes?: string[]
}

export interface IdentityLocks {
  face: boolean
  hair: boolean
  outfit: boolean
  style: boolean
}

export interface IdentityVersion {
  id: string
  name: string
  description: string
  negativePrompt: string
  immutableTraits: string
  assetIds: string[]
  locks: IdentityLocks
  createdAt: number
}

export interface IdentityProfile {
  id: string
  ownerType: IdentityOwnerType
  ownerId: string
  ownerName: string
  enabled: boolean
  strength: IdentityStrength
  activeVersionId: string
  companionProfileIds: string[]
  versions: IdentityVersion[]
  assets: IdentityAsset[]
  createdAt: number
  updatedAt: number
}

export interface ResolvedIdentityContext {
  profiles: IdentityProfile[]
  referenceImages: string[]
  prompt: string
  negativePrompt: string
  strength: IdentityStrength
  warnings: string[]
}

const store = localforage.createInstance({ name: 'nrt-app', storeName: 'identityProfiles' })
const profileKey = (ownerType: IdentityOwnerType, ownerId: string) => `${ownerType}:${ownerId}`
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

const defaultVersion = (): IdentityVersion => ({
  id: newId('identity_version'),
  name: '默认形象',
  description: '',
  negativePrompt: '',
  immutableTraits: '',
  assetIds: [],
  locks: { face: true, hair: true, outfit: false, style: false },
  createdAt: Date.now()
})

export const createIdentityProfile = (
  ownerType: IdentityOwnerType,
  ownerId: string,
  ownerName = ''
): IdentityProfile => {
  const version = defaultVersion()
  return {
    id: profileKey(ownerType, ownerId),
    ownerType,
    ownerId,
    ownerName,
    enabled: false,
    strength: 'stable',
    activeVersionId: version.id,
    companionProfileIds: [],
    versions: [version],
    assets: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

const normalizeProfile = (profile: IdentityProfile): IdentityProfile => {
  const versions = Array.isArray(profile.versions) && profile.versions.length ? profile.versions : [defaultVersion()]
  return {
    ...profile,
    enabled: profile.enabled === true,
    strength: ['natural', 'stable', 'strong'].includes(profile.strength) ? profile.strength : 'stable',
    companionProfileIds: Array.isArray(profile.companionProfileIds) ? profile.companionProfileIds : [],
    assets: Array.isArray(profile.assets) ? profile.assets : [],
    versions: versions.map(version => ({
      ...version,
      assetIds: Array.isArray(version.assetIds) ? version.assetIds : [],
      locks: version.locks
        ? { ...version.locks }
        : { face: true, hair: true, outfit: false, style: false }
    })),
    activeVersionId: versions.some(version => version.id === profile.activeVersionId) ? profile.activeVersionId : versions[0].id
  }
}

export const loadIdentityProfile = async (
  ownerType: IdentityOwnerType,
  ownerId: string,
  ownerName = ''
): Promise<IdentityProfile> => {
  const id = profileKey(ownerType, ownerId)
  const stored = await store.getItem<IdentityProfile>(id)
  return stored ? normalizeProfile(stored) : createIdentityProfile(ownerType, ownerId, ownerName)
}

export const saveIdentityProfile = async (profile: IdentityProfile) => {
  const normalized = normalizeProfile({ ...clone(profile), updatedAt: Date.now() })
  await store.setItem(normalized.id, normalized)
  return normalized
}

export const deleteIdentityProfile = async (ownerType: IdentityOwnerType, ownerId: string) => {
  await store.removeItem(profileKey(ownerType, ownerId))
}

export const listIdentityProfiles = async () => {
  const profiles: IdentityProfile[] = []
  await store.iterate<IdentityProfile, void>(value => { profiles.push(normalizeProfile(value)) })
  return profiles.sort((a, b) => b.updatedAt - a.updatedAt)
}

export const identityOwnerKey = profileKey

export const addIdentityVersion = (profile: IdentityProfile, name = '新形象') => {
  const version = defaultVersion()
  version.name = name
  profile.versions.push(version)
  profile.activeVersionId = version.id
  return version
}

export const removeIdentityVersion = (profile: IdentityProfile, versionId: string) => {
  if (profile.versions.length <= 1) return false
  profile.versions = profile.versions.filter(version => version.id !== versionId)
  if (profile.activeVersionId === versionId) profile.activeVersionId = profile.versions[0].id
  return true
}

export const inspectIdentityImage = (dataUrl: string): Promise<{ width: number; height: number; notes: string[] }> => new Promise(resolve => {
  const image = new Image()
  image.onload = () => {
    const notes: string[] = []
    const shortSide = Math.min(image.naturalWidth, image.naturalHeight)
    const ratio = Math.max(image.naturalWidth, image.naturalHeight) / Math.max(1, shortSide)
    if (shortSide < 384) notes.push('分辨率偏低，建议补充更清晰的参考图')
    if (ratio > 2.2) notes.push('画面较狭长，主体可能太小')
    resolve({ width: image.naturalWidth, height: image.naturalHeight, notes })
  }
  image.onerror = () => resolve({ width: 0, height: 0, notes: ['图片无法预览，请检查文件格式'] })
  image.src = dataUrl
})

export const addIdentityAsset = async (
  profile: IdentityProfile,
  dataUrl: string,
  kind: IdentityAssetKind = 'face',
  name = '形象参考'
) => {
  const normalizedDataUrl = /^data:image\//i.test(dataUrl) || /^(https?:|blob:)/i.test(dataUrl)
    ? dataUrl
    : `data:image/png;base64,${dataUrl}`
  const inspection = await inspectIdentityImage(normalizedDataUrl)
  const asset: IdentityAsset = {
    id: newId('identity_asset'),
    name,
    kind,
    dataUrl: normalizedDataUrl,
    addedAt: Date.now(),
    width: inspection.width,
    height: inspection.height,
    qualityNotes: inspection.notes
  }
  profile.assets.push(asset)
  const version = profile.versions.find(item => item.id === profile.activeVersionId) || profile.versions[0]
  if (!version.assetIds.includes(asset.id)) version.assetIds.push(asset.id)
  return asset
}

const lockLabels: Record<keyof IdentityLocks, string> = {
  face: '面容与身份特征',
  hair: '发型与发色',
  outfit: '服装与配饰',
  style: '画面风格'
}

const strengthText: Record<IdentityStrength, string> = {
  natural: '自然参考：保留创作自由，仅维持可辨认的身份特征。',
  stable: '稳定一致：优先保持角色身份、面容和已锁定特征一致。',
  strong: '强一致：严格复现参考形象与已锁定特征，不要改变身份。'
}

export const resolveIdentityContext = async (
  ownerType: IdentityOwnerType,
  ownerId: string,
  maxImages = 8
): Promise<ResolvedIdentityContext> => {
  const primary = await loadIdentityProfile(ownerType, ownerId)
  if (!primary.enabled) return { profiles: [], referenceImages: [], prompt: '', negativePrompt: '', strength: primary.strength, warnings: [] }
  const allProfiles = await listIdentityProfiles()
  const companionSet = new Set(primary.companionProfileIds)
  const profiles = [primary, ...allProfiles.filter(item => (companionSet.has(item.id) || item.companionProfileIds.includes(primary.id)) && item.enabled && item.id !== primary.id)]
  const promptParts: string[] = [strengthText[primary.strength]]
  const negativeParts: string[] = []
  const referenceImages: string[] = []
  const warnings: string[] = []

  profiles.forEach((profile, index) => {
    const version = profile.versions.find(item => item.id === profile.activeVersionId) || profile.versions[0]
    const selectedAssets = profile.assets.filter(asset => version.assetIds.includes(asset.id))
    const referenceStart = referenceImages.length + 1
    const enabledLocks = (Object.keys(version.locks) as Array<keyof IdentityLocks>)
      .filter(key => version.locks[key])
      .map(key => lockLabels[key])
      .join('、')
    promptParts.push(
      `人物${index + 1}“${profile.ownerName || profile.ownerId}”必须与其专属参考素材对应，不得与其他人物串脸。`,
      enabledLocks ? `需要固定：${enabledLocks}。` : '',
      version.description ? `形象设定：${version.description}` : '',
      version.immutableTraits ? `不可改变特征：${version.immutableTraits}` : ''
    )
    if (version.negativePrompt) negativeParts.push(version.negativePrompt)
    selectedAssets.forEach(asset => {
      if (referenceImages.length < maxImages) referenceImages.push(asset.dataUrl)
      if (asset.qualityNotes?.length) warnings.push(...asset.qualityNotes.map(note => `${profile.ownerName || '当前形象'}：${note}`))
    })
    const referenceEnd = referenceImages.length
    if (referenceEnd >= referenceStart) {
      promptParts.push(`人物${index + 1}对应参考素材第${referenceStart}${referenceEnd > referenceStart ? `～${referenceEnd}` : ''}张。`)
    }
    if (!selectedAssets.length) warnings.push(`${profile.ownerName || '当前形象'}尚未添加参考素材，将仅使用文字设定`)
  })

  return {
    profiles,
    referenceImages,
    prompt: promptParts.filter(Boolean).join('\n'),
    negativePrompt: negativeParts.filter(Boolean).join(', '),
    strength: primary.strength,
    warnings: Array.from(new Set(warnings))
  }
}

export const providerIdentityCapability = (provider: string) => {
  if (['gpt', 'gemini', 'flux', 'seedream'].includes(provider)) return { mode: 'image' as const, label: '支持参考素材' }
  if (provider === 'niji') return { mode: 'limited' as const, label: '使用文字设定；单图需可访问链接' }
  return { mode: 'prompt' as const, label: '使用固定特征词保持一致' }
}
