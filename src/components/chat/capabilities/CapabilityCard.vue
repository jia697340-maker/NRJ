<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CapabilityExecutionState } from '../../../types/mcp'
import { doubanPageTypeLabel } from '../../../services/doubanCapability'

const props = defineProps<{ execution: CapabilityExecutionState }>()
const emit = defineEmits<{ action: [payload: { executionId: string; action: 'allow' | 'cancel' | 'retry' }] }>()
const showDetails = ref(false)
const statusTitle = computed(() => ({ detected: '已识别', awaiting_confirmation: '等待允许', loading: '正在读取', success: '已读取', partial: '部分读取', error: '未能读取', cancelled: '已取消', skipped: '本次未读取' })[props.execution.status])
const statusIcon = computed(() => props.execution.status === 'loading' ? '' : props.execution.status === 'success' ? '✓' : props.execution.status === 'partial' ? '—' : props.execution.status === 'error' ? '!' : '豆')
const canView = computed(() => Boolean(props.execution.result))
const result = computed(() => props.execution.result)
const contentCount = computed(() => props.execution.permissions.readPostBody
  ? result.value?.content?.length || (props.execution.permissions.readSubjectInfo ? result.value?.subjectInfo?.length : 0) || 0
  : props.execution.permissions.readSubjectInfo ? result.value?.subjectInfo?.length || 0 : 0)
const action = (value: 'allow' | 'cancel' | 'retry') => emit('action', { executionId: props.execution.id, action: value })
</script>

<template>
  <article class="capability-card" :class="'status-' + execution.status" @click.stop>
    <div class="capability-mark" :class="{ spinning: execution.status === 'loading' }">{{ statusIcon }}</div>
    <div class="capability-main">
      <div class="capability-kicker"><strong>豆瓣 · {{ statusTitle }}</strong><span v-if="execution.fromCache">最近结果</span></div>
      <h3 v-if="execution.title && execution.title !== '豆瓣链接'">{{ execution.title }}</h3>
      <p>{{ execution.status === 'loading' ? '正在读取公开内容…' : execution.summary }}</p>
      <div v-if="execution.status === 'awaiting_confirmation'" class="capability-actions">
        <button type="button" @click="action('cancel')">取消</button><button class="primary" type="button" @click="action('allow')">允许一次</button>
      </div>
      <div v-else-if="['partial', 'error'].includes(execution.status) && execution.retryCount < 1" class="capability-actions"><button type="button" @click="action('retry')">重试一次</button></div>
    </div>
    <button v-if="canView" class="view-button" type="button" @click="showDetails = true">查看</button>
  </article>

  <Teleport defer to="#app">
    <Transition name="capability-sheet">
      <div v-if="showDetails" class="capability-backdrop" @click.self="showDetails = false">
        <section class="capability-sheet" role="dialog" aria-modal="true" aria-labelledby="capability-detail-title">
          <div class="sheet-handle"></div>
          <header><div><small>豆瓣内容</small><h2 id="capability-detail-title">{{ execution.title }}</h2></div><button type="button" aria-label="关闭" @click="showDetails = false">×</button></header>
          <div class="detail-meta">
            <span><b>页面类型</b>{{ doubanPageTypeLabel(execution.pageType) }}</span><span><b>来源</b>douban.com</span><span><b>本次提供</b>{{ execution.successfulFields.join('、') || '无' }}</span>
          </div>
          <div class="detail-section">
            <h3>本次读取</h3>
            <p v-for="field in execution.successfulFields" :key="'ok-' + field" class="field-ok">✓ {{ field }}</p>
            <p v-for="field in execution.unavailableFields" :key="'no-' + field" class="field-no">— {{ field }}</p>
          </div>
          <div v-if="result" class="detail-section extracted-content">
            <h3>提取内容</h3>
            <p v-if="contentCount"><b>主体</b>{{ contentCount }} 字</p><p v-if="execution.permissions.readRatingAndTags && result.rating"><b>评分</b>{{ result.rating }}</p><p v-if="execution.permissions.readRatingAndTags && result.tags.length"><b>标签</b>{{ result.tags.join('、') }}</p>
            <p v-if="execution.permissions.readPostBody && result.content" class="content-preview">{{ result.content }}</p><p v-else-if="execution.permissions.readSubjectInfo && result.subjectInfo" class="content-preview">{{ result.subjectInfo }}</p>
            <template v-if="execution.permissions.readComments && result.comments.length"><h4>评论</h4><p v-for="(item, index) in result.comments" :key="'comment-' + index" class="item-preview"><b v-if="item.author">{{ item.author }}：</b>{{ item.content }}</p></template>
            <template v-if="execution.permissions.readShortReviews && result.shortReviews.length"><h4>短评</h4><p v-for="(item, index) in result.shortReviews" :key="'short-' + index" class="item-preview"><b v-if="item.author">{{ item.author }}：</b>{{ item.content }}</p></template>
            <template v-if="execution.permissions.readLongReviews && result.longReviews.length"><h4>长评</h4><p v-for="(item, index) in result.longReviews" :key="'long-' + index" class="item-preview"><b v-if="item.author">{{ item.author }}：</b>{{ item.content }}</p></template>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.capability-card{display:flex;width:min(86%,430px);box-sizing:border-box;align-items:flex-start;gap:10px;margin:4px auto;padding:10px 11px;border:1px solid color-mix(in srgb,var(--border-color) 80%,#5d786a 20%);border-radius:13px;background:color-mix(in srgb,var(--card-bg-solid) 94%,#6c8979 6%);box-shadow:0 3px 13px var(--shadow-color);color:var(--text-primary)}.capability-mark{display:grid;width:28px;height:28px;flex:none;place-items:center;border-radius:9px;background:rgba(80,116,98,.12);color:#4f7562;font-size:11px;font-weight:750}.capability-mark.spinning{box-sizing:border-box;border:2px solid rgba(79,117,98,.18);border-top-color:#4f7562;border-radius:50%;background:transparent;animation:cap-spin .8s linear infinite}.capability-main{min-width:0;flex:1}.capability-kicker{display:flex;align-items:center;gap:7px}.capability-kicker strong{font-size:10px;font-weight:650;color:#4f7562}.capability-kicker span{padding:2px 5px;border-radius:7px;background:var(--bg-secondary);color:var(--text-tertiary);font-size:7px}.capability-main h3{overflow:hidden;margin:4px 0 0;font-size:11px;font-weight:600;text-overflow:ellipsis;white-space:nowrap}.capability-main p{display:-webkit-box;overflow:hidden;margin:3px 0 0;color:var(--text-tertiary);font-size:9px;line-height:1.45;-webkit-box-orient:vertical;-webkit-line-clamp:2}.view-button{align-self:center;padding:5px 2px;border:0;background:transparent;color:#4f7562;font-size:9px}.capability-actions{display:flex;gap:7px;margin-top:8px}.capability-actions button{padding:5px 9px;border:1px solid var(--border-color);border-radius:8px;background:transparent;color:var(--text-secondary);font-size:9px}.capability-actions button.primary{border-color:#597767;background:#597767;color:#fff}.status-error .capability-mark{background:rgba(178,81,68,.11);color:#ad5148}.status-error .capability-kicker strong{color:#9e4b43}.status-cancelled,.status-skipped{opacity:.72}
.capability-backdrop{position:fixed;inset:0;z-index:10020;display:flex;align-items:flex-end;justify-content:center;padding:18px;background:rgba(23,28,25,.38);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}.capability-sheet{width:min(100%,520px);max-height:min(78vh,700px);overflow:auto;padding:8px 17px calc(18px + env(safe-area-inset-bottom));border:1px solid var(--border-color);border-radius:22px 22px 15px 15px;background:var(--card-bg-solid);box-shadow:0 20px 65px rgba(0,0,0,.23)}.sheet-handle{width:35px;height:4px;margin:1px auto 12px;border-radius:3px;background:var(--border-color)}.capability-sheet header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.capability-sheet header small{color:#597767;font-size:9px}.capability-sheet h2{margin:3px 0 0;font-size:17px}.capability-sheet header button{width:29px;height:29px;border:0;border-radius:50%;background:var(--bg-secondary);color:var(--text-secondary);font-size:20px}.detail-meta{display:grid;gap:7px;margin-top:14px;padding:11px;border-radius:12px;background:var(--bg-secondary)}.detail-meta span{display:grid;grid-template-columns:68px minmax(0,1fr);gap:8px;color:var(--text-secondary);font-size:10px;line-height:1.45}.detail-meta b{color:var(--text-tertiary);font-weight:500}.detail-section{margin-top:16px}.detail-section h3,.detail-section h4{margin:0 0 8px;font-size:11px}.detail-section h4{margin-top:14px;color:var(--text-secondary)}.detail-section>p{margin:5px 0;font-size:10px;line-height:1.55}.field-ok{color:#4f7562}.field-no{color:var(--text-tertiary)}.extracted-content>p b{margin-right:8px;color:var(--text-tertiary);font-weight:500}.content-preview,.item-preview{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text-secondary)}.content-preview{max-height:210px;overflow:auto;padding:10px;border:1px solid var(--border-color);border-radius:10px}.item-preview{padding-bottom:6px;border-bottom:1px dashed var(--border-color)}.capability-sheet-enter-active,.capability-sheet-leave-active{transition:opacity .2s}.capability-sheet-enter-active .capability-sheet,.capability-sheet-leave-active .capability-sheet{transition:transform .22s}.capability-sheet-enter-from,.capability-sheet-leave-to{opacity:0}.capability-sheet-enter-from .capability-sheet,.capability-sheet-leave-to .capability-sheet{transform:translateY(20px)}@keyframes cap-spin{to{transform:rotate(360deg)}}@media(max-width:360px){.capability-card{width:92%}.capability-backdrop{padding:8px}.capability-sheet{border-radius:19px 19px 10px 10px}}@media(prefers-reduced-motion:reduce){.capability-mark.spinning{animation:none}.capability-sheet-enter-active,.capability-sheet-leave-active,.capability-sheet-enter-active .capability-sheet,.capability-sheet-leave-active .capability-sheet{transition:none}}
</style>
