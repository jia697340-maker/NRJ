/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, watch } from 'vue'
import { readStoredJSON } from './utils'

const COT_STORAGE_KEY = 'clingy_cot_settings'
const savedCotSettings = readStoredJSON<Record<string, any>>(COT_STORAGE_KEY, {})

export interface CotItem {
  id: string
  name: string
  position: 'system_top' | 'system_middle' | 'system_bottom' | 'assistant_prefill'
  role: 'system' | 'assistant' | 'user'
  content: string
  enabled: boolean
}

// 默认的 MOM 嵌套思维链配置
const defaultCotItems: CotItem[] = [
  {
    id: 'cot_default_1',
    name: '思维链开启引导 (头)',
    position: 'system_top',
    role: 'system',
    content: '【强制思考与回复格式】\n每次回复前，必须严格按照以下嵌套结构进行思考和输出：\n[incipere]\n<thinking>\n',
    enabled: true
  },
  {
    id: 'cot_default_3',
    name: '格式闭合 (尾)',
    position: 'system_bottom',
    role: 'system',
    content: '</thinking>\n[finire]\n<msg>\n你的最终回复正文\n</msg>',
    enabled: true
  },
  {
    id: 'cot_default_4',
    name: '思维链触发器',
    position: 'assistant_prefill',
    role: 'assistant',
    content: '[incipere]\n<thinking>\n',
    enabled: true
  }
]

export const cotSettings = reactive({
  enabled: savedCotSettings.enabled ?? false,
  mode: savedCotSettings.mode ?? 'skip', // 'skip' | 'custom' 保留兼容性
  showThinking: savedCotSettings.showThinking ?? true,
  items: (savedCotSettings.items || defaultCotItems) as CotItem[]
})

// 数据迁移与污染清洗逻辑
if (cotSettings.items) {
  let needsFix = false

  // 0. 移除旧的系统默认“中”条目 (cot_default_2)
  const oldMiddleIndex = cotSettings.items.findIndex(i => i.id === 'cot_default_2')
  if (oldMiddleIndex > -1) {
    cotSettings.items.splice(oldMiddleIndex, 1)
    needsFix = true
  }

  // 1. 清洗 [object Object] 等乱码污染
  cotSettings.items.forEach(item => {
    if (typeof item.content === 'string' && item.content.includes('[object Object]')) {
      item.content = item.content.replace(/\[object Object\]/g, '').replace(/,/g, '').trim()
      needsFix = true
    }
  })

  // 2. 检查并热修复为分离式头尾结构 (头包含 <thinking>, 尾包含 </thinking>)
  const topItem = cotSettings.items.find(i => i.position === 'system_top')
  const bottomItem = cotSettings.items.find(i => i.position === 'system_bottom')

  if (topItem && !topItem.content.includes('<thinking>')) {
    topItem.content = '【强制思考与回复格式】\n每次回复前，必须严格按照以下嵌套结构进行思考和输出：\n[incipere]\n<thinking>\n'
    needsFix = true
  }

  if (bottomItem && !bottomItem.content.includes('</thinking>')) {
    bottomItem.content = '</thinking>\n[finire]\n<msg>\n你的最终回复正文\n</msg>'
    needsFix = true
  }

  // 若发生了修复，立即回写本地避免下一次被覆盖
  if (needsFix) {
    localStorage.setItem(COT_STORAGE_KEY, JSON.stringify(cotSettings))
  }
}

watch(cotSettings, (newVal) => {
  localStorage.setItem(COT_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })
