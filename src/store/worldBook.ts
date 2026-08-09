/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, watch } from 'vue'
import { readStoredJSON } from './utils'

const WORLD_BOOK_STORAGE_KEY = 'clingy_world_book'
const savedWorldBook = readStoredJSON<any[]>(WORLD_BOOK_STORAGE_KEY, [])

export type DepthPosition = 'front' | 'middle' | 'back' | 'custom'

export interface WorldBookEntry {
  id: string
  title: string
  content: string
  updatedAt: number
  enabled: boolean
  light: 'blue' | 'green'
  keywords: string
  overrideSettings: boolean
  position: DepthPosition
  depth: number
  weight: number
}

export interface WorldBookGroup {
  id: string
  name: string
}

export interface WorldBook {
  id: string
  type: 'book' | 'folder'
  groupIds?: string[]
  title: string
  author?: string
  tags?: string[]
  rating?: number
  coverColor: string
  coverImage?: string
  bgImage?: string
  bgBlur?: number
  updatedAt: number
  enabled: boolean
  globalPosition: DepthPosition
  globalDepth: number
  globalWeight: number
  entries: WorldBookEntry[]
}

// 简单的数据迁移：如果旧数据没有 entries 或 type，进行补充
const migrateWorldBooks = (data: any[]): WorldBook[] => {
  return data.map(book => {
    const migrated: WorldBook = {
      id: book.id || Date.now().toString(),
      type: book.type || 'book', // 默认为书本
      groupIds: book.groupIds || [],
      title: book.title || '未命名',
      author: book.author || '',
      tags: book.tags || [],
      rating: book.rating || 0.0,
      coverColor: book.coverColor || '#F2E8E3', // INS风默认奶杏色
      coverImage: book.coverImage || '',
      bgImage: book.bgImage || '',
      bgBlur: book.bgBlur ?? 40,
      updatedAt: book.updatedAt || Date.now(),
      enabled: book.enabled !== false, // 默认开启
      globalPosition: book.globalPosition || 'middle',
      globalDepth: book.globalDepth ?? 0,
      globalWeight: book.globalWeight ?? 1,
      entries: (book.entries || []).map((e: any) => ({
        id: e.id || Date.now().toString() + '_entry',
        title: e.title || '未命名',
        content: e.content || '',
        updatedAt: e.updatedAt || Date.now(),
        enabled: e.enabled !== false,
        light: e.light || 'blue',
        keywords: e.keywords || '',
        overrideSettings: e.overrideSettings || false,
        position: e.position || 'middle',
        depth: e.depth ?? 0,
        weight: e.weight ?? 1
      }))
    }
    
    // 如果存在旧版的 content 字段，转为条目
    if (!book.entries && book.content) {
      migrated.entries = [{
        id: Date.now().toString() + '_entry',
        title: '默认条目',
        content: book.content,
        updatedAt: Date.now(),
        enabled: true,
        light: 'blue',
        keywords: '',
        overrideSettings: false,
        position: 'middle',
        depth: 0,
        weight: 1
      }]
    }
    return migrated
  })
}

const initialWorldBooks: WorldBook[] = Array.isArray(savedWorldBook) && savedWorldBook.length > 0 
  ? migrateWorldBooks(savedWorldBook) 
  : [
      { 
        id: '1', 
        type: 'book' as const,
        groupIds: [],
        title: '世界观', 
        author: '',
        tags: ['设定'],
        rating: 5.0,
        coverColor: '#F2E8E3',
        coverImage: '',
        bgImage: '',
        bgBlur: 40,
        enabled: true,
        globalPosition: 'middle',
        globalDepth: 0,
        globalWeight: 1,
        updatedAt: Date.now(),
        entries: [
          { 
            id: 'entry_1', 
            title: '背景设定', 
            content: '在这里写下关于这个世界的背景设定...', 
            updatedAt: Date.now(),
            enabled: true,
            light: 'blue',
            keywords: '',
            overrideSettings: false,
            position: 'middle',
            depth: 0,
            weight: 1
          }
        ]
      }
    ]

export const worldBooks = reactive<WorldBook[]>(initialWorldBooks)

watch(worldBooks, (newVal) => {
  localStorage.setItem(WORLD_BOOK_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const WORLD_BOOK_GROUPS_KEY = 'clingy_world_book_groups'
const savedWorldBookGroups = readStoredJSON<any[]>(WORLD_BOOK_GROUPS_KEY, [])
export const worldBookGroups = reactive<WorldBookGroup[]>(savedWorldBookGroups)

watch(worldBookGroups, (newVal) => {
  localStorage.setItem(WORLD_BOOK_GROUPS_KEY, JSON.stringify(newVal))
}, { deep: true })
