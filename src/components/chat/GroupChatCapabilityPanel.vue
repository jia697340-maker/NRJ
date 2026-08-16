<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GroupChatRecord } from '../../services/groupChat'
import ChatBilingualOptionModal from './modals/ChatBilingualOptionModal.vue'

const props = defineProps<{ group: GroupChatRecord; match: (...keywords: string[]) => boolean }>()
const emit = defineEmits<{ (e: 'save'): void }>()
const save = () => emit('save')

const showImageRecognitionModal = ref(false)

const imageRecognitionOptions = [
  { value: 'description_only', label: '省 Token', description: '只携带图片文字描述，不重复发送原图' },
  { value: 'visual', label: '完整视觉', description: '将原图发送给模型识别，效果更完整但消耗更高' }
]

const currentImageRecognitionLabel = computed(() => {
  const current = imageRecognitionOptions.find(opt => opt.value === (props.group.imageRecognitionMode || 'description_only'))
  return current?.label || '省 Token'
})

const currentImageRecognitionDesc = computed(() => {
  const current = imageRecognitionOptions.find(opt => opt.value === (props.group.imageRecognitionMode || 'description_only'))
  return current?.description || '只携带图片文字描述，不重复发送原图'
})

const selectImageRecognitionMode = (val: string) => {
  props.group.imageRecognitionMode = val as GroupChatRecord['imageRecognitionMode']
  save()
}
</script>

<template>
  <section class="role-edit-section">
    <div v-show="match('表情包', '单人表情', '视觉隔离')" class="glass-panel">
      <div class="glass-list-item"><div><div class="item-label">引用成员单人表情包</div><div class="group-item-desc">成员只能引用自己的单聊专属表情，不复制文件</div></div><label class="switch"><input v-model="group.referenceMemberEmojiLibraries" type="checkbox" @change="save"><span class="slider"></span></label></div>
      <div class="glass-list-item" @click="group.emojiVisionScope = group.emojiVisionScope === 'enabled_members' ? 'all_members' : 'enabled_members'; save()"><div><div class="item-label">表情视觉范围</div><div class="group-item-desc">{{ group.emojiVisionScope === 'enabled_members' ? '仅授权已开启视觉的成员，其他成员不得形成图像认知' : '表情图像对全体群成员可见' }}</div></div><div class="item-value"><span class="item-value-text">{{ group.emojiVisionScope === 'enabled_members' ? '成员隔离' : '全群可见' }}</span><span class="arrow">›</span></div></div>
    </div>

    <div v-show="match('图片识别', '省 Token', '视觉', '图片上下文')" class="glass-panel">
      <div class="glass-list-item" @click="showImageRecognitionModal = true">
        <div>
          <div class="item-label">图片上下文</div>
          <div class="group-item-desc">{{ currentImageRecognitionDesc }}</div>
        </div>
        <div class="item-value">
          <span class="item-value-text">{{ currentImageRecognitionLabel }}</span>
          <span class="arrow">›</span>
        </div>
      </div>
    </div>

    <ChatBilingualOptionModal
      v-model:visible="showImageRecognitionModal"
      title="图片上下文"
      :current-value="group.imageRecognitionMode || 'description_only'"
      :options="imageRecognitionOptions"
      @select="selectImageRecognitionMode"
    />

    <div v-show="match('群通话', '短期上下文', '临时总结')" class="glass-panel">
      <div class="group-section-title">群通话上下文</div>
      <div class="glass-list-item"><span class="item-label">语音短期上下文</span><div class="item-value"><input v-model.number="group.voiceCallMemoryValue" class="group-inline-number" type="number" min="1" max="200" @change="save"><span class="item-value-text">条</span></div></div>
      <div class="glass-list-item"><span class="item-label">视频短期上下文</span><div class="item-value"><input v-model.number="group.videoCallMemoryValue" class="group-inline-number" type="number" min="1" max="200" @change="save"><span class="item-value-text">条</span></div></div>
      <div class="glass-list-item"><span class="item-label">临时总结频次</span><div class="item-value"><input v-model.number="group.callSummaryFrequency" class="group-inline-number" type="number" min="4" max="100" @change="save"><span class="item-value-text">条</span></div></div>
    </div>

    <div v-show="match('通话禁用', '线下禁用', '多媒体', '心声')" class="glass-panel">
      <div class="glass-list-item"><span class="item-label">通话时禁用多媒体与互动</span><label class="switch"><input v-model="group.disableMediaDuringCall" type="checkbox" @change="save"><span class="slider"></span></label></div>
      <div class="glass-list-item"><span class="item-label">通话时禁用心声</span><label class="switch"><input v-model="group.disableThoughtDuringCall" type="checkbox" @change="save"><span class="slider"></span></label></div>
      <div class="glass-list-item"><span class="item-label">线下时禁用多媒体与互动</span><label class="switch"><input v-model="group.disableMediaDuringOffline" type="checkbox" @change="save"><span class="slider"></span></label></div>
      <div class="glass-list-item"><span class="item-label">线下时禁用心声</span><label class="switch"><input v-model="group.disableThoughtDuringOffline" type="checkbox" @change="save"><span class="slider"></span></label></div>
    </div>

    <div v-show="match('角色自主活动', '主动消息', '主动提及', '防刷屏')" class="glass-panel">
      <div class="glass-list-item"><div><div class="item-label">群成员自主活动</div><div class="group-item-desc">允许成员在活跃时段主动发言，并受频率和每日上限控制</div></div><label class="switch"><input v-model="group.autonomyEnabled" type="checkbox" @change="save"><span class="slider"></span></label></div>
      <template v-if="group.autonomyEnabled">
        <div class="glass-list-item"><span class="item-label bilingual-child-label">└ 允许主动消息</span><label class="switch"><input v-model="group.autonomyAllowMessages" type="checkbox" @change="save"><span class="slider"></span></label></div>
        <div class="glass-list-item"><span class="item-label bilingual-child-label">└ 允许主动提及成员</span><label class="switch"><input v-model="group.autonomyAllowMentions" type="checkbox" @change="save"><span class="slider"></span></label></div>
        <div class="glass-list-item"><span class="item-label bilingual-child-label">└ 允许群内状态事件</span><label class="switch"><input v-model="group.autonomyAllowStatusEvents" type="checkbox" @change="save"><span class="slider"></span></label></div>
        <div class="glass-list-item"><span class="item-label bilingual-child-label">└ 最小间隔</span><div class="item-value"><input v-model.number="group.autonomyMinIntervalMinutes" class="group-inline-number" type="number" min="5" max="10080" @change="save"><span class="item-value-text">分钟</span></div></div>
        <div class="glass-list-item"><span class="item-label bilingual-child-label">└ 每日最多</span><div class="item-value"><input v-model.number="group.autonomyMaxMessagesPerDay" class="group-inline-number" type="number" min="1" max="50" @change="save"><span class="item-value-text">次</span></div></div>
        <div class="glass-list-item"><span class="item-label bilingual-child-label">└ 活跃时段</span><div class="item-value"><input v-model.number="group.autonomyActiveStart" class="group-inline-number" type="number" min="0" max="23" @change="save"><span class="item-value-text">时 至</span><input v-model.number="group.autonomyActiveEnd" class="group-inline-number" type="number" min="1" max="24" @change="save"><span class="item-value-text">时</span></div></div>
      </template>
    </div>

    <div v-show="match('主动来电', '群语音', '群视频', '免打扰')" class="glass-panel">
      <div class="glass-list-item"><div><div class="item-label">允许成员主动发起群通话</div><div class="group-item-desc">仅具备对应通话能力的成员可发起，并遵守来电时段与间隔</div></div><label class="switch"><input v-model="group.incomingCallEnabled" type="checkbox" @change="save"><span class="slider"></span></label></div>
      <template v-if="group.incomingCallEnabled">
        <div class="glass-list-item"><span class="item-label bilingual-child-label">└ 自主活动允许来电</span><label class="switch"><input v-model="group.autonomyAllowIncomingCalls" type="checkbox" @change="save"><span class="slider"></span></label></div>
        <div class="glass-list-item"><span class="item-label bilingual-child-label">└ 最小来电间隔</span><div class="item-value"><input v-model.number="group.incomingCallMinIntervalMinutes" class="group-inline-number" type="number" min="30" max="10080" @change="save"><span class="item-value-text">分钟</span></div></div>
        <div class="glass-list-item"><span class="item-label bilingual-child-label">└ 允许来电时段</span><div class="item-value"><input v-model.number="group.incomingCallStartHour" class="group-inline-number" type="number" min="0" max="23" @change="save"><span class="item-value-text">时 至</span><input v-model.number="group.incomingCallEndHour" class="group-inline-number" type="number" min="1" max="24" @change="save"><span class="item-value-text">时</span></div></div>
      </template>
    </div>
  </section>
</template>

<style scoped>
@import './settings/ChatSettingsStyles.css';
.group-section-title{padding:13px 16px 8px;font-size:11px;color:var(--text-tertiary)}.group-item-desc{font-size:10px;color:var(--text-tertiary);margin-top:4px}.group-radio{width:18px;height:18px;border:1.5px solid var(--text-tertiary);border-radius:50%;box-sizing:border-box}.group-radio.active{border:5px solid var(--text-primary)}.bilingual-child-label{padding-left:12px;font-size:13px;color:var(--text-secondary)}.group-inline-number{width:54px;border:0;background:transparent;color:var(--text-secondary);font:inherit;text-align:right;outline:none;appearance:textfield}.group-inline-number::-webkit-inner-spin-button,.group-inline-number::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
</style>
