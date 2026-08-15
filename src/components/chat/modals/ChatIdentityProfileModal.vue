<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  addIdentityAsset,
  addIdentityVersion,
  loadIdentityProfile,
  providerIdentityCapability,
  removeIdentityVersion,
  saveIdentityProfile,
  type IdentityAssetKind,
  type IdentityOwnerType,
  type IdentityProfile
} from '../../../services/identityProfile'

const props = defineProps<{
  visible: boolean
  ownerType: IdentityOwnerType
  ownerId: string
  ownerName: string
  ownerAvatar?: string | null
  provider?: string
  availableCharacters?: any[]
}>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void; (e: 'saved', profile: IdentityProfile): void }>()

const activeTab = ref<'identity' | 'versions' | 'companions'>('identity')
const profile = ref<IdentityProfile | null>(null)
const isLoading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const uploadKind = ref<IdentityAssetKind>('face')
const statusText = ref('')

const activeVersion = computed(() => profile.value?.versions.find(item => item.id === profile.value?.activeVersionId) || profile.value?.versions[0])
const activeAssets = computed(() => {
  if (!profile.value || !activeVersion.value) return []
  return profile.value.assets.filter(asset => activeVersion.value?.assetIds.includes(asset.id))
})
const capability = computed(() => providerIdentityCapability(props.provider || 'novelai'))
const characterOptions = computed(() => (props.availableCharacters || []).filter(item => String(item.characterEntityId || item.id) !== props.ownerId && Number(item.id) !== 1))
const kindLabels: Record<IdentityAssetKind, string> = { face: '面容', full_body: '全身', hair: '发型', outfit: '服装', style: '画风' }

watch(() => props.visible, async visible => {
  if (!visible) return
  isLoading.value = true
  profile.value = await loadIdentityProfile(props.ownerType, props.ownerId, props.ownerName)
  profile.value.ownerName = props.ownerName
  activeTab.value = 'identity'
  statusText.value = ''
  isLoading.value = false
})

const close = () => emit('update:visible', false)
const save = async () => {
  if (!profile.value) return
  profile.value = await saveIdentityProfile(profile.value)
  emit('saved', profile.value)
  close()
}
const useAvatar = async () => {
  if (!profile.value || !props.ownerAvatar) return
  await addIdentityAsset(profile.value, props.ownerAvatar, 'face', '当前头像')
  statusText.value = '头像已加入当前形象版本'
}
const onFiles = async (event: Event) => {
  if (!profile.value) return
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || []).slice(0, 8)
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    await addIdentityAsset(profile.value, dataUrl, uploadKind.value, file.name.replace(/\.[^.]+$/, ''))
  }
  target.value = ''
  statusText.value = `已加入 ${files.length} 项素材，并完成基础质量检查`
}
const removeAsset = (id: string) => {
  if (!profile.value) return
  profile.value.assets = profile.value.assets.filter(item => item.id !== id)
  profile.value.versions.forEach(version => { version.assetIds = version.assetIds.filter(assetId => assetId !== id) })
}
const createVersion = () => {
  if (!profile.value) return
  const version = addIdentityVersion(profile.value, `形象 ${profile.value.versions.length + 1}`)
  const base = profile.value.versions[0]
  version.description = base.description
  version.immutableTraits = base.immutableTraits
  version.negativePrompt = base.negativePrompt
  version.locks = { ...base.locks }
  version.assetIds = profile.value.assets.filter(asset => base.assetIds.includes(asset.id) && asset.kind === 'face').map(asset => asset.id)
  activeTab.value = 'versions'
}
const deleteVersion = (id: string) => {
  if (!profile.value) return
  if (!removeIdentityVersion(profile.value, id)) statusText.value = '至少需要保留一个形象版本'
}
const toggleCompanion = (ownerId: string) => {
  if (!profile.value) return
  const id = `character:${ownerId}`
  profile.value.companionProfileIds = profile.value.companionProfileIds.includes(id)
    ? profile.value.companionProfileIds.filter(item => item !== id)
    : [...profile.value.companionProfileIds, id]
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="overlay" @click.self="close">
      <div class="modal">
        <header>
          <div><h3>{{ ownerType === 'character' ? '角色固定形象' : '我的固定形象' }}</h3><p>支持真人、二次元、3D、游戏角色与原创设定。</p></div>
          <button class="close" aria-label="关闭" @click="close">×</button>
        </header>
        <nav>
          <button :class="{active:activeTab==='identity'}" @click="activeTab='identity'">形象</button>
          <button :class="{active:activeTab==='versions'}" @click="activeTab='versions'">版本</button>
          <button :class="{active:activeTab==='companions'}" @click="activeTab='companions'">同框角色</button>
        </nav>
        <main v-if="profile && activeVersion">
          <section v-if="activeTab==='identity'">
            <label class="switch-row"><span><strong>保持形象一致</strong><small>{{ capability.label }}；无法保证每次完全相同。</small></span><input v-model="profile.enabled" type="checkbox"><i></i></label>
            <div class="strength-block">
              <span class="field-title">一致性强度</span>
              <div class="segments"><button v-for="item in [{id:'natural',name:'自然'},{id:'stable',name:'稳定'},{id:'strong',name:'强一致'}]" :key="item.id" :class="{active:profile.strength===item.id}" @click="profile.strength=item.id as any">{{item.name}}</button></div>
            </div>
            <div class="lock-grid">
              <button v-for="item in [{id:'face',name:'固定面容'},{id:'hair',name:'固定发型'},{id:'outfit',name:'固定服装'},{id:'style',name:'固定画风'}]" :key="item.id" :class="{active:(activeVersion.locks as any)[item.id]}" @click="(activeVersion.locks as any)[item.id]=!(activeVersion.locks as any)[item.id]">{{ item.name }}</button>
            </div>
            <label><span>形象设定</span><textarea v-model="activeVersion.description" rows="3" placeholder="外貌、体型、气质、材质或画面形态……"></textarea></label>
            <label><span>不可改变特征</span><textarea v-model="activeVersion.immutableTraits" rows="2" placeholder="例如：左眼下方泪痣、金色机械右臂、红色挑染"></textarea></label>
            <label><span>纠错与排除词</span><textarea v-model="activeVersion.negativePrompt" rows="2" placeholder="例如：不要改变瞳色、不要出现双重发色"></textarea></label>

            <div class="upload-head"><span class="field-title">参考素材</span><small>建议 2～4 张清晰、主体单一且角度互补的素材</small></div>
            <p class="notice">素材保存在本机，并会在你主动选择“固定形象档案”备份模块时进入备份。请只使用你有权使用的素材；删除角色时，其角色形象档案会同步删除。</p>
            <div class="kind-segments"><button v-for="(label,key) in kindLabels" :key="key" :class="{active:uploadKind===key}" @click="uploadKind=key as IdentityAssetKind">{{label}}</button></div>
            <div class="upload-actions"><button class="secondary" @click="fileInput?.click()">上传素材</button><button v-if="ownerAvatar" class="secondary" @click="useAvatar">使用当前头像</button><input ref="fileInput" hidden type="file" accept="image/*" multiple @change="onFiles"></div>
            <div v-if="activeAssets.length" class="asset-grid">
              <div v-for="asset in activeAssets" :key="asset.id" class="asset-card">
                <img :src="asset.dataUrl"><div><strong>{{kindLabels[asset.kind]}} · {{asset.name}}</strong><small v-if="asset.qualityNotes?.length">{{asset.qualityNotes.join('；')}}</small><small v-else>质量检查通过</small></div><button @click="removeAsset(asset.id)">×</button>
              </div>
            </div>
            <div v-else class="empty">暂无参考素材，可先只用文字设定。</div>
          </section>

          <section v-else-if="activeTab==='versions'">
            <p class="notice">面容可以保持一致，同时建立日常、古风、学生时代或其他世界观版本。</p>
            <button class="secondary" @click="createVersion">新增形象版本</button>
            <div class="version-list">
              <div v-for="version in profile.versions" :key="version.id" class="version-card" :class="{active:profile.activeVersionId===version.id}" @click="profile.activeVersionId=version.id">
                <div><input v-model="version.name" @click.stop><small>{{version.assetIds.length}} 项素材 · {{profile.activeVersionId===version.id?'当前使用':'点击切换'}}</small></div><button v-if="profile.versions.length>1" @click.stop="deleteVersion(version.id)">删除</button>
              </div>
            </div>
          </section>

          <section v-else>
            <p class="notice">用于合照或多人画面。生成时会按人物编号分别约束，减少串脸；对方也需要先建立固定形象。</p>
            <div v-if="ownerType==='user'" class="notice">我的形象可与所选角色共同用于情侣照、合照与约会画面。</div>
            <label v-for="item in characterOptions" :key="item.id" class="companion-row" @click="toggleCompanion(String(item.characterEntityId||item.id))">
              <span class="mini-avatar" :style="item.avatarUrl?{backgroundImage:`url(${item.avatarUrl})`}:{}">{{item.avatarUrl?'':(item.realName||item.name||'角').charAt(0)}}</span>
              <span><strong>{{item.realName||item.name}}</strong><small>加入当前画面的身份约束</small></span>
              <b :class="{checked:profile.companionProfileIds.includes(`character:${item.characterEntityId||item.id}`)}"></b>
            </label>
            <div v-if="!characterOptions.length" class="empty">暂无可选择的其他角色</div>
          </section>
        </main>
        <main v-else class="empty">{{isLoading?'正在读取形象档案…':'无法读取形象档案'}}</main>
        <div v-if="statusText" class="status">{{statusText}}</div>
        <footer><button class="secondary" @click="close">取消</button><button class="primary" @click="save">保存形象档案</button></footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay{position:fixed;z-index:20010;inset:0;display:grid;place-items:center;padding:16px;background:rgba(20,23,33,.45);backdrop-filter:blur(8px)}.modal{width:min(680px,95vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;border-radius:22px;background:var(--sys-bg-primary,#fff);color:var(--text-primary,#222);box-shadow:0 24px 80px rgba(0,0,0,.25)}header{display:flex;justify-content:space-between;padding:20px 22px 12px}h3{margin:0}header p{margin:4px 0 0;color:var(--text-secondary,#888);font-size:12px}.close{border:0;background:transparent;color:inherit;font-size:29px;cursor:pointer}nav{display:flex;gap:4px;margin:0 20px;padding:4px;border-radius:13px;background:var(--sys-bg-secondary,#f2f3f6)}nav button{flex:1;border:0;border-radius:10px;padding:9px;background:transparent;color:inherit;cursor:pointer}nav .active{background:var(--sys-bg-primary,#fff);font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.08)}main{min-height:330px;padding:18px 22px;overflow:auto}label{display:flex;flex-direction:column;gap:7px;margin:12px 0;font-size:13px;font-weight:600}textarea,input{box-sizing:border-box;width:100%;padding:11px;border:1px solid var(--border-color,#ddd);border-radius:10px;background:var(--sys-bg-secondary,#f6f7f8);color:inherit;outline:none;resize:vertical}.switch-row{position:relative;flex-direction:row;align-items:center;justify-content:space-between;padding:12px;border-radius:12px;background:var(--sys-bg-secondary,#f5f6f8)}.switch-row span{display:flex;flex-direction:column}.switch-row small,.upload-head small,.companion-row small,.asset-card small,.version-card small{color:var(--text-secondary,#888);font-weight:400}.switch-row input{position:absolute;width:1px;height:1px;opacity:0}.switch-row i{width:42px;height:24px;border-radius:14px;background:#c9cbd0;position:relative;transition:.2s}.switch-row i:after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:white;transition:.2s}.switch-row input:checked+i{background:#176b42}.switch-row input:checked+i:after{transform:translateX(18px)}.field-title{font-size:13px;font-weight:600}.strength-block{margin:16px 0}.segments,.kind-segments{display:flex;gap:4px;margin-top:8px;padding:4px;border-radius:12px;background:var(--sys-bg-secondary,#f2f3f6)}.segments button,.kind-segments button{flex:1;border:0;border-radius:9px;padding:8px 5px;background:transparent;color:inherit;cursor:pointer}.segments .active,.kind-segments .active{background:var(--sys-bg-primary,#fff);font-weight:700;box-shadow:0 2px 7px rgba(0,0,0,.08)}.lock-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.lock-grid button{padding:9px 5px;border:1px solid var(--border-color,#ddd);border-radius:10px;background:transparent;color:var(--text-secondary);cursor:pointer}.lock-grid .active{border-color:#176b42;background:rgba(23,107,66,.09);color:#176b42;font-weight:700}.upload-head{display:flex;flex-direction:column;gap:3px;margin-top:18px}.upload-actions{display:flex;gap:8px;margin:10px 0}.secondary{border:0;border-radius:9px;padding:10px 14px;background:#eceef0;color:#4c5158;cursor:pointer}.asset-grid,.version-list{display:flex;flex-direction:column;gap:8px}.asset-card,.version-card,.companion-row{display:flex;align-items:center;gap:10px;margin:0;padding:10px;border-radius:12px;background:var(--sys-bg-secondary,#f5f6f8)}.asset-card img{width:52px;height:52px;object-fit:cover;border-radius:9px}.asset-card>div,.version-card>div,.companion-row>span:nth-child(2){min-width:0;flex:1;display:flex;flex-direction:column}.asset-card button,.version-card button{border:0;background:transparent;color:#ff3b30;cursor:pointer}.notice{padding:10px;border-radius:10px;background:var(--sys-bg-secondary,#f5f6f8);color:var(--text-secondary,#777);font-size:12px}.version-card{border:1px solid transparent;cursor:pointer}.version-card.active{border-color:#176b42}.version-card input{padding:4px 7px;font-weight:700;background:transparent}.companion-row{flex-direction:row;cursor:pointer}.mini-avatar{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:var(--sys-bg-primary);background-position:center;background-size:cover}.companion-row b{width:20px;height:20px;border:1px solid var(--border-color,#ccc);border-radius:50%}.companion-row b.checked{border:6px solid #176b42}.empty{padding:30px;text-align:center;color:var(--text-secondary,#888);font-size:13px}.status{margin:0 22px;padding:8px 10px;border-radius:9px;background:rgba(23,107,66,.08);color:#176b42;font-size:12px}footer{display:flex;justify-content:flex-end;gap:10px;padding:14px 22px 20px;border-top:1px solid var(--border-color,#eee)}.primary{border:0;border-radius:11px;padding:11px 18px;background:#176b42;color:#fff;font-weight:700;cursor:pointer}@media(max-width:560px){.lock-grid{grid-template-columns:1fr 1fr}.kind-segments{overflow:auto}.kind-segments button{min-width:58px}}
</style>
