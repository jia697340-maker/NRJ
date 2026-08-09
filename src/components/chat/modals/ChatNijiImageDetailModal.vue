<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ visible: boolean; chat: any }>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void; (e: 'save'): void }>()
const activeTab = ref<'api' | 'specs' | 'prompt'>('api')
const showApiKey = ref(false)
const localConfig = ref<any>({})
const defaults = () => ({
  protocol: 'proxy', baseUrl: '', apiKey: '', speedMode: 'fast', aspectRatio: '2:3', stylize: 100,
  chaos: 0, weird: 0, seed: '', raw: false, styleReference: '', styleWeight: 100,
  imagePromptUrl: '', imageWeight: 1, promptPrefix: '', enableLlmAssist: false, llmContextSize: 12,
  pollInterval: 3000, timeout: 600000
})

watch(() => props.visible, visible => {
  if (!visible) return
  localConfig.value = { ...defaults(), ...(props.chat?.nijiImageConfig || {}) }
  activeTab.value = 'api'
})

const close = () => emit('update:visible', false)
const pullGlobal = () => {
  localConfig.value.protocol = localStorage.getItem('app_niji_image_protocol') || 'proxy'
  localConfig.value.baseUrl = localStorage.getItem('app_niji_image_baseurl') || ''
  localConfig.value.apiKey = localStorage.getItem('app_niji_image_apikey') || ''
  localConfig.value.speedMode = localStorage.getItem('app_niji_image_speed') || 'fast'
  localConfig.value.aspectRatio = localStorage.getItem('app_niji_image_aspect_ratio') || '2:3'
  localConfig.value.stylize = Number(localStorage.getItem('app_niji_image_stylize') || 100)
  localConfig.value.chaos = Number(localStorage.getItem('app_niji_image_chaos') || 0)
  localConfig.value.weird = Number(localStorage.getItem('app_niji_image_weird') || 0)
  localConfig.value.raw = localStorage.getItem('app_niji_image_raw') === 'true'
  localConfig.value.styleReference = localStorage.getItem('app_niji_image_sref') || ''
  localConfig.value.styleWeight = Number(localStorage.getItem('app_niji_image_sw') || 100)
  localConfig.value.imagePromptUrl = localStorage.getItem('app_niji_image_reference_url') || ''
  localConfig.value.imageWeight = Number(localStorage.getItem('app_niji_image_iw') || 1)
}
const save = () => {
  props.chat.nijiImageConfig = JSON.parse(JSON.stringify(localConfig.value))
  props.chat.imageGenProvider = 'niji'
  emit('save')
  close()
}
</script>

<template>
  <div v-if="visible" class="overlay" @click.self="close">
    <div class="modal">
      <header><div><h3>角色 Niji 7 独立配置</h3><p>仅用于第三方 Niji 中转，不会覆盖其他引擎。</p></div><button class="close" @click="close">×</button></header>
      <nav><button :class="{active:activeTab==='api'}" @click="activeTab='api'">API</button><button :class="{active:activeTab==='specs'}" @click="activeTab='specs'">参数</button><button :class="{active:activeTab==='prompt'}" @click="activeTab='prompt'">提示词</button></nav>
      <main>
        <section v-if="activeTab==='api'">
          <p class="notice warning">Midjourney 未提供普通开发者官方 API。请勿填写 Discord Token、Cookie 或账号密码。</p>
          <p class="notice">留空时使用图像大厅里的全局 Niji 配置。</p><button class="secondary" @click="pullGlobal">从全局 Niji 配置填入</button>
          <label><span>兼容协议</span><select v-model="localConfig.protocol"><option value="proxy">Midjourney Proxy</option><option value="hosted">Hosted Jobs</option></select></label>
          <label><span>中转基础地址</span><input v-model="localConfig.baseUrl" placeholder="留空使用全局地址"></label>
          <label><span>中转 API Key</span><div class="inline"><input v-model="localConfig.apiKey" :type="showApiKey?'text':'password'" placeholder="留空使用全局密钥"><button @click="showApiKey=!showApiKey">{{showApiKey?'隐藏':'显示'}}</button></div></label>
        </section>
        <section v-else-if="activeTab==='specs'" class="grid">
          <label><span>画面比例</span><select v-model="localConfig.aspectRatio"><option value="1:1">1:1</option><option value="2:3">2:3</option><option value="3:2">3:2</option><option value="9:16">9:16</option><option value="16:9">16:9</option></select></label>
          <label><span>速度模式</span><select v-model="localConfig.speedMode"><option value="fast">Fast</option><option value="relax">Relax</option><option value="turbo">Turbo</option></select></label>
          <label><span>Stylize 0–1000</span><input v-model.number="localConfig.stylize" type="number" min="0" max="1000"></label>
          <label><span>Chaos 0–100</span><input v-model.number="localConfig.chaos" type="number" min="0" max="100"></label>
          <label><span>Weird 0–3000</span><input v-model.number="localConfig.weird" type="number" min="0" max="3000"></label>
          <label><span>Seed（留空随机）</span><input v-model="localConfig.seed" type="number"></label>
          <label class="switch"><span><strong>Raw 模式</strong><small>降低默认审美修饰。</small></span><input v-model="localConfig.raw" type="checkbox"></label>
          <label><span>Style Reference</span><input v-model="localConfig.styleReference" placeholder="图片 URL 或风格代码"></label>
          <label><span>Style Weight</span><input v-model.number="localConfig.styleWeight" type="number" min="0" max="1000"></label>
          <label><span>Image Prompt URL</span><input v-model="localConfig.imagePromptUrl" placeholder="公开图片 URL"></label>
          <label><span>Image Weight 0–2</span><input v-model.number="localConfig.imageWeight" type="number" min="0" max="2" step="0.1"></label>
        </section>
        <section v-else>
          <label><span>角色固定画面设定</span><textarea v-model="localConfig.promptPrefix" rows="7" placeholder="人物外貌、服装、画风和镜头偏好……"></textarea></label>
          <label class="switch"><span><strong>智能整理聊天画面</strong><small>调用当前聊天 LLM，将简短画面补全为 Niji 7 精确描述。</small></span><input v-model="localConfig.enableLlmAssist" type="checkbox"></label>
          <label v-if="localConfig.enableLlmAssist"><span>读取最近消息数量</span><input v-model.number="localConfig.llmContextSize" type="number" min="1" max="50"></label>
        </section>
      </main>
      <footer><button class="secondary" @click="close">取消</button><button class="primary" @click="save">保存 Niji 配置</button></footer>
    </div>
  </div>
</template>

<style scoped>
.overlay{position:fixed;z-index:10001;inset:0;display:grid;place-items:center;padding:16px;background:rgba(20,23,33,.45);backdrop-filter:blur(8px)}.modal{width:min(680px,95vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;border-radius:22px;background:var(--sys-bg-primary,#fff);color:var(--text-primary,#222);box-shadow:0 24px 80px rgba(0,0,0,.25)}header{display:flex;justify-content:space-between;padding:20px 22px 12px}h3{margin:0}header p{margin:4px 0 0;color:var(--text-secondary,#888);font-size:12px}.close{border:0;background:transparent;color:inherit;font-size:29px}nav{display:flex;gap:4px;margin:0 20px;padding:4px;border-radius:13px;background:var(--sys-bg-secondary,#f2f3f6)}nav button{flex:1;border:0;border-radius:10px;padding:9px;background:transparent;color:inherit}nav .active{background:var(--sys-bg-primary,#fff);font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.08)}main{min-height:330px;padding:18px 22px;overflow:auto}label{display:flex;flex-direction:column;gap:7px;margin:12px 0;font-size:13px;font-weight:600}input,select,textarea{width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--border-color,#ddd);border-radius:10px;background:var(--sys-bg-secondary,#f6f7f8);color:inherit;font:inherit;outline:none}.inline{display:flex;gap:7px}.inline button,.secondary{border:0;border-radius:9px;padding:0 13px;background:#eceef0;color:#4c5158}.secondary{padding:10px 14px}.notice{padding:10px;border-radius:10px;background:var(--sys-bg-secondary,#f5f6f8);color:var(--text-secondary,#777);font-size:12px}.warning{background:#fff5e8;color:#87541b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.switch{flex-direction:row;align-items:center;justify-content:space-between;padding:12px;border-radius:12px;background:var(--sys-bg-secondary,#f5f6f8)}.switch span{display:flex;flex-direction:column}.switch input{width:auto}.switch small{color:var(--text-secondary,#888);font-weight:400}footer{display:flex;justify-content:flex-end;gap:10px;padding:14px 22px 20px;border-top:1px solid #eee}.primary{border:0;border-radius:11px;padding:11px 18px;background:#55466f;color:#fff;font-weight:700}@media(max-width:560px){.grid{grid-template-columns:1fr}}
</style>
