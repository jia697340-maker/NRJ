/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { registerMusicEmbedController, updateMusicEmbedState, type MusicEmbedController } from '../../composables/useMusicPlayer'

const props = defineProps<{ embedId: string; volume: number; duration: number }>()
const frame = ref<HTMLIFrameElement | null>(null)
let progressTimer: number | null = null
let currentTime = 0
const frameUrl = computed(() => {
  const [bvid, page = '1'] = props.embedId.split(':')
  return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&p=${encodeURIComponent(page)}&high_quality=1&autoplay=0`
})
const stopProgress = () => { if (progressTimer !== null) window.clearInterval(progressTimer); progressTimer = null }
const command = (func: string, args?: string) => frame.value?.contentWindow?.postMessage({ event: 'command', func, args }, '*')

const controller: MusicEmbedController = {
  async load() { currentTime = 0; updateMusicEmbedState('paused', props.duration, 0) },
  play() {
    command('play'); stopProgress(); updateMusicEmbedState('playing', props.duration, currentTime)
    progressTimer = window.setInterval(() => { currentTime = Math.min(props.duration, currentTime + .5); updateMusicEmbedState('playing', props.duration, currentTime) }, 500)
  },
  pause() { command('pause'); stopProgress(); updateMusicEmbedState('paused', props.duration, currentTime) },
  seek(seconds) { currentTime = seconds; command('seek', String(seconds)); updateMusicEmbedState('paused', props.duration, currentTime) },
  setVolume(value) { command('volume', String(value)) },
  destroy() { stopProgress() }
}

const onLoad = () => { updateMusicEmbedState('paused', props.duration, currentTime) }
watch(() => props.volume, value => controller.setVolume(value))
onMounted(() => { registerMusicEmbedController(controller) })
onBeforeUnmount(() => { registerMusicEmbedController(null); controller.destroy() })
</script>

<template>
  <div class="bilibili-shell">
    <iframe ref="frame" :src="frameUrl" title="Bilibili 公开视频播放器" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen @load="onLoad"></iframe>
    <small>公开视频可能因发布者或平台调整而变化；请优先使用视频内播放控件</small>
  </div>
</template>

<style scoped>
.bilibili-shell{width:min(88vw,360px);display:flex;flex-direction:column;gap:7px;align-items:center}.bilibili-shell iframe{width:100%;aspect-ratio:16/9;min-height:200px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:#111;box-shadow:0 14px 30px rgba(0,0,0,.22)}.bilibili-shell small{max-width:100%;overflow:hidden;color:#8e8e93;font-size:9px;text-overflow:ellipsis;white-space:nowrap}@media(max-width:340px){.bilibili-shell{width:calc(100vw - 28px)}}
</style>
