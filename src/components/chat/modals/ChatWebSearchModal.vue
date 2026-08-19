/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { apiSettings, webSearchSettings, type WebSearchMode } from '../../../store'
import { resolveModelAdapterProfile } from '../../../services/modelAdapters'
import { supportsManagedWebSearch } from '../../../services/webSearch'

const props = defineProps<{ visible: boolean; enabled: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'save', enabled: boolean): void }>()

const localEnabled = ref(false)
const mode = ref<WebSearchMode>('managed')
const selfHostedUrl = ref('')
const selfHostedToken = ref('')
const maxResults = ref(5)
const guideVisible = ref(false)
const testing = ref(false)
const testResult = ref<{ ok: boolean; text: string } | null>(null)
const deployUrl = 'https://render.com/deploy?repo=https://github.com/jia697340-maker/NRJ'

watch(() => props.visible, visible => {
  if (!visible) return
  localEnabled.value = props.enabled
  mode.value = webSearchSettings.mode
  selfHostedUrl.value = webSearchSettings.selfHostedUrl
  selfHostedToken.value = webSearchSettings.selfHostedToken
  maxResults.value = webSearchSettings.maxResults
  guideVisible.value = false
  testResult.value = null
})

const managedSupported = computed(() => {
  const profile = resolveModelAdapterProfile(apiSettings.provider, apiSettings.model, (apiSettings.adapterProfile || 'auto') as any)
  const url = apiSettings.provider === 'custom' ? apiSettings.customUrl : apiSettings.url
  return supportsManagedWebSearch({ provider: apiSettings.provider, url, profile })
})

const canSave = computed(() => !localEnabled.value || (mode.value === 'managed' ? managedSupported.value : /^https?:\/\//i.test(selfHostedUrl.value.trim())))

const selectMode = (value: WebSearchMode) => {
  mode.value = value
  testResult.value = null
}

const testConnection = async () => {
  const base = selfHostedUrl.value.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(base)) {
    testResult.value = { ok: false, text: '请先填写完整的 https:// 服务地址' }
    return
  }
  testing.value = true
  testResult.value = null
  try {
    const response = await fetch(`${base}/health`, {
      headers: selfHostedToken.value ? { Authorization: `Bearer ${selfHostedToken.value}` } : {}
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data?.error || `连接失败 (${response.status})`)
    testResult.value = { ok: true, text: '连接成功，可以使用自建联网服务' }
  } catch (error: any) {
    testResult.value = { ok: false, text: error?.message || '无法连接到自建联网服务' }
  } finally {
    testing.value = false
  }
}

const save = () => {
  if (!canSave.value) return
  webSearchSettings.mode = mode.value
  webSearchSettings.selfHostedUrl = selfHostedUrl.value.trim().replace(/\/+$/, '')
  webSearchSettings.selfHostedToken = selfHostedToken.value.trim()
  webSearchSettings.maxResults = Math.max(1, Math.min(10, Number(maxResults.value) || 5))
  emit('save', localEnabled.value)
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index:10010" @click.self="emit('close')">
    <div class="custom-confirm-modal web-search-modal">
      <div class="web-search-header">
        <div>
          <div class="confirm-title">联网搜索</div>
          <div class="header-desc">让角色读取最新互联网资料</div>
        </div>
        <button class="editorial-switch" type="button" :class="{ active: localEnabled }" :aria-pressed="localEnabled" @click="localEnabled = !localEnabled">
          <span></span>
        </button>
      </div>

      <div class="web-search-body">
        <div class="memory-type-item" :class="{ active: mode === 'managed' }" @click="selectMode('managed')">
          <div class="type-row"><span class="type-name">服务商联网</span><span class="recommend-label">推荐</span></div>
          <div class="type-desc">无需部署，使用当前 OpenRouter、OpenAI、Claude 或 Gemini 节点完成搜索。</div>
          <div v-if="mode === 'managed' && !managedSupported" class="mode-warning">当前聊天节点暂不支持服务商联网，可选择自建方式。</div>
        </div>

        <div class="memory-type-item" :class="{ active: mode === 'self-hosted' }" @click="selectMode('self-hosted')">
          <div class="type-name">自建联网服务</div>
          <div class="type-desc">搜索由你自己的服务处理，适合没有原生联网能力的模型。</div>
        </div>

        <div v-if="mode === 'self-hosted'" class="self-hosted-fields" @click.stop>
          <label class="field-label" for="web-search-url">服务地址</label>
          <input id="web-search-url" v-model="selfHostedUrl" class="line-input" type="url" inputmode="url" autocomplete="url" placeholder="https://你的服务地址" />
          <label class="field-label" for="web-search-token">访问密码</label>
          <input id="web-search-token" v-model="selfHostedToken" class="line-input" type="password" autocomplete="off" placeholder="部署时设置的访问密码" />

          <div class="field-actions">
            <button class="inline-action" type="button" @click="guideVisible = !guideVisible">{{ guideVisible ? '收起部署指引' : '手机部署指引' }}</button>
            <button class="inline-action" type="button" :disabled="testing" @click="testConnection">{{ testing ? '测试中…' : '测试连接' }}</button>
          </div>
          <div v-if="testResult" class="test-result" :class="{ success: testResult.ok }">{{ testResult.text }}</div>

          <div v-if="guideVisible" class="deploy-guide">
            <div class="guide-title">手机一键部署</div>
            <ol>
              <li>打开 Render 并登录。</li>
              <li>确认创建免费 Web Service。</li>
              <li>填写一个只有你知道的访问密码。</li>
              <li>部署完成后复制 onrender.com 地址。</li>
              <li>返回这里粘贴地址和同一密码。</li>
            </ol>
            <a class="deploy-link" :href="deployUrl" target="_blank" rel="noopener noreferrer">前往 Render 部署</a>
            <div class="guide-note">免费服务闲置后会休眠，首次搜索可能需要等待约一分钟唤醒。</div>
          </div>
        </div>
      </div>

      <div class="confirm-actions">
        <button class="confirm-btn cancel" type="button" @click="emit('close')">取消</button>
        <button class="confirm-btn primary" type="button" :disabled="!canSave" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';
.web-search-modal{width:min(88%,360px);max-width:360px;max-height:min(86vh,650px)}
.web-search-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 18px 14px;border-bottom:1px solid var(--border-color)}
.web-search-header .confirm-title{padding:0;margin:0;text-align:left}.header-desc{margin-top:4px;color:var(--text-tertiary);font-size:11px}
.editorial-switch{position:relative;flex:none;width:42px;height:24px;padding:0;border:0;border-radius:12px;background:var(--sys-bg-tertiary);cursor:pointer;transition:background .2s}.editorial-switch span{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--sys-bg-primary);box-shadow:0 1px 4px rgba(0,0,0,.18);transition:transform .2s}.editorial-switch.active{background:var(--text-primary)}.editorial-switch.active span{transform:translateX(18px)}
.web-search-body{padding:14px 16px 16px;overflow:auto}.memory-type-item{margin-bottom:10px}.type-row{display:flex;align-items:center;gap:7px}.recommend-label{padding:2px 6px;border-radius:8px;background:var(--text-primary);color:var(--sys-bg-secondary);font-size:9px}.mode-warning{margin-top:8px;color:#c76b3b;font-size:10px;line-height:1.5}
.self-hosted-fields{margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color)}.field-label{display:block;margin:9px 0 5px;color:var(--text-secondary);font-size:11px}.line-input{display:block;width:100%;height:38px;box-sizing:border-box;padding:0 11px;border:1px solid var(--border-color);border-radius:8px;outline:0;background:var(--sys-bg-primary);color:var(--text-primary);font:inherit;font-size:12px}.line-input:focus{border-color:var(--text-secondary)}.field-actions{display:flex;justify-content:space-between;gap:8px;margin-top:12px}.inline-action{padding:7px 10px;border:1px solid var(--border-color);border-radius:8px;background:var(--sys-bg-primary);color:var(--text-secondary);font:inherit;font-size:11px;cursor:pointer}.inline-action:disabled{opacity:.45}.test-result{margin-top:9px;color:#c35b54;font-size:10px;line-height:1.5}.test-result.success{color:#4e8b62}
.deploy-guide{margin-top:12px;padding:12px;border-radius:8px;background:var(--sys-bg-primary);color:var(--text-secondary);font-size:11px;line-height:1.55}.guide-title{margin-bottom:5px;color:var(--text-primary);font-weight:600}.deploy-guide ol{margin:0 0 10px;padding-left:18px}.deploy-link{display:flex;align-items:center;justify-content:center;height:36px;border-radius:8px;background:var(--text-primary);color:var(--sys-bg-secondary);font-weight:600;text-decoration:none}.guide-note{margin-top:8px;color:var(--text-tertiary);font-size:9px}.confirm-actions{display:flex;border-top:1px solid var(--border-color)}.confirm-btn{border:0;background:transparent;font:inherit}.confirm-btn.primary{color:#1976d2;font-weight:600}.confirm-btn:disabled{opacity:.35;pointer-events:none}
</style>
