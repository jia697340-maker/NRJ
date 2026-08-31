<!-- WARNING: 本项目专属“粘人精”，严禁出现违规英文或拼音命名！ -->
<script setup lang="ts">
const props = defineProps<{ width: number; height: number }>()
const emit = defineEmits<{ 'update:width': [value: number]; 'update:height': [value: number] }>()
const clamp = (value: number) => Math.max(1, Math.min(4, Math.round(Number(value) || 1)))
const update = (axis: 'width' | 'height', value: number) => {
  if (axis === 'width') emit('update:width', clamp(value))
  else emit('update:height', clamp(value))
}
const sizes = [[1,1],[2,1],[2,2],[3,2],[4,2],[4,3],[4,4]] as const
</script>

<template>
  <div class="widget-size-controls">
    <div class="size-shortcuts" aria-label="常用尺寸">
      <button v-for="size in sizes" :key="size.join('x')" type="button" :class="{ active: width===size[0] && height===size[1] }" @click="emit('update:width',size[0]);emit('update:height',size[1])">{{ size[0] }}×{{ size[1] }}</button>
    </div>
    <div class="custom-size-row">
      <span>自定义尺寸</span>
      <label>宽<input :value="width" type="number" inputmode="numeric" min="1" max="4" aria-label="小组件宽度格数" @change="update('width',Number(($event.target as HTMLInputElement).value))" /></label>
      <i>×</i>
      <label>高<input :value="height" type="number" inputmode="numeric" min="1" max="4" aria-label="小组件高度格数" @change="update('height',Number(($event.target as HTMLInputElement).value))" /></label>
    </div>
  </div>
</template>

<style scoped>
.widget-size-controls{display:flex;min-width:0;flex-direction:column;gap:8px;margin-top:11px}.size-shortcuts{display:flex;min-width:0;gap:5px;overflow-x:auto;padding-bottom:1px;scrollbar-width:none}.size-shortcuts::-webkit-scrollbar{display:none}.size-shortcuts button{height:27px;min-width:36px;flex:0 0 auto;border:1px solid var(--border-color);border-radius:9px;background:var(--card-bg-solid);color:var(--text-secondary);padding:0 7px;font:inherit;font-size:9px}.size-shortcuts button.active{border-color:var(--text-primary);color:var(--text-primary);box-shadow:inset 0 0 0 1px var(--text-primary)}.custom-size-row{display:flex;min-width:0;align-items:center;justify-content:flex-end;gap:5px;color:var(--text-secondary);font-size:9px}.custom-size-row>span{min-width:0;margin-right:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.custom-size-row label{display:flex;flex:0 0 auto;align-items:center;gap:3px}.custom-size-row i{font-style:normal}.custom-size-row input{box-sizing:border-box;width:38px;height:28px;border:1px solid var(--border-color);border-radius:8px;outline:0;background:var(--sys-bg-primary);color:var(--text-primary);font:inherit;font-size:10px;text-align:center}.custom-size-row input:focus{border-color:var(--text-secondary)}
@media(max-width:340px){.size-shortcuts button{min-width:34px;padding:0 6px}.custom-size-row>span{max-width:76px}}
</style>
