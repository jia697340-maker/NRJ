<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useNijiImage, type NijiGatewayProtocol, type NijiSpeedMode } from '../../composables/useNijiImage'
import { useNijiImageHistory } from '../../composables/useNijiImageHistory'

defineEmits<{ (e: 'back'): void }>()

const showApiKey = ref(false)
const activeTab = ref<'generate' | 'history'>('generate')
const prompt = ref(localStorage.getItem('app_niji_image_prompt') || '')
const previewImage = ref('')
const historyUrls = ref<Record<string, string>>({})
const config = ref({
  protocol: (localStorage.getItem('app_niji_image_protocol') || 'proxy') as NijiGatewayProtocol,
  baseUrl: localStorage.getItem('app_niji_image_baseurl') || '',
  apiKey: localStorage.getItem('app_niji_image_apikey') || '',
  speedMode: (localStorage.getItem('app_niji_image_speed') || 'fast') as NijiSpeedMode,
  aspectRatio: localStorage.getItem('app_niji_image_aspect_ratio') || '2:3',
  stylize: Number(localStorage.getItem('app_niji_image_stylize') || 100),
  chaos: Number(localStorage.getItem('app_niji_image_chaos') || 0),
  weird: Number(localStorage.getItem('app_niji_image_weird') || 0),
  seed: localStorage.getItem('app_niji_image_seed') || '',
  raw: localStorage.getItem('app_niji_image_raw') === 'true',
  styleReference: localStorage.getItem('app_niji_image_sref') || '',
  styleWeight: Number(localStorage.getItem('app_niji_image_sw') || 100),
  imagePromptUrl: localStorage.getItem('app_niji_image_reference_url') || '',
  imageWeight: Number(localStorage.getItem('app_niji_image_iw') || 1),
  pollInterval: Number(localStorage.getItem('app_niji_image_poll_interval') || 3000),
  timeout: Number(localStorage.getItem('app_niji_image_timeout') || 600000)
})

watch(config, value => {
  localStorage.setItem('app_niji_image_protocol', value.protocol)
  localStorage.setItem('app_niji_image_baseurl', value.baseUrl)
  localStorage.setItem('app_niji_image_apikey', value.apiKey)
  localStorage.setItem('app_niji_image_speed', value.speedMode)
  localStorage.setItem('app_niji_image_aspect_ratio', value.aspectRatio)
  localStorage.setItem('app_niji_image_stylize', String(value.stylize))
  localStorage.setItem('app_niji_image_chaos', String(value.chaos))
  localStorage.setItem('app_niji_image_weird', String(value.weird))
  localStorage.setItem('app_niji_image_seed', String(value.seed))
  localStorage.setItem('app_niji_image_raw', String(value.raw))
  localStorage.setItem('app_niji_image_sref', value.styleReference)
  localStorage.setItem('app_niji_image_sw', String(value.styleWeight))
  localStorage.setItem('app_niji_image_reference_url', value.imagePromptUrl)
  localStorage.setItem('app_niji_image_iw', String(value.imageWeight))
  localStorage.setItem('app_niji_image_poll_interval', String(value.pollInterval))
  localStorage.setItem('app_niji_image_timeout', String(value.timeout))
}, { deep: true })
watch(prompt, value => localStorage.setItem('app_niji_image_prompt', value))

const protocolHint = computed(() => config.value.protocol === 'proxy'
  ? '兼容 /mj/submit/imagine 与 /mj/task/{id}/fetch，使用 Bearer 鉴权。'
  : '兼容 /midjourney/v1/submit-jobs 与 job-status，使用 API-KEY 鉴权。')
const { isGenerating, errorMsg, progressText, lastGeneratedParams, generateImage, abortGeneration } = useNijiImage()
const { historyItems, loadHistoryList, addHistoryItem, deleteHistoryItem, getHistoryImageUrl } = useNijiImageHistory()

const handleGenerate = async () => {
  try {
    const image = await generateImage({
      apiKey: config.value.apiKey,
      baseUrl: config.value.baseUrl,
      protocol: config.value.protocol,
      pollInterval: config.value.pollInterval,
      timeout: config.value.timeout
    }, {
      prompt: prompt.value,
      speedMode: config.value.speedMode,
      aspectRatio: config.value.aspectRatio,
      stylize: config.value.stylize,
      chaos: config.value.chaos,
      weird: config.value.weird,
      seed: config.value.seed === '' ? null : Number(config.value.seed),
      raw: config.value.raw,
      styleReference: config.value.styleReference,
      styleWeight: config.value.styleWeight,
      imagePromptUrl: config.value.imagePromptUrl,
      imageWeight: config.value.imageWeight
    })
    previewImage.value = image
    if (lastGeneratedParams.value) await addHistoryItem(lastGeneratedParams.value, image)
  } catch {
    // composable 已提供可见错误。
  }
}

const openHistory = async (id: string) => {
  const url = await getHistoryImageUrl(id)
  if (url) { historyUrls.value[id] = url; previewImage.value = url; activeTab.value = 'generate' }
}

onMounted(loadHistoryList)
</script>

<template>
  <div class="ia-page">
    <div class="header-minimal">
      <div class="header-titles"><h1 class="main-title">Niji 7 接入</h1></div>
      <button class="back-btn" aria-label="返回图像引擎" @click="$emit('back')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
      </button>
    </div>
    <div class="niji-page">
    <div class="niji-scroll">
      <section class="card hero-card">
        <div class="section-heading">
          <div><span class="eyebrow">NIJI・JOURNEY</span><h3>Niji 7 独立接入</h3><p>仅连接用户自选的第三方中转，不读取其他图像引擎配置。</p></div>
          <span class="model-badge">Niji 7</span>
        </div>
      </section>

      <div class="pill-menu">
        <button class="pill-item" :class="{ active: activeTab === 'generate' }" @click="activeTab = 'generate'">生成与配置</button>
        <button class="pill-item" :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">生成历史</button>
      </div>

      <template v-if="activeTab === 'generate'">
        <section class="card">
          <div class="section-heading"><div><h3>第三方中转</h3><p>Midjourney 未提供普通开发者官方 API；请只填写中转商密钥。</p></div></div>
          <div class="warning">非官方接入可能失效或触发服务限制。请勿在此填写 Discord Token、Cookie 或账号密码。</div>
          <label class="field"><span>兼容协议</span><select v-model="config.protocol"><option value="proxy">Midjourney Proxy</option><option value="hosted">Hosted Jobs</option></select><small>{{ protocolHint }}</small></label>
          <label class="field"><span>中转基础地址</span><input v-model="config.baseUrl" placeholder="https://你的中转服务"></label>
          <label class="field"><span>中转 API Key（仅保存在本机）</span><div class="inline"><input v-model="config.apiKey" :type="showApiKey ? 'text' : 'password'" placeholder="填写中转商提供的 API Key"><button class="ghost-btn" @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button></div></label>
        </section>

        <section class="card">
          <h3>Niji 7 参数</h3>
          <label class="field"><span>画面描述</span><textarea v-model="prompt" rows="7" placeholder="明确描述人物外貌、服装、动作、场景、构图与光线……"></textarea></label>
          <div class="field-grid">
            <label class="field"><span>画面比例</span><select v-model="config.aspectRatio"><option value="1:1">1:1</option><option value="2:3">2:3（竖图）</option><option value="3:2">3:2（横图）</option><option value="9:16">9:16（手机）</option><option value="16:9">16:9（宽屏）</option></select></label>
            <label class="field"><span>速度模式</span><select v-model="config.speedMode"><option value="fast">Fast</option><option value="relax">Relax</option><option value="turbo">Turbo</option></select></label>
            <label class="field"><span>Stylize 0–1000</span><input v-model.number="config.stylize" type="number" min="0" max="1000"></label>
            <label class="field"><span>Chaos 0–100</span><input v-model.number="config.chaos" type="number" min="0" max="100"></label>
            <label class="field"><span>Weird 0–3000</span><input v-model.number="config.weird" type="number" min="0" max="3000"></label>
            <label class="field"><span>Seed（留空随机）</span><input v-model="config.seed" type="number" placeholder="随机"></label>
          </div>
          <label class="switch-row"><span><strong>Raw 模式</strong><small>降低默认审美修饰，提高提示词控制。</small></span><span class="switch"><input v-model="config.raw" type="checkbox"><i></i></span></label>
          <label class="field"><span>Style Reference（可选）</span><input v-model="config.styleReference" placeholder="图片 URL 或风格代码"><small>Niji 7 支持 sref；这里不会使用旧版 cref。</small></label>
          <label v-if="config.styleReference" class="field"><span>Style Weight 0–1000</span><input v-model.number="config.styleWeight" type="number" min="0" max="1000"></label>
          <label class="field"><span>Image Prompt URL（可选）</span><input v-model="config.imagePromptUrl" placeholder="中转可访问的公开图片 URL"></label>
          <label v-if="config.imagePromptUrl" class="field"><span>Image Weight 0–2</span><input v-model.number="config.imageWeight" type="number" min="0" max="2" step="0.1"></label>
          <div class="generate-row"><p class="hint">调用时会强制追加 <code>--niji 7</code>，避免旧模型默认值失效。</p><div class="actions"><button v-if="isGenerating" class="danger-btn" @click="abortGeneration">取消</button><button class="primary-btn" :disabled="isGenerating" @click="handleGenerate">{{ isGenerating ? (progressText || '正在生成…') : '开始生成' }}</button></div></div>
          <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
        </section>

        <section class="card preview-card"><img v-if="previewImage" :src="previewImage" alt="Niji 7 生成结果"><div v-else class="empty">生成结果将在这里显示</div></section>
      </template>

      <section v-else class="card history">
        <article v-for="item in historyItems" :key="item.id"><button class="history-main" @click="openHistory(item.id)"><strong>Niji 7 · {{ item.params.aspectRatio || '2:3' }}</strong><span>{{ new Date(item.timestamp).toLocaleString() }}</span><small>{{ item.params.prompt }}</small></button><button class="danger-btn" @click="deleteHistoryItem(item.id)">删除</button></article>
        <div v-if="!historyItems.length" class="empty">暂无 Niji 生成历史</div>
      </section>
    </div>
    </div>
  </div>
</template>

<style scoped src="../app_ImageAccess.css"></style>
<style scoped>
.niji-page{height:100%;min-height:0;color:#1d1d1f}.niji-scroll{height:100%;overflow-y:auto;padding:10px 24px 60px;box-sizing:border-box}.card{max-width:760px;margin:0 auto 18px;padding:22px;border-radius:22px;background:rgba(255,255,255,.88);box-shadow:0 12px 40px rgba(43,56,82,.08);border:1px solid rgba(255,255,255,.8)}.hero-card{background:linear-gradient(135deg,#27213e,#55466f);color:#fff}.section-heading,.generate-row{display:flex;align-items:center;justify-content:space-between;gap:16px}.section-heading h3{margin:4px 0 6px}.section-heading p,.hint{margin:3px 0 0;color:#7a7f89;font-size:12px;line-height:1.5}.hero-card p{color:rgba(255,255,255,.7)}.eyebrow{font-size:10px;letter-spacing:2px;color:#decfff}.model-badge{flex:none;padding:9px 12px;border:1px solid rgba(255,255,255,.24);border-radius:12px;font-size:13px;font-weight:800}.pill-menu{display:flex;max-width:760px;margin:0 auto 18px;padding:4px;border-radius:20px;background:#e9eaf0}.pill-item{flex:1;padding:9px 0;border:0;border-radius:16px;background:transparent;color:#555;font:inherit;font-size:14px;font-weight:500;cursor:pointer}.pill-item.active{background:#fff;color:#111;box-shadow:0 2px 8px rgba(0,0,0,.05)}h3{margin:0 0 14px;font-size:18px}.field{display:flex;flex-direction:column;gap:7px;margin-top:14px;font-size:13px;font-weight:600}.field small{color:#7a7f89;font-size:11px;font-weight:400;line-height:1.45}input,select,textarea{width:100%;box-sizing:border-box;border:1px solid #e2e5ea;border-radius:12px;padding:11px 12px;background:#f8f9fb;color:#222;font:inherit;outline:none}input:focus,select:focus,textarea:focus{border-color:#8a8f97;box-shadow:0 0 0 3px rgba(73,78,86,.1)}textarea{resize:vertical;line-height:1.55}.inline{display:flex;gap:8px}.ghost-btn,.primary-btn,.danger-btn,.history-main{border:0;border-radius:11px;font:inherit;cursor:pointer}.ghost-btn{flex:none;padding:0 14px;background:#eceef2;color:#4d5158}.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.warning{margin:14px 0 4px;padding:11px 12px;border-radius:12px;background:#fff5e8;color:#87541b;font-size:12px;line-height:1.5}.switch-row{display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding:12px;border-radius:12px;background:#f8f9fb;font-size:13px}.switch-row>span:first-child{display:flex;flex-direction:column;gap:3px}.switch-row small{color:#7a7f89;font-weight:400}.switch{position:relative;width:50px;height:30px;flex:none}.switch input{position:absolute;opacity:0;width:0;height:0}.switch i{position:absolute;inset:0;border-radius:30px;background:#e5e5ea;transition:.3s}.switch i:before{content:"";position:absolute;width:26px;height:26px;left:2px;top:2px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.1);transition:.3s}.switch input:checked+i{background:#765e9b}.switch input:checked+i:before{transform:translateX(20px)}.generate-row{align-items:flex-end;margin-top:18px}.actions{display:flex;gap:8px;flex:none}.primary-btn,.danger-btn{padding:11px 16px;font-weight:700}.primary-btn{background:#55466f;color:#fff}.primary-btn:disabled{opacity:.55}.danger-btn{background:#f6e9e9;color:#9d3030}.error{color:#c0392b;font-size:12px}.preview-card{display:grid;min-height:320px;place-items:center;background:#17141f}.preview-card img{max-width:100%;max-height:70vh;border-radius:12px}.empty{padding:40px;text-align:center;color:#888}.history article{display:flex;gap:8px;margin-bottom:8px}.history-main{display:flex;flex:1;min-width:0;flex-direction:column;align-items:flex-start;padding:11px;background:#f5f6f7;color:inherit;text-align:left}.history-main span{font-size:12px;color:#777}.history-main small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#777}code{padding:2px 4px;border-radius:4px;background:#eceef2;font-size:11px}@media(max-width:560px){.niji-scroll{padding:10px 16px 46px}.card{padding:18px;border-radius:18px}.field-grid{grid-template-columns:1fr}.section-heading{align-items:flex-start}.generate-row{align-items:stretch;flex-direction:column}.actions{justify-content:flex-end}.primary-btn{flex:1}.model-badge{font-size:11px}.history article{align-items:stretch}.history .danger-btn{padding:9px}}
.ia-page>.niji-page{height:auto;flex:1}
</style>
