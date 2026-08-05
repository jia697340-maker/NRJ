/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'
import { chatSettings } from '../../../store'

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
}>()

const handleSave = () => {
  emit('save')
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
</script>

<template>
  <div class="role-edit-section">
    <div class="glass-panel" v-show="matchSearch('线下', '见面', '独立', '模式')">
      <div class="glass-list-item" v-show="matchSearch('线下', '见面')">
        <div class="item-label" style="display:flex; flex-direction:column; gap:4px;">
          <span>启用线下模式</span>
          <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400;">允许进行线下面对面的真实接触场景</span>
        </div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" v-model="selectedChat.offlineMeetEnabled" @change="onOfflineToggle">
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <template v-if="selectedChat.offlineMeetEnabled">
        <div class="glass-list-item" v-show="matchSearch('模式', '独立')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ 线下表现形式</div>
          <div class="item-value">
            <select
              v-model="selectedChat.offlineMeetMode"
              @change="handleSave"
              style="background: transparent; border: none; font-size: 14px; color: var(--text-secondary); outline: none; text-align: right;"
            >
              <option value="mixed">与线上共用页面</option>
              <option value="separate">独立线下页面</option>
            </select>
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

    <div class="glass-panel" v-show="matchSearch('自动生成心声', '心声附带生图', '心声附带语音')">
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
      <div class="glass-list-item" v-show="matchSearch('语音上下文记忆')" style="border-top: 1px dashed rgba(0,0,0,0.05); padding-top: 12px; margin-top: 4px;">
        <div class="item-label" style="display:flex; flex-direction:column; gap:4px;">
          <span>语音短期上下文记忆</span>
          <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400;">独立于文字聊天外的通话记录条数</span>
        </div>
        <div class="item-value" style="display:flex; align-items:center; gap:8px;">
          <input type="number" v-model="chatSettings.voiceMsgCount" @change="handleSave" style="width: 50px; text-align: right; background: transparent; border: none; font-size: 15px; color: var(--text-secondary); outline: none;" min="1" max="100">
          <span class="item-value-text">条</span>
        </div>
      </div>
      
      <!-- 语音临时总结阈值 -->
      <div class="glass-list-item" v-show="matchSearch('语音临时总结')" style="padding-top: 12px; margin-top: 4px;">
        <div class="item-label" style="display:flex; flex-direction:column; gap:4px;">
          <span>语音临时总结频次</span>
          <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400;">每达到几条自动总结一次以省Token</span>
        </div>
        <div class="item-value" style="display:flex; align-items:center; gap:8px;">
          <input type="number" v-model="chatSettings.voiceSummaryThreshold" @change="handleSave" style="width: 50px; text-align: right; background: transparent; border: none; font-size: 15px; color: var(--text-secondary); outline: none;" min="10" max="200">
          <span class="item-value-text">条</span>
        </div>
      </div>

      <!-- 视频专属上下文记忆条数 -->
      <div class="glass-list-item" v-show="matchSearch('视频上下文记忆')" style="border-top: 1px dashed rgba(0,0,0,0.05); padding-top: 12px; margin-top: 4px;">
        <div class="item-label" style="display:flex; flex-direction:column; gap:4px;">
          <span>视频短期上下文记忆</span>
          <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400;">独立于文字聊天外的视频通话记录条数</span>
        </div>
        <div class="item-value" style="display:flex; align-items:center; gap:8px;">
          <input type="number" v-model="chatSettings.videoMsgCount" @change="handleSave" style="width: 50px; text-align: right; background: transparent; border: none; font-size: 15px; color: var(--text-secondary); outline: none;" min="1" max="100">
          <span class="item-value-text">条</span>
        </div>
      </div>
      
      <!-- 视频临时总结阈值 -->
      <div class="glass-list-item" v-show="matchSearch('视频临时总结')" style="padding-top: 12px; margin-top: 4px;">
        <div class="item-label" style="display:flex; flex-direction:column; gap:4px;">
          <span>视频临时总结频次</span>
          <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400;">每达到几条自动总结一次以省Token</span>
        </div>
        <div class="item-value" style="display:flex; align-items:center; gap:8px;">
          <input type="number" v-model="chatSettings.videoSummaryThreshold" @change="handleSave" style="width: 50px; text-align: right; background: transparent; border: none; font-size: 15px; color: var(--text-secondary); outline: none;" min="10" max="200">
          <span class="item-value-text">条</span>
        </div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('允许角色主动来电', '来电', '响铃时长', '免打扰', '通话时禁用多媒体', '通话时禁用心声', '线下模式禁用多媒体', '线下模式禁用心声')">
      <div class="glass-list-item" v-show="matchSearch('通话时禁用多媒体')">
        <div class="item-label" style="display:flex; flex-direction:column; gap:4px;">
          <span>通话时禁用多媒体与互动功能</span>
          <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400;">禁止角色发图片/表情/转账等，省Token防幻觉</span>
        </div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" v-model="chatSettings.disableSpecialTagsInCall" @change="handleSave">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('通话时禁用心声')">
        <div class="item-label" style="display:flex; flex-direction:column; gap:4px;">
          <span>通话时禁用心声功能</span>
          <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400;">通话时不再生成长段心声，大幅加快开口响应速度</span>
        </div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" v-model="chatSettings.disableThoughtInCall" @change="handleSave">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      
      <!-- 新增线下模式的对应开关 -->
      <div class="glass-list-item" v-show="matchSearch('线下模式禁用多媒体')" style="border-top: 1px dashed rgba(0,0,0,0.05); padding-top: 12px; margin-top: 4px;">
        <div class="item-label" style="display:flex; flex-direction:column; gap:4px;">
          <span>线下模式禁用多媒体与互动</span>
          <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400;">进入线下见面模式后禁止发图/表情/转账/拨打电话</span>
        </div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" v-model="chatSettings.disableSpecialTagsInOffline" @change="handleSave">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('线下模式禁用心声')">
        <div class="item-label" style="display:flex; flex-direction:column; gap:4px;">
          <span>线下模式禁用心声功能</span>
          <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400;">线下见面时不再写心声碎碎念，提升沉浸感和响应速度</span>
        </div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" v-model="chatSettings.disableThoughtInOffline" @change="handleSave">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      
      <div class="glass-list-item" v-show="matchSearch('允许角色主动发朋友圈与互动', '朋友圈')" style="border-top: 1px dashed rgba(0,0,0,0.05); padding-top: 12px; margin-top: 4px;">
        <div class="item-label" style="display:flex; flex-direction:column; gap:4px;">
          <span>允许角色主动发朋友圈与互动</span>
          <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400;">角色可以随心所欲去刷朋友圈、点赞评论或发帖</span>
        </div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" v-model="chatSettings.enableCharMoments" @change="handleSave">
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="glass-list-item" v-show="matchSearch('允许角色主动拨打语音', '来电', '语音')" style="border-top: 1px dashed rgba(0,0,0,0.05); padding-top: 12px; margin-top: 4px;">
        <div class="item-label" style="display:flex; flex-direction:column; gap:4px;">
          <span>允许角色主动拨打语音</span>
          <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400;">关闭后角色拨来的语音会直接记为未接来电</span>
        </div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" v-model="chatSettings.enableCharVoiceCall" @change="handleSave">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      
      <div class="glass-list-item" v-show="matchSearch('允许角色主动拨打视频', '来电', '视频')">
        <div class="item-label" style="display:flex; flex-direction:column; gap:4px;">
          <span>允许角色主动拨打视频</span>
          <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400;">关闭后角色拨来的视频会直接记为未接来电</span>
        </div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" v-model="chatSettings.enableCharVideoCall" @change="handleSave">
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <template v-if="chatSettings.enableCharVoiceCall !== false || chatSettings.enableCharVideoCall !== false">
        <div class="glass-list-item" v-show="matchSearch('响铃时长', '来电')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ 来电响铃时长</div>
          <div class="item-value" style="display:flex; align-items:center; gap:8px;">
            <input type="number" v-model="chatSettings.charCallRingSeconds" @change="handleSave" style="width: 50px; text-align: right; background: transparent; border: none; font-size: 15px; color: var(--text-secondary); outline: none;" min="5" max="120">
            <span class="item-value-text">秒</span>
          </div>
        </div>
        <div class="glass-list-item" v-show="matchSearch('免打扰')">
          <div class="item-label" style="display:flex; flex-direction:column; gap:4px; padding-left: 12px;">
            <span style="font-size: 13px; color: var(--text-secondary);">└ 免打扰时段</span>
            <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 400;">留空表示不限制，此时段内来电不响铃</span>
          </div>
          <div class="item-value" style="display:flex; align-items:center; gap:4px;">
            <input type="time" v-model="chatSettings.dndStart" @change="handleSave" style="background: transparent; border: none; font-size: 13px; color: var(--text-secondary); outline: none;">
            <span class="item-value-text" style="font-size: 12px;">至</span>
            <input type="time" v-model="chatSettings.dndEnd" @change="handleSave" style="background: transparent; border: none; font-size: 13px; color: var(--text-secondary); outline: none;">
          </div>
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
  </div>
</template>

<style scoped>
@import './ChatSettingsStyles.css';
</style>
