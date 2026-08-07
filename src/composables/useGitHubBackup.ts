export interface GitHubBackupConfig {
  token: string
  repository: string
  branch: string
  retention: number
  encryptionPassword?: string
}

export interface GitHubBackupEntry {
  id: string
  label: string
  createdAt: number
  totalSize: number
  parts: Array<{ name: string; size: number }>
  checksum: string
  encrypted: boolean
}

const API_ROOT = 'https://api.github.com'
const CHUNK_SIZE = 8 * 1024 * 1024

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  const batch = 0x8000
  for (let i = 0; i < bytes.length; i += batch) binary += String.fromCharCode(...bytes.subarray(i, i + batch))
  return btoa(binary)
}

const base64ToBytes = (value: string) => {
  const binary = atob(value.replace(/\s/g, ''))
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

const sha256 = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('')
}

export function useGitHubBackup() {
  const apiRequest = async (config: GitHubBackupConfig, endpoint: string, init: RequestInit = {}) => {
    const repository = config.repository.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/^\/+|\/+$/g, '')
    if (!/^[^/]+\/[^/]+$/.test(repository)) throw new Error('仓库格式应为“用户名/仓库名”')
    const response = await fetch(`${API_ROOT}/repos/${repository}${endpoint}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.headers || {})
      }
    })
    if (!response.ok) {
      let detail = ''
      try { detail = (await response.json()).message || '' } catch { /* ignore */ }
      throw new Error(`GitHub 请求失败（${response.status}）${detail ? `：${detail}` : ''}`)
    }
    if (response.status === 204) return null
    return response.json()
  }

  const contentEndpoint = (path: string, config: GitHubBackupConfig) => {
    const encoded = path.split('/').filter(Boolean).map(encodeURIComponent).join('/')
    const branch = encodeURIComponent(config.branch || 'main')
    return `/contents/${encoded}${encoded ? `?ref=${branch}` : `?ref=${branch}`}`
  }

  const getContent = (config: GitHubBackupConfig, path: string) => apiRequest(config, contentEndpoint(path, config))

  const putContent = (config: GitHubBackupConfig, path: string, content: string, message: string) => apiRequest(config, `/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    body: JSON.stringify({ message, branch: config.branch || 'main', content })
  })

  const testConnection = async (config: GitHubBackupConfig) => {
    const repo = await apiRequest(config, '')
    if (repo?.archived) throw new Error('该仓库已归档，不能写入备份')
    if (!repo?.private) throw new Error('为保护聊天和媒体数据，只允许使用私有仓库')
    return { name: repo.full_name as string, private: !!repo.private, defaultBranch: repo.default_branch as string }
  }

  const uploadBackup = async (config: GitHubBackupConfig, buffer: ArrayBuffer, label: string, onProgress: (current: number, total: number) => void, encrypted = true) => {
    await testConnection(config)
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const root = `clingy-backups/${id}`
    const bytes = new Uint8Array(buffer)
    const parts: { name: string; size: number }[] = []
    const total = Math.max(1, Math.ceil(bytes.length / CHUNK_SIZE))
    const checksum = await sha256(bytes)
    for (let index = 0; index < total; index++) {
      const name = `part-${String(index + 1).padStart(4, '0')}.bin`
      const slice = bytes.slice(index * CHUNK_SIZE, Math.min(bytes.length, (index + 1) * CHUNK_SIZE))
      await putContent(config, `${root}/${name}`, bytesToBase64(slice), `backup ${id} part ${index + 1}/${total}`)
      parts.push({ name, size: slice.byteLength })
      onProgress(index + 1, total)
    }
    const manifest: GitHubBackupEntry & { format: string; version: number } = { format: 'nrt-github-backup', version: 2, id, label, createdAt: Date.now(), totalSize: bytes.byteLength, parts, checksum, encrypted }
    await putContent(config, `${root}/manifest.json`, bytesToBase64(new TextEncoder().encode(JSON.stringify(manifest))), `complete backup ${id}`)
    await pruneBackups(config)
    return { id, total, checksum }
  }

  const listBackups = async (config: GitHubBackupConfig): Promise<GitHubBackupEntry[]> => {
    let roots: any[] = []
    try { roots = await getContent(config, 'clingy-backups') } catch (error: any) {
      if (String(error?.message || '').includes('404')) return []
      throw error
    }
    const directories = Array.isArray(roots) ? roots.filter(item => item.type === 'dir') : []
    const entries: GitHubBackupEntry[] = []
    for (const directory of directories) {
      try {
        const manifestFile = await getContent(config, `clingy-backups/${directory.name}/manifest.json`)
        const manifest = JSON.parse(new TextDecoder().decode(base64ToBytes(manifestFile.content || '')))
        if (manifest.format === 'nrt-github-backup' && Array.isArray(manifest.parts)) entries.push(manifest)
      } catch { /* 未写入清单的目录视为未完成上传，不展示为可恢复备份 */ }
    }
    return entries.sort((a, b) => b.createdAt - a.createdAt)
  }

  const downloadBackup = async (config: GitHubBackupConfig, entry: GitHubBackupEntry, onProgress: (current: number, total: number) => void) => {
    const result = new Uint8Array(entry.totalSize)
    let offset = 0
    for (let index = 0; index < entry.parts.length; index++) {
      const part = await getContent(config, `clingy-backups/${entry.id}/${entry.parts[index].name}`)
      const bytes = base64ToBytes(part.content || '')
      if (bytes.byteLength !== entry.parts[index].size) throw new Error(`第 ${index + 1} 个分卷大小不一致`)
      result.set(bytes, offset)
      offset += bytes.byteLength
      onProgress(index + 1, entry.parts.length)
    }
    if (offset !== entry.totalSize || await sha256(result) !== entry.checksum) throw new Error('GitHub 备份校验失败，分卷可能缺失或损坏')
    return result.buffer
  }

  const deleteBackup = async (config: GitHubBackupConfig, entry: GitHubBackupEntry) => {
    const files = await getContent(config, `clingy-backups/${entry.id}`) as any[]
    for (const file of files) {
      await apiRequest(config, `/contents/${file.path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'DELETE',
        body: JSON.stringify({ message: `delete backup ${entry.id}`, branch: config.branch || 'main', sha: file.sha })
      })
    }
  }

  const pruneBackups = async (config: GitHubBackupConfig) => {
    const retention = Math.max(1, Number(config.retention) || 10)
    const backups = await listBackups(config)
    for (const backup of backups.slice(retention)) await deleteBackup(config, backup)
  }

  return { testConnection, uploadBackup, listBackups, downloadBackup, deleteBackup, pruneBackups }
}
