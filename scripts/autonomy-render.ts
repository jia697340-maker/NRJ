/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { createApp, defineComponent, h, nextTick, reactive } from 'vue'
import '../src/style.css'
import '../src/components/app_ChatPreview.css'
import CharacterAutonomyView from '../src/components/chat/CharacterAutonomyView.vue'

const now = Date.now()
const chat = reactive({
  id: 'render_character',
  name: '林知遥',
  realName: '林知遥',
  avatarUrl: '',
  avatarText: '林',
  persona: '温柔、敏感、会认真表达自己的感受。',
  messages: [{ id: now - 3600000, type: 'left', content: '晚一点也要记得回来。' }],
  unread: 0,
  autonomyEnabled: true,
  autonomyAllowMessages: true,
  autonomyAllowMoments: true,
  autonomyAllowStatus: false,
  autonomyStatusPermissionExplicit: true,
  autonomyCatchup: true,
  autonomyActiveStart: 8,
  autonomyActiveEnd: 24,
  autonomyMinIntervalMinutes: 15,
  autonomyGuaranteeContact: true,
  autonomyMaxSilenceMinutes: 360,
  autonomyEmotionMustDeliver: true,
  autonomyHistory: [],
  autonomyState: { nextCheckAt: now + 3600000, lastCheckedAt: now },
  enableImmersiveStatus: false
})

const RenderRoot = defineComponent({
  setup() {
    return () => h(CharacterAutonomyView, { chat, onBack: () => undefined, onSave: () => undefined })
  }
})

createApp(RenderRoot).mount('#app')
nextTick(() => {
  const scroll = Number(new URLSearchParams(location.search).get('scroll') || 0)
  const container = document.querySelector<HTMLElement>('.autonomy-scroll')
  if (container) container.scrollTop = scroll
  document.documentElement.dataset.renderReady = 'true'
})
