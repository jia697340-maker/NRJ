/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  visible: boolean
  moment: any
  formatTime: (time: number | string) => string
  currentActor: { id: string, name: string }
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'preview', url: string): void
  (e: 'submit-comment', momentId: string, content: string, target?: { id: string, author: string }): void
  (e: 'toggle-like', comment: any): void
}>()

const commentDraft = ref('')
const replyTarget = ref<{ id: string, author: string } | null>(null)

const prepareDetailComment = (target: any = null) => {
  replyTarget.value = target ? { id: target.id, author: target.author } : null
  commentDraft.value = ''
}

const handleSubmit = () => {
  if (!commentDraft.value.trim()) return
  emit('submit-comment', props.moment.id, commentDraft.value.trim(), replyTarget.value || undefined)
  commentDraft.value = ''
  replyTarget.value = null
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible && moment" class="moment-modal-overlay" @click.self="emit('update:visible', false)">
      <div class="moment-detail-modal">
        <header>
          <button @click="emit('update:visible', false)">‹</button>
          <strong>详情</strong>
          <span></span>
        </header>
        <section>
          <div class="detail-author">{{ moment.author }}</div>
          <p>{{ moment.content }}</p>
          <div class="detail-meta-row">
            <span>{{ formatTime(moment.time) }}</span>
            <span>{{ moment.visibility || '公开' }}</span>
            <span v-if="moment.updatedAt">已编辑</span>
          </div>
          <div v-if="moment.location" class="moment-meta">⌖ {{ moment.location }}</div>
          <div v-if="moment.mentions?.length" class="moment-meta">
            @{{ moment.mentions.map((person: any) => person.name).join(' @') }}
          </div>
          
          <div class="detail-grid" :class="`count-${Math.min(moment.images?.length || 0, 9)}`">
            <img v-for="(img, index) in moment.images || []" :key="index" :src="img" @click="emit('preview', img)" />
          </div>
          
          <div class="detail-like-list" v-if="moment.likes?.length">
            ♡ {{ moment.likes.join('、') }}
          </div>
          <div class="detail-like-list" v-if="moment.views?.length">
            浏览：{{ moment.views.map((person: any) => person.name).join('、') }}
          </div>
          
          <div class="detail-comment-list">
            <div v-for="comment in moment.comments || []" :key="comment.id" @click="prepareDetailComment(comment)">
              <b>{{ comment.author }}</b>
              <span v-if="comment.replyToAuthor"> 回复 <b>{{ comment.replyToAuthor }}</b></span>：
              {{ comment.content }}
              <button @click.stop="emit('toggle-like', comment)">
                ♡{{ comment.likes?.length || '' }}
              </button>
            </div>
          </div>
          
          <div class="detail-composer">
            <span v-if="replyTarget">回复 {{ replyTarget.author }}</span>
            <input 
              v-model="commentDraft" 
              :placeholder="replyTarget ? `回复 ${replyTarget.author}` : '写评论…'" 
              @keyup.enter="handleSubmit"
            />
            <button :disabled="!commentDraft.trim()" @click="handleSubmit">发送</button>
          </div>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@import '../../app_ChatDiscover.css';
</style>
