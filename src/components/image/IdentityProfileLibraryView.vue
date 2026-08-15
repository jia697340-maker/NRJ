<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listIdentityProfiles, type IdentityProfile } from '../../services/identityProfile'
import ChatIdentityProfileModal from '../chat/modals/ChatIdentityProfileModal.vue'

defineEmits<{ (e: 'back'): void }>()
const profiles = ref<IdentityProfile[]>([])
const selected = ref<IdentityProfile | null>(null)
const showEditor = ref(false)
const load = async () => { profiles.value = await listIdentityProfiles() }
const open = (profile: IdentityProfile) => { selected.value = profile; showEditor.value = true }
onMounted(load)
</script>

<template>
  <div class="library-view">
    <header><button @click="$emit('back')">‹</button><div><h2>固定形象库</h2><p>统一管理角色与用户的形象版本和参考素材</p></div></header>
    <main>
      <div v-if="profiles.length" class="profile-list">
        <button v-for="profile in profiles" :key="profile.id" class="profile-card" @click="open(profile)">
          <span class="cover" :style="profile.assets[0]?.dataUrl?{backgroundImage:`url(${profile.assets[0].dataUrl})`}:{}">{{profile.assets[0]?'':profile.ownerName.charAt(0)}}</span>
          <span><strong>{{profile.ownerName||'未命名形象'}}</strong><small>{{profile.ownerType==='character'?'角色':'用户'}} · {{profile.versions.length}} 个版本 · {{profile.assets.length}} 项素材</small></span>
          <em>{{profile.enabled?'已启用':'未启用'}}</em><b>›</b>
        </button>
      </div>
      <div v-else class="empty"><strong>暂无固定形象档案</strong><span>请从角色设置、用户设置或角色主页中创建。</span></div>
    </main>
    <ChatIdentityProfileModal v-if="selected" v-model:visible="showEditor" :owner-type="selected.ownerType" :owner-id="selected.ownerId" :owner-name="selected.ownerName" @saved="load" />
  </div>
</template>

<style scoped>
.library-view{height:100%;overflow:auto;background:var(--sys-bg-primary);color:var(--text-primary)}header{display:flex;align-items:center;gap:12px;padding:22px 24px 14px}header button{width:36px;height:36px;border:0;border-radius:50%;background:var(--sys-bg-secondary);color:inherit;font-size:27px;cursor:pointer}h2{margin:0;font-size:20px}header p{margin:4px 0 0;color:var(--text-secondary);font-size:12px}main{padding:10px 24px 30px}.profile-list{display:flex;flex-direction:column;gap:10px}.profile-card{display:flex;align-items:center;gap:12px;width:100%;padding:12px;border:1px solid var(--border-color);border-radius:16px;background:var(--sys-bg-secondary);color:inherit;text-align:left;cursor:pointer}.cover{display:flex;align-items:center;justify-content:center;width:54px;height:54px;flex:none;border-radius:13px;background:var(--sys-bg-primary);background-position:center;background-size:cover;font-size:20px}.profile-card>span:nth-child(2){display:flex;min-width:0;flex:1;flex-direction:column;gap:4px}.profile-card small{color:var(--text-secondary);font-size:11px}.profile-card em{color:#176b42;font-size:11px;font-style:normal}.profile-card b{color:var(--text-tertiary);font-size:22px}.empty{display:flex;min-height:260px;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:var(--text-secondary)}.empty strong{color:var(--text-primary)}.empty span{font-size:12px}
</style>
