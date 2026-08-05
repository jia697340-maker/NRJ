const fs = require('fs');
const path = require('path');

const dirsToScan = [
  'src/components',
  'src/components/chat',
  'src/components/worldbook',
  'src/components/profile'
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Background replacements
  content = content.replace(/background(-color)?:\s*(#ffffff|#fff|white|#FFFFFF|#FFF)(;|\s|\!|\}|,)/g, 'background$1: var(--sys-bg-secondary)$3');
  content = content.replace(/background(-color)?:\s*(#f3f4f6|#f0f0f0|#f5f5f5|#f7f7f7|#f9f9f9|#fafafa|#eee|#eeeeee|#e5e5e5|#eef0f3)(;|\s|\!|\}|,)/g, 'background$1: var(--sys-bg-primary)$3');
  
  // Text color replacements
  content = content.replace(/color:\s*(#333333|#333|#111111|#111|#000000|#000|#1f2937|#111827|black|#1c1c1e)(;|\s|\!|\}|,)/g, 'color: var(--text-primary)$2');
  content = content.replace(/color:\s*(#666666|#666|#555555|#555|#444444|#444|#4b5563|#374151)(;|\s|\!|\}|,)/g, 'color: var(--text-secondary)$2');
  content = content.replace(/color:\s*(#999999|#999|#888888|#888|#aaaaaa|#aaa|#9ca3af|#6b7280|#8e8e93|#bbbbbb)(;|\s|\!|\}|,)/g, 'color: var(--text-tertiary)$2');
  
  // Border color replacements - careful with 1px solid #ddd
  // Using a replacer function for borders
  content = content.replace(/border(-color|-bottom|-bottom-color|-top|-top-color|-left|-left-color|-right|-right-color)?:\s*([^;\}]+)/g, (match, p1, p2) => {
    let replaced = p2
      .replace(/#ddd|#dddddd|#d1d5db|#e5e5ea|#eee|#eeeeee|#f0f0f0|#cccccc|#ccc/gi, 'var(--border-color)')
      .replace(/rgba\(0,\s*0,\s*0,\s*0\.[0-9]+\)/g, 'var(--border-color)'); // Also replace rgba black borders with var(--border-color)
    return `border${p1 || ''}: ${replaced}`;
  });

  // Also replace rgba black backgrounds with var(--border-color) or similar if they are used as dividers, but let's stick to rgba for borders only for now.

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', filePath);
  }
}

dirsToScan.forEach(dir => {
  const fullDir = path.join(__dirname, '..', dir);
  if (fs.existsSync(fullDir)) {
    fs.readdirSync(fullDir).forEach(file => {
      const fullPath = path.join(fullDir, file);
      if (fs.statSync(fullPath).isFile() && (file.endsWith('.vue') || file.endsWith('.css'))) {
        processFile(fullPath);
      }
    });
  }
});
