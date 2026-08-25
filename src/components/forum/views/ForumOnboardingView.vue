<script setup lang="ts">
import { computed, ref } from 'vue'
import AvatarUploadModal from '../../AvatarUploadModal.vue'
import ForumAvatar from '../components/ForumAvatar.vue'

const emit = defineEmits<{ (e: 'complete', value: { name: string; handle: string; bio: string; avatar: string; defaultSquare: boolean; generateStrangers: boolean }): void }>()
const name = ref('')
const handle = ref('')
const bio = ref('')
const avatar = ref('')
const avatarUploadVisible = ref(false)
const defaultSquare = ref(false)
const generateStrangers = ref(true)
const canSubmit = computed(() => name.value.trim().length > 0 && handle.value.trim().length > 0)
</script>

<template>
  <div class="forum-onboarding">
    <header class="onboarding-head">
      <span class="eyebrow">NRJ FORUM</span>
      <h1>创建论坛账号</h1>
      <p>论坛与聊天账号彼此独立，只导入你明确选择的内容。</p>
    </header>
    <div class="onboarding-form">
      <button class="avatar-picker" type="button" @click="avatarUploadVisible = true">
        <ForumAvatar :src="avatar" :name="name || '我'" size="xl" />
        <span><b>{{ avatar ? '更换头像' : '添加头像' }}</b><small>支持本地图片或网络图片地址</small></span><i>›</i>
      </button>
      <label class="field-row"><span>昵称</span><input v-model="name" maxlength="24" placeholder="论坛中显示的名字" /></label>
      <label class="field-row"><span>论坛号</span><div class="handle-input"><i>@</i><input v-model="handle" maxlength="32" placeholder="唯一 ID" /></div></label>
      <label class="field-row field-area"><span>简介</span><textarea v-model="bio" maxlength="160" placeholder="可以稍后再完善"></textarea></label>
      <div class="choice-list">
        <label class="choice-row"><span><b>进入公共广场</b><small>创建一个可选的初始公共圈子</small></span><input v-model="defaultSquare" type="checkbox" /><i></i></label>
      </div>
      <button class="primary-submit" type="button" :disabled="!canSubmit" @click="emit('complete', { name, handle, bio, avatar, defaultSquare, generateStrangers })">进入论坛</button>
    </div>
    <AvatarUploadModal v-model:visible="avatarUploadVisible" :current-avatar="avatar" shape="circle" title="设置论坛头像" @saved="value => avatar = value || ''" />
  </div>
</template>

<style scoped>
.forum-onboarding{height:100%;overflow:auto;background:var(--sys-bg-primary,#f5f5f7);color:var(--text-primary,#222);padding:clamp(34px,10vh,72px) 20px 24px;box-sizing:border-box}.onboarding-head,.onboarding-form{max-width:420px;margin:0 auto}.eyebrow{font-size:10px;letter-spacing:1.8px;color:var(--text-tertiary,#999);font-weight:650}.onboarding-head h1{font-size:23px;line-height:1.25;margin:10px 0 7px;letter-spacing:.2px}.onboarding-head p{font-size:13px;line-height:1.55;color:var(--text-secondary,#777);margin:0 0 24px}.onboarding-form{background:var(--sys-bg-secondary,#fff);border-radius:16px;padding:4px 16px 16px;box-shadow:0 1px 0 rgba(0,0,0,.04)}.avatar-picker{display:flex;width:100%;align-items:center;gap:12px;padding:14px 0;border:0;border-bottom:1px solid var(--border-color,rgba(0,0,0,.06));background:transparent;color:var(--text-primary,#222);text-align:left}.avatar-picker>span{display:flex;min-width:0;flex:1;flex-direction:column;gap:4px}.avatar-picker b{font-size:14px}.avatar-picker small{color:var(--text-tertiary,#999);font-size:11px}.avatar-picker>i{color:var(--text-tertiary,#999);font-style:normal}.field-row{display:flex;align-items:center;gap:12px;min-height:50px;border-bottom:1px solid var(--border-color,rgba(0,0,0,.06));font-size:14px}.field-row>span{flex:0 0 54px;font-weight:550}.field-row input,.field-row textarea{min-width:0;flex:1;border:0;outline:0;background:transparent;color:var(--text-primary,#222);font:inherit;font-size:14px;padding:8px 0}.handle-input{display:flex;align-items:center;min-width:0;flex:1}.handle-input i{font-style:normal;color:var(--text-tertiary,#999)}.field-area{align-items:flex-start;padding-top:13px}.field-area textarea{min-height:58px;resize:none;line-height:1.5}.choice-list{margin-top:9px}.choice-row{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;cursor:pointer}.choice-row span{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px}.choice-row b{font-size:13.5px;font-weight:550}.choice-row small{font-size:11px;line-height:1.35;color:var(--text-tertiary,#999)}.choice-row input{position:absolute;opacity:0}.choice-row>i{position:relative;flex:0 0 38px;height:22px;border-radius:12px;background:#d8dbe0;transition:.2s}.choice-row>i:after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.18);transition:.2s}.choice-row input:checked+i{background:var(--accent-color,#576b95)}.choice-row input:checked+i:after{transform:translateX(16px)}.primary-submit{width:100%;height:40px;margin-top:13px;border:0;border-radius:10px;background:var(--accent-color,#2b7de9);color:#fff;font-size:14px;font-weight:600}.primary-submit:disabled{opacity:.35}@media(max-width:340px){.forum-onboarding{padding-left:12px;padding-right:12px}.onboarding-form{padding-left:12px;padding-right:12px}.field-row>span{flex-basis:48px}}
</style>
