import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const WARNING_TEXT = '/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */\n'

function walkDir(dir) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      walkDir(fullPath)
    } else {
      if (['.ts', '.js', '.vue', '.css'].includes(path.extname(fullPath))) {
        let content = fs.readFileSync(fullPath, 'utf8')
        // 处理 vue 文件的 <style> 和 <template> 等不在第一行的问题，简单粗暴加在第一行就行，vue 会识别
        if (!content.startsWith(WARNING_TEXT)) {
          // 为了不破坏单行 vue 文件，直接 prepend
          content = WARNING_TEXT + content
          fs.writeFileSync(fullPath, content, 'utf8')
          console.log(`Added warning to ${fullPath}`)
        }
      }
    }
  }
}

walkDir(path.join(__dirname, '../src'))
console.log('Done!')
