const DAYS_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const PERIOD_MAP = {
  1: ['08:00', '08:45'], 2: ['08:55', '09:40'],
  3: ['10:00', '10:45'], 4: ['10:55', '11:40'],
  5: ['14:00', '14:45'], 6: ['14:55', '15:40'],
  7: ['16:00', '16:45'], 8: ['16:55', '17:40'],
  9: ['19:00', '19:45'], 10: ['19:55', '20:40'],
  11: ['20:50', '21:35'], 12: ['21:40', '22:25']
};

function getMondayDateStr(date = new Date()) {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let termConfig = JSON.parse(localStorage.getItem('term_cfg_v1') || 'null') || {
  totalWeeks: 20,
  startDate: getMondayDateStr()
};
let courses = JSON.parse(localStorage.getItem('courses_v1') || '[]');
let exams = JSON.parse(localStorage.getItem('exams_v1') || '[]');
let selectedDay = new Date().getDay();
let selectedWeek = 0; // 初始化后设为当前周，0 代表“全部周”

let deps = {
  showToast: () => {},
  openModal: () => {},
  closeModal: () => {},
  scheduleAppReminder: async () => {},
  cancelReminder: async () => {},
  syncToDeviceAlarm: async () => {},
  syncToDeviceCalendar: async () => {},
  makeSafeNotifId: () => Math.floor(Math.random() * 2000000000) + 1,
  pickAndSmartRecognize: () => {},
  onDataChanged: () => {}
};

// ==================== 周次计算与匹配逻辑 ====================
export function getCurrentTermWeek() {
  const start = new Date(`${termConfig.startDate || getMondayDateStr()}T00:00:00`);
  if (isNaN(start.getTime())) return 1;
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const wk = Math.floor(diffDays / 7) + 1;
  return Math.max(1, Math.min(Number(termConfig.totalWeeks || 20), wk));
}

function parseCustomWeeksSet(str) {
  const set = new Set();
  String(str || '').split(/[,，、\s]+/).forEach(tok => {
    const t = tok.trim();
    if (!t) return;
    const rm = t.match(/^(\d+)\s*[-~至到]\s*(\d+)$/);
    if (rm) {
      const a = Math.min(Number(rm[1]), Number(rm[2]));
      const b = Math.max(Number(rm[1]), Number(rm[2]));
      for (let i = a; i <= Math.min(b, 40); i++) set.add(i);
    } else if (/^\d+$/.test(t)) {
      set.add(Number(t));
    }
  });
  return set;
}

export function isCourseInWeek(course, weekNum) {
  if (!weekNum || weekNum <= 0) return true;
  const wType = course.weekType || 'all';
  if (wType === 'custom' && course.customWeeks) {
    return parseCustomWeeksSet(course.customWeeks).has(weekNum);
  }
  const ws = Number(course.weekStart || 1);
  const we = Number(course.weekEnd || termConfig.totalWeeks || 20);
  if (weekNum < ws || weekNum > we) return false;
  if (wType === 'odd') return weekNum % 2 === 1;
  if (wType === 'even') return weekNum % 2 === 0;
  return true;
}

function formatWeekBadge(course) {
  const wType = course.weekType || 'all';
  if (wType === 'custom' && course.customWeeks) return `第${course.customWeeks}周`;
  const ws = Number(course.weekStart || 1);
  const we = Number(course.weekEnd || termConfig.totalWeeks || 20);
  const suffix = wType === 'odd' ? '(单)' : (wType === 'even' ? '(双)' : '');
  return `${ws}-${we}周${suffix}`;
}

function saveTermConfig() {
  localStorage.setItem('term_cfg_v1', JSON.stringify(termConfig));
}
function saveCourses() {
  localStorage.setItem('courses_v1', JSON.stringify(courses));
  renderCourses();
  deps.onDataChanged?.();
}
function saveExams() {
  localStorage.setItem('exams_v1', JSON.stringify(exams));
  renderExams();
  deps.onDataChanged?.();
}

export function getCoursesList() { return courses; }
export function getExamsList() { return exams; }

export function getTodayCoursesSummary() {
  const now = new Date();
  const curWk = getCurrentTermWeek();
  const todayList = courses
    .filter(c => Number(c.day) === now.getDay() && isCourseInWeek(c, curWk))
    .sort((a, b) => a.start.localeCompare(b.start));
  return { currentWeek: curWk, todayCourses: todayList };
}

export function getUpcomingExamSummary() {
  return exams
    .filter(e => new Date(e.datetime).getTime() > Date.now())
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
}

// ==================== 闹钟时间换算 ====================
function calcCourseAlarmTime(item) {
  const [h, m] = (item.start || '08:00').split(':').map(Number);
  let totalMin = h * 60 + m - Number(item.advance || 15);
  let dayIndex = Number(item.day);
  if (totalMin < 0) { totalMin += 1440; dayIndex = (dayIndex + 6) % 7; }
  return { hour: Math.floor(totalMin / 60), minute: totalMin % 60, capWeekday: dayIndex + 1 };
}

function getNextWeekdayDate(jsDay, timeStr) {
  const [h, m] = (timeStr || '08:00').split(':').map(Number);
  const now = new Date(), d = new Date(now);
  d.setDate(now.getDate() + ((jsDay - now.getDay() + 7) % 7));
  d.setHours(h, m, 0, 0);
  if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

// ==================== 强化多条智能文本解析（支持起止周/单双周/自定义周/多日程） ====================
export function parseSmartText(rawText) {
  const lines = (rawText || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const parsedCourses = [];
  const parsedEvents = [];

  const dayRegex = /(?:星期|周)([一二三四五六日天1-7])/;
  const dayMap = { '一': 1, '1': 1, '二': 2, '2': 2, '三': 3, '3': 3, '四': 4, '4': 4, '五': 5, '5': 5, '六': 6, '6': 6, '日': 0, '天': 0, '7': 0 };
  const timeRangeRegex = /(\d{1,2})[:：](\d{2})\s*[-~至到]\s*(\d{1,2})[:：](\d{2})/;
  const singleTimeRegex = /(\d{1,2})[:：](\d{2})/;
  const periodRegex = /第?\s*(\d{1,2})\s*[-~至到]?\s*(\d{1,2})?\s*节/;
  const dateRegex = /(?:(\d{4})[-/.年])?\s*(\d{1,2})[-/.月](\d{1,2})日?/;
  const roomRegex = /([教实图综理文工医A-Za-z楼栋室]*\s*[A-Za-z]?-?\d{3,4}[室]?)/;
  const weekRangeRegex = /第?\s*(\d{1,2})\s*[-~至到]\s*(\d{1,2})\s*周(?:\s*[（(]?(单|双)周?[）)]?)?/;
  const customWeeksRegex = /第?\s*((?:\d{1,2}\s*[,，、]\s*)+\d{1,2})\s*周/;
  const oddEvenOnlyRegex = /[（(]?(单周|双周)[）)]?/;
  const yearNow = new Date().getFullYear();

  lines.forEach(line => {
    // 1) 判断是否为带具体日期的考试/日程/闹钟
    const dm = line.match(dateRegex);
    if (dm && !dayRegex.test(line)) {
      const y = dm[1] ? Number(dm[1]) : yearNow;
      const mo = String(Number(dm[2])).padStart(2, '0');
      const da = String(Number(dm[3])).padStart(2, '0');
      const tm = line.match(singleTimeRegex);
      const hh = tm ? String(Number(tm[1])).padStart(2, '0') : '09';
      const mm = tm ? tm[2] : '00';
      const rm = line.match(roomRegex);
      const title = line
        .replace(dateRegex, '')
        .replace(timeRangeRegex, '')
        .replace(singleTimeRegex, '')
        .replace(rm ? rm[0] : '', '')
        .replace(/[,，|]/g, ' ')
        .trim() || '批量导入日程';
      parsedEvents.push({
        type: /考|测验|答辩|四级|六级|期末|期中/.test(line) ? '考试' : (/闹钟|起床|提醒/.test(line) ? '闹钟' : '日程'),
        name: title.slice(0, 32),
        datetime: `${y}-${mo}-${da}T${hh}:${mm}`,
        room: rm ? rm[1].trim() : '',
        note: '批量导入'
      });
      return;
    }

    // 2) 判断是否为课程行（支持周次、起止周、单双周、自定义周）
    const dw = line.match(dayRegex);
    const tr = line.match(timeRangeRegex);
    const pr = line.match(periodRegex);
    if (dw || tr || pr) {
      const day = dw ? (dayMap[dw[1]] ?? 1) : 1;
      let start = '08:00', end = '09:40';
      if (tr) {
        start = `${String(Number(tr[1])).padStart(2, '0')}:${tr[2]}`;
        end = `${String(Number(tr[3])).padStart(2, '0')}:${tr[4]}`;
      } else if (pr) {
        const p1 = Number(pr[1]), p2 = Number(pr[2] || pr[1]);
        start = PERIOD_MAP[p1]?.[0] || '08:00';
        end = PERIOD_MAP[p2]?.[1] || '09:40';
      }

      let weekStart = 1;
      let weekEnd = Number(termConfig.totalWeeks || 16);
      let weekType = 'all';
      let customWeeks = '';

      let rest = line;
      const cw = rest.match(customWeeksRegex);
      const wr = rest.match(weekRangeRegex);
      if (cw) {
        weekType = 'custom';
        customWeeks = cw[1].replace(/[，、\s]+/g, ',');
        rest = rest.replace(cw[0], ' ');
      } else if (wr) {
        weekStart = Number(wr[1]);
        weekEnd = Number(wr[2]);
        if (wr[3] === '单') weekType = 'odd';
        else if (wr[3] === '双') weekType = 'even';
        rest = rest.replace(wr[0], ' ');
      }
      const oe = rest.match(oddEvenOnlyRegex);
      if (oe && weekType === 'all') {
        weekType = oe[1].includes('单') ? 'odd' : 'even';
        rest = rest.replace(oe[0], ' ');
      }

      const cleanForRoom = rest.replace(dayRegex, ' ').replace(timeRangeRegex, ' ').replace(periodRegex, ' ').replace(singleTimeRegex, ' ');
      const rm = cleanForRoom.match(roomRegex);
      const cname = cleanForRoom
        .replace(rm ? rm[0] : '', ' ')
        .replace(/[,，|[\]()（）]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (cname.length >= 1) {
        parsedCourses.push({
          name: cname.slice(0, 26),
          day, start, end,
          room: rm ? rm[1].trim() : '',
          weekStart, weekEnd, weekType, customWeeks
        });
      }
    }
  });
  return { parsedCourses, parsedEvents };
}

// ==================== 课程/日程多条批量导入确认弹窗 ====================
export function showSmartImportReviewModal(rawText, modeTitle = '批量导入与识别确认') {
  const { parsedCourses, parsedEvents } = parseSmartText(rawText);
  const box = document.createElement('div');
  box.innerHTML = `
    <div style="font-size:12px; font-weight:600; margin-bottom:4px;">📄 每行一条（可一次粘贴或编辑多门课/多条日程）：</div>
    <textarea id="ocrRawEdit" style="min-height:115px; font-size:12px;">${(rawText || '').replace(/</g, '&lt;')}</textarea>
    <div style="display:flex; gap:6px; margin:6px 0 10px; flex-wrap:wrap; align-items:center;">
      <button class="btn btn-sm btn-outline" id="reparseBtn">🔄 重新解析</button>
      <button class="btn btn-sm btn-outline" id="toggleAllChkBtn">☑️ 全选/反选</button>
      <select id="batchRemMode" style="width:auto; padding:4px 6px; font-size:11px; flex:1;">
        <option value="alarm" selected>导入提醒：App 15秒响铃</option>
        <option value="vibrate">导入提醒：震动横幅</option>
        <option value="normal">导入提醒：普通通知</option>
      </select>
    </div>
    <div id="parsedPreviewArea"></div>
  `;

  let currentC = parsedCourses;
  let currentE = parsedEvents;

  const renderPreview = (cList, eList) => {
    currentC = cList; currentE = eList;
    const area = box.querySelector('#parsedPreviewArea');
    if (!cList.length && !eList.length) {
      area.innerHTML = `
        <div class="sub-text" style="color:#b45309; padding:9px; background:#fef3c7; border-radius:8px;">
          <strong>支持以下多行格式（每行一条）：</strong><br/>
          <code>高等数学 周一 08:00-09:40 1-16周 教A201</code><br/>
          <code>物理实验 周三 第3-4节 1-16周(单) 实验楼302</code><br/>
          <code>专题研讨 周五 14:00-15:40 2,4,6,8周 教B105</code><br/>
          <code>英语四级考试 2026-12-12 09:00 教C301</code>
        </div>
      `;
      return;
    }
    let html = '';
    if (cList.length) {
      html += `<div style="font-weight:600; font-size:13px; margin:6px 0;">📅 已解析 ${cList.length} 门课程：</div>`;
      cList.forEach((c, i) => {
        html += `<label style="display:flex; gap:6px; align-items:flex-start; padding:6px 0; font-size:12px; border-bottom:1px solid var(--border);">
          <input type="checkbox" class="chk-course batch-chk" data-idx="${i}" checked style="width:auto; margin-top:2px;" />
          <span><strong>${c.name}</strong> <span class="badge">${formatWeekBadge(c)}</span><br/>
          <span class="sub-text">${DAYS_LABEL[c.day]} ${c.start}-${c.end} ${c.room || ''}</span></span>
        </label>`;
      });
    }
    if (eList.length) {
      html += `<div style="font-weight:600; font-size:13px; margin:10px 0 6px;">📝 已解析 ${eList.length} 条考试/日程：</div>`;
      eList.forEach((ev, i) => {
        html += `<label style="display:flex; gap:6px; align-items:flex-start; padding:6px 0; font-size:12px; border-bottom:1px solid var(--border);">
          <input type="checkbox" class="chk-event batch-chk" data-idx="${i}" checked style="width:auto; margin-top:2px;" />
          <span><span class="badge">${ev.type}</span><strong>${ev.name}</strong><br/>
          <span class="sub-text">${ev.datetime.replace('T', ' ')} ${ev.room || ''}</span></span>
        </label>`;
      });
    }
    html += `<button class="btn" id="doSmartImportBtn" style="width:100%; margin-top:12px;">✅ 一键批量导入选中项</button>`;
    area.innerHTML = html;

    area.querySelector('#doSmartImportBtn').onclick = async () => {
      const remMode = box.querySelector('#batchRemMode').value || 'alarm';
      let cc = 0, ec = 0;
      for (const chk of area.querySelectorAll('.chk-course:checked')) {
        await addCourseItem({ ...currentC[Number(chk.dataset.idx)], advance: 15, mode: remMode }, false);
        cc++;
      }
      for (const chk of area.querySelectorAll('.chk-event:checked')) {
        await addExamOrScheduleItem({ ...currentE[Number(chk.dataset.idx)], advance: 30, mode: remMode }, false);
        ec++;
      }
      if (cc) saveCourses();
      if (ec) saveExams();
      deps.closeModal();
      deps.showToast(`✅ 批量导入完成：${cc} 门课程、${ec} 条日程`, 2600);
    };
  };

  renderPreview(parsedCourses, parsedEvents);
  box.querySelector('#reparseBtn').onclick = () => {
    const r = parseSmartText(box.querySelector('#ocrRawEdit').value);
    renderPreview(r.parsedCourses, r.parsedEvents);
  };
  box.querySelector('#toggleAllChkBtn').onclick = () => {
    const all = Array.from(box.querySelectorAll('.batch-chk'));
    const shouldCheck = all.some(c => !c.checked);
    all.forEach(c => { c.checked = shouldCheck; });
  };

  deps.openModal(`🧠 ${modeTitle}`, box);
}

// ==================== 学期设置弹窗 & 周次切换渲染 ====================
function openTermConfigModal() {
  const box = document.createElement('div');
  box.innerHTML = `
    <div class="sub-text" style="margin-bottom:10px;">
      设置本学期第 1 周的周一日期和总周数后，App 会自动计算当前是第几周，并按每周排课精准显示。
    </div>
    <div style="margin-bottom:10px;">
      <div style="font-size:12px; font-weight:600; margin-bottom:4px;">第 1 周开课日期（建议选周一）</div>
      <input id="termStartInp" type="date" value="${termConfig.startDate || getMondayDateStr()}" />
    </div>
    <div style="margin-bottom:12px;">
      <div style="font-size:12px; font-weight:600; margin-bottom:4px;">本学期总周数</div>
      <input id="termTotalInp" type="number" min="1" max="30" value="${termConfig.totalWeeks || 20}" />
    </div>
    <button class="btn" id="saveTermBtn" style="width:100%;">💾 保存学期设置</button>
  `;
  box.querySelector('#saveTermBtn').onclick = () => {
    const sd = box.querySelector('#termStartInp').value || getMondayDateStr();
    const tw = Math.max(1, Math.min(30, Number(box.querySelector('#termTotalInp').value || 20)));
    termConfig = { startDate: sd, totalWeeks: tw };
    saveTermConfig();
    selectedWeek = getCurrentTermWeek();
    renderWeekSwitcher();
    renderCourses();
    deps.closeModal();
    deps.showToast(`✅ 学期已更新：共 ${tw} 周，当前第 ${selectedWeek} 周`);
    deps.onDataChanged?.();
  };
  deps.openModal('📅 学期周次设置', box);
}

function renderWeekSwitcher() {
  const sel = document.getElementById('viewWeekSelect');
  if (!sel) return;
  const total = Number(termConfig.totalWeeks || 20);
  const curWk = getCurrentTermWeek();
  let html = `<option value="0" ${selectedWeek === 0 ? 'selected' : ''}>全部周 (1-${total}周)</option>`;
  for (let w = 1; w <= total; w++) {
    html += `<option value="${w}" ${selectedWeek === w ? 'selected' : ''}>第 ${w} 周${w === curWk ? ' (本周)' : ''}</option>`;
  }
  sel.innerHTML = html;
}

function renderDayTabs() {
  const wrap = document.getElementById('dayTabs');
  if (!wrap) return;
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
  if (!list) return;
  const filtered = courses
    .filter(c => Number(c.day) === Number(selectedDay) && isCourseInWeek(c, selectedWeek))
    .sort((a, b) => a.start.localeCompare(b.start));

  if (!filtered.length) {
    const wkLabel = selectedWeek === 0 ? '全学期' : `第 ${selectedWeek} 周`;
    list.innerHTML = `<div class="sub-text" style="text-align:center; padding:16px;">${wkLabel} · ${DAYS_LABEL[selectedDay]} 暂无排课 ✨</div>`;
    return;
  }
  list.innerHTML = '';
  filtered.forEach(c => {
    const t = calcCourseAlarmTime(c);
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div style="flex:1;">
        <div><strong>${c.name}</strong> <span class="badge">${formatWeekBadge(c)}</span><span class="badge badge-alarm">提前${c.advance}分</span></div>
        <div class="sub-text">🕒 ${c.start}-${c.end} ｜ 📍 ${c.room || '未填教室'}</div>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <button class="btn btn-sm btn-warn sys-alarm-btn">⏰系统闹钟</button>
        <button class="btn btn-sm btn-green sys-cal-btn">📅系统日历</button>
        <button class="btn btn-sm btn-danger del-btn">删除</button>
      </div>
    `;
    div.querySelector('.sys-alarm-btn').onclick = () => deps.syncToDeviceAlarm({
      hour: t.hour, minute: t.minute, message: `上课：${c.name} (${c.room || ''})`, days: [t.capWeekday]
    });
    div.querySelector('.sys-cal-btn').onclick = () => {
      const sD = getNextWeekdayDate(Number(c.day), c.start);
      const eD = getNextWeekdayDate(Number(c.day), c.end);
      const interval = (c.weekType === 'odd' || c.weekType === 'even') ? ';INTERVAL=2' : '';
      deps.syncToDeviceCalendar({
        title: `上课：${c.name}`,
        location: c.room || '',
        description: `${formatWeekBadge(c)} · 每周${DAYS_LABEL[c.day]}`,
        startTimeMs: sD.getTime(),
        endTimeMs: Math.max(eD.getTime(), sD.getTime() + 3600000),
        rrule: `FREQ=WEEKLY${interval};BYDAY=${RRULE_DAYS[Number(c.day)]}`
      });
    };
    div.querySelector('.del-btn').onclick = async () => {
      await deps.cancelReminder(c.notifId);
      courses = courses.filter(x => x.id !== c.id);
      saveCourses();
    };
    list.appendChild(div);
  });
}

async function addCourseItem(item, shouldSave = true) {
  const t = calcCourseAlarmTime(item);
  const notifId = deps.makeSafeNotifId();
  await deps.scheduleAppReminder({
    id: notifId,
    title: `即将上课：${item.name}`,
    body: `${formatWeekBadge(item)} ${item.start}-${item.end} ${item.room || ''}`,
    weeklyWeekday: t.capWeekday, hour: t.hour, minute: t.minute,
    mode: item.mode || 'alarm'
  });
  courses.push({
    weekStart: 1, weekEnd: Number(termConfig.totalWeeks || 16), weekType: 'all', customWeeks: '',
    ...item,
    id: Date.now() + Math.random(),
    notifId
  });
  if (shouldSave) saveCourses();
  return t;
}

async function addExamOrScheduleItem(item, shouldSave = true) {
  const targetMs = new Date(item.datetime).getTime() - Number(item.advance || 0) * 60000;
  const notifId = deps.makeSafeNotifId();
  if (targetMs > Date.now()) {
    await deps.scheduleAppReminder({
      id: notifId,
      title: `${item.type || '日程'}：${item.name}`,
      body: `${item.datetime.replace('T', ' ')} ${item.room || ''}`,
      atDate: new Date(targetMs),
      mode: item.mode || 'alarm'
    });
  }
  exams.push({ ...item, type: item.type || '考试', id: Date.now() + Math.random(), notifId });
  if (shouldSave) saveExams();
  return targetMs;
}

function renderExams() {
  const list = document.getElementById('examList');
  if (!list) return;
  const sorted = [...exams].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  if (!sorted.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">暂无日程 🎯</div>';
    return;
  }
  list.innerHTML = '';
  const now = Date.now();
  sorted.forEach(ex => {
    const diffMs = new Date(ex.datetime).getTime() - now;
    let cd = '已过时', uc = '';
    if (diffMs > 0) {
      const d = Math.floor(diffMs / 86400000);
      const h = Math.floor((diffMs % 86400000) / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      cd = d > 0 ? `剩 ${d}天${h}时` : (h > 0 ? `剩 ${h}时${m}分` : `剩 ${m}分钟`);
      if (d <= 3) uc = 'badge-urgent';
    }
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div style="flex:1;">
        <div><span class="badge">${ex.type || '考试'}</span><strong>${ex.name}</strong> <span class="badge ${uc}">${cd}</span></div>
        <div class="sub-text">📅 ${ex.datetime.replace('T', ' ')} ｜ 📍 ${ex.room || '无'}</div>
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
      deps.syncToDeviceAlarm({ hour: t.getHours(), minute: t.getMinutes(), message: `${ex.type}：${ex.name}` });
    };
    div.querySelector('.sys-cal-btn').onclick = () => {
      const st = new Date(ex.datetime).getTime();
      deps.syncToDeviceCalendar({
        title: `[${ex.type}] ${ex.name}`, location: ex.room || '', description: ex.note || '',
        startTimeMs: st, endTimeMs: st + 7200000
      });
    };
    div.querySelector('.del-btn').onclick = async () => {
      await deps.cancelReminder(ex.notifId);
      exams = exams.filter(x => x.id !== ex.id);
      saveExams();
    };
    list.appendChild(div);
  });
}

// ==================== 初始化绑定 ====================
export function initSchedulePro(hooks) {
  deps = { ...deps, ...(hooks || {}) };
  selectedWeek = getCurrentTermWeek();

  // 自定义周输入框显隐联动
  const wkTypeSel = document.getElementById('cWeekType');
  const customInp = document.getElementById('cCustomWeeks');
  const toggleCustom = () => {
    if (customInp) customInp.style.display = wkTypeSel?.value === 'custom' ? 'block' : 'none';
  };
  wkTypeSel?.addEventListener('change', toggleCustom);
  toggleCustom();

  // 顶部周次切换控件
  document.getElementById('prevWeekBtn')?.addEventListener('click', () => {
    const total = Number(termConfig.totalWeeks || 20);
    selectedWeek = selectedWeek <= 1 ? total : selectedWeek - 1;
    renderWeekSwitcher(); renderCourses();
  });
  document.getElementById('nextWeekBtn')?.addEventListener('click', () => {
    const total = Number(termConfig.totalWeeks || 20);
    selectedWeek = selectedWeek >= total ? 1 : selectedWeek + 1;
    renderWeekSwitcher(); renderCourses();
  });
  document.getElementById('viewWeekSelect')?.addEventListener('change', (e) => {
    selectedWeek = Number(e.target.value); renderCourses();
  });
  document.getElementById('openTermCfgBtn')?.addEventListener('click', openTermConfigModal);

  // 添加单节课程（含起止周/单双周/自定义周）
  document.getElementById('addCourseBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('cName').value.trim();
    if (!name) return alert('请输入课程名称');
    const ws = Math.max(1, Number(document.getElementById('cWeekStart')?.value || 1));
    const we = Math.max(ws, Number(document.getElementById('cWeekEnd')?.value || 16));
    const weekType = document.getElementById('cWeekType')?.value || 'all';
    const customWeeks = (document.getElementById('cCustomWeeks')?.value || '').trim();
    if (weekType === 'custom' && !customWeeks) return alert('请填写自定义周次，如 1,3,5,8-12');

    const item = {
      name,
      day: Number(document.getElementById('cDay').value),
      room: document.getElementById('cRoom').value.trim(),
      start: document.getElementById('cStart').value,
      end: document.getElementById('cEnd').value,
      weekStart: ws, weekEnd: we, weekType, customWeeks,
      advance: Number(document.getElementById('cAdvance').value),
      mode: document.getElementById('cMode').value
    };
    const t = await addCourseItem(item, true);
    document.getElementById('cName').value = '';
    document.getElementById('cRoom').value = '';
    if (item.mode === 'sys_alarm') {
      await deps.syncToDeviceAlarm({ hour: t.hour, minute: t.minute, message: `上课：${item.name}`, days: [t.capWeekday] });
    } else if (item.mode === 'sys_cal') {
      const sD = getNextWeekdayDate(item.day, item.start);
      const eD = getNextWeekdayDate(item.day, item.end);
      await deps.syncToDeviceCalendar({
        title: `上课：${item.name}`, location: item.room, description: `${formatWeekBadge(item)} 每周${DAYS_LABEL[item.day]}`,
        startTimeMs: sD.getTime(), endTimeMs: Math.max(eD.getTime(), sD.getTime() + 3600000),
        rrule: `FREQ=WEEKLY;BYDAY=${RRULE_DAYS[item.day]}`
      });
    } else {
      deps.showToast(`✅ 已添加《${item.name}》(${formatWeekBadge(item)})`);
    }
  });

  // 批量导入多门课程 / 多条日程
  document.getElementById('openBatchCourseBtn')?.addEventListener('click', () => {
    showSmartImportReviewModal(
      '高等数学 周一 08:00-09:40 1-16周 教A101\n' +
      '物理实验 周三 第3-4节 1-16周(单) 实验楼302\n' +
      '化学实验 周三 第3-4节 2-16周(双) 实验楼405\n' +
      '专题讨论 周五 14:00-15:40 1,3,5,9周 教B205',
      '批量导入多门课程'
    );
  });

  document.getElementById('openBatchExamBtn')?.addEventListener('click', () => {
    const y = new Date().getFullYear();
    showSmartImportReviewModal(
      `高等数学期末考 ${y}-12-20 09:00 教A201\n` +
      `英语六级考试 ${y}-12-22 15:00 教B305\n` +
      `论文答辩日程 ${y}-12-28 14:00 综合楼502\n` +
      `早起背单词闹钟 ${y}-12-15 07:00`,
      '批量导入多条考试/日程'
    );
  });

  document.getElementById('smartImportCourseBtn')?.addEventListener('click', deps.pickAndSmartRecognize);
  document.getElementById('smartImportExamBtn')?.addEventListener('click', deps.pickAndSmartRecognize);

  // 添加单条考试/日程
  document.getElementById('addExamBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('eName').value.trim();
    const datetime = document.getElementById('eDateTime').value;
    if (!name || !datetime) return alert('请填写标题和日期时间');
    const item = {
      type: document.getElementById('eType').value, name, datetime,
      room: document.getElementById('eRoom').value.trim(),
      note: document.getElementById('eNote').value.trim(),
      advance: Number(document.getElementById('eAdvance').value),
      mode: document.getElementById('eMode').value
    };
    const targetMs = await addExamOrScheduleItem(item, true);
    document.getElementById('eName').value = '';
    document.getElementById('eRoom').value = '';
    document.getElementById('eNote').value = '';
    if (item.mode === 'sys_alarm') {
      const t = new Date(targetMs);
      await deps.syncToDeviceAlarm({ hour: t.getHours(), minute: t.getMinutes(), message: `${item.type}：${item.name}` });
    } else if (item.mode === 'sys_cal') {
      const st = new Date(datetime).getTime();
      await deps.syncToDeviceCalendar({ title: `[${item.type}] ${item.name}`, location: item.room, description: item.note, startTimeMs: st, endTimeMs: st + 7200000 });
    } else {
      deps.showToast('✅ 日程与提醒已保存');
    }
  });

  renderWeekSwitcher();
  renderDayTabs();
  renderCourses();
  renderExams();
}
