<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
defineProps<{ title: string; description: string }>()
</script>
<template>
  <div class="cw-empty-state">
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 7l3.2 8.8L36 19l-8.8 3.2L24 31l-3.2-8.8L12 19l8.8-3.2L24 7z"/><path d="M36.5 29l1.7 4.3 4.3 1.7-4.3 1.7-1.7 4.3-1.7-4.3-4.3-1.7 4.3-1.7 1.7-4.3z"/></svg>
    <strong>{{ title }}</strong><p>{{ description }}</p>
  </div>
</template>
