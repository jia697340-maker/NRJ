/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed, ref } from 'vue'
import {
  activatePromptScheme,
  createBlankPromptScheme,
  createPromptSchemeCopy,
  deletePromptScheme,
  getActivePromptScheme,
  getPromptScheme,
  globalPromptSettings,
  savePromptScheme,
  validateImportedPromptSchemes,
  type PromptEditorMode,
  type PromptItem,
  type PromptLanguage,
  type PromptPresetId,
  type PromptScheme
} from '../store'
import { buildPromptGenerationGuide, generatePromptSchemeOnline, parseGeneratedPromptPayload, type GeneratedPromptPayload } from '../services/promptSchemeAI'
import { findUnknownPromptVariables } from '../services/promptVariables'

type ConfirmFn = (message: string, title?: string, showCancel?: boolean, type?: 'normal' | 'danger') => Promise<boolean>

export function useAdvancedSettingsPrompt(showConfirm: ConfirmFn) {
  const viewingSchemeId = ref(globalPromptSettings.activeSchemeId)
  const itemEditorVisible = ref(false)
  const itemDraft = ref<PromptItem | null>(null)
  const itemEditIndex = ref(-1)
  const dragPromptIndex = ref<number | null>(null)
  const aiVisible = ref(false)
  const aiRequirement = ref('')
  const aiLoading = ref(false)
  const aiError = ref('')
  const aiResult = ref<GeneratedPromptPayload | null>(null)
  const aiUnknownVariables = ref<string[]>([])
  const importTextVisible = ref(false)
  const importText = ref('')
  const copyNameVisible = ref(false)
  const copySourceId = ref('')
  const copyName = ref('')
  const guideVisible = ref(false)
  const guideText = ref('')
  const conversionVisible = ref(false)
  const conversionItems = ref<PromptItem[]>([])
  const toast = ref('')
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  let aiController: AbortController | null = null

  const activeScheme = computed(() => getActivePromptScheme())
  const activeVariant = computed(() => activeScheme.value?.variants[globalPromptSettings.language])
  
  const viewingScheme = computed(() => getPromptScheme(viewingSchemeId.value))
  const viewingVariant = computed(() => viewingScheme.value?.variants[globalPromptSettings.language])
  
  const userSchemes = computed(() => globalPromptSettings.schemes.filter(item => item.source === 'user'))
  const builtinSchemes = computed(() => globalPromptSettings.schemes.filter(item => item.source === 'builtin'))

  const showToast = (message: string) => {
    toast.value = message
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toast.value = '' }, 2200)
  }

  const createScheme = (kind: 'copy' | 'blank', basePresetId: PromptPresetId = activeScheme.value?.basePresetId || 'v2', sourceId = viewingSchemeId.value) => {
    const draft = kind === 'blank'
      ? createBlankPromptScheme('新提示词方案', basePresetId)
      : createPromptSchemeCopy(sourceId)
    const saved = savePromptScheme(draft)
    viewingSchemeId.value = saved.id
  }

  const openCopyDialog = (sourceId = viewingSchemeId.value) => {
    const source = getPromptScheme(sourceId)
    if (!source) return
    copySourceId.value = source.id
    copyName.value = `${source.name} 副本`
    copyNameVisible.value = true
  }

  const confirmSchemeCopy = () => {
    const name = copyName.value.trim()
    if (!name) return showToast('副本名称不能为空')
    const saved = savePromptScheme(createPromptSchemeCopy(copySourceId.value, name))
    copyNameVisible.value = false
    viewingSchemeId.value = saved.id
    showToast('副本已保存到“我的方案”')
  }

  const switchScheme = async (schemeId: string) => {
    if (schemeId === globalPromptSettings.activeSchemeId) return
    const target = getPromptScheme(schemeId)
    if (!target) return
    if (await showConfirm(`确定切换到“${target.name}”吗？当前方案会保留，不会被覆盖。`, '切换提示词方案')) {
      activatePromptScheme(schemeId)
      viewingSchemeId.value = schemeId
      showToast('已启用此方案')
    }
  }

  const switchLanguage = async (language: PromptLanguage) => {
    if (language === globalPromptSettings.language) return
    const name = language === 'en' ? 'English' : '中文'
    if (await showConfirm(`确定切换为${name}内置指令吗？当前方案的中英文内容会分别保存。`, '切换提示词语言')) {
      activatePromptScheme(globalPromptSettings.activeSchemeId, language)
    }
  }

  const removeScheme = async (schemeId: string) => {
    const scheme = getPromptScheme(schemeId)
    if (!scheme || scheme.source === 'builtin') return
    if (await showConfirm(`确定删除“${scheme.name}”吗？此操作不可逆。`, '删除方案', true, 'danger')) {
      deletePromptScheme(schemeId)
      if (viewingSchemeId.value === schemeId) {
        viewingSchemeId.value = globalPromptSettings.activeSchemeId
      }
      showToast('方案已删除')
    }
  }

  const resetEditorToBuiltin = async () => {
    const draft = viewingScheme.value
    if (!draft || draft.source !== 'user') return
    const builtin = getPromptScheme(`builtin_${draft.basePresetId}`)
    if (!builtin) return showToast('没有找到对应的官方方案')
    const languageName = globalPromptSettings.language === 'en' ? 'English' : '中文'
    if (!await showConfirm(`恢复当前方案的${languageName}内容为官方 ${draft.basePresetId.toUpperCase()} 吗？恢复后立刻生效。`, '恢复官方内容')) return
    draft.variants[globalPromptSettings.language] = JSON.parse(JSON.stringify(builtin.variants[globalPromptSettings.language]))
    showToast('已恢复为官方内容')
  }

  const setEditorMode = (mode: PromptEditorMode) => {
    const variant = viewingVariant.value
    if (!variant || variant.mode === mode) return
    if (mode === 'full') {
      variant.structuredSnapshot = JSON.parse(JSON.stringify(variant.items))
      if (!variant.fullText.trim()) variant.fullText = variant.items.filter(item => item.enabled).map(item => item.content.trim()).filter(Boolean).join('\n\n')
    } else if (!variant.items.length && variant.structuredSnapshot.length) {
      variant.items = JSON.parse(JSON.stringify(variant.structuredSnapshot))
    }
    variant.mode = mode
  }

  const prepareFullTextConversion = () => {
    const variant = viewingVariant.value
    if (!variant?.fullText.trim()) return showToast('全文提示词不能为空')
    const lines = variant.fullText.replace(/\r\n/g, '\n').split('\n')
    const parsed: PromptItem[] = []
    let currentName = ''
    let currentLines: string[] = []
    const flush = () => {
      const content = currentLines.join('\n').trim()
      if (!currentName || !content) return
      parsed.push({ id: `custom_prompt_${Date.now()}_${parsed.length}_${Math.random().toString(36).slice(2, 5)}`, name: currentName, content, enabled: true })
    }
    for (const line of lines) {
      const heading = line.match(/^\s*#{1,3}\s+(.+?)\s*$/) || line.match(/^\s*【(.+?)】\s*$/)
      if (heading) {
        flush()
        currentName = heading[1].trim()
        currentLines = []
      } else {
        currentLines.push(line)
      }
    }
    flush()
    conversionItems.value = parsed.length
      ? parsed
      : [{ id: `custom_prompt_${Date.now()}`, name: '完整提示词', content: variant.fullText.trim(), enabled: true }]
    conversionVisible.value = true
  }

  const confirmFullTextConversion = () => {
    const variant = viewingVariant.value
    if (!variant || !conversionItems.value.length) return
    variant.items = JSON.parse(JSON.stringify(conversionItems.value))
    variant.structuredSnapshot = JSON.parse(JSON.stringify(conversionItems.value))
    variant.mode = 'items'
    conversionVisible.value = false
    showToast(`已转换为 ${variant.items.length} 个条目`)
  }

  const openItemEditor = (index = -1) => {
    const variant = viewingVariant.value
    if (!variant) return
    itemEditIndex.value = index
    itemDraft.value = index >= 0
      ? JSON.parse(JSON.stringify(variant.items[index]))
      : { id: `custom_prompt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, name: '新提示词条目', content: '', enabled: true }
    itemEditorVisible.value = true
  }

  const saveItem = () => {
    const variant = viewingVariant.value
    const item = itemDraft.value
    if (!variant || !item) return
    if (!item.name.trim() || !item.content.trim()) return showToast('条目名称和内容不能为空')
    if (itemEditIndex.value >= 0) variant.items[itemEditIndex.value] = item
    else variant.items.push(item)
    itemEditorVisible.value = false
  }

  const deleteItem = async (index: number) => {
    const variant = viewingVariant.value
    if (!variant || viewingScheme.value?.source === 'builtin') return
    if (await showConfirm('确定删除这个提示词条目吗？', '删除条目', true, 'danger')) variant.items.splice(index, 1)
  }

  const handlePromptDragStart = (index: number) => { dragPromptIndex.value = index }
  const handlePromptDragOver = (event: DragEvent, index: number) => {
    event.preventDefault()
    const variant = viewingVariant.value
    if (!variant || dragPromptIndex.value === null || dragPromptIndex.value === index || viewingScheme.value?.source === 'builtin') return
    const [item] = variant.items.splice(dragPromptIndex.value, 1)
    variant.items.splice(index, 0, item)
    dragPromptIndex.value = index
  }
  const handlePromptDragEnd = () => { dragPromptIndex.value = null }

  const copyText = async (content: string, success: string) => {
    await navigator.clipboard.writeText(content)
    showToast(success)
  }

  const copyGuide = () => {
    const scheme = viewingScheme.value || activeScheme.value
    if (!scheme) return
    guideText.value = buildPromptGenerationGuide('global', globalPromptSettings.language, scheme.basePresetId, scheme)
    guideVisible.value = true
  }

  const confirmCopyGuide = async () => {
    if (!guideText.value.trim()) return
    await copyText(guideText.value, '已复制给 AI 的完整生成说明')
    guideVisible.value = false
  }

  const exportScheme = () => {
    const scheme = viewingScheme.value || activeScheme.value
    if (!scheme) return
    const blob = new Blob([JSON.stringify({ schema: 'clingy-prompt-schemes', version: 2, schemes: [scheme] }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `提示词方案-${scheme.name}-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    showToast('方案已导出')
  }

  const importSchemesFromText = () => {
    try {
      const schemes = validateImportedPromptSchemes(JSON.parse(importText.value))
      globalPromptSettings.schemes.push(...schemes)
      activatePromptScheme(schemes[0].id)
      viewingSchemeId.value = schemes[0].id
      importTextVisible.value = false
      importText.value = ''
      showToast(`已导入 ${schemes.length} 个方案并选中`)
    } catch (error: any) {
      showToast(error?.message || '导入失败，请检查 JSON 格式')
    }
  }

  const importGeneratedText = () => {
    const scheme = activeScheme.value
    if (!scheme) return
    try {
      const parsed = parseGeneratedPromptPayload(importText.value, scheme.basePresetId, 'global')
      aiResult.value = parsed.payload
      aiUnknownVariables.value = parsed.unknownVariables
      importTextVisible.value = false
      aiVisible.value = true
    } catch (error: any) {
      showToast(error?.message || '无法识别 AI 返回内容')
    }
  }

  const openAiGenerator = () => {
    aiVisible.value = true
    aiResult.value = null
    aiError.value = ''
    aiUnknownVariables.value = []
  }

  const runAiGenerator = async () => {
    const scheme = activeScheme.value
    if (!scheme || aiLoading.value) return
    aiController = new AbortController()
    aiLoading.value = true
    aiError.value = ''
    aiResult.value = null
    try {
      const result = await generatePromptSchemeOnline({
        requirement: aiRequirement.value,
        language: globalPromptSettings.language,
        basePresetId: scheme.basePresetId,
        current: scheme,
        signal: aiController.signal
      })
      aiResult.value = result.payload
      aiUnknownVariables.value = result.unknownVariables
    } catch (error: any) {
      if (error?.name !== 'AbortError') aiError.value = error?.message || '在线生成失败'
    } finally {
      aiLoading.value = false
      aiController = null
    }
  }

  const cancelAiGenerator = () => aiController?.abort()

  const applyAiResult = () => {
    const result = aiResult.value
    const source = viewingScheme.value || activeScheme.value
    if (!result || !source) return
    const scheme = createPromptSchemeCopy(source.id, result.name)
    scheme.description = result.description
    scheme.basePresetId = result.basePresetId
    const variant = scheme.variants[globalPromptSettings.language]
    variant.mode = result.mode
    variant.items = JSON.parse(JSON.stringify(result.items))
    variant.structuredSnapshot = JSON.parse(JSON.stringify(result.items))
    variant.fullText = result.fullText
    
    const saved = savePromptScheme(scheme)
    viewingSchemeId.value = saved.id
    aiVisible.value = false
    showToast('已生成新方案并选中')
  }

  return {
    activeScheme, activeVariant, builtinSchemes, userSchemes, viewingSchemeId, viewingScheme, viewingVariant,
    itemEditorVisible, itemDraft, dragPromptIndex, aiVisible, aiRequirement, aiLoading, aiError, aiResult,
    aiUnknownVariables, importTextVisible, importText, copyNameVisible, copyName, guideVisible, guideText,
    conversionVisible, conversionItems, toast, createScheme,
    openCopyDialog, confirmSchemeCopy, switchScheme, switchLanguage, removeScheme, resetEditorToBuiltin, setEditorMode,
    prepareFullTextConversion, confirmFullTextConversion, openItemEditor,
    saveItem, deleteItem, handlePromptDragStart, handlePromptDragOver, handlePromptDragEnd, copyText,
    copyGuide, confirmCopyGuide, exportScheme, importSchemesFromText, importGeneratedText, openAiGenerator, runAiGenerator,
    cancelAiGenerator, applyAiResult, showToast
  }
}
