<script setup lang="ts">
import type { AppearanceCategoryId } from '../../appearanceRegistry'

withDefaults(defineProps<{
  categoryId: AppearanceCategoryId
  styleId: string
  dark?: boolean
  compact?: boolean
}>(), { dark: false, compact: false })
</script>

<template>
  <div class="appearance-style-preview" :class="[`category-${categoryId}`, `style-${styleId}`, { 'is-dark': dark, compact }]">
    <div v-if="styleId === 'default'" class="preview-default-profile">
      <div class="preview-default-cover"></div>
      <div class="preview-default-body">
        <strong>角色名字</strong><i></i><p>在这里留下一句属于自己的话。</p>
        <div class="preview-default-card"><small>近况</small><span></span><span></span></div>
      </div>
    </div>
    <div v-else-if="styleId === 'magazine'" class="preview-magazine-profile">
      <div class="preview-magazine-cover"><span></span></div>
      <div class="preview-magazine-body"><small>PROFILE</small><strong>角色名字</strong><p>在这里留下一句属于自己的话。</p><i></i><div><span></span><span></span><span></span></div></div>
    </div>
    <div v-else class="preview-letter-profile">
      <div class="preview-letter-sheet"><div></div></div><span class="preview-letter-avatar"></span>
      <div class="preview-letter-body"><small>PRIVATE NOTE</small><strong>角色名字</strong><i></i><p>她留下的话</p><b></b><div><span></span><span></span><span></span></div></div>
    </div>
  </div>
</template>

<style scoped>
.appearance-style-preview{position:relative;width:100%;height:100%;overflow:hidden;background:#f7f7f6;color:#202124;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.appearance-style-preview.is-dark{background:#171819;color:#efefec}.preview-default-cover{height:43%;background:linear-gradient(145deg,#d9dcdd,#f3f3f1)}.is-dark .preview-default-cover{background:linear-gradient(145deg,#36383a,#222325)}.preview-default-body,.preview-magazine-body,.preview-letter-body{padding:8%}.preview-default-body strong,.preview-magazine-body strong,.preview-letter-body strong{display:block;font-family:Georgia,"Songti SC",serif;font-size:clamp(13px,4vw,25px)}.preview-default-body>i{display:block;width:20%;height:1px;margin:6% 0;background:currentColor}.preview-default-body p,.preview-magazine-body p{margin:3% 0;color:#777;font-size:clamp(5px,1.8vw,10px)}.is-dark p{color:#aaa}.preview-default-card{margin-top:8%;padding:6%;border-radius:10px;background:#fff}.is-dark .preview-default-card{background:#232426}.preview-default-card span{display:block;width:72%;height:4px;margin-top:5px;border-radius:3px;background:#e9e9e7}.is-dark .preview-default-card span{background:#343638}.preview-magazine-cover{position:relative;height:47%;background:#fff;border-bottom:1px solid #ececea}.is-dark .preview-magazine-cover{background:#1d1e20;border-color:#2d2f31}.preview-magazine-cover span{position:absolute;left:8%;bottom:-11%;width:24%;aspect-ratio:1;border:3px solid #fff;border-radius:15%;background:#d8dbdc}.is-dark .preview-magazine-cover span{border-color:#1d1e20;background:#3b3d3f}.preview-magazine-body{padding-top:13%}.preview-magazine-body small,.preview-letter-body small{color:#898a8c;font-size:clamp(4px,1.5vw,8px);letter-spacing:.14em}.preview-magazine-body i{display:block;height:1px;margin:9% 0 6%;background:#e5e5e3}.is-dark .preview-magazine-body i{background:#303235}.preview-magazine-body>div,.preview-letter-body>div{display:grid;grid-template-columns:repeat(3,1fr);gap:4%}.preview-magazine-body>div span{aspect-ratio:.78;background:#e3e4e2;border-radius:2px}.is-dark .preview-magazine-body>div span{background:#303234}.preview-letter-profile{height:100%;padding:8%;background:repeating-linear-gradient(to bottom,transparent 0,transparent 18px,rgba(0,0,0,.025) 19px),#f5f5f3}.is-dark .preview-letter-profile{background:repeating-linear-gradient(to bottom,transparent 0,transparent 18px,rgba(255,255,255,.025) 19px),#191a1b}.preview-letter-sheet{width:78%;margin-left:auto;padding:4% 4% 10%;background:#fff;box-shadow:0 5px 18px rgba(0,0,0,.07);transform:rotate(1deg)}.is-dark .preview-letter-sheet{background:#242527}.preview-letter-sheet div{aspect-ratio:1.5;background:#e1e2e1}.is-dark .preview-letter-sheet div{background:#343638}.preview-letter-avatar{position:absolute;left:9%;top:30%;width:20%;aspect-ratio:1;border:3px solid #f5f5f3;border-radius:12%;background:#d2d5d6}.is-dark .preview-letter-avatar{border-color:#191a1b;background:#37393b}.preview-letter-body{padding:12% 2% 0}.preview-letter-body i{display:block;width:20%;height:1px;margin:5% 0;background:currentColor}.preview-letter-body p{margin:0;color:#888;font-size:clamp(5px,1.6vw,9px)}.preview-letter-body b{display:block;width:68%;height:4px;margin:4% 0 8%;background:#dfe0df}.is-dark .preview-letter-body b{background:#353739}.preview-letter-body>div span{aspect-ratio:.82;border:3px solid #fff;background:#dedfdd;box-shadow:0 3px 8px rgba(0,0,0,.06)}.is-dark .preview-letter-body>div span{border-color:#242527;background:#353739}
</style>
