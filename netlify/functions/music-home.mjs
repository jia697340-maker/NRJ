export default async () => {
  const endpoint = `https://music.163.com/api/personalized/playlist?limit=18&timestamp=${Date.now()}`
  try {
    const response = await fetch(endpoint, {
      cache: 'no-store',
      headers: { Referer: 'https://music.163.com/' }
    })
    if (!response.ok) return Response.json({ code: response.status, result: [] }, { status: 502 })
    const data = await response.json()
    return Response.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache'
      }
    })
  } catch {
    return Response.json({ code: 502, result: [] }, { status: 502 })
  }
}
