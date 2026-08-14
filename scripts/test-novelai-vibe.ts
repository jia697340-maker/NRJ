import assert from 'node:assert/strict'
import { parseNovelAIVibeContent } from '../src/services/novelAIVibeFile'
import { buildNovelAIVibeReferences, type VibeGroup, type VibeImage } from '../src/composables/useNovelAIVibe'

const makeVibe = (overrides: Record<string, unknown> = {}) => ({
  identifier: 'novelai-vibe-transfer',
  version: 1,
  type: 'image',
  id: 'official-id',
  name: '水彩',
  image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
  thumbnail: 'data:image/jpeg;base64,/9j/THUMBNAIL',
  encodings: {
    'v4-5full': {
      first: {
        encoding: 'ENCODED_05',
        params: { information_extracted: 0.5 }
      },
      second: {
        encoding: 'ENCODED_07',
        params: { information_extracted: 0.7 }
      }
    }
  },
  importInfo: {
    model: 'nai-diffusion-4-5-full',
    strength: 0.65,
    information_extracted: 0.68
  },
  ...overrides
})

const single = parseNovelAIVibeContent(JSON.stringify(makeVibe()), '水彩.naiv4vibe')
assert.equal(single.groupName, '水彩')
assert.equal(single.items.length, 1)
assert.equal(single.items[0].encodings.length, 2)
assert.equal(single.items[0].informationExtracted, 0.7)
assert.equal(single.items[0].mimeType, 'image/png')
assert.equal(single.items[0].previewMimeType, 'image/jpeg')

const encodingOnly = makeVibe({
  type: 'encoding',
  image: undefined,
  thumbnail: undefined,
  name: '纯编码'
})
const bundle = parseNovelAIVibeContent(JSON.stringify({
  identifier: 'novelai-vibe-transfer-bundle',
  version: 1,
  vibes: [makeVibe(), encodingOnly]
}), '组合.naiv4vibebundle')
assert.equal(bundle.groupName, '组合')
assert.equal(bundle.items.length, 2)
assert.equal(bundle.items[1].base64, '')

const image: VibeImage = {
  id: 'image-1',
  base64: single.items[0].base64,
  encodings: single.items[0].encodings,
  addedAt: 1
}
const group: VibeGroup = {
  id: 'group-1',
  name: '组合',
  items: [{ imageId: image.id, strength: 0.65, extracted: 0.7 }]
}
const cached = buildNovelAIVibeReferences([group], [image], [group.id], 'nai-diffusion-4-5-full')
assert.equal(cached.encodings[0], 'ENCODED_07')
assert.equal(cached.images[0], single.items[0].base64)

group.items[0].extracted = 0.6
const fallback = buildNovelAIVibeReferences([group], [image], [group.id], 'nai-diffusion-4-5-full')
assert.equal(fallback.encodings[0], null)
assert.equal(fallback.images[0], single.items[0].base64)

assert.throws(
  () => parseNovelAIVibeContent('{broken', '损坏.naiv4vibe'),
  /无法解析/
)

console.log('NovelAI Vibe 文件解析与预编码选择测试通过')
