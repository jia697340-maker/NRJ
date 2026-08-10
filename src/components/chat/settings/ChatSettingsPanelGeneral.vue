/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { chatSettings, offlinePresetSettings } from '../../../store'
import ChatOfflinePresetModal from '../modals/ChatOfflinePresetModal.vue'
import { getOfflineModelProfileLabel } from '../../../services/offlinePresets'

const props = defineProps<{
  selectedChat: any
  currentMediaThumb: string | null
  matchSearch: (...keywords: (string | undefined | null)[]) => boolean
}>()

const emit = defineEmits<{
  (e: 'save'): void
  (e: 'open-msg-count-modal'): void
  (e: 'show-memory-type-modal'): void
  (e: 'open-memory-value-modal'): void
  (e: 'show-emoji-view'): void
  (e: 'trigger-media-thumb-upload'): void
  (e: 'clear-media-thumb'): void
  (e: 'handle-clear-history-click'): void
  (e: 'open-offline-meet'): void
  (e: 'open-relationship'): void
  (e: 'open-autonomy'): void
}>()

const handleSave = () => {
  emit('save')
}

const showOfflinePresetModal = ref(false)
const showOfflineModeModal = ref(false)
const showOfflineLocationModal = ref(false)
const currentOfflinePresetName = computed(() => {
  const id = props.selectedChat?.offlinePresetId || offlinePresetSettings.currentPresetId || 'offline_default'
  return offlinePresetSettings.presets.find(item => item.id === id)?.name || '线下默认'
})
const currentOfflineProfileName = computed(() => getOfflineModelProfileLabel(props.selectedChat?.offlineModelProfile || 'auto'))

const selectOfflineMode = (mode: 'mixed' | 'separate') => {
  props.selectedChat.offlineMeetMode = mode
  showOfflineModeModal.value = false
  handleSave()
}

const selectOfflineLocationMode = (mode: 'vague' | 'continuous') => {
  props.selectedChat.offlineMeetLocationMode = mode
  showOfflineLocationModal.value = false
  handleSave()
}

const ensureOfflineDefaults = () => {
  if (!props.selectedChat.offlineMeetMode) {
    props.selectedChat.offlineMeetMode = 'mixed'
  }
}

const onOfflineToggle = () => {
  ensureOfflineDefaults()
  handleSave()
}

const narrationSaveState = ref<'idle' | 'saving' | 'saved'>('idle')
let narrationSaveTimer: ReturnType<typeof setTimeout> | null = null
const narrationUnavailable = computed(() => !props.selectedChat || props.selectedChat.id === 1)

const onBubbleNarrationToggle = () => {
  if (narrationUnavailable.value) return
  narrationSaveState.value = 'saving'
  handleSave()
  if (narrationSaveTimer) clearTimeout(narrationSaveTimer)
  narrationSaveTimer = setTimeout(() => {
    narrationSaveState.value = 'saved'
    narrationSaveTimer = setTimeout(() => {
      narrationSaveState.value = 'idle'
    }, 1600)
  }, 260)
}

onBeforeUnmount(() => {
  if (narrationSaveTimer) clearTimeout(narrationSaveTimer)
})
</script>

<template>
  <div class="role-edit-section">
    <div class="glass-panel" v-show="matchSearch('角色自主活动', '主动消息', '朋友圈', '上线', '下线', '活动历史')">
      <div class="glass-list-item autonomy-entry" @click="emit('open-autonomy')">
        <div class="autonomy-entry-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.64 5.64l2.12 2.12m8.48 8.48 2.12 2.12m0-12.72-2.12 2.12m-8.48 8.48-2.12 2.12"/></svg>
        </div>
        <div class="autonomy-entry-copy">
          <div class="item-label">角色自主活动</div>
          <div>主动消息、朋友圈与上线状态由角色自行决定</div>
        </div>
        <div class="item-value">
          <span class="autonomy-entry-state" :class="{ active: selectedChat.autonomyEnabled }">{{ selectedChat.autonomyEnabled ? '运行中' : '未开启' }}</span>
          <span class="arrow">›</span>
        </div>
      </div>
    </div>
    <div class="glass-panel" v-show="matchSearch('关系状态', '拉黑', '删除好友', '好友申请')">
      <div class="glass-list-item" @click="emit('open-relationship')">
        <div>
          <div class="item-label">关系状态</div>
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">拉黑、删除好友与申请动态</div>
        </div>
        <div class="item-value"><span style="width:7px;height:7px;border-radius:50%;background:#52a575;"></span><span class="item-value-text">查看</span><span class="arrow">></span></div>
      </div>
    </div>

    <section
      v-show="matchSearch('气泡叙事', '旁白', '动作描写', '心理描写', '环境描写', '混合叙事')"
      class="glass-panel narration-setting-card"
      :class="{ 'is-enabled': selectedChat.bubbleNarrationEnabled, 'is-disabled': narrationUnavailable }"
      aria-labelledby="bubble-narration-title"
    >
      <div class="narration-setting-head">
        <div class="narration-setting-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M6.5 7.5h7M6.5 11h4.5M15.5 15.5l1.3 2.2 2.2 1.3-2.2 1.3-1.3 2.2-1.3-2.2-2.2-1.3 2.2-1.3 1.3-2.2Z" />
            <path d="M17.5 13V5.8A2.8 2.8 0 0 0 14.7 3H5.8A2.8 2.8 0 0 0 3 5.8v7.4A2.8 2.8 0 0 0 5.8 16H9l3.5 2.8" />
          </svg>
        </div>
        <div class="narration-setting-copy">
          <div class="narration-title-row">
            <h3 id="bubble-narration-title">气泡叙事</h3>
            <span class="narration-new-badge">新功能</span>
          </div>
          <p id="bubble-narration-description">保留线上聊天气泡，在对话之间自然穿插动作、心理与环境描写。</p>
        </div>
        <div class="narration-setting-control">
          <span class="narration-save-state" role="status" aria-live="polite">
            <span v-if="narrationSaveState === 'saving'" class="narration-saving-dot" aria-hidden="true"></span>
            {{ narrationSaveState === 'saving' ? '保存中' : narrationSaveState === 'saved' ? '已保存' : selectedChat.bubbleNarrationEnabled ? '已开启' : '未开启' }}
          </span>
          <label class="switch narration-switch" :class="{ disabled: narrationUnavailable }">
            <input
              v-model="selectedChat.bubbleNarrationEnabled"
              type="checkbox"
              :disabled="narrationUnavailable"
              aria-label="气泡叙事"
              aria-describedby="bubble-narration-description"
              @change="onBubbleNarrationToggle"
            >
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <p v-if="narrationUnavailable" class="narration-unavailable" role="note">
        系统通知不支持聊天叙事，请在角色聊天中设置。
      </p>
      <div v-else-if="selectedChat.bubbleNarrationEnabled" class="narration-preview">
        <div class="narration-preview-label">效果预览</div>
        <div class="narration-preview-chat">
          <div class="preview-bubble">你怎么现在才回来？</div>
          <div class="preview-narration">
            <span class="preview-narration-line"></span>
            <span>他靠在门边，目光安静地落在你身上。</span>
            <span class="preview-narration-line"></span>
          </div>
          <div class="preview-bubble preview-bubble-self">临时有点事情。</div>
        </div>
        <div class="narration-preview-foot">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
          叙述内容独立展示，不会被误认为任何一方发送的消息
        </div>
      </div>
    </section>

    <div class="glass-panel" v-show="matchSearch('线下', '见面', '独立', '模式')">
      <div class="glass-list-item" v-show="matchSearch('线下', '见面')" style="display:flex; flex-direction:column; align-items:flex-start; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="item-label">启用线下模式</span>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" v-model="selectedChat.offlineMeetEnabled" @change="onOfflineToggle">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400; line-height: 1.4;">允许进行线下面对面的真实接触场景</span>
      </div>

      <template v-if="selectedChat.offlineMeetEnabled">
        <div class="glass-list-item" v-show="matchSearch('模式', '独立')" @click="showOfflineModeModal = true">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ 线下表现形式</div>
          <div class="item-value">
            <span class="item-value-text">{{ selectedChat.offlineMeetMode === 'separate' ? '独立线下页面' : '与线上共用页面' }}</span>
            <span class="arrow">></span>
          </div>
        </div>

        <div class="glass-list-item" v-show="matchSearch('线下预设', '提示词')" @click="showOfflinePresetModal = true">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">├ 线下预设</div>
          <div class="item-value"><span class="item-value-text">{{ currentOfflinePresetName }}</span><span class="arrow">></span></div>
        </div>

        <div class="glass-list-item" v-show="matchSearch('模型适配', 'Claude', 'DeepSeek', 'Gemini')" @click="showOfflinePresetModal = true">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">├ 模型适配</div>
          <div class="item-value"><span class="item-value-text">{{ currentOfflineProfileName }}</span><span class="arrow">></span></div>
        </div>

        <div class="glass-list-item" v-show="matchSearch('地点', '场景连续')" @click="showOfflineLocationModal = true">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ 地点处理</div>
          <div class="item-value">
            <span class="item-value-text">{{ selectedChat.offlineMeetLocationMode === 'continuous' ? '保持场景连续' : '未确定时保持模糊' }}</span>
            <span class="arrow">></span>
          </div>
        </div>

        <div
          v-if="selectedChat.offlineMeetMode === 'separate'"
          class="glass-list-item"
          v-show="matchSearch('进入', '线下', '页面')"
          @click="emit('open-offline-meet')"
          style="cursor: pointer;"
        >
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ 点击进入独立线下页面</div>
          <div class="item-value">
            <span class="arrow">></span>
          </div>
        </div>
      </template>
    </div>

    <div class="glass-panel" v-show="matchSearch('控制回复条数', '回复条数限制')">
      <div class="glass-list-item" v-show="matchSearch('控制回复条数')">
        <div class="item-label">控制回复条数</div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" v-model="selectedChat.enableMsgCountLimit" @change="handleSave">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <template v-if="selectedChat.enableMsgCountLimit">
        <div class="glass-list-item" v-show="matchSearch('回复条数限制')" @click="emit('open-msg-count-modal')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ 条数范围限制</div>
          <div class="item-value">
            <span class="item-value-text">{{ selectedChat.minMsgCount || 1 }} ~ {{ selectedChat.maxMsgCount || 3 }} 条</span>
            <span class="arrow">></span>
          </div>
        </div>
      </template>
    </div>

    <div class="glass-panel" v-show="matchSearch('自动生成心声', '心声附带生图', '心声附带语音', '心声存储上限')">
      <div class="glass-list-item" v-show="matchSearch('自动生成心声')">
        <div class="item-label">自动生成心声</div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" v-model="selectedChat.enableAutoThought" @change="handleSave">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <template v-if="selectedChat.enableAutoThought">
        <div class="glass-list-item" v-show="matchSearch('心声存储上限')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ 心声存储上限</div>
          <div class="item-value" style="display:flex; align-items:center; gap:8px;">
            <input type="number" v-model="chatSettings.innerThoughtLimit" @change="handleSave" style="width: 50px; text-align: right; background: transparent; border: none; font-size: 15px; color: var(--text-secondary); outline: none;" min="1" max="1000">
            <span class="item-value-text">条</span>
          </div>
        </div>
        <div class="glass-list-item" v-show="matchSearch('心声附带生图')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ 心声附带生图 (暂未接入)</div>
          <div class="item-value">
            <label class="switch" @click.stop style="transform: scale(0.8); transform-origin: right center;">
              <input type="checkbox" v-model="selectedChat.thoughtWithImage" @change="handleSave">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div class="glass-list-item" v-show="matchSearch('心声附带语音')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ 心声附带语音 (暂未接入)</div>
          <div class="item-value">
            <label class="switch" @click.stop style="transform: scale(0.8); transform-origin: right center;">
              <input type="checkbox" v-model="selectedChat.thoughtWithAudio" @change="handleSave">
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </template>
    </div>

    <div class="glass-panel" v-show="matchSearch('记忆计算方式', '记忆轮数', '记忆条数', '语音上下文记忆', '视频上下文记忆', '视频临时总结')">
      <div class="glass-list-item" v-show="matchSearch('记忆计算方式')" @click="emit('show-memory-type-modal')">
        <div class="item-label">记忆计算方式</div>
        <div class="item-value"><span class="item-value-text">{{ selectedChat.memoryType === 'round' ? '按轮数' : '按条数' }}</span><span class="arrow">></span></div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('记忆轮数', '记忆条数')" @click="emit('open-memory-value-modal')">
        <div class="item-label">{{ selectedChat.memoryType === 'round' ? '聊天记忆轮数' : '聊天记忆条数' }}</div>
        <div class="item-value"><span class="item-value-text">{{ selectedChat.memoryValue || '未设置' }}</span><span class="arrow">></span></div>
      </div>
      
      <!-- 语音专属上下文记忆条数 -->
      <div class="glass-list-item" v-show="matchSearch('语音上下文记忆')" style="border-top: 1px dashed rgba(0,0,0,0.05); padding-top: 12px; margin-top: 4px; display:flex; flex-direction:column; align-items:flex-start; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="item-label">语音短期上下文记忆</span>
          <div class="item-value" style="display:flex; align-items:center; gap:8px;">
            <input type="number" v-model="chatSettings.voiceMsgCount" @change="handleSave" style="width: 50px; text-align: right; background: transparent; border: none; font-size: 15px; color: var(--text-secondary); outline: none;" min="1" max="100">
            <span class="item-value-text">条</span>
          </div>
        </div>
        <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400; line-height: 1.4;">独立于文字聊天外的通话记录条数</span>
      </div>
      
      <!-- 语音临时总结阈值 -->
      <div class="glass-list-item" v-show="matchSearch('语音临时总结')" style="padding-top: 12px; margin-top: 4px; display:flex; flex-direction:column; align-items:flex-start; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="item-label">语音临时总结频次</span>
          <div class="item-value" style="display:flex; align-items:center; gap:8px;">
            <input type="number" v-model="chatSettings.voiceSummaryThreshold" @change="handleSave" style="width: 50px; text-align: right; background: transparent; border: none; font-size: 15px; color: var(--text-secondary); outline: none;" min="10" max="200">
            <span class="item-value-text">条</span>
          </div>
        </div>
        <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400; line-height: 1.4;">每达到几条自动总结一次以省Token</span>
      </div>

      <!-- 视频专属上下文记忆条数 -->
      <div class="glass-list-item" v-show="matchSearch('视频上下文记忆')" style="border-top: 1px dashed rgba(0,0,0,0.05); padding-top: 12px; margin-top: 4px; display:flex; flex-direction:column; align-items:flex-start; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="item-label">视频短期上下文记忆</span>
          <div class="item-value" style="display:flex; align-items:center; gap:8px;">
            <input type="number" v-model="chatSettings.videoMsgCount" @change="handleSave" style="width: 50px; text-align: right; background: transparent; border: none; font-size: 15px; color: var(--text-secondary); outline: none;" min="1" max="100">
            <span class="item-value-text">条</span>
          </div>
        </div>
        <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400; line-height: 1.4;">独立于文字聊天外的视频通话记录条数</span>
      </div>
      
      <!-- 视频临时总结阈值 -->
      <div class="glass-list-item" v-show="matchSearch('视频临时总结')" style="padding-top: 12px; margin-top: 4px; display:flex; flex-direction:column; align-items:flex-start; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="item-label">视频临时总结频次</span>
          <div class="item-value" style="display:flex; align-items:center; gap:8px;">
            <input type="number" v-model="chatSettings.videoSummaryThreshold" @change="handleSave" style="width: 50px; text-align: right; background: transparent; border: none; font-size: 15px; color: var(--text-secondary); outline: none;" min="10" max="200">
            <span class="item-value-text">条</span>
          </div>
        </div>
        <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400; line-height: 1.4;">每达到几条自动总结一次以省Token</span>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('允许角色主动来电', '来电', '响铃时长', '免打扰', '通话时禁用多媒体', '通话时禁用心声', '线下模式禁用多媒体', '线下模式禁用心声')">
      <div class="glass-list-item" v-show="matchSearch('通话时禁用多媒体')" style="display:flex; flex-direction:column; align-items:flex-start; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="item-label">通话时禁用多媒体与互动功能</span>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" v-model="chatSettings.disableSpecialTagsInCall" @change="handleSave">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400; line-height: 1.4;">禁止角色发图片/表情/转账等，省Token防幻觉</span>
      </div>
      <div class="glass-list-item" v-show="matchSearch('通话时禁用心声')" style="display:flex; flex-direction:column; align-items:flex-start; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="item-label">通话时禁用心声功能</span>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" v-model="chatSettings.disableThoughtInCall" @change="handleSave">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400; line-height: 1.4;">通话时不再生成长段心声，大幅加快开口响应速度</span>
      </div>
      
      <!-- 新增线下模式的对应开关 -->
      <div class="glass-list-item" v-show="matchSearch('线下模式禁用多媒体')" style="border-top: 1px dashed rgba(0,0,0,0.05); padding-top: 12px; margin-top: 4px; display:flex; flex-direction:column; align-items:flex-start; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="item-label">线下模式禁用多媒体与互动</span>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" v-model="chatSettings.disableSpecialTagsInOffline" @change="handleSave">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400; line-height: 1.4;">进入线下见面模式后禁止发图/表情/转账/拨打电话</span>
      </div>
      <div class="glass-list-item" v-show="matchSearch('线下模式禁用心声')" style="display:flex; flex-direction:column; align-items:flex-start; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="item-label">线下模式禁用心声功能</span>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" v-model="chatSettings.disableThoughtInOffline" @change="handleSave">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400; line-height: 1.4;">线下见面时不再写心声碎碎念，提升沉浸感和响应速度</span>
      </div>
      
      <div class="glass-list-item" v-show="matchSearch('允许角色主动发朋友圈与互动', '朋友圈')" style="border-top: 1px dashed rgba(0,0,0,0.05); padding-top: 12px; margin-top: 4px; display:flex; flex-direction:column; align-items:flex-start; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="item-label">允许此角色主动发朋友圈与互动</span>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" v-model="selectedChat.enableCharMoments" @change="handleSave">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400; line-height: 1.4;">角色可以随心所欲去刷朋友圈、点赞评论或发帖</span>
      </div>

      <div class="glass-list-item" v-show="matchSearch('允许角色朋友圈真实生图', '朋友圈', '生图')" style="display:flex; flex-direction:column; align-items:flex-start; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="item-label">允许角色朋友圈真实生图</span>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" v-model="chatSettings.enableCharMomentImages" @change="handleSave">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400; line-height: 1.4;">角色发帖带图片描述时调用其图像引擎；关闭后仅发布文字动态</span>
      </div>

      <div class="glass-list-item" v-show="matchSearch('允许角色主动拨打语音', '来电', '语音')" style="border-top: 1px dashed rgba(0,0,0,0.05); padding-top: 12px; margin-top: 4px; display:flex; flex-direction:column; align-items:flex-start; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="item-label">允许角色主动拨打语音</span>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" v-model="chatSettings.enableCharVoiceCall" @change="handleSave">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400; line-height: 1.4;">关闭后角色拨来的语音会直接记为未接来电</span>
      </div>
      
      <div class="glass-list-item" v-show="matchSearch('允许角色主动拨打视频', '来电', '视频')" style="display:flex; flex-direction:column; align-items:flex-start; gap:8px;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span class="item-label">允许角色主动拨打视频</span>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" v-model="chatSettings.enableCharVideoCall" @change="handleSave">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400; line-height: 1.4;">关闭后角色拨来的视频会直接记为未接来电</span>
      </div>

      <template v-if="chatSettings.enableCharVoiceCall !== false || chatSettings.enableCharVideoCall !== false">
        <div class="glass-list-item" v-show="matchSearch('响铃时长', '来电')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ 来电响铃时长</div>
          <div class="item-value" style="display:flex; align-items:center; gap:8px;">
            <input type="number" v-model="chatSettings.charCallRingSeconds" @change="handleSave" style="width: 50px; text-align: right; background: transparent; border: none; font-size: 15px; color: var(--text-secondary); outline: none;" min="5" max="120">
            <span class="item-value-text">秒</span>
          </div>
        </div>
        <div class="glass-list-item" v-show="matchSearch('免打扰')" style="display:flex; flex-direction:column; align-items:flex-start; gap:8px;">
          <div style="display:flex; justify-content:space-between; width:100%; align-items:center; padding-left: 12px;">
            <span style="font-size: 13px; color: var(--text-secondary);">└ 免打扰时段</span>
            <div class="item-value" style="display:flex; align-items:center; gap:4px;">
              <input type="time" v-model="chatSettings.dndStart" @change="handleSave" style="background: transparent; border: none; font-size: 13px; color: var(--text-secondary); outline: none;">
              <span class="item-value-text" style="font-size: 12px;">至</span>
              <input type="time" v-model="chatSettings.dndEnd" @change="handleSave" style="background: transparent; border: none; font-size: 13px; color: var(--text-secondary); outline: none;">
            </div>
          </div>
          <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400; line-height: 1.4; padding-left: 12px;">留空表示不限制，此时段内来电不响铃</span>
        </div>
      </template>
    </div>

    <div class="glass-panel" v-show="matchSearch('识别图片省TOKEN', 'token', '角色图片省Token')">
      <div class="glass-list-item" v-show="matchSearch('识别图片省TOKEN', 'token')">
        <div class="item-label">识别图片省TOKEN</div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" v-model="chatSettings.enableVisionTokenSaver">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('角色图片省Token', 'token')">
        <div class="item-label">角色图片省TOKEN</div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" v-model="chatSettings.enableRoleImageTokenSaver">
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('表情包管理库')">
      <div class="glass-list-item" v-show="matchSearch('表情包管理库')" @click="emit('show-emoji-view')">
        <div class="item-label">表情包管理库</div>
        <div class="item-value"><span class="item-value-text"></span><span class="arrow">></span></div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('自定义缩略图', '重置缩略图')">
      <div class="glass-list-item" v-show="matchSearch('自定义缩略图')" @click="emit('trigger-media-thumb-upload')">
        <div class="item-label">自定义缩略图</div>
        <div class="item-value">
          <span class="item-value-text" :style="{ color: currentMediaThumb ? 'var(--text-primary)' : 'var(--text-tertiary)' }">{{ currentMediaThumb ? '已设置' : '未设置' }}</span>
          <span class="arrow">></span>
        </div>
      </div>
      <div v-if="currentMediaThumb" class="glass-list-item" v-show="matchSearch('重置缩略图')" @click="emit('clear-media-thumb')">
        <div class="item-label" style="color: #FF4D4F; width: 100%; text-align: center;">重置缩略图</div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('语音自动转文字', '时间感知', '发送角色时间戳')">
      <div class="glass-list-item" v-show="matchSearch('语音自动转文字')">
        <div class="item-label">语音自动转文字</div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" v-model="chatSettings.autoTranscribeVoice">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('时间感知')">
        <div class="item-label">时间感知</div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" v-model="selectedChat.timePerception" @change="handleSave">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('发送角色时间戳')" :class="{ 'disabled-block': !selectedChat.timePerception }">
        <div class="item-label">发送角色时间戳</div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" v-model="selectedChat.sendCharacterTime" @change="handleSave">
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </div>

    <div class="glass-panel" style="margin-top: 24px; border: 1px solid rgba(255,77,79,0.3);" v-show="matchSearch('清空聊天记录')">
      <div class="glass-list-item" v-show="matchSearch('清空聊天记录')" @click="emit('handle-clear-history-click')">
        <div class="item-label" style="color: #FF4D4F; width: 100%; text-align: center; font-weight: bold;">清空聊天记录</div>
      </div>
    </div>

    <ChatOfflinePresetModal
      :visible="showOfflinePresetModal"
      :selected-chat="selectedChat"
      @close="showOfflinePresetModal = false"
      @save="handleSave"
    />

    <div v-if="showOfflineModeModal" class="wb-modal-overlay" @click.self="showOfflineModeModal = false">
      <div class="custom-confirm-modal offline-choice-modal">
        <div class="confirm-title">线下表现形式</div>
        <div class="offline-choice-list">
          <div class="memory-type-item" :class="{ active: selectedChat.offlineMeetMode !== 'separate' }" @click="selectOfflineMode('mixed')">
            <div><div class="offline-choice-name">与线上共用页面</div><div class="offline-choice-desc">在当前聊天中切换线下状态</div></div>
            <span v-if="selectedChat.offlineMeetMode !== 'separate'">✓</span>
          </div>
          <div class="memory-type-item" :class="{ active: selectedChat.offlineMeetMode === 'separate' }" @click="selectOfflineMode('separate')">
            <div><div class="offline-choice-name">独立线下页面</div><div class="offline-choice-desc">线下记录与线上消息分开展示</div></div>
            <span v-if="selectedChat.offlineMeetMode === 'separate'">✓</span>
          </div>
        </div>
        <div class="confirm-actions"><button class="confirm-btn cancel" @click="showOfflineModeModal = false">取消</button></div>
      </div>
    </div>

    <div v-if="showOfflineLocationModal" class="wb-modal-overlay" @click.self="showOfflineLocationModal = false">
      <div class="custom-confirm-modal offline-choice-modal">
        <div class="confirm-title">地点处理</div>
        <div class="offline-choice-list">
          <div class="memory-type-item" :class="{ active: selectedChat.offlineMeetLocationMode !== 'continuous' }" @click="selectOfflineLocationMode('vague')">
            <div><div class="offline-choice-name">未确定时保持模糊</div><div class="offline-choice-desc">不替用户擅自决定具体见面地点</div></div>
            <span v-if="selectedChat.offlineMeetLocationMode !== 'continuous'">✓</span>
          </div>
          <div class="memory-type-item" :class="{ active: selectedChat.offlineMeetLocationMode === 'continuous' }" @click="selectOfflineLocationMode('continuous')">
            <div><div class="offline-choice-name">保持场景连续</div><div class="offline-choice-desc">优先沿用历史中已经确定的地点</div></div>
            <span v-if="selectedChat.offlineMeetLocationMode === 'continuous'">✓</span>
          </div>
        </div>
        <div class="confirm-actions"><button class="confirm-btn cancel" @click="showOfflineLocationModal = false">取消</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.autonomy-entry{min-height:58px}.autonomy-entry-icon{width:32px;height:32px;border-radius:10px;background:var(--sys-bg-primary);display:grid;place-items:center;color:var(--text-secondary);flex:none;margin-right:11px}.autonomy-entry-icon svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round}.autonomy-entry-copy{min-width:0;flex:1}.autonomy-entry-copy>div:last-child{font-size:10.5px;color:var(--text-tertiary);margin-top:4px;white-space:normal;line-height:1.4}.autonomy-entry-state{font-size:11px;color:var(--text-tertiary);white-space:nowrap}.autonomy-entry-state.active{color:#438262}.autonomy-entry .arrow{font-family:inherit;font-size:20px;font-weight:400}

.narration-setting-card{overflow:hidden;transition:border-color .24s ease,box-shadow .24s ease,background .24s ease}.narration-setting-card.is-enabled{border-color:color-mix(in srgb,var(--text-primary) 16%,transparent);box-shadow:0 6px 18px rgba(0,0,0,.035)}.narration-setting-card.is-disabled{opacity:.68}.narration-setting-head{display:flex;align-items:center;gap:12px;padding:16px}.narration-setting-icon{width:38px;height:38px;display:grid;place-items:center;flex:none;border-radius:12px;color:var(--text-secondary);background:var(--sys-bg-primary);border:1px solid color-mix(in srgb,var(--text-primary) 7%,transparent);transition:color .24s ease,transform .24s ease}.is-enabled .narration-setting-icon{color:var(--text-primary);transform:translateY(-1px)}.narration-setting-icon svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.narration-setting-copy{min-width:0;flex:1}.narration-title-row{display:flex;align-items:center;gap:7px}.narration-title-row h3{margin:0;color:var(--text-primary);font-size:15px;font-weight:600;letter-spacing:.01em}.narration-new-badge{padding:2px 6px;border-radius:999px;background:color-mix(in srgb,var(--text-primary) 7%,transparent);color:var(--text-secondary);font-size:9px;font-weight:600;line-height:1.4}.narration-setting-copy p{margin:5px 0 0;color:var(--text-tertiary);font-size:11px;line-height:1.55}.narration-setting-control{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex:none}.narration-save-state{min-height:14px;color:var(--text-tertiary);font-size:9px;display:flex;align-items:center;gap:4px}.is-enabled .narration-save-state{color:var(--text-secondary)}.narration-saving-dot{width:8px;height:8px;border:1.5px solid color-mix(in srgb,var(--text-primary) 20%,transparent);border-top-color:var(--text-primary);border-radius:50%;animation:narration-spin .7s linear infinite}.narration-switch:focus-within .slider{outline:2px solid color-mix(in srgb,var(--text-primary) 32%,transparent);outline-offset:3px}.narration-switch.disabled{cursor:not-allowed}.narration-switch.disabled .slider{cursor:not-allowed}.narration-preview{padding:0 16px 15px;animation:narration-expand .28s cubic-bezier(.2,.8,.2,1)}.narration-preview-label{padding-top:12px;border-top:1px solid color-mix(in srgb,var(--text-primary) 7%,transparent);color:var(--text-tertiary);font-size:9px;font-weight:600;letter-spacing:.08em}.narration-preview-chat{display:flex;flex-direction:column;gap:8px;padding:11px 10px;margin-top:8px;border-radius:11px;background:color-mix(in srgb,var(--sys-bg-primary) 72%,transparent);overflow:hidden}.preview-bubble{align-self:flex-start;max-width:74%;padding:7px 10px;border-radius:10px 10px 10px 3px;background:var(--sys-bg-secondary);color:var(--text-primary);font-size:10px;line-height:1.45;border:1px solid color-mix(in srgb,var(--text-primary) 5%,transparent)}.preview-bubble-self{align-self:flex-end;border-radius:10px 10px 3px 10px;background:color-mix(in srgb,var(--text-primary) 10%,var(--sys-bg-secondary));}.preview-narration{display:flex;align-items:center;justify-content:center;gap:8px;padding:1px 4px;color:var(--text-tertiary);font-size:9px;font-style:italic;line-height:1.5;text-align:center}.preview-narration-line{height:1px;max-width:30px;flex:1;background:color-mix(in srgb,var(--text-primary) 9%,transparent)}.narration-preview-foot,.narration-unavailable{margin:9px 2px 0;color:var(--text-tertiary);font-size:9.5px;line-height:1.45}.narration-preview-foot{display:flex;align-items:flex-start;gap:5px}.narration-preview-foot svg{width:12px;height:12px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.narration-unavailable{padding:0 16px 14px}.is-dark .narration-setting-card.is-enabled{box-shadow:0 6px 18px rgba(0,0,0,.14)}@keyframes narration-spin{to{transform:rotate(360deg)}}@keyframes narration-expand{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}@media (hover:hover){.narration-setting-card:not(.is-disabled):hover{background:color-mix(in srgb,var(--sys-bg-secondary) 70%,transparent)}.narration-switch:hover .slider{filter:brightness(.97)}}@media (max-width:420px){.narration-setting-head{align-items:flex-start;padding:15px 14px;gap:10px}.narration-setting-icon{width:34px;height:34px;border-radius:10px}.narration-setting-copy p{max-width:220px}.narration-setting-control{gap:7px}.narration-preview{padding-left:14px;padding-right:14px}.narration-preview-chat{padding:10px 8px}.preview-narration-line{max-width:18px}}@media (prefers-reduced-motion:reduce){.narration-setting-card,.narration-setting-icon,.narration-preview,.slider{transition:none}.narration-saving-dot{animation-duration:1.4s}.narration-preview{animation:none}}
</style>

<style scoped>
@import './ChatSettingsStyles.css';
.offline-choice-modal { width: min(88vw, 360px); }
.offline-choice-list { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.offline-choice-name { color: var(--text-primary); font-size: 14px; font-weight: 500; }
.offline-choice-desc { color: var(--text-tertiary); font-size: 11px; line-height: 1.4; margin-top: 3px; }
</style>
