<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import type { CharacterDraft } from '../../types/characterWorkshop'
defineProps<{ draft: CharacterDraft; loading: boolean; loadingLabel: string }>()
const emit = defineEmits<{ close: []; inspect: []; optimize: []; review: []; audit: [] }>()
</script>
<template>
  <div class="cw-modal-backdrop" @click.self="!loading && emit('close')">
    <section class="cw-wide-modal quality-modal" role="dialog" aria-modal="true" aria-labelledby="quality-title">
      <header class="cw-modal-header"><div><p class="cw-kicker">QUALITY LAB</p><h2 id="quality-title">角色质量中心</h2><p>体检发现结构问题；双模型评审从不同节点独立判断；原作检查只依据锚点。</p></div><button class="cw-icon-button" type="button" aria-label="关闭" :disabled="loading" @click="emit('close')"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
      <div class="cw-quality-actions">
        <button type="button" :disabled="loading" @click="emit('inspect')"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 9h8m-8 4h5m-5 4h7"/></svg><span><strong>角色体检</strong><small>模板化、矛盾、边界与长期演绎</small></span></button>
        <button type="button" :disabled="loading" @click="emit('review')"><svg viewBox="0 0 24 24"><path d="M7 5h10v14H7zM3 8h4m10 0h4M3 16h4m10 0h4"/></svg><span><strong>双模型评审</strong><small>角色节点与全局节点独立评分</small></span></button>
        <button type="button" :disabled="loading || !draft.canonAnchors.length" @click="emit('audit')"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM9 4v4h6V4M8 13l2.5 2.5L16 10"/></svg><span><strong>原作一致性</strong><small>{{ draft.canonAnchors.length ? `${draft.canonAnchors.length} 个锚点` : '仅同人角色可用' }}</small></span></button>
      </div>
      <div v-if="loading" class="cw-modal-loading"><span class="cw-spinner"></span><strong>{{ loadingLabel }}</strong><p>评审只输出报告，不会暗中修改角色档案。</p></div>
      <div v-else class="cw-quality-results">
        <section class="cw-report-card">
          <div class="cw-report-title"><div><p class="cw-kicker">HEALTH REPORT</p><h3>人设体检</h3></div><strong v-if="draft.healthReport">{{ draft.healthReport.score }}</strong></div>
          <template v-if="draft.healthReport"><p class="cw-report-summary">{{ draft.healthReport.summary }}</p><div class="cw-strength-list"><span v-for="item in draft.healthReport.strengths" :key="item">{{ item }}</span></div><div class="cw-issue-list"><article v-for="issue in draft.healthReport.issues" :key="issue.title" :class="issue.severity"><div><span>{{ issue.category }}</span><strong>{{ issue.title }}</strong></div><p>{{ issue.detail }}</p><small>{{ issue.suggestion }}</small></article></div><button v-if="draft.healthReport.issues.length" class="cw-button secondary" type="button" @click="emit('optimize')">按报告优化并复检</button></template><p v-else class="cw-muted-copy">尚未体检。报告会指出具体问题和可执行建议，不使用模糊的“真实度百分比”。</p>
        </section>
        <section class="cw-report-card">
          <div class="cw-report-title"><div><p class="cw-kicker">MODEL PANEL</p><h3>独立评审</h3></div><span>{{ draft.modelReviews.length }} 份</span></div>
          <div v-if="draft.modelReviews.length" class="cw-review-list"><article v-for="review in draft.modelReviews" :key="review.id"><header><div><strong>{{ review.reviewer }}</strong><small>{{ review.model }}</small></div><b>{{ review.score }}</b></header><p>{{ review.verdict }}</p><div><span v-for="dimension in review.dimensions" :key="dimension.name">{{ dimension.name }} {{ dimension.score }}</span></div><ul><li v-for="risk in review.risks" :key="risk">{{ risk }}</li></ul></article></div><p v-else class="cw-muted-copy">配置独立角色节点后，可与全局聊天模型交叉评审。每份意见单独展示，不伪造统一答案。</p>
        </section>
        <section v-if="draft.canonAnchors.length" class="cw-report-card canon-report">
          <div class="cw-report-title"><div><p class="cw-kicker">CANON AUDIT</p><h3>原作偏离检查</h3></div><strong v-if="draft.canonAudit">{{ draft.canonAudit.score }}</strong></div>
          <template v-if="draft.canonAudit"><p class="cw-report-summary">{{ draft.canonAudit.summary }}</p><div class="cw-issue-list"><article v-for="item in draft.canonAudit.deviations" :key="`${item.anchor}-${item.detail}`" :class="item.severity"><div><strong>{{ item.anchor }}</strong></div><p>{{ item.detail }}</p><small>{{ item.fix }}</small></article></div></template><p v-else class="cw-muted-copy">检查只使用你提供的原作锚点；资料空白不会被误判为冲突。</p>
        </section>
      </div>
    </section>
  </div>
</template>
