/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import type { ForumPost, ForumUser } from '../../../types/forum'
import ForumHeader from '../components/ForumHeader.vue'
import ForumAvatar from '../components/ForumAvatar.vue'
import ForumTopicChip from '../components/ForumTopicChip.vue'

const props = defineProps<{
  currentUser: ForumUser
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'publish', postData: Partial<ForumPost>): void
}>()

const postContent = ref('')
const selectedTopics = ref<string[]>([])
const newTopicInput = ref('')
const showTopicInput = ref(false)

const addTopic = (tag: string) => {
  if (tag && !selectedTopics.value.includes(tag)) {
    selectedTopics.value.push(tag)
  }
  newTopicInput.value = ''
  showTopicInput.value = false
}

const removeTopic = (tag: string) => {
  selectedTopics.value = selectedTopics.value.filter(t => t !== tag)
}

const handlePublish = () => {
  const content = postContent.value.trim()
  if (!content) return

  emit('publish', {
    content,
    topics: selectedTopics.value,
    type: 'text'
  })
}
</script>

<template>
  <div class="forum-publish-view">
    <ForumHeader title="发动态" show-back @back="emit('back')">
      <template #right>
        <button
          class="publish-action-btn"
          :disabled="!postContent.trim()"
          type="button"
          @click="handlePublish"
        >
          发布
        </button>
      </template>
    </ForumHeader>

    <div class="publish-body">
      <!-- 用户身份栏 -->
      <div class="publish-author-row">
        <ForumAvatar
          :src="currentUser.avatar"
          :name="currentUser.name"
          :verified="currentUser.verified"
          size="sm"
        />
        <span class="publish-author-name">{{ currentUser.name }}</span>
      </div>

      <!-- 动态正文输入区 -->
      <textarea
        v-model="postContent"
        placeholder="记录当下的灵感、日常或随想..."
        class="publish-textarea"
        rows="8"
      ></textarea>

      <!-- 已选话题 -->
      <div v-if="selectedTopics.length > 0" class="selected-topics-list">
        <span
          v-for="t in selectedTopics"
          :key="t"
          class="topic-tag-bubble"
        >
          # {{ t }}
          <button class="remove-topic-btn" type="button" @click="removeTopic(t)">×</button>
        </span>
      </div>

      <!-- 话题快速插入 -->
      <div class="publish-toolbar">
        <button
          class="tool-btn"
          type="button"
          @click="showTopicInput = !showTopicInput"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>
          <span>添加话题</span>
        </button>
      </div>

      <!-- 话题输入框浮层 -->
      <div v-if="showTopicInput" class="topic-input-box">
        <input
          v-model="newTopicInput"
          type="text"
          placeholder="输入话题名称..."
          class="topic-inline-input"
          @keyup.enter="addTopic(newTopicInput.trim())"
        />
        <button
          class="topic-add-btn"
          type="button"
          @click="addTopic(newTopicInput.trim())"
        >
          确定
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forum-publish-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--sys-bg-secondary, #ffffff);
}

.publish-action-btn {
  background: var(--text-primary, #111111);
  color: var(--sys-bg-secondary, #ffffff);
  border: 0;
  border-radius: 999px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.12s ease;
}

.publish-action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.publish-action-btn:not(:disabled):active {
  transform: scale(0.94);
}

.publish-body {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.publish-author-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.publish-author-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #333333);
}

.publish-textarea {
  width: 100%;
  border: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-primary, #222222);
  outline: none;
  resize: none;
  background: transparent;
  font-family: inherit;
}

.publish-textarea::placeholder {
  color: var(--text-tertiary, #aaaaaa);
}

.selected-topics-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0;
}

.topic-tag-bubble {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(43, 125, 233, 0.1);
  color: var(--accent-color, #2b7de9);
  font-size: 12px;
  font-weight: 500;
}

.remove-topic-btn {
  background: transparent;
  border: 0;
  font-size: 14px;
  color: inherit;
  cursor: pointer;
  padding: 0;
}

.publish-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.05));
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 0;
  color: var(--text-secondary, #666666);
  font-size: 13px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
}

.tool-btn:active {
  background: var(--sys-bg-tertiary, #f0f0f0);
}

.topic-input-box {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  padding: 8px;
  background: var(--sys-bg-tertiary, #f6f7f9);
  border-radius: 10px;
}

.topic-inline-input {
  flex: 1;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  outline: none;
}

.topic-add-btn {
  background: var(--text-primary, #111111);
  color: var(--sys-bg-secondary, #ffffff);
  border: 0;
  border-radius: 6px;
  padding: 0 14px;
  font-size: 12.5px;
  cursor: pointer;
}
</style>
