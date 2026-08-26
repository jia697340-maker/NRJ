/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
export const optimizeImageFile = async (file: File, maxDimension = 1024, quality = .88): Promise<Blob> => {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} 不是可识别的图片文件。`)
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') return file
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error(`${file.name} 图片解码失败，请重试或更换图片格式。`) })
  try {
    const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * ratio)); const height = Math.max(1, Math.round(bitmap.height * ratio))
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d'); if (!context) throw new Error('浏览器无法创建图片优化画布。')
    context.drawImage(bitmap, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(`${file.name} 转换 WebP 失败。`)), 'image/webp', quality))
  } finally { bitmap.close() }
}
