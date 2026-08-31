<!-- WARNING: 本项目专属“粘人精”，严禁出现违规英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { WidgetType } from '../composables/useDesktopLayout'
import { compileWidgetSource } from '../services/widgetSourceRuntime'

const props = defineProps<{
  widgetType: WidgetType
  source: string
  instanceId: string
  editing?: boolean
  widthUnits?: number
  heightUnits?: number
}>()
const emit = defineEmits<{ error: [message: string]; ready: [] }>()

const renderedComponent = ref<unknown>(null)
const compiling = ref(false)
let compileSequence = 0
let timer: ReturnType<typeof setTimeout> | null = null

const compile = async () => {
  const sequence = ++compileSequence
  compiling.value = true
  try {
    const result = await compileWidgetSource(props.widgetType, props.source)
    if (sequence !== compileSequence) return
    renderedComponent.value = result.component
    emit('ready')
  } catch (error) {
    if (sequence !== compileSequence) return
    emit('error', error instanceof Error ? error.message : String(error))
  } finally {
    if (sequence === compileSequence) compiling.value = false
  }
}

watch(() => [props.widgetType, props.source], () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(compile, 320)
}, { immediate: true })

onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
const sizeLabel = computed(() => `${props.widthUnits ?? 1} × ${props.heightUnits ?? 1}`)
</script>

<template>
  <div class="source-renderer" :data-widget-size="sizeLabel">
    <component
      :is="renderedComponent"
      v-if="renderedComponent"
      :instance-id="instanceId"
      :editing="editing"
      :width-units="widthUnits"
      :height-units="heightUnits"
    />
    <div v-else class="source-renderer-loading">{{ compiling ? '正在编译…' : '等待可用源码' }}</div>
  </div>
</template>

<style scoped>
.source-renderer{position:relative;width:100%;height:100%;min-width:0;min-height:0}.source-renderer>:deep(*){min-width:0}.source-renderer-loading{display:flex;width:100%;height:100%;align-items:center;justify-content:center;border:1px dashed color-mix(in srgb,var(--text-secondary) 35%,transparent);border-radius:14px;color:var(--text-secondary);font-size:10px}
</style>
