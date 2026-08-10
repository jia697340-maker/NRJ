<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
defineProps<{ contacts: any[]; loading: boolean; loadingLabel: string }>()
const emit = defineEmits<{ close: []; select: [contact: any] }>()
</script>
<template>
  <div class="cw-modal-backdrop" @click.self="!loading && emit('close')"><section class="cw-publish-modal" role="dialog" aria-modal="true"><header class="cw-modal-header"><div><p class="cw-kicker">EXISTING PERSONA</p><h2>体检现有聊天角色</h2><p>原联系人不会被直接修改；工坊会建立独立草稿供你对照优化。</p></div><button class="cw-icon-button" type="button" aria-label="关闭" :disabled="loading" @click="emit('close')"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header><div v-if="loading" class="cw-modal-loading"><span class="cw-spinner"></span><strong>{{ loadingLabel }}</strong><p>正在提取稳定设定并进行第一轮体检。</p></div><div v-else-if="contacts.length" class="cw-contact-list"><button v-for="contact in contacts" :key="contact.id" type="button" :disabled="!contact.persona" @click="emit('select', contact)"><span>{{ (contact.name || '未').charAt(0) }}</span><div><strong>{{ contact.remark || contact.name }}</strong><small>{{ contact.persona ? contact.persona.slice(0, 80) : '没有可分析的人设内容' }}</small></div><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div><div v-else class="cw-empty-state"><strong>还没有可体检的联系人</strong><p>先在聊天中创建角色，或使用角色文件导入。</p></div></section></div>
</template>
