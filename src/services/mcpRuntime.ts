/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { mcpSettings } from '../store/mcp'
import type { McpModelTool, McpToolExecutionResult } from '../types/mcp'
import { readDoubanForCharacterTool } from './doubanCapability'

const DOUBAN_TOOL_NAME = 'mcp__douban__read_public_page'

export const getEnabledMcpTools = (): McpModelTool[] => {
  if (!mcpSettings.enabled || !mcpSettings.douban.enabled || mcpSettings.douban.triggerMode !== 'character') return []
  return [{
    name: DOUBAN_TOOL_NAME,
    description: '读取当前用户消息中的公开豆瓣链接。只有理解当前对话确实需要网页内容时才调用；不得读取非豆瓣链接。',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '提示中列出的完整豆瓣 HTTPS 链接' },
        execution_id: { type: 'string', description: '提示中与链接对应的 execution_id' }
      },
      required: ['url', 'execution_id'],
      additionalProperties: false
    }
  }]
}

export const executeMcpModelTool = async (modelName: string, args: Record<string, unknown>, _signal?: AbortSignal): Promise<McpToolExecutionResult> => {
  if (modelName !== DOUBAN_TOOL_NAME) throw new Error('该旧 MCP 工具已被移除。')
  if (!mcpSettings.enabled || !mcpSettings.douban.enabled) throw new Error('豆瓣能力未开启。')
  try {
    return { content: await readDoubanForCharacterTool(String(args.url || ''), String(args.execution_id || '')) }
  } catch (error) {
    return { content: JSON.stringify({ source: 'douban', status: 'unavailable', reason: error instanceof Error ? error.message : '读取失败' }), isError: true }
  }
}
