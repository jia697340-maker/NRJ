<!-- WARNING: 本项目专属“粘人精”，严禁出现违规英文或拼音命名！ -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { vue } from '@codemirror/lang-vue'
import type { WidgetType } from '../composables/useDesktopLayout'
import { compileWidgetSource, useWidgetSourceRuntime } from '../services/widgetSourceRuntime'
import WidgetSourceRenderer from './WidgetSourceRenderer.vue'

const props = defineProps<{ widgetType: WidgetType; initialWidth: number; initialHeight: number }>()
const emit = defineEmits<{ close: []; 'update-size': [width: number, height: number] }>()
const { definitions, loadWidgetSources, sourceFor, originalSourceFor, hasOverride, saveWidgetSource, resetWidgetSource } = useWidgetSourceRuntime()
const editorElement = ref<HTMLDivElement | null>(null)
const source = ref('')
const savedSource = ref('')
const widthUnits = ref(props.initialWidth)
const heightUnits = ref(props.initialHeight)
const viewMode = ref<'code' | 'split' | 'preview'>('split')
const compiling = ref(true)
const compileError = ref('')
const saving = ref(false)
const savedFeedback = ref('')
const showResetConfirm = ref(false)
const showLeaveConfirm = ref(false)
let editor: EditorView | null = null
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

const definition = computed(() => definitions[props.widgetType])
const dirty = computed(() => source.value !== savedSource.value)
const previewStyle = computed(() => ({ aspectRatio: `${widthUnits.value} / ${heightUnits.value}`, width: `${Math.min(100, Math.max(42, widthUnits.value / 4 * 100))}%` }))
const clampUnit = (value: number) => Math.max(1, Math.min(4, Math.round(Number(value) || 1)))
const updateWidth = (value: number) => { widthUnits.value = clampUnit(value); emit('update-size', widthUnits.value, heightUnits.value) }
const updateHeight = (value: number) => { heightUnits.value = clampUnit(value); emit('update-size', widthUnits.value, heightUnits.value) }
const setSize = (width: number, height: number) => { widthUnits.value = width; heightUnits.value = height; emit('update-size', width, height) }

const replaceEditorSource = (value: string) => {
  source.value = value
  if (!editor) return
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } })
}

const showFeedback = (message: string) => {
  savedFeedback.value = message
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => { savedFeedback.value = '' }, 2200)
}

const save = async () => {
  if (saving.value) return
  saving.value = true
  compileError.value = ''
  try {
    await compileWidgetSource(props.widgetType, source.value)
    await saveWidgetSource(props.widgetType, source.value)
    savedSource.value = source.value
    showFeedback('源码已保存并应用')
  } catch (error) {
    compileError.value = error instanceof Error ? error.message : String(error)
  } finally { saving.value = false }
}

const confirmReset = async () => {
  showResetConfirm.value = false
  const original = await originalSourceFor(props.widgetType)
  await resetWidgetSource(props.widgetType)
  replaceEditorSource(original)
  savedSource.value = original
  compileError.value = ''
  showFeedback('已恢复项目内置源码')
}

const requestClose = () => {
  if (dirty.value) showLeaveConfirm.value = true
  else emit('close')
}

const handlePreviewError = (message: string) => { compiling.value = false; compileError.value = message }
const handlePreviewReady = () => { compiling.value = false; compileError.value = '' }

onMounted(async () => {
  await loadWidgetSources()
  const initial = await sourceFor(props.widgetType)
  source.value = initial
  savedSource.value = initial
  await nextTick()
  if (!editorElement.value) return
  editor = new EditorView({
    parent: editorElement.value,
    state: EditorState.create({
      doc: initial,
      extensions: [
        basicSetup,
        vue(),
        keymap.of([...defaultKeymap, indentWithTab, { key: 'Mod-s', preventDefault: true, run: () => { void save(); return true } }]),
        EditorView.lineWrapping,
        EditorView.updateListener.of(update => { if (update.docChanged) source.value = update.state.doc.toString() }),
        EditorView.theme({
          '&': { height: '100%', backgroundColor: 'var(--sys-bg-secondary)', color: 'var(--text-primary)', fontSize: '12px' },
          '.cm-content': { fontFamily: 'SFMono-Regular, Consolas, monospace', padding: '10px 0', caretColor: 'var(--text-primary)' },
          '.cm-gutters': { backgroundColor: 'var(--sys-bg-primary)', color: 'var(--text-secondary)', border: '0' },
          '.cm-activeLine,.cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--text-primary) 5%, transparent)' },
          '.cm-focused': { outline: 'none' }
        })
      ]
    })
  })
})

watch(() => props.widgetType, () => { /* 编辑器按组件类型重新挂载 */ })
watch(source, () => { compiling.value = true; compileError.value = '' })
onBeforeUnmount(() => { editor?.destroy(); if (feedbackTimer) clearTimeout(feedbackTimer) })
</script>

<template>
  <section class="source-editor-page" role="dialog" aria-modal="true" :aria-label="`${definition.name}源码编辑器`">
    <header class="source-header">
      <button type="button" class="header-back" @click="requestClose">返回</button>
      <div class="header-title"><b>{{ definition.name }}</b><small>{{ definition.fileName }}</small></div>
      <button type="button" class="header-save" :disabled="saving || !dirty || Boolean(compileError)" @click="save">{{ saving ? '保存中' : '保存' }}</button>
    </header>

    <div class="source-toolbar">
      <div class="view-tabs" aria-label="编辑器视图">
        <button type="button" :class="{ active: viewMode === 'code' }" @click="viewMode='code'">源码</button>
        <button type="button" :class="{ active: viewMode === 'split' }" @click="viewMode='split'">分屏</button>
        <button type="button" :class="{ active: viewMode === 'preview' }" @click="viewMode='preview'">预览</button>
      </div>
      <div class="size-controls" aria-label="预览尺寸">
        <label>宽<input :value="widthUnits" type="number" inputmode="numeric" min="1" max="4" @change="updateWidth(Number(($event.target as HTMLInputElement).value))" /></label>
        <span>×</span>
        <label>高<input :value="heightUnits" type="number" inputmode="numeric" min="1" max="4" @change="updateHeight(Number(($event.target as HTMLInputElement).value))" /></label>
      </div>
    </div>

    <div class="quick-sizes" aria-label="常用预览尺寸">
      <button v-for="size in [[1,1],[2,1],[2,2],[3,2],[4,2],[4,3],[4,4]]" :key="size.join('x')" type="button" :class="{ active: widthUnits===size[0] && heightUnits===size[1] }" @click="setSize(size[0],size[1])">{{ size[0] }}×{{ size[1] }}</button>
      <span>{{ hasOverride(widgetType) ? '正在使用已修改源码' : '正在使用项目内置源码' }}</span>
    </div>

    <main class="editor-workspace" :class="`mode-${viewMode}`">
      <div v-show="viewMode !== 'preview'" ref="editorElement" class="code-pane" aria-label="Vue源码"></div>
      <div v-show="viewMode !== 'code'" class="preview-pane">
        <div class="preview-canvas">
          <div class="preview-widget" :style="previewStyle">
            <WidgetSourceRenderer
              :widget-type="widgetType"
              :source="source"
              :instance-id="`widget-source-preview-${widgetType}`"
              :editing="true"
              :width-units="widthUnits"
              :height-units="heightUnits"
              @error="handlePreviewError"
              @ready="handlePreviewReady"
            />
          </div>
        </div>
      </div>
    </main>

    <footer class="source-footer">
      <div class="compile-status" :class="{ error: compileError }">
        <b>{{ compileError ? '编译失败' : compiling ? '正在编译' : '编译成功' }}</b>
        <span v-if="compileError" :title="compileError">{{ compileError }}</span>
        <span v-else-if="savedFeedback">{{ savedFeedback }}</span>
        <span v-else>{{ dirty ? '有尚未保存的修改' : '源码已同步' }}</span>
      </div>
      <button type="button" class="reset-source" @click="showResetConfirm=true">重置为原始代码</button>
    </footer>

    <div v-if="showResetConfirm" class="editor-confirm" @click.self="showResetConfirm=false">
      <div><h3>重置源码？</h3><p>将清除这个小组件保存过的源码修改，恢复为项目当前内置的原始代码。组件内容、尺寸和桌面位置不会改变。</p><nav><button type="button" @click="showResetConfirm=false">取消</button><button type="button" class="danger" @click="confirmReset">确认重置</button></nav></div>
    </div>
    <div v-if="showLeaveConfirm" class="editor-confirm" @click.self="showLeaveConfirm=false">
      <div><h3>放弃未保存修改？</h3><p>离开后，本次尚未保存的源码修改不会生效。</p><nav><button type="button" @click="showLeaveConfirm=false">继续编辑</button><button type="button" class="danger" @click="emit('close')">放弃并返回</button></nav></div>
    </div>
  </section>
</template>

<style scoped>
.source-editor-page{position:absolute;z-index:80;inset:0;display:flex;min-width:0;min-height:0;flex-direction:column;background:var(--sys-bg-primary);color:var(--text-primary)}
.source-header{display:grid;grid-template-columns:58px minmax(0,1fr) 58px;align-items:center;min-height:56px;padding:max(12px,env(safe-area-inset-top)) 14px 8px;border-bottom:1px solid var(--border-color);box-sizing:border-box}.source-header button{height:34px;border:0;background:transparent;color:var(--text-primary);font:inherit;font-size:12px}.header-back{text-align:left}.header-save{text-align:right;font-weight:650}.header-save:disabled{opacity:.36}.header-title{min-width:0;text-align:center}.header-title b,.header-title small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.header-title b{font-size:14px}.header-title small{margin-top:2px;color:var(--text-secondary);font-size:9px;font-weight:400}
.source-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px}.view-tabs{display:flex;min-width:0;padding:2px;border-radius:10px;background:var(--card-bg-solid)}.view-tabs button,.quick-sizes button{border:0;background:transparent;color:var(--text-secondary);font:inherit}.view-tabs button{height:28px;padding:0 11px;border-radius:8px;font-size:10px}.view-tabs button.active{background:var(--sys-bg-secondary);color:var(--text-primary);box-shadow:0 1px 4px color-mix(in srgb,var(--shadow-color) 38%,transparent)}.size-controls{display:flex;flex:0 0 auto;align-items:center;gap:4px;color:var(--text-secondary);font-size:9px}.size-controls label{display:flex;align-items:center;gap:3px}.size-controls input{box-sizing:border-box;width:36px;height:28px;border:1px solid var(--border-color);border-radius:8px;outline:0;background:var(--sys-bg-secondary);color:var(--text-primary);font:inherit;font-size:11px;text-align:center}.size-controls input:focus{border-color:var(--text-secondary)}
.quick-sizes{display:flex;min-width:0;align-items:center;gap:5px;overflow-x:auto;padding:0 12px 8px;scrollbar-width:none}.quick-sizes::-webkit-scrollbar{display:none}.quick-sizes button{flex:0 0 auto;height:24px;padding:0 7px;border:1px solid var(--border-color);border-radius:8px;font-size:9px}.quick-sizes button.active{border-color:var(--text-primary);color:var(--text-primary)}.quick-sizes>span{min-width:0;flex:1;overflow:hidden;color:var(--text-secondary);font-size:9px;text-align:right;text-overflow:ellipsis;white-space:nowrap}
.editor-workspace{display:grid;min-height:0;flex:1;grid-template-columns:minmax(0,1.15fr) minmax(220px,.85fr);gap:1px;border-top:1px solid var(--border-color);border-bottom:1px solid var(--border-color);background:var(--border-color)}.editor-workspace.mode-code,.editor-workspace.mode-preview{grid-template-columns:1fr}.code-pane,.preview-pane{min-width:0;min-height:0;overflow:hidden;background:var(--sys-bg-secondary)}.code-pane :deep(.cm-editor){height:100%}.code-pane :deep(.cm-scroller){overflow:auto}.preview-pane{overflow:auto}.preview-canvas{box-sizing:border-box;display:flex;width:100%;min-height:100%;align-items:center;justify-content:center;padding:18px;background:linear-gradient(145deg,color-mix(in srgb,var(--card-bg-solid) 84%,#dbeafe),var(--sys-bg-primary))}.preview-widget{min-width:74px;max-width:360px;max-height:88%;transition:width .2s ease,aspect-ratio .2s ease}
.source-footer{display:flex;min-height:54px;align-items:center;justify-content:space-between;gap:10px;padding:7px 12px calc(7px + env(safe-area-inset-bottom));box-sizing:border-box}.compile-status{min-width:0;display:flex;flex-direction:column;gap:2px}.compile-status b{font-size:10px}.compile-status span{max-width:min(58vw,520px);overflow:hidden;color:var(--text-secondary);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.compile-status.error b,.compile-status.error span{color:#d14f4a}.reset-source{flex:0 0 auto;height:30px;border:1px solid var(--border-color);border-radius:9px;background:var(--sys-bg-secondary);color:#d14f4a;padding:0 9px;font:inherit;font-size:10px}
.editor-confirm{position:absolute;z-index:10;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.3);backdrop-filter:blur(7px)}.editor-confirm>div{width:min(100%,330px);overflow:hidden;border-radius:18px;background:var(--sys-bg-secondary);box-shadow:0 18px 48px rgba(0,0,0,.24);text-align:center}.editor-confirm h3{margin:20px 18px 7px;font-size:16px}.editor-confirm p{margin:0 20px 18px;color:var(--text-secondary);font-size:11px;line-height:1.55}.editor-confirm nav{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--border-color)}.editor-confirm nav button{height:45px;border:0;background:transparent;color:#0a84ff;font:inherit;font-size:13px}.editor-confirm nav button+button{border-left:1px solid var(--border-color)}.editor-confirm nav .danger{color:#ff3b30;font-weight:600}
@media(max-width:700px){.editor-workspace{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) minmax(150px,.72fr)}.editor-workspace.mode-code,.editor-workspace.mode-preview{grid-template-rows:1fr}.preview-canvas{padding:12px}.preview-widget{max-width:300px}}
@media(max-width:360px){.source-toolbar{padding-left:9px;padding-right:9px}.view-tabs button{padding:0 8px}.quick-sizes{padding-left:9px;padding-right:9px}.quick-sizes>span{display:none}.source-header{padding-left:10px;padding-right:10px}.source-footer{padding-left:10px;padding-right:10px}.compile-status span{max-width:50vw}}
</style>
