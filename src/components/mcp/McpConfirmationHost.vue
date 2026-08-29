<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { McpConfirmationRequest } from '../../types/mcp'
import { answerMcpConfirmation, MCP_CONFIRMATION_EVENT } from '../../services/mcp/permissions'

const queue = ref<McpConfirmationRequest[]>([])
const onRequest = (event: Event) => { const request = (event as CustomEvent<McpConfirmationRequest>).detail; if (request && !queue.value.some(item => item.id === request.id)) queue.value.push(request) }
const answer = (action: 'once' | 'chat' | 'deny') => { const current = queue.value[0]; if (!current) return; answerMcpConfirmation(current.id, action); queue.value.shift() }
onMounted(() => window.addEventListener(MCP_CONFIRMATION_EVENT, onRequest))
onUnmounted(() => window.removeEventListener(MCP_CONFIRMATION_EVENT, onRequest))
</script>

<template>
  <Teleport to="body">
    <div v-if="queue[0]" class="mcp-confirm-backdrop" role="presentation">
      <section class="mcp-confirm-sheet" role="dialog" aria-modal="true" aria-labelledby="mcp-confirm-title">
        <div class="sheet-handle"></div>
        <small>外部工具确认</small>
        <h2 id="mcp-confirm-title">{{ queue[0].characterName || '角色' }}想使用「{{ queue[0].toolName }}」</h2>
        <dl><div><dt>来源</dt><dd>{{ queue[0].connectionName }}</dd></div><div><dt>将执行</dt><dd>{{ queue[0].toolName }}</dd></div></dl>
        <details v-if="Object.keys(queue[0].arguments || {}).length"><summary>查看参数（敏感值已隐藏）</summary><pre>{{ JSON.stringify(queue[0].arguments, null, 2) }}</pre></details>
        <div class="actions"><button type="button" @click="answer('deny')">拒绝</button><button type="button" @click="answer('chat')">本次聊天允许</button><button class="primary" type="button" @click="answer('once')">允许一次</button></div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.mcp-confirm-backdrop{position:fixed;inset:0;z-index:30000;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:rgba(18,22,20,.46);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}.mcp-confirm-sheet{box-sizing:border-box;width:min(100%,520px);max-height:82vh;overflow:auto;padding:8px 17px calc(17px + env(safe-area-inset-bottom));border:1px solid var(--border-color);border-radius:22px 22px 14px 14px;background:var(--card-bg-solid);box-shadow:0 20px 70px rgba(0,0,0,.28);color:var(--text-primary)}.sheet-handle{width:36px;height:4px;margin:0 auto 13px;border-radius:3px;background:var(--border-color)}small{color:#597367;font-size:10px}h2{margin:5px 0 14px;font-size:16px;line-height:1.4}dl{margin:0;padding:10px 12px;border-radius:12px;background:var(--bg-secondary)}dl div{display:grid;grid-template-columns:62px minmax(0,1fr);gap:8px;margin:5px 0;font-size:11px}dt{color:var(--text-tertiary)}dd{margin:0;overflow-wrap:anywhere}details{margin-top:11px;font-size:10px;color:var(--text-secondary)}summary{cursor:pointer}pre{max-height:150px;overflow:auto;padding:9px;border-radius:9px;background:var(--sys-bg-primary);white-space:pre-wrap;overflow-wrap:anywhere;font-size:9px}.actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:15px}.actions button{min-height:39px;padding:7px;border:1px solid var(--border-color);border-radius:11px;background:transparent;color:var(--text-primary);font-size:10px}.actions .primary{border-color:#597367;background:#597367;color:#fff}@media(max-width:370px){.mcp-confirm-backdrop{padding:7px}.actions{grid-template-columns:1fr}.actions button{min-height:35px}}
</style>

