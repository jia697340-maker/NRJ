/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

defineEmits(['close'])

const currentView = ref<'platforms' | 'minimax'>('platforms')

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
      // 有时候即使没有 token plan，也会返回特定的 status_code，这里做个兜底判断
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
      // 无套餐 (按量计费)
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

  // 这里测试使用固定预设和参数，因为角色配置已经移动到 ChatSettingsView
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
    <!-- Platform Selection View -->
    <div v-if="currentView === 'platforms'" class="va-page">
      <div class="va-header">
        <div class="va-header-left"></div>
        <h2 class="va-title">语音引擎</h2>
        <div class="va-header-right">
          <button class="va-icon-btn" @click="$emit('close')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
      
      <div class="va-content">
        <p class="va-subtitle">选择要接入的语音合成服务</p>
        
        <div class="platform-list">
          <div class="platform-card active" @click="currentView = 'minimax'">
            <div class="platform-icon minimax-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
            </div>
            <div class="platform-info">
              <h3>MiniMax 语音</h3>
              <p>高保真、超低时延的语音合成服务</p>
            </div>
            <div class="platform-arrow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </div>
          
          <div class="platform-card disabled">
            <div class="platform-icon default-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            </div>
            <div class="platform-info">
              <h3>更多平台</h3>
              <p>敬请期待更多优秀语音引擎接入</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MiniMax Configuration View -->
    <div v-else-if="currentView === 'minimax'" class="va-page">
      <div class="va-header">
        <div class="va-header-left">
          <button class="va-icon-btn" @click="currentView = 'platforms'">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        </div>
        <h2 class="va-title">MiniMax 语音接入</h2>
        <div class="va-header-right">
          <button class="va-icon-btn" @click="$emit('close')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <div class="va-content">
        <!-- 密钥预设管理 -->
        <div class="settings-block preset-block" @click="showKeyPresetModal = true">
          <div class="preset-info">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span>API 密钥预设管理</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0b0b5" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
        </div>

        <!-- API 鉴权配置 -->
        <div class="settings-block">
          <div class="settings-title">基础鉴权</div>
          <div class="settings-group">
            <div class="setting-item">
              <span class="setting-label">API 区域</span>
              <div class="segmented-control">
                <button :class="['segment-btn', { active: region === 'global' }]" @click="region = 'global'">国际版</button>
                <button :class="['segment-btn', { active: region === 'china' }]" @click="region = 'china'">国内版</button>
              </div>
            </div>
            <div class="setting-item vertical-item">
              <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span class="setting-label">接口密钥</span>
                <button class="text-btn" @click="checkBalance" :disabled="isCheckingBalance">
                  {{ isCheckingBalance ? '查询中...' : '查询余额' }}
                </button>
              </div>
              <input type="password" v-model="apiKey" placeholder="在此输入您的 API Key" class="elegant-input" />
              
              <!-- 有套餐 -->
              <div v-if="hasTokenPlan === true && balanceMsg" style="font-size: 13px; color: #388e3c; margin-top: 4px; display: flex; align-items: center; justify-content: space-between;">
                <span>{{ balanceMsg }}</span>
                <span @click="openBalancePage" style="color: #1976d2; cursor: pointer; text-decoration: underline;">去充值</span>
              </div>
              
              <!-- 无套餐 -->
              <div v-else-if="hasTokenPlan === false" style="font-size: 13px; color: #d32f2f; margin-top: 4px; display: flex; flex-direction: column; gap: 8px;">
                <div>暂无有效套餐 <span style="opacity: 0.8; font-size: 11px;">(No active token plan subscription)</span></div>
                <button class="action-btn small-action-btn" @click="openBalancePage" style="width: auto; align-self: flex-start; margin-top: 0; padding: 6px 12px; background: rgba(0,0,0,0.05); color: #333; border: 1px solid #ddd;">
                  前往官网查看按量计费余额
                </button>
              </div>
              
              <!-- 错误信息 -->
              <div v-else-if="balanceMsg" style="font-size: 13px; color: #d32f2f; margin-top: 4px;">{{ balanceMsg }}</div>
            </div>
          </div>
        </div>

        <div style="font-size: 12px; color: #888; margin-bottom: 24px; padding: 0 4px; line-height: 1.5;">
          注：每个角色的专属语音参数（音色、模型、语速等）请前往该角色的「聊天设置 -> 角色」中进行配置。此处仅作为全局服务鉴权与引擎网络连通性测试。
        </div>

        <!-- 合成测试 -->
        <div class="settings-block">
          <div class="settings-title">合成测试</div>
          <div class="settings-group test-group">
            <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 14px; color: #333333; font-weight: 500;">合成模型</span>
              <select v-model="testModel" class="elegant-select" style="max-width: 60%; background: #f4f5f7; padding: 6px 12px; border-radius: 8px; direction: ltr; text-align: left;">
                <option v-for="opt in testModelOptions" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
            <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 14px; color: #333333; font-weight: 500;">合成音色</span>
              <select v-model="testVoiceId" class="elegant-select" style="max-width: 60%; background: #f4f5f7; padding: 6px 12px; border-radius: 8px; direction: ltr; text-align: left;">
                <option v-for="opt in testVoiceOptions" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
              </select>
            </div>
            <textarea v-model="testText" rows="3" placeholder="输入要合成的文本..." class="elegant-textarea"></textarea>
            <div v-if="errorMsg" class="error-banner">{{ errorMsg }}</div>
            <button class="action-btn" :disabled="isLoading" @click="playTest">
              <span v-if="isLoading" class="spinner"></span>
              {{ isLoading ? '正在合成...' : '合成并播放' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <!-- 密钥预设弹窗 -->
    <div v-if="showKeyPresetModal" class="va-modal-overlay" @click.self="showKeyPresetModal = false">
      <div class="va-modal-box preset-modal-box">
        <div class="va-modal-header">
          <h3>API 密钥预设</h3>
          <button class="va-icon-btn close-bg" @click="showKeyPresetModal = false">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="va-modal-body">
          <div class="preset-create-area">
            <input type="text" v-model="newPresetName" placeholder="为当前密钥命名并保存" class="elegant-input preset-input" />
            <button class="action-btn small-action-btn" @click="savePreset">保存预设</button>
          </div>
          
          <div class="preset-list" v-if="keyPresets.length > 0">
            <div v-for="preset in keyPresets" :key="preset.id" class="preset-item">
              <div class="preset-info-box" @click="applyPreset(preset)">
                <div class="preset-name">{{ preset.name }}</div>
                <div class="preset-region">{{ preset.region === 'global' ? '国际版' : '国内版' }}</div>
              </div>
              <button class="delete-btn" @click="deletePreset(preset.id)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
          <div v-else class="empty-hint">暂无保存的预设</div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* 全局基础重置与灰白灰高雅风格 */
.va-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #f4f5f7;
  color: #333333;
  z-index: 100;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
  overflow: hidden;
}

.va-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.va-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: calc(env(safe-area-inset-top) + 16px) 20px 16px;
  background-color: #f4f5f7;
  z-index: 10;
}

.va-title {
  font-size: 18px;
  font-weight: 600;
  color: #222222;
  margin: 0;
  letter-spacing: 0.5px;
}

.va-header-left, .va-header-right {
  width: 40px;
  display: flex;
  align-items: center;
}

.va-header-right {
  justify-content: flex-end;
}

.va-icon-btn {
  background: none;
  border: none;
  color: #555555;
  padding: 8px;
  margin: -8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.va-icon-btn:active {
  background-color: #e4e5e9;
}

.va-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px 20px 40px;
}

/* 平台选择页样式 */
.va-subtitle {
  font-size: 14px;
  color: #888888;
  margin-bottom: 24px;
  text-align: center;
}

.platform-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.platform-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
  transition: transform 0.2s, box-shadow 0.2s;
}

.platform-card.active {
  cursor: pointer;
}

.platform-card.active:active {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.platform-card.disabled {
  opacity: 0.6;
}

.platform-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
}

.minimax-icon {
  background: #f0f2f5;
  color: #333333;
}

.default-icon {
  background: #f5f5f5;
  color: #999999;
}

.platform-info {
  flex: 1;
}

.platform-info h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #222222;
}

.platform-info p {
  margin: 0;
  font-size: 13px;
  color: #888888;
}

.platform-arrow {
  color: #cccccc;
}

/* 详情配置页样式 */
.settings-block {
  margin-bottom: 24px;
}

.preset-block {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
  cursor: pointer;
  margin-bottom: 24px;
}

.preset-block:active {
  background: #fafafa;
}

.preset-info {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #333333;
  font-weight: 500;
  font-size: 15px;
}

.settings-title {
  font-size: 13px;
  font-weight: 500;
  color: #888888;
  margin-bottom: 10px;
  padding-left: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.title-with-help {
  display: flex;
  align-items: center;
  gap: 6px;
}

.help-btn {
  background: none;
  border: none;
  color: #999999;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: color 0.2s, background-color 0.2s;
  margin-top: -1px;
}

.help-btn:active {
  background-color: #e4e5e9;
  color: #555555;
}

.settings-group {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f4f5f7;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item.vertical-item {
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.setting-item.click-item {
  cursor: pointer;
}

.setting-item.click-item:active {
  background-color: #fafafa;
}

.setting-label {
  font-size: 15px;
  color: #333333;
  font-weight: 500;
}

.value-with-arrow {
  display: flex;
  align-items: center;
  gap: 8px;
}

.value-text {
  font-size: 15px;
  color: #666666;
}

/* 自定义控件美化 */
.segmented-control {
  display: flex;
  background: #f4f5f7;
  border-radius: 8px;
  padding: 3px;
  width: 140px;
}

.segment-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 6px 0;
  font-size: 13px;
  font-weight: 500;
  color: #888888;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.segment-btn.active {
  background: #ffffff;
  color: #333333;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}

.elegant-input {
  width: 100%;
  border: 1px solid #e4e5e9;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 15px;
  color: #333333;
  background-color: #fafafa;
  outline: none;
  transition: border-color 0.2s, background-color 0.2s;
  box-sizing: border-box;
}

.elegant-input:focus {
  border-color: #cccccc;
  background-color: #ffffff;
}

.elegant-input::placeholder {
  color: #bbbbbb;
}

.elegant-select {
  border: none;
  background: transparent;
  color: #666666;
  font-size: 15px;
  outline: none;
  text-align: right;
  direction: rtl;
}
.elegant-select option {
  direction: ltr;
}

.label-with-action, .label-with-value {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-btn {
  background: none;
  border: none;
  color: #555555;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.param-value {
  font-size: 14px;
  color: #666666;
  font-weight: 500;
}

.elegant-slider {
  width: 100%;
  appearance: none;
  height: 4px;
  background: #e4e5e9;
  border-radius: 2px;
  outline: none;
}

.elegant-slider::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  cursor: pointer;
}

.test-group {
  padding: 20px;
  background: #ffffff;
}

.elegant-textarea {
  width: 100%;
  border: 1px solid #e4e5e9;
  border-radius: 12px;
  padding: 14px;
  font-size: 15px;
  color: #333333;
  background-color: #fafafa;
  resize: none;
  outline: none;
  box-sizing: border-box;
  line-height: 1.5;
  transition: border-color 0.2s;
}

.elegant-textarea:focus {
  border-color: #cccccc;
  background-color: #ffffff;
}

.action-btn {
  width: 100%;
  background-color: #333333;
  color: #ffffff;
  border: none;
  padding: 14px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  margin-top: 16px;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  transition: background-color 0.2s;
}

.action-btn:active {
  background-color: #222222;
}

.action-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.small-action-btn {
  padding: 10px;
  font-size: 14px;
  margin-top: 0;
  border-radius: 8px;
  white-space: nowrap;
}

.error-banner {
  background-color: #fff0f0;
  color: #d32f2f;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  margin-top: 16px;
  text-align: center;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #ffffff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 弹窗统一样式 */
.va-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(2px);
  z-index: 200;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  animation: fadeIn 0.25s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; backdrop-filter: blur(0px); }
  to { opacity: 1; backdrop-filter: blur(2px); }
}

.va-modal-box {
  background: #f4f5f7;
  width: 100%;
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
}

.preset-modal-box {
  max-height: 70%;
}

.model-box {
  max-height: 60%;
}

.voice-box {
  height: 85%;
}

.help-modal-box {
  max-height: 80%;
}

.help-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-top: 8px;
}

.help-item h4 {
  margin: 0 0 8px 0;
  font-size: 15px;
  font-weight: 600;
  color: #222222;
}

.help-item p {
  margin: 0;
  font-size: 14px;
  color: #666666;
  line-height: 1.6;
}

.help-item p strong {
  color: #333333;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.va-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: #f4f5f7;
  border-radius: 24px 24px 0 0;
}

.va-modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #222222;
}

.close-bg {
  background: #e4e5e9;
  width: 32px;
  height: 32px;
  margin: 0;
}

.va-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px 40px;
}

/* 预设列表样式 */
.preset-create-area {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  align-items: stretch;
}

.preset-input {
  flex: 4; /* 约 80% */
}

.small-action-btn {
  flex: 1; /* 约 20% */
  padding: 10px 0;
  font-size: 14px;
  margin-top: 0;
  border-radius: 8px;
  white-space: nowrap;
  display: flex;
  justify-content: center;
  align-items: center;
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preset-item {
  background: #ffffff;
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}

.preset-info-box {
  flex: 1;
  cursor: pointer;
}

.preset-name {
  font-size: 15px;
  font-weight: 600;
  color: #333333;
  margin-bottom: 4px;
}

.preset-region {
  font-size: 12px;
  color: #999999;
}

.delete-btn {
  background: none;
  border: none;
  color: #ff3b30;
  padding: 8px;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:active {
  background: #fff0f0;
}

.empty-hint {
  text-align: center;
  color: #999999;
  font-size: 14px;
  padding: 32px 0;
}

/* 模型选择列表 */
.option-list {
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
}

.option-item {
  padding: 16px 20px;
  font-size: 15px;
  color: #333333;
  border-bottom: 1px solid #f4f5f7;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.option-item:last-child {
  border-bottom: none;
}

.option-item:active {
  background-color: #fafafa;
}

.option-item.active {
  font-weight: 600;
  color: #222222;
}

/* 音色选择网格 */
.sync-btn {
  width: 100%;
  background: #ffffff;
  border: 1px solid #e4e5e9;
  color: #333333;
  padding: 14px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}

.sync-btn:active {
  background: #fafafa;
}

.sync-btn:disabled {
  opacity: 0.6;
}

.voice-category {
  margin-bottom: 28px;
}

.category-title {
  font-size: 14px;
  color: #888888;
  font-weight: 500;
  margin-bottom: 12px;
  padding-left: 4px;
}

.voice-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.voice-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
  transition: transform 0.2s;
}

.voice-card:active {
  transform: scale(0.96);
  background: #fafafa;
}

.v-name {
  font-size: 15px;
  color: #222222;
  font-weight: 600;
  margin-bottom: 6px;
}

.v-id {
  font-size: 12px;
  color: #999999;
  word-break: break-all;
}
</style>
