/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
defineProps<{ visible: boolean; mode: 'management' | 'public-consent'; anonymousAllowed: boolean }>()
const emit = defineEmits<{ (e: 'choose', allowed: boolean): void; (e: 'close'): void; (e: 'clearAccounts'): void }>()
const operatorName = String(import.meta.env.VITE_MUSIC_OPERATOR_NAME || '本站运营者')
const operatorContact = String(import.meta.env.VITE_MUSIC_OPERATOR_CONTACT || '请联系站点提供者')
const privacyUrl = String(import.meta.env.VITE_MUSIC_PRIVACY_URL || '').trim()
</script>

<template>
  <div v-if="visible" class="privacy-mask" @click="emit('close')">
    <section class="privacy-sheet" @click.stop>
      <header><div><strong>{{ mode === 'public-consent' ? '启用匿名公共音乐' : '音乐与隐私' }}</strong><small>{{ mode === 'public-consent' ? '仅在你主动启用后发送查询' : '音乐来源与账号连接说明' }}</small></div><button @click="emit('close')">×</button></header>
      <div class="privacy-body">
        <div class="privacy-card"><span class="privacy-mark">匿</span><div><strong>匿名公共音乐</strong><p>启用后，搜索词、IP 地址和基础请求信息可能依次发送给多个已启用公共音乐服务，当前一家没有结果或不可用时才尝试下一家。不会发送聊天、角色、本地音乐或其他应用数据。</p></div></div>
        <template v-if="mode === 'management'">
          <div class="privacy-card"><span class="privacy-mark">码</span><div><strong>扫码登录按需确认</strong><p>只有点击网易云、QQ音乐或B站登录按钮时才会征求同意。平台凭证保存在站点服务端隔离会话存储中；浏览器只保存随机的 HttpOnly、Secure 会话标识，凭据不返回网页。</p></div></div>
          <div class="privacy-card"><span class="privacy-mark">选</span><div><strong>功能彼此独立</strong><p>拒绝扫码或关闭匿名公共来源，不影响本地音乐；扫码凭证不会提供给公共匿名音源。</p></div></div>
          <div class="privacy-card"><span class="privacy-mark">期</span><div><strong>保存与删除</strong><p>每次扫码前由用户自行选择仅本次会话、固定天数或自定义期限，并必须手动输入完整承诺。主动退出、期限届满或平台使会话失效后，账号连接会终止；可通过下方按钮立即删除。</p></div></div>
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
.privacy-mask{position:fixed;inset:0;z-index:1005;display:flex;align-items:center;justify-content:center;padding:20px 16px;background:rgba(0,0,0,.45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);animation:fadeIn .2s ease-out}.privacy-sheet{width:100%;max-width:440px;max-height:85vh;border:1px solid var(--music-card-border);border-radius:20px;background:var(--music-card-bg);box-shadow:0 12px 40px rgba(0,0,0,.18);display:flex;flex-direction:column;overflow:hidden;animation:scaleIn .2s cubic-bezier(0.16, 1, 0.3, 1)}@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes scaleIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 14px;border-bottom:1px solid var(--music-divider);flex-shrink:0}header strong{display:block;font-size:16px;font-weight:700}header small{display:block;margin-top:3px;color:var(--music-text-sub);font-size:11px}header button{width:30px;height:30px;border:0;border-radius:50%;background:var(--music-pill-bg);color:var(--music-text);font-size:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:opacity .15s}header button:active{opacity:.7}.privacy-body{flex:1;overflow-y:auto;padding:16px 20px 20px;display:flex;flex-direction:column;gap:12px;-webkit-overflow-scrolling:touch}.privacy-card{display:flex;gap:12px;padding:14px;border:1px solid var(--music-card-border);border-radius:14px;background:var(--music-secondary-bg);align-items:flex-start}.privacy-mark{width:36px;height:36px;flex:0 0 auto;display:grid;place-items:center;border:1px solid var(--music-card-border);border-radius:10px;background:var(--music-card-bg);font-size:13px;font-weight:800}.privacy-card strong{font-size:13px;display:block;color:var(--music-text)}.privacy-card p{margin:4px 0 0;color:var(--music-text-sub);font-size:11px;line-height:1.55}.privacy-note{padding:2px 4px;color:var(--music-text-sub);font-size:11px;line-height:1.55}.privacy-link{display:flex;align-items:center;justify-content:center;min-height:40px;border:1px solid var(--music-card-border);border-radius:12px;background:var(--music-secondary-bg);color:var(--music-text);font-size:11px;font-weight:700;text-decoration:none}.privacy-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}.privacy-actions button,.clear-action{min-height:42px;border:1px solid var(--music-card-border);border-radius:12px;font-size:12px;font-weight:700;appearance:none;-webkit-appearance:none;cursor:pointer;transition:transform .15s,opacity .15s}.privacy-actions button:active,.clear-action:active{transform:scale(0.98);opacity:.9}.privacy-actions .secondary,.clear-action{background:var(--music-secondary-bg);color:var(--music-text)}.privacy-actions .primary{background:var(--music-text);color:var(--music-bg)}.clear-action{width:100%;color:#b9504c}
</style>
