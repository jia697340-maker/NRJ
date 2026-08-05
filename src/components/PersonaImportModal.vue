/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, computed, watch } from 'vue'
import AvatarUploadModal from './AvatarUploadModal.vue'
import localforage from 'localforage'
import { worldBooks } from '../store'
import extractChunks from 'png-chunks-extract'
import text from 'png-chunk-text'
import utf8 from 'utf8'
import JSZip from 'jszip'
import * as mammoth from 'mammoth'

const avatarStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'avatars'
})

const props = withDefaults(defineProps<{
  visible: boolean
  mode?: 'card' | 'doc'
}>(), {
  mode: 'card'
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'import', personas: any[]): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const step = ref<'init' | 'preview' | 'edit'>('init')
const parsedList = ref<any[]>([])
const editingItem = ref<any>(null)
const uploadModalVisible = ref(false)

const close = () => {
  emit('update:visible', false)
  setTimeout(() => {
    step.value = 'init'
    parsedList.value = []
    if (fileInputRef.value) fileInputRef.value.value = ''
  }, 300)
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

// 提取PNG中的tEXt chara数据块并解析 UTF-8 Base64
const extractSTCharaFromPng = (buffer: ArrayBuffer) => {
  const chunks = extractChunks(new Uint8Array(buffer))
  const textChunks = chunks.filter((chunk: any) => chunk.name === 'tEXt').map((chunk: any) => text.decode(chunk.data))
  
  for (const chunk of textChunks) {
    if (chunk.keyword === 'chara') {
      try {
        const decodedString = utf8.decode(atob(chunk.text))
        return JSON.parse(decodedString)
      } catch (e) {
        console.error('解析 PNG chara 数据块失败:', e)
      }
    }
  }
  return null
}

const extractWorldBook = (data: any, charName: string): { ids: string[], books: any[] } => {
  const boundBookIds: string[] = []
  const extractedBooks: any[] = []
  const bookData = data.data?.character_book || data.character_book
  if (bookData && bookData.entries && bookData.entries.length > 0) {
    const bookId = 'book_' + Date.now() + '_' + Math.floor(Math.random()*10000)
    const newBook: any = {
      id: bookId,
      type: 'book',
      groupIds: [],
      title: (bookData.name || charName || '未命名') + ' 的专属世界书',
      author: bookData.name || '',
      tags: [],
      rating: 5.0,
      coverColor: '#F2E8E3',
      coverImage: '',
      bgImage: '',
      bgBlur: 40,
      updatedAt: Date.now(),
      enabled: true,
      globalPosition: 'middle',
      globalDepth: 0,
      globalWeight: 1,
      entries: bookData.entries.map((e: any, idx: number) => {
        let light: 'blue' | 'green' = e.constant ? 'blue' : 'green'
        let keywords = ''
        if (e.keys && Array.isArray(e.keys)) {
          keywords = e.keys.join(',')
        }
        let overrideSettings = false
        let depth = 0
        let position: 'front' | 'middle' | 'back' | 'custom' = 'middle'
        
        if (e.position === 'before_char') position = 'front'
        else if (e.position === 'after_char') position = 'back'
        else if (e.position === 'depth' || (e.extensions && e.extensions.position === 4)) {
          position = 'custom'
          overrideSettings = true
          depth = e.extensions?.depth ?? e.depth ?? 0
        }

        return {
          id: bookId + '_entry_' + idx,
          title: e.comment || e.name || '条目 ' + (idx + 1),
          content: e.content || '',
          updatedAt: Date.now(),
          enabled: e.enabled !== false,
          light: light,
          keywords: keywords,
          overrideSettings: overrideSettings,
          position: position,
          depth: depth,
          weight: e.extensions?.weight ?? e.weight ?? 1
        }
      })
    }
    extractedBooks.push(newBook)
    boundBookIds.push(bookId)
  }
  return { ids: boundBookIds, books: extractedBooks }
}

const processPngBuffer = async (buffer: ArrayBuffer, fileName: string, fileIndex: number, list: any[]) => {
  const stData = extractSTCharaFromPng(buffer)
  if (stData) {
    const blob = new Blob([buffer], { type: 'image/png' })
    const reader = new FileReader()
    const dataUrl = await new Promise<string>((resolve) => {
      reader.onload = ev => resolve(ev.target?.result as string)
      reader.readAsDataURL(blob)
    })
    const avatarKey = `avatar_st_${Date.now()}_${Math.floor(Math.random() * 10000)}_${fileIndex}`
    await avatarStore.setItem(avatarKey, dataUrl)
    
    const name = stData.data?.name || stData.name || '未命名'
    const signature = stData.data?.description || stData.description || ''
    const firstMes = stData.data?.first_mes || stData.first_mes || ''
    const fullDesc = signature + (firstMes ? '\n\n' + firstMes : '')
    
    const wbResult = extractWorldBook(stData, name)
    
    list.push({
      id: Date.now() + Math.random() + fileIndex,
      name: name,
      signature: fullDesc,
      avatar: avatarKey, // 使用 IndexedDB Key
      avatarObjUrl: URL.createObjectURL(blob), // 仅供预览
      boundWorldBooks: wbResult.ids,
      pendingWorldBooks: wbResult.books,
      selected: true
    })
  } else {
    console.warn(`未能在 PNG (${fileName}) 中找到有效的人设数据(chara chunk)`)
  }
}

const processTextDocument = (content: string, fileName: string, fileIndex: number | string, list: any[]) => {
  let name = fileName.replace(/\.[^/.]+$/, "") // 去掉后缀
  // 如果路径中有文件夹，仅取文件名
  if (name.includes('/')) name = name.split('/').pop() || name
  
  list.push({
    id: Date.now() + Math.random() + (typeof fileIndex === 'number' ? fileIndex : 0),
    name: name || '未命名',
    signature: content,
    avatar: '',
    boundWorldBooks: [],
    pendingWorldBooks: [],
    selected: true
  })
}

const processDocxBuffer = async (buffer: ArrayBuffer, fileName: string, fileIndex: number | string, list: any[]) => {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer })
    const text = result.value
    processTextDocument(text, fileName, fileIndex, list)
  } catch (err) {
    console.error(`解析 DOCX (${fileName}) 失败:`, err)
  }
}

const processJsonString = (content: string, fileIndex: number | string, list: any[]) => {
  const data = JSON.parse(content)
  // 判断是否是 ST 单张角色卡
  if (data.spec === 'chara_card_v2' || data.spec === 'chara_card_v3' || data.name) {
    const name = data.data?.name || data.name || '未命名'
    const signature = data.data?.description || data.description || ''
    const firstMes = data.data?.first_mes || data.first_mes || ''
    const fullDesc = signature + (firstMes ? '\n\n' + firstMes : '')
    
    const wbResult = extractWorldBook(data, name)
    
    list.push({
      id: Date.now() + Math.random() + (typeof fileIndex === 'number' ? fileIndex : 0),
      name: name,
      signature: fullDesc,
      avatar: '',
      boundWorldBooks: wbResult.ids,
      pendingWorldBooks: wbResult.books,
      selected: true
    })
  } else if (data.personas && data.persona_descriptions) {
    // 旧版批量结构
    for (const key in data.personas) {
      const name = data.personas[key]
      const descObj = data.persona_descriptions[key]
      const signature = descObj?.description || ''
      const avatar = data.avatars?.[key] || data.avatar_files?.[key] || descObj?.avatar || ''
      
      list.push({
        id: Date.now() + Math.random() + key,
        _key: key,
        name: name,
        signature: signature,
        avatar: avatar,
        boundWorldBooks: [],
        selected: true
      })
    }
  }
}

const handleFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  try {
    let list: any[] = []
    let zipFileIndexCounter = 0
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      try {
        if (file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
          // 处理 ZIP 文件
          const zip = new JSZip()
          const zipContent = await zip.loadAsync(file)
          
          for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
            if (zipEntry.dir) continue
            // 忽略 macOS 的 __MACOSX 等隐藏文件
            if (relativePath.includes('__MACOSX/') || relativePath.split('/').pop()?.startsWith('.')) continue
            
            try {
              if (props.mode === 'doc') {
                if (relativePath.toLowerCase().endsWith('.txt') || relativePath.toLowerCase().endsWith('.md')) {
                  const content = await zipEntry.async('text')
                  processTextDocument(content, relativePath, i * 1000 + zipFileIndexCounter++, list)
                } else if (relativePath.toLowerCase().endsWith('.docx')) {
                  const buffer = await zipEntry.async('arraybuffer')
                  await processDocxBuffer(buffer, relativePath, i * 1000 + zipFileIndexCounter++, list)
                }
              } else {
                if (relativePath.toLowerCase().endsWith('.png')) {
                  const buffer = await zipEntry.async('arraybuffer')
                  await processPngBuffer(buffer, relativePath, i * 1000 + zipFileIndexCounter++, list)
                } else if (relativePath.toLowerCase().endsWith('.json')) {
                  const content = await zipEntry.async('text')
                  processJsonString(content, i * 1000 + zipFileIndexCounter++, list)
                }
              }
            } catch (innerZipErr) {
               console.warn(`解析压缩包内文件 ${relativePath} 时跳过:`, innerZipErr)
            }
          }
        } else {
          // 单个文件解析
          if (props.mode === 'doc') {
            if (file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
              const content = await file.text()
              processTextDocument(content, file.name, i, list)
            } else if (file.name.toLowerCase().endsWith('.docx')) {
              const buffer = await file.arrayBuffer()
              await processDocxBuffer(buffer, file.name, i, list)
            }
          } else {
            if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
              const buffer = await file.arrayBuffer()
              await processPngBuffer(buffer, file.name, i, list)
            } else if (file.name.toLowerCase().endsWith('.json')) {
              const content = await file.text()
              processJsonString(content, i, list)
            }
          }
        }
      } catch (innerErr) {
         console.warn(`解析文件 ${file.name} 时跳过:`, innerErr)
      }
    }
    
    if (list.length > 0) {
      parsedList.value = list
      step.value = 'preview'
    } else {
      throw new Error('无法解析选中文件中的人设数据')
    }
  } catch (err: any) {
    alert('解析失败：' + err.message)
  }
}

const selectedCount = computed(() => parsedList.value.filter(p => p.selected).length)
const isAllSelected = computed(() => parsedList.value.length > 0 && selectedCount.value === parsedList.value.length)

const toggleSelectAll = () => {
  const val = !isAllSelected.value
  parsedList.value.forEach(p => p.selected = val)
}

const openEdit = (item: any) => {
  editingItem.value = { ...item }
  step.value = 'edit'
}

const saveEdit = () => {
  const index = parsedList.value.findIndex(p => p.id === editingItem.value.id)
  if (index > -1) {
    parsedList.value[index] = { ...editingItem.value }
  }
  step.value = 'preview'
}

const cancelEdit = () => {
  step.value = 'preview'
}

const handleAvatarSaved = (url: string | null) => {
  if (editingItem.value) {
    editingItem.value.avatar = url || ''
    editingItem.value.avatarObjUrl = ''
  }
}

const confirmImport = () => {
  const toImport = parsedList.value
    .filter(p => p.selected)
    .map(p => {
      // 释放对象URL
      if (p.avatarObjUrl) {
        URL.revokeObjectURL(p.avatarObjUrl)
      }
      // 只有在此处被选中的角色，其对应的世界书才真正推入全局 store
      if (p.pendingWorldBooks && p.pendingWorldBooks.length > 0) {
        p.pendingWorldBooks.forEach((book: any) => {
          worldBooks.push(book)
        })
      }
      return {
        id: Date.now() + Math.floor(Math.random() * 10000),
        name: p.name,
        signature: p.signature,
        avatar: p.avatar,
        mood: '',
        isCreate: false,
        boundWorldBooks: p.boundWorldBooks || []
      }
    })
  
  if (toImport.length === 0) {
    alert('请至少选择一个人设')
    return
  }
  
  emit('import', toImport)
  close()
}
</script>

<template>
  <div v-if="props.visible" class="modal-overlay">
    <div class="modal-content">
      
      <!-- 头部 -->
      <div class="modal-header">
        <h3 class="modal-title">
          {{ step === 'init' ? (props.mode === 'doc' ? '导入设定文档' : '导入人设卡') : step === 'preview' ? '设定预览' : '编辑人设' }}
        </h3>
        <div class="close-btn" @click="close">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </div>
      </div>

      <!-- 内容区: Init -->
      <div v-if="step === 'init'" class="step-init">
        <div class="upload-area" @click="triggerFileInput">
          <svg v-if="props.mode === 'doc'" viewBox="0 0 24 24" width="48" height="48" stroke="#ccc" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          <svg v-else viewBox="0 0 24 24" width="48" height="48" stroke="#ccc" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          
          <div class="upload-text">{{ props.mode === 'doc' ? '导入设定文档' : '导入 SillyTavern 角色卡' }}</div>
          <div class="upload-subtext">{{ props.mode === 'doc' ? '支持 TXT / MD / DOCX / ZIP 格式' : '支持 PNG / JSON / ZIP 格式' }}</div>
        </div>
        <input type="file" ref="fileInputRef" :accept="props.mode === 'doc' ? '.txt, .md, .docx, .zip' : '.json, .png, .zip'" multiple style="display: none" @change="handleFileChange" />
      </div>

      <!-- 内容区: Preview -->
      <div v-if="step === 'preview'" class="step-preview">
        <div class="preview-toolbar">
          <div class="select-all" @click="toggleSelectAll">
            <div class="checkbox" :class="{ checked: isAllSelected }"></div>
            <span>全选 ({{ selectedCount }}/{{ parsedList.length }})</span>
          </div>
        </div>
        
        <div class="persona-grid">
          <div v-for="item in parsedList" :key="item.id" class="persona-card" :class="{ selected: item.selected }">
            <div class="card-checkbox" @click="item.selected = !item.selected">
              <div class="checkbox" :class="{ checked: item.selected }">
                <svg v-if="item.selected" viewBox="0 0 24 24" width="12" height="12" stroke="white" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
            </div>
            
            <div class="card-content" @click="openEdit(item)">
              <div class="card-avatar" :style="(item.avatarObjUrl || item.avatar) ? { backgroundImage: `url(${item.avatarObjUrl || item.avatar})` } : {}">
                <span v-if="!(item.avatarObjUrl || item.avatar)">{{ item.name.charAt(0) || '设' }}</span>
              </div>
              <div class="card-info">
                <div class="card-name">{{ item.name }}</div>
                <div class="card-desc">{{ item.signature || '暂无详细设定...' }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="bottom-actions">
          <button class="btn cancel" @click="step = 'init'">重新选择</button>
          <button class="btn confirm" :disabled="selectedCount === 0" @click="confirmImport">确认导入</button>
        </div>
      </div>

      <!-- 内容区: Edit -->
      <div v-if="step === 'edit' && editingItem" class="step-edit">
        <div class="edit-avatar-wrap" @click="uploadModalVisible = true">
          <div class="edit-avatar" :style="(editingItem.avatarObjUrl || editingItem.avatar) ? { backgroundImage: `url(${editingItem.avatarObjUrl || editingItem.avatar})` } : {}">
            <span v-if="!(editingItem.avatarObjUrl || editingItem.avatar)">上传头像</span>
          </div>
        </div>
        
        <div class="form-group">
          <label>人设名称</label>
          <input type="text" v-model="editingItem.name" placeholder="请输入名称" class="edit-input" />
        </div>
        
        <div class="form-group">
          <label>详细设定</label>
          <textarea v-model="editingItem.signature" placeholder="请输入详细设定..." class="edit-textarea"></textarea>
        </div>
        
        <div class="bottom-actions">
          <button class="btn cancel" @click="cancelEdit">取消</button>
          <button class="btn confirm" @click="saveEdit">保存</button>
        </div>
      </div>

    </div>
    
    <Teleport to="body">
      <AvatarUploadModal 
        v-model:visible="uploadModalVisible" 
        :current-avatar="editingItem?.avatar || ''"
        shape="avatar"
        @saved="handleAvatarSaved" 
      />
    </Teleport>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  width: 100%;
  max-width: 400px;
  max-height: 85vh;
  background: var(--sys-bg-secondary);
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
}

/* Init */
.step-init {
  padding: 40px 20px;
}
.upload-area {
  border: 2px dashed var(--border-color);
  border-radius: 12px;
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  background: var(--sys-bg-primary);
  transition: all 0.2s;
}
.upload-area:hover {
  background: var(--sys-bg-primary);
  border-color: #bbb;
}
.upload-text {
  margin-top: 16px;
  font-size: 15px;
  color: var(--text-primary);
  font-weight: 500;
}
.upload-subtext {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}

/* Preview */
.step-preview {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}
.preview-toolbar {
  padding: 12px 20px;
  border-bottom: 1px solid #f5f5f5;
  background: var(--sys-bg-primary);
}
.select-all {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
}
.checkbox {
  width: 18px; height: 18px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.checkbox.checked {
  background: #a0a0a0;
  border-color: #a0a0a0;
}
.persona-grid {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.persona-card {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  background: #fdfdfd;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 12px;
  transition: all 0.2s;
}
.persona-card.selected {
  border-color: #a0a0a0;
  background: var(--sys-bg-primary);
}
.card-checkbox {
  flex-shrink: 0;
  margin-right: 12px;
  cursor: pointer;
}
.card-content {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  overflow: hidden;
}
.card-avatar {
  flex-shrink: 0;
  width: 44px; height: 44px;
  border-radius: 50%;
  background-color: var(--sys-bg-primary);
  background-size: cover;
  background-position: center;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; color: var(--text-tertiary);
  font-weight: 500;
}
.card-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap; 
  overflow: hidden; 
  text-overflow: ellipsis;
}
.card-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap; 
  overflow: hidden; 
  text-overflow: ellipsis;
  margin-top: 4px;
}

/* Edit */
.step-edit {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}
.edit-avatar-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}
.edit-avatar {
  width: 80px; height: 80px;
  border-radius: 50%;
  background-color: var(--sys-bg-primary);
  background-size: cover;
  background-position: center;
  border: 1px dashed var(--border-color);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: var(--text-tertiary);
  cursor: pointer;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.edit-input, .edit-textarea {
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
}
.edit-input:focus, .edit-textarea:focus {
  border-color: var(--text-primary);
}
.edit-textarea {
  height: 120px;
  resize: vertical;
}

/* Actions */
.bottom-actions {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 12px;
}
.btn {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  outline: none;
  transition: opacity 0.2s;
}
.btn:active {
  opacity: 0.8;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn.cancel {
  background: var(--sys-bg-primary);
  color: var(--text-secondary);
}
.btn.confirm {
  background: #111;
  color: #fff;
}
</style>
