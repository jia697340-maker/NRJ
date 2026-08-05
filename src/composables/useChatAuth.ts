/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed } from 'vue'

const AUTH_STORAGE_KEY = 'clingy_chat_auth_state'
const ACCOUNTS_STORAGE_KEY = 'clingy_chat_accounts'

export interface ChatAccount {
  id: string
  name: string
  avatarUrl: string
  accountId: string // 聊天ID号
  persona: string // 用户人设
}

const currentChatUserId = ref<string | null>(localStorage.getItem(AUTH_STORAGE_KEY) || null)
const chatAccounts = ref<ChatAccount[]>(JSON.parse(localStorage.getItem(ACCOUNTS_STORAGE_KEY) || '[]'))

export function useChatAuth() {
  const currentAccount = computed(() => {
    return chatAccounts.value.find(acc => acc.id === currentChatUserId.value) || null
  })

  const login = (id: string) => {
    currentChatUserId.value = id
    localStorage.setItem(AUTH_STORAGE_KEY, id)
  }

  const logout = () => {
    currentChatUserId.value = null
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  const register = (account: ChatAccount) => {
    chatAccounts.value.push(account)
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(chatAccounts.value))
    login(account.id)
  }

  const updateAccount = (id: string, updates: Partial<ChatAccount>) => {
    const idx = chatAccounts.value.findIndex(a => a.id === id)
    if (idx !== -1) {
      chatAccounts.value[idx] = { ...chatAccounts.value[idx], ...updates }
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(chatAccounts.value))
    }
  }

  const deleteAccount = (id: string) => {
    chatAccounts.value = chatAccounts.value.filter(a => a.id !== id)
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(chatAccounts.value))
    if (currentChatUserId.value === id) {
      logout()
    }
  }

  return {
    currentChatUserId,
    chatAccounts,
    currentAccount,
    login,
    logout,
    register,
    updateAccount,
    deleteAccount
  }
}
