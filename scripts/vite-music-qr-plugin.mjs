import musicQrHandler from '../netlify/functions/music-qr.mjs'

const readBody = request => new Promise((resolve, reject) => {
  const chunks = []
  request.on('data', chunk => chunks.push(Buffer.from(chunk)))
  request.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined))
  request.on('error', reject)
})

export const musicQrDevPlugin = () => ({
  name: 'nrj-public-music-qr',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`)
      if (url.pathname !== '/.netlify/functions/music-qr') return next()
      try {
        const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await readBody(request)
        const result = await musicQrHandler(new Request(url, { method: request.method, headers: request.headers, body }))
        response.statusCode = result.status
        result.headers.forEach((value, key) => {
          if (key !== 'set-cookie') response.setHeader(key, value)
        })
        const cookies = typeof result.headers.getSetCookie === 'function' ? result.headers.getSetCookie() : []
        if (cookies.length) response.setHeader('Set-Cookie', cookies)
        response.end(Buffer.from(await result.arrayBuffer()))
      } catch (error) {
        console.error('[music-qr] Vite middleware failed', error)
        response.statusCode = 502
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ status: 'failed', message: '扫码登录服务暂时不可用' }))
      }
    })
  }
})

