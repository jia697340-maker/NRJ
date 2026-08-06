/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref } from 'vue'

export interface WebDAVConfig {
  url: string
  username: string
  password: string
  // 是否已启用
  enabled: boolean
}

export interface WebDAVFile {
  name: string
  lastModified: string
  size: number
  isDir: boolean
  path: string
}

export function useWebDAV() {
  const isConnecting = ref(false)

  // 辅助函数：构造 Basic Auth 头
  const getAuthHeader = (config: WebDAVConfig) => {
    return 'Basic ' + btoa(`${config.username}:${config.password}`)
  }

  // 规范化 URL，确保以 / 结尾
  const normalizeUrl = (url: string) => {
    return url.endsWith('/') ? url : url + '/'
  }

  // 1. 测试连接 (PROPFIND)
  const checkConnection = async (config: WebDAVConfig): Promise<boolean> => {
    isConnecting.value = true
    try {
      const response = await fetch(config.url, {
        method: 'PROPFIND',
        headers: {
          'Authorization': getAuthHeader(config),
          'Depth': '0' // 只查当前目录信息
        }
      })
      isConnecting.value = false
      return response.ok || response.status === 207 // 207 Multi-Status
    } catch (e) {
      console.error('WebDAV 连接测试失败', e)
      isConnecting.value = false
      return false
    }
  }

  // 2. 列出目录文件
  const listFiles = async (config: WebDAVConfig, subPath: string = ''): Promise<WebDAVFile[]> => {
    try {
      const targetUrl = normalizeUrl(config.url) + subPath
      const response = await fetch(targetUrl, {
        method: 'PROPFIND',
        headers: {
          'Authorization': getAuthHeader(config),
          'Depth': '1' // 查当前目录及子层级
        }
      })
      
      if (!response.ok && response.status !== 207) {
        throw new Error(`PROPFIND 失败，状态码: ${response.status}`)
      }

      const text = await response.text()
      
      // 简单解析 XML 响应
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(text, 'text/xml')
      const responses = xmlDoc.getElementsByTagNameNS('*', 'response')
      
      const files: WebDAVFile[] = []
      
      for (let i = 0; i < responses.length; i++) {
        const resp = responses[i]
        const hrefNode = resp.getElementsByTagNameNS('*', 'href')[0]
        if (!hrefNode || !hrefNode.textContent) continue
        
        let href = hrefNode.textContent
        href = decodeURIComponent(href)
        
        // 排除当前目录自身
        const isCurrentDir = (new URL(targetUrl).pathname === href || new URL(targetUrl).pathname === href + '/')
        if (isCurrentDir) continue

        const propstatNode = resp.getElementsByTagNameNS('*', 'propstat')[0]
        if (!propstatNode) continue
        
        const propNode = propstatNode.getElementsByTagNameNS('*', 'prop')[0]
        if (!propNode) continue

        const isDir = propNode.getElementsByTagNameNS('*', 'collection').length > 0
        const nameMatch = href.replace(/\/$/, '').split('/').pop()
        const name = nameMatch || ''
        
        const lastModifiedNode = propNode.getElementsByTagNameNS('*', 'getlastmodified')[0]
        const lastModified = lastModifiedNode?.textContent || ''

        const sizeNode = propNode.getElementsByTagNameNS('*', 'getcontentlength')[0]
        const size = sizeNode?.textContent ? parseInt(sizeNode.textContent, 10) : 0

        files.push({
          name,
          lastModified,
          size,
          isDir,
          path: href
        })
      }
      
      // 按最后修改时间倒序排列
      files.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
      return files

    } catch (e) {
      console.error('获取文件列表失败', e)
      throw e
    }
  }

  // 3. 上传文件 (PUT)
  const uploadFile = async (config: WebDAVConfig, filename: string, data: ArrayBuffer | string): Promise<boolean> => {
    try {
      const targetUrl = normalizeUrl(config.url) + filename
      const response = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          'Authorization': getAuthHeader(config)
        },
        body: data
      })
      return response.ok || response.status === 201 || response.status === 204
    } catch (e) {
      console.error('文件上传失败', e)
      return false
    }
  }

  // 4. 下载文件 (GET)
  const downloadFile = async (config: WebDAVConfig, filename: string): Promise<ArrayBuffer> => {
    try {
      const targetUrl = normalizeUrl(config.url) + filename
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Authorization': getAuthHeader(config)
        }
      })
      if (!response.ok) {
        throw new Error(`文件下载失败，状态码: ${response.status}`)
      }
      return await response.arrayBuffer()
    } catch (e) {
      console.error('文件下载失败', e)
      throw e
    }
  }

  // 5. 删除文件 (DELETE)
  const deleteFile = async (config: WebDAVConfig, filename: string): Promise<boolean> => {
    try {
      const targetUrl = normalizeUrl(config.url) + filename
      const response = await fetch(targetUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': getAuthHeader(config)
        }
      })
      return response.ok || response.status === 204
    } catch (e) {
      console.error('删除文件失败', e)
      return false
    }
  }

  return {
    isConnecting,
    checkConnection,
    listFiles,
    uploadFile,
    downloadFile,
    deleteFile
  }
}
