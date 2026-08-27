<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { isApiSettingsReady, resolveApiCapability, globalSettings } from '../store'
import { usePersonaWorkshop } from '../composables/usePersonaWorkshop'
import { mockChats } from '../composables/chatState/state'
import type { PersonaDraft, PersonaGenerationInput, PersonaWorkshopMode } from '../types/personaWorkshop'

const emit = defineEmits<{ close: []; 'open-api': [] }>()
const workshop = usePersonaWorkshop()
const { recentDrafts, activeDraft, isWorking, workLabel, generationStage, errorMessage, successMessage } = workshop
const currentView = ref<'home' | 'workspace'>('home')
const mobilePanel = ref<'brief' | 'profile' | 'studio'>('brief')
const homeFilter = ref<'all' | 'draft' | 'published'>('all')
const expandedSection = ref('identity')
const keywordText = ref('')
const refineText = ref('')
const deleteTarget = ref<PersonaDraft | null>(null)
const publishVisible = ref(false)
const importVisible = ref(false)
const healthVisible = ref(false)
const libraryPersonas = ref<any[]>([])
const bindAccount = ref(false)
const applyToChats = ref(false)
const targetChatIds = ref<Array<string | number>>([])

const modes: Array<{ id: PersonaWorkshopMode; title: string; en: string; description: string; path: string }> = [
  { id: 'prompt', title: '自由描述', en: 'DESCRIBE', description: '写下你希望对方了解的自己，AI 帮你整理成稳定档案。', path: 'M5 5h14v10H9l-4 4V5zm4 4h6m-6 3h4' },
  { id: 'guided', title: '引导填写', en: 'GUIDED', description: '先确认身份、生活与边界，只补全尚未想清的部分。', path: 'M4 19.5l4.1-1 10.7-10.7-3.1-3.1L5 15.4l-1 4.1zm10-13.1l3.1 3.1' },
  { id: 'keywords', title: '关键词', en: 'KEYWORDS', description: '把零散标签变成有条件、有例外的真实倾向。', path: 'M4 7h10m-10 5h16M4 17h8M17 4l3 3-3 3' },
  { id: 'interview', title: '访谈梳理', en: 'INTERVIEW', description: '回答六个核心问题，让档案更接近你对自己的理解。', path: 'M12 3a8 8 0 1 0 8 8M9 10h6M9 14h4M18 17l2 2 3-4' },
  { id: 'dialogue', title: '对话反推', en: 'DIALOGUE', description: '从你说过的话中辨认表达节奏与稳定判断方式。', path: 'M5 5h14v11H8l-3 3V5zm4 4h6m-6 3h4' },
  { id: 'inspiration', title: '剧情灵感', en: 'STORY SELF', description: '生成有局限、有生活的虚构身份，用于剧情或角色扮演。', path: 'M12 3.5l1.5 4.1 4.1 1.5-4.1 1.5-1.5 4.1-1.5-4.1-4.1-1.5 4.1-1.5L12 3.5z' }
]

const generationInput = ref<PersonaGenerationInput>({
  mode: 'prompt', kind: 'self', prompt: '', keywords: [], dialogueText: '', dialogueContext: '',
  guided: { name: '', age: '', identity: '', personality: '', life: '', boundaries: '' },
  interview: { selfView: '', importantThings: '', dailyLife: '', closeness: '', conflict: '', misunderstood: '' }
})

const editorSections = [
  { id: 'identity', title: '身份与生活', summary: '称呼、身份和所处背景', fields: [
    { key: 'name', label: '希望被称呼', rows: 1, placeholder: '角色在聊天中如何称呼你' },
    { key: 'networkName', label: '网名', rows: 1, placeholder: '可留空，发布后仍可在人设库修改' },
    { key: 'tagline', label: '一句话印象', rows: 2, placeholder: '简洁概括你希望被理解的样子' },
    { key: 'age', label: '年龄', rows: 1, placeholder: '现实自我没有提供时保持未知' },
    { key: 'pronouns', label: '性别与称谓', rows: 1, placeholder: '希望使用的性别表达或称谓' },
    { key: 'identity', label: '当前身份', rows: 3, placeholder: '职业、学业、社会身份或剧情身份' },
    { key: 'world', label: '所处背景', rows: 3, placeholder: '现实背景或剧情世界观' },
    { key: 'lifestyle', label: '当前生活', rows: 4, placeholder: '作息、责任、朋友和正在进行的事情' },
    { key: 'interests', label: '兴趣与厌恶', rows: 3, placeholder: '写倾向和原因，不要求每次聊天都提及' }
  ]},
  { id: 'core', title: '人格内核', summary: '判断、目标与内在张力', fields: [
    { key: 'core', label: '稳定人格', rows: 5, placeholder: '通常关注什么、怎样判断、在什么情况下会例外' },
    { key: 'values', label: '重视的事', rows: 3, placeholder: '真正影响选择的价值与原则' },
    { key: 'goals', label: '当前目标', rows: 3, placeholder: '近期或长期想完成、守住的事情' },
    { key: 'vulnerabilities', label: '软肋与脆弱', rows: 3, placeholder: '只写你愿意让角色知道的部分' },
    { key: 'contradiction', label: '内在矛盾', rows: 4, placeholder: '互相拉扯的需求、习惯或选择' }
  ]},
  { id: 'interaction', title: '互动画像', summary: '表达、亲近和冲突方式', fields: [
    { key: 'voice', label: '表达方式', rows: 4, placeholder: '句子节奏、直接程度、幽默和信息密度' },
    { key: 'socialDistance', label: '关系距离', rows: 3, placeholder: '面对陌生人和熟人时有什么不同' },
    { key: 'carePreference', label: '希望怎样被关心', rows: 3, placeholder: '偏好倾听、建议、陪伴或留出空间' },
    { key: 'conflictStyle', label: '面对冲突', rows: 4, placeholder: '不满如何表达，又如何恢复沟通' }
  ]},
  { id: 'boundaries', title: '理解边界', summary: '敏感点、未知项和禁止推断', fields: [
    { key: 'boundaries', label: '明确边界', rows: 4, placeholder: '不希望被怎样对待或替你决定什么' },
    { key: 'sensitivities', label: '容易被误解', rows: 4, placeholder: '哪些表现常被别人理解错' },
    { key: 'unknowns', label: '仍然未知', rows: 4, placeholder: '没有提供、需要保持未知的信息' },
    { key: 'antiAssumptions', label: '禁止擅自推断', rows: 5, placeholder: '不得替你补写感受、行动、同意、承诺或关系结论' }
  ]}
]

const nodeReady = computed(() => {
  const target = resolveApiCapability('character-workshop').settings
  return Boolean(target && isApiSettingsReady(target))
})
const filteredDrafts = computed(() => recentDrafts.value.filter(item => homeFilter.value === 'all' || (homeFilter.value === 'published' ? item.status === 'published' : item.status !== 'published')))
const selectableChats = computed(() => mockChats.value.filter(chat => chat.id !== 1))
const completion = computed(() => {
  if (!activeDraft.value) return 0
  const fields = ['name', 'core', 'values', 'lifestyle', 'voice', 'boundaries', 'unknowns', 'antiAssumptions']
  return Math.round(fields.filter(key => String((activeDraft.value as any)[key] || '').trim()).length / fields.length * 100)
})
const generationAllowed = computed(() => {
  const input = generationInput.value
  if (input.mode === 'prompt') return Boolean(input.prompt.trim())
  if (input.mode === 'keywords') return input.keywords.length > 0
  if (input.mode === 'dialogue') return Boolean(input.dialogueText.trim())
  if (input.mode === 'interview') return Object.values(input.interview).some(value => value.trim())
  return true
})

const openMode = (mode: PersonaWorkshopMode) => {
  generationInput.value.mode = mode
  generationInput.value.kind = mode === 'inspiration' ? 'roleplay' : 'self'
  workshop.createDraft(mode, generationInput.value.kind)
  currentView.value = 'workspace'
  mobilePanel.value = 'brief'
}
const openStoredDraft = (id: string) => {
  const draft = workshop.openDraft(id)
  if (!draft) return
  generationInput.value.mode = draft.mode
  generationInput.value.kind = draft.kind
  generationInput.value.prompt = draft.sourcePrompt
  generationInput.value.keywords = [...draft.keywords]
  currentView.value = 'workspace'
}
const goHome = () => { if (activeDraft.value) workshop.saveDraft(activeDraft.value); currentView.value = 'home'; errorMessage.value = ''; successMessage.value = '' }
const updateField = (key: string, event: Event) => { if (activeDraft.value) (activeDraft.value as any)[key] = (event.target as HTMLTextAreaElement).value }
const toggleLock = (key: string) => { if (activeDraft.value) activeDraft.value.lockedFields = activeDraft.value.lockedFields.includes(key) ? activeDraft.value.lockedFields.filter(item => item !== key) : [...activeDraft.value.lockedFields, key] }
const addKeyword = () => { generationInput.value.keywords = [...new Set([...generationInput.value.keywords, ...keywordText.value.split(/[，,、\n]/).map(item => item.trim()).filter(Boolean)])].slice(0, 12); keywordText.value = '' }
const removeKeyword = (keyword: string) => { generationInput.value.keywords = generationInput.value.keywords.filter(item => item !== keyword) }
const runGeneration = async () => { try { await workshop.generate(generationInput.value); mobilePanel.value = 'profile' } catch {} }
const runRefine = async () => { if (!refineText.value.trim()) return; try { await workshop.refine(refineText.value); refineText.value = ''; mobilePanel.value = 'profile' } catch {} }
const runInspect = async () => { try { await workshop.inspect(); healthVisible.value = true } catch (error: any) { errorMessage.value = error?.message || '体检失败。' } }
const runSimulate = async () => { try { await workshop.simulate() } catch (error: any) { errorMessage.value = error?.message || '理解试演失败。' } }
const openImport = async () => { libraryPersonas.value = await workshop.loadUserPersonas(); importVisible.value = true }
const importPersona = (persona: any) => { workshop.importPersona(persona); generationInput.value = { ...generationInput.value, mode: 'prompt', kind: 'self', prompt: persona.signature || '' }; importVisible.value = false; currentView.value = 'workspace'; mobilePanel.value = 'profile' }
const openPublish = async () => {
  const personas = await workshop.loadUserPersonas()
  const source = activeDraft.value?.publishedPersonaId ? personas.find(item => item.id === activeDraft.value?.publishedPersonaId) : null
  bindAccount.value = Boolean(source?.boundAccountId)
  applyToChats.value = false
  targetChatIds.value = []
  publishVisible.value = true
}
const publish = async () => { try { await workshop.publish({ bindAccount: bindAccount.value, targetChatIds: applyToChats.value ? targetChatIds.value : [] }); publishVisible.value = false } catch (error: any) { errorMessage.value = error?.message || '发布失败。' } }
const toggleTargetChat = (id: string | number) => { targetChatIds.value = targetChatIds.value.map(String).includes(String(id)) ? targetChatIds.value.filter(item => String(item) !== String(id)) : [...targetChatIds.value, id] }
const confirmDelete = () => { if (deleteTarget.value) workshop.deleteDraft(deleteTarget.value.id); deleteTarget.value = null }
const formatTime = (timestamp: number) => new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(timestamp)

let saveTimer: ReturnType<typeof setTimeout> | null = null
watch(activeDraft, draft => { if (!draft || isWorking.value) return; if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(() => workshop.saveDraft(draft), 600) }, { deep: true })
onBeforeUnmount(() => { if (saveTimer) clearTimeout(saveTimer); if (isWorking.value) workshop.stop(); if (activeDraft.value) workshop.saveDraft(activeDraft.value) })
</script>

<template>
  <div class="character-workshop persona-workshop" :class="{ 'is-dark': globalSettings.darkMode }">
    <header class="cw-app-header">
      <div class="cw-brand"><span class="cw-brand-mark pw-brand-mark"></span><div><strong>人设工坊</strong><small>PERSONA ATELIER</small></div></div>
      <div class="cw-header-actions">
        <button v-if="currentView === 'workspace'" class="cw-button ghost compact pw-header-text" type="button" @click="goHome">返回档案</button>
        <button v-if="currentView === 'workspace' && activeDraft" class="cw-button primary compact" type="button" @click="openPublish">发布</button>
        <button class="cw-icon-button" type="button" aria-label="关闭人设工坊" @click="emit('close')"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
    </header>

    <main v-if="currentView === 'home'" class="cw-home">
      <section class="cw-hero pw-hero">
        <div><p class="cw-kicker">HOW SHOULD THEY KNOW YOU?</p><h1>让对方真正<br><em>理解你</em></h1><p class="cw-hero-copy">把零散的自我描述整理成清晰、克制的人设档案。保留未知，说明边界，也给长期相处留下自然变化的空间。</p></div>
        <div class="cw-hero-orbit pw-orbit" aria-hidden="true"><i></i><i></i><i></i><span><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0M4 5h3M17 5h3M12 16v3"/></svg></span></div>
      </section>
      <section class="cw-home-tools">
        <button type="button" @click="openImport"><span><svg viewBox="0 0 24 24"><path d="M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM4 21a8 8 0 0 1 16 0M18 5l1.5 1.5L22 4"/></svg></span><div><small>EXISTING PERSONA</small><strong>整理现有人设</strong><p>从人设库复制为草稿，保留原档案，重新拆分与校准。</p></div><svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5l5 5-5 5"/></svg></button>
        <button type="button" @click="emit('open-api')"><span><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/></svg></span><div><small>GENERATION NODE</small><strong>生成节点设置</strong><p>人设整理使用角色生成节点；未单独启用时沿用全局 API。</p></div><svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5l5 5-5 5"/></svg></button>
      </section>
      <section class="cw-section">
        <div class="cw-section-heading"><div><span>01</span><h2>从哪里开始</h2></div><p>现实自我重在准确，剧情身份允许自由创作。</p></div>
        <div class="cw-mode-grid">
          <button v-for="mode in modes" :key="mode.id" class="cw-mode-card" type="button" @click="openMode(mode.id)"><span class="cw-mode-icon"><svg viewBox="0 0 24 24"><path :d="mode.path"/></svg></span><small>{{ mode.en }}</small><strong>{{ mode.title }}</strong><p>{{ mode.description }}</p><span class="cw-card-arrow"><svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5l5 5-5 5"/></svg></span></button>
        </div>
      </section>
      <section class="cw-section library-section">
        <div class="cw-section-heading"><div><span>02</span><h2>我的档案</h2></div><div class="cw-library-controls"><div class="cw-filter-tabs"><button v-for="item in [{id:'all',label:'全部'},{id:'draft',label:'草稿'},{id:'published',label:'已发布'}]" :key="item.id" :class="{ active: homeFilter === item.id }" @click="homeFilter = item.id as any">{{ item.label }}</button></div></div></div>
        <div v-if="filteredDrafts.length" class="cw-library-grid">
          <article v-for="draft in filteredDrafts" :key="draft.id" class="cw-character-card" tabindex="0" @click="openStoredDraft(draft.id)" @keydown.enter="openStoredDraft(draft.id)"><div class="cw-character-monogram">{{ draft.name?.charAt(0) || '我' }}</div><div class="cw-character-info"><div><span class="cw-status" :class="draft.status">{{ draft.status === 'published' ? '已发布' : draft.status === 'ready' ? '待校准' : '草稿' }}</span><small>{{ draft.kind === 'self' ? '现实自我' : '剧情身份' }} · {{ formatTime(draft.updatedAt) }}</small></div><h3>{{ draft.name || '未命名人设' }}</h3><p>{{ draft.tagline || draft.core || '等待你写下第一笔。' }}</p><div class="cw-keyword-row"><span v-for="keyword in draft.keywords.slice(0,3)" :key="keyword">{{ keyword }}</span></div></div><button class="cw-card-menu" type="button" aria-label="删除人设草稿" @click.stop="deleteTarget = draft"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></button></article>
        </div>
        <div v-else class="cw-empty-state"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg><strong>这里还没有人设草稿</strong><p>选择上方任一种方式开始。未完成的内容会自动保存。</p></div>
      </section>
    </main>

    <main v-else-if="activeDraft" class="cw-workspace">
      <nav class="cw-mobile-tabs"><button :class="{ active: mobilePanel === 'brief' }" @click="mobilePanel = 'brief'">构思</button><button :class="{ active: mobilePanel === 'profile' }" @click="mobilePanel = 'profile'">档案</button><button :class="{ active: mobilePanel === 'studio' }" @click="mobilePanel = 'studio'">校准</button></nav>
      <aside class="cw-brief-panel" :class="{ 'mobile-active': mobilePanel === 'brief' }">
        <div class="cw-panel-title"><p class="cw-kicker">PERSONA BRIEF</p><h2>你希望怎样被认识</h2><p>现实自我不会补造事实；剧情身份可以自由展开。</p></div>
        <fieldset class="cw-segment-field pw-kind-choice"><legend>人设类型</legend><label><input v-model="generationInput.kind" type="radio" value="self"><span>现实自我</span></label><label><input v-model="generationInput.kind" type="radio" value="roleplay"><span>剧情身份</span></label></fieldset>
        <div class="cw-mode-select pw-mode-select"><button v-for="mode in modes" :key="mode.id" :class="{ active: generationInput.mode === mode.id }" :title="mode.title" @click="generationInput.mode = mode.id"><svg viewBox="0 0 24 24"><path :d="mode.path"/></svg><span>{{ mode.title }}</span></button></div>
        <div class="cw-brief-form">
          <template v-if="generationInput.mode === 'prompt' || generationInput.mode === 'inspiration'"><label class="cw-field"><span>{{ generationInput.mode === 'inspiration' ? '剧情身份方向' : '自我描述' }} <i>必填</i></span><textarea v-model="generationInput.prompt" rows="10" :placeholder="generationInput.mode === 'inspiration' ? '例如：蒸汽都市里的钟表修复师，冷静但不疏离，有一件一直拖着没完成的事……' : '例如：我慢热，但不等于冷漠。熟悉后话会多一些；难过时更希望对方先听我说，不要立刻给建议……'"></textarea></label></template>
          <template v-else-if="generationInput.mode === 'guided'"><label v-for="field in [{k:'name',l:'希望被称呼'},{k:'age',l:'年龄'},{k:'identity',l:'身份'},{k:'personality',l:'性格想法'},{k:'life',l:'当前生活'},{k:'boundaries',l:'明确边界'}]" :key="field.k" class="cw-field"><span>{{ field.l }}</span><input :value="(generationInput.guided as any)[field.k]" :placeholder="`可留空：${field.l}`" @input="(generationInput.guided as any)[field.k] = ($event.target as HTMLInputElement).value"></label><label class="cw-field"><span>补充说明</span><textarea v-model="generationInput.prompt" rows="4" placeholder="其他希望保留的事实或表达偏好"></textarea></label></template>
          <template v-else-if="generationInput.mode === 'keywords'"><label class="cw-field"><span>添加关键词</span><div class="cw-inline-input"><input v-model="keywordText" placeholder="例如：慢热、学生、怕麻烦" @keydown.enter.prevent="addKeyword"><button type="button" @click="addKeyword">添加</button></div></label><div class="cw-keyword-editor"><button v-for="keyword in generationInput.keywords" :key="keyword" @click="removeKeyword(keyword)">{{ keyword }}<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg></button><p v-if="!generationInput.keywords.length">最多保留 12 个关键词。</p></div></template>
          <template v-else-if="generationInput.mode === 'interview'"><label v-for="field in [{k:'selfView',l:'你通常怎样描述自己'},{k:'importantThings',l:'什么真正影响你的选择'},{k:'dailyLife',l:'你最近的生活是什么状态'},{k:'closeness',l:'你怎样与人变得亲近'},{k:'conflict',l:'意见不同时你通常怎样反应'},{k:'misunderstood',l:'你最不希望被怎样误解'}]" :key="field.k" class="cw-field"><span>{{ field.l }}</span><textarea :value="(generationInput.interview as any)[field.k]" rows="3" placeholder="可以简短回答，也可以暂时留空" @input="(generationInput.interview as any)[field.k] = ($event.target as HTMLTextAreaElement).value"></textarea></label></template>
          <template v-else><label class="cw-field"><span>对话背景</span><input v-model="generationInput.dialogueContext" placeholder="这些话是在什么关系或情境下说的"></label><label class="cw-field"><span>你的对话样本 <i>必填</i></span><textarea v-model="generationInput.dialogueText" rows="13" placeholder="只粘贴你本人说过的话。工坊会区分稳定表达与当时情绪，不会把对方的人设算到你身上。"></textarea></label></template>
        </div>
        <div v-if="!nodeReady" class="cw-inline-alert error"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg><span>API 节点尚未配置完整。</span><button @click="emit('open-api')">去设置</button></div>
        <button class="cw-generate-button" type="button" :disabled="isWorking || !nodeReady || !generationAllowed" @click="runGeneration"><span v-if="isWorking" class="cw-spinner"></span><svg v-else viewBox="0 0 24 24"><path d="M12 3.5l1.5 4.1 4.1 1.5-4.1 1.5-1.5 4.1-1.5-4.1-4.1-1.5 4.1-1.5L12 3.5z"/></svg>{{ isWorking ? workLabel : activeDraft.status === 'draft' ? '整理完整人设' : '重新整理未锁定内容' }}</button>
      </aside>

      <section class="cw-profile-panel" :class="{ 'mobile-active': mobilePanel === 'profile' }">
        <header class="cw-profile-header"><div><p class="cw-kicker">LIVE PERSONA FILE</p><h1>{{ activeDraft.name || '未命名人设' }}</h1><p>{{ activeDraft.tagline || '档案只描述你确认的自己，并为未知留出位置。' }}</p></div><div class="cw-completion"><strong>{{ completion }}%</strong><span><i :style="{ width: `${completion}%` }"></i></span><small>档案完整度</small></div></header>
        <div v-if="errorMessage" class="cw-banner error"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg><span>{{ errorMessage }}</span><button @click="errorMessage = ''">×</button></div>
        <div v-if="successMessage" class="cw-banner success"><svg viewBox="0 0 24 24"><path d="M5 12.5l4 4L19 7"/></svg><span>{{ successMessage }}</span><button @click="successMessage = ''">×</button></div>
        <div class="cw-editor-sections"><section v-for="section in editorSections" :key="section.id" class="cw-editor-section" :class="{ expanded: expandedSection === section.id }"><button class="cw-section-toggle" @click="expandedSection = expandedSection === section.id ? '' : section.id"><span><i>{{ String(editorSections.indexOf(section)+1).padStart(2,'0') }}</i><strong>{{ section.title }}</strong><small>{{ section.summary }}</small></span><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg></button><div v-show="expandedSection === section.id" class="cw-section-fields"><label v-for="field in section.fields" :key="field.key" class="cw-field editor-field"><span>{{ field.label }}<button :class="{ locked: activeDraft.lockedFields.includes(field.key) }" @click.prevent="toggleLock(field.key)"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path :d="activeDraft.lockedFields.includes(field.key) ? 'M8 10V7a4 4 0 0 1 8 0v3' : 'M8 10V7a4 4 0 0 1 7.5-2'"/></svg>{{ activeDraft.lockedFields.includes(field.key) ? '已锁定' : '锁定' }}</button></span><textarea :value="String((activeDraft as any)[field.key] || '')" :rows="field.rows" :placeholder="field.placeholder" @input="updateField(field.key, $event)"></textarea></label></div></section></div>
      </section>

      <aside class="cw-studio-panel" :class="{ 'mobile-active': mobilePanel === 'studio' }">
        <div class="cw-panel-title"><p class="cw-kicker">CALIBRATION STUDIO</p><h2>校准别人如何理解你</h2><p>锁定的字段不会被 AI 修改。现实自我不会补造身份事实。</p></div>
        <div class="cw-refine-box"><textarea v-model="refineText" rows="5" placeholder="例如：保留慢热，但不要写成社恐。我只是面对陌生人不主动。"></textarea><div><small>{{ activeDraft.lockedFields.length }} 个字段已锁定</small><button :disabled="!refineText.trim() || isWorking || !nodeReady" @click="runRefine"><span v-if="isWorking" class="cw-spinner"></span><svg v-else viewBox="0 0 24 24"><path d="M4 12h13m-5-5l5 5-5 5M19 5v14"/></svg>应用修改</button></div></div>
        <div class="pw-studio-actions"><button :disabled="isWorking || !nodeReady" @click="runInspect"><span>体检</span><small>{{ activeDraft.healthReport ? `${activeDraft.healthReport.score} 分 · 查看报告` : '检查误读、越界与隐私风险' }}</small></button><button :disabled="isWorking || !nodeReady" @click="runSimulate"><span>理解试演</span><small>{{ activeDraft.understandingSamples.length ? `已生成 ${activeDraft.understandingSamples.length} 个场景` : '看看角色可能如何理解你' }}</small></button></div>
        <section v-if="activeDraft.understandingSamples.length" class="cw-studio-section"><div class="cw-studio-heading"><h3>理解试演</h3><span>{{ activeDraft.understandingSamples.length }} 个场景</span></div><div class="pw-sample-list"><article v-for="sample in activeDraft.understandingSamples" :key="sample.scene"><small>{{ sample.scene }}</small><p>{{ sample.likelyUnderstanding }}</p><em>{{ sample.guardrail }}</em></article></div></section>
        <section class="cw-studio-section"><div class="cw-studio-heading"><h3>版本记录</h3><span>最多 20 版</span></div><div v-if="activeDraft.versions.length" class="cw-version-list"><button v-for="version in activeDraft.versions" :key="version.id" @click="workshop.restoreVersion(version.id)"><span><strong>{{ version.label }}</strong><small>{{ formatTime(version.createdAt) }}</small></span><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2L4 8m0-4v4h4"/></svg></button></div><p v-else class="cw-muted-copy">生成、AI 修改、体检和发布会建立可恢复的版本。</p></section>
      </aside>
      <div v-if="isWorking" class="cw-generation-overlay"><div><span class="cw-generation-symbol"><i></i><svg viewBox="0 0 24 24"><path d="M12 3.5l1.5 4.1 4.1 1.5-4.1 1.5-1.5 4.1-1.5-4.1-4.1-1.5 4.1-1.5L12 3.5z"/></svg></span><p class="cw-kicker">{{ generationStage ? `STAGE ${generationStage} / 3` : 'CALIBRATING' }}</p><strong>{{ workLabel || '正在整理人设档案' }}</strong><p>已完成的内容会自动保存。</p><button class="cw-stop-generation" @click="workshop.stop">暂停</button></div></div>
    </main>

    <div v-if="importVisible" class="cw-modal-backdrop" @click.self="importVisible = false"><section class="cw-publish-modal pw-library-modal"><header class="cw-modal-header"><div><p class="cw-kicker">PERSONA LIBRARY</p><h2>整理现有人设</h2><p>会创建独立草稿，不直接改动人设库中的原档案。</p></div><button class="cw-icon-button" @click="importVisible = false"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header><div v-if="libraryPersonas.length" class="cw-contact-list"><button v-for="persona in libraryPersonas" :key="persona.id" @click="importPersona(persona)"><span>{{ (persona.name || persona.networkName || '我').charAt(0) }}</span><div><strong>{{ persona.name || persona.networkName || '未命名人设' }}</strong><small>{{ persona.signature || '暂无详细人设' }}</small></div><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div><div v-else class="cw-empty-state pw-modal-empty"><strong>人设库还是空的</strong><p>可以返回首页，从任一种方式创建第一份人设。</p></div></section></div>

    <div v-if="publishVisible && activeDraft" class="cw-modal-backdrop" @click.self="publishVisible = false"><section class="cw-publish-modal pw-publish-modal"><header class="cw-modal-header"><div><p class="cw-kicker">PUBLISH PERSONA</p><h2>保存与应用</h2><p>“{{ activeDraft.name || '未命名人设' }}”会默认保存到人设库；其余设置只在你主动选择时生效。</p></div><button class="cw-icon-button" @click="publishVisible = false"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header><div class="pw-publish-body"><div class="pw-option fixed"><span class="pw-check checked"><svg viewBox="0 0 24 24"><path d="M5 12.5l4 4L19 7"/></svg></span><div><strong>保存到人设库</strong><small>发布后可以继续在人设库查看和编辑。</small></div><b>默认</b></div><label class="pw-option"><input v-model="bindAccount" type="checkbox"><span class="pw-check" :class="{ checked: bindAccount }"><svg viewBox="0 0 24 24"><path d="M5 12.5l4 4L19 7"/></svg></span><div><strong>绑定当前账号</strong><small>作为账号默认身份，供选择“账号人设”的聊天使用。</small></div></label><label class="pw-option"><input v-model="applyToChats" type="checkbox"><span class="pw-check" :class="{ checked: applyToChats }"><svg viewBox="0 0 24 24"><path d="M5 12.5l4 4L19 7"/></svg></span><div><strong>应用到指定聊天</strong><small>只修改所选聊天中的用户身份，不清除聊天和记忆。</small></div></label><div v-if="applyToChats" class="pw-chat-list"><button v-for="chat in selectableChats" :key="chat.id" type="button" :class="{ selected: targetChatIds.map(String).includes(String(chat.id)) }" @click="toggleTargetChat(chat.id)"><span>{{ chat.avatarText || chat.name?.charAt(0) || '聊' }}</span><strong>{{ chat.name || '未命名聊天' }}</strong><i class="pw-check" :class="{ checked: targetChatIds.map(String).includes(String(chat.id)) }"><svg viewBox="0 0 24 24"><path d="M5 12.5l4 4L19 7"/></svg></i></button><p v-if="!selectableChats.length">暂无可应用的聊天。</p></div></div><footer class="cw-modal-actions"><button class="cw-button secondary" @click="publishVisible = false">取消</button><button class="cw-button primary" @click="publish">保存人设</button></footer></section></div>

    <div v-if="healthVisible && activeDraft?.healthReport" class="cw-modal-backdrop" @click.self="healthVisible = false"><section class="cw-publish-modal pw-health-modal"><header class="cw-modal-header"><div><p class="cw-kicker">PERSONA CHECKUP</p><h2>人设体检</h2><p>{{ activeDraft.healthReport.summary }}</p></div><strong class="pw-score">{{ activeDraft.healthReport.score }}</strong><button class="cw-icon-button" @click="healthVisible = false"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header><div class="pw-health-body"><div class="cw-strength-list"><span v-for="item in activeDraft.healthReport.strengths" :key="item">{{ item }}</span></div><div v-if="activeDraft.healthReport.issues.length" class="cw-issue-list"><article v-for="issue in activeDraft.healthReport.issues" :key="issue.title" :class="issue.severity"><div><span>{{ issue.category }}</span><strong>{{ issue.title }}</strong></div><p>{{ issue.detail }}</p><small>{{ issue.suggestion }}</small></article></div><div v-else class="cw-empty-state pw-modal-empty"><strong>没有发现明显风险</strong><p>这份档案已经能较清楚地描述你，同时保留必要的未知。</p></div></div></section></div>

    <div v-if="deleteTarget" class="cw-modal-backdrop" @click.self="deleteTarget = null"><section class="cw-confirm-modal"><h2>删除这个人设草稿？</h2><p>“{{ deleteTarget.name || '未命名人设' }}”的草稿和版本会被移除；已保存到人设库的档案不会被删除。</p><div><button class="cw-button secondary" @click="deleteTarget = null">取消</button><button class="cw-button danger" @click="confirmDelete">删除草稿</button></div></section></div>
  </div>
</template>

<style src="./app_CharacterWorkshop.css"></style>
<style src="./app_PersonaWorkshop.css"></style>
