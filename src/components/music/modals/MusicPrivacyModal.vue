/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
defineProps<{ visible: boolean; mode: 'management' | 'public-consent'; anonymousAllowed: boolean }>()
const emit = defineEmits<{ (e: 'choose', allowed: boolean): void; (e: 'close'): void; (e: 'clearAccounts'): void }>()
const operatorName = String(import.meta.env.VITE_MUSIC_OPERATOR_NAME || '本站运营者')
const operatorContact = String(import.meta.env.VITE_MUSIC_OPERATOR_CONTACT || '请联系站点提供者')
const retentionDays = Number(import.meta.env.VITE_MUSIC_SESSION_RETENTION_DAYS || 90)
const privacyUrl = String(import.meta.env.VITE_MUSIC_PRIVACY_URL || '').trim()
</script>

<template>
  <div v-if="visible" class="privacy-mask" @click="emit('close')">
    <section class="privacy-sheet" @click.stop>
      <header><div><strong>{{ mode === 'public-consent' ? '启用匿名公共音乐' : '音乐与隐私' }}</strong><small>{{ mode === 'public-consent' ? '仅在你主动启用后发送查询' : '音乐来源与账号连接说明' }}</small></div><button @click="emit('close')">×</button></header>
      <div class="privacy-body">
        <div class="privacy-card"><span class="privacy-mark">匿</span><div><strong>匿名公共音乐</strong><p>启用后，搜索词、IP 地址和基础请求信息会发送给所选公共音乐服务。不会发送聊天、角色、本地音乐或其他应用数据。</p></div></div>
        <template v-if="mode === 'management'">
          <div class="privacy-card"><span class="privacy-mark">码</span><div><strong>扫码登录按需确认</strong><p>只有点击网易云、QQ音乐或B站登录按钮时才会征求同意。各平台凭证分别保存在当前浏览器的 HttpOnly 安全 Cookie 中，不写入数据库，也不返回网页。</p></div></div>
          <div class="privacy-card"><span class="privacy-mark">选</span><div><strong>功能彼此独立</strong><p>拒绝扫码或关闭匿名公共来源，不影响本地音乐；扫码凭证不会提供给公共匿名音源。</p></div></div>
          <div class="privacy-card"><span class="privacy-mark">期</span><div><strong>保存与删除</strong><p>主动退出或 {{ retentionDays }} 天后，当前浏览器的凭证会被清除或失效。可通过下方按钮立即断开账号。</p></div></div>
        </template>
        <div class="privacy-note">{{ anonymousAllowed ? '匿名公共查询当前已启用，可在此随时关闭。' : '匿名公共查询当前未启用。' }}公共服务的稳定性与可用曲目可能变化。</div>
        <div v-if="mode === 'management'" class="privacy-note">运营者：{{ operatorName }}　联系：{{ operatorContact }}</div>
        <a v-if="mode === 'management' && privacyUrl" class="privacy-link" :href="privacyUrl" target="_blank" rel="noopener noreferrer">查看完整《音乐与隐私说明》</a>
        <div class="privacy-actions"><button class="secondary" @click="emit('choose', false)">{{ mode === 'public-consent' ? '暂不启用' : '关闭匿名查询' }}</button><button class="primary" @click="emit('choose', true)">{{ anonymousAllowed ? '保持启用' : '同意并启用' }}</button></div>
        <button v-if="mode === 'management'" class="clear-action" @click="emit('clearAccounts')">断开音乐账号并删除登录凭证</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.privacy-mask{position:absolute;inset:0;z-index:95;display:flex;align-items:flex-end;background:rgba(0,0,0,.42);backdrop-filter:blur(8px)}.privacy-sheet{width:100%;max-height:86%;border:1px solid var(--music-card-border);border-radius:20px 20px 0 0;background:var(--music-card-bg);box-shadow:0 -8px 30px rgba(0,0,0,.12)}header{display:flex;align-items:center;justify-content:space-between;padding:19px 18px 14px;border-bottom:1px solid var(--music-divider)}header strong{display:block;font-size:17px}header small{display:block;margin-top:4px;color:var(--music-text-sub);font-size:11px}header button{width:32px;height:32px;border:0;border-radius:50%;background:var(--music-pill-bg);color:var(--music-text);font-size:22px}.privacy-body{max-height:68vh;overflow:auto;padding:14px 16px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px}.privacy-card{display:flex;gap:11px;padding:13px;border:1px solid var(--music-card-border);border-radius:14px;background:var(--music-secondary-bg)}.privacy-mark{width:34px;height:34px;flex:0 0 auto;display:grid;place-items:center;border:1px solid var(--music-card-border);border-radius:10px;background:var(--music-card-bg);font-size:12px;font-weight:800}.privacy-card strong{font-size:13px}.privacy-card p{margin:5px 0 0;color:var(--music-text-sub);font-size:10px;line-height:1.6}.privacy-note{padding:5px 3px;color:var(--music-text-sub);font-size:9px;line-height:1.6}.privacy-link{display:flex;align-items:center;justify-content:center;min-height:40px;border:1px solid var(--music-card-border);border-radius:12px;background:var(--music-secondary-bg);color:var(--music-text);font-size:11px;font-weight:700;text-decoration:none}.privacy-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.privacy-actions button,.clear-action{min-height:42px;border:1px solid var(--music-card-border);border-radius:12px;font-size:11px;font-weight:750;appearance:none;-webkit-appearance:none}.privacy-actions .secondary,.clear-action{background:var(--music-secondary-bg);color:var(--music-text)}.privacy-actions .primary{background:var(--music-text);color:var(--music-bg)}.clear-action{width:100%;color:#b9504c}
</style>
