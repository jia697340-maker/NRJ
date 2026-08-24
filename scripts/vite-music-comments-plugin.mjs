import musicCommentsHandler from '../netlify/functions/music-comments.mjs'

export const musicCommentsDevPlugin = () => ({
  name: 'nrj-public-music-comments',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`)
      if (url.pathname !== '/.netlify/functions/music-comments') return next()
      try {
        const result = await musicCommentsHandler(new Request(url, {
          method: request.method,
          headers: request.headers
        }))
        response.statusCode = result.status
        result.headers.forEach((value, key) => response.setHeader(key, value))
        response.end(Buffer.from(await result.arrayBuffer()))
      } catch (error) {
        console.error('[music-comments] Vite middleware failed', error)
        response.statusCode = 502
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ code: 502, msg: '评论暂时无法加载，请稍后重试' }))
      }
    })
  }
})

