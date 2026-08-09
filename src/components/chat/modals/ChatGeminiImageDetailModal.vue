<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGeminiImageReference } from '../../../composables/useGeminiImageReference'

const props = defineProps<{ visible: boolean; chat: any }>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void; (e: 'save'): void }>()
const { referenceGroups } = useGeminiImageReference()
const activeTab = ref<'api' | 'specs' | 'prompt' | 'references'>('api')
const showApiKey = ref(false)
const localConfig = ref<any>({})

const models = computed(() => localConfig.value.transport === 'openrouter'
  ? [
      { value: 'google/gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image（推荐）' },
      { value: 'google/gemini-3.1-flash-lite-image', label: 'Gemini 3.1 Flash Lite Image（快速）' },
      { value: 'google/gemini-3-pro-image', label: 'Gemini 3 Pro Image（最高质量）' }
    ]
  : [
      { value: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image（推荐）' },
      { value: 'gemini-3.1-flash-lite-image', label: 'Gemini 3.1 Flash Lite Image（快速）' },
      { value: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image（最高质量）' }
    ])
const isKnownModel = computed(() => models.value.some(item => item.value === localConfig.value.model))
const isLiteModel = computed(() => String(localConfig.value.model).includes('flash-lite-image'))
const isFlashModel = computed(() => String(localConfig.value.model).includes('3.1-flash-image'))

const defaults = () => ({
  apiKey: '',
  baseUrl: '',
  transport: 'official',
  model: 'gemini-3.1-flash-image',
  aspectRatio: '2:3',
  imageSize: '1K',
  mimeType: 'image/png',
  thinkingLevel: 'minimal',
  useGoogleSearch: false,
  useImageSearch: false,
  promptPrefix: '',
  referenceGroupIds: [],
  includeChatContext: true,
  contextSize: 12
})

watch(() => props.visible, visible => {
  if (!visible) return
  localConfig.value = {
    ...defaults(),
    ...(props.chat?.geminiImageConfig || {}),
    referenceGroupIds: [...(props.chat?.geminiImageConfig?.referenceGroupIds || [])]
  }
  activeTab.value = 'api'
})

const close = () => emit('update:visible', false)
const changeTransport = (transport: 'official' | 'openrouter') => {
  localConfig.value.transport = transport
  localConfig.value.baseUrl = transport === 'official'
    ? 'https://generativelanguage.googleapis.com'
    : 'https://openrouter.ai/api/v1'
  localConfig.value.model = transport === 'official'
    ? 'gemini-3.1-flash-image'
    : 'google/gemini-3.1-flash-image'
}
const selectModel = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  localConfig.value.model = value === '__custom' ? '' : value
  if (String(localConfig.value.model).includes('flash-lite-image')) localConfig.value.imageSize = '1K'
  else if (!String(localConfig.value.model).includes('3.1-flash-image') && localConfig.value.imageSize === '0.5K') localConfig.value.imageSize = '1K'
}
const pullGlobal = () => {
  const transport = localStorage.getItem('app_gemini_image_transport') || 'official'
  localConfig.value.transport = transport
  localConfig.value.apiKey = localStorage.getItem('app_gemini_image_apikey') || ''
  localConfig.value.baseUrl = localStorage.getItem('app_gemini_image_baseurl') || (transport === 'official' ? 'https://generativelanguage.googleapis.com' : 'https://openrouter.ai/api/v1')
  localConfig.value.model = localStorage.getItem('app_gemini_image_model') || (transport === 'official' ? 'gemini-3.1-flash-image' : 'google/gemini-3.1-flash-image')
  localConfig.value.aspectRatio = localStorage.getItem('app_gemini_image_aspect_ratio') || '2:3'
  localConfig.value.imageSize = localStorage.getItem('app_gemini_image_size') || '1K'
  localConfig.value.mimeType = localStorage.getItem('app_gemini_image_mime_type') || 'image/png'
  localConfig.value.thinkingLevel = localStorage.getItem('app_gemini_image_thinking_level') || 'minimal'
  localConfig.value.useGoogleSearch = localStorage.getItem('app_gemini_image_google_search') === 'true'
  localConfig.value.useImageSearch = localStorage.getItem('app_gemini_image_image_search') === 'true'
}
const save = () => {
  props.chat.geminiImageConfig = JSON.parse(JSON.stringify(localConfig.value))
  props.chat.imageGenProvider = 'gemini'
  emit('save')
  close()
}
</script>

<template>
  <div v-if="visible" class="overlay" @click.self="close">
    <div class="modal">
      <header><div><h3>角色 Gemini 生图独立配置</h3><p>直接理解中文与聊天上下文，不额外调用提示词 LLM。</p></div><button class="close" @click="close">×</button></header>
      <nav>
        <button :class="{ active: activeTab === 'api' }" @click="activeTab = 'api'">API</button>
        <button :class="{ active: activeTab === 'specs' }" @click="activeTab = 'specs'">参数</button>
        <button :class="{ active: activeTab === 'prompt' }" @click="activeTab = 'prompt'">提示词</button>
        <button :class="{ active: activeTab === 'references' }" @click="activeTab = 'references'">参考组</button>
      </nav>
      <main>
        <section v-if="activeTab === 'api'">
          <p class="notice">留空时使用图像大厅里的全局 Gemini 配置。</p>
          <button class="secondary block" @click="pullGlobal">从全局 Gemini 配置填入</button>
          <div class="transport"><button :class="{ active: localConfig.transport === 'official' }" @click="changeTransport('official')">Google 官方</button><button :class="{ active: localConfig.transport === 'openrouter' }" @click="changeTransport('openrouter')">OpenRouter</button></div>
          <label><span>API Key</span><div class="row"><input v-model="localConfig.apiKey" :type="showApiKey ? 'text' : 'password'" placeholder="留空使用全局密钥"><button class="secondary" @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button></div></label>
          <label><span>Base URL</span><input v-model="localConfig.baseUrl" placeholder="留空使用全局地址"></label>
          <label><span>模型</span><select :value="isKnownModel ? localConfig.model : '__custom'" @change="selectModel"><option v-for="model in models" :key="model.value" :value="model.value">{{ model.label }}</option><option value="__custom">自定义模型</option></select><input v-if="!isKnownModel" v-model="localConfig.model" placeholder="模型名称"></label>
        </section>

        <section v-else-if="activeTab === 'specs'" class="grid">
          <label><span>宽高比</span><select v-model="localConfig.aspectRatio"><option v-for="ratio in ['1:1','3:2','2:3','4:3','3:4','5:4','4:5','16:9','9:16','21:9']" :key="ratio">{{ ratio }}</option></select></label>
          <label><span>分辨率</span><select v-model="localConfig.imageSize"><option v-for="size in (isLiteModel ? ['1K'] : isFlashModel ? ['0.5K','1K','2K','4K'] : ['1K','2K','4K'])" :key="size">{{ size }}</option></select></label>
          <label><span>格式</span><select v-model="localConfig.mimeType"><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option></select></label>
          <label><span>思考等级</span><select v-model="localConfig.thinkingLevel" :disabled="!isFlashModel"><option value="minimal">Minimal（快速）</option><option value="high">High（复杂画面）</option></select></label>
          <template v-if="localConfig.transport === 'official'">
            <label class="switch"><span><strong>联网搜索</strong><small>使用实时资料</small></span><input v-model="localConfig.useGoogleSearch" type="checkbox"></label>
            <label class="switch"><span><strong>图片搜索</strong><small>搜索现实视觉资料</small></span><input v-model="localConfig.useImageSearch" type="checkbox"></label>
          </template>
          <p class="notice full">Gemini 不使用 Negative Prompt、Seed、Sampler、Steps 或 CFG。</p>
        </section>

        <section v-else-if="activeTab === 'prompt'">
          <label><span>角色固定画面设定</span><textarea v-model="localConfig.promptPrefix" rows="7" placeholder="人物外貌、固定服装、画风、镜头偏好……"></textarea></label>
          <label class="switch"><span><strong>直接附带最近聊天</strong><small>Gemini 自己理解上下文，不再额外调用 LLM 整理。</small></span><input v-model="localConfig.includeChatContext" type="checkbox"></label>
          <label v-if="localConfig.includeChatContext"><span>读取最近消息数量</span><input v-model.number="localConfig.contextSize" type="number" min="1" max="50"></label>
        </section>

        <section v-else>
          <p class="notice">使用图像大厅中独立创建的 Gemini 参考组。</p>
          <label v-for="group in referenceGroups" :key="group.id" class="group">
            <input v-model="localConfig.referenceGroupIds" type="checkbox" :value="group.id">
            <span><strong>{{ group.name }}</strong><small>{{ group.imageIds.length }} 张图 · {{ group.description || '无用途说明' }}</small></span>
          </label>
          <div v-if="!referenceGroups.length" class="empty">暂无 Gemini 参考组，请先在图像大厅中创建。</div>
        </section>
      </main>
      <footer><button class="secondary" @click="close">取消</button><button class="primary" @click="save">保存 Gemini 配置</button></footer>
    </div>
  </div>
</template>

<style scoped>
.overlay{position:fixed;z-index:10001;inset:0;display:grid;place-items:center;padding:16px;background:#14172173;backdrop-filter:blur(8px)}.modal{width:min(680px,95vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;border-radius:22px;background:var(--sys-bg-primary,#fff);color:var(--text-primary,#222);box-shadow:0 24px 80px #0004}header{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 22px 12px}h3{margin:0;font-size:19px}header p{margin:4px 0 0;color:var(--text-secondary,#888);font-size:12px}.close{border:0;background:transparent;color:inherit;font-size:29px;cursor:pointer}nav,.transport{display:flex;gap:4px;margin:0 20px;padding:4px;border-radius:13px;background:var(--sys-bg-secondary,#f2f3f6)}nav button,.transport button{flex:1;border:0;border-radius:10px;padding:9px;background:transparent;color:var(--text-secondary,#777);cursor:pointer}nav button.active,.transport button.active{background:var(--sys-bg-primary,#fff);color:#454a51;box-shadow:0 2px 8px #0001;font-weight:700}.transport{margin:12px 0}main{min-height:330px;padding:18px 22px;overflow-y:auto}section label{display:flex;flex-direction:column;gap:7px;margin-bottom:14px;font-size:13px;font-weight:600}input,select,textarea{width:100%;box-sizing:border-box;border:1px solid var(--border-color,#e1e4e8);border-radius:11px;padding:11px 12px;background:var(--sys-bg-secondary,#f7f8fa);color:inherit;font:inherit}.row{display:flex;gap:8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.full{grid-column:1/-1}.notice{padding:10px 12px;border-radius:10px;background:var(--sys-bg-secondary,#f5f6f8);color:var(--text-secondary,#777);font-size:12px;line-height:1.5}.switch{flex-direction:row!important;align-items:center;justify-content:space-between;padding:12px;border-radius:12px;background:var(--sys-bg-secondary,#f7f8fa)}.switch span{display:flex;flex-direction:column}.switch small,.group small{color:var(--text-secondary,#888);font-weight:400}.switch input,.group input{width:auto}.group{flex-direction:row!important;align-items:flex-start;padding:12px;border-radius:12px;background:var(--sys-bg-secondary,#f7f8fa)}.group span{display:flex;flex-direction:column}.empty{text-align:center;color:#999;padding:28px}.secondary,.primary{border:0;border-radius:11px;padding:10px 16px;cursor:pointer;font-weight:600}.secondary{background:var(--sys-bg-secondary,#eceef2);color:inherit}.primary{background:#545a64;color:#fff}.block{width:100%}footer{display:flex;justify-content:flex-end;gap:10px;padding:14px 22px 20px;border-top:1px solid var(--border-color,#eee)}@media(max-width:600px){.grid{grid-template-columns:1fr}}
</style>
