/* WARNING: 本项目专属“粘人精”，严禁出现违规英文或拼音命名！ */
import { markRaw, reactive, readonly, type Component } from 'vue'
import * as VueRuntime from 'vue'
import localforage from 'localforage'
import AvatarUploadModal from '../components/AvatarUploadModal.vue'
import TextEditModal from '../components/TextEditModal.vue'
import BackgroundSettingModal from '../components/BackgroundSettingModal.vue'
import { globalSettings } from '../store'
import * as widgetInstances from '../composables/useWidgetInstances'
import type { WidgetType } from '../composables/useDesktopLayout'
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url'
import type { compileScript as CompileScript, compileStyle as CompileStyle, parse as ParseSfc } from 'vue/compiler-sfc'

export interface WidgetSourceDefinition {
  type: WidgetType
  name: string
  fileName: string
}

export interface WidgetSourceRecord {
  widgetType: WidgetType
  source: string
  updatedAt: number
}

export interface CompiledWidgetSource {
  component: Component
  styleId: string
}

export const widgetSourceDefinitions: Record<WidgetType, WidgetSourceDefinition> = {
  'dual-avatar': { type: 'dual-avatar', name: '双头像小组件', fileName: 'DualAvatarWidget.vue' },
  'moment-card': { type: 'moment-card', name: 'Moment 文案卡片', fileName: 'MomentCard.vue' },
  'custom-image': { type: 'custom-image', name: '自定义图片小组件', fileName: 'CustomImageWidget.vue' },
  'folder-widget': { type: 'folder-widget', name: '文件夹相框小组件', fileName: 'FolderImageWidget.vue' },
  'dual-frame': { type: 'dual-frame', name: '双格相框小组件', fileName: 'DualFrameWidget.vue' },
  'circle-avatar-widget': { type: 'circle-avatar-widget', name: '圆形头像卡片小组件', fileName: 'CircleAvatarWidget.vue' },
  'rectangle-image': { type: 'rectangle-image', name: '长方形图片小组件', fileName: 'RectangleImageWidget.vue' },
  'profile-card-widget': { type: 'profile-card-widget', name: '社交名片小组件', fileName: 'ProfileCardWidget.vue' },
  'about-us-widget': { type: 'about-us-widget', name: '拍立得相框小组件', fileName: 'AboutUsWidget.vue' }
}

const originalSourceLoaders: Record<WidgetType, () => Promise<{ default: string }>> = {
  'dual-avatar': () => import('../components/DualAvatarWidget.vue?raw'),
  'moment-card': () => import('../components/MomentCard.vue?raw'),
  'custom-image': () => import('../components/CustomImageWidget.vue?raw'),
  'folder-widget': () => import('../components/FolderImageWidget.vue?raw'),
  'dual-frame': () => import('../components/DualFrameWidget.vue?raw'),
  'circle-avatar-widget': () => import('../components/CircleAvatarWidget.vue?raw'),
  'rectangle-image': () => import('../components/RectangleImageWidget.vue?raw'),
  'profile-card-widget': () => import('../components/ProfileCardWidget.vue?raw'),
  'about-us-widget': () => import('../components/AboutUsWidget.vue?raw')
}
const originalSourceCache = new Map<WidgetType, string>()

const sourceStore = localforage.createInstance({ name: 'nrt-app', storeName: 'widgetSources' })
const overrides = reactive<Partial<Record<WidgetType, WidgetSourceRecord>>>({})
const compiledCache = new Map<string, CompiledWidgetSource>()
let loaded = false
let loading: Promise<void> | null = null
let esbuildReady: Promise<typeof import('esbuild-wasm')> | null = null
type BrowserSfcCompiler = { parse: typeof ParseSfc; compileScript: typeof CompileScript; compileStyle: typeof CompileStyle }
let sfcCompilerReady: Promise<BrowserSfcCompiler> | null = null

const isWidgetType = (value: unknown): value is WidgetType => typeof value === 'string' && value in widgetSourceDefinitions

const loadWidgetSources = async () => {
  if (loaded) return
  if (loading) return loading
  loading = (async () => {
    await sourceStore.iterate((value: unknown) => {
      if (!value || typeof value !== 'object') return
      const record = value as Partial<WidgetSourceRecord>
      if (!isWidgetType(record.widgetType) || typeof record.source !== 'string' || !record.source.trim()) return
      overrides[record.widgetType] = { widgetType: record.widgetType, source: record.source, updatedAt: Number(record.updatedAt) || Date.now() }
    })
    loaded = true
  })().catch(error => {
    console.warn('小组件源码读取失败', error)
    loaded = true
  }).finally(() => { loading = null })
  return loading
}

const saveWidgetSource = async (widgetType: WidgetType, source: string) => {
  const record: WidgetSourceRecord = { widgetType, source, updatedAt: Date.now() }
  await sourceStore.setItem(widgetType, record)
  overrides[widgetType] = record
  return record
}

const resetWidgetSource = async (widgetType: WidgetType) => {
  await sourceStore.removeItem(widgetType)
  delete overrides[widgetType]
}

const originalSourceFor = async (widgetType: WidgetType) => {
  const cached = originalSourceCache.get(widgetType)
  if (cached) return cached
  const source = (await originalSourceLoaders[widgetType]()).default
  originalSourceCache.set(widgetType, source)
  return source
}
const sourceFor = async (widgetType: WidgetType) => overrides[widgetType]?.source ?? await originalSourceFor(widgetType)
const hasOverride = (widgetType: WidgetType) => Boolean(overrides[widgetType])

const hashSource = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return (hash >>> 0).toString(36)
}

const moduleDependencies: Record<string, Record<string, unknown>> = {
  vue: VueRuntime as unknown as Record<string, unknown>,
  './AvatarUploadModal.vue': { default: AvatarUploadModal },
  './TextEditModal.vue': { default: TextEditModal },
  './BackgroundSettingModal.vue': { default: BackgroundSettingModal },
  '../store': { globalSettings },
  '../composables/useWidgetInstances': widgetInstances as unknown as Record<string, unknown>
}

const importToRuntime = (clause: string, path: string): string => {
  const dependency = `__deps[${JSON.stringify(path)}]`
  const normalized = clause.trim()
  if (!moduleDependencies[path]) throw new Error(`暂不支持源码中的导入路径：${path}`)
  if (normalized.startsWith('{')) {
    const names = normalized.slice(1, -1).split(',').map(value => value.trim()).filter(Boolean).map(value => {
      const [source, alias] = value.split(/\s+as\s+/)
      return alias ? `${source.trim()}: ${alias.trim()}` : source.trim()
    })
    return `const { ${names.join(', ')} } = ${dependency};`
  }
  if (normalized.startsWith('* as ')) return `const ${normalized.slice(5).trim()} = ${dependency};`
  if (normalized.includes(',')) {
    const comma = normalized.indexOf(',')
    const defaultName = normalized.slice(0, comma).trim()
    return `const ${defaultName} = ${dependency}.default;\n${importToRuntime(normalized.slice(comma + 1), path)}`
  }
  return `const ${normalized} = ${dependency}.default;`
}

const evaluateComponent = (code: string) => {
  const imports: string[] = []
  const body = code.replace(/import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/g, (_match, clause: string, path: string) => {
    imports.push(importToRuntime(clause, path))
    return ''
  }).replace(/export\s+default\s+/, 'return ')
    .replace(/export\s*\{\s*([\w$]+)\s+as\s+default\s*\}\s*;?/, 'return $1;')
  if (/\bimport\s*\(/.test(body) || /\bexport\s+/.test(body)) throw new Error('运行时源码暂不支持动态 import 或额外 export')
  return new Function('__deps', `"use strict";\n${imports.join('\n')}\n${body}`)(moduleDependencies) as Component
}

const installStyle = (styleId: string, css: string) => {
  const elementId = `widget-source-style-${styleId}`
  let element = document.getElementById(elementId) as HTMLStyleElement | null
  if (!element) {
    element = document.createElement('style')
    element.id = elementId
    document.head.appendChild(element)
  }
  if (element.textContent !== css) element.textContent = css
}

const transpileTypeScript = async (content: string) => {
  if (!esbuildReady) esbuildReady = import('esbuild-wasm').then(async module => {
    await module.initialize({ wasmURL: esbuildWasmUrl })
    return module
  })
  const esbuild = await esbuildReady
  return (await esbuild.transform(content, { loader: 'ts', format: 'esm', target: 'es2020' })).code
}

const loadSfcCompiler = () => {
  const compilerUrl = '/widget-runtime/vue-compiler-sfc.js'
  if (!sfcCompilerReady) sfcCompilerReady = import(/* @vite-ignore */ compilerUrl) as Promise<BrowserSfcCompiler>
  return sfcCompilerReady
}

export const compileWidgetSource = async (widgetType: WidgetType, source: string): Promise<CompiledWidgetSource> => {
  const cacheKey = `${widgetType}:${hashSource(source)}`
  const cached = compiledCache.get(cacheKey)
  if (cached) return cached
  const { parse, compileScript, compileStyle } = await loadSfcCompiler()
  const filename = widgetSourceDefinitions[widgetType].fileName
  const parsed = parse(source, { filename })
  if (parsed.errors.length) throw new Error(parsed.errors.map(error => typeof error === 'string' ? error : error.message).join('\n'))
  const descriptor = parsed.descriptor
  if (!descriptor.template) throw new Error('源码必须包含 <template> 区域')
  if (!descriptor.scriptSetup && !descriptor.script) throw new Error('源码必须包含 <script setup> 或 <script> 区域')
  const scopeHash = `w${hashSource(`${widgetType}:${source}`)}`
  const scopeId = `data-v-${scopeHash}`
  const script = compileScript(descriptor, { id: scopeHash, inlineTemplate: true })
  const runnableScript = await transpileTypeScript(script.content)
  const component = evaluateComponent(runnableScript) as Component & { __scopeId?: string; __name?: string }
  component.__scopeId = scopeId
  component.__name ||= `EditableWidget_${widgetType}`
  const cssParts: string[] = []
  for (const block of descriptor.styles) {
    if (block.src) throw new Error('运行时源码不支持外部 style src，请把样式写在当前文件中')
    if (block.lang && block.lang !== 'css') throw new Error(`运行时源码暂不支持 ${block.lang} 样式预处理，请使用普通 CSS`)
    const result = compileStyle({ source: block.content, filename, id: scopeId, scoped: true })
    if (result.errors.length) throw new Error(result.errors.map(error => error instanceof Error ? error.message : String(error)).join('\n'))
    cssParts.push(result.code)
  }
  installStyle(scopeHash, cssParts.join('\n'))
  const result = { component: markRaw(component), styleId: scopeHash }
  compiledCache.set(cacheKey, result)
  return result
}

export const useWidgetSourceRuntime = () => ({
  definitions: widgetSourceDefinitions,
  overrides: readonly(overrides),
  loadWidgetSources,
  saveWidgetSource,
  resetWidgetSource,
  sourceFor,
  originalSourceFor,
  hasOverride,
  compileWidgetSource
})
