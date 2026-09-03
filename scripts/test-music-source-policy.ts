/* WARNING: 本项目专属“粘人精”，严禁出现违规英文或拼音命名！ */
import assert from 'node:assert/strict'
import type { MusicHomeSection, MusicSourceConfig } from '../src/types/music'
import { filterMusicHomeSectionsByEnabledSources, isPublicMusicDiscoveryEnabled, restoreMusicSourceConfigs } from '../src/services/musicProviders'
import { MUSIC_PRIVACY_VERSION, normalizeMusicPrivacyPreferences } from '../src/services/musicPrivacy'

const source = (id: string, enabled: boolean, kind: MusicSourceConfig['kind'] = 'netease'): MusicSourceConfig => ({
  id, name: id, enabled, kind, apiBase: kind === 'local' || kind === 'embed' ? undefined : `https://${id}.example`, capabilities: []
})

const defaults = [source('local', true, 'local'), source('public-meting', true, 'meting'), source('new-source', true)]
const restored = restoreMusicSourceConfigs(defaults, [source('local', false, 'local'), source('public-meting', false, 'meting')])
assert.equal(restored.find(item => item.id === 'local')?.enabled, false, '本地来源的关闭状态也必须保留')
assert.equal(restored.find(item => item.id === 'public-meting')?.enabled, false, '刷新后不能复活用户关闭的公共来源')
assert.equal(restored.find(item => item.id === 'new-source')?.enabled, false, '已有状态中的新增在线来源必须默认关闭')

assert.equal(isPublicMusicDiscoveryEnabled(restored, true), false, '匿名权限不能绕过来源开关')
assert.equal(isPublicMusicDiscoveryEnabled(defaults, false), false, '来源开关不能绕过匿名权限')
assert.equal(isPublicMusicDiscoveryEnabled(defaults, true), true)

const migratedPrivacy = normalizeMusicPrivacyPreferences({ version: 1, noticeAcknowledged: true, allowAnonymousPublicSources: false, updatedAt: 1 })
assert.equal(migratedPrivacy.version, MUSIC_PRIVACY_VERSION)
assert.equal(migratedPrivacy.allowAnonymousPublicSources, false, '升级隐私版本时必须保留用户的关闭选择')

const sections: MusicHomeSection[] = [
  { id: 'public', title: '公共推荐', type: 'playlists', playlists: [{ id: '1', sourceId: 'public-meting', name: '公共歌单', trackCount: 1, playCount: 1 }] },
  { id: 'other', title: '其他推荐', type: 'playlists', playlists: [{ id: '2', sourceId: 'new-source', name: '其他歌单', trackCount: 1, playCount: 1 }] }
]
assert.deepEqual(filterMusicHomeSectionsByEnabledSources(sections, restored), [], '缓存不能显示已关闭来源的推荐')
assert.deepEqual(filterMusicHomeSectionsByEnabledSources(sections, defaults).map(item => item.id), ['public', 'other'])

console.log('Music source policy tests passed')
