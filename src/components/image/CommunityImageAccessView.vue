<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import localforage from 'localforage'
import { usePollinationsImage, type PollinationsImageModel } from '../../composables/usePollinationsImage'
import { useAiHordeImage, type AiHordeModel } from '../../composables/useAiHordeImage'

const props = defineProps<{ provider: 'pollinations' | 'aihorde' }>()
defineEmits<{ (e: 'back'): void }>()

const isPollinations = computed(() => props.provider === 'pollinations')
const prefix = computed(() => isPollinations.value ? 'app_pollinations_image_' : 'app_ai_horde_image_')
const activeTab = ref<'generate' | 'history'>('generate')
const prompt = ref('')
const negativePrompt = ref('')
const showApiKey = ref(false)
const byopAppKey = ref(localStorage.getItem('app_pollinations_byop_client_id') || '')
const byopStatus = ref('')
const previewImage = ref('')
const loadingModels = ref(false)
const modelError = ref('')
const pollinationModels = ref<PollinationsImageModel[]>([])
const hordeModels = ref<AiHordeModel[]>([])
const displayModels = computed<any[]>(() => isPollinations.value ? pollinationModels.value : hordeModels.value)
const privacyAcknowledged = ref(false)
const referenceInput = ref<HTMLInputElement | null>(null)
const referenceImages = ref<string[]>([])
const historyItems = ref<Array<{ id: string; at: number; model: string; prompt: string; image: string }>>([])
const historyStore = computed(() => localforage.createInstance({ name: 'nrt-app', storeName: isPollinations.value ? 'pollinationsImageHistory' : 'aiHordeImageHistory' }))

const config = ref<any>({})
const resetConfig = () => {
  const key = prefix.value
  prompt.value = localStorage.getItem(`${key}prompt`) || ''
  negativePrompt.value = localStorage.getItem(`${key}negative_prompt`) || ''
  privacyAcknowledged.value = localStorage.getItem(`${key}privacy_ack`) === 'true'
  config.value = isPollinations.value ? {
    apiKey: localStorage.getItem(`${key}apikey`) || '',
    baseUrl: localStorage.getItem(`${key}baseurl`) || 'https://gen.pollinations.ai/v1',
    model: localStorage.getItem(`${key}model`) || 'zimage',
    size: localStorage.getItem(`${key}size`) || '1024x1024',
    quality: localStorage.getItem(`${key}quality`) || 'medium',
    safe: localStorage.getItem(`${key}safe`) || 'privacy,secrets,sexual,violence'
  } : {
    apiKey: localStorage.getItem(`${key}apikey`) || '',
    baseUrl: localStorage.getItem(`${key}baseurl`) || 'https://aihorde.net/api/v2',
    model: localStorage.getItem(`${key}model`) || '',
    width: Number(localStorage.getItem(`${key}width`) || 768),
    height: Number(localStorage.getItem(`${key}height`) || 1024),
    steps: Number(localStorage.getItem(`${key}steps`) || 24),
    cfgScale: Number(localStorage.getItem(`${key}cfg_scale`) || 7),
    sampler: localStorage.getItem(`${key}sampler`) || 'k_euler_a',
    seed: localStorage.getItem(`${key}seed`) || '',
    timeout: Number(localStorage.getItem(`${key}timeout`) || 600000),
    trustedWorkers: localStorage.getItem(`${key}trusted_workers`) !== 'false',
    validatedBackends: localStorage.getItem(`${key}validated_backends`) !== 'false',
    censorNsfw: localStorage.getItem(`${key}censor_nsfw`) !== 'false'
  }
}
resetConfig()

watch(config, value => {
  const key = prefix.value
  Object.entries(value).forEach(([name, val]) => {
    const storageName: Record<string, string> = { apiKey: 'apikey', baseUrl: 'baseurl', cfgScale: 'cfg_scale', trustedWorkers: 'trusted_workers', validatedBackends: 'validated_backends', censorNsfw: 'censor_nsfw' }
    localStorage.setItem(`${key}${storageName[name] || name}`, String(val ?? ''))
  })
}, { deep: true })
watch(prompt, value => localStorage.setItem(`${prefix.value}prompt`, value))
watch(negativePrompt, value => localStorage.setItem(`${prefix.value}negative_prompt`, value))
watch(privacyAcknowledged, value => localStorage.setItem(`${prefix.value}privacy_ack`, String(value)))
watch(byopAppKey, value => localStorage.setItem('app_pollinations_byop_client_id', value.trim()))

const pollinations = usePollinationsImage()
const horde = useAiHordeImage()
const isGenerating = computed(() => isPollinations.value ? pollinations.isGenerating.value : horde.isGenerating.value)
const errorMsg = computed(() => isPollinations.value ? pollinations.errorMsg.value : horde.errorMsg.value)
const progressText = computed(() => isPollinations.value ? '' : horde.progressText.value)
const selectedPollinationsModel = computed(() => pollinationModels.value.find(item => item.name === config.value.model))
const supportsReferences = computed(() => Boolean(selectedPollinationsModel.value?.input_modalities?.includes('image')))

const loadModels = async () => {
  loadingModels.value = true
  modelError.value = ''
  try {
    if (isPollinations.value) pollinationModels.value = await pollinations.fetchModels(true)
    else hordeModels.value = await horde.fetchModels()
  } catch (error: any) { modelError.value = error?.message || '模型列表加载失败' }
  finally { loadingModels.value = false }
}
const readFile = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file)
})
const addReferences = async (event: Event) => {
  const files = Array.from((event.target as HTMLInputElement).files || []).slice(0, 8 - referenceImages.value.length)
  for (const file of files) referenceImages.value.push(await readFile(file))
  if (referenceInput.value) referenceInput.value.value = ''
}
const saveHistory = async (image: string) => {
  const item = { id: `${props.provider}_${Date.now()}`, at: Date.now(), model: config.value.model || '自动', prompt: prompt.value.trim(), image }
  await historyStore.value.setItem(item.id, item)
  historyItems.value.unshift(item)
}
const loadHistory = async () => {
  const values: typeof historyItems.value = []
  await historyStore.value.iterate<any, void>(value => { if (value?.id) values.push(value) })
  historyItems.value = values.sort((a, b) => b.at - a.at)
}
const deleteHistory = async (id: string) => { await historyStore.value.removeItem(id); historyItems.value = historyItems.value.filter(item => item.id !== id) }
const base64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const startByop = async () => {
  if (!byopAppKey.value.trim().startsWith('pk_')) { byopStatus.value = '请先填写在 Pollinations 创建、并登记当前回调地址的 pk_ App Key'; return }
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)))
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  const state = base64Url(crypto.getRandomValues(new Uint8Array(24)))
  const redirectUri = `${location.origin}${location.pathname}`
  sessionStorage.setItem('pollinations_byop_verifier', verifier)
  sessionStorage.setItem('pollinations_byop_state', state)
  sessionStorage.setItem('pollinations_byop_redirect', redirectUri)
  const url = new URL('https://enter.pollinations.ai/authorize')
  url.search = new URLSearchParams({ response_type: 'code', client_id: byopAppKey.value.trim(), redirect_uri: redirectUri, state, code_challenge: challenge, code_challenge_method: 'S256', models: config.value.model || 'zimage', budget: '5', expiry: '30' }).toString()
  location.assign(url.toString())
}
const finishByop = async () => {
  if (!isPollinations.value) return
  const query = new URLSearchParams(location.search)
  const code = query.get('code')
  if (!code) return
  const state = query.get('state') || ''
  const expectedState = sessionStorage.getItem('pollinations_byop_state') || ''
  const verifier = sessionStorage.getItem('pollinations_byop_verifier') || ''
  const redirectUri = sessionStorage.getItem('pollinations_byop_redirect') || `${location.origin}${location.pathname}`
  if (!expectedState || state !== expectedState || !verifier) { byopStatus.value = 'Pollinations 授权状态校验失败，请重新连接'; return }
  byopStatus.value = '正在完成 Pollinations 授权…'
  try {
    const response = await fetch('https://enter.pollinations.ai/api/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: byopAppKey.value.trim(), redirect_uri: redirectUri, code_verifier: verifier }) })
    if (!response.ok) throw new Error(`授权令牌交换失败 (${response.status})`)
    const payload = await response.json()
    if (!payload?.access_token) throw new Error('授权接口没有返回访问令牌')
    config.value.apiKey = payload.access_token
    byopStatus.value = 'Pollinations 账户已连接，已保存限额授权令牌'
    history.replaceState({}, '', `${location.pathname}${location.hash}`)
  } catch (error: any) { byopStatus.value = error?.message || 'Pollinations 授权失败' }
  finally {
    sessionStorage.removeItem('pollinations_byop_verifier'); sessionStorage.removeItem('pollinations_byop_state'); sessionStorage.removeItem('pollinations_byop_redirect')
  }
}
const handleGenerate = async () => {
  try {
    const image = isPollinations.value
      ? await pollinations.generateImage({ apiKey: config.value.apiKey, baseUrl: config.value.baseUrl }, { model: config.value.model, prompt: prompt.value, size: config.value.size, quality: config.value.quality, safe: config.value.safe, referenceImages: supportsReferences.value ? referenceImages.value : [] })
      : await horde.generateImage({ apiKey: config.value.apiKey, baseUrl: config.value.baseUrl }, { prompt: prompt.value, negativePrompt: negativePrompt.value, model: config.value.model, width: config.value.width, height: config.value.height, steps: config.value.steps, cfgScale: config.value.cfgScale, sampler: config.value.sampler, seed: config.value.seed, timeout: config.value.timeout, trustedWorkers: config.value.trustedWorkers, validatedBackends: config.value.validatedBackends, censorNsfw: config.value.censorNsfw })
    previewImage.value = image
    await saveHistory(image)
  } catch { /* 适配器提供可见错误。 */ }
}

onMounted(async () => { await finishByop(); await Promise.all([loadModels(), loadHistory()]) })
</script>

<template>
  <div class="ia-page">
    <div class="header-minimal"><div class="header-titles"><h1 class="main-title">{{ isPollinations ? 'Pollinations AI 接入' : 'AI Horde 接入' }}</h1></div><button class="back-btn" @click="$emit('back')"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg></button></div>
    <div class="community-page">
      <div class="hero" :class="{ horde: !isPollinations }"><div><span class="brand">{{ isPollinations ? 'MULTI-MODEL IMAGE API' : 'COMMUNITY GPU HORDE' }}</span><h2>{{ isPollinations ? '低门槛多模型生图' : '社区免费志愿算力' }}</h2><p>{{ isPollinations ? '支持 Pollen、BYOP 与 OpenAI 兼容图片接口。' : '免费但可能排队；提示词会交给陌生志愿者设备处理。' }}</p></div><div class="model-badge">{{ isPollinations ? 'POL' : 'HOR' }}</div></div>
      <nav><button :class="{active:activeTab==='generate'}" @click="activeTab='generate'">生成</button><button :class="{active:activeTab==='history'}" @click="activeTab='history'">历史</button></nav>
      <section v-if="activeTab==='generate'" class="workspace">
        <div class="panel form">
          <p v-if="isPollinations" class="notice">Pollinations 不是无限免费服务。模型会消耗 Pollen；推荐使用个人 Key 或 BYOP 授权。Secret Key 仅应在可信设备使用。</p>
          <p v-else class="notice danger">隐私警告：AI Horde Worker 理论上可以看到并保存提示词和结果。匿名请求还可能被强制共享给数据集。此处不支持上传参考图。</p>
          <label class="ack" v-if="!isPollinations"><input v-model="privacyAcknowledged" type="checkbox"><span>我理解这是分布式公开风险服务，不提交真人隐私、密钥或敏感信息</span></label>
          <label><span>API Key</span><div class="inline"><input v-model="config.apiKey" :type="showApiKey?'text':'password'" :placeholder="isPollinations?'pk_ / 已授权的个人 Key':'留空使用匿名 Key 0000000000'"><button @click="showApiKey=!showApiKey">{{showApiKey?'隐藏':'显示'}}</button></div></label>
          <div v-if="isPollinations" class="byop-box"><label><span>BYOP App Key（pk_）</span><input v-model="byopAppKey" placeholder="需在 Pollinations 登记当前页面回调地址"></label><button @click="startByop">连接 Pollinations 账户</button><small>采用 OAuth 2.1 + PKCE，默认授权当前模型、5 Pollen 预算、30 天有效期。</small><p v-if="byopStatus">{{byopStatus}}</p></div>
          <label><span>API 地址</span><input v-model="config.baseUrl"></label>
          <label><span>在线模型</span><div class="inline"><select v-model="config.model"><option v-if="!config.model" value="">自动选择在线 Worker</option><option v-for="model in displayModels" :key="model.name" :value="model.name">{{ model.name }}{{ !isPollinations ? ` · ${model.count || 0} Worker · ETA ${model.eta || 0}s` : (model.paid_only ? ' · 付费余额' : '') }}</option></select><button :disabled="loadingModels" @click="loadModels">刷新</button></div></label>
          <p v-if="modelError" class="error">{{modelError}}</p>
          <label><span>画面描述</span><textarea v-model="prompt" rows="7" placeholder="描述主体、动作、场景、构图和光线……"></textarea></label>
          <label v-if="!isPollinations"><span>负面提示词</span><textarea v-model="negativePrompt" rows="3" placeholder="不希望出现的内容……"></textarea></label>
          <div v-if="isPollinations" class="grid"><label><span>尺寸</span><select v-model="config.size"><option>1024x1024</option><option>768x1024</option><option>1024x768</option><option>1024x1536</option><option>1536x1024</option></select></label><label><span>质量</span><select v-model="config.quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label class="wide"><span>安全检查</span><input v-model="config.safe"></label></div>
          <div v-else class="grid"><label><span>宽度</span><input v-model.number="config.width" type="number" min="256" max="1536" step="64"></label><label><span>高度</span><input v-model.number="config.height" type="number" min="256" max="1536" step="64"></label><label><span>步数</span><input v-model.number="config.steps" type="number" min="1" max="50"></label><label><span>CFG</span><input v-model.number="config.cfgScale" type="number" min="1" max="30" step="0.5"></label><label><span>采样器</span><select v-model="config.sampler"><option value="k_euler_a">Euler a</option><option value="k_euler">Euler</option><option value="k_dpmpp_2m">DPM++ 2M</option><option value="k_dpmpp_sde">DPM++ SDE</option></select></label><label><span>Seed</span><input v-model="config.seed" placeholder="随机"></label></div>
          <div v-if="isPollinations" class="reference-row"><div><strong>临时参考图</strong><small>{{ supportsReferences ? `当前模型支持 · ${referenceImages.length}/8` : '当前模型不支持图片输入' }}</small></div><button :disabled="!supportsReferences" @click="referenceInput?.click()">选择图片</button><input ref="referenceInput" type="file" accept="image/*" multiple hidden @change="addReferences"></div>
          <div v-if="referenceImages.length" class="thumbs"><div v-for="(image,index) in referenceImages" :key="index"><img :src="image"><button @click="referenceImages.splice(index,1)">×</button></div></div>
          <p v-if="progressText" class="progress">{{progressText}}</p><p v-if="errorMsg" class="error">{{errorMsg}}</p>
          <div class="actions"><button v-if="isGenerating" class="stop" @click="isPollinations?pollinations.abortGeneration():horde.abortGeneration()">取消</button><button class="primary" :disabled="isGenerating||!prompt.trim()||(!isPollinations&&!privacyAcknowledged)" @click="handleGenerate">{{isGenerating?'正在生成…':'开始生成'}}</button></div>
        </div>
        <div class="panel preview"><img v-if="previewImage" :src="previewImage"><div v-else class="empty">生成结果将在这里显示</div></div>
      </section>
      <section v-else class="panel history"><article v-for="item in historyItems" :key="item.id"><button class="history-main" @click="previewImage=item.image;activeTab='generate'"><strong>{{item.model}}</strong><span>{{new Date(item.at).toLocaleString()}}</span><small>{{item.prompt}}</small></button><button class="stop" @click="deleteHistory(item.id)">删除</button></article><div v-if="!historyItems.length" class="empty">暂无生成历史</div></section>
    </div>
  </div>
</template>

<style scoped src="../app_ImageAccess.css"></style>
<style scoped>
.ia-page>.community-page{height:auto;flex:1}.community-page{flex:1;overflow-y:auto;padding:20px;box-sizing:border-box;color:var(--text-primary,#202124)}.hero{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:22px;border-radius:20px;background:linear-gradient(135deg,#123b30,#2b8061);color:#fff}.hero.horde{background:linear-gradient(135deg,#27213e,#5b4b79)}.hero h2{margin:5px 0;font-size:24px}.hero p{margin:0;opacity:.75;font-size:12px}.brand{font-size:10px;letter-spacing:2px;color:#c7ffe4}.model-badge{padding:10px 14px;border:1px solid rgba(255,255,255,.25);border-radius:12px;font-weight:800}nav{display:flex;gap:5px;margin-bottom:14px;padding:5px;border-radius:13px;background:var(--sys-bg-secondary,#eef0f2)}nav button{flex:1;padding:10px;border:0;border-radius:9px;background:transparent;color:inherit}nav .active{background:var(--sys-bg-primary,#fff);box-shadow:0 2px 8px rgba(0,0,0,.08);font-weight:700}.workspace{display:grid;grid-template-columns:minmax(320px,1fr) minmax(300px,1fr);gap:14px}.panel{padding:18px;border:1px solid var(--border-color,#e2e4e8);border-radius:18px;background:var(--sys-bg-primary,#fff)}label{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;font-size:12px;font-weight:650}input,select,textarea,button{box-sizing:border-box;font:inherit}input,select,textarea{width:100%;padding:10px 11px;border:1px solid var(--border-color,#dfe2e6);border-radius:10px;background:var(--sys-bg-secondary,#f6f7f8);color:inherit;outline:none}.inline{display:flex;gap:6px}.inline button,.reference-row button{border:0;border-radius:9px;padding:0 12px;background:var(--sys-bg-secondary,#eceef0);color:inherit}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}.wide{grid-column:1/-1}.notice{padding:11px;border-radius:11px;background:#edf7f1;color:#315d49;font-size:12px;line-height:1.55}.notice.danger{background:#fff1ed;color:#8b3d2c}.ack{flex-direction:row;align-items:flex-start;padding:10px;border-radius:11px;background:var(--sys-bg-secondary,#f5f6f8);line-height:1.5}.ack input{width:auto;margin-top:3px}.reference-row{display:flex;justify-content:space-between;align-items:center;padding:11px;border-radius:11px;background:var(--sys-bg-secondary,#f5f6f8)}.reference-row div{display:flex;flex-direction:column}.reference-row small{color:var(--text-secondary,#777)}.reference-row button{padding:9px 12px}.thumbs{display:flex;gap:7px;overflow:auto;margin:10px 0}.thumbs div{position:relative;flex:0 0 66px}.thumbs img{width:66px;height:66px;object-fit:cover;border-radius:9px}.thumbs button{position:absolute;right:-3px;top:-3px;width:20px;height:20px;border:0;border-radius:50%;background:#fff;color:#a22}.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.primary,.stop{border:0;border-radius:10px;padding:10px 14px}.primary{background:#176b42;color:#fff;font-weight:700}.primary:disabled{opacity:.45}.stop{background:#f5e8e8;color:#9d3030}.preview{display:grid;min-height:520px;place-items:center;background:#101411}.preview img{max-width:100%;max-height:70vh;border-radius:12px}.empty{padding:40px;text-align:center;color:var(--text-secondary,#888)}.error{color:#b83f31;font-size:12px}.progress{padding:10px;border-radius:9px;background:#eee9f6;color:#5b4776;font-size:12px}.history article{display:flex;gap:8px;margin-bottom:8px}.history-main{display:flex;flex:1;flex-direction:column;align-items:flex-start;padding:11px;border:0;border-radius:10px;background:var(--sys-bg-secondary,#f5f6f7);color:inherit;text-align:left}.history-main small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary,#777)}@media(max-width:760px){.workspace{grid-template-columns:1fr}.preview{min-height:340px}.grid{grid-template-columns:1fr}.wide{grid-column:auto}}
select{appearance:none;padding-right:32px;background-image:linear-gradient(45deg,transparent 50%,#778 50%),linear-gradient(135deg,#778 50%,transparent 50%);background-position:calc(100% - 15px) 50%,calc(100% - 10px) 50%;background-size:5px 5px;background-repeat:no-repeat}input[type=checkbox]{appearance:none;width:36px!important;height:21px;flex:0 0 36px;padding:0;border:0;border-radius:999px;background:#d7dbe0;transition:.18s}input[type=checkbox]::after{content:'';display:block;width:17px;height:17px;margin:2px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.22);transition:.18s}input[type=checkbox]:checked{background:#176b42}input[type=checkbox]:checked::after{transform:translateX(15px)}.ack input{margin-top:1px}.byop-box{margin:0 0 12px;padding:12px;border:1px solid #cfe4d8;border-radius:12px;background:#f1f8f4}.byop-box label{margin:0 0 8px}.byop-box>button{width:100%;padding:10px;border:0;border-radius:10px;background:#176b42;color:#fff;font-weight:700}.byop-box small{display:block;margin-top:7px;color:var(--text-secondary,#777);line-height:1.45}.byop-box p{margin:8px 0 0;color:#315d49;font-size:12px}
</style>
