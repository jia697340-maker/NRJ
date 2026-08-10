/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  visible: boolean
  selectedChat: any
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'open-model-modal'): void
  (e: 'open-voice-modal'): void
  (e: 'open-language-modal'): void
  (e: 'open-emotion-modal'): void
  (e: 'save'): void
}>()

const close = () => {
  emit('update:visible', false)
}

const getLanguageLabel = (val: string) => {
  const languageOptions = [
    { value: '', label: '自动检测 (Auto)' },
    { value: 'zh', label: '中文 (Chinese)' },
    { value: 'en', label: '英语 (English)' },
    { value: 'ja', label: '日语 (Japanese)' },
    { value: 'ko', label: '韩语 (Korean)' },
    { value: 'fr', label: '法语 (French)' },
    { value: 'de', label: '德语 (German)' },
    { value: 'es', label: '西班牙语 (Spanish)' },
    { value: 'it', label: '意大利语 (Italian)' },
    { value: 'ru', label: '俄语 (Russian)' },
    { value: 'pt', label: '葡萄牙语 (Portuguese)' },
    { value: 'ar', label: '阿拉伯语 (Arabic)' },
    { value: 'hi', label: '印地语 (Hindi)' },
    { value: 'bn', label: '孟加拉语 (Bengali)' },
    { value: 'id', label: '印尼语 (Indonesian)' },
    { value: 'vi', label: '越南语 (Vietnamese)' },
    { value: 'th', label: '泰语 (Thai)' },
    { value: 'tr', label: '土耳其语 (Turkish)' },
    { value: 'fa', label: '波斯语 (Persian)' },
    { value: 'pl', label: '波兰语 (Polish)' },
    { value: 'uk', label: '乌克兰语 (Ukrainian)' },
    { value: 'nl', label: '荷兰语 (Dutch)' },
    { value: 'ro', label: '罗马尼亚语 (Romanian)' },
    { value: 'hu', label: '匈牙利语 (Hungarian)' },
    { value: 'cs', label: '捷克语 (Czech)' },
    { value: 'el', label: '希腊语 (Greek)' },
    { value: 'sv', label: '瑞典语 (Swedish)' },
    { value: 'fi', label: '芬兰语 (Finnish)' },
    { value: 'da', label: '丹麦语 (Danish)' },
    { value: 'no', label: '挪威语 (Norwegian)' },
    { value: 'he', label: '希伯来语 (Hebrew)' },
    { value: 'ms', label: '马来语 (Malay)' },
    { value: 'tl', label: '他加禄语 (Tagalog)' },
    { value: 'ur', label: '乌尔都语 (Urdu)' },
    { value: 'ta', label: '泰米尔语 (Tamil)' },
    { value: 'te', label: '泰卢固语 (Telugu)' },
    { value: 'ml', label: '马拉雅拉姆语 (Malayalam)' },
    { value: 'gu', label: '古吉拉特语 (Gujarati)' },
    { value: 'kn', label: '卡纳达语 (Kannada)' },
    { value: 'mr', label: '马拉地语 (Marathi)' }
  ]
  const opt = languageOptions.find(o => o.value === val)
  return opt ? opt.label : '自动检测 (Auto)'
}

const getEmotionLabel = (val: string) => {
  const emotionOptions = [
    { value: '', label: '无 (默认)' },
    { value: 'happy', label: '开心 (happy)' },
    { value: 'sad', label: '悲伤 (sad)' },
    { value: 'angry', label: '生气 (angry)' }
  ]
  const opt = emotionOptions.find(o => o.value === val)
  return opt ? opt.label : '无 (默认)'
}

const handleSave = () => {
  emit('save')
}

const selectProvider = (provider: 'minimax' | 'seed_audio' | 'gemini' | 'elevenlabs' | 'microsoft_mai' | 'aliyun_tts') => {
  props.selectedChat.voiceProvider = provider
  if (provider === 'elevenlabs') {
    props.selectedChat.elevenLabsStability ??= 0.5
    props.selectedChat.elevenLabsSimilarity ??= 0.75
    props.selectedChat.elevenLabsStyle ??= 0
    props.selectedChat.elevenLabsSpeed ??= 1
    props.selectedChat.elevenLabsSpeakerBoost ??= true
  }
  if (provider === 'microsoft_mai') {
    props.selectedChat.microsoftMaiVoiceName ||= 'zh-CN-Mei:MAI-Voice-2'
    props.selectedChat.microsoftMaiStyleDegree ??= 1
  }
  if (provider === 'aliyun_tts') {
    props.selectedChat.aliyunVoice ||= 'Cherry'
    props.selectedChat.aliyunLanguage ||= 'Auto'
    props.selectedChat.aliyunOptimizeInstructions ??= true
  }
  handleSave()
}

const setSeedAudioReferences = (event: Event) => {
  props.selectedChat.seedAudioReferenceUrls = (event.target as HTMLTextAreaElement).value
    .split(/\r?\n/)
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, 3)
  handleSave()
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10000;" @click.self="close">
    <div class="custom-confirm-modal" style="position: relative; width: 90%; max-width: 380px; max-height: 85vh; padding-bottom: 20px; display: flex; flex-direction: column;">
      <!-- 关闭按钮 -->
      <div @click="close" style="position: absolute; right: 16px; top: 16px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-secondary); font-size: 22px; font-weight: 300; line-height: 1; z-index: 2;">
        &times;
      </div>
      <div class="confirm-title" style="margin-bottom: 16px;">语音详细配置</div>
      <div style="flex: 1; overflow-y: auto; padding: 0 24px; display: flex; flex-direction: column; gap: 24px;">

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); border-left: 3px solid var(--text-primary); padding-left: 8px; line-height: 1;">语音引擎</div>
          <div class="voice-provider-grid">
            <div class="memory-type-item" :class="{ active: (selectedChat.voiceProvider || 'minimax') === 'minimax' }" style="margin-bottom: 0;" @click="selectProvider('minimax')">
              <div class="type-name" style="margin-bottom: 4px;">MiniMax</div>
              <div class="type-desc">低延迟语音合成</div>
            </div>
            <div class="memory-type-item" :class="{ active: selectedChat.voiceProvider === 'seed_audio' }" style="margin-bottom: 0;" @click="selectProvider('seed_audio')">
              <div class="type-name" style="margin-bottom: 4px;">Seed Audio 1.0</div>
              <div class="type-desc">高表现力角色语音</div>
            </div>
            <div class="memory-type-item" :class="{ active: selectedChat.voiceProvider === 'gemini' }" style="margin-bottom: 0;" @click="selectProvider('gemini')">
              <div class="type-name" style="margin-bottom: 4px;">Gemini TTS</div>
              <div class="type-desc">自然可控角色语音</div>
            </div>
            <div class="memory-type-item" :class="{ active: selectedChat.voiceProvider === 'elevenlabs' }" style="margin-bottom: 0;" @click="selectProvider('elevenlabs')">
              <div class="type-name" style="margin-bottom: 4px;">ElevenLabs</div>
              <div class="type-desc">细腻自然多语种语音</div>
            </div>
            <div class="memory-type-item" :class="{ active: selectedChat.voiceProvider === 'microsoft_mai' }" style="margin-bottom: 0;" @click="selectProvider('microsoft_mai')">
              <div class="type-name" style="margin-bottom: 4px;">Microsoft MAI</div>
              <div class="type-desc">自然丰富多语言语音</div>
            </div>
            <div class="memory-type-item" :class="{ active: selectedChat.voiceProvider === 'aliyun_tts' }" style="margin-bottom: 0;" @click="selectProvider('aliyun_tts')">
              <div class="type-name" style="margin-bottom: 4px;">阿里云 TTS</div>
              <div class="type-desc">自然可控的角色语音</div>
            </div>
          </div>
        </div>
        
        <!-- 基础选项 -->
        <div v-if="(selectedChat.voiceProvider || 'minimax') === 'minimax'" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); border-left: 3px solid var(--text-primary); padding-left: 8px; line-height: 1;">基础选项</div>
          
          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">语音模型</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">建议使用 speech-2.6-turbo 等高保真模型。</div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 14px; cursor: pointer;" @click="emit('open-model-modal')">
              <span style="font-size: 14px; color: var(--text-primary);">{{ selectedChat.voiceModel || 'speech-2.6-turbo' }}</span>
              <span class="arrow">></span>
            </div>
          </div>
          
          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">音色 ID</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">选择或输入该角色的专属音色 ID。</div>
            </div>
            <div style="display: flex; align-items: center; background: rgba(0,0,0,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 4px 14px; overflow: hidden;">
              <input type="text" v-model="selectedChat.voiceId" @change="handleSave" placeholder="未设置" style="flex: 1; border: none; background: transparent; outline: none; font-size: 14px; color: var(--text-primary); padding: 6px 0;" />
              <div @click="emit('open-voice-modal')" style="cursor: pointer; padding: 6px 0 6px 12px; border-left: 1px solid var(--border-color); margin-left: 8px; display: flex; align-items: center; gap: 4px; color: var(--text-secondary);">
                <span style="font-size: 13px;">选择</span>
                <span class="arrow">></span>
              </div>
            </div>
          </div>
          
          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">发音语言</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">默认自动检测。选择特定语言将强制大模型生成该语言文本并以此发音。</div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 14px; cursor: pointer;" @click="emit('open-language-modal')">
              <span style="font-size: 14px; color: var(--text-primary);">{{ getLanguageLabel(selectedChat.voiceLanguage || '') }}</span>
              <span class="arrow">></span>
            </div>
          </div>
        </div>

        <div v-else-if="selectedChat.voiceProvider === 'seed_audio'" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); border-left: 3px solid var(--text-primary); padding-left: 8px; line-height: 1;">Seed Audio 选项</div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">生成模式</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">干净人声适合聊天与通话；场景音频允许环境声、音效和配乐。</div>
            </div>
            <div class="voice-mode-tabs">
              <div class="voice-mode-tab" :class="{ active: (selectedChat.seedAudioMode || 'speech') === 'speech' }" @click="selectedChat.seedAudioMode = 'speech'; handleSave()">干净人声</div>
              <div class="voice-mode-tab" :class="{ active: selectedChat.seedAudioMode === 'scene' }" @click="selectedChat.seedAudioMode = 'scene'; handleSave()">场景音频</div>
            </div>
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">角色声音指令</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">可描述年龄、音色、语气和口音；留空时使用自然角色声音。</div>
            </div>
            <textarea v-model="selectedChat.seedAudioPromptPrefix" @change="handleSave" rows="3" class="voice-textarea" placeholder="例如：年轻温柔的女声，语气亲密自然"></textarea>
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">参考音频地址</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">每行一个 HTTPS 地址，最多 3 个。仅使用已获得授权的声音。</div>
            </div>
            <textarea :value="(selectedChat.seedAudioReferenceUrls || []).join('\n')" @change="setSeedAudioReferences" rows="3" class="voice-textarea" placeholder="https://example.com/reference.mp3"></textarea>
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 14px; color: var(--text-primary);">多语言增强</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">中英混合或非英语内容建议开启。</div>
              </div>
              <label class="switch" @click.stop>
                <input type="checkbox" :checked="selectedChat.seedAudioMultilingual ?? true" @change="(e) => { selectedChat.seedAudioMultilingual = (e.target as HTMLInputElement).checked; handleSave(); }">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div v-else-if="selectedChat.voiceProvider === 'gemini'" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); border-left: 3px solid var(--text-primary); padding-left: 8px; line-height: 1;">Gemini TTS 选项</div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">预置音色</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">填写 Gemini 预置音色名称，例如 Kore、Puck、Charon 或 Aoede。</div>
            </div>
            <input type="text" v-model="selectedChat.geminiVoiceName" @change="handleSave" placeholder="Kore" class="voice-input" />
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">角色声音指令</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">描述年龄感、语气、节奏、口音和情绪；生成时不会朗读这段指令。</div>
            </div>
            <textarea v-model="selectedChat.geminiVoicePrompt" @change="handleSave" rows="4" class="voice-textarea" placeholder="例如：年轻温柔的女声，亲密自然，语速舒缓，带轻微气声"></textarea>
          </div>
        </div>

        <div v-else-if="selectedChat.voiceProvider === 'elevenlabs'" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); border-left: 3px solid var(--text-primary); padding-left: 8px; line-height: 1;">ElevenLabs 选项</div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">音色 ID</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">填写该角色在 ElevenLabs 音色库或个人音色中的 Voice ID。</div>
            </div>
            <input type="text" v-model="selectedChat.elevenLabsVoiceId" @change="handleSave" placeholder="填写 Voice ID" class="voice-input" />
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">合成模型</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">Multilingual v2 更细腻，Flash v2.5 响应更快；留空使用接入页默认模型。</div>
            </div>
            <div class="voice-mode-tabs" style="margin-bottom: 8px;">
              <div class="voice-mode-tab" :class="{ active: (selectedChat.elevenLabsModel || '') === 'eleven_multilingual_v2' }" @click="selectedChat.elevenLabsModel = 'eleven_multilingual_v2'; handleSave()">Multilingual v2</div>
              <div class="voice-mode-tab" :class="{ active: selectedChat.elevenLabsModel === 'eleven_flash_v2_5' }" @click="selectedChat.elevenLabsModel = 'eleven_flash_v2_5'; handleSave()">Flash v2.5</div>
            </div>
            <input type="text" v-model="selectedChat.elevenLabsModel" @change="handleSave" placeholder="留空使用默认模型" class="voice-input" />
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">语言代码</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">可填写 zh、en、ja 等 ISO 639-1 代码；留空自动判断。</div>
            </div>
            <input type="text" v-model="selectedChat.elevenLabsLanguage" @change="handleSave" placeholder="自动检测" class="voice-input" />
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 14px; color: var(--text-primary);">稳定度 ({{ (selectedChat.elevenLabsStability ?? 0.5).toFixed(2) }})</div>
            <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">调低更有变化与情绪，调高更稳定一致。</div>
            <input type="range" v-model.number="selectedChat.elevenLabsStability" min="0" max="1" step="0.05" @change="handleSave" class="elegant-slider" style="margin-top: 8px;" />
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 14px; color: var(--text-primary);">相似度增强 ({{ (selectedChat.elevenLabsSimilarity ?? 0.75).toFixed(2) }})</div>
            <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">控制生成声音与原音色特征的接近程度。</div>
            <input type="range" v-model.number="selectedChat.elevenLabsSimilarity" min="0" max="1" step="0.05" @change="handleSave" class="elegant-slider" style="margin-top: 8px;" />
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 14px; color: var(--text-primary);">风格强度 ({{ (selectedChat.elevenLabsStyle ?? 0).toFixed(2) }})</div>
            <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">提高会强化原音色的表达风格，也可能增加延迟。</div>
            <input type="range" v-model.number="selectedChat.elevenLabsStyle" min="0" max="1" step="0.05" @change="handleSave" class="elegant-slider" style="margin-top: 8px;" />
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 14px; color: var(--text-primary);">合成语速 ({{ (selectedChat.elevenLabsSpeed ?? 1).toFixed(2) }}x)</div>
            <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">在 ElevenLabs 支持范围内微调角色说话速度。</div>
            <input type="range" v-model.number="selectedChat.elevenLabsSpeed" min="0.7" max="1.2" step="0.05" @change="handleSave" class="elegant-slider" style="margin-top: 8px;" />
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 14px; color: var(--text-primary);">说话者增强</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">增强生成语音与原说话者特征的相似度。</div>
              </div>
              <label class="switch" @click.stop>
                <input type="checkbox" :checked="selectedChat.elevenLabsSpeakerBoost ?? true" @change="(e) => { selectedChat.elevenLabsSpeakerBoost = (e.target as HTMLInputElement).checked; handleSave(); }">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div v-else-if="selectedChat.voiceProvider === 'microsoft_mai'" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); border-left: 3px solid var(--text-primary); padding-left: 8px; line-height: 1;">Microsoft MAI Voice 选项</div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">预置音色</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">选择常用中文音色，或填写 Azure Speech 已发布的完整 MAI Voice 音色名称。</div>
            </div>
            <div class="voice-mode-tabs" style="margin-bottom: 8px; width: 100%; box-sizing: border-box;">
              <div class="voice-mode-tab" :class="{ active: selectedChat.microsoftMaiVoiceName === 'zh-CN-Bo:MAI-Voice-2' }" style="flex: 1; text-align: center; padding-left: 4px; padding-right: 4px;" @click="selectedChat.microsoftMaiVoiceName = 'zh-CN-Bo:MAI-Voice-2'; handleSave()">Bo 男声</div>
              <div class="voice-mode-tab" :class="{ active: selectedChat.microsoftMaiVoiceName === 'zh-CN-Lan:MAI-Voice-2' }" style="flex: 1; text-align: center; padding-left: 4px; padding-right: 4px;" @click="selectedChat.microsoftMaiVoiceName = 'zh-CN-Lan:MAI-Voice-2'; handleSave()">Lan 女声</div>
              <div class="voice-mode-tab" :class="{ active: (selectedChat.microsoftMaiVoiceName || 'zh-CN-Mei:MAI-Voice-2') === 'zh-CN-Mei:MAI-Voice-2' }" style="flex: 1; text-align: center; padding-left: 4px; padding-right: 4px;" @click="selectedChat.microsoftMaiVoiceName = 'zh-CN-Mei:MAI-Voice-2'; handleSave()">Mei 女声</div>
            </div>
            <input type="text" v-model="selectedChat.microsoftMaiVoiceName" @change="handleSave" placeholder="zh-CN-Mei:MAI-Voice-2" class="voice-input" />
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">情绪风格</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">填写当前音色支持的 SSML style；留空时使用音色默认表达。</div>
            </div>
            <input type="text" v-model="selectedChat.microsoftMaiVoiceStyle" @change="handleSave" placeholder="留空使用默认风格" class="voice-input" />
          </div>

          <div v-if="selectedChat.microsoftMaiVoiceStyle" style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 14px; color: var(--text-primary);">风格强度（{{ (selectedChat.microsoftMaiStyleDegree ?? 1).toFixed(2) }}）</div>
            <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">控制情绪风格的表现强度，标准值为 1.00。</div>
            <input type="range" v-model.number="selectedChat.microsoftMaiStyleDegree" min="0.01" max="2" step="0.05" @change="handleSave" class="elegant-slider" style="margin-top: 8px;" />
          </div>
        </div>

        <div v-else style="display: flex; flex-direction: column; gap: 12px;">
          <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); border-left: 3px solid var(--text-primary); padding-left: 8px; line-height: 1;">阿里云 TTS 选项</div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">预置音色</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">选择常用音色，或填写当前模型支持的完整音色名称。</div>
            </div>
            <div class="voice-mode-tabs" style="margin-bottom: 8px; width: 100%; box-sizing: border-box;">
              <div class="voice-mode-tab" :class="{ active: (selectedChat.aliyunVoice || 'Cherry') === 'Cherry' }" style="flex: 1; text-align: center;" @click="selectedChat.aliyunVoice = 'Cherry'; handleSave()">Cherry</div>
              <div class="voice-mode-tab" :class="{ active: selectedChat.aliyunVoice === 'Serena' }" style="flex: 1; text-align: center;" @click="selectedChat.aliyunVoice = 'Serena'; handleSave()">Serena</div>
              <div class="voice-mode-tab" :class="{ active: selectedChat.aliyunVoice === 'Ethan' }" style="flex: 1; text-align: center;" @click="selectedChat.aliyunVoice = 'Ethan'; handleSave()">Ethan</div>
            </div>
            <input type="text" v-model="selectedChat.aliyunVoice" @change="handleSave" placeholder="Cherry" class="voice-input" />
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">模型</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">留空使用接入页的默认模型；Instruct 模型支持声音指令。</div>
            </div>
            <input type="text" v-model="selectedChat.aliyunModel" @change="handleSave" placeholder="留空使用默认模型" class="voice-input" />
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">合成语言</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">单一语种时明确指定通常更稳定；中英混合可保持自动。</div>
            </div>
            <div class="voice-mode-tabs" style="width: 100%; box-sizing: border-box;">
              <div class="voice-mode-tab" :class="{ active: (selectedChat.aliyunLanguage || 'Auto') === 'Auto' }" style="flex: 1; text-align: center;" @click="selectedChat.aliyunLanguage = 'Auto'; handleSave()">自动</div>
              <div class="voice-mode-tab" :class="{ active: selectedChat.aliyunLanguage === 'Chinese' }" style="flex: 1; text-align: center;" @click="selectedChat.aliyunLanguage = 'Chinese'; handleSave()">中文</div>
              <div class="voice-mode-tab" :class="{ active: selectedChat.aliyunLanguage === 'English' }" style="flex: 1; text-align: center;" @click="selectedChat.aliyunLanguage = 'English'; handleSave()">英文</div>
            </div>
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">角色声音指令</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">描述语气、节奏和情绪；仅支持指令的模型会应用此项。</div>
            </div>
            <textarea v-model="selectedChat.aliyunInstructions" @change="handleSave" rows="4" class="voice-textarea" placeholder="例如：年轻温柔的女声，亲密自然，语速舒缓。"></textarea>
          </div>

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 14px; color: var(--text-primary);">优化声音指令</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">由模型优化表达指令，提升自然度和表现力。</div>
              </div>
              <label class="switch" @click.stop>
                <input type="checkbox" :checked="selectedChat.aliyunOptimizeInstructions ?? true" @change="(e) => { selectedChat.aliyunOptimizeInstructions = (e.target as HTMLInputElement).checked; handleSave(); }">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- 播放体验 -->
        <div v-if="(selectedChat.voiceProvider || 'minimax') === 'minimax'" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); border-left: 3px solid var(--text-primary); padding-left: 8px; line-height: 1;">播放体验</div>
          
          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">流式输出 (Stream)</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">大幅降低首包延迟，边合成边返回边播放，带来极速响应体验。</div>
            </div>
            <div style="display: flex; justify-content: flex-end; align-items: center; padding: 4px 0;">
              <label class="switch" @click.stop>
                <input type="checkbox" v-model="selectedChat.voiceStream" @change="handleSave">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- 高级调参 -->
        <div v-if="selectedChat.voiceProvider !== 'gemini' && selectedChat.voiceProvider !== 'elevenlabs' && selectedChat.voiceProvider !== 'microsoft_mai' && selectedChat.voiceProvider !== 'aliyun_tts'" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); border-left: 3px solid var(--text-primary); padding-left: 8px; line-height: 1;">高级调参</div>
          
          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 14px; color: var(--text-primary);">合成音量 ({{ (selectedChat.voiceVolume || 1.0).toFixed(1) }}x)</div>
              <div v-if="selectedChat.voiceVolume !== 1.0" @click="selectedChat.voiceVolume = 1.0; handleSave()" style="font-size: 12px; color: #1976d2; cursor: pointer; padding: 2px 8px; background: rgba(25,118,210,0.1); border-radius: 4px; white-space: nowrap;">重置</div>
              <div v-else style="font-size: 12px; color: var(--text-tertiary); pointer-events: none; padding: 2px 8px; background: rgba(0,0,0,0.05); border-radius: 4px; white-space: nowrap;">重置</div>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">控制生成音频的基础响度。</div>
            <input type="range" v-model.number="selectedChat.voiceVolume" min="0.5" max="2.0" step="0.1" @change="handleSave" class="elegant-slider" style="margin-top: 8px;" />
          </div>
          
          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 14px; color: var(--text-primary);">合成语速 ({{ (selectedChat.voiceSpeed || 1.0).toFixed(1) }}x)</div>
              <div v-if="selectedChat.voiceSpeed !== 1.0" @click="selectedChat.voiceSpeed = 1.0; handleSave()" style="font-size: 12px; color: #1976d2; cursor: pointer; padding: 2px 8px; background: rgba(25,118,210,0.1); border-radius: 4px; white-space: nowrap;">重置</div>
              <div v-else style="font-size: 12px; color: var(--text-tertiary); pointer-events: none; padding: 2px 8px; background: rgba(0,0,0,0.05); border-radius: 4px; white-space: nowrap;">重置</div>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">调节说话的快慢。调高紧凑适合播报，调低拉长适合助眠。</div>
            <input type="range" v-model.number="selectedChat.voiceSpeed" min="0.5" max="2.0" step="0.1" @change="handleSave" class="elegant-slider" style="margin-top: 8px;" />
          </div>
          
          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 14px; color: var(--text-primary);">合成语调 ({{ (selectedChat.voicePitch || 1.0).toFixed(1) }}x)</div>
              <div v-if="selectedChat.voicePitch !== 1.0" @click="selectedChat.voicePitch = 1.0; handleSave()" style="font-size: 12px; color: #1976d2; cursor: pointer; padding: 2px 8px; background: rgba(25,118,210,0.1); border-radius: 4px; white-space: nowrap;">重置</div>
              <div v-else style="font-size: 12px; color: var(--text-tertiary); pointer-events: none; padding: 2px 8px; background: rgba(0,0,0,0.05); border-radius: 4px; white-space: nowrap;">重置</div>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">改变声音的粗细与尖沉。</div>
            <input type="range" v-model.number="selectedChat.voicePitch" min="0.5" max="2.0" step="0.1" @change="handleSave" class="elegant-slider" style="margin-top: 8px;" />
          </div>

          <div v-if="(selectedChat.voiceProvider || 'minimax') === 'minimax'" style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">情感风格</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">强制指定情绪。新一代模型多已自带情感预测，此参数可能不生效。</div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 14px; cursor: pointer;" @click="emit('open-emotion-modal')">
              <span style="font-size: 14px; color: var(--text-primary);">{{ getEmotionLabel(selectedChat.voiceEmotion || '') }}</span>
              <span class="arrow">></span>
            </div>
            <div v-if="selectedChat.voiceEmotion && !['speech-02-hd', 'speech-02-turbo', 'speech-01-hd', 'speech-01-turbo', 'speech-2.6-hd', 'speech-2.6-turbo'].includes(selectedChat.voiceModel || 'speech-2.6-turbo')" style="font-size: 11px; color: var(--text-secondary); margin-top: 7px; line-height: 1.4;">当前模型不支持显式情感参数，将由模型自动表达情绪。</div>
          </div>
        </div>
        
      </div>
      <div class="confirm-actions" style="margin-top: 16px; border-top: none; padding: 0 24px;">
        <div class="confirm-btn danger" style="background: var(--text-primary); color: var(--sys-bg-primary); border-radius: 12px;" @click="close">完成配置</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';

.voice-mode-tabs {
  display: flex;
  width: fit-content;
  padding: 4px;
  border-radius: 100px;
  background: rgba(0, 0, 0, 0.04);
}

.voice-provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
  gap: 8px;
}

.voice-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.02);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  padding: 11px 12px;
}

.voice-input:focus {
  border-color: var(--text-secondary);
  background: var(--sys-bg-primary);
}

.voice-mode-tab {
  padding: 7px 15px;
  border-radius: 100px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.voice-mode-tab.active {
  color: var(--text-primary);
  background: var(--sys-bg-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.voice-textarea {
  width: 100%;
  box-sizing: border-box;
  resize: none;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.03);
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  padding: 10px 12px;
  outline: none;
}

.voice-textarea:focus {
  border-color: var(--text-secondary);
  background: rgba(0, 0, 0, 0.05);
}

.elegant-slider {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 100px;
  background: rgba(0, 0, 0, 0.14);
  outline: none;
  cursor: pointer;
}

.elegant-slider::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border: 3px solid var(--sys-bg-primary);
  border-radius: 50%;
  background: var(--text-primary);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.elegant-slider::-moz-range-track {
  height: 4px;
  border: 0;
  border-radius: 100px;
  background: rgba(0, 0, 0, 0.14);
}

.elegant-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 3px solid var(--sys-bg-primary);
  border-radius: 50%;
  background: var(--text-primary);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}
</style>
