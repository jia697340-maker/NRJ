/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { requestForumJson } from './forumAI'
import { generateForumImage } from './forumMediaGeneration'
import { canAccountAppear } from './forumPolicy'
import { removeForumMedia } from './forumRepository'
import type {
  ForumAccount, ForumCircle, ForumComment, ForumContentBatch, ForumDistributionPlan, ForumGenerationConfig,
  ForumGenerationSession, ForumParticipantPolicy, ForumPost, ForumPostPlanSlot, ForumPostType, ForumSnapshot, ForumSubject, ForumContentKind
} from '../types/forum'

let generatedIdCounter = 0
const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${(generatedIdCounter++).toString(36)}`
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)))
const randomItem = <T>(values: T[], random: () => number) => values[Math.min(values.length - 1, Math.floor(random() * values.length))]
const shuffle = <T>(values: T[], random: () => number) => {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.min(index, Math.floor(random() * (index + 1)))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}
const unique = <T>(values: T[]) => [...new Set(values)]
const cloneSnapshot = (snapshot: ForumSnapshot) => JSON.parse(JSON.stringify(snapshot)) as ForumSnapshot

type TopicDomainDefinition = { id: string; label: string; keywords: string[]; scenes: string[]; focuses: string[] }
type ForumRefreshPlanningState = { usedTopicDomains: Set<string>; usedTopicSeeds: Set<string>; recentCircleIds: string[] }

// This is a broad combinatorial vocabulary, not a post template rotation. The planner chooses
// independent semantic bounds; the model still invents the concrete event and wording.
const publicTopicDomains: TopicDomainDefinition[] = [
  { id: 'meals', label: '吃饭与口味', keywords: ['吃饭','晚饭','早餐','外卖','餐厅','做饭','菜谱','食品','冷冻'], scenes: ['临时决定的一顿饭','一次外卖或堂食经历','厨房里发生的小插曲'], focuses: ['当时最在意的细节','一个很个人的口味判断','没有结论的随口记录'] },
  { id: 'weather', label: '天气与季节', keywords: ['天气','下雨','降温','高温','季节','台风'], scenes: ['出门时遇到的天气变化','一天里体感最明显的时刻','季节变化带来的小麻烦'], focuses: ['身体感受和现场细节','临时改变的安排','一句即时感想'] },
  { id: 'commute', label: '通勤与路上见闻', keywords: ['通勤','地铁','公交','开车','路上','交通'], scenes: ['上下班或上学路上','等车或换乘的时候','一段平常街道上的偶遇'], focuses: ['一个反常的小细节','当事人的即时反应','路过之后仍记得的画面'] },
  { id: 'shopping', label: '购物与物件', keywords: ['购物','买东西','快递','商品','便利店','网购'], scenes: ['刚买到或退掉一件东西','逛店时遇到的选择困难','收到快递后的第一反应'], focuses: ['使用感受而非测评','价格之外的小细节','一次踩雷或意外满意'] },
  { id: 'pets', label: '宠物与动物', keywords: ['宠物','猫','狗','动物','养宠'], scenes: ['宠物突然做的一件小事','路边遇到的一只动物','照顾动物时的日常麻烦'], focuses: ['一个具体动作','人与动物没对上频道','短暂又好笑的瞬间'] },
  { id: 'games', label: '游戏与娱乐', keywords: ['游戏','排位','主机','手游','桌游'], scenes: ['刚结束的一局游戏','和队友或朋友一起玩的片段','某个机制带来的情绪'], focuses: ['输赢之外的细节','一句带情绪的吐槽','想听听同好看法'] },
  { id: 'study', label: '学习与考试', keywords: ['学习','考试','复习','作业','课程','论文'], scenes: ['一次效率忽高忽低的学习','临近截止或考试的时刻','终于弄懂或仍没弄懂的问题'], focuses: ['实际卡住的地方','一个不一定有效的小办法','压力下的真实状态'] },
  { id: 'work', label: '工作与职场日常', keywords: ['工作','上班','同事','会议','加班','职场'], scenes: ['普通工作日里的插曲','一次沟通没对齐','快下班时突然发生的事'], focuses: ['具体处境而非职场大道理','克制的抱怨','微妙但难解释的感受'] },
  { id: 'relationships', label: '朋友与关系', keywords: ['朋友','关系','相处','吵架','社交'], scenes: ['和朋友的一次小摩擦','一段没及时回复的对话','相处中突然意识到的细节'], focuses: ['自己的犹豫','双方都未必有错的部分','想问但又有点不好意思的问题'] },
  { id: 'mood', label: '情绪与状态', keywords: ['情绪','心情','焦虑','开心','难过','压力'], scenes: ['说不上原因的情绪变化','忙完之后忽然安静的时刻','今天精神状态的一次波动'], focuses: ['不急着总结意义','身体和念头的具体反应','一句很短的自我记录'] },
  { id: 'home', label: '居家与家务', keywords: ['居家','家务','收纳','打扫','租房','家具'], scenes: ['收拾房间时翻出东西','一项拖了很久的家务','家里某个物件突然出问题'], focuses: ['琐碎过程','解决前后的差别','不值得写攻略的小经验'] },
  { id: 'health', label: '身体与生活习惯', keywords: ['身体','睡眠','耳朵','运动','健康','医院'], scenes: ['身体出现轻微不适的时候','调整作息或习惯的尝试','使用日常用品后的身体感受'], focuses: ['个人体验而非医学诊断','是否需要改变习惯的犹豫','想了解别人的普通经验'] },
  { id: 'technology', label: '数码与软件', keywords: ['数码','手机','电脑','软件','耳机','网络'], scenes: ['设备或软件突然不顺手','换了一个常用设置','使用某项功能时遇到怪问题'], focuses: ['真实使用场景','一个影响心情的小问题','不写成产品发布稿'] },
  { id: 'hobbies', label: '兴趣与手作', keywords: ['兴趣','手作','画画','乐器','模型','收藏'], scenes: ['练习兴趣时的一次小进展','做坏或做完一个小作品','重新捡起搁置的爱好'], focuses: ['过程里的具体动作','水平普通也可以分享','一个只对自己有意义的瞬间'] },
  { id: 'photo', label: '摄影与观察', keywords: ['摄影','照片','相机','曝光','镜头'], scenes: ['随手拍下一处光线','整理旧照片的时候','拍摄中遇到的技术或取舍'], focuses: ['画面里的具体细节','失败照片也值得说的地方','向同好请教一个明确问题'] },
  { id: 'media', label: '影视音乐与阅读', keywords: ['电影','电视剧','音乐','小说','阅读','演出'], scenes: ['刚看完或听完一段内容','重温旧作品时发现变化','某个片段突然留在脑子里'], focuses: ['个人反应而非完整影评','一个小到容易忽略的细节','允许只说半句话的感想'] },
  { id: 'neighborhood', label: '社区与城市小事', keywords: ['小区','社区','城市','邻居','街道','公园'], scenes: ['住处附近发生的小变化','公共空间里的一次偶遇','熟悉街角出现的新东西'], focuses: ['现场观察','人与人短暂交会','不夸大成社会议题'] },
  { id: 'oddities', label: '偶发怪事与碎碎念', keywords: ['怪事','奇怪','巧合','碎碎念','突然想到'], scenes: ['今天碰到的一个巧合','一个没头没尾的奇怪瞬间','突然冒出来的无用念头'], focuses: ['保持事情本身的小尺度','允许没有答案','用当事人的自然语气讲述'] }
]

const intentsForKind: Record<ForumContentKind, string[]> = {
  thought: ['随手记下当时的念头','只分享一个短暂感受'], life: ['讲一件今天发生的小事','记录一个普通生活片段'], 'image-share': ['围绕一张现场照片分享','用画面带出一件具体小事'],
  question: ['提出一个边界明确的问题','询问别人是否有类似经历'], help: ['说明具体困境并求实际建议','请人帮忙判断下一步'], complaint: ['吐槽一个具体的不顺','带着情绪讲清发生了什么'],
  experience: ['复盘一次亲身经历','分享刚试过的做法和结果'], discussion: ['抛出一个可有不同看法的问题','从具体经历引出讨论'], link: ['分享刚看到的内容并说自己的关注点','围绕链接中的一个细节交流'],
  poll: ['给出真实选择困境让大家投票','用几个自然选项收集偏好'], anonymous: ['匿名说一件不便署名的具体事','匿名询问一段真实顾虑'], 'circle-topic': ['在圈子范围内发起具体交流','和同好聊一个范围明确的小问题']
}

export const defaultForumGenerationConfig = (): ForumGenerationConfig => ({
  postCount: 3, requiredCharacterAccountIds: [], refreshMode: 'incremental', replaceScope: 'latest-batch', replacePostIds: [], postTypeMode: 'natural',
  allowedContentKinds: ['thought', 'life', 'image-share', 'question', 'help', 'complaint', 'experience', 'discussion', 'link', 'poll', 'anonymous', 'circle-topic'],
  ensureEverySelectedKind: true, commentMode: 'natural', commentsPerPost: 3, totalComments: 12, strangerRepeatMode: 'avoid', npcGenerationMode: 'lightweight', discoverCircles: true, includeInitialComments: true,
  anonymousUnavailable: 'create-circle', circleTopicUnavailable: 'create-circle', imageUnavailable: 'ai'
})

export const normalizeForumGenerationConfig = (input: ForumGenerationConfig): ForumGenerationConfig => {
  const defaults = defaultForumGenerationConfig()
  const postCount = Math.max(1, Math.round(Number(input?.postCount || defaults.postCount)))
  const allowed = unique((input?.allowedContentKinds || defaults.allowedContentKinds).filter(kind => postKinds.includes(kind)))
  return {
    ...defaults, ...input, postCount,
    requiredCharacterAccountIds: unique(input?.requiredCharacterAccountIds || []).slice(0, postCount),
    replacePostIds: unique(input?.replacePostIds || []),
    allowedContentKinds: allowed.length ? allowed : [...defaults.allowedContentKinds],
    commentsPerPost: Math.max(0, Math.round(Number(input?.commentsPerPost ?? defaults.commentsPerPost))),
    totalComments: Math.max(0, Math.round(Number(input?.totalComments ?? defaults.totalComments)))
  }
}

const lightweightPolicy = (subjectId: string): ForumParticipantPolicy => ({
  id: makeId('participant'), subjectId, enabled: true, allowedCircleIds: [], blockedCircleIds: [], allowedAccountIds: [], allowedGroupIds: [],
  scope: ['global', 'circle', 'passive', 'post'], allowPublicDiscovery: true, allowNpcKnowledge: false, allowMention: true, allowSearch: true,
  allowRecommendation: true, allowDm: true, allowGroup: false, autonomy: { level: 'off', actions: {} }, updatedAt: Date.now()
})

const uniqueHandle = (snapshot: ForumSnapshot, value: string) => {
  const base = String(value || '').trim().replace(/^@/, '').replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 28) || `nrj_${Date.now().toString(36)}`
  let result = base; let index = 1
  while (snapshot.accounts.some(item => item.handle.toLowerCase() === result.toLowerCase())) result = `${base.slice(0, 23)}_${index++}`
  return result
}

type AuthorDraft = { name: string; handle: string; avatar?: string; bio?: string; gender?: 'male' | 'female' | 'other' | 'unknown'; expressionStyle?: string; backgroundHints?: string[]; interests?: string[]; identity?: string; personality?: string; occupation?: string; boundaries?: string[]; postingStyle?: string; commentingStyle?: string; dmStyle?: string; emojiStyle?: string; punctuationStyle?: string; activeHours?: string[] }

const assignLibraryAvatar = (snapshot: ForumSnapshot, account: ForumAccount, gender: AuthorDraft['gender']) => {
  if (!snapshot.settings.avatarLibraryEnabled || !snapshot.avatarLibrary.length) return
  const preferredGroup = gender === 'male' || gender === 'female' ? gender : 'other'
  const ordered = [...snapshot.avatarLibrary.filter(item => item.group === preferredGroup), ...snapshot.avatarLibrary.filter(item => item.group !== preferredGroup)]
  const unused = ordered.find(item => !item.assignedAccountIds.length)
  const allowReuse = snapshot.settings.allowAvatarReuse && Math.random() < snapshot.settings.avatarReuseProbability
  const selected = unused || (allowReuse ? ordered[Math.floor(Math.random() * ordered.length)] : undefined)
  if (!selected) return
  selected.assignedAccountIds = unique([...selected.assignedAccountIds, account.id])
  account.avatar = selected.url
  account.avatarLibraryItemId = selected.id
}

export const createLightweightForumAuthors = async (snapshot: ForumSnapshot, viewerAccountId: string, count: number, batchId: string) => {
  if (!count) return []
  const generated = await requestForumJson<{ authors: AuthorDraft[] }>(snapshot, { userInitiated: true, viewerAccountId, involvedAccountIds: [] }, 'forum-population',
    `为一批开放论坛内容创建 ${count} 位彼此不同的轻量陌生作者。只需昵称、账号、头像文字或颜色描述、公开简介、表达习惯、少量背景提示和兴趣。不要创建作息、关系、长期记忆或复杂人格。昵称像普通网友，不使用机器人、观察员、记录者、小编等概念账号。必须尽量返回足量作者。`,
    '{"authors":[{"name":"昵称","handle":"账号","avatar":"头像描述或单字","bio":"简短简介","expressionStyle":"表达习惯","backgroundHints":["必要背景"],"interests":["兴趣"]}]}')
  const drafts = Array.isArray(generated.authors) ? generated.authors : []
  const result: ForumAccount[] = []
  for (let index = 0; index < count; index += 1) {
    const raw = drafts[index] || { name: `路过的人${index + 1}`, handle: `passing_${Date.now().toString(36)}_${index + 1}`, bio: '偶尔上来看看。', expressionStyle: '自然简短' }
    const name = String(raw.name || `路过的人${index + 1}`).trim().slice(0, 20)
    const subject: ForumSubject = { id: makeId('subject_light'), kind: 'npc', displayName: name, persona: String(raw.expressionStyle || raw.bio || '自然表达').slice(0, 240), createdAt: Date.now(), updatedAt: Date.now() }
    const account: ForumAccount = {
      id: makeId('forum_account'), subjectId: subject.id, kind: 'main', name, handle: uniqueHandle(snapshot, raw.handle), avatar: String(raw.avatar || name.slice(0, 1)), bio: String(raw.bio || '').slice(0, 160),
      privacy: 'normal', searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all', showInRecommendations: true, showOnline: false, showCircles: true,
      joinedAt: Date.now() - (7 + index * 3) * 86400000, circleIds: [], lifecycle: 'lightweight', expressionStyle: String(raw.expressionStyle || '').slice(0, 240), lockedFields: [], gender: raw.gender || 'unknown',
      backgroundHints: (raw.backgroundHints || []).map(String).slice(0, 4), firstSeenBatchId: batchId, lastSeenAt: Date.now()
    }
    assignLibraryAvatar(snapshot, account, raw.gender)
    snapshot.subjects.push(subject); snapshot.accounts.push(account); snapshot.participantPolicies.push(lightweightPolicy(subject.id)); result.push(account)
  }
  return result
}

type CircleDraft = { name: string; avatar?: string; description: string; contentScope: string; tags?: string[]; memberCount?: number }

export const postKinds: ForumContentKind[] = ['thought', 'life', 'image-share', 'question', 'help', 'complaint', 'experience', 'discussion', 'link', 'poll', 'anonymous', 'circle-topic']
const typeForKind = (kind: ForumPostPlanSlot['contentKind']): ForumPostType => kind === 'poll' ? 'poll' : kind === 'anonymous' ? 'anonymous' : kind === 'image-share' ? 'single-image' : kind === 'discussion' || kind === 'experience' ? 'long-article' : kind === 'question' || kind === 'help' ? 'qa' : kind === 'link' ? 'link' : 'text'
const circleSupportsKind = (circle: ForumCircle | undefined, kind: ForumContentKind, generatedCircleIds: string[] = []) => {
  if (!circle) return false
  if (generatedCircleIds.includes(circle.id)) return true
  const type = typeForKind(kind)
  if (kind === 'anonymous') return circle.anonymousMode !== 'disabled' && circle.contentPermissions.includes('anonymous')
  if (kind === 'poll') return circle.allowPoll && circle.contentPermissions.includes('poll')
  return kind === 'circle-topic' ? circle.contentPermissions.includes('text') : circle.contentPermissions.includes(type)
}

export const shouldDiscoverForumCircle = (snapshot: ForumSnapshot, config: ForumGenerationConfig, random: () => number = Math.random) => {
  if (!config.discoverCircles || config.profileAccountId) return false
  const misses = Math.max(0, Math.floor(Number(snapshot.settings.circleDiscoveryMisses || 0)))
  if (misses >= 1) return true
  const probability = Math.min(.68, .22 + Math.min(20, config.postCount) * .025)
  return random() < probability
}

export const distributeForumComments = (kinds: ForumContentKind[], config: Pick<ForumGenerationConfig, 'commentMode' | 'commentsPerPost' | 'totalComments' | 'includeInitialComments'>, random: () => number = Math.random) => {
  const postCount = kinds.length
  if (!config.includeInitialComments) return Array(postCount).fill(0)
  if (config.commentMode === 'per-post') return Array(postCount).fill(Math.max(0, Math.round(config.commentsPerPost)))
  const weights = kinds.map(kind => {
    const discussionWeight = ['question', 'help', 'discussion', 'complaint', 'poll'].includes(kind) ? 2.2 : ['experience', 'circle-topic', 'link'].includes(kind) ? 1.45 : .9
    const coldChance = kind === 'thought' || kind === 'life' || kind === 'image-share' ? .38 : .12
    return random() < coldChance ? 0 : Math.max(.08, discussionWeight * (.35 + random() * 1.65))
  })
  const target = config.commentMode === 'total'
    ? Math.max(0, Math.round(config.totalComments))
    : Math.max(0, Math.round(postCount * (.65 + random() * 2.35)))
  if (!target || !postCount) return Array(postCount).fill(0)
  if (!weights.some(Boolean)) weights[Math.floor(random() * postCount)] = 1
  const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1
  const exact = weights.map(value => value / weightTotal * target)
  const result = exact.map(Math.floor)
  let remaining = target - result.reduce((sum, value) => sum + value, 0)
  shuffle(exact.map((value, index) => ({ index, fraction: value - result[index] })), random).sort((a, b) => b.fraction - a.fraction).forEach(item => { if (remaining > 0) { result[item.index] += 1; remaining -= 1 } })
  const discussionIndexes = kinds.map((kind, index) => ['question', 'help', 'discussion', 'complaint', 'poll'].includes(kind) ? index : -1).filter(index => index >= 0)
  const ordinaryIndexes = kinds.map((kind, index) => discussionIndexes.includes(index) ? -1 : index).filter(index => index >= 0)
  if (discussionIndexes.length && ordinaryIndexes.length && target >= 2) {
    const hot = discussionIndexes.sort((a, b) => weights[b] - weights[a])[0]
    const ordinary = ordinaryIndexes.sort((a, b) => result[b] - result[a])[0]
    while (result[hot] <= result[ordinary] && result[ordinary] > 0) { result[hot] += 1; result[ordinary] -= 1 }
  }
  if (postCount >= 2 && target >= 2 && new Set(result).size === 1) { const high = weights.indexOf(Math.max(...weights)); const low = weights.indexOf(Math.min(...weights)); if (high !== low && result[low] > 0) { result[high] += 1; result[low] -= 1 } }
  return result
}

const inferCirclePublicDomain = (circle?: ForumCircle) => {
  if (!circle) return undefined
  const text = `${circle.name} ${circle.description} ${circle.contentScope} ${(circle.tags || []).join(' ')}`.toLowerCase()
  return publicTopicDomains.find(domain => domain.keywords.some(keyword => text.includes(keyword)))?.id
}

const buildTopicSeed = (domain: TopicDomainDefinition, kind: ForumContentKind, random: () => number, usedSeeds: Set<string>) => {
  const attempts = domain.scenes.length * domain.focuses.length * 2
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const seed = `${randomItem(domain.scenes, random)}；聚焦${randomItem(domain.focuses, random)}；${randomItem(intentsForKind[kind], random)}`
    if (!usedSeeds.has(seed)) return seed
  }
  return `${randomItem(domain.scenes, random)}；${randomItem(intentsForKind[kind], random)}；细节变体 ${usedSeeds.size + 1}`
}

const validateTopicSlots = (slots: ForumPostPlanSlot[]) => {
  const errors: string[] = []
  const domains = slots.map(slot => slot.topicDomain).filter(Boolean) as string[]
  const seeds = slots.map(slot => slot.topicSeed).filter(Boolean) as string[]
  if (domains.length !== slots.length || seeds.length !== slots.length) errors.push('存在未规划主题的帖子槽位')
  if (slots.length >= 4 && new Set(domains).size < Math.min(3, slots.length)) errors.push('主题领域数量不足')
  const counts = new Map<string, number>()
  domains.forEach(domain => counts.set(domain, (counts.get(domain) || 0) + 1))
  const maxAllowed = Math.max(2, Math.ceil(slots.length * .4))
  if ([...counts.values()].some(count => count > maxAllowed)) errors.push('单一主题领域异常集中')
  if (new Set(seeds).size !== seeds.length) errors.push('主题种子重复')
  if (slots.some(slot => !slot.circleId && slot.topicDomain?.startsWith('circle:'))) errors.push('公共帖继承了圈子主题')
  return errors
}

export const validateForumTopicPlan = (plan: Pick<ForumDistributionPlan, 'slots'>) => validateTopicSlots(plan.slots)

export const createForumDistributionPlan = (snapshot: ForumSnapshot, sessionId: string, batchId: string, config: ForumGenerationConfig, authorIds: string[], generatedCircleIds: string[], random: () => number = Math.random, refreshState?: ForumRefreshPlanningState): ForumDistributionPlan => {
  const allowedKinds = (config.postTypeMode === 'custom' ? config.allowedContentKinds : postKinds).filter(kind => {
    if (!['anonymous', 'circle-topic'].includes(kind) || generatedCircleIds.length) return true
    return snapshot.circles.some(circle => circle.isPublic && circleSupportsKind(circle, kind))
  })
  if (!allowedKinds.length) throw new Error('当前圈子权限下没有可生成的帖子类型。')
  const kindDeck: ForumContentKind[] = []
  while (kindDeck.length < config.postCount) kindDeck.push(...shuffle(allowedKinds, random))
  const kinds = Array.from({ length: config.postCount }, (_, index) => config.postTypeMode === 'custom' && config.ensureEverySelectedKind && index < allowedKinds.length ? allowedKinds[index] : kindDeck[index])
  const comments = distributeForumComments(kinds, config, random)
  const availableCircles = unique([...snapshot.circles.filter(circle => circle.isPublic).map(circle => circle.id), ...generatedCircleIds])
  const oldCircleIds = availableCircles.filter(id => !generatedCircleIds.includes(id))
  const maximumCirclePosts = generatedCircleIds.length ? config.postCount : Math.max(0, config.postCount - 1)
  const circlePostCount = availableCircles.length ? Math.min(maximumCirclePosts, Math.max(generatedCircleIds.length, Math.floor(config.postCount * .3))) : 0
  const circleAssignments = [...shuffle(generatedCircleIds, random)]
  if (circleAssignments.length < circlePostCount && generatedCircleIds.length && oldCircleIds.length) circleAssignments.push(randomItem(shuffle(oldCircleIds, random), random))
  const recentlyUsed = new Set(refreshState?.recentCircleIds.slice(-Math.max(1, availableCircles.length - 1)) || [])
  while (circleAssignments.length < circlePostCount) {
    const preferred = availableCircles.filter(id => !recentlyUsed.has(id) && !circleAssignments.slice(-availableCircles.length).includes(id))
    const deck = shuffle(preferred.length ? preferred : availableCircles.filter(id => !circleAssignments.slice(-availableCircles.length).includes(id)), random)
    circleAssignments.push(...(deck.length ? deck : shuffle(availableCircles, random)).slice(0, circlePostCount - circleAssignments.length))
  }
  const requiredCircleIndexes = kinds.map((kind, index) => ({ kind, index })).filter(item => item.kind === 'anonymous' || item.kind === 'circle-topic').map(item => item.index)
  const optionalCircleIndexes = shuffle(Array.from({ length: config.postCount }, (_, index) => index).filter(index => !requiredCircleIndexes.includes(index)), random)
  const circleIndexes = new Set([...requiredCircleIndexes, ...optionalCircleIndexes.slice(0, Math.max(0, circlePostCount - requiredCircleIndexes.length))])
  let circleCursor = 0
  const endAt = Date.now(); const startAt = endAt - (config.postCount <= 3 ? 8 : 36) * 3600000
  const requiredIds = config.requiredCharacterAccountIds.filter(id => authorIds.includes(id))
  const strangerIds = authorIds.filter(id => !requiredIds.includes(id))
  const authorDeck: string[] = []
  const authorPool = strangerIds.length ? strangerIds : requiredIds
  while (authorDeck.length < Math.max(0, config.postCount - requiredIds.length)) authorDeck.push(...shuffle(authorPool, random))
  const assignedAuthors = [
    ...requiredIds,
    ...authorDeck.slice(0, Math.max(0, config.postCount - requiredIds.length))
  ]
  const usedDomains = new Set(refreshState?.usedTopicDomains || [])
  const usedSeeds = new Set(refreshState?.usedTopicSeeds || [])
  const publicDeck = shuffle(publicTopicDomains.filter(domain => !usedDomains.has(`public:${domain.id}`)), random)
  const fallbackDeck = shuffle(publicTopicDomains, random)
  let publicCursor = 0
  const generatedCircleDomain = new Map<string, TopicDomainDefinition>()
  const slots: ForumPostPlanSlot[] = Array.from({ length: config.postCount }, (_, index) => {
    let kind = kinds[index]
    const createdAt = Math.round(startAt + ((index + .35 + random() * .3) / config.postCount) * Math.max(60000, endAt - startAt))
    let circleId = circleIndexes.has(index) ? circleAssignments[circleCursor++] : undefined
    const compatibleCircleIds = availableCircles.filter(id => generatedCircleIds.includes(id) || circleSupportsKind(snapshot.circles.find(circle => circle.id === id), kind, generatedCircleIds))
    if (circleId && !compatibleCircleIds.includes(circleId)) circleId = compatibleCircleIds.length ? randomItem(compatibleCircleIds, random) : undefined
    if ((kind === 'anonymous' || kind === 'circle-topic') && !circleId && compatibleCircleIds.length) circleId = randomItem(compatibleCircleIds, random)
    if ((kind === 'anonymous' || kind === 'circle-topic') && !circleId) throw new Error(`无法为已选择的 ${kind} 类型找到符合权限的圈子，未生成任何降级帖子。`)
    const commentTarget = comments[index]
    const heat: ForumPostPlanSlot['heat'] = commentTarget === 0 ? 'quiet' : commentTarget >= 4 ? 'hot' : 'normal'
    let domain: TopicDomainDefinition
    let topicDomain: string
    if (circleId) {
      const circle = snapshot.circles.find(item => item.id === circleId)
      domain = circle && !generatedCircleIds.includes(circleId)
        ? publicTopicDomains.find(item => item.id === inferCirclePublicDomain(circle)) || { id: 'circle-local', label: circle.name, keywords: [], scenes: [`${circle.contentScope || circle.description}范围内的一件具体小事`], focuses: ['只使用本帖所属圈子的范围'] }
        : generatedCircleDomain.get(circleId) || randomItem(publicTopicDomains.filter(item => !usedDomains.has(`public:${item.id}`)).length ? publicTopicDomains.filter(item => !usedDomains.has(`public:${item.id}`)) : publicTopicDomains, random)
      if (generatedCircleIds.includes(circleId)) generatedCircleDomain.set(circleId, domain)
      topicDomain = `circle:${circleId}:${domain.id}`
    } else {
      domain = publicDeck[publicCursor] || fallbackDeck[publicCursor % Math.max(1, fallbackDeck.length)] || publicTopicDomains[publicCursor % publicTopicDomains.length]
      publicCursor += 1
      topicDomain = `public:${domain.id}`
    }
    const topicSeed = buildTopicSeed(domain, kind, random, usedSeeds)
    usedSeeds.add(topicSeed); usedDomains.add(topicDomain)
    return { id: makeId('post_slot'), authorAccountId: assignedAuthors[index], circleId, postType: typeForKind(kind), createdAt, commentTarget, heat, contentKind: kind, topicDomain, topicSeed, topicIntent: randomItem(intentsForKind[kind], random) }
  }).sort((a, b) => b.createdAt - a.createdAt)
  const topicErrors = validateTopicSlots(slots)
  if (topicErrors.length) throw new Error(`论坛首页主题规划失败：${topicErrors.join('；')}`)
  if (refreshState) {
    slots.forEach(slot => { if (slot.topicDomain) refreshState.usedTopicDomains.add(slot.topicDomain); if (slot.topicSeed) refreshState.usedTopicSeeds.add(slot.topicSeed) })
    refreshState.recentCircleIds.push(...circleAssignments)
  }
  return { id: makeId('distribution'), sessionId, batchId, slots, plannedAuthorIds: unique(slots.map(item => item.authorAccountId)), plannedCircleIds: unique(slots.map(item => item.circleId).filter(Boolean) as string[]), plannedCommentCount: comments.reduce((sum, value) => sum + value, 0), createdAt: Date.now() }
}

type BatchAuthorDraft = AuthorDraft & { authorKey: string }
type BatchCircleDraft = CircleDraft & { circleKey: string }
type BatchCommentDraft = { commentKey: string; content: string }
type BatchPostDraft = { postKey: string; contentKind?: ForumContentKind; topicDomain?: string; topicSeed?: string; title?: string; content: string; topics?: string[]; pollOptions?: string[]; imagePrompt?: string; linkUrl?: string; linkTitle?: string; linkDescription?: string; comments?: BatchCommentDraft[] }
type ForumBatchDraft = { authors?: BatchAuthorDraft[]; circles?: BatchCircleDraft[]; posts?: BatchPostDraft[] }
type AuthorRef = { key: string; account?: ForumAccount }
type CircleRef = { key: string; circle?: ForumCircle }
type CommentSpec = { commentKey: string; authorKey: string; parentCommentKey?: string; createdAt: number }
type ForumGenerationDependencies = { requestJson?: typeof requestForumJson; generateImage?: typeof generateForumImage }

const materializeAuthors = (snapshot: ForumSnapshot, refs: AuthorRef[], drafts: BatchAuthorDraft[], batchId: string, mode: ForumGenerationConfig['npcGenerationMode']) => {
  const accounts = new Map<string, ForumAccount>()
  refs.forEach((ref, index) => {
    if (ref.account) { accounts.set(ref.key, ref.account); return }
    const raw = drafts.find(item => item.authorKey === ref.key)
    if (!raw?.name?.trim() || !raw.handle?.trim()) throw new Error(`模型没有完整返回轻量作者 ${ref.key}。`)
    const name = String(raw.name).trim().slice(0, 20)
    const subject: ForumSubject = { id: makeId('subject_light'), kind: 'npc', displayName: name, persona: String(raw.expressionStyle || raw.bio || '自然表达').slice(0, 240), createdAt: Date.now(), updatedAt: Date.now() }
    const account: ForumAccount = {
      id: makeId('forum_account'), subjectId: subject.id, kind: 'main', name, handle: uniqueHandle(snapshot, raw.handle), avatar: String(raw.avatar || name.slice(0, 1)), bio: String(raw.bio || '').slice(0, 160),
      privacy: 'normal', searchable: true, acceptsFollow: true, followRequiresApproval: false, acceptsDm: 'all', showInRecommendations: true, showOnline: false, showCircles: true,
      joinedAt: Date.now() - (7 + index * 3) * 86400000, circleIds: [], lifecycle: mode === 'full' ? 'persistent' : 'lightweight', expressionStyle: String(raw.expressionStyle || '').slice(0, 240), backgroundHints: (raw.backgroundHints || []).map(String).slice(0, mode === 'full' ? 8 : 4), firstSeenBatchId: batchId, lastSeenAt: Date.now(), lockedFields: [], gender: raw.gender || 'unknown'
    }
    assignLibraryAvatar(snapshot, account, raw.gender)
    snapshot.subjects.push(subject); snapshot.accounts.push(account); snapshot.participantPolicies.push(lightweightPolicy(subject.id)); accounts.set(ref.key, account)
    if (mode === 'full') {
      const personaId = makeId('forum_persona'); account.personaId = personaId
      snapshot.personas.push({ id: personaId, accountId: account.id, identity: String(raw.identity || raw.bio || '').slice(0, 500), personality: String(raw.personality || raw.expressionStyle || '').slice(0, 500), occupation: String(raw.occupation || '').slice(0, 120), interests: (raw.interests || []).map(String).slice(0, 12), boundaries: (raw.boundaries || []).map(String).slice(0, 10), postingStyle: String(raw.postingStyle || raw.expressionStyle || '').slice(0, 300), commentingStyle: String(raw.commentingStyle || raw.expressionStyle || '').slice(0, 300), dmStyle: String(raw.dmStyle || raw.expressionStyle || '').slice(0, 300), emojiStyle: String(raw.emojiStyle || '').slice(0, 120), punctuationStyle: String(raw.punctuationStyle || '').slice(0, 120), socialInitiative: 45, activeHours: (raw.activeHours || []).map(String).slice(0, 6), habits: {}, lockedFields: [] })
    }
  })
  return accounts
}

const materializeCircles = (snapshot: ForumSnapshot, refs: CircleRef[], drafts: BatchCircleDraft[], batchId: string) => {
  const circles = new Map<string, ForumCircle>()
  refs.forEach(ref => {
    if (ref.circle) { circles.set(ref.key, ref.circle); return }
    const raw = drafts.find(item => item.circleKey === ref.key)
    if (!raw?.name?.trim() || !raw.description?.trim() || !raw.contentScope?.trim()) throw new Error(`模型没有完整返回圈子 ${ref.key}。`)
    const circle: ForumCircle = {
      id: makeId('circle'), name: String(raw.name).trim().slice(0, 24), avatar: String(raw.avatar || raw.name.slice(0, 1)), description: String(raw.description).trim().slice(0, 180), contentScope: String(raw.contentScope).trim().slice(0, 500), rules: [], tags: (raw.tags || []).map(String).slice(0, 6),
      creatorAccountId: `generated:${batchId}`, administratorAccountIds: [], memberCount: clamp(raw.memberCount || 500, 12, 999999), activityScore: 50, searchable: true, isPublic: true, joinMode: 'public', contentPermissions: ['text', 'single-image', 'multi-image', 'long-article', 'link', 'poll', 'qa', 'anonymous'], anonymousMode: 'per-post', adminCanResolveAnonymous: false, allowPoll: true, allowLottery: false, mediaPermissions: ['image'], participantSubjectIds: [], aiPopulation: 0, aiActivity: 'off', createdAt: Date.now(), source: 'generated', generationBatchId: batchId
    }
    snapshot.circles.push(circle); circles.set(ref.key, circle)
  })
  return circles
}

const canUseAuthorInCircle = (snapshot: ForumSnapshot, author: AuthorRef, circle?: CircleRef) => {
  if (!author.account || !circle) return true
  if (circle.circle) return canAccountAppear(snapshot, author.account, circle.circle)
  const policy = snapshot.participantPolicies.find(item => item.subjectId === author.account?.subjectId)
  return Boolean(policy?.enabled && !policy.allowedCircleIds.length)
}

export const planForumComments = (snapshot: ForumSnapshot, plan: ForumDistributionPlan, authors: AuthorRef[], circles: CircleRef[], random: () => number = Math.random) => new Map(plan.slots.map(slot => {
  const roots: CommentSpec[] = []
  const circle = circles.find(item => item.key === slot.circleId)
  const eligibleKeys = authors.filter(author => canUseAuthorInCircle(snapshot, author, circle)).map(author => author.key)
  const pool = eligibleKeys.filter(key => key !== slot.authorAccountId)
  const specs = Array.from({ length: slot.commentTarget }, (_, index) => {
    const parent = roots.length && random() < Math.min(.62, .18 + roots.length * .09) ? randomItem(roots, random) : undefined
    const candidates = pool.length ? pool : eligibleKeys
    const authorKey = parent && random() < .12 ? slot.authorAccountId : randomItem(candidates, random)
    const baseInterval = Math.max(45_000, (Date.now() - Number(slot.createdAt)) / Math.max(2, slot.commentTarget + 1))
    const createdAt = Math.round(Math.min(Date.now(), Number(slot.createdAt) + (index + .35 + random() * .9) * baseInterval))
    const spec: CommentSpec = { commentKey: `comment_${slot.id}_${index + 1}`, authorKey, parentCommentKey: parent?.commentKey, createdAt }
    if (!parent) roots.push(spec)
    return spec
  })
  return [slot.id, specs]
}))

const generateSingleForumContentBatch = async (snapshot: ForumSnapshot, viewerAccountId: string, rawConfig: ForumGenerationConfig, onProgress?: (value: number) => void, dependencies: ForumGenerationDependencies = {}, refreshState?: ForumRefreshPlanningState, circleCreation: 'force' | 'disable' = 'disable') => {
  const normalized = normalizeForumGenerationConfig(rawConfig)
  let allowedContentKinds = [...normalized.allowedContentKinds]
  const publicCircles = snapshot.circles.filter(circle => circle.isPublic)
  const needsAnonymousCircle = normalized.postTypeMode === 'custom' && allowedContentKinds.includes('anonymous') && !publicCircles.some(circle => circleSupportsKind(circle, 'anonymous'))
  const needsTopicCircle = normalized.postTypeMode === 'custom' && allowedContentKinds.includes('circle-topic') && !publicCircles.some(circle => circleSupportsKind(circle, 'circle-topic'))
  if (needsAnonymousCircle && normalized.anonymousUnavailable === 'skip') allowedContentKinds = allowedContentKinds.filter(kind => kind !== 'anonymous')
  if (needsTopicCircle && normalized.circleTopicUnavailable === 'skip') allowedContentKinds = allowedContentKinds.filter(kind => kind !== 'circle-topic')
  if ((needsAnonymousCircle && normalized.anonymousUnavailable === 'existing-circle') || (needsTopicCircle && normalized.circleTopicUnavailable === 'existing-circle')) throw new Error('所选帖子类型需要圈子；请先选择/创建圈子，或改为跳过该类型。')
  const needsCreatedCircle = needsAnonymousCircle && normalized.anonymousUnavailable === 'create-circle' || needsTopicCircle && normalized.circleTopicUnavailable === 'create-circle'
  if (normalized.postTypeMode === 'custom' && allowedContentKinds.includes('image-share') && snapshot.settings.autoImageProvider === 'off') {
    if (normalized.imageUnavailable === 'skip') allowedContentKinds = allowedContentKinds.filter(kind => kind !== 'image-share')
    if (normalized.imageUnavailable === 'ai') throw new Error('图片分享选择了 AI 生图，但论坛自动配图当前已关闭。')
  }
  if (!allowedContentKinds.length) throw new Error('当前不可用类型处理后没有剩余帖子类型。')
  const config: ForumGenerationConfig = { ...normalized, allowedContentKinds, discoverCircles: normalized.discoverCircles || needsCreatedCircle }
  const sessionId = makeId('generation'); const batchId = makeId('content_batch')
  const session: ForumGenerationSession = { id: sessionId, status: 'planning', config, batchId, progress: 0, createdAt: Date.now() }
  const generatedImageStorageKeys: string[] = []
  snapshot.generationSessions.unshift(session)
  try {
    const draft = cloneSnapshot(snapshot); const draftSession = draft.generationSessions.find(item => item.id === sessionId)!
    const discoverCircleCount = circleCreation === 'force' || needsCreatedCircle ? 1 : 0
    const requiredIds = config.profileAccountId ? unique([config.profileAccountId, ...config.requiredCharacterAccountIds]) : config.requiredCharacterAccountIds
    const required = requiredIds.map(id => draft.accounts.find(item => item.id === id)).filter((item): item is ForumAccount => Boolean(item))
    const allowedRequired = required.filter(account => !account.isArchived && draft.participantPolicies.some(policy => policy.subjectId === account.subjectId && policy.enabled))
    if (allowedRequired.length !== required.length) throw new Error('所选角色中有未启用或已不可用的论坛参与者。')
    const recentAuthorIds = new Set(draft.posts.slice(0, 30).map(item => item.authorAccountId))
    const reusable = draft.accounts.filter(account => account.lifecycle === 'lightweight' && !account.isArchived && canAccountAppear(draft, account) && account.id !== viewerAccountId && (config.strangerRepeatMode === 'allow' || config.strangerRepeatMode === 'natural' && !recentAuthorIds.has(account.id)))
    const reuseCount = config.profileAccountId || config.strangerRepeatMode === 'avoid' ? 0 : Math.min(reusable.length, Math.max(1, Math.floor(config.postCount * (config.strangerRepeatMode === 'allow' ? .6 : .25))))
    const reused = reusable.slice(0, reuseCount)
    const desiredStrangers = config.profileAccountId ? 0 : Math.min(20, Math.max(0, config.postCount + 2 - allowedRequired.length - reused.length))
    const authorRefs: AuthorRef[] = [...allowedRequired.map((account, index) => ({ key: `character_${index + 1}`, account })), ...reused.map((account, index) => ({ key: `resident_${index + 1}`, account })), ...Array.from({ length: desiredStrangers }, (_, index) => ({ key: `stranger_${index + 1}` }))]
    const existingCircleRefs: CircleRef[] = draft.circles.filter(circle => circle.isPublic).map((circle, index) => ({ key: `circle_existing_${index + 1}`, circle }))
    const generatedCircleRefs: CircleRef[] = Array.from({ length: discoverCircleCount }, (_, index) => ({ key: `circle_new_${index + 1}` }))
    const circleRefs = [...generatedCircleRefs, ...existingCircleRefs]
    if (!authorRefs.length) throw new Error('本轮没有可用作者。')
    const keyedCircles = circleRefs.map(ref => ref.circle
      ? { ...ref.circle, id: ref.key }
      : { id: ref.key, name: '本轮待创建圈子', avatar: '', description: '', contentScope: '', rules: [], tags: [], creatorAccountId: '', administratorAccountIds: [], memberCount: 0, activityScore: 0, searchable: true, isPublic: true, joinMode: 'public', contentPermissions: [], anonymousMode: 'per-post', adminCanResolveAnonymous: false, allowPoll: true, allowLottery: false, mediaPermissions: [], participantSubjectIds: [], aiPopulation: 0, aiActivity: 'off', createdAt: Date.now(), source: 'generated' } as ForumCircle)
    const keyedPlan = createForumDistributionPlan({ ...draft, circles: keyedCircles }, sessionId, batchId, { ...config, requiredCharacterAccountIds: config.profileAccountId ? authorRefs.filter(ref => ref.account?.id === config.profileAccountId).map(ref => ref.key) : authorRefs.filter(ref => ref.account).map(ref => ref.key) }, authorRefs.map(ref => ref.key), generatedCircleRefs.map(ref => ref.key), Math.random, refreshState)
    if (config.profileAccountId) keyedPlan.slots.forEach(slot => { slot.authorAccountId = authorRefs.find(ref => ref.account?.id === config.profileAccountId)!.key })
    keyedPlan.slots.forEach(slot => {
      const author = authorRefs.find(ref => ref.key === slot.authorAccountId); const circle = circleRefs.find(ref => ref.key === slot.circleId)
      if (!author || !circle || canUseAuthorInCircle(draft, author, circle)) return
      const swap = keyedPlan.slots.find(candidate => !candidate.circleId && candidate.id !== slot.id && canUseAuthorInCircle(draft, authorRefs.find(ref => ref.key === candidate.authorAccountId)!, circle))
      if (swap) {
        ;[slot.authorAccountId, swap.authorAccountId] = [swap.authorAccountId, slot.authorAccountId]
        return
      }
      if (slot.contentKind === 'anonymous' || slot.contentKind === 'circle-topic' || generatedCircleRefs.some(ref => ref.key === slot.circleId)) throw new Error(`无法在不改变 ${slot.contentKind} 类型或新圈子绑定的前提下安排作者。`)
      delete slot.circleId
      const occupied = new Set(keyedPlan.slots.filter(item => item.id !== slot.id).map(item => item.topicDomain))
      const domain = shuffle(publicTopicDomains.filter(item => !occupied.has(`public:${item.id}`)), Math.random)[0] || randomItem(publicTopicDomains, Math.random)
      slot.topicDomain = `public:${domain.id}`
      slot.topicSeed = buildTopicSeed(domain, slot.contentKind, Math.random, new Set(keyedPlan.slots.filter(item => item.id !== slot.id).map(item => item.topicSeed).filter(Boolean) as string[]))
      slot.topicIntent = randomItem(intentsForKind[slot.contentKind], Math.random)
    })
    const repairedTopicErrors = validateTopicSlots(keyedPlan.slots)
    if (repairedTopicErrors.length) throw new Error(`论坛首页主题规划兼容调整失败：${repairedTopicErrors.join('；')}`)
    if (refreshState) keyedPlan.slots.forEach(slot => { if (slot.topicDomain) refreshState.usedTopicDomains.add(slot.topicDomain); if (slot.topicSeed) refreshState.usedTopicSeeds.add(slot.topicSeed) })
    keyedPlan.plannedAuthorIds = unique(keyedPlan.slots.map(slot => slot.authorAccountId))
    keyedPlan.plannedCircleIds = unique(keyedPlan.slots.map(slot => slot.circleId).filter(Boolean) as string[])
    const commentSpecs = planForumComments(draft, keyedPlan, authorRefs, circleRefs)
    const scopedAuthor = (ref?: AuthorRef) => {
      if (!ref?.account) return '由 authors 中同 key 的轻量陌生人承担'
      const account = ref.account
      const subject = draft.subjects.find(item => item.id === account.subjectId)
      const persona = draft.personas.find(item => item.accountId === account.id)
      return {
        name: account.name, bio: account.bio, expressionStyle: account.expressionStyle, backgroundHints: account.backgroundHints,
        stableIdentity: subject?.persona, identity: persona?.identity, personality: persona?.personality, occupation: persona?.occupation,
        interests: persona?.interests, postingStyle: persona?.postingStyle
      }
    }
    const promptPlan = keyedPlan.slots.map(slot => ({
      postKey: slot.id, authorKey: slot.authorAccountId, author: scopedAuthor(authorRefs.find(ref => ref.key === slot.authorAccountId)),
      circleKey: slot.circleId, circle: circleRefs.find(ref => ref.key === slot.circleId)?.circle ? { name: circleRefs.find(ref => ref.key === slot.circleId)!.circle!.name, contentScope: circleRefs.find(ref => ref.key === slot.circleId)!.circle!.contentScope, rules: circleRefs.find(ref => ref.key === slot.circleId)!.circle!.rules } : slot.circleId ? '由 circles 中同 key 的新圈子' : undefined,
      topicDomain: slot.topicDomain, topicSeed: slot.topicSeed, topicIntent: slot.topicIntent,
      type: slot.postType, kind: slot.contentKind, heat: slot.heat, comments: commentSpecs.get(slot.id)?.map(spec => ({ commentKey: spec.commentKey, authorKey: spec.authorKey, parentCommentKey: spec.parentCommentKey })) || []
    }))
    const circleCreationPlan = generatedCircleRefs.map(ref => {
      const slot = keyedPlan.slots.find(item => item.circleId === ref.key)
      return { circleKey: ref.key, topicDomain: slot?.topicDomain?.split(':').at(-1), boundary: '只定义这个圈子自身的范围；不得成为本批公共帖或其他圈子帖的共同主题' }
    })
    draftSession.status = 'generating'; draftSession.progress = 18; onProgress?.(18)
    const requestJson = dependencies.requestJson || requestForumJson
    const generated = await requestJson<ForumBatchDraft>(draft, { userInitiated: true, viewerAccountId, involvedAccountIds: [] }, 'forum-post',
      `一次性生成本轮完整论坛子批次，不得增删或改变规划中的 postKey、authorKey、circleKey、commentKey、parentCommentKey、contentKind、topicDomain、topicSeed。每个 postKey 是彼此独立的生活事件，只能遵守自己槽位中的主题、contentKind 和圈子，不得跟随同批其他帖子，不得把整批写成专题。life 必须是具体日常，question 必须明确提问，help 必须有具体求助，complaint 必须有具体吐槽对象或事件，experience 必须是亲历过程，discussion 必须有可讨论观点。circle 只约束绑定该 circleKey 的单篇帖子；没有 circleKey 的公共帖绝不能继承任何圈子 contentScope，也不要共同围绕用户或某个角色。authors 只创建这些${config.npcGenerationMode === 'full' ? '完整' : '轻量'}陌生人 key：${JSON.stringify(authorRefs.filter(ref => !ref.account).map(ref => ref.key))}。${config.npcGenerationMode === 'full' ? '完整 NPC 补充 identity、personality、occupation 和发帖/评论/私聊风格，但不伪造与用户的关系。' : '轻量 NPC 只写公开简介、表达习惯、少量背景和兴趣，不创建复杂人格。'}新圈子按边界创建：${JSON.stringify(circleCreationPlan)}。posts 严格按规划写全部帖子及内嵌 comments，不得少评论；评论长短和语气自然，不必都认真回答。图片分享必须给可用于生图的 imagePrompt；投票必须给 2 到 8 个有效 pollOptions；链接分享必须给 http/https 的 linkUrl、linkTitle 和简短 linkDescription。不要生成图片本体。\n完整规划：${JSON.stringify(promptPlan)}`,
      '{"authors":[{"authorKey":"stranger_1","name":"昵称","handle":"账号","avatar":"单字","gender":"male/female/other/unknown","bio":"公开简介","expressionStyle":"表达习惯","backgroundHints":["背景"],"interests":["兴趣"],"identity":"完整模式可用","personality":"完整模式可用","occupation":"职业","postingStyle":"发帖风格","commentingStyle":"评论风格","dmStyle":"私聊风格"}],"circles":[{"circleKey":"circle_new_1","name":"圈名","avatar":"字","description":"简介","contentScope":"内容范围","tags":["标签"],"memberCount":800}],"posts":[{"postKey":"规划值","contentKind":"原样回传规划值","topicDomain":"原样回传规划值","topicSeed":"原样回传规划值","title":"可选","content":"正文","topics":["话题"],"pollOptions":["投票选项"],"imagePrompt":"图片分享必填","linkUrl":"链接分享必填","linkTitle":"链接标题","linkDescription":"链接摘要","comments":[{"commentKey":"规划值","content":"评论"}]}]}')
    onProgress?.(72)
    const authorMap = materializeAuthors(draft, authorRefs, Array.isArray(generated.authors) ? generated.authors : [], batchId, config.npcGenerationMode)
    const circleMap = materializeCircles(draft, circleRefs, Array.isArray(generated.circles) ? generated.circles : [], batchId)
    const storedPlan: ForumDistributionPlan = { ...keyedPlan, slots: keyedPlan.slots.map(slot => ({ ...slot, authorAccountId: authorMap.get(slot.authorAccountId)!.id, circleId: slot.circleId ? circleMap.get(slot.circleId)?.id : undefined })), plannedAuthorIds: keyedPlan.plannedAuthorIds.map(key => authorMap.get(key)!.id), plannedCircleIds: keyedPlan.plannedCircleIds.map(key => circleMap.get(key)!.id) }
    draftSession.plan = storedPlan
    const postDrafts = Array.isArray(generated.posts) ? generated.posts : []
    const posts: ForumPost[] = []; const comments: ForumComment[] = []; const imageJobs: Array<{ post: ForumPost; prompt: string }> = []
    for (let index = 0; index < keyedPlan.slots.length; index += 1) {
      const keyedSlot = keyedPlan.slots[index]; const slot = storedPlan.slots[index]; const raw = postDrafts.find(item => item.postKey === keyedSlot.id)
      if (!raw?.content?.trim()) throw new Error(`模型没有完整返回帖子 ${keyedSlot.id}。`)
      if (raw.contentKind !== keyedSlot.contentKind || raw.topicDomain !== keyedSlot.topicDomain || raw.topicSeed !== keyedSlot.topicSeed) throw new Error(`模型偏离了帖子 ${keyedSlot.id} 的类型或独立主题规划，请重试。`)
      const author = draft.accounts.find(item => item.id === slot.authorAccountId); if (!author) throw new Error('帖子规划引用了不存在的作者。')
      const imagePrompt = String(raw.imagePrompt || '').trim()
      const post: ForumPost = { id: makeId('post'), author: { ...author, followersCount: 0, followingCount: 0, postsCount: 0, likesCount: 0 }, authorAccountId: author.id, circleId: slot.circleId, type: slot.postType, contentKind: slot.contentKind, topicDomain: slot.topicDomain, topicSeed: slot.topicSeed, content: String(raw.content).trim().slice(0, 4000), title: raw.title?.trim().slice(0, 120), topics: unique((raw.topics || []).map(item => String(item).replace(/^#+/, '').trim()).filter(Boolean)).slice(0, 2), visibility: slot.circleId ? 'circle' : 'public', likeCount: slot.heat === 'hot' ? 8 + slot.commentTarget * 2 : slot.commentTarget ? Math.floor(slot.commentTarget * .8) : 0, commentCount: slot.commentTarget, shareCount: slot.heat === 'hot' ? Math.max(1, Math.floor(slot.commentTarget / 4)) : 0, viewCount: slot.heat === 'hot' ? 90 + slot.commentTarget * 19 : 8 + slot.commentTarget * 7, effectiveViewCount: slot.heat === 'hot' ? 50 + slot.commentTarget * 9 : 4 + slot.commentTarget * 3, createdAt: slot.createdAt, source: 'generated', generationBatchId: batchId, isKept: false }
      if (slot.contentKind === 'anonymous') {
        const circle = slot.circleId ? draft.circles.find(item => item.id === slot.circleId) : undefined
        if (!circle || circle.anonymousMode === 'disabled' || !circle.contentPermissions.includes('anonymous')) throw new Error('匿名帖没有绑定允许匿名发布的有效圈子，批次未提交。')
        const anonymous = { id: makeId('anonymous'), circleId: slot.circleId!, ownerAccountId: author.id, anonymousCode: String(100 + Math.floor(Math.random() * 900)), rotationMode: circle.anonymousMode, adminCanResolve: Boolean(circle.adminCanResolveAnonymous) }
        draft.anonymousIdentities.push(anonymous); post.anonymousIdentityId = anonymous.id
      }
      if (slot.contentKind === 'poll') {
        const options = unique((raw.pollOptions || []).map(String).map(item => item.trim()).filter(Boolean)).slice(0, 8)
        if (options.length < 2) throw new Error('投票帖没有返回至少两个有效选项，批次未提交。')
        const pollId = makeId('poll'); draft.polls.push({ id: pollId, postId: post.id, multiple: false, anonymous: true, changeable: false, resultsVisible: 'immediate', options: options.map(label => ({ id: makeId('option'), label, votes: Math.floor(Math.random() * 18), voterAccountIds: [] })) }); post.pollId = pollId
      }
      if (slot.contentKind === 'link') {
        const linkUrl = String(raw.linkUrl || '').trim()
        if (!/^https?:\/\/\S+$/i.test(linkUrl)) throw new Error('链接分享没有返回有效的 http/https 地址，批次未提交。')
        post.linkPreview = { url: linkUrl.slice(0, 1000), title: String(raw.linkTitle || raw.title || linkUrl).trim().slice(0, 160), description: String(raw.linkDescription || '').trim().slice(0, 300) }
      }
      if (slot.contentKind === 'image-share') {
        if (!imagePrompt && config.imageUnavailable === 'ai') throw new Error('图片分享没有返回生图描述，批次未提交。')
        if (imagePrompt && draft.settings.autoImageProvider !== 'off') imageJobs.push({ post, prompt: imagePrompt })
        else if (config.imageUnavailable === 'text') { post.type = 'text'; post.contentKind = 'thought' }
        else throw new Error('图片分享没有可用图片，且本轮已完成规划，无法安全跳过后再伪装成其他类型。')
      }
      posts.push(post)
      const rawComments = Array.isArray(raw.comments) ? raw.comments : []; const commentMap = new Map<string, ForumComment>()
      for (const spec of commentSpecs.get(keyedSlot.id) || []) {
        const content = rawComments.find(item => item.commentKey === spec.commentKey)?.content?.trim(); if (!content) throw new Error(`模型没有完整返回评论 ${spec.commentKey}。`)
        const commentAuthor = authorMap.get(spec.authorKey); const parent = spec.parentCommentKey ? commentMap.get(spec.parentCommentKey) : undefined
        if (!commentAuthor || (spec.parentCommentKey && !parent)) throw new Error('评论作者或楼中楼关联无效。')
        const comment: ForumComment = { id: makeId('comment'), postId: post.id, author: { ...commentAuthor, followersCount: 0, followingCount: 0, postsCount: 0, likesCount: 0 }, authorAccountId: commentAuthor.id, parentId: parent?.id, rootCommentId: parent?.rootCommentId || parent?.id, replyToCommentId: parent?.id, depth: parent ? 1 : 0, replyToUser: parent ? { id: parent.authorAccountId, name: parent.author.name } : undefined, content: String(content).slice(0, 800), likeCount: 0, createdAt: spec.createdAt, source: 'generated', generationBatchId: batchId }
        comments.push(comment); commentMap.set(spec.commentKey, comment)
      }
    }
    for (let index = 0; index < imageJobs.length; index += 1) {
      const job = imageJobs[index]
      try {
        const media = await (dependencies.generateImage || generateForumImage)(job.prompt, draft.settings.autoImageProvider === 'off' ? 'pollinations' : draft.settings.autoImageProvider)
        job.post.media = [media]
        if (media.storageKey) generatedImageStorageKeys.push(media.storageKey)
      } catch (cause) {
        if (config.imageUnavailable === 'ai') throw new Error(`图片分享生成失败，批次未提交：${cause instanceof Error ? cause.message : String(cause)}`)
        if (config.imageUnavailable === 'skip') throw new Error(`图片分享生成失败，无法在不改变已规划类型数量的前提下跳过：${cause instanceof Error ? cause.message : String(cause)}`)
        job.post.type = 'text'; job.post.contentKind = 'thought'
      }
      onProgress?.(72 + Math.round((index + 1) / Math.max(1, imageJobs.length) * 18))
    }
    draft.posts.unshift(...posts.sort((a, b) => Number(b.createdAt) - Number(a.createdAt))); draft.comments.push(...comments)
    const strangers = authorRefs.filter(ref => !ref.account).map(ref => authorMap.get(ref.key)!)
    const usedCircleIds = new Set(posts.map(item => item.circleId).filter(Boolean))
    const generatedCircles = generatedCircleRefs.map(ref => circleMap.get(ref.key)!).filter(circle => circle && usedCircleIds.has(circle.id))
    draft.circles = draft.circles.filter(circle => circle.source !== 'generated' || circle.generationBatchId !== batchId || usedCircleIds.has(circle.id))
    const batch: ForumContentBatch = { id: batchId, sessionId, postIds: posts.map(item => item.id), commentIds: comments.map(item => item.id), authorAccountIds: strangers.map(item => item.id), circleIds: generatedCircles.map(item => item.id), createdAt: Date.now() }
    draft.contentBatches.unshift(batch); draftSession.status = 'committed'; draftSession.progress = 100; draftSession.completedAt = Date.now()
    Object.assign(snapshot, draft); onProgress?.(100)
    return batch
  } catch (cause) {
    generatedImageStorageKeys.forEach(key => { void removeForumMedia(key) })
    session.status = 'failed'; session.progress = 0; session.error = cause instanceof Error ? cause.message : String(cause); session.completedAt = Date.now(); throw cause
  }
}

const removeGeneratedPostsForReplacement = (snapshot: ForumSnapshot, config: ForumGenerationConfig) => {
  if (config.refreshMode !== 'replace') return [] as string[]
  const latestBatchId = snapshot.contentBatches.find(batch => batch.postIds.some(postId => snapshot.posts.some(post => post.id === postId)))?.id
  const requested = config.replaceScope === 'selected'
    ? new Set(config.replacePostIds)
    : config.replaceScope === 'latest-batch'
      ? new Set(snapshot.contentBatches.find(item => item.id === latestBatchId)?.postIds || [])
      : new Set(snapshot.posts.filter(post => post.source !== 'user').map(post => post.id))
  const protectedPostIds = new Set(snapshot.posts.filter(post => post.source === 'user' || post.isKept || snapshot.comments.some(comment => comment.postId === post.id && comment.source === 'user')).map(post => post.id))
  const removing = new Set(snapshot.posts.filter(post => requested.has(post.id) && post.source !== 'user' && !protectedPostIds.has(post.id)).map(post => post.id))
  if (!removing.size) return []
  const removedMediaKeys = snapshot.posts.filter(post => removing.has(post.id)).flatMap(post => (post.media || []).flatMap(media => [media.storageKey, media.audioStorageKey].filter(Boolean) as string[]))
  const retainedMediaKeys = new Set(snapshot.posts.filter(post => !removing.has(post.id)).flatMap(post => (post.media || []).flatMap(media => [media.storageKey, media.audioStorageKey].filter(Boolean) as string[])))
  const lotteryIds = new Set(snapshot.lotteries.filter(item => removing.has(item.postId)).map(item => item.id))
  snapshot.posts = snapshot.posts.filter(item => !removing.has(item.id))
  snapshot.comments = snapshot.comments.filter(item => !removing.has(item.postId))
  snapshot.polls = snapshot.polls.filter(item => !removing.has(item.postId))
  snapshot.lotteries = snapshot.lotteries.filter(item => !removing.has(item.postId))
  snapshot.lotteryEntries = snapshot.lotteryEntries.filter(item => !lotteryIds.has(item.lotteryId))
  snapshot.lotteryResults = snapshot.lotteryResults.filter(item => !lotteryIds.has(item.lotteryId))
  snapshot.events = snapshot.events.filter(item => !item.entityId || !removing.has(item.entityId))
  snapshot.notifications = snapshot.notifications.filter(item => !item.entityId || !removing.has(item.entityId))
  snapshot.contentBatches.forEach(batch => { batch.postIds = batch.postIds.filter(id => !removing.has(id)); batch.commentIds = batch.commentIds.filter(id => snapshot.comments.some(comment => comment.id === id)) })
  removedMediaKeys.filter(key => !retainedMediaKeys.has(key)).forEach(key => { void removeForumMedia(key) })
  return [...removing]
}

export const estimateForumBatchSize = (config: ForumGenerationConfig, contextTokenBudget = 5000) => {
  const commentsPerPost = config.commentMode === 'per-post' ? config.commentsPerPost : config.commentMode === 'total' ? config.totalComments / Math.max(1, config.postCount) : 4
  const personaCost = config.npcGenerationMode === 'full' ? 2.2 : 1
  const contextCost = Math.max(.7, Math.min(2, contextTokenBudget / 5000))
  return Math.max(1, Math.min(20, Math.floor(22 / Math.max(1, (1 + commentsPerPost / 5) * personaCost * contextCost))))
}

export const generateForumContentBatch = async (snapshot: ForumSnapshot, viewerAccountId: string, rawConfig: ForumGenerationConfig, onProgress?: (value: number) => void, dependencies: ForumGenerationDependencies = {}) => {
  const config = normalizeForumGenerationConfig(rawConfig)
  if (config.postTypeMode === 'custom' && config.ensureEverySelectedKind && config.allowedContentKinds.length > config.postCount) throw new Error(`已选择 ${config.allowedContentKinds.length} 种帖子类型，但本轮只有 ${config.postCount} 篇，无法保证每种至少一篇。`)
  const working = cloneSnapshot(snapshot)
  removeGeneratedPostsForReplacement(working, config)
  const batchSize = estimateForumBatchSize(config, snapshot.settings.aiContextTokenBudget)
  const batches: ForumContentBatch[] = []
  let remaining = config.postCount
  let generatedPosts = 0
  let requiredCursor = 0
  let kindCursor = 0
  const refreshState: ForumRefreshPlanningState = { usedTopicDomains: new Set(), usedTopicSeeds: new Set(), recentCircleIds: [] }
  const publicCircles = working.circles.filter(circle => circle.isPublic)
  const forceCircleForSelectedKind = config.postTypeMode === 'custom' && (
    config.allowedContentKinds.includes('anonymous') && !publicCircles.some(circle => circleSupportsKind(circle, 'anonymous')) && config.anonymousUnavailable === 'create-circle'
    || config.allowedContentKinds.includes('circle-topic') && !publicCircles.some(circle => circleSupportsKind(circle, 'circle-topic')) && config.circleTopicUnavailable === 'create-circle'
  )
  const createCircleThisRefresh = forceCircleForSelectedKind || shouldDiscoverForumCircle(working, config)
  try {
    while (remaining > 0) {
      const count = Math.min(batchSize, remaining)
      const requiredIds = config.profileAccountId ? [] : config.requiredCharacterAccountIds.slice(requiredCursor, requiredCursor + count)
      requiredCursor += requiredIds.length
      const uncoveredKinds = config.postTypeMode === 'custom' && config.ensureEverySelectedKind ? config.allowedContentKinds.slice(kindCursor, kindCursor + count) : []
      kindCursor += uncoveredKinds.length
      const batchConfig: ForumGenerationConfig = {
        ...config,
        postCount: count,
        refreshMode: 'incremental',
        requiredCharacterAccountIds: requiredIds,
        allowedContentKinds: uncoveredKinds.length ? uncoveredKinds : config.allowedContentKinds,
        totalComments: config.commentMode === 'total'
          ? Math.max(0, Math.round(config.totalComments * (generatedPosts + count) / config.postCount) - Math.round(config.totalComments * generatedPosts / config.postCount))
          : config.totalComments,
        ensureEverySelectedKind: uncoveredKinds.length > 0
      }
      const batch = await generateSingleForumContentBatch(working, viewerAccountId, batchConfig, value => onProgress?.(Math.round((generatedPosts / config.postCount + value / 100 * count / config.postCount) * 100)), dependencies, refreshState, createCircleThisRefresh && batches.length === 0 ? 'force' : 'disable')
      batches.push(batch)
      generatedPosts += count
      remaining -= count
    }
    const completedPostIds = new Set(batches.flatMap(batch => batch.postIds))
    const completedPosts = working.posts.filter(post => completedPostIds.has(post.id))
    if (completedPosts.length !== config.postCount) throw new Error(`整轮落库帖子数量为 ${completedPosts.length}，与要求的 ${config.postCount} 不一致。`)
    if (config.postTypeMode === 'custom' && config.ensureEverySelectedKind) {
      const requiredKinds = config.allowedContentKinds.filter(kind => {
        if (kind === 'image-share' && (config.imageUnavailable === 'text' || working.settings.autoImageProvider === 'off' && config.imageUnavailable === 'skip')) return false
        if (kind === 'anonymous' && !working.circles.some(circle => circle.isPublic && circleSupportsKind(circle, kind)) && config.anonymousUnavailable === 'skip') return false
        if (kind === 'circle-topic' && !working.circles.some(circle => circle.isPublic && circleSupportsKind(circle, kind)) && config.circleTopicUnavailable === 'skip') return false
        return true
      })
      const actualKinds = new Set(completedPosts.map(post => post.contentKind))
      const missingKinds = requiredKinds.filter(kind => !actualKinds.has(kind))
      if (missingKinds.length) throw new Error(`自定义类型没有完整兑现：缺少 ${missingKinds.join('、')}。`)
    }
    completedPosts.forEach(post => {
      if (!post.contentKind) throw new Error('生成帖子缺少最终 contentKind。')
      if (post.contentKind === 'image-share' && config.imageUnavailable === 'ai' && !post.media?.some(media => media.type === 'image')) throw new Error('图片分享没有最终图片。')
      if (post.contentKind === 'poll' && !post.pollId) throw new Error('投票帖没有最终投票实体。')
      if (post.contentKind === 'link' && !post.linkPreview?.url) throw new Error('链接分享没有最终链接卡片。')
      if (post.contentKind === 'anonymous' && !post.anonymousIdentityId) throw new Error('匿名帖没有最终匿名身份。')
      if (post.contentKind === 'circle-topic' && !post.circleId) throw new Error('圈子话题没有最终圈子绑定。')
    })
  } catch (cause) {
    const successfulPostIds = new Set(batches.flatMap(batch => batch.postIds))
    working.posts.filter(post => successfulPostIds.has(post.id)).flatMap(post => post.media || []).map(media => media.storageKey).filter(Boolean).forEach(key => { void removeForumMedia(key!) })
    const reason = cause instanceof Error ? cause.message : String(cause)
    throw new Error(batches.length ? `本轮要求生成 ${config.postCount} 篇，但在完成 ${generatedPosts} 篇后失败；为避免类型缺失和半批内容，本轮没有提交。${reason}` : reason)
  }
  if (config.discoverCircles && !config.profileAccountId) working.settings.circleDiscoveryMisses = batches.some(batch => batch.circleIds.length) ? 0 : Math.max(0, Number(working.settings.circleDiscoveryMisses || 0)) + 1
  Object.assign(snapshot, working)
  if (batches.length === 1) return batches[0]
  const combined: ForumContentBatch = { id: makeId('content_batch_group'), sessionId: batches[0].sessionId, postIds: batches.flatMap(item => item.postIds), commentIds: batches.flatMap(item => item.commentIds), authorAccountIds: unique(batches.flatMap(item => item.authorAccountIds)), circleIds: unique(batches.flatMap(item => item.circleIds)), createdAt: Date.now() }
  snapshot.contentBatches.unshift(combined)
  onProgress?.(100)
  return combined
}

export const promoteLightweightAuthor = (snapshot: ForumSnapshot, accountId: string, reason: string) => {
  const account = snapshot.accounts.find(item => item.id === accountId)
  if (!account || account.lifecycle !== 'lightweight') return account
  account.lifecycle = 'persistent'; account.persistenceReason = reason; account.lastSeenAt = Date.now()
  const subject = snapshot.subjects.find(item => item.id === account.subjectId)
  if (subject && !snapshot.personas.some(item => item.accountId === account.id)) {
    const personaId = makeId('forum_persona'); account.personaId = personaId
    snapshot.personas.push({ id: personaId, accountId: account.id, identity: account.bio, personality: account.expressionStyle, interests: [], boundaries: [], postingStyle: account.expressionStyle, socialInitiative: 30, activeHours: [], habits: {}, lockedFields: [] })
  }
  return account
}
