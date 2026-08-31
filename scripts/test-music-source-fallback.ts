import assert from 'node:assert/strict'
import {
  isMusicSourceCoolingDown,
  markMusicSourceFailure,
  markMusicSourceSuccess,
  orderMusicSourcesForCapability,
  resetMusicSourceFallbackHealth
} from '../src/services/musicSourceFallback'

const sources = [{ id: 'one' }, { id: 'two' }, { id: 'three' }]

resetMusicSourceFallbackHealth()
assert.deepEqual(orderMusicSourcesForCapability(sources, 'search').map(item => item.id), ['one', 'two', 'three'])

markMusicSourceFailure('one', 'search', new Error('请求失败 (429)'))
assert.equal(isMusicSourceCoolingDown('one', 'search'), true)
assert.deepEqual(orderMusicSourcesForCapability(sources, 'search').map(item => item.id), ['two', 'three'])
assert.deepEqual(orderMusicSourcesForCapability(sources, 'comments').map(item => item.id), ['one', 'two', 'three'], '某项能力失败不能污染其他能力')

markMusicSourceSuccess('three', 'search')
assert.deepEqual(orderMusicSourcesForCapability(sources, 'search').map(item => item.id), ['three', 'two'])

markMusicSourceSuccess('one', 'search')
assert.equal(isMusicSourceCoolingDown('one', 'search'), false)
assert.equal(orderMusicSourcesForCapability(sources, 'search')[0].id, 'one')

console.log('music source fallback tests passed')
