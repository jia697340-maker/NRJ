/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { buildCharacterAssetPrompt, getEffectiveCharacterAssets } from '../src/services/characterCapabilities'
import { generateFileBlob } from '../src/services/fileGenerationService'
import { CHARACTER_VIDEO_PROVIDERS, getCharacterVideoProviderDefaults, listCharacterVideoAdapters } from '../src/services/videoGenerationService'
import { getChatFilePreviewCapability, parseCsvRows } from '../src/services/chatFilePreview'

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, String(value)), removeItem: (key: string) => memory.delete(key), clear: () => memory.clear(), key: (index: number) => [...memory.keys()][index] ?? null, get length() { return memory.size } } })

const owner = 'char-a'
const providerIds = CHARACTER_VIDEO_PROVIDERS.map(item => item.id)
assert.deepEqual(listCharacterVideoAdapters().sort(), [...providerIds].sort(), '所有视频大厅节点都必须注册角色生成适配器')
assert.equal(new Set(providerIds).size, 8, '角色视频节点不得遗漏或重复')
for (const provider of CHARACTER_VIDEO_PROVIDERS) {
  const defaults = getCharacterVideoProviderDefaults(provider.id)
  assert.ok(provider.models.some(item => item.value === defaults.model), `${provider.label} 默认模型必须有效`)
  assert.ok(provider.ratios.includes(defaults.aspectRatio), `${provider.label} 默认比例必须有效`)
  assert.ok(provider.resolutions.includes(defaults.resolution), `${provider.label} 默认清晰度必须有效`)
  assert.ok(defaults.durationSeconds >= provider.durationMin && defaults.durationSeconds <= provider.durationMax, `${provider.label} 默认时长必须有效`)
}
const base = { id: owner, characterEntityId: owner, enableFileCapability: false, enableVideoMessageCapability: false, characterAssets: [], fileGenerationConfig: { enabled: true, allowedFormats: ['pptx', 'docx', 'xlsx', 'zip', 'json', 'xml', 'yaml'], maxSizeMb: 30 }, videoGenerationConfig: { enabled: false, provider: 'veo' } }
assert.equal(buildCharacterAssetPrompt(base), '', '关闭能力时不应发送任何文件/视频提示词')

const asset = { id: 'file-real', ownerCharacterId: owner, kind: 'file', source: 'configured', name: '课程表.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 120, summary: '本学期课程安排', tags: ['课程'], contentHash: 'abc', groupVisibility: 'private_only', createdAt: 1, updatedAt: 1 }
const privateOnly = { ...base, enableFileCapability: true, characterAssets: [asset] }
assert.match(buildCharacterAssetPrompt(privateOnly, 'single', '课程'), /课程表\.xlsx/)
assert.doesNotMatch(buildCharacterAssetPrompt(privateOnly, 'group', '课程'), /课程表\.xlsx/, '仅私聊资源不应泄漏到群聊提示词')
assert.equal(getEffectiveCharacterAssets({ ...privateOnly, enableFileCapability: false }).file.enabled, false)

const { buildSystemPrompt } = await import('../src/composables/chatState/prompt')
const fullPromptWithCapabilitiesOff = buildSystemPrompt({
  ...base,
  name: '测试角色',
  persona: '测试人设',
  messages: [],
  enableVoiceReply: false,
  enableNAIImageGen: false,
  enableVoiceCall: false,
  enableVideoCall: false,
  enableAutoThought: false,
  enableImmersiveStatus: false,
  boundWorldBooks: []
})
for (const protocol of ['send_existing_file', 'generate_file', 'send_existing_video', 'generate_video']) {
  assert.doesNotMatch(fullPromptWithCapabilitiesOff, new RegExp(protocol), `关闭能力时完整系统提示词不应包含 ${protocol}`)
}

const payload = { title: '测试汇报', content: '真实内容', sections: [{ title: '目标', content: '完成真实文件生成', bullets: ['可打开', '可校验'] }], rows: [{ 名称: '项目', 数量: 2 }] }
for (const format of ['pptx', 'docx', 'xlsx', 'zip', 'json', 'xml', 'yaml', 'csv'] as const) {
  const generated = await generateFileBlob({ ...payload, format })
  assert.ok(generated.blob.size > 0, `${format} 必须生成非空 Blob`)
  assert.ok(generated.name.endsWith(`.${format}`))
  if (['pptx', 'docx', 'zip'].includes(format)) {
    const archive = await JSZip.loadAsync(await generated.blob.arrayBuffer())
    if (format === 'pptx') assert.ok(archive.file('ppt/presentation.xml'))
    if (format === 'docx') assert.ok(archive.file('word/document.xml'))
  }
}
const safeCsv = await generateFileBlob({ format: 'csv', title: '安全表格', rows: [{ 内容: '=HYPERLINK("https://invalid.example")' }] })
assert.match(await safeCsv.blob.text(), /"'=HYPERLINK/)
const safeXml = await generateFileBlob({ format: 'xml', title: 'XML', content: `有效${String.fromCharCode(1)}内容` })
assert.doesNotMatch(await safeXml.blob.text(), /\u0001/)

assert.deepEqual(getChatFilePreviewCapability({ name: '测试文档.txt', mimeType: 'text/plain' }), { supported: true, kind: 'text', label: '文本' })
assert.equal(getChatFilePreviewCapability({ name: '课程表.xlsx', mimeType: 'application/octet-stream' }).kind, 'xlsx', '扩展名应作为 MIME 缺失时的预览回退')
assert.equal(getChatFilePreviewCapability({ name: '演示.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }).supported, false, '无法可靠还原的格式不得伪装成可预览')
assert.deepEqual(getChatFilePreviewCapability({ name: '矢量图', mimeType: 'image/svg+xml' }), { supported: true, kind: 'text', label: 'SVG 源码' }, 'SVG 必须按源码安全预览，不能作为可执行文档嵌入')
const parsedCsv = parseCsvRows('\uFEFF姓名,备注\r\n小林,"包含,逗号"\r\n小周,"他说""你好"""')
assert.deepEqual(parsedCsv.rows, [['姓名', '备注'], ['小林', '包含,逗号'], ['小周', '他说"你好"']])

const { parseGroupResponse } = await import('../src/services/groupChat')
const parsed = parseGroupResponse('<group_msg sender="char-a" kind="file" action="existing" ref="file_0">课程表</group_msg>', ['char-a'])
assert.equal(parsed.messages[0].messageType, 'file')
assert.equal(parsed.messages[0].assetAction, 'existing')
assert.equal(parsed.messages[0].assetRef, 'file_0')
const videoParsed = parseGroupResponse('<group_msg sender="char-a" kind="video" action="generate" mode="image_to_video" reference_ref="image_0">让画面动起来</group_msg>', ['char-a'])
assert.equal(videoParsed.messages[0].assetReferenceRef, 'image_0')

memory.set('app_veo_video_api_key', 'test-key')
const videoPrompt = buildCharacterAssetPrompt({
  ...base,
  enableVideoMessageCapability: true,
  videoGenerationConfig: { enabled: true, provider: 'veo', credentialRef: 'veo-default' },
  messages: [{ id: 1, type: 'right', content: '[图片]', imageData: { imageId: 'chat_img_1', summary: '湖边晚霞' } }]
})
assert.match(videoPrompt, /reference_ref="image_0"/)
assert.doesNotMatch(videoPrompt, /chat_img_1/, '提示词不得泄漏真实图片存储 ID')
memory.delete('app_veo_video_api_key')
assert.equal(buildCharacterAssetPrompt({ ...base, enableVideoMessageCapability: true, videoGenerationConfig: { enabled: true, provider: 'veo', credentialRef: 'veo-default' } }), '', '没有可用视频凭据时不应注入生成协议')
memory.set('app_agnes_connection_mode', 'web')
memory.set('app_agnes_web_api_key', 'test-key')
const agnesPrompt = buildCharacterAssetPrompt({
  ...base,
  enableVideoMessageCapability: true,
  videoGenerationConfig: { enabled: true, provider: 'agnes', credentialRef: 'agnes-default' },
  messages: [{ id: 2, type: 'right', content: '[图片]', imageData: { imageId: 'chat_img_2', summary: '人物照片' } }]
})
assert.match(agnesPrompt, /只允许 text_to_video/)
assert.doesNotMatch(agnesPrompt, /reference_ref="image_0"|image_to_video 并增加/, '不支持本地图片的节点不得注入图生视频协议')

console.log('chat asset tests passed')
