/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { requestVideoApi, type VideoConnectionMode } from './videoHttp'
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FileTransfer } from '@capacitor/file-transfer'
import { Share } from '@capacitor/share'

export type H3Mode = 'text' | 'first' | 'last' | 'frames' | 'references'
export type H3Resolution = '768P' | '2K'
export type H3Ratio = 'adaptive' | '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16'
export type H3Role = 'first_frame' | 'last_frame' | 'reference_image' | 'reference_video' | 'reference_audio'
export interface H3Media { id: string; role: H3Role; url: string; label: string; duration?: number; size?: number }
export interface H3Input { prompt: string; mode: H3Mode; resolution: H3Resolution; ratio: H3Ratio; duration: number; watermark: boolean; media: H3Media[] }
export interface H3Config { apiKey: string; baseUrl: string; connectionMode: VideoConnectionMode }
export interface H3TaskResult { id: string; status: 'queued'|'running'|'succeeded'|'failed'|'cancelled'; url?: string; prompt?: string; resolution?: H3Resolution; ratio?: H3Ratio; duration?: number; usage?: Record<string, number>; error?: string }

export const H3_CN_BASE_URL = 'https://api.minimaxi.com'
export const H3_GLOBAL_BASE_URL = 'https://api.minimax.io'
export const H3_RATIOS: H3Ratio[] = ['adaptive','21:9','16:9','4:3','1:1','3:4','9:16']
export const H3_MODES: Array<{value:H3Mode;label:string;description:string}> = [
  { value:'text', label:'文字', description:'根据描述生成原生音画视频' },
  { value:'first', label:'首帧', description:'指定视频的起始画面' },
  { value:'last', label:'尾帧', description:'指定视频的结束画面' },
  { value:'frames', label:'首尾帧', description:'控制开始和结束画面' },
  { value:'references', label:'全能参考', description:'组合角色、动作、镜头和声音素材' }
]

const cleanBase = (value: string) => (value || H3_CN_BASE_URL).trim().replace(/\/+$/, '')
const headers = (key: string) => ({ Authorization:`Bearer ${key.trim()}`, 'Content-Type':'application/json' })
const mediaContent = (item: H3Media) => {
  const type = item.role.includes('image') || item.role.includes('frame') ? 'image_url' : item.role === 'reference_video' ? 'video_url' : 'audio_url'
  return { type, [type]: { url:item.url.trim() }, role:item.role }
}

export const validateH3Input = (input: H3Input) => {
  if (!input.prompt.trim()) throw new Error('请填写视频描述')
  if (input.prompt.length > 7000) throw new Error('视频描述不能超过 7000 个字符')
  if (!Number.isInteger(input.duration) || input.duration < 4 || input.duration > 15) throw new Error('视频时长必须是 4 到 15 秒的整数')
  const count = (role: H3Role) => input.media.filter(item=>item.role===role).length
  if (input.media.some(item=>!item.url.trim())) throw new Error('请填写或移除空的素材地址')
  const modeRoles:Record<H3Mode,H3Role[]>={text:[],first:['first_frame'],last:['last_frame'],frames:['first_frame','last_frame'],references:['reference_image','reference_video','reference_audio']}
  if (input.media.some(item=>!modeRoles[input.mode].includes(item.role))) throw new Error('当前创作方式中包含不适用的素材')
  if (input.mode === 'first' && count('first_frame') !== 1) throw new Error('请添加一张首帧图片')
  if (input.mode === 'last' && count('last_frame') !== 1) throw new Error('请添加一张尾帧图片')
  if (input.mode === 'frames' && (count('first_frame') !== 1 || count('last_frame') !== 1)) throw new Error('请同时添加首帧和尾帧图片')
  if (input.mode === 'references' && !input.media.length) throw new Error('请至少添加一项参考素材')
  if (input.mode === 'text' && input.ratio === 'adaptive') throw new Error('文字生成需要选择具体画面比例')
  if (count('reference_image') > 9 || count('reference_video') > 3 || count('reference_audio') > 3 || input.media.length > 12) throw new Error('参考素材数量超过 H3 限制')
  const maxSize=(item:H3Media)=>item.role==='reference_video'?50:item.role==='reference_audio'?15:30
  if(input.media.some(item=>(item.size||0)>maxSize(item)*1024*1024))throw new Error('素材文件大小超过 H3 接口限制')
  const requestBytes=input.media.reduce((n,item)=>n+(item.url.startsWith('data:')?Math.ceil((item.size||item.url.length)*4/3):item.url.length),input.prompt.length)
  if(requestBytes>64*1024*1024)throw new Error('编码后的单次请求体不能超过 64 MB，请改用公开地址')
  if(input.media.some(item=>(item.role==='reference_video'||item.role==='reference_audio')&&(!item.duration||item.duration<2||item.duration>15)))throw new Error('请填写每段参考视频或音频的时长（2 到 15 秒）')
  const videoSeconds = input.media.filter(i=>i.role==='reference_video').reduce((n,i)=>n+(i.duration||0),0)
  const audioSeconds = input.media.filter(i=>i.role==='reference_audio').reduce((n,i)=>n+(i.duration||0),0)
  if (videoSeconds > 15 || audioSeconds > 15) throw new Error('参考视频或音频总时长不能超过 15 秒')
}

export const buildH3Body = (input: H3Input, kind:'generation'|'context'='generation') => {
  validateH3Input(input)
  const common={ model:'MiniMax-H3', content:[{type:'text',text:input.prompt.trim()},...input.media.map(mediaContent)], duration:input.duration, ratio:input.mode==='first'||input.mode==='last'||input.mode==='frames'?'adaptive':input.ratio }
  return kind==='context'?common:{...common,resolution:input.resolution,aigc_watermark:input.watermark}
}

const parseError = (status:number, data:any) => new Error(String(data?.error?.message || data?.message || `MiniMax H3 请求失败 (${status})`))
export const createH3Task = async (config:H3Config,input:H3Input,kind:'generation'|'context'='generation') => {
  if (!config.apiKey.trim()) throw new Error('请填写 MiniMax API Key')
  const response = await requestVideoApi({ url:`${cleanBase(config.baseUrl)}/v2/${kind==='context'?'h3_context_ir':'video_generation'}`, method:'POST', headers:headers(config.apiKey), data:buildH3Body(input,kind), connectionMode:config.connectionMode })
  const data:any=response.data
  if (response.status<200||response.status>=300||data?.error) throw parseError(response.status,data)
  if (!data?.task_id) throw new Error('MiniMax 接口没有返回任务编号')
  return String(data.task_id)
}

export const queryH3Task = async (config:H3Config,id:string):Promise<H3TaskResult> => {
  const response=await requestVideoApi({url:`${cleanBase(config.baseUrl)}/v2/query/video_generation/${encodeURIComponent(id)}`,method:'GET',headers:headers(config.apiKey),connectionMode:config.connectionMode})
  const data:any=response.data; if(response.status<200||response.status>=300||data?.error) throw parseError(response.status,data)
  const task=data?.task||{}
  return {id:String(task.id||id),status:task.status||'failed',url:task.content?.url,prompt:task.content?.prompt,resolution:task.resolution,ratio:task.ratio,duration:task.duration,usage:task.usage,error:task.error?.message||task.error}
}

export const cancelH3Task = async (config:H3Config,id:string) => {
  const response=await requestVideoApi({url:`${cleanBase(config.baseUrl)}/v2/video_generation/${encodeURIComponent(id)}`,method:'DELETE',headers:headers(config.apiKey),connectionMode:config.connectionMode})
  if(response.status<200||response.status>=300||(response.data as any)?.error)throw parseError(response.status,response.data)
}
export const regenerateH3Task = async (config:H3Config,sourceTaskId:string,watermark=false) => {
  const response=await requestVideoApi({url:`${cleanBase(config.baseUrl)}/v2/video_regeneration`,method:'POST',headers:headers(config.apiKey),data:{model:'MiniMax-H3',source_task_id:sourceTaskId,resolution:'2K',aigc_watermark:watermark},connectionMode:config.connectionMode})
  const data:any=response.data; if(response.status<200||response.status>=300||data?.error) throw parseError(response.status,data)
  return String(data.task_id)
}
export const estimateH3Cost = (input:H3Input,global=false) => {
  const output=input.duration*(input.resolution==='2K'?(global?0.13:0.8):(global?0.08:0.5))
  const video=input.media.filter(i=>i.role==='reference_video').reduce((n,i)=>n+(i.duration||0),0)*(input.resolution==='2K'?(global?0.13:0.8):(global?0.08:0.5))
  const extraImages=Math.max(0,input.media.filter(i=>i.role==='reference_image').length-5)*(global?0.04:0.2)
  return Number((output+video+extraImages).toFixed(2))
}

export const downloadH3Video = async (taskId:string,url:string) => {
  if(!Capacitor.isNativePlatform())throw new Error('请在安装后的 App 中保存视频')
  await Filesystem.mkdir({directory:Directory.Data,path:'minimax-h3-videos',recursive:true}).catch(()=>undefined)
  const path=`minimax-h3-videos/${taskId}.mp4`
  const file=await Filesystem.getUri({directory:Directory.Data,path})
  await FileTransfer.downloadFile({url,path:file.uri,progress:false,connectTimeout:60000,readTimeout:240000})
  return {path,uri:file.uri,webUrl:Capacitor.convertFileSrc(file.uri)}
}
export const shareH3Video = async(uri:string)=>Share.share({title:'MiniMax H3 视频作品',files:[uri],dialogTitle:'分享或保存视频'})
export const removeH3VideoFile = async(path?:string)=>{if(path&&Capacitor.isNativePlatform())await Filesystem.deleteFile({directory:Directory.Data,path}).catch(()=>undefined)}
