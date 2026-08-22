<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  chat: any
  coverUrl: string
  displayName: string
  displaySignature: string
  moments: any[]
  loading: boolean
  canViewMoments: boolean
}>()
const emit = defineEmits<{ (event: 'open-moments'): void; (event: 'copy-id'): void }>()

const photoMoments = computed(() => props.moments.flatMap(moment => {
  const image = Array.isArray(moment.images) ? moment.images[0] : null
  if (!image) return []
  return [{ ...moment, previewImage: typeof image === 'string' ? image : image.url }]
}).filter(item => item.previewImage).slice(0, 3))

const slots = computed(() => Array.from({ length: 3 }, (_, index) => photoMoments.value[index] || null))
const formatDate = (timestamp: number) => new Date(timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }).replace('/', '.')
</script>

<template>
  <section class="profile-magazine">
    <header class="profile-magazine__hero">
      <img v-if="coverUrl" class="profile-magazine__cover" :src="coverUrl" alt="角色主页封面" />
      <div v-else class="profile-magazine__cover-empty"></div>
      <div class="profile-magazine__avatar-wrap"><img v-if="chat.avatarUrl" class="profile-magazine__avatar" :src="chat.avatarUrl" alt="角色头像" /><span v-else>{{ displayName.charAt(0) }}</span></div>
    </header>
    <main class="profile-magazine__body">
      <section class="profile-magazine__identity"><p>PROFILE</p><h1>{{ displayName }}</h1><button v-if="chat.socialProfile?.socialId" type="button" @click="emit('copy-id')">@{{ chat.socialProfile.socialId }}</button><blockquote>{{ displaySignature }}</blockquote></section>
      <section v-if="canViewMoments" class="profile-magazine__moments">
        <header><div><strong>近况</strong><span>/ {{ String(moments.length).padStart(2, '0') }}</span></div><button type="button" @click="emit('open-moments')">查看全部</button></header>
        <div v-if="loading" class="profile-magazine__loading"><i></i><i></i><i></i></div>
        <div v-else class="profile-magazine__photo-row">
          <button v-for="(item,index) in slots" :key="item?.id || `empty-${index}`" type="button" :class="{ empty: !item }" :disabled="!item" @click="item && emit('open-moments')"><template v-if="item"><img :src="item.previewImage" alt="动态照片" loading="lazy" /><span>{{ formatDate(item.time) }}</span></template><i v-else aria-hidden="true"></i></button>
        </div>
        <p v-if="moments[0]?.content" class="profile-magazine__moment-text">{{ moments[0].content }}</p>
      </section>
    </main>
  </section>
</template>

<style scoped>
.profile-magazine{--p-bg:#f8f8f7;--p-surface:#fff;--p-text:#1d1d1f;--p-muted:#78787c;--p-line:#e8e8e6;background:var(--p-bg);color:var(--p-text);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.profile-magazine__hero{position:relative;height:clamp(260px,43vh,420px);background:#fff}.profile-magazine__cover,.profile-magazine__cover-empty{display:block;width:100%;height:100%;object-fit:cover;background:#fff}.profile-magazine__avatar-wrap{position:absolute;left:24px;bottom:-28px;display:grid;width:82px;height:82px;padding:4px;place-items:center;border-radius:18px;background:var(--p-surface);color:#777;font:28px Georgia,serif}.profile-magazine__avatar{width:100%;height:100%;object-fit:cover;border-radius:14px}.profile-magazine__body{padding:52px 24px 30px}.profile-magazine__identity{padding-bottom:31px}.profile-magazine__identity>p{margin:0 0 8px;color:var(--p-muted);font-size:9px;letter-spacing:.18em}.profile-magazine__identity h1{margin:0;font:520 clamp(30px,8vw,42px)/1.15 Georgia,"Songti SC",serif;letter-spacing:.02em}.profile-magazine__identity>button{appearance:none;margin-top:7px;padding:0;border:0;background:transparent;color:var(--p-muted);font:11px monospace}.profile-magazine__identity blockquote{max-width:25em;margin:17px 0 0;color:#4d4d50;font:14px/1.9 Georgia,"Songti SC",serif}.profile-magazine__moments{padding-top:20px;border-top:1px solid var(--p-line)}.profile-magazine__moments>header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.profile-magazine__moments>header strong{font-size:14px;font-weight:560}.profile-magazine__moments>header span{margin-left:6px;color:var(--p-muted);font-size:11px}.profile-magazine__moments>header button{appearance:none;padding:7px 0;border:0;background:transparent;color:var(--p-muted);font:10px inherit}.profile-magazine__photo-row,.profile-magazine__loading{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.profile-magazine__photo-row>button{appearance:none;min-width:0;padding:0;border:0;background:transparent;text-align:left}.profile-magazine__photo-row img,.profile-magazine__photo-row>button>i,.profile-magazine__loading i{display:block;width:100%;aspect-ratio:.78;object-fit:cover;border-radius:4px;background:#ececea}.profile-magazine__photo-row>button.empty>i{border:1px solid var(--p-line);background:linear-gradient(135deg,transparent 49.5%,var(--p-line) 50%,transparent 50.5%),var(--p-surface);opacity:.62}.profile-magazine__photo-row span{display:block;margin-top:7px;color:var(--p-muted);font-size:9px;letter-spacing:.04em}.profile-magazine__moment-text{display:-webkit-box;overflow:hidden;margin:15px 0 0;color:#4b4b4e;font-size:12px;line-height:1.7;-webkit-box-orient:vertical;-webkit-line-clamp:2}.profile-magazine__loading i{animation:pulse-placeholder 1.2s ease-in-out infinite}.profile-magazine__loading i:nth-child(2){animation-delay:.12s}.profile-magazine__loading i:nth-child(3){animation-delay:.24s}@keyframes pulse-placeholder{50%{opacity:.45}}:global(.dark-theme) .profile-magazine{--p-bg:#151617;--p-surface:#1c1d1f;--p-text:#f1f1ee;--p-muted:#919195;--p-line:#2a2b2d}:global(.dark-theme) .profile-magazine__hero,:global(.dark-theme) .profile-magazine__cover-empty{background:#1c1d1f}:global(.dark-theme) .profile-magazine__identity blockquote,:global(.dark-theme) .profile-magazine__moment-text{color:#c0c0bc}:global(.dark-theme) .profile-magazine__photo-row img,:global(.dark-theme) .profile-magazine__loading i{background:#292b2d}
</style>
