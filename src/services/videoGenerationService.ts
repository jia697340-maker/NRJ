/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FileTransfer } from '@capacitor/file-transfer'
import type { CharacterVideoGenerationConfig } from '../types/chatAssets'
import { getSecureValue, isNativeMobileApp } from './mobileSecureStorage'
import type { VideoConnectionMode } from './videoHttp'
import { VEO_DEFAULT_BASE_URL, VEO_MODELS, downloadVeoVideo, estimateVeoCost, getVeoOperation, submitVeoGeneration, type VeoDuration, type VeoModel, type VeoResolution } from './veoVideo'
import { GEMINI_OMNI_DEFAULT_BASE_URL, GEMINI_OMNI_MODEL, createGeminiOmniInteraction, downloadGeminiOmniVideo, estimateGeminiOmniCost, getGeminiOmniInteraction, type GeminiOmniDuration, type GeminiOmniResolution } from './geminiOmniVideo'
import { KLING_DEFAULT_BASE_URL, KLING_MODELS, estimateKlingCost, getKlingTask, submitKlingGeneration, type KlingAudio, type KlingDuration, type KlingModel, type KlingResolution } from './klingVideo'
import { WAN_MODELS, buildWanBaseUrl, estimateWanCost, queryWanTask, submitWanGeneration, type WanDuration, type WanModel, type WanResolution } from './wanVideo'
import { SEEDANCE_DEFAULT_BASE_URL, SEEDANCE_MODEL, querySeedanceTask, submitSeedanceGeneration, type SeedanceResolution } from './seedanceVideo'
import { H3_CN_BASE_URL, createH3Task, estimateH3Cost, queryH3Task, type H3Resolution } from './minimaxH3Video'
import { AGNES_DEFAULT_BASE_URL, createAgnesVideo, queryAgnesVideo, type AgnesResolution } from './agnesVideo'
import { ATLAS_DEFAULT_BASE_URL, ATLAS_VIDEO_MODELS, estimateAtlasCost, findAtlasPreset, queryAtlasVideo, submitAtlasVideo, uploadAtlasMedia, type AtlasVideoInput } from './atlasCloudVideo'

export interface CharacterVideoAdapterInput { ownerCharacterId: string; prompt: string; config: CharacterVideoGenerationConfig; firstFrame?: Blob; signal?: AbortSignal; onProgress?: (label: string) => void }
export interface CharacterVideoAdapter { id: string; generate(input: CharacterVideoAdapterInput): Promise<Blob> }
export interface CharacterVideoProviderDescriptor { id: string; label: string; shortLabel: string; credentialHint: string; supportsImage: boolean; models: Array<{ value: string; label: string }>; ratios: string[]; resolutions: string[]; durationMin: number; durationMax: number; defaultModel: string; defaultRatio: string; defaultResolution: string; defaultDuration: number }

export const CHARACTER_VIDEO_PROVIDERS: CharacterVideoProviderDescriptor[] = [
  { id:'veo',label:'Google Veo',shortLabel:'Veo',credentialHint:'Veo 视频大厅',supportsImage:true,models:VEO_MODELS.map(i=>({value:i.value,label:i.label})),ratios:['16:9','9:16'],resolutions:['720p','1080p','4k'],durationMin:4,durationMax:8,defaultModel:'veo-3.1-fast-generate-preview',defaultRatio:'16:9',defaultResolution:'720p',defaultDuration:8 },
  { id:'gemini-omni',label:'Gemini Omni',shortLabel:'Omni',credentialHint:'Gemini Omni 视频大厅',supportsImage:true,models:[{value:GEMINI_OMNI_MODEL,label:'Gemini Omni 1.1 Flash'}],ratios:['16:9','9:16'],resolutions:['360p','720p','1080p','4k'],durationMin:3,durationMax:10,defaultModel:GEMINI_OMNI_MODEL,defaultRatio:'16:9',defaultResolution:'720p',defaultDuration:6 },
  { id:'kling',label:'Kling',shortLabel:'Kling',credentialHint:'Kling 视频大厅',supportsImage:true,models:KLING_MODELS.map(i=>({value:i.value,label:i.label})),ratios:['16:9','9:16','1:1'],resolutions:['720p','1080p','4k'],durationMin:3,durationMax:15,defaultModel:'kling-3.0',defaultRatio:'16:9',defaultResolution:'720p',defaultDuration:5 },
  { id:'wan',label:'Wan 3.0',shortLabel:'Wan',credentialHint:'Wan 视频大厅',supportsImage:true,models:WAN_MODELS.map(i=>({value:i.value,label:i.label})),ratios:['adaptive','16:9','4:3','1:1','3:4','9:16'],resolutions:['480P','720P','1080P'],durationMin:2,durationMax:30,defaultModel:'wan3.0-video',defaultRatio:'16:9',defaultResolution:'720P',defaultDuration:5 },
  { id:'seedance',label:'Seedance 2.5',shortLabel:'Seedance',credentialHint:'Seedance 视频大厅',supportsImage:true,models:[{value:SEEDANCE_MODEL,label:'Seedance 2.5'}],ratios:['adaptive','16:9','4:3','1:1','3:4','9:16','21:9'],resolutions:['480p','720p','1080p'],durationMin:4,durationMax:30,defaultModel:SEEDANCE_MODEL,defaultRatio:'16:9',defaultResolution:'720p',defaultDuration:10 },
  { id:'minimax-h3',label:'MiniMax H3',shortLabel:'H3',credentialHint:'MiniMax H3 视频大厅',supportsImage:true,models:[{value:'MiniMax-H3',label:'MiniMax H3'}],ratios:['21:9','16:9','4:3','1:1','3:4','9:16'],resolutions:['768P','2K'],durationMin:4,durationMax:15,defaultModel:'MiniMax-H3',defaultRatio:'16:9',defaultResolution:'768P',defaultDuration:5 },
  { id:'agnes',label:'Agnes Video',shortLabel:'Agnes',credentialHint:'Agnes 视频大厅',supportsImage:false,models:[{value:'agnes-video-v2.0',label:'Agnes Video 2.0'}],ratios:['16:9','9:16','1:1','4:3','3:4'],resolutions:['480p','720p','1080p'],durationMin:3,durationMax:18,defaultModel:'agnes-video-v2.0',defaultRatio:'16:9',defaultResolution:'720p',defaultDuration:5 },
  { id:'atlas',label:'Atlas Cloud',shortLabel:'Atlas',credentialHint:'Atlas Cloud 视频大厅',supportsImage:true,models:ATLAS_VIDEO_MODELS.map(i=>({value:i.id,label:`${i.name} · ${i.workflow==='text'?'文生':i.workflow==='image'?'图生':'参考'}`})),ratios:['16:9','9:16','1:1','4:3','3:4'],resolutions:['720p','1080p'],durationMin:1,durationMax:60,defaultModel:ATLAS_VIDEO_MODELS[0].id,defaultRatio:'16:9',defaultResolution:'720p',defaultDuration:5 }
]

const adapters=new Map<string,CharacterVideoAdapter>()
export const registerCharacterVideoAdapter=(adapter:CharacterVideoAdapter)=>{adapters.set(adapter.id,adapter)}
export const listCharacterVideoAdapters=()=>[...adapters.keys()]
export const getCharacterVideoProvider=(id:string)=>CHARACTER_VIDEO_PROVIDERS.find(item=>item.id===id)
const read=(key:string,fallback='')=>localStorage.getItem(key)||fallback
const num=(key:string,fallback:number)=>Number.isFinite(Number(localStorage.getItem(key)))?Number(localStorage.getItem(key)):fallback
const bool=(key:string,fallback:boolean)=>localStorage.getItem(key)==null?fallback:localStorage.getItem(key)!=='false'
const mode=(key:string):VideoConnectionMode=>(isNativeMobileApp()?read(key,'app'):'web') as VideoConnectionMode
const ready=(modeKey:string,webKey:string)=>mode(modeKey)==='app'?isNativeMobileApp():Boolean(read(webKey).trim())

export const getCharacterVideoProviderDefaults=(id:string)=>{
  const p=getCharacterVideoProvider(id)||CHARACTER_VIDEO_PROVIDERS[0]
  const hall:Record<string,any>={
    veo:{model:read('app_veo_video_model',p.defaultModel),aspectRatio:read('app_veo_video_aspect_ratio',p.defaultRatio),resolution:read('app_veo_video_resolution',p.defaultResolution),durationSeconds:num('app_veo_video_duration',p.defaultDuration)},
    'gemini-omni':{model:GEMINI_OMNI_MODEL,aspectRatio:read('app_gemini_omni_ratio',p.defaultRatio),resolution:read('app_gemini_omni_resolution',p.defaultResolution),durationSeconds:num('app_gemini_omni_duration',p.defaultDuration)},
    kling:{model:read('app_kling_video_model',p.defaultModel),aspectRatio:read('app_kling_video_aspect_ratio',p.defaultRatio),resolution:read('app_kling_video_resolution',p.defaultResolution),durationSeconds:num('app_kling_video_duration',p.defaultDuration)},
    wan:{model:read('app_wan_video_model',p.defaultModel),aspectRatio:read('app_wan_video_ratio',p.defaultRatio),resolution:read('app_wan_video_resolution',p.defaultResolution),durationSeconds:num('app_wan_video_duration',p.defaultDuration)},
    seedance:{model:SEEDANCE_MODEL,aspectRatio:read('app_seedance_video_ratio',p.defaultRatio),resolution:read('app_seedance_video_resolution',p.defaultResolution),durationSeconds:num('app_seedance_video_duration',p.defaultDuration)},
    'minimax-h3':{model:'MiniMax-H3',aspectRatio:read('app_h3_ratio',p.defaultRatio),resolution:read('app_h3_resolution',p.defaultResolution),durationSeconds:num('app_h3_duration',p.defaultDuration)},
    agnes:{model:'agnes-video-v2.0',aspectRatio:read('app_agnes_ratio',p.defaultRatio),resolution:read('app_agnes_resolution',p.defaultResolution),durationSeconds:Math.round(num('app_agnes_num_frames',121)/Math.max(1,num('app_agnes_frame_rate',24)))},
    atlas:{model:read('app_atlas_model',p.defaultModel)==='custom'?read('app_atlas_custom_model',p.defaultModel):read('app_atlas_model',p.defaultModel),aspectRatio:read('app_atlas_ratio',p.defaultRatio),resolution:read('app_atlas_resolution',p.defaultResolution),durationSeconds:num('app_atlas_duration',p.defaultDuration)}
  }
  const v=hall[p.id]||{}
  return {provider:p.id,credentialRef:`${p.id}-default`,model:p.models.some(i=>i.value===v.model)?v.model:p.defaultModel,aspectRatio:p.ratios.includes(v.aspectRatio)?v.aspectRatio:p.defaultRatio,resolution:p.resolutions.includes(v.resolution)?v.resolution:p.defaultResolution,durationSeconds:Math.max(p.durationMin,Math.min(p.durationMax,Math.round(v.durationSeconds||p.defaultDuration)))}
}

export const canUseCharacterVideoAdapter=(config?:Partial<CharacterVideoGenerationConfig>|null)=>{
  const p=String(config?.provider||''); if(!adapters.has(p))return false
  if(p==='veo')return Boolean(read('app_veo_video_api_key').trim())
  if(p==='gemini-omni')return Boolean(read('app_gemini_omni_api_key',read('app_veo_video_api_key')).trim())
  if(p==='kling')return ready('app_kling_connection_mode','app_kling_web_api_key')
  if(p==='wan')return Boolean(read('app_wan_video_workspace').trim())&&ready('app_wan_connection_mode','app_wan_web_api_key')
  if(p==='seedance')return ready('app_seedance_connection_mode','app_seedance_web_api_key')
  if(p==='minimax-h3')return ready('app_h3_connection','app_h3_web_key')
  if(p==='agnes')return ready('app_agnes_connection_mode','app_agnes_web_api_key')
  return p==='atlas'&&ready('app_atlas_connection_mode','app_atlas_web_api_key')
}

const wait=(ms:number,signal?:AbortSignal)=>new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('已取消视频生成','AbortError'))},{once:true})})
const poll=async<T>(query:()=>Promise<T>,inspect:(value:T)=>{done?:string;failed?:string},signal?:AbortSignal,onProgress?:(label:string)=>void)=>{let delay=3500;const started=Date.now();while(Date.now()-started<15*60*1000){await wait(delay,signal);const state=inspect(await query());if(state.failed)throw new Error(state.failed);if(state.done)return state.done;onProgress?.('视频正在生成');delay=Math.min(10000,Math.round(delay*1.3))}throw new Error('视频生成等待超时，未创建视频消息')}
const toBase64=(bytes:Uint8Array)=>{let binary='';for(let offset=0;offset<bytes.length;offset+=0x8000)binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));return btoa(binary)}
const dataUrl=async(blob:Blob)=>`data:${blob.type||'image/jpeg'};base64,${toBase64(new Uint8Array(await blob.arrayBuffer()))}`
const fromBase64=(data:string,type='video/mp4')=>{const binary=atob(data.includes(',')?data.slice(data.indexOf(',')+1):data);return new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))],{type})}
const downloadBlob=async(url:string,signal?:AbortSignal)=>{if(!url)throw new Error('视频任务没有返回下载地址');if(!Capacitor.isNativePlatform()){const response=await fetch(url,{signal});if(!response.ok)throw new Error(`视频下载失败 (${response.status})`);const blob=await response.blob();if(!blob.size)throw new Error('视频下载结果为空');return blob.type?blob:new Blob([blob],{type:'video/mp4'})}const path=`character-video-temp/${Date.now()}-${crypto.randomUUID()}.mp4`;await Filesystem.mkdir({directory:Directory.Cache,path:'character-video-temp',recursive:true}).catch(()=>undefined);const file=await Filesystem.getUri({directory:Directory.Cache,path});try{await FileTransfer.downloadFile({url,path:file.uri,progress:false,connectTimeout:60000,readTimeout:240000});const result=await Filesystem.readFile({directory:Directory.Cache,path});const blob=result.data instanceof Blob?result.data:fromBase64(String(result.data));if(!blob.size)throw new Error('视频下载结果为空');return blob}finally{await Filesystem.deleteFile({directory:Directory.Cache,path}).catch(()=>undefined)}}
const credential=async(modeKey:string,webKey:string,secureKey:string)=>{const connectionMode=mode(modeKey);const apiKey=connectionMode==='app'?await getSecureValue(secureKey):read(webKey);if(!apiKey?.trim())throw new Error('当前节点尚未在视频大厅保存可复用的 API Key');return{apiKey:apiKey.trim(),connectionMode}}
const usageKey=(input:CharacterVideoAdapterInput)=>`clingy_character_video_usage_${input.ownerCharacterId}_${input.config.provider}_${new Date().toISOString().slice(0,10)}`
const assertLimit=(input:CharacterVideoAdapterInput)=>{if(Number(read(usageKey(input),'0'))>=Math.max(1,Number(input.config.maxDailyGenerations||3)))throw new Error('该角色今天在此节点的视频生成次数已达到上限')}
const record=(input:CharacterVideoAdapterInput)=>localStorage.setItem(usageKey(input),String(Number(read(usageKey(input),'0'))+1))
const cost=(value:number|null|undefined,config:CharacterVideoGenerationConfig,unit='$')=>{const limit=Number(config.maxEstimatedCost||0);if(value!=null&&limit>0&&value>limit)throw new Error(`本次视频预计费用 ${unit}${value.toFixed(2)}，超过角色设置的单次上限`)}

// Adapters are registered below. Every adapter returns a verified, non-empty Blob.
registerCharacterVideoAdapter({ id: 'veo', async generate(input) {
  const apiKey = read('app_veo_video_api_key').trim()
  if (!apiKey) throw new Error('请先在 Veo 视频大厅保存 Gemini Auth Key')
  const client = { apiKey, baseUrl: read('app_veo_video_base_url', VEO_DEFAULT_BASE_URL) }
  const model = (VEO_MODELS.some(item => item.value === input.config.model) ? input.config.model : 'veo-3.1-fast-generate-preview') as VeoModel
  const resolution = input.config.resolution as VeoResolution
  const duration = input.config.durationSeconds as VeoDuration
  cost(estimateVeoCost(model, resolution, duration), input.config)
  input.onProgress?.('正在提交 Veo 视频')
  const operationName = await submitVeoGeneration(client, { prompt: input.prompt, model, mode: input.firstFrame ? 'image' : 'text', aspectRatio: input.config.aspectRatio as '16:9' | '9:16', resolution, durationSeconds: duration, firstFrame: input.firstFrame }, input.signal)
  let video: Awaited<ReturnType<typeof getVeoOperation>>['video']
  await poll(() => getVeoOperation(client, operationName, input.signal), result => {
    if (!result.done) return {}
    if (!result.video) return { failed: 'Veo 任务已完成，但没有返回视频文件' }
    video = result.video
    return { done: 'ready' }
  }, input.signal, input.onProgress)
  input.onProgress?.('正在下载 Veo 视频')
  return downloadVeoVideo(client, video!, input.signal)
} })

registerCharacterVideoAdapter({ id: 'gemini-omni', async generate(input) {
  const apiKey = read('app_gemini_omni_api_key', read('app_veo_video_api_key')).trim()
  if (!apiKey) throw new Error('请先在 Gemini Omni 视频大厅保存可复用的 Gemini Auth Key')
  const client = { apiKey, baseUrl: read('app_gemini_omni_base_url', GEMINI_OMNI_DEFAULT_BASE_URL) }
  const resolution = input.config.resolution as GeminiOmniResolution
  const duration = input.config.durationSeconds as GeminiOmniDuration
  cost(estimateGeminiOmniCost(resolution, duration), input.config)
  input.onProgress?.('正在提交 Omni 视频')
  let result = await createGeminiOmniInteraction(client, { prompt: input.prompt, mode: input.firstFrame ? 'image' : 'text', aspectRatio: input.config.aspectRatio as '16:9' | '9:16', resolution, durationSeconds: duration, firstFrame: input.firstFrame }, input.signal)
  if (!['completed', 'succeeded', 'done'].includes(result.status)) {
    await poll(() => getGeminiOmniInteraction(client, result.id, input.signal), current => {
      result = current
      if (['failed', 'cancelled', 'canceled', 'expired'].includes(current.status)) return { failed: current.error || 'Omni 视频生成失败' }
      return ['completed', 'succeeded', 'done'].includes(current.status) ? { done: 'ready' } : {}
    }, input.signal, input.onProgress)
  }
  if (!result.video) throw new Error('Omni 任务已完成，但没有返回视频文件')
  input.onProgress?.('正在下载 Omni 视频')
  return downloadGeminiOmniVideo(client, result.video, input.signal)
} })

registerCharacterVideoAdapter({ id: 'kling', async generate(input) {
  const auth = await credential('app_kling_connection_mode', 'app_kling_web_api_key', 'kling_api_key')
  const client = { ...auth, baseUrl: read('app_kling_video_base_url', KLING_DEFAULT_BASE_URL) }
  const request = {
    prompt: input.prompt,
    model: (KLING_MODELS.some(item => item.value === input.config.model) ? input.config.model : 'kling-3.0') as KlingModel,
    mode: input.firstFrame ? 'image' as const : 'text' as const,
    aspectRatio: input.config.aspectRatio as '16:9' | '9:16' | '1:1',
    resolution: input.config.resolution as KlingResolution,
    duration: input.config.durationSeconds as KlingDuration,
    audio: read('app_kling_video_audio', 'off') as KlingAudio,
    multiShot: 'off' as const, shots: [], watermark: bool('app_kling_video_watermark', false),
    externalTaskId: `character-${crypto.randomUUID()}`, firstFrame: input.firstFrame
  }
  cost(estimateKlingCost(request), input.config, '¥')
  input.onProgress?.('正在提交 Kling 视频')
  const created = await submitKlingGeneration(client, request)
  let url = ''
  await poll(() => getKlingTask(client, { taskId: created.id }), task => {
    if (!task) return {}
    if (task.status === 'failed') return { failed: task.message || 'Kling 视频生成失败' }
    if (task.status === 'succeeded') { url = task.outputs?.find(item => item.url)?.url || ''; return url ? { done: 'ready' } : { failed: 'Kling 任务已完成，但没有返回视频地址' } }
    return {}
  }, input.signal, input.onProgress)
  input.onProgress?.('正在下载 Kling 视频')
  return downloadBlob(url, input.signal)
} })

registerCharacterVideoAdapter({ id: 'wan', async generate(input) {
  const auth = await credential('app_wan_connection_mode', 'app_wan_web_api_key', 'wan_api_key')
  const workspace = read('app_wan_video_workspace').trim()
  const region = read('app_wan_video_region', 'cn-beijing')
  if (!workspace) throw new Error('请先在 Wan 视频大厅保存业务空间 ID')
  const client = { ...auth, baseUrl: buildWanBaseUrl(workspace, region) }
  const model = (WAN_MODELS.some(item => item.value === input.config.model) ? input.config.model : 'wan3.0-video') as WanModel
  const resolution = input.config.resolution.toUpperCase() as WanResolution
  const duration = input.config.durationSeconds as WanDuration
  cost(estimateWanCost(model, resolution, duration, region), input.config, '¥')
  input.onProgress?.('正在提交 Wan 视频')
  const created = await submitWanGeneration(client, {
    prompt: input.prompt, model, mode: input.firstFrame ? 'image' : 'text', resolution,
    ratio: input.config.aspectRatio as any, duration, audio: bool('app_wan_video_audio', true),
    promptExtend: bool('app_wan_video_prompt_extend', true), watermark: bool('app_wan_video_watermark', false),
    media: input.firstFrame ? [{ type: 'first_frame', url: await dataUrl(input.firstFrame) }] : []
  })
  let url = ''
  await poll(() => queryWanTask(client, created.taskId), task => {
    if (['FAILED', 'CANCELED'].includes(task.status)) return { failed: task.message || `Wan 视频生成${task.status === 'CANCELED' ? '已取消' : '失败'}` }
    if (task.status === 'SUCCEEDED') { url = task.videoUrl || ''; return url ? { done: 'ready' } : { failed: 'Wan 任务已完成，但没有返回视频地址' } }
    return {}
  }, input.signal, input.onProgress)
  input.onProgress?.('正在下载 Wan 视频')
  return downloadBlob(url, input.signal)
} })

registerCharacterVideoAdapter({ id: 'seedance', async generate(input) {
  const auth = await credential('app_seedance_connection_mode', 'app_seedance_web_api_key', 'seedance_ark_api_key')
  const client = { ...auth, baseUrl: read('app_seedance_video_base_url', SEEDANCE_DEFAULT_BASE_URL) }
  input.onProgress?.('正在提交 Seedance 视频')
  const taskId = await submitSeedanceGeneration(client, {
    prompt: input.prompt, model: SEEDANCE_MODEL, mode: input.firstFrame ? 'image' : 'text',
    resolution: input.config.resolution as SeedanceResolution, ratio: input.config.aspectRatio as any,
    duration: input.config.durationSeconds, generateAudio: bool('app_seedance_video_audio', true),
    watermark: bool('app_seedance_video_watermark', false), returnLastFrame: bool('app_seedance_video_last_frame', true),
    media: input.firstFrame ? [{ role: 'first_frame', url: await dataUrl(input.firstFrame), label: '角色参考图' }] : []
  })
  let url = ''
  await poll(() => querySeedanceTask(client, taskId), task => {
    if (['failed', 'cancelled', 'expired'].includes(task.status)) return { failed: task.errorMessage || `Seedance 视频生成${task.status === 'cancelled' ? '已取消' : '失败'}` }
    if (task.status === 'succeeded') { url = task.videoUrl || ''; return url ? { done: 'ready' } : { failed: 'Seedance 任务已完成，但没有返回视频地址' } }
    return {}
  }, input.signal, input.onProgress)
  input.onProgress?.('正在下载 Seedance 视频')
  return downloadBlob(url, input.signal)
} })

registerCharacterVideoAdapter({ id: 'minimax-h3', async generate(input) {
  const auth = await credential('app_h3_connection', 'app_h3_web_key', 'minimax_h3_api_key')
  const client = { ...auth, baseUrl: read('app_h3_base_url', H3_CN_BASE_URL) }
  const request = {
    prompt: input.prompt, mode: input.firstFrame ? 'first' as const : 'text' as const,
    resolution: input.config.resolution as H3Resolution, ratio: input.config.aspectRatio as any,
    duration: input.config.durationSeconds, watermark: bool('app_h3_watermark', false),
    media: input.firstFrame ? [{ id: crypto.randomUUID(), role: 'first_frame' as const, url: await dataUrl(input.firstFrame), label: '角色参考图' }] : []
  }
  cost(estimateH3Cost(request, /minimax\.io/i.test(client.baseUrl)), input.config, /minimax\.io/i.test(client.baseUrl) ? '$' : '¥')
  input.onProgress?.('正在提交 MiniMax H3 视频')
  const taskId = await createH3Task(client, request)
  let url = ''
  await poll(() => queryH3Task(client, taskId), task => {
    if (['failed', 'cancelled'].includes(task.status)) return { failed: task.error || `MiniMax H3 视频生成${task.status === 'cancelled' ? '已取消' : '失败'}` }
    if (task.status === 'succeeded') { url = task.url || ''; return url ? { done: 'ready' } : { failed: 'MiniMax H3 任务已完成，但没有返回视频地址' } }
    return {}
  }, input.signal, input.onProgress)
  input.onProgress?.('正在下载 MiniMax H3 视频')
  return downloadBlob(url, input.signal)
} })

registerCharacterVideoAdapter({ id: 'agnes', async generate(input) {
  if (input.firstFrame) throw new Error('Agnes 当前接口只接受公开 HTTPS 图片，角色聊天中的本地图片不能安全用于图生视频，请改用文字生成或其他节点')
  const auth = await credential('app_agnes_connection_mode', 'app_agnes_web_api_key', 'agnes_api_key')
  const client = { ...auth, baseUrl: read('app_agnes_base_url', AGNES_DEFAULT_BASE_URL) }
  const frameRate = Math.max(1, Math.min(60, Math.round(num('app_agnes_frame_rate', 24))))
  const targetFrames = Math.min(441, Math.max(1, Math.round(input.config.durationSeconds * frameRate)))
  const numFrames = Math.min(441, Math.max(1, Math.round((targetFrames - 1) / 8) * 8 + 1))
  input.onProgress?.('正在提交 Agnes 视频')
  const created = await createAgnesVideo(client, {
    prompt: input.prompt, mode: 'text', resolution: input.config.resolution as AgnesResolution,
    ratio: input.config.aspectRatio as any, numFrames, frameRate, imageUrls: []
  })
  let url = ''
  await poll(() => queryAgnesVideo(client, created.videoId), task => {
    if (task.status === 'failed') return { failed: task.error || 'Agnes 视频生成失败' }
    if (task.status === 'completed') { url = task.videoUrl || ''; return url ? { done: 'ready' } : { failed: 'Agnes 任务已完成，但没有返回视频地址' } }
    return {}
  }, input.signal, input.onProgress)
  input.onProgress?.('正在下载 Agnes 视频')
  return downloadBlob(url, input.signal)
} })

const atlasModelFor = (requested: string, hasImage: boolean) => {
  const preset = findAtlasPreset(requested)
  if (preset && (hasImage ? preset.workflow !== 'text' : preset.workflow === 'text')) return preset
  const preferredProvider = preset?.provider
  return ATLAS_VIDEO_MODELS.find(item => item.workflow === (hasImage ? 'image' : 'text') && (!preferredProvider || item.provider === preferredProvider))
    || ATLAS_VIDEO_MODELS.find(item => item.workflow === (hasImage ? 'image' : 'text'))!
}

registerCharacterVideoAdapter({ id: 'atlas', async generate(input) {
  const auth = await credential('app_atlas_connection_mode', 'app_atlas_web_api_key', 'atlas_cloud_api_key')
  const client = { ...auth, baseUrl: read('app_atlas_base_url', ATLAS_DEFAULT_BASE_URL) }
  const preset = atlasModelFor(input.config.model, Boolean(input.firstFrame))
  const sourceUrls = input.firstFrame
    ? [await uploadAtlasMedia(client, new File([input.firstFrame], `character-${Date.now()}.${input.firstFrame.type.includes('png') ? 'png' : 'jpg'}`, { type: input.firstFrame.type || 'image/jpeg' }))]
    : []
  const request: AtlasVideoInput = {
    model: preset.id, prompt: input.prompt, workflow: input.firstFrame ? 'image' : 'text', sourceUrls,
    duration: input.config.durationSeconds, resolution: input.config.resolution, ratio: input.config.aspectRatio,
    promptExpansion: bool('app_atlas_prompt_expansion', true), watermark: bool('app_atlas_watermark', false),
    objectExpirationHours: Math.max(1, Math.min(336, num('app_atlas_object_expiration', 24))),
    requestRetentionHours: Math.max(0, Math.min(336, num('app_atlas_request_retention', 24)))
  }
  input.onProgress?.('正在核算 Atlas Cloud 费用')
  const estimate = await estimateAtlasCost(client, request)
  cost(estimate.price, input.config, estimate.currency === 'CNY' ? '¥' : '$')
  input.onProgress?.('正在提交 Atlas Cloud 视频')
  const created = await submitAtlasVideo(client, request)
  let url = ''
  await poll(() => queryAtlasVideo(client, created.id), task => {
    if (['failed', 'timeout'].includes(task.status)) return { failed: task.error || `Atlas Cloud 视频生成${task.status === 'timeout' ? '超时' : '失败'}` }
    if (task.status === 'completed') { url = task.outputs[0] || ''; return url ? { done: 'ready' } : { failed: 'Atlas Cloud 任务已完成，但没有返回视频地址' } }
    return {}
  }, input.signal, input.onProgress)
  input.onProgress?.('正在下载 Atlas Cloud 视频')
  return downloadBlob(url, input.signal)
} })

export const generateCharacterVideo = async (input: CharacterVideoAdapterInput) => {
  const provider = getCharacterVideoProvider(input.config.provider)
  const adapter = adapters.get(input.config.provider)
  if (!provider || !adapter) throw new Error('该角色选择的视频节点尚未接入')
  if (!input.prompt.trim()) throw new Error('角色没有提供视频生成描述')
  if (input.firstFrame && !provider.supportsImage) throw new Error(`${provider.shortLabel} 当前不支持聊天本地图片生成视频`)
  assertLimit(input)
  const blob = await adapter.generate(input)
  if (!(blob instanceof Blob) || !blob.size) throw new Error('视频节点没有返回可保存的真实视频文件')
  record(input)
  return blob.type ? blob : new Blob([blob], { type: 'video/mp4' })
}

export const readVideoMetadata = (blob: Blob) => new Promise<{ duration?: number; width?: number; height?: number }>(resolve => {
  const url = URL.createObjectURL(blob)
  const video = document.createElement('video')
  const finish = (value: { duration?: number; width?: number; height?: number }) => { URL.revokeObjectURL(url); resolve(value) }
  video.preload = 'metadata'
  video.onloadedmetadata = () => finish({ duration: Number.isFinite(video.duration) ? video.duration : undefined, width: video.videoWidth || undefined, height: video.videoHeight || undefined })
  video.onerror = () => finish({})
  video.src = url
})
