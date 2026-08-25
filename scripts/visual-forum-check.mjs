import fs from 'node:fs'

const endpoint = process.argv[2]
const outputDir = process.argv[3] || 'dist/forum-visual-check'
if (!endpoint) throw new Error('Usage: node scripts/visual-forum-check.mjs <devtools-websocket-url> [output-dir]')
fs.mkdirSync(outputDir, { recursive: true })
const socket = new WebSocket(endpoint)
let counter = 0
const pending = new Map()
socket.addEventListener('message', event => { const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const {resolve,reject}=pending.get(message.id);pending.delete(message.id);message.error?reject(new Error(message.error.message)):resolve(message.result)} })
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})})
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++counter;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const evaluate=expression=>send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})
await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:'http://127.0.0.1:4173'});await wait(2500)
await evaluate(`document.querySelector('.install-prompt-close')?.click()`);await wait(250)
await evaluate(`(()=>{const label=[...document.querySelectorAll('.app-name')].find(item=>item.textContent?.trim()==='论坛');label?.closest('.desktop-entry')?.click();return Boolean(label)})()`);await wait(1800)
await evaluate(`(()=>{const root=document.querySelector('.forum-onboarding');if(!root)return 'existing';const inputs=root.querySelectorAll('input');const set=(element,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}))};set(inputs[0],'移动端验收');set(inputs[1],'visual_check');return 'filled'})()`);await wait(250);await evaluate(`document.querySelector('.forum-onboarding .primary-submit')?.click()`);await wait(1400)
await evaluate(`document.querySelector('[aria-label="刷新社区动态"]')?.click()`);await wait(700)
const results=[]
for(const width of [320,375,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:780,deviceScaleFactor:1,mobile:true});await wait(350)
  const metrics=await evaluate(`(()=>{const sheet=document.querySelector('.refresh-sheet');const root=document.documentElement;const boxes=[...document.querySelectorAll('.refresh-sheet *')].map(el=>({el,rect:el.getBoundingClientRect()}));const escaped=boxes.filter(({rect})=>rect.left<-1||rect.right>innerWidth+1).map(({el,rect})=>({tag:el.tagName,class:el.className,left:Math.round(rect.left),right:Math.round(rect.right)})).slice(0,12);return {width:innerWidth,documentOverflow:root.scrollWidth>root.clientWidth,sheet:sheet?{left:sheet.getBoundingClientRect().left,right:sheet.getBoundingClientRect().right,height:sheet.getBoundingClientRect().height}:null,escaped}})()`)
  const image=await send('Page.captureScreenshot',{format:'png',fromSurface:true});fs.writeFileSync(`${outputDir}/forum-refresh-${width}.png`,Buffer.from(image.data,'base64'));results.push(metrics.result.value)
}
await evaluate(`document.querySelector('.refresh-sheet header>button')?.click()`);await wait(250);await evaluate(`document.querySelectorAll('.forum-bottom-nav .nav-tab-btn')[1]?.click()`);await wait(350);await evaluate(`[...document.querySelectorAll('.head-text-btn')].find(item=>item.textContent?.trim()==='创建')?.click()`);await wait(350)
const circleResults=[]
for(const width of [320,375,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:780,deviceScaleFactor:1,mobile:true});await wait(300);const metrics=await evaluate(`(()=>{const sheet=document.querySelector('.overlay>section');const root=document.documentElement;const escaped=[...document.querySelectorAll('.overlay>section *')].map(el=>({el,rect:el.getBoundingClientRect()})).filter(({rect})=>rect.left<-1||rect.right>innerWidth+1).map(({el,rect})=>({tag:el.tagName,class:el.className,left:Math.round(rect.left),right:Math.round(rect.right)})).slice(0,12);return {width:innerWidth,documentOverflow:root.scrollWidth>root.clientWidth,sheet:sheet?{left:sheet.getBoundingClientRect().left,right:sheet.getBoundingClientRect().right,height:sheet.getBoundingClientRect().height}:null,escaped}})()`);const image=await send('Page.captureScreenshot',{format:'png',fromSurface:true});fs.writeFileSync(`${outputDir}/forum-circle-create-${width}.png`,Buffer.from(image.data,'base64'));circleResults.push(metrics.result.value)}
const report={refresh:results,circleCreate:circleResults};fs.writeFileSync(`${outputDir}/metrics.json`,JSON.stringify(report,null,2));process.stdout.write(JSON.stringify(report,null,2));socket.close()
