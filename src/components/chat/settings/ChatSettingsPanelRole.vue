/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { chatSettings } from '../../../store'
import localforage from 'localforage'
import { canViewMoment } from '../../../services/moments'
import { getChatLanguageLabel } from '../../../constants/chatLanguages'
import { readGroupChats } from '../../../services/groupChat'
import { useChatAuth } from '../../../composables/useChatAuth'
import { ensureRelationship } from '../../../composables/useChatRelationship'
import { getImageProviderName } from '../../../services/imageProviderRegistry'
import { getIdentityClockLabel } from '../../../services/conversationTime'
import { DEFAULT_FILE_FORMATS } from '../../../services/characterCapabilities'
import { deleteCharacterAssetIfUnreferenced, saveCharacterAsset, updateCharacterAssetMeta } from '../../../services/characterAssetRepository'
import { CHARACTER_VIDEO_PROVIDERS, canUseCharacterVideoAdapter, getCharacterVideoProvider, getCharacterVideoProviderDefaults, readVideoMetadata } from '../../../services/videoGenerationService'
import type { CharacterAssetMeta, GeneratedFileFormat } from '../../../types/chatAssets'

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
  (e: 'show-pollinations-image-detail-modal'): void
  (e: 'show-ai-horde-image-detail-modal'): void
  (e: 'show-image-provider-modal'): void
  (e: 'show-identity-profile-modal', target: 'character'): void
  (e: 'show-world-book-bind-selector'): void
  (e: 'show-bilingual-option-modal', kind: 'mode' | 'display'): void
  (e: 'show-bilingual-language-modal', kind: 'output' | 'translation'): void
  (e: 'show-group-memory-bridge-modal'): void
  (e: 'show-social-circle-modal'): void
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

const fileInput = ref<HTMLInputElement | null>(null)
const videoInput = ref<HTMLInputElement | null>(null)
const assetBusy = ref(false)
const assetNotice = ref('')
const pendingDeleteAssetId = ref('')
const characterAssets = computed<CharacterAssetMeta[]>(() => Array.isArray(props.selectedChat?.characterAssets) ? props.selectedChat.characterAssets : [])
const characterFiles = computed(() => characterAssets.value.filter(asset => asset.kind === 'file'))
const characterVideos = computed(() => characterAssets.value.filter(asset => asset.kind === 'video'))
const characterOwnerId = () => String(props.selectedChat?.characterEntityId || props.selectedChat?.id || '')
const ensureFileConfig = () => {
  props.selectedChat.fileGenerationConfig ||= { enabled: true, allowedFormats: [...DEFAULT_FILE_FORMATS], maxSizeMb: 30 }
  if (!Array.isArray(props.selectedChat.fileGenerationConfig.allowedFormats)) props.selectedChat.fileGenerationConfig.allowedFormats = [...DEFAULT_FILE_FORMATS]
}
const ensureVideoConfig = () => {
  props.selectedChat.videoGenerationConfig ||= { ...getCharacterVideoProviderDefaults('veo'), enabled: false, baseUrl: '', maxDailyGenerations: 3, maxEstimatedCost: 1 }
}
const selectedVideoProvider = computed(() => getCharacterVideoProvider(String(props.selectedChat?.videoGenerationConfig?.provider || 'veo')) || CHARACTER_VIDEO_PROVIDERS[0])
const selectedVideoProviderReady = computed(() => canUseCharacterVideoAdapter(props.selectedChat?.videoGenerationConfig))
const toggleFileCapability = (event: Event) => {
  props.selectedChat.enableFileCapability = (event.target as HTMLInputElement).checked
  ensureFileConfig(); handleSave()
}
const toggleVideoMessageCapability = (event: Event) => {
  props.selectedChat.enableVideoMessageCapability = (event.target as HTMLInputElement).checked
  ensureVideoConfig(); handleSave()
}
const toggleFileFormat = (format: GeneratedFileFormat) => {
  ensureFileConfig()
  const selected = new Set<GeneratedFileFormat>(props.selectedChat.fileGenerationConfig.allowedFormats)
  selected.has(format) ? selected.delete(format) : selected.add(format)
  props.selectedChat.fileGenerationConfig.allowedFormats = DEFAULT_FILE_FORMATS.filter(item => selected.has(item))
  handleSave()
}
const addConfiguredAssets = async (files: FileList | null, kind: 'file' | 'video') => {
  if (!files?.length || assetBusy.value) return
  assetBusy.value = true; assetNotice.value = ''
  try {
    const maxBytes = kind === 'video' ? 500 * 1024 * 1024 : Math.max(1, Number(props.selectedChat.fileGenerationConfig?.maxSizeMb || 30)) * 1024 * 1024
    for (const file of Array.from(files)) {
      if (!file.size) throw new Error(`${file.name} 是空文件`)
      if (file.size > maxBytes) throw new Error(`${file.name} 超过 ${kind === 'video' ? '500 MB' : `${props.selectedChat.fileGenerationConfig?.maxSizeMb || 30} MB`} 限制`)
      if (kind === 'video' && !file.type.startsWith('video/')) throw new Error(`${file.name} 不是可识别的视频文件`)
      const metadata = kind === 'video' ? await readVideoMetadata(file) : {}
      const asset = await saveCharacterAsset({ ownerCharacterId: characterOwnerId(), kind, source: 'configured', blob: file, name: file.name, summary: file.name.replace(/\.[^.]+$/, ''), groupVisibility: 'allowed', ...metadata })
      props.selectedChat.characterAssets = [...characterAssets.value, asset]
    }
    assetNotice.value = kind === 'video' ? '真实视频已加入角色资源' : '真实文件已加入角色资源'
    await handleSave()
  } catch (reason) { assetNotice.value = reason instanceof Error ? reason.message : '资源保存失败' }
  finally {
    assetBusy.value = false
    if (fileInput.value) fileInput.value.value = ''
    if (videoInput.value) videoInput.value.value = ''
  }
}
const requestDeleteAsset = async (asset: CharacterAssetMeta) => {
  if (pendingDeleteAssetId.value !== asset.id) { pendingDeleteAssetId.value = asset.id; return }
  try {
    const removedBlob = await deleteCharacterAssetIfUnreferenced(asset, currentChatUserId.value)
    props.selectedChat.characterAssets = characterAssets.value.filter(item => item.id !== asset.id)
    pendingDeleteAssetId.value = ''
    assetNotice.value = removedBlob ? '角色资源已删除' : '已从角色资源中移除；聊天历史仍在引用，真实文件已保留'
    await handleSave()
  } catch (reason) { assetNotice.value = reason instanceof Error ? reason.message : '删除失败' }
}
const setAssetGroupVisibility = async (asset: CharacterAssetMeta) => {
  props.selectedChat.characterAssets = updateCharacterAssetMeta(characterAssets.value, asset.id, { groupVisibility: asset.groupVisibility === 'allowed' ? 'private_only' : 'allowed' })
  await handleSave()
}
const setAssetSummary = async (asset: CharacterAssetMeta, summary: string) => {
  props.selectedChat.characterAssets = updateCharacterAssetMeta(characterAssets.value, asset.id, { summary: summary.trim().slice(0, 500) })
  await handleSave()
}
const setVideoOption = (key: 'aspectRatio' | 'resolution' | 'durationSeconds', value: string | number) => {
  ensureVideoConfig()
  props.selectedChat.videoGenerationConfig[key] = value
  if (selectedVideoProvider.value.id === 'veo') {
    if (key === 'resolution' && value !== '720p') props.selectedChat.videoGenerationConfig.durationSeconds = 8
    if (key === 'durationSeconds' && value !== 8 && props.selectedChat.videoGenerationConfig.resolution !== '720p') props.selectedChat.videoGenerationConfig.resolution = '720p'
  }
  handleSave()
}
const setVideoProvider = (providerId: string) => {
  ensureVideoConfig()
  const previous = props.selectedChat.videoGenerationConfig
  props.selectedChat.videoGenerationConfig = { ...previous, ...getCharacterVideoProviderDefaults(providerId), enabled: previous.enabled, maxDailyGenerations: previous.maxDailyGenerations, maxEstimatedCost: previous.maxEstimatedCost, baseUrl: '' }
  handleSave()
}
const setVideoModel = (event: Event) => {
  ensureVideoConfig()
  props.selectedChat.videoGenerationConfig.model = (event.target as HTMLSelectElement).value
  if (selectedVideoProvider.value.id === 'veo' && props.selectedChat.videoGenerationConfig.model === 'veo-3.1-lite-generate-preview' && props.selectedChat.videoGenerationConfig.resolution === '4k') props.selectedChat.videoGenerationConfig.resolution = '720p'
  handleSave()
}
const normalizeVideoDuration = () => {
  ensureVideoConfig()
  const provider = selectedVideoProvider.value
  props.selectedChat.videoGenerationConfig.durationSeconds = Math.max(provider.durationMin, Math.min(provider.durationMax, Math.round(Number(props.selectedChat.videoGenerationConfig.durationSeconds) || provider.defaultDuration)))
  if (provider.id === 'veo' && props.selectedChat.videoGenerationConfig.resolution !== '720p') props.selectedChat.videoGenerationConfig.durationSeconds = 8
  handleSave()
}
const normalizeAssetNumber = (target: 'fileSize' | 'daily' | 'cost') => {
  if (target === 'fileSize') props.selectedChat.fileGenerationConfig.maxSizeMb = Math.max(1, Math.min(200, Number(props.selectedChat.fileGenerationConfig.maxSizeMb) || 30))
  else if (target === 'daily') props.selectedChat.videoGenerationConfig.maxDailyGenerations = Math.max(1, Math.min(50, Number(props.selectedChat.videoGenerationConfig.maxDailyGenerations) || 3))
  else props.selectedChat.videoGenerationConfig.maxEstimatedCost = Math.max(0, Number(props.selectedChat.videoGenerationConfig.maxEstimatedCost) || 0)
  handleSave()
}
const formatAssetSize = (size: number) => size < 1024 * 1024 ? `${Math.max(1, size / 1024).toFixed(0)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`

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
      .filter(m => canViewMoment(m, { id: props.selectedChat.id, name: props.selectedChat.name || '对方', groups: props.selectedChat.groups, groupIds: props.selectedChat.groupIds, isFriend: ensureRelationship(props.selectedChat).friendship === 'friends' }))
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
    <div class="user-avatar-action-box" style="margin-bottom: 24px;" v-show="matchSearch('当前时间', '待开发', '更换头像', '伴')">
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
        <div class="action-btn placeholder">待开发</div>
        <div class="action-btn placeholder">待开发</div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('角色主页', '真名', '备注', '角色设定', '社交人脉', '朋友圈人物', '生活圈')">
      <div class="glass-list-item" v-show="matchSearch('角色主页')" @click="emit('open-character-profile')">
        <div class="item-label">角色主页</div>
        <div class="item-value"><span class="item-value-text">查看角色详细资料与设定</span><span class="arrow">></span></div>
      </div>
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
      <div class="glass-list-item" v-show="matchSearch('社交人脉', '朋友圈人物', '生活圈')" @click="emit('show-social-circle-modal')">
        <div class="item-label">社交人脉</div>
        <div class="item-value">
          <span class="item-value-text">{{ selectedChat.socialCircle?.length ? `已配置 ${selectedChat.socialCircle.length} 位生活人脉` : '未配置' }}</span>
          <span class="arrow">></span>
        </div>
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
            <span class="item-value-text">{{ selectedChat.voiceProvider === 'seed_audio' ? 'Seed Audio 1.0 · 独立配置' : selectedChat.voiceProvider === 'gemini' ? 'Gemini TTS · 音色与声音指令' : selectedChat.voiceProvider === 'elevenlabs' ? 'ElevenLabs · 音色与表现参数' : selectedChat.voiceProvider === 'microsoft_mai' ? 'Microsoft MAI · 音色与情绪风格' : selectedChat.voiceProvider === 'aliyun_tts' ? '阿里云 TTS · 音色与声音指令' : selectedChat.voiceProvider === 'doubao_tts' ? '豆包语音 · 音色与表达参数' : selectedChat.voiceProvider === 'fish_audio' ? 'Fish Audio · 克隆音色与表现参数' : 'MiniMax · 语言、音色与参数' }}</span>
            <span class="arrow">></span>
          </div>
        </div>
      </template>
    </div>

    <div class="glass-panel" v-show="matchSearch('开启角色生图', '固定形象', '锁脸', '生图引擎', 'NAI生图详细配置', 'GPT生图详细配置', 'Gemini生图详细配置', 'FLUX生图详细配置', 'Niji生图详细配置', 'Seedream生图详细配置', 'Pollinations生图详细配置', 'AI Horde生图详细配置')">
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
        <div class="glass-list-item" v-show="matchSearch('生图引擎', 'NovelAI', 'GPT Image', 'Gemini Image', 'FLUX.2', 'Niji 7', 'Seedream 5.0', 'Pollinations AI', 'AI Horde')" @click="emit('show-image-provider-modal')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ 生图引擎</div>
          <div class="item-value">
            <span class="item-value-text">{{ getImageProviderName(selectedChat.imageGenProvider || 'novelai') }}</span>
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
        <div v-else-if="selectedChat.imageGenProvider === 'seedream'" class="glass-list-item" v-show="matchSearch('Seedream生图详细配置')" @click="emit('show-seedream-image-detail-modal')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ Seedream 生图详细配置</div>
          <div class="item-value"><span class="item-value-text">设置方舟模型、清晰度与独立参考组</span><span class="arrow">></span></div>
        </div>
        <div v-else-if="selectedChat.imageGenProvider === 'pollinations'" class="glass-list-item" v-show="matchSearch('Pollinations生图详细配置')" @click="emit('show-pollinations-image-detail-modal')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ Pollinations 生图详细配置</div>
          <div class="item-value"><span class="item-value-text">设置动态模型、Pollen 与固定形象</span><span class="arrow">></span></div>
        </div>
        <div v-else class="glass-list-item" v-show="matchSearch('AI Horde生图详细配置')" @click="emit('show-ai-horde-image-detail-modal')">
          <div class="item-label" style="font-size: 13px; color: var(--text-secondary); padding-left: 12px;">└ AI Horde 生图详细配置</div>
          <div class="item-value"><span class="item-value-text">设置在线模型、排队参数与隐私确认</span><span class="arrow">></span></div>
        </div>
      </template>
    </div>

    <div class="glass-panel asset-capability-panel" v-show="matchSearch('文件与视频能力', '角色文件能力', '角色视频能力', '已有文件', '已有视频', 'PPTX', 'Veo')">
      <input ref="fileInput" class="asset-hidden-input" type="file" multiple @change="addConfiguredAssets(($event.target as HTMLInputElement).files, 'file')">
      <input ref="videoInput" class="asset-hidden-input" type="file" accept="video/mp4,video/webm,video/quicktime" multiple @change="addConfiguredAssets(($event.target as HTMLInputElement).files, 'video')">
      <div class="glass-list-item asset-heading-row">
        <div class="item-label">角色文件能力</div>
        <div class="item-value"><label class="switch" @click.stop><input type="checkbox" :checked="!!selectedChat.enableFileCapability" @change="toggleFileCapability"><span class="slider"></span></label></div>
      </div>
      <template v-if="selectedChat.enableFileCapability">
        <div class="asset-subsection">
          <div class="asset-subtitle"><span>角色已有文件</span><button type="button" :disabled="assetBusy" @click="fileInput?.click()">添加文件</button></div>
          <div v-if="!characterFiles.length" class="asset-empty">尚未添加文件</div>
          <div v-for="asset in characterFiles" :key="asset.id" class="asset-row">
            <div class="asset-row-main"><strong :title="asset.name">{{ asset.name }}</strong><small>{{ formatAssetSize(asset.size) }} · {{ asset.groupVisibility === 'allowed' ? '可用于群聊' : '仅私聊' }}</small><input class="asset-summary-input" :value="asset.summary" maxlength="500" placeholder="资源描述，帮助角色准确选择" @change="setAssetSummary(asset, ($event.target as HTMLInputElement).value)"></div>
            <button type="button" class="asset-quiet-btn" @click="setAssetGroupVisibility(asset)">{{ asset.groupVisibility === 'allowed' ? '设为私聊' : '允许群聊' }}</button>
            <button type="button" class="asset-delete-btn" :class="{ confirming: pendingDeleteAssetId === asset.id }" @click="requestDeleteAsset(asset)">{{ pendingDeleteAssetId === asset.id ? '确认' : '删除' }}</button>
          </div>
        </div>
        <div class="asset-subsection">
          <div class="asset-toggle-row"><span>实时生成文件</span><label class="switch" @click.stop><input type="checkbox" :checked="selectedChat.fileGenerationConfig?.enabled !== false" @change="ensureFileConfig(); selectedChat.fileGenerationConfig.enabled = ($event.target as HTMLInputElement).checked; handleSave()"><span class="slider"></span></label></div>
          <div v-if="selectedChat.fileGenerationConfig?.enabled !== false" class="asset-format-list">
            <button v-for="format in DEFAULT_FILE_FORMATS" :key="format" type="button" :class="{ active: selectedChat.fileGenerationConfig?.allowedFormats?.includes(format) }" @click="toggleFileFormat(format)">{{ format.toUpperCase() }}</button>
          </div>
          <div v-if="selectedChat.fileGenerationConfig?.enabled !== false" class="asset-config-grid"><label><span>文件上限 (MB)</span><input v-model.number="selectedChat.fileGenerationConfig.maxSizeMb" type="number" min="1" max="200" @change="normalizeAssetNumber('fileSize')"></label></div>
        </div>
      </template>

      <div class="asset-divider"></div>
      <div class="glass-list-item asset-heading-row">
        <div class="item-label">角色视频能力</div>
        <div class="item-value"><label class="switch" @click.stop><input type="checkbox" :checked="!!selectedChat.enableVideoMessageCapability" @change="toggleVideoMessageCapability"><span class="slider"></span></label></div>
      </div>
      <template v-if="selectedChat.enableVideoMessageCapability">
        <div class="asset-subsection">
          <div class="asset-subtitle"><span>角色已有视频</span><button type="button" :disabled="assetBusy" @click="videoInput?.click()">添加视频</button></div>
          <div v-if="!characterVideos.length" class="asset-empty">尚未添加视频</div>
          <div v-for="asset in characterVideos" :key="asset.id" class="asset-row">
            <div class="asset-row-main"><strong :title="asset.name">{{ asset.name }}</strong><small>{{ formatAssetSize(asset.size) }} · {{ asset.groupVisibility === 'allowed' ? '可用于群聊' : '仅私聊' }}</small><input class="asset-summary-input" :value="asset.summary" maxlength="500" placeholder="资源描述，帮助角色准确选择" @change="setAssetSummary(asset, ($event.target as HTMLInputElement).value)"></div>
            <button type="button" class="asset-quiet-btn" @click="setAssetGroupVisibility(asset)">{{ asset.groupVisibility === 'allowed' ? '设为私聊' : '允许群聊' }}</button>
            <button type="button" class="asset-delete-btn" :class="{ confirming: pendingDeleteAssetId === asset.id }" @click="requestDeleteAsset(asset)">{{ pendingDeleteAssetId === asset.id ? '确认' : '删除' }}</button>
          </div>
        </div>
        <div class="asset-subsection">
          <div class="asset-toggle-row"><span>实时生成</span><label class="switch" @click.stop><input type="checkbox" :checked="!!selectedChat.videoGenerationConfig?.enabled" @change="ensureVideoConfig(); selectedChat.videoGenerationConfig.enabled = ($event.target as HTMLInputElement).checked; handleSave()"><span class="slider"></span></label></div>
          <template v-if="selectedChat.videoGenerationConfig?.enabled">
            <div class="asset-provider-list" aria-label="视频节点">
              <button v-for="provider in CHARACTER_VIDEO_PROVIDERS" :key="provider.id" type="button" :class="{ active: selectedVideoProvider.id === provider.id }" @click="setVideoProvider(provider.id)">{{ provider.shortLabel }}</button>
            </div>
            <label class="asset-select-row"><span>模型</span><select :value="selectedChat.videoGenerationConfig.model" @change="setVideoModel"><option v-for="item in selectedVideoProvider.models" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
            <div class="asset-config-grid">
              <label><span>单日上限</span><input v-model.number="selectedChat.videoGenerationConfig.maxDailyGenerations" type="number" min="1" max="50" @change="normalizeAssetNumber('daily')"></label>
              <label><span>单次费用上限</span><input v-model.number="selectedChat.videoGenerationConfig.maxEstimatedCost" type="number" min="0" step="0.1" @change="normalizeAssetNumber('cost')"></label>
            </div>
            <div class="asset-option-row"><span>比例</span><div class="asset-option-values"><button v-for="value in selectedVideoProvider.ratios" :key="value" type="button" :class="{ active: selectedChat.videoGenerationConfig.aspectRatio === value }" @click="setVideoOption('aspectRatio', value)">{{ value === 'adaptive' ? '自适应' : value }}</button></div></div>
            <div class="asset-option-row"><span>清晰度</span><div class="asset-option-values"><button v-for="value in selectedVideoProvider.resolutions" :key="value" type="button" :class="{ active: selectedChat.videoGenerationConfig.resolution === value }" @click="setVideoOption('resolution', value)">{{ value }}</button></div></div>
            <label class="asset-duration-row"><span>时长</span><input v-model.number="selectedChat.videoGenerationConfig.durationSeconds" type="number" :min="selectedVideoProvider.durationMin" :max="selectedVideoProvider.durationMax" step="1" @change="normalizeVideoDuration"><small>秒（{{ selectedVideoProvider.durationMin }}–{{ selectedVideoProvider.durationMax }}）</small></label>
            <div class="asset-help" :class="{ warning: !selectedVideoProviderReady }">复用{{ selectedVideoProvider.credentialHint }}中保存的凭据，角色配置不会复制 API Key。{{ selectedVideoProvider.supportsImage ? '支持文字生成和聊天图片生成。' : '当前仅支持文字生成。' }}{{ selectedVideoProviderReady ? '' : ' 当前尚未检测到可复用凭据。' }}</div>
          </template>
        </div>
      </template>
      <div v-if="assetNotice" class="asset-notice">{{ assetNotice }}</div>
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
      <div class="glass-list-item" v-show="matchSearch('角色时间', '角色时区', '自定义时间')" :class="{ 'disabled-block': !selectedChat.timePerception }" @click="emit('open-timezone-modal', 'character')">
        <div class="item-label">角色独立时间</div>
        <div class="item-value"><span class="item-value-text">{{ getIdentityClockLabel(selectedChat) }}</span><span class="arrow">></span></div>
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
.asset-hidden-input{display:none}.asset-capability-panel{overflow:hidden}.asset-heading-row{min-height:46px}.asset-subsection{padding:10px 14px 12px;border-top:1px solid var(--border-color)}.asset-subtitle,.asset-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:var(--text-secondary)}.asset-subtitle button,.asset-quiet-btn,.asset-delete-btn{border:1px solid var(--border-color);border-radius:6px;background:transparent;color:var(--text-secondary);font-size:10px;line-height:1;padding:5px 7px;cursor:pointer}.asset-subtitle button:disabled{opacity:.5}.asset-empty{padding:10px 0 2px;font-size:11px;color:var(--text-tertiary)}.asset-row{display:flex;align-items:center;gap:6px;min-width:0;padding:8px 0;border-bottom:1px dashed var(--border-color)}.asset-row:last-child{border-bottom:0}.asset-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.asset-row-main strong{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.asset-row-main small{font-size:10px;color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.asset-summary-input{min-width:0;width:100%;box-sizing:border-box;border:0;border-bottom:1px solid transparent;background:transparent;color:var(--text-secondary);font-size:10px;padding:2px 0;outline:none}.asset-summary-input:focus{border-bottom-color:var(--border-color)}.asset-delete-btn.confirming{color:#c65555;border-color:rgba(198,85,85,.45)}.asset-format-list{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.asset-format-list button,.asset-option-row button,.asset-provider-list button{border:1px solid var(--border-color);border-radius:5px;background:transparent;color:var(--text-tertiary);font-size:9px;padding:4px 6px;cursor:pointer}.asset-format-list button.active,.asset-option-row button.active,.asset-provider-list button.active{color:var(--text-primary);background:var(--bg-secondary)}.asset-divider{height:8px;background:var(--bg-secondary);border-top:1px solid var(--border-color);border-bottom:1px solid var(--border-color)}.asset-provider-list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:9px}.asset-provider-list button{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.asset-config-grid{display:grid;grid-template-columns:1fr;gap:7px;margin-top:9px}.asset-config-grid label,.asset-select-row,.asset-duration-row{display:flex;align-items:center;gap:8px;min-width:0}.asset-config-grid label span,.asset-select-row>span,.asset-duration-row>span{width:92px;flex:0 0 92px;font-size:10px;color:var(--text-tertiary)}.asset-config-grid input,.asset-select-row select,.asset-duration-row input{flex:1;min-width:0;box-sizing:border-box;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:11px;padding:6px 7px;outline:none}.asset-select-row{margin-top:7px}.asset-option-row{display:flex;align-items:flex-start;gap:5px;margin-top:7px}.asset-option-row>span{width:56px;flex:0 0 56px;padding-top:4px;font-size:10px;color:var(--text-tertiary)}.asset-option-values{display:flex;flex:1;min-width:0;flex-wrap:wrap;gap:5px}.asset-duration-row{margin-top:7px}.asset-duration-row input{max-width:74px}.asset-duration-row small{min-width:0;font-size:9px;color:var(--text-tertiary);white-space:nowrap}.asset-help,.asset-notice{font-size:10px;line-height:1.45;color:var(--text-tertiary);margin-top:8px}.asset-help.warning{color:#b17434}.asset-notice{padding:0 14px 12px;color:var(--text-secondary)}@media(max-width:340px){.asset-subsection{padding-left:10px;padding-right:10px}.asset-row{gap:4px;align-items:flex-start}.asset-quiet-btn,.asset-delete-btn{padding:5px;font-size:9px}.asset-provider-list{grid-template-columns:repeat(3,minmax(0,1fr))}.asset-config-grid label span,.asset-select-row>span,.asset-duration-row>span{width:78px;flex-basis:78px}.asset-duration-row small{white-space:normal}}
</style>

<style scoped>
@import './ChatSettingsStyles.css';
</style>
