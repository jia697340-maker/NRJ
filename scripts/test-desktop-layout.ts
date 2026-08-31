import assert from 'node:assert/strict'

const values = new Map<string, string>()
const localStorageStub = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, String(value)) },
  removeItem: (key: string) => { values.delete(key) },
  clear: () => { values.clear() },
  key: (index: number) => [...values.keys()][index] ?? null,
  get length() { return values.size }
}

Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true })
Object.defineProperty(globalThis, 'window', {
  value: { addEventListener: () => undefined, removeEventListener: () => undefined },
  configurable: true
})

const { appRegistry } = await import('../src/appRegistry')
const { useDesktopLayout } = await import('../src/composables/useDesktopLayout')

const appIds = appRegistry.map(app => app.id)
const fixtureApps = ['mall', 'fate', 'book_store', 'bubble']
localStorage.setItem('clingy_desktop_layout_v2', JSON.stringify({
  version: 2,
  dock: [],
  hiddenAppIds: [],
  pages: [
    { id: 'free-layout-page', entries: fixtureApps.map((id, index) => ({ type: 'app', id, column: index + 1, row: 1 })) },
    { id: 'page-2', entries: [] },
    { id: 'page-3', entries: [] },
    { id: 'page-4', entries: [] }
  ]
}))

const desktop = useDesktopLayout()
desktop.initialize(appIds)

const firstPage = desktop.layout.pages.find(page => page.id === 'free-layout-page')!
const positionOf = (id: string) => {
  const entry = firstPage.entries.find(item => item.id === id)
  assert(entry, `找不到桌面条目 ${id}`)
  return { column: entry.column, row: entry.row }
}

assert(desktop.moveEntry(
  { area: 'page', pageId: firstPage.id, entryId: 'bubble', column: 4, row: 1 },
  { area: 'page', pageId: firstPage.id, column: 2, row: 2 }
))
assert.deepEqual(positionOf('mall'), { column: 1, row: 1 })
assert.deepEqual(positionOf('fate'), { column: 2, row: 1 })
assert.deepEqual(positionOf('book_store'), { column: 3, row: 1 })
assert.deepEqual(positionOf('bubble'), { column: 2, row: 2 })

assert(desktop.moveEntry(
  { area: 'page', pageId: firstPage.id, entryId: 'book_store', column: 3, row: 1 },
  { area: 'page', pageId: firstPage.id, column: 1, row: 2 }
))
assert.deepEqual(positionOf('mall'), { column: 1, row: 1 })
assert.deepEqual(positionOf('fate'), { column: 2, row: 1 })
assert.deepEqual(positionOf('book_store'), { column: 1, row: 2 })
assert.deepEqual(positionOf('bubble'), { column: 2, row: 2 })

assert(desktop.moveEntry(
  { area: 'page', pageId: firstPage.id, entryId: 'mall', column: 1, row: 1 },
  { area: 'page', pageId: firstPage.id, column: 2, row: 1 }
))
assert.deepEqual(positionOf('mall'), { column: 2, row: 1 })
assert.deepEqual(positionOf('fate'), { column: 1, row: 1 })
assert.deepEqual(positionOf('book_store'), { column: 1, row: 2 })
assert.deepEqual(positionOf('bubble'), { column: 2, row: 2 })

const folderId = desktop.createFolder(
  { area: 'page', pageId: firstPage.id, entryId: 'mall', column: 2, row: 1 },
  { area: 'page', pageId: firstPage.id, entryId: 'fate', column: 1, row: 1 }
)
assert(folderId)
assert.deepEqual(desktop.findFolder(folderId)?.appIds, ['fate', 'mall'])
assert(desktop.canMoveEntry(
  { area: 'folder', folderId, index: 0 },
  { area: 'folder', folderId, index: 1 }
), '文件夹内排序能力必须保留')
assert(desktop.moveEntry(
  { area: 'folder', folderId, index: 0 },
  { area: 'folder', folderId, index: 1 }
))
assert.deepEqual(desktop.findFolder(folderId)?.appIds, ['mall', 'fate'])

const widgetPageIndex = desktop.addPage(0)
const added = desktop.addWidget('profile-card-widget', 4, 3, widgetPageIndex)
const widgetBeforeReset = { pageId: desktop.layout.pages[added.pageIndex].id, column: added.location.column, row: added.location.row, width: added.entry.widthUnits, height: added.entry.heightUnits }

desktop.reset(appIds)
const widgetAfterResetPage = desktop.layout.pages.find(page => page.entries.some(entry => entry.id === added.entry.id))
const widgetAfterReset = widgetAfterResetPage?.entries.find(entry => entry.id === added.entry.id)
assert(widgetAfterResetPage && widgetAfterReset?.type === 'widget')
assert.deepEqual(
  { pageId: widgetAfterResetPage.id, column: widgetAfterReset.column, row: widgetAfterReset.row, width: widgetAfterReset.widthUnits, height: widgetAfterReset.heightUnits },
  widgetBeforeReset,
  '未选择删除时必须完整保留小组件页面、坐标和尺寸'
)

const pageIndexOf = (id: string) => desktop.layout.pages.findIndex(page => page.entries.some(entry => entry.id === id))
const beautifyPage = pageIndexOf('widget_beautify')
assert(beautifyPage >= 0)
for (const id of ['character_workshop', 'persona_workshop', 'bubble_dressup', 'character_phone', 'watch_together', 'timebox', 'mcp']) {
  assert.equal(pageIndexOf(id), beautifyPage, `${id} 应与小组件美化位于同一默认页面`)
}
assert.deepEqual(
  desktop.layout.pages[pageIndexOf('mall')].entries.filter(entry => entry.type === 'app').map(entry => entry.id),
  ['mall', 'fate', 'book_store', 'bubble', 'text_game', 'keep_alive', 'appearance_wardrobe', 'game'],
  '第四页应保持两行、每行四个应用的默认顺序'
)

const retainedWidgetPage = desktop.addPage(desktop.layout.pages.length - 1)
const retainedWidget = desktop.addWidget('rectangle-image', 2, 1, retainedWidgetPage)
const retainedPageId = desktop.layout.pages[retainedWidget.pageIndex].id
assert(desktop.resizeWidget(retainedWidget.entry.id, 4, 3), '空白区域中的小组件应允许调整到自定义尺寸')
const resizedWidget = desktop.layout.pages[retainedWidget.pageIndex].entries.find(entry => entry.id === retainedWidget.entry.id)
assert(resizedWidget?.type === 'widget')
assert.deepEqual({ width: resizedWidget.widthUnits, height: resizedWidget.heightUnits }, { width: 4, height: 3 })
assert(desktop.resizeWidget(retainedWidget.entry.id, 2, 1), '应允许恢复为原有尺寸')
desktop.reset(appIds, [added.entry.id])
assert.equal(desktop.layout.pages.some(page => page.entries.some(entry => entry.id === added.entry.id)), false, '只应删除明确选中的小组件')
const retainedAfterDelete = desktop.layout.pages.find(page => page.id === retainedPageId)?.entries.find(entry => entry.id === retainedWidget.entry.id)
assert(retainedAfterDelete?.type === 'widget')
assert.deepEqual(
  { column: retainedAfterDelete.column, row: retainedAfterDelete.row, width: retainedAfterDelete.widthUnits, height: retainedAfterDelete.heightUnits },
  { column: retainedWidget.location.column, row: retainedWidget.location.row, width: 2, height: 1 },
  '删除选中小组件时不得移动或改动其他小组件'
)

console.log('Desktop layout tests passed')
