/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

defineEmits(['close'])

const currentView = ref<'platforms' | 'minimax'>('platforms')

const activeIndex = ref(0)
const platforms = [
  { id: 'minimax', name: 'MiniMax 语音', desc: '高保真、超低时延的\n语音合成服务', action: '进入配置', disabled: false },
  { id: 'more', name: '更多平台', desc: '敬请期待更多\n优秀语音引擎接入', action: '即将开放', disabled: true }
]

const handlePrev = () => {
  if (activeIndex.value > 0) activeIndex.value--
}
const handleNext = () => {
  if (activeIndex.value < platforms.length - 1) activeIndex.value++
}
const handleSelect = (id: string, disabled: boolean) => {
  if (!disabled && id === 'minimax') {
    currentView.value = 'minimax'
  }
}

const region = ref('global')
const apiKey = ref('')
const testText = ref('这是一段语音合成测试文本。')
const testModel = ref('speech-2.6-turbo')
const testVoiceId = ref('female-yujie')
const isLoading = ref(false)

const testVoiceOptions = [
  { id: 'female-yujie', name: '温柔御姐' },
  { id: 'female-tianmei', name: '甜美少女' },
  { id: 'female-shaonv', name: '青春少女' },
  { id: 'male-qn-qingse', name: '青涩青年' },
  { id: 'male-qn-jingying', name: '精英沉稳' },
  { id: 'female-huopo', name: '活泼开朗' },
  { id: 'female-wenrou', name: '知性温柔' },
  { id: 'audiobook_male_1', name: '有声书男声 1' },
  { id: 'audiobook_male_2', name: '有声书男声 2' },
  { id: 'audiobook_female_1', name: '有声书女声 1' },
  { id: 'audiobook_female_2', name: '有声书女声 2' },
  { id: 'male-shangwu', name: '商务男声' },
  { id: 'female-chengshu', name: '成熟女声' },
  { id: 'male-boy', name: '阳光男孩' },
  { id: 'female-girl', name: '乖巧女孩' }
]
const errorMsg = ref('')

const isCheckingBalance = ref(false)
const balanceMsg = ref('')
const hasTokenPlan = ref<boolean | null>(null)

const showKeyPresetModal = ref(false)

const testModelOptions = [
  'speech-2.6-turbo',
  'speech-2.8-turbo',
  'speech-01-turbo'
]

// Key Presets
interface KeyPreset {
  id: string
  name: string
  key: string
  region: string
}
const keyPresets = ref<KeyPreset[]>([])
const newPresetName = ref('')

onMounted(() => {
  const saved = localStorage.getItem('minimax_voice_config_v4')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (parsed.region) region.value = parsed.region
      if (parsed.apiKey) apiKey.value = parsed.apiKey
      if (parsed.testText) testText.value = parsed.testText
      if (parsed.testModel) testModel.value = parsed.testModel
      if (parsed.testVoiceId) testVoiceId.value = parsed.testVoiceId
      if (parsed.keyPresets) keyPresets.value = parsed.keyPresets
    } catch(e) {}
  }
})

watch([region, apiKey, testText, testModel, testVoiceId, keyPresets], () => {
  const saved = localStorage.getItem('minimax_voice_config_v4')
  let parsed = {}
  try { if (saved) parsed = JSON.parse(saved) } catch(e) {}
  
  localStorage.setItem('minimax_voice_config_v4', JSON.stringify({
    ...parsed,
    region: region.value,
    apiKey: apiKey.value,
    testText: testText.value,
    testModel: testModel.value,
    testVoiceId: testVoiceId.value,
    keyPresets: keyPresets.value
  }))
}, { deep: true })

let audioInstance: HTMLAudioElement | null = null

const hexToBlob = (hexString: string, mimeType: string) => {
  const bytes = new Uint8Array(Math.ceil(hexString.length / 2))
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16)
  }
  return new Blob([bytes], { type: mimeType })
}

const getBaseUrl = () => {
  return region.value === 'china' ? 'https://api.minimaxi.com' : 'https://api.minimax.io'
}

const savePreset = () => {
  if (!apiKey.value) {
    alert('请先填写当前要保存的 API Key')
    return
  }
  if (!newPresetName.value.trim()) {
    alert('请输入预设名称')
    return
  }
  keyPresets.value.push({
    id: Date.now().toString(),
    name: newPresetName.value.trim(),
    key: apiKey.value,
    region: region.value
  })
  newPresetName.value = ''
}

const applyPreset = (preset: KeyPreset) => {
  apiKey.value = preset.key
  region.value = preset.region
  showKeyPresetModal.value = false
}

const deletePreset = (id: string) => {
  keyPresets.value = keyPresets.value.filter(p => p.id !== id)
}

const checkBalance = async () => {
  if (!apiKey.value) {
    balanceMsg.value = '请先填写接口密钥'
    hasTokenPlan.value = null
    return
  }
  
  isCheckingBalance.value = true
  balanceMsg.value = ''
  hasTokenPlan.value = null
  
  try {
    const res = await fetch(`${getBaseUrl()}/v1/token_plan/remains`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.value}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!res.ok) {
      if (res.status === 401) throw new Error('鉴权失败：密钥错误或区域不匹配')
      throw new Error(`服务异常 (状态码: ${res.status})`)
    }
    
    const data = await res.json()
    if (data.base_resp && data.base_resp.status_code !== 0) {
      if (data.base_resp.status_msg && data.base_resp.status_msg.includes('plan')) {
        hasTokenPlan.value = false
        return
      }
      throw new Error(data.base_resp.status_msg || '查询失败')
    }
    
    if (data.remains !== undefined && data.remains !== null) {
      hasTokenPlan.value = true
      balanceMsg.value = `剩余额度：¥ ${data.remains}`
    } else {
      hasTokenPlan.value = false
    }
  } catch (err: any) {
    balanceMsg.value = err.message || '查询失败'
    hasTokenPlan.value = null
  } finally {
    isCheckingBalance.value = false
  }
}

const openBalancePage = () => {
  const url = region.value === 'china' 
    ? 'https://platform.minimaxi.com/user-center/payment/balance'
    : 'https://platform.minimax.io/user-center/payment/balance'
  window.open(url, '_blank')
}

const playTest = async () => {
  if (!apiKey.value) {
    errorMsg.value = '请填写接口密钥'
    return
  }
  if (!testText.value) {
    errorMsg.value = '请填写测试文本'
    return
  }
  
  isLoading.value = true
  errorMsg.value = ''
  
  if (audioInstance) {
    audioInstance.pause()
    audioInstance = null
  }

  const url = `${getBaseUrl()}/v1/t2a_v2`

  const voiceSetting: any = {
    voice_id: testVoiceId.value || 'female-yujie',
    speed: 1.0,
    pitch: 1.0,
    vol: 1.0
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.value}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: testModel.value || 'speech-2.6-turbo',
        text: testText.value,
        stream: false,
        voice_setting: voiceSetting,
        audio_setting: {
          format: "mp3",
          sample_rate: 32000,
          bitrate: 128000
        }
      })
    })

    if (!res.ok) {
      if (res.status === 401) throw new Error('鉴权失败：密钥错误或区域不匹配')
      if (res.status === 429) throw new Error('请求超限：并发过高或余额不足')
      throw new Error(`服务异常 (状态码: ${res.status})`)
    }

    const data = await res.json()
    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(data.base_resp.status_msg || '合成失败')
    }

    if (data.data && data.data.audio) {
      const blob = hexToBlob(data.data.audio, 'audio/mp3')
      const blobUrl = URL.createObjectURL(blob)
      audioInstance = new Audio(blobUrl)
      audioInstance.play()
    } else {
      throw new Error('未接收到有效音频流')
    }
  } catch (err: any) {
    errorMsg.value = err.message || '未知错误'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="va-wrapper">
    <!-- 极简无界顶栏 -->
    <div class="header-minimal">
      <div class="header-titles">
        <h1 class="main-title">{{ currentView === 'platforms' ? '语音引擎' : 'MiniMax 接入' }}</h1>
        <p class="sub-title" v-if="currentView === 'platforms'">选择要接入的语音合成服务</p>
      </div>
      <button class="close-btn" @click="$emit('close')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
      </button>
      <button class="back-btn" v-if="currentView === 'minimax'" @click="currentView = 'platforms'">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
      </button>
    </div>

    <!-- 纯白胶囊悬浮轮播（平台选择） -->
    <div v-if="currentView === 'platforms'" class="carousel-container">
      <button class="nav-btn prev-btn" :class="{ hidden: activeIndex === 0 }" @click="handlePrev">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>

      <div class="capsule-track">
        <div class="capsule-wrapper" :style="{ transform: `translateX(calc(-${activeIndex * 100}% - ${activeIndex * 40}px))` }">
          
          <div v-for="(item, index) in platforms" :key="item.id" 
               class="capsule-item" 
               :class="{ active: index === activeIndex, disabled: item.disabled }"
               @click="handleSelect(item.id, item.disabled)">
            
            <div class="capsule-shape">
              <!-- 动态呼吸涟漪 (利用 transform 硬件加速) -->
              <div class="ripple-bg" v-if="index === activeIndex && !item.disabled">
                <div class="ripple r1"></div>
                <div class="ripple r2"></div>
              </div>
              
              <div class="capsule-icon">
                <svg v-if="item.id === 'minimax'" viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                <svg v-else viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
              </div>

              <div class="capsule-text">
                <h3>{{ item.name }}</h3>
                <p v-html="item.desc.replace('\n', '<br>')"></p>
              </div>

              <div class="capsule-action">
                <span>{{ item.action }}</span>
              </div>
            </div>

          </div>

        </div>
      </div>

      <button class="nav-btn next-btn" :class="{ hidden: activeIndex === platforms.length - 1 }" @click="handleNext">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>

    <!-- 无界信纸排版（配置详情） -->
    <div v-else-if="currentView === 'minimax'" class="va-detail-view">
      <div class="fluid-form">
        
        <div class="form-row preset-row" @click="showKeyPresetModal = true">
          <span class="row-label">API 密钥预设</span>
          <span class="row-action">管理 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m9 18 6-6-6-6"/></svg></span>
        </div>

        <div class="form-row">
          <span class="row-label">API 区域</span>
          <div class="pill-tabs">
            <div class="pill-tab" :class="{active: region === 'global'}" @click="region = 'global'">国际版</div>
            <div class="pill-tab" :class="{active: region === 'china'}" @click="region = 'china'">国内版</div>
          </div>
        </div>

        <div class="form-row column-row">
          <div class="row-header">
            <span class="row-label">接口密钥</span>
            <button class="text-btn" @click="checkBalance" :disabled="isCheckingBalance">
              {{ isCheckingBalance ? '查询中...' : '查询余额' }}
            </button>
          </div>
          <input type="password" v-model="apiKey" placeholder="在此输入您的 API Key" class="fluid-input" />
          
          <div class="msg-box">
            <div v-if="hasTokenPlan === true && balanceMsg" class="success-msg">
              <span>{{ balanceMsg }}</span>
              <span @click="openBalancePage" class="link-text">去充值</span>
            </div>
            <div v-else-if="hasTokenPlan === false" class="error-msg column-msg">
              <div>暂无有效套餐 <span class="sub-text">(No active token plan)</span></div>
              <button class="ghost-btn" @click="openBalancePage">前往官网查看按量计费余额</button>
            </div>
            <div v-else-if="balanceMsg" class="error-msg">{{ balanceMsg }}</div>
          </div>
        </div>

        <div class="form-section-title">合成测试</div>
        
        <div class="form-row">
          <span class="row-label">合成模型</span>
          <select v-model="testModel" class="fluid-select">
            <option v-for="opt in testModelOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </div>

        <div class="form-row">
          <span class="row-label">合成音色</span>
          <select v-model="testVoiceId" class="fluid-select">
            <option v-for="opt in testVoiceOptions" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
          </select>
        </div>

        <div class="form-row column-row">
          <textarea v-model="testText" rows="3" placeholder="输入要合成的文本..." class="fluid-textarea"></textarea>
          <div v-if="errorMsg" class="error-banner">{{ errorMsg }}</div>
          <button class="fluid-action-btn" :disabled="isLoading" @click="playTest">
            <span v-if="isLoading" class="spinner"></span>
            {{ isLoading ? '正在合成...' : '合成并播放' }}
          </button>
        </div>
      </div>
    </div>

    <!-- API Preset Modal (匹配极简风格) -->
    <div v-if="showKeyPresetModal" class="modal-overlay" @click.self="showKeyPresetModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>API 密钥预设</h3>
          <button class="modal-close" @click="showKeyPresetModal = false">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div class="preset-add">
          <input type="text" v-model="newPresetName" placeholder="为当前密钥命名并保存" class="fluid-input" />
          <button class="add-btn" @click="savePreset">保存</button>
        </div>
        
        <div class="preset-list" v-if="keyPresets.length > 0">
          <div v-for="preset in keyPresets" :key="preset.id" class="preset-item">
            <div class="preset-info" @click="applyPreset(preset)">
              <div class="preset-name">{{ preset.name }}</div>
              <div class="preset-region">{{ preset.region === 'global' ? '国际版' : '国内版' }}</div>
            </div>
            <button class="del-btn" @click="deletePreset(preset.id)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
        <div v-else class="empty-hint">暂无保存的预设</div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Container & Resets */
.va-wrapper {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: #ffffff;
  color: #111111;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 100;
}

/* Header */
.header-minimal {
  position: relative;
  padding: calc(env(safe-area-inset-top) + 24px) 24px 20px;
  text-align: center;
  flex-shrink: 0;
}
.header-titles {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.main-title {
  margin: 0; font-size: 18px; font-weight: 600; color: #000; letter-spacing: 0.5px;
}
.sub-title {
  margin: 0; font-size: 13px; color: #888; font-weight: 400;
}
.close-btn {
  position: absolute; top: calc(env(safe-area-inset-top) + 20px); right: 20px;
  background: none; border: none; color: #000; cursor: pointer; padding: 6px;
  border-radius: 50%; transition: background 0.2s;
}
.close-btn:active { background: rgba(0,0,0,0.05); }

.back-btn {
  position: absolute; top: calc(env(safe-area-inset-top) + 20px); left: 20px;
  background: none; border: none; color: #000; cursor: pointer; padding: 6px;
  border-radius: 50%; transition: background 0.2s;
}
.back-btn:active { background: rgba(0,0,0,0.05); }

/* Carousel */
.carousel-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
.nav-btn {
  position: absolute; top: 50%; transform: translateY(-50%);
  width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: #bbbbbb; cursor: pointer; z-index: 10;
  transition: opacity 0.3s, color 0.3s;
}
.nav-btn:active { color: #000; }
.prev-btn { left: 16px; }
.next-btn { right: 16px; }
.nav-btn.hidden { opacity: 0; pointer-events: none; }

.capsule-track {
  width: 250px; 
  height: 460px;
  position: relative;
}
.capsule-wrapper {
  display: flex;
  gap: 40px; 
  height: 100%;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}
.capsule-item {
  width: 250px;
  flex-shrink: 0;
  height: 100%;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s;
  will-change: transform, opacity;
  transform: scale(0.85);
  opacity: 0.3;
  display: flex;
  align-items: center;
  justify-content: center;
}
.capsule-item.active {
  transform: scale(1);
  opacity: 1;
}

/* The fluid pill/capsule shape */
.capsule-shape {
  width: 100%;
  height: 100%;
  border-radius: 125px; /* Fully rounded top and bottom */
  background: #ffffff;
  box-shadow: 0 20px 60px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.03);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 48px 24px 36px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  box-sizing: border-box;
}

.capsule-item.disabled .capsule-shape {
  background: #fbfbfb;
}

/* Hardware Accelerated Ripple */
.ripple-bg {
  position: absolute;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  width: 64px; height: 64px;
  z-index: 0;
  pointer-events: none;
}
.ripple {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.04);
  animation: rippleAnim 3.5s infinite cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
}
.ripple.r2 {
  animation-delay: 1.75s;
}
@keyframes rippleAnim {
  0% { transform: scale(0.6); opacity: 1; }
  100% { transform: scale(3.5); opacity: 0; }
}

.capsule-icon {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 12px 28px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(0,0,0,0.03);
  display: flex; align-items: center; justify-content: center;
  color: #111;
  z-index: 1;
  margin-top: 8px;
}
.capsule-item.disabled .capsule-icon {
  color: #ccc; box-shadow: none; background: transparent;
}

.capsule-text {
  text-align: center;
  z-index: 1;
  margin-top: 24px;
}
.capsule-text h3 {
  margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #111;
}
.capsule-text p {
  margin: 0; font-size: 13px; color: #888; line-height: 1.6;
}

.capsule-action {
  z-index: 1;
  font-size: 14px;
  font-weight: 600;
  color: #000;
  padding: 14px 28px;
  border-radius: 100px;
  background: rgba(0,0,0,0.04);
  transition: background 0.2s;
}
.capsule-item.disabled .capsule-action {
  color: #aaa; background: transparent;
}
.capsule-item.active .capsule-action:active {
  background: rgba(0,0,0,0.08);
}

/* Detail Form: Borderless layout */
.va-detail-view {
  flex: 1;
  overflow-y: auto;
  padding: 10px 24px 60px;
  -webkit-overflow-scrolling: touch;
}
.fluid-form {
  max-width: 400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 36px;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.column-row {
  flex-direction: column;
  align-items: stretch;
  gap: 16px;
}
.preset-row {
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(0,0,0,0.04);
  cursor: pointer;
}
.row-label {
  font-size: 15px; color: #111; font-weight: 600;
}
.row-action {
  font-size: 13px; color: #666; display: flex; align-items: center; gap: 2px;
}

.pill-tabs {
  display: flex; background: rgba(0,0,0,0.04); border-radius: 100px; padding: 4px;
}
.pill-tab {
  padding: 6px 16px; font-size: 13px; border-radius: 100px; color: #777; cursor: pointer; transition: all 0.2s; font-weight: 500;
}
.pill-tab.active {
  background: #fff; color: #000; box-shadow: 0 4px 12px rgba(0,0,0,0.08); 
}

.row-header {
  display: flex; justify-content: space-between; align-items: center;
}
.text-btn {
  background: none; border: none; font-size: 12px; color: #666; cursor: pointer; padding: 0; text-decoration: underline; text-underline-offset: 2px;
}

.fluid-input, .fluid-select, .fluid-textarea {
  width: 100%; border: none; background: rgba(0,0,0,0.03); border-radius: 16px;
  padding: 18px 20px; font-size: 15px; color: #000; outline: none; transition: background 0.2s;
  box-sizing: border-box;
}
.fluid-input:focus, .fluid-select:focus, .fluid-textarea:focus {
  background: rgba(0,0,0,0.06);
}
.fluid-select {
  width: auto; padding: 10px 16px; text-align: right; direction: rtl; appearance: none; font-weight: 500;
}
.fluid-textarea {
  resize: none; line-height: 1.6;
}

.form-section-title {
  font-size: 12px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-top: 10px;
}

.fluid-action-btn {
  background: #000; color: #fff; border: none; border-radius: 100px; padding: 18px;
  font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: transform 0.2s;
}
.fluid-action-btn:active { transform: scale(0.98); }
.fluid-action-btn:disabled { background: rgba(0,0,0,0.1); color: #aaa; transform: none; cursor: not-allowed; }

.msg-box { font-size: 12px; line-height: 1.5; margin-top: -4px; padding: 0 4px; }
.success-msg { color: #388e3c; display: flex; justify-content: space-between; align-items: center; }
.error-msg { color: #d32f2f; }
.column-msg { display: flex; flex-direction: column; gap: 10px; }
.link-text { color: #000; text-decoration: underline; cursor: pointer; font-weight: 500; }
.sub-text { opacity: 0.6; font-size: 11px; }

.ghost-btn {
  align-self: flex-start; padding: 8px 14px; background: transparent; color: #000;
  border: 1px solid rgba(0,0,0,0.1); border-radius: 100px; font-size: 12px; font-weight: 600; cursor: pointer;
}
.ghost-btn:active { background: rgba(0,0,0,0.03); }

.error-banner { background: #fff0f0; color: #d32f2f; padding: 12px 16px; border-radius: 12px; font-size: 13px; text-align: center; }

.spinner {
  width: 16px; height: 16px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Preset Modal */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.7); backdrop-filter: blur(8px);
  z-index: 200; display: flex; flex-direction: column; justify-content: flex-end; animation: fadeIn 0.3s;
}
.modal-content {
  background: #fff; width: 100%; border-radius: 36px 36px 0 0; padding: 32px 24px 60px;
  box-shadow: 0 -20px 80px rgba(0,0,0,0.06); animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;
}
.modal-header h3 { margin: 0; font-size: 18px; font-weight: 600; color: #000; }
.modal-close { background: rgba(0,0,0,0.04); border: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #000; cursor: pointer;}
.modal-close:active { background: rgba(0,0,0,0.08); }

.preset-add { display: flex; gap: 12px; margin-bottom: 32px; }
.preset-add .fluid-input { flex: 1; padding: 16px 20px; }
.add-btn { background: #000; color: #fff; border: none; border-radius: 16px; padding: 0 24px; font-weight: 600; cursor: pointer; }
.add-btn:active { transform: scale(0.96); }

.preset-list { display: flex; flex-direction: column; gap: 12px; }
.preset-item {
  display: flex; justify-content: space-between; align-items: center; padding: 16px 20px;
  background: rgba(0,0,0,0.02); border-radius: 16px; transition: background 0.2s;
}
.preset-item:active { background: rgba(0,0,0,0.05); }
.preset-info { flex: 1; cursor: pointer; }
.preset-name { font-size: 15px; font-weight: 600; color: #000; margin-bottom: 4px; }
.preset-region { font-size: 12px; color: #888; }
.del-btn { background: rgba(255,59,48,0.08); border: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #ff3b30; cursor: pointer; transition: transform 0.2s; }
.del-btn:active { transform: scale(0.9); background: rgba(255,59,48,0.15); }
.empty-hint { text-align: center; color: #bbb; font-size: 14px; padding: 40px 0; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
</style>
