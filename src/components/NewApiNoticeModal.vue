<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  darkMode?: boolean
  continueToImport?: boolean
  initialDontRemind?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'continue', dontRemindAgain: boolean): void
}>()

const dontRemindAgain = ref(false)

watch(() => props.visible, visible => {
  if (visible) dontRemindAgain.value = Boolean(props.initialDontRemind)
})
</script>

<template>
  <div v-if="visible" class="import-modal-overlay" :class="{ 'is-dark': darkMode }">
    <div class="import-modal-content notice-modal-content" role="dialog" aria-modal="true" aria-labelledby="new-api-notice-title">
      <button class="modal-close-btn" type="button" @click="emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="state-container notice-state-container">
        <div class="modal-header">
          <h2 id="new-api-notice-title" class="en-title">COMPATIBILITY NOTICE</h2>
          <span class="cn-subtitle">第三方节点兼容功能说明</span>
        </div>

        <div class="notice-scroll" tabindex="0">
          <section class="notice-section notice-lead">
            <p>本功能仅用于方便已经持有第三方 API 节点的用户减少重复配置，可识别兼容接口、同步模型，并在站点支持时读取对应 API Key 的额度信息。</p>
            <p class="notice-emphasis">本功能与 New API、One API 官方及任何第三方中转站均无隶属、合作、代理或授权关系。</p>
          </section>

          <section class="notice-section">
            <h3>作者立场</h3>
            <p>作者不支持、不推荐，也不倡导用户主动购买任何第三方中转服务。本项目不提供站点列表、购买或充值入口，不参与推广、返利、交易或质量背书。</p>
            <p>兼容功能只服务于已经自行取得节点的用户，不代表作者对中转模式或任何具体站点的认可。若后续出现不当推广、诱导消费、安全或合规风险，作者可能限制或移除本功能。</p>
          </section>

          <section class="notice-section">
            <h3>使用第三方中转可能存在的风险</h3>
            <ul class="notice-list">
              <li>API Key、对话、图片、文件和请求记录会发送至第三方接口，可能被其记录或处理。</li>
              <li>运营主体、上游来源、计费倍率、余额统计和退款规则可能不透明，服务也可能限速、停运或无法退款。</li>
              <li>模型名称由站点自行返回，可能存在模型重命名、混合路由、高价模型转低价线路、版本或上下文缩水等“掺水”情况。</li>
              <li>检测成功仅表示接口当前可连接、凭证当前可用，不代表站点可信，也不代表模型、余额、计费和上游来源已经得到认证。</li>
              <li>第三方服务可能违反其上游平台条款或缺少必要授权，并可能带来封禁、数据安全及所在地合规风险。</li>
            </ul>
          </section>

          <section class="notice-section notice-warning">
            <h3>请在继续前确认</h3>
            <p>仅导入你已经合法取得并充分信任的 HTTPS 节点，不要因为本功能而购买陌生服务，也不要向不可信接口发送隐私、账号凭证或其他敏感内容。</p>
            <p>任何以“公益”“低价”“稳定”等名义宣传的站点，都应由用户自行核验运营主体、数据流向、退款规则与上游授权。</p>
          </section>
        </div>

        <label class="notice-reminder-row">
          <span class="notice-reminder-copy">
            <span class="notice-reminder-title">下次不再提醒</span>
            <span class="notice-reminder-desc">仍可通过页面标题旁的“说明”随时查看</span>
          </span>
          <span class="notice-switch">
            <input v-model="dontRemindAgain" type="checkbox">
            <span class="notice-slider"></span>
          </span>
        </label>

        <div class="modal-actions notice-actions">
          <button class="text-btn" type="button" @click="emit('close')">取消</button>
          <button class="primary-btn" type="button" @click="emit('continue', dontRemindAgain)">
            {{ continueToImport ? '已了解，继续导入' : '我已了解' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./NewApiImportModal.css"></style>
<style scoped src="./NewApiNoticeModal.css"></style>
