/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const appUrl = process.argv[2] || 'http://127.0.0.1:4173'
const screenshotPath = process.argv[3] || join(process.cwd(), 'persona-inheritance-qa.png')
const chromePath = join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe')
const edgePath = join(process.env.PROGRAMFILES_X86 || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
const browserPath = existsSync(chromePath) ? chromePath : edgePath
const profileDir = join(tmpdir(), `clingy-persona-qa-${Date.now()}`)
const port = 9333 + Math.floor(Math.random() * 300)
await mkdir(profileDir, { recursive: true })

const browser = spawn(browserPath, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  '--remote-allow-origins=*',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank'
], { stdio: 'ignore', windowsHide: true })

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const waitForJson = async url => {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(url)
      if (response.ok) return response.json()
    } catch {}
    await delay(100)
  }
  throw new Error(`等待浏览器调试端口超时：${url}`)
}

let socket
let nextId = 1
const pending = new Map()
const runtimeErrors = []
const keepAlive = setInterval(() => {}, 1000)

try {
  const targets = await waitForJson(`http://127.0.0.1:${port}/json`)
  const page = targets.find(target => target.type === 'page')
  if (!page) throw new Error('没有找到浏览器页面')
  socket = new WebSocket(page.webSocketDebuggerUrl)
  socket.binaryType = 'arraybuffer'
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  socket.addEventListener('message', event => {
    const payload = typeof event.data === 'string'
      ? event.data
      : new TextDecoder().decode(event.data instanceof ArrayBuffer ? event.data : new Uint8Array(event.data))
    const message = JSON.parse(payload)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      message.error ? reject(new Error(message.error.message)) : resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') {
      runtimeErrors.push(message.params.exceptionDetails?.text || '页面运行异常')
    }
  })
  socket.addEventListener('close', () => {
    for (const { reject } of pending.values()) reject(new Error('浏览器调试连接已关闭'))
    pending.clear()
  })

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  const waitFor = async (expression, label) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return
      await delay(100)
    }
    throw new Error(`等待界面元素超时：${label}`)
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 1, mobile: true })
  await send('Page.navigate', { url: appUrl })
  await waitFor("document.readyState === 'complete'", '应用初始页面')

  await evaluate(`(() => {
    localStorage.clear();
    localStorage.setItem('clingy_chat_auth_state', 'qa-account');
    localStorage.setItem('clingy_chat_accounts', JSON.stringify([{
      id: 'qa-account', name: '测试网名', realName: '', avatarUrl: '', accountId: 'QA-001', persona: ''
    }]));
    localStorage.setItem('app_chat_personas_qa-account', JSON.stringify([{
      id: 101, name: '测试真名', networkName: '测试网名', signature: '测试绑定人设正文',
      customText: '测试绑定备注', mood: '', isCreate: false, avatar: '', boundAccountId: 'qa-account'
    }, { id: 2, name: '', signature: '', customText: '', mood: '', isCreate: true }]));
    localStorage.setItem('clingy_custom_contacts_qa-account', JSON.stringify([{
      id: 'qa-contact', name: '测试角色', remark: '', persona: '测试角色设定', avatarKey: '',
      userProfile: { name: '', remark: '', persona: '', avatarUrl: '' },
      userProfileSource: { type: 'account', personaId: 101, name: '旧账号人设', hasLocalChanges: false },
      groups: [], isPinned: false
    }]));
    localStorage.setItem('clingy_chat_setting_tab', '用户');
    localStorage.setItem('clingy_global_settings', JSON.stringify({ enableLockScreen: false }));
    localStorage.setItem('nianrenji-install-prompt-dismissed', 'true');
    return true;
  })()`)
  await send('Page.reload', { ignoreCache: true })
  await waitFor("[...document.querySelectorAll('.app-name')].some(el => el.textContent.trim() === '聊天')", '聊天应用图标')
  await evaluate("[...document.querySelectorAll('.app-name')].find(el => el.textContent.trim() === '聊天').click()")
  await waitFor("[...document.querySelectorAll('.chat-name')].some(el => el.textContent.trim() === '测试角色')", '测试联系人')
  await evaluate("[...document.querySelectorAll('.chat-name')].find(el => el.textContent.trim() === '测试角色').closest('.chat-item').click()")
  await waitFor("document.querySelectorAll('.chat-advanced-header .icon-btn').length >= 3", '聊天页设置入口')
  await evaluate("[...document.querySelectorAll('.chat-advanced-header .icon-btn')].at(-1).click()")
  await waitFor("document.querySelector('.profile-source-hint')", '用户人设来源提示')

  const result = await evaluate(`(() => {
    const bodyText = document.body.innerText;
    const account = JSON.parse(localStorage.getItem('clingy_chat_accounts'))[0];
    const contact = JSON.parse(localStorage.getItem('clingy_custom_contacts_qa-account'))[0];
    return {
      sourceHint: document.querySelector('.profile-source-hint')?.innerText.trim(),
      showsPersona: bodyText.includes('测试绑定人设正文'),
      showsName: bodyText.includes('测试真名'),
      accountPersona: account.persona,
      migratedProfile: contact.userProfile,
      migratedSource: contact.userProfileSource
    };
  })()`)

  if (!result.sourceHint?.includes('账号人设（自动跟随）')) throw new Error(`来源提示不正确：${result.sourceHint}`)
  if (!result.showsPersona || !result.showsName) throw new Error('聊天设置没有渲染绑定人设资料')
  if (result.accountPersona !== '测试绑定人设正文') throw new Error('绑定人设没有同步到账号资料')
  if (result.migratedProfile !== null || result.migratedSource?.type !== 'account') throw new Error('旧会话快照迁移失败')
  if (runtimeErrors.length) throw new Error(`页面运行异常：${runtimeErrors.join('；')}`)

  const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  await mkdir(join(screenshotPath, '..'), { recursive: true })
  await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'))
  console.log(JSON.stringify({ ok: true, screenshotPath, ...result }, null, 2))
} finally {
  try { socket?.close() } catch {}
  browser.kill()
  await Promise.race([
    new Promise(resolve => browser.once('exit', resolve)),
    delay(1500)
  ])
  try { await rm(profileDir, { recursive: true, force: true }) } catch {}
  clearInterval(keepAlive)
}
