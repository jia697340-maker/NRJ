<script setup lang="ts">
defineProps<{ label: string; modelValue: number; defaultValue: number; min: number; max: number; step?: number; unit?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: number]; reset: [] }>()
</script>

<template>
  <div class="bubble-range-control">
    <div class="bubble-range-head">
      <label>{{ label }}</label>
      <div>
        <input :value="modelValue" type="number" :min="min" :max="max" :step="step || 1" @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))" />
        <span>{{ unit }}</span>
        <button type="button" :disabled="modelValue === defaultValue" :aria-label="`重置${label}`" @click="emit('reset')">
          <svg viewBox="0 0 24 24"><path d="M4 10a8 8 0 1 1 2.3 7.7M4 4v6h6" /></svg><i>重置</i>
        </button>
      </div>
    </div>
    <input class="bubble-range-slider" type="range" :value="modelValue" :min="min" :max="max" :step="step || 1" @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))" />
  </div>
</template>

<style scoped>
.bubble-range-control{padding:12px 0;border-bottom:1px solid var(--border-color,rgba(127,127,127,.18))}.bubble-range-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.bubble-range-head>label{font-size:14px;color:var(--text-primary);font-weight:500}.bubble-range-head>div{min-width:0;display:flex;align-items:center;gap:4px}.bubble-range-head input[type=number]{width:54px;height:30px;padding:0 6px;border:1px solid var(--border-color);border-radius:8px;outline:0;background:var(--sys-bg-primary);color:var(--text-primary);font-size:13px;text-align:right}.bubble-range-head span{min-width:16px;color:var(--text-tertiary);font-size:12px}.bubble-range-head button{height:30px;display:inline-flex;align-items:center;gap:4px;padding:0 7px;border:1px solid var(--border-color);border-radius:8px;background:var(--sys-bg-primary);color:var(--text-secondary);cursor:pointer;font-size:12px}.bubble-range-head button:disabled{opacity:.35;cursor:default}.bubble-range-head svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.bubble-range-head i{font-style:normal}.bubble-range-slider{display:block;width:100%;height:4px;accent-color:var(--theme-color,#4f7cff)}@media(max-width:350px){.bubble-range-head{gap:6px}.bubble-range-head>label{font-size:13px}.bubble-range-head button{width:30px;padding:0;justify-content:center}.bubble-range-head button i{display:none}}
</style>
