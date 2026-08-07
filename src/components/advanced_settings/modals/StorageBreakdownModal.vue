/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  show: boolean
  storageInfo: {
    usage: number
    quota: number
    percentage: number
    details: Array<{id: string, name: string, usage: number, percentage: number, color: string, count: number, reclaimable: number}>
    recognizedUsage: number
    userDataUsage: number
    cacheUsage: number
    backupUsage: number
    overheadUsage: number
    reclaimableUsage: number
    itemCount: number
    accuracy: string
  }
  isScanning: boolean
  deepScanResults: Array<any>
  formatBytes: (bytes: number) => string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'openDeepClean', tabId: string): void
}>()

const highlightId = ref('')

const scrollToCategory = (categoryId: string) => {
  highlightId.value = categoryId
  const el = document.getElementById(`cat-${categoryId}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Reset highlight after animation
    setTimeout(() => {
      highlightId.value = ''
    }, 2000)
  }
}

const handleItemClick = (categoryId: string) => {
  // 点击某一项时，直接将其 categoryId 传给深层排查页
  emit('openDeepClean', categoryId)
}

// SVG Donut Chart Logic
const svgSize = 300
const center = svgSize / 2
const radius = 80 // Inner radius
const strokeWidth = 30

// Filter details to only include those > 0%
const chartData = computed(() => {
  return props.storageInfo.details.filter(d => d.percentage > 0)
})

const pieChartSegments = computed(() => {
  if (!chartData.value.length) return []
  
  let currentAngle = 0
  return chartData.value.map(item => {
    // Percentage to degrees
    const angle = (item.percentage / 100) * 360
    
    // Calculate path
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle += angle
    
    // For small slices, SVG arc calculation might break if it's exactly 360
    const isLargeArc = angle > 180 ? 1 : 0
    
    // Calculate coordinates
    const startRad = (startAngle - 90) * Math.PI / 180
    const endRad = (endAngle - 90) * Math.PI / 180
    
    const x1 = center + radius * Math.cos(startRad)
    const y1 = center + radius * Math.sin(startRad)
    const x2 = center + radius * Math.cos(endRad)
    const y2 = center + radius * Math.sin(endRad)
    
    // Path string for the arc
    // Move to start -> draw arc to end
    // If it's a full circle (or very close), draw two semi-circles
    let d = ''
    if (angle >= 359.9) {
      d = `
        M ${center} ${center - radius}
        A ${radius} ${radius} 0 1 1 ${center} ${center + radius}
        A ${radius} ${radius} 0 1 1 ${center} ${center - radius}
      `
    } else {
      d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${isLargeArc} 1 ${x2} ${y2}`
    }
    
    // Calculate mid-point for labels (using a larger radius for the line)
    const midAngle = startAngle + (angle / 2)
    const midRad = (midAngle - 90) * Math.PI / 180
    
    // Distances for lines
    const lineStartR = radius + (strokeWidth / 2) + 2
    const lineMidR = lineStartR + 15
    const lineEndR = lineMidR + 15
    
    const lx1 = center + lineStartR * Math.cos(midRad)
    const ly1 = center + lineStartR * Math.sin(midRad)
    const lx2 = center + lineMidR * Math.cos(midRad)
    const ly2 = center + lineMidR * Math.sin(midRad)
    
    // Horizontal extension line
    const textAnchor = midAngle < 180 ? 'start' : 'end'
    const lx3 = midAngle < 180 ? lx2 + 10 : lx2 - 10
    
    // Show label if percentage is significant enough to fit
    const showLabel = item.percentage > 2
    
    return {
      ...item,
      d,
      lx1, ly1, lx2, ly2, lx3,
      textX: lx3 + (midAngle < 180 ? 5 : -5),
      textY: ly2 + 4,
      textAnchor,
      showLabel
    }
  })
})

</script>

<template>
  <Teleport to="body">
    <Transition name="fade-scale">
      <!-- 彻底移除遮罩，改为全屏白色/纯色背景，融入系统层级 -->
      <div class="storage-fullscreen-view" v-if="show">
        
        <!-- 极简原生顶栏 -->
        <div class="fullscreen-header">
        <button class="back-btn" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <h2 class="header-title">存储空间详情</h2>
        <div style="width: 40px"></div>
      </div>
      
      <div class="fullscreen-content">
        
        <!-- 扫描状态加载区 -->
        <div v-if="isScanning" class="scanning-state">
          <div class="spinner"></div>
          <p>正在深度扫描底层文件...</p>
        </div>

        <template v-else>
          <!-- 巨大的沉浸式数据图表 -->
          <div class="chart-container">
            <div class="svg-pie-wrapper">
              <svg :width="svgSize" :height="svgSize" viewBox="0 0 300 300">
                <!-- Base empty ring -->
                <circle v-if="!chartData.length" 
                  :cx="center" :cy="center" :r="radius" 
                  fill="none" stroke="var(--sys-bg-tertiary)" :stroke-width="strokeWidth" 
                />
                
                <!-- Data Segments -->
                <g v-for="segment in pieChartSegments" :key="'seg-'+segment.id">
                  <!-- Segment Arc -->
                  <path 
                    :d="segment.d" 
                    fill="none" 
                    :stroke="segment.color" 
                    :stroke-width="strokeWidth" 
                    class="pie-path"
                    @click="scrollToCategory(segment.id)"
                  />
                  
                  <!-- Label Lines and Text -->
                  <g v-if="segment.showLabel" class="pie-label-group" @click="scrollToCategory(segment.id)">
                    <!-- Polyline -->
                    <polyline 
                      :points="`${segment.lx1},${segment.ly1} ${segment.lx2},${segment.ly2} ${segment.lx3},${segment.ly2}`" 
                      fill="none" 
                      :stroke="segment.color" 
                      stroke-width="1.5"
                    />
                    <!-- Text (Name + Percentage) -->
                    <text 
                      :x="segment.textX" 
                      :y="segment.textY" 
                      :text-anchor="segment.textAnchor"
                      font-size="11"
                      font-weight="600"
                      :fill="segment.color"
                    >
                      {{ segment.name }}
                    </text>
                    <text 
                      :x="segment.textX" 
                      :y="segment.textY + 12" 
                      :text-anchor="segment.textAnchor"
                      font-size="10"
                      fill="var(--text-tertiary)"
                    >
                      {{ segment.percentage }}%
                    </text>
                  </g>
                </g>
              </svg>
              
              <!-- Center Text -->
              <div class="svg-pie-center">
                <span class="pie-size">{{ formatBytes(storageInfo.usage) }}</span>
                <span class="pie-label">应用总占用</span>
              </div>
            </div>
            <p class="chart-hint">点击图表色块或文字即可定位至详情，点击卡片进行管理</p>
          </div>

          <div class="storage-ledger-summary">
            <div class="ledger-summary-item">
              <span>用户内容</span>
              <strong>{{ formatBytes(storageInfo.userDataUsage) }}</strong>
            </div>
            <div class="ledger-summary-item">
              <span>离线缓存</span>
              <strong>{{ formatBytes(storageInfo.cacheUsage) }}</strong>
            </div>
            <div class="ledger-summary-item">
              <span>系统开销</span>
              <strong>{{ formatBytes(storageInfo.overheadUsage) }}</strong>
            </div>
          </div>

          <!-- 精细的 20+ 种分类列表，取代粗糙的大类 -->
          <div class="category-list">
            <div 
              class="category-card" 
              v-for="item in storageInfo.details" 
              :key="item.id" 
              :id="`cat-${item.id}`"
              :class="{ 'highlight-pulse': highlightId === item.id }"
              @click="handleItemClick(item.id)"
            >
              <div class="cat-color" :style="{ backgroundColor: item.color }"></div>
              <div class="cat-info">
                <span class="cat-name">{{ item.name }}</span>
                <span class="cat-size">{{ formatBytes(item.usage) }} ({{ item.percentage }}%) · {{ item.count }} 项</span>
                <span v-if="item.reclaimable" class="cat-reclaimable">可安全释放 {{ formatBytes(item.reclaimable) }}</span>
              </div>
              <svg class="cat-arrow" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
            
              <div v-if="!storageInfo.details.length" class="empty-state">
                毫无占用，干净如新。
              </div>
            </div>
          </template>
          
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 全屏级视图，完全遮盖下层元素，无弹窗感 */
.storage-fullscreen-view {
  position: fixed; /* 强制基于浏览器视口，无视父级限制 */
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100vw;
  height: 100vh;
  background: var(--sys-bg-primary, #ffffff);
  z-index: 9999; /* 绝对顶层，秒杀一切底层顶栏 */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  transform-origin: center center;
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.fullscreen-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--sys-bg-tertiary);
}

.back-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.2s;
}

.back-btn:active {
  background: var(--sys-bg-secondary);
}

.header-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.fullscreen-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 40px;
}

.scanning-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  gap: 20px;
  color: var(--text-tertiary);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--sys-bg-tertiary);
  border-top-color: var(--text-secondary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.chart-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 0;
}

.svg-pie-wrapper {
  position: relative;
  width: 300px;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pie-path {
  cursor: pointer;
  transition: opacity 0.2s, stroke-width 0.2s;
}
.pie-path:hover, .pie-path:active {
  opacity: 0.8;
  stroke-width: 34; /* Slightly thicker on interaction */
}

.pie-label-group {
  cursor: pointer;
}
.pie-label-group text {
  transition: opacity 0.2s;
}
.pie-label-group:hover text, .pie-label-group:active text {
  opacity: 0.7;
}

.svg-pie-center {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--sys-bg-primary);
  pointer-events: none; /* Let clicks pass through if needed, though it's empty in center */
}

.pie-size {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.pie-label {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.chart-hint {
  margin-top: 24px;
  font-size: 13px;
  color: var(--text-tertiary);
  opacity: 0.8;
}

.category-list {
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.category-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: var(--sys-bg-secondary, #f8f9fa);
  border-radius: 16px;
  cursor: pointer;
  transition: transform 0.2s;
}

.category-card:active {
  transform: scale(0.98);
}

.cat-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
}

.cat-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cat-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.cat-size {
  font-size: 13px;
  color: var(--text-tertiary);
}

.cat-reclaimable {
  color: #6b9080;
  font-size: 11px;
}

.storage-ledger-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin: 0 24px 24px;
  padding: 16px 0;
  border-top: 1px solid var(--sys-separator, #e5e5e5);
  border-bottom: 1px solid var(--sys-separator, #e5e5e5);
}

.ledger-summary-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  border-right: 1px dashed var(--sys-separator, #eeeeee);
  color: var(--text-tertiary);
  font-size: 11px;
  text-align: center;
}

.ledger-summary-item:last-child { border-right: 0; }
.ledger-summary-item strong { color: var(--text-primary); font-size: 13px; font-weight: 600; }

.cat-arrow {
  color: var(--text-tertiary);
  opacity: 0.5;
}

/* Highlight Animation for targeted categories */
.highlight-pulse {
  animation: pulse-bg 2s ease-out;
}

@keyframes pulse-bg {
  0% { background: var(--sys-bg-secondary, #f8f9fa); transform: scale(1); }
  20% { background: #e0f2fe; transform: scale(1.02); box-shadow: 0 4px 12px rgba(2, 132, 199, 0.1); }
  100% { background: var(--sys-bg-secondary, #f8f9fa); transform: scale(1); box-shadow: none; }
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-tertiary);
}
</style>
