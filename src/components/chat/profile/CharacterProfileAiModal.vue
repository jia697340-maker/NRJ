<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { generateSocialProfileFields, type SocialGenerationField, type SocialGenerationResult } from '../../../services/characterSocialGenerator'

const props = defineProps<{ visible: boolean; chat: any; existingMoments: any[] }>()
const emit = defineEmits<{
  (event: 'close'): void
  (event: 'apply', result: SocialGenerationResult, generation: { includeRecentChat: boolean; allowChatDetails: boolean; momentCount: number }): void
}>()

type FieldState = 'idle' | 'loading' | 'success' | 'error'
const fieldOptions: Array<{ id: SocialGenerationField; title: string; description: string }> = [
  { id: 'nickname', title: '网名', description: '符合角色气质的社交昵称' },
  { id: 'socialId', title: '社交 ID', description: '简洁、稳定且容易辨认' },
  { id: 'signature', title: '个性签名', description: '一句自然、有辨识度的自我表达' },
  { id: 'coverStyle', title: '背景方案', description: '从现有主题中选择合适风格' },
  { id: 'moments', title: '朋友圈草稿', description: '生成后逐条确认，不会直接发布' }
]

const selectedFields = ref<SocialGenerationField[]>(['nickname', 'socialId', 'signature', 'coverStyle', 'moments'])
const momentCount = ref(3)
const includeRecentChat = ref(true)
const allowChatDetails = ref(false)
const fieldStates = ref<Record<SocialGenerationField, FieldState>>({ nickname: 'idle', socialId: 'idle', signature: 'idle', coverStyle: 'idle', moments: 'idle' })
const fieldErrors = ref<Partial<Record<SocialGenerationField, string>>>({})
const result = ref<SocialGenerationResult>({})
const globalError = ref('')
const applied = ref(false)

const allSelected = computed(() => selectedFields.value.length === fieldOptions.length)
const isGenerating = computed(() => Object.values(fieldStates.value).some(state => state === 'loading'))
const successfulFields = computed(() => selectedFields.value.filter(field => fieldStates.value[field] === 'success'))

watch(() => props.visible, visible => {
  if (!visible) return
  const generation = props.chat?.socialProfile?.generation || {}
  momentCount.value = Math.min(20, Math.max(1, Number(generation.momentCount || 3)))
  includeRecentChat.value = generation.includeRecentChat ?? true
  allowChatDetails.value = generation.allowChatDetails ?? false
  globalError.value = ''
  applied.value = false
})

const toggleField = (field: SocialGenerationField) => {
  if (isGenerating.value) return
  selectedFields.value = selectedFields.value.includes(field)
    ? selectedFields.value.filter(item => item !== field)
    : [...selectedFields.value, field]
}

const toggleAll = () => {
  if (isGenerating.value) return
  selectedFields.value = allSelected.value ? [] : fieldOptions.map(item => item.id)
}

const hasValue = (field: SocialGenerationField, generated: SocialGenerationResult) => {
  if (field === 'moments') return Array.isArray(generated.moments) && generated.moments.length > 0
  return Boolean(generated[field])
}

const generate = async (fields = selectedFields.value) => {
  if (!fields.length || isGenerating.value) return
  globalError.value = ''
  applied.value = false
  fields.forEach(field => {
    fieldStates.value[field] = 'loading'
    delete fieldErrors.value[field]
  })
  try {
    const generated = await generateSocialProfileFields({
      chat: props.chat,
      fields,
      momentCount: momentCount.value,
      includeRecentChat: includeRecentChat.value,
      allowChatDetails: allowChatDetails.value,
      existingMoments: props.existingMoments
    })
    result.value = { ...result.value, ...generated }
    fields.forEach(field => {
      if (hasValue(field, generated)) fieldStates.value[field] = 'success'
      else {
        fieldStates.value[field] = 'error'
        fieldErrors.value[field] = '本次没有生成有效内容，可单独重试'
      }
    })
  } catch (error: any) {
    const message = error?.message || '生成失败，请检查 API 设置后重试'
    fields.forEach(field => {
      fieldStates.value[field] = 'error'
      fieldErrors.value[field] = message
    })
    globalError.value = message
  }
}

const updateText = (field: 'nickname' | 'socialId' | 'signature', value: string) => {
  result.value = { ...result.value, [field]: value }
}

const updateMoment = (index: number, value: string) => {
  const moments = [...(result.value.moments || [])]
  moments[index] = value
  result.value = { ...result.value, moments }
}

const removeMoment = (index: number) => {
  result.value = { ...result.value, moments: (result.value.moments || []).filter((_, itemIndex) => itemIndex !== index) }
  if (!result.value.moments?.length) fieldStates.value.moments = 'error'
}

const applyResult = () => {
  const payload: SocialGenerationResult = {}
  successfulFields.value.forEach(field => {
    if (field === 'moments') payload.moments = (result.value.moments || []).map(item => item.trim()).filter(Boolean)
    else (payload as any)[field] = result.value[field]
  })
  emit('apply', payload, { includeRecentChat: includeRecentChat.value, allowChatDetails: allowChatDetails.value, momentCount: momentCount.value })
  applied.value = true
}
</script>

<template>
  <Teleport to="body">
    <Transition name="social-sheet">
      <div v-if="visible" class="social-ai-overlay" @click.self="!isGenerating && emit('close')">
        <section class="social-ai-sheet" role="dialog" aria-modal="true" aria-labelledby="social-ai-title">
          <header class="social-ai-header">
            <div>
              <p>AI ASSIST</p>
              <h2 id="social-ai-title">完善角色主页</h2>
              <span>按需选择字段，每项都能独立生成与重试</span>
            </div>
            <button class="social-icon-button" type="button" aria-label="关闭" :disabled="isGenerating" @click="emit('close')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </header>

          <div class="social-ai-scroll">
            <div class="social-select-heading">
              <div><strong>选择生成内容</strong><span>已选 {{ selectedFields.length }} 项</span></div>
              <button type="button" :disabled="isGenerating" @click="toggleAll">{{ allSelected ? '取消全选' : '全选' }}</button>
            </div>

            <div class="social-field-grid">
              <button
                v-for="field in fieldOptions"
                :key="field.id"
                type="button"
                class="social-field-card"
                :class="[{ selected: selectedFields.includes(field.id) }, `state-${fieldStates[field.id]}`]"
                :aria-pressed="selectedFields.includes(field.id)"
                :disabled="isGenerating"
                @click="toggleField(field.id)"
              >
                <span class="social-check" aria-hidden="true"><svg v-if="selectedFields.includes(field.id)" viewBox="0 0 24 24"><path d="m5 12 4 4L19 7" /></svg></span>
                <span class="social-field-copy"><strong>{{ field.title }}</strong><small>{{ field.description }}</small></span>
                <span v-if="fieldStates[field.id] === 'loading'" class="social-spinner" aria-label="生成中"></span>
                <svg v-else-if="fieldStates[field.id] === 'success'" class="social-state-icon success" viewBox="0 0 24 24" aria-label="生成成功"><path d="M20 6 9 17l-5-5" /></svg>
                <svg v-else-if="fieldStates[field.id] === 'error'" class="social-state-icon error" viewBox="0 0 24 24" aria-label="生成失败"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg>
              </button>
            </div>

            <section class="social-context-card">
              <div class="social-context-row">
                <div><strong>结合最近聊天</strong><span>参考关系、情绪与近期事件</span></div>
                <label class="social-switch"><input v-model="includeRecentChat" type="checkbox"><span></span></label>
              </div>
              <div class="social-context-row" :class="{ muted: !includeRecentChat }">
                <div><strong>允许提及聊天细节</strong><span>关闭时只吸收氛围，不复述私聊</span></div>
                <label class="social-switch"><input v-model="allowChatDetails" type="checkbox" :disabled="!includeRecentChat"><span></span></label>
              </div>
              <label v-if="selectedFields.includes('moments')" class="social-count-row">
                <span><strong>朋友圈数量</strong><small>一次请求生成 1～20 条草稿</small></span>
                <span class="social-number-control"><button type="button" :disabled="momentCount <= 1 || isGenerating" @click="momentCount--">−</button><input v-model.number="momentCount" type="number" min="1" max="20" aria-label="朋友圈生成数量"><button type="button" :disabled="momentCount >= 20 || isGenerating" @click="momentCount++">＋</button></span>
              </label>
            </section>

            <div v-if="globalError" class="social-alert error" role="alert">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg>
              <span>{{ globalError }}</span>
            </div>

            <section v-if="successfulFields.length || Object.keys(fieldErrors).length" class="social-results">
              <div class="social-results-title"><strong>生成结果</strong><span>可以编辑后再采用</span></div>
              <article v-for="field in selectedFields" :key="`result_${field}`" class="social-result-card" :class="{ failed: fieldStates[field] === 'error' }">
                <header><strong>{{ fieldOptions.find(item => item.id === field)?.title }}</strong><button v-if="fieldStates[field] === 'error'" type="button" :disabled="isGenerating" @click="generate([field])">单独重试</button></header>
                <p v-if="fieldStates[field] === 'error'">{{ fieldErrors[field] }}</p>
                <input v-else-if="field === 'nickname' || field === 'socialId'" :value="result[field]" :aria-label="field === 'nickname' ? '生成的网名' : '生成的社交 ID'" @input="updateText(field, ($event.target as HTMLInputElement).value)">
                <textarea v-else-if="field === 'signature'" :value="result.signature" aria-label="生成的个性签名" @input="updateText('signature', ($event.target as HTMLTextAreaElement).value)"></textarea>
                <div v-else-if="field === 'coverStyle'" class="social-cover-result"><span :class="`cover-${result.coverStyle}`"></span><b>{{ { dots: '柔和波点', grid: '细线格纹', stars: '静谧星点', plain: '克制纯色' }[result.coverStyle || 'dots'] }}</b></div>
                <div v-else-if="field === 'moments'" class="social-moment-results">
                  <div v-for="(moment, index) in result.moments" :key="index"><textarea :value="moment" :aria-label="`朋友圈草稿 ${index + 1}`" @input="updateMoment(index, ($event.target as HTMLTextAreaElement).value)"></textarea><button type="button" aria-label="删除这条草稿" @click="removeMoment(index)"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg></button></div>
                </div>
              </article>
            </section>
          </div>

          <footer class="social-ai-footer">
            <div v-if="applied" class="social-applied"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>已采用生成结果</div>
            <button v-if="!successfulFields.length" class="social-primary-button" type="button" :disabled="!selectedFields.length || isGenerating" @click="generate()">
              <span v-if="isGenerating" class="social-spinner light"></span>{{ isGenerating ? '正在生成…' : `生成 ${selectedFields.length} 项内容` }}
            </button>
            <template v-else>
              <button class="social-secondary-button" type="button" :disabled="isGenerating" @click="generate()">重新生成所选</button>
              <button class="social-primary-button" type="button" :disabled="isGenerating || applied" @click="applyResult">{{ applied ? '已采用' : `采用 ${successfulFields.length} 项结果` }}</button>
            </template>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.social-ai-overlay{position:fixed;inset:0;z-index:14000;display:flex;align-items:flex-end;justify-content:center;padding:24px;background:rgba(10,12,14,.46);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.social-ai-sheet{display:flex;flex-direction:column;width:min(680px,100%);max-height:min(850px,92vh);overflow:hidden;border:1px solid var(--border-color);border-radius:22px;background:var(--sys-bg-primary);box-shadow:0 18px 50px rgba(0,0,0,.16);color:var(--text-primary)}
.social-ai-header{display:flex;align-items:flex-start;justify-content:space-between;padding:24px 26px 18px;border-bottom:1px solid var(--border-color);background:var(--sys-bg-secondary)}
.social-ai-header p{margin:0 0 5px;color:#728078;font-size:10px;font-weight:800;letter-spacing:1.8px}.social-ai-header h2{margin:0;font-size:21px;line-height:1.25}.social-ai-header span{display:block;margin-top:6px;color:var(--text-tertiary);font-size:13px}.social-icon-button{display:grid;place-items:center;width:40px;height:40px;border:0;border-radius:50%;background:var(--sys-bg-tertiary);color:var(--text-secondary);cursor:pointer;transition:.18s}.social-icon-button:hover{background:var(--border-color);color:var(--text-primary)}.social-icon-button:active{transform:scale(.94)}.social-icon-button:focus-visible,.social-field-card:focus-visible,.social-ai-sheet button:focus-visible,.social-ai-sheet input:focus-visible,.social-ai-sheet textarea:focus-visible{outline:2px solid #60756a;outline-offset:2px}.social-icon-button svg{width:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}
.social-ai-scroll{overflow-y:auto;padding:22px 26px 30px}.social-select-heading,.social-select-heading>div{display:flex;align-items:center}.social-select-heading{justify-content:space-between;margin-bottom:12px}.social-select-heading>div{gap:9px}.social-select-heading strong{font-size:14px}.social-select-heading span{color:var(--text-tertiary);font-size:12px}.social-select-heading button{border:0;background:none;color:#576b95;font:600 13px inherit;cursor:pointer}
.social-field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.social-field-card{position:relative;display:flex;align-items:center;min-height:72px;padding:13px 14px;border:1px solid var(--border-color);border-radius:13px;background:var(--sys-bg-secondary);color:var(--text-primary);text-align:left;cursor:pointer;transition:border-color .18s,background .18s,transform .18s}.social-field-card:last-child{grid-column:1/-1}.social-field-card:hover{border-color:rgba(87,107,149,.34)}.social-field-card:active{transform:scale(.985)}.social-field-card.selected{border-color:rgba(87,107,149,.46);background:color-mix(in srgb,var(--sys-bg-secondary) 90%,#dfe6f1)}.social-check{display:grid;place-items:center;flex:0 0 21px;width:21px;height:21px;margin-right:11px;border:1.5px solid #b7bcc2;border-radius:7px}.selected .social-check{border-color:#576b95;background:#576b95}.social-check svg{width:14px;fill:none;stroke:#fff;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}.social-field-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:4px}.social-field-copy strong{font-size:14px}.social-field-copy small{overflow:hidden;color:var(--text-tertiary);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.social-state-icon{width:18px;margin-left:8px;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.social-state-icon.success{stroke:#4f8068}.social-state-icon.error{stroke:#c25b58}
.social-spinner{width:17px;height:17px;margin-left:8px;border:2px solid rgba(87,107,149,.2);border-top-color:#576b95;border-radius:50%;animation:social-spin .8s linear infinite}.social-spinner.light{margin:0 8px 0 0;border-color:rgba(255,255,255,.25);border-top-color:#fff}@keyframes social-spin{to{transform:rotate(360deg)}}
.social-context-card{margin-top:18px;overflow:hidden;border:1px solid var(--border-color);border-radius:14px;background:var(--sys-bg-secondary)}.social-context-row,.social-count-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 16px;border-bottom:1px solid var(--border-color)}.social-context-row.muted{opacity:.55}.social-context-row>div,.social-count-row>span:first-child{display:flex;min-width:0;flex-direction:column;gap:4px}.social-context-row strong,.social-count-row strong{font-size:13px}.social-context-row span,.social-count-row small{color:var(--text-tertiary);font-size:11px}.social-switch{position:relative;flex:0 0 44px;width:44px;height:26px}.social-switch input{position:absolute;opacity:0}.social-switch span{display:block;width:100%;height:100%;border-radius:15px;background:#c9cbd0;transition:.2s}.social-switch span:after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.16);transition:.2s}.social-switch input:checked+span{background:#60756a}.social-switch input:checked+span:after{transform:translateX(18px)}.social-switch input:focus-visible+span{outline:2px solid #60756a;outline-offset:2px}.social-count-row{border-bottom:0}.social-number-control{display:flex;overflow:hidden;height:34px;border:1px solid var(--border-color);border-radius:9px}.social-number-control button{width:34px;border:0;background:var(--sys-bg-tertiary);color:var(--text-primary);font-size:17px}.social-number-control input{width:42px;border:0;border-right:1px solid var(--border-color);border-left:1px solid var(--border-color);background:var(--sys-bg-secondary);color:var(--text-primary);font:600 13px inherit;text-align:center;appearance:textfield}.social-number-control input::-webkit-inner-spin-button{display:none}
.social-alert{display:flex;gap:10px;align-items:center;margin-top:14px;padding:12px 14px;border-radius:11px;font-size:12px}.social-alert.error{background:rgba(194,91,88,.1);color:#a84d4a}.social-alert svg{width:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}
.social-results{margin-top:22px}.social-results-title{display:flex;align-items:baseline;gap:9px;margin-bottom:10px}.social-results-title strong{font-size:14px}.social-results-title span{color:var(--text-tertiary);font-size:11px}.social-result-card{margin-top:9px;padding:14px;border:1px solid var(--border-color);border-radius:13px;background:var(--sys-bg-secondary)}.social-result-card.failed{border-color:rgba(194,91,88,.26)}.social-result-card header{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}.social-result-card header strong{font-size:12px}.social-result-card header button{border:0;background:none;color:#576b95;font:600 12px inherit}.social-result-card p{color:#a84d4a;font-size:12px}.social-result-card input,.social-result-card textarea{width:100%;border:1px solid transparent;border-radius:9px;outline:0;background:var(--sys-bg-primary);color:var(--text-primary);font:13px/1.55 inherit}.social-result-card input{height:40px;padding:0 12px}.social-result-card textarea{min-height:68px;padding:10px 12px;resize:vertical}.social-result-card input:focus,.social-result-card textarea:focus{border-color:#7d8ba9;background:var(--sys-bg-secondary)}.social-cover-result{display:flex;align-items:center;gap:11px;font-size:13px}.social-cover-result>span{width:48px;height:34px;border:1px solid var(--border-color);border-radius:8px;background-color:#f4f3ef}.cover-dots{background-image:radial-gradient(#c7c3ba 1.2px,transparent 1.2px);background-size:10px 10px}.cover-grid{background-image:linear-gradient(#d9d6cf 1px,transparent 1px),linear-gradient(90deg,#d9d6cf 1px,transparent 1px);background-size:10px 10px}.cover-stars{background-color:#30363b!important;background-image:radial-gradient(#ece8df 1px,transparent 1px);background-size:13px 13px}.cover-plain{background:#dce2de!important}.social-moment-results{display:flex;flex-direction:column;gap:8px}.social-moment-results>div{display:flex;align-items:flex-start;gap:7px}.social-moment-results textarea{flex:1}.social-moment-results button{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;border:0;border-radius:9px;background:var(--sys-bg-tertiary);color:var(--text-tertiary)}.social-moment-results svg{width:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.social-ai-footer{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:15px 26px calc(15px + env(safe-area-inset-bottom));border-top:1px solid var(--border-color);background:var(--sys-bg-secondary)}.social-ai-footer button{min-height:43px;padding:0 18px;border:0;border-radius:11px;font:650 13px inherit;cursor:pointer;transition:.18s}.social-ai-footer button:active{transform:scale(.98)}.social-ai-footer button:disabled{cursor:not-allowed;opacity:.45}.social-primary-button{display:flex;align-items:center;justify-content:center;background:#191b1c;color:#fff}.social-secondary-button{background:var(--sys-bg-tertiary);color:var(--text-primary)}.social-applied{display:flex;align-items:center;gap:6px;margin-right:auto;color:#4f8068;font-size:12px}.social-applied svg{width:17px;fill:none;stroke:currentColor;stroke-width:2}
.social-sheet-enter-active,.social-sheet-leave-active{transition:opacity .22s}.social-sheet-enter-active .social-ai-sheet,.social-sheet-leave-active .social-ai-sheet{transition:transform .26s cubic-bezier(.2,.75,.2,1)}.social-sheet-enter-from,.social-sheet-leave-to{opacity:0}.social-sheet-enter-from .social-ai-sheet,.social-sheet-leave-to .social-ai-sheet{transform:translateY(28px)}
@media(max-width:620px){.social-ai-overlay{padding:0;align-items:flex-end}.social-ai-sheet{width:100%;max-height:94dvh;border-right:0;border-bottom:0;border-left:0;border-radius:20px 20px 0 0}.social-ai-header{padding:20px 19px 15px}.social-ai-header h2{font-size:19px}.social-ai-scroll{padding:18px 16px 24px}.social-field-grid{grid-template-columns:1fr}.social-field-card:last-child{grid-column:auto}.social-ai-footer{padding:12px 16px calc(12px + env(safe-area-inset-bottom))}.social-ai-footer button{flex:1;padding:0 10px}.social-applied{display:none}}@media(prefers-reduced-motion:reduce){.social-ai-sheet,.social-field-card,.social-spinner{animation:none!important;transition:none!important}}
</style>
