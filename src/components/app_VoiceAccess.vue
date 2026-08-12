/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { useVoiceAccess } from '../composables/useVoiceAccess'

defineEmits(['close'])

const {
  currentView,
  activeIndex,
  platforms,
  handlePrev,
  handleNext,
  handleSelect,
  viewTitle,
  seedTransport,
  seedCustomProtocol,
  seedApiKey,
  seedBaseUrl,
  seedModel,
  seedTestText,
  seedTestMode,
  seedTestFormat,
  seedIsLoading,
  seedErrorMsg,
  selectSeedTransport,
  geminiTransport,
  geminiProtocol,
  geminiAuthMode,
  geminiApiKey,
  geminiBaseUrl,
  geminiModel,
  geminiTestVoice,
  geminiTestStyle,
  geminiTestText,
  geminiIsLoading,
  geminiErrorMsg,
  selectGeminiTransport,
  elevenLabsTransport,
  elevenLabsProtocol,
  elevenLabsApiKey,
  elevenLabsBaseUrl,
  elevenLabsModel,
  elevenLabsOutputFormat,
  elevenLabsTestVoiceId,
  elevenLabsTestText,
  elevenLabsIsLoading,
  elevenLabsErrorMsg,
  selectElevenLabsTransport,
  microsoftMaiTransport,
  microsoftMaiProtocol,
  microsoftMaiApiKey,
  microsoftMaiRegion,
  microsoftMaiBaseUrl,
  microsoftMaiModel,
  microsoftMaiTestVoice,
  microsoftMaiTestStyle,
  microsoftMaiTestStyleDegree,
  microsoftMaiTestText,
  microsoftMaiIsLoading,
  microsoftMaiErrorMsg,
  selectMicrosoftMaiTransport,
  aliyunTransport,
  aliyunProtocol,
  aliyunRegion,
  aliyunApiKey,
  aliyunBaseUrl,
  aliyunModel,
  aliyunTestVoice,
  aliyunTestLanguage,
  aliyunTestInstructions,
  aliyunOptimizeInstructions,
  aliyunTestText,
  aliyunIsLoading,
  aliyunErrorMsg,
  selectAliyunTransport,
  selectAliyunRegion,
  region,
  apiKey,
  testText,
  testModel,
  testVoiceId,
  isLoading,
  testVoiceOptions,
  errorMsg,
  isCheckingBalance,
  balanceMsg,
  hasTokenPlan,
  showKeyPresetModal,
  testModelOptions,
  keyPresets,
  newPresetName,
  audioInstance,
  testVoiceStore,
  testVoiceMetaStore,
  pendingTests,
  MAX_TEST_CACHE_ITEMS,
  hash,
  hexToBlob,
  getBaseUrl,
  trimTestCache,
  savePreset,
  applyPreset,
  deletePreset,
  checkBalance,
  openBalancePage,
  playTest,
  playSeedTest,
  playGeminiTest,
  playElevenLabsTest,
  playMicrosoftMaiTest,
  playAliyunTest,
} = useVoiceAccess()
</script>

<template>
  <div class="va-wrapper">
    <!-- 极简无界顶栏 -->
    <div class="header-minimal">
      <div class="header-titles">
        <h1 class="main-title">{{ viewTitle() }}</h1>
        <p class="sub-title" v-if="currentView === 'platforms'">选择要接入的语音合成服务</p>
      </div>
      <button class="close-btn" @click="$emit('close')">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
      </button>
      <button class="back-btn" v-if="currentView !== 'platforms'" @click="currentView = 'platforms'">
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
                <svg v-else-if="item.id === 'seed_audio'" viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M4 13v-2"></path><path d="M8 17V7"></path><path d="M12 20V4"></path><path d="M16 17V7"></path><path d="M20 13v-2"></path></svg>
                <svg v-else-if="item.id === 'gemini'" viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M12 2c.8 5.4 4.6 9.2 10 10-5.4.8-9.2 4.6-10 10-.8-5.4-4.6-9.2-10-10 5.4-.8 9.2-4.6 10-10Z"></path></svg>
                <svg v-else-if="item.id === 'elevenlabs'" viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M6 5v14"></path><path d="M10 5v14"></path><path d="M14 8v8"></path><path d="M18 5v14"></path></svg>
                <svg v-else-if="item.id === 'microsoft_mai'" viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M4 12h2"></path><path d="M8 8v8"></path><path d="M12 4v16"></path><path d="M16 7v10"></path><path d="M20 10v4"></path></svg>
                <svg v-else-if="item.id === 'aliyun_tts'" viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.2" fill="none"><path d="M4 13v-2"></path><path d="M8 16V8"></path><path d="M12 19V5"></path><path d="M16 16V8"></path><path d="M20 13v-2"></path><path d="M6 4h12"></path></svg>
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

    <div v-else-if="currentView === 'seed_audio'" class="va-detail-view">
      <div class="fluid-form">
        <div class="form-row column-row seed-provider-row">
          <div class="row-header"><span class="row-label">接入渠道</span></div>
          <div class="pill-tabs wide-tabs">
            <div class="pill-tab" :class="{ active: seedTransport === 'byteplus' }" @click="selectSeedTransport('byteplus')">BytePlus 官方</div>
            <div class="pill-tab" :class="{ active: seedTransport === 'fal' }" @click="selectSeedTransport('fal')">fal 第三方</div>
            <div class="pill-tab" :class="{ active: seedTransport === 'custom' }" @click="selectSeedTransport('custom')">自定义中转</div>
          </div>
          <div class="provider-hint">{{ seedTransport === 'byteplus' ? '使用 BytePlus Seed Speech 官方同步接口。' : seedTransport === 'fal' ? '使用 fal 异步队列接口，适合快速接入。' : '填写兼容 BytePlus 或 fal 协议的中转地址。' }}</div>
        </div>

        <div v-if="seedTransport === 'custom'" class="form-row">
          <span class="row-label">中转协议</span>
          <div class="pill-tabs">
            <div class="pill-tab" :class="{ active: seedCustomProtocol === 'byteplus' }" @click="seedCustomProtocol = 'byteplus'">BytePlus</div>
            <div class="pill-tab" :class="{ active: seedCustomProtocol === 'fal' }" @click="seedCustomProtocol = 'fal'">fal</div>
          </div>
        </div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">接口密钥</span></div>
          <input type="password" v-model="seedApiKey" placeholder="在此输入独立的 Seed Audio API Key" class="fluid-input" autocomplete="off" />
        </div>

        <div v-if="seedTransport === 'custom'" class="form-row column-row">
          <div class="row-header"><span class="row-label">中转地址</span></div>
          <input type="url" v-model="seedBaseUrl" placeholder="https://your-proxy.example.com" class="fluid-input" />
        </div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">模型名称</span></div>
          <input type="text" v-model="seedModel" placeholder="seed-audio-1.0" class="fluid-input" />
        </div>

        <div class="form-section-title">合成测试</div>

        <div class="form-row">
          <span class="row-label">生成模式</span>
          <div class="pill-tabs">
            <div class="pill-tab" :class="{ active: seedTestMode === 'speech' }" @click="seedTestMode = 'speech'">干净人声</div>
            <div class="pill-tab" :class="{ active: seedTestMode === 'scene' }" @click="seedTestMode = 'scene'">场景音频</div>
          </div>
        </div>

        <div class="form-row">
          <span class="row-label">音频格式</span>
          <div class="pill-tabs">
            <div class="pill-tab" :class="{ active: seedTestFormat === 'mp3' }" @click="seedTestFormat = 'mp3'">MP3</div>
            <div class="pill-tab" :class="{ active: seedTestFormat === 'wav' }" @click="seedTestFormat = 'wav'">WAV</div>
          </div>
        </div>

        <div class="form-row column-row">
          <textarea v-model="seedTestText" rows="4" maxlength="2048" placeholder="输入要合成的文本或音频场景描述..." class="fluid-textarea"></textarea>
          <div class="text-counter">{{ seedTestText.length }} / 2048</div>
          <div v-if="seedErrorMsg" class="error-banner">{{ seedErrorMsg }}</div>
          <button class="fluid-action-btn" :disabled="seedIsLoading" @click="playSeedTest">
            <span v-if="seedIsLoading" class="spinner"></span>
            {{ seedIsLoading ? '正在合成...' : '合成并播放' }}
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="currentView === 'gemini'" class="va-detail-view">
      <div class="fluid-form">
        <div class="form-row column-row seed-provider-row">
          <div class="row-header"><span class="row-label">接入渠道</span></div>
          <div class="pill-tabs wide-tabs">
            <div class="pill-tab" :class="{ active: geminiTransport === 'official' }" @click="selectGeminiTransport('official')">Google 官方</div>
            <div class="pill-tab" :class="{ active: geminiTransport === 'custom' }" @click="selectGeminiTransport('custom')">第三方中转</div>
          </div>
          <div class="provider-hint">{{ geminiTransport === 'official' ? '使用 Google Gemini 官方 Interactions API。' : '填写兼容 Gemini 原生协议的中转地址与鉴权方式。' }}</div>
        </div>

        <div v-if="geminiTransport === 'custom'" class="form-row">
          <span class="row-label">中转协议</span>
          <div class="pill-tabs">
            <div class="pill-tab" :class="{ active: geminiProtocol === 'interactions' }" @click="geminiProtocol = 'interactions'">Interactions</div>
            <div class="pill-tab" :class="{ active: geminiProtocol === 'generate_content' }" @click="geminiProtocol = 'generate_content'">GenerateContent</div>
          </div>
        </div>

        <div v-if="geminiTransport === 'custom'" class="form-row">
          <span class="row-label">鉴权方式</span>
          <div class="pill-tabs">
            <div class="pill-tab" :class="{ active: geminiAuthMode === 'x_goog_api_key' }" @click="geminiAuthMode = 'x_goog_api_key'">x-goog-api-key</div>
            <div class="pill-tab" :class="{ active: geminiAuthMode === 'bearer' }" @click="geminiAuthMode = 'bearer'">Bearer</div>
          </div>
        </div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">接口密钥</span></div>
          <input type="password" v-model="geminiApiKey" placeholder="在此输入独立的 Gemini TTS API Key" class="fluid-input" autocomplete="off" />
        </div>

        <div v-if="geminiTransport === 'custom'" class="form-row column-row">
          <div class="row-header"><span class="row-label">中转地址</span></div>
          <input type="url" v-model="geminiBaseUrl" placeholder="https://your-proxy.example.com" class="fluid-input" />
        </div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">模型名称</span></div>
          <input type="text" v-model="geminiModel" placeholder="gemini-3.1-flash-tts-preview" class="fluid-input" />
        </div>

        <div class="form-section-title">合成测试</div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">预置音色</span></div>
          <input type="text" v-model="geminiTestVoice" placeholder="Kore" class="fluid-input" />
          <div class="provider-hint">可填写 Kore、Puck、Charon、Aoede 等 Gemini 预置音色名称。</div>
        </div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">角色声音指令</span></div>
          <textarea v-model="geminiTestStyle" rows="3" maxlength="500" placeholder="描述语气、节奏、口音与情绪..." class="fluid-textarea"></textarea>
        </div>

        <div class="form-row column-row">
          <textarea v-model="geminiTestText" rows="4" maxlength="2048" placeholder="输入要合成的文本..." class="fluid-textarea"></textarea>
          <div class="text-counter">{{ geminiTestText.length }} / 2048</div>
          <div v-if="geminiErrorMsg" class="error-banner">{{ geminiErrorMsg }}</div>
          <button class="fluid-action-btn" :disabled="geminiIsLoading" @click="playGeminiTest">
            <span v-if="geminiIsLoading" class="spinner"></span>
            {{ geminiIsLoading ? '正在合成...' : '合成并播放' }}
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="currentView === 'elevenlabs'" class="va-detail-view">
      <div class="fluid-form">
        <div class="form-row column-row seed-provider-row">
          <div class="row-header"><span class="row-label">接入渠道</span></div>
          <div class="pill-tabs wide-tabs">
            <div class="pill-tab" :class="{ active: elevenLabsTransport === 'official' }" @click="selectElevenLabsTransport('official')">ElevenLabs 官方</div>
            <div class="pill-tab" :class="{ active: elevenLabsTransport === 'custom' }" @click="selectElevenLabsTransport('custom')">第三方中转</div>
          </div>
          <div class="provider-hint">{{ elevenLabsTransport === 'official' ? '使用 ElevenLabs 官方文本转语音接口。' : '填写第三方中转地址，并选择其兼容的请求协议。' }}</div>
        </div>

        <div v-if="elevenLabsTransport === 'custom'" class="form-row">
          <span class="row-label">中转协议</span>
          <div class="pill-tabs">
            <div class="pill-tab" :class="{ active: elevenLabsProtocol === 'elevenlabs' }" @click="elevenLabsProtocol = 'elevenlabs'">ElevenLabs</div>
            <div class="pill-tab" :class="{ active: elevenLabsProtocol === 'openai' }" @click="elevenLabsProtocol = 'openai'">OpenAI TTS</div>
          </div>
        </div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">接口密钥</span></div>
          <input type="password" v-model="elevenLabsApiKey" placeholder="在此输入独立的 ElevenLabs API Key" class="fluid-input" autocomplete="off" />
          <div class="provider-hint">官方密钥建议仅开放文本转语音权限，并设置使用额度。</div>
        </div>

        <div v-if="elevenLabsTransport === 'custom'" class="form-row column-row">
          <div class="row-header"><span class="row-label">中转地址</span></div>
          <input type="url" v-model="elevenLabsBaseUrl" placeholder="https://your-proxy.example.com" class="fluid-input" />
        </div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">默认模型</span></div>
          <div class="pill-tabs wide-tabs">
            <div class="pill-tab" :class="{ active: elevenLabsModel === 'eleven_multilingual_v2' }" @click="elevenLabsModel = 'eleven_multilingual_v2'">Multilingual v2</div>
            <div class="pill-tab" :class="{ active: elevenLabsModel === 'eleven_flash_v2_5' }" @click="elevenLabsModel = 'eleven_flash_v2_5'">Flash v2.5</div>
          </div>
          <input type="text" v-model="elevenLabsModel" placeholder="eleven_multilingual_v2" class="fluid-input" />
        </div>

        <div class="form-row">
          <span class="row-label">音频格式</span>
          <div class="pill-tabs">
            <div class="pill-tab" :class="{ active: elevenLabsOutputFormat === 'mp3_44100_128' }" @click="elevenLabsOutputFormat = 'mp3_44100_128'">MP3 高品质</div>
            <div class="pill-tab" :class="{ active: elevenLabsOutputFormat === 'mp3_22050_32' }" @click="elevenLabsOutputFormat = 'mp3_22050_32'">MP3 省流</div>
            <div class="pill-tab" :class="{ active: elevenLabsOutputFormat === 'wav_44100' }" @click="elevenLabsOutputFormat = 'wav_44100'">WAV</div>
          </div>
        </div>

        <div class="form-section-title">合成测试</div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">音色 ID</span></div>
          <input type="text" v-model="elevenLabsTestVoiceId" placeholder="填写 ElevenLabs Voice ID" class="fluid-input" />
          <div class="provider-hint">可在 ElevenLabs 音色库或个人音色页面复制 Voice ID。</div>
        </div>

        <div class="form-row column-row">
          <textarea v-model="elevenLabsTestText" rows="4" maxlength="2048" placeholder="输入要合成的文本..." class="fluid-textarea"></textarea>
          <div class="text-counter">{{ elevenLabsTestText.length }} / 2048</div>
          <div v-if="elevenLabsErrorMsg" class="error-banner">{{ elevenLabsErrorMsg }}</div>
          <button class="fluid-action-btn" :disabled="elevenLabsIsLoading" @click="playElevenLabsTest">
            <span v-if="elevenLabsIsLoading" class="spinner"></span>
            {{ elevenLabsIsLoading ? '正在合成...' : '合成并播放' }}
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="currentView === 'microsoft_mai'" class="va-detail-view">
      <div class="fluid-form">
        <div class="form-row column-row seed-provider-row">
          <div class="row-header"><span class="row-label">接入渠道</span></div>
          <div class="pill-tabs wide-tabs">
            <div class="pill-tab" :class="{ active: microsoftMaiTransport === 'official' }" @click="selectMicrosoftMaiTransport('official')">Microsoft 官方</div>
            <div class="pill-tab" :class="{ active: microsoftMaiTransport === 'custom' }" @click="selectMicrosoftMaiTransport('custom')">第三方中转</div>
          </div>
          <div class="provider-hint">{{ microsoftMaiTransport === 'official' ? '使用 Azure Speech 官方 SSML 接口与独立资源密钥。' : '填写中转地址，并选择 Azure Speech 或 OpenAI TTS 兼容协议。' }}</div>
        </div>

        <div v-if="microsoftMaiTransport === 'custom'" class="form-row">
          <span class="row-label">中转协议</span>
          <div class="pill-tabs">
            <div class="pill-tab" :class="{ active: microsoftMaiProtocol === 'azure' }" @click="microsoftMaiProtocol = 'azure'">Azure Speech</div>
            <div class="pill-tab" :class="{ active: microsoftMaiProtocol === 'openai' }" @click="microsoftMaiProtocol = 'openai'">OpenAI TTS</div>
          </div>
        </div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">接口密钥</span></div>
          <input type="password" v-model="microsoftMaiApiKey" placeholder="在此输入独立的 Azure Speech 或中转 API Key" class="fluid-input" autocomplete="off" />
          <div class="provider-hint">公开部署时建议使用中转服务，避免在浏览器中暴露 Azure Speech 资源密钥。</div>
        </div>

        <div v-if="microsoftMaiTransport === 'official'" class="form-row column-row">
          <div class="row-header"><span class="row-label">Azure Speech 区域</span></div>
          <input type="text" v-model="microsoftMaiRegion" placeholder="eastus" class="fluid-input" autocomplete="off" />
          <div class="provider-hint">填写 Speech 资源所在区域，例如 eastus、swedencentral 或 southeastasia。</div>
        </div>

        <div v-else class="form-row column-row">
          <div class="row-header"><span class="row-label">中转地址</span></div>
          <input type="url" v-model="microsoftMaiBaseUrl" placeholder="https://your-proxy.example.com" class="fluid-input" />
        </div>

        <div v-if="microsoftMaiTransport === 'custom' && microsoftMaiProtocol === 'openai'" class="form-row column-row">
          <div class="row-header"><span class="row-label">模型名称</span></div>
          <input type="text" v-model="microsoftMaiModel" placeholder="microsoft/mai-voice-2" class="fluid-input" />
        </div>

        <div class="form-section-title">合成测试</div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">预置音色</span></div>
          <div class="pill-tabs wide-tabs">
            <div class="pill-tab" :class="{ active: microsoftMaiTestVoice === 'zh-CN-Bo:MAI-Voice-2' }" @click="microsoftMaiTestVoice = 'zh-CN-Bo:MAI-Voice-2'">Bo 男声</div>
            <div class="pill-tab" :class="{ active: microsoftMaiTestVoice === 'zh-CN-Lan:MAI-Voice-2' }" @click="microsoftMaiTestVoice = 'zh-CN-Lan:MAI-Voice-2'">Lan 女声</div>
            <div class="pill-tab" :class="{ active: microsoftMaiTestVoice === 'zh-CN-Mei:MAI-Voice-2' }" @click="microsoftMaiTestVoice = 'zh-CN-Mei:MAI-Voice-2'">Mei 女声</div>
          </div>
          <input type="text" v-model="microsoftMaiTestVoice" placeholder="zh-CN-Mei:MAI-Voice-2" class="fluid-input" />
          <div class="provider-hint">也可填写 MAI-Voice-2-Flash 或其他已在当前 Azure 区域发布的完整音色名称。</div>
        </div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">情绪风格</span></div>
          <input type="text" v-model="microsoftMaiTestStyle" placeholder="留空使用音色默认风格" class="fluid-input" />
          <div class="provider-hint">填写该音色支持的 style；不同音色支持范围可能不同。</div>
        </div>

        <div v-if="microsoftMaiTestStyle.trim()" class="form-row">
          <span class="row-label">风格强度</span>
          <div class="pill-tabs">
            <div class="pill-tab" :class="{ active: microsoftMaiTestStyleDegree === 0.8 }" @click="microsoftMaiTestStyleDegree = 0.8">柔和</div>
            <div class="pill-tab" :class="{ active: microsoftMaiTestStyleDegree === 1 }" @click="microsoftMaiTestStyleDegree = 1">标准</div>
            <div class="pill-tab" :class="{ active: microsoftMaiTestStyleDegree === 1.2 }" @click="microsoftMaiTestStyleDegree = 1.2">鲜明</div>
          </div>
        </div>

        <div class="form-row column-row">
          <textarea v-model="microsoftMaiTestText" rows="4" maxlength="2048" placeholder="输入要合成的文本..." class="fluid-textarea"></textarea>
          <div class="text-counter">{{ microsoftMaiTestText.length }} / 2048</div>
          <div v-if="microsoftMaiErrorMsg" class="error-banner">{{ microsoftMaiErrorMsg }}</div>
          <button class="fluid-action-btn" :disabled="microsoftMaiIsLoading" @click="playMicrosoftMaiTest">
            <span v-if="microsoftMaiIsLoading" class="spinner"></span>
            {{ microsoftMaiIsLoading ? '正在合成...' : '合成并播放' }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="va-detail-view">
      <div class="fluid-form">
        <div class="form-row column-row seed-provider-row">
          <div class="row-header"><span class="row-label">接入渠道</span></div>
          <div class="pill-tabs wide-tabs">
            <div class="pill-tab" :class="{ active: aliyunTransport === 'official' }" @click="selectAliyunTransport('official')">阿里云官方</div>
            <div class="pill-tab" :class="{ active: aliyunTransport === 'custom' }" @click="selectAliyunTransport('custom')">第三方中转</div>
          </div>
          <div class="provider-hint">{{ aliyunTransport === 'official' ? '使用阿里云百炼 DashScope 原生接口；公开部署建议通过自己的服务端转发。' : '填写第三方中转地址，并选择其兼容的请求协议。' }}</div>
        </div>

        <div v-if="aliyunTransport === 'custom'" class="form-row">
          <span class="row-label">中转协议</span>
          <div class="pill-tabs">
            <div class="pill-tab" :class="{ active: aliyunProtocol === 'dashscope' }" @click="aliyunProtocol = 'dashscope'">DashScope</div>
            <div class="pill-tab" :class="{ active: aliyunProtocol === 'openai' }" @click="aliyunProtocol = 'openai'">OpenAI TTS</div>
          </div>
        </div>

        <div class="form-row">
          <span class="row-label">服务地域</span>
          <div class="pill-tabs">
            <div class="pill-tab" :class="{ active: aliyunRegion === 'china' }" @click="selectAliyunRegion('china')">北京</div>
            <div class="pill-tab" :class="{ active: aliyunRegion === 'international' }" @click="selectAliyunRegion('international')">新加坡</div>
          </div>
        </div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">接口密钥</span></div>
          <input type="password" v-model="aliyunApiKey" placeholder="在此输入独立的百炼或中转 API Key" class="fluid-input" autocomplete="off" />
          <div class="provider-hint">北京与新加坡地域的 API Key 不通用，请与所选地域保持一致。</div>
        </div>

        <div v-if="aliyunTransport === 'custom'" class="form-row column-row">
          <div class="row-header"><span class="row-label">中转地址</span></div>
          <input type="url" v-model="aliyunBaseUrl" placeholder="https://your-proxy.example.com" class="fluid-input" />
        </div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">默认模型</span></div>
          <div class="pill-tabs wide-tabs">
            <div class="pill-tab" :class="{ active: aliyunModel === 'qwen3-tts-instruct-flash' }" @click="aliyunModel = 'qwen3-tts-instruct-flash'">Instruct Flash</div>
            <div class="pill-tab" :class="{ active: aliyunModel === 'qwen3-tts-flash' }" @click="aliyunModel = 'qwen3-tts-flash'">Flash</div>
          </div>
          <input type="text" v-model="aliyunModel" placeholder="qwen3-tts-instruct-flash" class="fluid-input" />
          <div class="provider-hint">Instruct Flash 支持自然语言声音指令；普通 Flash 使用音色默认表达。</div>
        </div>

        <div class="form-section-title">合成测试</div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">预置音色</span></div>
          <div class="pill-tabs wide-tabs">
            <div class="pill-tab" :class="{ active: aliyunTestVoice === 'Cherry' }" @click="aliyunTestVoice = 'Cherry'">Cherry</div>
            <div class="pill-tab" :class="{ active: aliyunTestVoice === 'Serena' }" @click="aliyunTestVoice = 'Serena'">Serena</div>
            <div class="pill-tab" :class="{ active: aliyunTestVoice === 'Ethan' }" @click="aliyunTestVoice = 'Ethan'">Ethan</div>
          </div>
          <input type="text" v-model="aliyunTestVoice" placeholder="Cherry" class="fluid-input" />
          <div class="provider-hint">也可填写当前模型支持的其他系统音色或已创建的音色 ID。</div>
        </div>

        <div class="form-row">
          <span class="row-label">合成语言</span>
          <div class="pill-tabs">
            <div class="pill-tab" :class="{ active: aliyunTestLanguage === 'Auto' }" @click="aliyunTestLanguage = 'Auto'">自动</div>
            <div class="pill-tab" :class="{ active: aliyunTestLanguage === 'Chinese' }" @click="aliyunTestLanguage = 'Chinese'">中文</div>
            <div class="pill-tab" :class="{ active: aliyunTestLanguage === 'English' }" @click="aliyunTestLanguage = 'English'">英文</div>
          </div>
        </div>

        <div class="form-row column-row">
          <div class="row-header"><span class="row-label">声音指令</span></div>
          <textarea v-model="aliyunTestInstructions" rows="3" maxlength="1200" placeholder="描述语气、节奏与情绪..." class="fluid-textarea"></textarea>
          <div class="provider-hint">仅支持指令控制的模型会应用此项。</div>
        </div>

        <div class="form-row">
          <span class="row-label">优化声音指令</span>
          <div class="pill-tabs">
            <div class="pill-tab" :class="{ active: aliyunOptimizeInstructions }" @click="aliyunOptimizeInstructions = true">开启</div>
            <div class="pill-tab" :class="{ active: !aliyunOptimizeInstructions }" @click="aliyunOptimizeInstructions = false">关闭</div>
          </div>
        </div>

        <div class="form-row column-row">
          <textarea v-model="aliyunTestText" rows="4" maxlength="1200" placeholder="输入要合成的文本..." class="fluid-textarea"></textarea>
          <div class="text-counter">{{ aliyunTestText.length }} / 1200</div>
          <div v-if="aliyunErrorMsg" class="error-banner">{{ aliyunErrorMsg }}</div>
          <button class="fluid-action-btn" :disabled="aliyunIsLoading" @click="playAliyunTest">
            <span v-if="aliyunIsLoading" class="spinner"></span>
            {{ aliyunIsLoading ? '正在合成...' : '合成并播放' }}
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
  width: 100%;
  box-sizing: border-box;
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
.wide-tabs { width: 100%; box-sizing: border-box; }
.wide-tabs .pill-tab { flex: 1 1 0; min-width: 0; padding-left: 5px; padding-right: 5px; text-align: center; white-space: nowrap; font-size: 12px; }
.seed-provider-row { gap: 12px; }
.provider-hint { padding: 0 4px; color: #999; font-size: 12px; line-height: 1.5; }
.text-counter { margin-top: -10px; padding-right: 4px; color: #aaa; font-size: 11px; text-align: right; }

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
