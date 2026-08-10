<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { ref } from 'vue'
import type { CharacterDraft, CharacterTemplate } from '../../types/characterWorkshop'
defineProps<{ templates: CharacterTemplate[]; activeDraft: CharacterDraft | null }>()
const emit = defineEmits<{ close: []; use: [template: CharacterTemplate]; save: []; delete: [id: string]; export: []; import: [file: File] }>()
const input = ref<HTMLInputElement | null>(null)
const pickFile = () => input.value?.click()
const onFile = (event: Event) => { const file = (event.target as HTMLInputElement).files?.[0]; if (file) emit('import', file); (event.target as HTMLInputElement).value = '' }
</script>
<template>
  <div class="cw-modal-backdrop" @click.self="emit('close')"><section class="cw-wide-modal template-modal" role="dialog" aria-modal="true"><header class="cw-modal-header"><div><p class="cw-kicker">LOCAL LIBRARY</p><h2>模板与角色文件</h2><p>所有模板只保存在当前设备。JSON 文件可分享、备份并重新导入。</p></div><button class="cw-icon-button" type="button" aria-label="关闭" @click="emit('close')"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header><div class="cw-template-actions"><button type="button" @click="pickFile"><svg viewBox="0 0 24 24"><path d="M12 16V4m-4 4l4-4 4 4M5 13v7h14v-7"/></svg><span><strong>导入角色文件</strong><small>支持工坊 JSON</small></span></button><button type="button" :disabled="!activeDraft" @click="emit('export')"><svg viewBox="0 0 24 24"><path d="M12 4v12m-4-4l4 4 4-4M5 18v2h14v-2"/></svg><span><strong>导出当前角色</strong><small>生成可分享文件</small></span></button><button type="button" :disabled="!activeDraft" @click="emit('save')"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 4v6h8V4M8 15h8"/></svg><span><strong>存为本地模板</strong><small>复用结构与风格</small></span></button><input ref="input" type="file" accept="application/json,.json" hidden @change="onFile"></div><div v-if="templates.length" class="cw-template-grid"><article v-for="template in templates" :key="template.id"><div><small>LOCAL TEMPLATE</small><h3>{{ template.name }}</h3><p>{{ template.description }}</p><div><span v-for="tag in template.tags.slice(0,4)" :key="tag">{{ tag }}</span></div></div><footer><button type="button" @click="emit('delete', template.id)">删除</button><button type="button" @click="emit('use', template)">使用模板</button></footer></article></div><div v-else class="cw-empty-state"><strong>本地模板库为空</strong><p>打开一个角色后，可以保存为模板；模板不会带上聊天记录和发布关系。</p></div></section></div>
</template>
