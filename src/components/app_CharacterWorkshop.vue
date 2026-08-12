<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { apiSettings, characterApiSettings, globalSettings } from '../store'
import { useCharacterWorkshop } from '../composables/useCharacterWorkshop'
import CharacterEmptyState from './character/CharacterEmptyState.vue'
import CharacterPublishModal from './character/CharacterPublishModal.vue'
import CharacterCandidateModal from './character/CharacterCandidateModal.vue'
import CharacterQualityModal from './character/CharacterQualityModal.vue'
import CharacterContactImportModal from './character/CharacterContactImportModal.vue'
import CharacterTemplateModal from './character/CharacterTemplateModal.vue'
import { useCharacterWorkshopFeatures } from '../composables/useCharacterWorkshopFeatures'
import type { CharacterDraft, CharacterGenerationInput, CharacterGenerationMode } from '../types/characterWorkshop'

const emit = defineEmits<{ close: []; 'open-chat': [contactId: string]; 'open-api': [] }>()
const workshop = useCharacterWorkshop()
const features = useCharacterWorkshopFeatures()
const { recentDrafts, publishedDrafts, activeDraft, isGenerating, generationStage, generationLabel, errorMessage, successMessage } = workshop
const { templates, contacts, candidates, isFeatureLoading, featureLabel } = features
const currentView = ref<'home' | 'workspace'>('home')
const homeFilter = ref<'all' | 'draft' | 'published'>('all')
const mobilePanel = ref<'brief' | 'profile' | 'studio'>('brief')
const publishVisible = ref(false)
const publishLoading = ref(false)
const deleteTarget = ref<CharacterDraft | null>(null)
const isSelectingDrafts = ref(false)
const selectedDraftIds = ref<string[]>([])
const batchDeleteVisible = ref(false)
const refineText = ref('')
const keywordText = ref('')
const expandedSection = ref('identity')
const candidateVisible = ref(false)
const qualityVisible = ref(false)
const contactImportVisible = ref(false)
const templateVisible = ref(false)

const modes: Array<{ id: CharacterGenerationMode; title: string; en: string; description: string; path: string }> = [
  { id: 'instant', title: '一键生成', en: 'INSTANT', description: '从零创造一个不落俗套、适合长期聊天的角色。', path: 'M12 3.5l1.5 4.1 4.1 1.5-4.1 1.5-1.5 4.1-1.5-4.1-4.1-1.5 4.1-1.5L12 3.5zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z' },
  { id: 'prompt', title: '提示词生成', en: 'PROMPT', description: '用一段自然语言描述人物、关系和你想要的感觉。', path: 'M5 5h14v10H9l-4 4V5zm4 4h6m-6 3h4' },
  { id: 'guided', title: '半手写', en: 'GUIDED', description: '锁定你在意的事实，让 AI 只补全还没有想好的部分。', path: 'M4 19.5l4.1-1 10.7-10.7-3.1-3.1L5 15.4l-1 4.1zm10-13.1l3.1 3.1' },
  { id: 'keywords', title: '关键词生成', en: 'KEYWORDS', description: '把零散标签变成有因果、有例外、有生活痕迹的人。', path: 'M4 7h10m-10 5h16M4 17h8M17 4l3 3-3 3' },
  { id: 'fandom', title: '同人生成', en: 'FANDOM', description: '尊重原作锚点，并明确控制改编与自由发挥的边界。', path: 'M6 4h9l3 3v13H6V4zm8 0v4h4M9 12h6m-6 4h5' },
  { id: 'dialogue', title: '对话反推', en: 'DIALOGUE', description: '从真实对白中提取语言指纹、判断方式和关系距离。', path: 'M5 5h14v11H8l-3 3V5zm4 4h6m-6 3h4' }
]

const generationInput = ref<CharacterGenerationInput>({
  mode: 'prompt', prompt: '', keywords: [], fandomSource: '', fandomCharacter: '', divergence: 'balanced',
  canonText: '', dialogueText: '', dialogueContext: '', candidateCount: 1,
  guided: { name: '', age: '', identity: '', relationship: '', personality: '', boundaries: '' }
})

const editorSections = [
  { id: 'identity', title: '身份与世界', summary: '名字、身份和所处环境', fields: [
    { key: 'name', label: '角色姓名', rows: 1, placeholder: '一个自然、符合背景的名字' },
    { key: 'tagline', label: '一句话印象', rows: 2, placeholder: '不使用标签堆砌，写下这个人最鲜明的张力' },
    { key: 'age', label: '年龄', rows: 1, placeholder: '年龄或年龄段' },
    { key: 'identity', label: '身份', rows: 2, placeholder: '职业、社会身份与当前处境' },
    { key: 'world', label: '世界背景', rows: 4, placeholder: '客观世界设定，发布时可拆入世界书' }
  ]},
  { id: 'core', title: '人格内核', summary: '欲望、恐惧和内在矛盾', fields: [
    { key: 'core', label: '稳定人格', rows: 5, placeholder: '他关注什么、怎样判断、通常如何行动' },
    { key: 'desire', label: '核心欲望', rows: 3, placeholder: '长期真正想得到或守住什么' },
    { key: 'fear', label: '恐惧与软肋', rows: 3, placeholder: '害怕什么，以及会如何掩饰' },
    { key: 'contradiction', label: '内在矛盾', rows: 4, placeholder: '至少一处能产生真实选择的冲突' },
    { key: 'lifestyle', label: '独立生活', rows: 4, placeholder: '工作、朋友、作息、正在进行的事情' }
  ]},
  { id: 'relationship', title: '关系行为', summary: '亲密、关心、冲突与边界', fields: [
    { key: 'relationship', label: '初始关系', rows: 4, placeholder: '与用户现在是什么关系，知道彼此多少' },
    { key: 'careStyle', label: '表达关心', rows: 3, placeholder: '用具体行为，而不是万能安慰' },
    { key: 'conflictStyle', label: '处理冲突', rows: 4, placeholder: '不满如何发生、升级和缓和' },
    { key: 'independence', label: '独立性', rows: 3, placeholder: '与用户无关的目标、责任和注意力' },
    { key: 'boundaries', label: '关系边界', rows: 4, placeholder: '会拒绝什么，不会替用户做什么决定' }
  ]},
  { id: 'voice', title: '表达画像', summary: '语言节奏与禁止套路', fields: [
    { key: 'voice', label: '语言气质', rows: 4, placeholder: '句长、信息密度、直接程度、幽默方式' },
    { key: 'verbalHabits', label: '自然习惯', rows: 3, placeholder: '只写可变化的倾向，不强塞固定口癖' },
    { key: 'antiPatterns', label: '禁止模式', rows: 5, placeholder: '不会说的套话、不会出现的机器式回应' },
    { key: 'knowledgeLimits', label: '知识边界', rows: 3, placeholder: '知道什么，不知道什么，如何面对未知' },
    { key: 'openingLine', label: '开场消息', rows: 3, placeholder: '第一次进入聊天时自然会发出的消息' }
  ]}
]

const nodeReady = computed(() => {
  const target = characterApiSettings.enabled ? characterApiSettings : apiSettings
  const url = target.provider === 'custom' ? target.customUrl : target.url
  const key = target.provider === 'custom' ? target.customKey : target.key
  return Boolean(url && key && target.model)
})
const filteredDrafts = computed(() => recentDrafts.value.filter(item => homeFilter.value === 'all' || item.status === homeFilter.value || (homeFilter.value === 'draft' && item.status === 'ready')))
const allFilteredSelected = computed(() => filteredDrafts.value.length > 0 && filteredDrafts.value.every(item => selectedDraftIds.value.includes(item.id)))
const completion = computed(() => {
  const draft = activeDraft.value
  if (!draft) return 0
  const fields = ['name', 'identity', 'core', 'contradiction', 'relationship', 'voice', 'antiPatterns', 'boundaries']
  return Math.round(fields.filter(key => String((draft as any)[key] || '').trim()).length / fields.length * 100)
})

const openMode = (mode: CharacterGenerationMode) => {
  generationInput.value.mode = mode
  workshop.createDraft(mode)
  currentView.value = 'workspace'
  mobilePanel.value = 'brief'
}
const openStoredDraft = (id: string) => {
  const draft = workshop.openDraft(id)
  if (!draft) return
  generationInput.value.mode = draft.mode
  generationInput.value.prompt = draft.sourcePrompt
  generationInput.value.keywords = [...draft.keywords]
  currentView.value = 'workspace'
}
const goHome = () => { if (activeDraft.value) workshop.saveDraft(activeDraft.value); currentView.value = 'home'; errorMessage.value = ''; successMessage.value = '' }
const addKeyword = () => {
  const values = keywordText.value.split(/[，,、\n]/).map(item => item.trim()).filter(Boolean)
  generationInput.value.keywords = [...new Set([...generationInput.value.keywords, ...values])].slice(0, 12)
  keywordText.value = ''
}
const removeKeyword = (keyword: string) => { generationInput.value.keywords = generationInput.value.keywords.filter(item => item !== keyword) }
const toggleLock = (key: string) => {
  if (!activeDraft.value) return
  const locks = activeDraft.value.lockedFields
  activeDraft.value.lockedFields = locks.includes(key) ? locks.filter(item => item !== key) : [...locks, key]
}
const updateField = (key: string, event: Event) => { if (activeDraft.value) (activeDraft.value as any)[key] = (event.target as HTMLInputElement).value }

const runGeneration = async () => {
  if (!nodeReady.value || isGenerating.value) return
  if (generationInput.value.mode === 'prompt' && !generationInput.value.prompt.trim()) return
  if (generationInput.value.mode === 'keywords' && generationInput.value.keywords.length === 0) return
  if (generationInput.value.mode === 'dialogue' && !generationInput.value.dialogueText.trim()) return
  if (generationInput.value.candidateCount > 1) {
    candidateVisible.value = true
    try { await features.buildCandidates(generationInput.value) } catch (error: any) { candidateVisible.value = false; errorMessage.value = error?.message || '候选生成失败。' }
    return
  }
  try { await workshop.generate(generationInput.value); mobilePanel.value = 'profile' } catch { /* 错误由工作台呈现 */ }
}
const selectCandidate = async (candidate: any) => {
  if (!activeDraft.value) return
  features.applyCandidate(activeDraft.value, candidate)
  for (const key of ['name', 'identity', 'core', 'contradiction', 'voice', 'relationship']) if (!activeDraft.value.lockedFields.includes(key)) activeDraft.value.lockedFields.push(key)
  generationInput.value.candidateCount = 1
  candidateVisible.value = false
  try { await workshop.generate(generationInput.value); mobilePanel.value = 'profile' } catch { /* 工作台显示错误 */ }
}
const runRefine = async () => {
  if (!refineText.value.trim() || isGenerating.value) return
  try { await workshop.refine(refineText.value); refineText.value = ''; mobilePanel.value = 'profile' } catch { /* 错误由工作台呈现 */ }
}
const handlePublish = async (options: { createWorldBook: boolean; autoSplitWorldBook: boolean; openChat: boolean }) => {
  publishLoading.value = true
  try {
    const contactId = await workshop.publish({ createWorldBook: options.createWorldBook, autoSplitWorldBook: options.autoSplitWorldBook })
    publishVisible.value = false
    if (options.openChat) emit('open-chat', contactId)
  } catch (error: any) { errorMessage.value = error?.message || '发布失败，请稍后重试。' }
  finally { publishLoading.value = false }
}
const runInspection = async () => { if (!activeDraft.value) return; try { await features.inspect(activeDraft.value); workshop.saveDraft(activeDraft.value, '角色体检') } catch (e: any) { errorMessage.value = e?.message || '体检失败。' } }
const runOptimization = async () => { if (!activeDraft.value) return; try { workshop.saveDraft(activeDraft.value, '体检优化前'); await features.optimizeByReport(activeDraft.value); workshop.saveDraft(activeDraft.value, '按体检报告优化') } catch (e: any) { errorMessage.value = e?.message || '优化失败。' } }
const runModelReview = async () => { if (!activeDraft.value) return; try { await features.review(activeDraft.value); workshop.saveDraft(activeDraft.value, '多模型评审') } catch (e: any) { errorMessage.value = e?.message || '模型评审失败。' } }
const runCanonAudit = async () => { if (!activeDraft.value) return; try { await features.auditCanon(activeDraft.value); workshop.saveDraft(activeDraft.value, '原作一致性检查') } catch (e: any) { errorMessage.value = e?.message || '原作检查失败。' } }
const inspectExistingContact = async (contact: any) => {
  try { const draft = await features.importContactForInspection(contact); workshop.saveDraft(draft, '导入现有人设并体检'); contactImportVisible.value = false; currentView.value = 'workspace'; mobilePanel.value = 'profile'; qualityVisible.value = true }
  catch (e: any) { errorMessage.value = e?.message || '现有人设分析失败。' }
}
const useTemplate = (template: any) => { const draft = features.createFromTemplate(template); workshop.saveDraft(draft, '从本地模板创建'); templateVisible.value = false; currentView.value = 'workspace'; mobilePanel.value = 'profile' }
const importDraft = async (file: File) => { try { const draft = await features.importDraftFile(file); workshop.saveDraft(draft, '导入角色文件'); templateVisible.value = false; currentView.value = 'workspace'; mobilePanel.value = 'profile' } catch (e: any) { errorMessage.value = e?.message || '导入失败。' } }
const confirmDelete = () => { if (deleteTarget.value) workshop.deleteDraft(deleteTarget.value.id); deleteTarget.value = null }
const toggleDraftSelection = (id: string) => {
  selectedDraftIds.value = selectedDraftIds.value.includes(id)
    ? selectedDraftIds.value.filter(item => item !== id)
    : [...selectedDraftIds.value, id]
}
const toggleSelectAll = () => {
  const visibleIds = filteredDrafts.value.map(item => item.id)
  selectedDraftIds.value = allFilteredSelected.value
    ? selectedDraftIds.value.filter(id => !visibleIds.includes(id))
    : [...new Set([...selectedDraftIds.value, ...visibleIds])]
}
const exitSelection = () => { isSelectingDrafts.value = false; selectedDraftIds.value = [] }
const confirmBatchDelete = () => {
  workshop.deleteDrafts(selectedDraftIds.value)
  batchDeleteVisible.value = false
  exitSelection()
}
const formatTime = (timestamp: number) => new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(timestamp)

let saveTimer: ReturnType<typeof setTimeout> | null = null
watch(activeDraft, draft => {
  if (!draft || isGenerating.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => workshop.saveDraft(draft), 600)
}, { deep: true })
onBeforeUnmount(() => { if (saveTimer) clearTimeout(saveTimer); if (isGenerating.value) workshop.stopGeneration(); if (activeDraft.value) workshop.saveDraft(activeDraft.value) })
</script>

<template>
  <div class="character-workshop" :class="{ 'is-dark': globalSettings.darkMode }">
    <header class="cw-app-header">
      <button class="cw-icon-button" type="button" :aria-label="currentView === 'home' ? '返回桌面' : '返回角色工坊首页'" @click="currentView === 'home' ? emit('close') : goHome()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
      </button>
      <div class="cw-brand"><span class="cw-brand-mark"></span><div><strong>角色工坊</strong><small>CHARACTER ATELIER</small></div></div>
      <div class="cw-header-actions">
        <button v-if="currentView === 'workspace'" class="cw-button ghost compact" type="button" :disabled="!activeDraft || isFeatureLoading" @click="qualityVisible = true">质量中心</button>
        <button class="cw-button ghost compact cw-template-trigger" type="button" @click="templateVisible = true">模板与文件</button>
        <button v-if="currentView === 'workspace'" class="cw-button ghost compact" type="button" :disabled="!activeDraft || isGenerating" @click="activeDraft && workshop.saveDraft(activeDraft)">保存</button>
        <button v-if="currentView === 'workspace'" class="cw-button primary compact" type="button" :disabled="!activeDraft?.name.trim() || isGenerating" @click="publishVisible = true">{{ activeDraft?.publishedContactId ? '同步' : '发布' }}</button>
        <button v-else class="cw-icon-button" type="button" aria-label="打开 API 节点设置" @click="emit('open-api')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/></svg></button>
      </div>
    </header>

    <main v-if="currentView === 'home'" class="cw-home">
      <section class="cw-hero">
        <div><p class="cw-kicker">BUILD SOMEONE, NOT A TEMPLATE</p><h1>写下一个人，<br><em>让相遇从这里开始。</em></h1><p class="cw-hero-copy">从模糊的感觉到可以长期相处的完整角色。保留矛盾、边界、生活和真实的说话方式。</p></div>
        <div class="cw-hero-orbit" aria-hidden="true"><i></i><i></i><i></i><span><svg viewBox="0 0 24 24"><path d="M12 3.5l1.5 4.1 4.1 1.5-4.1 1.5-1.5 4.1-1.5-4.1-4.1-1.5 4.1-1.5L12 3.5z"/></svg></span></div>
      </section>

      <section class="cw-home-tools" aria-label="角色维护工具">
        <button type="button" @click="contactImportVisible = true"><span><svg viewBox="0 0 24 24"><path d="M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM4 21a8 8 0 0 1 16 0M18 5l1.5 1.5L22 4"/></svg></span><div><small>PERSONA CLINIC</small><strong>体检现有聊天角色</strong><p>复制为独立草稿，找出机器味、关系失衡和长期演绎风险。</p></div><svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5l5 5-5 5"/></svg></button>
        <button type="button" @click="templateVisible = true"><span><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5"/></svg></span><div><small>LOCAL LIBRARY</small><strong>模板、导入与分享</strong><p>复用本地模板，或用 JSON 文件跨设备备份和分享角色。</p></div><svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5l5 5-5 5"/></svg></button>
      </section>

      <section class="cw-section">
        <div class="cw-section-heading"><div><span>01</span><h2>从哪里开始</h2></div><p>六种入口，共用同一套角色档案与质量标准。</p></div>
        <div class="cw-mode-grid">
          <button v-for="mode in modes" :key="mode.id" class="cw-mode-card" type="button" @click="openMode(mode.id)">
            <span class="cw-mode-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path :d="mode.path"/></svg></span>
            <small>{{ mode.en }}</small><strong>{{ mode.title }}</strong><p>{{ mode.description }}</p><span class="cw-card-arrow"><svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5l5 5-5 5"/></svg></span>
          </button>
        </div>
      </section>

      <section class="cw-section library-section">
        <div class="cw-section-heading"><div><span>02</span><h2>角色档案</h2></div><div class="cw-library-controls"><div class="cw-filter-tabs" role="tablist"><button v-for="item in [{id:'all',label:'全部'},{id:'draft',label:'草稿'},{id:'published',label:'已发布'}]" :key="item.id" type="button" :class="{ active: homeFilter === item.id }" @click="homeFilter = item.id as any">{{ item.label }}</button></div><button v-if="!isSelectingDrafts && filteredDrafts.length" class="cw-manage-button" type="button" @click="isSelectingDrafts = true">批量管理</button></div></div>
        <div v-if="isSelectingDrafts" class="cw-selection-toolbar"><button type="button" @click="toggleSelectAll"><span class="cw-checkbox" :class="{ checked: allFilteredSelected }"><svg viewBox="0 0 24 24"><path d="M5 12.5l4 4L19 7"/></svg></span>{{ allFilteredSelected ? '取消全选' : '全选当前列表' }}</button><span>已选择 {{ selectedDraftIds.length }} 项</span><div><button type="button" @click="exitSelection">取消</button><button class="danger" type="button" :disabled="!selectedDraftIds.length" @click="batchDeleteVisible = true">删除所选</button></div></div>
        <div v-if="filteredDrafts.length" class="cw-library-grid">
          <article v-for="draft in filteredDrafts" :key="draft.id" class="cw-character-card" :class="{ selected: selectedDraftIds.includes(draft.id), selecting: isSelectingDrafts }" tabindex="0" :aria-selected="isSelectingDrafts ? selectedDraftIds.includes(draft.id) : undefined" @click="isSelectingDrafts ? toggleDraftSelection(draft.id) : openStoredDraft(draft.id)" @keydown.enter="isSelectingDrafts ? toggleDraftSelection(draft.id) : openStoredDraft(draft.id)">
            <span v-if="isSelectingDrafts" class="cw-card-checkbox cw-checkbox" :class="{ checked: selectedDraftIds.includes(draft.id) }"><svg viewBox="0 0 24 24"><path d="M5 12.5l4 4L19 7"/></svg></span>
            <div class="cw-character-monogram">{{ draft.name?.charAt(0) || '未' }}</div>
            <div class="cw-character-info"><div><span class="cw-status" :class="draft.status">{{ draft.status === 'published' ? '已发布' : draft.status === 'ready' ? '待校准' : '草稿' }}</span><small>{{ formatTime(draft.updatedAt) }}</small></div><h3>{{ draft.name || '未命名角色' }}</h3><p>{{ draft.tagline || draft.sourcePrompt || '等待你写下第一笔。' }}</p><div class="cw-keyword-row"><span v-for="keyword in draft.keywords.slice(0, 3)" :key="keyword">{{ keyword }}</span></div></div>
            <button v-if="!isSelectingDrafts" class="cw-card-menu" type="button" aria-label="删除角色草稿" @click.stop="deleteTarget = draft"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></button>
          </article>
        </div>
        <CharacterEmptyState v-else title="这里还没有角色" description="选择上方任一种方式开始。未完成的内容会自动保存，不必一次想清所有细节。" />
      </section>
    </main>

    <main v-else-if="activeDraft" class="cw-workspace">
      <nav class="cw-mobile-tabs" aria-label="工作台区域"><button :class="{ active: mobilePanel === 'brief' }" @click="mobilePanel = 'brief'">构思</button><button :class="{ active: mobilePanel === 'profile' }" @click="mobilePanel = 'profile'">档案</button><button :class="{ active: mobilePanel === 'studio' }" @click="mobilePanel = 'studio'">共创</button></nav>

      <aside class="cw-brief-panel" :class="{ 'mobile-active': mobilePanel === 'brief' }">
        <div class="cw-panel-title"><p class="cw-kicker">GENERATION BRIEF</p><h2>告诉我你想遇见谁</h2><p>先给方向，不必把每个细节一次写完。</p></div>
        <div class="cw-mode-select" role="tablist"><button v-for="mode in modes" :key="mode.id" type="button" :class="{ active: generationInput.mode === mode.id }" :title="mode.title" @click="generationInput.mode = mode.id"><svg viewBox="0 0 24 24"><path :d="mode.path"/></svg><span>{{ mode.title }}</span></button></div>

        <div class="cw-brief-form">
          <template v-if="generationInput.mode === 'instant'"><div class="cw-insight-card"><svg viewBox="0 0 24 24"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1m0-12.8l-2.1 2.1m-8.6 8.6l-2.1 2.1"/><circle cx="12" cy="12" r="4"/></svg><strong>保留意外感</strong><p>工坊会主动避开高频人设模板，并让角色拥有与用户无关的生活线。</p></div></template>
          <template v-else-if="generationInput.mode === 'prompt'"><label class="cw-field"><span>角色描述 <i>必填</i></span><textarea v-model="generationInput.prompt" rows="10" placeholder="例如：一个在旧书店工作的年轻人。话不多，但不是冷漠；对陌生人有礼貌，对熟人偶尔刻薄。和我刚认识，不要一上来就过度亲密……"></textarea><small>{{ generationInput.prompt.length }}/2000</small></label></template>
          <template v-else-if="generationInput.mode === 'guided'">
            <label v-for="field in [{k:'name',l:'姓名'},{k:'age',l:'年龄'},{k:'identity',l:'身份'},{k:'relationship',l:'初始关系'},{k:'personality',l:'性格想法'},{k:'boundaries',l:'明确边界'}]" :key="field.k" class="cw-field"><span>{{ field.l }}</span><input :value="(generationInput.guided as any)[field.k]" :placeholder="`可留空，由 AI 补全${field.l}`" @input="(generationInput.guided as any)[field.k] = ($event.target as HTMLInputElement).value"></label>
          </template>
          <template v-else-if="generationInput.mode === 'keywords'"><label class="cw-field"><span>添加关键词</span><div class="cw-inline-input"><input v-model="keywordText" placeholder="输入后按回车，例如：寡言、兽医、慢热" @keydown.enter.prevent="addKeyword"><button type="button" @click="addKeyword">添加</button></div></label><div class="cw-keyword-editor"><button v-for="keyword in generationInput.keywords" :key="keyword" type="button" @click="removeKeyword(keyword)">{{ keyword }}<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg></button><p v-if="!generationInput.keywords.length">关键词会出现在这里，最多保留 12 个。</p></div></template>
          <template v-else-if="generationInput.mode === 'fandom'"><label class="cw-field"><span>作品或世界</span><input v-model="generationInput.fandomSource" placeholder="作品名与采用的时间线"></label><label class="cw-field"><span>目标角色</span><input v-model="generationInput.fandomCharacter" placeholder="角色姓名"></label><fieldset class="cw-segment-field"><legend>改编程度</legend><label v-for="item in [{id:'canon',label:'贴近原作'},{id:'balanced',label:'平衡'},{id:'free',label:'自由衍生'}]" :key="item.id"><input v-model="generationInput.divergence" type="radio" :value="item.id"><span>{{ item.label }}</span></label></fieldset><label class="cw-field"><span>原作锚点 <i>一行一条</i></span><textarea v-model="generationInput.canonText" rows="7" placeholder="只填写你能确认的事实，例如：\n讨厌被陌生人触碰\n在第二章离开家乡\n不会主动谈论父亲"></textarea></label><label class="cw-field"><span>衍生要求</span><textarea v-model="generationInput.prompt" rows="4" placeholder="关系、情境与允许补写的空白；未知资料不会被当作事实"></textarea></label></template>
          <template v-else><label class="cw-field"><span>对话发生在什么情境</span><input v-model="generationInput.dialogueContext" placeholder="例如：争执后和好、刚认识、工作中的语音"></label><label class="cw-field"><span>角色对话样本 <i>必填</i></span><textarea v-model="generationInput.dialogueText" rows="12" placeholder="粘贴尽可能自然、包含不同情绪的对白。工坊会提取判断方式、句式节奏与关系距离，不会照抄隐私信息。"></textarea><small>{{ generationInput.dialogueText.length }}/12000</small></label><label class="cw-field"><span>补充要求</span><textarea v-model="generationInput.prompt" rows="4" placeholder="哪些部分可以推断，哪些必须保留未知"></textarea></label></template>
          <fieldset class="cw-segment-field cw-candidate-choice"><legend>生成几个候选方向</legend><label v-for="item in [{id:1,label:'直接生成'},{id:2,label:'比较 2 个'},{id:3,label:'比较 3 个'}]" :key="item.id"><input v-model="generationInput.candidateCount" type="radio" :value="item.id"><span>{{ item.label }}</span></label></fieldset>
        </div>
        <div v-if="!nodeReady" class="cw-inline-alert error"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg><span>API 节点尚未配置完整。</span><button type="button" @click="emit('open-api')">去设置</button></div>
        <button class="cw-generate-button" type="button" :disabled="isGenerating || isFeatureLoading || !nodeReady || (generationInput.mode === 'prompt' && !generationInput.prompt.trim()) || (generationInput.mode === 'keywords' && !generationInput.keywords.length) || (generationInput.mode === 'dialogue' && !generationInput.dialogueText.trim())" @click="runGeneration"><span v-if="isGenerating || isFeatureLoading" class="cw-spinner"></span><svg v-else viewBox="0 0 24 24"><path d="M12 3.5l1.5 4.1 4.1 1.5-4.1 1.5-1.5 4.1-1.5-4.1-4.1-1.5 4.1-1.5L12 3.5z"/></svg>{{ isFeatureLoading ? featureLabel : isGenerating ? generationLabel : generationInput.candidateCount > 1 ? `生成并比较 ${generationInput.candidateCount} 个候选` : (activeDraft.status === 'draft' ? '生成完整角色' : '重新生成未锁定内容') }}</button>
      </aside>

      <section class="cw-profile-panel" :class="{ 'mobile-active': mobilePanel === 'profile' }">
        <header class="cw-profile-header"><div><p class="cw-kicker">LIVE CHARACTER FILE</p><h1>{{ activeDraft.name || '未命名角色' }}</h1><p>{{ activeDraft.tagline || '档案会随着你的书写实时生长。' }}</p></div><div class="cw-completion"><strong>{{ completion }}%</strong><span><i :style="{ width: `${completion}%` }"></i></span><small>档案完整度</small></div></header>
        <div v-if="errorMessage" class="cw-banner error" role="alert"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg><span>{{ errorMessage }}</span><button type="button" aria-label="关闭错误" @click="errorMessage = ''">×</button></div>
        <div v-if="successMessage" class="cw-banner success" role="status"><svg viewBox="0 0 24 24"><path d="M5 12.5l4 4L19 7"/></svg><span>{{ successMessage }}</span><button type="button" aria-label="关闭提示" @click="successMessage = ''">×</button></div>
        <div class="cw-editor-sections">
          <section v-for="section in editorSections" :key="section.id" class="cw-editor-section" :class="{ expanded: expandedSection === section.id }">
            <button class="cw-section-toggle" type="button" :aria-expanded="expandedSection === section.id" @click="expandedSection = expandedSection === section.id ? '' : section.id"><span><i>{{ String(editorSections.indexOf(section) + 1).padStart(2, '0') }}</i><strong>{{ section.title }}</strong><small>{{ section.summary }}</small></span><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg></button>
            <div v-show="expandedSection === section.id" class="cw-section-fields">
              <label v-for="field in section.fields" :key="field.key" class="cw-field editor-field"><span>{{ field.label }}<button type="button" :class="{ locked: activeDraft.lockedFields.includes(field.key) }" :aria-label="`${activeDraft.lockedFields.includes(field.key) ? '解锁' : '锁定'}${field.label}`" @click.prevent="toggleLock(field.key)"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path :d="activeDraft.lockedFields.includes(field.key) ? 'M8 10V7a4 4 0 0 1 8 0v3' : 'M8 10V7a4 4 0 0 1 7.5-2'"/></svg>{{ activeDraft.lockedFields.includes(field.key) ? '已锁定' : '锁定' }}</button></span><textarea :value="String((activeDraft as any)[field.key] || '')" :rows="field.rows" :placeholder="field.placeholder" @input="updateField(field.key, $event)"></textarea></label>
            </div>
          </section>
        </div>
      </section>

      <aside class="cw-studio-panel" :class="{ 'mobile-active': mobilePanel === 'studio' }">
        <div class="cw-panel-title"><p class="cw-kicker">CO-CREATION STUDIO</p><h2>和 AI 一起校准</h2><p>描述你感觉“不对”的地方。锁定的字段不会被修改。</p></div>
        <div class="cw-refine-box"><textarea v-model="refineText" rows="5" placeholder="例如：他现在太像温柔客服了。保留耐心，但让他有自己的判断，不要每次都安慰或反问。"></textarea><div><small>{{ activeDraft.lockedFields.length }} 个字段已锁定</small><button type="button" :disabled="!refineText.trim() || isGenerating || !nodeReady" @click="runRefine"><span v-if="isGenerating" class="cw-spinner"></span><svg v-else viewBox="0 0 24 24"><path d="M4 12h13m-5-5l5 5-5 5M19 5v14"/></svg>应用修改</button></div></div>

        <button class="cw-quality-launch" type="button" :disabled="isFeatureLoading" @click="qualityVisible = true"><span><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 9h8m-8 4h5m-5 4h7"/></svg></span><div><small>QUALITY LAB</small><strong>体检、评审与原作检查</strong><p>{{ activeDraft.healthReport ? `最近体检 ${activeDraft.healthReport.score} 分` : '先诊断，再决定是否自动优化' }}</p></div><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>

        <section class="cw-studio-section"><div class="cw-studio-heading"><h3>对白试演</h3><span>{{ activeDraft.samples.length }} 个场景</span></div><div v-if="activeDraft.samples.length" class="cw-sample-list"><article v-for="(sample, index) in activeDraft.samples" :key="`${sample.scene}-${index}`"><small>{{ sample.scene }}</small><p><b>你</b>{{ sample.user }}</p><p><b>{{ activeDraft.name || '角色' }}</b>{{ sample.character }}</p></article></div><CharacterEmptyState v-else title="还没有试演" description="完成生成后，这里会用六种高频场景检查套话、过度亲密和固定反问。" /></section>
        <section class="cw-studio-section"><div class="cw-studio-heading"><h3>版本记录</h3><span>最多保留 20 版</span></div><div v-if="activeDraft.versions.length" class="cw-version-list"><button v-for="version in activeDraft.versions" :key="version.id" type="button" @click="workshop.restoreVersion(version.id)"><span><strong>{{ version.label }}</strong><small>{{ formatTime(version.createdAt) }}</small></span><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2L4 8m0-4v4h4"/></svg></button></div><p v-else class="cw-muted-copy">生成、AI 修改和发布时会自动建立可恢复的版本。</p></section>
      </aside>

      <div v-if="isGenerating" class="cw-generation-overlay" role="status" aria-live="polite"><div><span class="cw-generation-symbol"><i></i><svg viewBox="0 0 24 24"><path d="M12 3.5l1.5 4.1 4.1 1.5-4.1 1.5-1.5 4.1-1.5-4.1-4.1-1.5 4.1-1.5L12 3.5z"/></svg></span><p class="cw-kicker">STAGE {{ generationStage || 1 }} / 4</p><strong>{{ generationLabel || '正在整理角色档案' }}</strong><p>每完成一个阶段都会自动保存；暂停后可以从未完成的阶段继续。</p><div class="cw-stage-progress"><i v-for="stage in 4" :key="stage" :class="{ done: stage <= (generationStage || 1) }"></i></div><button class="cw-stop-generation" type="button" @click="workshop.stopGeneration"><svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1"/></svg>暂停生成</button></div></div>
    </main>

    <CharacterPublishModal v-if="publishVisible && activeDraft" :draft="activeDraft" :loading="publishLoading" @close="publishVisible = false" @publish="handlePublish" />
    <CharacterCandidateModal v-if="candidateVisible" :candidates="candidates" :loading="isFeatureLoading" @close="candidateVisible = false" @select="selectCandidate" />
    <CharacterQualityModal v-if="qualityVisible && activeDraft" :draft="activeDraft" :loading="isFeatureLoading" :loading-label="featureLabel" @close="qualityVisible = false" @inspect="runInspection" @optimize="runOptimization" @review="runModelReview" @audit="runCanonAudit" />
    <CharacterContactImportModal v-if="contactImportVisible" :contacts="contacts" :loading="isFeatureLoading" :loading-label="featureLabel" @close="contactImportVisible = false" @select="inspectExistingContact" />
    <CharacterTemplateModal v-if="templateVisible" :templates="templates" :active-draft="activeDraft" @close="templateVisible = false" @use="useTemplate" @save="activeDraft && features.saveAsTemplate(activeDraft)" @delete="features.deleteTemplate" @export="activeDraft && features.exportDraft(activeDraft)" @import="importDraft" />
    <div v-if="deleteTarget" class="cw-modal-backdrop" @click.self="deleteTarget = null"><section class="cw-confirm-modal" role="alertdialog" aria-modal="true"><span class="cw-confirm-icon"><svg viewBox="0 0 24 24"><path d="M5 7h14m-9-3h4m-7 3l1 13h8l1-13M10 11v5m4-5v5"/></svg></span><h2>删除这个角色草稿？</h2><p>“{{ deleteTarget.name || '未命名角色' }}”的档案与版本记录会被移除；已经发布到聊天的联系人不会被删除。</p><div><button class="cw-button secondary" type="button" @click="deleteTarget = null">取消</button><button class="cw-button danger" type="button" @click="confirmDelete">删除草稿</button></div></section></div>
    <div v-if="batchDeleteVisible" class="cw-modal-backdrop" @click.self="batchDeleteVisible = false"><section class="cw-confirm-modal" role="alertdialog" aria-modal="true"><span class="cw-confirm-icon"><svg viewBox="0 0 24 24"><path d="M5 7h14m-9-3h4m-7 3l1 13h8l1-13M10 11v5m4-5v5"/></svg></span><h2>删除选中的 {{ selectedDraftIds.length }} 个角色？</h2><p>所选档案与版本记录会被移除；已经发布到聊天的联系人不会被删除。</p><div><button class="cw-button secondary" type="button" @click="batchDeleteVisible = false">取消</button><button class="cw-button danger" type="button" @click="confirmBatchDelete">确认删除</button></div></section></div>
  </div>
</template>

<style src="./app_CharacterWorkshop.css"></style>
