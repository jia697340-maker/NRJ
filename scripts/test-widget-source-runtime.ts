/* WARNING: 本项目专属“粘人精”，严禁出现违规英文或拼音命名！ */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc'
import { transform } from 'esbuild-wasm'
import * as VueRuntime from 'vue'

const widgets = [
  'DualAvatarWidget.vue', 'MomentCard.vue', 'CustomImageWidget.vue', 'FolderImageWidget.vue', 'DualFrameWidget.vue',
  'CircleAvatarWidget.vue', 'RectangleImageWidget.vue', 'ProfileCardWidget.vue', 'AboutUsWidget.vue'
]
const allowedImports = new Set(['vue', './AvatarUploadModal.vue', './TextEditModal.vue', './BackgroundSettingModal.vue', '../store', '../composables/useWidgetInstances'])
const dependencies: Record<string, Record<string, unknown>> = {
  vue: VueRuntime as unknown as Record<string, unknown>,
  './AvatarUploadModal.vue': { default: {} }, './TextEditModal.vue': { default: {} }, './BackgroundSettingModal.vue': { default: {} },
  '../store': { globalSettings: {} }, '../composables/useWidgetInstances': { defaultWidgetConfig: () => ({}), useWidgetInstances: () => ({ records: {}, updateConfig: async () => true }) }
}

const importToRuntime = (clause: string, path: string): string => {
  assert(allowedImports.has(path), `发现运行时不支持的导入：${path}`)
  const dependency = `__deps[${JSON.stringify(path)}]`, normalized = clause.trim()
  if (normalized.startsWith('{')) {
    const names = normalized.slice(1, -1).split(',').map(value => value.trim()).filter(Boolean).map(value => {
      const [source, alias] = value.split(/\s+as\s+/)
      return alias ? `${source.trim()}: ${alias.trim()}` : source.trim()
    })
    return `const { ${names.join(', ')} } = ${dependency};`
  }
  if (normalized.startsWith('* as ')) return `const ${normalized.slice(5).trim()} = ${dependency};`
  return `const ${normalized} = ${dependency}.default;`
}

for (const fileName of widgets) {
  const source = readFileSync(resolve('src/components', fileName), 'utf8')
  const parsed = parse(source, { filename: fileName })
  assert.deepEqual(parsed.errors, [], `${fileName} 必须能解析为完整 Vue 单文件组件`)
  const descriptor = parsed.descriptor
  assert(descriptor.template && (descriptor.script || descriptor.scriptSetup), `${fileName} 必须保留 template 与 script 源码`)
  const scopeHash = `test-${fileName.replace(/\W/g, '')}`
  const compiled = compileScript(descriptor, { id: scopeHash, inlineTemplate: true })
  let runnable = (await transform(compiled.content, { loader: 'ts', format: 'esm', target: 'es2020' })).code
  const imports: string[] = []
  runnable = runnable.replace(/import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/g, (_match, clause: string, path: string) => {
    imports.push(importToRuntime(clause, path)); return ''
  }).replace(/export\s+default\s+/, 'return ')
    .replace(/export\s*\{\s*([\w$]+)\s+as\s+default\s*\}\s*;?/, 'return $1;')
  const component = new Function('__deps', `"use strict";\n${imports.join('\n')}\n${runnable}`)(dependencies)
  assert(component && typeof component === 'object', `${fileName} 必须能生成可运行组件`)
  for (const style of descriptor.styles) {
    const result = compileStyle({ source: style.content, filename: fileName, id: `data-v-${scopeHash}`, scoped: true })
    assert.deepEqual(result.errors, [], `${fileName} 的样式必须可编译`)
  }
}

console.log('Widget source runtime tests passed')
