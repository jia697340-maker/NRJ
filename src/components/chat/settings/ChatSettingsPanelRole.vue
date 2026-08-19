/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { chatSettings } from '../../../store'
import localforage from 'localforage'
import { canViewMoment } from '../../../services/moments'
import { getChatLanguageLabel } from '../../../constants/chatLanguages'
import { readGroupChats } from '../../../services/groupChat'
import { useChatAuth } from '../../../composables/useChatAuth'

const props = defineProps<{
  selectedChat: any
  characterCurrentTime: string
  getTimezoneLabel: (tz: string) => string
  matchSearch: (...keywords: (string | undefined | null)[]) => boolean
}>()

const emit = defineEmits<{
  (e: 'open-timezone-modal', target: 'character'): void
  (e: 'open-avatar-upload', target: 'contact'): void
  (e: 'open-text-modal', title: string, text: string, defaultText: string, placeholder: string, target: string): void
  (e: 'open-long-text-modal', title: string, text: string, defaultText: string, placeholder: string, target: string): void
  (e: 'show-voice-detail-modal'): void
  (e: 'show-nai-image-detail-modal'): void
  (e: 'show-gpt-image-detail-modal'): void
  (e: 'show-gemini-image-detail-modal'): void
  (e: 'show-flux-image-detail-modal'): void
  (e: 'show-niji-image-detail-modal'): void
  (e: 'show-seedream-image-detail-modal'): void
  (e: 'show-image-provider-modal'): void
  (e: 'show-identity-profile-modal', target: 'character'): void
  (e: 'show-world-book-bind-selector'): void
  (e: 'show-bilingual-option-modal', kind: 'mode' | 'display'): void
  (e: 'show-bilingual-language-modal', kind: 'output' | 'translation'): void
  (e: 'show-group-memory-bridge-modal'): void
  (e: 'open-character-profile'): void
  (e: 'save'): void
}>()

const { currentChatUserId } = useChatAuth()

const memoryBridgeSummary = computed(() => {
  if (!props.selectedChat) return '未开启'
  const entityId = String(props.selectedChat.characterEntityId || props.selectedChat.id || '')
  if (!entityId) return '未开启'
  const allGroups = readGroupChats(currentChatUserId.value)
  const connectedCount = allGroups.filter(g => 
    (g.memberIds || []).map(String).includes(entityId) && 
    Boolean(g.memberSettings?.[entityId]?.enableMemoryBridge)
  ).length
  return connectedCount > 0 ? `已开启 ${connectedCount} 个群聊` : '未开启'
})

const handleSave = () => {
  emit('save')
}

const toggleImmersiveStatus = (event: Event) => {
  const enabled = (event.target as HTMLInputElement).checked
  props.selectedChat.enableImmersiveStatus = enabled
  if (!enabled) {
    props.selectedChat.statusText = ''
    props.selectedChat.offlineUntil = 0
    props.selectedChat.statusSource = ''
    props.selectedChat.statusSetAt = 0
    props.selectedChat.presenceSession = null
    props.selectedChat.presencePendingReply = false
    props.selectedChat.autonomyAllowStatus = false
    props.selectedChat.autonomyStatusPermissionExplicit = true
    if (props.selectedChat.autonomyState && typeof props.selectedChat.autonomyState === 'object') {
      delete props.selectedChat.autonomyState.status
      delete props.selectedChat.autonomyState.statusSetAt
      delete props.selectedChat.autonomyState.statusSource
    }
  }
  handleSave()
}

const bilingualModeLabel = () => ({
  auto: '智能判断',
  forced: '强制指定',
  follow_user: '跟随用户'
} as Record<string, string>)[props.selectedChat?.bilingualMode || 'auto'] || '智能判断'

const translationDisplayLabel = () => ({
  tap: '点击后显示',
  always: '始终显示',
  translated_only: '仅显示译文',
  original_only: '仅显示原文'
} as Record<string, string>)[props.selectedChat?.translationDisplay || 'tap'] || '点击后显示'

// 朋友圈动态Token预估
const momentTokenEstimate = ref('')

const calculateMomentTokens = async () => {
  if (!props.selectedChat) {
    momentTokenEstimate.value = '计算中...'
    return
  }
  try {
    const discoverStore = localforage.createInstance({
      name: 'nrt-app',
      storeName: 'discover_moments'
    })
    
    // 我们需要通过当前已授权用户的ID去获取朋友圈列表
    // 由于在这里拿不到 user ID，暂退一步只获取全局的。如果遇到登录隔离这会有偏差，但作为UI预估可以接受。
    let storageKey = 'moments_list'
    try {
      const auth = localStorage.getItem('clingy_chat_auth')
      if (auth) {
        const authData = JSON.parse(auth)
        if (authData.currentUserId) storageKey = `moments_list_${authData.currentUserId}`
      }
    } catch(e) {}
    
    const moments = await discoverStore.getItem<any[]>(storageKey) || []
    const visibleMoments = moments
      .filter(m => canViewMoment(m, { id: props.selectedChat.id, name: props.selectedChat.name || '对方', groups: props.selectedChat.groups, groupIds: props.selectedChat.groupIds }))
      .filter(m => String(m.authorId ?? '') !== String(props.selectedChat.id) && m.author !== (props.selectedChat.name || '对方'))
      .sort((a, b) => Number((b.mentions || []).some((person: any) => String(person.id) === String(props.selectedChat.id))) - Number((a.mentions || []).some((person: any) => String(person.id) === String(props.selectedChat.id))) || Number(b.time) - Number(a.time))
      .slice(0, chatSettings.momentReadCount ?? 5)

    if (visibleMoments.length === 0) {
      momentTokenEstimate.value = '当前无最新动态'
      return
    }

    let rawTextLength = 0
    visibleMoments.forEach(m => {
      rawTextLength += (m.author || '').length
      rawTextLength += (m.content || '').length
      if (m.images && m.images.length) rawTextLength += 10 // 算上一句旁白提示
      if (m.comments?.length) {
        m.comments.forEach((c: any) => {
          rawTextLength += (c.author || '').length
          rawTextLength += (c.content || '').length
        })
      }
    })
    
    // 如果存在动态，则不加上强硬的 80 误导字数限制，仅根据真实内容加一点点基础系统词
    const estimatedTokens = Math.ceil((rawTextLength + 20) * 0.6)
    momentTokenEstimate.value = `将发送 ${visibleMoments.length} 条真实动态，按内容预计消耗 ~${estimatedTokens} Tokens`
  } catch (error) {
    momentTokenEstimate.value = '预估失败'
  }
}

watch(() => chatSettings.momentReadCount, calculateMomentTokens, { immediate: true })
watch(() => props.selectedChat, calculateMomentTokens)
</script>

<template>
  <div class="role-edit-section">
    <div class="user-avatar-action-box" style="margin-bottom: 24px;" v-show="matchSearch('当前时间', '角色主页', '待开发', '更换头像', '伴')">
      <div class="action-column">
        <div class="action-btn" @click="emit('open-timezone-modal', 'character')">
          <span style="font-size: 11px; opacity: 0.8; margin-bottom: 2px;">当前时间</span>
          <span style="font-family: monospace; font-size: 15px;">{{ characterCurrentTime }}</span>
        </div>
        <div class="action-btn placeholder">待开发</div>
      </div>
      
      <div class="role-edit-avatar-box">
        <div class="role-edit-avatar" @click="emit('open-avatar-upload', 'contact')" :style="selectedChat?.avatarUrl ? { backgroundImage: `url(${selectedChat.avatarUrl})` } : {}">
          <span v-if="!selectedChat?.avatarUrl">{{ selectedChat?.avatarText || '伴' }}</span>
          <div class="avatar-edit-overlay">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#fff" stroke-width="2" fill="none"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          </div>
        </div>
        <div class="role-edit-avatar-tip">点击更换头像</div>
      </div>
      
      <div class="action-column">
        <button type="button" class="action-btn" @click="emit('open-character-profile')">角色主页</button>
        <div class="action-btn placeholder">待开发</div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('真名', '备注', '角色设定')">
      <div class="glass-list-item" v-show="matchSearch('真名')" @click="emit('open-text-modal', '编辑真名', selectedChat.realName, '', '请输入真名', 'realName')">
        <div class="item-label">真名</div>
        <div class="item-value"><span class="item-value-text">{{ selectedChat.realName || '未设置' }}</span><span class="arrow">></span></div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('备注')" @click="emit('open-text-modal', '编辑备注', selectedChat.remark, '', '请输入备注', 'remark')">
        <div class="item-label">备注</div>
        <div class="item-value"><span class="item-value-text">{{ selectedChat.remark || '未设置' }}</span><span class="arrow">></span></div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('角色设定')" @click="emit('open-long-text-modal', '编辑角色设定', selectedChat.persona, '', '请详细描述该角色的性格、背景等设定，可以包含多段落...', 'persona')">
        <div class="item-label">角色设定</div>
        <div class="item-value"><span class="item-value-text">{{ selectedChat.persona || '未设置' }}</span><span class="arrow">></span></div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('双语对话', '语言控制模式', '角色输出语言', '翻译目标语言', '翻译显示方式')">
      <div class="glass-list-item" v-show="matchSearch('双语对话')">
        <div class="item-label">双语对话</div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" :checked="!!selectedChat.bilingualEnabled" @change="(e) => { selectedChat.bilingualEnabled = (e.target as HTMLInputElement).checked; handleSave(); }">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <template v-if="selectedChat.bilingualEnabled">
        <div class="glass-list-item" v-show="matchSearch('语言控制模式')" @click="emit('show-bilingual-option-modal', 'mode')">
          <div class="item-label bilingual-child-label">└ 语言控制模式</div>
          <div class="item-value"><span class="item-value-text">{{ bilingualModeLabel() }}</span><span class="arrow">></span></div>
        </div>
        <div class="glass-list-item" v-show="matchSearch('角色输出语言')" @click="emit('show-bilingual-language-modal', 'output')">
          <div class="item-label bilingual-child-label">└ 角色输出语言</div>
          <div class="item-value"><span class="item-value-text">{{ getChatLanguageLabel(selectedChat.dialogueLanguage || 'auto', selectedChat.customDialogueLanguage) }}</span><span class="arrow">></span></div>
        </div>
        <div class="glass-list-item" v-show="matchSearch('翻译目标语言')" @click="emit('show-bilingual-language-modal', 'translation')">
          <div class="item-label bilingual-child-label">└ 翻译目标语言</div>
          <div class="item-value"><span class="item-value-text">{{ getChatLanguageLabel(selectedChat.translationLanguage || 'app', selectedChat.customTranslationLanguage) }}</span><span class="arrow">></span></div>
        </div>
        <div class="glass-list-item" v-show="matchSearch('翻译显示方式')" @click="emit('show-bilingual-option-modal', 'display')">
          <div class="item-label bilingual-child-label">└ 翻译显示方式</div>
          <div class="item-value"><span class="item-value-text">{{ translationDisplayLabel() }}</span><span class="arrow">></span></div>
        </div>
      </template>
    </div>

    <div class="glass-panel" v-show="matchSearch('开启角色语音接入', '开启角色语音通话接入', '开启角色视频通话接入', '语音详细配置', '语音引擎', 'Seed Audio', 'Gemini TTS', 'ElevenLabs', 'Microsoft MAI Voice', '语音模型', '发音语言', '音色 ID', '合成音量', '合成语速', '合成语调', '情感风格')">
      <div class="glass-list-item" v-show="matchSearch('开启角色语音接入')">
        <div class="item-label">开启角色语音接入</div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" :checked="!!selectedChat.enableVoiceReply" @change="(e) => { selectedChat.enableVoiceReply = (e.target as HTMLInputElement).checked; handleSave(); }">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('开启角色语音通话接入')">
        <div class="item-label">开启角色语音通话接入</div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" :checked="!!selectedChat.enableVoiceCall" @change="(e) => { selectedChat.enableVoiceCall = (e.target as HTMLInputElement).checked; handleSave(); }">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('开启角色视频通话接入')">
        <div class="item-label">开启角色视频通话接入</div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" :checked="!!selectedChat.enableVideoCall" @change="(e) => { selectedChat.enableVideoCall = (e.target as HTMLInputElement).checked; handleSave(); }">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <template v-if="selectedChat.enableVoiceReply || selectedChat.enableVoiceCall || selectedChat.enableVideoCall">
        <div class="glass-list-item" v-show="matchSearch('语音详细配置', '通话语音详细配置')" @click="emit('show-voice-detail-modal')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ 通话语音详细配置</div>
          <div class="item-value">
            <span class="item-value-text">{{ selectedChat.voiceProvider === 'seed_audio' ? 'Seed Audio 1.0 · 独立配置' : selectedChat.voiceProvider === 'gemini' ? 'Gemini TTS · 音色与声音指令' : selectedChat.voiceProvider === 'elevenlabs' ? 'ElevenLabs · 音色与表现参数' : selectedChat.voiceProvider === 'microsoft_mai' ? 'Microsoft MAI · 音色与情绪风格' : selectedChat.voiceProvider === 'aliyun_tts' ? '阿里云 TTS · 音色与声音指令' : 'MiniMax · 语言、音色与参数' }}</span>
            <span class="arrow">></span>
          </div>
        </div>
      </template>
    </div>

    <div class="glass-panel" v-show="matchSearch('开启角色生图', '固定形象', '锁脸', '生图引擎', 'NAI生图详细配置', 'GPT生图详细配置', 'Gemini生图详细配置', 'FLUX生图详细配置', 'Niji生图详细配置', 'Seedream生图详细配置')">
      <div class="glass-list-item" v-show="matchSearch('开启角色生图')">
        <div class="item-label">开启角色生图</div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" :checked="!!selectedChat.enableNAIImageGen" @change="(e) => { selectedChat.enableNAIImageGen = (e.target as HTMLInputElement).checked; handleSave(); }">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <template v-if="selectedChat.enableNAIImageGen">
        <div class="glass-list-item" v-show="matchSearch('固定形象', '锁脸', '角色一致性')" @click="emit('show-identity-profile-modal', 'character')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ 角色固定形象</div>
          <div class="item-value"><span class="item-value-text">形象版本、参考素材与多人同框</span><span class="arrow">></span></div>
        </div>
        <div class="glass-list-item" v-show="matchSearch('生图引擎', 'NovelAI', 'GPT Image', 'Gemini Image', 'FLUX.2', 'Niji 7', 'Seedream 5.0')" @click="emit('show-image-provider-modal')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ 生图引擎</div>
          <div class="item-value">
            <span class="item-value-text">{{ (selectedChat.imageGenProvider || 'novelai') === 'novelai' ? 'NovelAI' : selectedChat.imageGenProvider === 'gemini' ? 'Gemini Image' : selectedChat.imageGenProvider === 'flux' ? 'FLUX.2' : selectedChat.imageGenProvider === 'niji' ? 'Niji 7' : selectedChat.imageGenProvider === 'seedream' ? 'Seedream 5.0' : 'GPT Image' }}</span>
            <span class="arrow">></span>
          </div>
        </div>
        <div v-if="(selectedChat.imageGenProvider || 'novelai') === 'novelai'" class="glass-list-item" v-show="matchSearch('NAI生图详细配置')" @click="emit('show-nai-image-detail-modal')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ NAI 生图详细配置</div>
          <div class="item-value">
            <span class="item-value-text">绑定画师串与参数</span>
            <span class="arrow">></span>
          </div>
        </div>
        <div v-else-if="selectedChat.imageGenProvider === 'gpt'" class="glass-list-item" v-show="matchSearch('GPT生图详细配置')" @click="emit('show-gpt-image-detail-modal')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ GPT 生图详细配置</div>
          <div class="item-value">
            <span class="item-value-text">设置自然语言提示词与参考组</span>
            <span class="arrow">></span>
          </div>
        </div>
        <div v-else-if="selectedChat.imageGenProvider === 'gemini'" class="glass-list-item" v-show="matchSearch('Gemini生图详细配置')" @click="emit('show-gemini-image-detail-modal')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ Gemini 生图详细配置</div>
          <div class="item-value">
            <span class="item-value-text">设置原生模型、上下文与参考组</span>
            <span class="arrow">></span>
          </div>
        </div>
        <div v-else-if="selectedChat.imageGenProvider === 'flux'" class="glass-list-item" v-show="matchSearch('FLUX生图详细配置')" @click="emit('show-flux-image-detail-modal')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ FLUX 生图详细配置</div>
          <div class="item-value">
            <span class="item-value-text">设置 Pro / Max、尺寸与独立参考组</span>
            <span class="arrow">></span>
          </div>
        </div>
        <div v-else-if="selectedChat.imageGenProvider === 'niji'" class="glass-list-item" v-show="matchSearch('Niji生图详细配置')" @click="emit('show-niji-image-detail-modal')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ Niji 7 生图详细配置</div>
          <div class="item-value"><span class="item-value-text">设置中转协议、Niji 参数与提示词</span><span class="arrow">></span></div>
        </div>
        <div v-else class="glass-list-item" v-show="matchSearch('Seedream生图详细配置')" @click="emit('show-seedream-image-detail-modal')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ Seedream 生图详细配置</div>
          <div class="item-value"><span class="item-value-text">设置方舟模型、清晰度与独立参考组</span><span class="arrow">></span></div>
        </div>
      </template>
    </div>

    <div class="glass-panel" v-show="matchSearch('沉浸模式与状态', '启用沉浸式状态与时间流逝')">
      <div class="glass-list-item" v-show="matchSearch('启用沉浸式状态与时间流逝')">
        <div style="display: flex; flex-direction: column; width: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="item-label">启用沉浸式状态与时间流逝</div>
            <div class="item-value" style="flex: unset;">
              <label class="switch" @click.stop>
                <input type="checkbox" :checked="!!selectedChat.enableImmersiveStatus" @change="toggleImmersiveStatus">
                <span class="slider"></span>
              </label>
            </div>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.3;">
            开启后，角色可自主决定“下线/睡眠”等状态，并可出现已读不回等拟真反应。
          </div>
        </div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('打电话角色先开口', '通话', '电话', '先开口')">
      <div class="glass-list-item" v-show="matchSearch('打电话角色先开口', '通话', '电话', '先开口')">
        <div style="display: flex; flex-direction: column; width: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="item-label">打电话角色先开口</div>
            <div class="item-value" style="flex: unset;">
              <label class="switch" @click.stop>
                <input type="checkbox" :checked="!!selectedChat.charSpeaksFirstOnCall" @change="(e) => { selectedChat.charSpeaksFirstOnCall = (e.target as HTMLInputElement).checked; handleSave(); }">
                <span class="slider"></span>
              </label>
            </div>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.3;">
            开启后电话一接通角色就会主动说第一句话，关闭则等你先开口。
          </div>
        </div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('角色获取朋友圈条数', '数量', '朋友圈')">
      <div class="glass-list-item" v-show="matchSearch('角色获取朋友圈条数', '数量', '朋友圈')">
        <div style="display: flex; flex-direction: column; width: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="item-label">角色获取朋友圈条数</div>
            <div class="item-value" style="flex: unset; display: flex; align-items: center; gap: 8px;">
              <input type="number" 
                :value="chatSettings.momentReadCount" 
                @change="(e) => { 
                  let val = parseInt((e.target as HTMLInputElement).value);
                  if (isNaN(val) || val < 1) val = 1;
                  chatSettings.momentReadCount = val; 
                  handleSave(); 
                }"
                min="1"
                style="width: 50px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 2px 4px; text-align: center; color: var(--text-primary); outline: none;"
              >
              <span style="font-size: 13px; color: var(--text-secondary);">条</span>
            </div>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.3;">
            {{ momentTokenEstimate }}
          </div>
        </div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('关联世界书', '分组', '角色时区', '允许角色看到表情包图像', '角色根据表情包图形发送', 'token')">
      <div class="glass-list-item" v-show="matchSearch('关联世界书', '分组')" @click="emit('show-world-book-bind-selector')">
        <div class="item-label">关联世界书/分组</div>
        <div class="item-value">
          <span class="item-value-text">
            <template v-if="!selectedChat.boundWorldBooks?.length && !selectedChat.boundWorldBookGroups?.length">未绑定</template>
            <template v-else>已绑定 {{ (selectedChat.boundWorldBookGroups?.length || 0) + (selectedChat.boundWorldBooks?.length || 0) }} 项</template>
          </span>
          <span class="arrow">></span>
        </div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('群聊记忆互通', '记忆互通', '群记忆', '单聊记忆')" @click="emit('show-group-memory-bridge-modal')">
        <div class="item-label">群聊记忆互通</div>
        <div class="item-value">
          <span class="item-value-text">{{ memoryBridgeSummary }}</span>
          <span class="arrow">></span>
        </div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('角色时区')" :class="{ 'disabled-block': !selectedChat.timePerception }" @click="emit('open-timezone-modal', 'character')">
        <div class="item-label">角色时区</div>
        <div class="item-value"><span class="item-value-text">{{ getTimezoneLabel(selectedChat.timezone) || '默认' }}</span><span class="arrow">></span></div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('允许角色看到表情包图像')">
        <div class="item-label">允许角色看到表情包图像</div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" :checked="!!selectedChat.enableEmojiVision" @change="(e) => { selectedChat.enableEmojiVision = (e.target as HTMLInputElement).checked; handleSave(); }">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('角色根据表情包图形发送', 'token')">
        <div style="display: flex; flex-direction: column; width: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="item-label">角色根据表情包图形发送</div>
            <div class="item-value" style="flex: unset;">
              <label class="switch" @click.stop>
                <input type="checkbox" :checked="!!selectedChat.enableRoleEmojiVision" @change="(e) => { selectedChat.enableRoleEmojiVision = (e.target as HTMLInputElement).checked; handleSave(); }">
                <span class="slider"></span>
              </label>
            </div>
          </div>
          <div v-if="selectedChat.enableRoleEmojiVision" style="font-size: 11px; color: #FF4D4F; margin-top: 4px; line-height: 1.3;">
            开启后会把所有可用表情包图片发送给大模型识别，极度消耗 TOKEN。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bilingual-child-label {
  padding-left: 12px;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>

<style scoped>
@import './ChatSettingsStyles.css';
</style>
