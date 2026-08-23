/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export interface ForumUser {
  id: string
  name: string
  handle: string
  avatar: string
  bio?: string
  banner?: string
  verified?: boolean
  isFollowing?: boolean
  followersCount: number
  followingCount: number
  postsCount: number
  likesCount: number
  location?: string
  joinedDate?: string
  ipLocation?: string
}

export type ForumPostType = 'text' | 'single-image' | 'multi-image' | 'long-article' | 'quote' | 'repost'

export interface ForumMediaItem {
  id: string
  url: string
  aspectRatio?: number // width / height
  alt?: string
}

export interface ForumQuoteContent {
  id: string
  author: ForumUser
  content: string
  media?: ForumMediaItem[]
  createdAt: number | string
}

export interface ForumPost {
  id: string
  author: ForumUser
  type: ForumPostType
  content: string
  title?: string // 针对长文章 / 专栏
  topics?: string[]
  media?: ForumMediaItem[]
  quote?: ForumQuoteContent
  repostOrigin?: ForumPost
  likeCount: number
  commentCount: number
  shareCount: number
  viewCount?: number
  isLiked?: boolean
  isBookmarked?: boolean
  isReposted?: boolean
  createdAt: number | string
  pinned?: boolean
}

export interface ForumComment {
  id: string
  postId: string
  author: ForumUser
  content: string
  likeCount: number
  isLiked?: boolean
  createdAt: number | string
  replyToUser?: {
    id: string
    name: string
  }
  replies?: ForumComment[]
}

export interface ForumTopic {
  id: string
  name: string
  tag: string
  hotScore: string
  description?: string
  postsCount: number
}

export interface ForumDirectMessage {
  id: string
  senderId: string
  receiverId: string
  content: string
  mediaUrl?: string
  createdAt: number | string
  isSelf?: boolean
}

export interface ForumConversation {
  id: string
  user: ForumUser
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
}
