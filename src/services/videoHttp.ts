/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { CapacitorHttp } from '@capacitor/core'

export type VideoConnectionMode = 'web' | 'app'

export interface VideoHttpRequest {
  url: string
  method: 'GET' | 'POST' | 'DELETE'
  headers?: Record<string, string>
  data?: unknown
  connectionMode?: VideoConnectionMode
  signal?: AbortSignal
  connectTimeout?: number
  readTimeout?: number
}

const parseResponse = async (response: Response) => {
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

export const requestVideoApi = async (request: VideoHttpRequest) => {
  if (request.connectionMode === 'web') {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.data === undefined ? undefined : JSON.stringify(request.data),
        signal: request.signal
      })
      return { status: response.status, data: await parseResponse(response), headers: response.headers }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error
      throw new Error('浏览器无法连接视频接口。请检查网络、接口地址以及该接口是否允许网页跨域直连。')
    }
  }
  const response = await CapacitorHttp.request({
    url: request.url,
    method: request.method,
    headers: request.headers,
    data: request.data,
    connectTimeout: request.connectTimeout || 30000,
    readTimeout: request.readTimeout || 60000
  })
  return { status: response.status, data: response.data, headers: response.headers }
}

export const downloadWebVideo = (url: string, fileName: string) => {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}
