/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export interface LocalMusicMetadata { title?: string; artist?: string; album?: string }

const decodeTextFrame = (bytes: Uint8Array) => {
  if (!bytes.length) return ''
  const encoding = bytes[0]
  const body = bytes.slice(1)
  try {
    if (encoding === 1 || encoding === 2) {
      const littleEndian = body[0] === 0xff && body[1] === 0xfe
      const content = body[0] === 0xff || body[0] === 0xfe ? body.slice(2) : body
      return new TextDecoder(littleEndian ? 'utf-16le' : 'utf-16be').decode(content).replace(/\0/g, '').trim()
    }
    return new TextDecoder(encoding === 0 ? 'windows-1252' : 'utf-8').decode(body).replace(/\0/g, '').trim()
  } catch { return '' }
}

const syncSafe = (bytes: Uint8Array) => ((bytes[0] & 0x7f) << 21) | ((bytes[1] & 0x7f) << 14) | ((bytes[2] & 0x7f) << 7) | (bytes[3] & 0x7f)

export const readLocalMusicMetadata = async (file: File): Promise<LocalMusicMetadata> => {
  if (!/\.mp3$/i.test(file.name)) return {}
  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer())
  if (String.fromCharCode(...bytes.slice(0, 3)) !== 'ID3') return {}
  const version = bytes[3]
  const tagEnd = Math.min(bytes.length, 10 + syncSafe(bytes.slice(6, 10)))
  const result: LocalMusicMetadata = {}
  let offset = 10
  while (offset + 10 <= tagEnd) {
    const id = new TextDecoder('ascii').decode(bytes.slice(offset, offset + 4))
    if (!/^T[A-Z0-9]{3}$/.test(id)) break
    const size = version === 4 ? syncSafe(bytes.slice(offset + 4, offset + 8)) : new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0)
    if (!size || offset + 10 + size > tagEnd) break
    const value = decodeTextFrame(bytes.slice(offset + 10, offset + 10 + size))
    if (id === 'TIT2') result.title = value
    if (id === 'TPE1') result.artist = value
    if (id === 'TALB') result.album = value
    offset += 10 + size
  }
  return result
}
