import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const DAYS_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// ==================== 1. 安卓本地闹钟 & 通知引擎 ====================
function makeSafeNotifId() {
  // 安卓 Java int 必须 <= 2147483647
  return Math.floor(Math.random() * 2000000000) + 1;
}

async function initNotificationChannels() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.requestPermissions();
    await LocalNotifications.createChannel({
      id: 'alarm_channel',
      name: '课表与考试强提醒闹钟',
      description: '高优先级震动响铃提醒',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: 'default'
    });
    await LocalNotifications.createChannel({
      id: 'normal_channel',
      name: '普通计划通知',
      description: '常规学习计划通知',
      importance: 3,
      vibration: true
    });
  } catch (e) {
    console.error('Init notifications error:', e);
  }
}

async function scheduleReminder({ id, title, body, atDate, weeklyWeekday, hour, minute, mode }) {
  const channelId = mode === 'alarm' ? 'alarm_channel' : 'normal_channel';

  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') {
        alert('请在手机设置中开启本应用的通知和闹钟权限！');
        return;
      }
      const schedule = weeklyWeekday !== undefined
        ? { on: { weekday: weeklyWeekday, hour, minute }, allowWhileIdle: true }
        : { at: atDate, allowWhileIdle: true };

      await LocalNotifications.schedule({
        notifications: [{
          id,
          title: (mode === 'alarm' ? '⏰ [闹钟] ' : '🔔 ') + title,
          body,
          channelId,
          schedule,
          sound: 'default'
        }]
      });
    } catch (e) {
      alert('设置提醒失败: ' + e.message);
    }
  } else {
    // 浏览器预览降级模式
    if ('Notification' in window && Notification.permission !== 'granted') {
      await Notification.requestPermission();
    }
    if (atDate) {
      const delay = atDate.getTime() - Date.now();
      if (delay > 0 && delay < 86400000) {
        setTimeout(() => alert(`${title}\n${body}`), delay);
      }
    }
  }
}

async function cancelReminder(id) {
  if (!id || !Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch (e) {
    console.warn(e);
  }
}

// 测试 5 秒闹钟
document.getElementById('testAlarmBtn').addEventListener('click', async () => {
  const target = new Date(Date.now() + 5000);
  await scheduleReminder({
    id: makeSafeNotifId(),
    title: '闹钟测试成功！',
    body: '课表与考试强提醒工作正常，祝你学习顺利！',
    atDate: target,
    mode: 'alarm'
  });
  alert('已设置 5 秒后响铃测试，可切到桌面验证安卓提醒！');
});

// ==================== 2. 底部导航与通用弹窗 ====================
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalContent = document.getElementById('modalContent');
function openModal(title, htmlOrNode) {
  modalTitle.textContent = title;
  modalContent.innerHTML = '';
  if (typeof htmlOrNode === 'string') modalContent.innerHTML = htmlOrNode;
  else modalContent.appendChild(htmlOrNode);
  modal.classList.add('open');
}
document.getElementById('closeModalBtn').addEventListener('click', () => modal.classList.remove('open'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

document.querySelectorAll('nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('headerTitle').textContent = btn.dataset.title;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${tab}`).classList.add('active');
  });
});

// ==================== 3. 课表管理 ====================
let courses = JSON.parse(localStorage.getItem('courses_v1') || '[]');
let selectedDay = new Date().getDay();

function saveCourses() {
  localStorage.setItem('courses_v1', JSON.stringify(courses));
  renderCourses();
}

function renderDayTabs() {
  const wrap = document.getElementById('dayTabs');
  wrap.innerHTML = '';
  [1, 2, 3, 4, 5, 6, 0].forEach(d => {
    const b = document.createElement('button');
    b.className = 'day-pill' + (d === selectedDay ? ' active' : '');
    b.textContent = DAYS_LABEL[d];
    b.onclick = () => { selectedDay = d; renderDayTabs(); renderCourses(); };
    wrap.appendChild(b);
  });
}

function renderCourses() {
  const list = document.getElementById('courseList');
  const filtered = courses
    .filter(c => Number(c.day) === Number(selectedDay))
    .sort((a, b) => a.start.localeCompare(b.start));

  if (!filtered.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">今天暂无排课，好好休息或自由复习吧 ✨</div>';
    return;
  }
  list.innerHTML = '';
  filtered.forEach(c => {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div>
        <div><strong>${c.name}</strong> <span class="badge ${c.mode === 'alarm' ? 'badge-alarm' : ''}">${c.mode === 'alarm' ? '⏰闹钟' : '🔔通知'}</span></div>
        <div class="sub-text">🕒 ${c.start} - ${c.end} ｜ 📍 ${c.room || '未填教室'} ｜ 提前${c.advance}分钟提醒</div>
      </div>
      <button class="btn btn-sm btn-danger">删除</button>
    `;
    div.querySelector('button').onclick = async () => {
      await cancelReminder(c.notifId);
      courses = courses.filter(x => x.id !== c.id);
      saveCourses();
    };
    list.appendChild(div);
  });
}

async function addCourseItem(item) {
  const [h, m] = item.start.split(':').map(Number);
  let totalMin = h * 60 + m - Number(item.advance || 15);
  let dayIndex = Number(item.day);
  if (totalMin < 0) {
    totalMin += 1440;
    dayIndex = (dayIndex + 6) % 7;
  }
  const remH = Math.floor(totalMin / 60);
  const remM = totalMin % 60;
  // Capacitor weekday: 1=周日, 2=周一 ... 7=周六
  const capWeekday = dayIndex + 1;
  const notifId = makeSafeNotifId();

  await scheduleReminder({
    id: notifId,
    title: `即将上课：${item.name}`,
    body: `时间 ${item.start}-${item.end}，地点：${item.room || '请查看课表'}`,
    weeklyWeekday: capWeekday,
    hour: remH,
    minute: remM,
    mode: item.mode || 'alarm'
  });

  courses.push({ ...item, id: Date.now() + Math.random(), notifId });
  saveCourses();
}

document.getElementById('addCourseBtn').addEventListener('click', async () => {
  const name = document.getElementById('cName').value.trim();
  if (!name) return alert('请输入课程名称');
  await addCourseItem({
    name,
    day: Number(document.getElementById('cDay').value),
    room: document.getElementById('cRoom').value.trim(),
    start: document.getElementById('cStart').value,
    end: document.getElementById('cEnd').value,
    advance: Number(document.getElementById('cAdvance').value),
    mode: document.getElementById('cMode').value
  });
  document.getElementById('cName').value = '';
  document.getElementById('cRoom').value = '';
  alert('课程已添加，每周定时提醒已开启！');
});

// 批量文本 / CSV 导入课表
document.getElementById('openBatchCourseBtn').addEventListener('click', () => {
  const box = document.createElement('div');
  box.innerHTML = `
    <div class="sub-text" style="margin-bottom:8px;">
      每行一节课，逗号分隔：<code>课程名,周一,08:00,09:40,教室</code>
    </div>
    <textarea id="batchCourseText" style="min-height:130px;" placeholder="高等数学,周一,08:00,09:40,A101&#10;大学英语,周三,10:00,11:40,B205"></textarea>
    <button class="btn" style="width:100%; margin-top:10px;" id="confirmBatchBtn">一键导入并设置闹钟</button>
  `;
  box.querySelector('#confirmBatchBtn').onclick = async () => {
    const raw = box.querySelector('#batchCourseText').value.trim();
    if (!raw) return;
    const dayMap = { '周日': 0, '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6 };
    let count = 0;
    for (const line of raw.split('\n')) {
      const parts = line.split(/[,，]/).map(s => s.trim());
      if (parts.length >= 3) {
        await addCourseItem({
          name: parts[0],
          day: dayMap[parts[1]] ?? 1,
          start: parts[2] || '08:00',
          end: parts[3] || '09:40',
          room: parts[4] || '',
          advance: 15,
          mode: 'alarm'
        });
        count++;
      }
    }
    modal.classList.remove('open');
    alert(`成功导入 ${count} 节课程！`);
  };
  openModal('批量导入课表', box);
});

// ==================== 4. 考试计划管理 ====================
let exams = JSON.parse(localStorage.getItem('exams_v1') || '[]');

function saveExams() {
  localStorage.setItem('exams_v1', JSON.stringify(exams));
  renderExams();
}

function renderExams() {
  const list = document.getElementById('examList');
  const sorted = [...exams].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  if (!sorted.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">暂无考试计划，添加后自动倒计时提醒 🎯</div>';
    return;
  }
  list.innerHTML = '';
  const now = Date.now();
  sorted.forEach(ex => {
    const diffMs = new Date(ex.datetime).getTime() - now;
    let countdown = '已结束';
    let urgentClass = '';
    if (diffMs > 0) {
      const days = Math.floor(diffMs / 86400000);
      const hrs = Math.floor((diffMs % 86400000) / 3600000);
      countdown = days > 0 ? `还剩 ${days} 天 ${hrs} 小时` : `还剩 ${hrs} 小时`;
      if (days <= 3) urgentClass = 'badge-urgent';
    }
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div>
        <div><strong>${ex.name}</strong> <span class="badge ${urgentClass}">${countdown}</span></div>
        <div class="sub-text">📅 ${ex.datetime.replace('T', ' ')} ｜ 📍 ${ex.room || '未填考场'}</div>
        ${ex.note ? `<div class="sub-text">📌 ${ex.note}</div>` : ''}
      </div>
      <button class="btn btn-sm btn-danger">删除</button>
    `;
    div.querySelector('button').onclick = async () => {
      await cancelReminder(ex.notifId);
      exams = exams.filter(x => x.id !== ex.id);
      saveExams();
    };
    list.appendChild(div);
  });
}

document.getElementById('addExamBtn').addEventListener('click', async () => {
  const name = document.getElementById('eName').value.trim();
  const datetime = document.getElementById('eDateTime').value;
  if (!name || !datetime) return alert('请填写考试科目和日期时间');

  const advance = Number(document.getElementById('eAdvance').value);
  const mode = document.getElementById('eMode').value;
  const room = document.getElementById('eRoom').value.trim();
  const note = document.getElementById('eNote').value.trim();
  const targetMs = new Date(datetime).getTime() - advance * 60000;
  const notifId = makeSafeNotifId();

  if (targetMs > Date.now()) {
    await scheduleReminder({
      id: notifId,
      title: `考试提醒：${name}`,
      body: `开考时间 ${datetime.replace('T', ' ')}，考场：${room || '请确认'} ${note}`,
      atDate: new Date(targetMs),
      mode
    });
  }

  exams.push({ id: Date.now(), name, datetime, room, note, advance, mode, notifId });
  saveExams();
  document.getElementById('eName').value = '';
  document.getElementById('eRoom').value = '';
  document.getElementById('eNote').value = '';
  alert('考试计划与提醒已保存！');
});

// ==================== 5. IndexedDB 本地资料与音乐存储 ====================
let db = null;
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('StudyHubDB', 1);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('files')) d.createObjectStore('files', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('tracks')) d.createObjectStore('tracks', { keyPath: 'id' });
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

function dbPut(store, item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(item);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function dbGetAll(store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
function dbDelete(store, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function renderFiles() {
  const filter = document.getElementById('fileFilter').value;
  const all = (await dbGetAll('files')).sort((a, b) => b.createdAt - a.createdAt);
  const items = filter === 'all' ? all : all.filter(f => f.category === filter);
  const list = document.getElementById('fileList');

  if (!items.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">暂无导入的资料，点击上方按钮上传图片、文字或文件 📂</div>';
    return;
  }
  list.innerHTML = '';
  items.forEach(f => {
    const div = document.createElement('div');
    div.className = 'item-row';
    const url = f.blob ? URL.createObjectURL(f.blob) : '';
    const leftHtml = f.category === 'image'
      ? `<img src="${url}" class="thumb" />`
      : `<div style="font-size:28px; width:46px; text-align:center;">${f.category === 'text' ? '📝' : '📄'}</div>`;

    div.innerHTML = `
      <div style="display:flex; gap:10px; align-items:center; flex:1; cursor:pointer;" class="open-trigger">
        ${leftHtml}
        <div>
          <div style="font-weight:500; word-break:break-all;">${f.name}</div>
          <div class="sub-text">${(f.size / 1024).toFixed(1)} KB · ${new Date(f.createdAt).toLocaleDateString()}</div>
        </div>
      </div>
      <button class="btn btn-sm btn-danger">删除</button>
    `;

    div.querySelector('.open-trigger').onclick = async () => {
      if (f.category === 'image') {
        openModal(f.name, `<img src="${url}" style="width:100%; border-radius:8px;" />`);
      } else if (f.category === 'text') {
        const text = f.textContent ?? (f.blob ? await f.blob.text() : '');
        openModal(f.name, `<pre style="white-space:pre-wrap; font-size:13px; line-height:1.6;">${text.replace(/</g, '&lt;')}</pre>`);
      } else {
        openModal(f.name, `
          <p class="sub-text">文件类型：${f.mime || '常见文档'}</p>
          <a href="${url}" download="${f.name}" class="btn" style="display:inline-block; text-decoration:none; margin-top:8px;">⬇️ 打开 / 导出此文件</a>
        `);
      }
    };
    div.querySelector('button').onclick = async () => {
      await dbDelete('files', f.id);
      renderFiles();
    };
    list.appendChild(div);
  });
}

document.getElementById('fileUploadInput').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    let category = 'doc';
    if (file.type.startsWith('image/')) category = 'image';
    else if (file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name)) category = 'text';

    await dbPut('files', {
      id: Date.now() + Math.random(),
      name: file.name,
      mime: file.type,
      size: file.size,
      category,
      blob: file,
      createdAt: Date.now()
    });
  }
  e.target.value = '';
  renderFiles();
});

document.getElementById('openNoteModalBtn').addEventListener('click', () => {
  const box = document.createElement('div');
  box.innerHTML = `
    <input id="noteTitle" placeholder="笔记标题 (如: 考前重点整理)" style="margin-bottom:8px;" />
    <textarea id="noteBody" style="min-height:160px;" placeholder="在这里输入或粘贴文字..."></textarea>
    <button class="btn" style="width:100%; margin-top:10px;" id="saveNoteBtn">保存到资料库</button>
  `;
  box.querySelector('#saveNoteBtn').onclick = async () => {
    const title = box.querySelector('#noteTitle').value.trim() || '未命名笔记';
    const body = box.querySelector('#noteBody').value;
    await dbPut('files', {
      id: Date.now(),
      name: title + '.txt',
      mime: 'text/plain',
      size: new Blob([body]).size,
      category: 'text',
      textContent: body,
      createdAt: Date.now()
    });
    modal.classList.remove('open');
    renderFiles();
  };
  openModal('新建文字笔记', box);
});
document.getElementById('fileFilter').addEventListener('change', renderFiles);

// ==================== 6. 放松音乐（离线白噪音 + 本地播放器） ====================
let audioCtx = null;
let currentNodes = [];
let masterGain = null;
let sleepTimeout = null;

function stopAmbient() {
  currentNodes.forEach(n => { try { n.stop?.(); n.disconnect?.(); } catch {} });
  currentNodes = [];
  document.querySelectorAll('.ambient-btn').forEach(b => b.classList.remove('playing'));
  if (sleepTimeout) { clearTimeout(sleepTimeout); sleepTimeout = null; }
  document.getElementById('timerStatus').textContent = '';
}

function playAmbient(type, btnEl) {
  stopAmbient();
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = Number(document.getElementById('ambientVol').value);
  masterGain.connect(audioCtx.destination);

  if (type === 'alpha') {
    // 舒缓 Cmaj7 和弦轻音乐氛围音
    [261.63, 329.63, 392.0, 493.88].forEach(freq => {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.value = 0.08;
      osc.connect(g); g.connect(masterGain);
      osc.start();
      currentNodes.push(osc, g);
    });
  } else {
    // 生成自然噪声 buffer
    const bufferSize = audioCtx.sampleRate * 3;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'fire' || type === 'ocean') {
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      } else {
        data[i] = white * 0.4;
      }
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = type === 'rain' ? 'bandpass' : 'lowpass';
    filter.frequency.value = type === 'rain' ? 1100 : (type === 'ocean' ? 420 : 260);
    noise.connect(filter);

    if (type === 'ocean') {
      const lfo = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();
      const waveGain = audioCtx.createGain();
      lfo.frequency.value = 0.12;
      lfoGain.gain.value = 0.35;
      waveGain.gain.value = 0.65;
      lfo.connect(lfoGain); lfoGain.connect(waveGain.gain);
      filter.connect(waveGain); waveGain.connect(masterGain);
      lfo.start();
      currentNodes.push(lfo, lfoGain, waveGain);
    } else {
      filter.connect(masterGain);
    }
    noise.start();
    currentNodes.push(noise, filter);
  }

  btnEl.classList.add('playing');
  const mins = Number(document.getElementById('sleepTimer').value);
  if (mins > 0) {
    document.getElementById('timerStatus').textContent = `⏱️ 将在 ${mins} 分钟后自动停止播放`;
    sleepTimeout = setTimeout(stopAmbient, mins * 60000);
  }
}

document.querySelectorAll('.ambient-btn').forEach(btn => {
  btn.addEventListener('click', () => playAmbient(btn.dataset.sound, btn));
});
document.getElementById('stopAmbientBtn').addEventListener('click', stopAmbient);
document.getElementById('ambientVol').addEventListener('input', (e) => {
  if (masterGain) masterGain.gain.value = Number(e.target.value);
});

async function renderTracks() {
  const tracks = await dbGetAll('tracks');
  const list = document.getElementById('trackList');
  if (!tracks.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center;">可导入手机里的 MP3 / FLAC 歌曲离线播放 🎶</div>';
    return;
  }
  list.innerHTML = '';
  const player = document.getElementById('audioPlayer');
  tracks.forEach(t => {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div style="flex:1; cursor:pointer;" class="play-track">🎵 ${t.name}</div>
      <button class="btn btn-sm btn-danger">删除</button>
    `;
    div.querySelector('.play-track').onclick = () => {
      player.src = URL.createObjectURL(t.blob);
      player.play();
      document.getElementById('nowPlaying').textContent = '正在播放：' + t.name;
    };
    div.querySelector('button').onclick = async () => {
      await dbDelete('tracks', t.id);
      renderTracks();
    };
    list.appendChild(div);
  });
}

document.getElementById('musicUploadInput').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    await dbPut('tracks', { id: Date.now() + Math.random(), name: file.name, blob: file });
  }
  e.target.value = '';
  renderTracks();
});

// ==================== 7. 全球股市与个股每日消息汇总 ====================
const DEMO_MARKET = {
  updatedAt: '演示数据（点右上角⚙️填入你的 GitHub 仓库即可每天自动更新）',
  indices: [
    { symbol: '^GSPC', name: '标普500', region: '美国', price: 6012.45, changePct: 0.68 },
    { symbol: '^IXIC', name: '纳斯达克', region: '美国', price: 19240.10, changePct: 1.12 },
    { symbol: '000001.SS', name: '上证指数', region: '中国A股', price: 3356.80, changePct: 0.45 },
    { symbol: '^HSI', name: '恒生指数', region: '中国香港', price: 20410.22, changePct: -0.32 }
  ],
  stocks: [
    {
      symbol: 'NVDA', name: '英伟达 NVIDIA', market: '美股', price: 145.60, changePct: 2.35,
      summary: '今日焦点：\n• AI 算力芯片需求持续强劲，多家投行上调目标价\n• 新一代数据中心架构量产进度符合预期',
      news: [
        { title: '请点击右上角“仓库源”填入你的 用户名/study-stock-app 以开启每日真实行情与消息汇总', source: '系统提示', time: '今天', link: 'https://github.com' }
      ]
    }
  ]
};

let marketData = DEMO_MARKET;

function renderStocks(keyword = '') {
  document.getElementById('stockUpdated').textContent = '更新时间：' + (marketData.updatedAt || '--');
  const idxGrid = document.getElementById('indicesGrid');
  idxGrid.innerHTML = (marketData.indices || []).map(i => {
    const cls = i.changePct >= 0 ? 'up' : 'down';
    const sign = i.changePct >= 0 ? '+' : '';
    return `
      <div class="idx-box">
        <div style="font-size:12px; color:#6b7280;">${i.region} · ${i.name}</div>
        <div style="font-size:16px; font-weight:700; margin:4px 0;">${i.price}</div>
        <div class="${cls}" style="font-size:12px;">${sign}${i.changePct}%</div>
      </div>
    `;
  }).join('');

  const kw = keyword.trim().toLowerCase();
  const filtered = (marketData.stocks || []).filter(s => {
    if (!kw) return true;
    return s.name.toLowerCase().includes(kw) ||
      s.symbol.toLowerCase().includes(kw) ||
      (s.summary || '').toLowerCase().includes(kw);
  });

  const list = document.getElementById('stocksList');
  if (!filtered.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center;">未匹配到相关股票或资讯</div>';
    return;
  }

  list.innerHTML = filtered.map(s => {
    const cls = s.changePct >= 0 ? 'up' : 'down';
    const sign = s.changePct >= 0 ? '+' : '';
    const newsHtml = (s.news || []).map(n => `
      <a class="news-link" href="${n.link || '#'}" target="_blank" rel="noopener">
        <div>${n.title}</div>
        <div class="sub-text">${n.source} · ${n.time}</div>
      </a>
    `).join('');
    return `
      <div class="item-row" style="flex-direction:column;">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <div>
            <strong>${s.name}</strong> <span class="badge">${s.market}</span>
            <div class="sub-text">${s.symbol}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:16px; font-weight:700;">${s.price}</div>
            <div class="${cls}" style="font-size:12px;">${sign}${s.changePct}%</div>
          </div>
        </div>
        <div class="news-box" style="width:100%;">
          <div style="font-weight:600; margin-bottom:4px; white-space:pre-line;">📰 ${s.summary || '每日消息汇总'}</div>
          ${newsHtml}
        </div>
      </div>
    `;
  }).join('');
}

async function fetchMarketData() {
  const repo = localStorage.getItem('github_stock_repo') || '';
  if (!repo) {
    marketData = DEMO_MARKET;
    renderStocks(document.getElementById('stockSearch').value);
    return;
  }
  document.getElementById('stockUpdated').textContent = '正在从 GitHub 拉取最新全球行情与消息汇总...';
  try {
    const url = `https://raw.githubusercontent.com/${repo}/main/data/market_data.json?t=${Date.now()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    marketData = await res.json();
    localStorage.setItem('cached_market_v1', JSON.stringify(marketData));
  } catch (e) {
    const cached = localStorage.getItem('cached_market_v1');
    marketData = cached ? JSON.parse(cached) : DEMO_MARKET;
    alert('拉取失败，请检查仓库名是否正确且已运行过更新任务：' + e.message);
  }
  renderStocks(document.getElementById('stockSearch').value);
}

document.getElementById('refreshStocksBtn').addEventListener('click', fetchMarketData);
document.getElementById('stockSearch').addEventListener('input', (e) => renderStocks(e.target.value));
document.getElementById('configRepoBtn').addEventListener('click', () => {
  const cur = localStorage.getItem('github_stock_repo') || '';
  const val = prompt('请输入你的 GitHub 仓库路径（格式：用户名/仓库名，例如 zhangsan/study-stock-app）：', cur);
  if (val !== null) {
    localStorage.setItem('github_stock_repo', val.trim());
    fetchMarketData();
  }
});

// ==================== 启动初始化 ====================
(async function bootstrap() {
  await openDB();
  await initNotificationChannels();
  renderDayTabs();
  renderCourses();
  renderExams();
  renderFiles();
  renderTracks();
  fetchMarketData();
})();
