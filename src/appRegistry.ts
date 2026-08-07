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
  { id: 'wardrobe', name: '衣柜', icon: '<span class="text-icon">衣</span>', color: '#ffffff', available: true, allowCustomFont: true }
]

export const availableAppIds = new Set(appRegistry.filter(app => app.available).map(app => app.id))

