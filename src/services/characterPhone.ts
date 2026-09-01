/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { sendCapabilityMessage } from './api'
import { estimateTextTokens } from '../utils/tokenEstimate'
import { addCharacterPhoneEvent, createEmptyCharacterPhone, loadCharacterPhone, saveCharacterPhone } from './characterPhoneRepository'
import type { CharacterPhoneApp, CharacterPhoneAppEntry, CharacterPhoneConversation, CharacterPhoneDevice, CharacterPhoneRecord, CharacterPhoneReadRequest } from '../types/characterPhone'

const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const now = () => Date.now()
const safeText = (value: unknown, length = 1000) => String(value || '').trim().slice(0, length)
const color = (value: unknown, fallback: string) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback

const appDefinitions: Array<Pick<CharacterPhoneApp, 'id' | 'name' | 'kind' | 'icon' | 'color'>> = [
  { id: 'chat', name: '聊天', kind: 'chat', icon: '聊', color: '#35c759' },
  { id: 'contacts', name: '联系人', kind: 'contacts', icon: '联', color: '#8e8e93' },
  { id: 'moments', name: '朋友圈', kind: 'moments', icon: '圈', color: '#4f7cff' },
  { id: 'calls', name: '电话', kind: 'calls', icon: '话', color: '#34c759' },
  { id: 'sms', name: '短信', kind: 'sms', icon: '信', color: '#57c95b' },
  { id: 'photos', name: '相册', kind: 'photos', icon: '相', color: '#ff9f0a' },
  { id: 'files', name: '文件', kind: 'files', icon: '文', color: '#4b8dff' },
  { id: 'notes', name: '备忘录', kind: 'notes', icon: '记', color: '#ffd60a' },
  { id: 'calendar', name: '日历', kind: 'calendar', icon: '历', color: '#ff453a' },
  { id: 'browser', name: '浏览器', kind: 'browser', icon: '览', color: '#5ac8fa' },
  { id: 'maps', name: '地图', kind: 'maps', icon: '图', color: '#30d158' },
  { id: 'clock', name: '时钟', kind: 'clock', icon: '钟', color: '#1c1c1e' },
  { id: 'settings', name: '设置', kind: 'settings', icon: '设', color: '#8e8e93' }
]

export const makeBuiltInApp = (id: string): CharacterPhoneApp => {
  const definition = appDefinitions.find(item => item.id === id) || appDefinitions[0]
  return {
    ...definition,
    builtIn: true,
    hidden: false,
    badge: 0,
    allowCharacterUse: true,
    allowBackgroundUse: true,
    managementMode: 'autonomous',
    refreshMode: 'manual',
    refreshIntervalMinutes: 180,
    lastRefreshedAt: 0,
    entries: []
  }
}

export const createManualPhoneDevice = (name = '日常手机'): CharacterPhoneDevice => ({
  id: uid('device'), name, type: 'phone', purpose: '日常使用', active: true,
  wallpaper: '', battery: 78, storageUsedPercent: 36, silent: false, doNotDisturb: false,
  lockType: 'none', lockCredential: '', lockReason: '', failedAttempts: 0, lockedUntil: 0,
  foregroundAppId: '', lastUsedAt: now(), apps: appDefinitions.map(item => makeBuiltInApp(item.id))
})

const parseJson = (raw: string) => {
  const cleaned = String(raw || '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim()
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const source = fenced || cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1)
  return JSON.parse(source)
}

const normalizeEntry = (raw: any): CharacterPhoneAppEntry => ({
  id: String(raw?.id || uid('entry')), title: safeText(raw?.title || '未命名记录', 120),
  subtitle: safeText(raw?.subtitle, 300), content: safeText(raw?.content, 3000),
  createdAt: Number(raw?.createdAt || now()), updatedAt: Number(raw?.updatedAt || raw?.createdAt || now()),
  read: raw?.read === true, contactId: safeText(raw?.contactId, 80), meta: raw?.meta && typeof raw.meta === 'object' ? raw.meta : {}
})

const normalizeGeneratedApp = (raw: any, index: number): CharacterPhoneApp => {
  const builtIn = appDefinitions.find(item => item.id === raw?.id)
  if (builtIn) return { ...makeBuiltInApp(builtIn.id), hidden: raw?.hidden === true, badge: Math.max(0, Number(raw?.badge || 0)), entries: Array.isArray(raw?.entries) ? raw.entries.map(normalizeEntry) : [] }
  const allowedKinds = new Set(['feed', 'records', 'gallery', 'dashboard', 'list', 'page'])
  return {
    id: safeText(raw?.id || `custom_${index}_${Math.random().toString(36).slice(2, 6)}`, 80).replace(/[^a-zA-Z0-9_-]/g, '_'),
    name: safeText(raw?.name || '生活 APP', 30), kind: allowedKinds.has(raw?.kind) ? raw.kind : 'feed',
    icon: safeText(raw?.icon || '用', 2), color: color(raw?.color, '#7c6cff'), builtIn: false,
    hidden: raw?.hidden === true, badge: Math.max(0, Number(raw?.badge || 0)), allowCharacterUse: raw?.allowCharacterUse !== false,
    allowBackgroundUse: raw?.allowBackgroundUse !== false, managementMode: 'autonomous', refreshMode: 'manual',
    refreshIntervalMinutes: Math.max(15, Number(raw?.refreshIntervalMinutes || 180)), lastRefreshedAt: 0,
    entries: Array.isArray(raw?.entries) ? raw.entries.map(normalizeEntry) : []
  }
}

const normalizeGeneratedDevice = (raw: any, index: number): CharacterPhoneDevice => {
  const requestedApps: CharacterPhoneApp[] = Array.isArray(raw?.apps) ? raw.apps.map((item: any, appIndex: number) => normalizeGeneratedApp(item, appIndex)) : []
  const byId = new Map(requestedApps.map((app: CharacterPhoneApp) => [app.id, app]))
  for (const requiredId of ['chat', 'contacts', 'calls', 'photos', 'notes', 'calendar', 'browser', 'clock', 'settings']) if (!byId.has(requiredId)) byId.set(requiredId, makeBuiltInApp(requiredId))
  const lockType = ['none', 'pin', 'password', 'pattern', 'biometric'].includes(raw?.lockType) ? raw.lockType : 'none'
  return {
    id: safeText(raw?.id || `device_${index}_${Math.random().toString(36).slice(2, 7)}`, 80), name: safeText(raw?.name || '日常手机', 40),
    type: ['phone', 'tablet', 'other'].includes(raw?.type) ? raw.type : 'phone', purpose: safeText(raw?.purpose || '日常使用', 120), active: raw?.active !== false,
    wallpaper: safeText(raw?.wallpaper, 500), battery: Math.min(100, Math.max(1, Number(raw?.battery || 76))), storageUsedPercent: Math.min(99, Math.max(0, Number(raw?.storageUsedPercent || 38))),
    silent: raw?.silent === true, doNotDisturb: raw?.doNotDisturb === true, lockType,
    lockCredential: lockType === 'none' ? '' : safeText(raw?.lockCredential, 80), lockReason: lockType === 'none' ? '' : safeText(raw?.lockReason, 500),
    failedAttempts: 0, lockedUntil: 0, foregroundAppId: '', lastUsedAt: now(), apps: [...byId.values()]
  }
}

export const generateCharacterPhone = async (chat: any, accountId: string, options: { includeRecentChat?: boolean } = {}) => {
  const characterId = String(chat.characterEntityId || chat.id)
  const timelineId = String(chat.timelineState?.activeTimelineId || chat.activeTimelineId || 'main')
  const existing = await loadCharacterPhone(accountId, characterId, chat.id, timelineId)
  const people = (chat.socialCircle || []).slice(0, 12).map((item: any) => ({ id: item.entityId || item.id, name: item.name, relation: item.relation, persona: safeText(item.persona, 500) }))
  const recent = options.includeRecentChat ? (chat.messages || []).filter((item: any) => ['left', 'right'].includes(item.type)).slice(-12).map((item: any) => `${item.type === 'left' ? chat.name : '用户'}：${safeText(item.content, 500)}`).join('\n') : ''
  const prompt = `你负责为一个虚构角色建立真实、克制、长期可持续的个人设备档案。只返回合法 JSON，不要 Markdown、解释或思维过程。\n角色：${chat.realName || chat.name}\n角色人设：${safeText(chat.persona, 9000)}\n社交资料：${JSON.stringify(chat.socialProfile || {})}\n生活人脉：${JSON.stringify(people)}\n${recent ? `近期聊天原文（只用于合理贴合当前生活，不得照搬隐私）：\n${recent}` : '不要读取近期单聊。'}\n设备数量必须符合人设，可以为 0、1 或多台；不要默认两台。每台设备可以无锁，也可以使用 pin、password、pattern、biometric。密码可以是数字、英文或混合，必须给出符合人物经历的 lockReason；无锁时凭据和原因留空。APP 除系统能力外应根据职业、兴趣和生活生成，保留普通、闲置和意外但合理的应用，不要让每个 APP 都藏秘密。每个 APP 最多给 3 条简短初始记录。\nJSON：{"devices":[{"id":"","name":"","type":"phone|tablet|other","purpose":"","active":true,"wallpaper":"","battery":76,"storageUsedPercent":38,"silent":false,"doNotDisturb":false,"lockType":"none|pin|password|pattern|biometric","lockCredential":"","lockReason":"","apps":[{"id":"内置可用 chat|contacts|moments|calls|sms|photos|files|notes|calendar|browser|maps|clock|settings；动态APP自定ID","name":"","kind":"feed|records|gallery|dashboard|list|page","icon":"一个汉字","color":"#RRGGBB","hidden":false,"badge":0,"entries":[{"title":"","subtitle":"","content":""}]}]}]}`
  const response: any = await sendCapabilityMessage('character-phone', [{ role: 'system', content: prompt }, { role: 'user', content: `生成${chat.realName || chat.name}当前真实使用的设备。` }])
  const parsed = parseJson(typeof response === 'string' ? response : response.content)
  existing.devices = Array.isArray(parsed?.devices) ? parsed.devices.slice(0, 5).map(normalizeGeneratedDevice) : []
  existing.generated = true
  existing.generationSource = 'ai'
  addCharacterPhoneEvent(existing, { type: 'phone_created', title: '设备档案已建立', detail: existing.devices.length ? `建立了 ${existing.devices.length} 台设备` : '角色当前没有设备', deviceId: existing.devices[0]?.id || '', actualActor: 'system', characterKnowledge: 'character_known', importance: 2, unresolved: false, bridgeEligible: false })
  await saveCharacterPhone(existing)
  return existing
}

export const refreshCharacterPhoneApp = async (record: CharacterPhoneRecord, device: CharacterPhoneDevice, app: CharacterPhoneApp, chat: any, mode: 'incremental' | 'replace-generated' = 'incremental') => {
  const oldEntries = app.entries.slice(-12)
  const prompt = `你负责刷新虚构角色手机中的一个 APP。只返回合法 JSON，不要 Markdown。不得改变角色核心人设，不得重写项目现有单聊、群聊、朋友圈或论坛。角色：${chat.realName || chat.name}\n人设：${safeText(chat.persona, 7000)}\n设备：${device.name}（${device.purpose}）\nAPP：${app.name}，类型：${app.kind}\n已有记录：${JSON.stringify(oldEntries)}\n请生成 1～5 条自然、不过度戏剧化的新记录，避免重复。JSON：{"entries":[{"title":"","subtitle":"","content":"","contactId":"","read":false,"meta":{}}]}`
  const response: any = await sendCapabilityMessage('character-phone', [{ role: 'system', content: prompt }, { role: 'user', content: mode === 'incremental' ? '增量刷新。' : '替换该 APP 中由 AI 生成的背景记录。' }])
  const parsed = parseJson(typeof response === 'string' ? response : response.content)
  const entries: CharacterPhoneAppEntry[] = Array.isArray(parsed?.entries) ? parsed.entries.slice(0, 8).map(normalizeEntry).map((entry: CharacterPhoneAppEntry) => ({ ...entry, meta: { ...(entry.meta || {}), generated: true } })) : []
  app.entries = mode === 'replace-generated' ? [...app.entries.filter(item => item.meta?.generated !== true), ...entries] : [...app.entries, ...entries]
  app.lastRefreshedAt = now()
  app.badge += entries.filter(item => !item.read).length
  addCharacterPhoneEvent(record, { type: 'app_refreshed', title: `${app.name}已刷新`, detail: `新增 ${entries.length} 条内容`, deviceId: device.id, appId: app.id, actualActor: 'system', characterKnowledge: 'character_unknown', importance: 1, unresolved: false, bridgeEligible: false })
  await saveCharacterPhone(record)
  return entries
}

export const ensurePhoneConversation = (record: CharacterPhoneRecord, input: Pick<CharacterPhoneConversation, 'id' | 'title' | 'kind' | 'participantIds'> & Partial<CharacterPhoneConversation>) => {
  let conversation = record.conversations.find(item => item.id === input.id)
  if (!conversation) {
    conversation = { id: input.id, title: input.title, kind: input.kind, participantIds: input.participantIds, linkedChatId: input.linkedChatId, linkedGroupId: input.linkedGroupId, unread: 0, updatedAt: now(), messages: [] }
    record.conversations.push(conversation)
  }
  return conversation
}

export const appendPhoneConversationMessage = (record: CharacterPhoneRecord, conversation: CharacterPhoneConversation, input: Partial<CharacterPhoneConversation['messages'][number]> & { content: string; senderId: string; senderName: string }) => {
  const message = {
    id: input.id || uid('phone_msg'), conversationId: conversation.id, senderId: input.senderId,
    senderName: input.senderName, displaySenderId: input.displaySenderId || input.senderId,
    content: safeText(input.content, 5000), createdAt: Number(input.createdAt || now()), read: input.read === true,
    actualActor: input.actualActor || 'character', authorizedByCharacter: input.authorizedByCharacter === true,
    characterKnowledge: input.characterKnowledge || 'character_known', source: input.source || 'phone'
  } as CharacterPhoneConversation['messages'][number]
  conversation.messages.push(message)
  conversation.updatedAt = message.createdAt
  return message
}

export const generateContactPhoneReply = async (record: CharacterPhoneRecord, conversation: CharacterPhoneConversation, contact: any, ownerChat: any) => {
  const recent = conversation.messages.slice(-20).map(item => `${item.senderName}：${item.content}`).join('\n')
  const prompt = `你扮演${contact.name}，只回复${ownerChat.realName || ownerChat.name}。人物资料：${safeText(contact.persona, 5000)}\n双方关系：${safeText(contact.relation, 300)}\n近期手机聊天：\n${recent}\n只返回 JSON：{"messages":["一到三条自然消息"]}。不得替主角色或用户发言，不要解释规则。`
  const response: any = await sendCapabilityMessage('character-phone', [{ role: 'system', content: prompt }, { role: 'user', content: '根据对话自然回应；不想回复时 messages 返回空数组。' }])
  const parsed = parseJson(typeof response === 'string' ? response : response.content)
  const created = (Array.isArray(parsed?.messages) ? parsed.messages : []).slice(0, 3).map((content: unknown) => appendPhoneConversationMessage(record, conversation, { content: safeText(content, 2000), senderId: String(contact.entityId || contact.id), senderName: contact.name, actualActor: 'contact', authorizedByCharacter: false, characterKnowledge: 'character_unknown', read: false, source: 'generated' }))
  conversation.unread += created.length
  await saveCharacterPhone(record)
  return created
}

const eventLine = (event: any) => `- ${event.title}：${event.detail}`
const trimToBudget = (lines: string[], budget: number) => {
  const selected: string[] = []
  for (const line of lines) {
    if (estimateTextTokens(selected.concat(line).join('\n')) > budget) break
    selected.push(line)
  }
  return selected
}

export const buildCharacterPhoneContext = async (chat: any, accountId: string, options: { includeDashboard?: boolean; mode?: 'chat' | 'background' } = {}) => {
  const characterId = String(chat.characterEntityId || chat.id || '')
  if (!characterId) return { text: '', eventIds: [] as string[] }
  const timelineId = String(chat.timelineState?.activeTimelineId || chat.activeTimelineId || 'main')
  const record = await loadCharacterPhone(accountId, characterId, chat.id, timelineId)
  if (!record.generated || !record.settings.enabled) return { text: '', eventIds: [] as string[] }
  if (record.settings.chatToPhone) {
    const conversationId = `user:${chat.id}`
    const conversation = ensurePhoneConversation(record, { id: conversationId, title: '用户', kind: 'user', participantIds: [characterId, accountId], linkedChatId: chat.id })
    const existingIds = new Set(conversation.messages.map(item => item.id))
    let changed = false
    for (const message of (chat.messages || []).filter((item: any) => ['left', 'right'].includes(item.type) && !item.phoneAuthorship).slice(-100)) {
      const id = `single_${message.id}`
      if (existingIds.has(id)) continue
      appendPhoneConversationMessage(record, conversation, {
        id, content: safeText(message.content, 5000), senderId: message.type === 'left' ? characterId : accountId,
        senderName: message.type === 'left' ? (chat.realName || chat.name) : '用户', actualActor: message.type === 'left' ? 'character' : 'user',
        authorizedByCharacter: message.type === 'left', characterKnowledge: 'character_known', read: true, source: 'single_chat', createdAt: Number(message.timestamp || message.id || now())
      })
      changed = true
    }
    if (changed) await saveCharacterPhone(record)
  }
  const sections: string[] = []
  const activeDevices = record.devices.filter(item => item.active)
  const useAllowed = options.mode === 'background' ? record.settings.allowBackgroundUse : record.settings.allowUseDuringChat
  const deviceInfoAllowed = options.mode === 'background' ? useAllowed : (useAllowed || record.settings.bridgeToChat)
  if (deviceInfoAllowed && activeDevices.length) {
    sections.push(`设备：${activeDevices.map(device => `${device.name}（${device.purpose}；${device.lockType === 'none' ? '无锁屏' : `锁屏${device.lockType}，凭据 ${device.lockCredential}，原因：${device.lockReason || '未记录'}`}）`).join('；')}`)
  }
  if (options.includeDashboard && useAllowed) {
    const dashboard = activeDevices.slice(0, 2).flatMap(device => {
      const foreground = device.apps.find(app => app.id === device.foregroundAppId)?.name || '桌面'
      const unread = record.conversations.filter(item => item.unread > 0).slice(0, 4).map(item => `${item.title} ${item.unread}条未读`)
      const badges = device.apps.filter(app => app.badge > 0).slice(0, 4).map(app => `${app.name}${app.badge}`)
      return [`${device.name}：电量${device.battery}%，${device.silent ? '静音' : '响铃'}，前台${foreground}${unread.length ? `；${unread.join('、')}` : ''}${badges.length ? `；角标${badges.join('、')}` : ''}`]
    })
    if (dashboard.length) sections.push(`当前可见状态：\n${dashboard.join('\n')}`)
  }
  const eventBridgeAllowed = options.mode === 'background' ? record.settings.allowBackgroundUse : record.settings.bridgeToChat
  const eligible = eventBridgeAllowed ? record.events.filter(event => event.bridgeEligible && event.characterKnowledge !== 'character_unknown' && (options.mode === 'background' ? event.deliveredToBackgroundAt === 0 : event.deliveredToChatAt === 0) && (event.unresolved || event.importance >= 4)).sort((a, b) => b.importance - a.importance || a.createdAt - b.createdAt) : []
  const lines = trimToBudget(eligible.map(eventLine), Math.max(100, record.settings.contextTokenBudget - estimateTextTokens(sections.join('\n'))))
  if (lines.length) sections.push(`角色已经知道的手机事件：\n${lines.join('\n')}`)
  if (!sections.length) return { text: '', eventIds: [] }
  const actionRules = useAllowed ? `\n角色可以但不必在符合情境时使用手机。需要读取具体内容时输出 <read_phone app_id="chat" target="unread"/>；系统至多追加一次读取结果。需要写入手机时输出 <phone_action type="send_message|reply_contact|add_note|add_calendar_event|activity" app_id="APP_ID" target_id="联系人ID">内容</phone_action>。手机动作标签不展示给用户，每轮不超过 ${record.settings.maxActionsPerRun} 个。` : ''
  return { text: `\n\n【角色自己的手机】\n${sections.join('\n')}\n这些是角色自己的设备与已知状态。角色没有义务展示功能，只在符合人设和当前情境时使用手机；不得知道标记为未知的用户操作。${actionRules}`, eventIds: eligible.slice(0, lines.length).map(event => event.id) }
}

export const markPhoneContextDelivered = async (chat: any, accountId: string, eventIds: string[], target: 'chat' | 'background' = 'chat') => {
  if (!eventIds.length) return
  const characterId = String(chat.characterEntityId || chat.id)
  const timelineId = String(chat.timelineState?.activeTimelineId || chat.activeTimelineId || 'main')
  const record = await loadCharacterPhone(accountId, characterId, chat.id, timelineId)
  const stamp = now()
  for (const event of record.events) if (eventIds.includes(event.id)) {
    if (target === 'background' && event.deliveredToBackgroundAt === 0) event.deliveredToBackgroundAt = stamp
    if (target === 'chat' && event.deliveredToChatAt === 0) event.deliveredToChatAt = stamp
  }
  await saveCharacterPhone(record)
}

export const buildPhoneReadObservation = async (chat: any, accountId: string, requests: CharacterPhoneReadRequest[], origin: 'chat' | 'background' = 'chat') => {
  const characterId = String(chat.characterEntityId || chat.id)
  const timelineId = String(chat.timelineState?.activeTimelineId || chat.activeTimelineId || 'main')
  const record = await loadCharacterPhone(accountId, characterId, chat.id, timelineId)
  const allowed = origin === 'background' ? record.settings.allowBackgroundUse : (record.settings.allowDeepReadFollowup && record.settings.allowUseDuringChat)
  if (!allowed) return { text: '', record, requests: [] as CharacterPhoneReadRequest[], confirmedEventIds: [] as string[] }
  const device = record.devices.find(item => item.active) || record.devices[0]
  if (!device) return { text: '【角色尝试查看手机，但当前没有可使用的设备。】', record, requests: [], confirmedEventIds: [] as string[] }
  const unique = [...new Map(requests.map(item => [`${item.appId}:${item.target}`, item])).values()].slice(0, 6)
  const observations: string[] = []
  const confirmedEventIds: string[] = []
  for (const request of unique) {
    const app = device.apps.find(item => item.id === request.appId)
    if (!app) { observations.push(`${request.appId}：设备中没有这个 APP。`); continue }
    device.foregroundAppId = app.id
    device.lastUsedAt = now()
    if (app.kind === 'chat') {
      const conversations = record.conversations.filter(item => request.target !== 'unread' || item.unread > 0).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)
      observations.push(`${app.name}：${conversations.length ? conversations.map(item => `${item.title}${item.unread ? `（${item.unread}条未读）` : ''}：${item.messages.at(-1)?.content || '暂无消息'}`).join('；') : '没有符合条件的会话'}`)
      conversations.forEach(item => { item.unread = 0; item.messages.forEach(message => { if (message.actualActor === 'contact') message.read = true }) })
    } else {
      const entries = app.entries.slice(-8)
      observations.push(`${app.name}：${entries.length ? entries.map(item => `${item.title}${item.content ? `—${item.content}` : ''}`).join('；') : '当前没有内容'}`)
      entries.forEach(entry => { entry.read = true })
      app.badge = 0
    }
    if (record.settings.userOperationsDiscoverable) {
      const relatedEvents = record.events.filter(event => event.appId === app.id && event.unresolved && event.actualActor === 'user')
      for (const event of relatedEvents) {
        const targetMatches = !request.target || request.target === 'latest' || request.target === 'unread' || String(event.meta?.conversationId || '') === request.target
        if (!targetMatches) continue
        event.characterKnowledge = 'character_confirmed'
        event.bridgeEligible = true
        confirmedEventIds.push(event.id)
        observations.push(`发现异常：${event.detail}`)
      }
    }
  }
  if (origin === 'background') {
    const day = new Date().toLocaleDateString('en-CA')
    if (record.settings.backgroundActionDate !== day) { record.settings.backgroundActionDate = day; record.settings.backgroundActionsToday = 0 }
    record.settings.backgroundActionsToday++
  }
  await saveCharacterPhone(record)
  return { text: `【角色刚刚查看了自己的手机】\n${observations.join('\n')}\n请基于这些真实内容自然继续本轮交流或执行手机写入动作。不得再次请求读取手机或朋友圈。`, record, requests: unique, confirmedEventIds }
}

export const parsePhoneReadRequests = (raw: string) => {
  const requests: CharacterPhoneReadRequest[] = []
  const cleaned = String(raw || '').replace(/<read_phone\b([^>]*)\/>/gi, (_full, attrs: string) => {
    const appId = attrs.match(/\bapp_id\s*=\s*["']([^"']+)["']/i)?.[1] || 'chat'
    const target = attrs.match(/\btarget\s*=\s*["']([^"']+)["']/i)?.[1] || 'latest'
    requests.push({ appId, target })
    return ''
  })
  return { cleaned, requests }
}

export const executePhoneActionTags = async (raw: string, chat: any, accountId: string, origin: 'chat' | 'background' = 'chat') => {
  const allMatches = [...String(raw || '').matchAll(/<phone_action\b([^>]*)>([\s\S]*?)<\/phone_action>/gi)]
  const characterId = String(chat.characterEntityId || chat.id)
  const timelineId = String(chat.timelineState?.activeTimelineId || chat.activeTimelineId || 'main')
  const record = await loadCharacterPhone(accountId, characterId, chat.id, timelineId)
  if (!record.generated || !record.settings.enabled || (origin === 'chat' ? !record.settings.allowUseDuringChat : !record.settings.allowBackgroundUse)) return { cleaned: allMatches.reduce((text, match) => text.replace(match[0], ''), String(raw || '')), handled: 0, matched: allMatches.length }
  let handled = 0
  const day = new Date().toLocaleDateString('en-CA')
  if (record.settings.backgroundActionDate !== day) { record.settings.backgroundActionDate = day; record.settings.backgroundActionsToday = 0 }
  const limit = origin === 'background' ? Math.min(record.settings.maxActionsPerRun, Math.max(0, record.settings.dailyBackgroundLimit - record.settings.backgroundActionsToday)) : record.settings.maxActionsPerRun
  const matches = allMatches
  let cleaned = String(raw || '')
  const device = record.devices.find(item => item.active) || record.devices[0]
  for (const match of matches.slice(0, limit)) {
    cleaned = cleaned.replace(match[0], '')
    if (!device) continue
    const attrs = match[1] || ''
    const content = safeText(match[2], 5000)
    const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1] || 'activity'
    const appId = attrs.match(/\bapp_id\s*=\s*["']([^"']+)["']/i)?.[1] || (type.includes('note') ? 'notes' : type.includes('calendar') ? 'calendar' : 'chat')
    const targetId = attrs.match(/\b(?:conversation_id|target_id)\s*=\s*["']([^"']+)["']/i)?.[1] || ''
    const app = device.apps.find(item => item.id === appId)
    if (!app || !app.allowCharacterUse || (origin === 'background' && !app.allowBackgroundUse) || app.managementMode === 'readonly') continue
    const highImpact = ['change_lock', 'delete', 'block_user', 'unblock_user', 'purchase', 'transfer'].includes(type)
    if (highImpact && !record.settings.allowHighImpactActions) continue
    device.foregroundAppId = app.id
    device.lastUsedAt = now()
    if (type === 'reply_contact' || type === 'send_message') {
      const contact = (chat.socialCircle || []).find((item: any) => String(item.entityId || item.id) === String(targetId))
      const conversation = ensurePhoneConversation(record, { id: targetId || uid('conversation'), title: contact?.name || targetId || '联系人', kind: 'contact', participantIds: [characterId, targetId] })
      appendPhoneConversationMessage(record, conversation, { content, senderId: characterId, senderName: chat.realName || chat.name, actualActor: 'character', authorizedByCharacter: true, characterKnowledge: 'character_known' })
    } else {
      app.entries.push(normalizeEntry({ title: type === 'add_note' ? '新备忘录' : type === 'add_calendar_event' ? '新日程' : `${chat.realName || chat.name}使用了${app.name}`, content, read: true, meta: { generated: false, actor: 'character', actionType: type } }))
    }
    addCharacterPhoneEvent(record, { type, title: `${chat.realName || chat.name}使用了${app.name}`, detail: content || type, deviceId: device.id, appId: app.id, actualActor: 'character', characterKnowledge: 'character_known', importance: highImpact ? 5 : content ? 3 : 1, unresolved: type === 'reply_contact' || type === 'add_calendar_event', bridgeEligible: content.length > 0 })
    handled++
  }
  if (origin === 'background') record.settings.backgroundActionsToday += handled
  if (handled) await saveCharacterPhone(record)
  return { cleaned, handled, matched: matches.length }
}

export const runDueCharacterPhoneRefreshes = async (chats: any[], accountId: string) => {
  const stamp = now()
  for (const chat of chats.filter(item => item?.id !== 1 && item?.chatType !== 'group')) {
    const characterId = String(chat.characterEntityId || chat.id || '')
    if (!characterId) continue
    const timelineId = String(chat.timelineState?.activeTimelineId || chat.activeTimelineId || 'main')
    const record = await loadCharacterPhone(accountId || 'guest', characterId, chat.id, timelineId)
    if (!record.generated || !record.settings.enabled || !record.settings.allowBackgroundUse) continue
    const day = new Date().toLocaleDateString('en-CA')
    if (record.settings.backgroundActionDate !== day) { record.settings.backgroundActionDate = day; record.settings.backgroundActionsToday = 0; await saveCharacterPhone(record) }
    if (record.settings.backgroundActionsToday >= record.settings.dailyBackgroundLimit) continue
    const device = record.devices.find(item => item.active)
    const dueApp = device?.apps.find(item => item.refreshMode === 'auto' && item.allowBackgroundUse && item.refreshIntervalMinutes >= 15 && stamp - item.lastRefreshedAt >= item.refreshIntervalMinutes * 60000)
    if (!device || !dueApp) continue
    try { await refreshCharacterPhoneApp(record, device, dueApp, chat, 'incremental'); record.settings.backgroundActionsToday++; await saveCharacterPhone(record) }
    catch (error) { console.warn(`[角色手机] ${chat.name || characterId} 的 ${dueApp.name} 自动刷新失败`, error) }
  }
}

