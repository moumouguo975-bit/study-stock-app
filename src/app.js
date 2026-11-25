import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const NativeTools = registerPlugin('NativeTools');
const DEFAULT_GITHUB_REPO = 'moumouguo975-bit/study-stock-app';
const DAYS_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// ==================== 1. 多样提醒引擎（App响铃 + 设备系统闹钟 + 设备系统日历，关App仍有效） ====================
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
      [880, 1174.66, 880, 1318.5].forEach((freq, i) => {
        const osc = ringAudioCtx.createOscillator();
        const gain = ringAudioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const t = ringAudioCtx.currentTime + i * 0.17;
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain); gain.connect(ringAudioCtx.destination);
        osc.start(t); osc.stop(t + 0.16);
      });
      if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150]);
    };
    beep();
    ringInterval = setInterval(beep, 1200);
  } catch {}
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

function makeSafeNotifId() { return Math.floor(Math.random() * 2000000000) + 1; }

async function initNotificationChannels() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.requestPermissions();
    await LocalNotifications.createChannel({
      id: 'alarm_ring_v3',
      name: '课表与日程响铃闹钟',
      description: '15秒真实连续响铃与震动',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: 'alarm_ring.wav'
    });
    await LocalNotifications.createChannel({
      id: 'vibrate_channel_v3',
      name: '震动横幅提醒',
      description: '强震动静音提醒',
      importance: 4,
      vibration: true
    });
    await LocalNotifications.createChannel({
      id: 'normal_channel_v3',
      name: '普通通知',
      description: '常规学习通知',
      importance: 3,
      vibration: false
    });
    LocalNotifications.addListener('localNotificationReceived', (n) => {
      if (n.channelId === 'alarm_ring_v3') startRingingOverlay(n.title, n.body);
    });
    LocalNotifications.addListener('localNotificationActionPerformed', (act) => {
      if (act.notification?.channelId === 'alarm_ring_v3') {
        startRingingOverlay(act.notification.title, act.notification.body);
      }
    });
  } catch (e) { console.error(e); }
}

async function syncToDeviceAlarm({ hour, minute, message, days }) {
  if (!Capacitor.isNativePlatform()) {
    alert(`已模拟同步系统闹钟：${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${message}`);
    return;
  }
  try {
    await NativeTools.setSystemAlarm({
      hour: Number(hour),
      minute: Number(minute),
      message: message || '学财助手闹钟',
      days: days || [],
      skipUi: false
    });
  } catch (e) {
    alert('写入系统闹钟失败：' + e.message);
  }
}

async function syncToDeviceCalendar({ title, location, description, startTimeMs, endTimeMs, rrule }) {
  if (!Capacitor.isNativePlatform()) {
    alert(`已模拟同步系统日历：${title} (${new Date(startTimeMs).toLocaleString()})`);
    return;
  }
  try {
    await NativeTools.addCalendarEvent({
      title: title || '学习日程',
      location: location || '',
      description: description || '',
      startTimeMs,
      endTimeMs: endTimeMs || (startTimeMs + 3600000),
      rrule: rrule || ''
    });
  } catch (e) {
    alert('写入系统日历失败：' + e.message);
  }
}

async function scheduleAppReminder({ id, title, body, atDate, weeklyWeekday, hour, minute, mode }) {
  const isAlarm = mode === 'alarm' || mode === 'sys_alarm';
  const channelId = isAlarm ? 'alarm_ring_v3' : (mode === 'vibrate' ? 'vibrate_channel_v3' : 'normal_channel_v3');
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return;
      const schedule = weeklyWeekday !== undefined
        ? { on: { weekday: weeklyWeekday, hour, minute }, allowWhileIdle: true }
        : { at: atDate, allowWhileIdle: true };
      await LocalNotifications.schedule({
        notifications: [{
          id,
          title: (isAlarm ? '⏰ ' : '🔔 ') + title,
          body,
          channelId,
          schedule,
          sound: isAlarm ? 'alarm_ring.wav' : 'default'
        }]
      });
    } catch {}
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

document.getElementById('testAlarmBtn').addEventListener('click', () => {
  const box = document.createElement('div');
  box.innerHTML = `
    <p class="sub-text" style="margin-bottom:10px;">支持多种提醒方式，其中【系统闹钟】和【系统日历】直接写入手机底层，关掉 App 甚至重启手机依然 100% 准时响铃！</p>
    <button class="btn" id="t5s" style="width:100%; margin-bottom:8px;">🔔 测试 App 5秒后连续响铃</button>
    <button class="btn btn-warn" id="tSys" style="width:100%; margin-bottom:8px;">📱 同步到手机【系统时钟闹钟】(1分钟后)</button>
    <button class="btn btn-green" id="tCal" style="width:100%;">📅 同步到手机【系统日历日程】(10分钟后)</button>
  `;
  box.querySelector('#t5s').onclick = async () => {
    modal.classList.remove('open');
    await scheduleAppReminder({
      id: makeSafeNotifId(), title: '响铃闹钟测试', body: '15秒闹铃正常工作！',
      atDate: new Date(Date.now() + 5000), mode: 'alarm'
    });
    setTimeout(() => { if (document.visibilityState === 'visible') startRingingOverlay('响铃闹钟测试', '铃声正常响起！'); }, 5200);
    alert('5 秒后开始响铃！');
  };
  box.querySelector('#tSys').onclick = async () => {
    modal.classList.remove('open');
    const d = new Date(Date.now() + 65000);
    await syncToDeviceAlarm({ hour: d.getHours(), minute: d.getMinutes(), message: '学财助手系统闹钟测试' });
  };
  box.querySelector('#tCal').onclick = async () => {
    modal.classList.remove('open');
    const start = Date.now() + 600000;
    await syncToDeviceCalendar({ title: '学财助手日程提醒测试', location: '自习室', description: '关掉App后也会由手机系统日历准时提醒', startTimeMs: start, endTimeMs: start + 1800000 });
  };
  openModal('⏰ 多样提醒与设备同步测试', box);
});

// ==================== 2. 导航与通用弹窗 ====================
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

// ==================== 3. 图片 OCR & 文档智能解析课表/日程引擎 ====================
const PERIOD_MAP = {
  1: ['08:00', '08:45'], 2: ['08:55', '09:40'], 3: ['10:00', '10:45'], 4: ['10:55', '11:40'],
  5: ['14:00', '14:45'], 6: ['14:55', '15:40'], 7: ['16:00', '16:45'], 8: ['16:55', '17:40'],
  9: ['19:00', '19:45'], 10: ['19:55', '20:40']
};

function parseSmartText(rawText) {
  const lines = (rawText || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const parsedCourses = [];
  const parsedEvents = [];
  const dayRegex = /(?:星期|周)([一二三四五六日天1-7])/;
  const dayCharMap = { '一': 1, '1': 1, '二': 2, '2': 2, '三': 3, '3': 3, '四': 4, '4': 4, '五': 5, '5': 5, '六': 6, '6': 6, '日': 0, '天': 0, '7': 0 };
  const timeRangeRegex = /(\d{1,2})[:：](\d{2})\s*[-~至到]\s*(\d{1,2})[:：](\d{2})/;
  const singleTimeRegex = /(\d{1,2})[:：](\d{2})/;
  const periodRegex = /第?\s*(\d{1,2})\s*[-~至到]?\s*(\d{1,2})?\s*节/;
  const dateRegex = /(?:(\d{4})[-/.年])?\s*(\d{1,2})[-/.月](\d{1,2})日?/;
  const roomRegex = /([教实图综A-Za-z楼栋室]*\s*[A-Za-z]?-?\d{3,4}[室]?)/;

  const yearNow = new Date().getFullYear();

  lines.forEach(line => {
    // 1. 先检查是否含具体日期 -> 识别为考试/日程/闹钟
    const dm = line.match(dateRegex);
    if (dm && !line.includes('周')) {
      const y = dm[1] ? Number(dm[1]) : yearNow;
      const mo = String(Number(dm[2])).padStart(2, '0');
      const da = String(Number(dm[3])).padStart(2, '0');
      const tm = line.match(singleTimeRegex);
      const hh = tm ? String(Number(tm[1])).padStart(2, '0') : '09';
      const mm = tm ? tm[2] : '00';
      const rm = line.match(roomRegex);
      let title = line.replace(dateRegex, '').replace(timeRangeRegex, '').replace(singleTimeRegex, '').replace(/[,，|]/g, ' ').trim();
      if (!title) title = '识别日程';
      const type = /考|测验|答辩/.test(line) ? '考试' : (/闹钟|起床|吃药/.test(line) ? '闹钟' : '日程');
      parsedEvents.push({
        type,
        name: title.slice(0, 28),
        datetime: `${y}-${mo}-${da}T${hh}:${mm}`,
        room: rm ? rm[1] : '',
        note: '智能识别导入'
      });
      return;
    }

    // 2. 检查是否含星期几或节次/时间段 -> 识别为课程
    const dw = line.match(dayRegex);
    const tr = line.match(timeRangeRegex);
    const pr = line.match(periodRegex);
    if (dw || tr || pr) {
      const day = dw ? (dayCharMap[dw[1]] ?? 1) : 1;
      let start = '08:00', end = '09:40';
      if (tr) {
        start = `${String(Number(tr[1])).padStart(2, '0')}:${tr[2]}`;
        end = `${String(Number(tr[3])).padStart(2, '0')}:${tr[4]}`;
      } else if (pr) {
        const p1 = Number(pr[1]), p2 = Number(pr[2] || pr[1]);
        start = (PERIOD_MAP[p1] && PERIOD_MAP[p1][0]) || '08:00';
        end = (PERIOD_MAP[p2] && PERIOD_MAP[p2][1]) || '09:40';
      } else {
        const st = line.match(singleTimeRegex);
        if (st) {
          const h = Number(st[1]);
          start = `${String(h).padStart(2, '0')}:${st[2]}`;
          end = `${String((h + 1) % 24).padStart(2, '0')}:${st[2]}`;
        }
      }
      const rm = line.match(roomRegex);
      let cname = line
        .replace(dayRegex, '').replace(timeRangeRegex, '').replace(periodRegex, '')
        .replace(singleTimeRegex, '').replace(roomRegex, '').replace(/[,，|]/g, ' ').trim();
      if (cname.length >= 1) {
        parsedCourses.push({
          name: cname.slice(0, 22),
          day, start, end,
          room: rm ? rm[1] : ''
        });
      }
    }
  });

  return { parsedCourses, parsedEvents };
}

async function runSmartRecognizeFromLocalFile(fileRecord) {
  openModal('🧠 智能识别中...', '<div style="text-align:center; padding:24px;">正在通过离线 OCR / 文档引擎提取文字并解析课表与日程，请稍候...</div>');
  try {
    let extractedText = '';
    if (fileRecord.textContent) {
      extractedText = fileRecord.textContent;
    } else if (Capacitor.isNativePlatform() && fileRecord.localPath) {
      const res = await NativeTools.extractText({ localPath: fileRecord.localPath });
      extractedText = res.text || '';
    } else if (fileRecord.blob) {
      extractedText = await fileRecord.blob.text();
    }
    showSmartImportReviewModal(extractedText);
  } catch (e) {
    openModal('识别提示', `<p class="sub-text" style="color:#dc2626;">识别遇到问题：${e.message}</p><p class="sub-text">提示：支持 JPG/PNG 图片、Word(.docx)、Excel(.xlsx)、PPT(.pptx)、TXT/CSV 文档。</p>`);
  }
}

function showSmartImportReviewModal(rawText) {
  const { parsedCourses, parsedEvents } = parseSmartText(rawText);
  const box = document.createElement('div');
  box.innerHTML = `
    <div style="font-size:12px; font-weight:600; margin-bottom:4px;">📄 提取到的原文（可手动微调后重新解析）：</div>
    <textarea id="ocrRawEdit" style="min-height:95px; font-size:12px;">${(rawText || '').replace(/</g, '&lt;')}</textarea>
    <button class="btn btn-sm btn-outline" id="reparseBtn" style="margin:6px 0 10px;">🔄 重新智能解析</button>
    <div id="parsedPreviewArea"></div>
  `;

  const renderPreview = (cList, eList) => {
    const area = box.querySelector('#parsedPreviewArea');
    if (!cList.length && !eList.length) {
      area.innerHTML = `<div class="sub-text" style="color:#b45309; padding:8px; background:#fef3c7; border-radius:8px;">
        暂未匹配到标准格式。你可以在上方文本框整理成每行一条，例如：<br/>
        <code>高等数学 周一 08:00-09:40 教A201</code><br/>
        <code>线性代数考试 2026-12-20 09:00 教B305</code><br/>
        再点“重新智能解析”！
      </div>`;
      return;
    }

    let html = '';
    if (cList.length) {
      html += `<div style="font-weight:600; font-size:13px; margin:6px 0;">📅 识别到 ${cList.length} 节课程：</div>`;
      cList.forEach((c, idx) => {
        html += `<label style="display:flex; gap:6px; align-items:center; padding:5px 0; font-size:12px; border-bottom:1px solid #eee;">
          <input type="checkbox" class="chk-course" data-idx="${idx}" checked style="width:auto;" />
          <span><strong>${c.name}</strong> · ${DAYS_LABEL[c.day]} ${c.start}-${c.end} ${c.room}</span>
        </label>`;
      });
    }
    if (eList.length) {
      html += `<div style="font-weight:600; font-size:13px; margin:10px 0 6px;">📝 识别到 ${eList.length} 条考试/日程：</div>`;
      eList.forEach((ev, idx) => {
        html += `<label style="display:flex; gap:6px; align-items:center; padding:5px 0; font-size:12px; border-bottom:1px solid #eee;">
          <input type="checkbox" class="chk-event" data-idx="${idx}" checked style="width:auto;" />
          <span><span class="badge">${ev.type}</span><strong>${ev.name}</strong> · ${ev.datetime.replace('T', ' ')} ${ev.room}</span>
        </label>`;
      });
    }
    html += `<button class="btn" id="doSmartImportBtn" style="width:100%; margin-top:12px;">✅ 一键导入并设置闹钟</button>`;
    area.innerHTML = html;

    area.querySelector('#doSmartImportBtn').onclick = async () => {
      let cCount = 0, eCount = 0;
      for (const chk of area.querySelectorAll('.chk-course:checked')) {
        const c = cList[Number(chk.dataset.idx)];
        await addCourseItem({ ...c, advance: 15, mode: 'alarm' });
        cCount++;
      }
      for (const chk of area.querySelectorAll('.chk-event:checked')) {
        const ev = eList[Number(chk.dataset.idx)];
        await addExamOrScheduleItem({ ...ev, advance: 30, mode: 'alarm' });
        eCount++;
      }
      modal.classList.remove('open');
      alert(`智能导入完成！已导入 ${cCount} 节课、${eCount} 条日程，并已开启响铃提醒（可在列表中一键同步到系统闹钟或日历）。`);
    };
  };

  renderPreview(parsedCourses, parsedEvents);
  box.querySelector('#reparseBtn').onclick = () => {
    const res = parseSmartText(box.querySelector('#ocrRawEdit').value);
    renderPreview(res.parsedCourses, res.parsedEvents);
  };
  openModal('🧠 智能识别结果确认', box);
}

async function pickAndSmartRecognize() {
  try {
    if (Capacitor.isNativePlatform()) {
      const res = await NativeTools.pickFiles({ accept: '*/*', multiple: false });
      const file = (res.files || [])[0];
      if (!file) return;
      await runSmartRecognizeFromLocalFile(file);
    } else {
      const text = prompt('浏览器预览模式：请直接粘贴课表/日程文字进行智能解析：', '高等数学 周一 08:00-09:40 A201\n英语期末考试 2026-12-25 14:00 B102');
      if (text) showSmartImportReviewModal(text);
    }
  } catch (e) {
    if (!String(e.message).includes('取消')) alert('选择文件失败：' + e.message);
  }
}

document.getElementById('smartImportCourseBtn').addEventListener('click', pickAndSmartRecognize);
document.getElementById('smartImportExamBtn').addEventListener('click', pickAndSmartRecognize);

// ==================== 4. 课表管理 ====================
let courses = JSON.parse(localStorage.getItem('courses_v1') || '[]');
let selectedDay = new Date().getDay();

function calcCourseAlarmTime(item) {
  const [h, m] = (item.start || '08:00').split(':').map(Number);
  let totalMin = h * 60 + m - Number(item.advance || 15);
  let dayIndex = Number(item.day);
  if (totalMin < 0) { totalMin += 1440; dayIndex = (dayIndex + 6) % 7; }
  return { hour: Math.floor(totalMin / 60), minute: totalMin % 60, capWeekday: dayIndex + 1, jsDay: dayIndex };
}

function getNextWeekdayDate(jsDay, timeStr) {
  const [h, m] = (timeStr || '08:00').split(':').map(Number);
  const now = new Date();
  const d = new Date(now);
  const diff = (jsDay - now.getDay() + 7) % 7;
  d.setDate(now.getDate() + diff);
  d.setHours(h, m, 0, 0);
  if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

function saveCourses() { localStorage.setItem('courses_v1', JSON.stringify(courses)); renderCourses(); }

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
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">今天暂无排课，可点击上方“📷 图/文档识课表”智能导入 ✨</div>';
    return;
  }
  list.innerHTML = '';
  filtered.forEach(c => {
    const t = calcCourseAlarmTime(c);
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div style="flex:1;">
        <div><strong>${c.name}</strong> <span class="badge badge-alarm">提前${c.advance}分</span></div>
        <div class="sub-text">🕒 ${c.start}-${c.end} ｜ 📍 ${c.room || '未填教室'}</div>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <button class="btn btn-sm btn-warn sys-alarm-btn">⏰系统闹钟</button>
        <button class="btn btn-sm btn-green sys-cal-btn">📅系统日历</button>
        <button class="btn btn-sm btn-danger del-btn">删除</button>
      </div>
    `;
    div.querySelector('.sys-alarm-btn').onclick = () => syncToDeviceAlarm({
      hour: t.hour, minute: t.minute, message: `上课：${c.name} (${c.room || ''})`, days: [t.capWeekday]
    });
    div.querySelector('.sys-cal-btn').onclick = () => {
      const startD = getNextWeekdayDate(Number(c.day), c.start);
      const endD = getNextWeekdayDate(Number(c.day), c.end);
      syncToDeviceCalendar({
        title: `上课：${c.name}`, location: c.room || '',
        description: `每周${DAYS_LABEL[c.day]} ${c.start}-${c.end}`,
        startTimeMs: startD.getTime(),
        endTimeMs: Math.max(endD.getTime(), startD.getTime() + 3600000),
        rrule: `FREQ=WEEKLY;BYDAY=${RRULE_DAYS[Number(c.day)]}`
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
  await scheduleAppReminder({
    id: notifId, title: `即将上课：${item.name}`,
    body: `时间 ${item.start}-${item.end}，地点：${item.room || '请查看课表'}`,
    weeklyWeekday: t.capWeekday, hour: t.hour, minute: t.minute, mode: item.mode || 'alarm'
  });
  courses.push({ ...item, id: Date.now() + Math.random(), notifId });
  saveCourses();
  return t;
}

document.getElementById('addCourseBtn').addEventListener('click', async () => {
  const name = document.getElementById('cName').value.trim();
  if (!name) return alert('请输入课程名称');
  const item = {
    name, day: Number(document.getElementById('cDay').value),
    room: document.getElementById('cRoom').value.trim(),
    start: document.getElementById('cStart').value, end: document.getElementById('cEnd').value,
    advance: Number(document.getElementById('cAdvance').value), mode: document.getElementById('cMode').value
  };
  const t = await addCourseItem(item);
  document.getElementById('cName').value = '';
  document.getElementById('cRoom').value = '';
  if (item.mode === 'sys_alarm') {
    await syncToDeviceAlarm({ hour: t.hour, minute: t.minute, message: `上课：${item.name} (${item.room})`, days: [t.capWeekday] });
  } else if (item.mode === 'sys_cal') {
    const startD = getNextWeekdayDate(item.day, item.start);
    const endD = getNextWeekdayDate(item.day, item.end);
    await syncToDeviceCalendar({
      title: `上课：${item.name}`, location: item.room, description: `每周${DAYS_LABEL[item.day]}`,
      startTimeMs: startD.getTime(), endTimeMs: Math.max(endD.getTime(), startD.getTime() + 3600000),
      rrule: `FREQ=WEEKLY;BYDAY=${RRULE_DAYS[item.day]}`
    });
  } else {
    alert('课程及提醒已保存！');
  }
});

document.getElementById('openBatchCourseBtn').addEventListener('click', () => {
  showSmartImportReviewModal('高等数学 周一 08:00-09:40 教A101\n大学英语 周三 10:00-11:40 教B205');
});

// ==================== 5. 考试 / 日程 / 闹钟管理 ====================
let exams = JSON.parse(localStorage.getItem('exams_v1') || '[]');
function saveExams() { localStorage.setItem('exams_v1', JSON.stringify(exams)); renderExams(); }

async function addExamOrScheduleItem(item) {
  const targetMs = new Date(item.datetime).getTime() - Number(item.advance || 0) * 60000;
  const notifId = makeSafeNotifId();
  if (targetMs > Date.now()) {
    await scheduleAppReminder({
      id: notifId, title: `${item.type || '日程'}提醒：${item.name}`,
      body: `时间 ${item.datetime.replace('T', ' ')}，地点：${item.room || '无'} ${item.note || ''}`,
      atDate: new Date(targetMs), mode: item.mode || 'alarm'
    });
  }
  exams.push({ ...item, type: item.type || '考试', id: Date.now() + Math.random(), notifId });
  saveExams();
  return targetMs;
}

function renderExams() {
  const list = document.getElementById('examList');
  const sorted = [...exams].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  if (!sorted.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">暂无考试/日程，支持图片文档识别一键导入 🎯</div>';
    return;
  }
  list.innerHTML = '';
  const now = Date.now();
  sorted.forEach(ex => {
    const diffMs = new Date(ex.datetime).getTime() - now;
    let countdown = '已过时', urgentClass = '';
    if (diffMs > 0) {
      const days = Math.floor(diffMs / 86400000);
      const hrs = Math.floor((diffMs % 86400000) / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      countdown = days > 0 ? `剩 ${days}天${hrs}小时` : (hrs > 0 ? `剩 ${hrs}小时${mins}分` : `剩 ${mins}分钟`);
      if (days <= 3) urgentClass = 'badge-urgent';
    }
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div style="flex:1;">
        <div><span class="badge">${ex.type || '考试'}</span><strong>${ex.name}</strong> <span class="badge ${urgentClass}">${countdown}</span></div>
        <div class="sub-text">📅 ${ex.datetime.replace('T', ' ')} ｜ 📍 ${ex.room || '未填地点'}</div>
        ${ex.note ? `<div class="sub-text">📌 ${ex.note}</div>` : ''}
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <button class="btn btn-sm btn-warn sys-alarm-btn">⏰系统闹钟</button>
        <button class="btn btn-sm btn-green sys-cal-btn">📅系统日历</button>
        <button class="btn btn-sm btn-danger del-btn">删除</button>
      </div>
    `;
    div.querySelector('.sys-alarm-btn').onclick = () => {
      const t = new Date(new Date(ex.datetime).getTime() - Number(ex.advance || 0) * 60000);
      syncToDeviceAlarm({ hour: t.getHours(), minute: t.getMinutes(), message: `${ex.type || '日程'}：${ex.name}` });
    };
    div.querySelector('.sys-cal-btn').onclick = () => {
      const st = new Date(ex.datetime).getTime();
      syncToDeviceCalendar({ title: `[${ex.type || '考试'}] ${ex.name}`, location: ex.room || '', description: ex.note || '', startTimeMs: st, endTimeMs: st + 7200000 });
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
  if (!name || !datetime) return alert('请填写标题和日期时间');
  const item = {
    type: document.getElementById('eType').value,
    name, datetime,
    room: document.getElementById('eRoom').value.trim(),
    note: document.getElementById('eNote').value.trim(),
    advance: Number(document.getElementById('eAdvance').value),
    mode: document.getElementById('eMode').value
  };
  const targetMs = await addExamOrScheduleItem(item);
  document.getElementById('eName').value = '';
  document.getElementById('eRoom').value = '';
  document.getElementById('eNote').value = '';
  if (item.mode === 'sys_alarm') {
    const t = new Date(targetMs);
    await syncToDeviceAlarm({ hour: t.getHours(), minute: t.getMinutes(), message: `${item.type}：${item.name}` });
  } else if (item.mode === 'sys_cal') {
    const st = new Date(datetime).getTime();
    await syncToDeviceCalendar({ title: `[${item.type}] ${item.name}`, location: item.room, description: item.note, startTimeMs: st, endTimeMs: st + 7200000 });
  } else {
    alert('日程与提醒已保存！');
  }
});

// ==================== 6. 原生文件资料库（带 OCR / 文档识别入口） ====================
let localFiles = JSON.parse(localStorage.getItem('files_meta_v3') || '[]');
function saveFilesMeta() { localStorage.setItem('files_meta_v3', JSON.stringify(localFiles)); renderFiles(); }

function renderFiles() {
  const filter = document.getElementById('fileFilter').value;
  const items = localFiles.filter(f => filter === 'all' || f.category === filter);
  const list = document.getElementById('fileList');
  if (!items.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">暂无资料，点击上方原生导入图片、Word/Excel/PDF 或新建笔记 📂</div>';
    return;
  }
  list.innerHTML = '';
  items.forEach(f => {
    const srcUrl = f.localPath ? Capacitor.convertFileSrc(f.localPath) : (f.dataUrl || '');
    const div = document.createElement('div');
    div.className = 'item-row';
    const leftHtml = f.category === 'image' && srcUrl
      ? `<img src="${srcUrl}" class="thumb" />`
      : `<div style="font-size:26px; width:46px; text-align:center;">${f.category === 'text' ? '📝' : '📄'}</div>`;
    div.innerHTML = `
      <div style="display:flex; gap:10px; align-items:center; flex:1; cursor:pointer;" class="open-trigger">
        ${leftHtml}
        <div>
          <div style="font-weight:500; word-break:break-all;">${f.name}</div>
          <div class="sub-text"><span class="badge badge-fmt">${f.format || 'FILE'}</span> ${(f.size / 1024).toFixed(1)} KB</div>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <button class="btn btn-sm btn-green ocr-btn">🧠 识课表</button>
        <button class="btn btn-sm btn-danger del-btn">删除</button>
      </div>
    `;
    div.querySelector('.open-trigger').onclick = async () => {
      if (f.category === 'image') {
        openModal(f.name, `<img src="${srcUrl}" style="width:100%; border-radius:8px; margin-bottom:10px;" /><button class="btn btn-green" style="width:100%;" id="mOcr">🧠 OCR 识别图中课表/日程</button>`);
        document.getElementById('mOcr').onclick = () => runSmartRecognizeFromLocalFile(f);
      } else if (f.textContent !== undefined) {
        openModal(f.name, `<pre style="white-space:pre-wrap; font-size:13px;">${f.textContent.replace(/</g, '&lt;')}</pre>`);
      } else {
        openModal(f.name, `<p class="sub-text">格式：${f.format} ｜ 大小：${(f.size / 1024).toFixed(1)} KB</p><button class="btn btn-green" style="width:100%;" id="mDocOcr">🧠 提取文档文字并智能解析课表/日程</button>`);
        document.getElementById('mDocOcr').onclick = () => runSmartRecognizeFromLocalFile(f);
      }
    };
    div.querySelector('.ocr-btn').onclick = () => runSmartRecognizeFromLocalFile(f);
    div.querySelector('.del-btn').onclick = async () => {
      if (Capacitor.isNativePlatform() && f.localPath) {
        try { await NativeTools.deleteLocalFile({ localPath: f.localPath }); } catch {}
      }
      localFiles = localFiles.filter(x => x.id !== f.id);
      saveFilesMeta();
    };
    list.appendChild(div);
  });
}

document.getElementById('nativeImportFileBtn').addEventListener('click', async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeTools.pickFiles({ accept: '*/*', multiple: true });
      for (const f of (res.files || [])) {
        let category = 'doc';
        if ((f.mime || '').startsWith('image/') || /^(JPG|JPEG|PNG|WEBP|GIF|BMP)$/i.test(f.format)) category = 'image';
        else if ((f.mime || '').startsWith('text/') || /^(TXT|MD|CSV)$/i.test(f.format)) category = 'text';
        localFiles.unshift({ id: Date.now() + Math.random(), ...f, category, createdAt: Date.now() });
      }
      saveFilesMeta();
    } catch (e) {
      if (!String(e.message).includes('取消')) alert('导入失败：' + e.message);
    }
  } else {
    document.getElementById('fallbackFileInput').click();
  }
});

document.getElementById('fallbackFileInput').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    const ext = (file.name.split('.').pop() || 'FILE').toUpperCase();
    const isImg = file.type.startsWith('image/');
    const isTxt = file.type.startsWith('text/') || /^(TXT|MD|CSV)$/.test(ext);
    localFiles.unshift({
      id: Date.now() + Math.random(), name: file.name, format: ext, size: file.size,
      category: isImg ? 'image' : (isTxt ? 'text' : 'doc'),
      textContent: isTxt ? await file.text() : undefined,
      dataUrl: isImg ? URL.createObjectURL(file) : undefined, createdAt: Date.now()
    });
  }
  e.target.value = '';
  saveFilesMeta();
});

document.getElementById('openNoteModalBtn').addEventListener('click', () => {
  const box = document.createElement('div');
  box.innerHTML = `
    <input id="noteTitle" placeholder="笔记标题" style="margin-bottom:8px;" />
    <textarea id="noteBody" style="min-height:150px;" placeholder="输入或粘贴文字..."></textarea>
    <button class="btn" style="width:100%; margin-top:10px;" id="saveNoteBtn">保存</button>
  `;
  box.querySelector('#saveNoteBtn').onclick = () => {
    const title = box.querySelector('#noteTitle').value.trim() || '未命名笔记';
    const body = box.querySelector('#noteBody').value;
    localFiles.unshift({
      id: Date.now(), name: title + '.txt', format: 'TXT',
      size: new Blob([body]).size, category: 'text', textContent: body, createdAt: Date.now()
    });
    modal.classList.remove('open');
    saveFilesMeta();
  };
  openModal('新建文字笔记', box);
});
document.getElementById('fileFilter').addEventListener('change', renderFiles);

// ==================== 7. 放松音乐 + 原生多格式音频导入 + EQ 音效系统 ====================
let ambCtx = null, ambNodes = [], ambGain = null, sleepTimeout = null;
function stopAmbient() {
  ambNodes.forEach(n => { try { n.stop?.(); n.disconnect?.(); } catch {} });
  ambNodes = [];
  document.querySelectorAll('.ambient-btn').forEach(b => b.classList.remove('playing'));
  if (sleepTimeout) { clearTimeout(sleepTimeout); sleepTimeout = null; }
  document.getElementById('timerStatus').textContent = '';
}
function applySleepTimer() {
  if (sleepTimeout) { clearTimeout(sleepTimeout); sleepTimeout = null; }
  const mins = Number(document.getElementById('sleepTimer').value);
  if (mins > 0) {
    document.getElementById('timerStatus').textContent = `⏱️ 音乐与白噪音将在 ${mins} 分钟后自动停止`;
    sleepTimeout = setTimeout(() => {
      stopAmbient();
      audioPlayer.pause();
      playPauseBtn.textContent = '▶️ 播放';
    }, mins * 60000);
  } else {
    document.getElementById('timerStatus').textContent = '';
  }
}
document.getElementById('sleepTimer').addEventListener('change', applySleepTimer);

function playAmbient(type, btnEl) {
  stopAmbient();
  ambCtx = ambCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (ambCtx.state === 'suspended') ambCtx.resume();
  ambGain = ambCtx.createGain();
  ambGain.gain.value = Number(document.getElementById('ambientVol').value);
  ambGain.connect(ambCtx.destination);

  if (type === 'alpha') {
    [261.63, 329.63, 392.0, 493.88].forEach(freq => {
      const osc = ambCtx.createOscillator(), g = ambCtx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq; g.gain.value = 0.09;
      osc.connect(g); g.connect(ambGain); osc.start();
      ambNodes.push(osc, g);
    });
  } else {
    const bufferSize = ambCtx.sampleRate * 3;
    const buffer = ambCtx.createBuffer(1, bufferSize, ambCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'fire' || type === 'ocean') { data[i] = (lastOut + 0.02 * w) / 1.02; lastOut = data[i]; data[i] *= 3.5; }
      else data[i] = w * 0.45;
    }
    const noise = ambCtx.createBufferSource();
    noise.buffer = buffer; noise.loop = true;
    const filter = ambCtx.createBiquadFilter();
    filter.type = type === 'rain' ? 'bandpass' : 'lowpass';
    filter.frequency.value = type === 'rain' ? 1100 : (type === 'ocean' ? 420 : 260);
    noise.connect(filter);
    if (type === 'ocean') {
      const lfo = ambCtx.createOscillator(), lfoG = ambCtx.createGain(), wG = ambCtx.createGain();
      lfo.frequency.value = 0.12; lfoG.gain.value = 0.35; wG.gain.value = 0.65;
      lfo.connect(lfoG); lfoG.connect(wG.gain); filter.connect(wG); wG.connect(ambGain);
      lfo.start(); ambNodes.push(lfo, lfoG, wG);
    } else { filter.connect(ambGain); }
    noise.start(); ambNodes.push(noise, filter);
  }
  btnEl.classList.add('playing');
  applySleepTimer();
}
document.querySelectorAll('.ambient-btn').forEach(btn => btn.addEventListener('click', () => playAmbient(btn.dataset.sound, btn)));
document.getElementById('stopAmbientBtn').addEventListener('click', stopAmbient);
document.getElementById('ambientVol').addEventListener('input', (e) => { if (ambGain) ambGain.gain.value = Number(e.target.value); });

// 多格式本地音频 + 3段EQ & 环绕音效引擎
const audioPlayer = document.getElementById('audioPlayer');
const musicSeek = document.getElementById('musicSeek');
const curTimeEl = document.getElementById('curTime');
const durTimeEl = document.getElementById('durTime');
const playPauseBtn = document.getElementById('playPauseBtn');
const loopModeBtn = document.getElementById('loopModeBtn');
let tracks = JSON.parse(localStorage.getItem('tracks_v3') || '[]');
let currentTrackIdx = -1;
let loopMode = 'list'; // list | single | shuffle

// WebAudio EQ 节点
let eqCtx = null, eqSource = null, bassFilter = null, midFilter = null, trebleFilter = null, delayNode = null, wetGain = null;

function ensureEqGraph() {
  if (eqCtx) {
    if (eqCtx.state === 'suspended') eqCtx.resume();
    return;
  }
  try {
    eqCtx = new (window.AudioContext || window.webkitAudioContext)();
    eqSource = eqCtx.createMediaElementSource(audioPlayer);
    bassFilter = eqCtx.createBiquadFilter(); bassFilter.type = 'lowshelf'; bassFilter.frequency.value = 100;
    midFilter = eqCtx.createBiquadFilter(); midFilter.type = 'peaking'; midFilter.frequency.value = 1000; midFilter.Q.value = 1;
    trebleFilter = eqCtx.createBiquadFilter(); trebleFilter.type = 'highshelf'; trebleFilter.frequency.value = 7500;

    // 轻微大厅混响延迟通道
    delayNode = eqCtx.createDelay(); delayNode.delayTime.value = 0.045;
    wetGain = eqCtx.createGain(); wetGain.gain.value = 0.0;

    eqSource.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(eqCtx.destination);

    trebleFilter.connect(delayNode);
    delayNode.connect(wetGain);
    wetGain.connect(eqCtx.destination);
    applyEqSliders();
  } catch (e) {
    console.warn('EQ init skipped:', e);
  }
}

function applyEqSliders() {
  const b = Number(document.getElementById('eqBass').value);
  const m = Number(document.getElementById('eqMid').value);
  const t = Number(document.getElementById('eqTreble').value);
  document.getElementById('eqBassVal').textContent = `${b > 0 ? '+' : ''}${b}dB`;
  document.getElementById('eqMidVal').textContent = `${m > 0 ? '+' : ''}${m}dB`;
  document.getElementById('eqTrebleVal').textContent = `${t > 0 ? '+' : ''}${t}dB`;
  if (bassFilter) bassFilter.gain.value = b;
  if (midFilter) midFilter.gain.value = m;
  if (trebleFilter) trebleFilter.gain.value = t;
}

const EQ_PRESETS = {
  flat:  { b: 0, m: 0, t: 0, wet: 0 },
  bass:  { b: 9, m: 1, t: -1, wet: 0 },
  vocal: { b: -2, m: 6, t: 4, wet: 0 },
  sleep: { b: 2, m: -2, t: -7, wet: 0.08 },
  hall:  { b: 4, m: 1, t: 5, wet: 0.25 }
};

document.querySelectorAll('#eqPresets .eq-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#eqPresets .eq-pill').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    const p = EQ_PRESETS[btn.dataset.eq] || EQ_PRESETS.flat;
    document.getElementById('eqBass').value = p.b;
    document.getElementById('eqMid').value = p.m;
    document.getElementById('eqTreble').value = p.t;
    ensureEqGraph();
    applyEqSliders();
    if (wetGain) wetGain.gain.value = p.wet;
  });
});
['eqBass', 'eqMid', 'eqTreble'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    ensureEqGraph();
    applyEqSliders();
  });
});

document.getElementById('playSpeed').addEventListener('change', (e) => {
  audioPlayer.playbackRate = Number(e.target.value);
});

loopModeBtn.addEventListener('click', () => {
  if (loopMode === 'list') { loopMode = 'single'; loopModeBtn.textContent = '🔂 单曲'; }
  else if (loopMode === 'single') { loopMode = 'shuffle'; loopModeBtn.textContent = '🔀 随机'; }
  else { loopMode = 'list'; loopModeBtn.textContent = '🔁 列表'; }
});

function fmtSec(sec) {
  if (!isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function saveTracks() { localStorage.setItem('tracks_v3', JSON.stringify(tracks)); renderTracks(); }

async function playTrackAt(idx) {
  if (!tracks.length) return;
  currentTrackIdx = (idx + tracks.length) % tracks.length;
  const t = tracks[currentTrackIdx];
  const src = t.localPath ? Capacitor.convertFileSrc(t.localPath) : t.webUrl;
  if (!src) return alert('音频路径无效，请重新导入');

  ensureEqGraph();
  audioPlayer.src = src;
  audioPlayer.playbackRate = Number(document.getElementById('playSpeed').value);
  audioPlayer.load();
  document.getElementById('nowPlaying').textContent = '🎵 ' + t.name;
  const fmtBadge = document.getElementById('nowFormatBadge');
  fmtBadge.textContent = t.format || 'AUDIO';
  fmtBadge.style.display = 'inline-block';

  try {
    await audioPlayer.play();
    playPauseBtn.textContent = '⏸ 暂停';
    applySleepTimer();
  } catch (err) {
    playPauseBtn.textContent = '▶️ 播放';
    alert('该格式暂不支持解码（请确认不是网易云 .ncm / QQ音乐加密格式）：' + err.message);
  }
}

audioPlayer.addEventListener('loadedmetadata', () => { durTimeEl.textContent = fmtSec(audioPlayer.duration); });
audioPlayer.addEventListener('timeupdate', () => {
  curTimeEl.textContent = fmtSec(audioPlayer.currentTime);
  if (audioPlayer.duration) musicSeek.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
});
audioPlayer.addEventListener('ended', () => {
  if (!tracks.length) return;
  if (loopMode === 'single') playTrackAt(currentTrackIdx);
  else if (loopMode === 'shuffle') playTrackAt(Math.floor(Math.random() * tracks.length));
  else playTrackAt(currentTrackIdx + 1);
});
musicSeek.addEventListener('input', () => {
  if (audioPlayer.duration) audioPlayer.currentTime = (Number(musicSeek.value) / 100) * audioPlayer.duration;
});
playPauseBtn.addEventListener('click', () => {
  if (currentTrackIdx < 0 && tracks.length > 0) return playTrackAt(0);
  ensureEqGraph();
  if (audioPlayer.paused) { audioPlayer.play(); playPauseBtn.textContent = '⏸ 暂停'; }
  else { audioPlayer.pause(); playPauseBtn.textContent = '▶️ 播放'; }
});
document.getElementById('prevTrackBtn').addEventListener('click', () => playTrackAt(currentTrackIdx - 1));
document.getElementById('nextTrackBtn').addEventListener('click', () => playTrackAt(currentTrackIdx + 1));

function renderTracks() {
  const list = document.getElementById('trackList');
  if (!tracks.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:10px;">点右上角“+ 导入多格式音乐”，支持 MP3 / FLAC / WAV / M4A / AAC / OGG / OPUS 🎶</div>';
    return;
  }
  list.innerHTML = '';
  tracks.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div style="flex:1; cursor:pointer;" class="play-track">
        <div><span class="badge badge-fmt">${t.format || 'AUDIO'}</span> ${t.name}</div>
        <div class="sub-text">${((t.size || 0) / 1048576).toFixed(2)} MB</div>
      </div>
      <div style="display:flex; gap:4px;">
        <button class="btn btn-sm btn-outline ren-btn">改名</button>
        <button class="btn btn-sm btn-danger del-btn">删除</button>
      </div>
    `;
    div.querySelector('.play-track').onclick = () => playTrackAt(i);
    div.querySelector('.ren-btn').onclick = () => {
      const nn = prompt('输入新的歌曲名称：', t.name);
      if (nn && nn.trim()) { t.name = nn.trim(); saveTracks(); }
    };
    div.querySelector('.del-btn').onclick = async () => {
      if (Capacitor.isNativePlatform() && t.localPath) {
        try { await NativeTools.deleteLocalFile({ localPath: t.localPath }); } catch {}
      }
      tracks = tracks.filter(x => x.id !== t.id);
      saveTracks();
    };
    list.appendChild(div);
  });
}

document.getElementById('nativeImportMusicBtn').addEventListener('click', async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeTools.pickFiles({ accept: 'audio/*', multiple: true });
      const added = res.files || [];
      for (const f of added) {
        tracks.push({ id: Date.now() + Math.random(), ...f });
      }
      saveTracks();
      if (added.length) playTrackAt(tracks.length - 1);
    } catch (e) {
      if (!String(e.message).includes('取消')) alert('导入音频失败：' + e.message);
    }
  } else {
    document.getElementById('fallbackMusicInput').click();
  }
});

document.getElementById('fallbackMusicInput').addEventListener('change', (e) => {
  for (const file of e.target.files) {
    const fmt = (file.name.split('.').pop() || 'AUDIO').toUpperCase();
    tracks.push({ id: Date.now() + Math.random(), name: file.name, format: fmt, size: file.size, webUrl: URL.createObjectURL(file) });
  }
  e.target.value = '';
  saveTracks();
  if (tracks.length) playTrackAt(tracks.length - 1);
});

// ==================== 8. 全球股市 + 可滑动交互态势图 + 双引擎全网任意搜股 ====================
let marketData = { updatedAt: '加载中...', globalNews: [], indices: [], stocks: [] };
let activeRegion = 'all';
let customWatchlist = JSON.parse(localStorage.getItem('custom_watchlist_v1') || '[]');

async function httpGetJson(url) {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36' }
    });
    return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  } else {
    const res = await fetch(url);
    return await res.json();
  }
}

async function httpGetText(url) {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url, headers: { 'User-Agent': 'Mozilla/5.0' } });
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  } else {
    const res = await fetch(url);
    return await res.text();
  }
}

// 静态迷你走势图（列表卡片用）
function renderMiniSparkline(history, isUp, height = 40) {
  if (!history || history.length < 2) return `<div class="sub-text" style="height:${height}px;">暂无走势</div>`;
  const min = Math.min(...history), max = Math.max(...history), span = max - min || 1;
  const w = 240, pad = 3;
  const pts = history.map((v, i) => [
    (pad + (i / (history.length - 1)) * (w - pad * 2)).toFixed(1),
    (height - pad - ((v - min) / span) * (height - pad * 2)).toFixed(1)
  ]);
  const line = pts.map(p => p.join(',')).join(' ');
  const area = `${pts[0][0]},${height} ${line} ${pts[pts.length - 1][0]},${height}`;
  const color = isUp ? '#ef4444' : '#10b981';
  const fill = isUp ? 'rgba(239,68,68,0.14)' : 'rgba(16,185,129,0.14)';
  return `<svg viewBox="0 0 ${w} ${height}" preserveAspectRatio="none" style="width:100%; height:${height}px; display:block;">
    <polygon points="${area}" fill="${fill}" />
    <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}

// 手指滑动显示精确价格和时间的交互态势图！
function mountInteractiveChart(container, history, dates, isUp) {
  container.innerHTML = '';
  if (!history || history.length < 2) {
    container.innerHTML = '<div class="sub-text" style="padding:20px; text-align:center;">暂无走势数据</div>';
    return;
  }

  const scrubBar = document.createElement('div');
  scrubBar.className = 'scrub-bar';
  const lastIdx = history.length - 1;
  const firstVal = history[0] || 1;
  const updateReadout = (idx) => {
    const val = history[idx];
    const dt = (dates && dates[idx]) ? dates[idx] : `第${idx + 1}点`;
    const diffPct = (((val - firstVal) / firstVal) * 100).toFixed(2);
    const sign = Number(diffPct) >= 0 ? '+' : '';
    scrubBar.innerHTML = `<span>🕒 ${dt}</span><span>💰 <strong>${val}</strong></span><span class="${Number(diffPct) >= 0 ? 'up' : 'down'}">区间 ${sign}${diffPct}%</span>`;
  };
  updateReadout(lastIdx);

  const chartBox = document.createElement('div');
  chartBox.className = 'chart-interactive';

  const w = 320, h = 155, pad = 10;
  const min = Math.min(...history), max = Math.max(...history), span = max - min || 1;
  const coords = history.map((v, i) => ({
    x: pad + (i / (history.length - 1)) * (w - pad * 2),
    y: h - pad - ((v - min) / span) * (h - pad * 2)
  }));
  const line = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = `${coords[0].x.toFixed(1)},${h - pad} ${line} ${coords[lastIdx].x.toFixed(1)},${h - pad}`;
  const color = isUp ? '#ef4444' : '#10b981';
  const fill = isUp ? 'rgba(239,68,68,0.16)' : 'rgba(16,185,129,0.16)';

  chartBox.innerHTML = `
    <svg id="scrubSvg" viewBox="0 0 ${w} ${h}" style="width:100%; height:160px; display:block;">
      <polygon points="${area}" fill="${fill}" />
      <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      <line id="crossLine" x1="${coords[lastIdx].x}" y1="${pad}" x2="${coords[lastIdx].x}" y2="${h - pad}" stroke="#6366f1" stroke-width="1.4" stroke-dasharray="4 3" />
      <circle id="crossDot" cx="${coords[lastIdx].x}" cy="${coords[lastIdx].y}" r="5" fill="${color}" stroke="#fff" stroke-width="2" />
    </svg>
    <div class="time-row"><span>低: ${min.toFixed(2)}</span><span>👆 左右滑动查看精确时间与价格</span><span>高: ${max.toFixed(2)}</span></div>
  `;

  const svg = chartBox.querySelector('#scrubSvg');
  const crossLine = chartBox.querySelector('#crossLine');
  const crossDot = chartBox.querySelector('#crossDot');

  const handleMove = (clientX) => {
    const rect = svg.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const idx = Math.round(ratio * (history.length - 1));
    const pt = coords[idx];
    crossLine.setAttribute('x1', pt.x);
    crossLine.setAttribute('x2', pt.x);
    crossDot.setAttribute('cx', pt.x);
    crossDot.setAttribute('cy', pt.y);
    updateReadout(idx);
  };

  svg.addEventListener('touchstart', (e) => { if (e.touches[0]) handleMove(e.touches[0].clientX); }, { passive: true });
  svg.addEventListener('touchmove', (e) => { if (e.touches[0]) { e.preventDefault(); handleMove(e.touches[0].clientX); } }, { passive: false });
  svg.addEventListener('pointerdown', (e) => handleMove(e.clientX));
  svg.addEventListener('pointermove', (e) => { if (e.buttons > 0 || e.pointerType === 'mouse') handleMove(e.clientX); });

  container.appendChild(scrubBar);
  container.appendChild(chartBox);
}

async function fetchLiveChartForRange(symbol, range, interval) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const cData = await httpGetJson(url);
  const r = cData.chart.result[0];
  const meta = r.meta || {};
  const q = r.indicators.quote[0] || {};
  const rawCloses = q.close || [];
  const timestamps = r.timestamp || [];
  const history = [], dates = [];

  for (let i = 0; i < rawCloses.length; i++) {
    if (rawCloses[i] != null) {
      history.push(Number(rawCloses[i].toFixed(2)));
      const d = new Date((timestamps[i] || 0) * 1000);
      const label = range === '5d'
        ? `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dates.push(label);
    }
  }
  const price = Number((meta.regularMarketPrice || history[history.length - 1] || 0).toFixed(2));
  const prev = Number((meta.chartPreviousClose || history[0] || price).toFixed(2));
  const change = Number((price - prev).toFixed(2));
  const changePct = prev ? Number(((change / prev) * 100).toFixed(2)) : 0;
  return {
    price, change, changePct, history, dates,
    open: Number((q.open?.filter(v => v != null).slice(-1)[0] || 0).toFixed(2)),
    high: Number((q.high?.filter(v => v != null).slice(-1)[0] || 0).toFixed(2)),
    low: Number((q.low?.filter(v => v != null).slice(-1)[0] || 0).toFixed(2)),
    volume: q.volume?.filter(v => v != null).slice(-1)[0] || 0
  };
}

function openStockDetailModal(item) {
  const isUp = (item.changePct || 0) >= 0;
  const sign = isUp ? '+' : '';
  const box = document.createElement('div');
  const newsHtml = (item.news && item.news.length)
    ? item.news.map(n => `
        <a class="news-link" href="${n.link || '#'}" target="_blank" rel="noopener">
          <div style="font-weight:500;">${n.title}</div>
          <div class="sub-text">${n.source || '财经'} · ${n.time || ''}</div>
        </a>`).join('')
    : '<div class="sub-text">暂无快讯</div>';

  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
      <span id="mdPrice" style="font-size:26px; font-weight:700;">${item.price ?? '--'}</span>
      <span id="mdChg" class="${isUp ? 'up' : 'down'}" style="font-size:15px;">${sign}${item.change ?? 0} (${sign}${item.changePct ?? 0}%)</span>
    </div>
    <div class="day-tabs" id="rangeTabs" style="margin-bottom:6px;">
      <button class="day-pill" data-r="5d" data-i="30m">5日分时</button>
      <button class="day-pill active" data-r="1mo" data-i="1d">1月</button>
      <button class="day-pill" data-r="3mo" data-i="1d">3月</button>
      <button class="day-pill" data-r="1y" data-i="1wk">1年</button>
    </div>
    <div id="interactiveChartHost" style="margin-bottom:10px;"></div>
    ${item.open ? `
      <div class="form-grid" style="font-size:12px; background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:10px;">
        <div>今开：<strong>${item.open}</strong></div>
        <div>成交量：<strong>${item.volume ? (item.volume / 10000).toFixed(1) + '万' : '--'}</strong></div>
        <div>最高：<strong class="up">${item.high}</strong></div>
        <div>最低：<strong class="down">${item.low}</strong></div>
      </div>` : ''}
    <div style="font-weight:600; margin-bottom:6px;">📰 每日消息汇总</div>
    <div class="news-box">${newsHtml}</div>
  `;

  const host = box.querySelector('#interactiveChartHost');
  mountInteractiveChart(host, item.history, item.dates, isUp);

  box.querySelectorAll('#rangeTabs .day-pill').forEach(btn => {
    btn.addEventListener('click', async () => {
      box.querySelectorAll('#rangeTabs .day-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      host.innerHTML = '<div class="sub-text" style="padding:30px; text-align:center;">正在加载实时走势数据...</div>';
      try {
        const res = await fetchLiveChartForRange(item.symbol, btn.dataset.r, btn.dataset.i);
        const upNow = res.changePct >= 0;
        mountInteractiveChart(host, res.history, res.dates, upNow);
      } catch (e) {
        host.innerHTML = `<div class="sub-text" style="color:#dc2626; padding:12px;">加载该周期走势失败：${e.message}</div>`;
      }
    });
  });

  openModal(`${item.name} (${item.symbol})`, box);
}

function renderStocks(keyword = '') {
  document.getElementById('stockUpdated').textContent = '更新时间：' + (marketData.updatedAt || '--');

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
      ${renderMiniSparkline(i.history, isUp, 36)}
    `;
    box.onclick = () => openStockDetailModal(i);
    idxGrid.appendChild(box);
  });

  const gnList = document.getElementById('globalNewsList');
  const gNews = marketData.globalNews || [];
  gnList.innerHTML = gNews.length
    ? gNews.map(n => `
        <a class="news-link" href="${n.link || '#'}" target="_blank" rel="noopener">
          <div style="font-size:13px;">${n.title}</div>
          <div class="sub-text">${n.source} · ${n.time}</div>
        </a>`).join('')
    : '<div class="sub-text">点击上方“刷新”获取全球头条</div>';

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
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:12px;">本地自选未匹配，请点右边 <strong>🔍 全网搜</strong> 实时检索全球任意一只股票！</div>';
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
          <div class="sub-text">${s.symbol} · 点开滑动看精确价格与时间</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:16px; font-weight:700;">${s.price}</div>
          <div class="${isUp ? 'up' : 'down'}" style="font-size:12px;">${sign}${s.changePct}%</div>
        </div>
      </div>
      <div style="width:100%; cursor:pointer;" class="st-chart">${renderMiniSparkline(s.history, isUp, 44)}</div>
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

// 东方财富 + Yahoo Finance 双引擎全网任意搜股（支持中文、A股/港股/美股/欧日/加密货币）
function mapEastMoneyToYahooSymbol(item) {
  const code = String(item.Code || '');
  const mkt = String(item.MktNum || '');
  if (mkt === '1') return `${code}.SS`;
  if (mkt === '0') return `${code}.SZ`;
  if (mkt === '116') {
    const clean = code.length === 5 && code.startsWith('0') ? code.slice(1) : code.padStart(4, '0');
    return `${clean}.HK`;
  }
  return code;
}

async function liveSearchGlobalStock(query) {
  const q = query.trim();
  const resBox = document.getElementById('liveSearchResult');
  if (!q) { resBox.innerHTML = ''; return; }
  resBox.innerHTML = '<div class="card" style="background:#eef2ff;">🔍 正在通过全球双引擎检索所有交易所个股...</div>';

  const candidates = [];
  const seen = new Set();
  const pushCand = (c) => {
    if (!c.symbol || seen.has(c.symbol.toUpperCase())) return;
    seen.add(c.symbol.toUpperCase());
    candidates.push(c);
  };

  // 引擎1：东方财富（对中文名、A股、港股、中概股极其精准）
  try {
    const emUrl = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(q)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=6`;
    const emData = await httpGetJson(emUrl);
    const rows = emData?.QuotationCodeTable?.Data || [];
    rows.forEach(r => {
      pushCand({
        symbol: mapEastMoneyToYahooSymbol(r),
        name: r.Name || r.Code,
        market: r.SecurityTypeName || '全球'
      });
    });
  } catch {}

  // 引擎2：Yahoo Finance（全球美/欧/日/印/加密全覆盖）
  try {
    const yfUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=6&newsCount=3`;
    const yfData = await httpGetJson(yfUrl);
    (yfData.quotes || []).forEach(qt => {
      if (qt.symbol) {
        pushCand({
          symbol: qt.symbol,
          name: qt.shortname || qt.longname || qt.symbol,
          market: qt.exchDisp || qt.exchange || '全球'
        });
      }
    });
  } catch {}

  if (!candidates.length) {
    resBox.innerHTML = '<div class="sub-text" style="padding:8px;">全网未找到匹配股票，请检查拼写或直接输入代码（如 600519、0700、AAPL、TSLA）。</div>';
    return;
  }

  resBox.innerHTML = '<div class="sub-text" style="margin-bottom:6px;">🌐 全网检索到以下股票（点击查看实时可滑动态势图与每日新闻）：</div>';
  candidates.slice(0, 8).forEach(cand => {
    const row = document.createElement('div');
    row.className = 'card';
    row.style.cssText = 'padding:10px; margin-bottom:8px; border:1px solid #c7d2fe; background:#f5f7ff; cursor:pointer;';
    row.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong>${cand.name}</strong>
          <div class="sub-text">${cand.symbol} · ${cand.market}</div>
        </div>
        <button class="btn btn-sm">看态势图</button>
      </div>
    `;
    row.onclick = async () => {
      row.querySelector('button').textContent = '加载中...';
      try {
        const chartInfo = await fetchLiveChartForRange(cand.symbol, '1mo', '1d');
        let newsList = [];
        try {
          const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(cand.name + ' ' + cand.symbol + ' 股价 新闻')}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
          const xmlText = await httpGetText(rssUrl);
          const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
          newsList = Array.from(doc.querySelectorAll('item')).slice(0, 6).map(it => ({
            title: it.querySelector('title')?.textContent || '',
            source: it.querySelector('source')?.textContent || '财经资讯',
            time: (it.querySelector('pubDate')?.textContent || '').slice(0, 22),
            link: it.querySelector('link')?.textContent || '#'
          }));
        } catch {}

        const fullStock = { ...cand, ...chartInfo, news: newsList };
        openStockDetailModal(fullStock);
        customWatchlist = [fullStock, ...customWatchlist.filter(x => x.symbol !== fullStock.symbol)].slice(0, 12);
        localStorage.setItem('custom_watchlist_v1', JSON.stringify(customWatchlist));
        renderStocks('');
      } catch (err) {
        alert('拉取实时走势失败：' + err.message);
      } finally {
        row.querySelector('button').textContent = '看态势图';
      }
    };
    resBox.appendChild(row);
  });
}

async function fetchMarketData() {
  const repo = localStorage.getItem('github_stock_repo') || DEFAULT_GITHUB_REPO;
  document.getElementById('stockUpdated').textContent = `正在同步 ${repo} 全球股市...`;
  try {
    const url = `https://raw.githubusercontent.com/${repo}/main/data/market_data.json?t=${Date.now()}`;
    marketData = await httpGetJson(url);
    localStorage.setItem('cached_market_v3', JSON.stringify(marketData));
  } catch (e) {
    const cached = localStorage.getItem('cached_market_v3');
    if (cached) marketData = JSON.parse(cached);
    document.getElementById('stockUpdated').textContent = '同步失败（请确认网络畅通）：' + e.message;
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
  await initNotificationChannels();
  renderDayTabs();
  renderCourses();
  renderExams();
  renderFiles();
  renderTracks();
  fetchMarketData();
})();
