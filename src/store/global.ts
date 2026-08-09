/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { reactive, watch } from 'vue'
import { readStoredJSON } from './utils'

const STORAGE_KEY = 'clingy_global_settings'
const savedSettings = readStoredJSON<Record<string, any>>(STORAGE_KEY, {})

export const globalSettings = reactive({
  darkMode: savedSettings.darkMode ?? false,
  nightShift: savedSettings.nightShift ?? false,
  accentColor: savedSettings.accentColor ?? '#007aff',
  wallpaper: savedSettings.wallpaper ?? 'default',
  lockScreenWallpaper: savedSettings.lockScreenWallpaper ?? 'default',
  lockScreenStyle: savedSettings.lockScreenStyle ?? 'modern',
  chatListWallpaper: savedSettings.chatListWallpaper ?? 'default',
  showStatusBar: savedSettings.showStatusBar ?? true,
  showNotch: savedSettings.showNotch ?? true,
  chargingBoltInside: savedSettings.chargingBoltInside ?? false,
  showDockAppNames: savedSettings.showDockAppNames ?? false,
  classicTheme: savedSettings.classicTheme ?? 'default',
  enableSlider: savedSettings.enableSlider ?? false,
  sliderIcon: savedSettings.sliderIcon ?? '♥',
  enableLockScreen: savedSettings.enableLockScreen ?? false,
  unlockMethod: savedSettings.unlockMethod ?? 'swipe',
  unlockDigit: savedSettings.unlockDigit ?? '1234',
  unlockQaQuestion: savedSettings.unlockQaQuestion ?? '我是你的什么人？',
  unlockQaAnswer: savedSettings.unlockQaAnswer ?? '粘人精'
})

watch(globalSettings, (newVal) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })

const APP_STATS_STORAGE_KEY = 'clingy_app_stats'
const savedAppStats = readStoredJSON<Record<string, any>>(APP_STATS_STORAGE_KEY, {})

export const appStats = reactive({
  apiCalls: savedAppStats.apiCalls ?? 0,
  apiFailures: savedAppStats.apiFailures ?? 0,
  apiTotalTime: savedAppStats.apiTotalTime ?? 0, // 毫秒
  usageTime: savedAppStats.usageTime ?? 0, // 秒
  firstLaunch: savedAppStats.firstLaunch ?? Date.now(),
  messagesSent: savedAppStats.messagesSent ?? 0,
  latestNightChatTime: savedAppStats.latestNightChatTime ?? -1, // 分钟数(0-360)，记录0点-6点的最晚记录
  lastChatDate: savedAppStats.lastChatDate ?? '', // YYYY-MM-DD
  currentStreak: savedAppStats.currentStreak ?? 0,
  maxStreak: savedAppStats.maxStreak ?? 0,
  dailyMessageCount: savedAppStats.dailyMessageCount ?? 0,
  maxDailyMessages: savedAppStats.maxDailyMessages ?? 0
})

watch(appStats, (newVal) => {
  localStorage.setItem(APP_STATS_STORAGE_KEY, JSON.stringify(newVal))
}, { deep: true })
