import assert from 'node:assert/strict'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() { return storage.size }
  },
  configurable: true
})

const { buildGroupChatMessages, createGroupChat, normalizeGroupChat, parseGroupResponse } = await import('../src/services/groupChat.ts')
const { applyMemoryExtraction, buildExtractionPrompt, formatMessagesForMemory, getUncoveredMessages, invalidateMemoriesForMessages } = await import('../src/services/memoryEngine.ts')
const { findRoleEmojiByResponse, normalizeEmojiScope, selectRoleAvailableEmojis, selectUserSendableEmojis } = await import('../src/services/chatEmojiScope.ts')
const { awardGroupActivity, ensureGroupManagementState, getGroupPermissions, getSpeakableCharacterIds, groupManagementService, isGroupMemberMuted } = await import('../src/services/groupManagementService.ts')

const scopedEmojis = [
  { id: 'user-1', name: '用户笑', category: 'user' as const },
  { id: 'global-1', name: '共同笑', category: 'global' as const },
  { id: 'role-a', name: '无语', category: 'role' as const, roleId: 'a' },
  { id: 'role-b', name: '无语', category: 'role' as const, targetId: 'b' },
  { id: 'group-1', name: '群里见', category: 'group' as const, groupId: 'g1' }
]
assert.equal(normalizeEmojiScope(scopedEmojis[3]).ownerCharacterId, 'b')
assert.deepEqual(selectUserSendableEmojis(scopedEmojis, 'g1').map(item => item.id), ['user-1', 'group-1'])
assert.deepEqual(selectRoleAvailableEmojis(scopedEmojis, 'a', { groupId: 'g1', includePrivateRoleLibrary: true }).map(item => item.id), ['global-1', 'role-a', 'group-1'])
assert.deepEqual(selectRoleAvailableEmojis(scopedEmojis, 'a', { groupId: 'g1', includePrivateRoleLibrary: false }).map(item => item.id), ['global-1', 'group-1'])
assert.equal(findRoleEmojiByResponse(scopedEmojis, 'b', { id: 'role-b', name: '无语' })?.id, 'role-b')

const contacts = [
  { id: 'a', name: '阿岚', persona: '直率，习惯先回应朋友的玩笑。', memoryBook: [] },
  { id: 'b', name: '白露', persona: '慢热，有自己的话题和作息。', memoryBook: [] }
]
const group = createGroupChat({ name: '周末碰头', groupContext: '', memberIds: ['a', 'b'] }, { name: '小满' })
let payload = await buildGroupChatMessages(group, contacts, { name: '小满' })
assert.equal(payload.length, 1)
assert.doesNotMatch(payload[0].content, /可选群背景/)
assert.match(payload[0].content, /用户只是群成员之一/)
assert.match(payload[0].content, /display_name="阿岚"/)
assert.doesNotMatch(payload[0].content, /单聊全局提示词|单聊设置|应用组合/)
assert.doesNotMatch(payload[0].content, /<\/?msg(?:\s|>)/)
assert.doesNotMatch(payload[0].content, /<\/?send_(?:image|voice|emoji|transfer|red_packet)/)

group.groupContext = '这是一起旅行前临时建的群。'
payload = await buildGroupChatMessages(group, contacts, { name: '小满' })
assert.match(payload[0].content, /可选群背景/)
assert.match(payload[0].content, /一起旅行前临时建的群/)

const parsed = parseGroupResponse('<group_msg sender="b">先等等，我还没收拾好。</group_msg><group_msg sender="a" reply_to="12" mentions="b">@白露 你每次都这么说。</group_msg>', ['a', 'b'])
assert.deepEqual(parsed.messages.map(item => item.senderId), ['b', 'a'])
assert.equal(parsed.messages[1].replyToMessageId, '12')
assert.deepEqual(parsed.messages[1].mentions, ['b'])
assert.equal(parseGroupResponse('<group_msg sender="a" kind="emoji" emoji_id="role-a">无语</group_msg>', ['a']).messages[0].emojiId, 'role-a')
assert.equal(parseGroupResponse('<group_msg sender="unknown">越权消息</group_msg><group_idle />', ['a', 'b']).messages.length, 0)
assert.equal(parseGroupResponse('<group_idle />', ['a', 'b']).idle, true)
assert.deepEqual(parseGroupResponse('<group_management sender="a" action="mute" target="b" duration="600">刷屏</group_management>', ['a', 'b']).managementActions[0], { senderId: 'a', targetId: 'b', action: 'mute', durationSeconds: 600, reason: '刷屏' })
assert.equal(parseGroupResponse('<group_management sender="unknown" action="mute" target="b" duration="600">越权</group_management>', ['a', 'b']).managementActions.length, 0)
assert.deepEqual(parseGroupResponse('<group_announcement_ack sender="b" announcement_id="notice-1" />', ['a', 'b']).announcementAcks, [{ senderId: 'b', announcementId: 'notice-1' }])

const configured = normalizeGroupChat({ ...group, autoSummaryEnabled: true, autoSummaryThreshold: 137, autoSummaryTokenThreshold: 4321, autoSummaryTrigger: 'token', memoryBatchSize: 87, memoryTokenBudget: 777, memorySummaryRetryCount: 3 })
assert.equal(configured.autoSummaryThreshold, 137)
assert.equal(configured.autoSummaryTokenThreshold, 4321)
assert.equal(configured.autoSummaryTrigger, 'token')
assert.equal(configured.memoryBatchSize, 87)
assert.equal(configured.memoryTokenBudget, 777)
assert.equal(configured.memorySummaryRetryCount, 3)
assert.equal(configured.referenceMemberEmojiLibraries, true)
assert.equal(configured.emojiVisionScope, 'enabled_members')
assert.equal(configured.imageRecognitionMode, 'visual')
assert.equal(configured.voiceCallMemoryValue, 24)
assert.equal(configured.autonomyEnabled, false)
assert.equal(configured.incomingCallEnabled, false)

const parityConfigured = normalizeGroupChat({
  ...group,
  bilingualEnabled: true,
  bilingualMode: 'forced',
  dialogueLanguage: 'ja',
  translationLanguage: 'zh-CN',
  translationDisplay: 'always',
  timePerception: true,
  sendCharacterTime: false,
  memberTimezones: { a: 'Asia/Tokyo', b: 'Europe/London' }
})
assert.equal(parityConfigured.bilingualMode, 'forced')
assert.equal(parityConfigured.dialogueLanguage, 'ja')
assert.equal(parityConfigured.translationLanguage, 'zh-CN')
assert.equal(parityConfigured.translationDisplay, 'always')
assert.equal(parityConfigured.sendCharacterTime, false)
assert.equal(parityConfigured.memberTimezones.a, 'Asia/Tokyo')
assert.equal(parityConfigured.bubbleNarrationEnabled, false)
assert.equal(parityConfigured.enableMsgCountLimit, false)

const parityContacts = [
  { ...contacts[0], bilingualEnabled: false, timePerception: false, timezone: 'America/New_York' },
  { ...contacts[1], bilingualEnabled: false, timePerception: false, timezone: 'America/Los_Angeles' }
]
parityConfigured.userProfile = { name: '小满', timezone: 'Asia/Shanghai' }
parityConfigured.messages = [{ id: 1723456789000, timestamp: 1723456789000, type: 'right', content: '测试时间' }]
payload = await buildGroupChatMessages(parityConfigured, parityContacts, parityConfigured.userProfile)
assert.match(payload[0].content, /所有对白必须使用日语/)
assert.match(payload[0].content, /简体中文翻译/)
assert.match(payload[0].content, /Asia\/Shanghai/)
assert.match(payload[0].content, /Asia\/Tokyo/)
assert.match(payload[0].content, /Europe\/London/)
assert.match(payload[1].content, /time="2024-/)

const parityOff = normalizeGroupChat({ ...parityConfigured, bilingualEnabled: false, timePerception: false })
payload = await buildGroupChatMessages(parityOff, [
  { ...parityContacts[0], bilingualEnabled: true, timePerception: true },
  { ...parityContacts[1], bilingualEnabled: true, timePerception: true }
], parityOff.userProfile)
assert.doesNotMatch(payload[0].content, /双语对话规则|Bilingual dialogue rules/)
assert.doesNotMatch(payload[0].content, /群聊当前时间/)
assert.doesNotMatch(payload[1].content, /\stime=/)

const capabilityGroup = normalizeGroupChat({
  ...group,
  bubbleNarrationEnabled: true,
  enableMsgCountLimit: true,
  minMsgCount: 2,
  maxMsgCount: 5,
  boundWorldBookGroups: ['lore_group'],
  memberSettings: { a: { enableVoiceReply: true, enableNAIImageGen: true } },
  messages: [
    { id: 201, type: 'right', content: '[语音消息]', voiceData: { text: '能听见吗', seconds: 3 } },
    { id: 202, type: 'right', content: '[发来一笔转账]', transferData: { type: 'transfer', amount: 88, remark: '晚饭', status: 'pending' } },
    { id: 203, type: 'right', content: '[图片]', imageData: { text: '海边的合照', summary: '' } }
  ]
})
payload = await buildGroupChatMessages(capabilityGroup, contacts, { name: '小满' })
assert.match(payload[0].content, /群聊气泡叙事/)
assert.match(payload[0].content, /2 到 5 个 group_msg/)
assert.match(payload[1].content, /能听见吗/)
assert.match(payload[2].content, /88/)
assert.match(payload[2].content, /晚饭/)
assert.match(payload[3].content, /海边的合照/)
assert.deepEqual(capabilityGroup.boundWorldBookGroups, ['lore_group'])
assert.equal(capabilityGroup.memberSettings.a.enableVoiceReply, true)

const callGroup = normalizeGroupChat({
  ...group,
  activeCallType: 'voice',
  activeCallStartedAt: 1723456789000,
  activeCallStartMessageId: 301,
  memberSettings: { a: { enableVoiceCall: true }, b: { enableVoiceCall: false } },
  disableMediaDuringCall: true,
  disableThoughtDuringCall: true,
  activeCallTemporarySummary: '较早的群通话内容',
  messages: [
    { id: 300, type: 'right', content: '通话前的普通消息' },
    { id: 301, type: 'right', content: '群语音内容', isVoiceCallProcessMsg: true },
    { id: 302, type: 'right', content: '旧视频内容', isVideoCallProcessMsg: true }
  ]
})
payload = await buildGroupChatMessages(callGroup, contacts, { name: '小满' })
assert.match(payload[0].content, /当前群通话/)
assert.match(payload[0].content, /语音通话/)
assert.match(payload[0].content, /较早的群通话内容/)
assert.match(payload[0].content, /禁止发送 image、voice、emoji/)
assert.match(payload[0].content, /禁止输出 group_inner_thought/)
assert.match(payload[0].content, /display_name="阿岚"/)
assert.doesNotMatch(payload[0].content, /display_name="白露"/)
assert.ok(payload.some(item => typeof item.content === 'string' && item.content.includes('群语音内容')))
assert.ok(!payload.some(item => typeof item.content === 'string' && item.content.includes('旧视频内容')))
callGroup.activeCallType = null
payload = await buildGroupChatMessages(callGroup, contacts, { name: '小满' })
assert.ok(!payload.some(item => typeof item.content === 'string' && item.content.includes('群语音内容')))
assert.equal(normalizeGroupChat({ id: 'legacy', memberIds: [] }).userProfile.name, '我')

const sourceMessages = [
  { id: 101, type: 'right', content: '周六一起去海边吧' },
  { id: 102, type: 'left', senderId: 'a', senderNameSnapshot: '阿岚', content: '好，我带相机。' },
  { id: 103, type: 'left', senderId: 'b', senderNameSnapshot: '白露', content: '我下午才能到。' }
]
group.messages.push(...sourceMessages)
assert.match(formatMessagesForMemory(sourceMessages), /阿岚: 好，我带相机/)
assert.match(formatMessagesForMemory(sourceMessages), /白露: 我下午才能到/)
assert.match(buildExtractionPrompt(sourceMessages, 'hybrid', '', { name: group.name, members: [{ id: 'a', name: '阿岚' }, { id: 'b', name: '白露' }] }), /memberMemories/)

applyMemoryExtraction(group, {
  narrative: '群里约定周六去海边，阿岚带相机，白露下午到。',
  subjective: '',
  memberMemories: { a: '我答应周六去海边并带相机。', b: '我会在周六下午到海边。', unknown: '不应保存' },
  events: [{ title: '周六海边计划', summary: '群成员约定周六去海边。', participants: ['用户', '阿岚', '白露'], evidence: { messageIds: [101, 102, 103] } }],
  variables: [], tableRows: [], relations: []
}, sourceMessages, 'hybrid')
assert.equal(group.memoryBook.length, 1)
assert.equal(group.memberMemories.a.length, 1)
assert.equal(group.memberMemories.b.length, 1)
assert.equal(group.memberMemories.unknown, undefined)
assert.equal(getUncoveredMessages(group).length, 0)

group.messages.push({ id: 104, type: 'left', senderId: 'a', senderNameSnapshot: '阿岚', content: '我把相机借出去了。' })
assert.deepEqual(getUncoveredMessages(group).map(item => item.id), [104])
invalidateMemoriesForMessages(group, [102])
assert.equal(group.memoryBook.length, 0)
assert.equal(group.memberMemories.a.length, 0)
assert.ok(getUncoveredMessages(group).some(item => item.id === 101))

for (let index = 0; index < 30; index++) group.messages.push({ id: 200 + index, type: index % 2 ? 'left' : 'right', senderId: 'a', content: `消息${index}` })
payload = await buildGroupChatMessages(group, contacts, { name: '小满' })
assert.doesNotMatch(payload[0].content, /group_memory_delta|同次记忆整理|每经过 24/)

const managedGroup = createGroupChat({ name: '管理测试群', groupContext: '', memberIds: ['a', 'b', 'c'] }, { name: '小满' })
assert.equal(managedGroup.ownerId, 'user')
ensureGroupManagementState(managedGroup)
const stableAdminIds = managedGroup.adminIds
const stableLevelTitles = managedGroup.levelTitles
ensureGroupManagementState(managedGroup)
assert.equal(managedGroup.adminIds, stableAdminIds)
assert.equal(managedGroup.levelTitles, stableLevelTitles)
assert.equal(getGroupPermissions(managedGroup, 'user').canTransferOwnership, true)
groupManagementService.promoteMember(managedGroup, 'user', 'a')
assert.deepEqual(managedGroup.adminIds, ['a'])
assert.throws(() => groupManagementService.muteMember(managedGroup, 'a', 'user', 60), /管理员只能管理普通成员|群主不能/)
groupManagementService.muteMember(managedGroup, 'a', 'b', 60, '测试禁言')
assert.equal(isGroupMemberMuted(managedGroup, 'b'), true)
assert.deepEqual(getSpeakableCharacterIds(managedGroup).sort(), ['a', 'c'])
groupManagementService.unmuteMember(managedGroup, 'a', 'b')
assert.equal(isGroupMemberMuted(managedGroup, 'b'), false)
groupManagementService.setWholeGroupMute(managedGroup, 'a', true)
assert.equal(isGroupMemberMuted(managedGroup, 'b'), true)
assert.equal(isGroupMemberMuted(managedGroup, 'a'), false)
groupManagementService.setWholeGroupMute(managedGroup, 'user', false)

assert.equal(awardGroupActivity(managedGroup, 'b', 'turn-1', Date.now()), true)
assert.equal(managedGroup.memberPoints?.b, 3)
assert.equal(awardGroupActivity(managedGroup, 'b', 'turn-1', Date.now()), false)
const notice = groupManagementService.publishAnnouncement(managedGroup, 'a', { title: '集合通知', content: '今晚八点集合', isPinned: true, needConfirm: true })
assert.equal(managedGroup.announcements?.length, 1)
groupManagementService.markAnnouncementRead(managedGroup, 'user', notice.id)
groupManagementService.confirmAnnouncement(managedGroup, 'user', notice.id)
assert.equal(notice.readUserIds.includes('user'), true)
assert.equal(notice.confirmedUserIds.includes('user'), true)
groupManagementService.transferOwnership(managedGroup, 'user', 'a')
assert.equal(managedGroup.ownerId, 'a')
assert.equal(getGroupPermissions(managedGroup, 'user').isOwner, false)
groupManagementService.recoverOwnership(managedGroup)
assert.equal(managedGroup.ownerId, 'user')
const restoredManagedGroup = normalizeGroupChat(JSON.parse(JSON.stringify(managedGroup)))
assert.equal(restoredManagedGroup.announcements?.[0].title, '集合通知')
assert.deepEqual(restoredManagedGroup.adminIds, ['a'])
assert.ok((restoredManagedGroup.adminLogs?.length || 0) >= 6)

console.log('Group chat prompt and response protocol tests passed.')
