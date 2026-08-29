/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { FileGenerationPayload, GeneratedFileFormat } from '../types/chatAssets'

const MIME: Record<GeneratedFileFormat, string> = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8', txt: 'text/plain;charset=utf-8', md: 'text/markdown;charset=utf-8',
  html: 'text/html;charset=utf-8', rtf: 'application/rtf', json: 'application/json;charset=utf-8',
  xml: 'application/xml;charset=utf-8', yaml: 'application/yaml;charset=utf-8', zip: 'application/zip',
  js: 'text/javascript;charset=utf-8', ts: 'text/typescript;charset=utf-8', py: 'text/x-python;charset=utf-8',
  java: 'text/x-java-source;charset=utf-8', css: 'text/css;charset=utf-8', vue: 'text/plain;charset=utf-8'
}

const safeFileStem = (value: string) => (String(value || '角色生成文件').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim() || '角色生成文件').slice(0, 120)
const safeZipPath = (value: string, index: number) => {
  const segments = String(value || `file-${index + 1}.txt`).replace(/\\/g, '/').split('/').filter(segment => segment && segment !== '.' && segment !== '..')
  return segments.map(segment => segment.replace(/[:*?"<>|\u0000-\u001f]/g, '_')).join('/').slice(0, 240) || `file-${index + 1}.txt`
}
const textContent = (payload: FileGenerationPayload) => payload.content || (payload.sections || []).map(section => `${section.title}\n${section.content || ''}${section.bullets?.length ? `\n${section.bullets.map(item => `- ${item}`).join('\n')}` : ''}`).join('\n\n') || payload.title
const normalizePayload = (payload: FileGenerationPayload) => ({ ...payload, title: String(payload.title || '角色生成文件').trim().slice(0, 200), content: payload.content == null ? '' : String(payload.content), sections: Array.isArray(payload.sections) ? payload.sections.slice(0, 80).map(section => ({ title: String(section?.title || '').slice(0, 200), content: String(section?.content || ''), bullets: Array.isArray(section?.bullets) ? section.bullets.map(String).slice(0, 100) : [] })) : [], rows: Array.isArray(payload.rows) ? payload.rows.slice(0, 10000) : [], files: Array.isArray(payload.files) ? payload.files.slice(0, 200).map((file, index) => ({ name: safeZipPath(file?.name, index), content: String(file?.content || '') })) : [] })

const createPptx = async (payload: ReturnType<typeof normalizePayload>) => {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'NRJ'
  pptx.subject = payload.title
  pptx.title = payload.title
  pptx.company = 'NRJ'
  pptx.theme = { headFontFace: 'Microsoft YaHei', bodyFontFace: 'Microsoft YaHei' }
  const titleSlide = pptx.addSlide()
  titleSlide.background = { color: 'F6F3EC' }
  titleSlide.addText(payload.title, { x: 0.8, y: 2.35, w: 11.7, h: 1.1, fontFace: 'Microsoft YaHei', fontSize: 30, bold: true, color: '252525', align: 'center', margin: 0.05, fit: 'shrink' })
  const sections = payload.sections.length ? payload.sections : [{ title: '内容', content: payload.content, bullets: [] }]
  for (const section of sections) {
    const slide = pptx.addSlide()
    slide.background = { color: 'FBFAF7' }
    slide.addText(section.title || '内容', { x: 0.7, y: 0.45, w: 11.9, h: 0.6, fontFace: 'Microsoft YaHei', fontSize: 23, bold: true, color: '252525', margin: 0 })
    const parts = [section.content, ...(section.bullets || []).map(item => `• ${item}`)].filter(Boolean)
    slide.addText(parts.join('\n'), { x: 0.9, y: 1.35, w: 11.5, h: 5.25, fontFace: 'Microsoft YaHei', fontSize: 17, color: '3D3D3D', breakLine: false, valign: 'top', margin: 0.08, fit: 'shrink', paraSpaceAfter: 10 })
  }
  const result = await pptx.write({ outputType: 'blob' })
  return result instanceof Blob ? result : new Blob([result as BlobPart], { type: MIME.pptx })
}

const createDocx = async (payload: ReturnType<typeof normalizePayload>) => {
  const { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun } = await import('docx')
  const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [new Paragraph({ text: payload.title, heading: HeadingLevel.TITLE })]
  if (payload.sections.length) {
    payload.sections.forEach(section => {
      children.push(new Paragraph({ text: section.title || '内容', heading: HeadingLevel.HEADING_1 }))
      if (section.content) children.push(new Paragraph({ children: [new TextRun(section.content)] }))
      section.bullets.forEach(item => children.push(new Paragraph({ text: item, bullet: { level: 0 } })))
    })
  } else if (payload.content) children.push(new Paragraph({ children: [new TextRun(payload.content)] }))
  if (payload.rows.length) {
    const headers = Array.from(new Set(payload.rows.flatMap(row => Object.keys(row))))
    children.push(new Table({ rows: [new TableRow({ children: headers.map(header => new TableCell({ children: [new Paragraph({ text: header })] })) }), ...payload.rows.map(row => new TableRow({ children: headers.map(header => new TableCell({ children: [new Paragraph({ text: String(row[header] ?? '') })] })) }))] }))
  }
  return Packer.toBlob(new Document({ sections: [{ properties: {}, children }] }))
}

const createXlsx = async (payload: ReturnType<typeof normalizePayload>) => {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'NRJ'
  const sheet = workbook.addWorksheet((payload.title || '数据').slice(0, 31))
  if (payload.rows.length) {
    const headers = Array.from(new Set(payload.rows.flatMap(row => Object.keys(row))))
    sheet.columns = headers.map(header => ({ header, key: header, width: Math.min(40, Math.max(12, header.length + 4)) }))
    payload.rows.forEach(row => sheet.addRow(row))
    sheet.getRow(1).font = { bold: true }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: Math.max(1, headers.length) } }
  } else {
    sheet.addRow([payload.title])
    textContent(payload).split(/\r?\n/).forEach(line => sheet.addRow([line]))
    sheet.getColumn(1).width = 80
  }
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: MIME.xlsx })
}

const wrapCanvasText = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const lines: string[] = []
  for (const paragraph of String(text).split(/\r?\n/)) {
    let line = ''
    for (const character of paragraph || ' ') {
      if (context.measureText(line + character).width > maxWidth && line) { lines.push(line); line = character } else line += character
    }
    lines.push(line)
  }
  return lines
}

const canvasBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PDF 页面渲染失败')), 'image/png'))

const createPdf = async (payload: ReturnType<typeof normalizePayload>) => {
  if (typeof document === 'undefined') throw new Error('当前环境无法生成带中文排版的 PDF')
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const width = 1240; const height = 1754; const margin = 100; const lineHeight = 40
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前设备无法创建 PDF 绘图上下文')
  const source = `${payload.title}\n\n${textContent(payload)}`
  context.font = '28px "Microsoft YaHei", "PingFang SC", sans-serif'
  const lines = wrapCanvasText(context, source, width - margin * 2)
  const perPage = Math.max(1, Math.floor((height - margin * 2) / lineHeight))
  for (let offset = 0; offset < lines.length; offset += perPage) {
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height)
    context.fillStyle = '#222222'; context.font = '28px "Microsoft YaHei", "PingFang SC", sans-serif'; context.textBaseline = 'top'
    lines.slice(offset, offset + perPage).forEach((line, index) => context.fillText(line, margin, margin + index * lineHeight))
    const png = await pdf.embedPng(await (await canvasBlob(canvas)).arrayBuffer())
    const page = pdf.addPage([595.28, 841.89])
    page.drawImage(png, { x: 0, y: 0, width: 595.28, height: 841.89 })
  }
  const bytes = await pdf.save()
  return new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: MIME.pdf })
}

const csvValue = (value: unknown) => {
  const text = String(value ?? '')
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}
const createCsv = (payload: ReturnType<typeof normalizePayload>) => {
  if (!payload.rows.length) return `\uFEFF${csvValue(payload.title)}\r\n${textContent(payload).split(/\r?\n/).map(csvValue).join('\r\n')}`
  const headers = Array.from(new Set(payload.rows.flatMap(row => Object.keys(row))))
  return `\uFEFF${headers.map(csvValue).join(',')}\r\n${payload.rows.map(row => headers.map(header => csvValue(row[header])).join(',')).join('\r\n')}`
}
const rtfEscape = (value: string) => Array.from(value).map(character => {
  const code = character.charCodeAt(0)
  if (character === '\\' || character === '{' || character === '}') return `\\${character}`
  return code > 127 ? `\\u${code > 32767 ? code - 65536 : code}?` : character
}).join('').replace(/\r?\n/g, '\\par\n')

const createStructuredText = async (format: GeneratedFileFormat, payload: ReturnType<typeof normalizePayload>) => {
  if (format === 'json') return JSON.stringify(payload.rows.length ? payload.rows : { title: payload.title, content: payload.content, sections: payload.sections }, null, 2)
  if (format === 'yaml') {
    const { stringify } = await import('yaml')
    return stringify(payload.rows.length ? payload.rows : { title: payload.title, content: payload.content, sections: payload.sections })
  }
  if (format === 'xml') {
    const escape = (value: string) => value.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<?xml version="1.0" encoding="UTF-8"?>\n<document><title>${escape(payload.title)}</title><content>${escape(textContent(payload))}</content></document>`
  }
  if (format === 'html') return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${payload.title.replace(/[<&]/g, '')}</title></head><body><h1>${payload.title.replace(/[<&]/g, '')}</h1><pre>${textContent(payload).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre></body></html>`
  if (format === 'rtf') return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Microsoft YaHei;}}\\f0\\fs24 ${rtfEscape(`${payload.title}\n\n${textContent(payload)}`)}}`
  return textContent(payload)
}

const validateGenerated = async (format: GeneratedFileFormat, blob: Blob) => {
  if (!blob.size) throw new Error('生成结果为空')
  const buffer = await blob.arrayBuffer()
  if (['pptx', 'docx', 'zip'].includes(format)) {
    const { default: JSZip } = await import('jszip')
    await JSZip.loadAsync(buffer)
  } else if (format === 'xlsx') {
    const { default: ExcelJS } = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
  } else if (format === 'pdf') {
    const { PDFDocument } = await import('pdf-lib')
    const pdf = await PDFDocument.load(buffer)
    if (!pdf.getPageCount()) throw new Error('PDF 没有有效页面')
  }
  else if (format === 'json') JSON.parse(await blob.text())
  else if (format === 'yaml') {
    const { parse } = await import('yaml')
    parse(await blob.text())
  }
  else if (format === 'xml') {
    const text = await blob.text()
    if (typeof DOMParser !== 'undefined') {
      const parsed = new DOMParser().parseFromString(text, 'application/xml')
      if (parsed.querySelector('parsererror')) throw new Error('XML 生成结果无法解析')
    } else if (!/^<\?xml[\s\S]*<document>[\s\S]*<\/document>\s*$/i.test(text)) throw new Error('XML 生成结果无法解析')
  }
}

export const parseFileGenerationPayload = (body: string, format: GeneratedFileFormat, title: string): FileGenerationPayload => {
  try {
    const parsed = JSON.parse(body)
    if (parsed && typeof parsed === 'object') return { ...parsed, format, title: String(parsed.title || title || '角色生成文件') }
  } catch { /* 纯文本正文是合法降级输入。 */ }
  return { format, title: title || '角色生成文件', content: body }
}

export const generateFileBlob = async (rawPayload: FileGenerationPayload) => {
  const payload = normalizePayload(rawPayload)
  const format = rawPayload.format
  let blob: Blob
  if (format === 'pptx') blob = await createPptx(payload)
  else if (format === 'docx') blob = await createDocx(payload)
  else if (format === 'xlsx') blob = await createXlsx(payload)
  else if (format === 'pdf') blob = await createPdf(payload)
  else if (format === 'zip') {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    const files = payload.files.length ? payload.files : [{ name: `${safeFileStem(payload.title)}.txt`, content: textContent(payload) }]
    files.forEach(file => zip.file(file.name, file.content))
    blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 }, mimeType: MIME.zip })
  } else {
    const content = format === 'csv' ? createCsv(payload) : await createStructuredText(format, payload)
    blob = new Blob([content], { type: MIME[format] })
  }
  await validateGenerated(format, blob)
  return { blob: blob.type ? blob : new Blob([blob], { type: MIME[format] }), name: `${safeFileStem(payload.title)}.${format}`, mimeType: MIME[format] }
}
