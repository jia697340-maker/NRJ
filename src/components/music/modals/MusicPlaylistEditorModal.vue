/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { MusicPlaylist } from '../../../types/music'

const props = defineProps<{ visible: boolean; playlist?: MusicPlaylist | null }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', value: Pick<MusicPlaylist, 'name' | 'description' | 'isPrivate' | 'coverUrl' | 'coverStorage' | 'originalCoverUrl'>): void
}>()
const name = ref('')
const description = ref('')
const isPrivate = ref(false)
const coverKind = ref<'none' | 'local' | 'url'>('none')
const urlStorage = ref<'url-direct' | 'url-cached'>('url-direct')
const coverUrl = ref('')
const localCover = ref('')
const error = ref('')
const busy = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const reset = () => {
  const playlist = props.playlist
  name.value = playlist?.name || ''
  description.value = playlist?.description || ''
  isPrivate.value = Boolean(playlist?.isPrivate)
  error.value = ''
  busy.value = false
  if (playlist?.coverStorage === 'local') {
    coverKind.value = 'local'; localCover.value = playlist.coverUrl || ''; coverUrl.value = ''
  } else if (playlist?.coverStorage === 'url-direct' || playlist?.coverStorage === 'url-cached') {
    coverKind.value = 'url'; urlStorage.value = playlist.coverStorage; coverUrl.value = playlist.originalCoverUrl || playlist.coverUrl || ''; localCover.value = playlist.coverStorage === 'url-cached' ? playlist.coverUrl || '' : ''
  } else {
    coverKind.value = playlist?.coverUrl ? 'url' : 'none'; coverUrl.value = playlist?.coverUrl || ''; localCover.value = ''
  }
}
watch(() => props.visible, visible => { if (visible) reset() })
watch(() => props.playlist?.id, () => { if (props.visible) reset() })

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('图片读取失败'))
  reader.readAsDataURL(blob)
})

const handleFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  error.value = ''
  if (!file.type.startsWith('image/')) { error.value = '请选择图片文件'; return }
  if (file.size > 10 * 1024 * 1024) { error.value = '封面图片不能超过 10MB'; return }
  try { localCover.value = await blobToDataUrl(file); coverKind.value = 'local' }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '图片读取失败' }
}

const submit = async () => {
  const normalizedName = name.value.trim()
  if (!normalizedName) { error.value = '请输入歌单名称'; return }
  error.value = ''
  busy.value = true
  try {
    let savedCover = ''
    let storage: MusicPlaylist['coverStorage']
    let originalCoverUrl: string | undefined
    if (coverKind.value === 'local') {
      if (!localCover.value) throw new Error('请先选择本地封面')
      savedCover = localCover.value; storage = 'local'
    } else if (coverKind.value === 'url') {
      const normalizedUrl = coverUrl.value.trim()
      if (!/^https?:\/\//i.test(normalizedUrl)) throw new Error('请输入有效的 http 或 https 图片地址')
      originalCoverUrl = normalizedUrl
      storage = urlStorage.value
      if (urlStorage.value === 'url-direct') savedCover = normalizedUrl
      else if (props.playlist?.coverStorage === 'url-cached' && props.playlist.originalCoverUrl === normalizedUrl && props.playlist.coverUrl) savedCover = props.playlist.coverUrl
      else {
        const response = await fetch(normalizedUrl)
        if (!response.ok) throw new Error(`图片下载失败（${response.status}）`)
        const blob = await response.blob()
        if (!blob.type.startsWith('image/')) throw new Error('该地址返回的不是图片')
        if (blob.size > 10 * 1024 * 1024) throw new Error('远程封面不能超过 10MB')
        savedCover = await blobToDataUrl(blob)
      }
    }
    emit('save', { name: normalizedName, description: description.value.trim(), isPrivate: isPrivate.value, coverUrl: savedCover || undefined, coverStorage: storage, originalCoverUrl })
  } catch (reason) { error.value = reason instanceof Error ? reason.message : '封面保存失败' }
  finally { busy.value = false }
}
</script>

<template>
  <div v-if="visible" class="editor-mask" @click.self="emit('close')">
    <section class="editor-sheet" role="dialog" aria-modal="true" :aria-label="playlist ? '编辑歌单' : '新建歌单'">
      <header><div><strong>{{ playlist ? '编辑歌单' : '新建歌单' }}</strong><small>名称、简介、封面与私密状态</small></div><button class="close-btn" aria-label="关闭" @click="emit('close')">×</button></header>
      <div class="editor-body">
        <div class="cover-preview" :style="(coverKind === 'local' ? localCover : coverKind === 'url' ? coverUrl : '') ? { backgroundImage: `url(${coverKind === 'local' ? localCover : coverUrl})` } : {}"><span v-if="coverKind === 'none' || (coverKind === 'local' ? !localCover : !coverUrl)">歌单</span></div>
        <label class="field"><span>歌单名称</span><input v-model="name" maxlength="60" placeholder="给歌单起个名字" /></label>
        <label class="field"><span>歌单简介</span><textarea v-model="description" maxlength="300" rows="3" placeholder="写下这份歌单的心情或用途"></textarea><small>{{ description.length }}/300</small></label>
        <div class="field"><span>歌单封面</span><div class="segmented"><button :class="{ active: coverKind === 'none' }" @click="coverKind = 'none'">默认</button><button :class="{ active: coverKind === 'local' }" @click="coverKind = 'local'; fileInput?.click()">本地图片</button><button :class="{ active: coverKind === 'url' }" @click="coverKind = 'url'">图片 URL</button></div></div>
        <input ref="fileInput" class="hidden-input" type="file" accept="image/*" @change="handleFile" />
        <button v-if="coverKind === 'local'" class="secondary-button" @click="fileInput?.click()">{{ localCover ? '重新选择图片' : '选择本地图片' }}</button>
        <template v-if="coverKind === 'url'">
          <label class="field"><span>图片地址</span><input v-model="coverUrl" inputmode="url" placeholder="https://example.com/cover.jpg" /></label>
          <div class="field"><span>保存方式</span><div class="choice-list"><button :class="{ active: urlStorage === 'url-direct' }" @click="urlStorage = 'url-direct'"><b>直接引用</b><small>始终读取原地址</small></button><button :class="{ active: urlStorage === 'url-cached' }" @click="urlStorage = 'url-cached'"><b>下载到本地</b><small>断网或原地址失效仍可显示</small></button></div></div>
        </template>
        <button class="privacy-row" role="switch" :aria-checked="isPrivate" @click="isPrivate = !isPrivate"><span><b>私密歌单</b><small>仅保存在自己的音乐资料中</small></span><i :class="{ active: isPrivate }"><em></em></i></button>
        <p v-if="error" class="error-text">{{ error }}</p>
      </div>
      <footer><button class="cancel-button" @click="emit('close')">取消</button><button class="save-button" :disabled="busy" @click="submit">{{ busy ? '正在保存…' : '保存歌单' }}</button></footer>
    </section>
  </div>
</template>

<style scoped>
.editor-mask{position:absolute;inset:0;z-index:92;display:flex;align-items:flex-end;background:rgba(0,0,0,.42);backdrop-filter:blur(8px)}.editor-sheet{width:100%;max-height:92%;display:flex;flex-direction:column;border:1px solid var(--music-card-border);border-radius:20px 20px 0 0;background:var(--music-card-bg);color:var(--music-text);box-shadow:0 -10px 32px rgba(0,0,0,.14)}header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid var(--music-divider)}header strong,header small{display:block}header strong{font-size:16px}header small{margin-top:3px;color:var(--music-text-sub);font-size:10px}.close-btn{width:32px;height:32px;border:0;border-radius:50%;background:var(--music-pill-bg);color:var(--music-text);font-size:21px}.editor-body{min-height:0;overflow:auto;padding:14px 18px;display:flex;flex-direction:column;gap:13px}.cover-preview{width:78px;height:78px;align-self:center;display:grid;place-items:center;border:1px solid var(--music-card-border);border-radius:14px;background:var(--music-secondary-bg) center/cover no-repeat;color:var(--music-text-sub);font-size:11px;font-weight:700}.field{position:relative;display:flex;min-width:0;flex-direction:column;gap:6px}.field>span{font-size:11px;font-weight:650}.field>small{position:absolute;right:8px;bottom:7px;color:var(--music-text-muted);font-size:9px}.field input,.field textarea{width:100%;box-sizing:border-box;border:1px solid var(--music-card-border);border-radius:11px;outline:0;background:var(--music-secondary-bg);color:var(--music-text);font:inherit;font-size:12px}.field input{height:39px;padding:0 11px}.field textarea{resize:none;padding:10px 11px 24px;line-height:1.5}.field input:focus,.field textarea:focus{border-color:var(--music-text-sub)}.segmented{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:3px;border-radius:11px;background:var(--music-secondary-bg)}.segmented button{height:32px;min-width:0;border:0;border-radius:8px;background:transparent;color:var(--music-text-sub);font-size:10px}.segmented button.active{background:var(--music-card-bg);color:var(--music-text);box-shadow:0 1px 4px rgba(0,0,0,.08)}.hidden-input{display:none}.secondary-button{height:36px;border:1px solid var(--music-card-border);border-radius:10px;background:var(--music-pill-bg);color:var(--music-text);font-size:11px}.choice-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.choice-list button{min-width:0;padding:9px;border:1px solid var(--music-card-border);border-radius:11px;background:var(--music-secondary-bg);color:var(--music-text);text-align:left}.choice-list button.active{border-color:var(--music-text);box-shadow:inset 0 0 0 1px var(--music-text)}.choice-list b,.choice-list small{display:block;overflow:hidden;text-overflow:ellipsis}.choice-list b{font-size:11px;white-space:nowrap}.choice-list small{margin-top:3px;color:var(--music-text-sub);font-size:8px;line-height:1.35}.privacy-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 11px;border:1px solid var(--music-card-border);border-radius:12px;background:var(--music-secondary-bg);color:var(--music-text);text-align:left}.privacy-row span{min-width:0}.privacy-row b,.privacy-row small{display:block}.privacy-row b{font-size:11px}.privacy-row small{margin-top:3px;color:var(--music-text-sub);font-size:9px}.privacy-row i{width:34px;height:20px;flex:0 0 auto;padding:2px;box-sizing:border-box;border-radius:10px;background:var(--music-card-border);transition:.2s}.privacy-row i.active{background:var(--music-text)}.privacy-row em{display:block;width:16px;height:16px;border-radius:50%;background:var(--music-card-bg);transition:.2s}.privacy-row i.active em{transform:translateX(14px)}.error-text{margin:0;color:#dc2626;font-size:10px;line-height:1.4}footer{display:grid;grid-template-columns:1fr 1.35fr;gap:9px;padding:11px 18px calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--music-divider)}footer button{height:40px;border:0;border-radius:12px;font-size:12px;font-weight:700}.cancel-button{background:var(--music-pill-bg);color:var(--music-text)}.save-button{background:var(--music-text);color:var(--music-bg)}.save-button:disabled{opacity:.5}@media(max-width:340px){.editor-body{padding-left:14px;padding-right:14px}.choice-list small{font-size:7.5px}footer{padding-left:14px;padding-right:14px}}
</style>
