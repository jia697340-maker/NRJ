<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CharacterDraft } from '../../types/characterWorkshop'

const props = defineProps<{ draft: CharacterDraft; loading: boolean }>()
const emit = defineEmits<{ close: []; publish: [options: { createWorldBook: boolean; autoSplitWorldBook: boolean; openChat: boolean }] }>()
const createWorldBook = ref(Boolean(props.draft.world.trim()))
const autoSplitWorldBook = ref(Boolean(props.draft.world.trim()))
const openChat = ref(true)
const checks = computed(() => [
  { label: '基础身份', ready: Boolean(props.draft.name.trim() && props.draft.identity.trim()) },
  { label: '人格内核', ready: Boolean(props.draft.core.trim() && props.draft.contradiction.trim()) },
  { label: '表达画像', ready: Boolean(props.draft.voice.trim() && props.draft.antiPatterns.trim()) },
  { label: '关系边界', ready: Boolean(props.draft.relationship.trim() && props.draft.boundaries.trim()) },
  { label: '对白试演', ready: props.draft.samples.length >= 3 }
])
const readyCount = computed(() => checks.value.filter(item => item.ready).length)
</script>

<template>
  <div class="cw-modal-backdrop" role="presentation" @click.self="emit('close')">
    <section class="cw-publish-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title">
      <header class="cw-modal-header">
        <div>
          <p class="cw-kicker">PUBLISH CHARACTER</p>
          <h2 id="publish-title">把 {{ draft.name || '这个角色' }} 带进聊天</h2>
        </div>
        <button class="cw-icon-button" type="button" aria-label="关闭发布窗口" :disabled="loading" @click="emit('close')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </header>

      <div class="cw-readiness">
        <div class="cw-score-ring" :style="{ '--score': `${readyCount / checks.length * 360}deg` }"><span>{{ readyCount }}/{{ checks.length }}</span></div>
        <div><strong>档案完整度</strong><p>{{ readyCount === checks.length ? '关键档案齐全，可以发布。' : '仍可发布，未完成部分会降低长期演绎稳定性。' }}</p></div>
      </div>

      <div class="cw-check-list">
        <div v-for="item in checks" :key="item.label" class="cw-check-item" :class="{ ready: item.ready }">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path v-if="item.ready" d="M5 12.5l4 4L19 7"/><path v-else d="M12 7v6m0 4h.01"/><circle v-if="!item.ready" cx="12" cy="12" r="9"/></svg>
          <span>{{ item.label }}</span><small>{{ item.ready ? '已就绪' : '建议补充' }}</small>
        </div>
      </div>

      <div class="cw-publish-options">
        <label class="cw-option-row" :class="{ disabled: !draft.world.trim() }">
          <span><strong>创建并绑定世界书</strong><small>将客观背景与角色人设分开，减少上下文混杂。</small></span>
          <input v-model="createWorldBook" type="checkbox" :disabled="!draft.world.trim() || loading"><i aria-hidden="true"></i>
        </label>
        <label class="cw-option-row" :class="{ disabled: !createWorldBook }">
          <span><strong>AI 自动拆分世界书</strong><small>按地点、规则、组织与时间线拆成可独立召回的条目；失败时自动回退为单条目。</small></span>
          <input v-model="autoSplitWorldBook" type="checkbox" :disabled="!createWorldBook || loading"><i aria-hidden="true"></i>
        </label>
        <label class="cw-option-row">
          <span><strong>发布后立即开聊</strong><small>完成创建后直接进入这个角色的聊天页面。</small></span>
          <input v-model="openChat" type="checkbox" :disabled="loading"><i aria-hidden="true"></i>
        </label>
      </div>

      <footer class="cw-modal-actions">
        <button class="cw-button secondary" type="button" :disabled="loading" @click="emit('close')">继续编辑</button>
        <button class="cw-button primary" type="button" :disabled="loading || !draft.name.trim() || !draft.core.trim()" @click="emit('publish', { createWorldBook, autoSplitWorldBook, openChat })">
          <span v-if="loading" class="cw-spinner" aria-hidden="true"></span>{{ loading ? '正在发布' : (draft.publishedContactId ? '同步到聊天' : '加入聊天列表') }}
        </button>
      </footer>
    </section>
  </div>
</template>
