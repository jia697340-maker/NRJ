/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'
import type { AtlasCostEstimate, AtlasVideoInput } from '../services/atlasCloudVideo'
import type { VideoConnectionMode } from '../services/videoHttp'

export type AtlasTaskStatus='submitting'|'queued'|'processing'|'paused'|'downloading'|'completed'|'failed'|'timeout'
export interface AtlasLocalTask { id:string; remoteId?:string; status:AtlasTaskStatus; progress:number; createdAt:number; updatedAt:number; baseUrl:string; connectionMode:VideoConnectionMode; project:string; input:AtlasVideoInput; estimate?:AtlasCostEstimate; outputUrl?:string; outputExpiresAt?:number; localFilePath?:string; localFileUri?:string; localWebUrl?:string; requestId?:string; errorCode?:number; error?:string }
const store=localforage.createInstance({name:'nrt-app',storeName:'atlasCloudVideoTasks'})
const tasks=ref<AtlasLocalTask[]>([])
const load=async()=>{const rows:AtlasLocalTask[]=[];for(const key of await store.keys()){const row=await store.getItem<AtlasLocalTask>(key);if(row)rows.push(row)}tasks.value=rows.sort((a,b)=>b.createdAt-a.createdAt);return tasks.value}
const save=async(task:AtlasLocalTask)=>{const next={...task,updatedAt:Date.now()};await store.setItem(next.id,next);await load();return next}
const patch=async(id:string,value:Partial<AtlasLocalTask>)=>{const row=await store.getItem<AtlasLocalTask>(id);if(!row)throw new Error('本地找不到这个 Atlas Cloud 任务');return save({...row,...value,id})}
const get=(id:string)=>store.getItem<AtlasLocalTask>(id)
const remove=async(id:string)=>{await store.removeItem(id);await load()}
void load()
export const useAtlasCloudVideoHistory=()=>({tasks,load,save,patch,get,remove})
