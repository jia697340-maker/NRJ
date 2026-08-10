/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
const { chromium } = require('playwright')
const path = require('path')

const root = path.resolve(__dirname, '..')
const run = async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 })
  await context.addInitScript(() => {
    localStorage.setItem('nianrenji-install-prompt-dismissed', 'true')
    localStorage.removeItem('clingy_desktop_layout_v1')
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' })
  await page.getByText('角色工坊', { exact: true }).click()
  await page.waitForSelector('.cw-home')
  const featureCards = await page.locator('.cw-mode-card').count()
  await page.getByRole('button', { name: /模板、导入与分享/ }).click()
  await page.waitForSelector('.template-modal')
  await page.screenshot({ path: path.join(root, 'qa-character-template-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: '关闭' }).click()
  await page.screenshot({ path: path.join(root, 'qa-character-home-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: /提示词生成/ }).first().click()
  await page.waitForSelector('.cw-workspace')
  const desktopRects = await page.evaluate(() => ({
    scrollY,
    app: document.querySelector('.character-workshop')?.getBoundingClientRect().toJSON(),
    header: document.querySelector('.cw-app-header')?.getBoundingClientRect().toJSON(),
    workspace: document.querySelector('.cw-workspace')?.getBoundingClientRect().toJSON()
  }))
  await page.screenshot({ path: path.join(root, 'qa-character-workspace-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: '质量中心', exact: true }).click()
  await page.waitForSelector('.quality-modal')
  await page.screenshot({ path: path.join(root, 'qa-character-quality-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: '关闭' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(root, 'qa-character-workspace-mobile.png'), fullPage: true })
  const metrics = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    bodyWidth: document.body.scrollWidth,
    appWidth: document.querySelector('.character-workshop')?.scrollWidth,
    visiblePanels: [...document.querySelectorAll('.cw-brief-panel,.cw-profile-panel,.cw-studio-panel')].filter(node => getComputedStyle(node).display !== 'none').length
  }))
  console.log(JSON.stringify({ pageErrors, featureCards, desktopRects, metrics }))
  await browser.close()
}
run().catch(error => { console.error(error); process.exit(1) })
