<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import type { CharacterCandidate } from '../../types/characterWorkshop'
defineProps<{ candidates: CharacterCandidate[]; loading: boolean }>()
const emit = defineEmits<{ close: []; select: [candidate: CharacterCandidate] }>()
const fields = [{ key: 'identity', label: '身份' }, { key: 'core', label: '人格内核' }, { key: 'contradiction', label: '矛盾来源' }, { key: 'voice', label: '表达节奏' }, { key: 'relationship', label: '关系方式' }] as const
</script>
<template>
  <div class="cw-modal-backdrop" @click.self="emit('close')">
    <section class="cw-wide-modal" role="dialog" aria-modal="true" aria-labelledby="candidate-title">
      <header class="cw-modal-header"><div><p class="cw-kicker">CANDIDATE COMPARISON</p><h2 id="candidate-title">选择值得继续深化的方向</h2><p>候选不是换名字的同一人。横向比较他们的判断、矛盾与关系方式。</p></div><button class="cw-icon-button" type="button" aria-label="关闭" @click="emit('close')"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
      <div v-if="loading" class="cw-modal-loading"><span class="cw-spinner"></span><strong>正在创造差异化候选</strong><p>这一步只建立骨架，选定后再生成完整档案。</p></div>
      <div v-else class="cw-candidate-grid">
        <article v-for="(candidate, index) in candidates" :key="candidate.id" class="cw-candidate-column">
          <div class="cw-candidate-head"><small>方向 {{ String(index + 1).padStart(2, '0') }}</small><h3>{{ candidate.name }}</h3><p>{{ candidate.tagline }}</p></div>
          <dl><template v-for="field in fields" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ candidate[field.key] || '未说明' }}</dd></template></dl>
          <button class="cw-button primary" type="button" @click="emit('select', candidate)">选择并深化</button>
        </article>
      </div>
    </section>
  </div>
</template>
