/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<template>
  <div class="skeleton-list">
    <div v-for="i in 3" :key="i" class="skeleton-card">
      <div class="skeleton-header">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-user-info">
          <div class="skeleton-line w-40"></div>
          <div class="skeleton-line w-20"></div>
        </div>
      </div>
      <div class="skeleton-body">
        <div class="skeleton-line w-100"></div>
        <div class="skeleton-line w-80"></div>
        <div class="skeleton-line w-60"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skeleton-list {
  display: flex;
  flex-direction: column;
}

.skeleton-card {
  padding: 16px;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.05));
  background: var(--sys-bg-secondary, #ffffff);
}

.skeleton-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.skeleton-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--sys-bg-tertiary, #e6e8eb);
  animation: shimmer 1.5s infinite ease-in-out;
}

.skeleton-user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skeleton-body {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 12px;
  border-radius: 4px;
  background: var(--sys-bg-tertiary, #e6e8eb);
  animation: shimmer 1.5s infinite ease-in-out;
}

.w-100 { width: 100%; }
.w-80 { width: 80%; }
.w-60 { width: 60%; }
.w-40 { width: 40%; }
.w-20 { width: 20%; }

@keyframes shimmer {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}
</style>
