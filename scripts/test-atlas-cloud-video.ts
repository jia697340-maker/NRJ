/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ATLAS_DEFAULT_BASE_URL, ATLAS_VIDEO_MODELS, buildAtlasBody, normalizeAtlasTask,
  validateAtlasInput, type AtlasVideoInput
} from '../src/services/atlasCloudVideo'

assert.equal(ATLAS_DEFAULT_BASE_URL,'https://api.atlascloud.ai')
assert.ok(ATLAS_VIDEO_MODELS.length>=10,'Atlas 模型中心应提供足够的跨厂商精选模型')
assert.ok(new Set(ATLAS_VIDEO_MODELS.map(item=>item.provider)).size>=7,'Atlas 精选模型应覆盖多家厂商')
const base:AtlasVideoInput={model:'minimax/h3/text-to-video',prompt:'雨夜电影镜头',workflow:'text',duration:8,resolution:'2K',ratio:'16:9',sourceUrls:[],promptExpansion:true,watermark:false,objectExpirationHours:24,requestRetentionHours:0}
assert.deepEqual(buildAtlasBody(base),{model:'minimax/h3/text-to-video',prompt:'雨夜电影镜头',duration:8,resolution:'2K',ratio:'16:9',prompt_expansion:true})
assert.deepEqual(buildAtlasBody({...base,model:'kwaivgi/kling-v3.0-turbo/image-to-video',workflow:'image',sourceUrls:['https://example.com/a.jpg'],resolution:'720p'}),{model:'kwaivgi/kling-v3.0-turbo/image-to-video',prompt:'雨夜电影镜头',duration:8,resolution:'720p',aspect_ratio:'16:9',image_url:'https://example.com/a.jpg'})
assert.deepEqual(buildAtlasBody({...base,extra:{duration:12,audio:true}}),{model:'minimax/h3/text-to-video',prompt:'雨夜电影镜头',duration:12,resolution:'2K',ratio:'16:9',prompt_expansion:true,audio:true})
assert.throws(()=>validateAtlasInput({...base,prompt:''}),/视频描述/)
assert.throws(()=>validateAtlasInput({...base,workflow:'image',sourceUrls:[]}),/图片素材/)
assert.throws(()=>validateAtlasInput({...base,objectExpirationHours:337}),/336/)
assert.deepEqual(normalizeAtlasTask({id:'p1',status:'succeeded',outputs:['https://example.com/a.mp4']}),{id:'p1',model:undefined,status:'completed',progress:100,outputs:['https://example.com/a.mp4'],error:undefined,errorCode:undefined,requestId:undefined})
assert.equal(normalizeAtlasTask({prediction_id:'p2',status:'running',progress:32}).status,'processing')

const hall=readFileSync(new URL('../src/components/app_VideoHall.vue',import.meta.url),'utf8')
for(const marker of ["id: 'omni'","id: 'veo'","id: 'kling'","id: 'wan'","id: 'seedance'","id: 'h3'","id: 'agnes'","id: 'atlas'",'AtlasCloudVideoAccessView'])assert.ok(hall.includes(marker),`视频大厅入口回归或缺失：${marker}`)
const view=readFileSync(new URL('../src/components/video/AtlasCloudVideoAccessView.vue',import.meta.url),'utf8')
for(const marker of ['确认费用并生成','模型专属参数（JSON）','查询余额','上传本机素材','继续查询','远程视频保留至','@media(max-width:340px)'])assert.ok(view.includes(marker),`Atlas 用户操作链缺失：${marker}`)
console.log('Atlas Cloud video integration tests passed')
