/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { appStats, apiSettings } from '../../store'
import { apiLogger } from '../../services/apiLogger'
import ApiLogConfirmModal from './modals/ApiLogConfirmModal.vue'
import ApiLogViewerModal from './modals/ApiLogViewerModal.vue'

const activeTab = ref<'stats' | 'api'>('stats')
const showConfirmModal = ref(false)
const showViewerModal = ref(false)

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

const handleToggleLogging = () => {
  if (!apiSettings.enableApiLogging) {
    showConfirmModal.value = true
  } else {
    // 关闭时自动清除日志
    apiSettings.enableApiLogging = false
    apiLogger.clearLogs()
  }
}

const confirmEnableLogging = () => {
  apiSettings.enableApiLogging = true
  showConfirmModal.value = false
}

</script>

<template>
  <div class="plugin-panel">
    <div class="panel-header">
      <div class="header-top">
        <h2>无用统计</h2>
        <div class="panel-tabs">
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'stats' }"
            @click="activeTab = 'stats'"
          >
            趣味统计
          </button>
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'api' }"
            @click="activeTab = 'api'"
          >
            API 追踪
          </button>
        </div>
      </div>
      <p class="subtitle" v-if="activeTab === 'stats'">记录一些没有什么实际用途，但偶尔看看会觉得有趣的本地数据。</p>
      <p class="subtitle" v-else>清晰了解你的每一次 API 请求，排查调用去向，不花一分冤枉钱。</p>
    </div>

    <div class="stats-grid" v-if="activeTab === 'stats'">
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
        <div class="stat-icon heart">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </div>
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

    <div class="api-guide-wrapper" v-else>
      
      <!-- 详细日志控制面板 -->
      <div class="api-logger-control">
        <div class="logger-header">
          <div class="logger-title">
            <h3>详细 API 追踪</h3>
            <span class="status-badge" :class="{ active: apiSettings.enableApiLogging }">
              {{ apiSettings.enableApiLogging ? '记录中' : '未开启' }}
            </span>
          </div>
          <label class="toggle-switch">
            <input 
              type="checkbox" 
              :checked="apiSettings.enableApiLogging"
              @change="handleToggleLogging"
            >
            <span class="slider"></span>
          </label>
        </div>
        
        <Transition name="fade">
          <div v-if="apiSettings.enableApiLogging" class="logger-settings">
            <div class="setting-item">
              <label>最大保存条数</label>
              <input 
                type="number" 
                v-model.number="apiSettings.apiLogMaxCount" 
                min="100" 
                max="5000"
                class="count-input"
              >
            </div>
            <button class="view-btn" @click="showViewerModal = true">
              查看历史记录
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </Transition>
      </div>

      <div class="api-guide-card">
        <div class="guide-header">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h3>常规聊天互动</h3>
        </div>
        <div class="guide-content">
          <p>这是最基础的调用。<strong>你每发一条消息</strong>，收到回复时，会产生 1 次 API 调用。</p>
        </div>
      </div>

      <div class="api-guide-card">
        <div class="guide-header">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
          <h3>发送图片 (视觉识别)</h3>
        </div>
        <div class="guide-content">
          <p>发送图片时，为了识别图片内容，会额外发起 1 次视觉模型调用。</p>
        </div>
      </div>

      <div class="api-guide-card highlight">
        <div class="guide-header">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          </div>
          <h3>对话归档 (自动总结)</h3>
        </div>
        <div class="guide-content">
          <p>当聊天记录达到阈值时，系统会在后台自动总结历史对话，产生 1 次调用。</p>
        </div>
      </div>

      <div class="api-guide-card">
        <div class="guide-header">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
          </div>
          <h3>朋友圈互动 (自主交互)</h3>
        </div>
        <div class="guide-content">
          <p>进行朋友圈点赞、评论或发布时，为了分析并决定是否回复，会产生 1 次调用。</p>
        </div>
      </div>

      <div class="api-guide-card highlight-blue">
        <div class="guide-header">
          <div class="guide-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
              <path d="M2 12h20"></path>
            </svg>
          </div>
          <h3>构建高级记忆 (向量数据库)</h3>
        </div>
        <div class="guide-content">
          <p>开启“向量记忆”后，系统会将对话频繁转化为向量特征，产生小额调用。</p>
        </div>
      </div>
    </div>

    <!-- 弹窗 -->
    <ApiLogConfirmModal 
      :show="showConfirmModal"
      @close="showConfirmModal = false"
      @confirm="confirmEnableLogging"
    />
    
    <ApiLogViewerModal 
      :show="showViewerModal"
      @close="showViewerModal = false"
    />
  </div>
</template>

<style scoped>
.header-top {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-tabs {
  display: flex;
  background: var(--sys-bg-tertiary);
  border-radius: 8px;
  padding: 4px;
  gap: 4px;
}

.tab-btn {
  border: none;
  background: transparent;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--card-bg-solid);
  color: var(--text-primary);
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

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
  margin: 0;
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

.api-guide-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: fadeUp 0.3s ease;
}

.api-logger-control {
  background: var(--card-bg-solid);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
  margin-bottom: 8px;
}

.logger-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logger-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logger-title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.status-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--sys-bg-tertiary);
  color: var(--text-secondary);
}

.status-badge.active {
  background: rgba(46, 213, 115, 0.1);
  color: #2ed573;
}

.logger-settings {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.count-input {
  width: 70px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--sys-bg-tertiary);
  color: var(--text-primary);
  font-size: 13px;
  text-align: center;
}

.count-input:focus {
  outline: none;
  border-color: var(--primary-color, #007aff);
}

.view-btn {
  background: var(--primary-color, #007aff);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: opacity 0.2s;
}

.view-btn:hover {
  opacity: 0.9;
}

/* Switch Styles */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}
.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e5e5ea;
  transition: .3s;
  border-radius: 24px;
}
.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
input:checked + .slider {
  background-color: var(--primary-color, #34c759);
}
input:checked + .slider:before {
  transform: translateX(20px);
}

.api-guide-card {
  background: var(--card-bg-solid);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.api-guide-card.highlight {
  border-color: rgba(255, 107, 129, 0.3);
  background: linear-gradient(135deg, rgba(255, 107, 129, 0.03) 0%, rgba(255, 107, 129, 0.01) 100%);
}

.api-guide-card.highlight-blue {
  border-color: rgba(30, 144, 255, 0.3);
  background: linear-gradient(135deg, rgba(30, 144, 255, 0.03) 0%, rgba(30, 144, 255, 0.01) 100%);
}

.guide-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.guide-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
}

.guide-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.guide-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.guide-content p {
  margin: 0 0 6px 0;
}

.guide-content p:last-child {
  margin-bottom: 0;
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
