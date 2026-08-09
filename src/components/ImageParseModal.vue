/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { readImageMetadata, metadataToGenerationParams } from '../composables/useImageMetadata'
import { sendChatMessage } from '../services/api'

const emit = defineEmits<{ (e: 'close'): void; (e: 'apply', params: any, image: string): void }>()

// 常见 AI 绘画提示词中英离线词典 (全面扩充版)
const tagDict: Record<string, string> = {
  // 画质与基础
  "masterpiece": "杰作", "best quality": "最佳画质", "high quality": "高画质", "official art": "官方艺术图",
  "finely detailed": "细节精细", "best details": "最佳细节", "countershading": "反光阴影", "no text": "无文字",
  "artbook": "画集", "artist collaboration": "画师合作", "beautiful": "美丽的", "detailed": "详细的",
  "illustration": "插画", "sketch": "草图", "anime": "动漫", "manga": "漫画", "realistic": "写实",
  "photorealistic": "超写实", "4k": "4K分辨率", "8k": "8K分辨率",
  
  // 人物基础
  "1girl": "1个女孩", "1boy": "1个男孩", "solo": "单人", "upperbody": "上半身", "full body": "全身",
  "cowboy shot": "西部镜头", "portrait": "肖像", "path to nowhere": "无期迷途", "adult": "成年",
  
  // 身体特征
  "big breast": "巨乳", "medium breasts": "中等乳房", "small breasts": "平胸", "gigantic breasts": "超大乳房",
  "long hair": "长发", "short hair": "短发", "blonde hair": "金发", "black hair": "黑发", "white hair": "白发",
  "blue eyes": "蓝眼", "red eyes": "红眼", "red face": "红脸", "looking at viewer": "看着镜头", "smile": "微笑",
  "nsfw": "R18", "cleavage": "乳沟", "thighs": "大腿", "navel": "肚脐",
  
  // 负面/劣质特征 (扩充)
  "lowres": "低画质", "low resolution": "低分辨率", "bad anatomy": "糟糕的人体", "bad hands": "糟糕的手", 
  "text": "文字", "error": "错误", "missing fingers": "缺失的手指", "extra digit": "多余的指头", "extra digits": "多余的指头",
  "fewer digits": "较少的指头", "cropped": "被裁剪的", "worst quality": "最差质量", "normal quality": "普通质量", 
  "bad quality": "糟糕质量", "very bad quality": "极差质量", "jpeg artifacts": "JPEG失真", "signature": "签名", 
  "watermark": "水印", "username": "用户名", "blurry": "模糊", "bad feet": "糟糕的脚", "mutated hands": "变异的手", 
  "poorly drawn hands": "画得不好的手", "poorly drawn face": "画得不好的脸", "mutation": "变异", "deformed": "畸形", 
  "ugly": "丑陋", "film grain": "胶片颗粒", "scan artifacts": "扫描伪影", "chromatic aberration": "色差", 
  "multiple views": "多视图", "bad id": "错误的ID", "bad pixiv id": "错误的PixivID", "bad": "糟糕的",
  "extra fingers": "多余的手指", "multiple fingers": "过多的手指", "scan": "扫描", "unfinished": "未完成的",
  "displeasing": "令人不悦的", "very displeasing": "非常令人不悦的", "logo": "Logo", "dated": "过时的",
  "artistic error": "艺术错误", "errors": "多个错误", "fewer elements": "较少的元素", "extra elements": "多余的元素",
  "missing elements": "缺失的元素", "abstract": "抽象的", "distorted": "扭曲的", "malformed": "畸形的",
  "disfigured": "毁容的", "extra limbs": "多余的肢体", "missing limbs": "缺失的肢体", "fused faces": "融合的脸",
  "cloned face": "克隆的脸", "cloned": "克隆的", "bad proportions": "糟糕的比例", "gross proportions": "恶心的比例",
  "out of frame": "出画的", "poorly drawn": "画得不好的",
  
  // 年份
  "year 2024": "2024年", "year 2025": "2025年", "year 2023": "2023年", "year2024": "2024年", "year2025": "2025年", "year2023": "2023年"
}

// 离线秒翻方法
const translateTextOffline = (text: string) => {
  let result = text;
  const keys = Object.keys(tagDict).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    // 使用负向预查和正向预查，确保匹配独立的单词或词组
    const regex = new RegExp(`(?<![a-zA-Z])${k}(?![a-zA-Z])`, 'gi');
    result = result.replace(regex, tagDict[k]);
  }
  return result;
}
const fileInput = ref<HTMLInputElement | null>(null)
const image = ref('')
const fileBlob = ref<Blob | null>(null)
const metadata = ref<any>(null)
const analysis = ref('')
const busy = ref(false)
const error = ref('')

const copyStates = ref<Record<string, boolean>>({})
const translating = ref<Record<string, boolean>>({})
const translations = ref<Record<string, string>>({})
const showTranslation = ref<Record<string, boolean>>({}) // 跟踪当前显示的是原文还是中文

const parsedData = computed<any>(() => {
  if (metadata.value?.novelAi) {
    return metadataToGenerationParams(metadata.value.novelAi)
  }
  if (analysis.value) {
    const jsonMatch = analysis.value.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const p = JSON.parse(jsonMatch[0])
        return {
          input: p.positive_en || '',
          negative_prompt: p.negative_en || '',
          width: p.width,
          height: p.height
        }
      } catch {}
    }
  }
  return null
})

const getCoreParamsText = (data: any) => {
  const parts = []
  if (data.width && data.height) parts.push(`尺寸: ${data.width}x${data.height}`)
  if (data.steps) parts.push(`步数: ${data.steps}`)
  if (data.sampler) parts.push(`采样器: ${data.sampler}`)
  if (data.scale) parts.push(`CFG: ${data.scale}`)
  if (data.seed) parts.push(`种子: ${data.seed}`)
  return parts.join(', ')
}

const copyText = (text: string, type: string) => {
  if (!text) return
  navigator.clipboard.writeText(text)
  copyStates.value[type] = true
  setTimeout(() => { copyStates.value[type] = false }, 2000)
}

const copyAll = (data: any) => {
  const parts = []
  if (data.input) parts.push(`正向提示词:\n${data.input}`)
  if (data.negative_prompt) parts.push(`反向提示词:\n${data.negative_prompt}`)
  const core = getCoreParamsText(data)
  if (core) parts.push(`核心参数:\n${core}`)
  copyText(parts.join('\n\n'), 'all')
}

const translateText = (text: string, type: string) => {
  // 切换显示状态
  if (translations.value[type]) {
    showTranslation.value[type] = !showTranslation.value[type]
    return
  }
  
  // 首次翻译
  translating.value[type] = true
  try {
    // 瞬间完成本地翻译
    translations.value[type] = translateTextOffline(text)
    showTranslation.value[type] = true
  } catch (e: any) {
    error.value = '翻译失败：' + (e.message || '未知错误')
  } finally {
    translating.value[type] = false
  }
}

const upload = () => fileInput.value?.click()
const onFile = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  image.value = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file) })
  fileBlob.value = file
  error.value = ''
  try { metadata.value = await readImageMetadata(file) } catch { metadata.value = null }
}
const analyze = async () => {
  if (!image.value) return
  busy.value = true; error.value = ''
  try {
    const result: any = await sendChatMessage([{ role: 'user', content: [{ type: 'text', text: 'Analyze this image for NovelAI image generation. Reply in Chinese with a short visual breakdown, then strict JSON only in a code block: {"positive_en":"comma separated English tags","negative_en":"comma separated English negative tags","width":number,"height":number}. Do not claim you know its original seed or prompt.' }, { type: 'image_url', image_url: { url: image.value } }] }], undefined, false, true)
    analysis.value = typeof result === 'string' ? result : result.content || ''
  } catch (e: any) { error.value = e.message || '图片分析失败：请确认当前聊天模型支持视觉输入。' } finally { busy.value = false }
}
const resetImage = () => {
  image.value = ''
  fileBlob.value = null
  metadata.value = null
  analysis.value = ''
  error.value = ''
  copyStates.value = {}
  translating.value = {}
  translations.value = {}
  showTranslation.value = {}
  if (fileInput.value) fileInput.value.value = ''
}

const apply = () => {
  if (!image.value) return
  if (parsedData.value) {
    emit('apply', parsedData.value, image.value)
  } else {
    error.value = '还没有可载入的参数；请先解析图片。'
  }
}
</script>
<template>
  <div class="modal-overlay" style="z-index:30000" @click.self="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <button class="nav-btn cancel-btn" @click="emit('close')">取消</button>
        <span class="nav-title">图片解析与反推</span>
        <button class="nav-btn done-btn" :class="{ disabled: !image }" @click="apply">载入</button>
      </div>
      
      <div class="modal-body">
        <p class="desc-text">PNG 元数据只在本地读取；普通图片会发送给配置的视觉模型。</p>
        
        <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
        
        <div v-if="parsedData" class="info-box neutral" style="margin-bottom: 12px; padding: 10px;">
          当前为本地极速匹配翻译，未覆盖的生僻词将保留原英文。
        </div>
        <div class="upload-area" @click="upload" :class="{'has-image': image}">
          <div v-if="!image" class="upload-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#999;margin-bottom:8px"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span>点击选择图片</span>
          </div>
          <img v-else :src="image" class="preview-image" />
        </div>
        
        <div v-if="parsedData" class="parsed-data-container">
          <div class="param-section" v-if="parsedData.input">
            <div class="param-header">
              <span class="param-title">正向提示词</span>
              <div class="param-actions">
                <button class="small-btn" @click="translateText(parsedData.input, 'positive')" :disabled="translating['positive']">
                  {{ translating['positive'] ? '翻译中...' : (showTranslation['positive'] ? '恢复原文' : '翻译中文') }}
                </button>
                <button class="small-btn" @click="copyText(parsedData.input, 'positive')">
                  {{ copyStates['positive'] ? '已复制' : '复制' }}
                </button>
              </div>
            </div>
            <div class="param-content">
              <div v-if="showTranslation['positive'] && translations['positive']" class="translated-text">{{ translations['positive'] }}</div>
              <div v-if="!showTranslation['positive']" class="original-text">{{ parsedData.input }}</div>
            </div>
          </div>

          <div class="param-section" v-if="parsedData.negative_prompt">
            <div class="param-header">
              <span class="param-title">反向提示词</span>
              <div class="param-actions">
                <button class="small-btn" @click="translateText(parsedData.negative_prompt, 'negative')" :disabled="translating['negative']">
                  {{ translating['negative'] ? '翻译中...' : (showTranslation['negative'] ? '恢复原文' : '翻译中文') }}
                </button>
                <button class="small-btn" @click="copyText(parsedData.negative_prompt, 'negative')">
                  {{ copyStates['negative'] ? '已复制' : '复制' }}
                </button>
              </div>
            </div>
            <div class="param-content">
              <div v-if="showTranslation['negative'] && translations['negative']" class="translated-text">{{ translations['negative'] }}</div>
              <div v-if="!showTranslation['negative']" class="original-text">{{ parsedData.negative_prompt }}</div>
            </div>
          </div>

          <div class="param-section" v-if="getCoreParamsText(parsedData)">
            <div class="param-header">
              <span class="param-title">核心参数</span>
              <div class="param-actions">
                <button class="small-btn" @click="copyText(getCoreParamsText(parsedData), 'core')">
                  {{ copyStates['core'] ? '已复制' : '复制' }}
                </button>
              </div>
            </div>
            <div class="param-content core-params">
              <span class="core-param-item" v-if="parsedData.width && parsedData.height">尺寸: {{parsedData.width}}x{{parsedData.height}}</span>
              <span class="core-param-item" v-if="parsedData.steps">步数: {{parsedData.steps}}</span>
              <span class="core-param-item" v-if="parsedData.sampler">采样器: {{parsedData.sampler}}</span>
              <span class="core-param-item" v-if="parsedData.scale">CFG: {{parsedData.scale}}</span>
              <span class="core-param-item" v-if="parsedData.seed">种子: {{parsedData.seed}}</span>
            </div>
          </div>

          <div class="action-group" style="margin-bottom: 0;">
            <button class="action-btn apply-btn" @click="apply">
              一键填入参数
            </button>
            <button class="action-btn copy-all-btn" @click="copyAll(parsedData)">
              {{ copyStates['all'] ? '✓ 已全部复制' : '复制全部参数' }}
            </button>
          </div>
        </div>

        <div v-else-if="image" class="info-box neutral">
          未发现可复现的参数，可使用视觉反推。
        </div>
        
        <div v-if="image && !parsedData" class="action-group">
          <button class="action-btn" :disabled="busy" @click="analyze">
            <span v-if="busy" class="spinner"></span>
            {{ busy ? '解析中…' : '视觉反推' }}
          </button>
          <button class="action-btn reset-btn" :disabled="busy" @click="resetImage">
            重置图片
          </button>
        </div>

        <div v-if="image && parsedData" class="action-group" style="margin-top: 12px;">
          <button class="action-btn reset-btn" @click="resetImage">
            重置图片
          </button>
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: var(--sys-bg-secondary, #fff);
  border-radius: 20px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 24px 48px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #eee);
  background: var(--sys-bg-primary, #fff);
}

.nav-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.2s;
}

.nav-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-btn:active:not(.disabled) {
  opacity: 0.5;
}

.cancel-btn {
  color: var(--text-tertiary, #8e8e93);
  font-weight: 400;
}

.done-btn {
  color: var(--theme-color, #007aff);
  font-weight: 600;
}

.nav-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #000);
  letter-spacing: -0.4px;
}

.modal-body {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: var(--sys-bg-secondary, #f2f2f7);
}

.modal-body::-webkit-scrollbar {
  display: none;
}

.desc-text {
  font-size: 13px; color: var(--text-secondary, #666); line-height: 1.5; margin: 0 0 16px 0; text-align: center;
}
.upload-area {
  border: 2px dashed var(--border-color, #d1d1d6); border-radius: 16px; padding: 24px; text-align: center;
  cursor: pointer; transition: all 0.2s ease; background: var(--sys-bg-primary, #fff);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 160px; margin-bottom: 16px; overflow: hidden;
}
.upload-area:hover { border-color: var(--theme-color, #007aff); background: rgba(0, 122, 255, 0.05); }
.upload-area.has-image { padding: 8px; border-style: solid; border-color: transparent; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.upload-placeholder { display: flex; flex-direction: column; align-items: center; color: var(--text-tertiary, #999); font-size: 14px; font-weight: 500; }
.preview-image { max-width: 100%; max-height: 240px; border-radius: 10px; object-fit: contain; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }

.parsed-data-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.param-section {
  background: var(--sys-bg-primary, #fff);
  border: 1px solid var(--border-color, #eee);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0,0,0,0.02);
}

.param-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: var(--sys-bg-secondary, #f8f8f8);
  border-bottom: 1px solid var(--border-color, #eee);
}

.param-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #333);
}

.param-actions {
  display: flex;
  gap: 8px;
}

.small-btn {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  color: #555;
  cursor: pointer;
  transition: all 0.2s;
}

.small-btn:hover:not(:disabled) {
  background: #f0f0f0;
  border-color: #ccc;
}

.small-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.small-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.param-content {
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.5;
}

.translated-text {
  color: #1a1a1a;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #eee;
}

.original-text {
  color: var(--text-secondary, #666);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
  word-break: break-word;
  white-space: pre-wrap;
}

.core-params {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.core-param-item {
  background: var(--sys-bg-secondary, #f2f2f7);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: #555;
  border: 1px solid #e5e5ea;
}

.apply-btn {
  background: var(--theme-color, #007aff);
}

.copy-all-btn {
  background: #444;
}

.info-box { padding: 14px; border-radius: 12px; font-size: 13px; line-height: 1.5; margin-bottom: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.02); }
.info-box.neutral { background: var(--sys-bg-primary, #fff); color: var(--text-secondary, #666); text-align: center; border: 1px solid var(--border-color, #eee); }

.action-group {
  display: flex; gap: 12px; margin-bottom: 16px;
}
.action-btn {
  flex: 1; padding: 14px; border-radius: 12px; border: none; background: #2c2c2e; color: #fff;
  font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s;
  display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.action-btn.reset-btn {
  background: var(--sys-bg-primary, #fff); color: var(--text-primary, #000); border: 1px solid var(--border-color, #d1d1d6); box-shadow: 0 2px 6px rgba(0,0,0,0.05);
}
.action-btn:active:not(:disabled) { transform: scale(0.97); }
.action-btn:disabled { background: var(--border-color, #ccc); color: var(--text-secondary, #888); box-shadow: none; cursor: not-allowed; }

.error-msg {
  color: #ff3b30; font-size: 13px; text-align: center; background: #ffeceb; padding: 12px; border-radius: 12px; margin-bottom: 16px;
  font-weight: 500;
}
.spinner {
  width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { 100% { transform: rotate(360deg); } }
</style>
