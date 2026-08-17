/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { MusicLyricLine } from '../types/music'

const timePattern = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

export const parseMusicLyrics = (raw: string, translationRaw = ''): MusicLyricLine[] => {
  const translations = new Map<number, string>()
  const parse = (text: string, target: MusicLyricLine[] | null) => {
    for (const row of text.replace(/\r/g, '').split('\n')) {
      const value = row.replace(timePattern, '').trim()
      if (!value) continue
      const stamps = [...row.matchAll(timePattern)]
      for (const stamp of stamps) {
        const fraction = (stamp[3] || '0').padEnd(3, '0').slice(0, 3)
        const time = Number(stamp[1]) * 60 + Number(stamp[2]) + Number(fraction) / 1000
        if (target) target.push({ time, text: value })
        else translations.set(Math.round(time * 100), value)
      }
    }
  }
  parse(translationRaw, null)
  const result: MusicLyricLine[] = []
  parse(raw, result)
  result.sort((a, b) => a.time - b.time)
  return result.map((line, index) => ({
    ...line,
    translation: translations.get(Math.round(line.time * 100)),
    endTime: result[index + 1]?.time
  }))
}

export const serializeMusicLyrics = (lines: MusicLyricLine[]) => lines.map(line => {
  const minutes = Math.floor(line.time / 60).toString().padStart(2, '0')
  const seconds = Math.floor(line.time % 60).toString().padStart(2, '0')
  const hundredths = Math.floor((line.time % 1) * 100).toString().padStart(2, '0')
  return `[${minutes}:${seconds}.${hundredths}]${line.text}`
}).join('\n')
