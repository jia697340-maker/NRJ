import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

try {
  const walletSource = await readFile('src/services/walletService.ts', 'utf8')
  const walletTranspiled = ts.transpileModule(walletSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const walletUrl = `data:text/javascript;base64,${Buffer.from(walletTranspiled).toString('base64')}`
  const source = await readFile('src/services/transferLifecycle.ts', 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText.replace("from './walletService';", `from '${walletUrl}';`)
  const lifecycle = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)

  const transferData = lifecycle.createTransferData({
    type: 'transfer',
    amount: 88,
    remark: '测试转账',
    expireHours: 2,
    sender: 'character'
  })
  const transferMessage = { id: lifecycle.createChatMessageId(), type: 'left', content: '[发来一笔转账]', transferData }
  const laterMessage = { id: lifecycle.createChatMessageId(), type: 'left', content: '转账后继续说话' }
  const chat = { name: '角色', messages: [transferMessage, laterMessage] }

  const rejected = lifecycle.resolveTransfer({
    chat,
    transferId: transferData.id,
    action: 'reject',
    actor: 'user',
    userName: '用户'
  })
  assert.equal(rejected.ok, true)
  assert.equal(transferData.status, 'rejected')
  assert.equal(chat.messages.at(-1).systemKind, 'transfer_event')
  assert.equal(chat.messages.at(-1).transferMessageId, transferMessage.id)
  assert.equal(chat.preview, '[转账已退还]')

  const duplicate = lifecycle.resolveTransfer({
    chat,
    transferId: transferData.id,
    action: 'claim',
    actor: 'user',
    userName: '用户'
  })
  assert.equal(duplicate.ok, false)
  assert.equal(duplicate.reason, 'already_resolved')

  const context = lifecycle.formatTransferForContext(transferMessage)
  assert.match(context, /sender="character"/)
  assert.match(context, /receiver="user"/)
  assert.match(context, /status="rejected"/)

  const legacyTransfer = {
    id: 100,
    type: 'right',
    content: '[发来一笔转账]',
    transferData: { id: 101, type: 'transfer', amount: 12, remark: '', status: 'pending', expireTime: Date.now() + 3600000 }
  }
  const legacyEvent = { id: 102, type: 'system', content: '角色退回了用户的转账' }
  const legacyChat = { messages: [legacyTransfer, legacyEvent] }
  assert.equal(lifecycle.normalizeChatTransfers(legacyChat), true)
  assert.equal(legacyTransfer.transferData.status, 'rejected')
  assert.equal(legacyEvent.systemKind, 'transfer_event')
  assert.equal(legacyEvent.transferMessageId, legacyTransfer.id)

  const orphanChat = { messages: [{ id: 200, type: 'system', content: '角色退回了用户的红包' }] }
  assert.equal(lifecycle.normalizeChatTransfers(orphanChat), true)
  assert.equal(orphanChat.messages[0].systemKind, 'transfer_event_orphan')
  assert.match(orphanChat.messages[0].content, /历史转账记录不完整/)

  console.log('transfer lifecycle tests passed')
} finally {}
