<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useFluxImageReference } from '../../../composables/useFluxImageReference'

const props = defineProps<{ visible: boolean; chat: any }>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void; (e: 'save'): void }>()
const { referenceGroups } = useFluxImageReference()
const activeTab = ref<'api' | 'specs' | 'prompt' | 'references'>('api')
const showApiKey = ref(false)
const localConfig = ref<any>({})
const defaults = () => ({
  apiKey: '',
  proxyUrl: '',
  model: 'flux-2-pro-preview',
  width: 1024,
  height: 1536,
  outputFormat: 'png',
  safetyTolerance: 2,
  seed: '',
  disablePromptUpsampling: false,
  promptPrefix: '',
  referenceGroupIds: [],
  enableLlmAssist: false,
  llmContextSize: 12
})

watch(() => props.visible, visible => {
  if (!visible) return
  localConfig.value = {
    ...defaults(),
    ...(props.chat?.fluxImageConfig || {}),
    referenceGroupIds: [...(props.chat?.fluxImageConfig?.referenceGroupIds || [])]
  }
  activeTab.value = 'api'
})

const close = () => emit('update:visible', false)
const pullGlobal = () => {
  localConfig.value.apiKey = localStorage.getItem('app_flux_image_apikey') || ''
  localConfig.value.proxyUrl = localStorage.getItem('app_flux_image_proxy_url') || ''
  localConfig.value.model = localStorage.getItem('app_flux_image_model') || 'flux-2-pro-preview'
  localConfig.value.width = Number(localStorage.getItem('app_flux_image_width') || 1024)
  localConfig.value.height = Number(localStorage.getItem('app_flux_image_height') || 1536)
  localConfig.value.outputFormat = localStorage.getItem('app_flux_image_format') || 'png'
  localConfig.value.safetyTolerance = Number(localStorage.getItem('app_flux_image_safety') || 2)
  localConfig.value.disablePromptUpsampling = localStorage.getItem('app_flux_image_disable_pup') === 'true'
}
const save = () => {
  props.chat.fluxImageConfig = JSON.parse(JSON.stringify(localConfig.value))
  props.chat.imageGenProvider = 'flux'
  emit('save')
  close()
}
</script>

<template>
  <div v-if="visible" class="overlay" @click.self="close">
    <div class="modal">
      <header><div><h3>角色 FLUX 独立配置</h3><p>仅用于 Black Forest Labs，不会覆盖其他引擎。</p></div><button class="close" @click="close">×</button></header>
      <nav><button :class="{active:activeTab==='api'}" @click="activeTab='api'">API</button><button :class="{active:activeTab==='specs'}" @click="activeTab='specs'">参数</button><button :class="{active:activeTab==='prompt'}" @click="activeTab='prompt'">提示词</button><button :class="{active:activeTab==='references'}" @click="activeTab='references'">参考组</button></nav>
      <main>
        <section v-if="activeTab==='api'">
          <p class="notice">留空时使用图像大厅里的全局 FLUX 配置。</p><button class="secondary" @click="pullGlobal">从全局 FLUX 配置填入</button>
          <label><span>BFL API Key</span><div class="inline"><input v-model="localConfig.apiKey" :type="showApiKey?'text':'password'" placeholder="留空使用全局密钥"><button @click="showApiKey=!showApiKey">{{showApiKey?'隐藏':'显示'}}</button></div></label>
          <label><span>Cloudflare 代理地址</span><input v-model="localConfig.proxyUrl" placeholder="留空使用全局代理"></label>
          <label><span>模型</span><select v-model="localConfig.model"><option value="flux-2-pro-preview">FLUX.2 Pro Preview（推荐）</option><option value="flux-2-pro">FLUX.2 Pro（固定版本）</option><option value="flux-2-max">FLUX.2 Max（最高质量）</option></select></label>
        </section>
        <section v-else-if="activeTab==='specs'" class="grid">
          <label><span>宽度</span><input v-model.number="localConfig.width" type="number" min="64" step="16"></label><label><span>高度</span><input v-model.number="localConfig.height" type="number" min="64" step="16"></label>
          <label><span>格式</span><select v-model="localConfig.outputFormat"><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option></select></label><label><span>安全级别 0–5</span><input v-model.number="localConfig.safetyTolerance" type="number" min="0" max="5"></label>
          <label><span>Seed（留空随机）</span><input v-model="localConfig.seed" type="number"></label>
          <label class="switch"><span><strong>关闭内置提示词扩写</strong><small>开启 LLM 整理时建议关闭，避免二次改写。</small></span><input v-model="localConfig.disablePromptUpsampling" type="checkbox"></label>
        </section>
        <section v-else-if="activeTab==='prompt'">
          <label><span>角色固定画面设定</span><textarea v-model="localConfig.promptPrefix" rows="7" placeholder="人物外貌、服装、画风和镜头偏好……"></textarea></label>
          <label class="switch"><span><strong>智能整理聊天画面</strong><small>调用当前聊天 LLM 整理角色设定与最近消息；默认关闭。</small></span><input v-model="localConfig.enableLlmAssist" type="checkbox"></label>
          <label v-if="localConfig.enableLlmAssist"><span>读取最近消息数量</span><input v-model.number="localConfig.llmContextSize" type="number" min="1" max="50"></label>
        </section>
        <section v-else>
          <p class="notice">这里仅使用图像大厅中创建的 FLUX 参考组，API 最多提交 8 张。</p>
          <label v-for="group in referenceGroups" :key="group.id" class="group"><input v-model="localConfig.referenceGroupIds" type="checkbox" :value="group.id"><span><strong>{{group.name}}</strong><small>{{group.imageIds.length}} 张 · {{group.description||'无说明'}}</small></span></label>
          <div v-if="!referenceGroups.length" class="empty">暂无 FLUX 参考组</div>
        </section>
      </main>
      <footer><button class="secondary" @click="close">取消</button><button class="primary" @click="save">保存 FLUX 配置</button></footer>
    </div>
  </div>
</template>

<style scoped>
.overlay{position:fixed;z-index:10001;inset:0;display:grid;place-items:center;padding:16px;background:rgba(20,23,33,.45);backdrop-filter:blur(8px)}.modal{width:min(680px,95vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;border-radius:22px;background:var(--sys-bg-primary,#fff);color:var(--text-primary,#222);box-shadow:0 24px 80px rgba(0,0,0,.25)}header{display:flex;justify-content:space-between;padding:20px 22px 12px}h3{margin:0}header p{margin:4px 0 0;color:var(--text-secondary,#888);font-size:12px}.close{border:0;background:transparent;color:inherit;font-size:29px}nav{display:flex;gap:4px;margin:0 20px;padding:4px;border-radius:13px;background:var(--sys-bg-secondary,#f2f3f6)}nav button{flex:1;border:0;border-radius:10px;padding:9px;background:transparent;color:inherit}nav .active{background:var(--sys-bg-primary,#fff);font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.08)}main{min-height:330px;padding:18px 22px;overflow:auto}label{display:flex;flex-direction:column;gap:7px;margin:12px 0;font-size:13px;font-weight:600}input,select,textarea{width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--border-color,#ddd);border-radius:10px;background:var(--sys-bg-secondary,#f6f7f8);color:inherit}.inline{display:flex;gap:7px}.inline button,.secondary{border:0;border-radius:9px;padding:0 13px;background:#eceef0;color:#4c5158}.secondary{padding:10px 14px}.notice{padding:10px;border-radius:10px;background:var(--sys-bg-secondary,#f5f6f8);color:var(--text-secondary,#777);font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.switch,.group{flex-direction:row;align-items:center;justify-content:space-between;padding:12px;border-radius:12px;background:var(--sys-bg-secondary,#f5f6f8)}.switch span,.group span{display:flex;flex-direction:column}.switch input,.group input{width:auto}.switch small,.group small{color:var(--text-secondary,#888);font-weight:400}.empty{padding:35px;text-align:center;color:#888}footer{display:flex;justify-content:flex-end;gap:10px;padding:14px 22px 20px;border-top:1px solid #eee}.primary{border:0;border-radius:11px;padding:11px 18px;background:#176b42;color:#fff;font-weight:700}@media(max-width:560px){.grid{grid-template-columns:1fr}}
</style>
