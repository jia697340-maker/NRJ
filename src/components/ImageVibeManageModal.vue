/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useNovelAIVibe, type VibeGroup, type VibeImage } from '../composables/useNovelAIVibe'
import { parseNovelAIVibeFile } from '../services/novelAIVibeFile'

const emit = defineEmits(['close'])

const {
  vibeImages,
  vibeGroups,
  addImage,
  addImportedGroup,
  removeImage,
  addGroup,
  removeGroup,
  updateGroup,
  removeImages,
  removeGroups
} = useNovelAIVibe()

const activeTab = ref<'groups' | 'library'>('groups')

// --- Multi-Select State ---
const isSelectionMode = ref(false)
const selectedImageIds = ref<string[]>([])
const selectedGroupIds = ref<string[]>([])

const toggleSelectionMode = () => {
  isSelectionMode.value = !isSelectionMode.value
  selectedImageIds.value = []
  selectedGroupIds.value = []
}

// --- Library ---
const fileInput = ref<HTMLInputElement | null>(null)

const toggleImageSelection = (id: string) => {
  const idx = selectedImageIds.value.indexOf(id)
  if (idx > -1) selectedImageIds.value.splice(idx, 1)
  else selectedImageIds.value.push(id)
}

const toggleAllImages = () => {
  if (selectedImageIds.value.length === vibeImages.value.length) {
    selectedImageIds.value = []
  } else {
    selectedImageIds.value = vibeImages.value.map(img => img.id)
  }
}

const showConfirmModal = ref(false)
const confirmModalMessage = ref('')
const confirmModalAction = ref<(() => void) | null>(null)

const handleConfirm = (message: string, action: () => void) => {
  confirmModalMessage.value = message
  confirmModalAction.value = action
  showConfirmModal.value = true
}

const executeConfirm = () => {
  if (confirmModalAction.value) {
    confirmModalAction.value()
  }
  showConfirmModal.value = false
}

const cancelConfirm = () => {
  showConfirmModal.value = false
}

const handleDeleteSelectedImages = async () => {
  if (selectedImageIds.value.length === 0) return
  handleConfirm(`确定要删除选中的 ${selectedImageIds.value.length} 张图片吗？这将同时从所有使用它的氛围组中移除。`, async () => {
    await removeImages(selectedImageIds.value)
    selectedImageIds.value = []
    isSelectionMode.value = false
  })
}

const triggerUpload = () => {
  fileInput.value?.click()
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  
  const file = target.files[0]
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const img = new Image()
    img.onload = async () => {
      let width = img.width
      let height = img.height
      const maxArea = 1024 * 1024
      
      // 等比缩放，限制最大面积为 1024x1024 以免触发 NovelAI 的付费点数扣除
      if (width * height > maxArea) {
        const ratio = Math.sqrt(maxArea / (width * height))
        width = Math.floor(width * ratio)
        height = Math.floor(height * ratio)
      }
      
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        // 填充白色背景，防止透明 PNG 转 JPEG 时出现黑底
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        
        // 转为 JPEG 格式并压缩
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.9)
        await addImage(compressedBase64)
      }
    }
    if (e.target?.result) {
      img.src = e.target.result as string
    }
  }
  reader.readAsDataURL(file)
  target.value = ''
}

const handleDeleteImage = async (id: string) => {
  handleConfirm('确定要从图库中删除此图片吗？这将同时从所有使用它的氛围组中移除。', async () => {
    await removeImage(id)
  })
}

// --- Groups ---
const selectedGroupId = ref<string | null>(null)
const selectedGroup = computed(() => vibeGroups.value.find(g => g.id === selectedGroupId.value) || null)

const groupFileInput = ref<HTMLInputElement | null>(null)

const handleImportClick = () => {
  groupFileInput.value?.click()
}

const handleFileImport = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  
  const file = target.files[0]

  try {
    const parsed = await parseNovelAIVibeFile(file)
    const group = await addImportedGroup(
      parsed.groupName,
      parsed.items.map(item => ({
        image: {
          base64: item.base64,
          mimeType: item.mimeType,
          previewBase64: item.previewBase64,
          previewMimeType: item.previewMimeType,
          name: item.name,
          externalId: item.externalId,
          sourceFilename: item.sourceFilename,
          encodings: item.encodings
        },
        strength: item.strength,
        extracted: item.informationExtracted
      }))
    )
    selectedGroupId.value = group.id
    handleConfirm(`已导入氛围组“${group.name}”，共 ${group.items.length} 个氛围。`, () => {})
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    handleConfirm(`导入失败：${message}`, () => {})
  } finally {
    target.value = ''
  }
}

const showCreateGroup = ref(false)
const newGroupName = ref('')

const openGroup = (id: string) => {
  selectedGroupId.value = id
}

const handleCreateGroup = async () => {
  if (!newGroupName.value.trim()) return
  const g = await addGroup(newGroupName.value.trim())
  selectedGroupId.value = g.id
  newGroupName.value = ''
  showCreateGroup.value = false
}

const toggleGroupSelection = (id: string) => {
  const idx = selectedGroupIds.value.indexOf(id)
  if (idx > -1) selectedGroupIds.value.splice(idx, 1)
  else selectedGroupIds.value.push(id)
}

const toggleAllGroups = () => {
  if (selectedGroupIds.value.length === vibeGroups.value.length) {
    selectedGroupIds.value = []
  } else {
    selectedGroupIds.value = vibeGroups.value.map(g => g.id)
  }
}

const handleDeleteSelectedGroups = async () => {
  if (selectedGroupIds.value.length === 0) return
  handleConfirm(`确定要删除选中的 ${selectedGroupIds.value.length} 个氛围组吗？(图库中的图片不会被删除)`, async () => {
    await removeGroups(selectedGroupIds.value)
    selectedGroupIds.value = []
    isSelectionMode.value = false
  })
}

const handleDeleteGroup = async (id: string) => {
  handleConfirm('确定要删除此氛围组吗？(图库中的图片不会被删除)', async () => {
    await removeGroup(id)
    if (selectedGroupId.value === id) {
      selectedGroupId.value = null
    }
  })
}

// Group Edit
const showAddImageToGroup = ref(false)

const handleAddImageToGroup = async (img: VibeImage) => {
  if (!selectedGroup.value) return
  
  // check if already exists
  if (selectedGroup.value.items.some(i => i.imageId === img.id)) {
    return
  }

  const updatedGroup = JSON.parse(JSON.stringify(selectedGroup.value)) as VibeGroup
  updatedGroup.items.push({
    imageId: img.id,
    strength: 0.6,
    extracted: 1.0
  })
  
  await updateGroup(updatedGroup)
  showAddImageToGroup.value = false
}

const handleRemoveFromGroup = async (imageId: string) => {
  if (!selectedGroup.value) return
  const updatedGroup = JSON.parse(JSON.stringify(selectedGroup.value)) as VibeGroup
  updatedGroup.items = updatedGroup.items.filter(i => i.imageId !== imageId)
  await updateGroup(updatedGroup)
}

const handleUpdateItemParams = async (imageId: string, field: 'strength' | 'extracted', value: number) => {
  if (!selectedGroup.value) return
  const updatedGroup = JSON.parse(JSON.stringify(selectedGroup.value)) as VibeGroup
  const item = updatedGroup.items.find(i => i.imageId === imageId)
  if (item) {
    item[field] = value
    await updateGroup(updatedGroup)
  }
}

const EMPTY_PREVIEW = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

const getVibeImageSrc = (img: VibeImage | undefined) => {
  if (!img) return EMPTY_PREVIEW
  if (img.previewBase64) {
    return `data:${img.previewMimeType || 'image/png'};base64,${img.previewBase64}`
  }
  if (img.base64) {
    return `data:${img.mimeType || 'image/jpeg'};base64,${img.base64}`
  }
  return EMPTY_PREVIEW
}

const getImageSrc = (id: string) => {
  return getVibeImageSrc(vibeImages.value.find(i => i.id === id))
}
</script>

<template>
  <div class="vibe-modal-overlay">
    <div class="vibe-modal-box">
      <!-- Group List & Library View -->
      <template v-if="!selectedGroupId">
        <div class="vm-header">
          <div style="width: 60px;">
            <button class="nav-btn" @click="$emit('close')">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
          </div>
          <h3>氛围转移图库</h3>
          <div style="width: 60px; display: flex; justify-content: flex-end;">
            <button class="nav-btn" :class="{ 'is-active-btn': isSelectionMode }" @click="toggleSelectionMode">
              <template v-if="isSelectionMode">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </template>
              <template v-else>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 11 12 14 22 4"></polyline>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
              </template>
            </button>
          </div>
        </div>
        
        <div class="vm-tabs">
          <button class="vm-tab" :class="{ active: activeTab === 'groups' }" @click="activeTab = 'groups'">预设组</button>
          <button class="vm-tab" :class="{ active: activeTab === 'library' }" @click="activeTab = 'library'">图库 ({{ vibeImages.length }})</button>
        </div>

        <div class="vm-body" :style="{ paddingBottom: isSelectionMode ? '80px' : '0' }">
          <div v-if="activeTab === 'groups'" class="list-layout">
            <div class="nav-list">
              <div v-for="g in vibeGroups" :key="g.id" class="nav-item" @click="isSelectionMode ? toggleGroupSelection(g.id) : openGroup(g.id)">
                <div class="nav-item-left" style="display: flex; align-items: center; gap: 12px;">
                  <input v-if="isSelectionMode" type="checkbox" class="styled-checkbox" :checked="selectedGroupIds.includes(g.id)" />
                  {{ g.name }}
                </div>
                <div class="nav-item-right" v-if="!isSelectionMode">
                  <span class="nav-value">{{ g.items.length }}图</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
              </div>
              <div v-if="!isSelectionMode" class="nav-item" @click="showCreateGroup = true">
                <div class="nav-item-left" style="color: #111;">+ 新建分组</div>
              </div>
              <div v-if="!isSelectionMode" class="nav-item" @click="handleImportClick">
                <div class="nav-item-left" style="color: #111;">+ 导入预设文件</div>
              </div>
              <input type="file" ref="groupFileInput" accept=".naiv4vibe,.naiv4vibebundle" style="display:none" @change="handleFileImport" />
            </div>

            <div v-if="showCreateGroup" class="create-group-prompt">
              <input type="text" v-model="newGroupName" placeholder="输入新分组名称" class="flat-input" @keyup.enter="handleCreateGroup" />
              <div class="cg-actions">
                <button class="flat-btn" @click="showCreateGroup = false">取消</button>
                <button class="flat-btn primary-bg" @click="handleCreateGroup">保存</button>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'library'" class="library-layout">
            <button v-if="!isSelectionMode" class="flat-btn primary-bg" @click="triggerUpload" style="margin-bottom: 24px; width: 100%;">
              + 上传本地图片
            </button>
            <input type="file" ref="fileInput" accept="image/*" style="display:none" @change="handleFileUpload" />
            
            <div class="lib-grid">
              <div v-for="img in vibeImages" :key="img.id" class="lib-img-wrapper" @click="isSelectionMode ? toggleImageSelection(img.id) : null" :class="{ 'selectable-mode': isSelectionMode }">
                <img :src="getVibeImageSrc(img)" />
                <div v-if="isSelectionMode" class="selection-circle" :class="{ 'is-selected': selectedImageIds.includes(img.id) }">
                  <svg v-if="selectedImageIds.includes(img.id)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <button v-else class="del-img-btn" @click.stop="handleDeleteImage(img.id)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
            <div v-if="vibeImages.length === 0" class="empty-hint">图库为空，请上传图片</div>
          </div>
        </div>

        <!-- Selection Bottom Bar -->
        <transition name="slide-up">
          <div v-if="isSelectionMode" class="selection-bottom-bar">
            <button class="sbb-icon-btn" @click="activeTab === 'groups' ? toggleAllGroups() : toggleAllImages()">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 11l3 3L22 4"></path>
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
              </svg>
              <span>{{ (activeTab === 'groups' && selectedGroupIds.length > 0 && selectedGroupIds.length === vibeGroups.length) || (activeTab === 'library' && selectedImageIds.length > 0 && selectedImageIds.length === vibeImages.length) ? '取消全选' : '全选' }}</span>
            </button>
            
            <div class="sbb-center">
              已选择 {{ activeTab === 'groups' ? selectedGroupIds.length : selectedImageIds.length }} 项
            </div>

            <button class="sbb-icon-btn danger" :disabled="activeTab === 'groups' ? selectedGroupIds.length === 0 : selectedImageIds.length === 0" @click="activeTab === 'groups' ? handleDeleteSelectedGroups() : handleDeleteSelectedImages()">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              <span>删除</span>
            </button>
          </div>
        </transition>
      </template>

      <!-- Group Detail View -->
      <template v-else>
        <div class="vm-header">
          <div style="width: 60px;">
            <button class="nav-btn" @click="selectedGroupId = null">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
          </div>
          <h3>{{ selectedGroup?.name }}</h3>
          <div style="width: 60px; display: flex; justify-content: flex-end;">
            <button class="nav-btn text-danger" @click="handleDeleteGroup(selectedGroup!.id)">删除</button>
          </div>
        </div>

        <div class="vm-body detail-layout">
          <button class="flat-btn" @click="showAddImageToGroup = true" style="margin-bottom: 24px; width: 100%;">+ 从图库添加图片</button>

          <div class="group-items-list">
            <div v-for="item in selectedGroup?.items" :key="item.imageId" class="group-item-card">
              <img :src="getImageSrc(item.imageId)" class="v-img" />
              <div class="v-controls">
                <div class="v-slider-row">
                  <label>参考强度 (Strength) <span>{{ item.strength }}</span></label>
                  <input type="range" min="0" max="1" step="0.05" :value="item.strength" @change="e => handleUpdateItemParams(item.imageId, 'strength', Number((e.target as HTMLInputElement).value))" class="flat-range" />
                </div>
                <div class="v-slider-row">
                  <label>信息提取度 (Extracted) <span>{{ item.extracted }}</span></label>
                  <input type="range" min="0" max="1" step="0.05" :value="item.extracted" @change="e => handleUpdateItemParams(item.imageId, 'extracted', Number((e.target as HTMLInputElement).value))" class="flat-range" />
                </div>
              </div>
              <button class="remove-item-btn" @click="handleRemoveFromGroup(item.imageId)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
          <div v-if="selectedGroup?.items.length === 0" class="empty-hint">该分组暂无图片</div>
        </div>
      </template>
    </div>

    <!-- Add Image to Group Modal -->
    <div v-if="showAddImageToGroup" class="picker-overlay">
      <div class="picker-box">
        <div class="vm-header">
          <div style="width: 60px">
            <button class="nav-btn" @click="showAddImageToGroup = false">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
          </div>
          <h3>选择图片</h3>
          <div style="width: 60px; display: flex; justify-content: flex-end;"></div>
        </div>
        <div class="pb-grid">
          <div class="lib-grid">
            <div v-for="img in vibeImages" :key="img.id" class="lib-img-wrapper selectable" @click="handleAddImageToGroup(img)">
              <img :src="getVibeImageSrc(img)" />
              <div v-if="selectedGroup?.items.some(i => i.imageId === img.id)" class="selected-mask">已添加</div>
            </div>
          </div>
          <div v-if="vibeImages.length === 0" class="empty-hint">图库为空，请先上传图片</div>
        </div>
      </div>
    </div>
    <!-- 通用确认弹窗 -->
    <Transition name="fade">
      <div class="simple-modal-overlay" v-if="showConfirmModal">
        <div class="simple-modal">
          <div class="simple-modal-title">提示</div>
          <div class="simple-modal-body" style="text-align: center; color: #666; font-size: 14px;">
            {{ confirmModalMessage }}
          </div>
          <div class="simple-modal-footer">
            <button class="simple-modal-btn cancel" @click="cancelConfirm">取消</button>
            <button class="simple-modal-btn confirm" style="color: #ff3b30;" @click="executeConfirm">确定</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.vibe-modal-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: #ffffff; z-index: 200; display: flex; flex-direction: column;
}
.vibe-modal-box {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  background: #ffffff;
}
.vm-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: calc(env(safe-area-inset-top) + 12px) 16px 12px;
  background: #ffffff;
  border-bottom: 1px solid #eaeaea;
  z-index: 10;
}
.vm-header h3 { margin: 0; font-size: 16px; font-weight: 600; color: #111; }
.nav-btn {
  background: none; border: none; padding: 4px 0; color: #111;
  font-size: 15px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.is-active-btn { color: #007aff; }
.text-danger { color: #ff3b30; }
.text-danger:disabled { color: #ffb4b0; cursor: not-allowed; }

.vm-tabs {
  display: flex; background: #fff; border-bottom: 1px solid #eaeaea;
}
.vm-tab {
  flex: 1; background: none; border: none; padding: 14px 0; font-size: 15px; font-weight: 500;
  color: #888; cursor: pointer; border-bottom: 2px solid transparent;
}
.vm-tab.active { color: #111; border-bottom-color: #111; }

.vm-body {
  flex: 1; overflow-y: auto;
}

.list-layout, .library-layout, .detail-layout {
  padding: 20px;
}

.nav-list { display: flex; flex-direction: column; }
.nav-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 0; border-bottom: 1px solid #eaeaea; cursor: pointer;
}
.nav-item-left { font-size: 15px; color: #111; }
.nav-item-right { display: flex; align-items: center; gap: 8px; }
.nav-value { font-size: 14px; color: #888; }

.create-group-prompt {
  margin-top: 16px; padding: 16px; background: #ffffff; border: 1px solid #eaeaea; border-radius: 12px;
}
.flat-input {
  width: 100%; padding: 12px 14px; background: #f7f8fa; border: 1px solid #eaeaea; border-radius: 8px; font-size: 15px; color: #111; box-sizing: border-box; margin-bottom: 12px;
}
.flat-input:focus { outline: none; border-color: #ccc; background: #fff; }
.cg-actions { display: flex; gap: 12px; }

.flat-btn {
  flex: 1; background: #fff; border: 1px solid #eaeaea; padding: 12px; border-radius: 8px; font-size: 15px; color: #111; cursor: pointer; text-align: center;
}
.flat-btn:hover { background: #fafafa; }
.primary-bg { background: #111; color: #fff; border-color: #111; }
.primary-bg:hover { background: #000; }

.lib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; }
.lib-img-wrapper { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: #eee; }
.lib-img-wrapper.selectable-mode { cursor: pointer; }
.lib-img-wrapper img { width: 100%; height: 100%; object-fit: cover; }
.del-img-btn {
  position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: #fff; border: none; width: 24px; height: 24px; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 12px;
}

.selection-circle {
  position: absolute; bottom: 8px; right: 8px; width: 24px; height: 24px;
  border-radius: 12px; border: 2px solid #fff; background: rgba(0,0,0,0.3);
  display: flex; align-items: center; justify-content: center; box-sizing: border-box; transition: all 0.2s;
}
.selection-circle.is-selected {
  background: #007aff; border-color: #007aff;
}

.selection-bottom-bar {
  position: absolute; bottom: 0; left: 0; width: 100%; height: 84px;
  background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: flex-start;
  padding: 12px 24px 0; box-sizing: border-box; z-index: 50;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.03);
}
.sbb-icon-btn {
  background: none; border: none; display: flex; flex-direction: column; align-items: center; gap: 4px;
  color: #111; cursor: pointer; padding: 0 8px;
}
.sbb-icon-btn span { font-size: 11px; font-weight: 500; }
.sbb-icon-btn.danger { color: #ff3b30; }
.sbb-icon-btn.danger:disabled { color: #ffb4b0; cursor: not-allowed; }
.sbb-center {
  flex: 1; text-align: center; font-size: 14px; font-weight: 600; color: #111; margin-top: 6px;
}

.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }

.styled-checkbox { width: 20px; height: 20px; accent-color: #007aff; margin: 0; }

.empty-hint { color: #888; font-size: 14px; padding: 40px 0; text-align: center; }

/* Detail Layout */
.group-items-list { display: flex; flex-direction: column; gap: 24px; }
.group-item-card {
  display: flex; flex-direction: column; gap: 12px; position: relative;
  padding-bottom: 24px; border-bottom: 1px solid #eaeaea;
}
.group-item-card:last-child { border-bottom: none; }
.v-img { width: 100%; max-height: 300px; object-fit: cover; border-radius: 12px; background: #eee; }
.v-controls { display: flex; flex-direction: column; gap: 16px; }
.v-slider-row { display: flex; flex-direction: column; gap: 8px; }
.v-slider-row label { font-size: 13px; color: #555; display: flex; justify-content: space-between; }
.v-slider-row label span { font-weight: 500; color: #111; }
.flat-range {
  -webkit-appearance: none; width: 100%; height: 4px; background: #eaeaea; border-radius: 2px; outline: none;
}
.flat-range::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #111; cursor: pointer;
}
.remove-item-btn {
  position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: #fff; border: none; width: 28px; height: 28px; border-radius: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px;
}

/* Picker Overlay */
.picker-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #ffffff; z-index: 300; display: flex; flex-direction: column;
}
.picker-box {
  width: 100%; height: 100%; display: flex; flex-direction: column;
}
.pb-grid { padding: 20px; overflow-y: auto; flex: 1; }
.selectable { cursor: pointer; }
.selected-mask { position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(255,255,255,0.7); color:#111; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; }

/* --- 轻量级弹窗样式 --- */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.simple-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.simple-modal {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(25px) saturate(200%);
  -webkit-backdrop-filter: blur(25px) saturate(200%);
  width: 270px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  transform: translateY(-10%);
}

.simple-modal-title {
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  padding: 20px 16px 8px;
  color: #111;
}

.simple-modal-body {
  padding: 0 16px 20px;
}

.simple-modal-footer {
  display: flex;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.simple-modal-btn {
  flex: 1;
  background: transparent;
  border: none;
  padding: 12px 0;
  font-size: 16px;
  cursor: pointer;
  color: #007aff;
}

.simple-modal-btn.cancel {
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  font-weight: 400;
}

.simple-modal-btn.confirm {
  font-weight: 600;
}

.simple-modal-btn:active {
  background: rgba(0, 0, 0, 0.05);
}
</style>
