import { writeFile } from 'node:fs/promises'

const port = process.argv[2] || '9223'
const appUrl = process.argv[3] || 'http://127.0.0.1:5180/'
const screenshotPath = process.argv[4]
const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const tab = tabs.find(item => item.type === 'page' && item.url.startsWith(appUrl)) || tabs.find(item => item.type === 'page')
if (!tab) throw new Error('No Chrome page target')
const ws = new WebSocket(tab.webSocketDebuggerUrl)
let sequence = 0
const pending = new Map()
ws.onmessage = event => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message)
    pending.delete(message.id)
  }
}
await new Promise(resolve => { ws.onopen = resolve })
const call = (method, params = {}) => new Promise(resolve => {
  const id = ++sequence
  pending.set(id, resolve)
  ws.send(JSON.stringify({ id, method, params }))
})
const evaluate = async expression => {
  const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text)
  return response.result?.result?.value
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const clickText = text => evaluate(`(()=>{const leaf=Array.from(document.querySelectorAll('*')).find(item=>item.children.length===0&&item.textContent.trim()===${JSON.stringify(text)});const node=leaf?.closest('button,[role="button"],.app-icon-wrapper,.app-item')||leaf?.parentElement;if(!node)return false;node.click();return true})()`)
const setInput = (selector, value) => evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)return false;const setter=Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
const audit = async (label, width) => {
  await call('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true })
  await wait(180)
  const result = await evaluate(`(()=>{const root=document.querySelector('.forum-app-container');if(!root)return {missing:true,bodyText:(document.body?.innerText||'').trim().slice(0,500),bodyHtml:(document.body?.innerHTML||'').slice(0,800)};const intentional=['settings-tabs','composer-tools','member-picks'];const outside=Array.from(root.querySelectorAll('*')).filter(element=>{const style=getComputedStyle(element);if(style.display==='none'||style.position==='fixed')return false;if(intentional.some(name=>element.classList.contains(name)||element.closest('.'+name)))return false;const rect=element.getBoundingClientRect();return rect.width>0&&(rect.left < -1 || rect.right > innerWidth + 1)}).slice(0,12).map(element=>({tag:element.tagName,className:element.className,text:(element.textContent||'').trim().slice(0,40),rect:[Math.round(element.getBoundingClientRect().left),Math.round(element.getBoundingClientRect().right)]}));return {missing:false,viewport:innerWidth,rootWidth:Math.round(root.getBoundingClientRect().width),rootScrollWidth:root.scrollWidth,outside}})()`)
  console.log(label, width, JSON.stringify(result))
  if (result.missing || result.rootScrollWidth > width + 1 || result.outside.length) throw new Error(`${label} failed at ${width}px`)
}

await call('Page.navigate', { url: appUrl })
await wait(3500)
await clickText('知道了')
await clickText('论坛')
await wait(900)
for (const width of [320, 375, 390]) await audit('onboarding', width)
if (await evaluate(`Boolean(document.querySelector('.forum-onboarding'))`)) {
  await setInput('.field-row input', '测试用户')
  await setInput('.handle-input input', 'nrj_layout_test')
  await setInput('.field-area textarea', '用于窄屏布局检查的较长中文简介与 English1234567890')
  await clickText('进入论坛')
  await wait(500)
}
for (const width of [320, 375, 390]) await audit('feed', width)
await clickText('圈子')
await wait(180)
for (const width of [320, 375, 390]) await audit('circles', width)
await clickText('创建')
await wait(100)
for (const width of [320, 375, 390]) await audit('circle-create', width)
await setInput('.create-strip input:nth-of-type(1)', '厨房与日常做饭的超长圈子名称测试')
await setInput('.create-strip input:nth-of-type(2)', '分享日常做饭、菜谱失败经验、食材处理、厨具使用和厨房琐事，不讨论无关内容。')
await clickText('完成')
await wait(180)
for (const width of [320, 375, 390]) await audit('circle-detail', width)
await evaluate(`document.querySelector('button[aria-label="返回"]')?.click()`)
await wait(120)
if (screenshotPath) {
  const capture = await call('Page.captureScreenshot', { format: 'png', fromSurface: true })
  await writeFile(screenshotPath, Buffer.from(capture.result.data, 'base64'))
}
await clickText('我的')
await wait(250)
await clickText('编辑资料')
await wait(250)
for (const width of [320, 375, 390]) await audit('settings', width)
await clickText('圈子')
await wait(100)
await evaluate(`document.querySelector('.setting-details summary')?.click()`)
for (const width of [320, 375, 390]) await audit('settings-circles', width)
await clickText('AI')
await wait(100)
for (const width of [320, 375, 390]) await audit('settings-runtime', width)
ws.close()
console.log('forum mobile UI audit passed')
