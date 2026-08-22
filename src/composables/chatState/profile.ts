/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { useChatAuth } from '../useChatAuth'
import { syncBoundPersonaToCurrentAccount } from '../useChatUserProfiles'
import { myProfile } from './state'

export const loadMyProfile = async () => {
  await syncBoundPersonaToCurrentAccount()
  const { currentAccount } = useChatAuth()
  if (currentAccount.value) {
    // Account name is the network name. Do not use it as a fallback here: a
    // newly registered user has not provided a real name yet.
    myProfile.value.name = currentAccount.value.realName || ''
    myProfile.value.avatarUrl = currentAccount.value.avatarUrl
    myProfile.value.persona = currentAccount.value.persona
    const extraKey = `clingy_user_extra_${currentAccount.value.id}`
    const extraStr = localStorage.getItem(extraKey)
    if (extraStr) {
      try {
        const extra = JSON.parse(extraStr)
        myProfile.value.remark = extra.remark || ''
        myProfile.value.timezone = extra.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        myProfile.value.clockMode = extra.clockMode === 'custom' || extra.clockMode === 'timezone' || extra.clockMode === 'system' ? extra.clockMode : (extra.timezone ? 'timezone' : 'system')
        myProfile.value.clockAnchorRealAt = Number(extra.clockAnchorRealAt || Date.now())
        myProfile.value.clockAnchorTimeAt = Number(extra.clockAnchorTimeAt || Date.now())
      } catch(e) {}
    } else {
      myProfile.value.remark = ''
      myProfile.value.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      myProfile.value.clockMode = 'system'
      myProfile.value.clockAnchorRealAt = Date.now()
      myProfile.value.clockAnchorTimeAt = Date.now()
    }
  }
}

export const saveMyProfile = () => {
  const { currentChatUserId, updateAccount } = useChatAuth()
  if (currentChatUserId.value) {
    updateAccount(currentChatUserId.value, {
      realName: myProfile.value.name,
      avatarUrl: myProfile.value.avatarUrl,
      persona: myProfile.value.persona
    })
    const extraKey = `clingy_user_extra_${currentChatUserId.value}`
    localStorage.setItem(extraKey, JSON.stringify({
      remark: myProfile.value.remark,
      timezone: myProfile.value.timezone,
      clockMode: myProfile.value.clockMode,
      clockAnchorRealAt: myProfile.value.clockAnchorRealAt,
      clockAnchorTimeAt: myProfile.value.clockAnchorTimeAt
    }))
  }
}
