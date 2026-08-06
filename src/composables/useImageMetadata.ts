/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export interface ImageMetadataResult {
  isPng: boolean
  raw: Record<string, string>
  novelAi: Record<string, any> | null
  error?: string
}

const decodeLatin1 = (data: Uint8Array) => new TextDecoder('latin1').decode(data)
const decodeUtf8 = (data: Uint8Array) => new TextDecoder('utf-8').decode(data)

const parseJson = (value: string) => {
  try { return JSON.parse(value) } catch { return null }
}

async function extractStealthMetadata(file: Blob): Promise<Record<string, any> | null> {
  try {
    const img = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;
    
    const width = img.width;
    const height = img.height;
    const alphaLsb = new Uint8Array(width * height);
    let idx = 0;
    // Extract Alpha channel LSB by column-major order (transpose)
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const aIndex = (y * width + x) * 4 + 3;
        alphaLsb[idx++] = data[aIndex] & 1;
      }
    }
    
    const numBytes = Math.floor(alphaLsb.length / 8);
    const bytes = new Uint8Array(numBytes);
    for (let i = 0; i < numBytes; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | alphaLsb[i * 8 + j];
      }
      bytes[i] = b;
    }
    
    let pos = 0;
    const getNextNBytes = (n: number) => {
      const res = bytes.slice(pos, pos + n);
      pos += n;
      return res;
    };
    
    const magic = "stealth_pngcomp";
    const magicBytes = getNextNBytes(magic.length);
    const readMagic = decodeUtf8(magicBytes);
    
    if (readMagic !== magic) {
      return null;
    }
    
    const lenBytes = getNextNBytes(4);
    const dataView = new DataView(lenBytes.buffer, lenBytes.byteOffset, 4);
    const readLenBits = dataView.getUint32(0, false);
    const readLen = Math.floor(readLenBits / 8);
    
    const jsonDataBytes = getNextNBytes(readLen);
    
    // NovelAI stealth data is gzipped
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(jsonDataBytes);
    writer.close();
    
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    
    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const decompressed = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      decompressed.set(c, offset);
      offset += c.length;
    }
    
    const jsonStr = decodeUtf8(decompressed);
    const parsed = JSON.parse(jsonStr);
    
    if (parsed && typeof parsed.Comment === 'string') {
      try {
        parsed.Comment = JSON.parse(parsed.Comment);
      } catch(e) {}
    }
    
    return parsed;
  } catch (e) {
    console.warn("Stealth metadata extraction failed or not present", e);
    return null;
  }
}

/** Parse A1111 WebUI parameters text into an object */
function parseWebUIParameters(text: string) {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return null;
  
  let prompt = '';
  let negativePrompt = '';
  let paramsString = '';
  
  let i = 0;
  // Positive prompt is until "Negative prompt:" or the parameters line
  while (i < lines.length) {
    if (lines[i].startsWith('Negative prompt:')) break;
    if (lines[i].includes('Steps:') && lines[i].includes('Sampler:')) break;
    prompt += lines[i] + '\n';
    i++;
  }
  
  if (i < lines.length && lines[i].startsWith('Negative prompt:')) {
    let negLine = lines[i].substring('Negative prompt:'.length).trim();
    negativePrompt += negLine + '\n';
    i++;
    while (i < lines.length) {
      if (lines[i].includes('Steps:') && lines[i].includes('Sampler:')) break;
      negativePrompt += lines[i] + '\n';
      i++;
    }
  }
  
  if (i < lines.length) {
    paramsString = lines[i];
  }
  
  const result: any = {
    input: prompt.trim(),
    negative_prompt: negativePrompt.trim(),
    Comment: {}
  };
  
  const paramPairs = paramsString.split(', ');
  for (const pair of paramPairs) {
    const splitIdx = pair.indexOf(':');
    if (splitIdx > -1) {
      const key = pair.substring(0, splitIdx).trim();
      const val = pair.substring(splitIdx + 1).trim();
      if (key === 'Steps') result.Comment.steps = parseInt(val);
      if (key === 'Sampler') result.Comment.sampler = val;
      if (key === 'CFG scale') result.Comment.scale = parseFloat(val);
      if (key === 'Seed') result.Comment.seed = parseInt(val);
      if (key === 'Size') {
        const [w, h] = val.split('x');
        result.Comment.width = parseInt(w);
        result.Comment.height = parseInt(h);
      }
    }
  }
  
  return result;
}

/** Read PNG tEXt/iTXt chunks and stealth metadata locally. No image data leaves the device. */
export const readImageMetadata = async (file: Blob): Promise<ImageMetadataResult> => {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const png = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (!png) return { isPng: false, raw: {}, novelAi: null }
  
  const raw: Record<string, string> = {}
  let at = 8
  while (at + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + at, 4).getUint32(0)
    const type = decodeLatin1(bytes.slice(at + 4, at + 8))
    const data = bytes.slice(at + 8, at + 8 + length)
    
    if (type === 'tEXt') {
      const text = decodeLatin1(data)
      const sep = text.indexOf('\0')
      if (sep > -1) raw[text.slice(0, sep)] = text.slice(sep + 1)
    } else if (type === 'iTXt') {
      let sep1 = data.indexOf(0);
      if (sep1 > -1) {
        const keyword = decodeLatin1(data.slice(0, sep1));
        const compFlag = data[sep1 + 1];
        const compMethod = data[sep1 + 2];
        let sep2 = data.indexOf(0, sep1 + 3); // lang tag
        if (sep2 !== -1) {
          let sep3 = data.indexOf(0, sep2 + 1); // trans keyword
          if (sep3 !== -1) {
            const textBytes = data.slice(sep3 + 1);
            if (compFlag === 0) {
              raw[keyword] = decodeUtf8(textBytes);
            } else if (compFlag === 1 && compMethod === 0) {
              try {
                // iTXt uses zlib (deflate in Web Streams)
                const ds = new DecompressionStream('deflate');
                const writer = ds.writable.getWriter();
                writer.write(textBytes);
                writer.close();
                const reader = ds.readable.getReader();
                const chunks: Uint8Array[] = [];
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  if (value) chunks.push(value);
                }
                const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
                const decompressed = new Uint8Array(totalLen);
                let offset = 0;
                for (const c of chunks) {
                  decompressed.set(c, offset);
                  offset += c.length;
                }
                raw[keyword] = decodeUtf8(decompressed);
              } catch (e) {
                console.warn("iTXt decompression failed", e);
              }
            }
          }
        }
      }
    }
    
    if (type === 'IEND') break
    at += length + 12
  }
  
  // Try stealth first (NovelAI stealth metadata)
  let novelAi: Record<string, any> | null = await extractStealthMetadata(file);
  
  // Fallbacks if no stealth metadata found
  if (!novelAi) {
    if (raw['parameters']) {
      novelAi = parseWebUIParameters(raw['parameters']);
    } else if (raw['Description'] || raw['Comment']) {
      let comment = parseJson(raw['Comment'] || '{}');
      if (!comment) comment = {};
      novelAi = {
        Description: raw['Description'] || '',
        Comment: comment
      };
    } else {
      const candidates = ['Comment', 'comment', 'parameters', 'Description', 'Software']
      for (const key of candidates) {
        const parsed = raw[key] && parseJson(raw[key])
        if (parsed && typeof parsed === 'object') { novelAi = parsed; break }
      }
    }
  }
  
  return { isPng: true, raw, novelAi }
}

export const metadataToGenerationParams = (metadata: Record<string, any> | null) => {
  if (!metadata) return null
  
  const desc = metadata.Description || metadata.input || metadata.prompt || '';
  const comment = metadata.Comment || metadata.parameters || metadata;
  
  const input = typeof desc === 'string' && desc.trim().length > 0 ? desc : comment.prompt || comment.input;
  if (!input) return null;
  
  return {
    input,
    negative_prompt: comment.uc || comment.negative_prompt || metadata.negative_prompt || '',
    model: metadata.model || comment.model || 'nai-diffusion-4-5-full',
    width: comment.width,
    height: comment.height,
    scale: comment.scale,
    sampler: comment.sampler,
    steps: comment.steps,
    seed: comment.seed,
    n_samples: comment.n_samples,
    noise_schedule: comment.noise_schedule
  }
}
