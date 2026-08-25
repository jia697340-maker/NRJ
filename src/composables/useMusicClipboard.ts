/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import type { MusicTrack, MusicPlaylist } from '../types/music'

export interface ClipboardParseResult {
  type: 'netease-playlist' | 'netease-song' | 'text-list' | 'json' | 'm3u' | 'unknown'
  title: string
  description?: string
  rawId?: string
  tracks: Array<{
    title: string
    artist: string
    album?: string
    audioUrl?: string
    sourceTrackId?: string
  }>
  rawTextPreview: string
}

export function useMusicClipboard() {
  const isReading = ref(false)
  const parseResult = ref<ClipboardParseResult | null>(null)
  const parseError = ref('')

  /**
   * 纯端侧解析剪贴板或传入的文本
   * 严格保护隐私：只在内存中提取与音乐/歌单相关的特征信息，不记录或持久化任何多余剪贴板内容
   */
  const parseClipboardText = (text: string): ClipboardParseResult => {
    const trimmed = text.trim()
    if (!trimmed) {
      throw new Error('剪贴板中没有读取到有效文本内容')
    }

    // 预览文本安全脱敏（最多展示前 80 个字符，防止展示敏感长文本）
    const rawTextPreview = trimmed.length > 80 ? `${trimmed.slice(0, 80)}...` : trimmed

    // 1. 优先尝试识别网易云歌单分享链接或口令
    // 例如：https://music.163.com/playlist?id=12345678 或分享文案中含有 playlist?id= / playlist/123456
    const neteasePlaylistMatch = trimmed.match(/(?:music\.163\.com[^\s]*[?&]id=|playlist\?id=|playlist\/)(\d+)/i)
    if (neteasePlaylistMatch) {
      const playlistId = neteasePlaylistMatch[1]
      // 尝试提取文案中的歌单名称
      let playlistTitle = '网易云歌单'
      const titleMatch = trimmed.match(/分享[【「《](.+?)[】」》]的歌单|分享歌单[【「《](.+?)[】」》]|歌单[：:]([^\n]+)/i)
      if (titleMatch) {
        playlistTitle = (titleMatch[1] || titleMatch[2] || titleMatch[3] || '').trim() || playlistTitle
      }

      return {
        type: 'netease-playlist',
        title: playlistTitle,
        description: `识别到网易云歌单 ID: ${playlistId}`,
        rawId: playlistId,
        tracks: [],
        rawTextPreview
      }
    }

    // 2. 识别网易云单曲链接 /song?id=xxxx
    const neteaseSongMatch = trimmed.match(/(?:music\.163\.com[^\s]*[?&]id=|song\?id=|song\/)(\d+)/i)
    if (neteaseSongMatch) {
      const songId = neteaseSongMatch[1]
      let songTitle = '网易云单曲'
      let songArtist = '网络歌手'
      const songInfoMatch = trimmed.match(/分享[【「《](.+?)[】」》]的单曲|分享单曲[【「《](.+?)[】」》]/i)
      if (songInfoMatch) {
        const full = (songInfoMatch[1] || songInfoMatch[2] || '').trim()
        if (full.includes(' - ')) {
          const parts = full.split(' - ')
          songArtist = parts[0].trim()
          songTitle = parts.slice(1).join(' - ').trim()
        } else {
          songTitle = full || songTitle
        }
      }

      return {
        type: 'netease-song',
        title: songTitle,
        rawId: songId,
        tracks: [{
          title: songTitle,
          artist: songArtist,
          sourceTrackId: songId
        }],
        rawTextPreview
      }
    }

    // 3. 尝试解析 JSON 格式
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const json = JSON.parse(trimmed)
        if (json && typeof json === 'object') {
          // 歌单数组或曲库备份
          if (Array.isArray(json)) {
            const tracks = json.map((item: any) => ({
              title: item.title || item.name || '未知曲目',
              artist: item.artist || item.author || '未知歌手',
              album: item.album,
              audioUrl: item.audioUrl || item.url
            })).filter(item => item.title)

            if (tracks.length) {
              return {
                type: 'json',
                title: '导入的歌曲清单',
                description: `从 JSON 数据中识别出 ${tracks.length} 首歌曲`,
                tracks,
                rawTextPreview
              }
            }
          } else if (json.customPlaylists || json.playlistTracks) {
            return {
              type: 'json',
              title: '音乐曲库备份',
              description: '识别到完整的应用曲库备份 JSON',
              tracks: [],
              rawTextPreview
            }
          }
        }
      } catch {
        // 非合规 JSON，继续向下匹配文本列表
      }
    }

    // 4. 尝试解析 M3U / M3U8 格式
    if (trimmed.includes('#EXTM3U') || trimmed.includes('#EXTINF')) {
      const lines = trimmed.split(/\r?\n/)
      const tracks: Array<{ title: string; artist: string; audioUrl?: string }> = []
      let pendingTitle = ''
      for (const line of lines) {
        const l = line.trim()
        if (l.startsWith('#EXTINF:')) {
          pendingTitle = l.split(',').slice(1).join(',').trim()
        } else if (l && !l.startsWith('#') && /^https?:\/\//i.test(l)) {
          const parts = pendingTitle.includes(' - ') ? pendingTitle.split(' - ') : [pendingTitle || `曲目 ${tracks.length + 1}`]
          tracks.push({
            title: parts.length > 1 ? parts.slice(1).join(' - ').trim() : parts[0].trim(),
            artist: parts.length > 1 ? parts[0].trim() : '未知歌手',
            audioUrl: l
          })
          pendingTitle = ''
        }
      }
      if (tracks.length) {
        return {
          type: 'm3u',
          title: 'M3U 歌单',
          description: `解析到 ${tracks.length} 首网络曲目`,
          tracks,
          rawTextPreview
        }
      }
    }

    // 5. 纯文本逐行歌单列表解析（如 "1. 歌名 - 歌手" 或 "歌名 - 歌手" 或 "歌名 / 歌手"）
    const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length > 0) {
      const parsedTracks: Array<{ title: string; artist: string }> = []
      for (const line of lines) {
        // 去除行首序号 如 "1. ", "01 - ", "1、"
        const cleanLine = line.replace(/^\d+[\.\、\-\s]+/, '').trim()
        if (!cleanLine) continue

        // 支持 "歌名 - 歌手", "歌手 - 歌名", "歌名 / 歌手"
        if (cleanLine.includes(' - ')) {
          const parts = cleanLine.split(' - ')
          parsedTracks.push({
            title: parts[0].trim(),
            artist: parts.slice(1).join(' - ').trim()
          })
        } else if (cleanLine.includes(' / ')) {
          const parts = cleanLine.split(' / ')
          parsedTracks.push({
            title: parts[0].trim(),
            artist: parts.slice(1).join(' / ').trim()
          })
        } else if (cleanLine.includes('——')) {
          const parts = cleanLine.split('——')
          parsedTracks.push({
            title: parts[0].trim(),
            artist: parts.slice(1).join('——').trim()
          })
        } else if (cleanLine.length >= 2 && cleanLine.length <= 40) {
          // 单独一行只有歌名的情况
          parsedTracks.push({
            title: cleanLine,
            artist: '未知歌手'
          })
        }
      }

      if (parsedTracks.length > 0) {
        return {
          type: 'text-list',
          title: `文本识别歌单 (${parsedTracks.length}首)`,
          description: `从剪贴板文本中识别出 ${parsedTracks.length} 行歌曲信息`,
          tracks: parsedTracks,
          rawTextPreview
        }
      }
    }

    throw new Error('未能从内容中识别出有效的音乐链接、歌单或歌曲清单')
  }

  /**
   * 一键读取剪贴板并解析
   */
  const readAndParseClipboard = async (): Promise<ClipboardParseResult> => {
    isReading.value = true
    parseError.value = ''
    parseResult.value = null

    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error('当前浏览器环境不支持一键读取剪贴板，请手动粘贴识别')
      }

      const text = await navigator.clipboard.readText()
      if (!text || !text.trim()) {
        throw new Error('剪贴板为空，请先复制音乐链接或歌曲清单')
      }

      const result = parseClipboardText(text)
      parseResult.value = result
      return result
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : '剪贴板识别失败'
      parseError.value = msg
      throw err
    } finally {
      isReading.value = false
    }
  }

  /**
   * 手动输入或粘贴文本解析
   */
  const parseManualText = (text: string): ClipboardParseResult => {
    parseError.value = ''
    try {
      const result = parseClipboardText(text)
      parseResult.value = result
      return result
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : '文本解析失败'
      parseError.value = msg
      throw err
    }
  }

  const reset = () => {
    parseResult.value = null
    parseError.value = ''
    isReading.value = false
  }

  return {
    isReading,
    parseResult,
    parseError,
    readAndParseClipboard,
    parseManualText,
    reset
  }
}
