/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { readGroupChats, saveGroupChat, type GroupChatRecord } from '../../../services/groupChat'
import { useChatAuth } from '../../../composables/useChatAuth'
import { normalizeMemoryBridgeMemberSettings } from '../../../services/memoryBridge'

const props = defineProps<{
  visible: boolean
  character: any
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'change'): void
}>()

const { currentChatUserId } = useChatAuth()

const characterEntityId = computed(() => {
  if (!props.character) return ''
  return String(props.character.characterEntityId || props.character.id || '')
})

const characterName = computed(() => {
  return props.character?.realName || props.character?.name || '此角色'
})

const groups = ref<GroupChatRecord[]>([])

const loadGroups = () => {
  const entityId = characterEntityId.value
  if (!entityId) {
    groups.value = []
    return
  }
  groups.value = readGroupChats(currentChatUserId.value)
    .filter(group => (group.memberIds || []).map(String).includes(entityId))
    .map(group => {
      group.memberSettings ||= {}
      group.memberSettings[entityId] = normalizeMemoryBridgeMemberSettings(group.memberSettings[entityId])
      return group
    })
}

watch([() => props.visible, characterEntityId, currentChatUserId], ([visible]) => {
  if (visible) loadGroups()
}, { immediate: true })

const isBridgeEnabled = (group: GroupChatRecord) => {
  const entityId = characterEntityId.value
  if (!entityId || !group.memberSettings) return false
  return Boolean(group.memberSettings[entityId]?.enableMemoryBridge)
}

const toggleBridge = (group: GroupChatRecord, enabled: boolean) => {
  const entityId = characterEntityId.value
  if (!entityId) return
  group.memberSettings ||= {}
  group.memberSettings[entityId] = normalizeMemoryBridgeMemberSettings(group.memberSettings[entityId])
  group.memberSettings[entityId].enableMemoryBridge = enabled
  saveGroupChat(currentChatUserId.value, group)
  emit('change')
}

const saveBridgeConfig = (group: GroupChatRecord) => {
  const entityId = characterEntityId.value
  if (!entityId) return
  group.memberSettings[entityId] = normalizeMemoryBridgeMemberSettings(group.memberSettings[entityId])
  saveGroupChat(currentChatUserId.value, group)
  emit('change')
}

const handleClose = () => {
  emit('update:visible', false)
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" @click.self="handleClose">
    <div class="custom-confirm-modal bridge-modal">
      <div class="confirm-title">{{ characterName }} · 群聊记忆互通</div>
      
      <div class="bridge-intro">
        <p class="intro-p">
          启用后，<b>{{ characterName }}</b> 在对应群内的主观记忆可以进入其单聊上下文，其单聊长期记忆也可以进入该角色在群聊中的独立成员上下文。
        </p>
        <p class="intro-sub">
          * 互通记忆仅向该角色自身隔离生效，严禁进入群内共同记忆，且绝不向其他群成员泄露。默认关闭。
        </p>
      </div>

      <div class="bridge-list-container">
        <div v-if="groups.length === 0" class="bridge-empty">
          <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="1.5" fill="none" class="empty-icon">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <div class="empty-text">该角色当前暂未加入任何群聊</div>
          <div class="empty-hint">将角色加入群聊后，即可在此配置记忆互通</div>
        </div>

        <div v-else class="bridge-list">
          <div v-for="group in groups" :key="group.id" class="bridge-item" :class="{ enabled: isBridgeEnabled(group) }">
            <div class="bridge-item-header">
              <div class="group-info-col">
                <div class="group-avatar-wrapper">
                  <span v-if="!group.avatarUrl" class="group-avatar-text">{{ group.avatarText || '群' }}</span>
                  <img v-else :src="group.avatarUrl" class="group-avatar-img" alt="群头像" />
                </div>
                <div class="group-details">
                  <div class="group-name">{{ group.name }}</div>
                  <div class="group-meta">成员 {{ group.memberIds?.length || 0 }} 人</div>
                </div>
              </div>

              <div class="group-switch-col">
                <label class="switch" @click.stop>
                  <input type="checkbox" :checked="isBridgeEnabled(group)" @change="(e) => toggleBridge(group, (e.target as HTMLInputElement).checked)" />
                  <span class="slider"></span>
                </label>
              </div>
            </div>

            <div v-if="isBridgeEnabled(group)" class="bridge-config">
              <div class="bridge-direction-title">群聊传入单聊</div>
              <div class="bridge-config-row">
                <span>读取短期上下文</span>
                <div class="bridge-config-action">
                  <input v-model.number="group.memberSettings[characterEntityId].memoryBridgeConfig.groupToSingle.shortTermValue" class="bridge-number-input" type="number" min="1" max="200" @change="saveBridgeConfig(group)">
                  <span class="bridge-unit">条</span>
                  <label class="switch"><input v-model="group.memberSettings[characterEntityId].memoryBridgeConfig.groupToSingle.shortTermEnabled" type="checkbox" @change="saveBridgeConfig(group)"><span class="slider"></span></label>
                </div>
              </div>
              <div class="bridge-config-row">
                <span>读取长期记忆</span>
                <div class="bridge-config-action">
                  <input v-model.number="group.memberSettings[characterEntityId].memoryBridgeConfig.groupToSingle.longTermTokenBudget" class="bridge-number-input bridge-token-input" type="number" min="200" max="4000" step="100" @change="saveBridgeConfig(group)">
                  <span class="bridge-unit">Token</span>
                  <label class="switch"><input v-model="group.memberSettings[characterEntityId].memoryBridgeConfig.groupToSingle.longTermEnabled" type="checkbox" @change="saveBridgeConfig(group)"><span class="slider"></span></label>
                </div>
              </div>

              <div class="bridge-direction-title bridge-direction-divider">单聊传入群聊</div>
              <div class="bridge-config-row">
                <span>读取短期上下文</span>
                <div class="bridge-config-action">
                  <input v-model.number="group.memberSettings[characterEntityId].memoryBridgeConfig.singleToGroup.shortTermValue" class="bridge-number-input" type="number" min="1" max="200" @change="saveBridgeConfig(group)">
                  <span class="bridge-unit">条</span>
                  <label class="switch"><input v-model="group.memberSettings[characterEntityId].memoryBridgeConfig.singleToGroup.shortTermEnabled" type="checkbox" @change="saveBridgeConfig(group)"><span class="slider"></span></label>
                </div>
              </div>
              <div class="bridge-config-row">
                <span>读取长期记忆</span>
                <div class="bridge-config-action">
                  <input v-model.number="group.memberSettings[characterEntityId].memoryBridgeConfig.singleToGroup.longTermTokenBudget" class="bridge-number-input bridge-token-input" type="number" min="200" max="4000" step="100" @change="saveBridgeConfig(group)">
                  <span class="bridge-unit">Token</span>
                  <label class="switch"><input v-model="group.memberSettings[characterEntityId].memoryBridgeConfig.singleToGroup.longTermEnabled" type="checkbox" @change="saveBridgeConfig(group)"><span class="slider"></span></label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="confirm-actions">
        <div class="confirm-btn" style="width: 100%;" @click="handleClose">完成</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';

.bridge-modal {
  width: min(90vw, 420px);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.bridge-intro {
  padding: 0 18px 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  text-align: left;
}

.intro-p {
  margin: 0 0 6px;
  color: var(--text-primary);
}

.intro-sub {
  margin: 0;
  font-size: 11px;
  color: var(--text-tertiary);
}

.bridge-list-container {
  flex: 1;
  overflow-y: auto;
  max-height: 48vh;
  padding: 8px 12px;
}

.bridge-empty {
  padding: 36px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-tertiary);
  text-align: center;
}

.empty-icon {
  opacity: 0.4;
  margin-bottom: 4px;
}

.empty-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.empty-hint {
  font-size: 11px;
  opacity: 0.8;
}

.bridge-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bridge-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 0;
  overflow: hidden;
  background: var(--sys-bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.bridge-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
}

.group-info-col {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.group-avatar-wrapper {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--sys-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.group-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.group-avatar-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.group-details {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
}

.group-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-meta {
  font-size: 11px;
  color: var(--text-tertiary);
}

.group-switch-col {
  flex-shrink: 0;
  margin-left: 10px;
}

.bridge-config {
  border-top: 1px solid var(--border-color);
  padding: 5px 12px 9px;
}

.bridge-direction-title {
  padding: 8px 0 5px;
  color: var(--text-tertiary);
  font-size: 11px;
  text-align: left;
}

.bridge-direction-divider {
  border-top: 1px solid var(--border-color);
  margin-top: 5px;
}

.bridge-config-row {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 12px;
}

.bridge-config-action {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.bridge-number-input {
  width: 42px;
  border: 0;
  border-bottom: 1px solid var(--border-color);
  border-radius: 0;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  text-align: right;
  outline: none;
  appearance: textfield;
  padding: 4px 2px;
}

.bridge-token-input {
  width: 54px;
}

.bridge-number-input:focus {
  border-bottom-color: var(--text-primary);
}

.bridge-number-input::-webkit-inner-spin-button,
.bridge-number-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.bridge-unit {
  min-width: 34px;
  color: var(--text-tertiary);
  font-size: 10px;
  text-align: left;
}
</style>
