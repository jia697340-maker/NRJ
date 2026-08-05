/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed } from 'vue'
import { appStats } from '../../store'

// 格式化使用时长 (将秒数转换为 00时00分00秒)
const formatUsageTime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  if (hours > 0) {
    return `${hours}小时 ${minutes}分钟 ${seconds}秒`
  } else if (minutes > 0) {
    return `${minutes}分钟 ${seconds}秒`
  } else {
    return `${seconds}秒`
  }
}

// 格式化首次启动日期
const formatFirstLaunch = (timestamp: number) => {
  const date = new Date(timestamp)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

// 计算平均响应时长
const avgResponseTime = computed(() => {
  if (appStats.apiCalls === 0) return '0 毫秒'
  const avg = appStats.apiTotalTime / appStats.apiCalls
  return `${Math.round(avg)} 毫秒`
})

// 计算 API 成功率
const successRate = computed(() => {
  if (appStats.apiCalls === 0) return '100%'
  const success = appStats.apiCalls - appStats.apiFailures
  const rate = (success / appStats.apiCalls) * 100
  return `${rate.toFixed(1)}%`
})

// 计算天数
const daysTogether = computed(() => {
  const now = Date.now()
  const diffTime = Math.abs(now - appStats.firstLaunch)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
})

// 格式化最晚修仙时间
const formatNightTime = computed(() => {
  if (appStats.latestNightChatTime === -1) return '尚未修仙'
  const h = Math.floor(appStats.latestNightChatTime / 60).toString().padStart(2, '0')
  const m = (appStats.latestNightChatTime % 60).toString().padStart(2, '0')
  return `凌晨 ${h}:${m}`
})

</script>

<template>
  <div class="plugin-panel">
    <div class="panel-header">
      <h2>无用统计</h2>
      <p class="subtitle">记录一些没有什么实际用途，但偶尔看看会觉得有趣的本地数据。</p>
    </div>

    <div class="stats-grid">
      <!-- 碎碎念总数 -->
      <div class="stat-card">
        <div class="stat-icon chat">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-title">碎碎念总计</div>
          <div class="stat-value">{{ appStats.messagesSent }} <span class="unit">条</span></div>
          <div class="stat-desc">你对 TA 说过的所有话语</div>
        </div>
      </div>

      <!-- 单日心流 -->
      <div class="stat-card">
        <div class="stat-icon flow">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-title">单日最高心流</div>
          <div class="stat-value">{{ appStats.maxDailyMessages }} <span class="unit">条</span></div>
          <div class="stat-desc">聊得最火热的那天（今日已发：{{ appStats.dailyMessageCount }}）</div>
        </div>
      </div>

      <!-- 连续羁绊 -->
      <div class="stat-card highlight">
        <div class="stat-icon fire">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-title">最高连续羁绊</div>
          <div class="stat-value">{{ appStats.maxStreak }} <span class="unit">天</span></div>
          <div class="stat-desc">连续不间断的聊天天数（当前：{{ appStats.currentStreak }}）</div>
        </div>
      </div>

      <!-- 最晚修仙记录 -->
      <div class="stat-card">
        <div class="stat-icon moon">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-title">最晚修仙记录</div>
          <div class="stat-value">{{ formatNightTime }}</div>
          <div class="stat-desc">你们曾经多晚还在聊天</div>
        </div>
      </div>

      <!-- 陪伴卡片 -->
      <div class="stat-card highlight full-width">
        <div class="stat-icon heart">♥</div>
        <div class="stat-info">
          <div class="stat-title">相伴时光</div>
          <div class="stat-value">{{ formatUsageTime(appStats.usageTime) }}</div>
          <div class="stat-desc">自 {{ formatFirstLaunch(appStats.firstLaunch) }} 起，已相伴 {{ daysTogether }} 天</div>
        </div>
      </div>

      <!-- API 调用统计 -->
      <div class="stat-card">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-title">API 召唤次数</div>
          <div class="stat-value">{{ appStats.apiCalls }} <span class="unit">次</span></div>
          <div class="stat-desc">你一共向宇宙发出了多少次呼唤</div>
        </div>
      </div>

      <!-- API 失败统计 -->
      <div class="stat-card">
        <div class="stat-icon error">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-title">宇宙失联次数</div>
          <div class="stat-value">{{ appStats.apiFailures }} <span class="unit">次</span></div>
          <div class="stat-desc">成功穿透率为 {{ successRate }}</div>
        </div>
      </div>

      <!-- 平均响应时间 -->
      <div class="stat-card full-width">
        <div class="stat-icon time">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-title">平均跃迁耗时</div>
          <div class="stat-value">{{ avgResponseTime }}</div>
          <div class="stat-desc">TA 跨越光年回应你所需的平均时间</div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.plugin-panel {
  padding: 10px 0 30px 0;
  animation: fadeUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.panel-header {
  margin-bottom: 24px;
}

.panel-header h2 {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
  letter-spacing: 0.5px;
}

.subtitle {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.5;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-card {
  background: var(--card-bg-solid);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.02);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card.full-width {
  grid-column: span 2;
  flex-direction: row;
  align-items: center;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}

.stat-card.highlight {
  background: linear-gradient(135deg, rgba(255, 107, 129, 0.05) 0%, rgba(255, 107, 129, 0.01) 100%);
  border-color: rgba(255, 107, 129, 0.2);
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--sys-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.stat-icon.heart {
  color: #ff6b81;
  background: rgba(255, 107, 129, 0.1);
  font-size: 24px;
}

.stat-icon.error {
  color: #ff4757;
  background: rgba(255, 71, 87, 0.1);
}

.stat-icon.time {
  color: #1e90ff;
  background: rgba(30, 144, 255, 0.1);
}

.stat-icon.chat {
  color: #2ed573;
  background: rgba(46, 213, 115, 0.1);
}

.stat-icon.flow {
  color: #ffa502;
  background: rgba(255, 165, 2, 0.1);
}

.stat-icon.fire {
  color: #ff6348;
  background: rgba(255, 99, 72, 0.1);
}

.stat-icon.moon {
  color: #5352ed;
  background: rgba(83, 82, 237, 0.1);
}

.stat-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.stat-title {
  font-size: 13px;
  color: var(--text-tertiary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-card.full-width .stat-value {
  font-size: 22px;
}

.stat-value .unit {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: normal;
  margin-left: 2px;
}

.stat-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
  line-height: 1.4;
}
</style>
