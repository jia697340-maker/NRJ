/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { ForumContentKind } from '../types/forum'

export const forumContentKindLabels: Record<ForumContentKind, string> = {
  thought: '碎碎念', life: '日常生活', 'image-share': '图片分享', question: '提问', help: '求助', complaint: '吐槽', experience: '经历', discussion: '讨论/长文', link: '链接分享', poll: '投票', anonymous: '匿名', 'circle-topic': '圈子话题'
}

export const forumContentKinds = Object.entries(forumContentKindLabels).map(([id, label]) => ({ id: id as ForumContentKind, label }))
