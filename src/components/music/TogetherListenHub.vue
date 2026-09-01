/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useTogetherListen } from '../../services/togetherListen'
import { useMusicPlayer } from '../../composables/useMusicPlayer'
import { useMusicLibrary } from '../../composables/useMusicLibrary'
import { mockChats, myProfile } from '../../composables/chatState/state'
import type { TogetherListenMemoryMode, TogetherListenTextDisplay } from '../../types/togetherListen'
import type { MusicTrack } from '../../types/music'

const props = withDefaults(defineProps<{ visible: boolean; suggestedChat?: any | null; initialPage?: 'home' | 'settings'; returnToPlayerOnConnect?: boolean }>(), { initialPage: 'home', returnToPlayerOnConnect: false })
const emit = defineEmits<{ (e: 'close'): void }>()
const {
  activeSession, records, settings, busy, error, startStrangerMatch, inviteCharacter,
  addUserMessage, requestPartnerReply, createUserFriendRequest, respondFriendRequest,
  endSession, summarizeActiveSession, summarizeRecord, cancelPendingSession, updateSettings, clearError
} = useTogetherListen()
const player = useMusicPlayer()
const library = useMusicLibrary()

const page = ref<'home' | 'roles' | 'room' | 'settings' | 'records' | 'record-detail'>('home')
const selectedRecord = ref<(typeof records.value)[number] | null>(null)
const input = ref('')
const chatScroll = ref<HTMLElement | null>(null)
const roleSearch = ref('')
const requestMessage = ref('想和你成为好友')
const pickerOpen = ref(false)
const trackQuery = ref('')
const clock = ref(Date.now())
let clockTimer: number | null = null

const quickTracks = computed(() => {
  const source = library.searchResult.value.tracks.length
    ? library.searchResult.value.tracks
    : [...library.likedTracks.value, ...library.history.value]
  const seen = new Set<string>()
  return source.filter(track => {
    const key = `${track.sourceId}:${track.sourceTrackId || track.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return track.available !== false
  }).slice(0, 12)
})
const quickTrackLabel = computed(() => library.searchResult.value.tracks.length ? '搜索结果' : '喜欢与最近播放')
const userForSession = (session: (typeof records.value)[number] | null | undefined) => session?.user || myProfile.value
const userInitial = (session: (typeof records.value)[number] | null | undefined) => String(userForSession(session).name || '我').charAt(0)
const userAvatarStyle = (session: (typeof records.value)[number] | null | undefined) => userForSession(session).avatarUrl
  ? { backgroundImage: `url(${userForSession(session).avatarUrl})` }
  : {}
const partnerName = (session: (typeof records.value)[number]) => session.participant.revealed
  ? session.participant.name
  : session.participant.anonymousName
const partnerInitial = (session: (typeof records.value)[number]) => session.participant.revealed
  ? String(session.participant.name || '听').charAt(0)
  : '?'
const partnerAvatarStyle = (session: (typeof records.value)[number]) => session.participant.revealed && session.participant.avatarUrl
  ? { backgroundImage: `url(${session.participant.avatarUrl})` }
  : {}

const roleList = computed(() => mockChats.value.filter(chat => (
  chat && chat.id !== 1 && chat.chatType !== 'group' && chat.contactState !== 'candidate'
    && (!props.suggestedChat || String(chat.id) !== String(props.suggestedChat.id))
    && (!roleSearch.value.trim() || String(chat.realName || chat.name || '').toLowerCase().includes(roleSearch.value.trim().toLowerCase()))
)))
const displayName = computed(() => {
  const participant = activeSession.value?.participant
  if (!participant) return ''
  return participant.revealed ? participant.name : participant.anonymousName
})
const elapsed = computed(() => {
  const session = activeSession.value
  if (!session) return '00:00'
  const seconds = Math.max(0, Math.floor(((session.endedAt || clock.value) - session.startedAt) / 1000))
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
})
const pendingPartnerRequest = computed(() => activeSession.value?.friendRequests.find(item => item.direction === 'partner_to_user' && item.status === 'pending'))
const pendingUserRequest = computed(() => activeSession.value?.friendRequests.find(item => item.direction === 'user_to_partner' && item.status === 'pending'))
const canRequestFriend = computed(() => activeSession.value?.mode === 'stranger'
  && activeSession.value.settings.allowFriendRequests
  && !activeSession.value.promotedChatId
  && !pendingUserRequest.value)

watch(() => props.visible, visible => {
  if (!visible) return
  clearError()
  if (props.initialPage === 'settings') page.value = 'settings'
  else if (activeSession.value) page.value = 'room'
  else if (props.suggestedChat) page.value = 'roles'
  else page.value = 'home'
})
watch(() => activeSession.value?.messages.length, async () => {
  await nextTick()
  if (chatScroll.value) chatScroll.value.scrollTop = chatScroll.value.scrollHeight
})
onMounted(() => { clockTimer = window.setInterval(() => { clock.value = Date.now() }, 1000) })
onUnmounted(() => { if (clockTimer !== null) window.clearInterval(clockTimer) })

const startMatch = async () => {
  page.value = 'room'
  await startStrangerMatch()
  if (props.returnToPlayerOnConnect && activeSession.value?.status === 'active') close()
}
const chooseRole = async (chat: any) => {
  page.value = 'room'
  const accepted = await inviteCharacter(chat)
  if (props.returnToPlayerOnConnect && accepted) close()
}
const send = () => {
  const text = input.value.trim()
  if (!text) return
  addUserMessage(text); input.value = ''
}
const updateMemoryMode = (event: Event) => updateSettings({ memoryMode: (event.target as HTMLSelectElement).value as TogetherListenMemoryMode })
const updateTextDisplay = (event: Event) => updateSettings({ textDisplay: (event.target as HTMLSelectElement).value as TogetherListenTextDisplay })
const close = () => emit('close')
const openRecord = (record: (typeof records.value)[number]) => { selectedRecord.value = record; page.value = 'record-detail' }
const finishSession = async () => { await endSession(); page.value = 'records' }
const searchTracks = async () => {
  if (!trackQuery.value.trim()) { library.clearSearch(); return }
  await library.searchAll(trackQuery.value)
}
const chooseTrack = async (track: MusicTrack) => {
  await player.playTrack(track)
  pickerOpen.value = false
}
</script>

<template>
  <Teleport to="body">
    <transition name="listen-hub-fade">
      <div v-if="visible" class="listen-hub-overlay" @click.self="close">
        <section class="listen-hub" role="dialog" aria-modal="true" aria-label="一起听">
          <header class="listen-hub-header">
            <button v-if="page === 'record-detail'" type="button" @click="page = 'records'">‹</button>
            <button v-else-if="page !== 'home' && !activeSession && initialPage !== 'settings'" type="button" @click="page = 'home'">‹</button>
            <button v-else type="button" @click="close">×</button>
            <div><strong>{{ page === 'settings' ? '一起听设置' : page === 'records' ? '一起听记录' : page === 'record-detail' ? '记录详情' : page === 'roles' ? '选择角色' : '一起听' }}</strong><small v-if="activeSession">{{ displayName }} · {{ elapsed }}</small></div>
            <button v-if="activeSession?.status === 'active' && page !== 'settings'" type="button" @click="page = 'settings'">设置</button>
            <button v-else-if="page === 'settings'" type="button" @click="initialPage === 'settings' ? close() : page = 'room'">完成</button>
            <span v-else></span>
          </header>

          <main v-if="page === 'home'" class="listen-home">
            <div class="listen-current-track">
              <span class="listen-cover" :style="player.currentTrack.value?.coverUrl ? { backgroundImage: `url(${player.currentTrack.value.coverUrl})` } : {}">♫</span>
              <div><small>从当前音乐开始</small><strong>{{ player.currentTrack.value?.title || '暂未播放歌曲' }}</strong><span>{{ player.currentTrack.value?.artist || '进入后仍可选歌' }}</span></div>
            </div>
            <button class="listen-track-picker-toggle" type="button" @click="pickerOpen = !pickerOpen">{{ player.currentTrack.value ? '换一首歌' : '先选一首歌' }}<b>›</b></button>
            <section v-if="pickerOpen" class="listen-track-picker">
              <form @submit.prevent="searchTracks"><input v-model="trackQuery" placeholder="搜索歌曲或歌手" /><button type="submit" :disabled="library.isSearching.value">{{ library.isSearching.value ? '搜索中' : '搜索' }}</button></form>
              <small>{{ quickTrackLabel }}</small>
              <button v-for="track in quickTracks" :key="`${track.sourceId}:${track.sourceTrackId || track.id}`" type="button" @click="chooseTrack(track)"><span><strong>{{ track.title }}</strong><small>{{ track.artist }}</small></span><b>播放</b></button>
              <p v-if="!quickTracks.length">{{ library.libraryMessage.value || '还没有最近播放，可搜索歌曲' }}</p>
            </section>
            <button class="listen-mode-card" type="button" :disabled="busy" @click="startMatch">
              <i class="stranger-icon">✦</i><span><strong>匹配陌生听友</strong><small>由 API 创建独立 AI 听友，可能聊天，也可能安静听歌</small></span><b>›</b>
            </button>
            <button class="listen-mode-card" type="button" @click="page = 'roles'">
              <i>♫</i><span><strong>邀请角色一起听</strong><small>角色会根据人设、关系与当前状态决定是否接受</small></span><b>›</b>
            </button>
            <button v-if="records.length" class="listen-quiet-row" type="button" @click="page = 'records'"><span>一起听记录</span><b>{{ records.length }} 次 ›</b></button>
            <p class="listen-disclosure">陌生听友为 AI 模拟角色，不会连接现实中的陌生用户。</p>
          </main>

          <main v-else-if="page === 'roles'" class="listen-role-page">
            <div v-if="suggestedChat" class="suggested-role"><small>当前聊天</small><button type="button" @click="chooseRole(suggestedChat)"><span class="role-avatar" :style="suggestedChat.avatarUrl ? { backgroundImage: `url(${suggestedChat.avatarUrl})` } : {}">{{ suggestedChat.avatarUrl ? '' : String(suggestedChat.name || '角').charAt(0) }}</span><span><strong>{{ suggestedChat.realName || suggestedChat.name }}</strong><small>邀请 TA 一起听当前歌曲</small></span><b>邀请</b></button></div>
            <input v-model="roleSearch" class="role-search" placeholder="搜索角色" />
            <div class="role-list">
              <button v-for="chat in roleList" :key="chat.id" type="button" :disabled="busy" @click="chooseRole(chat)">
                <span class="role-avatar" :style="chat.avatarUrl ? { backgroundImage: `url(${chat.avatarUrl})` } : {}">{{ chat.avatarUrl ? '' : String(chat.name || '角').charAt(0) }}</span>
                <span><strong>{{ chat.realName || chat.name }}</strong><small>{{ chat.statusText || '根据人设自主回应邀请' }}</small></span><b>邀请</b>
              </button>
              <p v-if="!roleList.length">没有可邀请的角色</p>
            </div>
          </main>

          <main v-else-if="page === 'room'" class="listen-room">
            <div v-if="activeSession" class="listen-room-track">
              <span class="listen-cover large" :style="player.currentTrack.value?.coverUrl ? { backgroundImage: `url(${player.currentTrack.value.coverUrl})` } : {}">♫</span>
              <div><strong>{{ player.currentTrack.value?.title || '暂未播放' }}</strong><small>{{ player.currentTrack.value?.artist || '可以返回播放器选歌' }}</small><p>{{ player.currentTrack.value?.lyrics?.[player.currentLyricIndex.value]?.text || '当前没有歌词' }}</p></div>
              <div class="listen-controls"><button type="button" @click="player.togglePlay()">{{ player.isPlaying.value ? 'Ⅱ' : '▶' }}</button><button type="button" @click="player.nextTrack()">▶｜</button></div>
            </div>
            <button v-if="activeSession && !player.currentTrack.value" class="listen-track-picker-toggle room" type="button" @click="pickerOpen = !pickerOpen">选择一起听的歌曲<b>›</b></button>
            <section v-if="activeSession && pickerOpen && !player.currentTrack.value" class="listen-track-picker room">
              <form @submit.prevent="searchTracks"><input v-model="trackQuery" placeholder="搜索歌曲或歌手" /><button type="submit" :disabled="library.isSearching.value">{{ library.isSearching.value ? '搜索中' : '搜索' }}</button></form>
              <small>{{ quickTrackLabel }}</small>
              <button v-for="track in quickTracks" :key="`${track.sourceId}:${track.sourceTrackId || track.id}`" type="button" @click="chooseTrack(track)"><span><strong>{{ track.title }}</strong><small>{{ track.artist }}</small></span><b>播放</b></button>
              <p v-if="!quickTracks.length">{{ library.libraryMessage.value || '还没有最近播放，可搜索歌曲' }}</p>
            </section>

            <div v-if="activeSession" class="listen-connection" :class="activeSession.status">
              <div class="listen-avatar-pair" aria-label="一起听双方头像">
                <span class="listen-paired-avatar" :style="userAvatarStyle(activeSession)">{{ userForSession(activeSession).avatarUrl ? '' : userInitial(activeSession) }}</span>
                <span class="listen-paired-avatar partner" :class="{ anonymous: !activeSession.participant.revealed, pending: activeSession.status !== 'active' }" :style="partnerAvatarStyle(activeSession)">{{ activeSession.participant.revealed && activeSession.participant.avatarUrl ? '' : partnerInitial(activeSession) }}</span>
              </div>
              <p>{{ activeSession.status === 'active' ? `和${displayName}一起听了 ${elapsed}` : activeSession.status === 'matching' ? '正在连接一位听友' : `等待${displayName}回应` }}</p>
            </div>

            <div v-if="activeSession?.status === 'matching' || activeSession?.status === 'inviting'" class="listen-waiting">
              <span v-if="busy" class="listen-spinner"></span><strong>{{ error || activeSession.lastError || (activeSession.status === 'matching' ? '正在寻找听友' : '正在等待角色回应') }}</strong><small>{{ error || activeSession.lastError ? '没有创建联系人，可以安全重试。' : '可以取消，不会创建未完成的联系人' }}</small><div class="listen-wait-actions"><button type="button" @click="cancelPendingSession(); page = 'home'">取消</button><button v-if="(error || activeSession.lastError) && activeSession.status === 'matching'" type="button" @click="cancelPendingSession(); startMatch()">重试</button></div>
            </div>
            <div v-else-if="!activeSession" class="listen-empty-room">
              <strong>{{ error || '会话已经结束' }}</strong><button type="button" @click="page = 'home'">返回一起听</button>
            </div>
            <template v-else>
              <div class="listen-participant">
                <span><strong>{{ displayName }}</strong><small>{{ activeSession.participant.revealed ? `ID：${activeSession.participant.socialId}` : '匿名头像 · 身份暂未公开' }}</small></span>
                <em>{{ activeSession.mode === 'stranger' ? 'AI 听友' : '已有角色' }}</em>
              </div>
              <div ref="chatScroll" class="listen-chat">
                <div v-for="message in activeSession.messages" :key="message.id" class="listen-message" :class="[message.sender, message.kind]">
                  <small v-if="message.sender !== 'system'">{{ message.sender === 'user' ? '我' : displayName }}<template v-if="message.trackTitle"> · 听《{{ message.trackTitle }}》时</template></small>
                  <p>{{ message.content }}</p>
                </div>
                <div v-if="pendingPartnerRequest" class="friend-request-card"><strong>{{ displayName }}想加你为好友</strong><p>{{ pendingPartnerRequest.message }}</p><div><button type="button" @click="respondFriendRequest(pendingPartnerRequest.id, false)">拒绝</button><button type="button" @click="respondFriendRequest(pendingPartnerRequest.id, true)">接受</button></div></div>
              </div>
              <div v-if="error" class="listen-error">{{ error }}</div>
              <div v-if="canRequestFriend" class="friend-request-inline"><input v-model="requestMessage" maxlength="80" /><button type="button" @click="createUserFriendRequest(requestMessage)">申请好友</button></div>
              <div v-else-if="pendingUserRequest" class="friend-request-status">好友申请等待对方回应，可点击 API 回复推进。</div>
              <div v-else-if="activeSession.promotedChatId" class="friend-request-status success">已经成为好友，身份已公开。</div>
              <div class="listen-composer"><input v-model="input" placeholder="在一起听里说点什么…" @keydown.enter.prevent="send" /><button type="button" @click="send">发送</button><button class="api" type="button" :disabled="busy" @click="requestPartnerReply()">{{ busy ? '回复中…' : 'API 回复' }}</button></div>
              <button class="end-listen" type="button" :disabled="busy" @click="finishSession">{{ busy ? '正在整理本次记录…' : '结束本次一起听' }}</button>
            </template>
          </main>

          <main v-else-if="page === 'settings'" class="listen-settings">
            <section><h3>记录与记忆</h3><label v-if="activeSession" class="listen-summary-action"><span><strong>立即总结当前会话</strong><small>{{ activeSession.summary || '只整理音乐聊天与重要歌曲' }}</small></span><button type="button" :disabled="busy" @click="summarizeActiveSession">{{ busy ? '总结中…' : '执行' }}</button></label><label><span><strong>音乐记忆模式</strong><small>控制角色在哪里记得一起听经历</small></span><select :value="settings.memoryMode" @change="updateMemoryMode"><option value="none">不保留</option><option value="music-only">仅音乐空间延续</option><option value="shared">与普通单聊互通</option></select></label><label><span><strong>文字记录显示</strong><small>默认不混入普通单聊</small></span><select :value="settings.textDisplay" @change="updateTextDisplay"><option value="separate">独立音乐聊天</option><option value="single-chat">同步到普通单聊</option></select></label><label><span><strong>保留本地记录</strong><small>结束后仍可从一起听记录查看</small></span><input type="checkbox" :checked="settings.keepLocalRecords" @change="updateSettings({ keepLocalRecords: ($event.target as HTMLInputElement).checked })" /></label><label><span><strong>结束后自动总结</strong><small>总结遵守上面的记忆范围</small></span><input type="checkbox" :checked="settings.autoSummary" @change="updateSettings({ autoSummary: ($event.target as HTMLInputElement).checked })" /></label></section>
            <section><h3>语言与上下文</h3><label><span><strong>双语聊天</strong><small>只影响音乐聊天，不改变普通单聊</small></span><input type="checkbox" :checked="settings.bilingualEnabled" @change="updateSettings({ bilingualEnabled: ($event.target as HTMLInputElement).checked })" /></label><label v-if="settings.bilingualEnabled"><span><strong>翻译目标语言</strong><small>例如英语、日语或跟随应用</small></span><input class="listen-setting-text" :value="settings.translationLanguage" maxlength="24" @change="updateSettings({ translationLanguage: ($event.target as HTMLInputElement).value.trim() || '跟随应用' })" /></label><label><span><strong>允许感知歌词</strong><small>每次只提交当前附近歌词</small></span><input type="checkbox" :checked="settings.includeLyrics" @change="updateSettings({ includeLyrics: ($event.target as HTMLInputElement).checked })" /></label></section>
            <section><h3>对方行为</h3><label><span><strong>允许角色主动邀请</strong><small>角色可在普通单聊中发来一起听邀请，你仍可拒绝</small></span><input type="checkbox" :checked="settings.allowCharacterInvites" @change="updateSettings({ allowCharacterInvites: ($event.target as HTMLInputElement).checked })" /></label><label><span><strong>允许主动说话</strong><small>关闭后仍可安静一起听</small></span><input type="checkbox" :checked="settings.allowPartnerSpeak" @change="updateSettings({ allowPartnerSpeak: ($event.target as HTMLInputElement).checked })" /></label><label><span><strong>歌曲变化时自主判断</strong><small>只在换歌等重要事件调用，不逐句歌词调用</small></span><input type="checkbox" :checked="settings.eventDrivenEnabled" @change="updateSettings({ eventDrivenEnabled: ($event.target as HTMLInputElement).checked })" /></label><label><span><strong>允许切歌</strong><small>带冷却，避免连续机械切歌</small></span><input type="checkbox" :checked="settings.allowPartnerSwitchTrack" @change="updateSettings({ allowPartnerSwitchTrack: ($event.target as HTMLInputElement).checked })" /></label><label><span><strong>允许播放和暂停</strong></span><input type="checkbox" :checked="settings.allowPartnerPlaybackControl" @change="updateSettings({ allowPartnerPlaybackControl: ($event.target as HTMLInputElement).checked })" /></label><label><span><strong>允许好友申请</strong></span><input type="checkbox" :checked="settings.allowFriendRequests" @change="updateSettings({ allowFriendRequests: ($event.target as HTMLInputElement).checked })" /></label></section>
          </main>

          <main v-else-if="page === 'records'" class="listen-records">
            <button v-for="record in records" :key="record.id" type="button" @click="openRecord(record)">
              <span class="listen-record-avatars"><i :style="userAvatarStyle(record)">{{ userForSession(record).avatarUrl ? '' : userInitial(record) }}</i><i :class="{ anonymous: !record.participant.revealed }" :style="partnerAvatarStyle(record)">{{ record.participant.revealed && record.participant.avatarUrl ? '' : partnerInitial(record) }}</i></span>
              <span class="listen-record-copy"><strong>我和{{ partnerName(record) }}</strong><small>{{ new Date(record.startedAt).toLocaleString('zh-CN') }} · {{ record.trackHistory.length }} 首歌</small><p>{{ record.summary || '没有生成总结' }}</p></span>
            </button>
            <div v-if="!records.length" class="record-empty">还没有一起听记录</div>
          </main>
          <main v-else class="listen-record-detail">
            <template v-if="selectedRecord">
              <div class="record-detail-head"><div class="record-detail-pair"><div class="listen-avatar-pair"><span class="listen-paired-avatar" :style="userAvatarStyle(selectedRecord)">{{ userForSession(selectedRecord).avatarUrl ? '' : userInitial(selectedRecord) }}</span><span class="listen-paired-avatar partner" :class="{ anonymous: !selectedRecord.participant.revealed }" :style="partnerAvatarStyle(selectedRecord)">{{ selectedRecord.participant.revealed && selectedRecord.participant.avatarUrl ? '' : partnerInitial(selectedRecord) }}</span></div></div><strong>我和{{ partnerName(selectedRecord) }}的一起听</strong><small>{{ new Date(selectedRecord.startedAt).toLocaleString('zh-CN') }} · {{ selectedRecord.trackHistory.map(track => `《${track.title}》`).join('、') || '未记录歌曲' }}</small><p>{{ selectedRecord.summary || '本次没有生成总结。' }}</p><button v-if="!selectedRecord.summary" type="button" :disabled="busy" @click="summarizeRecord(selectedRecord.id)">{{ busy ? '总结中…' : '生成总结' }}</button></div>
              <div class="record-detail-messages"><div v-for="message in selectedRecord.messages" :key="message.id" class="listen-message" :class="[message.sender, message.kind]"><small v-if="message.sender !== 'system'">{{ message.sender === 'user' ? '我' : selectedRecord.participant.name }}</small><p>{{ message.content }}</p></div></div>
            </template>
          </main>
        </section>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.listen-hub-overlay{position:fixed;inset:0;z-index:12050;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.42);backdrop-filter:blur(3px)}.listen-hub{display:flex;width:min(100%,480px);height:min(88vh,780px);flex-direction:column;overflow:hidden;border-radius:22px 22px 0 0;background:var(--sys-bg-primary,#fff);color:var(--text-primary,#202124);box-shadow:0 -18px 48px rgba(0,0,0,.18);padding-bottom:env(safe-area-inset-bottom);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.listen-hub-header{display:grid;grid-template-columns:56px 1fr 56px;align-items:center;min-height:58px;border-bottom:1px solid var(--border-color,#ececef)}.listen-hub-header>button{height:44px;border:0;background:transparent;color:inherit;font:inherit;font-size:13px}.listen-hub-header>button:first-child{font-size:27px}.listen-hub-header>div{text-align:center}.listen-hub-header strong,.listen-hub-header small{display:block}.listen-hub-header strong{font-size:15px}.listen-hub-header small{margin-top:3px;color:var(--text-tertiary,#999);font-size:9px}.listen-hub main{min-height:0;flex:1;overflow:auto}.listen-home,.listen-role-page,.listen-settings,.listen-records{padding:16px}.listen-current-track,.listen-participant,.listen-room-track{display:flex;align-items:center;gap:12px}.listen-current-track{padding:13px;border-radius:16px;background:var(--sys-bg-secondary,#f6f6f7)}.listen-cover{display:grid;width:48px;height:48px;flex:none;place-items:center;border-radius:12px;background:#252528 center/cover;color:#fff;font-style:normal}.listen-cover.large{width:64px;height:64px}.listen-current-track>div,.listen-participant>span:nth-child(2),.listen-room-track>div{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px}.listen-current-track small,.listen-current-track span,.listen-mode-card small,.role-list small,.suggested-role small,.listen-participant small,.listen-room-track small{color:var(--text-tertiary,#999);font-size:10px}.listen-current-track strong,.listen-current-track span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.listen-mode-card{display:flex;width:100%;align-items:center;gap:12px;margin-top:11px;padding:15px 13px;border:1px solid var(--border-color,#ececef);border-radius:16px;background:var(--sys-bg-secondary,#fff);color:inherit;text-align:left}.listen-mode-card>i{display:grid;width:42px;height:42px;flex:none;place-items:center;border-radius:14px;background:#242426;color:#fff;font-size:18px;font-style:normal}.listen-mode-card>.stranger-icon{background:linear-gradient(145deg,#7b68ee,#4a90e2)}.listen-mode-card>span{display:flex;min-width:0;flex:1;flex-direction:column;gap:4px}.listen-mode-card>b{color:var(--text-tertiary,#aaa);font-size:24px}.listen-quiet-row{display:flex;width:100%;justify-content:space-between;margin-top:13px;padding:13px 2px;border:0;border-bottom:1px solid var(--border-color,#eee);background:transparent;color:inherit}.listen-quiet-row b{color:var(--text-tertiary,#999);font-weight:400}.listen-disclosure{margin:15px 3px;color:var(--text-tertiary,#999);font-size:9px;line-height:1.55}.role-search{box-sizing:border-box;width:100%;height:40px;margin:8px 0 12px;padding:0 13px;border:1px solid var(--border-color,#e5e5e8);border-radius:12px;background:var(--sys-bg-secondary,#f6f6f7);color:inherit;outline:0}.suggested-role{margin-bottom:14px}.suggested-role>small{display:block;margin:0 3px 6px}.suggested-role button,.role-list button{display:flex;width:100%;align-items:center;gap:11px;padding:10px 4px;border:0;border-bottom:1px solid var(--border-color,#eee);background:transparent;color:inherit;text-align:left}.role-avatar{display:grid;width:40px;height:40px;flex:none;place-items:center;border-radius:50%;background:var(--sys-bg-tertiary,#e5e5e8) center/cover;font-size:13px}.suggested-role button>span:nth-child(2),.role-list button>span:nth-child(2){display:flex;min-width:0;flex:1;flex-direction:column;gap:4px}.suggested-role button>b,.role-list button>b{padding:6px 11px;border-radius:12px;background:#242426;color:#fff;font-size:10px}.listen-room{display:flex!important;flex-direction:column;overflow:hidden!important}.listen-room-track{padding:12px 15px;border-bottom:1px solid var(--border-color,#eee);background:var(--sys-bg-secondary,#f7f7f8)}.listen-room-track p{margin:2px 0 0;overflow:hidden;color:var(--text-secondary,#666);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.listen-controls{display:flex!important;flex:0!important;flex-direction:row!important}.listen-controls button{width:34px;height:34px;border:0;border-radius:50%;background:var(--sys-bg-tertiary,#e7e7e9);color:inherit}.listen-waiting,.listen-empty-room{display:flex;flex:1;align-items:center;justify-content:center;flex-direction:column;gap:11px;padding:30px;text-align:center}.listen-waiting small{color:var(--text-tertiary,#999);font-size:10px}.listen-waiting button,.listen-empty-room button{padding:8px 18px;border:0;border-radius:13px;background:#262629;color:#fff}.listen-spinner{width:30px;height:30px;border:3px solid #ddd;border-top-color:#444;border-radius:50%;animation:listen-spin .8s linear infinite}.listen-participant{padding:9px 14px;border-bottom:1px solid var(--border-color,#eee)}.listen-participant em{padding:3px 7px;border-radius:9px;background:var(--sys-bg-tertiary,#eee);color:var(--text-tertiary,#777);font-size:8px;font-style:normal}.listen-chat{min-height:0;flex:1;overflow:auto;padding:13px 14px}.listen-message{display:flex;margin-bottom:10px;flex-direction:column;align-items:flex-start}.listen-message.user{align-items:flex-end}.listen-message small{margin:0 4px 3px;color:var(--text-tertiary,#999);font-size:8px}.listen-message p{max-width:78%;margin:0;padding:8px 11px;border-radius:14px 14px 14px 4px;background:var(--sys-bg-tertiary,#ececef);font-size:12px;line-height:1.5;white-space:pre-wrap}.listen-message.user p{border-radius:14px 14px 4px 14px;background:#252527;color:#fff}.listen-message.system{align-items:center}.listen-message.system p{max-width:90%;padding:3px 9px;border-radius:9px;background:transparent;color:var(--text-tertiary,#999);font-size:9px;text-align:center}.friend-request-card{margin:13px 5px;padding:13px;border:1px solid var(--border-color,#ddd);border-radius:14px;background:var(--sys-bg-secondary,#fff)}.friend-request-card p{margin:6px 0;color:var(--text-secondary,#666);font-size:11px}.friend-request-card div{display:flex;gap:7px}.friend-request-card button{height:31px;flex:1;border:1px solid var(--border-color,#ddd);border-radius:9px;background:transparent;color:inherit}.friend-request-card button:last-child{background:#242426;color:#fff}.listen-error{padding:6px 14px;color:#c34d4d;font-size:10px}.friend-request-inline{display:flex;gap:7px;padding:7px 12px}.friend-request-inline input{min-width:0;flex:1;border:1px solid var(--border-color,#ddd);border-radius:10px;background:transparent;color:inherit;padding:0 9px}.friend-request-inline button{height:34px;border:0;border-radius:10px;background:var(--sys-bg-tertiary,#eee);color:inherit;font-size:10px}.friend-request-status{padding:6px 14px;color:var(--text-tertiary,#999);font-size:9px;text-align:center}.friend-request-status.success{color:#3d8662}.listen-composer{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;padding:9px 12px;border-top:1px solid var(--border-color,#eee)}.listen-composer input{min-width:0;height:36px;padding:0 10px;border:1px solid var(--border-color,#ddd);border-radius:11px;background:var(--sys-bg-secondary,#f7f7f8);color:inherit;outline:0}.listen-composer button{border:0;border-radius:10px;background:var(--sys-bg-tertiary,#eee);color:inherit;font-size:10px;padding:0 10px}.listen-composer .api{background:#262629;color:#fff}.end-listen{height:38px;margin:0 12px 8px;border:0;border-radius:11px;background:transparent;color:#c24b4b}.listen-settings section{margin-bottom:15px;overflow:hidden;border:1px solid var(--border-color,#e7e7e9);border-radius:14px}.listen-settings h3{margin:0;padding:10px 12px;background:var(--sys-bg-secondary,#f7f7f8);color:var(--text-tertiary,#777);font-size:10px}.listen-settings label{display:flex;min-height:52px;align-items:center;gap:12px;padding:7px 12px;border-top:1px solid var(--border-color,#eee)}.listen-settings label>span{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px}.listen-settings label strong{font-size:12px}.listen-settings label small{color:var(--text-tertiary,#999);font-size:9px}.listen-settings select{max-width:145px;border:0;background:transparent;color:inherit;font-size:10px;text-align:right}.listen-settings input[type=checkbox]{width:18px;height:18px}.listen-records button{display:flex;width:100%;padding:12px 3px;border:0;border-bottom:1px solid var(--border-color,#eee);background:transparent;color:inherit;text-align:left}.listen-records button span{min-width:0}.listen-records small{display:block;margin-top:3px;color:var(--text-tertiary,#999);font-size:9px}.listen-records p{margin:7px 0 0;color:var(--text-secondary,#666);font-size:10px;line-height:1.5}.record-empty{padding:80px 20px;color:var(--text-tertiary,#999);font-size:11px;text-align:center}.listen-hub-fade-enter-active,.listen-hub-fade-leave-active{transition:.2s}.listen-hub-fade-enter-from,.listen-hub-fade-leave-to{opacity:0}.listen-hub-fade-enter-from .listen-hub,.listen-hub-fade-leave-to .listen-hub{transform:translateY(30px)}.listen-hub{transition:.2s}@keyframes listen-spin{to{transform:rotate(360deg)}}@media(max-width:360px){.listen-composer{grid-template-columns:minmax(0,1fr) auto}.listen-composer .api{grid-column:1/-1;height:34px}.listen-hub{height:94vh}}
.listen-wait-actions{display:flex;gap:8px}
.listen-record-detail{padding:15px}.record-detail-head{padding:13px;border-radius:14px;background:var(--sys-bg-secondary,#f7f7f8)}.record-detail-head small{display:block;margin-top:4px;color:var(--text-tertiary,#999);font-size:9px;line-height:1.5}.record-detail-head p{margin:9px 0 0;color:var(--text-secondary,#666);font-size:11px;line-height:1.6}.record-detail-messages{padding:15px 2px}
.listen-summary-action button,.record-detail-head button{height:31px;border:0;border-radius:9px;background:#252527;color:#fff;padding:0 12px;font-size:10px}.record-detail-head button{margin-top:10px}
.listen-track-picker-toggle{display:flex;width:100%;justify-content:space-between;margin:9px 0 0;padding:10px 12px;border:1px solid var(--border-color,#e6e6e8);border-radius:12px;background:transparent;color:inherit;font-size:11px}.listen-track-picker-toggle b{font-size:16px}.listen-track-picker-toggle.room{margin:0;border-width:0 0 1px;border-radius:0}.listen-track-picker{margin-top:8px;padding:10px;border:1px solid var(--border-color,#e7e7e9);border-radius:13px}.listen-track-picker.room{margin:0;border-width:0 0 1px;border-radius:0;max-height:245px;overflow:auto}.listen-track-picker form{display:flex;gap:6px;margin-bottom:8px}.listen-track-picker form input{min-width:0;height:35px;flex:1;padding:0 10px;border:1px solid var(--border-color,#ddd);border-radius:10px;background:var(--sys-bg-secondary,#f6f6f7);color:inherit}.listen-track-picker form button{padding:0 12px;border:0;border-radius:10px;background:#272729;color:#fff}.listen-track-picker>small{display:block;margin:3px 2px;color:var(--text-tertiary,#999);font-size:9px}.listen-track-picker>button{display:flex;width:100%;align-items:center;gap:8px;padding:8px 2px;border:0;border-bottom:1px solid var(--border-color,#eee);background:transparent;color:inherit;text-align:left}.listen-track-picker>button span{display:flex;min-width:0;flex:1;flex-direction:column}.listen-track-picker>button strong,.listen-track-picker>button small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.listen-track-picker>button small,.listen-track-picker>p{color:var(--text-tertiary,#999);font-size:9px}.listen-track-picker>button b{font-size:9px;font-weight:400}.listen-setting-text{max-width:145px;height:30px;padding:0 8px;border:1px solid var(--border-color,#ddd);border-radius:9px;background:transparent;color:inherit;text-align:right}
.listen-connection{display:flex;align-items:center;flex-direction:column;padding:10px 16px 13px;border-bottom:1px solid var(--border-color,#eee);background:linear-gradient(180deg,var(--sys-bg-secondary,#f7f7f8),transparent)}.listen-connection>p{margin:3px 0 0;color:var(--text-tertiary,#888);font-size:9px;text-align:center}.listen-avatar-pair{position:relative;width:136px;height:66px}.listen-paired-avatar{position:absolute;top:2px;left:9px;z-index:2;display:grid;width:62px;height:62px;place-items:center;border-radius:50%;background:linear-gradient(145deg,#e4e4e8,#c9c9d0) center/cover;color:#555;font-size:17px;box-shadow:0 3px 12px rgba(0,0,0,.12)}.listen-paired-avatar.partner{left:65px;z-index:1}.listen-paired-avatar.anonymous{background:linear-gradient(145deg,#8177a8,#4f526d);color:#fff}.listen-paired-avatar.pending{animation:listen-avatar-pulse 1.5s ease-in-out infinite}.listen-participant>span{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px}.listen-records button{align-items:center;gap:12px}.listen-record-avatars{position:relative;display:block;width:61px;min-width:61px!important;height:39px}.listen-record-avatars i{position:absolute;top:1px;display:grid;width:36px;height:36px;place-items:center;border-radius:50%;background:linear-gradient(145deg,#e4e4e8,#c9c9d0) center/cover;color:#555;font-size:10px;font-style:normal}.listen-record-avatars i:first-child{left:0;z-index:2}.listen-record-avatars i:last-child{left:31px}.listen-record-avatars i.anonymous{background:linear-gradient(145deg,#8177a8,#4f526d);color:#fff}.listen-record-copy{flex:1}.record-detail-pair{display:flex;justify-content:center;margin:0 0 4px}.record-detail-head{text-align:center}.record-detail-head>small,.record-detail-head>p{text-align:left}@keyframes listen-avatar-pulse{50%{transform:scale(.94);opacity:.72}}
</style>
