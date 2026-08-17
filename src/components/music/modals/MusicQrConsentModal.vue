/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
defineProps<{ visible: boolean; platformName: string; retentionDays: number }>()
const emit = defineEmits<{ (e: 'cancel'): void; (e: 'confirm'): void }>()
const operatorName = String(import.meta.env.VITE_MUSIC_OPERATOR_NAME || '本站运营者')
const operatorContact = String(import.meta.env.VITE_MUSIC_OPERATOR_CONTACT || '请联系站点提供者')
</script>

<template>
  <div v-if="visible" class="consent-mask" @click.stop="emit('cancel')"><section class="consent-sheet" @click.stop><header><div><strong>{{ platformName }}扫码登录</strong><small>可选账号连接确认</small></div><button @click="emit('cancel')">×</button></header><div class="consent-body"><div class="consent-card"><strong>登录后会处理</strong><p>本次二维码标识、扫码状态，以及 {{ platformName }} 返回的登录凭证；使用个人音乐功能时，还会读取账号昵称、头像、歌单、收藏和已有播放权益。</p></div><div class="consent-card"><strong>凭证如何保护</strong><p>登录凭证只保存在当前浏览器的 HttpOnly 安全 Cookie 中，不写入数据库、不返回网页，也不会发送聊天、角色或本地文件。</p></div><div class="consent-note">拒绝不影响无需账号的音乐功能。你可以在“音乐与隐私”中随时断开连接；主动退出或 {{ retentionDays }} 天后，浏览器凭证会失效。运营者：{{ operatorName }}；联系：{{ operatorContact }}。</div><div class="consent-actions"><button class="secondary" @click="emit('cancel')">暂不登录</button><button class="primary" @click="emit('confirm')">同意并生成二维码</button></div></div></section></div>
</template>

<style scoped>
.consent-mask{position:absolute;inset:0;z-index:96;display:flex;align-items:flex-end;background:rgba(0,0,0,.46);backdrop-filter:blur(8px)}.consent-sheet{width:100%;border:1px solid var(--music-card-border);border-radius:20px 20px 0 0;background:var(--music-card-bg)}header{display:flex;align-items:center;justify-content:space-between;padding:19px 18px 14px;border-bottom:1px solid var(--music-divider)}header strong{display:block;font-size:17px}header small{display:block;margin-top:4px;color:var(--music-text-sub);font-size:11px}header button{width:32px;height:32px;border:0;border-radius:50%;background:var(--music-pill-bg);color:var(--music-text);font-size:22px}.consent-body{padding:14px 16px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px}.consent-card{padding:13px;border:1px solid var(--music-card-border);border-radius:14px;background:var(--music-secondary-bg)}.consent-card strong{font-size:13px}.consent-card p{margin:5px 0 0;color:var(--music-text-sub);font-size:10px;line-height:1.6}.consent-note{padding:4px;color:var(--music-text-sub);font-size:9px;line-height:1.6}.consent-actions{display:grid;grid-template-columns:1fr 1.35fr;gap:8px}.consent-actions button{height:42px;border:1px solid var(--music-card-border);border-radius:12px;font-size:11px;font-weight:750;appearance:none;-webkit-appearance:none}.secondary{background:var(--music-secondary-bg);color:var(--music-text)}.primary{background:var(--music-text);color:var(--music-bg)}
</style>
