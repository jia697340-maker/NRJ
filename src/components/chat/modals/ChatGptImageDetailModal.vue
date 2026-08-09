<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGptImageReference } from '../../../composables/useGptImageReference'

const GPT_IMAGE_MODELS = [
  { value: 'gpt-image-2', label: 'GPT Image 2（最新）' },
  { value: 'gpt-image-2-2026-04-21', label: 'GPT Image 2（2026-04-21 固定版本）' },
  { value: 'gpt-image-1.5', label: 'GPT Image 1.5（已弃用）' },
  { value: 'chatgpt-image-latest', label: 'ChatGPT Image Latest（已弃用）' },
  { value: 'gpt-image-1', label: 'GPT Image 1（已弃用）' },
  { value: 'gpt-image-1-mini', label: 'GPT Image 1 Mini（低成本，已弃用）' }
] as const

const PARAMETER_HELP: Record<string, { title: string; description: string }> = {
  model: { title: '模型', description: 'GPT Image 2 是当前推荐版本；带日期的是固定快照。旧模型仅供兼容使用，也可以选择自定义模型来连接第三方接口。' },
  size: { title: '尺寸', description: '控制图片宽高。尺寸越大，通常需要更多生成时间和费用；旧版模型只支持标准尺寸。' },
  quality: { title: '质量', description: '低、中、高会逐级增加细节、耗时和费用。“自动”由接口选择，日常使用建议选择“中”。' },
  format: { title: '格式', description: 'PNG 适合无损保存；JPEG 文件通常更小；WebP 在画质与文件大小之间较均衡。' },
  moderation: { title: '内容审核', description: '“自动”使用标准审核；“较宽松”减少部分敏感内容的拦截，但不会关闭审核，也不能绕过服务条款。' },
  compression: { title: '压缩质量', description: '仅用于 JPEG 和 WebP。数值越高细节越完整、文件越大；数值越低文件越小。' }
}

const props = defineProps<{
  visible: boolean
  chat: any
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save'): void
}>()

const { referenceGroups } = useGptImageReference()
const showApiKey = ref(false)
const activeTab = ref<'api' | 'specs' | 'prompt' | 'references'>('api')
const activeParameterHelp = ref('')
const localConfig = ref<any>({})
const isKnownModel = computed(() => GPT_IMAGE_MODELS.some(model => model.value === localConfig.value.model))
const activeHelp = computed(() => PARAMETER_HELP[activeParameterHelp.value] || null)

const selectModel = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  localConfig.value.model = value === '__custom' ? '' : value
}

const defaults = () => ({
  apiKey: '',
  baseUrl: '',
  model: 'gpt-image-2',
  size: '1024x1536',
  quality: 'medium',
  outputFormat: 'png',
  outputCompression: 90,
  moderation: 'auto',
  promptPrefix: '',
  referenceGroupIds: [],
  enableLlmAssist: false,
  llmContextSize: 12
})

watch(() => props.visible, visible => {
  if (visible) {
    localConfig.value = {
      ...defaults(),
      ...(props.chat?.gptImageConfig || {}),
      referenceGroupIds: [...(props.chat?.gptImageConfig?.referenceGroupIds || [])]
    }
    activeTab.value = 'api'
  }
})

const closeModal = () => emit('update:visible', false)

const pullGlobal = () => {
  localConfig.value.apiKey = localStorage.getItem('app_gpt_image_apikey') || ''
  localConfig.value.baseUrl = localStorage.getItem('app_gpt_image_baseurl') || 'https://api.openai.com/v1'
  localConfig.value.model = localStorage.getItem('app_gpt_image_model') || 'gpt-image-2'
  localConfig.value.size = localStorage.getItem('app_gpt_image_size') || '1024x1536'
  localConfig.value.quality = localStorage.getItem('app_gpt_image_quality') || 'medium'
  localConfig.value.outputFormat = localStorage.getItem('app_gpt_image_format') || 'png'
  localConfig.value.outputCompression = Number(localStorage.getItem('app_gpt_image_compression') || 90)
  localConfig.value.moderation = localStorage.getItem('app_gpt_image_moderation') || 'auto'
}

const handleSave = () => {
  props.chat.gptImageConfig = JSON.parse(JSON.stringify(localConfig.value))
  props.chat.imageGenProvider = 'gpt'
  emit('save')
  closeModal()
}
</script>

<template>
  <div v-if="visible" class="overlay" @click.self="closeModal">
    <div class="modal">
      <header>
        <div>
          <h3>角色 GPT 生图独立配置</h3>
          <p>只用于 GPT 图片模型，不会覆盖 NAI 配置。</p>
        </div>
        <button class="close" @click="closeModal">×</button>
      </header>

      <nav>
        <button :class="{ active: activeTab === 'api' }" @click="activeTab = 'api'">API</button>
        <button :class="{ active: activeTab === 'specs' }" @click="activeTab = 'specs'">参数</button>
        <button :class="{ active: activeTab === 'prompt' }" @click="activeTab = 'prompt'">提示词</button>
        <button :class="{ active: activeTab === 'references' }" @click="activeTab = 'references'">参考组</button>
      </nav>

      <main>
        <section v-if="activeTab === 'api'">
          <div class="notice">留空时使用图像大厅里的全局 GPT 配置。</div>
          <button class="secondary" @click="pullGlobal">从全局 GPT 配置填入</button>
          <label>
            <span>API Key</span>
            <div class="with-action">
              <input v-model="localConfig.apiKey" :type="showApiKey ? 'text' : 'password'" placeholder="留空使用全局密钥">
              <button @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button>
            </div>
          </label>
          <label>
            <span>Base URL</span>
            <input v-model="localConfig.baseUrl" placeholder="留空使用全局地址">
          </label>
          <label>
            <span class="field-title">
              模型
              <button type="button" class="help-btn" aria-label="查看模型说明" @click.prevent="activeParameterHelp = 'model'">?</button>
            </span>
            <select :value="isKnownModel ? localConfig.model : '__custom'" @change="selectModel">
              <option v-for="model in GPT_IMAGE_MODELS" :key="model.value" :value="model.value">{{ model.label }}</option>
              <option value="__custom">自定义模型（兼容第三方接口）</option>
            </select>
            <input v-if="!isKnownModel" v-model="localConfig.model" placeholder="输入第三方接口支持的模型名称">
          </label>
        </section>

        <section v-else-if="activeTab === 'specs'" class="two-column">
          <label>
            <span class="field-title">
              尺寸
              <button type="button" class="help-btn" aria-label="查看尺寸说明" @click.prevent="activeParameterHelp = 'size'">?</button>
            </span>
            <select v-model="localConfig.size">
              <option value="auto">自动</option>
              <option value="1024x1024">1024×1024 方图</option>
              <option value="1536x1024">1536×1024 横图</option>
              <option value="1024x1536">1024×1536 竖图</option>
            </select>
          </label>
          <label>
            <span class="field-title">
              质量
              <button type="button" class="help-btn" aria-label="查看质量说明" @click.prevent="activeParameterHelp = 'quality'">?</button>
            </span>
            <select v-model="localConfig.quality">
              <option value="auto">自动</option>
              <option value="low">低</option>
              <option value="medium">中（推荐）</option>
              <option value="high">高</option>
            </select>
          </label>
          <label>
            <span class="field-title">
              格式
              <button type="button" class="help-btn" aria-label="查看输出格式说明" @click.prevent="activeParameterHelp = 'format'">?</button>
            </span>
            <select v-model="localConfig.outputFormat">
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
          </label>
          <label>
            <span class="field-title">
              内容审核
              <button type="button" class="help-btn" aria-label="查看内容审核说明" @click.prevent="activeParameterHelp = 'moderation'">?</button>
            </span>
            <select v-model="localConfig.moderation">
              <option value="auto">自动</option>
              <option value="low">较宽松</option>
            </select>
          </label>
          <label v-if="localConfig.outputFormat !== 'png'" class="full">
            <span class="field-title">
              压缩质量 {{ localConfig.outputCompression }}%
              <button type="button" class="help-btn" aria-label="查看压缩质量说明" @click.prevent="activeParameterHelp = 'compression'">?</button>
            </span>
            <input v-model.number="localConfig.outputCompression" type="range" min="0" max="100">
          </label>
          <p class="notice full">角色每次发送一张图。GPT 不使用 Negative、Sampler、Steps、Seed 或 Vibe 强度。</p>
        </section>

        <section v-else-if="activeTab === 'prompt'">
          <label>
            <span>角色固定画面设定</span>
            <textarea v-model="localConfig.promptPrefix" rows="7" placeholder="例如：始终保持黑色长发、蓝色眼睛；日系动画厚涂风格……"></textarea>
          </label>
          <label class="switch-row">
            <span>
              <strong>智能整理聊天画面</strong>
              <small>调用当前聊天 LLM 阅读最近消息，整理成自然语言画面描述；关闭时直接使用角色发出的图片描述。</small>
            </span>
            <input v-model="localConfig.enableLlmAssist" type="checkbox">
          </label>
          <label v-if="localConfig.enableLlmAssist">
            <span>读取最近消息数量</span>
            <input v-model.number="localConfig.llmContextSize" type="number" min="1" max="50">
          </label>
        </section>

        <section v-else>
          <p class="notice">这里使用图像大厅中独立创建的 GPT 参考组，不会读取 NAI 氛围组。</p>
          <div v-if="referenceGroups.length" class="groups">
            <label v-for="group in referenceGroups" :key="group.id" class="group">
              <input v-model="localConfig.referenceGroupIds" type="checkbox" :value="group.id">
              <span>
                <strong>{{ group.name }}</strong>
                <small>{{ group.imageIds.length }} 张图 · {{ group.description || '无用途说明' }}</small>
              </span>
            </label>
          </div>
          <div v-else class="empty">暂无 GPT 参考组，请先到“图像接入 → GPT Image”创建。</div>
        </section>
      </main>

      <footer>
        <button class="secondary" @click="closeModal">取消</button>
        <button class="primary" @click="handleSave">保存 GPT 配置</button>
      </footer>
    </div>

    <div v-if="activeHelp" class="help-overlay" @click.self="activeParameterHelp = ''">
      <div class="help-modal" role="dialog" aria-modal="true" :aria-label="`${activeHelp.title}说明`">
        <div class="help-header">
          <h3>{{ activeHelp.title }}</h3>
          <button class="close" aria-label="关闭参数说明" @click="activeParameterHelp = ''">×</button>
        </div>
        <p>{{ activeHelp.description }}</p>
        <button class="help-close" @click="activeParameterHelp = ''">知道了</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; z-index: 10001; inset: 0; display: grid; place-items: center; padding: 16px; background: rgba(20,23,33,.45); backdrop-filter: blur(8px); }
.modal { width: min(680px,95vw); max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; border-radius: 22px; background: var(--sys-bg-primary,#fff); color: var(--text-primary,#222); box-shadow: 0 24px 80px rgba(0,0,0,.25); }
header { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 22px 12px; }
h3 { margin: 0; font-size: 19px; }
header p { margin: 4px 0 0; color: var(--text-secondary,#888); font-size: 12px; }
.close { border: 0; background: transparent; color: inherit; font-size: 29px; cursor: pointer; }
nav { display: flex; gap: 4px; margin: 0 20px; padding: 4px; border-radius: 13px; background: var(--sys-bg-secondary,#f2f3f6); }
nav button { flex: 1; border: 0; border-radius: 10px; padding: 9px; background: transparent; color: var(--text-secondary,#777); cursor: pointer; }
nav button.active { background: var(--sys-bg-primary,#fff); color: #454a51; box-shadow: 0 2px 8px rgba(0,0,0,.08); font-weight: 700; }
main { min-height: 330px; padding: 18px 22px; overflow-y: auto; }
section label { display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px; font-size: 13px; font-weight: 600; }
input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border-color,#e1e4e8); border-radius: 11px; padding: 11px 12px; background: var(--sys-bg-secondary,#f7f8fa); color: inherit; font: inherit; }
textarea { resize: vertical; font-size: 14px; line-height: 1.5; }
.field-title { display: flex; align-items: center; gap: 6px; }
.help-btn { display: inline-grid; width: 18px; height: 18px; place-items: center; padding: 0; border: 1px solid #cfd2d7; border-radius: 50%; background: #f3f4f5; color: #666b73; font-size: 11px; font-weight: 700; line-height: 1; cursor: pointer; }
.with-action { display: flex; gap: 7px; }
.with-action button, .secondary { flex: 0 0 auto; border: 0; border-radius: 10px; padding: 0 13px; background: #eceef0; color: #4c5158; cursor: pointer; }
.secondary { padding: 10px 14px; }
.notice { margin: 0 0 14px; padding: 10px 12px; border-radius: 10px; background: var(--sys-bg-secondary,#f5f6f8); color: var(--text-secondary,#777); font-size: 12px; line-height: 1.5; }
.two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
.full { grid-column: 1 / -1; }
.switch-row { flex-direction: row; align-items: center; justify-content: space-between; padding: 12px; border-radius: 12px; background: var(--sys-bg-secondary,#f5f6f8); }
.switch-row span { display: flex; flex-direction: column; gap: 4px; }
.switch-row small, .group small { color: var(--text-secondary,#888); font-weight: 400; line-height: 1.4; }
.switch-row input, .group input { width: auto; }
.groups { display: grid; gap: 9px; }
.group { flex-direction: row; align-items: flex-start; padding: 12px; border-radius: 12px; background: var(--sys-bg-secondary,#f5f6f8); }
.group span { display: flex; flex-direction: column; gap: 3px; }
.empty { padding: 36px 12px; text-align: center; color: var(--text-secondary,#888); font-size: 13px; }
footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 22px 20px; border-top: 1px solid var(--border-color,#eee); }
.primary { border: 0; border-radius: 11px; padding: 11px 18px; background: #4d5259; color: #fff; font-weight: 700; cursor: pointer; }
.help-overlay { position: fixed; z-index: 10002; inset: 0; display: grid; place-items: center; padding: 16px; background: rgba(20,23,33,.45); }
.help-modal { width: min(390px,calc(100vw - 32px)); box-sizing: border-box; padding: 20px; border-radius: 18px; background: var(--sys-bg-primary,#fff); color: var(--text-primary,#222); box-shadow: 0 24px 80px rgba(0,0,0,.25); }
.help-header { display: flex; align-items: center; justify-content: space-between; }
.help-modal p { margin: 6px 0 18px; color: var(--text-secondary,#666); font-size: 14px; line-height: 1.7; }
.help-close { width: 100%; border: 0; border-radius: 10px; padding: 11px; background: #e8eaec; color: #444950; font-weight: 600; cursor: pointer; }
@media (max-width: 560px) { .two-column { grid-template-columns: 1fr; } .full { grid-column: auto; } }
</style>
