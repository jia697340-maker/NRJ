/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type ForumSubjectKind = 'user' | 'character' | 'npc'
export type ForumAccountKind = 'main' | 'alternate' | 'private' | 'circle' | 'verified' | 'work' | 'anonymous' | 'custom'
export type ForumPrivacy = 'public' | 'normal' | 'semi-private' | 'private' | 'hidden'
export type ForumAutonomyLevel = 'off' | 'low' | 'normal' | 'high' | 'custom'
export type ForumBridgeMode = 'off' | 'all' | 'selected' | 'summary' | 'important' | 'reachable-only'
export type ForumMemoryType = 'identity' | 'public-profile' | 'relationship' | 'post' | 'comment' | 'like' | 'follow' | 'dm' | 'group' | 'circle' | 'important-event' | 'user-public' | 'user-private' | 'chat-daily' | 'chat-secret' | 'emotion' | 'image' | 'voice' | 'offline-event'
export type ForumPostType = 'text' | 'single-image' | 'multi-image' | 'long-article' | 'quote' | 'repost' | 'poll' | 'qa' | 'voice' | 'video' | 'short-video' | 'music' | 'link' | 'location' | 'anonymous' | 'lottery' | 'event' | 'story'
export type ForumMediaType = 'image' | 'voice' | 'video' | 'short-video' | 'music' | 'file'
export type ForumAuthorLifecycle = 'lightweight' | 'persistent' | 'character' | 'user'
export type ForumGenerationStatus = 'draft' | 'planning' | 'generating' | 'committed' | 'failed'

export interface ForumSubject { id: string; kind: ForumSubjectKind; sourceId?: string; sourceAccountId?: string; displayName: string; persona: string; avatarKey?: string; detachedAt?: number; createdAt: number; updatedAt: number }
export interface ForumPersona { id: string; accountId: string; identity?: string; personality?: string; occupation?: string; interests: string[]; boundaries: string[]; postingStyle?: string; commentingStyle?: string; dmStyle?: string; emojiStyle?: string; punctuationStyle?: string; socialInitiative: number; activeHours: string[]; habits: Partial<Record<'image' | 'voice' | 'shortVideo' | 'anonymous' | 'alternateAccount', boolean>>; lockedFields: string[] }

export interface ForumResidentProfile {
  id: string; subjectId: string; accountId: string; origin: 'character' | 'social-circle' | 'ambient'
  browsingPatience: number; likeTendency: number; commentTendency: number; followTendency: number; socialInitiative: number; strangerTrust: number; conflictTolerance: number; trendSensitivity: number; privacySensitivity: number
  activeHours: [number, number]; homeCircleIds: string[]; interests: string[]; avoidedTopics: string[]
  averageLength: 'short' | 'medium' | 'long'; punctuationStyle: string; emojiFrequency: 'none' | 'low' | 'medium' | 'high'; commonWords: string[]; avoidedPhrases: string[]; recentSamples: string[]
  lastActiveAt?: number; lastPostAt?: number; createdAt: number; updatedAt: number
}

export interface ForumAccount {
  id: string; subjectId: string; kind: ForumAccountKind; customKind?: string; name: string; handle: string; avatar: string; avatarMediaId?: string; bio?: string; banner?: string; bannerMediaId?: string; verified?: boolean
  privacy: ForumPrivacy; searchable: boolean; acceptsFollow: boolean; followRequiresApproval: boolean; acceptsDm: 'all' | 'following' | 'mutual' | 'none'; showInRecommendations: boolean; showOnline: boolean; showCircles: boolean
  location?: string; ipLocation?: string; joinedAt: number; personaId?: string; circleIds: string[]; isArchived?: boolean
  lifecycle?: ForumAuthorLifecycle; expressionStyle?: string; backgroundHints?: string[]; firstSeenBatchId?: string; lastSeenAt?: number; persistenceReason?: string
}

/** UI projection. Ownership remains in ForumAccount/ForumSubject. */
export interface ForumUser extends ForumAccount { followersCount: number; followingCount: number; postsCount: number; likesCount: number; joinedDate?: string; isFollowing?: boolean }

export interface ForumAutonomyPolicy { level: ForumAutonomyLevel; actions: Partial<Record<'post' | 'comment' | 'like' | 'follow' | 'unfollow' | 'replyDm' | 'startDm' | 'createGroup' | 'inviteGroup' | 'image' | 'voice' | 'shortVideo' | 'anonymous' | 'lottery' | 'poll', boolean>> }
export interface ForumParticipantPolicy {
  id: string; subjectId: string; enabled: boolean; allowedCircleIds: string[]; blockedCircleIds: string[]; allowedAccountIds: string[]; allowedGroupIds: string[]
  scope: Array<'global' | 'circle' | 'account' | 'group' | 'following-feed' | 'dm' | 'passive' | 'post'>
  allowPublicDiscovery: boolean; allowNpcKnowledge: boolean; allowMention: boolean; allowSearch: boolean; allowRecommendation: boolean; allowDm: boolean; allowGroup: boolean; autonomy: ForumAutonomyPolicy; updatedAt: number
}
export interface ForumAccountLink { id: string; subjectId: string; accountIds: string[]; share: Partial<Record<'persona' | 'appearance' | 'worldbook' | 'memory' | 'image-reference' | 'interests' | 'circle-relations' | 'dm-memory' | 'location' | 'ip-location', boolean>> }
export interface ForumRecognitionState { id: string; observerAccountId: string; targetAccountIds: string[]; status: 'known' | 'suspected' | 'unknown' | 'mistaken'; confidence: number; evidenceEventIds: string[]; updatedAt: number }

export interface ForumWorldBinding { id: string; circleId: string; bookIds: string[]; groupIds: string[]; entryIds: string[]; weights: Record<string, number>; priorities: string[]; followUpdates: boolean; lastSnapshots: Record<string, number> }
export interface ForumCircle {
  id: string; name: string; avatar: string; background?: string; description: string; contentScope: string; announcement?: string; rules: string[]; tags: string[]; creatorAccountId: string; administratorAccountIds: string[]
  memberCount: number; activityScore: number; searchable: boolean; isPublic: boolean; joinMode: 'public' | 'follow' | 'application' | 'invite' | 'password' | 'specified-account' | 'specified-character' | 'hidden'; passwordHint?: string
  contentPermissions: ForumPostType[]; anonymousMode: 'disabled' | 'per-post' | 'circle-fixed' | 'daily'; adminCanResolveAnonymous: boolean; allowPoll: boolean; allowLottery: boolean; mediaPermissions: ForumMediaType[]
  participantSubjectIds: string[]; aiPopulation: number; aiActivity: ForumAutonomyLevel; worldBindingId?: string; createdAt: number; source?: 'user' | 'generated' | 'imported'; generationBatchId?: string
}
export interface ForumMembership { id: string; circleId: string; accountId: string; role: 'owner' | 'admin' | 'member' | 'pending' | 'invited' | 'banned'; circleIdentity?: Partial<Pick<ForumAccount, 'name' | 'avatar' | 'bio'>>; joinedAt: number }

export interface ForumMediaItem { id: string; type?: ForumMediaType; url: string; storageKey?: string; audioStorageKey?: string; audioUrl?: string; mimeType?: string; aspectRatio?: number; alt?: string; duration?: number; transcript?: string; subtitle?: string; animation?: 'pan' | 'zoom' | 'fade' | 'slide'; posterUrl?: string }
export interface ForumQuoteContent { id: string; author: ForumUser; content: string; media?: ForumMediaItem[]; createdAt: number | string }
export interface ForumPollOption { id: string; label: string; votes: number; voterAccountIds: string[] }
export interface ForumPoll { id: string; postId: string; multiple: boolean; anonymous: boolean; changeable: boolean; resultsVisible: 'immediate' | 'after-end'; endsAt?: number; options: ForumPollOption[] }
export interface ForumLottery { id: string; postId: string; prize: string; prizeMediaId?: string; winnerCount: number; drawAt: number; conditions: Array<'like' | 'comment' | 'follow' | 'join-circle' | 'repost' | 'mention' | 'keyword' | 'none'>; keyword?: string; anonymous: boolean; drawnAt?: number }
export interface ForumLotteryEntry { id: string; lotteryId: string; accountId: string; enteredAt: number }
export interface ForumLotteryResult { id: string; lotteryId: string; winnerAccountIds: string[]; drawnAt: number; randomSeed: string }

export interface ForumPost {
  id: string; author: ForumUser; authorAccountId: string; circleId?: string; type: ForumPostType; content: string; title?: string; topics?: string[]; media?: ForumMediaItem[]; quote?: ForumQuoteContent; repostOrigin?: ForumPost
  anonymousIdentityId?: string; pollId?: string; lotteryId?: string; visibility: 'public' | 'followers' | 'mutual' | 'circle' | 'private' | 'custom'; visibleToAccountIds?: string[]; expiresAt?: number
  likeCount: number; commentCount: number; shareCount: number; viewCount?: number; effectiveViewCount?: number; isLiked?: boolean; isBookmarked?: boolean; isReposted?: boolean; createdAt: number | string; updatedAt?: number; pinned?: boolean; source?: 'user' | 'generated' | 'resident' | 'autonomy' | 'imported'
}
export interface ForumComment { id: string; postId: string; author: ForumUser; authorAccountId: string; parentId?: string; rootCommentId?: string; replyToCommentId?: string; depth?: number; content: string; media?: ForumMediaItem[]; likeCount: number; isLiked?: boolean; createdAt: number | string; replyToUser?: { id: string; name: string }; replies?: ForumComment[] }
export interface ForumTopic { id: string; name: string; tag: string; hotScore: string; description?: string; postsCount: number }

export interface ForumRelationship { id: string; fromAccountId: string; toAccountId: string; type: 'follow' | 'follow-request' | 'friend' | 'bookmark-account'; createdAt: number }
export interface ForumRelationshipEdge { id: string; fromAccountId: string; toAccountId: string; familiarity: number; affinity: number; trust: number; tension: number; interactionCount: number; impressionSummary: string; lastInteractionAt?: number; updatedAt: number }
export interface ForumExposure { id: string; viewerAccountId: string; postId: string; source: 'recommend' | 'following' | 'latest' | 'circle' | 'profile' | 'search'; shownAt: number; attention: 'shown' | 'glanced' | 'read' | 'deep-read'; dwellMs: number; openedPost: boolean; openedProfile: boolean }
export interface ForumScheduledAction { id: string; actorAccountId: string; type: 'view' | 'like' | 'comment' | 'follow' | 'post'; postId?: string; circleId?: string; dueAt: number; reason: string; completedAt?: number }
export interface ForumBlockRule { id: string; ownerAccountId: string; targetAccountId: string; effects: Array<'posts' | 'search' | 'follow' | 'dm' | 'comment' | 'mention' | 'group-invite' | 'recommendation' | 'profile'>; createdAt: number }
export interface ForumMuteRule { id: string; ownerAccountId: string; targetAccountId?: string; circleId?: string; topic?: string; keyword?: string; contentType?: ForumPostType; hideReposts?: boolean; hideComments?: boolean; expiresAt?: number }
export interface ForumVisibilityRule { id: string; ownerAccountId: string; targetAccountId: string; scopes: Array<'all' | 'post' | 'circle' | 'media' | 'online-status' | 'following-list'>; postIds?: string[]; circleIds?: string[] }
export interface AnonymousIdentity { id: string; circleId: string; ownerAccountId: string; anonymousCode: string; rotationMode: 'per-post' | 'circle-fixed' | 'daily'; expiresAt?: number; adminCanResolve: boolean }

export interface ForumDirectMessage { id: string; conversationId?: string; senderId: string; receiverId?: string; content: string; type?: 'text' | 'image' | 'voice' | 'share-post' | 'share-account' | 'share-circle'; mediaUrl?: string; mediaId?: string; quotedMessageId?: string; createdAt: number | string; isSelf?: boolean; readAt?: number; recalledAt?: number }
export interface ForumConversation { id: string; kind?: 'direct' | 'group'; user: ForumUser; participantAccountIds: string[]; groupId?: string; lastMessage: string; lastMessageTime: string; unreadCount: number; mutedUntil?: number; requestState?: 'none' | 'pending' | 'accepted' | 'rejected' }
export interface ForumGroup { id: string; name: string; avatar: string; announcement?: string; ownerAccountId: string; administratorAccountIds: string[]; temporary: boolean; createdAt: number }
export interface ForumGroupMember { id: string; groupId: string; accountId: string; nickname?: string; role: 'owner' | 'admin' | 'member'; mutedUntil?: number; joinedAt: number }

export interface ForumBridgeDirectionPolicy { mode: ForumBridgeMode; memoryTypes: ForumMemoryType[] }
export interface ForumBridgePolicy { id: string; subjectId: string; forumToChat: ForumBridgeDirectionPolicy; chatToForum: ForumBridgeDirectionPolicy; updatedAt: number }
export interface ForumMemory { id: string; subjectId?: string; accountId?: string; circleId?: string; type: ForumMemoryType; summary: string; visibility: 'public' | 'private' | 'restricted'; sourceEventIds: string[]; importance: number; createdAt: number }
export interface ForumCircleMemory { id: string; circleId: string; kind: 'trend' | 'meme' | 'controversy' | 'event' | 'active-account' | 'management' | 'lottery' | 'activity' | 'conflict' | 'relationship'; summary: string; importance: number; createdAt: number }
export interface ForumEvent { id: string; type: string; actorAccountId?: string; targetAccountIds: string[]; circleId?: string; entityId?: string; payload: Record<string, unknown>; createdAt: number }
export interface ForumNotification { id: string; accountId: string; type: 'like' | 'comment' | 'reply' | 'mention' | 'follow' | 'follow-request' | 'dm' | 'message-request' | 'group-invite' | 'circle-request' | 'management' | 'lottery' | 'poll' | 'event' | 'worldbook-update' | 'recognition'; actorAccountId?: string; entityId?: string; text: string; readAt?: number; createdAt: number }

export interface ForumGenerationConfig {
  rangeDays: number; customStartAt?: number; customEndAt?: number; postCount: number; commentMin: number; commentMax: number; publicPostCount: number; circlePostCount: number
  strangerAuthorMin: number; strangerAuthorMax: number; requiredCharacterAccountIds: string[]; includeOwnedCircles: boolean; ownedCirclePostCounts: Record<string, number>; randomCircleCount: number; worldBookIds: string[]
}
export interface ForumPostPlanSlot { id: string; authorAccountId: string; circleId?: string; postType: ForumPostType; createdAt: number; commentTarget: number; heat: 'quiet' | 'normal' | 'hot'; contentKind: 'thought' | 'life' | 'image-share' | 'question' | 'help' | 'complaint' | 'experience' | 'discussion' | 'link' | 'poll' | 'anonymous' | 'circle-topic' }
export interface ForumDistributionPlan { id: string; sessionId: string; batchId: string; slots: ForumPostPlanSlot[]; plannedAuthorIds: string[]; plannedCircleIds: string[]; plannedCommentCount: number; createdAt: number }
export interface ForumGenerationSession { id: string; status: ForumGenerationStatus; config: ForumGenerationConfig; plan?: ForumDistributionPlan; batchId?: string; progress: number; error?: string; createdAt: number; completedAt?: number }
export interface ForumContentBatch { id: string; sessionId: string; postIds: string[]; commentIds: string[]; authorAccountIds: string[]; circleIds: string[]; createdAt: number }

export interface ForumSettings { initialized: boolean; activeAccountId: string; defaultSquareEnabled: boolean; generateStrangers: boolean; manualGenerationOnly: boolean; autonomousCommunity: boolean; ambientPopulationTarget: number; aiBatchSize: number; aiContextTokenBudget: number; refreshWorldBookIds?: string[]; preferredImageProvider?: string; preferredVoiceProvider?: string; lastWorldTickAt?: number; createdAt: number; updatedAt: number }
export interface AllowedForumContext { viewerAccount: ForumAccount; circle?: ForumCircle; worldBookEntries: Array<{ bookId: string; entryId: string; title: string; content: string; weight: number }>; eventPost?: Pick<ForumPost, 'id' | 'authorAccountId' | 'circleId' | 'type' | 'content' | 'topics'>; involvedAccounts: ForumAccount[]; involvedSubjects: Array<Pick<ForumSubject, 'id' | 'kind' | 'displayName' | 'persona'>>; involvedPersonas: Array<Pick<ForumPersona, 'accountId' | 'identity' | 'personality' | 'occupation' | 'interests' | 'boundaries' | 'postingStyle' | 'emojiStyle' | 'punctuationStyle' | 'activeHours'>>; recentPosts: Array<Pick<ForumPost, 'authorAccountId' | 'content' | 'topics' | 'createdAt'>>; reachableMemories: ForumMemory[]; anonymousActors: Array<{ anonymousIdentityId: string; label: string }> }

export interface ForumSnapshot {
  version: number; settings: ForumSettings; subjects: ForumSubject[]; accounts: ForumAccount[]; personas: ForumPersona[]; participantPolicies: ForumParticipantPolicy[]; accountLinks: ForumAccountLink[]; recognitions: ForumRecognitionState[]
  circles: ForumCircle[]; memberships: ForumMembership[]; worldBindings: ForumWorldBinding[]; posts: ForumPost[]; comments: ForumComment[]; topics: ForumTopic[]; relationships: ForumRelationship[]; blocks: ForumBlockRule[]; mutes: ForumMuteRule[]; visibilityRules: ForumVisibilityRule[]
  anonymousIdentities: AnonymousIdentity[]; polls: ForumPoll[]; lotteries: ForumLottery[]; lotteryEntries: ForumLotteryEntry[]; lotteryResults: ForumLotteryResult[]; conversations: ForumConversation[]; messages: ForumDirectMessage[]; groups: ForumGroup[]; groupMembers: ForumGroupMember[]
  bridgePolicies: ForumBridgePolicy[]; memories: ForumMemory[]; circleMemories: ForumCircleMemory[]; events: ForumEvent[]; notifications: ForumNotification[]
  residentProfiles: ForumResidentProfile[]; relationshipEdges: ForumRelationshipEdge[]; exposures: ForumExposure[]; scheduledActions: ForumScheduledAction[]
  generationSessions: ForumGenerationSession[]; contentBatches: ForumContentBatch[]
}
