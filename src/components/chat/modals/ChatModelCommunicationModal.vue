/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  communicateWithChatModel,
  generateChatModelRules,
  normalizeChatModelRules,
  normalizeModelCommunicationMessages,
  type ChatModelRule,
  type ModelCommunicationMessage
} from '../../../services/modelCommunication'

const props = defineProps<{ visible: boolean; chat: any; initialFocusIds?: Array<number | string> }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'persist'): void }>()

type Tab = 'communicate' | 'rules'
const activeTab = ref<Tab>('communicate')
const focusIds = ref<Set<string>>(new Set())
const contextIds = ref<Set<string>>(new Set())
const contextExpanded = ref(true)
const contextRadius = ref(5)
const input = ref('')
const communicationMessages = ref<ModelCommunicationMessage[]>([])
const candidateRules = ref<string[]>([])
const selectedRuleIds = ref<Set<string>>(new Set())
const isSending = ref(false)
const isGeneratingRules = ref(false)
const errorMessage = ref('')
const editTarget = ref<ChatModelRule | null>(null)
const editValue = ref('')
const deleteConfirmVisible = ref(false)
const clearConfirmVisible = ref(false)
const conversationBody = ref<HTMLElement | null>(null)
let controller: AbortController | null = null

const eligibleMessages = computed(() => (props.chat?.messages || []).filter((item: any) =>
  ['left', 'right', 'system', 'narration'].includes(item?.type) && !item?.isUndelivered && String(item?.content || '').trim()
))
const contextAvailableMessages = computed(() => {
  if (!focusIds.value.size) return eligibleMessages.value.slice(-60)
  const indexes = eligibleMessages.value.map((item: any, index: number) => focusIds.value.has(String(item.id)) ? index : -1).filter((index: number) => index >= 0)
  if (!indexes.length) return eligibleMessages.value.slice(-60)
  const start = Math.max(0, Math.min(...indexes) - 30)
  const end = Math.min(eligibleMessages.value.length, Math.max(...indexes) + 31)
  return eligibleMessages.value.slice(start, end)
})
const selectedContextMessages = computed(() => eligibleMessages.value.filter((item: any) => contextIds.value.has(String(item.id))))
const rules = computed<ChatModelRule[]>(() => normalizeChatModelRules(props.chat?.modelCommunicationRules))
const allRulesSelected = computed(() => rules.value.length > 0 && rules.value.every(item => selectedRuleIds.value.has(item.id)))

const selectNearby = (radius: number) => {
  contextRadius.value = radius
  const ids = new Set<string>()
  if (!focusIds.value.size) {
    eligibleMessages.value.slice(-Math.max(1, radius * 2)).forEach((item: any) => ids.add(String(item.id)))
  } else {
    eligibleMessages.value.forEach((item: any, index: number) => {
      if (!focusIds.value.has(String(item.id))) return
      for (let cursor = Math.max(0, index - radius); cursor <= Math.min(eligibleMessages.value.length - 1, index + radius); cursor++) {
        ids.add(String(eligibleMessages.value[cursor].id))
      }
    })
  }
  focusIds.value.forEach(id => ids.add(id))
  contextIds.value = ids
}

const initialize = () => {
  activeTab.value = 'communicate'
  focusIds.value = new Set((props.initialFocusIds || []).map(String))
  if (!focusIds.value.size) {
    const latestRoleMessage = [...eligibleMessages.value].reverse().find((item: any) => item.type === 'left')
    if (latestRoleMessage) focusIds.value.add(String(latestRoleMessage.id))
  }
  selectNearby(5)
  communicationMessages.value = normalizeModelCommunicationMessages(props.chat?.modelCommunicationMessages)
  candidateRules.value = []
  selectedRuleIds.value = new Set()
  contextExpanded.value = true
  contextRadius.value = 5
  input.value = ''
  errorMessage.value = ''
}

watch(() => props.visible, visible => { if (visible) initialize(); else controller?.abort() })

const speakerName = (message: any) => message.type === 'right' ? '我' : message.type === 'left' ? (props.chat?.name || '角色') : message.type === 'narration' ? '旁白' : '系统'
const toggleContext = (id: number | string) => {
  const key = String(id)
  const next = new Set(contextIds.value)
  if (next.has(key) && !focusIds.value.has(key)) next.delete(key)
  else next.add(key)
  contextIds.value = next
}
const toggleFocus = (id: number | string) => {
  const key = String(id)
  const next = new Set(focusIds.value)
  if (next.has(key)) next.delete(key); else next.add(key)
  focusIds.value = next
  if (next.has(key)) contextIds.value = new Set([...contextIds.value, key])
}
const persistCommunication = () => {
  props.chat.modelCommunicationMessages = communicationMessages.value.slice(-80)
  emit('persist')
}
const scrollConversation = async () => { await nextTick(); if (conversationBody.value) conversationBody.value.scrollTop = conversationBody.value.scrollHeight }

const send = async () => {
  const text = input.value.trim()
  if (!text || isSending.value) return
  errorMessage.value = ''
  const userMessage: ModelCommunicationMessage = { id: `model_comm_${Date.now()}_user`, role: 'user', content: text, createdAt: Date.now() }
  communicationMessages.value.push(userMessage)
  input.value = ''
  persistCommunication()
  await scrollConversation()
  isSending.value = true
  controller = new AbortController()
  try {
    const content = await communicateWithChatModel({
      chat: props.chat,
      selectedMessages: selectedContextMessages.value,
      focusIds: [...focusIds.value],
      communicationMessages: communicationMessages.value.slice(0, -1),
      userText: text,
      signal: controller.signal
    })
    communicationMessages.value.push({ id: `model_comm_${Date.now()}_assistant`, role: 'assistant', content, createdAt: Date.now() })
    persistCommunication()
    await scrollConversation()
  } catch (error: any) {
    if (error?.name !== 'AbortError') errorMessage.value = error?.message || '模型沟通失败，请检查 API 设置。'
  } finally { isSending.value = false; controller = null }
}

const regenerateRules = async () => {
  if (isGeneratingRules.value) return
  errorMessage.value = ''
  isGeneratingRules.value = true
  controller = new AbortController()
  try {
    candidateRules.value = await generateChatModelRules({
      chat: props.chat,
      selectedMessages: selectedContextMessages.value,
      focusIds: [...focusIds.value],
      communicationMessages: communicationMessages.value,
      signal: controller.signal
    })
  } catch (error: any) {
    if (error?.name !== 'AbortError') errorMessage.value = error?.message || '规则生成失败。'
  } finally { isGeneratingRules.value = false; controller = null }
}

const saveCandidateRules = () => {
  const now = Date.now()
  const existing = normalizeChatModelRules(props.chat?.modelCommunicationRules)
  const additions = candidateRules.value.map((content, index) => content.trim() ? ({
    id: `chat_rule_${now}_${index}`, content: content.trim(), enabled: true, createdAt: now, updatedAt: now,
    sourceMessageIds: [...focusIds.value]
  }) : null).filter(Boolean) as ChatModelRule[]
  if (!additions.length) return
  props.chat.modelCommunicationRules = [...existing, ...additions]
  candidateRules.value = []
  emit('persist')
  activeTab.value = 'rules'
}

const addManualRule = () => { editTarget.value = { id: '', content: '', enabled: true, createdAt: Date.now(), updatedAt: Date.now(), sourceMessageIds: [] }; editValue.value = '' }
const openEditRule = (rule: ChatModelRule) => { editTarget.value = rule; editValue.value = rule.content }
const saveEditRule = () => {
  const content = editValue.value.trim()
  if (!content) return
  const current = normalizeChatModelRules(props.chat?.modelCommunicationRules)
  const index = current.findIndex(item => item.id === editTarget.value?.id)
  if (index >= 0) current[index] = { ...current[index], content, updatedAt: Date.now() }
  else current.push({ id: `chat_rule_${Date.now()}`, content, enabled: true, createdAt: Date.now(), updatedAt: Date.now(), sourceMessageIds: [] })
  props.chat.modelCommunicationRules = current
  editTarget.value = null
  emit('persist')
}
const toggleRule = (rule: ChatModelRule) => {
  props.chat.modelCommunicationRules = rules.value.map(item => item.id === rule.id ? { ...item, enabled: !item.enabled, updatedAt: Date.now() } : item)
  emit('persist')
}
const toggleRuleSelection = (id: string) => {
  const next = new Set(selectedRuleIds.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  selectedRuleIds.value = next
}
const toggleAllRules = () => { selectedRuleIds.value = allRulesSelected.value ? new Set() : new Set(rules.value.map(item => item.id)) }
const confirmDeleteRules = () => {
  props.chat.modelCommunicationRules = rules.value.filter(item => !selectedRuleIds.value.has(item.id))
  selectedRuleIds.value = new Set()
  deleteConfirmVisible.value = false
  emit('persist')
}
const clearCommunication = () => { communicationMessages.value = []; candidateRules.value = []; clearConfirmVisible.value = false; persistCommunication() }
</script>

<template>
  <transition name="folder-fade">
    <div v-if="visible" class="folder-modal-overlay" @click.self="emit('close')">
      <section class="model-communication-modal" @click.stop>
        <header class="panel-header">
          <div><strong>与模型沟通</strong><small>暂停角色扮演，纠正当前聊天的后续表现</small></div>
          <div class="panel-close" @click="emit('close')"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
        </header>

        <nav class="panel-tabs">
          <div :class="{ active: activeTab === 'communicate' }" @click="activeTab = 'communicate'">直接沟通</div>
          <div :class="{ active: activeTab === 'rules' }" @click="activeTab = 'rules'">聊天规则 {{ rules.length }}</div>
        </nav>

        <template v-if="activeTab === 'communicate'">
          <div class="context-card">
            <div class="context-heading" @click="contextExpanded = !contextExpanded"><span><strong>引用聊天上下文</strong><small>重点 {{ focusIds.size }} 条 · 共 {{ contextIds.size }} 条</small></span><svg :class="{ expanded: contextExpanded }" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"><path d="m6 9 6 6 6-6"/></svg></div>
            <template v-if="contextExpanded">
              <div class="context-presets"><div :class="{ active: contextRadius === 0 }" @click="selectNearby(0)">仅重点</div><div :class="{ active: contextRadius === 2 }" @click="selectNearby(2)">前后 2 条</div><div :class="{ active: contextRadius === 5 }" @click="selectNearby(5)">前后 5 条</div><div :class="{ active: contextRadius === 10 }" @click="selectNearby(10)">前后 10 条</div></div>
              <div class="context-list">
                <div v-for="message in contextAvailableMessages" :key="message.id" class="context-row" :class="{ included: contextIds.has(String(message.id)), focus: focusIds.has(String(message.id)) }">
                  <div class="context-check" :class="{ checked: contextIds.has(String(message.id)) }" @click="toggleContext(message.id)"><svg viewBox="0 0 24 24"><path d="M5 12.5l4 4L19 7"/></svg></div>
                  <div class="context-copy" @click="toggleContext(message.id)"><span>{{ speakerName(message) }}</span><p>{{ message.content }}</p></div>
                  <div class="focus-tag" :class="{ active: focusIds.has(String(message.id)) }" @click="toggleFocus(message.id)">{{ focusIds.has(String(message.id)) ? '重点' : '设为重点' }}</div>
                </div>
              </div>
            </template>
          </div>

          <div ref="conversationBody" class="conversation-body">
            <div v-if="!communicationMessages.length" class="empty-state"><strong>直接告诉模型哪里不对</strong><span>例如：不要无条件安慰，保持上一轮生气的情绪，也不要固定反问。</span></div>
            <div v-for="message in communicationMessages" :key="message.id" class="communication-bubble" :class="message.role"><small>{{ message.role === 'user' ? '我' : '模型助手' }}</small><p>{{ message.content }}</p></div>
            <div v-if="isSending" class="communication-bubble assistant loading"><span></span>模型正在回应</div>
          </div>

          <div v-if="candidateRules.length" class="candidate-panel">
            <div class="candidate-heading"><div><strong>待保存规则</strong><small>可以直接修改后再保存</small></div><div @click="regenerateRules">重新生成</div></div>
            <textarea v-for="(_, index) in candidateRules" :key="index" v-model="candidateRules[index]" class="candidate-textarea"></textarea>
            <div class="candidate-actions"><div @click="candidateRules = []">取消</div><div class="primary" @click="saveCandidateRules">保存为当前聊天规则</div></div>
          </div>
          <div v-if="errorMessage" class="error-card">{{ errorMessage }}</div>
          <footer class="communication-footer">
            <div class="footer-tools"><div @click="clearConfirmVisible = true">清空沟通</div><div :class="{ disabled: isGeneratingRules }" @click="regenerateRules">{{ isGeneratingRules ? '生成中…' : (candidateRules.length ? '重新生成规则' : '生成规则') }}</div></div>
            <div class="communication-input"><textarea v-model="input" rows="2" placeholder="直接和模型说明问题……" @keydown.ctrl.enter.prevent="send"></textarea><div :class="{ disabled: !input.trim() || isSending }" @click="send"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></div></div>
          </footer>
        </template>

        <template v-else>
          <div class="rules-toolbar"><div @click="toggleAllRules"><span class="context-check" :class="{ checked: allRulesSelected }"><svg viewBox="0 0 24 24"><path d="M5 12.5l4 4L19 7"/></svg></span>{{ allRulesSelected ? '取消全选' : '全选' }}</div><span>已选择 {{ selectedRuleIds.size }} 条</span><div><button type="button" @click="addManualRule">新增规则</button><button type="button" class="danger" :disabled="!selectedRuleIds.size" @click="deleteConfirmVisible = true">删除</button></div></div>
          <div class="rules-body">
            <div v-if="!rules.length" class="empty-state"><strong>还没有当前聊天规则</strong><span>可以手动新增，或回到“直接沟通”让模型生成。</span></div>
            <article v-for="rule in rules" :key="rule.id" class="rule-card" :class="{ selected: selectedRuleIds.has(rule.id), disabled: !rule.enabled }">
              <div class="context-check" :class="{ checked: selectedRuleIds.has(rule.id) }" @click="toggleRuleSelection(rule.id)"><svg viewBox="0 0 24 24"><path d="M5 12.5l4 4L19 7"/></svg></div>
              <div class="rule-copy" @click="openEditRule(rule)"><p>{{ rule.content }}</p><small>{{ rule.sourceMessageIds.length ? `来自 ${rule.sourceMessageIds.length} 条重点消息` : '手动规则' }}</small></div>
              <div class="rule-switch" :class="{ active: rule.enabled }" @click="toggleRule(rule)"><i></i></div>
            </article>
          </div>
        </template>

        <div v-if="editTarget" class="inner-overlay" @click.self="editTarget = null"><div class="edit-modal" @click.stop><div class="edit-title">{{ editTarget.id ? '修改规则' : '新增规则' }}</div><textarea v-model="editValue" class="edit-textarea" placeholder="输入需要在后续聊天中持续执行的规则"></textarea><div class="confirm-actions"><div @click="editTarget = null">取消</div><div class="primary" @click="saveEditRule">保存</div></div></div></div>
        <div v-if="deleteConfirmVisible" class="inner-overlay" @click.self="deleteConfirmVisible = false"><div class="edit-modal confirm-box" @click.stop><div class="edit-title">删除所选规则</div><p class="confirm-desc">删除后，后续聊天将不再向模型发送这些规则。</p><div class="confirm-actions"><div @click="deleteConfirmVisible = false">取消</div><div class="danger" @click="confirmDeleteRules">删除</div></div></div></div>
        <div v-if="clearConfirmVisible" class="inner-overlay" @click.self="clearConfirmVisible = false"><div class="edit-modal confirm-box" @click.stop><div class="edit-title">清空模型沟通</div><p class="confirm-desc">只会清空幕后沟通记录，已经保存的聊天规则不会被删除。</p><div class="confirm-actions"><div @click="clearConfirmVisible = false">取消</div><div class="danger" @click="clearCommunication">清空</div></div></div></div>
      </section>
    </div>
  </transition>
</template>

<style scoped>
.folder-modal-overlay{position:fixed;inset:0;z-index:10004;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.42);backdrop-filter:blur(3px)}
.model-communication-modal{position:relative;width:92%;max-width:min(460px,calc(100% - 24px));height:min(84vh,760px);display:flex;flex-direction:column;overflow:hidden;border-radius:20px;background:var(--sys-bg-secondary,#fff);box-shadow:0 14px 38px rgba(0,0,0,.16);color:var(--text-primary,#222)}
.panel-header{min-height:62px;padding:0 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,.05)}.panel-header>div:first-child{display:flex;flex-direction:column;gap:3px}.panel-header strong{font-size:17px}.panel-header small{font-size:10px;color:var(--text-tertiary,#999)}.panel-close{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;color:var(--text-secondary,#666);cursor:pointer}
.panel-tabs{display:flex;gap:8px;padding:8px 14px}.panel-tabs div{flex:1;padding:9px 4px;border-radius:10px;text-align:center;font-size:13px;color:var(--text-tertiary,#999);cursor:pointer}.panel-tabs .active{background:var(--sys-bg-primary,#f5f5f7);color:var(--text-primary,#222);font-weight:600}
.context-card{margin:0 14px 9px;border-radius:13px;background:var(--sys-bg-primary,#f7f7f8);overflow:hidden}.context-heading{min-height:48px;padding:0 13px;display:flex;align-items:center;justify-content:space-between;cursor:pointer}.context-heading span{display:flex;flex-direction:column;gap:2px}.context-heading strong{font-size:12px}.context-heading small{font-size:9px;color:var(--text-tertiary,#999)}.context-heading svg{transition:.2s}.context-heading svg.expanded{transform:rotate(180deg)}
.context-presets{display:flex;gap:6px;padding:0 10px 8px;overflow:auto}.context-presets div{flex:0 0 auto;padding:5px 8px;border-radius:8px;background:var(--sys-bg-secondary,#fff);font-size:9px;color:var(--text-secondary,#666);cursor:pointer}.context-presets .active{color:var(--theme-color,#5b8def)}.context-list{max-height:190px;overflow:auto;padding:0 8px 8px}.context-row{display:grid;grid-template-columns:22px minmax(0,1fr) auto;align-items:center;gap:7px;padding:7px 5px;border-radius:9px;opacity:.55}.context-row.included{opacity:1;background:var(--sys-bg-secondary,#fff)}.context-row+.context-row{margin-top:4px}.context-check{width:19px;height:19px;box-sizing:border-box;display:grid;place-items:center;border:1px solid var(--border-color,#ddd);border-radius:6px;color:transparent;cursor:pointer}.context-check svg{width:14px;fill:none;stroke:currentColor;stroke-width:2}.context-check.checked{border-color:var(--theme-color,#5b8def);background:var(--theme-color,#5b8def);color:#fff}.context-copy{min-width:0;cursor:pointer}.context-copy span{font-size:9px;color:var(--text-tertiary,#999)}.context-copy p{margin:2px 0 0;overflow:hidden;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.focus-tag{padding:4px 6px;border-radius:7px;font-size:8px;color:var(--text-tertiary,#999);cursor:pointer}.focus-tag.active{background:color-mix(in srgb,var(--theme-color,#5b8def) 12%,transparent);color:var(--theme-color,#5b8def)}
.conversation-body{flex:1;overflow:auto;padding:4px 14px 12px}.empty-state{min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;text-align:center;color:var(--text-tertiary,#999)}.empty-state strong{font-size:13px;color:var(--text-secondary,#666)}.empty-state span{max-width:260px;font-size:10px;line-height:1.5}.communication-bubble{max-width:86%;margin:8px 0;padding:10px 12px;border-radius:13px;background:var(--sys-bg-primary,#f7f7f8)}.communication-bubble.user{margin-left:auto;background:color-mix(in srgb,var(--theme-color,#5b8def) 12%,var(--sys-bg-secondary,#fff))}.communication-bubble small{font-size:9px;color:var(--text-tertiary,#999)}.communication-bubble p{margin:4px 0 0;font-size:12px;line-height:1.55;white-space:pre-wrap}.communication-bubble.loading{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--text-tertiary,#999)}.communication-bubble.loading span{width:7px;height:7px;border-radius:50%;background:currentColor;animation:pulse 1s infinite}
.candidate-panel{max-height:250px;overflow:auto;margin:0 14px 8px;padding:11px;border:1px solid color-mix(in srgb,var(--theme-color,#5b8def) 24%,transparent);border-radius:13px;background:var(--sys-bg-primary,#f7f7f8)}.candidate-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.candidate-heading>div:first-child{display:flex;flex-direction:column}.candidate-heading strong{font-size:12px}.candidate-heading small{font-size:9px;color:var(--text-tertiary,#999)}.candidate-heading>div:last-child{font-size:10px;color:var(--theme-color,#5b8def);cursor:pointer}.candidate-textarea{display:block;box-sizing:border-box;width:100%;min-height:58px;margin-top:6px;padding:8px 10px;border:1px solid var(--border-color,#e5e5e5);border-radius:9px;outline:0;resize:none;background:var(--sys-bg-secondary,#fff);color:var(--text-primary,#222);font:inherit;font-size:11px;line-height:1.45}.candidate-actions{display:flex;justify-content:flex-end;gap:16px;margin-top:9px;font-size:11px;cursor:pointer}.candidate-actions .primary{color:var(--theme-color,#5b8def);font-weight:600}.error-card{margin:0 14px 8px;padding:8px 10px;border-radius:9px;background:rgba(216,100,100,.1);color:#c45d5d;font-size:10px}
.communication-footer{padding:8px 12px calc(10px + env(safe-area-inset-bottom));border-top:1px solid rgba(0,0,0,.05)}.footer-tools{display:flex;justify-content:space-between;margin-bottom:7px;font-size:10px;color:var(--text-tertiary,#999)}.footer-tools div{cursor:pointer}.footer-tools div:last-child{color:var(--theme-color,#5b8def)}.communication-input{display:grid;grid-template-columns:minmax(0,1fr) 38px;align-items:end;gap:7px}.communication-input textarea{box-sizing:border-box;width:100%;min-height:45px;max-height:100px;padding:10px 12px;border:1px solid var(--border-color,#e5e5e5);border-radius:13px;outline:0;resize:none;background:var(--sys-bg-primary,#f7f7f8);color:var(--text-primary,#222);font:inherit;font-size:12px}.communication-input>div{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:var(--text-primary,#222);color:var(--sys-bg-secondary,#fff);cursor:pointer}.disabled{opacity:.45!important;pointer-events:none}
.rules-toolbar{min-height:45px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid rgba(0,0,0,.05);font-size:10px;color:var(--text-tertiary,#999)}.rules-toolbar>div:first-child{display:flex;align-items:center;gap:6px;cursor:pointer}.rules-toolbar>div:last-child{display:flex;gap:7px}.rules-toolbar button{padding:6px 9px;border:0;border-radius:8px;background:var(--sys-bg-primary,#f5f5f7);color:var(--text-secondary,#666);font:inherit;font-size:10px;cursor:pointer}.rules-toolbar button.danger{color:#d86464}.rules-toolbar button:disabled{opacity:.4;cursor:not-allowed}.rules-body{flex:1;overflow:auto;padding:12px 14px}.rule-card{display:grid;grid-template-columns:20px minmax(0,1fr) 36px;align-items:center;gap:9px;margin-bottom:9px;padding:13px;border-radius:13px;background:var(--sys-bg-primary,#f7f7f8)}.rule-card.selected{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--theme-color,#5b8def) 35%,transparent)}.rule-card.disabled .rule-copy{opacity:.5}.rule-copy{cursor:pointer}.rule-copy p{margin:0;font-size:12px;line-height:1.5;white-space:pre-wrap}.rule-copy small{display:block;margin-top:5px;font-size:9px;color:var(--text-tertiary,#999)}.rule-switch{width:34px;height:20px;padding:2px;box-sizing:border-box;border-radius:12px;background:rgba(0,0,0,.12);cursor:pointer;transition:.2s}.rule-switch i{display:block;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.15);transition:.2s}.rule-switch.active{background:var(--theme-color,#5b8def)}.rule-switch.active i{transform:translateX(14px)}
.inner-overlay{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;border-radius:20px;background:rgba(0,0,0,.35)}.edit-modal{width:82%;overflow:hidden;border-radius:16px;background:var(--sys-bg-secondary,#fff)}.edit-title{padding:20px 20px 14px;text-align:center;font-size:16px;font-weight:600}.edit-textarea{display:block;box-sizing:border-box;width:calc(100% - 32px);min-height:125px;margin:0 16px 10px;padding:10px 12px;border:1px solid var(--border-color,#e5e5e5);border-radius:10px;outline:0;resize:none;background:var(--sys-bg-primary,#f7f8fa);color:var(--text-primary,#222);font:inherit;font-size:13px;line-height:1.5}.confirm-actions{display:flex;margin-top:14px;border-top:1px solid rgba(0,0,0,.06)}.confirm-actions div{flex:1;padding:13px;text-align:center;font-size:14px;cursor:pointer;color:var(--text-secondary,#666)}.confirm-actions div+div{border-left:1px solid rgba(0,0,0,.06)}.confirm-actions .primary{color:var(--theme-color,#5b8def);font-weight:600}.confirm-actions .danger{color:#d86464}.confirm-desc{padding:0 24px 12px;text-align:center;font-size:13px;line-height:1.5;color:var(--text-tertiary,#888)}
@keyframes pulse{50%{opacity:.25}}@media(max-width:480px){.model-communication-modal{width:100%;max-width:none;height:92vh;align-self:flex-end;border-radius:20px 20px 0 0}.folder-modal-overlay{align-items:flex-end}.context-list{max-height:165px}}
</style>
