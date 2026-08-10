import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const browser = spawn(edge, [
  '--headless=old', '--no-sandbox', '--disable-gpu', '--disable-gpu-sandbox',
  '--disable-dev-shm-usage', '--use-gl=swiftshader', '--remote-debugging-pipe',
  '--no-first-run', '--window-size=430,932', 'about:blank'
], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] })

let id = 0
let buffer = ''
const pending = new Map()
browser.stdio[4].setEncoding('utf8')
browser.stdio[4].on('data', chunk => {
  buffer += chunk
  const messages = buffer.split('\0')
  buffer = messages.pop() || ''
  for (const raw of messages) {
    if (!raw) continue
    const message = JSON.parse(raw)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      message.error ? reject(new Error(message.error.message)) : resolve(message.result)
    }
  }
})

const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const messageId = ++id
  pending.set(messageId, { resolve, reject })
  browser.stdio[3].write(JSON.stringify({ id: messageId, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0')
})
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const main = async () => {
  const { targetId } = await send('Target.createTarget', { url: 'http://127.0.0.1:4173' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  await send('Page.enable', {}, sessionId)
  await send('Runtime.enable', {}, sessionId)
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 1, mobile: true }, sessionId)
  await wait(1800)
  const relationship = {
    friendship: 'deleted_by_user', blockedBy: 'none', changedAt: Date.now(),
    blockedMessages: [{ id: Date.now() - 4000, content: '我刚刚还是下意识点开了聊天框。', createdAt: Date.now() - 4000, viewed: false }],
    undeliveredUserMessages: [],
    requests: [{ id: 'request_qa', direction: 'character_to_user', message: '我想了很久，还是想问问你，能不能重新加回来。', status: 'pending', createdAt: Date.now() - 60000, sentAt: Date.now() - 60000 }],
    events: [
      { id: 'event_1', type: 'request_created', title: '对方向你发送了好友申请', detail: '我想了很久，还是想问问你，能不能重新加回来。', createdAt: Date.now() - 60000 },
      { id: 'event_2', type: 'user_deleted_friend', title: '你删除了好友', detail: '角色档案和聊天记录仍会保留。', createdAt: Date.now() - 3600000 }
    ],
    plan: { action: 'reconsider', summary: '准备再等一会儿看看', reviewAt: Date.now() + 18 * 60000, visibility: 'exact' }
  }
  const contact = { id: 'qa_contact', name: '林屿', remark: '', persona: '克制、敏感，有自己的判断。', messages: [{ id: Date.now() - 7200000, type: 'left', content: '晚点再说吧' }], relationship }
  const seed = `localStorage.setItem('clingy_chat_auth_state','qa_user');localStorage.setItem('clingy_chat_accounts',JSON.stringify([{id:'qa_user',name:'测试用户',avatarUrl:'',accountId:'qa',persona:''}]));localStorage.setItem('clingy_custom_contacts_qa_user',JSON.stringify([${JSON.stringify(contact)}]));localStorage.setItem('nianrenji-install-prompt-dismissed','true');location.reload();`
  await send('Runtime.evaluate', { expression: seed }, sessionId)
  await wait(2200)
  const clickText = async text => {
    await send('Runtime.evaluate', { expression: `(()=>{const el=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&e.textContent.trim()===${JSON.stringify(text)});if(el){el.click();return true}return false})()` }, sessionId)
    await wait(900)
  }
  await clickText('聊天')
  await clickText('联系人')
  await clickText('新的朋友')
  const requestShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId)
  await writeFile(process.argv[2], Buffer.from(requestShot.data, 'base64'))
  await clickText('林屿')
  const relationShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId)
  await writeFile(process.argv[3], Buffer.from(relationShot.data, 'base64'))
  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId)
  await wait(500)
  const desktopShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId)
  await writeFile(process.argv[4], Buffer.from(desktopShot.data, 'base64'))
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 1, mobile: true }, sessionId)
  await send('Runtime.evaluate', { expression: `document.querySelector('.header-icon')?.click()` }, sessionId)
  await wait(600)
  await send('Runtime.evaluate', { expression: `document.querySelector('.friends-header button')?.click()` }, sessionId)
  await wait(600)
  await clickText('消息')
  await clickText('林屿')
  const chatShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId)
  await writeFile(process.argv[5], Buffer.from(chatShot.data, 'base64'))
  browser.kill()
}

main().catch(error => { console.error(error); browser.kill(); process.exitCode = 1 })
