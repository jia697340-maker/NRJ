<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { resolveMcpApproval, type McpApprovalRequest } from '../services/mcpApproval'

const request = ref<McpApprovalRequest | null>(null)

const argumentText = computed(() => {
  if (!request.value) return ''
  try {
    const text = JSON.stringify(request.value.arguments, null, 2)
    return text.length > 1800 ? `${text.slice(0, 1800)}\n…` : text
  } catch {
    return String(request.value.arguments ?? '')
  }
})

const handleRequest = (event: Event) => {
  request.value = (event as CustomEvent<McpApprovalRequest>).detail
}

const answer = (approved: boolean) => {
  if (!request.value) return
  resolveMcpApproval(request.value.id, approved)
  request.value = null
}

onMounted(() => window.addEventListener('mcp-approval-request', handleRequest))
onBeforeUnmount(() => {
  window.removeEventListener('mcp-approval-request', handleRequest)
  if (request.value) resolveMcpApproval(request.value.id, false)
})
</script>

<template>
  <Transition name="mcp-confirm">
    <div v-if="request" class="mcp-confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="mcp-confirm-title">
      <section class="mcp-confirm-card">
        <div class="mcp-confirm-mark" aria-hidden="true">M</div>
        <div class="mcp-confirm-copy">
          <p class="mcp-confirm-kicker">MCP 操作确认</p>
          <h2 id="mcp-confirm-title">允许“{{ request.toolName }}”执行吗？</h2>
          <p>{{ request.connectionName }} 将执行一次{{ request.risk === 'external' ? '外部' : request.risk === 'sensitive' ? '敏感' : '写入' }}操作。只有本次允许，不会自动记住。</p>
        </div>
        <pre v-if="argumentText" class="mcp-confirm-args">{{ argumentText }}</pre>
        <div class="mcp-confirm-actions">
          <button type="button" class="mcp-confirm-button quiet" @click="answer(false)">不允许</button>
          <button type="button" class="mcp-confirm-button primary" @click="answer(true)">允许本次</button>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.mcp-confirm-backdrop {
  position: absolute;
  inset: 0;
  z-index: 12000;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 18px;
  background: rgba(20, 20, 20, 0.34);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.mcp-confirm-card {
  width: min(100%, 330px);
  max-height: min(78vh, 520px);
  overflow: auto;
  box-sizing: border-box;
  padding: 18px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.18);
  color: var(--text-primary, #222);
}

.mcp-confirm-mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  margin-bottom: 12px;
  border-radius: 10px;
  background: var(--accent-color, #282828);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

.mcp-confirm-copy { min-width: 0; }
.mcp-confirm-kicker {
  margin: 0 0 4px;
  color: var(--text-secondary, #777);
  font-size: 11px;
  letter-spacing: .06em;
}
.mcp-confirm-copy h2 {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 17px;
  line-height: 1.35;
  font-weight: 650;
}
.mcp-confirm-copy > p:last-child {
  margin: 7px 0 0;
  color: var(--text-secondary, #777);
  font-size: 12px;
  line-height: 1.55;
}
.mcp-confirm-args {
  max-height: 150px;
  margin: 13px 0 0;
  overflow: auto;
  padding: 10px;
  border-radius: 11px;
  background: rgba(0, 0, 0, 0.045);
  color: var(--text-secondary, #666);
  font: 10px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.mcp-confirm-actions {
  display: flex;
  gap: 9px;
  margin-top: 15px;
}
.mcp-confirm-button {
  flex: 1 1 0;
  min-width: 0;
  height: 38px;
  border: 0;
  border-radius: 12px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.mcp-confirm-button.quiet { background: rgba(0, 0, 0, 0.06); color: var(--text-primary, #222); }
.mcp-confirm-button.primary { background: var(--accent-color, #282828); color: #fff; font-weight: 600; }
.mcp-confirm-button:active { transform: scale(.985); }

:global(.is-dark) .mcp-confirm-card {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(38, 38, 38, 0.98);
}
:global(.is-dark) .mcp-confirm-args,
:global(.is-dark) .mcp-confirm-button.quiet { background: rgba(255, 255, 255, 0.08); }

.mcp-confirm-enter-active, .mcp-confirm-leave-active { transition: opacity .18s ease; }
.mcp-confirm-enter-active .mcp-confirm-card, .mcp-confirm-leave-active .mcp-confirm-card { transition: transform .2s ease, opacity .18s ease; }
.mcp-confirm-enter-from, .mcp-confirm-leave-to { opacity: 0; }
.mcp-confirm-enter-from .mcp-confirm-card, .mcp-confirm-leave-to .mcp-confirm-card { opacity: 0; transform: translateY(8px) scale(.98); }

@media (max-width: 340px) {
  .mcp-confirm-backdrop { padding: 12px; }
  .mcp-confirm-card { padding: 15px; border-radius: 17px; }
  .mcp-confirm-copy h2 { font-size: 16px; }
}
</style>
