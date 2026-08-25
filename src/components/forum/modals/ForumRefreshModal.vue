/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { ForumGenerationConfig, ForumUser } from '../../../types/forum'
import { defaultForumGenerationConfig, normalizeForumGenerationConfig } from '../../../services/forumGeneration'

const props = defineProps<{ visible: boolean; characters: ForumUser[]; busy?: boolean; progress?: number; error?: string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'confirm', config: ForumGenerationConfig): void }>()
const form = reactive(defaultForumGenerationConfig())
const presets = [3, 5, 10]
const valid = computed(() => form.postCount >= 1 && form.postCount <= 20 && form.requiredCharacterAccountIds.length <= form.postCount)
const characterHint = computed(() => {
  if (!form.requiredCharacterAccountIds.length) return '本轮主要由不同陌生网友发帖'
  if (form.requiredCharacterAccountIds.length === form.postCount) return '本轮帖子将全部由所选角色参与'
  return `保证包含 ${form.requiredCharacterAccountIds.length} 位角色，其余主要是陌生网友`
})

watch(() => props.visible, visible => {
  if (visible) Object.assign(form, defaultForumGenerationConfig())
})

const toggleCharacter = (accountId: string) => {
  const index = form.requiredCharacterAccountIds.indexOf(accountId)
  if (index >= 0) form.requiredCharacterAccountIds.splice(index, 1)
  else if (form.requiredCharacterAccountIds.length < form.postCount) form.requiredCharacterAccountIds.push(accountId)
}
const submit = () => {
  if (!valid.value || props.busy) return
  emit('confirm', normalizeForumGenerationConfig(form))
}
</script>

<template>
  <div v-if="visible" class="refresh-overlay" @click.self="emit('close')">
    <section class="refresh-sheet" role="dialog" aria-modal="true" aria-labelledby="forum-refresh-title">
      <header><div><h2 id="forum-refresh-title">刷新论坛</h2><p>{{busy?'正在后台生成，可以随时收起或离开论坛':'选数量和参与角色，其余由论坛自然安排'}}</p></div><button type="button" aria-label="关闭" @click="emit('close')">×</button></header>
      <div class="form-body">
        <section class="field-block"><div class="field-title"><b>生成帖子</b><small>默认少量生成，更快也更自然</small></div><div class="count-row"><button v-for="count in presets" :key="count" type="button" :class="{active:form.postCount===count}" @click="form.postCount=count;form.requiredCharacterAccountIds.splice(count)">{{count}} 篇</button><label :class="{active:!presets.includes(form.postCount)}"><span>自定义</span><input v-model.number="form.postCount" type="number" min="1" max="20" @change="form.requiredCharacterAccountIds.splice(form.postCount)"></label></div></section>
        <section class="field-block"><div class="field-title"><b>参与角色</b><small>可不选</small></div><div v-if="characters.length" class="character-list"><button v-for="user in characters" :key="user.id" type="button" :class="{selected:form.requiredCharacterAccountIds.includes(user.id)}" @click="toggleCharacter(user.id)"><i>✓</i><span>{{user.name}}</span></button></div><p v-else class="empty-characters">聊天 App 里还没有可参与论坛的角色</p><p class="character-hint">{{characterHint}}</p></section>
        <p v-if="!valid" class="validation">帖子数量需为 1～20，且不能少于已选角色数。</p><p v-else-if="error" class="validation">{{error}}</p>
      </div>
      <div v-if="busy" class="progress"><span :style="{width:`${progress||0}%`}"></span><small>正在生成 {{progress||0}}%</small></div>
      <footer><button class="cancel" type="button" @click="emit('close')">{{busy?'收起':'取消'}}</button><button class="confirm" type="button" :disabled="busy||!valid" @click="submit">{{busy?'后台生成中…':`生成 ${form.postCount} 篇`}}</button></footer>
    </section>
  </div>
</template>

<style scoped>
.refresh-overlay{position:absolute;inset:0;z-index:520;display:flex;align-items:flex-end;background:rgba(0,0,0,.34)}.refresh-sheet{box-sizing:border-box;width:100%;max-height:min(78%,560px);display:flex;flex-direction:column;border-radius:16px 16px 0 0;background:var(--sys-bg-secondary,#fff);padding:5px 14px calc(9px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 28px rgba(0,0,0,.08)}header{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:52px;border-bottom:1px solid var(--border-color,rgba(0,0,0,.06))}header>div{min-width:0;flex:1}h2{margin:0;font-size:14px;font-weight:650}header p{margin:2px 0 0;color:var(--text-tertiary,#999);font-size:10.5px}header>button{width:28px;height:28px;border:0;border-radius:50%;background:transparent;color:var(--text-secondary,#777);font-size:20px}.form-body{min-height:0;overflow:auto}.field-block{padding:13px 1px;border-bottom:1px solid var(--border-color,rgba(0,0,0,.055))}.field-title{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:9px}.field-title b{font-size:12.5px}.field-title small{color:var(--text-tertiary,#999);font-size:9.8px}.count-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.count-row button,.count-row label{box-sizing:border-box;height:36px;border:1px solid transparent;border-radius:9px;background:var(--sys-bg-primary,#f3f4f6);color:var(--text-secondary,#666);font:inherit;font-size:11.5px}.count-row button.active,.count-row label.active{border-color:color-mix(in srgb,var(--accent-color,#2b7de9) 42%,transparent);background:color-mix(in srgb,var(--accent-color,#2b7de9) 9%,transparent);color:var(--accent-color,#2b7de9);font-weight:600}.count-row label{position:relative;display:flex;align-items:center;justify-content:center}.count-row label span{pointer-events:none}.count-row input{position:absolute;inset:0;width:100%;border:0;background:transparent;color:transparent;text-align:center;outline:0;appearance:textfield}.count-row label:focus-within span{display:none}.count-row label:focus-within input{color:var(--text-primary,#222)}.character-list{display:flex;flex-wrap:wrap;gap:6px}.character-list button{display:flex;max-width:100%;height:31px;align-items:center;gap:6px;padding:0 9px;border:1px solid transparent;border-radius:9px;background:var(--sys-bg-primary,#f3f4f6);color:var(--text-secondary,#666);font:inherit;font-size:11px}.character-list i{display:flex;width:14px;height:14px;align-items:center;justify-content:center;border:1px solid #c5c7ca;border-radius:4px;color:transparent;font-size:9px;font-style:normal}.character-list button.selected{color:var(--text-primary,#333)}.character-list button.selected i{border-color:var(--accent-color,#576b95);background:var(--accent-color,#576b95);color:#fff}.character-hint,.empty-characters{margin:8px 0 0;color:var(--text-tertiary,#999);font-size:10px;line-height:1.45}.validation{margin:9px 1px 2px;color:#c24a4a;font-size:10px}.progress{position:relative;flex:0 0 22px;overflow:hidden;border-radius:7px;background:var(--sys-bg-primary,#f2f3f5)}.progress>span{position:absolute;inset:0 auto 0 0;background:color-mix(in srgb,var(--accent-color,#2b7de9) 25%,transparent)}.progress small{position:relative;display:block;text-align:center;color:var(--text-secondary,#666);font-size:9.5px;line-height:22px}footer{display:flex;gap:8px;padding-top:9px}footer button{height:36px;border:0;border-radius:10px;font:inherit;font-size:12px;font-weight:600}.cancel{flex:0 0 30%;background:var(--sys-bg-primary,#f1f2f4);color:var(--text-secondary,#666)}.confirm{flex:1;background:var(--accent-color,#2b7de9);color:#fff}button:disabled{opacity:.38}@media(max-width:340px){.refresh-sheet{padding-left:11px;padding-right:11px}.count-row{grid-template-columns:repeat(2,1fr)}}
</style>
