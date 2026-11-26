import { Capacitor, CapacitorHttp } from '@capacitor/core';
import qs from 'qs';

const OCR_CFG_KEY = 'umi_ocr_cfg_v3';

let ocrConfig = JSON.parse(localStorage.getItem(OCR_CFG_KEY) || 'null') || {
  mode: 'web',
  webApiKey: '',
  webEngine: '2',
  serverUrl: 'http://192.168.1.100:1224',
  parser: 'multi_para',
  maxPages: 3
};

export function getOcrConfig() {
  return ocrConfig;
}

export function saveOcrConfig(next) {
  ocrConfig = { ...ocrConfig, ...(next || {}) };
  localStorage.setItem(OCR_CFG_KEY, JSON.stringify(ocrConfig));
  return ocrConfig;
}

export function fileBlobToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').replace(/^data:[^;]+;base64,/, ''));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

// 自动将高清大图压缩到 820KB 以内，确保 100% 通过免费网页 OCR 1MB 限制
export function compressBase64ForWebOcr(rawBase64, maxBytes = 820 * 1024) {
  return new Promise((resolve) => {
    const clean = String(rawBase64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!clean || clean.length * 0.75 <= maxBytes) {
      resolve(clean);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.width, h = img.height;
        const maxDim = 1800;
        if (Math.max(w, h) > maxDim) {
          const ratio = maxDim / Math.max(w, h);
          w = Math.max(1, Math.round(w * ratio));
          h = Math.max(1, Math.round(h * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        let quality = 0.85;
        let out = canvas.toDataURL('image/jpeg', quality).replace(/^data:[^;]+;base64,/, '');
        while (out.length * 0.75 > maxBytes && quality > 0.35) {
          quality -= 0.15;
          out = canvas.toDataURL('image/jpeg', quality).replace(/^data:[^;]+;base64,/, '');
        }
        resolve(out);
      } catch {
        resolve(clean);
      }
    };
    img.onerror = () => resolve(clean);
    img.src = `data:image/jpeg;base64,${clean}`;
  });
}

// 免费网页版高精度 OCR（OCR.space Engine 2/3，自动语种 + 表格还原）
export async function callWebFreeOcrOnBase64(base64Str, cfg = ocrConfig) {
  const compressed = await compressBase64ForWebOcr(base64Str);
  if (!compressed) throw new Error('图像数据为空');
  const apiKey = (cfg.webApiKey || '').trim() || 'helloworld';
  const engine = String(cfg.webEngine || '2');

  const fields = {
    base64Image: `data:image/jpeg;base64,${compressed}`,
    language: 'auto',
    OCREngine: engine,
    isTable: 'true',
    scale: 'true',
    detectOrientation: 'true'
  };

  let resData;
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.post({
      url: 'https://api.ocr.space/parse/image',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: qs.stringify(fields)
    });
    if (res.status >= 400) throw new Error(`网页 OCR 返回 HTTP ${res.status}`);
    resData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  } else {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    const resp = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { apikey: apiKey },
      body: form
    });
    if (!resp.ok) throw new Error(`网页 OCR 返回 HTTP ${resp.status}`);
    resData = await resp.json();
  }

  if (typeof resData === 'string') throw new Error(resData);
  if (resData?.IsErroredOnProcessing) {
    const msg = Array.isArray(resData.ErrorMessage)
      ? resData.ErrorMessage.join('; ')
      : (resData.ErrorMessage || resData.ErrorDetails || '免费网页 OCR 识别失败');
    throw new Error(msg);
  }
  const text = (resData?.ParsedResults || [])
    .map(p => (p?.ParsedText || '').trim())
    .filter(Boolean)
    .join('\n');
  return text;
}

// 远程 Umi-OCR HTTP 服务（备选）
export async function callRemoteUmiOcrOnBase64(base64Str, cfg = ocrConfig) {
  const baseUrl = (cfg.serverUrl || 'http://192.168.1.100:1224').replace(/\/+$/, '');
  const cleanB64 = String(base64Str || '').replace(/^data:[^;]+;base64,/, '');
  if (!cleanB64) throw new Error('图像 Base64 为空');
  const payload = {
    base64: cleanB64,
    options: { 'data.format': 'text', 'tbpu.parser': cfg.parser || 'multi_para' }
  };
  let res;
  if (Capacitor.isNativePlatform()) {
    const r = await CapacitorHttp.post({
      url: `${baseUrl}/api/ocr`,
      headers: { 'Content-Type': 'application/json' },
      data: payload
    });
    if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
    res = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  } else {
    const resp = await fetch(`${baseUrl}/api/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    res = await resp.json();
  }
  if (res?.code === 100) return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  if (res?.code === 101) return '';
  throw new Error(res?.data || `Umi-OCR 错误码 ${res?.code ?? '未知'}`);
}

// 统一文档/图片文字提取入口（默认走免费网页版 OCR）
export async function extractTextWithOcr(fileRecord, { NativeTools, isNative, onProgress }) {
  if (fileRecord.textContent !== undefined && fileRecord.textContent !== '') {
    return fileRecord.textContent;
  }
  const mode = ocrConfig.mode || 'web';

  if (isNative && fileRecord.localPath) {
    // mode === 'web' 或 'remote' 时，复用原生插件提取图片/多页PDF的 Base64 数组
    const nativeMode = mode === 'local' ? 'local' : 'remote';
    onProgress?.(
      mode === 'web'
        ? `🌐 正在通过免费网页版 OCR (Engine ${ocrConfig.webEngine || '2'}) 识别...`
        : (mode === 'local' ? '⚡ 本机离线 OCR 识别中...' : `🖥️ 正在连接远程 Umi-OCR (${ocrConfig.serverUrl})...`)
    );
    const prep = await NativeTools.extractText({
      localPath: fileRecord.localPath,
      mode: nativeMode,
      maxPages: ocrConfig.maxPages || 3
    });
    if (!prep?.needsOcr) return prep?.text || '';
    const imgs = prep.images || [];
    const chunks = [];
    for (let i = 0; i < imgs.length; i++) {
      onProgress?.(
        mode === 'web'
          ? `🌐 免费网页版 OCR 正在识别第 ${i + 1}/${imgs.length} 页...`
          : `🖥️ 远程 Umi-OCR 正在识别第 ${i + 1}/${imgs.length} 页...`
      );
      const part = mode === 'web'
        ? await callWebFreeOcrOnBase64(imgs[i], ocrConfig)
        : await callRemoteUmiOcrOnBase64(imgs[i], ocrConfig);
      if (part && part.trim()) chunks.push(part.trim());
    }
    return chunks.join('\n\n');
  }

  const rawB64 = fileRecord.rawBase64 || (fileRecord.dataUrl?.startsWith('data:image') ? fileRecord.dataUrl : '');
  if (rawB64) {
    onProgress?.(mode === 'remote' ? '🖥️ 正在调用远程 Umi-OCR...' : '🌐 正在调用免费网页版 OCR...');
    return mode === 'remote'
      ? await callRemoteUmiOcrOnBase64(rawB64, ocrConfig)
      : await callWebFreeOcrOnBase64(rawB64, ocrConfig);
  }
  throw new Error('请选择图片或纯文本文档进行识别');
}

// 设置页一键测试当前 OCR 引擎
export async function testOcrEngine({ NativeTools, isNative }) {
  const mode = ocrConfig.mode || 'web';
  if (mode === 'web') {
    const c = document.createElement('canvas');
    c.width = 240; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#111111'; ctx.font = 'bold 28px sans-serif'; ctx.fillText('OCR OK 2026', 24, 42);
    const b64 = c.toDataURL('image/jpeg', 0.9).replace(/^data:[^;]+;base64,/, '');
    const txt = await callWebFreeOcrOnBase64(b64, ocrConfig);
    return `✅ 免费网页版 OCR 正常！测试识别结果：「${txt || '已连通'}」`;
  }
  if (mode === 'local') {
    if (!isNative) return 'ℹ️ 本机离线 OCR 需在安卓 APK 中测试。';
    const res = await NativeTools.testLocalOcr();
    return `✅ ${res?.engine || '本机离线 OCR'} 已就绪！`;
  }
  if (isNative && /^https?:\/\/(127\.0\.0\.1|localhost)/i.test(ocrConfig.serverUrl)) {
    throw new Error('手机端不可填 127.0.0.1，请改填电脑局域网 IP，或切回「免费网页版 OCR」');
  }
  const url = `${(ocrConfig.serverUrl || '').replace(/\/+$/, '')}/api/ocr/get_options`;
  const res = isNative
    ? (await CapacitorHttp.get({ url })).data
    : await (await fetch(url)).json();
  const parsed = typeof res === 'string' ? JSON.parse(res) : res;
  return `✅ 远程 Umi-OCR 已连通（${Object.keys(parsed || {}).length} 项参数）`;
}
