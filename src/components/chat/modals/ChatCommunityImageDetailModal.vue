<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePollinationsImage } from '../../../composables/usePollinationsImage'
import { useAiHordeImage } from '../../../composables/useAiHordeImage'

const props = defineProps<{ visible: boolean; chat: any; provider: 'pollinations' | 'aihorde' }>()
const emit = defineEmits<{ (e:'update:visible', value:boolean):void; (e:'save'):void }>()
const isPollinations = computed(() => props.provider === 'pollinations')
const localConfig = ref<any>({})
const activeTab = ref<'api'|'specs'|'prompt'>('api')
const showApiKey = ref(false)
const models = ref<any[]>([])
const loadingModels = ref(false)
const modelError = ref('')
const pollinations = usePollinationsImage()
const horde = useAiHordeImage()
const defaults = () => isPollinations.value ? {
  apiKey:'', baseUrl:'', model:'zimage', size:'1024x1024', quality:'medium', safe:'privacy,secrets,sexual,violence',
  promptPrefix:'', enableLlmAssist:false, llmContextSize:12, useIdentityReferences:true
} : {
  apiKey:'', baseUrl:'', model:'', width:768, height:1024, steps:24, cfgScale:7, sampler:'k_euler_a', seed:'',
  negativePrompt:'', promptPrefix:'', enableLlmAssist:false, llmContextSize:12, timeout:600000,
  trustedWorkers:true, validatedBackends:true, censorNsfw:true, privacyAcknowledged:false
}
const loadModels = async () => {
  loadingModels.value = true; modelError.value = ''
  try { models.value = isPollinations.value ? await pollinations.fetchModels() : await horde.fetchModels() }
  catch (error:any) { modelError.value = error?.message || '模型列表加载失败' }
  finally { loadingModels.value = false }
}
watch(() => props.visible, visible => {
  if (!visible) return
  const saved = isPollinations.value ? props.chat?.pollinationsImageConfig : props.chat?.aiHordeImageConfig
  localConfig.value = { ...defaults(), ...(saved || {}) }
  activeTab.value = 'api'
  void loadModels()
})
const close = () => emit('update:visible', false)
const pullGlobal = () => {
  const key = isPollinations.value ? 'app_pollinations_image_' : 'app_ai_horde_image_'
  localConfig.value.apiKey = localStorage.getItem(`${key}apikey`) || ''
  localConfig.value.baseUrl = localStorage.getItem(`${key}baseurl`) || ''
  localConfig.value.model = localStorage.getItem(`${key}model`) || (isPollinations.value ? 'zimage' : '')
  if (isPollinations.value) {
    localConfig.value.size = localStorage.getItem(`${key}size`) || '1024x1024'
    localConfig.value.quality = localStorage.getItem(`${key}quality`) || 'medium'
    localConfig.value.safe = localStorage.getItem(`${key}safe`) || 'privacy,secrets,sexual,violence'
  } else {
    localConfig.value.width = Number(localStorage.getItem(`${key}width`) || 768)
    localConfig.value.height = Number(localStorage.getItem(`${key}height`) || 1024)
    localConfig.value.steps = Number(localStorage.getItem(`${key}steps`) || 24)
    localConfig.value.cfgScale = Number(localStorage.getItem(`${key}cfg_scale`) || 7)
    localConfig.value.sampler = localStorage.getItem(`${key}sampler`) || 'k_euler_a'
  }
}
const save = () => {
  if (!isPollinations.value && !localConfig.value.privacyAcknowledged) { modelError.value = '请先确认 AI Horde 分布式处理的隐私风险'; activeTab.value = 'api'; return }
  if (isPollinations.value) props.chat.pollinationsImageConfig = JSON.parse(JSON.stringify(localConfig.value))
  else props.chat.aiHordeImageConfig = JSON.parse(JSON.stringify(localConfig.value))
  props.chat.imageGenProvider = props.provider
  emit('save'); close()
}
</script>

<template>
  <div v-if="visible" class="overlay" @click.self="close"><div class="modal">
    <header><div><h3>角色 {{isPollinations?'Pollinations AI':'AI Horde'}} 独立配置</h3><p>{{isPollinations?'使用多模型统一 API，不覆盖其他引擎。':'使用社区志愿算力，仅启用文生图。'}}</p></div><button class="close" @click="close">×</button></header>
    <nav><button :class="{active:activeTab==='api'}" @click="activeTab='api'">API</button><button :class="{active:activeTab==='specs'}" @click="activeTab='specs'">参数</button><button :class="{active:activeTab==='prompt'}" @click="activeTab='prompt'">提示词</button></nav>
    <main>
      <section v-if="activeTab==='api'">
        <p class="notice" :class="{warning:!isPollinations}">{{isPollinations?'模型会消耗 Pollen；Secret Key 仅应保存在可信设备。留空时使用图像大厅的全局配置。':'提示词和结果会由陌生志愿者设备处理；不要提交真人隐私、密钥或敏感聊天内容。留空 Key 时使用匿名账号。'}}</p>
        <button class="secondary" @click="pullGlobal">从全局配置填入</button>
        <label><span>API 地址</span><input v-model="localConfig.baseUrl" :placeholder="isPollinations?'https://gen.pollinations.ai/v1':'https://aihorde.net/api/v2'"></label>
        <label><span>API Key</span><div class="inline"><input v-model="localConfig.apiKey" :type="showApiKey?'text':'password'" :placeholder="isPollinations?'个人 Key / BYOP 授权 Key':'留空使用匿名 Key'"><button @click="showApiKey=!showApiKey">{{showApiKey?'隐藏':'显示'}}</button></div></label>
        <label v-if="!isPollinations" class="switch"><span><strong>确认分布式隐私风险</strong><small>固定形象参考图不会发送给 AI Horde。</small></span><input v-model="localConfig.privacyAcknowledged" type="checkbox"></label>
      </section>
      <section v-else-if="activeTab==='specs'" class="grid">
        <label class="wide"><span>模型</span><div class="inline"><select v-model="localConfig.model"><option v-if="!localConfig.model" value="">自动选择在线 Worker</option><option v-for="model in models" :key="model.name" :value="model.name">{{model.name}}{{!isPollinations?` · ${model.count||0} Worker`:model.paid_only?' · 付费余额':''}}</option></select><button :disabled="loadingModels" @click="loadModels">刷新</button></div></label>
        <template v-if="isPollinations"><label><span>尺寸</span><select v-model="localConfig.size"><option>1024x1024</option><option>768x1024</option><option>1024x768</option><option>1024x1536</option><option>1536x1024</option></select></label><label><span>质量</span><select v-model="localConfig.quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label class="wide"><span>安全检查</span><input v-model="localConfig.safe"></label><label class="switch wide"><span><strong>允许固定形象参考图</strong><small>仅在所选模型支持图片输入时发送。</small></span><input v-model="localConfig.useIdentityReferences" type="checkbox"></label></template>
        <template v-else><label><span>宽度</span><input v-model.number="localConfig.width" type="number" min="256" max="1536" step="64"></label><label><span>高度</span><input v-model.number="localConfig.height" type="number" min="256" max="1536" step="64"></label><label><span>步数</span><input v-model.number="localConfig.steps" type="number" min="1" max="50"></label><label><span>CFG</span><input v-model.number="localConfig.cfgScale" type="number" min="1" max="30" step=".5"></label><label><span>采样器</span><select v-model="localConfig.sampler"><option value="k_euler_a">Euler a</option><option value="k_euler">Euler</option><option value="k_dpmpp_2m">DPM++ 2M</option><option value="k_dpmpp_sde">DPM++ SDE</option></select></label><label><span>Seed</span><input v-model="localConfig.seed" placeholder="随机"></label><label class="switch"><span><strong>仅可信 Worker</strong></span><input v-model="localConfig.trustedWorkers" type="checkbox"></label><label class="switch"><span><strong>仅验证后端</strong></span><input v-model="localConfig.validatedBackends" type="checkbox"></label></template>
      </section>
      <section v-else><label><span>角色固定画面设定</span><textarea v-model="localConfig.promptPrefix" rows="6" placeholder="人物外貌、服装、画风与镜头偏好……"></textarea></label><label v-if="!isPollinations"><span>负面提示词</span><textarea v-model="localConfig.negativePrompt" rows="4"></textarea></label><label class="switch"><span><strong>智能整理聊天画面</strong><small>使用当前聊天 LLM 补全画面描述。</small></span><input v-model="localConfig.enableLlmAssist" type="checkbox"></label><label v-if="localConfig.enableLlmAssist"><span>读取最近消息数量</span><input v-model.number="localConfig.llmContextSize" type="number" min="1" max="50"></label></section>
      <p v-if="modelError" class="error">{{modelError}}</p>
    </main>
    <footer><button class="secondary" @click="close">取消</button><button class="primary" @click="save">保存配置</button></footer>
  </div></div>
</template>

<style scoped>
.overlay{position:fixed;z-index:10001;inset:0;display:grid;place-items:center;padding:16px;background:rgba(20,23,33,.45);backdrop-filter:blur(8px)}.modal{width:min(680px,95vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;border-radius:22px;background:var(--sys-bg-primary,#fff);color:var(--text-primary,#222);box-shadow:0 24px 80px rgba(0,0,0,.25)}header{display:flex;justify-content:space-between;padding:20px 22px 12px}h3{margin:0}header p{margin:4px 0 0;color:var(--text-secondary,#888);font-size:12px}.close{border:0;background:transparent;color:inherit;font-size:29px}nav{display:flex;gap:4px;margin:0 20px;padding:4px;border-radius:13px;background:var(--sys-bg-secondary,#f2f3f6)}nav button{flex:1;border:0;border-radius:10px;padding:9px;background:transparent;color:inherit}nav .active{background:var(--sys-bg-primary,#fff);font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.08)}main{min-height:330px;padding:18px 22px;overflow:auto}label{display:flex;flex-direction:column;gap:7px;margin:12px 0;font-size:13px;font-weight:600}input,select,textarea{width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--border-color,#ddd);border-radius:10px;background:var(--sys-bg-secondary,#f6f7f8);color:inherit;font:inherit;outline:none}.inline{display:flex;gap:7px}.inline button,.secondary{border:0;border-radius:9px;padding:0 13px;background:#eceef0;color:#4c5158}.secondary{padding:10px 14px}.notice{padding:10px;border-radius:10px;background:#edf7f1;color:#315d49;font-size:12px;line-height:1.5}.warning{background:#fff1ed;color:#8b3d2c}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.wide{grid-column:1/-1}.switch{flex-direction:row;align-items:center;justify-content:space-between;padding:12px;border-radius:12px;background:var(--sys-bg-secondary,#f5f6f8)}.switch span{display:flex;flex-direction:column}.switch input{width:auto}.switch small{color:var(--text-secondary,#888);font-weight:400}footer{display:flex;justify-content:flex-end;gap:10px;padding:14px 22px 20px;border-top:1px solid #eee}.primary{border:0;border-radius:11px;padding:11px 18px;background:#176b42;color:#fff;font-weight:700}.error{color:#b83f31;font-size:12px}@media(max-width:560px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}}
select{appearance:none;padding-right:32px;background-image:linear-gradient(45deg,transparent 50%,#778 50%),linear-gradient(135deg,#778 50%,transparent 50%);background-position:calc(100% - 15px) 50%,calc(100% - 10px) 50%;background-size:5px 5px;background-repeat:no-repeat}input[type=checkbox]{appearance:none;width:36px!important;height:21px;flex:0 0 36px;padding:0;border:0;border-radius:999px;background:#d7dbe0;transition:.18s}input[type=checkbox]::after{content:'';display:block;width:17px;height:17px;margin:2px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.22);transition:.18s}input[type=checkbox]:checked{background:#176b42}input[type=checkbox]:checked::after{transform:translateX(15px)}
</style>
