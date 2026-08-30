/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import assert from 'node:assert/strict'
import { createMusicProviders, defaultMusicSourceConfigs } from '../src/services/musicProviders'
import { isTrialMusicDuration, parseMp3Duration, verifiedEmbedTrack } from '../src/services/musicPlaybackValidation'

const mp3Header = (frames: number) => {
  const bytes = new Uint8Array(64)
  bytes.set([0xff, 0xfb, 0x90, 0x00], 0)
  bytes.set(new TextEncoder().encode('Info'), 36)
  bytes.set([0, 0, 0, 1], 40)
  bytes.set([(frames >>> 24) & 255, (frames >>> 16) & 255, (frames >>> 8) & 255, frames & 255], 44)
  return bytes
}

const trialDuration = parseMp3Duration(mp3Header(1150))
assert.ok(trialDuration > 30 && trialDuration < 30.1)
assert.equal(isTrialMusicDuration(trialDuration), true)

const fullDuration = parseMp3Duration(mp3Header(8000))
assert.ok(fullDuration > 200)
assert.equal(isTrialMusicDuration(fullDuration), false)

const officialConfig = defaultMusicSourceConfigs().find(item => item.id === 'official-video')
assert.ok(officialConfig?.enabled)
assert.equal(officialConfig?.apiBase, undefined)

const officialProvider = createMusicProviders(defaultMusicSourceConfigs()).find(item => item.id === 'official-video')
assert.ok(officialProvider)
const officialResults = await officialProvider.search('讨厌红楼梦')
assert.ok(officialResults.tracks.length >= 2)
assert.ok(officialResults.tracks.every(verifiedEmbedTrack))
assert.ok(officialResults.tracks.some(track => track.embedId === 'cOy2rdGe8LE' && track.duration > 200))

const publicProvider = createMusicProviders(defaultMusicSourceConfigs()).find(item => item.id === 'public-video')
assert.ok(publicProvider)
const publicResults = await publicProvider.search('讨厌红楼梦')
assert.equal(publicResults.tracks[0]?.embedProvider, 'bilibili')
assert.equal(publicResults.tracks[0]?.duration, 239)

console.log('Music playback validation tests passed')
