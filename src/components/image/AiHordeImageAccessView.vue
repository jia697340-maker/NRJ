<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">import CommunityImageAccessView from './CommunityImageAccessView.vue'; defineEmits<{(e:'back'):void}>()</script>
<template><CommunityImageAccessView provider="aihorde" @back="$emit('back')" /></template>

