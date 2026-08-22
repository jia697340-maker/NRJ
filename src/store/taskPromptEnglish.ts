/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { PromptItem } from './prompt'

const translations: Record<string, { name: string; content: string }> = {
  task_video_call_decision_system: {
    name: 'Video/voice call · Answer decision (system)',
    content: `[Task]\nDecide whether the character {{char_name}} would answer the video or voice call that the user {{user_name}} is placing now. Make only this choice; do not continue the dialogue or output an explanation or emoji.\n\n[{{char_name}}'s persona]\n{{char_persona}}\n\n[Information about {{user_name}}]\n{{user_persona}}\n\n[Long-term memory]\n{{long_term_memory}}\n\n[Recent chat history]\n{{short_term_memory}}`
  },
  task_video_call_decision_user: {
    name: 'Video/voice call · Answer decision (user)',
    content: `[Current event]\n{{user_name}} is placing a real-time call to {{char_name}}.\nBased only on {{char_name}}'s persona, {{user_name}}'s profile, and the recent conversation context above, independently decide whether {{char_name}} would answer now.\n\n[Required output]\nOutput exactly one valid JSON object and no other characters.\n- Answer: {"decision": "accept"}\n- Decline: {"decision": "reject"}`
  },
  task_video_call_temp_summary: {
    name: 'Video/voice call · Interim summary',
    content: `Summarize the following portion of the call concisely.\nRequirements:\n1. Extract the key discussion points and current progress.\n2. Write objectively in the third person.\n3. When the conversation is in Chinese, keep the summary within 50–150 Chinese characters.\n4. Write the summary in Simplified Chinese unless the source conversation clearly uses another language.\n\n{{optional_previous_summary}}\n[New call transcript]\n{{new_messages}}`
  },
  task_video_call_final_summary: {
    name: 'Video/voice call · Final archival summary',
    content: `[Complete call archive]\nUsing the earlier call summary, when present, and the detailed transcript from the end of the call, produce a third-person archival summary of the complete call for long-term memory.\n\nRequirements:\n1. Write objectively in the third person, for example: “{{char_name}} and {{user_name}} discussed ... during the call.”\n2. Preserve the core events, decisions, and both parties' emotional states.\n3. Be concise. When the conversation is in Chinese, keep the summary within 100–300 Chinese characters.\n4. Write the summary in Simplified Chinese unless the source conversation clearly uses another language.\n\n{{optional_previous_summary}}\n{{remaining_messages}}`
  },
  task_voice_call_status: {
    name: 'Voice call · Mode constraint',
    content: `\n\n[Current mode: voice call]\nThe character {{char_name}} and the user {{user_name}} are in a real-time voice call. {{char_name}} uses natural spoken language without kaomoji, sticker tags, or parenthetical action descriptions from text chat.`
  },
  task_video_call_status: {
    name: 'Video call · Mode constraint',
    content: `\n\n[Current mode: video call]\n{{char_name}} and {{user_name}} are in a real-time video call. Strictly separate {{char_name}}'s speech from action and environment narration:\n1. Speech must use <msg>spoken words</msg> and contain only words actually said aloud. Never include parenthetical action descriptions.\n2. Actions, environment, and narration must use a standalone <narration>action, expression, or surrounding environment</narration>, written objectively in the third person. Refer to everyone by explicit name, such as {{char_name}} and {{user_name}}, rather than first- or second-person pronouns.\nExample:\n<narration>{{char_name}} moves the camera a little closer and studies {{user_name}} on the screen.</narration>\n<msg>Can you hear me clearly?</msg>`
  }
}

export const buildEnglishTaskPromptItems = (source: PromptItem[]): PromptItem[] => (
  source.map(item => ({ ...item, ...(translations[item.id] || {}) }))
)
