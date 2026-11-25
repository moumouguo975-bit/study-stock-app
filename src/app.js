import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const SystemAlarm = registerPlugin('SystemAlarm');
const DEFAULT_GITHUB_REPO = 'moumouguo975-bit/study-stock-app';
const DAYS_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// ==================== 1. 真实响铃闹钟引擎（应用内循环响铃 + 15秒铃声通知 + 手机原生系统闹钟） ====================
let ringInterval = null;
let ringAudioCtx = null;

function startRingingOverlay(title, body) {
  document.getElementById('ringTitle').textContent = title || '闹钟响铃中';
  document.getElementById('ringBody').textContent = body || '设定的时间到了！';
  document.getElementById('ringingOverlay').classList.add('active');

  stopRingingSoundOnly();
  try {
    ringAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (ringAudioCtx.state === 'suspended') ringAudioCtx.resume();
    const beep = () => {
      if (!ringAudioCtx) return;
      [880, 1174.66, 880, 1174.66].forEach((freq, i) => {
        const osc = ringAudioCtx.createOscillator();
        const gain = ringAudioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const t = ringAudioCtx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(gain);
        gain.connect(ringAudioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.17);
      });
      if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150]);
    };
    beep();
    ringInterval = setInterval(beep, 1200);
  } catch (e) {
    console.warn('WebAudio ring error:', e);
  }
}

function stopRingingSoundOnly() {
  if (ringInterval) { clearInterval(ringInterval); ringInterval = null; }
  if (ringAudioCtx) { try { ringAudioCtx.close(); } catch {} ringAudioCtx = null; }
  if (navigator.vibrate) navigator.vibrate(0);
}

document.getElementById('stopRingBtn').addEventListener('click', () => {
  stopRingingSoundOnly();
  document.getElementById('ringingOverlay').classList.remove('active');
});

function makeSafeNotifId() {
  return Math.floor(Math.random() * 2000000000) + 1;
}

async function initNotificationChannels() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.requestPermissions();
    // 新建 v2 响铃通道，绑定打包内置的 15 秒真实闹铃 alarm_ring.wav
    await LocalNotifications.createChannel({
      id: 'alarm_ring_v2',
      name: '课表考试响铃闹钟',
      description: '15秒连续响铃与震动强提醒',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: 'alarm_ring.wav'
    });
    await LocalNotifications.createChannel({
      id: 'normal_channel_v2',
      name: '普通计划通知',
      description: '常规学习计划通知',
      importance: 3,
      vibration: true
    });

    // App 前台收到闹钟或点击闹钟通知时，直接拉起全屏循环响铃界面
    LocalNotifications.addListener('localNotificationReceived', (notif) => {
      if (notif.channelId === 'alarm_ring_v2') {
        startRingingOverlay(notif.title, notif.body);
      }
    });
    LocalNotifications.addListener('localNotificationActionPerformed', (act) => {
      const notif = act.notification;
      if (notif && notif.channelId === 'alarm_ring_v2') {
        startRingingOverlay(notif.title, notif.body);
      }
    });
  } catch (e) {
    console.error('Init notifications error:', e);
  }
}

async function setNativeSystemAlarm({ hour, minute, message, days }) {
  if (!Capacitor.isNativePlatform()) {
    alert(`浏览器模式模拟系统闹钟：${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} - ${message}`);
    return;
  }
  try {
    await SystemAlarm.setAlarm({
      hour: Number(hour),
      minute: Number(minute),
      message: message || '学财助手闹钟',
      days: days || [],
      skipUi: false
    });
  } catch (e) {
    alert('调起手机系统时钟失败：' + e.message);
  }
}

async function scheduleReminder({ id, title, body, atDate, weeklyWeekday, hour, minute, mode }) {
  const isAlarm = mode === 'alarm';
  const channelId = isAlarm ? 'alarm_ring_v2' : 'normal_channel_v2';

  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') {
        alert('请允许通知和闹钟权限，否则无法响铃！');
        return;
      }
      const schedule = weeklyWeekday !== undefined
        ? { on: { weekday: weeklyWeekday, hour, minute }, allowWhileIdle: true }
        : { at: atDate, allowWhileIdle: true };

      await LocalNotifications.schedule({
        notifications: [{
          id,
          title: (isAlarm ? '⏰ [响铃闹钟] ' : '🔔 ') + title,
          body,
          channelId,
          schedule,
          sound: isAlarm ? 'alarm_ring.wav' : 'default'
        }]
      });
    } catch (e) {
      alert('设置提醒失败: ' + e.message);
    }
  } else if (atDate) {
    const delay = atDate.getTime() - Date.now();
    if (delay > 0 && delay < 86400000) {
      setTimeout(() => isAlarm ? startRingingOverlay(title, body) : alert(title + '\n' + body), delay);
    }
  }
}

async function cancelReminder(id) {
  if (!id || !Capacitor.isNativePlatform()) return;
  try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch {}
}

// 测试响铃闹钟（支持 5 秒后真实响铃，或一键写入手机系统时钟）
document.getElementById('testAlarmBtn').addEventListener('click', () => {
  const box = document.createElement('div');
  box.innerHTML = `
    <p class="sub-text" style="margin-bottom:12px;">选择测试方式：内置闹钟会播放 15 秒连续响铃并弹出响铃界面；系统闹钟会直接写入你手机自带的【时钟】App（锁屏永不失效）。</p>
    <button class="btn" id="btnTest5s" style="width:100%; margin-bottom:8px;">🔔 5 秒后立刻响铃测试</button>
    <button class="btn btn-warn" id="btnTestSys" style="width:100%;">⏰ 写入手机自带【系统闹钟】(1分钟后)</button>
  `;
  box.querySelector('#btnTest5s').onclick = async () => {
    modal.classList.remove('open');
    const target = new Date(Date.now() + 5000);
    await scheduleReminder({
      id: makeSafeNotifId(),
      title: '闹钟响铃测试！',
      body: '连续响铃工作正常！点击可关闭。',
      atDate: target,
      mode: 'alarm'
    });
    // 同时保底前台5秒拉起全屏响铃
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        startRingingOverlay('闹钟响铃测试！', '铃声正常响起！');
      }
    }, 5200);
    alert('已设定 5 秒后响铃（请调大手机媒体与通知音量）！');
  };
  box.querySelector('#btnTestSys').onclick = async () => {
    modal.classList.remove('open');
    const d = new Date(Date.now() + 65000);
    await setNativeSystemAlarm({ hour: d.getHours(), minute: d.getMinutes(), message: '学财助手系统闹钟测试' });
  };
  openModal('⏰ 响铃闹钟测试', box);
});

// ==================== 2. 导航与弹窗 ====================
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
    document.getElementById('headerTitle').textContent = btn.dataset.title;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${btn.dataset.tab}`).classList.add('active');
  });
});

// ==================== 3. 课表管理（带一键写入系统闹钟） ====================
let courses = JSON.parse(localStorage.getItem('courses_v1') || '[]');
let selectedDay = new Date().getDay();

function calcCourseAlarmTime(item) {
  const [h, m] = item.start.split(':').map(Number);
  let totalMin = h * 60 + m - Number(item.advance || 15);
  let dayIndex = Number(item.day);
  if (totalMin < 0) { totalMin += 1440; dayIndex = (dayIndex + 6) % 7; }
  return { hour: Math.floor(totalMin / 60), minute: totalMin % 60, capWeekday: dayIndex + 1 };
}

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
  const filtered = courses.filter(c => Number(c.day) === Number(selectedDay)).sort((a, b) => a.start.localeCompare(b.start));
  if (!filtered.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">今天暂无排课 ✨</div>';
    return;
  }
  list.innerHTML = '';
  filtered.forEach(c => {
    const t = calcCourseAlarmTime(c);
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div style="flex:1;">
        <div><strong>${c.name}</strong> <span class="badge ${c.mode === 'alarm' ? 'badge-alarm' : ''}">${c.mode === 'alarm' ? '⏰响铃' : '🔔通知'}</span></div>
        <div class="sub-text">🕒 ${c.start}-${c.end} ｜ 📍 ${c.room || '未填教室'} ｜ 提前${c.advance}分</div>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <button class="btn btn-sm btn-warn sys-alarm-btn">⏰系统闹钟</button>
        <button class="btn btn-sm btn-danger del-btn">删除</button>
      </div>
    `;
    div.querySelector('.sys-alarm-btn').onclick = () => {
      setNativeSystemAlarm({
        hour: t.hour,
        minute: t.minute,
        message: `上课：${c.name} (${c.room || ''})`,
        days: [t.capWeekday]
      });
    };
    div.querySelector('.del-btn').onclick = async () => {
      await cancelReminder(c.notifId);
      courses = courses.filter(x => x.id !== c.id);
      saveCourses();
    };
    list.appendChild(div);
  });
}

async function addCourseItem(item) {
  const t = calcCourseAlarmTime(item);
  const notifId = makeSafeNotifId();
  await scheduleReminder({
    id: notifId,
    title: `即将上课：${item.name}`,
    body: `时间 ${item.start}-${item.end}，地点：${item.room || '请查看课表'}`,
    weeklyWeekday: t.capWeekday,
    hour: t.hour,
    minute: t.minute,
    mode: item.mode || 'alarm'
  });
  courses.push({ ...item, id: Date.now() + Math.random(), notifId });
  saveCourses();
  return t;
}

document.getElementById('addCourseBtn').addEventListener('click', async () => {
  const name = document.getElementById('cName').value.trim();
  if (!name) return alert('请输入课程名称');
  const item = {
    name,
    day: Number(document.getElementById('cDay').value),
    room: document.getElementById('cRoom').value.trim(),
    start: document.getElementById('cStart').value,
    end: document.getElementById('cEnd').value,
    advance: Number(document.getElementById('cAdvance').value),
    mode: document.getElementById('cMode').value
  };
  const t = await addCourseItem(item);
  document.getElementById('cName').value = '';
  document.getElementById('cRoom').value = '';
  if (item.mode === 'alarm' && confirm('课程已保存！是否同时写入手机自带【系统时钟闹钟】（锁屏永不漏响）？')) {
    await setNativeSystemAlarm({ hour: t.hour, minute: t.minute, message: `上课：${item.name}`, days: [t.capWeekday] });
  }
});

document.getElementById('openBatchCourseBtn').addEventListener('click', () => {
  const box = document.createElement('div');
  box.innerHTML = `
    <div class="sub-text" style="margin-bottom:8px;">每行一节课，逗号分隔：<code>课程名,周一,08:00,09:40,教室</code></div>
    <textarea id="batchCourseText" style="min-height:130px;" placeholder="高等数学,周一,08:00,09:40,A101&#10;大学英语,周三,10:00,11:40,B205"></textarea>
    <button class="btn" style="width:100%; margin-top:10px;" id="confirmBatchBtn">一键导入</button>
  `;
  box.querySelector('#confirmBatchBtn').onclick = async () => {
    const raw = box.querySelector('#batchCourseText').value.trim();
    if (!raw) return;
    const dayMap = { '周日': 0, '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6 };
    let count = 0;
    for (const line of raw.split('\n')) {
      const parts = line.split(/[,，]/).map(s => s.trim());
      if (parts.length >= 3) {
        await addCourseItem({ name: parts[0], day: dayMap[parts[1]] ?? 1, start: parts[2] || '08:00', end: parts[3] || '09:40', room: parts[4] || '', advance: 15, mode: 'alarm' });
        count++;
      }
    }
    modal.classList.remove('open');
    alert(`成功导入 ${count} 节课程！`);
  };
  openModal('批量导入课表', box);
});

// ==================== 4. 考试计划 ====================
let exams = JSON.parse(localStorage.getItem('exams_v1') || '[]');
function saveExams() { localStorage.setItem('exams_v1', JSON.stringify(exams)); renderExams(); }

function renderExams() {
  const list = document.getElementById('examList');
  const sorted = [...exams].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  if (!sorted.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">暂无考试计划 🎯</div>';
    return;
  }
  list.innerHTML = '';
  const now = Date.now();
  sorted.forEach(ex => {
    const diffMs = new Date(ex.datetime).getTime() - now;
    let countdown = '已结束', urgentClass = '';
    if (diffMs > 0) {
      const days = Math.floor(diffMs / 86400000);
      const hrs = Math.floor((diffMs % 86400000) / 3600000);
      countdown = days > 0 ? `还剩 ${days} 天 ${hrs} 小时` : `还剩 ${hrs} 小时`;
      if (days <= 3) urgentClass = 'badge-urgent';
    }
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div style="flex:1;">
        <div><strong>${ex.name}</strong> <span class="badge ${urgentClass}">${countdown}</span></div>
        <div class="sub-text">📅 ${ex.datetime.replace('T', ' ')} ｜ 📍 ${ex.room || '未填考场'}</div>
        ${ex.note ? `<div class="sub-text">📌 ${ex.note}</div>` : ''}
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <button class="btn btn-sm btn-warn sys-alarm-btn">⏰系统闹钟</button>
        <button class="btn btn-sm btn-danger del-btn">删除</button>
      </div>
    `;
    div.querySelector('.sys-alarm-btn').onclick = () => {
      const target = new Date(new Date(ex.datetime).getTime() - Number(ex.advance || 0) * 60000);
      setNativeSystemAlarm({ hour: target.getHours(), minute: target.getMinutes(), message: `考试：${ex.name} (${ex.room || ''})` });
    };
    div.querySelector('.del-btn').onclick = async () => {
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
  alert('考试计划与响铃闹钟已保存！');
});

// ==================== 5. IndexedDB 存储（使用 ArrayBuffer 彻底修复安卓 WebView 文件/音乐读取问题） ====================
let db = null;
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('StudyHubDB_v2', 1);
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

function makeBlobFromRecord(rec, fallbackMime = 'application/octet-stream') {
  if (rec.data) return new Blob([rec.data], { type: rec.mime || fallbackMime });
  if (rec.blob) return rec.blob;
  return new Blob([]);
}

async function renderFiles() {
  const filter = document.getElementById('fileFilter').value;
  const all = (await dbGetAll('files')).sort((a, b) => b.createdAt - a.createdAt);
  const items = filter === 'all' ? all : all.filter(f => f.category === filter);
  const list = document.getElementById('fileList');
  if (!items.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">暂无资料，点击上方导入 📂</div>';
    return;
  }
  list.innerHTML = '';
  items.forEach(f => {
    const div = document.createElement('div');
    div.className = 'item-row';
    const blob = makeBlobFromRecord(f);
    const url = f.category !== 'text' ? URL.createObjectURL(blob) : '';
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
        const text = f.textContent ?? await blob.text();
        openModal(f.name, `<pre style="white-space:pre-wrap; font-size:13px; line-height:1.6;">${text.replace(/</g, '&lt;')}</pre>`);
      } else {
        openModal(f.name, `
          <p class="sub-text">文件大小：${(f.size / 1024).toFixed(1)} KB</p>
          <a href="${url}" download="${f.name}" class="btn" style="display:inline-block; text-decoration:none; margin-top:8px;">⬇️ 打开 / 导出此文件</a>
        `);
      }
    };
    div.querySelector('button').onclick = async () => { await dbDelete('files', f.id); renderFiles(); };
    list.appendChild(div);
  });
}

document.getElementById('fileUploadInput').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    let category = 'doc';
    if (file.type.startsWith('image/')) category = 'image';
    else if (file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name)) category = 'text';
    const data = await file.arrayBuffer();
    await dbPut('files', {
      id: Date.now() + Math.random(),
      name: file.name,
      mime: file.type,
      size: data.byteLength,
      category,
      data,
      createdAt: Date.now()
    });
  }
  e.target.value = '';
  renderFiles();
});

document.getElementById('openNoteModalBtn').addEventListener('click', () => {
  const box = document.createElement('div');
  box.innerHTML = `
    <input id="noteTitle" placeholder="笔记标题" style="margin-bottom:8px;" />
    <textarea id="noteBody" style="min-height:160px;" placeholder="输入文字..."></textarea>
    <button class="btn" style="width:100%; margin-top:10px;" id="saveNoteBtn">保存</button>
  `;
  box.querySelector('#saveNoteBtn').onclick = async () => {
    const title = box.querySelector('#noteTitle').value.trim() || '未命名笔记';
    const body = box.querySelector('#noteBody').value;
    await dbPut('files', {
      id: Date.now(), name: title + '.txt', mime: 'text/plain',
      size: new Blob([body]).size, category: 'text', textContent: body, createdAt: Date.now()
    });
    modal.classList.remove('open');
    renderFiles();
  };
  openModal('新建文字笔记', box);
});
document.getElementById('fileFilter').addEventListener('change', renderFiles);

// ==================== 6. 放松音乐（离线白噪音 + 修复版高可靠本地音乐播放器） ====================
let audioCtx = null, currentNodes = [], masterGain = null, sleepTimeout = null;
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
    [261.63, 329.63, 392.0, 493.88].forEach(freq => {
      const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq; g.gain.value = 0.09;
      osc.connect(g); g.connect(masterGain); osc.start();
      currentNodes.push(osc, g);
    });
  } else {
    const bufferSize = audioCtx.sampleRate * 3;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'fire' || type === 'ocean') { data[i] = (lastOut + 0.02 * w) / 1.02; lastOut = data[i]; data[i] *= 3.5; }
      else data[i] = w * 0.45;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer; noise.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = type === 'rain' ? 'bandpass' : 'lowpass';
    filter.frequency.value = type === 'rain' ? 1100 : (type === 'ocean' ? 420 : 260);
    noise.connect(filter);
    if (type === 'ocean') {
      const lfo = audioCtx.createOscillator(), lfoG = audioCtx.createGain(), wG = audioCtx.createGain();
      lfo.frequency.value = 0.12; lfoG.gain.value = 0.35; wG.gain.value = 0.65;
      lfo.connect(lfoG); lfoG.connect(wG.gain); filter.connect(wG); wG.connect(masterGain);
      lfo.start(); currentNodes.push(lfo, lfoG, wG);
    } else {
      filter.connect(masterGain);
    }
    noise.start(); currentNodes.push(noise, filter);
  }
  btnEl.classList.add('playing');
  const mins = Number(document.getElementById('sleepTimer').value);
  if (mins > 0) {
    document.getElementById('timerStatus').textContent = `⏱️ 将在 ${mins} 分钟后自动停止`;
    sleepTimeout = setTimeout(stopAmbient, mins * 60000);
  }
}
document.querySelectorAll('.ambient-btn').forEach(btn => btn.addEventListener('click', () => playAmbient(btn.dataset.sound, btn)));
document.getElementById('stopAmbientBtn').addEventListener('click', stopAmbient);
document.getElementById('ambientVol').addEventListener('input', (e) => { if (masterGain) masterGain.gain.value = Number(e.target.value); });

// 本地音频播放器核心修复
const audioPlayer = document.getElementById('audioPlayer');
const musicSeek = document.getElementById('musicSeek');
const curTimeEl = document.getElementById('curTime');
const durTimeEl = document.getElementById('durTime');
const playPauseBtn = document.getElementById('playPauseBtn');
let cachedTracks = [];
let currentTrackIdx = -1;
let activeAudioUrl = null;

function fmtSec(sec) {
  if (!isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function guessAudioMime(name) {
  const n = (name || '').toLowerCase();
  if (n.endsWith('.mp3')) return 'audio/mpeg';
  if (n.endsWith('.wav')) return 'audio/wav';
  if (n.endsWith('.ogg')) return 'audio/ogg';
  if (n.endsWith('.m4a') || n.endsWith('.aac')) return 'audio/mp4';
  if (n.endsWith('.flac')) return 'audio/flac';
  return 'audio/mpeg';
}

async function playTrackAt(idx) {
  if (!cachedTracks.length) return;
  currentTrackIdx = (idx + cachedTracks.length) % cachedTracks.length;
  const t = cachedTracks[currentTrackIdx];
  if (activeAudioUrl) { URL.revokeObjectURL(activeAudioUrl); activeAudioUrl = null; }
  const blob = makeBlobFromRecord(t, guessAudioMime(t.name));
  if (!blob.size) {
    alert('该音频文件数据为空，请删除后重新导入标准 MP3/M4A/WAV 文件！');
    return;
  }
  activeAudioUrl = URL.createObjectURL(blob);
  audioPlayer.src = activeAudioUrl;
  audioPlayer.load();
  document.getElementById('nowPlaying').textContent = '🎵 ' + t.name;
  try {
    await audioPlayer.play();
    playPauseBtn.textContent = '⏸ 暂停';
  } catch (err) {
    playPauseBtn.textContent = '▶️ 播放';
    alert('无法解码此音频（提示：网易云 .ncm 或 QQ音乐加密文件无法直接播放，请导入普通 MP3/M4A/WAV/FLAC）：' + err.message);
  }
}

audioPlayer.addEventListener('loadedmetadata', () => {
  durTimeEl.textContent = fmtSec(audioPlayer.duration);
});
audioPlayer.addEventListener('timeupdate', () => {
  curTimeEl.textContent = fmtSec(audioPlayer.currentTime);
  if (audioPlayer.duration) {
    musicSeek.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
  }
});
audioPlayer.addEventListener('ended', () => {
  if (cachedTracks.length > 0) playTrackAt(currentTrackIdx + 1);
});
audioPlayer.addEventListener('error', () => {
  playPauseBtn.textContent = '▶️ 播放';
  document.getElementById('nowPlaying').textContent = '⚠️ 该文件格式不支持播放（请导入标准 MP3/M4A/WAV）';
});

musicSeek.addEventListener('input', () => {
  if (audioPlayer.duration) {
    audioPlayer.currentTime = (Number(musicSeek.value) / 100) * audioPlayer.duration;
  }
});
playPauseBtn.addEventListener('click', () => {
  if (currentTrackIdx < 0 && cachedTracks.length > 0) return playTrackAt(0);
  if (audioPlayer.paused) { audioPlayer.play(); playPauseBtn.textContent = '⏸ 暂停'; }
  else { audioPlayer.pause(); playPauseBtn.textContent = '▶️ 播放'; }
});
document.getElementById('prevTrackBtn').addEventListener('click', () => playTrackAt(currentTrackIdx - 1));
document.getElementById('nextTrackBtn').addEventListener('click', () => playTrackAt(currentTrackIdx + 1));

async function renderTracks() {
  cachedTracks = await dbGetAll('tracks');
  const list = document.getElementById('trackList');
  if (!cachedTracks.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:10px;">点右上角“+ 导入音乐”导入手机里的 MP3 / M4A / WAV / FLAC 歌曲 🎶</div>';
    return;
  }
  list.innerHTML = '';
  cachedTracks.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div style="flex:1; cursor:pointer;" class="play-track">
        <div>🎵 ${t.name}</div>
        <div class="sub-text">${((t.size || 0) / 1048576).toFixed(2)} MB</div>
      </div>
      <div style="display:flex; gap:4px;">
        <button class="btn btn-sm btn-outline ren-btn">改名</button>
        <button class="btn btn-sm btn-danger del-btn">删除</button>
      </div>
    `;
    div.querySelector('.play-track').onclick = () => playTrackAt(i);
    div.querySelector('.ren-btn').onclick = async () => {
      const nn = prompt('输入新的歌曲名：', t.name);
      if (nn && nn.trim()) {
        t.name = nn.trim();
        await dbPut('tracks', t);
        renderTracks();
      }
    };
    div.querySelector('.del-btn').onclick = async () => {
      await dbDelete('tracks', t.id);
      renderTracks();
    };
    list.appendChild(div);
  });
}

document.getElementById('musicUploadInput').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    try {
      const data = await file.arrayBuffer();
      const mime = file.type || guessAudioMime(file.name);
      await dbPut('tracks', {
        id: Date.now() + Math.random(),
        name: file.name,
        mime,
        size: data.byteLength,
        data
      });
    } catch (err) {
      alert('读取音频失败：' + err.message);
    }
  }
  e.target.value = '';
  await renderTracks();
  if (cachedTracks.length > 0) playTrackAt(cachedTracks.length - 1);
});

// ==================== 7. 全球股市 + 30日SVG走势态势图 + 全网实时搜任意股票 ====================
let marketData = { updatedAt: '加载中...', globalNews: [], indices: [], stocks: [] };
let activeRegion = 'all';
let customWatchlist = JSON.parse(localStorage.getItem('custom_watchlist_v1') || '[]');

// 原生跨平台 HTTP GET（安卓自动绕过 CORS 限制）
async function httpGetJson(url) {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url,
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36' }
    });
    return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  } else {
    const res = await fetch(url);
    return await res.json();
  }
}

async function httpGetText(url) {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  } else {
    const res = await fetch(url);
    return await res.text();
  }
}

// 绘制清晰美观的 30 日走势态势图（红涨绿跌带渐变面积）
function renderSparklineSVG(history, isUp, height = 42, showLabels = false) {
  if (!history || history.length < 2) {
    return `<div class="sub-text" style="height:${height}px; display:flex; align-items:center;">暂无走势数据</div>`;
  }
  const min = Math.min(...history);
  const max = Math.max(...history);
  const span = max - min || 1;
  const w = 240, h = height;
  const pad = 4;
  const pts = history.map((v, i) => {
    const x = pad + (i / (history.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x.toFixed(1), y.toFixed(1)];
  });
  const line = pts.map(p => p.join(',')).join(' ');
  const area = `${pts[0][0]},${h} ${line} ${pts[pts.length - 1][0]},${h}`;
  const color = isUp ? '#ef4444' : '#10b981';
  const fill = isUp ? 'rgba(239,68,68,0.14)' : 'rgba(16,185,129,0.14)';
  return `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%; height:${height}px; display:block;">
      <polygon points="${area}" fill="${fill}" />
      <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    ${showLabels ? `<div class="time-row"><span>近30日最低: ${min.toFixed(2)}</span><span>近30日最高: ${max.toFixed(2)}</span></div>` : ''}
  `;
}

function openStockDetailModal(item) {
  const isUp = (item.changePct || 0) >= 0;
  const sign = isUp ? '+' : '';
  const newsHtml = (item.news && item.news.length)
    ? item.news.map(n => `
        <a class="news-link" href="${n.link || '#'}" target="_blank" rel="noopener">
          <div style="font-weight:500;">${n.title}</div>
          <div class="sub-text">${n.source || '财经'} · ${n.time || ''}</div>
        </a>`).join('')
    : '<div class="sub-text">暂无相关快讯</div>';

  const dates = item.dates || [];
  const rangeStr = dates.length >= 2 ? `${dates[0]} 至 ${dates[dates.length - 1]}` : '近1个月走势';

  openModal(`${item.name} (${item.symbol})`, `
    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px;">
      <span style="font-size:26px; font-weight:700;">${item.price ?? '--'}</span>
      <span class="${isUp ? 'up' : 'down'}" style="font-size:16px;">${sign}${item.change ?? 0} (${sign}${item.changePct ?? 0}%)</span>
    </div>
    <div style="background:#f9fafb; border-radius:10px; padding:10px; border:1px solid #e5e7eb; margin-bottom:12px;">
      <div class="sub-text" style="margin-bottom:4px;">📊 态势走势图 (${rangeStr})</div>
      ${renderSparklineSVG(item.history, isUp, 130, true)}
    </div>
    ${item.open ? `
      <div class="form-grid" style="font-size:12px; background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:12px;">
        <div>今开：<strong>${item.open}</strong></div>
        <div>成交量：<strong>${item.volume ? (item.volume / 10000).toFixed(1) + '万' : '--'}</strong></div>
        <div>最高：<strong class="up">${item.high}</strong></div>
        <div>最低：<strong class="down">${item.low}</strong></div>
      </div>` : ''}
    <div style="font-weight:600; margin-bottom:6px;">📰 每日消息汇总</div>
    <div class="news-box">${newsHtml}</div>
  `);
}

function renderStocks(keyword = '') {
  document.getElementById('stockUpdated').textContent = '更新时间：' + (marketData.updatedAt || '--');

  // 1. 全球大盘指数（按地区筛选 + 内联态势图）
  const indices = (marketData.indices || []).filter(i => activeRegion === 'all' || i.region === activeRegion);
  const idxGrid = document.getElementById('indicesGrid');
  idxGrid.innerHTML = '';
  indices.forEach(i => {
    const isUp = (i.changePct || 0) >= 0;
    const sign = isUp ? '+' : '';
    const box = document.createElement('div');
    box.className = 'idx-box';
    box.innerHTML = `
      <div style="font-size:12px; color:#6b7280;">${i.region} · ${i.name}</div>
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin:2px 0;">
        <span style="font-size:15px; font-weight:700;">${i.price}</span>
        <span class="${isUp ? 'up' : 'down'}" style="font-size:12px;">${sign}${i.changePct}%</span>
      </div>
      ${renderSparklineSVG(i.history, isUp, 36)}
    `;
    box.onclick = () => openStockDetailModal(i);
    idxGrid.appendChild(box);
  });

  // 2. 全球财经头条
  const gnList = document.getElementById('globalNewsList');
  const gNews = marketData.globalNews || [];
  gnList.innerHTML = gNews.length
    ? gNews.map(n => `
        <a class="news-link" href="${n.link || '#'}" target="_blank" rel="noopener">
          <div style="font-size:13px;">${n.title}</div>
          <div class="sub-text">${n.source} · ${n.time}</div>
        </a>`).join('')
    : '<div class="sub-text">点击上方“刷新”拉取全球每日头条</div>';

  // 3. 合并仓库股票 + 用户自选实时股票
  const allStocks = [...customWatchlist, ...(marketData.stocks || [])];
  const kw = keyword.trim().toLowerCase();
  const filtered = allStocks.filter(s => {
    if (!kw) return true;
    return (s.name || '').toLowerCase().includes(kw) ||
      (s.symbol || '').toLowerCase().includes(kw) ||
      (s.market || '').toLowerCase().includes(kw) ||
      (s.summary || '').toLowerCase().includes(kw);
  });

  const list = document.getElementById('stocksList');
  list.innerHTML = '';
  if (!filtered.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:12px;">本地列表未找到，请直接点击右上角 <strong>🔍 全网搜</strong> 查询全球任意股票！</div>';
    return;
  }

  filtered.forEach(s => {
    const isUp = (s.changePct || 0) >= 0;
    const sign = isUp ? '+' : '';
    const newsItems = (s.news || []).slice(0, 4).map(n => `
      <a class="news-link" href="${n.link || '#'}" target="_blank" rel="noopener">
        <div>${n.title}</div>
        <div class="sub-text">${n.source || ''} · ${n.time || ''}</div>
      </a>`).join('');

    const div = document.createElement('div');
    div.className = 'item-row';
    div.style.flexDirection = 'column';
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; width:100%; align-items:center; cursor:pointer;" class="st-head">
        <div>
          <strong>${s.name}</strong> <span class="badge">${s.market || '全球'}</span>
          <div class="sub-text">${s.symbol} · 点我看大图与指标</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:16px; font-weight:700;">${s.price}</div>
          <div class="${isUp ? 'up' : 'down'}" style="font-size:12px;">${sign}${s.changePct}%</div>
        </div>
      </div>
      <div style="width:100%; cursor:pointer;" class="st-chart">${renderSparklineSVG(s.history, isUp, 46)}</div>
      <div class="news-box" style="width:100%;">
        <div style="font-weight:600; margin-bottom:4px;">📰 每日消息汇总 (${(s.news || []).length}条)</div>
        ${newsItems || '<div class="sub-text">暂无快讯</div>'}
      </div>
    `;
    div.querySelector('.st-head').onclick = () => openStockDetailModal(s);
    div.querySelector('.st-chart').onclick = () => openStockDetailModal(s);
    list.appendChild(div);
  });
}

// 全网实时搜索任意全球股票（Yahoo Finance + Google News RSS）
async function liveSearchGlobalStock(query) {
  const q = query.trim();
  const resBox = document.getElementById('liveSearchResult');
  if (!q) { resBox.innerHTML = ''; return; }
  resBox.innerHTML = '<div class="card" style="background:#eef2ff;">🔍 正在全网检索全球交易所股票与走势图...</div>';
  try {
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=6&newsCount=5`;
    const data = await httpGetJson(searchUrl);
    const quotes = (data.quotes || []).filter(x => x.symbol);
    if (!quotes.length) {
      resBox.innerHTML = '<div class="sub-text" style="padding:8px;">全网未找到匹配代码，建议输入英文代码或公司名（如 AAPL、BABA、600519.SS、0700.HK）</div>';
      return;
    }

    resBox.innerHTML = '<div class="sub-text" style="margin-bottom:6px;">🌐 全网实时检索结果（点任意一只查看实时态势图与新闻）：</div>';
    quotes.forEach(qt => {
      const row = document.createElement('div');
      row.className = 'card';
      row.style.cssText = 'padding:10px; margin-bottom:8px; border:1px solid #c7d2fe; background:#f5f7ff; cursor:pointer;';
      row.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong>${qt.shortname || qt.longname || qt.symbol}</strong>
            <div class="sub-text">${qt.symbol} · ${qt.exchDisp || qt.exchange || ''} (${qt.typeDisp || ''})</div>
          </div>
          <button class="btn btn-sm">查看态势图</button>
        </div>
      `;
      row.onclick = async () => {
        row.querySelector('button').textContent = '加载中...';
        try {
          const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(qt.symbol)}?range=1mo&interval=1d`;
          const cData = await httpGetJson(chartUrl);
          const r = cData.chart.result[0];
          const meta = r.meta;
          const quotesArr = r.indicators.quote[0];
          const closes = (quotesArr.close || []).filter(v => v != null).map(v => Number(v.toFixed(2)));
          const timestamps = r.timestamp || [];
          const dates = timestamps.map(ts => {
            const d = new Date(ts * 1000);
            return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          });
          const price = Number((meta.regularMarketPrice || closes[closes.length - 1] || 0).toFixed(2));
          const prev = Number((meta.chartPreviousClose || closes[closes.length - 2] || price).toFixed(2));
          const change = Number((price - prev).toFixed(2));
          const changePct = prev ? Number(((change / prev) * 100).toFixed(2)) : 0;

          // 同步拉取该股最新中文新闻
          let newsList = [];
          try {
            const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent((qt.shortname || qt.symbol) + ' 股价 新闻')}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
            const xmlText = await httpGetText(rssUrl);
            const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
            newsList = Array.from(doc.querySelectorAll('item')).slice(0, 6).map(it => ({
              title: it.querySelector('title')?.textContent || '',
              source: it.querySelector('source')?.textContent || '财经资讯',
              time: (it.querySelector('pubDate')?.textContent || '').slice(0, 22),
              link: it.querySelector('link')?.textContent || '#'
            }));
          } catch {}

          const fullStock = {
            symbol: qt.symbol,
            name: qt.shortname || qt.longname || qt.symbol,
            market: qt.exchDisp || '自选',
            price, change, changePct,
            open: Number((quotesArr.open?.slice(-1)[0] || 0).toFixed(2)),
            high: Number((quotesArr.high?.slice(-1)[0] || 0).toFixed(2)),
            low: Number((quotesArr.low?.slice(-1)[0] || 0).toFixed(2)),
            volume: quotesArr.volume?.slice(-1)[0] || 0,
            history: closes,
            dates,
            news: newsList
          };
          openStockDetailModal(fullStock);
          // 自动加入自选置顶保存
          customWatchlist = [fullStock, ...customWatchlist.filter(x => x.symbol !== fullStock.symbol)].slice(0, 10);
          localStorage.setItem('custom_watchlist_v1', JSON.stringify(customWatchlist));
          renderStocks('');
        } catch (err) {
          alert('拉取该股票实时数据失败：' + err.message);
        } finally {
          row.querySelector('button').textContent = '查看态势图';
        }
      };
      resBox.appendChild(row);
    });
  } catch (e) {
    resBox.innerHTML = `<div class="sub-text" style="color:#dc2626;">全网搜索需要网络访问权限：${e.message}</div>`;
  }
}

async function fetchMarketData() {
  const repo = localStorage.getItem('github_stock_repo') || DEFAULT_GITHUB_REPO;
  document.getElementById('stockUpdated').textContent = `正在从 ${repo} 同步全球行情与每日消息...`;
  try {
    const url = `https://raw.githubusercontent.com/${repo}/main/data/market_data.json?t=${Date.now()}`;
    marketData = await httpGetJson(url);
    localStorage.setItem('cached_market_v2', JSON.stringify(marketData));
  } catch (e) {
    const cached = localStorage.getItem('cached_market_v2');
    if (cached) marketData = JSON.parse(cached);
    document.getElementById('stockUpdated').textContent = '同步失败（请确认已运行 Update Global Stocks & News 任务）：' + e.message;
  }
  renderStocks(document.getElementById('stockSearch').value);
}

document.querySelectorAll('#regionTabs .day-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#regionTabs .day-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeRegion = btn.dataset.region;
    renderStocks(document.getElementById('stockSearch').value);
  });
});

document.getElementById('refreshStocksBtn').addEventListener('click', fetchMarketData);
document.getElementById('stockSearch').addEventListener('input', (e) => renderStocks(e.target.value));
document.getElementById('stockSearch').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') liveSearchGlobalStock(e.target.value);
});
document.getElementById('liveSearchBtn').addEventListener('click', () => {
  liveSearchGlobalStock(document.getElementById('stockSearch').value);
});
document.getElementById('configRepoBtn').addEventListener('click', () => {
  const cur = localStorage.getItem('github_stock_repo') || DEFAULT_GITHUB_REPO;
  const val = prompt('GitHub 股市数据仓库（格式：用户名/仓库名）：', cur);
  if (val !== null && val.trim()) {
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
