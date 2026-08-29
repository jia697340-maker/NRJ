/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import type { CharacterAssetGroupVisibility, CharacterAssetKind, CharacterAssetMeta, CharacterAssetSource } from '../types/chatAssets'

export const characterFileBlobStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatFileBlobs' })
export const characterVideoBlobStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatVideoBlobs' })

interface StoredCharacterAssetBlob {
  blob: Blob
  ownerCharacterId: string
  contentHash: string
}

const safeName = (value: string, fallback: string) => {
  const cleaned = String(value || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim()
  return (cleaned || fallback).slice(0, 180)
}

const bytesToHex = (bytes: Uint8Array) => Array.from(bytes).map(value => value.toString(16).padStart(2, '0')).join('')

export const hashBlob = async (blob: Blob) => {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return bytesToHex(new Uint8Array(digest))
}

export const normalizeCharacterAssets = (raw: unknown, ownerCharacterId: string): CharacterAssetMeta[] => {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item: any) => {
    const kind = item?.kind === 'video' ? 'video' : item?.kind === 'file' ? 'file' : null
    if (!kind || !item?.id || String(item.ownerCharacterId || ownerCharacterId) !== ownerCharacterId) return []
    return [{
      id: String(item.id), ownerCharacterId, kind,
      source: item.source === 'generated' ? 'generated' : 'configured',
      name: safeName(item.name, kind === 'video' ? '视频.mp4' : '文件'),
      mimeType: String(item.mimeType || (kind === 'video' ? 'video/mp4' : 'application/octet-stream')),
      size: Math.max(0, Number(item.size || 0)), summary: String(item.summary || '').slice(0, 500),
      tags: Array.isArray(item.tags) ? item.tags.map(String).filter(Boolean).slice(0, 20) : [],
      contentHash: String(item.contentHash || ''), groupVisibility: item.groupVisibility === 'private_only' ? 'private_only' : 'allowed',
      createdAt: Number(item.createdAt || Date.now()), updatedAt: Number(item.updatedAt || item.createdAt || Date.now()),
      duration: item.duration == null ? undefined : Number(item.duration), width: item.width == null ? undefined : Number(item.width), height: item.height == null ? undefined : Number(item.height)
    } satisfies CharacterAssetMeta]
  })
}

export const saveCharacterAsset = async (input: {
  ownerCharacterId: string
  kind: CharacterAssetKind
  source: CharacterAssetSource
  blob: Blob
  name: string
  summary?: string
  tags?: string[]
  groupVisibility?: CharacterAssetGroupVisibility
  duration?: number
  width?: number
  height?: number
}): Promise<CharacterAssetMeta> => {
  if (!(input.blob instanceof Blob) || input.blob.size <= 0) throw new Error('资源内容为空，未保存')
  const contentHash = await hashBlob(input.blob)
  const id = `${input.kind}_${Date.now()}_${contentHash.slice(0, 12)}`
  const store = input.kind === 'video' ? characterVideoBlobStore : characterFileBlobStore
  await store.setItem(id, { blob: input.blob, ownerCharacterId: String(input.ownerCharacterId), contentHash } satisfies StoredCharacterAssetBlob)
  const storedValue = await store.getItem<StoredCharacterAssetBlob>(id)
  const stored = storedValue?.blob
  if (!storedValue || !(stored instanceof Blob) || storedValue.ownerCharacterId !== String(input.ownerCharacterId) || stored.size !== input.blob.size || await hashBlob(stored) !== contentHash) {
    await store.removeItem(id).catch(() => undefined)
    throw new Error('资源写入后校验失败，未创建消息')
  }
  const now = Date.now()
  return {
    id, ownerCharacterId: String(input.ownerCharacterId), kind: input.kind, source: input.source,
    name: safeName(input.name, input.kind === 'video' ? '视频.mp4' : '文件'),
    mimeType: input.blob.type || (input.kind === 'video' ? 'video/mp4' : 'application/octet-stream'),
    size: input.blob.size, summary: String(input.summary || '').slice(0, 500), tags: (input.tags || []).map(String).filter(Boolean).slice(0, 20),
    contentHash, groupVisibility: input.groupVisibility || 'allowed', createdAt: now, updatedAt: now,
    duration: input.duration, width: input.width, height: input.height
  }
}

export const getCharacterAssetBlob = async (asset: Pick<CharacterAssetMeta, 'id' | 'kind' | 'size' | 'contentHash'> & Partial<Pick<CharacterAssetMeta, 'ownerCharacterId'>>) => {
  const store = asset.kind === 'video' ? characterVideoBlobStore : characterFileBlobStore
  const stored = await store.getItem<Blob | StoredCharacterAssetBlob>(asset.id)
  const blob = stored instanceof Blob ? stored : stored?.blob
  if (!(blob instanceof Blob) || blob.size <= 0) throw new Error('真实资源已丢失')
  if (stored && !(stored instanceof Blob) && asset.ownerCharacterId && stored.ownerCharacterId !== String(asset.ownerCharacterId)) throw new Error('资源不属于当前角色')
  if (asset.size && blob.size !== asset.size) throw new Error('资源大小校验失败')
  if (stored && !(stored instanceof Blob) && asset.contentHash && stored.contentHash !== asset.contentHash) throw new Error('资源指纹校验失败')
  return blob
}

export const deleteCharacterAssetBlob = async (asset: Pick<CharacterAssetMeta, 'id' | 'kind'>) => {
  await (asset.kind === 'video' ? characterVideoBlobStore : characterFileBlobStore).removeItem(asset.id)
}

export const deleteCharacterAssetIfUnreferenced = async (asset: Pick<CharacterAssetMeta, 'id' | 'kind'>, accountId?: string | null) => {
  const containsReference = (value: unknown) => {
    try { return JSON.stringify(value).includes(`"assetId":"${asset.id}"`) } catch { return false }
  }
  const contactKey = accountId ? `clingy_custom_contacts_${accountId}` : 'clingy_custom_contacts'
  const groupKey = accountId ? `clingy_group_chats_${accountId}` : 'clingy_group_chats'
  if (containsReference(JSON.parse(localStorage.getItem(contactKey) || '[]')) || containsReference(JSON.parse(localStorage.getItem(groupKey) || '[]'))) return false
  const timelineStore = localforage.createInstance({ name: 'nrt-app', storeName: 'chatTimelines' })
  let referenced = false
  await timelineStore.iterate(value => { if (!referenced && containsReference(value)) referenced = true })
  if (referenced) return false
  await deleteCharacterAssetBlob(asset)
  return true
}

export const updateCharacterAssetMeta = (assets: CharacterAssetMeta[], assetId: string, patch: Partial<Pick<CharacterAssetMeta, 'summary' | 'tags' | 'groupVisibility' | 'name'>>) => (
  assets.map(asset => asset.id === assetId ? { ...asset, ...patch, name: patch.name ? safeName(patch.name, asset.name) : asset.name, updatedAt: Date.now() } : asset)
)

export const persistCharacterAssetMetadata = (accountId: string | null | undefined, chat: any) => {
  const key = accountId ? `clingy_custom_contacts_${accountId}` : 'clingy_custom_contacts'
  const raw = localStorage.getItem(key)
  if (!raw) return
  const contacts = JSON.parse(raw)
  const index = contacts.findIndex((item: any) => String(item.characterEntityId || item.id) === String(chat.characterEntityId || chat.id))
  if (index < 0) return
  contacts[index].characterAssets = JSON.parse(JSON.stringify(chat.characterAssets || []))
  localStorage.setItem(key, JSON.stringify(contacts))
}
