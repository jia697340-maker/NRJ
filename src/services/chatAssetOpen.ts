/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import type { CharacterAssetMeta } from '../types/chatAssets'
import { getCharacterAssetBlob } from './characterAssetRepository'

const blobToBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunk) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk))
  return btoa(binary)
}

export const downloadCharacterAsset = async (asset: CharacterAssetMeta) => {
  const blob = await getCharacterAssetBlob(asset)
  if (Capacitor.isNativePlatform()) {
    const path = `shared-chat-assets/${asset.id}-${asset.name}`
    await Filesystem.mkdir({ directory: Directory.Cache, path: 'shared-chat-assets', recursive: true }).catch(() => undefined)
    await Filesystem.writeFile({ directory: Directory.Cache, path, data: await blobToBase64(blob), recursive: true })
    const file = await Filesystem.getUri({ directory: Directory.Cache, path })
    await Share.share({ title: asset.name, files: [file.uri], dialogTitle: '打开、保存或分享' })
    return
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = asset.name; anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor); anchor.click(); anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export const createCharacterAssetObjectUrl = async (asset: CharacterAssetMeta) => URL.createObjectURL(await getCharacterAssetBlob(asset))
