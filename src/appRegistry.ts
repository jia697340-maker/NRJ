/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export interface AppRegistryItem {
  id: string
  name: string
  icon: string
  color: string
  available: boolean
  allowCustomFont: boolean
}

// 桌面、图标管理与字体作用范围共用此清单。以后新增 APP 只需在这里注册一次。
export const appRegistry: AppRegistryItem[] = [
  { id: 'appearance', name: '外观设置', icon: '<span class="text-icon">颜</span>', color: '#ffffff', available: true, allowCustomFont: true },
  { id: 'appearance_wardrobe', name: '外观衣柜', icon: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14v15H5z"/><path d="M12 5v15M8.5 9h.01M15.5 9h.01M9 2h6v3"/></svg>', color: '#ffffff', available: true, allowCustomFont: true },
  { id: 'world_book', name: '世界书', icon: '<span class="text-icon">书</span>', color: '#ffffff', available: true, allowCustomFont: true },
  { id: 'settings', name: '高级设置', icon: '<span class="text-icon">设</span>', color: '#ffffff', available: true, allowCustomFont: true },
  { id: 'messages', name: '短信', icon: '<span class="text-icon">信</span>', color: '#ffffff', available: true, allowCustomFont: true },
  { id: 'api_settings', name: 'API设置', icon: '<span class="text-icon">A</span>', color: '#ffffff', available: true, allowCustomFont: true },
  { id: 'chat', name: '聊天', icon: '<span class="text-icon">聊</span>', color: '#ffffff', available: true, allowCustomFont: true },
  { id: 'delivery', name: '投递', icon: '<span class="text-icon">投</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'wallet', name: '钱包', icon: '<span class="text-icon">包</span>', color: '#ffffff', available: true, allowCustomFont: true },
  { id: 'app_store', name: '应用商城', icon: '<span class="text-icon">商</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'couple_space', name: '情侣空间', icon: '<span class="text-icon">空</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'forum', name: '论坛', icon: '<span class="text-icon">论</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'live', name: '直播', icon: '<span class="text-icon">播</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'voice_access', name: '语音接入', icon: '<span class="text-icon">音</span>', color: '#ffffff', available: true, allowCustomFont: true },
  { id: 'image_access', name: '图像接入', icon: '<span class="text-icon">图</span>', color: '#ffffff', available: true, allowCustomFont: true },
  { id: 'music', name: '音乐', icon: '<span class="text-icon">乐</span>', color: '#ffffff', available: true, allowCustomFont: true },
  { id: 'widget_beautify', name: '小组件美化', icon: '<span class="text-icon">美</span>', color: '#ffffff', available: true, allowCustomFont: true },
  { id: 'character_workshop', name: '角色工坊', icon: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l1.5 4.1 4.1 1.5-4.1 1.5-1.5 4.1-1.5-4.1-4.1-1.5 4.1-1.5L12 3.5z"/><path d="M18.1 14.5l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1z"/><path d="M5.5 15.2l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6z"/></svg>', color: '#ffffff', available: true, allowCustomFont: true },
  { id: 'persona_workshop', name: '人设工坊', icon: '<span class="text-icon">我</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'bubble_dressup', name: '气泡装扮', icon: '<span class="text-icon">泡</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'character_phone', name: 'TA的手机', icon: '<span class="text-icon">机</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'watch_together', name: '共赏空间', icon: '<span class="text-icon">赏</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'timebox', name: '时间盒', icon: '<span class="text-icon">盒</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'mcp', name: 'MCP', icon: '<span class="text-icon">M</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'text_game', name: '文游', icon: '<span class="text-icon">游</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'book_store', name: '书城', icon: '<span class="text-icon">城</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'game', name: '游戏', icon: '<span class="text-icon">游</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'bubble', name: '泡泡', icon: '<span class="text-icon">泡</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'mall', name: '商城', icon: '<span class="text-icon">商</span>', color: '#ffffff', available: false, allowCustomFont: true },
  { id: 'fate', name: '缘分', icon: '<span class="text-icon">缘</span>', color: '#ffffff', available: false, allowCustomFont: true }
]

export const availableAppIds = new Set(appRegistry.filter(app => app.available).map(app => app.id))
