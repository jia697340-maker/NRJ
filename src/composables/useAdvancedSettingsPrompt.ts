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
  const editorVisible = ref(false)
  const editorDraft = ref<PromptScheme | null>(null)
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
  const schemeManageMode = ref(false)
  const selectedSchemeIds = ref<string[]>([])
  const conversionVisible = ref(false)
  const conversionItems = ref<PromptItem[]>([])
  const toast = ref('')
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  let aiController: AbortController | null = null

  const activeScheme = computed(() => getActivePromptScheme())
  const activeVariant = computed(() => activeScheme.value?.variants[globalPromptSettings.language])
  const editorVariant = computed(() => editorDraft.value?.variants[globalPromptSettings.language])
  const userSchemes = computed(() => globalPromptSettings.schemes.filter(item => item.source === 'user'))
  const builtinSchemes = computed(() => globalPromptSettings.schemes.filter(item => item.source === 'builtin'))

  const showToast = (message: string) => {
    toast.value = message
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toast.value = '' }, 2200)
  }

  const openSchemeEditor = (schemeId = globalPromptSettings.activeSchemeId) => {
    const scheme = getPromptScheme(schemeId)
    if (!scheme) return
    editorDraft.value = JSON.parse(JSON.stringify(scheme))
    editorVisible.value = true
  }

  const createScheme = (kind: 'copy' | 'blank', basePresetId: PromptPresetId = activeScheme.value?.basePresetId || 'v2', sourceId = globalPromptSettings.activeSchemeId) => {
    editorDraft.value = kind === 'blank'
      ? createBlankPromptScheme('新提示词方案', basePresetId)
      : createPromptSchemeCopy(sourceId)
    editorVisible.value = true
  }

  const openCopyDialog = (sourceId = globalPromptSettings.activeSchemeId) => {
    const source = getPromptScheme(sourceId)
    if (!source) return
    copySourceId.value = source.id
    copyName.value = `${source.name} 副本`
    copyNameVisible.value = true
  }

  const confirmSchemeCopy = () => {
    const name = copyName.value.trim()
    if (!name) return showToast('副本名称不能为空')
    editorDraft.value = savePromptScheme(createPromptSchemeCopy(copySourceId.value, name))
    copyNameVisible.value = false
    editorVisible.value = true
    showToast('副本已保存到“我的方案”')
  }

  const saveEditor = async () => {
    const draft = editorDraft.value
    const variant = editorVariant.value
    if (!draft || !variant) return
    if (draft.source === 'builtin') {
      openCopyDialog(draft.id)
      return
    }
    if (!draft.name.trim()) return showToast('方案名称不能为空')
    if (variant.mode === 'items' && !variant.items.some(item => item.enabled && item.content.trim())) return showToast('至少需要一个已启用且有内容的条目')
    if (variant.mode === 'full' && !variant.fullText.trim()) return showToast('全文提示词不能为空')
    const content = variant.mode === 'full' ? variant.fullText : variant.items.map(item => item.content).join('\n')
    const unknown = findUnknownPromptVariables(content, 'global')
    if (unknown.length) {
      const confirmed = await showConfirm(`发现当前全局提示词不支持的变量：\n${unknown.join('、')}\n\n仍要保存吗？未知变量会原样发送给模型。`, '变量检查')
      if (!confirmed) return
    }
    savePromptScheme(draft)
    editorVisible.value = false
    showToast('提示词方案已保存并启用')
  }

  const switchScheme = async (schemeId: string) => {
    if (schemeId === globalPromptSettings.activeSchemeId) return
    const target = getPromptScheme(schemeId)
    if (!target) return
    if (await showConfirm(`确定切换到“${target.name}”吗？当前方案会保留，不会被覆盖。`, '切换提示词方案')) {
      activatePromptScheme(schemeId)
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
    if (await showConfirm(`确定删除“${scheme.name}”吗？此操作不会影响内置 V1/V2。`, '删除自定义方案', true, 'danger')) {
      deletePromptScheme(schemeId)
      editorVisible.value = false
      showToast('自定义方案已删除')
    }
  }

  const toggleSchemeManage = () => {
    schemeManageMode.value = !schemeManageMode.value
    selectedSchemeIds.value = []
  }

  const toggleSchemeSelection = (schemeId: string) => {
    selectedSchemeIds.value = selectedSchemeIds.value.includes(schemeId)
      ? selectedSchemeIds.value.filter(id => id !== schemeId)
      : [...selectedSchemeIds.value, schemeId]
  }

  const toggleAllSchemes = () => {
    selectedSchemeIds.value = selectedSchemeIds.value.length === userSchemes.value.length
      ? []
      : userSchemes.value.map(item => item.id)
  }

  const removeSelectedSchemes = async () => {
    const ids = selectedSchemeIds.value.filter(id => getPromptScheme(id)?.source === 'user')
    if (!ids.length) return
    if (!await showConfirm(`确定删除选中的 ${ids.length} 个方案吗？删除后无法恢复。`, '批量删除方案', true, 'danger')) return
    ids.forEach(deletePromptScheme)
    selectedSchemeIds.value = []
    schemeManageMode.value = false
    showToast(`已删除 ${ids.length} 个方案`)
  }

  const resetEditorToBuiltin = async () => {
    const draft = editorDraft.value
    if (!draft || draft.source !== 'user') return
    const builtin = getPromptScheme(`builtin_${draft.basePresetId}`)
    if (!builtin) return showToast('没有找到对应的官方方案')
    const languageName = globalPromptSettings.language === 'en' ? 'English' : '中文'
    if (!await showConfirm(`恢复当前方案的${languageName}内容为官方 ${draft.basePresetId.toUpperCase()} 吗？方案名称不会改变，保存后生效。`, '恢复官方内容')) return
    draft.variants[globalPromptSettings.language] = JSON.parse(JSON.stringify(builtin.variants[globalPromptSettings.language]))
    showToast('已恢复官方内容，请确认后保存')
  }

  const setEditorMode = (mode: PromptEditorMode) => {
    const variant = editorVariant.value
    if (!variant || variant.mode === mode) return
    if (mode === 'full') {
      variant.structuredSnapshot = JSON.parse(JSON.stringify(variant.items))
      if (!variant.fullText.trim()) variant.fullText = variant.items.filter(item => item.enabled).map(item => item.content.trim()).filter(Boolean).join('\n\n')
    } else if (!variant.items.length && variant.structuredSnapshot.length) {
      variant.items = JSON.parse(JSON.stringify(variant.structuredSnapshot))
    }
    variant.mode = mode
  }

  const convertFullTextToItem = () => {
    const variant = editorVariant.value
    if (!variant?.fullText.trim()) return
    variant.items = [{ id: `custom_prompt_${Date.now()}`, name: '完整提示词', content: variant.fullText, enabled: true }]
    variant.structuredSnapshot = JSON.parse(JSON.stringify(variant.items))
    variant.mode = 'items'
  }

  const prepareFullTextConversion = () => {
    const variant = editorVariant.value
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
    const variant = editorVariant.value
    if (!variant || !conversionItems.value.length) return
    variant.items = JSON.parse(JSON.stringify(conversionItems.value))
    variant.structuredSnapshot = JSON.parse(JSON.stringify(conversionItems.value))
    variant.mode = 'items'
    conversionVisible.value = false
    showToast(`已转换为 ${variant.items.length} 个条目`)
  }

  const openItemEditor = (index = -1) => {
    const variant = editorVariant.value
    if (!variant) return
    itemEditIndex.value = index
    itemDraft.value = index >= 0
      ? JSON.parse(JSON.stringify(variant.items[index]))
      : { id: `custom_prompt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, name: '新提示词条目', content: '', enabled: true }
    itemEditorVisible.value = true
  }

  const saveItem = () => {
    const variant = editorVariant.value
    const item = itemDraft.value
    if (!variant || !item) return
    if (!item.name.trim() || !item.content.trim()) return showToast('条目名称和内容不能为空')
    if (itemEditIndex.value >= 0) variant.items[itemEditIndex.value] = item
    else variant.items.push(item)
    itemEditorVisible.value = false
  }

  const deleteItem = async (index: number) => {
    const variant = editorVariant.value
    if (!variant || editorDraft.value?.source === 'builtin') return
    if (await showConfirm('确定删除这个提示词条目吗？', '删除条目', true, 'danger')) variant.items.splice(index, 1)
  }

  const handlePromptDragStart = (index: number) => { dragPromptIndex.value = index }
  const handlePromptDragOver = (event: DragEvent, index: number) => {
    event.preventDefault()
    const variant = editorVariant.value
    if (!variant || dragPromptIndex.value === null || dragPromptIndex.value === index || editorDraft.value?.source === 'builtin') return
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
    const scheme = editorDraft.value || activeScheme.value
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
    const scheme = editorDraft.value || activeScheme.value
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
      importTextVisible.value = false
      importText.value = ''
      showToast(`已导入 ${schemes.length} 个方案`)
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
    const source = activeScheme.value
    if (!result || !source) return
    const scheme = createPromptSchemeCopy(source.id, result.name)
    scheme.description = result.description
    scheme.basePresetId = result.basePresetId
    const variant = scheme.variants[globalPromptSettings.language]
    variant.mode = result.mode
    variant.items = JSON.parse(JSON.stringify(result.items))
    variant.structuredSnapshot = JSON.parse(JSON.stringify(result.items))
    variant.fullText = result.fullText
    editorDraft.value = scheme
    aiVisible.value = false
    editorVisible.value = true
    showToast('已生成新方案草稿，确认内容后保存')
  }

  return {
    activeScheme, activeVariant, builtinSchemes, userSchemes, editorVisible, editorDraft, editorVariant,
    itemEditorVisible, itemDraft, dragPromptIndex, aiVisible, aiRequirement, aiLoading, aiError, aiResult,
    aiUnknownVariables, importTextVisible, importText, copyNameVisible, copyName, guideVisible, guideText,
    schemeManageMode, selectedSchemeIds, conversionVisible, conversionItems, toast, openSchemeEditor, createScheme,
    openCopyDialog, confirmSchemeCopy, saveEditor, switchScheme, switchLanguage, removeScheme, toggleSchemeManage,
    toggleSchemeSelection, toggleAllSchemes, removeSelectedSchemes, resetEditorToBuiltin, setEditorMode,
    convertFullTextToItem, prepareFullTextConversion, confirmFullTextConversion, openItemEditor,
    saveItem, deleteItem, handlePromptDragStart, handlePromptDragOver, handlePromptDragEnd, copyText,
    copyGuide, confirmCopyGuide, exportScheme, importSchemesFromText, importGeneratedText, openAiGenerator, runAiGenerator,
    cancelAiGenerator, applyAiResult, showToast
  }
}
