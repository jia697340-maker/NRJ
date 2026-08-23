<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ForumCircle } from '../../../types/forum'
import ForumHeader from '../components/ForumHeader.vue'
import ForumEmptyState from '../components/ForumEmptyState.vue'

const props = defineProps<{ circles: ForumCircle[]; activeAccountId: string; memberships: Array<{ circleId: string; accountId: string; role: string }> }>()
const emit = defineEmits<{ (e:'back'):void; (e:'open', circle:ForumCircle):void; (e:'join', id:string):void; (e:'create', value:{name:string;description:string;contentScope:string;isPublic:boolean}):void }>()
const mode = ref<'mine'|'discover'>('mine')
const creating = ref(false)
const name = ref('')
const contentScope = ref('')
const mine = computed(() => new Set(props.memberships.filter(item => item.accountId === props.activeAccountId && !['pending','banned'].includes(item.role)).map(item => item.circleId)))
const display = computed(() => mode.value === 'mine' ? props.circles.filter(item => mine.value.has(item.id)) : props.circles.filter(item => item.searchable && !mine.value.has(item.id)))
const submit = () => { const scope=contentScope.value.trim();if(!name.value.trim()||!scope)return; emit('create',{name:name.value,description:scope.slice(0,80),contentScope:scope,isPublic:true}); name.value='';contentScope.value='';creating.value=false }
</script>
<template>
  <div class="circles-view">
    <ForumHeader title="圈子" show-back @back="emit('back')"><template #right><button class="head-text-btn" type="button" @click="creating=!creating">{{creating?'取消':'创建'}}</button></template></ForumHeader>
    <div class="segment"><button :class="{active:mode==='mine'}" @click="mode='mine'">我的圈子</button><button :class="{active:mode==='discover'}" @click="mode='discover'">发现</button></div>
    <form v-if="creating" class="create-strip" @submit.prevent="submit"><input v-model="name" maxlength="20" placeholder="圈子名称"/><input v-model="contentScope" maxlength="240" placeholder="这里聊什么"/><button :disabled="!name.trim()||!contentScope.trim()">完成</button></form>
    <div class="circle-scroll">
      <div v-for="circle in display" :key="circle.id" class="circle-row" role="button" tabindex="0" @click="emit('open',circle)" @keyup.enter="emit('open',circle)">
        <span class="circle-avatar">{{circle.avatar||circle.name.slice(0,1)}}</span>
        <span class="circle-copy"><b>{{circle.name}}</b><small>{{circle.description||'暂无简介'}}</small><em>{{circle.memberCount}} 人 · {{circle.tags.slice(0,2).join(' / ')||'综合'}}</em></span>
        <button v-if="mode==='discover'" class="join-btn" type="button" @click.stop="emit('join',circle.id)">加入</button><i v-else>›</i>
      </div>
      <ForumEmptyState v-if="!display.length" :title="mode==='mine'?'还没有加入圈子':'暂无可发现圈子'" :description="mode==='mine'?'创建或加入一个感兴趣的圈子吧':'隐藏圈和邀请圈不会出现在这里'" />
    </div>
  </div>
</template>
<style scoped>
.circles-view{display:flex;flex-direction:column;height:100%;background:var(--sys-bg-primary,#f5f5f7)}.head-text-btn{border:0;background:transparent;color:var(--accent-color,#2b7de9);font:inherit;font-size:13px;padding:6px 4px}.segment{display:flex;gap:3px;padding:7px 12px;background:var(--sys-bg-secondary,#fff);border-bottom:1px solid var(--border-color,rgba(0,0,0,.06))}.segment button{flex:1;height:30px;border:0;border-radius:8px;background:transparent;color:var(--text-secondary,#777);font-size:13px}.segment button.active{background:var(--sys-bg-tertiary,#f0f1f3);color:var(--text-primary,#222);font-weight:600}.create-strip{display:grid;grid-template-columns:minmax(72px,.7fr) minmax(90px,1.3fr) auto;gap:7px;padding:9px 12px;background:var(--sys-bg-secondary,#fff);border-bottom:1px solid var(--border-color,rgba(0,0,0,.06))}.create-strip input{min-width:0;height:32px;border:1px solid var(--border-color,#e5e5e5);border-radius:8px;background:var(--sys-bg-primary,#f7f7f8);padding:0 8px;color:var(--text-primary,#222);font:inherit;font-size:12px;outline:0}.create-strip button{border:0;border-radius:8px;background:var(--accent-color,#2b7de9);color:#fff;padding:0 10px;font-size:12px}.create-strip button:disabled{opacity:.35}.circle-scroll{flex:1;overflow:auto;background:var(--sys-bg-secondary,#fff)}.circle-row{display:flex;width:100%;min-width:0;align-items:center;gap:11px;padding:12px 16px;border:0;border-bottom:1px solid var(--border-color,rgba(0,0,0,.055));background:transparent;text-align:left;color:var(--text-primary,#222)}.circle-avatar{display:flex;flex:0 0 42px;height:42px;align-items:center;justify-content:center;border-radius:12px;background:var(--sys-bg-tertiary,#eceef1);font-size:15px;font-weight:650}.circle-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}.circle-copy b{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.circle-copy small{font-size:12px;color:var(--text-secondary,#777);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.circle-copy em{font-size:10.5px;color:var(--text-tertiary,#999);font-style:normal}.circle-row>i{flex-shrink:0;color:var(--text-tertiary,#aaa);font-size:20px;font-style:normal}.join-btn{flex:0 0 auto;height:27px;border:1px solid var(--accent-color,#2b7de9);border-radius:999px;background:transparent;color:var(--accent-color,#2b7de9);padding:0 11px;font-size:12px}@media(max-width:340px){.create-strip{grid-template-columns:1fr auto}.create-strip input:nth-child(2){grid-column:1/2}.circle-row{padding-left:12px;padding-right:12px}}
</style>
