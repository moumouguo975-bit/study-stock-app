import { Capacitor, CapacitorHttp } from '@capacitor/core';

const PANDA_CFG_KEY = 'panda_pet_cfg_v1';
const PANDA_CHAT_KEY = 'panda_pet_chat_v1';

const API_PRESETS = {
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  siliconflow: { label: '硅基流动 (免费额度)', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
  qwen: { label: '通义千问 DashScope', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  zhipu: { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  custom: { label: '自定义 OpenAI 兼容接口', baseUrl: '', model: '' }
};

let pandaCfg = JSON.parse(localStorage.getItem(PANDA_CFG_KEY) || 'null') || {
  visible: true,
  preset: 'deepseek',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  apiKey: '',
  useAppContext: true,
  dockSide: 'right',
  docked: true,
  topPct: 68
};

let pandaHistory = JSON.parse(localStorage.getItem(PANDA_CHAT_KEY) || '[]');
let ctxHooks = {
  getContextSummary: () => '',
  showToast: () => {},
  openModal: () => {},
  closeModal: () => {}
};

export function getPandaConfig() {
  return pandaCfg;
}

export function savePandaConfig(patch) {
  pandaCfg = { ...pandaCfg, ...(patch || {}) };
  localStorage.setItem(PANDA_CFG_KEY, JSON.stringify(pandaCfg));
  applyPandaPositionAndState();
  return pandaCfg;
}

export function setPandaVisible(visible) {
  savePandaConfig({ visible: !!visible });
}

function getPandaEl() {
  return document.getElementById('pandaPet');
}

function applyPandaPositionAndState() {
  const el = getPandaEl();
  if (!el) return;
  el.style.display = pandaCfg.visible ? 'flex' : 'none';
  if (!pandaCfg.visible) return;

  const vh = window.innerHeight || 720;
  const vw = window.innerWidth || 360;
  const topPx = Math.max(72, Math.min(vh - 140, (pandaCfg.topPct / 100) * vh));
  el.style.top = `${topPx.toFixed(0)}px`;

  el.classList.remove('dock-left', 'dock-right', 'dock-hidden');
  if (pandaCfg.dockSide === 'left') {
    el.style.left = '8px';
    el.style.right = 'auto';
    el.classList.add('dock-left');
  } else {
    el.style.left = `${Math.max(8, vw - 64)}px`;
    el.style.right = 'auto';
    el.classList.add('dock-right');
  }
  if (pandaCfg.docked) {
    el.classList.add('dock-hidden');
  }
}

async function callPandaLLM(userText) {
  const key = (pandaCfg.apiKey || '').trim();
  if (!key) throw new Error('请先为小熊猫设置 API Key！');
  const baseUrl = (pandaCfg.baseUrl || 'https://api.deepseek.com/v1').trim().replace(/\/+$/, '');
  const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
  const model = (pandaCfg.model || 'deepseek-chat').trim();

  const sysLines = [
    '你是“学财助手 Pro”里一只聪明、温暖又有点可爱的 AI 小熊猫助手，回答简洁清晰、实用贴心。'
  ];
  if (pandaCfg.useAppContext) {
    const appCtx = ctxHooks.getContextSummary?.() || '';
    if (appCtx) sysLines.push(`以下是用户当前的 App 实时信息（仅在相关时自然引用）：\n${appCtx}`);
  }

  const messages = [
    { role: 'system', content: sysLines.join('\n') },
    ...pandaHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userText }
  ];

  const payload = { model, messages, temperature: 0.7 };
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`
  };

  let data;
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.post({ url: endpoint, headers, data: payload });
    if (res.status >= 400) {
      const errTxt = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      throw new Error(`HTTP ${res.status}: ${errTxt.slice(0, 140)}`);
    }
    data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  } else {
    const resp = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 140)}`);
    data = await resp.json();
  }

  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error('模型未返回有效回复，请检查模型名与接口地址');
  return String(reply).trim();
}

export function openPandaConfigModal() {
  const box = document.createElement('div');
  const presetOpts = Object.entries(API_PRESETS)
    .map(([k, v]) => `<option value="${k}" ${pandaCfg.preset === k ? 'selected' : ''}>${v.label}</option>`)
    .join('');

  box.innerHTML = `
    <div class="sub-text" style="margin-bottom:8px;">
      支持所有 OpenAI 兼容格式大模型（DeepSeek / 硅基流动 / 通义千问 / 智谱 / OpenAI 等），Key 仅保存在你手机本地。
    </div>
    <div style="margin-bottom:8px;">
      <div style="font-size:12px; font-weight:600; margin-bottom:4px;">服务商预设</div>
      <select id="pPresetSel">${presetOpts}</select>
    </div>
    <div style="margin-bottom:8px;">
      <div style="font-size:12px; font-weight:600; margin-bottom:4px;">API Key（必填）</div>
      <input id="pApiKeyInp" type="password" placeholder="粘贴你的 sk-... API Key" value="${(pandaCfg.apiKey || '').replace(/"/g, '&quot;')}" />
    </div>
    <div style="margin-bottom:8px;">
      <div style="font-size:12px; font-weight:600; margin-bottom:4px;">接口地址 Base URL</div>
      <input id="pBaseUrlInp" placeholder="https://api.deepseek.com/v1" value="${(pandaCfg.baseUrl || '').replace(/"/g, '&quot;')}" />
    </div>
    <div style="margin-bottom:10px;">
      <div style="font-size:12px; font-weight:600; margin-bottom:4px;">模型名称 Model</div>
      <input id="pModelInp" placeholder="如 deepseek-chat / glm-4-flash" value="${(pandaCfg.model || '').replace(/"/g, '&quot;')}" />
    </div>
    <label style="display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:12px;">
      <input type="checkbox" id="pCtxChk" style="width:18px; height:18px;" ${pandaCfg.useAppContext ? 'checked' : ''} />
      <span>允许小熊猫读取今日课表与考试信息以便智能问答</span>
    </label>
    <div style="display:flex; gap:8px;">
      <button class="btn" id="pSaveCfgBtn" style="flex:1;">💾 保存并开始聊天</button>
    </div>
  `;

  box.querySelector('#pPresetSel').addEventListener('change', (e) => {
    const p = API_PRESETS[e.target.value];
    if (p && e.target.value !== 'custom') {
      box.querySelector('#pBaseUrlInp').value = p.baseUrl;
      box.querySelector('#pModelInp').value = p.model;
    }
  });

  box.querySelector('#pSaveCfgBtn').onclick = () => {
    savePandaConfig({
      preset: box.querySelector('#pPresetSel').value,
      apiKey: box.querySelector('#pApiKeyInp').value.trim(),
      baseUrl: box.querySelector('#pBaseUrlInp').value.trim() || 'https://api.deepseek.com/v1',
      model: box.querySelector('#pModelInp').value.trim() || 'deepseek-chat',
      useAppContext: box.querySelector('#pCtxChk').checked
    });
    ctxHooks.showToast('🐼 小熊猫 API 配置已保存');
    openPandaChatModal();
  };

  ctxHooks.openModal('🐼 小熊猫 AI 接口设置', box);
}

export function openPandaChatModal() {
  const box = document.createElement('div');
  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:8px; flex-wrap:wrap;">
      <span class="sub-text" style="margin:0;">当前模型：<strong>${pandaCfg.model || '未配置'}</strong> ${pandaCfg.apiKey ? '🟢' : '🔴未填Key'}</span>
      <div style="display:flex; gap:4px;">
        <button class="btn btn-sm btn-outline" id="pOpenCfgBtn">🔑 设API Key</button>
        <button class="btn btn-sm btn-danger" id="pClearChatBtn">清空</button>
      </div>
    </div>
    <div class="day-tabs" style="margin-bottom:6px;">
      <button class="day-pill p-quick" data-q="今天我有哪些课？给我个学习建议">📅 今日课表</button>
      <button class="day-pill p-quick" data-q="最近有哪些考试或日程？帮我列个复习计划">🎯 考试规划</button>
      <button class="day-pill p-quick" data-q="给我讲一个轻松简短的笑话放松一下">🎋 放松一下</button>
    </div>
    <div id="pandaChatLog" style="min-height:200px; max-height:46vh; overflow-y:auto; padding:8px; border-radius:10px; background:var(--card-sub); border:1px solid var(--border); margin-bottom:8px;"></div>
    <div class="search-row" style="margin-bottom:0;">
      <input id="pandaPromptInp" placeholder="和小熊猫说点什么..." />
      <button class="btn btn-sm" id="pandaSendBtn" style="white-space:nowrap;">发送</button>
    </div>
  `;

  const logEl = box.querySelector('#pandaChatLog');
  const inpEl = box.querySelector('#pandaPromptInp');
  const sendBtn = box.querySelector('#pandaSendBtn');

  const renderChat = () => {
    if (!pandaHistory.length) {
      logEl.innerHTML = `<div class="sub-text" style="text-align:center; padding:26px 8px;">🐼 你好呀！我是你的小熊猫学习搭子～<br/>${pandaCfg.apiKey ? '直接发消息或点上方快捷问题聊聊吧！' : '请先点右上角 <strong>🔑 设API Key</strong> 激活对话能力。'}</div>`;
      return;
    }
    logEl.innerHTML = pandaHistory.map(m => {
      const isUser = m.role === 'user';
      return `<div style="display:flex; justify-content:${isUser ? 'flex-end' : 'flex-start'}; margin-bottom:8px;">
        <div style="max-width:86%; padding:8px 10px; border-radius:12px; font-size:13px; line-height:1.55; white-space:pre-wrap; word-break:break-word; background:${isUser ? 'var(--primary)' : 'var(--card)'}; color:${isUser ? '#fff' : 'var(--text)'}; border:1px solid var(--border);">${(m.content || '').replace(/</g, '&lt;')}</div>
      </div>`;
    }).join('');
    logEl.scrollTop = logEl.scrollHeight;
  };

  renderChat();

  const sendMessage = async (textRaw) => {
    const q = (textRaw ?? inpEl.value).trim();
    if (!q) return;
    if (!pandaCfg.apiKey) {
      ctxHooks.showToast('🔑 请先配置小熊猫 API Key');
      openPandaConfigModal();
      return;
    }
    inpEl.value = '';
    pandaHistory.push({ role: 'user', content: q });
    renderChat();
    sendBtn.disabled = true;
    sendBtn.textContent = '思考中...';
    try {
      const reply = await callPandaLLM(q);
      pandaHistory.push({ role: 'assistant', content: reply });
      pandaHistory = pandaHistory.slice(-30);
      localStorage.setItem(PANDA_CHAT_KEY, JSON.stringify(pandaHistory));
      renderChat();
    } catch (e) {
      pandaHistory.push({ role: 'assistant', content: `❌ 对话失败：${e.message}` });
      renderChat();
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = '发送';
    }
  };

  sendBtn.onclick = () => sendMessage();
  inpEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
  box.querySelectorAll('.p-quick').forEach(b => b.addEventListener('click', () => sendMessage(b.dataset.q)));
  box.querySelector('#pOpenCfgBtn').onclick = openPandaConfigModal;
  box.querySelector('#pClearChatBtn').onclick = () => {
    pandaHistory = [];
    localStorage.setItem(PANDA_CHAT_KEY, '[]');
    renderChat();
  };

  ctxHooks.openModal('🐼 AI 小熊猫助手', box);
}

export function initPandaPet(hooks) {
  ctxHooks = { ...ctxHooks, ...(hooks || {}) };
  const el = getPandaEl();
  if (!el) return;

  applyPandaPositionAndState();
  window.addEventListener('resize', applyPandaPositionAndState);

  let dragging = false, moved = false;
  let startX = 0, startY = 0, origLeft = 0, origTop = 0;

  const onStart = (cx, cy) => {
    const r = el.getBoundingClientRect();
    dragging = true; moved = false;
    startX = cx; startY = cy;
    origLeft = r.left; origTop = r.top;
    el.classList.add('dragging');
    el.classList.remove('dock-hidden');
  };

  const onMove = (cx, cy) => {
    if (!dragging) return;
    const dx = cx - startX, dy = cy - startY;
    if (Math.hypot(dx, dy) > 8) moved = true;
    if (!moved) return;
    const vw = window.innerWidth || 360, vh = window.innerHeight || 720;
    const nextL = Math.max(-10, Math.min(vw - 46, origLeft + dx));
    const nextT = Math.max(66, Math.min(vh - 126, origTop + dy));
    el.style.left = `${nextL}px`;
    el.style.top = `${nextT}px`;
  };

  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    const vw = window.innerWidth || 360, vh = window.innerHeight || 720;
    const r = el.getBoundingClientRect();

    if (!moved) {
      // 吸附半隐藏状态点一下先滑出；展开状态点一下打开聊天窗
      if (pandaCfg.docked) {
        savePandaConfig({ docked: false });
        ctxHooks.showToast('🐼 点我开始对话，拖到边缘可吸附隐藏', 1600);
      } else {
        openPandaChatModal();
      }
      return;
    }

    const centerX = r.left + r.width / 2;
    const nearLeft = r.left <= 48;
    const nearRight = (vw - r.right) <= 48;
    const dockSide = centerX < vw / 2 ? 'left' : 'right';
    const shouldHide = nearLeft || nearRight;
    const topPct = Math.round((Math.max(72, Math.min(vh - 140, r.top)) / vh) * 100);

    savePandaConfig({ dockSide, docked: shouldHide, topPct });
    if (shouldHide) ctxHooks.showToast('🐼 已贴边隐藏，轻点即可唤出', 1400);
  };

  el.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    const t = e.touches[0];
    if (t) onStart(t.clientX, t.clientY);
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    e.stopPropagation();
    e.preventDefault();
    const t = e.touches[0];
    if (t) onMove(t.clientX, t.clientY);
  }, { passive: false });
  el.addEventListener('touchend', (e) => { e.stopPropagation(); onEnd(); }, { passive: true });
  el.addEventListener('touchcancel', () => { dragging = false; applyPandaPositionAndState(); }, { passive: true });

  // 兼容桌面鼠标预览拖拽
  el.addEventListener('mousedown', (e) => { e.stopPropagation(); onStart(e.clientX, e.clientY); });
  window.addEventListener('mousemove', (e) => { if (dragging) onMove(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (dragging) onEnd(); });
}
