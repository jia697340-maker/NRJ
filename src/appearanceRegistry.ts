/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */

export type AppearanceCategoryId = 'characterProfile'

export interface AppearanceStyleDefinition {
  id: string
  name: string
  keywords: string
  description: string
}

export interface AppearanceCategoryDefinition {
  id: AppearanceCategoryId
  name: string
  description: string
  styles: AppearanceStyleDefinition[]
}

export const appearanceCategories: AppearanceCategoryDefinition[] = [
  {
    id: 'characterProfile',
    name: '角色主页',
    description: '角色资料、近况与公开关系的呈现方式',
    styles: [
      { id: 'default', name: '原版主页', keywords: '编辑感 · 留白', description: '保留当前角色主页的完整结构与交互。' },
      { id: 'magazine', name: '私人杂志', keywords: '摄影集 · 冷白', description: '让封面与近况照片成为主页的主要视觉。' },
      { id: 'letter', name: '私人信笺', keywords: '纸页 · 档案', description: '以照片纸、细线和记录感整理角色资料。' }
    ]
  }
]

export const appearanceCategoryMap = Object.fromEntries(appearanceCategories.map(category => [category.id, category])) as Record<AppearanceCategoryId, AppearanceCategoryDefinition>

export const getAppearanceStyle = (categoryId: AppearanceCategoryId, styleId: string) => (
  appearanceCategoryMap[categoryId].styles.find(style => style.id === styleId) || appearanceCategoryMap[categoryId].styles[0]
)
