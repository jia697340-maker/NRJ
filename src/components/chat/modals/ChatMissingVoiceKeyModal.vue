/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <transition name="folder-fade">
    <div v-if="visible" class="folder-modal-overlay" @click="emit('close')" @touchmove.prevent>
      <div class="custom-confirm-modal missing-voice-key-modal" @click.stop>
        <div class="confirm-title">无法播放语音</div>
        <div class="confirm-desc missing-voice-key-desc">
          <p>因为您尚未配置语音接口密钥，所以暂时无法播放语音。</p>
          <p>您可以在「应用首页 - 语音接入」中完成配置。</p>
        </div>
        <div class="confirm-actions">
          <div class="confirm-btn missing-voice-key-confirm" @click="emit('close')">知道了</div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';

.missing-voice-key-modal {
  background: var(--sys-bg-secondary, #fff);
}

.missing-voice-key-desc {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.missing-voice-key-desc p {
  margin: 0;
}

.missing-voice-key-confirm {
  color: var(--theme-color, #1976d2);
  font-weight: 600;
}
</style>
