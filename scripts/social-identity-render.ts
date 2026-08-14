/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { createApp, nextTick } from 'vue'
import '../src/style.css'

const view = new URLSearchParams(location.search).get('view') || 'contacts'
const accounts = [
  { id: 'render_user_a', name: '栀子', avatarUrl: '', accountId: 'garden_main', persona: '安静但坦率。', purpose: 'primary', linkedAccountIds: ['render_user_b'] },
  { id: 'render_user_b', name: '小栀', avatarUrl: '', accountId: 'garden_side', persona: '喜欢摄影，慢热。', purpose: 'alternate', linkedAccountIds: ['render_user_a'] }
]
const profile = {
  nickname: '一一', socialId: 'nrt_60767447', signature: '这个人还没有写个性签名', coverStyle: 'dots', awarenessEnabled: true,
  managementMode: 'readonly', permissions: { nickname: true, socialId: false, signature: true, cover: true, publishMoments: true, editMoments: true, deleteMoments: false, manageUserMoments: false, generateImages: false },
  generation: { includeRecentChat: false, allowChatDetails: false, momentCount: 3 }, changes: [], updatedAt: Date.now()
}
const directoryEntry = { entityId: 'render_character', ownerAccountId: 'render_user_a', name: '一一', persona: '有自己的边界，不会因为申请就立刻同意。', avatarKey: 'avatar_contact_render_character', socialProfile: profile, idAliases: [], createdAt: Date.now(), updatedAt: Date.now() }
const candidate = {
  id: 'render_character', characterEntityId: 'render_character', contactState: 'candidate', name: '一一', realName: '一一', remark: '', persona: directoryEntry.persona,
  avatarText: '一', avatarUrl: '', avatarKey: directoryEntry.avatarKey, socialProfile: profile, groups: [], messages: [],
  relationship: { friendship: 'strangers', blockedBy: 'none', changedAt: Date.now(), stateChangedAt: Date.now(), blockedMessages: [], undeliveredUserMessages: [], requests: [], events: [], disclosedLinkedAccountIds: [], plan: { action: 'none', summary: '目前没有新的打算', visibility: 'exact', status: 'completed' } }
}

localStorage.setItem('clingy_chat_accounts', JSON.stringify(accounts))
localStorage.setItem('clingy_chat_auth_state', 'render_user_b')
localStorage.setItem('clingy_character_directory_v1', JSON.stringify([directoryEntry]))
localStorage.setItem('clingy_custom_contacts_render_user_b', JSON.stringify(view === 'profile' || view === 'flow' ? [candidate] : []))

const appRoot = document.querySelector('#app')!

if (view === 'auth') {
  localStorage.removeItem('clingy_chat_auth_state')
  const { default: ChatAuthView } = await import('../src/components/chat/ChatAuthView.vue')
  createApp(ChatAuthView, { onClose: () => {} }).mount(appRoot)
  window.setTimeout(() => (document.querySelector('.register-entry') as HTMLElement)?.click(), 120)
} else if (view === 'profile' || view === 'flow') {
  const { default: CharacterProfileView } = await import('../src/components/chat/profile/CharacterProfileView.vue')
  createApp(CharacterProfileView, { chat: candidate, onBack: () => {}, onOpenChat: () => {}, onSave: () => {} }).mount(appRoot)
  if (view === 'profile') window.setTimeout(() => (document.querySelector('.character-primary-action') as HTMLElement)?.click(), 280)
  if (view === 'flow') {
    window.setTimeout(async () => {
      try {
        const { acceptFriendRequest, createFriendRequest } = await import('../src/composables/useChatRelationship')
        const request = createFriendRequest(candidate, 'user_to_character', '想重新认识你。')
        if (request) acceptFriendRequest(candidate, request)
        const saved = JSON.parse(localStorage.getItem('clingy_custom_contacts_render_user_b') || '[]')[0]
        document.body.dataset.qaFlow = JSON.stringify({
          requestCount: saved?.relationship?.requests?.length || 0,
          requestStatus: saved?.relationship?.requests?.[0]?.status,
          friendship: saved?.relationship?.friendship,
          contactState: saved?.contactState
        })
      } catch (error: any) {
        document.body.dataset.qaFlow = JSON.stringify({ error: error?.message || String(error) })
      }
    }, 900)
  }
} else {
  const [{ default: AppChatContacts }, { loadCustomContacts }] = await Promise.all([
    import('../src/components/app_ChatContacts.vue'),
    import('../src/composables/chatState/contacts')
  ])
  await loadCustomContacts()
  createApp(AppChatContacts, { onClose: () => {}, onOpenFriendRequests: () => {}, onOpenDirectoryCharacter: () => {} }).mount(appRoot)
  await nextTick()
  const input = document.querySelector('.search-input') as HTMLInputElement
  input.value = 'nrt_60767447'
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

window.setTimeout(() => {
  const selectors = ['.directory-result', '.character-sheet-overlay', '.friend-request-editor', '.register-form', '.account-purpose-section']
  const metrics = selectors.map(selector => {
    const element = document.querySelector(selector)
    if (!element) return null
    const rect = element.getBoundingClientRect()
    return { selector, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }
  }).filter(Boolean)
  document.body.dataset.qaMetrics = JSON.stringify({ viewport: window.innerWidth, metrics })
}, 600)
