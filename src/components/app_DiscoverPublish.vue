/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatState } from '../composables/useChatState'
import { useChatAuth } from '../composables/useChatAuth'

const emit = defineEmits(['close', 'publish'])

const { mockChats } = useChatState()
const { currentChatUserId } = useChatAuth()
const groups = computed(() => {
  const key = currentChatUserId.value ? `clingy_chat_groups_${currentChatUserId.value}` : 'clingy_chat_groups'
  return (JSON.parse(localStorage.getItem(key) || '[]') as string[]).map(name => ({ id: name, name }))
})

const text = ref('')
const images = ref<{ id: string, dataUrl: string }[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

// 谁可以看选项
const visibilityOptions = ['公开', '私密', '部分可见', '不给谁看']
const currentVisibility = ref('公开')
const showVisibilityMenu = ref(false)

const showImageSourceMenu = ref(false)
const showTextToImageModal = ref(false)
const textToImageContent = ref('')
const location = ref('')
const locationDraft = ref('')
const showLocationModal = ref(false)
const showMentionModal = ref(false)
const mentionedIds = ref<Array<string | number>>([])
const mentionableChats = computed(() => mockChats.value.filter((chat: any) => chat.id !== 1 && !chat.isCreate))

const handleBack = () => {
  emit('close')
}

// 选中的可见分组 IDs
const selectedGroupIds = ref<string[]>([])

const handlePublish = () => {
  emit('publish', {
    text: text.value,
    images: images.value.map(img => ({
      url: img.dataUrl,
      isBase64: img.dataUrl.startsWith('data:image')
    })),
    visibility: currentVisibility.value,
    groupIds: ['部分可见', '不给谁看'].includes(currentVisibility.value) ? selectedGroupIds.value : [],
    location: location.value.trim(),
    mentions: mentionableChats.value.filter((chat: any) => mentionedIds.value.includes(chat.id)).map((chat: any) => ({ id: chat.id, name: chat.name }))
  })
}

const saveLocation = () => {
  location.value = locationDraft.value.trim()
  showLocationModal.value = false
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const selectLocalImage = () => {
  showImageSourceMenu.value = false
  triggerFileInput()
}

const openTextToImage = () => {
  showImageSourceMenu.value = false
  textToImageContent.value = ''
  showTextToImageModal.value = true
}

const generateTextToImage = () => {
  if (!textToImageContent.value.trim()) return
  
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // 设置 canvas 尺寸
  canvas.width = 600
  canvas.height = 600
  
  // 绘制背景（随机生成一个柔和颜色或纯色）
  const colors = ['#f4f1de', '#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#e9c46a']
  const bgColor = colors[Math.floor(Math.random() * colors.length)]
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // 自动根据背景色选择文字颜色
  const isDark = ['#3d405b', '#e07a5f'].includes(bgColor)
  ctx.fillStyle = isDark ? '#ffffff' : '#333333'
  ctx.font = 'bold 40px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  const text = textToImageContent.value.trim()
  const maxWidth = 500
  const words = text.split('')
  let line = ''
  const lines = []
  
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n]
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width
    if (testWidth > maxWidth && n > 0) {
      lines.push(line)
      line = words[n]
    } else {
      line = testLine
    }
  }
  lines.push(line)
  
  const lineHeight = 56
  const startY = (canvas.height - (lines.length * lineHeight)) / 2 + (lineHeight / 2)
  
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], canvas.width / 2, startY + (i * lineHeight))
  }
  
  const dataUrl = canvas.toDataURL('image/png')
  
  images.value.push({
    id: Date.now() + '_' + Math.random(),
    dataUrl: dataUrl
  })
  
  showTextToImageModal.value = false
}

const onFileChange = (e: Event) => {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (images.value.length >= 9) break
    const reader = new FileReader()
    reader.onload = (evt) => {
      images.value.push({
        id: Date.now() + '_' + Math.random(),
        dataUrl: evt.target?.result as string
      })
    }
    reader.readAsDataURL(file)
  }
  if (fileInput.value) fileInput.value.value = ''
}

const removeImage = (index: number) => {
  images.value.splice(index, 1)
}
</script>

<template>
  <div class="discover-publish-view">
    <div class="publish-header">
      <div class="header-btn" @click="handleBack">取消</div>
      <div 
        class="header-btn publish-btn" 
        :class="{ 'is-disabled': !text && images.length === 0 }" 
        @click="(text || images.length > 0) ? handlePublish() : null"
      >
        发表
      </div>
    </div>
    
    <div class="publish-body">
      <textarea 
        class="publish-textarea" 
        v-model="text" 
        placeholder="这一刻的想法..." 
        rows="4"
      ></textarea>
      
      <div class="image-grid">
        <div class="image-item" v-for="(img, idx) in images" :key="img.id">
          <img :src="img.dataUrl" />
          <div class="remove-btn" @click="removeImage(idx)">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="#fff" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
        </div>
        <div class="image-add-btn" v-if="images.length < 9" @click="showImageSourceMenu = true">
          <svg viewBox="0 0 24 24" width="32" height="32" stroke="#cdcdcd" stroke-width="1.2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
      </div>
      <input type="file" ref="fileInput" multiple accept="image/*" style="display: none;" @change="onFileChange" />
      
      <div class="options-list">
        <!-- 所在位置 -->
        <div class="option-item" @click="locationDraft = location; showLocationModal = true">
          <div class="option-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="#333" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
          <div class="option-content">
            <div class="option-title">所在位置</div>
            <div v-if="location" class="option-value">{{ location }}</div>
          </div>
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="#ccc" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>

        <!-- 提醒谁看 -->
        <div class="option-item" @click="showMentionModal = true">
          <div class="option-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="#333" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path></svg>
          </div>
          <div class="option-content">
            <div class="option-title">提醒谁看</div>
            <div v-if="mentionedIds.length" class="option-value">已选 {{ mentionedIds.length }} 人</div>
          </div>
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="#ccc" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>

        <!-- 谁可以看 -->
        <div class="option-item" @click="showVisibilityMenu = true">
          <div class="option-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="#333" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <div class="option-content">
            <div class="option-title">谁可以看</div>
            <div class="option-value">
              {{ currentVisibility }}
              <span v-if="['部分可见', '不给谁看'].includes(currentVisibility) && selectedGroupIds.length > 0" style="font-size:12px; margin-left:4px; color:#576b95">
                (已选{{selectedGroupIds.length}}个分组)
              </span>
            </div>
          </div>
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="#ccc" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>

      </div>
    </div>

    <!-- 选择图片来源 底部菜单 -->
    <div v-if="showImageSourceMenu" class="visibility-menu-overlay" @click="showImageSourceMenu = false">
      <div class="visibility-menu" @click.stop>
        <div class="menu-desc">选择添加方式</div>
        <div class="menu-list">
          <div class="menu-item" @click="selectLocalImage">
            <div class="menu-item-text">本地图片</div>
          </div>
          <div class="menu-item" @click="openTextToImage">
            <div class="menu-item-text">文字图</div>
          </div>
        </div>
        <div class="menu-gap"></div>
        <div class="menu-cancel" @click="showImageSourceMenu = false">取消</div>
      </div>
    </div>

    <div v-if="showLocationModal" class="text-to-image-overlay" @click.self="showLocationModal = false">
      <div class="text-to-image-modal">
        <div class="tti-header">所在位置</div>
        <div class="tti-body"><input v-model="locationDraft" class="tti-textarea" maxlength="50" placeholder="如：上海·外滩" /></div>
        <div class="tti-footer"><button class="tti-btn cancel" @click="showLocationModal = false">取消</button><button class="tti-btn confirm" @click="saveLocation">确定</button></div>
      </div>
    </div>

    <div v-if="showMentionModal" class="visibility-menu-overlay" @click.self="showMentionModal = false">
      <div class="visibility-menu">
        <div class="menu-desc">提醒谁看</div>
        <div class="menu-list">
          <label v-for="chat in mentionableChats" :key="chat.id" class="mention-item"><span>{{ chat.name }}</span><input v-model="mentionedIds" type="checkbox" :value="chat.id" /></label>
          <div v-if="!mentionableChats.length" class="menu-desc">暂无可提醒的角色</div>
        </div>
        <div class="menu-cancel" @click="showMentionModal = false">确定</div>
      </div>
    </div>

    <!-- 文字图输入弹窗 -->
    <div v-if="showTextToImageModal" class="text-to-image-overlay" @click="showTextToImageModal = false">
      <div class="text-to-image-modal" @click.stop>
        <div class="tti-header">输入文字生成图片</div>
        <div class="tti-body">
          <textarea v-model="textToImageContent" placeholder="输入你想生成图片的文字..." class="tti-textarea" rows="4"></textarea>
        </div>
        <div class="tti-footer">
          <button class="tti-btn cancel" @click="showTextToImageModal = false">取消</button>
          <button class="tti-btn confirm" :disabled="!textToImageContent.trim()" @click="generateTextToImage">确定</button>
        </div>
      </div>
    </div>

    <!-- 谁可以看 底部菜单 (Action Sheet) -->
    <div v-if="showVisibilityMenu" class="visibility-menu-overlay" @click="showVisibilityMenu = false">
      <div class="visibility-menu" @click.stop>
        <div class="menu-desc">选择谁可以看</div>
        <div class="menu-list">
          <div 
            class="menu-item" 
            v-for="opt in visibilityOptions" 
            :key="opt"
            @click="currentVisibility = opt; if(!['部分可见', '不给谁看'].includes(opt)) showVisibilityMenu = false"
          >
            <div style="display:flex; flex-direction:column; align-items:flex-start;">
              <div class="menu-item-text" :class="{ 'is-active': currentVisibility === opt }">{{ opt }}</div>
              
              <!-- 部分可见与不给谁看均按联系人分组多选 -->
              <div v-if="(opt === '部分可见' || opt === '不给谁看') && currentVisibility === opt" style="width:100%; margin-top:12px; display:flex; flex-direction:column; gap:8px;" @click.stop>
                <div v-if="groups.length === 0" style="font-size:13px; color:#999;">暂无分组数据，请先去联系人列表创建分组</div>
                <div v-for="g in groups" :key="g.id" style="display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-top:1px solid #f2f2f2; width:100%;">
                  <span style="font-size:14px; color:#333;">{{ g.name }}</span>
                  <label class="checkbox-label">
                    <input type="checkbox" :value="g.id" v-model="selectedGroupIds" style="width:18px;height:18px;" />
                  </label>
                </div>
                <div style="text-align:right; margin-top:8px;">
                  <button @click="showVisibilityMenu = false" style="background:#07c160; color:#fff; border:none; border-radius:4px; padding:6px 12px; font-size:14px;">确定</button>
                </div>
              </div>

            </div>
            <svg v-if="currentVisibility === opt && !['部分可见', '不给谁看'].includes(opt)" viewBox="0 0 24 24" width="20" height="20" stroke="#07C160" stroke-width="2" fill="none" style="position:absolute; right:20px; top:18px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>
        <div class="menu-gap"></div>
        <div class="menu-cancel" @click="showVisibilityMenu = false">取消</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.discover-publish-view {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #ffffff; /* 纯白背景 */
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.publish-header {
  height: 56px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: transparent;
  flex-shrink: 0;
}

.header-btn {
  font-size: 16px;
  color: #333;
  cursor: pointer;
  padding: 8px 0;
}

.publish-btn {
  background-color: #07C160;
  color: #fff;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}
.publish-btn.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.publish-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 30px 24px;
}

.publish-textarea {
  width: 100%;
  border: none;
  outline: none;
  font-size: 17px;
  line-height: 1.5;
  resize: none;
  background: transparent;
  color: #333;
  font-family: inherit;
  padding: 0;
}
.publish-textarea::placeholder {
  color: #b2b2b2;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 12px;
  margin-bottom: 40px;
}

.image-item {
  aspect-ratio: 1;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  background: #f7f7f7;
}
.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  background: rgba(0,0,0,0.4);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.image-add-btn {
  aspect-ratio: 1;
  background-color: #f7f7f7;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
}

.options-list {
  display: flex;
  flex-direction: column;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 16px 0;
  cursor: pointer;
}

.option-icon {
  margin-right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.option-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 8px;
  border-bottom: 0.5px solid #ebebeb;
  padding-bottom: 16px;
  margin-bottom: -16px;
}

.option-item:last-child .option-content {
  border-bottom: none;
}

.option-title {
  font-size: 16px;
  color: #333;
}
.option-title.border-none {
  border-bottom: none;
}

.option-value {
  font-size: 15px;
  color: #999;
}

.visibility-menu-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  z-index: 1001;
  display: flex;
  align-items: flex-end;
  animation: fadeIn 0.2s;
}

.visibility-menu {
  width: 100%;
  background: #f7f7f7;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  overflow: hidden;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.menu-desc {
  text-align: center;
  font-size: 13px;
  color: #999;
  padding: 16px;
  background: #fff;
  border-bottom: 0.5px solid #ebebeb;
}

.menu-list {
  background: #fff;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 16px 20px;
  border-bottom: 0.5px solid #ebebeb;
  cursor: pointer;
}
.menu-item:last-child {
  border-bottom: none;
}
.menu-item:active {
  background-color: #f2f2f2;
}

.menu-item-text {
  font-size: 16px;
  color: #333;
}
.menu-item-text.is-active {
  font-weight: 500;
}

.menu-item svg {
  position: absolute;
  right: 24px;
}

.menu-gap {
  height: 8px;
  background: #f7f7f7;
}

.menu-cancel {
  text-align: center;
  padding: 16px;
  font-size: 16px;
  color: #333;
  cursor: pointer;
  background: #fff;
}
.menu-cancel:active {
  background: #f2f2f2;
}
.mention-item { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:.5px solid #ebebeb; color:#333; font-size:16px; }
.mention-item input { width:18px; height:18px; accent-color:#07c160; }

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.text-to-image-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  z-index: 1002;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s;
}

.text-to-image-modal {
  width: 280px;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: folderPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1);
}

.tti-header {
  padding: 16px;
  text-align: center;
  font-size: 16px;
  font-weight: 500;
  color: #333;
  border-bottom: 0.5px solid #ebebeb;
}

.tti-body {
  padding: 16px;
}

.tti-textarea {
  width: 100%;
  border: 1px solid #ebebeb;
  border-radius: 8px;
  padding: 8px;
  font-size: 14px;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.tti-textarea:focus {
  border-color: #07C160;
}

.tti-footer {
  display: flex;
  border-top: 0.5px solid #ebebeb;
}

.tti-btn {
  flex: 1;
  padding: 14px;
  border: none;
  background: transparent;
  font-size: 16px;
  cursor: pointer;
}

.tti-btn.cancel {
  color: #999;
  border-right: 0.5px solid #ebebeb;
}

.tti-btn.confirm {
  color: #07C160;
  font-weight: 500;
}

.tti-btn.confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes folderPopIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
</style>
