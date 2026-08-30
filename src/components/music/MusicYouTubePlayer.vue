/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { registerMusicEmbedController, updateMusicEmbedState, type MusicEmbedController } from '../../composables/useMusicPlayer'

const props = defineProps<{ videoId: string; volume: number }>()
const host = ref<HTMLElement | null>(null)

interface YouTubePlayer {
  loadVideoById(id: string): void
  cueVideoById(id: string): void
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  setVolume(value: number): void
  getDuration(): number
  getCurrentTime(): number
  destroy(): void
}

interface YouTubeApi {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number }
}

declare global {
  interface Window {
    YT?: YouTubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

let player: YouTubePlayer | null = null
let progressTimer: number | null = null
let readyPromise: Promise<void> | null = null
let resolveReady: (() => void) | null = null

const stopProgress = () => { if (progressTimer !== null) window.clearInterval(progressTimer); progressTimer = null }
const startProgress = () => {
  stopProgress()
  progressTimer = window.setInterval(() => {
    if (player) updateMusicEmbedState('playing', player.getDuration() || 0, player.getCurrentTime() || 0)
  }, 500)
}

const loadApi = () => {
  if (window.YT?.Player) return Promise.resolve()
  return new Promise<void>(resolve => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve() }
    if (!document.querySelector('script[data-nrj-youtube-player]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.dataset.nrjYoutubePlayer = 'true'
      document.head.appendChild(script)
    }
  })
}

const ensurePlayer = async () => {
  if (player) return
  if (!readyPromise) readyPromise = new Promise<void>(resolve => { resolveReady = resolve })
  await loadApi()
  if (!host.value || !window.YT) throw new Error('官方视频播放器没有准备好')
  player = new window.YT.Player(host.value, {
    videoId: props.videoId,
    width: '100%',
    height: '100%',
    playerVars: { playsinline: 1, controls: 1, rel: 0, origin: window.location.origin },
    events: {
      onReady: () => { player?.setVolume(Math.round(props.volume * 100)); resolveReady?.(); resolveReady = null },
      onStateChange: (event: { data: number }) => {
        const states = window.YT?.PlayerState
        if (!states || !player) return
        if (event.data === states.PLAYING) { updateMusicEmbedState('playing', player.getDuration(), player.getCurrentTime()); startProgress() }
        else if (event.data === states.PAUSED) { updateMusicEmbedState('paused', player.getDuration(), player.getCurrentTime()); stopProgress() }
        else if (event.data === states.BUFFERING) updateMusicEmbedState('buffering', player.getDuration(), player.getCurrentTime())
        else if (event.data === states.ENDED) { stopProgress(); updateMusicEmbedState('ended', player.getDuration(), player.getCurrentTime()) }
      },
      onError: () => { stopProgress(); updateMusicEmbedState('error') }
    }
  })
  await readyPromise
}

const controller: MusicEmbedController = {
  async load(videoId, autoplay) { await ensurePlayer(); if (!player) return; if (autoplay) player.loadVideoById(videoId); else player.cueVideoById(videoId) },
  play() { player?.playVideo() },
  pause() { player?.pauseVideo() },
  seek(seconds) { player?.seekTo(seconds, true) },
  setVolume(value) { player?.setVolume(Math.round(value * 100)) },
  destroy() { stopProgress(); player?.destroy(); player = null }
}

watch(() => props.videoId, value => { if (value && player) player.loadVideoById(value) })
watch(() => props.volume, value => controller.setVolume(value))
onMounted(() => { registerMusicEmbedController(controller) })
onBeforeUnmount(() => { registerMusicEmbedController(null); controller.destroy() })
</script>

<template>
  <div class="youtube-shell">
    <div ref="host" class="youtube-host"></div>
    <small>由 YouTube 官方播放器提供完整内容</small>
  </div>
</template>

<style scoped>
.youtube-shell{width:min(88vw,360px);display:flex;flex-direction:column;gap:7px;align-items:center}.youtube-host{width:100%;aspect-ratio:16/9;min-height:200px;overflow:hidden;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:#111;box-shadow:0 14px 30px rgba(0,0,0,.22)}.youtube-shell small{max-width:100%;overflow:hidden;color:#8e8e93;font-size:9px;text-overflow:ellipsis;white-space:nowrap}@media(max-width:340px){.youtube-shell{width:calc(100vw - 28px)}}
</style>
