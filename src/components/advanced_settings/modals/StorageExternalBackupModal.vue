<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BACKUP_CATALOG, useDataBackup, type BackupModule } from '../../../composables/useDataBackup'
import { useGitHubBackup, type GitHubBackupConfig, type GitHubBackupEntry } from '../../../composables/useGitHubBackup'

const props = defineProps<{ show: boolean; showConfirm: any; destination: 'github' | 'email' }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { createBackupFile, readBackupFile, restoreBackupData, saveSnapshot, getAutomationPlans, setAutomationPlan, getPendingEmailBackup, readPendingEmailBackup, clearPendingEmailBackup } = useDataBackup()
const { testConnection, uploadBackup, listBackups, downloadBackup, deleteBackup } = useGitHubBackup()
const step = ref<'scope' | 'categories' | 'confirm' | 'cloud' | 'tutorial'>('scope')
const selected = ref<BackupModule[]>([])
const expanded = ref<string[]>([])
const usePassword = ref(true)
const password = ref('')
const confirmPassword = ref('')
const cloudPassword = ref('')
const restoreMode = ref<'merge' | 'overwrite'>('merge')
const isWorking = ref(false)
const status = ref('')
const autoEnabled = ref(false)
const intervalDays = ref(7)
const cloudBackups = ref<GitHubBackupEntry[]>([])
const config = ref<GitHubBackupConfig>({ token: '', repository: '', branch: 'main', retention: 10, encryptionPassword: '' })
const groups = computed(() => Array.from(new Set(BACKUP_CATALOG.map(item => item.group))).map(group => ({ group, items: BACKUP_CATALOG.filter(item => item.group === group) })))
const title = computed(() => props.destination === 'github' ? 'GitHub 私有仓库备份' : '邮箱备份')
const scopeTitle = computed(() => step.value === 'categories' ? '分类备份' : step.value === 'confirm' ? '确认备份' : step.value === 'cloud' ? 'GitHub 云端记录' : step.value === 'tutorial' ? `${title.value}教程` : title.value)
const selectedAll = computed(() => selected.value.length === BACKUP_CATALOG.length)
const formatSize = (value: number) => value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`

watch(() => props.show, visible => {
  if (!visible) return
  const stored = localStorage.getItem('github_backup_config')
  if (props.destination === 'github' && stored) { try { config.value = { ...config.value, ...JSON.parse(stored) } } catch { /* ignore */ } }
  step.value = 'scope'; selected.value = []; expanded.value = []; password.value = ''; confirmPassword.value = ''; cloudPassword.value = ''
  const plan = getAutomationPlans().find(item => item.destination === props.destination)
  if (plan) { autoEnabled.value = plan.enabled; intervalDays.value = plan.intervalDays }
})

const toggleItem = (id: string) => { const index = selected.value.indexOf(id); if (index >= 0) selected.value.splice(index, 1); else selected.value.push(id) }
const toggleGroup = (items: string[]) => { const all = items.every(id => selected.value.includes(id)); selected.value = all ? selected.value.filter(id => !items.includes(id)) : Array.from(new Set([...selected.value, ...items])) }
const backupModules = () => selected.value.length === 0 ? ['__full__'] : selected.value
const backupName = () => `粘人精备份-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.nrtbackup`
const downloadFallback = (file: File) => { const url = URL.createObjectURL(file); const link = document.createElement('a'); link.href = url; link.download = file.name; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url) }

const persistConfig = () => {
  if (props.destination === 'github') localStorage.setItem('github_backup_config', JSON.stringify(config.value))
}

const saveAutomation = () => {
  setAutomationPlan({ destination: props.destination, enabled: autoEnabled.value, intervalDays: intervalDays.value, modules: backupModules(), lastRunAt: getAutomationPlans().find(item => item.destination === props.destination)?.lastRunAt || 0 })
  persistConfig()
}

const toggleAutomation = async () => {
  if (!autoEnabled.value) {
    if (!usePassword.value || !password.value || password.value !== confirmPassword.value) {
      await props.showConfirm('自动备份必须先设置并确认加密密码。密码只保存在当前设备，换机恢复时仍需输入。', '需要加密密码', false)
      return
    }
    if (props.destination === 'github') config.value.encryptionPassword = password.value
    else localStorage.setItem('email_backup_password', password.value)
    autoEnabled.value = true
  } else {
    autoEnabled.value = false
    if (props.destination === 'github') config.value.encryptionPassword = ''
    else localStorage.removeItem('email_backup_password')
  }
  saveAutomation()
}

const testGitHub = async () => {
  if (!config.value.token.trim() || !config.value.repository.trim()) return void await props.showConfirm('请先填写仓库和访问令牌。', '信息不完整', false)
  isWorking.value = true; status.value = '正在测试仓库权限…'
  try {
    const result = await testConnection(config.value)
    persistConfig()
    await props.showConfirm(`已连接 ${result.name}${result.private ? '（私有仓库）' : '。注意：当前仓库不是私有仓库'}`, '连接成功', false)
  } catch (error: any) { await props.showConfirm(error?.message || '连接失败。', '连接失败', false) }
  finally { isWorking.value = false; status.value = '' }
}

const start = async () => {
  if (!usePassword.value) return void await props.showConfirm('云端与邮件备份必须使用密码加密。', '安全保护', false)
  if (!password.value || password.value !== confirmPassword.value) return void await props.showConfirm('请确认两次输入的备份密码一致。', '备份密码', false)
  if (props.destination === 'github' && (!config.value.token.trim() || !config.value.repository.trim())) return void await props.showConfirm('请填写 GitHub 访问令牌和私有仓库名。', '信息不完整', false)
  isWorking.value = true
  try {
    status.value = selected.value.length ? '正在整理分类数据…' : '正在整理全部可恢复数据…'
    const backup = await createBackupFile(backupModules(), password.value)
    const file = new File([backup.buffer], backupName(), { type: 'application/octet-stream' })
    if (props.destination === 'github') {
      status.value = '正在准备 GitHub 分卷上传…'
      await uploadBackup(config.value, backup.buffer, file.name, (current, total) => status.value = `正在上传第 ${current} / ${total} 卷…`, true)
      persistConfig()
      await props.showConfirm('GitHub 备份已完成并通过完整性清单登记。', '备份完成', false)
    } else {
      status.value = '正在交给系统分享面板…'
      const data = { title: '粘人精加密备份', text: '请妥善保存此加密备份文件；恢复时需要备份密码。', files: [file] }
      if (navigator.share && (!navigator.canShare || navigator.canShare(data))) await navigator.share(data)
      else { downloadFallback(file); await props.showConfirm('已下载备份文件，请在邮件应用中手动添加附件并发送。', '请发送邮件', false) }
    }
    emit('close')
  } catch (error: any) {
    if (error?.name !== 'AbortError') await props.showConfirm(error?.message || '备份失败，请检查网络与配置后重试。', '备份失败', false)
  } finally { isWorking.value = false; status.value = '' }
}

const openCloud = async () => {
  step.value = 'cloud'; isWorking.value = true; status.value = '正在读取云端备份清单…'
  try { cloudBackups.value = await listBackups(config.value) }
  catch (error: any) { await props.showConfirm(error?.message || '读取 GitHub 备份失败。', '读取失败', false) }
  finally { isWorking.value = false; status.value = '' }
}

const restoreCloud = async (entry: GitHubBackupEntry) => {
  if (entry.encrypted && !cloudPassword.value) return void await props.showConfirm('请输入该备份的解密密码。', '需要密码', false)
  const message = restoreMode.value === 'overwrite' ? '将用云端备份覆盖本机数据。当前云端凭据会保留，确定继续？' : '将云端备份与本机数据合并，确定继续？'
  if (!await props.showConfirm(message, '恢复确认', true, restoreMode.value === 'overwrite' ? 'danger' : 'normal')) return
  isWorking.value = true
  try {
    status.value = '正在下载并校验分卷…'
    const buffer = await downloadBackup(config.value, entry, (current, total) => status.value = `正在下载第 ${current} / ${total} 卷…`)
    status.value = '正在保存恢复前快照…'
    const { data } = await readBackupFile(buffer, cloudPassword.value || undefined)
    await saveSnapshot('GitHub 恢复前自动恢复点')
    status.value = '正在写入本机数据…'
    await restoreBackupData(data, restoreMode.value)
    await props.showConfirm('GitHub 备份恢复成功，页面将重新载入。', '恢复完成', false)
    window.location.reload()
  } catch (error: any) { await props.showConfirm(error?.message || '恢复失败。', '恢复失败', false) }
  finally { isWorking.value = false; status.value = '' }
}

const removeCloud = async (entry: GitHubBackupEntry) => {
  if (!await props.showConfirm(`确定删除“${entry.label}”及其全部分卷吗？`, '删除云端备份', true, 'danger')) return
  isWorking.value = true; status.value = '正在删除云端分卷…'
  try { await deleteBackup(config.value, entry); cloudBackups.value = await listBackups(config.value) }
  catch (error: any) { await props.showConfirm(error?.message || '删除失败。', '删除失败', false) }
  finally { isWorking.value = false; status.value = '' }
}

const sendPending = async () => {
  const pending = await readPendingEmailBackup()
  if (!pending?.buffer) return
  const file = new File([pending.buffer], `粘人精待发送备份-${pending.meta.createdAt}.nrtbackup`, { type: 'application/octet-stream' })
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) { await navigator.share({ title: '粘人精加密备份', files: [file] }); await clearPendingEmailBackup() }
  else downloadFallback(file)
}

const goBack = () => {
  if (step.value === 'scope') emit('close')
  else if (step.value === 'confirm') step.value = selected.value.length ? 'categories' : 'scope'
  else step.value = 'scope'
}
</script>

<template>
  <div v-if="show" class="gu-modal-mask" @click="!isWorking && emit('close')">
    <div class="gu-modal-container" @click.stop>
      <div class="gu-modal-header"><div class="gu-modal-title"><span>{{ scopeTitle }}</span><i class="gu-seal">存</i></div><button class="gu-close-btn" :disabled="isWorking" @click="emit('close')">×</button></div>
      <div class="gu-modal-body">
        <template v-if="step === 'scope'">
          <div class="gu-summary-card"><div class="gu-summary-mark">全</div><div><b>完整备份</b><small>备份全部可恢复数据，云端连接凭据不会被包含。</small></div></div>
          <button class="gu-main-option" @click="step = 'confirm'"><span>完整备份全部数据</span><i>›</i></button>
          <div class="gu-summary-card"><div class="gu-summary-mark">分</div><div><b>分类备份</b><small>逐项选择数据，按你的组合保存。</small></div></div>
          <button class="gu-main-option" @click="step = 'categories'"><span>进入分类清单</span><i>›</i></button>
          <button v-if="destination === 'github'" class="gu-main-option" @click="openCloud"><span>管理 GitHub 云端记录</span><i>›</i></button>
          <button class="gu-main-option" @click="step = 'tutorial'"><span>首次使用与恢复教程</span><i>›</i></button>
        </template>

        <template v-else-if="step === 'categories'">
          <div class="gu-note">每个项目单独备份；展开分组后逐项勾选。</div>
          <button class="gu-text-link" @click="selected = selectedAll ? [] : BACKUP_CATALOG.map(item => item.id)">{{ selectedAll ? '取消全选' : '全选全部项目' }}</button>
          <div v-for="entry in groups" :key="entry.group" class="gu-group"><button class="gu-group-head" @click="expanded.includes(entry.group) ? expanded = expanded.filter(item => item !== entry.group) : expanded.push(entry.group)"><span>{{ entry.group }}</span><small>{{ entry.items.filter(item => selected.includes(item.id)).length }} / {{ entry.items.length }}　{{ expanded.includes(entry.group) ? '−' : '+' }}</small></button><div v-if="expanded.includes(entry.group)" class="gu-choice-list"><button v-for="item in entry.items" :key="item.id" class="gu-choice" :class="{ selected: selected.includes(item.id) }" @click="toggleItem(item.id)"><span class="gu-check">{{ selected.includes(item.id) ? '✓' : '' }}</span><span><b>{{ item.name }}<em v-if="item.sensitive">敏感</em></b><small>{{ item.description }}</small></span></button><button class="gu-group-all" @click="toggleGroup(entry.items.map(item => item.id))">{{ entry.items.every(item => selected.includes(item.id)) ? '取消本组全选' : '全选本组' }}</button></div></div>
        </template>

        <template v-else-if="step === 'confirm'">
          <div class="gu-note">{{ selected.length ? `已选择 ${selected.length} 个数据项目。` : '将备份全部可恢复数据。' }}</div>
          <template v-if="destination === 'github'">
            <div class="gu-note">大备份按 8 MB 分卷。只有分卷全部成功并写入校验清单后，才会显示为可恢复备份。</div>
            <div class="gu-section"><label>私有仓库</label><input v-model="config.repository" class="gu-input" placeholder="用户名/仓库名"></div>
            <div class="gu-section"><label>访问令牌</label><input v-model="config.token" type="password" class="gu-input" placeholder="Fine-grained token"></div>
            <div class="gu-section"><label>分支</label><input v-model="config.branch" class="gu-input" placeholder="main"></div>
            <div class="gu-section"><label>云端保留数量</label><div class="gu-retention plain"><button v-for="count in [5, 10, 20]" :key="count" :class="{ active: config.retention === count }" @click="config.retention = count">{{ count }} 个</button></div></div>
            <button class="gu-text-link" :disabled="isWorking" @click="testGitHub">「 测试仓库权限 」</button>
            <p class="gu-warning">令牌只保存在当前设备且不会进入备份；仅授予该私有仓库 Contents 读写权限。</p>
          </template>
          <template v-else><div class="gu-note">应用只负责生成附件并打开系统分享面板；你仍需选择邮件应用并确认发送。若设备不支持文件分享，将改为下载文件。</div></template>
          <div class="gu-security"><div class="gu-security-toggle selected"><span>✓</span>云端文件强制使用密码加密</div><div class="gu-passwords"><input v-model="password" type="password" class="gu-input" placeholder="设置备份密码"><input v-model="confirmPassword" type="password" class="gu-input" placeholder="再次确认密码"></div></div>
          <div class="gu-security"><button class="gu-security-toggle" :class="{ selected: autoEnabled }" @click="toggleAutomation"><span>{{ autoEnabled ? '✓' : '' }}</span>{{ destination === 'email' ? '定期生成待发送备份' : '应用打开时自动备份' }}</button><div v-if="autoEnabled" class="gu-retention"><button v-for="day in [1, 7, 30]" :key="day" :class="{ active: intervalDays === day }" @click="intervalDays = day; saveAutomation()">每 {{ day }} 天</button></div><button v-if="destination === 'email' && getPendingEmailBackup()" class="gu-text-link pending-link" @click="sendPending">发送已生成的待发备份</button></div>
        </template>

        <template v-else-if="step === 'cloud'">
          <div class="gu-note">下载时会逐卷校验。恢复前自动保存本机恢复点；云端令牌不会被覆盖。</div>
          <div class="gu-section"><label>解密密码</label><input v-model="cloudPassword" type="password" class="gu-input" placeholder="恢复加密备份时填写"></div>
          <div class="gu-radio-group compact"><button class="gu-radio-label" :class="{ active: restoreMode === 'merge' }" @click="restoreMode = 'merge'"><span class="gu-radio-dot"></span><span class="gu-radio-title">合并（推荐）</span></button><button class="gu-radio-label" :class="{ active: restoreMode === 'overwrite' }" @click="restoreMode = 'overwrite'"><span class="gu-radio-dot"></span><span class="gu-radio-title">覆盖本机</span></button></div>
          <div v-if="cloudBackups.length" class="gu-cloud-list"><div v-for="entry in cloudBackups" :key="entry.id" class="gu-cloud-item"><div><b>{{ entry.label }}</b><small>{{ new Date(entry.createdAt).toLocaleString() }} · {{ formatSize(entry.totalSize) }} · {{ entry.parts.length }} 卷</small></div><div class="gu-cloud-actions"><button @click="restoreCloud(entry)">恢复</button><button class="danger" @click="removeCloud(entry)">删除</button></div></div></div>
          <div v-else-if="!isWorking" class="gu-empty">暂时没有可恢复的 GitHub 备份</div>
        </template>

        <template v-else>
          <template v-if="destination === 'github'">
            <div class="gu-summary-card"><div class="gu-summary-mark">一</div><div><b>准备私有仓库</b><small>在 GitHub 新建 Private 仓库，建议专门用于备份。</small></div></div>
            <div class="gu-summary-card"><div class="gu-summary-mark">二</div><div><b>创建细粒度令牌</b><small>只选择该仓库，并授予 Contents：Read and write；不要授予账户级权限。</small></div></div>
            <div class="gu-summary-card"><div class="gu-summary-mark">三</div><div><b>填写并测试</b><small>仓库填写“用户名/仓库名”，分支通常为 main。测试成功后再上传。</small></div></div>
            <div class="gu-summary-card"><div class="gu-summary-mark">四</div><div><b>换机恢复</b><small>新设备配置相同仓库，进入“管理 GitHub 云端记录”，输入备份密码并选择合并或覆盖。</small></div></div>
          </template>
          <template v-else>
            <div class="gu-summary-card"><div class="gu-summary-mark">一</div><div><b>设置独立密码</b><small>不要把备份密码写在同一封邮件里，忘记密码将无法恢复。</small></div></div>
            <div class="gu-summary-card"><div class="gu-summary-mark">二</div><div><b>发送给自己</b><small>生成后在系统分享面板选择邮件应用，确认附件已经加入，再手动发送。</small></div></div>
            <div class="gu-summary-card"><div class="gu-summary-mark">三</div><div><b>从附件恢复</b><small>下载 .nrtbackup 附件，在“从本地恢复数据”中预览并恢复。</small></div></div>
            <div class="gu-note">邮件不是实时同步。定期任务只会在应用打开且到期时生成待发送文件，仍需你确认发送。</div>
          </template>
        </template>
        <div v-if="isWorking" class="gu-progress"><i></i>{{ status }}</div>
      </div>
      <div class="gu-modal-footer"><button class="gu-btn-cancel" :disabled="isWorking" @click="goBack">{{ step === 'scope' ? '取消' : '返回' }}</button><button v-if="step === 'categories'" class="gu-btn-confirm" :disabled="!selected.length" @click="step = 'confirm'">选择备份方式</button><button v-else-if="step === 'confirm'" class="gu-btn-confirm" :disabled="isWorking" @click="start">{{ destination === 'github' ? '备份到 GitHub' : '生成并发送邮件' }}</button><button v-else-if="step === 'cloud'" class="gu-btn-confirm" :disabled="isWorking" @click="openCloud">刷新列表</button></div>
    </div>
  </div>
</template>

<style scoped>
.gu-modal-mask{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.9);backdrop-filter:blur(5px)}.gu-modal-container{width:90%;max-width:440px;background:#fff;border:1px solid #e5e5e5;box-shadow:0 10px 30px rgba(0,0,0,.05)}.gu-modal-header,.gu-modal-footer{display:flex;align-items:center;padding:20px 24px}.gu-modal-header{justify-content:space-between;border-bottom:1px dashed #f0f0f0}.gu-modal-title{display:flex;align-items:center;gap:6px;font-family:"STSong","SimSun",serif;font-size:18px;font-weight:bold;letter-spacing:2px}.gu-seal{width:14px;height:14px;display:grid;place-items:center;background:#be2a2a;color:#fff;border-radius:2px;font-size:10px;font-style:normal}.gu-close-btn,.gu-main-option,.gu-group-head,.gu-choice,.gu-text-link,.gu-group-all,.gu-security-toggle,.gu-radio-label,.gu-cloud-actions button{appearance:none;border:0;background:transparent;cursor:pointer}.gu-close-btn{font-size:24px;color:#999}.gu-modal-body{display:flex;flex-direction:column;gap:14px;max-height:64vh;overflow:auto;padding:24px}.gu-summary-card{display:flex;align-items:flex-start;gap:12px;padding:14px;border:1px solid #f0f0f0;background:#fafafa}.gu-summary-mark{width:30px;height:30px;display:grid;place-items:center;flex:none;background:#1a1a1a;color:#fff;font-family:"STSong","SimSun",serif}.gu-summary-card b,.gu-summary-card small{display:block}.gu-summary-card b{font-size:14px;margin-bottom:3px}.gu-summary-card small,.gu-note{font-size:12px;line-height:1.6;color:#777}.gu-main-option{display:flex;justify-content:space-between;align-items:center;padding:4px 0 12px;color:#1a1a1a;font-family:"STSong","SimSun",serif;font-size:14px;border-bottom:1px dashed #e5e5e5}.gu-main-option i{font-size:20px;font-style:normal;color:#999}.gu-note{padding:12px;background:#fafafa;border:1px solid #f0f0f0}.gu-text-link{align-self:flex-start;padding:2px 0;color:#666;font-family:"STSong","SimSun",serif;font-size:13px}.gu-group{border-top:1px solid #e5e5e5}.gu-group-head{display:flex;width:100%;justify-content:space-between;padding:13px 0;color:#1a1a1a;text-align:left;font-family:"STSong","SimSun",serif;font-size:15px}.gu-group-head small{font-size:12px;color:#999}.gu-choice-list{border-top:1px solid #f5f5f5}.gu-choice{display:flex;width:100%;gap:11px;padding:11px 0;border-bottom:1px solid #f0f0f0;color:#1a1a1a;text-align:left}.gu-check,.gu-security-toggle>span{width:16px;height:16px;display:grid;place-items:center;flex:none;border:1px solid #cfcfcf;color:#fff;font-size:11px}.selected .gu-check,.gu-security-toggle.selected>span{background:#1a1a1a;border-color:#1a1a1a}.gu-choice b,.gu-choice small{display:block}.gu-choice b{font-size:14px;margin-bottom:3px}.gu-choice small{font-size:12px;line-height:1.5;color:#777}.gu-choice em{margin-left:6px;padding:1px 4px;border:1px solid #be2a2a;color:#be2a2a;font-size:10px;font-style:normal;font-weight:normal}.gu-group-all{padding:10px 0;color:#666;font-family:"STSong","SimSun",serif;font-size:12px}.gu-section{display:flex;flex-direction:column;gap:7px}.gu-section label{font-size:14px;font-weight:bold;color:#1a1a1a}.gu-input{appearance:none;box-sizing:border-box;width:100%;padding:10px 12px;border:1px solid #e5e5e5;border-radius:0;background:#fafafa;color:#1a1a1a;outline:0}.gu-input:focus{border-color:#1a1a1a;background:#fff}.gu-warning{margin:0;color:#be2a2a;font-size:12px;line-height:1.6}.gu-security{padding-top:14px;border-top:1px dashed #e5e5e5}.gu-security-toggle{display:flex;align-items:center;gap:8px;color:#333;font-size:14px}.gu-passwords{display:grid;gap:9px;margin:12px 0 0 24px}.gu-progress{display:flex;align-items:center;justify-content:center;gap:9px;color:#666;font-family:"STSong","SimSun",serif;font-size:13px}.gu-progress i{width:16px;height:16px;border:2px solid #eee;border-top-color:#1a1a1a;border-radius:50%;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.gu-modal-footer{gap:12px;background:#fafafa;border-top:1px solid #e5e5e5}.gu-btn-cancel,.gu-btn-confirm{appearance:none;flex:1;padding:12px 0;cursor:pointer;font-size:14px}.gu-btn-cancel{border:1px solid #e5e5e5;background:transparent;color:#666}.gu-btn-confirm{border:1px solid #1a1a1a;background:#1a1a1a;color:#fff}.gu-btn-cancel:disabled,.gu-btn-confirm:disabled,.gu-text-link:disabled{opacity:.5;cursor:not-allowed}.gu-retention{display:flex;gap:8px;margin:10px 0 0 24px}.gu-retention.plain{margin:0}.gu-retention button{appearance:none;padding:6px 9px;border:1px solid #e5e5e5;background:#fafafa;color:#666;font-family:"STSong","SimSun",serif;font-size:12px;cursor:pointer}.gu-retention button.active{background:#1a1a1a;border-color:#1a1a1a;color:#fff}.pending-link{margin:10px 0 0 24px}.gu-radio-group.compact{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gu-radio-label{display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #e5e5e5;color:#666;text-align:left}.gu-radio-label.active{border-color:#1a1a1a;color:#1a1a1a}.gu-radio-dot{width:10px;height:10px;border:1px solid #aaa;border-radius:50%}.gu-radio-label.active .gu-radio-dot{border:3px solid #1a1a1a}.gu-radio-title{font-size:13px}.gu-cloud-list{display:flex;flex-direction:column;border-top:1px solid #e5e5e5}.gu-cloud-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 0;border-bottom:1px solid #f0f0f0}.gu-cloud-item b,.gu-cloud-item small{display:block}.gu-cloud-item b{max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.gu-cloud-item small{margin-top:4px;color:#888;font-size:11px}.gu-cloud-actions{display:flex;flex:none;gap:8px}.gu-cloud-actions button{padding:5px;color:#555;font-size:12px}.gu-cloud-actions .danger{color:#be2a2a}.gu-empty{padding:28px 0;color:#999;text-align:center;font-size:13px}
</style>
