/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref } from 'vue'
import { BACKUP_CATALOG, type BackupModule } from '../../../composables/useDataBackup'
import { useDataBackup } from '../../../composables/useDataBackup'

const props = defineProps<{ show: boolean; showConfirm: any }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { createBackupFile } = useDataBackup()
const allModules: BackupModule[] = BACKUP_CATALOG.map(item => item.id)
const isExporting = ref(false)
const showCustomExport = ref(false)
const selectedModules = ref<BackupModule[]>([...allModules])
const expandedGroups = ref<string[]>([])
const usePassword = ref(false)
const password = ref('')
const confirmPassword = ref('')
const statusText = ref('')
const exportScope = computed(() => showCustomExport.value ? selectedModules.value : allModules)
const backupGroups = computed(() => Array.from(new Set(BACKUP_CATALOG.map(item => item.group))).map(name => ({ name, items: BACKUP_CATALOG.filter(item => item.group === name) })))
const isAllSelected = computed(() => selectedModules.value.length === allModules.length)

const toggleModule = (mod: BackupModule) => {
  const index = selectedModules.value.indexOf(mod)
  if (index > -1) selectedModules.value.splice(index, 1)
  else if (index === -1) selectedModules.value.push(mod)
}
const toggleGroup = (group: string) => { expandedGroups.value = expandedGroups.value.includes(group) ? expandedGroups.value.filter(item => item !== group) : [...expandedGroups.value, group] }
const toggleAll = () => { selectedModules.value = isAllSelected.value ? [] : [...allModules] }
const toggleGroupSelection = (items: BackupModule[]) => {
  selectedModules.value = items.every(item => selectedModules.value.includes(item)) ? selectedModules.value.filter(item => !items.includes(item)) : Array.from(new Set([...selectedModules.value, ...items]))
}

const handleExport = async () => {
  if (usePassword.value && !password.value) return void await props.showConfirm('请输入加密密码', '提示', false)
  if (usePassword.value && password.value !== confirmPassword.value) return void await props.showConfirm('两次输入的密码不一致', '提示', false)
  isExporting.value = true
  try {
    statusText.value = '正在整理全部数据…'
    await new Promise(resolve => setTimeout(resolve, 80))
    const backup = await createBackupFile(exportScope.value, usePassword.value ? password.value : undefined)
    statusText.value = usePassword.value ? '正在加密并生成备份文件…' : '正在生成备份文件…'
    const url = URL.createObjectURL(new Blob([backup.buffer], { type: 'application/octet-stream' }))
    const anchor = document.createElement('a')
    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    anchor.href = url
    anchor.download = `粘人精-${showCustomExport.value ? '自定义导出' : '完整备份'}-${stamp}.nrtbackup`
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
    emit('close')
    await props.showConfirm('备份文件已生成，请妥善保管。', '备份完成', false)
  } catch (error) {
    console.error(error)
    await props.showConfirm('导出过程中发生错误，请重试。', '提示', false)
  } finally {
    isExporting.value = false
    statusText.value = ''
  }
}
</script>

<template>
  <div v-if="show" class="gu-modal-mask" @click="!isExporting && emit('close')">
    <div class="gu-modal-container" @click.stop>
      <div class="gu-modal-header"><div class="gu-modal-title"><span>{{ showCustomExport ? '自定义导出' : '创建完整备份' }}</span><i class="gu-seal">存</i></div><button class="gu-close-btn" :disabled="isExporting" @click="emit('close')">×</button></div>
      <div class="gu-modal-body">
        <template v-if="!showCustomExport">
          <div class="gu-summary-card"><div class="gu-summary-mark">全</div><div><div class="gu-summary-title">完整备份当前设备的数据</div><div class="gu-summary-text">聊天、角色、世界书、图片、历史记录与应用设定都会包含在内。</div></div></div>
          <button class="gu-text-link" :disabled="isExporting" @click="showCustomExport = true">「 只导出部分内容 」</button>
        </template>
        <template v-else>
          <div class="gu-section-title">选择需要导出的内容</div>
          <div class="gu-note">每个项目可单独导出；展开分类后逐项勾选。</div>
          <button class="gu-text-link" :disabled="isExporting" @click="toggleAll">{{ isAllSelected ? '取消全选全部项目' : '全选全部项目' }}</button>
          <div v-for="group in backupGroups" :key="group.name" class="gu-group">
            <button class="gu-group-head" :disabled="isExporting" @click="toggleGroup(group.name)"><span>{{ group.name }}</span><small>{{ group.items.filter(item => selectedModules.includes(item.id)).length }} / {{ group.items.length }}　{{ expandedGroups.includes(group.name) ? '−' : '+' }}</small></button>
            <div v-if="expandedGroups.includes(group.name)" class="gu-choice-list">
              <button v-for="item in group.items" :key="item.id" class="gu-choice" :class="{ selected: selectedModules.includes(item.id) }" :disabled="isExporting" @click="toggleModule(item.id)"><span class="gu-choice-check">{{ selectedModules.includes(item.id) ? '✓' : '' }}</span><span><b>{{ item.name }}<em v-if="item.sensitive">敏感</em></b><small>{{ item.description }}</small></span></button>
              <button class="gu-group-all" :disabled="isExporting" @click="toggleGroupSelection(group.items.map(item => item.id))">{{ group.items.every(item => selectedModules.includes(item.id)) ? '取消本组全选' : '全选本组' }}</button>
            </div>
          </div>
          <button class="gu-text-link" :disabled="isExporting" @click="showCustomExport = false">「 返回完整备份 」</button>
        </template>
        <div class="gu-security"><button class="gu-security-toggle" :class="{ selected: usePassword }" :disabled="isExporting" @click="usePassword = !usePassword"><span>{{ usePassword ? '✓' : '' }}</span>使用密码加密备份文件</button><div v-if="usePassword" class="gu-password-fields"><input v-model="password" type="password" class="gu-input" placeholder="设置加密密码" :disabled="isExporting"><input v-model="confirmPassword" type="password" class="gu-input" placeholder="再次确认密码" :disabled="isExporting"><p>忘记密码将无法恢复此备份。</p></div></div>
        <div v-if="isExporting" class="gu-loading-area"><span class="gu-spinner"></span><span>{{ statusText }}</span></div>
      </div>
      <div class="gu-modal-footer"><button class="gu-btn-cancel" :disabled="isExporting" @click="emit('close')">取消</button><button class="gu-btn-confirm" :disabled="isExporting || (showCustomExport && !selectedModules.length)" @click="handleExport">{{ isExporting ? '整理中…' : showCustomExport ? '导出所选内容' : '创建完整备份' }}</button></div>
    </div>
  </div>
</template>

<style scoped>
.gu-modal-mask{position:fixed;inset:0;background:rgba(255,255,255,.9);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:1000}.gu-modal-container{width:90%;max-width:410px;background:#fff;border:1px solid #e5e5e5;box-shadow:0 10px 30px rgba(0,0,0,.05)}.gu-modal-header,.gu-modal-footer{display:flex;align-items:center;padding:20px 24px}.gu-modal-header{justify-content:space-between;border-bottom:1px dashed #f0f0f0}.gu-modal-title{display:flex;gap:6px;align-items:center;font-family:"STSong","SimSun",serif;font-size:18px;font-weight:bold;letter-spacing:2px}.gu-seal{width:14px;height:14px;background:#be2a2a;color:#fff;font-style:normal;font-size:10px;display:grid;place-items:center;border-radius:2px}.gu-close-btn{border:0;background:none;color:#999;font-size:24px;cursor:pointer}.gu-modal-body{padding:24px;display:flex;flex-direction:column;gap:20px;max-height:62vh;overflow:auto}.gu-summary-card{display:flex;gap:14px;padding:16px;background:#fafafa;border:1px solid #f0f0f0}.gu-summary-mark{width:34px;height:34px;flex:none;display:grid;place-items:center;background:#1a1a1a;color:#fff;font-family:"STSong","SimSun",serif;font-size:18px}.gu-summary-title{font-size:14px;font-weight:600;color:#1a1a1a;margin-bottom:6px}.gu-summary-text,small{font-size:12px;line-height:1.6;color:#777}.gu-text-link{align-self:flex-start;padding:0;border:0;background:none;color:#666;font-family:"STSong","SimSun",serif;font-size:13px;cursor:pointer}.gu-section-title{font-size:14px;font-weight:bold;color:#1a1a1a}.gu-choice-list{display:flex;flex-direction:column;border-top:1px solid #f0f0f0}.gu-choice{display:flex;align-items:center;gap:11px;padding:13px 0;border:0;border-bottom:1px solid #f0f0f0;background:none;text-align:left;cursor:pointer;color:#1a1a1a}.gu-choice-check,.gu-security-toggle>span{width:16px;height:16px;display:inline-grid;place-items:center;border:1px solid #cfcfcf;color:#fff;font-size:11px;flex:none}.gu-choice.selected .gu-choice-check,.gu-security-toggle.selected>span{background:#1a1a1a;border-color:#1a1a1a}.gu-choice b,.gu-choice small{display:block}.gu-choice b{font-size:14px;margin-bottom:3px}.gu-security{padding-top:18px;border-top:1px dashed #e5e5e5}.gu-security-toggle{display:flex;align-items:center;gap:8px;padding:0;border:0;background:none;color:#333;font-size:14px;cursor:pointer}.gu-password-fields{display:flex;flex-direction:column;gap:9px;margin:12px 0 0 24px;padding-left:12px;border-left:2px solid #f3f3f3}.gu-input{box-sizing:border-box;width:100%;padding:10px 12px;border:1px solid #e5e5e5;background:#fafafa;outline:none}.gu-input:focus{border-color:#1a1a1a;background:#fff}.gu-password-fields p{margin:0;font-size:12px;color:#be2a2a}.gu-loading-area{display:flex;align-items:center;gap:10px;justify-content:center;color:#666;font-family:"STSong","SimSun",serif;font-size:13px}.gu-spinner{width:18px;height:18px;border:2px solid #eee;border-top-color:#1a1a1a;border-radius:50%;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.gu-modal-footer{gap:12px;background:#fafafa;border-top:1px solid #e5e5e5}.gu-btn-cancel,.gu-btn-confirm{flex:1;padding:12px 0;border:0;font-size:14px;cursor:pointer}.gu-btn-cancel{background:transparent;border:1px solid #e5e5e5;color:#666}.gu-btn-confirm{background:#1a1a1a;color:#fff}.gu-btn-cancel:disabled,.gu-btn-confirm:disabled,.gu-text-link:disabled,.gu-choice:disabled,.gu-security-toggle:disabled{opacity:.5;cursor:not-allowed}
/* 压住项目全局按钮规则，维持存储页既有的素白账本风格。 */
.gu-close-btn{appearance:none!important;border:0!important;background:transparent!important;padding:0!important;color:#999!important;font-size:24px!important;line-height:1!important}
.gu-text-link{appearance:none!important;border:0!important;background:transparent!important;padding:3px 0!important;color:#666!important;font-family:"STSong","SimSun",serif!important;font-size:13px!important;letter-spacing:1px!important;line-height:1.4!important}
.gu-choice{appearance:none!important;display:flex!important;align-items:center!important;gap:11px!important;width:100%!important;padding:13px 0!important;border:0!important;border-bottom:1px solid #f0f0f0!important;background:transparent!important;text-align:left!important;color:#1a1a1a!important}
.gu-security-toggle{appearance:none!important;display:flex!important;align-items:center!important;gap:8px!important;border:0!important;background:transparent!important;padding:0!important;color:#333!important;font-size:14px!important;line-height:1.4!important}
.gu-btn-cancel,.gu-btn-confirm{appearance:none!important}.gu-btn-cancel{background:transparent!important;border:1px solid #e5e5e5!important;color:#666!important}.gu-btn-confirm{background:#1a1a1a!important;color:#fff!important}
.gu-summary-card{align-items:flex-start;border-color:#e8e8e8}.gu-summary-mark{display:flex!important;align-items:center!important;justify-content:center!important;flex:0 0 34px!important;width:34px!important;height:34px!important;line-height:1!important}.gu-summary-title{margin-top:1px}.gu-summary-text{line-height:1.65}
.gu-note{padding:10px 12px;border:1px solid #f0f0f0;background:#fafafa;color:#777;font-size:12px;line-height:1.6}.gu-group{border-top:1px solid #e5e5e5}.gu-group-head{display:flex;align-items:center;justify-content:space-between;width:100%;padding:13px 0;border:0;background:transparent;color:#1a1a1a;text-align:left;font-family:"STSong","SimSun",serif;font-size:15px;cursor:pointer}.gu-group-head small{color:#999}.gu-group-all{padding:10px 0;border:0;background:transparent;color:#666;font-family:"STSong","SimSun",serif;font-size:12px;cursor:pointer}.gu-choice em{margin-left:6px;padding:1px 4px;border:1px solid #be2a2a;color:#be2a2a;font-size:10px;font-style:normal;font-weight:normal}
</style>
