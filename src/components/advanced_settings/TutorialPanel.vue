/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

type SectionTab = 'declarations' | 'tutorials'

const currentSection = ref<SectionTab>('declarations')
const activeDocId = ref<string | null>(null)
const copyToast = ref(false)

const scrollToTop = () => {
  nextTick(() => {
    const parentWrapper = document.querySelector('.gu-content-wrapper')
    if (parentWrapper) {
      parentWrapper.scrollTop = 0
    }
  })
}

watch(currentSection, () => {
  scrollToTop()
})

watch(activeDocId, () => {
  scrollToTop()
})

interface TutorialDoc {
  id: string
  title: string
  tag: string
  desc: string
  fileName: string
  content: string
}

// 教程文档数据
const tutorialDocs: TutorialDoc[] = [
  {
    id: 'quickstart',
    title: '快速上手与全功能使用指南',
    tag: '基础篇',
    desc: 'API 节点配置、人设工坊、多模态互动与常见问题排查。',
    fileName: '使用教程.md',
    content: `# 粘人精 快速上手与全功能使用指南

欢迎使用粘人精！本应用是一款基于大语言模型的沉浸式伴侣对话与互动应用，采用「本地优先（Local-First）」架构，所有数据均存储在您的设备本地。

---

## 一、快速起步：配置 API 节点

1. **进入设置**：在主界面点击桌面上的「设置」或侧边栏底部的「API 设置」。
2. **选择服务商**：支持 OpenAI、Claude、DeepSeek、Google Gemini、硅基流动（SiliconFlow）、NewAPI / OneAPI 自建节点等多种服务商。
3. **填写基础信息**：
   - **接口地址 (Base URL)**：如 \`https://api.openai.com/v1\` 或您的代理中转地址。
   - **API Key**：填写您从服务商获取的有效密钥。
   - **模型名称 (Model)**：选择或手动输入模型，如 \`gpt-4o\`、\`claude-3-5-sonnet\`、\`deepseek-chat\` 等。
4. **测试连接**：点击「测试连接」按钮，验证配置是否生效。

---

## 二、聊天互动与多模态交互

- **单聊与群聊**：支持创建一对一专属对话，或创建包含多名角色的多人互动群聊。
- **语音通话与 TTS**：支持接入阿里云语音合成（Aliyun TTS）与 ElevenLabs，实现角色拟真发音与语音通话。
- **图像视觉识别**：可向角色发送图片，模型将基于视觉能力理解画面并做出拟真情感反应。
- **生图绘画互动**：支持 NovelAI / Flux 等图像生成能力，角色可在对话中发送自拍、插画与场景图。
- **转账与互动小组件**：支持零钱钱包、转账互动、动态朋友圈点赞与互动等丰富玩法。

---

## 三、人设工坊与世界书设定

- **角色工坊**：支持深度定制角色性格、语言风格、关系阶段、专属称谓与心理动向。
- **世界书系统**：支持配置全局或角色专属的背景设定条目，基于关键词精准激活，赋予角色长久的世界观认知。
- **思维链（CoT）**：在高级设置中可开启思维链，观察模型在回复前的“内心独白”与情感推演过程。

---

## 四、外观主题与个性化定制

- **主题切换**：支持多种预设主题（白纸墨香、极简暗黑、浅粉柔光等），完美契合不同审美。
- **自定义壁纸与字体**：支持上传本地图片作为背景壁纸，自定义全局字体。
- **桌面与图标**：支持自定义应用图标、小组件样式与角标。

---

## 五、长期记忆与自动总结

- 进入联系人聊天设置中的「总结」选项。
- 推荐选择「综合记忆」方式，系统将在对话累积到一定篇幅后自动提炼事件、关系、偏好与情感点滴。
- 详见文档：《长期记忆与自动总结使用教程》。

---

## 六、数据备份与多设备同步

- 本地数据优先存储于浏览器的 IndexedDB 中。
- 支持通过「GitHub 私有仓库备份」、「WebDAV 网盘同步」或「本地加密备份包（.nrtbackup）」跨设备迁移。
- 详见文档：《云端备份与多设备恢复教程》。

---

## 七、常见问题排查

1. **聊天提示“请求失败”**：请检查 API 节点配置是否正确，网络是否通畅，以及模型余额是否充足。
2. **图片无法显示**：所有上传的图片均以安全格式存入本地 IndexedDB，若清理了浏览器缓存可能导致图片丢失，请定期做好云端/本地备份。
3. **遇到显示异常或更新**：可在高级设置中点击「更新日志和更新」检查最新版本，或通过高级设置中的「控制台/诊断中心」排查问题。`
  },
  {
    id: 'memory',
    title: '长期记忆与自动总结使用教程',
    tag: '进阶篇',
    desc: '综合记忆、人物资料、关系图谱及向量节点高级配置说明。',
    fileName: '长期记忆与自动总结使用教程.md',
    content: `# 长期记忆与自动总结使用教程

本文面向第一次使用长期记忆功能的用户。你不需要了解 Token、向量或提示词，只要选择“想怎样整理”和“是否自动整理”即可。

先记住两件事：
1. 所有总结方式都不要求配置向量模型。
2. 不理解的高级设置保持默认值，不会影响正常使用。

---

## 一、最快开始方式

1. 打开某个联系人的聊天设置。
2. 进入“总结”。
3. 将“总结方式”设置为“综合记忆（推荐）”。
4. 开启“自动整理记忆”。
5. 保持默认的“系统自动判断”即可。

---

## 二、怎样选择总结方式

- **综合记忆（推荐）**：同时生成文字总结、角色感受、事件、人物资料、表格和关系记录。
- **经典文字总结**：把一段聊天整理成连贯的客观文字，最接近旧版总结。
- **角色主观记忆**：用角色第一人称保存感受、想法以及角色对关系的理解。
- **重要事件记忆**：重点记录事件中的人物、时间、地点、结果、决定和未完成事项。
- **人物资料与状态**：重点维护称呼、喜好、禁忌、习惯、边界、关系与当前状态。
- **分类表格记忆**：把人物、地点、礼物、承诺、冲突等内容保存成可修改的分类记录。

---

## 三、向量模型（Embedding）说明

向量模型不负责生成总结，也不是必需条件。它只负责在保存了很多记忆后，帮助系统通过语义找到“意思相近”的旧记忆。
未配置向量节点时，系统自动使用关键词、人物、标签、时间与重要度混合召回。`
  },
  {
    id: 'backup',
    title: '云端备份与多设备恢复教程',
    tag: '数据篇',
    desc: 'GitHub 私有仓库、WebDAV 网盘及本地加密备份包迁移指南。',
    fileName: '云端备份与多设备恢复教程.md',
    content: `# 云端备份与多设备恢复教程

本教程对应“高级设置 → 存储”中的 GitHub、邮箱和 WebDAV 功能。云端文件均应使用独立密码加密；云端账号密码、访问令牌和自动化设置不会写入备份文件。

---

## 一、GitHub 私有仓库备份

1. 在 GitHub 新建一个 Private 仓库，建议只用于粘人精备份。
2. 在 Settings → Developer settings → Personal access tokens → Fine-grained tokens 创建令牌。
3. Repository access 只选择刚创建的仓库；Repository permissions 将 Contents 设为 Read and write。
4. 应用内仓库填写 \`用户名/仓库名\`，分支通常填写 \`main\`，然后点击“测试仓库权限”。
5. 设置备份密码后上传。大文件会自动按 8 MB 分卷加密存储。

---

## 二、WebDAV 网盘同步

1. 在网盘安全设置中开启 WebDAV，并创建应用专用密码。
2. 建议为粘人精创建独立目录，例如 \`/clingy-backups/\`。
3. 在应用中填写目录 URL、账号、应用密码和自动备份加密密码。
4. 点击“连接并保存”，配置保留版本与自动备份周期。

---

## 三、合并还是覆盖

- **合并**：保留本机已有内容；同 ID 数据以备份中的版本为准。适合日常换设备。
- **覆盖**：用备份替换应用数据，但保留当前设备上的凭据。只适合新设备或明确需要回退时使用。`
  },
  {
    id: 'privacy',
    title: '音乐与隐私说明',
    tag: '隐私篇',
    desc: '公共音乐查询、扫码登录授权与本地数据凭证隔离说明。',
    fileName: '音乐与隐私说明.md',
    content: `# 音乐与隐私说明

## 一、基本功能
本地音乐和播放器基本功能不要求登录第三方音乐账号。扫码登录和匿名公共音乐查询均为可选功能；拒绝其中一项，不影响其他无需该项信息的功能。

## 二、匿名公共音乐查询
只有用户在“音乐来源”中主动同意并启用后，应用才会把搜索词发送给所选公共音乐服务。不会发送聊天内容、角色资料或本地文件。

## 三、凭证隔离与安全
平台登录凭证由同域网关处理：
- 平台凭证保存在当前浏览器的 HttpOnly Cookie 中，不写入浏览器本地明文存储；
- 网页脚本不能读取平台凭证；
- 退出后立即清除当前保存的凭证。`
  }
]

// 权限与声明数据
const declarations = [
  {
    title: '同人二创与版权说明',
    badge: '版权声明',
    items: [
      { subtitle: '非商用声明', detail: '本应用为非营利性的同人二次创作工具，仅供个人学习、交流与娱乐使用，严禁任何形式的商业转售、牟利或非法传播。' },
      { subtitle: '知识产权归属', detail: '应用内涉及的所有原创角色原型、音画素材及背景世界观归原版权方所有。本项目在此向原作品及创作者致以最崇高的敬意。' }
    ]
  },
  {
    title: '第三方技术与服务致谢',
    badge: '技术生态',
    items: [
      { subtitle: '大语言模型 (LLM)', detail: '兼容并致谢 OpenAI、Anthropic (Claude)、DeepSeek、Google (Gemini)、SiliconFlow (硅基流动)、OneAPI / NewAPI 等开源及商业大模型生态。' },
      { subtitle: '多模态与语音图像', detail: '致谢 阿里云语音合成 (Aliyun TTS)、ElevenLabs Voice、NovelAI Diffusion 与 Black Forest Labs (Flux) 提供的多模态生成支持。' },
      { subtitle: '核心框架与开源库', detail: '基于 Vue 3、Vite、TypeScript、LocalForage (IndexedDB)、Lucide 等优秀开源软件构建。' }
    ]
  },
  {
    title: '隐私安全与本地存储承诺',
    badge: '数据安全',
    items: [
      { subtitle: '本地优先架构 (Local-First)', detail: '所有聊天对话、角色人设、世界书条目及用户自定义图片均存储在您本机的浏览器数据库（IndexedDB）中，不存在任何中心化用户数据库。' },
      { subtitle: 'API 密钥自主可控', detail: '您的 API Key 及自定义节点地址完全存放在本机环境，由客户端直连或通过您指定的反代节点进行通信，绝无第三方服务器窃取或中间收集。' }
    ]
  },
  {
    title: '免责与合规声明',
    badge: '免责合规',
    items: [
      { subtitle: 'AI 生成内容提示', detail: '应用中角色的一切回复、语音与图像均为大模型算法实时生成，不代表开发者立场，请理性辨别。' },
      { subtitle: '合规使用倡议', detail: '请使用者严格遵守所在地法律法规，严禁将本应用用于生成违法、有害、诽谤或侵犯他人隐私与合法权益的内容。' }
    ]
  }
]

const currentDoc = computed(() => {
  return tutorialDocs.find(d => d.id === activeDocId.value) || null
})

// 安全将纯文本 HTML 转义
const escapeHtml = (text: string) => {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;')
}

// 格式化行内样式（粗体、行内代码）
const formatInline = (text: string) => {
  let res = escapeHtml(text)
  // 行内代码 `code`
  res = res.replace(/`([^`]+)`/g, '<code class="doc-inline-code">$1</code>')
  // 加粗 **bold**
  res = res.replace(/\*\*([^*]+)\*\*/g, '<strong class="doc-bold">$1</strong>')
  return res
}

// 轻量安全 Markdown 渲染器（针对教程文档格式优化）
const renderedDocHtml = computed(() => {
  if (!currentDoc.value) return ''
  const lines = currentDoc.value.content.split('\n')
  const htmlParts: string[] = []
  
  let inUl = false
  let inOl = false

  const closeLists = () => {
    if (inUl) {
      htmlParts.push('</ul>')
      inUl = false
    }
    if (inOl) {
      htmlParts.push('</ol>')
      inOl = false
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    // 空行
    if (!trimmed) {
      closeLists()
      continue
    }

    // 分割线 ---
    if (trimmed === '---' || trimmed === '***') {
      closeLists()
      htmlParts.push('<hr class="doc-hr" />')
      continue
    }

    // 一级标题（文档主标题已在顶部单独显示，正文中的 # 可作为二级渲染或副标）
    if (trimmed.startsWith('# ')) {
      closeLists()
      const title = trimmed.substring(2)
      htmlParts.push(`<h2 class="doc-h1">${formatInline(title)}</h2>`)
      continue
    }

    // 二级标题 ##
    if (trimmed.startsWith('## ')) {
      closeLists()
      const title = trimmed.substring(3)
      htmlParts.push(`<h3 class="doc-h2"><span class="doc-h2-tag"></span>${formatInline(title)}</h3>`)
      continue
    }

    // 三级标题 ###
    if (trimmed.startsWith('### ')) {
      closeLists()
      const title = trimmed.substring(4)
      htmlParts.push(`<h4 class="doc-h3">${formatInline(title)}</h4>`)
      continue
    }

    // 有序列表 1. 2. 3.
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
    if (olMatch) {
      if (inUl) {
        htmlParts.push('</ul>')
        inUl = false
      }
      if (!inOl) {
        htmlParts.push('<ol class="doc-ol">')
        inOl = true
      }
      htmlParts.push(`<li class="doc-li doc-ol-li">${formatInline(olMatch[2])}</li>`)
      continue
    }

    // 无序列表 - 或 *
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/)
    if (ulMatch) {
      if (inOl) {
        htmlParts.push('</ol>')
        inOl = false
      }
      if (!inUl) {
        htmlParts.push('<ul class="doc-ul">')
        inUl = true
      }
      // 判断是否有缩进子项
      const isSub = rawLine.startsWith('   ') || rawLine.startsWith('\t')
      htmlParts.push(`<li class="doc-li doc-ul-li ${isSub ? 'doc-sub-li' : ''}">${formatInline(ulMatch[1])}</li>`)
      continue
    }

    // 普通段落
    closeLists()
    htmlParts.push(`<p class="doc-p">${formatInline(trimmed)}</p>`)
  }

  closeLists()
  return htmlParts.join('')
})

// 查看在线文档
const openDoc = (docId: string) => {
  activeDocId.value = docId
}

// 退出在线文档查看
const closeDoc = () => {
  activeDocId.value = null
}

// 下载 Markdown 文档
const downloadDoc = (doc: TutorialDoc) => {
  const blob = new Blob([doc.content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = doc.fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 复制全部文本
const copyDocContent = (content: string) => {
  navigator.clipboard.writeText(content).then(() => {
    copyToast.value = true
    setTimeout(() => {
      copyToast.value = false
    }, 2000)
  })
}
</script>

<template>
  <div class="gu-tutorial-panel">
    <!-- 顶部卷轴分栏选择器 -->
    <div class="gu-section-tabs" v-if="!activeDocId">
      <button 
        class="gu-section-btn" 
        :class="{ active: currentSection === 'declarations' }"
        @click="currentSection = 'declarations'"
      >
        <span class="gu-section-tag">卷一</span>
        <span class="gu-section-text">权限与声明</span>
      </button>
      <div class="gu-section-sep">|</div>
      <button 
        class="gu-section-btn" 
        :class="{ active: currentSection === 'tutorials' }"
        @click="currentSection = 'tutorials'"
      >
        <span class="gu-section-tag">卷二</span>
        <span class="gu-section-text">使用教程</span>
      </button>
    </div>

    <!-- 卷一：权限与声明 -->
    <div v-if="currentSection === 'declarations' && !activeDocId" class="gu-dec-section">
      <div class="gu-dec-intro">
        <div class="gu-dec-lead">「 守正持心，恪尽明达 」</div>
        <div class="gu-dec-sub">本卷宗明示本项目之版权归属、技术生态鸣谢、本地数据安全承诺与免责合规条款。</div>
      </div>

      <div class="gu-dec-list">
        <div v-for="(dec, idx) in declarations" :key="idx" class="gu-dec-card">
          <div class="gu-dec-header">
            <div class="gu-dec-title-wrap">
              <span class="gu-dec-num">〇{{ idx + 1 }}</span>
              <span class="gu-dec-title">{{ dec.title }}</span>
            </div>
            <span class="gu-dec-badge">{{ dec.badge }}</span>
          </div>

          <div class="gu-dec-body">
            <div v-for="(item, i) in dec.items" :key="i" class="gu-dec-item">
              <div class="gu-dec-item-sub">〔 {{ item.subtitle }} 〕</div>
              <div class="gu-dec-item-detail">{{ item.detail }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 卷二：使用教程列表 -->
    <div v-if="currentSection === 'tutorials' && !activeDocId" class="gu-tut-section">
      <div class="gu-tut-intro">
        <div class="gu-tut-lead">「 循序渐进，尽得其妙 」</div>
        <div class="gu-tut-sub">支持在线查阅卷宗，或一键导出为 Markdown 文件留存。</div>
      </div>

      <div class="gu-tut-list">
        <div v-for="(doc, idx) in tutorialDocs" :key="doc.id" class="gu-tut-card">
          <div class="gu-tut-card-top">
            <div class="gu-tut-title-wrap">
              <span class="gu-tut-tag">{{ doc.tag }}</span>
              <span class="gu-tut-title">{{ doc.title }}</span>
            </div>
          </div>
          <div class="gu-tut-desc">{{ doc.desc }}</div>
          
          <div class="gu-tut-actions">
            <button class="gu-btn-action gu-btn-read" @click="openDoc(doc.id)">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="1.6" fill="none">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
              </svg>
              <span>在线阅读</span>
            </button>
            <button class="gu-btn-action gu-btn-dl" @click="downloadDoc(doc)">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="1.6" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>下载 .md</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 在线查阅卷轴视图 -->
    <div v-if="activeDocId && currentDoc" class="gu-viewer">
      <div class="gu-viewer-header">
        <button class="gu-viewer-back" @click="closeDoc">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>返回目录</span>
        </button>

        <div class="gu-viewer-actions">
          <button class="gu-viewer-btn" @click="copyDocContent(currentDoc.content)">
            {{ copyToast ? '已复制' : '复制全文' }}
          </button>
          <button class="gu-viewer-btn gu-viewer-btn-primary" @click="downloadDoc(currentDoc)">
            下载文件
          </button>
        </div>
      </div>

      <div class="gu-viewer-body">
        <div class="gu-viewer-title-area">
          <span class="gu-viewer-badge">{{ currentDoc.tag }}</span>
          <h2 class="gu-viewer-title">{{ currentDoc.title }}</h2>
        </div>
        <div class="gu-viewer-divider"></div>
        <div class="gu-viewer-content doc-article" v-html="renderedDocHtml"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gu-tutorial-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 顶部卷轴分栏导航 */
.gu-section-tabs {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px 0 16px 0;
  border-bottom: 1px dashed #EAEAEA;
}

.gu-section-btn {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 4px;
  transition: all 0.2s ease;
  color: #888888;
}

.gu-section-btn.active {
  background: #F7F7F7;
  color: #1A1A1A;
}

.gu-section-tag {
  font-family: "STSong", "SimSun", serif;
  font-size: 11px;
  padding: 1px 4px;
  border: 1px solid #CCCCCC;
  border-radius: 2px;
}

.gu-section-btn.active .gu-section-tag {
  border-color: #BE2A2A;
  color: #BE2A2A;
}

.gu-section-text {
  font-family: "STSong", "SimSun", "Songti SC", serif;
  font-size: 15px;
  font-weight: bold;
  letter-spacing: 1px;
}

.gu-section-sep {
  color: #E0E0E0;
  font-size: 12px;
}

/* 引言导读 */
.gu-dec-intro, .gu-tut-intro {
  text-align: center;
  padding: 8px 12px 16px 12px;
}

.gu-dec-lead, .gu-tut-lead {
  font-family: "STSong", "SimSun", serif;
  font-size: 16px;
  font-weight: bold;
  color: #BE2A2A;
  letter-spacing: 3px;
  margin-bottom: 6px;
}

.gu-dec-sub, .gu-tut-sub {
  font-size: 12px;
  color: #777777;
  line-height: 1.5;
}

/* 声明卡片列表 */
.gu-dec-list, .gu-tut-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.gu-dec-card, .gu-tut-card {
  border: 1px solid #ECECEC;
  border-radius: 4px;
  background: #FAFAFA;
  padding: 16px;
  transition: border-color 0.2s;
}

.gu-dec-card:hover, .gu-tut-card:hover {
  border-color: #D6D6D6;
}

.gu-dec-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #EFEFEF;
  padding-bottom: 10px;
  margin-bottom: 12px;
}

.gu-dec-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gu-dec-num {
  font-family: "STSong", "SimSun", serif;
  font-size: 13px;
  color: #999999;
}

.gu-dec-title {
  font-family: "STSong", "SimSun", serif;
  font-size: 15px;
  font-weight: bold;
  color: #1A1A1A;
  letter-spacing: 1px;
}

.gu-dec-badge {
  font-size: 11px;
  color: #BE2A2A;
  background: rgba(190, 42, 42, 0.06);
  padding: 2px 6px;
  border-radius: 2px;
  border: 1px solid rgba(190, 42, 42, 0.2);
}

.gu-dec-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gu-dec-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.gu-dec-item-sub {
  font-size: 13px;
  font-weight: bold;
  color: #333333;
}

.gu-dec-item-detail {
  font-size: 12.5px;
  color: #666666;
  line-height: 1.6;
  padding-left: 6px;
}

/* 教程卡片样式 */
.gu-tut-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.gu-tut-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gu-tut-tag {
  font-size: 11px;
  color: #555555;
  background: #EEEEEE;
  padding: 2px 6px;
  border-radius: 2px;
}

.gu-tut-title {
  font-family: "STSong", "SimSun", serif;
  font-size: 15px;
  font-weight: bold;
  color: #1A1A1A;
  letter-spacing: 1px;
}

.gu-tut-desc {
  font-size: 12.5px;
  color: #666666;
  line-height: 1.5;
  margin-bottom: 12px;
}

.gu-tut-actions {
  display: flex;
  gap: 10px;
}

.gu-btn-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid #DCDCDC;
  background: #FFFFFF;
  border-radius: 4px;
  font-size: 13px;
  color: #333333;
  cursor: pointer;
  transition: all 0.2s ease;
}

.gu-btn-action:hover {
  background: #F5F5F5;
  border-color: #BE2A2A;
  color: #BE2A2A;
}

.gu-btn-read {
  font-family: "STSong", "SimSun", serif;
  font-weight: bold;
}

/* 卷轴查阅器 */
.gu-viewer {
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  border: 1px solid #E5E5E5;
  border-radius: 4px;
  padding: 16px;
  animation: fadeIn 0.2s ease;
}

.gu-viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid #EEEEEE;
  margin-bottom: 16px;
}

.gu-viewer-back {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #555555;
}

.gu-viewer-back:hover {
  color: #BE2A2A;
}

.gu-viewer-actions {
  display: flex;
  gap: 8px;
}

.gu-viewer-btn {
  padding: 4px 10px;
  background: #F5F5F5;
  border: 1px solid #E0E0E0;
  border-radius: 3px;
  font-size: 12px;
  color: #444444;
  cursor: pointer;
}

.gu-viewer-btn:hover {
  background: #EBEBEB;
}

.gu-viewer-btn-primary {
  background: #BE2A2A;
  border-color: #BE2A2A;
  color: #FFFFFF;
}

.gu-viewer-btn-primary:hover {
  background: #A82525;
}

.gu-viewer-title-area {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.gu-viewer-badge {
  font-size: 11px;
  color: #BE2A2A;
  border: 1px solid #BE2A2A;
  padding: 1px 5px;
  border-radius: 2px;
}

.gu-viewer-title {
  margin: 0;
  font-family: "STSong", "SimSun", serif;
  font-size: 17px;
  font-weight: bold;
  color: #1A1A1A;
}

.gu-viewer-divider {
  height: 1px;
  background: #F0F0F0;
  margin-bottom: 14px;
}

.gu-viewer-content {
  background: #FAFAFA;
  padding: 18px 20px;
  border-radius: 6px;
  border: 1px solid #EFEFEF;
  max-height: 520px;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: #2D3748;
}

/* 优雅排版系统 */
:deep(.doc-article) {
  font-size: 13.5px;
  line-height: 1.75;
  letter-spacing: 0.2px;
}

:deep(.doc-h1) {
  font-family: "STSong", "SimSun", "Songti SC", serif;
  font-size: 17px;
  font-weight: 700;
  color: #1A202C;
  margin: 18px 0 12px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #E2E8F0;
}

:deep(.doc-h1:first-child) {
  margin-top: 0;
}

:deep(.doc-h2) {
  font-family: "STSong", "SimSun", "Songti SC", serif;
  font-size: 15.5px;
  font-weight: 700;
  color: #1A202C;
  margin: 20px 0 10px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

:deep(.doc-h2-tag) {
  display: inline-block;
  width: 3.5px;
  height: 14px;
  background: #BE2A2A;
  border-radius: 2px;
}

:deep(.doc-h3) {
  font-size: 14px;
  font-weight: 600;
  color: #2D3748;
  margin: 14px 0 8px 0;
}

:deep(.doc-p) {
  margin: 0 0 10px 0;
  color: #4A5568;
  line-height: 1.75;
}

:deep(.doc-hr) {
  border: none;
  border-top: 1px dashed #E2E8F0;
  margin: 16px 0;
}

:deep(.doc-ol),
:deep(.doc-ul) {
  margin: 6px 0 12px 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

:deep(.doc-li) {
  color: #374151;
  line-height: 1.7;
}

:deep(.doc-ul-li) {
  list-style-type: disc;
}

:deep(.doc-ol-li) {
  list-style-type: decimal;
}

:deep(.doc-sub-li) {
  margin-left: 14px;
  list-style-type: circle;
  color: #4B5563;
}

:deep(.doc-bold) {
  font-weight: 600;
  color: #111827;
}

:deep(.doc-inline-code) {
  display: inline-block;
  padding: 1px 6px;
  margin: 0 2px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  color: #B91C1C;
  background-color: #FEF2F2;
  border: 1px solid #FECACA;
  border-radius: 4px;
  word-break: break-all;
}
</style>
