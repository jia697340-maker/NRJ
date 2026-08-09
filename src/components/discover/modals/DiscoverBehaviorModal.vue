/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  availableCharacters: any[]
  groups: { id: string, name: string }[]
  getMomentBehavior: (chat: any) => any
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'contacts-updated'): void
}>()

const showBehaviorEditor = ref(false)
const behaviorSection = ref<'schedule' | 'interaction' | 'content'>('schedule')
const showAudienceGroupPicker = ref(false)
const selectedBehaviorChatId = ref<string | number | null>(null)
const behaviorDraft = ref<any>({})

watch(() => behaviorDraft.value.audience, value => { 
  if (['部分可见', '不给谁看'].includes(value)) showAudienceGroupPicker.value = true 
})

const openBehavior = (chat: any) => {
  selectedBehaviorChatId.value = chat.id
  behaviorDraft.value = JSON.parse(JSON.stringify(props.getMomentBehavior(chat)))
  behaviorSection.value = 'schedule'
  showBehaviorEditor.value = true
}

const closeBehaviorEditor = () => {
  showBehaviorEditor.value = false
  selectedBehaviorChatId.value = null
}

const adjustBehaviorNumber = (field: string, delta: number, min = 0, max = 999) => {
  behaviorDraft.value[field] = Math.min(max, Math.max(min, Number(behaviorDraft.value[field] || 0) + delta))
}

const saveBehavior = () => {
  const chat = props.availableCharacters.find((item: any) => item.id === selectedBehaviorChatId.value)
  if (!chat) return
  chat.momentBehavior = JSON.parse(JSON.stringify(behaviorDraft.value))
  
  const key = localStorage.getItem('clingy_legacy_owner') ? `clingy_custom_contacts_${localStorage.getItem('clingy_legacy_owner')}` : 'clingy_custom_contacts'
  const saved = JSON.parse(localStorage.getItem(key) || '[]')
  const target = saved.find((item: any) => item.id === chat.id)
  if (target) target.momentBehavior = chat.momentBehavior
  localStorage.setItem(key, JSON.stringify(saved))
  
  emit('contacts-updated')
  closeBehaviorEditor()
}
</script>

<template>
  <Teleport to="body">
    <!-- 主列表 -->
    <div v-if="visible && !showBehaviorEditor" class="moment-modal-overlay behavior-modal-overlay" @click.self="emit('update:visible', false)">
      <div class="custom-modal behavior-picker-modal">
        <div class="behavior-picker-header">
          <h3>选择要设置的角色</h3>
          <p class="behavior-picker-tip">默认由角色像真人一样自主决定；需要时也可为单个角色启用手动规则。</p>
        </div>
        <div class="behavior-role-list">
          <button v-for="chat in availableCharacters" :key="chat.id" class="behavior-role-item" @click="openBehavior(chat)">
            <span>{{ chat.name }}</span><span class="behavior-role-arrow">›</span>
          </button>
          <div v-if="!availableCharacters.length" class="empty-note">暂无可设置的角色</div>
        </div>
        <div class="behavior-picker-footer">
          <button class="behavior-picker-cancel" @click="emit('update:visible', false)">取消</button>
        </div>
      </div>
    </div>

    <!-- 编辑器 -->
    <div v-if="showBehaviorEditor" class="moment-modal-overlay behavior-modal-overlay" @click.self="closeBehaviorEditor">
      <div class="behavior-panel">
        <header>
          <button @click="closeBehaviorEditor">‹</button>
          <strong>{{ availableCharacters.find((chat: any) => chat.id === selectedBehaviorChatId)?.name }} 的朋友圈</strong>
          <span></span>
        </header>
        <div class="behavior-form">
          <div class="behavior-row behavior-mode-row">
            <span><b>真人自主模式</b><small>由角色按人设、情境和关系自由决定，不使用下面的概率、冷却或预设文风</small></span>
            <label class="behavior-switch">
              <input type="checkbox" :checked="behaviorDraft.mode !== 'custom'" @change="behaviorDraft.mode = ($event.target as HTMLInputElement).checked ? 'autonomous' : 'custom'"><i></i>
            </label>
          </div>
          
          <div v-if="behaviorDraft.mode !== 'custom'" class="behavior-autonomous-note">
            已关闭全部行为参数。角色想不想发、发不发图、要不要点赞评论以及怎么说，都由角色自己决定。
          </div>
          <template v-else>
            <div class="behavior-manual-label">高级手动规则</div>
            <div class="behavior-section-nav">
              <button :class="{ active: behaviorSection === 'schedule' }" @click="behaviorSection = 'schedule'">频率</button>
              <button :class="{ active: behaviorSection === 'interaction' }" @click="behaviorSection = 'interaction'">互动</button>
              <button :class="{ active: behaviorSection === 'content' }" @click="behaviorSection = 'content'">内容</button>
            </div>
            
            <template v-if="behaviorSection === 'schedule'">
              <div class="behavior-row"><span>活跃开始</span><div class="stepper"><button @click="adjustBehaviorNumber('activeStart', -1, 0, 23)">−</button><b>{{ behaviorDraft.activeStart }}:00</b><button @click="adjustBehaviorNumber('activeStart', 1, 0, 23)">＋</button></div></div>
              <div class="behavior-row"><span>活跃结束</span><div class="stepper"><button @click="adjustBehaviorNumber('activeEnd', -1, 0, 23)">−</button><b>{{ behaviorDraft.activeEnd }}:00</b><button @click="adjustBehaviorNumber('activeEnd', 1, 0, 23)">＋</button></div></div>
              <div class="behavior-row"><span>发帖冷却</span><div class="stepper"><button @click="adjustBehaviorNumber('postCooldownMinutes', -10)">−</button><b>{{ behaviorDraft.postCooldownMinutes }} 分钟</b><button @click="adjustBehaviorNumber('postCooldownMinutes', 10)">＋</button></div></div>
            </template>
            
            <template v-else-if="behaviorSection === 'interaction'">
              <div class="behavior-row"><span>互动冷却</span><div class="stepper"><button @click="adjustBehaviorNumber('interactCooldownMinutes', -5)">−</button><b>{{ behaviorDraft.interactCooldownMinutes }} 分钟</b><button @click="adjustBehaviorNumber('interactCooldownMinutes', 5)">＋</button></div></div>
              <div class="behavior-slider"><div><span>点赞概率</span><b>{{ behaviorDraft.likeProbability }}%</b></div><input type="range" min="0" max="100" v-model.number="behaviorDraft.likeProbability" /></div>
              <div class="behavior-slider"><div><span>评论概率</span><b>{{ behaviorDraft.commentProbability }}%</b></div><input type="range" min="0" max="100" v-model.number="behaviorDraft.commentProbability" /></div>
            </template>
            
            <template v-else>
              <div class="behavior-slider"><div><span>发图概率</span><b>{{ behaviorDraft.imageProbability }}%</b></div><input type="range" min="0" max="100" v-model.number="behaviorDraft.imageProbability" /></div>
              <div class="behavior-text"><span>额外表达偏好（可留空）</span><textarea v-model="behaviorDraft.style" placeholder="留空时完全遵循角色自己的人设"></textarea></div>
              <button class="behavior-choice" @click="showAudienceGroupPicker = true"><span>默认受众</span><b>{{ behaviorDraft.audience }} <i>›</i></b></button>
            </template>
          </template>
          <button class="behavior-save" @click="saveBehavior">保存设置</button>
        </div>
      </div>
    </div>

    <!-- 受众分组选择 -->
    <div v-if="showAudienceGroupPicker" class="moment-modal-overlay audience-picker-overlay" @click.self="showAudienceGroupPicker = false">
      <div class="moment-sheet">
        <h3>默认受众</h3>
        <button v-for="audience in ['公开', '私密', '部分可见', '不给谁看']" :key="audience" class="audience-option" :class="{ active: behaviorDraft.audience === audience }" @click="behaviorDraft.audience = audience">
          <span>{{ audience }}</span><span v-if="behaviorDraft.audience === audience">✓</span>
        </button>
        <template v-if="['部分可见', '不给谁看'].includes(behaviorDraft.audience)">
          <h3 class="audience-group-title">选择分组</h3>
          <label v-for="group in groups" :key="group.id" class="audience-check">
            <span>{{ group.name }}</span>
            <input type="checkbox" :value="group.id" v-model="behaviorDraft.audienceGroupIds" />
          </label>
          <div v-if="!groups.length" class="empty-note">请先在联系人中创建分组</div>
        </template>
        <button @click="showAudienceGroupPicker = false">确定</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@import '../../app_ChatDiscover.css';
</style>
