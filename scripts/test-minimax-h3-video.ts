/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildH3Body, estimateH3Cost, validateH3Input, type H3Input } from '../src/services/minimaxH3Video.ts'

const base:H3Input={prompt:'雨夜霓虹街道，一名骑手从镜头前经过，立体环境声自然。',mode:'text',resolution:'2K',ratio:'16:9',duration:5,watermark:true,media:[]}
assert.deepEqual(buildH3Body(base),{model:'MiniMax-H3',content:[{type:'text',text:base.prompt}],duration:5,ratio:'16:9',resolution:'2K',aigc_watermark:true})
assert.deepEqual(buildH3Body(base,'context'),{model:'MiniMax-H3',content:[{type:'text',text:base.prompt}],duration:5,ratio:'16:9'})

const references:H3Input={...base,mode:'references',resolution:'768P',ratio:'adaptive',media:[
  {id:'image',role:'reference_image',url:'data:image/jpeg;base64,AAAA',label:'人物.jpg',size:3},
  {id:'video',role:'reference_video',url:'https://example.com/action.mp4',label:'动作.mp4',duration:8},
  {id:'audio',role:'reference_audio',url:'https://example.com/voice.mp3',label:'对白.mp3',duration:7}
]}
const body=buildH3Body(references) as any
assert.equal(body.content[1].type,'image_url')
assert.equal(body.content[2].role,'reference_video')
assert.equal(body.content[3].audio_url.url,'https://example.com/voice.mp3')
assert.doesNotThrow(()=>validateH3Input({...base,mode:'frames',ratio:'adaptive',media:[
  {id:'first',role:'first_frame',url:'https://example.com/first.jpg',label:'首帧'},
  {id:'last',role:'last_frame',url:'https://example.com/last.jpg',label:'尾帧'}
]}))
assert.throws(()=>validateH3Input({...base,ratio:'adaptive'}),/具体画面比例/)
assert.throws(()=>validateH3Input({...references,media:[{id:'video',role:'reference_video',url:'x',label:'x',duration:16}]}),/2 到 15 秒/)
assert.throws(()=>validateH3Input({...references,media:[{id:'image',role:'reference_image',url:'x',label:'x',size:31*1024*1024}]}),/文件大小/)
assert.equal(estimateH3Cost(base,true),0.65)

const hall=readFileSync(new URL('../src/components/app_VideoHall.vue',import.meta.url),'utf8')
const view=readFileSync(new URL('../src/components/video/MinimaxH3VideoAccessView.vue',import.meta.url),'utf8')
const service=readFileSync(new URL('../src/services/minimaxH3Video.ts',import.meta.url),'utf8')
assert.ok(hall.includes('MinimaxH3VideoAccessView'),'视频大厅缺少 MiniMax H3 入口')
for(const capability of ['网页直连','App 直连','文字','首帧','尾帧','首尾帧','全能参考','理解素材并完善描述','再生成为 2K','截取当前画面','作品集','从聊天片段整理场景'])assert.ok(`${view}\n${service}`.includes(capability),`H3 页面缺少能力：${capability}`)
for(const endpoint of ['/v2/video_generation','h3_context_ir','video_regeneration','query/video_generation'])assert.ok(service.includes(endpoint),`H3 服务缺少接口：${endpoint}`)
for(const file of ['KlingVideoAccessView.vue','WanVideoAccessView.vue','SeedanceVideoAccessView.vue']){
  const source=readFileSync(new URL(`../src/components/video/${file}`,import.meta.url),'utf8')
  assert.ok(source.includes('网页直连')&&source.includes('App 直连'),`${file} 未同时开放两种连接方式`)
}
console.log('MiniMax H3 and dual connection video tests passed')
