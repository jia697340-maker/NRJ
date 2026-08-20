/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMusicLibrary } from '../../../composables/useMusicLibrary'

const props = defineProps<{
  visible: boolean
  defaultNickname?: string
  defaultVipLabel?: string
  defaultSignature?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const {
  customNickname,
  customVipLabel,
  customSignature,
  setCustomProfile,
  resetCustomProfile,
  setMessage
} = useMusicLibrary()

const nicknameInput = ref('')
const vipLabelInput = ref('')
const signatureInput = ref('')

watch(
  () => props.visible,
  (val) => {
    if (val) {
      nicknameInput.value = customNickname.value ?? ''
      vipLabelInput.value = customVipLabel.value ?? ''
      signatureInput.value = customSignature.value ?? ''
    }
  },
  { immediate: true }
)

const handleSave = () => {
  const finalNickname = nicknameInput.value.trim() || null
  const finalVip = vipLabelInput.value.trim() || null
  const finalSig = signatureInput.value.trim() || null

  setCustomProfile({
    nickname: finalNickname,
    vipLabel: finalVip,
    signature: finalSig
  })

  setMessage('音乐昵称与信息已保存')
  emit('close')
}

const handleReset = () => {
  nicknameInput.value = ''
  vipLabelInput.value = ''
  signatureInput.value = ''
  resetCustomProfile()
  emit('close')
}
</script>

<template>
  <div v-if="visible" class="edit-modal-mask" @click="emit('close')">
    <section class="edit-modal-card" @click.stop>
      <!-- 头部 -->
      <header class="edit-header">
        <div class="edit-title-group">
          <div class="edit-title">修改音乐资料</div>
          <div class="edit-subtitle">自定义名称、VIP 徽章与副标题签名</div>
        </div>
        <button class="edit-close-btn" title="关闭" @click="emit('close')">×</button>
      </header>

      <!-- 表单主体 -->
      <div class="edit-body">
        <!-- 昵称编辑卡片 -->
        <div class="field-card">
          <div class="field-header">
            <strong>昵称 / 名字</strong>
            <small>默认：{{ defaultNickname || '我的音乐' }}</small>
          </div>
          <div class="field-input-box">
            <input
              v-model="nicknameInput"
              type="text"
              class="field-input"
              maxlength="30"
              placeholder="输入新名字 / 昵称（留空则为默认）"
              @keydown.enter="handleSave"
            />
            <button
              v-if="nicknameInput"
              class="clear-input-btn"
              title="清空"
              @click="nicknameInput = ''"
            >
              ×
            </button>
          </div>
        </div>

        <!-- VIP 标签卡片 -->
        <div class="field-card">
          <div class="field-header">
            <strong>徽章标签</strong>
            <small>默认：{{ defaultVipLabel || 'SVIP' }}</small>
          </div>
          <div class="field-input-box">
            <input
              v-model="vipLabelInput"
              type="text"
              class="field-input"
              maxlength="12"
              placeholder="例如：SVIP、黑胶VIP、PRO"
              @keydown.enter="handleSave"
            />
            <button
              v-if="vipLabelInput"
              class="clear-input-btn"
              title="清空"
              @click="vipLabelInput = ''"
            >
              ×
            </button>
          </div>
        </div>

        <!-- 副标题与签名 -->
        <div class="field-card">
          <div class="field-header">
            <strong>个性签名</strong>
            <small>默认：{{ defaultSignature || '点击添加个性签名...' }}</small>
          </div>
          <div class="field-input-box">
            <input
              v-model="signatureInput"
              type="text"
              class="field-input"
              maxlength="50"
              placeholder="输入个性签名（留空则为占位提示）"
              @keydown.enter="handleSave"
            />
            <button
              v-if="signatureInput"
              class="clear-input-btn"
              title="清空"
              @click="signatureInput = ''"
            >
              ×
            </button>
          </div>
        </div>

        <!-- 操作按钮组 -->
        <div class="action-buttons-row">
          <button class="btn-reset" @click="handleReset">重置为默认</button>
          <button class="btn-save" @click="handleSave">保存设置</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.edit-modal-mask {
  position: absolute;
  inset: 0;
  z-index: 86;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  padding: 20px;
  box-sizing: border-box;
  animation: fadeIn 0.18s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.edit-modal-card {
  width: 100%;
  max-width: 360px;
  border: 1px solid var(--music-card-border);
  border-radius: 20px;
  background: var(--music-card-bg);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: scaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes scaleUp {
  from { transform: scale(0.94); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--music-divider);
}

.edit-title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.edit-title {
  font-size: 16px;
  font-weight: 750;
  color: var(--music-text);
}

.edit-subtitle {
  color: var(--music-text-sub);
  font-size: 11px;
}

.edit-close-btn {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: var(--music-pill-bg);
  color: var(--music-text);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.15s;
}

.edit-close-btn:active {
  opacity: 0.7;
}

.edit-body {
  padding: 14px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-card {
  padding: 10px 12px;
  border: 1px solid var(--music-card-border);
  border-radius: 12px;
  background: var(--music-secondary-bg);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.field-header strong {
  font-size: 12px;
  font-weight: 700;
  color: var(--music-text);
}

.field-header small {
  font-size: 10px;
  color: var(--music-text-sub);
}

.field-input-box {
  position: relative;
  display: flex;
  align-items: center;
}

.field-input {
  width: 100%;
  height: 36px;
  padding: 0 28px 0 10px;
  border: 1px solid var(--music-card-border);
  border-radius: 8px;
  background: var(--music-card-bg);
  color: var(--music-text);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.field-input:focus {
  border-color: var(--music-text);
}

.field-input::placeholder {
  color: var(--music-text-muted);
  font-size: 11px;
}

.clear-input-btn {
  position: absolute;
  right: 6px;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--music-text-muted);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.action-buttons-row {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.btn-reset {
  flex: 1;
  height: 38px;
  border: 1px solid var(--music-card-border);
  border-radius: 10px;
  background: var(--music-secondary-bg);
  color: var(--music-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-reset:active {
  opacity: 0.8;
}

.btn-save {
  flex: 1.4;
  height: 38px;
  border: none;
  border-radius: 10px;
  background: var(--music-text);
  color: var(--music-bg);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-save:active {
  opacity: 0.85;
}
</style>
