/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FileTransfer } from '@capacitor/file-transfer'
import { Share } from '@capacitor/share'
import { requestVideoApi, type VideoConnectionMode } from './videoHttp'

export const ATLAS_DEFAULT_BASE_URL = 'https://api.atlascloud.ai'
export type AtlasWorkflow = 'text' | 'image' | 'reference'
export type AtlasRemoteStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'timeout' | 'unknown'

export interface AtlasModelPreset {
  id: string
  name: string
  provider: string
  workflow: AtlasWorkflow
  description: string
  duration: number
  resolution: string
  ratio: string
  imageField?: 'image_url' | 'images'
  resolutionField?: 'resolution' | 'size'
  ratioField?: 'ratio' | 'aspect_ratio'
  promptExpansionField?: 'prompt_expansion' | 'enable_prompt_expansion'
  watermarkField?: 'watermark' | 'aigc_watermark'
  tags: string[]
}

export const ATLAS_VIDEO_MODELS: AtlasModelPreset[] = [
  { id:'bytedance/seedance-2.5/text-to-video', name:'Seedance 2.5', provider:'ByteDance', workflow:'text', description:'长叙事与原生音画', duration:5, resolution:'720p', ratio:'16:9', resolutionField:'resolution', ratioField:'ratio', tags:['音画','叙事'] },
  { id:'bytedance/seedance-2.5/image-to-video', name:'Seedance 2.5 图生', provider:'ByteDance', workflow:'image', description:'单图动画与镜头控制', duration:5, resolution:'720p', ratio:'16:9', imageField:'image_url', resolutionField:'resolution', ratioField:'ratio', tags:['图生','音画'] },
  { id:'bytedance/seedance-2.5/reference-to-video', name:'Seedance 2.5 参考生成', provider:'ByteDance', workflow:'reference', description:'组合多项素材保持人物与风格', duration:5, resolution:'720p', ratio:'16:9', imageField:'images', resolutionField:'resolution', ratioField:'ratio', tags:['多参考','一致性'] },
  { id:'alibaba/wan-3.0/text-to-video', name:'Wan 3.0', provider:'Alibaba', workflow:'text', description:'中文理解与电影感画面', duration:5, resolution:'720p', ratio:'16:9', resolutionField:'resolution', ratioField:'ratio', promptExpansionField:'enable_prompt_expansion', tags:['中文','电影感'] },
  { id:'alibaba/wan-3.0/image-to-video', name:'Wan 3.0 图生', provider:'Alibaba', workflow:'image', description:'保持主体的单图动画', duration:5, resolution:'720p', ratio:'16:9', imageField:'image_url', resolutionField:'resolution', ratioField:'ratio', promptExpansionField:'enable_prompt_expansion', tags:['图生','主体'] },
  { id:'kwaivgi/kling-v3.0-turbo/text-to-video', name:'Kling 3.0 Turbo', provider:'KwaiVGI', workflow:'text', description:'动作、镜头与原生音频', duration:5, resolution:'720p', ratio:'16:9', resolutionField:'resolution', ratioField:'aspect_ratio', tags:['动作','快速'] },
  { id:'kwaivgi/kling-v3.0-turbo/image-to-video', name:'Kling 3.0 Turbo 图生', provider:'KwaiVGI', workflow:'image', description:'首帧驱动与动态表现', duration:5, resolution:'720p', ratio:'16:9', imageField:'image_url', resolutionField:'resolution', ratioField:'aspect_ratio', tags:['图生','动作'] },
  { id:'minimax/h3/text-to-video', name:'MiniMax H3', provider:'MiniMax', workflow:'text', description:'多镜头与原生立体声', duration:8, resolution:'768P', ratio:'16:9', resolutionField:'resolution', ratioField:'ratio', promptExpansionField:'prompt_expansion', tags:['2K','立体声'] },
  { id:'minimax/h3/image-to-video', name:'MiniMax H3 图生', provider:'MiniMax', workflow:'image', description:'高质量人物和商品动画', duration:8, resolution:'768P', ratio:'16:9', imageField:'image_url', resolutionField:'resolution', ratioField:'ratio', promptExpansionField:'prompt_expansion', tags:['图生','立体声'] },
  { id:'minimax/h3/reference-to-video', name:'MiniMax H3 全能参考', provider:'MiniMax', workflow:'reference', description:'融合图片、视频与声音参考', duration:8, resolution:'768P', ratio:'16:9', imageField:'images', resolutionField:'resolution', ratioField:'ratio', promptExpansionField:'prompt_expansion', tags:['多模态','立体声'] },
  { id:'google/veo3.1-fast/text-to-video', name:'Veo 3.1 Fast', provider:'Google', workflow:'text', description:'快速原生音画生成', duration:8, resolution:'720p', ratio:'16:9', resolutionField:'resolution', ratioField:'aspect_ratio', tags:['音画','快速'] },
  { id:'pixverse/v6/text-to-video', name:'PixVerse v6', provider:'PixVerse', workflow:'text', description:'风格化与通用短视频', duration:5, resolution:'720p', ratio:'16:9', resolutionField:'resolution', ratioField:'aspect_ratio', tags:['风格','短视频'] },
  { id:'vidu/q3-pro/text-to-video', name:'Vidu Q3 Pro', provider:'Vidu', workflow:'text', description:'主体一致与镜头表现', duration:5, resolution:'720p', ratio:'16:9', resolutionField:'resolution', ratioField:'aspect_ratio', tags:['一致性','镜头'] },
  { id:'vidu/q3/reference-to-video', name:'Vidu Q3 参考生成', provider:'Vidu', workflow:'reference', description:'多主体参考与角色一致性', duration:5, resolution:'720p', ratio:'16:9', imageField:'images', resolutionField:'resolution', ratioField:'aspect_ratio', tags:['多参考','角色'] },
  { id:'xai/grok-imagine-video-v1.5/text-to-video', name:'Grok Imagine 1.5', provider:'xAI', workflow:'text', description:'快速创意音画短片', duration:5, resolution:'720p', ratio:'16:9', resolutionField:'resolution', ratioField:'aspect_ratio', tags:['创意','音画'] }
]

export interface AtlasVideoInput {
  model: string
  prompt: string
  workflow: AtlasWorkflow
  duration?: number
  resolution?: string
  ratio?: string
  sourceUrls: string[]
  seed?: number
  promptExpansion?: boolean
  watermark?: boolean
  extra?: Record<string, unknown>
  objectExpirationHours?: number
  requestRetentionHours?: number
}

export interface AtlasClientConfig { apiKey: string; baseUrl: string; connectionMode: VideoConnectionMode }
export interface AtlasCostEstimate { price?: number; originPrice?: number; discount?: number; estimated: boolean; estimatedTokens?: number; currency: string }
export interface AtlasRemoteTask { id: string; model?: string; status: AtlasRemoteStatus; progress: number; outputs: string[]; error?: string; errorCode?: number; requestId?: string }

export class AtlasApiError extends Error {
  status: number
  requestId?: string
  retryable: boolean
  constructor(message: string, status: number, requestId?: string) {
    super(message); this.name='AtlasApiError'; this.status=status; this.requestId=requestId; this.retryable=[429,500,502,503,504].includes(status)
  }
}

const cleanBase=(value:string)=>(value||ATLAS_DEFAULT_BASE_URL).trim().replace(/\/+$/,'')
const authHeaders=(key:string)=>({Authorization:`Bearer ${key.trim()}`,'Content-Type':'application/json'})
const responseHeader=(headers: Headers | Record<string,any>, name:string)=>headers instanceof Headers?headers.get(name):headers?.[name]||headers?.[name.toLowerCase()]
const payloadMessage=(data:any,fallback:string)=>String(data?.msg||data?.message||data?.error?.message||data?.error||fallback)
const apiError=(status:number,data:any,headers:Headers|Record<string,any>,fallback:string)=>{
  const requestId=String(data?.request_id||responseHeader(headers,'x-request-id')||'')||undefined
  const prefix=status===401?'API Key 无效或接口地址不正确':status===402?'Atlas Cloud 余额不足':status===403?'当前账户没有调用权限':status===404?'模型不存在或当前账户不可用':status===429?'请求达到模型限流':status===451?'当前地区不可用':status>=500?'Atlas Cloud 服务暂时不可用':fallback
  return new AtlasApiError(`${prefix}：${payloadMessage(data,fallback)}`,status,requestId)
}

export const findAtlasPreset=(model:string)=>ATLAS_VIDEO_MODELS.find(item=>item.id===model)

export const validateAtlasInput=(input:AtlasVideoInput)=>{
  if(!input.model.trim())throw new Error('请填写或选择 Atlas Cloud 模型')
  if(!input.prompt.trim())throw new Error('请填写视频描述')
  if(input.prompt.length>10000)throw new Error('视频描述不能超过 10000 个字符')
  if(input.duration!==undefined&&(!Number.isFinite(input.duration)||input.duration<1||input.duration>60))throw new Error('视频时长必须在 1 到 60 秒之间')
  if(input.seed!==undefined&&(!Number.isSafeInteger(input.seed)||input.seed<0))throw new Error('Seed 必须是大于或等于 0 的整数')
  if(input.workflow!=='text'&&!input.sourceUrls.length)throw new Error(input.workflow==='image'?'请添加一项图片素材':'请至少添加一项参考素材')
  if(input.sourceUrls.some(url=>!/^https:\/\/[^\s]+$/i.test(url.trim())))throw new Error('远程素材必须使用公开可访问的 HTTPS 地址')
  if(input.objectExpirationHours!==undefined&&(!Number.isInteger(input.objectExpirationHours)||input.objectExpirationHours<1||input.objectExpirationHours>336))throw new Error('作品保留时间必须是 1 到 336 小时')
  if(input.requestRetentionHours!==undefined&&(!Number.isInteger(input.requestRetentionHours)||input.requestRetentionHours<0||input.requestRetentionHours>336))throw new Error('任务记录保留时间必须是 0 到 336 小时')
}

export const buildAtlasBody=(input:AtlasVideoInput)=>{
  validateAtlasInput(input)
  const preset=findAtlasPreset(input.model)
  const body:Record<string,unknown>={model:input.model.trim(),prompt:input.prompt.trim()}
  if(input.duration!==undefined)body.duration=input.duration
  if(input.resolution?.trim())body[preset?.resolutionField||'resolution']=input.resolution.trim()
  if(input.ratio?.trim())body[preset?.ratioField||'aspect_ratio']=input.ratio.trim()
  if(input.seed!==undefined)body.seed=input.seed
  if(input.promptExpansion!==undefined&&preset?.promptExpansionField)body[preset.promptExpansionField]=input.promptExpansion
  if(input.watermark!==undefined&&preset?.watermarkField)body[preset.watermarkField]=input.watermark
  if(input.sourceUrls.length){
    const urls=input.sourceUrls.map(url=>url.trim())
    if((preset?.imageField||'image_url')==='images')body.images=urls
    else if(urls.length===1)body.image_url=urls[0]
    else body.image_urls=urls
  }
  return {...body,...(input.extra||{})}
}

const retentionHeaders=(input:AtlasVideoInput)=>({
  ...(input.objectExpirationHours!==undefined?{'X-AtlasCloud-Object-Expiration-Hours':String(input.objectExpirationHours)}:{}),
  ...(input.requestRetentionHours!==undefined?{'X-AtlasCloud-Request-Retention-Hours':String(input.requestRetentionHours)}:{})
})

export const estimateAtlasCost=async(config:AtlasClientConfig,input:AtlasVideoInput):Promise<AtlasCostEstimate>=>{
  const response=await requestVideoApi({url:`${cleanBase(config.baseUrl)}/api/v1/model/calculate`,method:'POST',headers:{...authHeaders(config.apiKey),...retentionHeaders(input)},data:buildAtlasBody(input),connectionMode:config.connectionMode})
  const payload:any=response.data
  if(response.status<200||response.status>=300||payload?.code&&payload.code!==200)throw apiError(response.status,payload,response.headers,'费用计算失败')
  const data=payload?.data||payload
  const num=(value:unknown)=>Number.isFinite(Number(value))?Number(value):undefined
  return {price:num(data?.price),originPrice:num(data?.origin_price),discount:num(data?.discount),estimated:Boolean(data?.estimated),estimatedTokens:num(data?.estimated_tokens),currency:String(data?.currency||'USD').toUpperCase()}
}

export const submitAtlasVideo=async(config:AtlasClientConfig,input:AtlasVideoInput):Promise<AtlasRemoteTask>=>{
  if(!config.apiKey.trim())throw new Error('请填写 Atlas Cloud API Key')
  const response=await requestVideoApi({url:`${cleanBase(config.baseUrl)}/api/v1/model/generateVideo`,method:'POST',headers:{...authHeaders(config.apiKey),...retentionHeaders(input)},data:buildAtlasBody(input),connectionMode:config.connectionMode,connectTimeout:30000,readTimeout:120000})
  const payload:any=response.data
  if(response.status<200||response.status>=300||payload?.code&&payload.code!==200)throw apiError(response.status,payload,response.headers,'Atlas Cloud 视频任务提交失败')
  return normalizeAtlasTask(payload?.data||payload,String(responseHeader(response.headers,'x-request-id')||''))
}

export const normalizeAtlasTask=(data:any,requestId=''):AtlasRemoteTask=>{
  const raw=String(data?.status||'').toLowerCase()
  const aliases:Record<string,AtlasRemoteStatus>={starting:'queued',pending:'queued',in_queue:'queued',running:'processing',succeeded:'completed',success:'completed',error:'failed'}
  const status=(['queued','processing','completed','failed','timeout'].includes(raw)?raw:aliases[raw]||'unknown') as AtlasRemoteStatus
  const outputs=Array.isArray(data?.outputs)?data.outputs.filter((value:unknown)=>typeof value==='string'):typeof data?.output==='string'?[data.output]:[]
  return {id:String(data?.id||data?.prediction_id||data?.session_id||''),model:data?.model?String(data.model):undefined,status,progress:Math.max(0,Math.min(100,Number(data?.progress)|| (status==='completed'?100:0))),outputs,error:data?.error?payloadMessage(data,'视频生成失败'):undefined,errorCode:Number.isFinite(Number(data?.error_code))?Number(data.error_code):undefined,requestId:requestId||data?.request_id||undefined}
}

export const queryAtlasVideo=async(config:AtlasClientConfig,id:string)=>{
  const response=await requestVideoApi({url:`${cleanBase(config.baseUrl)}/api/v1/model/prediction/${encodeURIComponent(id)}`,method:'GET',headers:{Authorization:`Bearer ${config.apiKey.trim()}`},connectionMode:config.connectionMode,connectTimeout:30000,readTimeout:60000})
  const payload:any=response.data
  if(response.status<200||response.status>=300)throw apiError(response.status,payload,response.headers,'Atlas Cloud 任务查询失败')
  return normalizeAtlasTask(payload?.data||payload,String(responseHeader(response.headers,'x-request-id')||''))
}

export const uploadAtlasMedia=async(config:AtlasClientConfig,file:File)=>{
  if(!config.apiKey.trim())throw new Error('上传素材需要 Atlas Cloud API Key')
  if(file.size>50*1024*1024)throw new Error('单个素材不能超过 50 MB')
  const form=new FormData(); form.append('file',file,file.name)
  let response:Response
  try{response=await fetch(`${cleanBase(config.baseUrl)}/api/v1/model/uploadMedia`,{method:'POST',headers:{Authorization:`Bearer ${config.apiKey.trim()}`},body:form})}
  catch{throw new Error('素材上传失败。请检查网络以及 Atlas Cloud 是否允许当前网页跨域访问。')}
  let payload:any=null; try{payload=await response.json()}catch{payload={}}
  if(!response.ok)throw apiError(response.status,payload,response.headers,'素材上传失败')
  const url=payload?.data?.download_url||payload?.data?.url||payload?.download_url||payload?.url
  if(!url)throw new Error('Atlas Cloud 没有返回素材临时地址')
  return String(url)
}

export const getAtlasBalance=async(config:AtlasClientConfig)=>{
  const response=await requestVideoApi({url:`${cleanBase(config.baseUrl)}/public/v1/balance`,method:'GET',headers:{Authorization:`Bearer ${config.apiKey.trim()}`},connectionMode:config.connectionMode})
  const payload:any=response.data
  if(response.status<200||response.status>=300)throw apiError(response.status,payload,response.headers,'余额查询失败')
  const data=payload?.data||payload
  return {value:Number(data?.value),currency:String(data?.currency||'usd').toUpperCase()}
}

export const downloadAtlasVideo=async(taskId:string,url:string)=>{
  if(!Capacitor.isNativePlatform())throw new Error('请在安装后的 App 中保存视频')
  await Filesystem.mkdir({directory:Directory.Data,path:'atlas-cloud-videos',recursive:true}).catch(()=>undefined)
  const path=`atlas-cloud-videos/${taskId}.mp4`; const file=await Filesystem.getUri({directory:Directory.Data,path})
  await FileTransfer.downloadFile({url,path:file.uri,progress:false,connectTimeout:60000,readTimeout:240000})
  return {path,uri:file.uri,webUrl:Capacitor.convertFileSrc(file.uri)}
}
export const shareAtlasVideo=(uri:string)=>Share.share({title:'Atlas Cloud 视频作品',files:[uri],dialogTitle:'分享或保存视频'})
export const removeAtlasVideoFile=async(path?:string)=>{if(path&&Capacitor.isNativePlatform())await Filesystem.deleteFile({directory:Directory.Data,path}).catch(()=>undefined)}
