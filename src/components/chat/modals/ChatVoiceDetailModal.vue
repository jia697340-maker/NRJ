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
        
        <!-- 基础选项 -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
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

        <!-- 播放体验 -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
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
        <div style="display: flex; flex-direction: column; gap: 12px;">
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

          <div style="padding-bottom: 12px; border-bottom: 1px dashed var(--border-color);">
            <div style="margin-bottom: 8px;">
              <div style="font-size: 14px; color: var(--text-primary);">情感风格</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">强制指定情绪。新一代模型多已自带情感预测，此参数可能不生效。</div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 14px; cursor: pointer;" @click="emit('open-emotion-modal')">
              <span style="font-size: 14px; color: var(--text-primary);">{{ getEmotionLabel(selectedChat.voiceEmotion || '') }}</span>
              <span class="arrow">></span>
            </div>
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
</style>
