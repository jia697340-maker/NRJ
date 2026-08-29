<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { mcpSettings } from '../store/mcp'
import { clearDoubanCapabilityCache } from '../services/doubanCapability'
import type { DoubanReadDepth, DoubanTriggerMode } from '../types/mcp'

defineEmits<{ close: [] }>()

const showKey = ref(false)
const cacheMessage = ref('')
const scopes = [
  { key: 'readPostBody', title: '帖子正文', note: '小组帖子与长评的主要内容' },
  { key: 'readSubjectInfo', title: '条目信息', note: '电影、书籍与音乐的公开资料' },
  { key: 'readComments', title: '评论与回复', note: '帖子下公开可见的讨论' },
  { key: 'readShortReviews', title: '短评', note: '条目页面中的公开短评' },
  { key: 'readLongReviews', title: '长评', note: '公开影评、书评与乐评' },
  { key: 'readRatingAndTags', title: '评分与标签', note: '豆瓣评分及页面标签' },
  { key: 'readAuthorPublicInfo', title: '作者公开资料', note: '页面展示的发布者或作者信息' },
  { key: 'readRelatedItems', title: '相关推荐', note: '页面中的关联条目' }
] as const
const triggerModes: Array<{ id: DoubanTriggerMode; title: string; note: string }> = [
  { id: 'auto', title: '自动读取', note: '发现链接后立即读取' },
  { id: 'character', title: '由角色决定', note: '角色按对话需要选择' },
  { id: 'confirm', title: '每次询问', note: '获得本次允许后读取' }
]
const depths: Array<{ id: DoubanReadDepth; title: string; note: string }> = [
  { id: 'light', title: '轻量', note: '标题、主体前段与少量评论' },
  { id: 'standard', title: '标准', note: '完整主体与主要评论' },
  { id: 'full', title: '尽可能完整', note: '更多公开内容，仍受总量限制' }
]
const activeScopeCount = computed(() => scopes.filter(item => mcpSettings.douban[item.key]).length)

const toggleScope = (key: typeof scopes[number]['key']) => { mcpSettings.douban[key] = !mcpSettings.douban[key] }
const clearCache = async () => {
  await clearDoubanCapabilityCache()
  cacheMessage.value = '最近读取结果已清除'
  window.setTimeout(() => { cacheMessage.value = '' }, 2200)
}

watch(() => mcpSettings.douban.triggerMode, mode => {
  if (mode === 'confirm') mcpSettings.douban.showCapabilityCard = true
})
</script>

<template>
  <div class="mcp-app">
    <header class="mcp-header">
      <span class="header-spacer"></span>
      <div class="header-copy"><h1>MCP</h1><p>为角色开启公开网页能力</p></div>
      <button class="icon-button" type="button" aria-label="关闭" @click="$emit('close')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg>
      </button>
    </header>

    <main class="mcp-scroll">
      <section class="master-panel">
        <div class="master-mark">M</div>
        <div class="master-copy"><strong>MCP</strong><small>{{ mcpSettings.enabled ? '已允许使用你开启的能力' : '所有能力均已暂停' }}</small></div>
        <button class="switch-control" :class="{ on: mcpSettings.enabled }" type="button" role="switch" :aria-checked="mcpSettings.enabled" @click="mcpSettings.enabled = !mcpSettings.enabled"><span></span></button>
      </section>

      <section class="capability-panel" :class="{ muted: !mcpSettings.enabled }">
        <div class="capability-heading">
          <span class="douban-mark">豆</span>
          <div><h2>豆瓣</h2><p>读取公开可访问的帖子与书影音页面</p></div>
          <button class="switch-control" :class="{ on: mcpSettings.douban.enabled }" type="button" role="switch" :aria-checked="mcpSettings.douban.enabled" @click="mcpSettings.douban.enabled = !mcpSettings.douban.enabled"><span></span></button>
        </div>
        <p class="capability-note">不需要豆瓣账号或登录。受限、已删除或无法公开访问的内容不会读取。</p>
      </section>

      <template v-if="mcpSettings.douban.enabled">
        <section class="content-section">
          <div class="section-heading"><div><h2>允许角色读取</h2><p>已允许 {{ activeScopeCount }} 项；关闭的内容不会提供给角色</p></div></div>
          <div class="setting-list">
            <button v-for="item in scopes" :key="item.key" class="setting-row" type="button" @click="toggleScope(item.key)">
              <span class="row-copy"><strong>{{ item.title }}</strong><small>{{ item.note }}</small></span>
              <span class="small-check" :class="{ on: mcpSettings.douban[item.key] }"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"/></svg></span>
            </button>
          </div>
        </section>

        <section class="content-section">
          <div class="section-heading"><div><h2>读取方式</h2><p>遇到豆瓣链接时如何处理</p></div></div>
          <div class="choice-list">
            <button v-for="item in triggerModes" :key="item.id" type="button" :class="{ active: mcpSettings.douban.triggerMode === item.id }" @click="mcpSettings.douban.triggerMode = item.id">
              <span><strong>{{ item.title }}</strong><small>{{ item.note }}</small></span><i></i>
            </button>
          </div>
        </section>

        <section class="content-section">
          <div class="section-heading"><div><h2>读取深度</h2><p>控制每次提供给角色的内容量</p></div></div>
          <div class="depth-grid">
            <button v-for="item in depths" :key="item.id" type="button" :class="{ active: mcpSettings.douban.depth === item.id }" @click="mcpSettings.douban.depth = item.id">
              <strong>{{ item.title }}</strong><small>{{ item.note }}</small>
            </button>
          </div>
        </section>

        <section class="content-section compact-section">
          <button class="plain-setting-row" type="button" :disabled="mcpSettings.douban.triggerMode === 'confirm'" @click="mcpSettings.douban.showCapabilityCard = !mcpSettings.douban.showCapabilityCard">
            <span><strong>聊天中显示读取状态</strong><small>{{ mcpSettings.douban.triggerMode === 'confirm' ? '每次询问时必须显示确认卡片' : '关闭后仍会读取，只是不显示卡片' }}</small></span>
            <span class="switch-control" :class="{ on: mcpSettings.douban.showCapabilityCard }"><span></span></span>
          </button>
        </section>

        <section class="content-section key-section">
          <div class="section-heading"><div><h2>Jina Reader API Key</h2><p>可选；不填写也能使用基础读取</p></div></div>
          <div class="secret-input">
            <input v-model="mcpSettings.jinaApiKey" :type="showKey ? 'text' : 'password'" autocomplete="off" spellcheck="false" placeholder="可选，填写后提高请求限额">
            <button type="button" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button>
          </div>
          <p class="privacy-note">网页端密钥仅保存在当前浏览器，但无法达到服务器级保密。它不会发送给聊天模型，也不会显示在聊天卡片中。公开链接会交给 Jina Reader 读取。</p>
          <button class="cache-action" type="button" @click="clearCache">{{ cacheMessage || '清除最近读取结果' }}</button>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped src="./app_MCP.css"></style>
