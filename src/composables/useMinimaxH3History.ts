/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'
import type { H3Input } from '../services/minimaxH3Video'
export interface H3LocalTask { id:string; remoteId?:string; type:'generation'|'context'|'regeneration'; status:'submitting'|'queued'|'running'|'completed'|'failed'|'cancelled'|'paused'; createdAt:number; updatedAt:number; baseUrl:string; connectionMode:'web'|'app'; input:H3Input; project?:string; videoUrl?:string; localFilePath?:string; localFileUri?:string; localWebUrl?:string; enhancedPrompt?:string; error?:string; usage?:Record<string,number> }
const store=localforage.createInstance({name:'nrt-app',storeName:'minimaxH3VideoTasks'})
const tasks=ref<H3LocalTask[]>([])
const load=async()=>{const rows:H3LocalTask[]=[];for(const key of await store.keys()){const row=await store.getItem<H3LocalTask>(key);if(row)rows.push(row)}tasks.value=rows.sort((a,b)=>b.createdAt-a.createdAt);return tasks.value}
const save=async(task:H3LocalTask)=>{const next={...task,updatedAt:Date.now()};await store.setItem(next.id,next);await load();return next}
const patch=async(id:string,value:Partial<H3LocalTask>)=>{const row=await store.getItem<H3LocalTask>(id);if(!row)throw new Error('本地找不到这个 H3 任务');return save({...row,...value,id})}
const get=(id:string)=>store.getItem<H3LocalTask>(id)
const remove=async(id:string)=>{await store.removeItem(id);await load()}
void load()
export const useMinimaxH3History=()=>({tasks,load,save,patch,get,remove})
