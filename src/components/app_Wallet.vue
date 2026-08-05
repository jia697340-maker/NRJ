/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import { globalSettings } from '../store'

const emit = defineEmits(['close'])

const activeTab = ref('wallet') // wallet, stocks, mine

const accountInfo = ref({
  name: '--',
  id: '--',
  totalAsset: '0.00',
  todayIncome: '--',
  incomeRate: '--',
  stockMarketValue: '0.00',
  stockTodayIncome: '--',
  stockIncomeRate: '--'
})

const assetDistribution = [
  { label: '现金', amount: '0.00', percent: '0.0%', color: '#d1d1d6' },
  { label: '股票', amount: '0.00', percent: '0.0%', color: '#8e8e93' },
  { label: '基金', amount: '0.00', percent: '0.0%', color: '#aeaeb2' },
  { label: '其他', amount: '0.00', percent: '0.0%', color: '#e5e5ea' }
]
const recentTransactions = ref<any[]>([])
const stockList = ref<any[]>([])
const marketIndices = ref<any[]>([])

const handleBack = () => {
  emit('close')
}

// Generate simple SVG sparkline path
const generateSparkline = (points: number[]) => {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const width = 100
  const height = 30
  
  const mapped = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width
    const y = height - ((p - min) / range) * height
    return `${x},${y}`
  })
  
  return `M ${mapped.join(' L ')}`
}

const mainSparkline = generateSparkline([10, 15, 13, 20, 25, 22, 30])
const stockSparkline = generateSparkline([5, 8, 12, 10, 18, 24, 28])
</script>

<template>
  <div class="wallet-app" :class="{ 'dark-theme': globalSettings.darkMode }">
    <!-- ==================== 钱包 TAB ==================== -->
    <div class="tab-content" v-show="activeTab === 'wallet'">
      <div class="page-header">
        <h2 @click="handleBack" style="cursor: pointer;">钱包 <span class="subtitle">Wallet</span></h2>
        <div class="header-actions">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
        </div>
      </div>

      <div class="asset-card">
        <div class="card-title">总资产 (CNY) <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></div>
        <div class="card-main">
          <div class="asset-amount">{{ accountInfo.totalAsset }}</div>
          <div class="sparkline">
            <svg viewBox="0 -5 100 40" width="100%" height="40" preserveAspectRatio="none">
              <path :d="mainSparkline" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </div>
        </div>
        <div class="card-stats">
          <div class="stat-col">
            <div class="stat-label">今日收益</div>
            <div class="stat-val up">{{ accountInfo.todayIncome }}</div>
          </div>
          <div class="stat-col">
            <div class="stat-label">收益率</div>
            <div class="stat-val up">{{ accountInfo.incomeRate }}</div>
          </div>
        </div>
      </div>

      <div class="action-grid">
        <div class="action-item">
          <div class="a-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg></div>
          <span>充值</span>
        </div>
        <div class="action-item">
          <div class="a-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><polyline points="9 11 12 14 15 11"></polyline></svg></div>
          <span>提现</span>
        </div>
        <div class="action-item">
          <div class="a-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg></div>
          <span>转账</span>
        </div>
        <div class="action-item">
          <div class="a-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></div>
          <span>账单</span>
        </div>
      </div>

      <div class="section-block">
        <div class="section-header">
          <h3>资产分布</h3>
          <span class="more">更多 <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg></span>
        </div>
        <div class="distribution-content">
          <div class="donut-chart">
            <div class="donut-hole"></div>
          </div>
          <div class="dist-list">
            <div class="dist-item" v-for="(item, idx) in assetDistribution" :key="idx">
              <span class="dist-dot" :style="{ backgroundColor: item.color }"></span>
              <span class="d-label">{{ item.label }}</span>
              <span class="d-amount">{{ item.amount }}</span>
              <span class="d-pct">{{ item.percent }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="section-block">
        <h3>快捷功能</h3>
        <div class="quick-funcs">
          <div class="q-func-card">
            <div class="q-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg></div>
            <div class="q-info">
              <div class="q-title">银行卡</div>
              <div class="q-desc">管理您的银行卡</div>
            </div>
          </div>
          <div class="q-func-card">
            <div class="q-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></div>
            <div class="q-info">
              <div class="q-title">安全中心</div>
              <div class="q-desc">保障账户安全</div>
            </div>
          </div>
          <div class="q-func-card">
            <div class="q-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
            <div class="q-info">
              <div class="q-title">红包</div>
              <div class="q-desc">查看可用红包</div>
            </div>
          </div>
          <div class="q-func-card">
            <div class="q-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg></div>
            <div class="q-info">
              <div class="q-title">帮助与反馈</div>
              <div class="q-desc">常见问题解答</div>
            </div>
          </div>
        </div>
      </div>

      <div class="section-block">
        <div class="section-header">
          <h3>最近交易</h3>
          <span class="more">更多 <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg></span>
        </div>
        <div class="transaction-list">
          <div v-if="recentTransactions.length === 0" class="empty-placeholder">
            暂无交易记录
          </div>
          <div v-else class="tx-item" v-for="(tx, idx) in recentTransactions" :key="idx">
            <div class="tx-info">
              <div class="tx-title">{{ tx.title }}</div>
              <div class="tx-time">{{ tx.time }}</div>
            </div>
            <div class="tx-amount" :class="tx.type === 'in' ? 'tx-in' : 'tx-out'">
              {{ tx.amount }}
              <div class="tx-currency">CNY</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 股票 TAB ==================== -->
    <div class="tab-content" v-show="activeTab === 'stocks'">
      <div class="page-header">
        <h2 @click="handleBack" style="cursor: pointer;">股票 <span class="subtitle">Stocks</span></h2>
        <div class="header-actions">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>
      </div>

      <div class="section-block">
        <h3>我的持仓</h3>
        <div class="asset-card">
          <div class="card-title">总市值 (CNY)</div>
          <div class="card-main">
            <div class="asset-amount">{{ accountInfo.stockMarketValue }}</div>
            <div class="sparkline">
              <svg viewBox="0 -5 100 40" width="100%" height="40" preserveAspectRatio="none">
                <path :d="stockSparkline" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </div>
          </div>
          <div class="card-stats">
            <div class="stat-col">
              <div class="stat-label">今日收益</div>
              <div class="stat-val up">{{ accountInfo.stockTodayIncome }}</div>
            </div>
            <div class="stat-col">
              <div class="stat-label">收益率</div>
              <div class="stat-val up">{{ accountInfo.stockIncomeRate }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="action-grid">
        <div class="action-item">
          <div class="a-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></div>
          <span>买入</span>
        </div>
        <div class="action-item">
          <div class="a-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg></div>
          <span>卖出</span>
        </div>
        <div class="action-item">
          <div class="a-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg></div>
          <span>撤单</span>
        </div>
        <div class="action-item">
          <div class="a-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg></div>
          <span>持仓</span>
        </div>
      </div>

      <div class="section-block">
        <div class="section-header">
          <h3>持仓列表</h3>
          <span class="more">编辑</span>
        </div>
        <div class="stock-list">
          <div class="s-header">
            <span class="s-col-name">名称/代码</span>
            <span class="s-col-val">市值</span>
            <span class="s-col-rate">盈亏/收益率</span>
          </div>
          <div v-if="stockList.length === 0" class="empty-placeholder">
            暂无持仓
          </div>
          <div v-else class="s-item" v-for="(stock, idx) in stockList" :key="idx">
            <div class="s-col-name">
              <div class="s-name">{{ stock.name }}</div>
              <div class="s-code">{{ stock.code }}</div>
            </div>
            <div class="s-col-val">{{ stock.value }}</div>
            <div class="s-col-rate" :class="stock.isUp ? 'up' : 'down'">
              <div>{{ stock.profit }}</div>
              <div class="s-pct">{{ stock.rate }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="section-block">
        <h3>市场概览</h3>
        <div class="market-scroll">
          <div v-if="marketIndices.length === 0" class="empty-placeholder" style="width: 100%; text-align: left; padding: 4vw 0;">
            暂无市场数据
          </div>
          <div v-else class="market-card" v-for="(idx, i) in marketIndices" :key="i">
            <div class="m-name">{{ idx.name }}</div>
            <div class="m-val">{{ idx.value }}</div>
            <div class="m-rate" :class="idx.isUp ? 'up' : 'down'">{{ idx.rate }}</div>
            <div class="m-chart">
               <svg viewBox="0 0 50 20" width="100%" height="20" preserveAspectRatio="none">
                 <path d="M0,15 L10,10 L20,12 L30,5 L40,8 L50,2" fill="none" stroke="currentColor" stroke-width="1.5"></path>
               </svg>
            </div>
          </div>
        </div>
      </div>

      <div class="section-block">
        <div class="section-header">
          <h3>热门板块</h3>
          <span class="more">更多 <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg></span>
        </div>
        <div class="tag-list">
          <div class="tag-item">科技 <span class="tag-rate up">+2.45%</span></div>
          <div class="tag-item">金融 <span class="tag-rate up">+1.85%</span></div>
          <div class="tag-item">消费 <span class="tag-rate up">+1.25%</span></div>
          <div class="tag-item">医药 <span class="tag-rate up">+0.95%</span></div>
        </div>
      </div>
    </div>

    <!-- ==================== 我的 TAB ==================== -->
    <div class="tab-content" v-show="activeTab === 'mine'">
      <div class="page-header">
        <h2 @click="handleBack" style="cursor: pointer;">我的 <span class="subtitle">Mine</span></h2>
        <div class="header-actions">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" style="margin-left: 15px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </div>
      </div>

      <div class="user-profile-card">
        <div class="u-avatar">
          <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.5" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </div>
        <div class="u-info">
          <div class="u-name-line">
            <span class="u-name">{{ accountInfo.name }}</span>
            <span class="u-badge">未认证</span>
          </div>
          <div class="u-id">ID: {{ accountInfo.id }}</div>
        </div>
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" class="u-arrow"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>

      <div class="asset-card compact">
        <div class="card-title">资产总览 <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></div>
        <div class="card-main">
          <div class="asset-amount">{{ accountInfo.totalAsset }}</div>
          <div class="sparkline">
            <svg viewBox="0 -5 100 40" width="100%" height="40" preserveAspectRatio="none">
              <path :d="mainSparkline" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </div>
        </div>
        <div class="card-sub">总资产 (CNY)</div>
      </div>

      <div class="section-block">
        <h3>我的服务</h3>
        <div class="service-list">
          <div class="s-list-item">
            <div class="s-l-icon"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
            <div class="s-l-name">我的订单</div>
            <svg class="s-l-arrow" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
          <div class="s-list-item">
            <div class="s-l-icon"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg></div>
            <div class="s-l-name">我的卡券</div>
            <svg class="s-l-arrow" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
          <div class="s-list-item">
            <div class="s-l-icon"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></div>
            <div class="s-l-name">我的收藏</div>
            <svg class="s-l-arrow" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
          <div class="s-list-item">
            <div class="s-l-icon"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
            <div class="s-l-name">浏览记录</div>
            <svg class="s-l-arrow" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
          <div class="s-list-item">
            <div class="s-l-icon"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></div>
            <div class="s-l-name">我的活动</div>
            <svg class="s-l-arrow" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
          <div class="s-list-item">
            <div class="s-l-icon"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg></div>
            <div class="s-l-name">邀请好友</div>
            <span class="s-l-hint">得奖励</span>
            <svg class="s-l-arrow" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>
      </div>

      <div class="section-block">
        <h3>设置与帮助</h3>
        <div class="service-list">
          <div class="s-list-item">
            <div class="s-l-icon"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></div>
            <div class="s-l-name">设置</div>
            <svg class="s-l-arrow" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
          <div class="s-list-item">
            <div class="s-l-icon"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg></div>
            <div class="s-l-name">帮助与反馈</div>
            <svg class="s-l-arrow" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 底部 TAB BAR ==================== -->
    <div class="bottom-tab-bar">
      <div class="tab-item" :class="{ active: activeTab === 'wallet' }" @click="activeTab = 'wallet'">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" :fill="activeTab === 'wallet' ? 'currentColor' : 'none'"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path></svg>
      </div>
      <div class="tab-item" :class="{ active: activeTab === 'stocks' }" @click="activeTab = 'stocks'">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" :fill="activeTab === 'stocks' ? 'currentColor' : 'none'"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
      </div>
      <div class="tab-item" :class="{ active: activeTab === 'mine' }" @click="activeTab = 'mine'">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" :fill="activeTab === 'mine' ? 'currentColor' : 'none'"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wallet-app {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--app-bg, #f7f7f8);
  color: var(--app-text, #111111);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wallet-app.dark-theme {
  --app-bg: #000000;
  --app-text: #ffffff;
  --card-bg: #1c1c1e;
  --border-color: rgba(255,255,255,0.08);
  --sub-text: #8e8e93;
  --icon-bg: rgba(255,255,255,0.1);
  --up-color: #ff453a;
  --down-color: #32d74b;
}

:not(.dark-theme) .wallet-app {
  --card-bg: #ffffff;
  --border-color: var(--border-color);
  --sub-text: #8e8e93;
  --icon-bg: rgba(0,0,0,0.04);
  --up-color: #ff3b30;
  --down-color: #34c759;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 40px 5vw calc(80px + env(safe-area-inset-bottom));
  scrollbar-width: none;
}
.tab-content::-webkit-scrollbar { display: none; }

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6vw;
}

.page-header h2 {
  font-size: 5vw;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 2vw;
}

.page-header .subtitle {
  font-size: 3.5vw;
  color: var(--sub-text);
  font-weight: 400;
}

.header-actions {
  display: flex;
  color: var(--app-text);
}

/* Card Style */
.asset-card {
  background: var(--card-bg);
  border-radius: 4vw;
  padding: 5vw;
  box-shadow: 0 4px 20px rgba(0,0,0,0.03);
  margin-bottom: 6vw;
  border: 1px solid var(--border-color);
}

.card-title {
  font-size: 3vw;
  color: var(--sub-text);
  display: flex;
  align-items: center;
  gap: 1vw;
  margin-bottom: 2vw;
}

.card-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4vw;
}

.asset-amount {
  font-size: 8vw;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.sparkline {
  width: 25vw;
  height: 8vw;
}

.card-stats {
  display: flex;
  gap: 8vw;
}

.stat-col {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 2.8vw;
  color: var(--sub-text);
  margin-bottom: 1vw;
}

.stat-val {
  font-size: 3.5vw;
  font-weight: 600;
}

.up { color: var(--up-color) !important; }
.down { color: var(--down-color) !important; }

/* Actions */
.action-grid {
  display: flex;
  justify-content: space-between;
  padding: 0 2vw;
  margin-bottom: 8vw;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2vw;
}

.a-icon {
  width: 12vw;
  height: 12vw;
  border-radius: 50%;
  background: var(--card-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 10px rgba(0,0,0,0.02);
  border: 1px solid var(--border-color);
}

.action-item span {
  font-size: 3vw;
  font-weight: 500;
}

/* Sections */
.section-block {
  margin-bottom: 8vw;
}

.section-block h3 {
  font-size: 4vw;
  font-weight: 600;
  margin: 0 0 4vw 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4vw;
}

.section-header h3 { margin: 0; }

.more {
  font-size: 3vw;
  color: var(--sub-text);
  display: flex;
  align-items: center;
}

/* Distribution */
.distribution-content {
  display: flex;
  align-items: center;
  gap: 6vw;
}

.donut-chart {
  width: 24vw;
  height: 24vw;
  border-radius: 50%;
  background: conic-gradient(
    #d1d1d6 0% 54.6%,
    #8e8e93 54.6% 83.3%,
    #aeaeb2 83.3% 97.2%,
    #e5e5ea 97.2% 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
}

.donut-hole {
  width: 16vw;
  height: 16vw;
  border-radius: 50%;
  background: var(--app-bg);
}

.dist-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2vw;
}

.dist-item {
  display: flex;
  align-items: center;
  font-size: 3vw;
}

.dist-dot {
  width: 2vw;
  height: 2vw;
  border-radius: 50%;
  margin-right: 2vw;
}

.d-label { width: 10vw; color: var(--sub-text); }
.d-amount { flex: 1; font-weight: 500; text-align: right; }
.d-pct { width: 12vw; text-align: right; color: var(--sub-text); }

/* Quick Funcs */
.quick-funcs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3vw;
}

.q-func-card {
  background: var(--card-bg);
  padding: 3vw;
  border-radius: 3vw;
  display: flex;
  align-items: center;
  gap: 3vw;
  border: 1px solid var(--border-color);
}

.q-icon {
  width: 8vw;
  height: 8vw;
  border-radius: 2vw;
  background: var(--icon-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--sub-text);
}

.q-title { font-size: 3.2vw; font-weight: 500; margin-bottom: 0.5vw; }
.q-desc { font-size: 2.5vw; color: var(--sub-text); }

/* Transactions */
.transaction-list {
  display: flex;
  flex-direction: column;
  gap: 4vw;
}

.tx-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tx-title { font-size: 3.5vw; font-weight: 500; margin-bottom: 1vw; }
.tx-time { font-size: 2.8vw; color: var(--sub-text); }

.tx-amount { font-size: 4vw; font-weight: 600; text-align: right; }
.tx-currency { font-size: 2.5vw; color: var(--sub-text); font-weight: 400; margin-top: 0.5vw; }

.tx-in { color: var(--up-color); }
.tx-out { color: var(--app-text); }

/* Empty Placeholder */
.empty-placeholder {
  text-align: center;
  padding: 6vw 0;
  color: var(--sub-text);
  font-size: 3.5vw;
}

/* Stock List */
.stock-list {
  background: var(--card-bg);
  border-radius: 3vw;
  padding: 4vw;
  border: 1px solid var(--border-color);
}

.s-header {
  display: flex;
  font-size: 2.8vw;
  color: var(--sub-text);
  margin-bottom: 4vw;
  padding-bottom: 2vw;
  border-bottom: 1px solid var(--border-color);
}

.s-item {
  display: flex;
  align-items: center;
  margin-bottom: 4vw;
}
.s-item:last-child { margin-bottom: 0; }

.s-col-name { flex: 1.2; }
.s-col-val { flex: 1; text-align: right; font-weight: 500; font-size: 3.5vw; }
.s-col-rate { flex: 1; text-align: right; font-size: 3.5vw; font-weight: 500; }

.s-name { font-size: 3.5vw; font-weight: 500; margin-bottom: 0.5vw; }
.s-code { font-size: 2.5vw; color: var(--sub-text); }

.s-pct { font-size: 2.8vw; margin-top: 0.5vw; }

/* Market Scroll */
.market-scroll {
  display: flex;
  gap: 3vw;
  overflow-x: auto;
  padding-bottom: 2vw;
  scrollbar-width: none;
}
.market-scroll::-webkit-scrollbar { display: none; }

.market-card {
  flex: 0 0 28vw;
  background: var(--card-bg);
  padding: 3vw;
  border-radius: 3vw;
  border: 1px solid var(--border-color);
}

.m-name { font-size: 2.8vw; color: var(--sub-text); margin-bottom: 1vw; }
.m-val { font-size: 3.5vw; font-weight: 600; margin-bottom: 0.5vw; }
.m-rate { font-size: 2.8vw; margin-bottom: 2vw; }

.m-chart { height: 4vw; opacity: 0.5; }
.m-rate.up + .m-chart { color: var(--up-color); }
.m-rate.down + .m-chart { color: var(--down-color); }

/* Tags */
.tag-list {
  display: flex;
  gap: 2vw;
}

.tag-item {
  flex: 1;
  background: var(--card-bg);
  padding: 2vw 0;
  border-radius: 2vw;
  text-align: center;
  font-size: 3vw;
  font-weight: 500;
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 1vw;
}

.tag-rate { font-size: 2.5vw; }

/* Profile User */
.user-profile-card {
  display: flex;
  align-items: center;
  background: var(--card-bg);
  padding: 4vw;
  border-radius: 4vw;
  margin-bottom: 6vw;
  border: 1px solid var(--border-color);
}

.u-avatar {
  width: 14vw;
  height: 14vw;
  border-radius: 50%;
  background: #e5e5ea;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 4vw;
}

.u-info { flex: 1; }

.u-name-line {
  display: flex;
  align-items: center;
  gap: 2vw;
  margin-bottom: 1vw;
}

.u-name { font-size: 4.5vw; font-weight: 600; }
.u-badge {
  font-size: 2vw;
  background: var(--icon-bg);
  padding: 0.5vw 1.5vw;
  border-radius: 1vw;
  color: var(--sub-text);
}

.u-id { font-size: 2.8vw; color: var(--sub-text); }
.u-arrow { color: var(--sub-text); }

/* Compact Asset Card */
.asset-card.compact {
  padding: 4vw 5vw;
}
.asset-card.compact .card-main { margin-bottom: 1vw; }
.card-sub { font-size: 2.8vw; color: var(--sub-text); }

/* Service List */
.service-list {
  background: var(--card-bg);
  border-radius: 4vw;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.s-list-item {
  display: flex;
  align-items: center;
  padding: 4vw;
  border-bottom: 1px solid var(--border-color);
}
.s-list-item:last-child { border-bottom: none; }

.s-l-icon {
  width: 6vw;
  display: flex;
  justify-content: center;
  color: var(--sub-text);
  margin-right: 3vw;
}

.s-l-name { flex: 1; font-size: 3.5vw; }
.s-l-hint { font-size: 2.8vw; color: var(--sub-text); margin-right: 2vw; }
.s-l-arrow { color: rgba(142,142,147,0.5); }

/* Bottom Tab Bar */
.bottom-tab-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: calc(60px + env(safe-area-inset-bottom));
  background: var(--card-bg);
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1px solid var(--border-color);
  z-index: 200;
}

.tab-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 100%;
  color: var(--sub-text);
  cursor: pointer;
  transition: color 0.2s;
}

.tab-item.active {
  color: var(--app-text);
}
</style>
