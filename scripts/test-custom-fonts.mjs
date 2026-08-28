// Runtime regression tests: FontFace/IndexedDB/idle are controlled doubles, not device performance benchmarks.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'
import { compileScript, parse } from '@vue/compiler-sfc'

const source = readFileSync(new URL('../src/composables/useCustomFonts.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const MB = 1024 * 1024
const META = 'clingy_custom_fonts'
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }

function environment({ mobile = true, idle = true, metadata = new Map(), blobs = new Map(), ua, platform, touches = 0, paint = true } = {}) {
  const events = []
  const faces = new Set()
  const urls = new Map()
  const styles = new Map()
  const queue = new Map()
  let sequence = 0
  const controls = { saveGate: null, loadGate: null, saveError: null, metaError: null, loadError: null, quota: 1024 * MB }
  const store = {
    async getItem(id) { events.push(['get', id]); return blobs.get(id) ?? null },
    async setItem(id, blob) {
      events.push(['save-start', id, blob])
      if (controls.saveGate) await controls.saveGate.promise
      if (controls.saveError) throw controls.saveError
      blobs.set(id, blob)
      events.push(['save-done', id])
      return blob
    },
    async removeItem(id) { events.push(['remove', id]); blobs.delete(id) }
  }
  class TestFontFace {
    constructor(family, url) { this.family = family; this.url = url; events.push(['face', family, urls.get(url.match(/url\("([^"]+)"\)/)[1])]) }
    async load() {
      events.push(['load', this.family])
      if (controls.loadGate) await controls.loadGate.promise
      if (controls.loadError) throw controls.loadError
      return this
    }
  }
  const document = {
    hidden: false,
    body: { dataset: {} },
    head: { appendChild(style) { styles.set(style.id, style) } },
    getElementById: id => styles.get(id),
    createElement: () => ({ id: '', textContent: '' }),
    fonts: { add(face) { events.push(['add', face.family]); faces.add(face) }, delete: face => faces.delete(face) }
  }
  const window = { matchMedia: () => ({ matches: false }) }
  if (idle) {
    window.requestIdleCallback = (callback, options) => { const id = ++sequence; queue.set(id, { callback, options }); return id }
    window.cancelIdleCallback = id => queue.delete(id)
  }
  const context = vm.createContext({
    exports: {},
    require: name => {
      if (name === 'vue') return vue
      if (name === 'localforage') return { __esModule: true, default: { createInstance(options) { assert.deepEqual(JSON.parse(JSON.stringify(options)), { name: 'nrt-app', storeName: 'customFonts' }); return store } } }
      throw new Error(`Unexpected import: ${name}`)
    },
    document, window, FontFace: TestFontFace,
    navigator: {
      userAgent: ua ?? (mobile ? 'Android Chrome' : 'Desktop Chrome'), platform: platform ?? '', maxTouchPoints: touches,
      storage: { estimate: async () => ({ quota: controls.quota, usage: 0 }), persisted: async () => true }
    },
    localStorage: {
      getItem: id => metadata.get(id) ?? null,
      setItem(id, value) { if (controls.metaError) throw controls.metaError; metadata.set(id, value); events.push(['meta', value]) }
    },
    URL: class extends URL {
      static createObjectURL(blob) { const id = `blob:test-${++sequence}`; urls.set(id, blob); return id }
      static revokeObjectURL(id) { urls.delete(id); events.push(['revoke', id]) }
    },
    setTimeout, clearTimeout, performance, AbortController, DOMException, Blob, Error,
    requestAnimationFrame: callback => paint ? setTimeout(callback, 0) : 0,
    cancelAnimationFrame: clearTimeout
  })
  vm.runInContext(compiled, context)
  return {
    api: context.exports.useCustomFonts(), controls, events, faces, urls, document, metadata, blobs, queue,
    css: () => styles.get('clingy-custom-font-rules')?.textContent ?? '',
    async idle(deadline = { didTimeout: false, timeRemaining: () => 40 }) {
      const entry = queue.entries().next().value
      assert.ok(entry, 'idle task should be scheduled')
      queue.delete(entry[0]); entry[1].callback(deadline); await settle()
    }
  }
}

function file(size, format = 'ttf') {
  // Actual sized Blob/File, but only the header is meaningful; parsing is deliberately mocked.
  const header = format === 'woff2' ? new TextEncoder().encode('wOF2') : new Uint8Array([0, 1, 0, 0])
  return new File([header, new Uint8Array(size - 4)], `fixture.${format}`)
}
const options = (extra = {}) => ({ name: '测试字体', fileName: 'fixture.ttf', sourceType: 'local', scopes: ['global'], ...extra })
const phasesFor = (phases, gate) => phase => { phases.push(phase); if (phase === 'saving') gate?.resolve() }

for (const [size, format] of [[2, 'woff2'], [15, 'ttf'], [30, 'ttf'], [50, 'ttf']]) {
  test(`${size} MiB ${format}: original File applied before saving, one parse, restore after restart`, async () => {
    const e = environment()
    await e.api.initialize()
    const input = file(size * MB, format)
    const saving = deferred()
    const phases = []
    e.controls.saveGate = deferred()
    const importing = e.api.addFont(input, options({ onPhase: phasesFor(phases, saving) }))
    await saving.promise; await settle()
    const record = e.api.records[0]
    assert.ok(e.api.loadedIds.has(record.id))
    assert.equal(e.faces.size, 1)
    assert.ok(e.css().includes(record.family))
    assert.equal(e.urls.size, 0)
    assert.equal(e.metadata.has(META), false)
    assert.equal(e.events.find(event => event[0] === 'face')[2], input)
    assert.equal(e.events.find(event => event[0] === 'save-start')[2], input)
    assert.ok(e.events.findIndex(event => event[0] === 'add') < e.events.findIndex(event => event[0] === 'save-start'))
    // Leaving settings / switching Apps does not own or cancel the persistence task.
    await e.api.setFontContext('chat', 'desktop')
    await e.api.schedulePreloadEnabledFonts()
    assert.equal(e.events.filter(event => event[0] === 'get').length, 0)
    e.controls.saveGate.resolve()
    await importing
    assert.deepEqual(phases, ['verifying', 'loading', 'applied', 'saving', 'saved'])
    assert.equal(e.events.filter(event => event[0] === 'load').length, 1)
    assert.equal(e.api.pendingLocalIds.size, 0)
    await e.api.setFontContext('forum', 'desktop')
    assert.equal(e.events.filter(event => event[0] === 'load').length, 1)
    const restarted = environment({ metadata: e.metadata, blobs: e.blobs })
    await restarted.api.initialize()
    assert.equal(restarted.faces.size, 1)
    assert.ok(restarted.css().includes(record.family))
  })
}

for (const failure of ['saveError', 'metaError', 'quota']) {
  test(`${failure}: rollback face, record, CSS and storage, retain error after modal remount`, async () => {
    const e = environment()
    await e.api.initialize()
    const previous = await e.api.addFont(file(1024), options())
    const oldMeta = e.metadata.get(META)
    if (failure === 'quota') e.controls.quota = 1
    else e.controls[failure] = new Error('storage failed')
    await assert.rejects(e.api.addFont(file(2048), options()), /保存到本机失败.*已撤销/)
    assert.equal(e.faces.size, 1)
    assert.equal(e.api.records.length, 1)
    assert.ok(e.css().includes(previous.family))
    assert.equal(e.blobs.size, 1)
    assert.equal(e.metadata.get(META), oldMeta)
    assert.equal(e.api.pendingLocalIds.size, 0)
    assert.ok(e.api.localImportError.value.includes('已撤销'))
    assert.equal(e.urls.size, 0)
  })
}

test('invalid font does not save; rejected FontFace is cleaned up', async () => {
  const e = environment()
  await e.api.initialize()
  await assert.rejects(e.api.addFont(new Blob(['invalid']), options()), /不.*支持/)
  e.controls.loadError = new Error('parse failed')
  await assert.rejects(e.api.addFont(file(1024), options()), /parse failed/)
  assert.equal(e.api.records.length, 0)
  assert.equal(e.faces.size, 0)
  assert.equal(e.urls.size, 0)
  assert.equal(e.events.filter(event => event[0] === 'save-start').length, 0)
})

test('pending record cannot leak through other metadata writes or be edited/deleted', async () => {
  const e = environment()
  await e.api.initialize()
  const old = await e.api.addFont(file(1024), options())
  const saving = deferred()
  e.controls.saveGate = deferred()
  const importing = e.api.addFont(file(2048), options({ scopes: ['app:chat'], onPhase: phasesFor([], saving) }))
  await saving.promise
  const pending = e.api.records[1]
  await e.api.updateFont(old.id, { name: 'changed' })
  assert.equal(JSON.parse(e.metadata.get(META)).length, 1)
  await assert.rejects(e.api.updateFont(pending.id, { enabled: false }), /正在保存/)
  await assert.rejects(e.api.removeFont(pending.id), /正在保存/)
  e.controls.saveGate.resolve()
  await importing
  await e.api.updateFont(pending.id, { enabled: false })
  assert.equal(e.api.loadedIds.has(pending.id), false)
  await e.api.setFontContext('chat', 'desktop')
  await e.api.updateFont(pending.id, { enabled: true })
  assert.ok(e.api.loadedIds.has(pending.id))
  assert.ok(e.css().includes('data-font-app="chat"'))
  await e.api.removeFont(pending.id)
  assert.equal(e.blobs.has(pending.id), false)
})

const savedRecord = (id, size, scopes, format = 'ttf') => ({
  id, size: size * MB, scopes, format, name: id, family: id, fileName: `${id}.${format}`,
  sourceType: 'local', enabled: true, createdAt: 1, updatedAt: 1
})
function seeded(records, config = {}) {
  return environment({
    ...config,
    metadata: new Map([[META, JSON.stringify(records)]]),
    blobs: new Map(records.map(record => [record.id, new Blob(['font'])]))
  })
}

test('mobile: three 30+ MiB fonts stay cold; current App/global/system are immediate', async () => {
  const e = seeded([
    savedRecord('chat', 40, ['app:chat']), savedRecord('forum', 40, ['app:forum']), savedRecord('music', 50, ['app:music']),
    savedRecord('global', 40, ['global']), savedRecord('desktop', 40, ['system:desktop']), savedRecord('lock', 40, ['system:lockscreen'])
  ])
  await e.api.initialize()
  assert.deepEqual([...e.api.loadedIds].sort(), ['desktop', 'global'])
  await e.api.schedulePreloadEnabledFonts()
  assert.equal(e.queue.size, 0)
  await e.api.setFontContext('chat', 'desktop')
  assert.ok(e.api.loadedIds.has('chat'))
  assert.equal(e.api.loadedIds.has('forum'), false)
  assert.equal(e.api.loadedIds.has('music'), false)
  await e.api.setFontContext('chat', 'lockscreen')
  assert.ok(e.api.loadedIds.has('lock'))
})

test('mobile idle tiers: small first, 15–30 MiB only real idle, >30 MiB excluded', async () => {
  const e = seeded([
    savedRecord('medium', 30, ['app:music'], 'woff2'), savedRecord('large', 30.01, ['app:forum']),
    savedRecord('small', 15, ['app:chat']), savedRecord('tiny', 2, ['app:messages'], 'woff2')
  ])
  await e.api.schedulePreloadEnabledFonts()
  await e.idle()
  assert.deepEqual([...e.api.loadedIds], ['tiny'])
  await e.idle()
  assert.deepEqual([...e.api.loadedIds], ['tiny', 'small'])
  assert.equal([...e.queue.values()][0].options, undefined)
  await e.idle({ didTimeout: true, timeRemaining: () => 40 })
  await e.idle({ didTimeout: false, timeRemaining: () => 3 })
  assert.equal(e.api.loadedIds.has('medium'), false)
  e.document.hidden = true
  await e.idle()
  assert.equal(e.api.loadedIds.has('medium'), false)
  e.document.hidden = false
  await e.idle()
  assert.ok(e.api.loadedIds.has('medium'))
  assert.equal(e.api.loadedIds.has('large'), false)
  assert.equal(e.queue.size, 0)
})

test('without idle API: medium fonts load on demand, small uses timer fallback', async () => {
  const e = seeded([savedRecord('small', 2, ['app:music']), savedRecord('medium', 20, ['app:chat'])], { idle: false })
  await e.api.schedulePreloadEnabledFonts()
  await new Promise(resolve => setTimeout(resolve, 400))
  assert.deepEqual([...e.api.loadedIds], ['small'])
  await e.api.setActiveApp('chat')
  assert.ok(e.api.loadedIds.has('medium'))
})

for (const config of [
  { ua: 'iPhone Safari' }, { ua: 'Android; wv' }, { ua: 'Macintosh Safari', platform: 'MacIntel', touches: 5 }
]) {
  test(`mobile detection: ${config.ua}`, async () => {
    const e = seeded([savedRecord('large', 40, ['app:chat'])], config)
    await e.api.schedulePreloadEnabledFonts()
    assert.equal(e.queue.size, 0)
    await e.api.setActiveApp('chat')
    assert.ok(e.api.loadedIds.has('large'))
  })
}

test('desktop retains preload of large enabled fonts', async () => {
  const e = seeded([savedRecord('large', 50, ['app:chat'])], { mobile: false })
  await e.api.schedulePreloadEnabledFonts()
  await e.idle()
  assert.ok(e.api.loadedIds.has('large'))
})

test('background work yields to a current-scope load', async () => {
  const e = seeded([savedRecord('current', 40, ['app:chat']), savedRecord('small', 2, ['app:music'])])
  await e.api.schedulePreloadEnabledFonts()
  e.controls.loadGate = deferred()
  const context = e.api.setActiveApp('chat')
  await settle()
  await e.idle()
  assert.equal(e.events.filter(event => event[0] === 'load').length, 1)
  e.controls.loadGate.resolve()
  await context
  await e.idle()
  assert.ok(e.api.loadedIds.has('small'))
})

test('hidden page without animation frames still completes persistence', async () => {
  const e = environment({ paint: false })
  await e.api.initialize()
  await e.api.addFont(file(1024), options())
  assert.equal(e.blobs.size, 1)
})

test('URL import keeps save-before-load, duplicate URL lookup, local restart and replacement', async () => {
  const e = environment()
  await e.api.initialize()
  const phases = []
  const urlOptions = options({ sourceType: 'url', sourceUrl: 'https://fonts.example/a.ttf#one', onPhase: phase => phases.push(phase) })
  const record = await e.api.addFont(file(1024), urlOptions)
  assert.deepEqual(phases, ['saving', 'loading'])
  assert.ok(e.events.findIndex(event => event[0] === 'save-done') < e.events.findIndex(event => event[0] === 'load'))
  assert.equal((await e.api.findExistingUrlFont('https://fonts.example/a.ttf#two')).record.id, record.id)
  assert.equal((await e.api.findExistingUrlFont('https://fonts.example/a.ttf')).available, true)
  await e.api.replaceFont(record.id, file(2048), urlOptions)
  assert.equal(e.api.records.length, 1)
  assert.equal(e.faces.size, 1)
  const restarted = environment({ metadata: e.metadata, blobs: e.blobs })
  await restarted.api.initialize()
  assert.ok(restarted.api.loadedIds.has(record.id))
})

test('modal can close and unmount during local saving; pending save and failure notice survive', async () => {
  const e = environment()
  await e.api.initialize()
  e.controls.saveGate = deferred()
  const saving = deferred()
  const modalApi = {
    ...e.api,
    addFont: (blob, metadata) => e.api.addFont(blob, {
      ...metadata,
      onPhase(phase) { metadata.onPhase(phase); if (phase === 'saving') saving.resolve() }
    })
  }
  const { descriptor } = parse(readFileSync(new URL('../src/components/AppearanceFontModal.vue', import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'font-modal-test' })
  const output = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const context = vm.createContext({
    exports: {}, DOMException, Error,
    require: name => {
      if (name === 'vue') return vue
      if (name.endsWith('appRegistry')) return { appRegistry: [] }
      if (name.endsWith('useCustomFonts')) return { useCustomFonts: () => modalApi }
      throw new Error(`Unexpected import: ${name}`)
    }
  })
  vm.runInContext(output, context)
  const component = context.exports.default
  // Mount the real setup/lifecycle using Vue's custom renderer, without browser layout.
  component.render = () => null
  const renderer = vue.createRenderer({
    createComment: () => ({}), insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null,
    createElement: () => ({}), createText: () => ({}), setText() {}, setElementText() {}, patchProp() {}
  })
  const emitted = []
  const app = renderer.createApp(component, { visible: true, 'onUpdate:visible': value => emitted.push(value) })
  const mounted = app.mount({})
  const state = mounted.$.setupState
  state.openImport()
  await state.onFileChange({ target: { files: [file(1024)] } })
  const importing = state.performImport()
  await saving.promise
  assert.equal(state.phaseLabel, '已生效，正在保存到本机…')
  assert.equal(state.canCloseWhileSaving, true)
  state.close()
  assert.deepEqual(emitted, [false])
  assert.equal(e.api.pendingLocalIds.size, 1)
  app.unmount()
  e.controls.saveError = new Error('disk full')
  e.controls.saveGate.resolve()
  await importing
  assert.equal(e.api.records.length, 0)
  assert.match(e.api.localImportError.value, /保存到本机失败.*已撤销/)
})
