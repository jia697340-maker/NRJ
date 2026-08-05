/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'
import localforage from 'localforage'

export interface EmojiItem {
  id: string
  name: string
  type: 'local' | 'url'
  data: string | Blob // URL string or File/Blob
  category: 'user' | 'role' | 'global'
  roleId?: number // 当 category 为 role 时需要
  previewUrl?: string // 仅用于前端临时预览和展示的 URL
  groupIds?: string[] // 新增：所属的分组ID列表
}

export interface EmojiGroup {
  id: string
  name: string
  category: 'user' | 'role' | 'global'
  roleId?: number
}

// 预览池项目
export interface PreviewEmojiItem extends Omit<EmojiItem, 'category'> {
  selected: boolean
}

// 初始化专属数据库
const emojiStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'chatEmojis'
})

// 提升为全局状态（单例），避免在多组件调用时状态不共享导致数据相互覆盖
const emojis = ref<EmojiItem[]>([])
const groups = ref<EmojiGroup[]>([])
const previewPool = ref<PreviewEmojiItem[]>([])
const isParsing = ref(false)

export function useChatEmoji() {
  const GROUPS_KEY = '__emoji_groups__'

  // 初始化加载所有表情和分组
  const loadEmojis = async () => {
    try {
      const loadedGroups = await emojiStore.getItem<EmojiGroup[]>(GROUPS_KEY)
      if (loadedGroups) {
        groups.value = loadedGroups
      }

      const keys = await emojiStore.keys()
      const loaded: EmojiItem[] = []
      for (const key of keys) {
        if (key === GROUPS_KEY) continue
        const item = await emojiStore.getItem<EmojiItem>(key)
        if (item) {
          // 确保 groupIds 存在
          if (!item.groupIds) {
            item.groupIds = []
          }
          // 如果是本地 Blob，生成临时预览链接
          if (item.type === 'local' && item.data instanceof Blob) {
            item.previewUrl = URL.createObjectURL(item.data)
          } else if (item.type === 'url' && typeof item.data === 'string') {
            item.previewUrl = item.data
          }
          loaded.push(item)
        }
      }
      emojis.value = loaded
    } catch (err) {
      console.error('Failed to load emojis or groups:', err)
    }
  }

  // 保存分组到数据库
  const saveGroupsToDB = async () => {
    try {
      // 必须将 Vue Proxy 对象转为普通对象，否则会导致 IndexedDB 报错 DataCloneError
      const plainGroups = JSON.parse(JSON.stringify(groups.value))
      await emojiStore.setItem(GROUPS_KEY, plainGroups)
    } catch (err) {
      console.error('Failed to save groups:', err)
    }
  }

  // 添加分组
  const addGroup = async (name: string, category: 'user' | 'role' | 'global', roleId?: number) => {
    const newGroup: EmojiGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      category,
      roleId
    }
    groups.value.push(newGroup)
    await saveGroupsToDB()
    return newGroup
  }

  // 更新分组
  const updateGroup = async (id: string, name: string) => {
    const group = groups.value.find(g => g.id === id)
    if (group) {
      group.name = name
      await saveGroupsToDB()
    }
  }

  // 删除分组
  const deleteGroups = async (ids: string[]) => {
    groups.value = groups.value.filter(g => !ids.includes(g.id))
    await saveGroupsToDB()
    
    // 同时将这些分组ID从所有表情包中移除
    let needsUpdate = false
    const updatedEmojis: EmojiItem[] = []
    
    emojis.value.forEach(emoji => {
      if (emoji.groupIds && emoji.groupIds.some(id => ids.includes(id))) {
        emoji.groupIds = emoji.groupIds.filter(id => !ids.includes(id))
        needsUpdate = true
        updatedEmojis.push(emoji)
      }
    })
    
    if (needsUpdate && updatedEmojis.length > 0) {
      await saveEmojisToDB(updatedEmojis)
    }
  }

  // 批量修改表情包的分组
  // operation: 'add' (追加分组), 'set' (覆盖分组), 'remove' (移除分组), 'clear' (清空所有分组)
  const updateEmojisGroup = async (emojiIds: string[], targetGroupIds: string[], operation: 'add' | 'set' | 'remove' | 'clear' = 'add') => {
    const targetEmojis = emojis.value.filter(e => emojiIds.includes(e.id))
    if (targetEmojis.length === 0) return

    targetEmojis.forEach(emoji => {
      if (!emoji.groupIds) emoji.groupIds = []
      
      switch (operation) {
        case 'add':
          targetGroupIds.forEach(id => {
            if (!emoji.groupIds!.includes(id)) {
              emoji.groupIds!.push(id)
            }
          })
          break
        case 'set':
          emoji.groupIds = [...targetGroupIds]
          break
        case 'remove':
          emoji.groupIds = emoji.groupIds.filter(id => !targetGroupIds.includes(id))
          break
        case 'clear':
          emoji.groupIds = []
          break
      }
    })

    await saveEmojisToDB(targetEmojis)
  }

  // 合并分组: 将 sourceGroupIds 中的所有表情添加到 targetGroupId，然后删除 sourceGroupIds
  const mergeGroups = async (sourceGroupIds: string[], targetGroupId: string) => {
    // 找出所有属于源分组的表情
    const emojisToUpdate = emojis.value.filter(e => 
      e.groupIds && e.groupIds.some(id => sourceGroupIds.includes(id))
    )
    
    // 将它们添加到目标分组
    await updateEmojisGroup(emojisToUpdate.map(e => e.id), [targetGroupId], 'add')
    
    // 删除源分组
    await deleteGroups(sourceGroupIds)
  }

  // 跨大类转移/复制表情包
  const transferEmojis = async (emojiIds: string[], targetCategories: ('user' | 'role' | 'global')[], targetRoleId?: number, isCopy: boolean = false) => {
    const targetEmojis = emojis.value.filter(e => emojiIds.includes(e.id))
    if (targetEmojis.length === 0 || targetCategories.length === 0) return

    const newItemsToSave: EmojiItem[] = []

    // 无论是否是复制模式，如果选择了多个目标分类，或者明确选择了复制模式，都需要克隆
    // 特殊情况：如果是移动模式（isCopy = false），且只有1个目标大类，我们可以直接修改原始数据
    if (!isCopy && targetCategories.length === 1) {
      const singleTarget = targetCategories[0]
      targetEmojis.forEach(item => {
        item.category = singleTarget
        item.roleId = singleTarget === 'role' ? targetRoleId : undefined
        item.groupIds = [] // 清空原有分组
      })
      await saveEmojisToDB(targetEmojis)
      return
    }

    // 否则（多选目标，或者单选但要求复制）：遍历目标大类生成克隆体
    targetCategories.forEach(targetCat => {
      targetEmojis.forEach(item => {
        newItemsToSave.push({
          id: `emoji_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: item.name,
          type: item.type,
          data: item.data, // 同一份数据
          category: targetCat,
          roleId: targetCat === 'role' ? targetRoleId : undefined,
          groupIds: [] 
        })
      })
    })

    // 保存所有克隆出来的新表情
    if (newItemsToSave.length > 0) {
      await saveEmojisToDB(newItemsToSave)
    }

    // 如果不是复制模式（也就是说是移动模式），在克隆分配完给多个目标分类后，应该删除原分类中的原始表情
    if (!isCopy) {
      // 这里可以批量删除
      for (const id of emojiIds) {
        // 注意：不调用 deleteEmoji 因为 deleteEmoji 会 revoke 本地 URL！
        // 因为我们克隆时用的是同个 Blob，如果 revoke 就会导致新表情也裂图。
        // 所以我们只从 db 删除并从数组移除。
        await emojiStore.removeItem(id)
      }
      emojis.value = emojis.value.filter(e => !emojiIds.includes(e.id))
    }
  }

  // 释放 ObjectURL 避免内存泄漏
  const revokePreviewUrls = (items: { type: string, previewUrl?: string }[]) => {
    items.forEach(item => {
      if (item.type === 'local' && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl)
      }
    })
  }

  // 将表情保存到数据库
  const saveEmojisToDB = async (items: EmojiItem[]) => {
    try {
      for (const item of items) {
        // 不要保存临时的 previewUrl
        const toSave = { ...item }
        delete toSave.previewUrl
        
        // 确保数组类型是普通数组，避免 Proxy 引发 DataCloneError
        if (toSave.groupIds) {
          toSave.groupIds = [...toSave.groupIds]
        }
        
        await emojiStore.setItem(toSave.id, toSave)
      }
      // 重新加载刷新列表
      await loadEmojis()
    } catch (err) {
      console.error('Failed to save emojis:', err)
      throw err
    }
  }

  // 删除表情
  const deleteEmoji = async (id: string) => {
    try {
      const item = emojis.value.find(e => e.id === id)
      if (item && item.type === 'local' && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl)
      }
      await emojiStore.removeItem(id)
      emojis.value = emojis.value.filter(e => e.id !== id)
    } catch (err) {
      console.error('Failed to delete emoji:', err)
    }
  }

  // 更新表情
  const updateEmoji = async (id: string, updates: Partial<EmojiItem>) => {
    try {
      const index = emojis.value.findIndex(e => e.id === id)
      if (index === -1) return

      const currentItem = emojis.value[index]
      
      // 如果改变了本地文件，释放旧的 URL
      if (updates.type === 'local' || (updates.type === 'url' && currentItem.type === 'local')) {
         if (currentItem.type === 'local' && currentItem.previewUrl) {
            URL.revokeObjectURL(currentItem.previewUrl)
         }
      }

      const newItem = { ...currentItem, ...updates }
      
      // 不保存 previewUrl 到数据库
      const toSave = { ...newItem }
      delete toSave.previewUrl

      await emojiStore.setItem(id, toSave)
      
      // 重新加载以确保状态一致，或者直接在内存中更新
      emojis.value[index] = newItem
    } catch (err) {
      console.error('Failed to update emoji:', err)
      throw err
    }
  }

  // --- 解析模块 ---

  // 强大的正则提取 URL 与可能的名字
  const extractUrlsFromText = (text: string) => {
    const results: { url: string, name: string }[] = []
    
    // 匹配常规 URL 的正则
    // 使用 split 切分文本，这样可以把连续在一行的多个 "名字 URL 名字 URL" 拆分开
    const urlRegex = /(https?:\/\/[^\s<>"']+?\.(?:jpg|jpeg|gif|png|webp|svg)(?:\?[^\s<>"']*)?)/gi
    
    // parts 结构将是：[前文本, URL1, 中间文本, URL2, 后文本...]
    const parts = text.split(urlRegex)
    
    let counter = 1
    
    for (let i = 1; i < parts.length; i += 2) {
      const url = parts[i]
      let possibleName = parts[i - 1]
      
      // 去除可能遗留的 markdown 符号，如前一个 URL 留下的 ')' 或 ']'
      possibleName = possibleName.replace(/^[\])]+/, '')
      
      // 检查当前是不是 markdown 格式： ![名字]( 结尾
      const mdMatch = possibleName.match(/!\[(.*?)\]\($/)
      if (mdMatch) {
        possibleName = mdMatch[1]
      } else {
        // 去掉冒号并清除首尾空格
        possibleName = possibleName.replace(/[:：]/g, '').trim()
        // 如果可能的名字跨越多行（比如上一行的末尾是当前表情的名字），取最后一行
        if (possibleName.includes('\n')) {
          const lines = possibleName.split('\n')
          possibleName = lines.pop()?.trim() || ''
        }
      }

      if (!possibleName) {
        // 从 URL 的最后一部分生成一个默认名字
        const urlParts = url.split('/')
        const lastPart = urlParts[urlParts.length - 1].split('?')[0]
        possibleName = lastPart || `表情 ${counter}`
      }
      
      results.push({
        url,
        name: possibleName
      })
      counter++
    }
    
    return results
  }

  // 处理纯文本内容解析
  const parseTextContent = (text: string) => {
    const extracted = extractUrlsFromText(text)
    extracted.forEach(item => {
      previewPool.value.push({
        id: `prev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: item.name,
        type: 'url',
        data: item.url,
        previewUrl: item.url,
        selected: true
      })
    })
  }

  // 处理本地文件上传 (图片、文本、ZIP)
  const parseLocalFiles = async (files: File[]) => {
    isParsing.value = true
    try {
      for (const file of files) {
        // 1. 本地图片处理
        if (file.type.startsWith('image/')) {
          const previewUrl = URL.createObjectURL(file)
          previewPool.value.push({
            id: `prev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: file.name.replace(/\.[^/.]+$/, ""), // 移除扩展名
            type: 'local',
            data: file,
            previewUrl: previewUrl,
            selected: true
          })
          continue
        }
        
        // 2. 文本类文件处理 (txt, md, json, world)
        if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.world')) {
          const text = await file.text()
          parseTextContent(text)
          continue
        }

        // 3. Word 文档处理 (.docx) - 实质上也是一个 ZIP 包
        if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          // @ts-ignore
          if (typeof window.JSZip !== 'undefined') {
            // @ts-ignore
            const jszip = new window.JSZip()
            const zip = await jszip.loadAsync(file)
            
            // 提取 word 核心的 xml 内容
            const docXmlFile = zip.file('word/document.xml')
            if (docXmlFile) {
              const xmlContent = await docXmlFile.async('string')
              // 使用极其野蛮但有效的正则，剥离所有 XML 标签，提取出纯文本
              const pureText = xmlContent.replace(/<[^>]+>/g, '')
              parseTextContent(pureText)
            }
          } else {
            console.error('JSZip 库未加载，无法解析 DOCX 文件')
          }
          continue
        }

        // 4. ZIP 压缩包处理
        if (file.name.endsWith('.zip') || file.type === 'application/zip') {
          // @ts-ignore
          if (typeof window.JSZip !== 'undefined') {
            // @ts-ignore
            const jszip = new window.JSZip()
            const zip = await jszip.loadAsync(file)
            
            for (const [filename, zipEntry] of Object.entries(zip.files)) {
              // @ts-ignore
              if (!zipEntry.dir) {
                // 判断是否是图片
                const ext = filename.split('.').pop()?.toLowerCase()
                if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
                  // @ts-ignore
                  const blob = await zipEntry.async("blob")
                  const previewUrl = URL.createObjectURL(blob)
                  previewPool.value.push({
                    id: `prev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: filename.split('/').pop()?.replace(/\.[^/.]+$/, "") || 'ZIP图片',
                    type: 'local',
                    data: blob,
                    previewUrl: previewUrl,
                    selected: true
                  })
                }
                // 判断是否是支持提取URL的文本
                else if (['txt', 'md', 'json', 'world'].includes(ext || '')) {
                  // @ts-ignore
                  const text = await zipEntry.async("string")
                  parseTextContent(text)
                }
              }
            }
          } else {
            console.error('JSZip 库未加载，无法解析 ZIP 文件')
          }
          continue
        }
      }
    } catch (err) {
      console.error('Error parsing files:', err)
    } finally {
      isParsing.value = false
    }
  }

  // 确认导入选中的预览项
  const confirmImport = async (category: 'user' | 'role' | 'global', roleId?: number) => {
    const selectedItems = previewPool.value.filter(item => item.selected)
    if (selectedItems.length === 0) return 0

    const itemsToSave: EmojiItem[] = selectedItems.map(item => ({
      id: `emoji_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: item.name,
      type: item.type,
      data: item.data,
      category,
      roleId,
      previewUrl: item.previewUrl // 临时传递，保存时会被剔除
    }))

    await saveEmojisToDB(itemsToSave)

    // 清理未被选中的本地 Blob ObjectURL 防止内存泄漏
    const unselectedItems = previewPool.value.filter(item => !item.selected)
    revokePreviewUrls(unselectedItems)

    // 清空预览池
    previewPool.value = []
    
    return itemsToSave.length
  }

  // 取消导入并清理预览池
  const clearPreviewPool = () => {
    revokePreviewUrls(previewPool.value)
    previewPool.value = []
  }

  return {
    emojis,
    previewPool,
    isParsing,
    loadEmojis,
    deleteEmoji,
    updateEmoji,
    parseTextContent,
    parseLocalFiles,
    confirmImport,
    clearPreviewPool,
    groups,
    addGroup,
    updateGroup,
    deleteGroups,
    updateEmojisGroup,
    mergeGroups,
    transferEmojis
  }
}
