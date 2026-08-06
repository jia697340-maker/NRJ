/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { watch } from 'vue'
import { useNovelAIVibe } from '../../../composables/useNovelAIVibe'
import { COMMON_RESOLUTIONS, llmProviders, useChatNAIConfig } from '../../../composables/useChatNAIConfig'

const props = defineProps<{
  visible: boolean
  chat: any
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save'): void
}>()

const { vibeGroups } = useNovelAIVibe()

const {
  localConfig, activeTab, showApiKey, showLlmApiKey,
  presets, promptPresets, llmPresets,
  llmModelOptions, isFetchingModels, fetchModelError, fetchModelSuccess,
  showLlmPromptModal, editingLlmPrompt, dragPromptIndex,
  showConfirmModal, confirmModalMessage,
  showPromptPresetNameModal, newPromptPresetName, currentPromptPresetId,
  showLlmPresetNameModal, newLlmPresetName,
  
  initConfig,
  fetchLlmModels, applyLlmPreset, saveLlmPreset, confirmSaveLlmPreset, cancelSaveLlmPreset,
  deleteLlmPreset, onLlmProviderChange, pullFromGlobalApi,
  addLlmPrompt, editLlmPrompt, saveLlmPrompt, deleteLlmPrompt,
  handlePromptDragStart, handlePromptDragOver, handlePromptDragEnd,
  applyPromptPreset, savePromptPreset, confirmSavePromptPreset, cancelSavePromptPreset, deletePromptPreset,
  applyPreset, fixResolution, onWidthBlur, onHeightBlur,
  cancelConfirm, executeConfirm
} = useChatNAIConfig(props)

watch(() => props.visible, (newVal) => {
  if (newVal) {
    initConfig()
  }
})

const closeModal = () => {
  emit('update:visible', false)
}

const handleSave = () => {
  localConfig.value.width = fixResolution(localConfig.value.width)
  localConfig.value.height = fixResolution(localConfig.value.height)
  props.chat.naiConfig = JSON.parse(JSON.stringify(localConfig.value))
  emit('save')
  closeModal()
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10000;" @click.self="closeModal">
    <div class="custom-confirm-modal nai-detail-modal">
      <div @click="closeModal" class="modal-close-btn">&times;</div>
      <div class="confirm-title" style="margin-bottom: 16px;">角色生图独立配置</div>
      
      <div class="modal-scroll-body">
        
        <!-- API 配置 -->
        <div class="section">
          <h3 class="section-title">API 独立配置</h3>
          <div style="font-size: 13px; color: #888; margin-bottom: 12px;">注：留空则使用图像大厅的全局配置</div>
          
          <div class="form-row">
            <label>从全局预设快捷填入</label>
            <div class="input-with-btn">
              <select v-model="localConfig.presetId" @change="applyPreset" class="form-select">
                <option value="">-- 选择全局节点预设 --</option>
                <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <label>API Key</label>
            <div class="input-with-btn">
              <input :type="showApiKey ? 'text' : 'password'" v-model="localConfig.apiKey" class="form-input" placeholder="输入覆盖用的 API Key" />
              <button class="text-btn" @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button>
            </div>
          </div>
          <div class="form-row">
            <label>Base URL</label>
            <div class="input-with-btn">
              <input type="text" v-model="localConfig.baseUrl" class="form-input" placeholder="留空默认官方/全局" />
              <button class="text-btn" @click="localConfig.baseUrl = 'https://image.novelai.net'" title="恢复为官方地址">官方</button>
            </div>
          </div>
          <div class="form-row">
            <div class="flex-between">
              <label>流式生成 (SSE)</label>
              <label class="toggle-switch">
                <input type="checkbox" v-model="localConfig.useStream" class="toggle-checkbox" />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- 参数配置区 -->
        <div class="section">
          <div class="pill-menu-wrapper">
            <div class="pill-menu">
              <button class="pill-item" :class="{active: activeTab === 'specs'}" @click="activeTab = 'specs'">模型与规格</button>
              <button class="pill-item" :class="{active: activeTab === 'vibe'}" @click="activeTab = 'vibe'">氛围参考</button>
              <button class="pill-item" :class="{active: activeTab === 'prompts'}" @click="activeTab = 'prompts'">提示词</button>
              <button class="pill-item" :class="{active: activeTab === 'llm'}" @click="activeTab = 'llm'">LLM 辅助</button>
            </div>
          </div>

          <!-- 模型与规格 -->
          <div v-if="activeTab === 'specs'" class="tab-content">
            <div class="form-row">
              <label>模型 (Model)</label>
              <select v-model="localConfig.model" class="form-select">
                <option value="nai-diffusion-4-5-full">NAI 4.5 完整版</option>
                <option value="nai-diffusion-4-5-curated-preview">NAI 4.5 精选预览版</option>
                <option value="nai-diffusion-4-full">NAI 4 完整版</option>
                <option value="nai-diffusion-4-curated-preview">NAI 4 精选预览版</option>
                <option value="nai-diffusion-3">NAI 3 标准模型</option>
                <option value="nai-diffusion-furry-3">NAI 3 Furry模型</option>
              </select>
            </div>
            
            <div class="form-row">
              <label>快捷尺寸</label>
              <select class="form-select" @change="(e) => {
                const val = (e.target as HTMLSelectElement).value;
                if (val) {
                  const parts = val.split('x');
                  localConfig.width = parseInt(parts[0]);
                  localConfig.height = parseInt(parts[1]);
                }
              }">
                <option value="">-- 选择常用尺寸 --</option>
                <option v-for="res in COMMON_RESOLUTIONS" :key="res.label" :value="`${res.width}x${res.height}`">
                  {{ res.label }}
                </option>
              </select>
            </div>

            <div class="form-row-half">
              <div class="form-row">
                <label>宽度 (Width)</label>
                <input type="number" step="64" min="64" v-model.number="localConfig.width" @blur="onWidthBlur" class="form-input" />
              </div>
              <div class="form-row">
                <label>高度 (Height)</label>
                <input type="number" step="64" min="64" v-model.number="localConfig.height" @blur="onHeightBlur" class="form-input" />
              </div>
            </div>
            <div class="form-row-half">
              <div class="form-row">
                <label>生成步数 (Steps)</label>
                <input type="number" min="1" max="50" v-model.number="localConfig.steps" class="form-input" />
              </div>
              <div class="form-row">
                <label>引导系数 (Scale)</label>
                <input type="number" step="0.1" v-model.number="localConfig.scale" class="form-input" />
              </div>
            </div>
            <div class="form-row-half">
              <div class="form-row">
                <label>采样器 (Sampler)</label>
                <select v-model="localConfig.sampler" class="form-select">
                  <option value="k_euler_ancestral">Euler Ancestral</option>
                  <option value="k_euler">Euler</option>
                  <option value="k_dpmpp_2s_ancestral">DPM++ 2S Ancestral</option>
                  <option value="k_dpmpp_2m_sde">DPM++ 2M SDE</option>
                  <option value="k_dpmpp_2m">DPM++ 2M</option>
                  <option value="k_dpmpp_sde">DPM++ SDE</option>
                  <option value="ddim" v-if="localConfig.model.includes('nai-diffusion-3')">DDIM</option>
                </select>
              </div>
              <div class="form-row">
                <label>噪声调度 (Schedule)</label>
                <select v-model="localConfig.noise_schedule" class="form-select">
                  <option value="karras">Karras</option>
                  <option value="exponential">Exponential</option>
                  <option value="polyexponential">Polyexponential</option>
                  <option value="native" v-if="localConfig.model.includes('nai-diffusion-3')">Native</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <label>随机种子 (Seed)</label>
              <input type="number" v-model="localConfig.seed" class="form-input" placeholder="不填表示随机" />
            </div>

            <!-- NAI3 特定设置 -->
            <div v-if="localConfig.model.includes('nai-diffusion-3')" class="form-row" style="margin-top: 10px; padding: 12px; background: rgba(0,0,0,0.02); border-radius: 8px;">
              <div class="flex-between" style="margin-bottom: 8px;">
                <label>启用 SMEA (sm)</label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="localConfig.sm" class="toggle-checkbox" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div class="flex-between" :style="{ opacity: localConfig.sm ? 1 : 0.5 }">
                <label>启用 SMEA DYN (sm_dyn)</label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="localConfig.sm_dyn" :disabled="!localConfig.sm" class="toggle-checkbox" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>

            <!-- NAI4 特定设置 -->
            <div v-if="localConfig.model.includes('nai-diffusion-4')" class="form-row" style="margin-top: 10px; padding: 12px; background: rgba(0,0,0,0.02); border-radius: 8px;">
              <div class="flex-between">
                <label>启用 Variety+ (skip_cfg_above_sigma)</label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="localConfig.skip_cfg_above_sigma" class="toggle-checkbox" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          <!-- 氛围参考 (Vibe) -->
          <div v-if="activeTab === 'vibe'" class="tab-content">
            <div class="vibe-checkbox-list">
              <div v-if="vibeGroups.length === 0" class="vibe-empty">暂无氛围组，请先前往图像大厅添加</div>
              <label v-for="g in vibeGroups" :key="g.id" class="vibe-checkbox-item">
                <span class="vci-name">{{ g.name }} <span class="vci-count">({{ g.items.length }}图)</span></span>
                <input type="checkbox" :value="g.id" v-model="localConfig.vibe_group_ids" class="styled-checkbox" />
              </label>
            </div>
          </div>

          <!-- 提示词配置 -->
          <div v-if="activeTab === 'prompts'" class="tab-content">
            <div class="form-row">
              <label>提示词预设方案</label>
              <div class="input-with-btn">
                <select v-model="currentPromptPresetId" @change="applyPromptPreset" class="form-select">
                  <option value="">当前自定义</option>
                  <option v-for="p in promptPresets" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
                <button class="text-btn" @click="savePromptPreset">保存</button>
                <button v-if="currentPromptPresetId" class="text-btn" style="color: #ff3b30;" @click="deletePromptPreset">删除</button>
              </div>
            </div>
            <div class="form-row">
              <label>正向提示词与画风 (Prompt)</label>
              <textarea 
                v-model="localConfig.naiImagePrompt" 
                class="form-textarea"
                rows="6" 
                placeholder="在此输入画师TAG以及角色外貌等描述，这将在生图时被拼接进去"
              ></textarea>
            </div>
            <div class="form-row">
              <label>默认反向提示词 (Negative Prompt)</label>
              <textarea 
                v-model="localConfig.negativePrompt" 
                class="form-textarea"
                rows="4" 
              ></textarea>
            </div>
            <div class="form-row" style="padding:12px;background:rgba(0,122,255,.05);border-radius:8px">
              <div class="flex-between"><label>角色视觉档案</label><label class="toggle-switch"><input type="checkbox" v-model="localConfig.visualProfile.enabled" class="toggle-checkbox" /><span class="toggle-slider"></span></label></div>
              <template v-if="localConfig.visualProfile.enabled">
                <div class="flex-between" style="margin-top:10px; margin-bottom: 6px;">
                  <label style="margin:0;">中文设定（仅供你查看）</label>
                  <button class="simple-modal-btn" style="padding: 4px 10px; font-size: 11px; border: none; border-radius: 4px; background: rgba(0,122,255,0.1); color: #007aff; height: auto; flex: none; min-width: auto; cursor: pointer;" @click="translateVisualProfile" :disabled="isTranslating">{{ isTranslating ? '翻译中...' : '一键翻译并填入' }}</button>
                </div>
                <div v-if="translateError" style="font-size: 11px; color: #ff3b30; margin-bottom: 6px;">{{ translateError }}</div>
                <textarea v-model="localConfig.visualProfile.descriptionZh" class="form-textarea" rows="2" placeholder="例如：银发、异色瞳、黑色长风衣" />
                <label style="margin-top:10px">固定英文角色词</label><textarea v-model="localConfig.visualProfile.promptEn" class="form-textarea" rows="3" placeholder="silver hair, heterochromia, black long coat" />
                <label style="margin-top:10px">角色专属负面词</label><textarea v-model="localConfig.visualProfile.negativeEn" class="form-textarea" rows="2" placeholder="例如：wrong eye color" />
                <button style="margin-top: 8px; padding: 6px 16px; border-radius: 8px; border: 1px solid rgba(255,59,48,0.3); background: rgba(255,59,48,0.05); color: #ff3b30; font-size: 13px; cursor: pointer; transition: all 0.2s;" @click="localConfig.visualProfile = { enabled:false, descriptionZh:'', promptEn:'', negativeEn:'' }">删除视觉档案</button>
              </template>
            </div>
          </div>

          <!-- LLM 辅助生图 -->
          <div v-if="activeTab === 'llm'" class="tab-content">
            <div class="form-row" style="padding: 12px; background: rgba(0,122,255,0.05); border-radius: 8px; border: 1px solid rgba(0,122,255,0.2);">
              <div class="flex-between" style="margin-bottom: 8px;">
                <label style="color: #007aff; margin-bottom: 0;">开启 LLM 生图辅助</label>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="localConfig.enableLlmAssist" class="toggle-checkbox" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div style="font-size: 12px; color: #666; line-height: 1.4;">开启后，每次生图将抓取近期聊天记录，由独立的大模型负责生成精细的提示词。</div>
            </div>

            <template v-if="localConfig.enableLlmAssist">
              <div class="form-row" style="margin-top: 16px; background: rgba(0,0,0,0.02); padding: 12px; border-radius: 8px;">
                <div class="flex-between" style="margin-bottom: 8px;">
                  <label style="margin-bottom: 0; color: var(--text-primary);">独立 LLM 预设方案</label>
                  <button class="simple-modal-btn cancel" style="padding: 4px 12px; font-size: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 6px; background: rgba(0,122,255,0.05); color: #007aff; height: auto; flex: none;" @click="pullFromGlobalApi">↓ 从全局节点拉取</button>
                </div>
                <div class="input-with-btn" style="margin-bottom: 12px;">
                  <select v-model="localConfig.llmPresetId" @change="applyLlmPreset" class="form-select">
                    <option value="">-- 当前未保存的自定义方案 --</option>
                    <option v-for="p in llmPresets" :key="p.id" :value="p.id">{{ p.name }}</option>
                  </select>
                  <button class="text-btn" @click="saveLlmPreset">{{ localConfig.llmPresetId ? '保存修改' : '另存为' }}</button>
                  <button v-if="localConfig.llmPresetId" class="text-btn" style="color: #ff3b30;" @click="deleteLlmPreset">删除</button>
                </div>
              </div>

              <div class="form-row">
                <label>LLM 服务商</label>
                <select v-model="localConfig.llmProvider" @change="onLlmProviderChange" class="form-select">
                  <option v-for="p in llmProviders" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
              </div>

              <div class="form-row">
                <label>LLM API URL (支持自定义)</label>
                <input type="text" v-model="localConfig.llmApiUrl" class="form-input" placeholder="例如 https://api.openai.com/v1/chat/completions" />
              </div>
              
              <div class="form-row">
                <label>LLM API Key</label>
                <div class="input-with-btn">
                  <input :type="showLlmApiKey ? 'text' : 'password'" v-model="localConfig.llmApiKey" class="form-input" placeholder="输入 LLM 的 API Key" />
                  <button class="text-btn" @click="showLlmApiKey = !showLlmApiKey">{{ showLlmApiKey ? '隐藏' : '显示' }}</button>
                </div>
              </div>

              <div class="form-row">
                <div class="flex-between" style="margin-bottom: 8px;">
                  <label style="margin-bottom: 0;">LLM Model</label>
                  <button class="simple-modal-btn cancel" style="padding: 4px 12px; font-size: 12px; border: 1px solid var(--border-color); border-radius: 6px; background: rgba(0,0,0,0.02); color: var(--text-primary); height: auto; flex: none; min-width: 80px;" @click="fetchLlmModels" :disabled="isFetchingModels">{{ isFetchingModels ? '拉取中...' : '拉取模型列表' }}</button>
                </div>
                
                <div v-if="llmModelOptions.length > 0" style="margin-bottom: 8px;">
                  <select v-model="localConfig.llmModel" class="form-select" style="background: rgba(0,122,255,0.05); border-color: rgba(0,122,255,0.3);">
                    <option value="" disabled>-- 请选择拉取到的模型 --</option>
                    <option v-for="m in llmModelOptions" :key="m" :value="m">{{ m }}</option>
                  </select>
                </div>
                
                <input type="text" v-model="localConfig.llmModel" class="form-input" placeholder="若列表未拉取或无目标模型，可在此手动填入模型名 (如 gpt-4o)" />
                <div v-if="fetchModelError" style="font-size: 11px; color: #ff3b30; margin-top: 4px;">{{ fetchModelError }}</div>
                <div v-if="fetchModelSuccess" style="font-size: 11px; color: #34c759; margin-top: 4px;">模型拉取成功！请在上方下拉框选择，或继续手动输入。</div>
              </div>

              <div class="form-row" style="margin-top: 16px;">
                <label>上下文提取条数</label>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input type="number" min="1" max="100" v-model.number="localConfig.llmContextSize" class="form-input" style="width: 100px;" />
                  <span style="font-size: 12px; color: #666;">向上提取最近对话作为生图上下文</span>
                </div>
              </div>

              <div class="form-row" style="margin-top: 24px;">
                <div class="flex-between" style="margin-bottom: 12px;">
                  <label>LLM 辅助提示词条目 (拖拽可排序)</label>
                  <button class="simple-modal-btn confirm primary" style="padding: 4px 12px; font-size: 12px; border: none; border-radius: 6px; background: var(--text-secondary); color: var(--sys-bg-secondary); height: auto; flex: none; min-width: 80px;" @click="addLlmPrompt">+ 新增条目</button>
                </div>
                <div class="cot-list" style="display: flex; flex-direction: column; gap: 8px;">
                  <div 
                    v-for="(prompt, index) in localConfig.llmPrompts" 
                    :key="prompt.id" 
                    class="cot-item-card"
                    draggable="true"
                    @dragstart="handlePromptDragStart(index)"
                    @dragover="handlePromptDragOver($event, index)"
                    @dragend="handlePromptDragEnd"
                    :class="{ 'is-dragging': dragPromptIndex === index }"
                  >
                    <div class="cot-card-inner">
                      <div class="cot-card-top">
                        <div class="drag-handle">
                          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        </div>
                        <span class="cot-item-name">{{ prompt.name }}</span>
                        <div class="spacer"></div>
                        <label class="toggle-switch mini" style="margin: 0; transform: scale(0.9); transform-origin: right center;">
                          <input type="checkbox" v-model="prompt.enabled" class="toggle-checkbox" />
                          <span class="toggle-slider"></span>
                        </label>
                      </div>

                      <div class="cot-card-bottom">
                        <div style="font-size: 11px; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%;">
                          {{ prompt.content }}
                        </div>
                        <div class="cot-item-actions">
                          <button class="icon-btn edit" @click="editLlmPrompt(prompt)">编辑</button>
                          <button class="icon-btn delete" @click="deleteLlmPrompt(prompt.id)">删除</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

      </div>

      <div class="confirm-actions" style="margin-top: 16px; border-top: none; padding: 0 24px; gap: 12px; margin-bottom: 4px;">
        <div class="confirm-btn secondary" style="background: rgba(0,0,0,0.05); color: var(--text-secondary); border-radius: 12px;" @click="closeModal">取消</div>
        <div class="confirm-btn primary" style="background: var(--text-primary); color: var(--sys-bg-primary); border-radius: 12px;" @click="handleSave">保存配置</div>
      </div>
    </div>

    <!-- 通用确认弹窗 -->
    <Transition name="fade">
      <div class="simple-modal-overlay" v-if="showConfirmModal" style="z-index: 20000;">
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

    <!-- LLM 提示词编辑弹窗 -->
    <Transition name="fade">
      <div class="simple-modal-overlay" v-if="showLlmPromptModal" style="z-index: 20000;">
        <div class="simple-modal" style="width: 85%; max-width: 500px;">
          <div class="simple-modal-title">编辑 LLM 辅助提示词</div>
          <div class="simple-modal-body" style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <div style="font-size: 13px; margin-bottom: 6px; color: #555;">条目名称</div>
              <input v-model="editingLlmPrompt.name" class="simple-modal-input" placeholder="输入条目名称" />
            </div>
            <div>
              <div style="font-size: 13px; margin-bottom: 6px; color: #555;">提示词内容</div>
              <textarea v-model="editingLlmPrompt.content" class="simple-modal-input" rows="12" placeholder="输入系统设定的 Prompt..." style="resize: vertical;"></textarea>
            </div>
          </div>
          <div class="simple-modal-footer">
            <button class="simple-modal-btn cancel" @click="showLlmPromptModal = false">取消</button>
            <button class="simple-modal-btn confirm" @click="saveLlmPrompt">保存</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 轻量级 iOS 风格命名弹窗 (LLM预设) -->
    <Transition name="fade">
      <div class="simple-modal-overlay" v-if="showLlmPresetNameModal" style="z-index: 20000;">
        <div class="simple-modal">
          <div class="simple-modal-title">保存 LLM 预设</div>
          <div class="simple-modal-body">
            <input 
              v-model="newLlmPresetName" 
              class="simple-modal-input" 
              placeholder="请输入预设名称" 
              spellcheck="false" 
              autocomplete="off"
              @keyup.enter="confirmSaveLlmPreset"
            />
          </div>
          <div class="simple-modal-footer">
            <button class="simple-modal-btn cancel" @click="cancelSaveLlmPreset">取消</button>
            <button class="simple-modal-btn confirm" @click="confirmSaveLlmPreset">确定</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 轻量级 iOS 风格命名弹窗 (提示词预设) -->
    <Transition name="fade">
      <div class="simple-modal-overlay" v-if="showPromptPresetNameModal" style="z-index: 20000;">
        <div class="simple-modal">
          <div class="simple-modal-title">保存提示词预设</div>
          <div class="simple-modal-body">
            <input 
              v-model="newPromptPresetName" 
              class="simple-modal-input" 
              placeholder="请输入预设名称" 
              spellcheck="false" 
              autocomplete="off"
              @keyup.enter="confirmSavePromptPreset"
            />
          </div>
          <div class="simple-modal-footer">
            <button class="simple-modal-btn cancel" @click="cancelSavePromptPreset">取消</button>
            <button class="simple-modal-btn confirm" @click="confirmSavePromptPreset">确定</button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped src="./ChatNAIImageDetailModal.css"></style>
