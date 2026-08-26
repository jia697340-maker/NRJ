<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { ForumAccount, ForumAvatarLibraryItem, ForumPersona } from '../../../types/forum'
import ForumAvatar from '../components/ForumAvatar.vue'

const props = defineProps<{ visible: boolean; account: ForumAccount | null; persona: ForumPersona | null; avatars: ForumAvatarLibraryItem[] }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', accountId: string, account: Record<string, unknown>, persona: Record<string, unknown>): void
  (e: 'assign-avatar', accountId: string, avatarId: string): void
  (e: 'refresh-profile', accountId: string): void
}>()
const form = reactive({ name: '', handle: '', bio: '', location: '', banner: '', gender: 'unknown', identity: '', personality: '', occupation: '', interests: '', boundaries: '', postingStyle: '', commentingStyle: '', dmStyle: '', accountLocks: [] as string[], personaLocks: [] as string[] })
watch(() => [props.visible, props.account, props.persona] as const, () => {
  const a = props.account; const p = props.persona
  if (!a) return
  Object.assign(form, { name: a.name, handle: a.handle, bio: a.bio || '', location: a.location || '', banner: a.banner || '', gender: a.gender || 'unknown', identity: p?.identity || '', personality: p?.personality || '', occupation: p?.occupation || '', interests: (p?.interests || []).join('、'), boundaries: (p?.boundaries || []).join('、'), postingStyle: p?.postingStyle || '', commentingStyle: p?.commentingStyle || '', dmStyle: p?.dmStyle || '', accountLocks: [...(a.lockedFields || [])], personaLocks: [...(p?.lockedFields || [])] })
}, { immediate: true })
const compatibleAvatars = computed(() => props.avatars.filter(item => form.gender === 'unknown' || form.gender === 'other' ? true : item.group === form.gender || item.group === 'other'))
const toggle = (scope: 'accountLocks' | 'personaLocks', field: string) => {
  const values = form[scope]; form[scope] = values.includes(field) ? values.filter(item => item !== field) : [...values, field]
}
const save = () => {
  if (!props.account || !form.name.trim() || !form.handle.trim()) return
  const accountValues: Record<string, unknown> = { name: form.name, handle: form.handle, bio: form.bio, location: form.location, banner: form.banner, gender: form.gender }
  const personaValues: Record<string, unknown> = { identity: form.identity, personality: form.personality, occupation: form.occupation, interests: form.interests.split(/[、,，]/).map(v => v.trim()).filter(Boolean), boundaries: form.boundaries.split(/[、,，]/).map(v => v.trim()).filter(Boolean), postingStyle: form.postingStyle, commentingStyle: form.commentingStyle, dmStyle: form.dmStyle }
  const changedAccount = Object.entries(accountValues).filter(([key, value]) => String(value ?? '') !== String((props.account as unknown as Record<string, unknown>)[key] ?? '')).map(([key]) => key)
  const changedPersona = Object.entries(personaValues).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify((props.persona as unknown as Record<string, unknown> | null)?.[key] ?? (Array.isArray(value) ? [] : ''))).map(([key]) => key)
  emit('save', props.account.id, { ...accountValues, lockedFields: [...new Set([...form.accountLocks, ...changedAccount])] }, { ...personaValues, lockedFields: [...new Set([...form.personaLocks, ...changedPersona])] })
  emit('close')
}
</script>

<template>
  <div v-if="visible&&account" class="overlay" @click.self="emit('close')"><section>
    <header><div><b>管理 NPC</b><small>账号字段与 persona 字段分别锁定</small></div><button @click="emit('close')">×</button></header>
    <div class="scroll">
      <div class="identity"><ForumAvatar :src="account.avatar" :name="form.name" size="xl"/><div><b>{{form.name}}</b><small>@{{form.handle}}</small></div><button @click="emit('refresh-profile',account.id)">AI 增量刷新主页</button></div>
      <label>昵称<input v-model="form.name" maxlength="24"><button :class="{on:form.accountLocks.includes('name')}" @click.prevent="toggle('accountLocks','name')">锁</button></label>
      <label>论坛号<input v-model="form.handle" maxlength="32"><button :class="{on:form.accountLocks.includes('handle')}" @click.prevent="toggle('accountLocks','handle')">锁</button></label>
      <label>性别<select v-model="form.gender"><option value="unknown">未指定</option><option value="female">女</option><option value="male">男</option><option value="other">其他</option></select><button :class="{on:form.accountLocks.includes('gender')}" @click.prevent="toggle('accountLocks','gender')">锁</button></label>
      <label>简介<textarea v-model="form.bio"/><button :class="{on:form.accountLocks.includes('bio')}" @click.prevent="toggle('accountLocks','bio')">锁</button></label>
      <label>所在地<input v-model="form.location"><button :class="{on:form.accountLocks.includes('location')}" @click.prevent="toggle('accountLocks','location')">锁</button></label>
      <label>主页背景<input v-model="form.banner" placeholder="图片 URL"><button :class="{on:form.accountLocks.includes('banner')}" @click.prevent="toggle('accountLocks','banner')">锁</button></label>
      <h4>头像库（已占用头像会按复用规则拦截）</h4><div class="avatars"><button v-for="item in compatibleAvatars" :key="item.id" :title="item.label" @click="emit('assign-avatar',account.id,item.id)"><img :src="item.url"><i>{{item.assignedAccountIds.length?'已用':'可用'}}</i></button></div>
      <h4>完整人设</h4>
      <label v-for="item in [{k:'identity',t:'身份'},{k:'personality',t:'性格'},{k:'occupation',t:'职业'},{k:'interests',t:'兴趣（顿号分隔）'},{k:'boundaries',t:'边界（顿号分隔）'},{k:'postingStyle',t:'发帖风格'},{k:'commentingStyle',t:'评论风格'},{k:'dmStyle',t:'私信风格'}]" :key="item.k">{{item.t}}<textarea v-model="(form as any)[item.k]"/><button :class="{on:form.personaLocks.includes(item.k)}" @click.prevent="toggle('personaLocks',item.k)">锁</button></label>
    </div><footer><button @click="emit('close')">取消</button><button class="primary" @click="save">保存</button></footer>
  </section></div>
</template>

<style scoped>
.overlay{position:absolute;inset:0;z-index:650;display:flex;align-items:flex-end;background:rgba(0,0,0,.42)}section{display:flex;width:100%;max-height:90%;flex-direction:column;border-radius:18px 18px 0 0;background:var(--sys-bg-secondary,#fff)}header,footer{display:flex;align-items:center;justify-content:space-between;padding:11px 15px;border-bottom:1px solid var(--border-color,#eee)}header>div{display:flex;flex-direction:column}header small{color:var(--text-tertiary,#999);font-size:10px}header button,footer button{border:0;border-radius:8px;background:var(--sys-bg-tertiary,#eee);padding:8px 13px;color:inherit}.scroll{overflow:auto;padding:10px 15px}.identity{display:flex;align-items:center;gap:9px;margin-bottom:10px}.identity>div{display:flex;min-width:0;flex:1;flex-direction:column}.identity small{color:#888}.identity>button{border:0;border-radius:8px;background:var(--accent-color,#576b95);padding:7px 9px;color:#fff;font-size:10px}label{display:grid;grid-template-columns:80px minmax(0,1fr) 32px;align-items:center;gap:7px;margin:7px 0;font-size:11.5px}input,select,textarea{box-sizing:border-box;width:100%;min-width:0;border:1px solid var(--border-color,#ddd);border-radius:7px;background:var(--sys-bg-primary,#f7f7f8);padding:6px 8px;color:inherit;font:inherit}textarea{min-height:45px;resize:vertical}label button{height:29px;border:0;border-radius:7px;background:var(--sys-bg-tertiary,#eee);color:#888}label button.on{background:var(--accent-color,#576b95);color:#fff}h4{margin:14px 0 7px;font-size:12px}.avatars{display:flex;gap:7px;overflow:auto}.avatars button{position:relative;flex:0 0 48px;height:48px;border:0;border-radius:50%;padding:0;background:#eee}.avatars img{width:100%;height:100%;border-radius:50%;object-fit:cover}.avatars i{position:absolute;right:-3px;bottom:-3px;border-radius:6px;background:#333;padding:1px 3px;color:#fff;font-size:7px;font-style:normal}footer{justify-content:flex-end;gap:8px;border-top:1px solid var(--border-color,#eee);border-bottom:0}.primary{background:var(--accent-color,#576b95)!important;color:#fff!important}
</style>
