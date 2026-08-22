<script setup lang="ts">
import { computed, ref } from 'vue'
import { appearanceCategories, appearanceCategoryMap, getAppearanceStyle, type AppearanceCategoryId } from '../appearanceRegistry'
import { appearanceState, applyAppearancePreset, applyAppearanceStyle, deleteAppearancePreset, getAppearanceSelections, globalSettings, saveAppearancePreset, type AppearancePreset } from '../store'
import { useChatAuth } from '../composables/useChatAuth'
import AppearanceStylePreview from './appearance/AppearanceStylePreview.vue'

const emit = defineEmits<{ (event: 'close'): void }>()
const { currentChatUserId, chatAccounts, currentAccount } = useChatAuth()

type WardrobeView = 'home' | 'category' | 'detail' | 'current' | 'presets'
const view = ref<WardrobeView>('home')
const selectedCategoryId = ref<AppearanceCategoryId>('characterProfile')
const selectedStyleId = ref('default')
const previewDark = ref(false)
const showApplySheet = ref(false)
const selectedAccountIds = ref<string[]>([])
const applyGlobally = ref(true)
const pendingPreset = ref<AppearancePreset | null>(null)
const showSavePreset = ref(false)
const presetName = ref('')
const toast = ref('')
let toastTimer: number | null = null

const notify = (message: string) => {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = '' }, 2200)
}

const effectiveSelections = computed(() => getAppearanceSelections(currentChatUserId.value))
const selectedCategory = computed(() => appearanceCategoryMap[selectedCategoryId.value])
const selectedStyle = computed(() => getAppearanceStyle(selectedCategoryId.value, selectedStyleId.value))
const currentSchemeName = computed(() => currentAccount.value ? `${currentAccount.value.name}的搭配` : '项目共用')

const openCategory = (categoryId: AppearanceCategoryId) => {
  selectedCategoryId.value = categoryId
  view.value = 'category'
}

const openDetail = (categoryId: AppearanceCategoryId, styleId: string) => {
  selectedCategoryId.value = categoryId
  selectedStyleId.value = styleId
  previewDark.value = false
  view.value = 'detail'
}

const goBack = () => {
  if (view.value === 'detail') view.value = 'category'
  else if (view.value !== 'home') view.value = 'home'
  else emit('close')
}

const openApply = (preset: AppearancePreset | null = null) => {
  pendingPreset.value = preset
  applyGlobally.value = true
  selectedAccountIds.value = currentChatUserId.value ? [currentChatUserId.value] : []
  showApplySheet.value = true
}

const toggleAccount = (accountId: string) => {
  selectedAccountIds.value = selectedAccountIds.value.includes(accountId)
    ? selectedAccountIds.value.filter(id => id !== accountId)
    : [...selectedAccountIds.value, accountId]
}

const selectAllAccounts = () => {
  selectedAccountIds.value = selectedAccountIds.value.length === chatAccounts.value.length ? [] : chatAccounts.value.map(account => account.id)
}

const confirmApply = () => {
  const targetIds = applyGlobally.value ? null : selectedAccountIds.value
  if (!applyGlobally.value && !selectedAccountIds.value.length) return notify('请至少选择一个账号')
  if (pendingPreset.value) applyAppearancePreset(pendingPreset.value, targetIds)
  else applyAppearanceStyle(selectedCategoryId.value, selectedStyleId.value, targetIds)
  showApplySheet.value = false
  notify(applyGlobally.value ? '已应用为项目共用搭配' : `已应用到 ${selectedAccountIds.value.length} 个账号`)
}

const createPreset = () => {
  const name = presetName.value.trim()
  if (!name) return
  saveAppearancePreset(name, currentChatUserId.value)
  presetName.value = ''
  showSavePreset.value = false
  notify('当前搭配已保存')
}
</script>

<template>
  <div class="wardrobe-app" :class="{ 'is-dark': globalSettings.darkMode }">
    <Transition name="wardrobe-toast"><div v-if="toast" class="wardrobe-toast" role="status">{{ toast }}</div></Transition>
    <header class="wardrobe-topbar">
      <button class="wardrobe-icon-button" type="button" aria-label="返回" @click="goBack"><svg viewBox="0 0 24 24"><path d="M19 12H5m7-7-7 7 7 7"/></svg></button>
      <div><small>APPEARANCE</small><strong>{{ view === 'home' ? '外观衣柜' : view === 'category' ? selectedCategory.name : view === 'detail' ? selectedStyle.name : view === 'current' ? '当前搭配' : '我的方案' }}</strong></div>
      <button v-if="view === 'current'" class="wardrobe-text-button" type="button" @click="showSavePreset = true">保存</button><span v-else></span>
    </header>

    <main class="wardrobe-scroll">
      <template v-if="view === 'home'">
        <section class="wardrobe-intro"><p>为不同界面保留各自合适的呈现方式。</p></section>
        <button class="current-combination" type="button" @click="view = 'current'">
          <div class="wardrobe-section-head"><div><small>当前搭配</small><strong>{{ currentSchemeName }}</strong></div><span>查看全部</span></div>
          <div class="combination-body">
            <div class="preview-stack"><div v-for="(category, index) in appearanceCategories.slice(0,3)" :key="category.id" :style="{ '--stack-index': index }"><AppearanceStylePreview :category-id="category.id" :style-id="effectiveSelections[category.id]" compact /></div></div>
            <div class="combination-copy"><span v-for="category in appearanceCategories.slice(0,3)" :key="category.id">{{ category.name }} · {{ getAppearanceStyle(category.id, effectiveSelections[category.id]).name }}</span></div>
          </div>
        </button>

        <section class="wardrobe-categories">
          <div class="wardrobe-section-head"><div><small>界面分类</small><strong>按页面挑选</strong></div></div>
          <button v-for="category in appearanceCategories" :key="category.id" class="wardrobe-category-row" type="button" @click="openCategory(category.id)">
            <span class="category-preview"><AppearanceStylePreview :category-id="category.id" :style-id="effectiveSelections[category.id]" compact /></span>
            <span class="category-copy"><strong>{{ category.name }}</strong><small>{{ category.styles.length }} 款样式</small></span>
            <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </section>

        <button class="presets-entry" type="button" @click="view = 'presets'"><span><small>我的方案</small><strong>保存与恢复整套搭配</strong></span><em>{{ appearanceState.presets.length }} 套</em><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>
      </template>

      <template v-else-if="view === 'category'">
        <section class="category-heading"><small>{{ selectedCategory.styles.length }} STYLES</small><h1>{{ selectedCategory.name }}</h1><p>{{ selectedCategory.description }}</p></section>
        <div class="style-gallery">
          <button v-for="style in selectedCategory.styles" :key="style.id" class="style-card" type="button" @click="openDetail(selectedCategory.id, style.id)">
            <span class="style-card-preview"><AppearanceStylePreview :category-id="selectedCategory.id" :style-id="style.id" /></span>
            <span class="style-card-meta"><span><strong>{{ style.name }}</strong><small>{{ style.keywords }}</small></span><em v-if="effectiveSelections[selectedCategory.id] === style.id">使用中</em></span>
          </button>
        </div>
      </template>

      <template v-else-if="view === 'detail'">
        <section class="detail-preview-shell"><AppearanceStylePreview :category-id="selectedCategory.id" :style-id="selectedStyle.id" :dark="previewDark" /></section>
        <div class="preview-mode-switch" role="group" aria-label="预览模式"><button type="button" :class="{ active: !previewDark }" @click="previewDark = false">日间</button><button type="button" :class="{ active: previewDark }" @click="previewDark = true">夜间</button></div>
        <section class="detail-copy"><small>{{ selectedStyle.keywords }}</small><h1>{{ selectedStyle.name }}</h1><p>{{ selectedStyle.description }}</p><dl><div><dt>适用界面</dt><dd>{{ selectedCategory.name }}</dd></div><div><dt>模式</dt><dd>日间与夜间</dd></div></dl></section>
        <button class="wardrobe-primary-button" type="button" :class="{ current: effectiveSelections[selectedCategory.id] === selectedStyle.id }" @click="openApply()">{{ effectiveSelections[selectedCategory.id] === selectedStyle.id ? '使用中 · 调整范围' : '应用此样式' }}</button>
      </template>

      <template v-else-if="view === 'current'">
        <section class="category-heading"><small>CURRENT SET</small><h1>{{ currentSchemeName }}</h1><p>每个界面可以保留自己的样式。</p></section>
        <div class="current-list"><button v-for="category in appearanceCategories" :key="category.id" type="button" @click="openCategory(category.id)"><span class="current-thumb"><AppearanceStylePreview :category-id="category.id" :style-id="effectiveSelections[category.id]" compact /></span><span><small>{{ category.name }}</small><strong>{{ getAppearanceStyle(category.id, effectiveSelections[category.id]).name }}</strong></span><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button></div>
      </template>

      <template v-else>
        <section class="category-heading"><small>SAVED SETS</small><h1>我的方案</h1><p>方案只保存衣柜中的界面样式，不改变壁纸、字体与基础外观。</p></section>
        <button class="save-current-card" type="button" @click="showSavePreset = true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span><strong>保存当前搭配</strong><small>记录当前账号看到的界面组合</small></span></button>
        <div v-if="appearanceState.presets.length" class="preset-list"><article v-for="preset in appearanceState.presets" :key="preset.id"><div><small>{{ new Date(preset.createdAt).toLocaleDateString('zh-CN') }}</small><strong>{{ preset.name }}</strong><p>{{ appearanceCategories.map(category => getAppearanceStyle(category.id, preset.selections[category.id]).name).join(' · ') }}</p></div><footer><button type="button" @click="deleteAppearancePreset(preset.id)">删除</button><button class="apply" type="button" @click="openApply(preset)">应用</button></footer></article></div>
        <div v-else class="wardrobe-empty"><span></span><strong>还没有保存方案</strong><p>把当前多个界面的选择保存下来，以后可以一次恢复。</p></div>
      </template>
    </main>

    <Teleport to="body">
      <Transition name="wardrobe-sheet"><div v-if="showApplySheet" class="wardrobe-sheet-overlay" :class="{ 'is-dark': globalSettings.darkMode }" @click.self="showApplySheet = false"><section class="wardrobe-sheet" role="dialog" aria-modal="true"><header><div><small>APPLY TO</small><h2>应用范围</h2></div><button type="button" aria-label="关闭" @click="showApplySheet = false"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="scope-options"><button type="button" :class="{ active: applyGlobally }" @click="applyGlobally = true"><span><strong>项目共用</strong><small>作为默认样式，也用于以后新增的账号</small></span><i></i></button><button type="button" :class="{ active: !applyGlobally }" @click="applyGlobally = false"><span><strong>指定账号</strong><small>多选当前已有账号并单独覆盖</small></span><i></i></button></div><div v-if="!applyGlobally" class="account-picker"><header><span>选择账号</span><button type="button" @click="selectAllAccounts">{{ selectedAccountIds.length === chatAccounts.length ? '取消全选' : '全选' }}</button></header><button v-for="account in chatAccounts" :key="account.id" type="button" :class="{ selected: selectedAccountIds.includes(account.id) }" @click="toggleAccount(account.id)"><span class="account-avatar">{{ account.name.charAt(0) }}</span><span><strong>{{ account.name }}</strong><small>{{ account.accountId }}</small></span><i><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></i></button></div><footer><button type="button" @click="showApplySheet = false">取消</button><button class="primary" type="button" @click="confirmApply">确认应用</button></footer></section></div></Transition>

      <Transition name="wardrobe-sheet"><div v-if="showSavePreset" class="wardrobe-sheet-overlay center" :class="{ 'is-dark': globalSettings.darkMode }" @click.self="showSavePreset = false"><section class="wardrobe-dialog" role="dialog" aria-modal="true"><header><small>SAVE SET</small><h2>保存当前搭配</h2><p>给这套界面组合起一个名字。</p></header><label><span>方案名称</span><input v-model="presetName" maxlength="20" placeholder="例如：清晨" @keyup.enter="createPreset"></label><footer><button type="button" @click="showSavePreset = false">取消</button><button class="primary" type="button" :disabled="!presetName.trim()" @click="createPreset">保存</button></footer></section></div></Transition>
    </Teleport>
  </div>
</template>

<style scoped src="./AppearanceWardrobe.css"></style>
