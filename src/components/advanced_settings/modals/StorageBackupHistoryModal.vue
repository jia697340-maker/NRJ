/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDataBackup, type BackupAutomationConfig, type BackupSnapshot } from '../../../composables/useDataBackup'

const props = defineProps<{ show: boolean; showConfirm: any }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { listSnapshots, restoreSnapshot, deleteSnapshot, getAutomationConfig, setAutomationConfig } = useDataBackup()
const snapshots = ref<BackupSnapshot[]>([])
const config = ref<BackupAutomationConfig>(getAutomationConfig())
const busy = ref(false)
const showSettings = ref(false)

const refresh = () => { snapshots.value = listSnapshots(); config.value = getAutomationConfig() }
watch(() => props.show, value => { if (value) refresh() })
const formatTime = (value: number) => new Date(value).toLocaleString()
const formatSize = (value: number) => value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`
const saveConfig = () => { setAutomationConfig(config.value); showSettings.value = false }
const restore = async (item: BackupSnapshot) => {
  const ok = await props.showConfirm(`恢复至 ${formatTime(item.createdAt)} 的“${item.reason}”吗？\n\n当前数据不会被删除：恢复前会再自动保存一个恢复点。`, '恢复确认', true, 'danger')
  if (!ok) return
  busy.value = true
  try { await restoreSnapshot(item.id); window.location.reload() } catch { await props.showConfirm('恢复点已不可用或已损坏。', '恢复失败', false) } finally { busy.value = false }
}
const remove = async (item: BackupSnapshot) => {
  const ok = await props.showConfirm(`删除“${item.reason}”恢复点吗？`, '删除确认', true, 'danger')
  if (!ok) return
  await deleteSnapshot(item.id); refresh()
}
</script>

<template>
  <div v-if="show" class="gu-modal-mask" @click="!busy && emit('close')">
    <div class="gu-modal-container" @click.stop>
      <div class="gu-modal-header"><div class="gu-modal-title"><span>{{ showSettings ? '自动备份' : '备份记录' }}</span><i class="gu-seal">存</i></div><button class="gu-close-btn" :disabled="busy" @click="emit('close')">×</button></div>
      <div class="gu-modal-body">
        <template v-if="showSettings">
          <div class="gu-section-title">本机自动备份</div>
          <button class="gu-choice" :class="{ selected: config.enabled }" @click="config.enabled = !config.enabled"><span class="gu-check">{{ config.enabled ? '✓' : '' }}</span><span><b>定期保存本地恢复点</b><small>恢复点只保存在当前浏览器，不会自动上传。</small></span></button>
          <div v-if="config.enabled" class="gu-frequency"><button v-for="days in [1, 7, 30]" :key="days" class="gu-frequency-btn" :class="{ selected: config.intervalDays === days }" @click="config.intervalDays = days">每 {{ days }} 天</button></div>
          <p class="gu-hint">系统最多保留最近 6 个自动或导入前恢复点。</p>
        </template>
        <template v-else>
          <div class="gu-summary">导入或恢复前会自动保存当前状态，可在这里撤回。</div>
          <div v-if="snapshots.length" class="gu-record-list"><div v-for="item in snapshots" :key="item.id" class="gu-record"><div><b>{{ item.reason }}</b><small>{{ formatTime(item.createdAt) }} · {{ formatSize(item.size) }}</small></div><div class="gu-record-actions"><button @click="restore(item)">恢复</button><button class="danger" @click="remove(item)">删除</button></div></div></div>
          <div v-else class="gu-empty">暂时没有本地恢复点</div>
        </template>
      </div>
      <div class="gu-modal-footer"><button class="gu-btn-cancel" @click="showSettings ? showSettings = false : emit('close')">{{ showSettings ? '返回' : '关闭' }}</button><button class="gu-btn-confirm" @click="showSettings ? saveConfig() : showSettings = true">{{ showSettings ? '保存设置' : '自动备份设置' }}</button></div>
    </div>
  </div>
</template>

<style scoped>
.gu-modal-mask{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.9);backdrop-filter:blur(5px)}.gu-modal-container{width:90%;max-width:420px;background:#fff;border:1px solid #e5e5e5;box-shadow:0 10px 30px rgba(0,0,0,.05)}.gu-modal-header,.gu-modal-footer{display:flex;align-items:center;padding:20px 24px}.gu-modal-header{justify-content:space-between;border-bottom:1px dashed #f0f0f0}.gu-modal-title{display:flex;align-items:center;gap:6px;font-family:"STSong","SimSun",serif;font-size:18px;font-weight:bold;letter-spacing:2px}.gu-seal{width:14px;height:14px;display:grid;place-items:center;background:#be2a2a;color:#fff;border-radius:2px;font-style:normal;font-size:10px}.gu-close-btn{appearance:none;border:0;background:none;padding:0;color:#999;font-size:24px;cursor:pointer}.gu-modal-body{display:flex;flex-direction:column;gap:16px;padding:24px;max-height:55vh;overflow:auto}.gu-section-title{font-size:14px;font-weight:bold}.gu-summary{padding:12px;background:#fafafa;border:1px solid #f0f0f0;color:#666;font-size:12px;line-height:1.6}.gu-choice{appearance:none;display:flex;align-items:center;gap:10px;width:100%;padding:13px 0;border:0;border-bottom:1px solid #f0f0f0;background:none;text-align:left;color:#1a1a1a;cursor:pointer}.gu-check{display:grid;place-items:center;width:16px;height:16px;border:1px solid #cfcfcf;color:#fff;font-size:11px}.gu-choice.selected .gu-check{background:#1a1a1a;border-color:#1a1a1a}.gu-choice b,.gu-choice small,.gu-record b,.gu-record small{display:block}.gu-choice small,.gu-record small{margin-top:4px;color:#777;font-size:12px;line-height:1.5}.gu-frequency{display:flex;gap:8px}.gu-frequency-btn{appearance:none;flex:1;border:1px solid #e5e5e5;background:#fff;padding:9px 0;color:#666;font-size:13px;cursor:pointer}.gu-frequency-btn.selected{background:#1a1a1a;border-color:#1a1a1a;color:#fff}.gu-hint{margin:0;color:#999;font-size:12px}.gu-record-list{border-top:1px solid #f0f0f0}.gu-record{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid #f0f0f0}.gu-record b{font-size:14px}.gu-record-actions{display:flex;gap:6px}.gu-record-actions button{appearance:none;border:0;background:none;padding:4px;color:#666;font-family:"STSong","SimSun",serif;font-size:12px;cursor:pointer}.gu-record-actions .danger{color:#be2a2a}.gu-empty{padding:28px 0;text-align:center;color:#999;font-size:13px}.gu-modal-footer{gap:12px;background:#fafafa;border-top:1px solid #e5e5e5}.gu-btn-cancel,.gu-btn-confirm{appearance:none;flex:1;padding:12px 0;border:0;font-size:14px;cursor:pointer}.gu-btn-cancel{border:1px solid #e5e5e5;background:transparent;color:#666}.gu-btn-confirm{background:#1a1a1a;color:#fff}
</style>
