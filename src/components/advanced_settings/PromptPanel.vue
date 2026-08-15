/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  activateTaskPromptLanguage,
  globalPromptSettings,
  groupPromptSettings,
  offlinePresetSettings,
  resetGroupPromptSettings,
  taskPromptSettings,
  taskSystemPromptItemIds,
  type PromptItem
} from '../../store'
import { getPromptVariables, buildPromptVariableGuide, findUnknownPromptVariables, type PromptVariableScope } from '../../services/promptVariables'
import { useAdvancedSettingsPrompt } from '../../composables/useAdvancedSettingsPrompt'
import { estimateTextTokens, formatEstimatedTokens } from '../../utils/tokenEstimate'
import ChatOfflinePresetModal from '../chat/modals/ChatOfflinePresetModal.vue'
import SearchableSelect from '../SearchableSelect.vue'

const props = defineProps<{ showConfirm: any }>()
const activePromptTab = ref<'normal' | 'group' | 'offline' | 'task'>('normal')
const variablesVisible = ref(false)
const variableScope = ref<PromptVariableScope>('global')
const offlineModalVisible = ref(false)
const offlineBridge = reactive({
  offlinePresetId: offlinePresetSettings.currentPresetId,
  offlineModelProfile: 'auto',
  offlineMeetEnabled: true
})

const prompt = useAdvancedSettingsPrompt(props.showConfirm)
const activeTokenLabel = computed(() => formatEstimatedTokens(estimateTextTokens(
  prompt.activeVariant.value?.mode === 'full'
    ? prompt.activeVariant.value.fullText
    : (prompt.activeVariant.value?.items || []).filter(item => item.enabled).map(item => item.content).join('\n\n')
)))
const viewingTokenLabel = computed(() => formatEstimatedTokens(estimateTextTokens(
  prompt.viewingVariant.value?.mode === 'full'
    ? prompt.viewingVariant.value.fullText
    : (prompt.viewingVariant.value?.items || []).filter(item => item.enabled).map(item => item.content).join('\n\n')
)))
const currentOfflinePresetName = computed(() => offlinePresetSettings.presets.find(item => item.id === offlinePresetSettings.currentPresetId)?.name || '官方 Default')
const variables = computed(() => getPromptVariables(variableScope.value))

const openVariables = (scope: PromptVariableScope) => {
  variableScope.value = scope
  variablesVisible.value = true
}

const insertVariable = async (token: string) => {
  const target = document.activeElement as HTMLTextAreaElement | HTMLInputElement | null
  if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') && !target.disabled) {
    const start = target.selectionStart ?? target.value.length
    const end = target.selectionEnd ?? start
    target.setRangeText(token, start, end, 'end')
    target.dispatchEvent(new Event('input', { bubbles: true }))
    target.focus()
    prompt.showToast(`已插入 ${token}`)
    return
  }
  await prompt.copyText(token, `已复制 ${token}`)
}

const copyAllVariables = () => prompt.copyText(buildPromptVariableGuide(variableScope.value), '已复制全部变量与说明')

const taskEditorVisible = ref(false)
const taskDraft = ref<PromptItem | null>(null)
const taskEditIndex = ref(-1)
const taskDragIndex = ref<number | null>(null)
const openTaskEditor = (index = -1) => {
  taskEditIndex.value = index
  taskDraft.value = index >= 0
    ? JSON.parse(JSON.stringify(taskPromptSettings.items[index]))
    : { id: `task_custom_${Date.now()}`, name: '新任务提示词', content: '', enabled: true }
  taskEditorVisible.value = true
}
const saveTaskEditor = () => {
  if (!taskDraft.value?.name.trim() || !taskDraft.value.content.trim()) return prompt.showToast('名称和内容不能为空')
  if (taskEditIndex.value >= 0) taskPromptSettings.items[taskEditIndex.value] = taskDraft.value
  else taskPromptSettings.items.push(taskDraft.value)
  taskEditorVisible.value = false
}
const deleteTaskItem = async (index: number) => {
  if (await props.showConfirm('确定删除这个特殊任务提示词吗？', '删除条目', true, 'danger')) taskPromptSettings.items.splice(index, 1)
}
const resetTaskItems = async () => {
  if (await props.showConfirm('恢复当前语言的官方任务提示词吗？自定义任务条目会保留。', '恢复默认')) activateTaskPromptLanguage(globalPromptSettings.language, true)
}
const taskDragStart = (index: number) => { taskDragIndex.value = index }
const taskDragOver = (event: DragEvent, index: number) => {
  event.preventDefault()
  if (taskDragIndex.value === null || taskDragIndex.value === index) return
  const [item] = taskPromptSettings.items.splice(taskDragIndex.value, 1)
  taskPromptSettings.items.splice(index, 0, item)
  taskDragIndex.value = index
}
const taskTokenLabel = computed(() => formatEstimatedTokens(estimateTextTokens(taskPromptSettings.items.filter(item => item.enabled).map(item => item.content).join('\n\n'))))

const groupEditorVisible = ref(false)
const groupDraft = ref<PromptItem | null>(null)
const groupEditIndex = ref(-1)
const openGroupEditor = (index = -1) => {
  groupEditIndex.value = index
  groupDraft.value = index >= 0
    ? JSON.parse(JSON.stringify(groupPromptSettings.items[index]))
    : { id: `group_custom_${Date.now()}`, name: '新群聊提示词', content: '', enabled: true }
  groupEditorVisible.value = true
}
const saveGroupEditor = () => {
  if (!groupDraft.value?.name.trim() || !groupDraft.value.content.trim()) return prompt.showToast('名称和内容不能为空')
  if (groupEditIndex.value >= 0) groupPromptSettings.items[groupEditIndex.value] = groupDraft.value
  else groupPromptSettings.items.push(groupDraft.value)
  groupEditorVisible.value = false
}
const deleteGroupItem = async (index: number) => {
  if (await props.showConfirm('确定删除这个群聊提示词吗？', '删除条目', true, 'danger')) groupPromptSettings.items.splice(index, 1)
}
const resetGroupItems = async () => {
  if (await props.showConfirm('恢复官方群聊提示词吗？当前修改会被覆盖。', '恢复默认')) resetGroupPromptSettings()
}
const groupTokenLabel = computed(() => formatEstimatedTokens(estimateTextTokens(groupPromptSettings.items.filter(item => item.enabled).map(item => item.content).join('\n\n'))))

const viewingUnknownVariables = computed(() => {
  const variant = prompt.viewingVariant.value
  if (!variant) return []
  const content = variant.mode === 'full' ? variant.fullText : variant.items.map(item => item.content).join('\n')
  return findUnknownPromptVariables(content, 'global')
})

const syncOfflineBridge = () => {
  offlinePresetSettings.currentPresetId = offlineBridge.offlinePresetId || offlinePresetSettings.currentPresetId
}

const allSchemeOptions = computed(() => {
  const builtins = prompt.builtinSchemes.value.map(s => ({ value: s.id, label: `[内置] ${s.name}` }))
  const users = prompt.userSchemes.value.map(s => ({ value: s.id, label: s.name }))
  return [...builtins, ...users]
})
</script>

<template>
  <div class="settings-panel">
    <div class="mag-header">
      <div class="mag-title-box"><span class="mag-title">全局提示词</span><span class="mag-subtitle">System Prompts</span></div>
      <div class="mag-desc">管理常规聊天、群聊、线下互动与特殊任务的底层提示词。群聊规则独立生效，不会改变单聊提示词。</div>
    </div>

    <div class="mag-tabs main-tabs">
      <button class="mag-tab-btn" :class="{ active: activePromptTab === 'normal' }" @click="activePromptTab = 'normal'">常规聊天</button>
      <button class="mag-tab-btn" :class="{ active: activePromptTab === 'group' }" @click="activePromptTab = 'group'">群聊</button>
      <button class="mag-tab-btn" :class="{ active: activePromptTab === 'offline' }" @click="activePromptTab = 'offline'">线下互动</button>
      <button class="mag-tab-btn" :class="{ active: activePromptTab === 'task' }" @click="activePromptTab = 'task'">特殊任务</button>
    </div>

    <template v-if="activePromptTab === 'normal'">
      <div class="prompt-version-card">
        <div class="prompt-version-copy"><span class="mag-list-label">当前方案</span><span class="prompt-version-desc">使用 {{ prompt.viewingScheme.value?.source === 'builtin' ? '内置' : '自定义' }} 方案，{{ globalPromptSettings.language === 'en' ? '英文' : '中文' }}指令 · {{ viewingTokenLabel }}</span></div>
        <div class="mag-tabs prompt-version-tabs">
          <button class="mag-tab-btn" :class="{ active: globalPromptSettings.language === 'zh' }" @click="prompt.switchLanguage('zh')">中文</button>
          <button class="mag-tab-btn" :class="{ active: globalPromptSettings.language === 'en' }" @click="prompt.switchLanguage('en')">English</button>
        </div>
      </div>

      <div class="mag-settings-card">
        <div class="scheme-toolbar">
          <div class="scheme-selector-wrapper">
            <SearchableSelect
              v-model="prompt.viewingSchemeId.value"
              :options="allSchemeOptions"
              placeholder="选择预设方案"
              :searchable="true"
              @update:modelValue="prompt.switchScheme($event)"
            />
          </div>
          <div class="header-actions">
            <button class="mag-icon-text-btn" @click="prompt.createScheme('blank')">+ 新建</button>
            <button class="mag-icon-text-btn" @click="prompt.openCopyDialog()">复制副本</button>
            <button class="mag-icon-text-btn" @click="prompt.importTextVisible.value = true">导入</button>
            <button class="mag-icon-text-btn" @click="prompt.openAiGenerator">AI 生成</button>
            <button v-if="prompt.viewingScheme.value?.source === 'user'" class="mag-icon-text-btn danger" @click="prompt.removeScheme(prompt.viewingSchemeId.value)">删除当前</button>
          </div>
        </div>

        <template v-if="prompt.viewingScheme.value">
          <div v-if="prompt.viewingScheme.value.source === 'builtin'" class="readonly-notice">当前为内置方案，内容永久只读。如果需要修改条目，请点击右上角“复制副本”创建一个自定义方案。</div>
          <template v-else>
            <div class="form-row scheme-meta-row">
              <input v-model="prompt.viewingScheme.value.name" class="simple-modal-input" placeholder="方案名称" maxlength="40">
              <input v-model="prompt.viewingScheme.value.description" class="simple-modal-input" placeholder="方案说明（选填）" maxlength="160">
            </div>
            <div class="editor-mode-switch">
              <button :class="{ active: prompt.viewingVariant.value?.mode === 'items' }" @click="prompt.setEditorMode('items')">条目模式</button>
              <button :class="{ active: prompt.viewingVariant.value?.mode === 'full' }" @click="prompt.setEditorMode('full')">全文大框</button>
            </div>
          </template>

          <template v-if="prompt.viewingVariant.value?.mode === 'items'">
            <div class="entries-toolbar">
              <span>共 {{ prompt.viewingVariant.value.items.length }} 个条目</span>
              <div>
                <button @click="openVariables('global')">可用变量</button>
                <button v-if="prompt.viewingScheme.value.source === 'user'" @click="prompt.openItemEditor()">+ 新增条目</button>
              </div>
            </div>
            <div class="cot-list">
              <div v-for="(item, index) in prompt.viewingVariant.value.items" :key="item.id" class="cot-item-card compact" :class="{ 'is-dragging': prompt.dragPromptIndex.value === index }" :draggable="prompt.viewingScheme.value.source === 'user'" @dragstart="prompt.handlePromptDragStart(index)" @dragover="prompt.handlePromptDragOver($event, index)" @dragend="prompt.handlePromptDragEnd">
                <div class="cot-card-top">
                  <span class="drag-handle" v-if="prompt.viewingScheme.value.source === 'user'">排序</span>
                  <span class="cot-item-name">{{ item.name }}</span>
                  <div class="spacer"></div>
                  <label class="toggle-switch mini">
                    <input v-model="item.enabled" type="checkbox" :disabled="prompt.viewingScheme.value.source === 'builtin'">
                    <span class="slider"></span>
                  </label>
                </div>
                <div class="entry-preview">{{ item.content.slice(0, 120) || '暂无内容' }}</div>
                <div class="cot-card-bottom">
                  <span class="cot-tag">{{ item.content.length }} 字</span>
                  <div class="cot-item-actions">
                    <button class="icon-btn edit" @click="prompt.openItemEditor(index)">{{ prompt.viewingScheme.value.source === 'builtin' ? '查看详情' : '编辑' }}</button>
                    <button v-if="prompt.viewingScheme.value.source === 'user'" class="icon-btn delete" @click="prompt.deleteItem(index)">删除</button>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template v-else-if="prompt.viewingVariant.value">
            <div class="raw-mode-note">按“## 条目名称”或“【条目名称】”分段编写，可自动转换为多个条目。</div>
            <div class="entries-toolbar">
              <span>完整提示词全文</span>
              <div>
                <button @click="openVariables('global')">可用变量</button>
                <button v-if="prompt.viewingScheme.value.source === 'user'" @click="prompt.prepareFullTextConversion">按标题格式转为条目</button>
              </div>
            </div>
            <textarea v-model="prompt.viewingVariant.value.fullText" class="simple-modal-input textarea full-textarea" :disabled="prompt.viewingScheme.value.source === 'builtin'" spellcheck="false" placeholder="在这里整体编写提示词……"></textarea>
          </template>
          
          <div v-if="viewingUnknownVariables.length" class="validation-warning">当前包含系统不支持的未知变量：{{ viewingUnknownVariables.join('、') }}。未知变量会原样发送给模型。</div>
        </template>
        
        <div class="library-footer" style="margin-top: 24px;">
          <button v-if="prompt.viewingScheme.value?.source === 'user'" class="mag-icon-text-btn" @click="prompt.resetEditorToBuiltin">恢复官方预设内容</button>
          <div class="spacer"></div>
          <button class="mag-icon-text-btn" @click="prompt.copyGuide">复制本方案给 AI 的生成说明</button>
          <button class="mag-icon-text-btn" @click="prompt.exportScheme">导出当前方案到文件</button>
        </div>
      </div>
    </template>

    <template v-else-if="activePromptTab === 'group'">
      <div class="prompt-version-card">
        <div class="prompt-version-copy"><span class="mag-list-label">群聊专属提示词</span><span class="prompt-version-desc">每次群聊只调用一次模型，由模型在同一次返回中自然决定谁发言、顺序、条数和篇幅 · {{ groupTokenLabel }}</span></div>
        <button class="mag-btn primary" @click="openGroupEditor()">+ 新增</button>
      </div>
      <div class="mag-settings-card">
        <div class="readonly-notice">角色不是围绕用户工作的助手。群背景为空时不会注入任何群背景段落；本页不提供发言概率、人数、顺序或句数等数值控制。</div>
        <div class="cot-list">
          <div v-for="(item, index) in groupPromptSettings.items" :key="item.id" class="cot-item-card compact">
            <div class="cot-card-top"><span class="cot-item-name">{{ item.name }}</span><div class="spacer"></div><label class="toggle-switch mini"><input v-model="item.enabled" type="checkbox"><span class="slider"></span></label></div>
            <div class="entry-preview">{{ item.content.slice(0, 160) || '暂无内容' }}</div>
            <div class="cot-card-bottom"><span class="cot-tag">仅群聊生效</span><div class="cot-item-actions"><button class="icon-btn edit" @click="openGroupEditor(index)">编辑</button><button class="icon-btn delete" @click="deleteGroupItem(index)">删除</button></div></div>
          </div>
        </div>
        <div class="library-footer"><button class="mag-icon-text-btn" @click="resetGroupItems">恢复官方群聊提示词</button></div>
      </div>
    </template>

    <template v-else-if="activePromptTab === 'offline'">
      <div class="prompt-version-card">
        <div class="prompt-version-copy"><span class="mag-list-label">线下专属提示词</span><span class="prompt-version-desc">线下规则会在全局方案之后、聊天记录前后分别注入；单个角色仍可在聊天设置中覆盖默认选择。</span></div>
        <button class="mag-btn primary" @click="offlineModalVisible = true">管理线下预设</button>
      </div>
      <div class="mag-settings-card offline-summary">
        <div class="summary-row"><span>全局默认预设</span><strong>{{ currentOfflinePresetName }}</strong></div>
        <div class="summary-row"><span>官方预设</span><strong>{{ offlinePresetSettings.presets.filter(item => item.source === 'builtin').length }} 套</strong></div>
        <div class="summary-row"><span>我的预设</span><strong>{{ offlinePresetSettings.presets.filter(item => item.source === 'user').length }} 套</strong></div>
        <div class="offline-flow">
          <div><b>主要任务</b><span>定义本轮只续写角色的下一次回应</span></div>
          <div><b>线下模式</b><span>定义面对面动作、距离、场景与连续性</span></div>
          <div><b>回复规则</b><span>在聊天历史后再次约束最终输出</span></div>
        </div>
        <div class="library-footer"><button class="mag-icon-text-btn" @click="openVariables('offline')">查看线下变量</button><button class="mag-icon-text-btn" @click="offlineModalVisible = true">打开完整预设库</button></div>
      </div>
    </template>

    <template v-else>
      <div class="mag-settings-card">
        <div class="mag-list-header">
          <div class="list-heading-copy"><span class="mag-list-label">特殊任务条目</span><span class="prompt-token-note">通话决策、阶段摘要等任务触发时使用 · {{ taskTokenLabel }}</span></div>
          <div class="header-actions"><button class="mag-icon-text-btn" @click="openVariables('task')">变量</button><button class="mag-icon-text-btn" @click="resetTaskItems">恢复默认</button><button class="mag-btn primary" @click="openTaskEditor()">+ 新增</button></div>
        </div>
        <div class="cot-list">
          <div v-for="(item, index) in taskPromptSettings.items" :key="item.id" class="cot-item-card" :class="{ 'is-dragging': taskDragIndex === index }" draggable="true" @dragstart="taskDragStart(index)" @dragover="taskDragOver($event, index)" @dragend="taskDragIndex = null">
            <div class="cot-card-top"><span class="drag-handle">排序</span><span class="cot-item-name">{{ item.name }}</span><span v-if="taskSystemPromptItemIds.has(item.id)" class="source-tag">系统任务</span><div class="spacer"></div><label class="toggle-switch mini"><input v-model="item.enabled" type="checkbox"><span class="slider"></span></label></div>
            <div class="cot-card-bottom"><span class="cot-tag">仅在对应任务触发时生效</span><div class="cot-item-actions"><button class="icon-btn edit" @click="openTaskEditor(index)">编辑</button><button class="icon-btn delete" @click="deleteTaskItem(index)">删除</button></div></div>
          </div>
        </div>
      </div>
    </template>
  </div>

  <Transition name="fade">
    <div v-if="prompt.itemEditorVisible.value && prompt.itemDraft.value" class="simple-modal-overlay" @click.self="prompt.itemEditorVisible.value = false">
      <div class="cot-edit-modal"><div class="cot-modal-header"><h3>{{ prompt.viewingScheme.value?.source === 'builtin' ? '查看提示词条目' : '编辑提示词条目' }}</h3><button class="close-btn" @click="prompt.itemEditorVisible.value = false">关闭</button></div><div class="cot-modal-body"><div class="form-row"><div class="form-label">条目名称</div><input v-model="prompt.itemDraft.value.name" class="simple-modal-input" :disabled="prompt.viewingScheme.value?.source === 'builtin'"></div><div class="form-row"><div class="form-label form-label-line"><span>提示词内容</span><button v-if="prompt.viewingScheme.value?.source === 'user'" class="inline-text-btn" @click="openVariables('global')">插入变量</button></div><textarea v-model="prompt.itemDraft.value.content" class="simple-modal-input textarea" :disabled="prompt.viewingScheme.value?.source === 'builtin'" spellcheck="false"></textarea></div><div class="form-row horizontal"><div class="form-label">启用此条目</div><label class="toggle-switch"><input v-model="prompt.itemDraft.value.enabled" type="checkbox" :disabled="prompt.viewingScheme.value?.source === 'builtin'"><span class="slider"></span></label></div></div><div class="cot-modal-footer"><button class="simple-modal-btn" @click="prompt.itemEditorVisible.value = false">{{ prompt.viewingScheme.value?.source === 'builtin' ? '关闭' : '取消' }}</button><button v-if="prompt.viewingScheme.value?.source === 'user'" class="simple-modal-btn primary" @click="prompt.saveItem">保存并生效</button></div></div>
    </div>
  </Transition>

  <Transition name="fade">
    <div v-if="variablesVisible" class="simple-modal-overlay" @click.self="variablesVisible = false">
      <div class="cot-edit-modal variable-modal"><div class="cot-modal-header"><div><h3>可用变量</h3><span class="modal-subtitle">点击变量会插入当前输入框；没有活动输入框时自动复制。</span></div><button class="close-btn" @click="variablesVisible = false">关闭</button></div><div class="cot-modal-body variable-list"><button v-for="item in variables" :key="item.key" class="variable-card" @click="insertVariable(item.token)"><code>{{ item.token }}</code><span><b>{{ item.name }}</b>{{ item.description }}</span><small>示例：{{ item.example }}</small></button></div><div class="cot-modal-footer"><button class="simple-modal-btn" @click="copyAllVariables">复制全部变量与说明</button><button class="simple-modal-btn primary" @click="variablesVisible = false">完成</button></div></div>
    </div>
  </Transition>

  <Transition name="fade">
    <div v-if="prompt.aiVisible.value" class="simple-modal-overlay" @click.self="!prompt.aiLoading.value && (prompt.aiVisible.value = false)">
      <div class="cot-edit-modal ai-modal"><div class="cot-modal-header"><div><h3>AI 生成提示词方案</h3><span class="modal-subtitle">生成结果会自动创建为一个新的方案副本。</span></div><button class="close-btn" @click="prompt.aiVisible.value = false">关闭</button></div><div class="cot-modal-body"><div class="form-row"><div class="form-label">希望这套方案达到什么效果</div><textarea v-model="prompt.aiRequirement.value" class="simple-modal-input textarea" placeholder="例如：更自然地推进长期关系，减少模板化反问……" spellcheck="false"></textarea></div><div class="ai-actions"><button class="simple-modal-btn" @click="prompt.copyGuide">复制说明给其他 AI</button><button class="simple-modal-btn" @click="prompt.importTextVisible.value = true">粘贴 AI 结果</button><button v-if="prompt.aiLoading.value" class="simple-modal-btn danger" @click="prompt.cancelAiGenerator">停止生成</button><button v-else class="simple-modal-btn primary" @click="prompt.runAiGenerator">在线生成</button></div><div v-if="prompt.aiLoading.value" class="generation-state"><span class="loading-dot"></span>正在调用当前配置的模型，请稍候……</div><div v-if="prompt.aiError.value" class="validation-warning">{{ prompt.aiError.value }}</div><div v-if="prompt.aiResult.value" class="ai-result-card"><div><strong>{{ prompt.aiResult.value.name }}</strong><span>{{ prompt.aiResult.value.description }}</span></div><div class="result-meta"><span>{{ prompt.aiResult.value.mode === 'full' ? '全文模式' : `${prompt.aiResult.value.items.length} 个条目` }}</span><span>兼容 {{ prompt.aiResult.value.basePresetId.toUpperCase() }}</span></div><div v-if="prompt.aiUnknownVariables.value.length" class="validation-warning">包含未知变量：{{ prompt.aiUnknownVariables.value.join('、') }}</div></div></div><div class="cot-modal-footer"><button class="simple-modal-btn" @click="prompt.aiVisible.value = false">取消</button><button class="simple-modal-btn primary" :disabled="!prompt.aiResult.value" @click="prompt.applyAiResult">保存为新方案</button></div></div>
    </div>
  </Transition>

  <Transition name="fade">
    <div v-if="prompt.importTextVisible.value" class="simple-modal-overlay" @click.self="prompt.importTextVisible.value = false"><div class="cot-edit-modal"><div class="cot-modal-header"><div><h3>粘贴或导入 JSON</h3><span class="modal-subtitle">支持完整方案文件，也支持 AI 按生成说明返回的单个对象。</span></div><button class="close-btn" @click="prompt.importTextVisible.value = false">关闭</button></div><div class="cot-modal-body"><textarea v-model="prompt.importText.value" class="simple-modal-input textarea full-textarea" placeholder="粘贴 JSON 内容……" spellcheck="false"></textarea></div><div class="cot-modal-footer"><button class="simple-modal-btn" @click="prompt.importGeneratedText">解析为 AI 结果</button><button class="simple-modal-btn primary" @click="prompt.importSchemesFromText">导入方案文件</button></div></div></div>
  </Transition>

  <Transition name="fade">
    <div v-if="prompt.copyNameVisible.value" class="simple-modal-overlay" @click.self="prompt.copyNameVisible.value = false">
      <div class="cot-edit-modal"><div class="cot-modal-header"><div><h3>创建方案副本</h3><span class="modal-subtitle">副本会保存到“我的方案”，原方案不会改变。</span></div><button class="close-btn" @click="prompt.copyNameVisible.value = false">关闭</button></div><div class="cot-modal-body"><div class="form-row"><div class="form-label">副本名称</div><input v-model="prompt.copyName.value" class="simple-modal-input" maxlength="40" @keyup.enter="prompt.confirmSchemeCopy"></div></div><div class="cot-modal-footer"><button class="simple-modal-btn" @click="prompt.copyNameVisible.value = false">取消</button><button class="simple-modal-btn primary" :disabled="!prompt.copyName.value.trim()" @click="prompt.confirmSchemeCopy">创建并切换</button></div></div>
    </div>
  </Transition>

  <Transition name="fade">
    <div v-if="prompt.guideVisible.value" class="simple-modal-overlay" @click.self="prompt.guideVisible.value = false">
      <div class="cot-edit-modal scheme-editor-modal"><div class="cot-modal-header"><div><h3>复制给 AI 的生成说明</h3><span class="modal-subtitle">可以先检查或修改，确认后才会复制到剪贴板。</span></div><button class="close-btn" @click="prompt.guideVisible.value = false">关闭</button></div><div class="cot-modal-body"><textarea v-model="prompt.guideText.value" class="simple-modal-input textarea full-textarea" spellcheck="false"></textarea></div><div class="cot-modal-footer"><button class="simple-modal-btn" @click="prompt.guideVisible.value = false">取消</button><button class="simple-modal-btn primary" :disabled="!prompt.guideText.value.trim()" @click="prompt.confirmCopyGuide">确认复制</button></div></div>
    </div>
  </Transition>

  <Transition name="fade">
    <div v-if="prompt.conversionVisible.value" class="simple-modal-overlay" @click.self="prompt.conversionVisible.value = false">
      <div class="cot-edit-modal"><div class="cot-modal-header"><div><h3>转换为条目</h3><span class="modal-subtitle">已按标题识别 {{ prompt.conversionItems.value.length }} 个条目，确认后替换当前条目列表。</span></div><button class="close-btn" @click="prompt.conversionVisible.value = false">关闭</button></div><div class="cot-modal-body conversion-list"><div v-for="item in prompt.conversionItems.value" :key="item.id" class="conversion-card"><strong>{{ item.name }}</strong><span>{{ item.content.slice(0, 100) }}{{ item.content.length > 100 ? '…' : '' }}</span></div></div><div class="cot-modal-footer"><button class="simple-modal-btn" @click="prompt.conversionVisible.value = false">取消</button><button class="simple-modal-btn primary" @click="prompt.confirmFullTextConversion">确认转换</button></div></div>
    </div>
  </Transition>

  <Transition name="fade">
    <div v-if="groupEditorVisible && groupDraft" class="simple-modal-overlay" @click.self="groupEditorVisible = false"><div class="cot-edit-modal"><div class="cot-modal-header"><h3>编辑群聊提示词</h3><button class="close-btn" @click="groupEditorVisible = false">关闭</button></div><div class="cot-modal-body"><div class="form-row"><div class="form-label">条目名称</div><input v-model="groupDraft.name" class="simple-modal-input"></div><div class="form-row"><div class="form-label">提示词内容</div><textarea v-model="groupDraft.content" class="simple-modal-input textarea" spellcheck="false"></textarea></div><div class="form-row horizontal"><div class="form-label">启用此条目</div><label class="toggle-switch"><input v-model="groupDraft.enabled" type="checkbox"><span class="slider"></span></label></div></div><div class="cot-modal-footer"><button class="simple-modal-btn" @click="groupEditorVisible = false">取消</button><button class="simple-modal-btn primary" @click="saveGroupEditor">保存并生效</button></div></div></div>
  </Transition>

  <Transition name="fade">
    <div v-if="taskEditorVisible && taskDraft" class="simple-modal-overlay" @click.self="taskEditorVisible = false"><div class="cot-edit-modal"><div class="cot-modal-header"><h3>编辑特殊任务提示词</h3><button class="close-btn" @click="taskEditorVisible = false">关闭</button></div><div class="cot-modal-body"><div class="form-row"><div class="form-label">条目名称</div><input v-model="taskDraft.name" class="simple-modal-input"></div><div class="form-row"><div class="form-label form-label-line"><span>提示词内容</span><button class="inline-text-btn" @click="openVariables('task')">插入变量</button></div><textarea v-model="taskDraft.content" class="simple-modal-input textarea" spellcheck="false"></textarea></div><div class="form-row horizontal"><div class="form-label">启用此条目</div><label class="toggle-switch"><input v-model="taskDraft.enabled" type="checkbox"><span class="slider"></span></label></div></div><div class="cot-modal-footer"><button class="simple-modal-btn" @click="taskEditorVisible = false">取消</button><button class="simple-modal-btn primary" @click="saveTaskEditor">保存</button></div></div></div>
  </Transition>

  <ChatOfflinePresetModal :visible="offlineModalVisible" :selected-chat="offlineBridge" @close="offlineModalVisible = false" @save="syncOfflineBridge" />
  <Transition name="fade"><div v-if="prompt.toast.value" class="prompt-toast">{{ prompt.toast.value }}</div></Transition>
</template>

<style scoped>
.settings-panel{display:flex;flex-direction:column;min-height:100%;padding-bottom:30px}.mag-header{margin-bottom:16px;padding:0 10px}.mag-title-box{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}.mag-title{font-size:18px;font-weight:600;color:#4a4643;letter-spacing:1px}.mag-subtitle,.prompt-token-note,.cot-tag{font-family:Georgia,serif;font-style:italic}.mag-subtitle{font-size:13px;color:#d4c9c1}.mag-desc,.prompt-version-desc{font-size:12px;color:#8c8681;line-height:1.5}.mag-tabs{display:flex;gap:12px;margin-bottom:16px;padding:0 10px}.mag-tab-btn{padding:7px 16px;border-radius:20px;border:1px solid #ebe5df;background:#fff;color:#8c8681;font-size:13px;cursor:pointer;transition:.2s}.mag-tab-btn.active{background:#4a4643;border-color:#4a4643;color:#fff;box-shadow:0 2px 6px rgba(74,70,67,.2)}.prompt-version-card{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 10px 16px;padding:14px 16px;background:#fff;border:1px solid #ebe5df;border-radius:16px}.prompt-version-copy,.list-heading-copy{display:flex;flex-direction:column;gap:4px;min-width:0}.mag-list-label{font-size:14px;font-weight:600;color:#4a4643;letter-spacing:.5px}.prompt-version-tabs{flex-shrink:0;gap:8px;margin:0;padding:0}.mag-settings-card{background:#fff;border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:16px}.scheme-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.scheme-selector-wrapper{flex:1;min-width:240px;max-width:320px}.header-actions,.library-footer,.entries-toolbar>div,.ai-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.mag-icon-text-btn,.inline-text-btn{background:#f8f6f3;border:1px solid #ebe5df;border-radius:8px;color:#4a4643;font-size:11px;padding:6px 10px;cursor:pointer;transition:.2s}.mag-icon-text-btn:hover{background:#eee9e2}.mag-icon-text-btn.danger{color:#bd7777}.mag-btn{padding:7px 14px;font-size:12px;border-radius:8px;cursor:pointer;border:1px solid #ebe5df;background:#f8f6f3;color:#4a4643}.mag-btn.primary{background:#4a4643;color:#fff;border-color:#4a4643}.scheme-meta-row{display:flex;flex-direction:row;gap:12px}.scheme-meta-row .simple-modal-input{flex:1}.readonly-notice,.raw-mode-note{padding:12px 14px;border-radius:12px;background:#f8f6f3;color:#8c8681;font-size:12px;line-height:1.5}.library-footer{border-top:1px dashed #ebe5df;padding-top:14px;display:flex;justify-content:flex-end}.summary-row{display:flex;justify-content:space-between;padding:13px 10px;border-bottom:1px dashed #ebe5df;color:#8c8681;font-size:13px}.summary-row strong{color:#4a4643}.offline-flow{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.offline-flow div{display:flex;flex-direction:column;gap:5px;padding:14px;border:1px solid #ebe5df;border-radius:14px}.offline-flow b{color:#4a4643;font-size:13px}.offline-flow span{color:#8c8681;font-size:11px;line-height:1.45}.cot-list{display:flex;flex-direction:column;gap:10px}.cot-item-card{background:#fff;border:1px solid #ebe5df;border-radius:16px;padding:14px;transition:.2s}.cot-item-card.is-dragging{opacity:.5;background:#f8f6f3}.cot-item-card.compact{padding:14px 16px}.cot-card-top{display:flex;align-items:center;gap:9px}.drag-handle{color:#b9afa8;font-size:10px;cursor:grab}.cot-item-name{font-size:13px;font-weight:600;color:#4a4643;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.spacer{flex:1}.cot-card-bottom{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding-left:28px}.cot-tag{color:#8c8681;font-size:10px}.cot-item-actions{display:flex;gap:7px}.icon-btn{background:#f8f6f3;border:1px solid #ebe5df;font-size:11px;cursor:pointer;padding:5px 10px;border-radius:8px;color:#4a4643}.icon-btn.delete,.danger{color:#bd7777!important}.entry-preview{margin:9px 0 0 28px;color:#9c938c;font-size:11px;line-height:1.5;white-space:pre-wrap;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}.toggle-switch{position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0}.toggle-switch.mini{width:32px;height:18px}.toggle-switch input{opacity:0;width:0;height:0}.slider{position:absolute;inset:0;background:rgba(0,0,0,.08);transition:.3s;border-radius:24px}.slider:before{position:absolute;content:"";height:20px;width:20px;left:2px;bottom:2px;background:#fff;transition:.3s;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.1)}.toggle-switch.mini .slider:before{height:14px;width:14px}.toggle-switch input:checked+.slider{background:#4a4643}.toggle-switch input:checked+.slider:before{transform:translateX(20px)}.toggle-switch.mini input:checked+.slider:before{transform:translateX(14px)}.simple-modal-overlay{position:fixed;inset:0;background:rgba(235,229,223,.66);backdrop-filter:blur(4px);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}.cot-edit-modal{background:#fff;width:min(500px,100%);max-height:90vh;border-radius:20px;overflow:hidden;box-shadow:0 12px 48px rgba(74,70,67,.14);display:flex;flex-direction:column;border:1px solid #ebe5df}.scheme-editor-modal{width:min(760px,100%)}.cot-modal-header{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px dashed #ebe5df}.cot-modal-header h3{margin:0;font-size:17px;font-weight:600;color:#4a4643}.modal-subtitle{display:block;margin-top:4px;color:#a49c96;font-size:10px}.close-btn{background:none;border:0;color:#8c8681;cursor:pointer;font-size:12px}.cot-modal-body{padding:20px 22px;display:flex;flex-direction:column;gap:16px;overflow-y:auto}.form-row{display:flex;flex-direction:column;gap:8px}.form-row.horizontal{flex-direction:row;justify-content:space-between;align-items:center;background:#f8f6f3;padding:14px 16px;border:1px solid #ebe5df;border-radius:12px}.form-label{font-size:13px;color:#4a4643;font-weight:600}.form-label-line,.entries-toolbar{display:flex;justify-content:space-between;align-items:center}.simple-modal-input{width:100%;box-sizing:border-box;padding:11px 14px;border:1px solid #ebe5df;border-radius:12px;background:#f8f6f3;font-size:13px;color:#4a4643;outline:0;font-family:inherit}.simple-modal-input:focus{border-color:#4a4643;background:#fff;box-shadow:0 0 0 3px rgba(74,70,67,.05)}.simple-modal-input:disabled{color:#8c8681;opacity:.8}.simple-modal-input.textarea{min-height:150px;resize:vertical;line-height:1.6;font-family:Georgia,"Times New Roman",serif}.simple-modal-input.full-textarea{min-height:300px}.editor-mode-switch{display:flex;padding:3px;border-radius:18px;background:#f0ece8}.editor-mode-switch button{flex:1;border:0;border-radius:15px;background:transparent;color:#8c8681;padding:7px;cursor:pointer}.editor-mode-switch button.active{background:#4a4643;color:#fff}.entries-toolbar{color:#8c8681;font-size:12px;padding:0 4px}.entries-toolbar button{border:0;background:none;color:#6f655e;font-size:11px;cursor:pointer;padding:4px 8px;border-radius:6px;transition:.2s}.entries-toolbar button:hover{background:#f0ece8}.cot-modal-footer{display:flex;padding:14px 20px;border-top:1px dashed #ebe5df;justify-content:flex-end;gap:9px;background:#fafafa;flex-wrap:wrap}.simple-modal-btn{padding:9px 18px;border-radius:20px;border:1px solid #ebe5df;color:#8c8681;font-size:12px;background:#fff;cursor:pointer}.simple-modal-btn.primary{background:#4a4643;color:#fff;border-color:#4a4643}.simple-modal-btn:disabled{opacity:.45;cursor:not-allowed}.validation-warning{padding:11px 13px;border:1px solid #e7cfc6;border-radius:10px;background:#fff8f5;color:#a66f61;font-size:11px;line-height:1.5}.variable-list{gap:9px}.variable-card{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;width:100%;padding:12px;border:1px solid #ebe5df;border-radius:12px;background:#fff;text-align:left;cursor:pointer;color:#4a4643}.variable-card code{grid-row:1/3;padding:4px 7px;border-radius:7px;background:#f0ece8;color:#6f655e}.variable-card span{display:flex;gap:6px;font-size:11px;color:#8c8681}.variable-card b{color:#4a4643}.variable-card small{grid-column:2;color:#aaa19a}.ai-actions{justify-content:flex-end}.generation-state,.ai-result-card{padding:13px;border:1px solid #ebe5df;border-radius:12px;color:#8c8681;font-size:12px}.loading-dot{display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#4a4643;animation:pulse 1s infinite}.ai-result-card>div:first-child{display:flex;flex-direction:column;gap:5px}.ai-result-card strong{color:#4a4643}.result-meta{display:flex;gap:8px;margin-top:10px}.result-meta span{padding:3px 7px;border-radius:8px;background:#f0ece8;font-size:10px}.conversion-list{gap:9px}.conversion-card{display:flex;flex-direction:column;gap:5px;padding:12px 14px;border:1px solid #ebe5df;border-radius:12px;background:#f8f6f3}.conversion-card strong{color:#4a4643;font-size:12px}.conversion-card span{color:#8c8681;font-size:11px;line-height:1.5;white-space:pre-wrap}.prompt-toast{position:fixed;left:50%;bottom:38px;transform:translateX(-50%);z-index:3000;padding:10px 18px;border-radius:18px;background:#4a4643;color:#fff;font-size:12px;box-shadow:0 6px 20px rgba(74,70,67,.22)}.fade-enter-active,.fade-leave-active{transition:opacity .2s}.fade-enter-from,.fade-leave-to{opacity:0}@keyframes pulse{50%{opacity:.3}}
@media(max-width:600px){.main-tabs{gap:7px}.main-tabs .mag-tab-btn{flex:1;padding:7px 5px}.prompt-version-card{align-items:flex-start;flex-direction:column}.mag-list-header{align-items:flex-start;flex-direction:column;gap:9px}.scheme-toolbar{flex-direction:column;align-items:stretch}.scheme-selector-wrapper{max-width:100%}.header-actions{width:100%;justify-content:flex-start}.scheme-meta-row{flex-direction:column}.offline-flow{grid-template-columns:1fr}.scheme-editor-modal{height:94vh;max-height:94vh}.cot-modal-footer{padding:12px}.simple-modal-btn{padding:8px 13px}.variable-card{grid-template-columns:1fr}.variable-card code,.variable-card small{grid-column:1;grid-row:auto}.cot-card-bottom{padding-left:0}.entry-preview{margin-left:0}.library-footer{justify-content:flex-start;flex-direction:column;align-items:stretch;gap:8px}.mag-tabs{padding:0 4px}.mag-settings-card{padding:10px}}
</style>
