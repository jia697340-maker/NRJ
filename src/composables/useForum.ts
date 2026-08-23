/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed } from 'vue'
import type { ForumPost, ForumUser, ForumTopic, ForumComment, ForumConversation, ForumDirectMessage } from '../types/forum'

// 当前用户默认资料
export const currentForumUser = ref<ForumUser>({
  id: 'user_self',
  name: '未命名漫游者',
  handle: 'wanderer_01',
  avatar: '',
  bio: '在数字旷野里，记录片刻的生活与随想。',
  banner: '',
  verified: false,
  followersCount: 128,
  followingCount: 64,
  postsCount: 12,
  likesCount: 389,
  location: '云端节点',
  joinedDate: '2026年3月'
})

// 初始模拟用户池（真实社交感，无任何 AI 标识）
export const mockForumUsers: Record<string, ForumUser> = {
  user_lin: {
    id: 'user_lin',
    name: '林深见鹿',
    handle: 'deer_in_woods',
    avatar: '',
    bio: '胶片摄影爱好者 / 城市散步指南 / 偶尔写写随笔',
    banner: '',
    verified: true,
    isFollowing: true,
    followersCount: 3420,
    followingCount: 215,
    postsCount: 88,
    likesCount: 14200,
    location: '上海',
    joinedDate: '2025年11月',
    ipLocation: '上海'
  },
  user_momo: {
    id: 'user_momo',
    name: '莫莫不说话',
    handle: 'silent_momo',
    avatar: '',
    bio: '白天是普通的建筑设计师，晚上是猫咪全职铲屎官 🐈',
    banner: '',
    verified: false,
    isFollowing: false,
    followersCount: 890,
    followingCount: 340,
    postsCount: 45,
    likesCount: 2310,
    location: '杭州',
    joinedDate: '2026年1月',
    ipLocation: '浙江'
  },
  user_night: {
    id: 'user_night',
    name: '夜航巡游员',
    handle: 'night_voyager',
    avatar: '',
    bio: '收集深夜电台、黑胶唱片与城市边缘的灯火。',
    banner: '',
    verified: true,
    isFollowing: true,
    followersCount: 8920,
    followingCount: 120,
    postsCount: 156,
    likesCount: 45200,
    location: '成都',
    joinedDate: '2025年8月',
    ipLocation: '四川'
  },
  user_coffee: {
    id: 'user_coffee',
    name: '浅烘日记',
    handle: 'coffee_beans',
    avatar: '',
    bio: '记录每一杯手冲的风味轮，探寻城市街角的独立咖啡馆 ☕',
    banner: '',
    verified: false,
    isFollowing: false,
    followersCount: 1420,
    followingCount: 98,
    postsCount: 62,
    likesCount: 5670,
    location: '广州',
    joinedDate: '2026年2月',
    ipLocation: '广东'
  }
}

// 话题热榜数据
export const mockForumTopics = ref<ForumTopic[]>([
  { id: 'topic_1', name: '今日份的咖啡时刻', tag: '今日份的咖啡时刻', hotScore: '24.8万', postsCount: 1420, description: '分享你手边的一杯温度与香气。' },
  { id: 'topic_2', name: '城市散步与胶片日记', tag: '城市散步与胶片日记', hotScore: '18.2万', postsCount: 980, description: '用镜头定格街头转角的光影。' },
  { id: 'topic_3', name: '深夜循环歌单', tag: '深夜循环歌单', hotScore: '15.6万', postsCount: 3200, description: '哪一首歌陪你走过长夜？' },
  { id: 'topic_4', name: '猫猫迷惑行为大赏', tag: '猫猫迷惑行为大赏', hotScore: '12.4万', postsCount: 4520, description: '记录毛孩子那些令人费解的可爱瞬间。' },
  { id: 'topic_5', name: '书房一角与阅读随想', tag: '书房一角与阅读随想', hotScore: '9.8万', postsCount: 610, description: '安静翻开一本书的治愈时光。' }
])

// 初始信息流帖子种子数据（覆盖纯文字、单图、多图、长文、引用等多种形态）
export const mockForumPosts = ref<ForumPost[]>([
  {
    id: 'post_1',
    author: mockForumUsers.user_lin,
    type: 'multi-image',
    content: '雨后的梧桐树叶落了一地，空气里有泥土和湿润的木质香气。带了胶片机出门，洗出来的色调让人想起很多年前的秋天。',
    topics: ['城市散步与胶片日记', '今日份的咖啡时刻'],
    media: [
      { id: 'm1', url: '/dove.jpg', aspectRatio: 1 },
      { id: 'm2', url: '/pwa-icon.jpg', aspectRatio: 1 },
      { id: 'm3', url: '/dove.jpg', aspectRatio: 1 }
    ],
    likeCount: 184,
    commentCount: 29,
    shareCount: 14,
    viewCount: 2340,
    isLiked: false,
    isBookmarked: false,
    createdAt: '10分钟前'
  },
  {
    id: 'post_2',
    author: mockForumUsers.user_momo,
    type: 'text',
    content: '有时候觉得，在阳台看日落的那二十分钟，是整座城市最温柔的时刻。车流慢下来，云层从粉橘色渐变到灰蓝，整个人好像也被重新充满电了。',
    topics: [],
    likeCount: 312,
    commentCount: 45,
    shareCount: 22,
    viewCount: 4120,
    isLiked: true,
    isBookmarked: false,
    createdAt: '42分钟前'
  },
  {
    id: 'post_3',
    author: mockForumUsers.user_night,
    type: 'quote',
    content: '非常赞同这段对空间感的描摹。真正的安静不是没有声音，而是所有的声音都在它们合适的位置上。',
    quote: {
      id: 'quote_src_1',
      author: mockForumUsers.user_lin,
      content: '雨后的梧桐树叶落了一地，空气里有泥土和湿润的木质香气。带了胶片机出门，洗出来的色调让人想起很多年前的秋天。',
      createdAt: '1小时前'
    },
    topics: ['书房一角与阅读随想'],
    likeCount: 96,
    commentCount: 12,
    shareCount: 8,
    viewCount: 1560,
    isLiked: false,
    isBookmarked: true,
    createdAt: '2小时前'
  },
  {
    id: 'post_4',
    author: mockForumUsers.user_coffee,
    type: 'single-image',
    content: '今天尝试了一款埃塞俄比亚的花魁，浅度烘焙。研磨的一瞬间花果香扑鼻，入口有明显的柑橘与茉莉清甜，尾段泛着蜂蜜般的余韵。好豆子果然能点亮一整天的心情。',
    topics: ['今日份的咖啡时刻'],
    media: [
      { id: 'm4', url: '/dove.jpg', aspectRatio: 1.33 }
    ],
    likeCount: 524,
    commentCount: 68,
    shareCount: 35,
    viewCount: 7800,
    isLiked: false,
    isBookmarked: false,
    createdAt: '3小时前'
  }
])

// 模拟评论字典
export const mockForumComments = ref<Record<string, ForumComment[]>>({
  post_1: [
    {
      id: 'c_1',
      postId: 'post_1',
      author: mockForumUsers.user_momo,
      content: '最后一张的构图好棒！光影抓得恰到好处 👍',
      likeCount: 12,
      isLiked: false,
      createdAt: '8分钟前',
      replies: [
        {
          id: 'c_1_1',
          postId: 'post_1',
          author: mockForumUsers.user_lin,
          content: '谢谢莫莫！当时刚好有一束斜阳穿过树梢，运气很好。',
          likeCount: 4,
          isLiked: false,
          createdAt: '5分钟前',
          replyToUser: { id: 'user_momo', name: '莫莫不说话' }
        }
      ]
    },
    {
      id: 'c_2',
      postId: 'post_1',
      author: mockForumUsers.user_night,
      content: '胶片的颗粒感果然有着数码无法替代的呼吸感。',
      likeCount: 7,
      isLiked: true,
      createdAt: '6分钟前'
    }
  ]
})

// 模拟私信列表
export const mockForumConversations = ref<ForumConversation[]>([
  {
    id: 'conv_1',
    user: mockForumUsers.user_lin,
    lastMessage: '下次去那家复古胶片馆可以一起呀！',
    lastMessageTime: '14:20',
    unreadCount: 1
  },
  {
    id: 'conv_2',
    user: mockForumUsers.user_coffee,
    lastMessage: '那款豆子的烘焙曲线我发你一份参考。',
    lastMessageTime: '昨天',
    unreadCount: 0
  }
])

// 模拟私信对话记录
export const mockForumDirectMessages = ref<Record<string, ForumDirectMessage[]>>({
  user_lin: [
    { id: 'dm_1', senderId: 'user_lin', receiverId: 'user_self', content: '哈喽！看到你刚刚给我的照片点赞啦～', createdAt: '14:15' },
    { id: 'dm_2', senderId: 'user_self', receiverId: 'user_lin', content: '拍得很棒！色调很有胶片质感。', createdAt: '14:18', isSelf: true },
    { id: 'dm_3', senderId: 'user_lin', receiverId: 'user_self', content: '下次去那家复古胶片馆可以一起呀！', createdAt: '14:20' }
  ]
})

export function useForum() {
  // 当前全局路由栈（支持单 App 内部无刷新导航）
  // tab: 'feed' | 'discover' | 'messages' | 'profile'
  const activeTab = ref<'feed' | 'discover' | 'messages' | 'profile'>('feed')
  
  // 页面堆栈机制（支持进入 帖子详情、查看他人主页、私聊页面、搜索页、发布页等）
  type ForumRoute = 
    | { name: 'tab' }
    | { name: 'post_detail'; postId: string }
    | { name: 'user_profile'; userId: string }
    | { name: 'chat_room'; userId: string }
    | { name: 'search' }
    | { name: 'publish' }

  const routeStack = ref<ForumRoute[]>([{ name: 'tab' }])
  const currentRoute = computed(() => routeStack.value[routeStack.value.length - 1])

  const pushRoute = (route: ForumRoute) => {
    routeStack.value.push(route)
  }

  const popRoute = () => {
    if (routeStack.value.length > 1) {
      routeStack.value.pop()
    }
  }

  const resetToTab = (tabName: 'feed' | 'discover' | 'messages' | 'profile') => {
    activeTab.value = tabName
    routeStack.value = [{ name: 'tab' }]
  }

  // 帖子交互点赞
  const toggleLikePost = (postId: string) => {
    const post = mockForumPosts.value.find(p => p.id === postId)
    if (post) {
      post.isLiked = !post.isLiked
      post.likeCount += post.isLiked ? 1 : -1
    }
  }

  // 帖子收藏
  const toggleBookmarkPost = (postId: string) => {
    const post = mockForumPosts.value.find(p => p.id === postId)
    if (post) {
      post.isBookmarked = !post.isBookmarked
    }
  }

  // 关注/取消关注用户
  const toggleFollowUser = (userId: string) => {
    const user = mockForumUsers[userId] || (currentForumUser.value.id === userId ? currentForumUser.value : null)
    if (user) {
      user.isFollowing = !user.isFollowing
      user.followersCount += user.isFollowing ? 1 : -1
    }
  }

  // 发布新帖子
  const publishNewPost = (postData: Partial<ForumPost>) => {
    const newPost: ForumPost = {
      id: `post_${Date.now()}`,
      author: currentForumUser.value,
      type: postData.type || 'text',
      content: postData.content || '',
      topics: postData.topics || [],
      media: postData.media || [],
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      viewCount: 1,
      isLiked: false,
      isBookmarked: false,
      createdAt: '刚刚',
      ...postData
    }
    mockForumPosts.value.unshift(newPost)
    currentForumUser.value.postsCount += 1
    popRoute()
  }

  // 发送评论
  const addComment = (postId: string, content: string, replyTo?: { id: string; name: string }) => {
    if (!mockForumComments.value[postId]) {
      mockForumComments.value[postId] = []
    }
    const newComment: ForumComment = {
      id: `c_${Date.now()}`,
      postId,
      author: currentForumUser.value,
      content,
      likeCount: 0,
      isLiked: false,
      createdAt: '刚刚',
      replyToUser: replyTo
    }
    mockForumComments.value[postId].unshift(newComment)
    const post = mockForumPosts.value.find(p => p.id === postId)
    if (post) post.commentCount += 1
  }

  // 发送私信
  const sendDirectMessage = (targetUserId: string, content: string) => {
    if (!mockForumDirectMessages.value[targetUserId]) {
      mockForumDirectMessages.value[targetUserId] = []
    }
    const msg: ForumDirectMessage = {
      id: `dm_${Date.now()}`,
      senderId: currentForumUser.value.id,
      receiverId: targetUserId,
      content,
      createdAt: '刚刚',
      isSelf: true
    }
    mockForumDirectMessages.value[targetUserId].push(msg)

    // 更新或创建对话列表项
    const conv = mockForumConversations.value.find(c => c.user.id === targetUserId)
    if (conv) {
      conv.lastMessage = content
      conv.lastMessageTime = '刚刚'
    } else {
      const targetUser = mockForumUsers[targetUserId]
      if (targetUser) {
        mockForumConversations.value.unshift({
          id: `conv_${Date.now()}`,
          user: targetUser,
          lastMessage: content,
          lastMessageTime: '刚刚',
          unreadCount: 0
        })
      }
    }
  }

  return {
    activeTab,
    routeStack,
    currentRoute,
    pushRoute,
    popRoute,
    resetToTab,
    currentForumUser,
    mockForumUsers,
    mockForumTopics,
    mockForumPosts,
    mockForumComments,
    mockForumConversations,
    mockForumDirectMessages,
    toggleLikePost,
    toggleBookmarkPost,
    toggleFollowUser,
    publishNewPost,
    addComment,
    sendDirectMessage
  }
}
