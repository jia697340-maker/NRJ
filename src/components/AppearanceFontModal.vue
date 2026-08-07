/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { appRegistry } from '../appRegistry'
import { useCustomFonts, type CustomFontRecord } from '../composables/useCustomFonts'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits(['update:visible'])
const {
  records,
  loadedIds,
  loadingIds,
  errors,
  initialize,
  addFont,
  updateFont,
  removeFont,
  downloadFont,
  detectFormat,
  formatSize
} = useCustomFonts()

type ViewMode = 'list' | 'import' | 'edit'
const viewMode = ref<ViewMode>('list')
const sourceMode = ref<'local' | 'url'>('local')
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const urlInput = ref('')
const fontName = ref('')
const selectedScopes = ref<string[]>(['global'])
const editingId = ref<string | null>(null)
const busy = ref(false)
const progress = ref<number | null>(null)
const message = ref('')
const messageTone = ref<'normal' | 'error' | 'warning'>('normal')

const systemScopes = [
  { id: 'system:desktop', name: '桌面与状态栏' },
  { id: 'system:lockscreen', name: '锁屏' }
]
const fontApps = computed(() => appRegistry.filter(app => app.allowCustomFont))
const editingRecord = computed(() => records.find(record => record.id === editingId.value) || null)

watch(() => props.visible, async visible => {
  if (visible) {
    await initialize()
    if (viewMode.value === 'edit' && !editingRecord.value) viewMode.value = 'list'
  }
})

const close = () => {
  if (busy.value) return
  emit('update:visible', false)
  viewMode.value = 'list'
}

const resetDraft = () => {
  sourceMode.value = 'local'
  selectedFile.value = null
  urlInput.value = ''
  fontName.value = ''
  selectedScopes.value = ['global']
  progress.value = null
  message.value = ''
  messageTone.value = 'normal'
  if (fileInputRef.value) fileInputRef.value.value = ''
}

const openImport = () => {
  resetDraft()
  editingId.value = null
  viewMode.value = 'import'
}

const openEdit = (record: CustomFontRecord) => {
  editingId.value = record.id
  fontName.value = record.name
  selectedScopes.value = [...record.scopes]
  message.value = ''
  viewMode.value = 'edit'
}

const goBack = () => {
  if (busy.value) return
  viewMode.value = 'list'
  editingId.value = null
  resetDraft()
}

const setSourceMode = (mode: 'local' | 'url') => {
  if (busy.value) return
  sourceMode.value = mode
  message.value = ''
}

const onFileChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0] || null
  selectedFile.value = file
  message.value = ''
  if (!file) return
  if (!fontName.value.trim()) fontName.value = file.name.replace(/\.[^.]+$/, '')
  try {
    await detectFormat(file)
    if (file.size > 20 * 1024 * 1024) {
      message.value = `字体大小为 ${formatSize(file.size)}，首次载入可能较慢，建议优先使用 WOFF2。`
      messageTone.value = 'warning'
    } else {
      message.value = `已识别 ${formatSize(file.size)} 的字体文件`
      messageTone.value = 'normal'
    }
  } catch (error) {
    message.value = error instanceof Error ? error.message : '无法识别该字体'
    messageTone.value = 'error'
  }
}

const toggleScope = (scope: string) => {
  if (busy.value) return
  if (scope === 'global') {
    selectedScopes.value = ['global']
    return
  }
  const next = selectedScopes.value.filter(item => item !== 'global')
  const index = next.indexOf(scope)
  if (index >= 0) next.splice(index, 1)
  else next.push(scope)
  selectedScopes.value = next.length ? next : ['global']
}

const importFont = async () => {
  if (busy.value) return
  message.value = ''
  let blob: Blob
  let fileName: string
  try {
    busy.value = true
    progress.value = sourceMode.value === 'url' ? 0 : null
    if (sourceMode.value === 'local') {
      if (!selectedFile.value) throw new Error('请先选择字体文件')
      blob = selectedFile.value
      fileName = selectedFile.value.name
    } else {
      const url = urlInput.value.trim()
      if (!url) throw new Error('请先填写字体直链')
      blob = await downloadFont(url, value => { progress.value = value })
      const parsed = new URL(url)
      fileName = decodeURIComponent(parsed.pathname.split('/').pop() || '网络字体')
    }
    const record = await addFont(blob, {
      name: fontName.value,
      fileName,
      sourceType: sourceMode.value,
      sourceUrl: sourceMode.value === 'url' ? urlInput.value.trim() : undefined,
      scopes: selectedScopes.value
    })
    if (errors[record.id]) throw new Error(errors[record.id])
    message.value = '字体已导入并保存在本机'
    messageTone.value = 'normal'
    viewMode.value = 'list'
    resetDraft()
  } catch (error) {
    message.value = error instanceof Error ? error.message : '字体导入失败'
    messageTone.value = 'error'
  } finally {
    busy.value = false
    progress.value = null
  }
}

const saveEdit = async () => {
  if (!editingRecord.value || busy.value) return
  busy.value = true
  try {
    await updateFont(editingRecord.value.id, { name: fontName.value, scopes: selectedScopes.value })
    viewMode.value = 'list'
    editingId.value = null
  } finally {
    busy.value = false
  }
}

const toggleEnabled = async (record: CustomFontRecord) => {
  await updateFont(record.id, { enabled: !record.enabled })
}

const deleteFont = async (record: CustomFontRecord) => {
  if (busy.value) return
  busy.value = true
  try {
    await removeFont(record.id)
    if (editingId.value === record.id) goBack()
  } finally {
    busy.value = false
  }
}

const scopeSummary = (record: CustomFontRecord) => {
  if (record.scopes.includes('global')) return '全部界面'
  const names = record.scopes.map(scope => {
    if (scope === 'system:desktop') return '桌面与状态栏'
    if (scope === 'system:lockscreen') return '锁屏'
    if (scope.startsWith('app:')) return appRegistry.find(app => app.id === scope.slice(4))?.name || scope.slice(4)
    return scope
  })
  if (names.length <= 2) return names.join('、')
  return `${names.slice(0, 2).join('、')}等 ${names.length} 个区域`
}

const statusText = (record: CustomFontRecord) => {
  if (!record.enabled) return '已停用'
  if (loadingIds.has(record.id)) return '加载中'
  if (errors[record.id]) return '加载失败'
  if (loadedIds.has(record.id)) return '已生效'
  return '按需加载'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="soft-fade">
      <div v-if="visible" class="soft-modal-overlay font-modal-overlay" @click.self="close">
      <section class="soft-modal-panel font-modal-panel" @click.stop>
        <div class="soft-modal-header font-modal-header">
          <button v-if="viewMode !== 'list'" class="font-back-btn" type="button" :disabled="busy" @click="goBack">
            <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span class="title">{{ viewMode === 'list' ? '自定义字体' : (viewMode === 'edit' ? '字体作用范围' : '导入字体') }}</span>
          <button class="close-btn" type="button" :disabled="busy" @click="close">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <template v-if="viewMode === 'list'">
          <div class="font-intro">
            <div class="font-intro-mark">Aa</div>
            <div>
              <div class="font-intro-title">字体库</div>
              <div class="font-intro-desc">URL 字体会先下载并保存在本机，之后不再依赖图床。</div>
            </div>
          </div>

          <div class="font-scroll-content">
            <div v-if="records.length === 0" class="font-empty">
              <div class="font-empty-sample">粘人精</div>
              <div class="font-empty-title">还没有导入字体</div>
              <div class="font-empty-desc">支持 WOFF2、WOFF、TTF 与 OTF</div>
            </div>

            <div v-else class="font-record-list">
              <div v-for="record in records" :key="record.id" class="font-record-card" :class="{ disabled: !record.enabled }">
                <div class="font-record-top" @click="openEdit(record)">
                  <div class="font-record-sample" :style="loadedIds.has(record.id) ? { fontFamily: `'${record.family}'` } : {}">字</div>
                  <div class="font-record-info">
                    <div class="font-record-name">{{ record.name }}</div>
                    <div class="font-record-meta">{{ record.format.toUpperCase() }} · {{ formatSize(record.size) }} · {{ scopeSummary(record) }}</div>
                    <div v-if="errors[record.id]" class="font-record-error">{{ errors[record.id] }}</div>
                  </div>
                  <div class="font-record-state" :class="{ error: !!errors[record.id] }">{{ statusText(record) }}</div>
                </div>
                <div class="font-record-actions">
                  <button class="font-text-btn" type="button" @click="openEdit(record)">范围</button>
                  <button class="font-text-btn" type="button" @click="toggleEnabled(record)">{{ record.enabled ? '停用' : '启用' }}</button>
                  <button class="font-text-btn danger" type="button" @click="deleteFont(record)">删除</button>
                </div>
              </div>
            </div>
          </div>

          <div class="font-bottom-action">
            <button class="font-primary-btn" type="button" @click="openImport">导入新字体</button>
          </div>
        </template>

        <template v-else>
          <div class="font-scroll-content font-editor-scroll">
            <template v-if="viewMode === 'import'">
              <div class="font-section-title">字体来源</div>
              <div class="font-segmented">
                <button type="button" :class="{ active: sourceMode === 'local' }" @click="setSourceMode('local')">本地上传</button>
                <button type="button" :class="{ active: sourceMode === 'url' }" @click="setSourceMode('url')">URL 导入</button>
              </div>

              <input ref="fileInputRef" class="font-hidden-input" type="file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" @change="onFileChange" />
              <button v-if="sourceMode === 'local'" class="font-source-card" type="button" @click="fileInputRef?.click()">
                <span class="font-source-icon">Aa</span>
                <span class="font-source-copy">
                  <strong>{{ selectedFile ? selectedFile.name : '选择字体文件' }}</strong>
                  <small>{{ selectedFile ? formatSize(selectedFile.size) : '文件仅保存在当前设备' }}</small>
                </span>
                <span class="font-source-link">{{ selectedFile ? '更换' : '选择' }}</span>
              </button>

              <div v-else class="font-url-area">
                <input v-model="urlInput" class="soft-input font-url-input" type="url" inputmode="url" placeholder="粘贴字体文件直链" :disabled="busy" />
                <div class="font-url-tip">图床必须允许跨域读取；导入成功后会自动缓存到本机。</div>
              </div>
            </template>

            <div class="font-section-title">显示名称</div>
            <input v-model="fontName" class="soft-input font-name-input" type="text" placeholder="自动使用文件名" :disabled="busy" />

            <div class="font-preview-card" :style="editingRecord && loadedIds.has(editingRecord.id) ? { fontFamily: `'${editingRecord.family}'` } : {}">
              <div class="font-preview-main">春风有信，花开有期</div>
              <div class="font-preview-sub">Clingy · 0123456789</div>
            </div>

            <div class="font-section-title">作用范围</div>
            <div class="font-scope-list">
              <button class="font-scope-row" type="button" @click="toggleScope('global')">
                <span><strong>全部界面</strong><small>包含以后新增的 APP</small></span>
                <span class="soft-toggle" :class="{ 'is-active': selectedScopes.includes('global') }"><span class="soft-toggle-knob"></span></span>
              </button>
              <button v-for="scope in systemScopes" :key="scope.id" class="font-scope-row" type="button" @click="toggleScope(scope.id)">
                <span><strong>{{ scope.name }}</strong></span>
                <span class="soft-toggle" :class="{ 'is-active': selectedScopes.includes(scope.id) }"><span class="soft-toggle-knob"></span></span>
              </button>
              <button v-for="app in fontApps" :key="app.id" class="font-scope-row" type="button" @click="toggleScope(`app:${app.id}`)">
                <span><strong>{{ app.name }}</strong><small v-if="!app.available">待应用上线后自动生效</small></span>
                <span class="soft-toggle" :class="{ 'is-active': selectedScopes.includes(`app:${app.id}`) }"><span class="soft-toggle-knob"></span></span>
              </button>
            </div>

            <div v-if="message" class="font-message" :class="messageTone">{{ message }}</div>
            <div v-if="busy && sourceMode === 'url' && progress !== null" class="font-progress">
              <div class="font-progress-bar" :style="{ width: `${progress}%` }"></div>
              <span>{{ progress >= 100 ? '正在验证字体…' : `正在导入 ${progress}%` }}</span>
            </div>
          </div>

          <div class="font-bottom-action two-actions">
            <button class="font-secondary-btn" type="button" :disabled="busy" @click="goBack">取消</button>
            <button class="font-primary-btn" type="button" :disabled="busy" @click="viewMode === 'edit' ? saveEdit() : importFont()">
              {{ busy ? '处理中…' : (viewMode === 'edit' ? '保存范围' : '导入并应用') }}
            </button>
          </div>
        </template>
      </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@import './AppearanceSettings.css';

.font-modal-overlay { padding: 18px; }
.font-modal-panel { width: min(410px, calc(100% - 36px)); height: min(720px, 88vh); overflow: hidden; }
.font-modal-header { flex: 0 0 auto; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; }
.font-back-btn { position: absolute; left: 14px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 50%; background: transparent; color: var(--text-secondary); cursor: pointer; }
.font-back-btn:disabled, .close-btn:disabled { opacity: .4; cursor: default; }
.font-intro { display: flex; gap: 13px; align-items: center; margin: 16px 18px 8px; padding: 14px; border-radius: 16px; background: rgba(255,255,255,.4); border: 1px solid var(--border-color); }
.font-intro-mark { flex: 0 0 46px; height: 46px; border-radius: 14px; display: flex; align-items: center; justify-content: center; background: var(--card-bg-solid); box-shadow: 0 3px 10px var(--shadow-color); color: var(--text-primary); font-family: Georgia, serif; font-size: 19px; }
.font-intro-title { color: var(--text-primary); font-size: 14px; font-weight: 600; margin-bottom: 3px; }
.font-intro-desc { color: var(--text-tertiary); font-size: 11px; line-height: 1.55; }
.font-scroll-content { flex: 1; min-height: 0; overflow-y: auto; padding: 10px 18px 18px; scrollbar-width: none; }
.font-scroll-content::-webkit-scrollbar { display: none; }
.font-empty { padding: 48px 16px; text-align: center; color: var(--text-tertiary); }
.font-empty-sample { width: 72px; height: 72px; margin: 0 auto 14px; border-radius: 22px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.42); border: 1px solid var(--border-color); font-family: serif; font-size: 20px; color: var(--text-secondary); }
.font-empty-title { color: var(--text-secondary); font-size: 14px; margin-bottom: 5px; }
.font-empty-desc { font-size: 11px; }
.font-record-list { display: flex; flex-direction: column; gap: 12px; }
.font-record-card { border: 1px solid var(--border-color); border-radius: 16px; background: rgba(255,255,255,.34); overflow: hidden; transition: opacity .2s; }
.font-record-card.disabled { opacity: .58; }
.font-record-top { padding: 13px; display: flex; align-items: center; gap: 11px; cursor: pointer; }
.font-record-sample { flex: 0 0 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: var(--card-bg-solid); color: var(--text-primary); font-size: 20px; box-shadow: 0 2px 7px var(--shadow-color); }
.font-record-info { flex: 1; min-width: 0; }
.font-record-name { color: var(--text-primary); font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.font-record-meta { color: var(--text-tertiary); font-size: 10px; margin-top: 4px; line-height: 1.35; }
.font-record-error { color: #c65d5d; font-size: 10px; margin-top: 3px; }
.font-record-state { flex: 0 0 auto; color: var(--text-secondary); font-size: 10px; padding: 4px 7px; border-radius: 10px; background: var(--sys-bg-tertiary); }
.font-record-state.error { color: #c65d5d; }
.font-record-actions { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--border-color); }
.font-text-btn { border: none; border-right: 1px solid var(--border-color); background: transparent; padding: 10px 4px; color: var(--text-secondary); font-size: 11px; cursor: pointer; }
.font-text-btn:last-child { border-right: none; }
.font-text-btn.danger { color: #c65d5d; }
.font-bottom-action { flex: 0 0 auto; padding: 12px 18px 17px; border-top: 1px solid var(--border-color); background: rgba(255,255,255,.2); }
.font-bottom-action.two-actions { display: flex; gap: 10px; }
.font-primary-btn, .font-secondary-btn { min-height: 43px; border: none; border-radius: 14px; padding: 0 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
.font-primary-btn { width: 100%; background: var(--text-primary); color: var(--sys-bg-primary); }
.font-secondary-btn { flex: .7; background: var(--sys-bg-tertiary); color: var(--text-secondary); }
.two-actions .font-primary-btn { flex: 1.3; }
.font-primary-btn:disabled, .font-secondary-btn:disabled { opacity: .48; cursor: default; }
.font-editor-scroll { padding-top: 16px; }
.font-section-title { margin: 2px 2px 9px; color: var(--text-secondary); font-size: 11px; letter-spacing: 1px; }
.font-section-title:not(:first-child) { margin-top: 19px; }
.font-segmented { display: grid; grid-template-columns: 1fr 1fr; padding: 3px; border-radius: 13px; background: var(--sys-bg-tertiary); }
.font-segmented button { border: none; border-radius: 10px; padding: 9px; background: transparent; color: var(--text-tertiary); font-size: 12px; cursor: pointer; }
.font-segmented button.active { background: var(--card-bg-solid); color: var(--text-primary); box-shadow: 0 2px 8px var(--shadow-color); }
.font-hidden-input { display: none; }
.font-source-card { width: 100%; margin-top: 12px; border: 1px solid var(--border-color); border-radius: 15px; background: rgba(255,255,255,.34); padding: 13px; display: flex; align-items: center; gap: 11px; text-align: left; cursor: pointer; color: var(--text-primary); }
.font-source-icon { flex: 0 0 39px; height: 39px; border-radius: 11px; display: flex; align-items: center; justify-content: center; background: var(--card-bg-solid); font-family: Georgia, serif; box-shadow: 0 2px 7px var(--shadow-color); }
.font-source-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.font-source-copy strong { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.font-source-copy small { color: var(--text-tertiary); font-size: 10px; margin-top: 3px; }
.font-source-link { color: var(--text-secondary); font-size: 11px; }
.font-url-area { margin-top: 12px; }
.font-url-input, .font-name-input { width: 100%; background: rgba(255,255,255,.38); color: var(--text-primary); box-sizing: border-box; padding: 12px 13px; }
.font-url-tip { color: var(--text-tertiary); font-size: 10px; line-height: 1.5; padding: 7px 2px 0; }
.font-preview-card { margin-top: 12px; padding: 18px 14px; text-align: center; border: 1px solid var(--border-color); border-radius: 15px; background: rgba(255,255,255,.28); color: var(--text-primary); }
.font-preview-main { font-size: 18px; margin-bottom: 7px; }
.font-preview-sub { color: var(--text-secondary); font-size: 11px; letter-spacing: .5px; }
.font-scope-list { border: 1px solid var(--border-color); border-radius: 15px; overflow: hidden; background: rgba(255,255,255,.28); }
.font-scope-row { width: 100%; min-height: 52px; padding: 9px 12px; border: none; border-bottom: 1px solid var(--border-color); background: transparent; color: var(--text-primary); display: flex; align-items: center; justify-content: space-between; text-align: left; cursor: pointer; }
.font-scope-row:last-child { border-bottom: none; }
.font-scope-row > span:first-child { display: flex; flex-direction: column; min-width: 0; }
.font-scope-row strong { font-size: 12px; font-weight: 500; }
.font-scope-row small { color: var(--text-tertiary); font-size: 9px; margin-top: 3px; }
.font-scope-row .soft-toggle { transform: scale(.82); transform-origin: right center; flex: 0 0 auto; }
.font-message { margin-top: 12px; padding: 10px 12px; border-radius: 12px; background: var(--sys-bg-tertiary); color: var(--text-secondary); font-size: 10px; line-height: 1.5; }
.font-message.error { color: #b94c4c; background: rgba(185,76,76,.09); }
.font-message.warning { color: #9a6c2d; background: rgba(154,108,45,.09); }
.font-progress { height: 34px; margin-top: 12px; border-radius: 11px; overflow: hidden; position: relative; background: var(--sys-bg-tertiary); display: flex; align-items: center; justify-content: center; }
.font-progress-bar { position: absolute; inset: 0 auto 0 0; background: rgba(127,155,168,.25); transition: width .18s; }
.font-progress span { position: relative; color: var(--text-secondary); font-size: 10px; }

@media (max-height: 620px) {
  .font-modal-panel { height: 94vh; }
  .font-intro { margin-top: 10px; padding: 10px; }
}
</style>
