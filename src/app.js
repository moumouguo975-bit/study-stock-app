import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const NativeTools = registerPlugin('NativeTools');
const DEFAULT_GITHUB_REPO = 'moumouguo975-bit/study-stock-app';
const DAYS_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// ==================== 通用网络工具 ====================
async function httpGetJson(url, extraHeaders = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
    ...extraHeaders
  };
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url, headers });
    return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  }
  const res = await fetch(url);
  return await res.json();
}

async function httpGetText(url, extraHeaders = {}) {
  const headers = { 'User-Agent': 'Mozilla/5.0', ...extraHeaders };
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url, headers });
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  }
  const res = await fetch(url);
  return await res.text();
}

// ==================== 0. 个性化外观设置（配色 / 黑夜跟随系统 / 毛玻璃 / 字体） ====================
const FONT_MAP = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  serif: '"Noto Serif SC", "Songti SC", Georgia, serif',
  mono: '"JetBrains Mono", Consolas, "Courier New", monospace',
  rounded: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", ui-rounded, sans-serif'
};

let appPrefs = JSON.parse(localStorage.getItem('app_prefs_v1') || 'null') || {
  color: '#4f46e5',
  darkMode: 'system',
  glass: false,
  fontFamily: 'system',
  fontSize: '14px'
};

const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

function hexToSoftBg(hex) {
  const clean = (hex || '#4f46e5').replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 79;
  const g = parseInt(clean.slice(2, 4), 16) || 70;
  const b = parseInt(clean.slice(4, 6), 16) || 229;
  return `rgba(${r}, ${g}, ${b}, 0.14)`;
}

function applyAppearance() {
  const root = document.documentElement;
  root.style.setProperty('--primary', appPrefs.color || '#4f46e5');
  root.style.setProperty('--primary-light', hexToSoftBg(appPrefs.color));
  root.style.setProperty('--app-font', FONT_MAP[appPrefs.fontFamily] || FONT_MAP.system);
  root.style.setProperty('--app-size', appPrefs.fontSize || '14px');

  const isDark = appPrefs.darkMode === 'dark' || (appPrefs.darkMode === 'system' && darkMediaQuery.matches);
  document.body.classList.toggle('dark-mode', isDark);
  document.body.classList.toggle('glass-mode', !!appPrefs.glass);

  // 同步弹窗控件状态
  document.getElementById('customColorPicker').value = appPrefs.color || '#4f46e5';
  document.getElementById('darkModeSelect').value = appPrefs.darkMode || 'system';
  document.getElementById('glassModeToggle').checked = !!appPrefs.glass;
  document.getElementById('fontFamilySelect').value = appPrefs.fontFamily || 'system';
  document.getElementById('fontSizeSelect').value = appPrefs.fontSize || '14px';
  document.querySelectorAll('#colorSwatches .swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.color.toLowerCase() === (appPrefs.color || '').toLowerCase());
  });
}

function savePrefs() {
  localStorage.setItem('app_prefs_v1', JSON.stringify(appPrefs));
  applyAppearance();
}

darkMediaQuery.addEventListener?.('change', applyAppearance);

const settingsModal = document.getElementById('settingsModal');
document.getElementById('openSettingsBtn').addEventListener('click', () => {
  applyAppearance();
  settingsModal.classList.add('open');
});
document.getElementById('closeSettingsBtn').addEventListener('click', () => settingsModal.classList.remove('open'));
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.classList.remove('open');
});
document.querySelectorAll('#colorSwatches .swatch').forEach(s => {
  s.addEventListener('click', () => {
    appPrefs.color = s.dataset.color;
    savePrefs();
  });
});
document.getElementById('customColorPicker').addEventListener('input', (e) => {
  appPrefs.color = e.target.value;
  savePrefs();
});
document.getElementById('darkModeSelect').addEventListener('change', (e) => {
  appPrefs.darkMode = e.target.value;
  savePrefs();
});
document.getElementById('glassModeToggle').addEventListener('change', (e) => {
  appPrefs.glass = e.target.checked;
  savePrefs();
});
document.getElementById('fontFamilySelect').addEventListener('change', (e) => {
  appPrefs.fontFamily = e.target.value;
  savePrefs();
});
document.getElementById('fontSizeSelect').addEventListener('change', (e) => {
  appPrefs.fontSize = e.target.value;
  savePrefs();
});

// ==================== 1. 多地区自动定位时钟 + 24h每小时 & 7天滑动天气 + 互动建议 ====================
const DEVICE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
let savedCities = JSON.parse(localStorage.getItem('weather_cities_v2') || 'null') || [
  { id: 'local', name: '当前位置', isLocal: true, lat: null, lon: null, timezone: DEVICE_TZ }
];
let activeCityId = localStorage.getItem('active_city_id_v2') || 'local';
let activeWeatherBundle = null;

const WMO_MAP = {
  0: ['☀️', '晴朗'], 1: ['🌤️', '晴间多云'], 2: ['⛅', '多云'], 3: ['☁️', '阴天'],
  45: ['🌫️', '有雾'], 48: ['🌫️', '冻雾'], 51: ['🌦️', '小毛雨'], 53: ['🌦️', '毛毛雨'], 55: ['🌧️', '浓毛雨'],
  61: ['🌧️', '小雨'], 63: ['🌧️', '中雨'], 65: ['🌧️', '大雨'], 71: ['❄️', '小雪'], 73: ['❄️', '中雪'], 75: ['❄️', '大雪'],
  80: ['🌦️', '阵雨'], 81: ['🌧️', '中阵雨'], 82: ['⛈️', '强阵雨'], 95: ['⛈️', '雷阵雨'], 96: ['⛈️', '雷暴'], 99: ['⛈️', '强雷暴']
};
function wmoDesc(code) { return WMO_MAP[code] || ['🌤️', '多云']; }

function getActiveCity() {
  return savedCities.find(c => c.id === activeCityId) || savedCities[0];
}

function saveCities() {
  localStorage.setItem('weather_cities_v2', JSON.stringify(savedCities));
  localStorage.setItem('active_city_id_v2', activeCityId);
}

function updateLiveClock() {
  const city = getActiveCity();
  const tz = city?.timezone || DEVICE_TZ;
  const now = new Date();
  try {
    const timeStr = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(now);
    const dateStr = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz, year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    }).format(now);
    document.getElementById('liveClock').textContent = timeStr;
    document.getElementById('liveDate').textContent = dateStr;
    document.getElementById('liveTzLabel').textContent = `${city.isLocal ? '📍 设备时区' : '🌍 当地时区'} · ${tz}`;
  } catch {
    document.getElementById('liveClock').textContent = now.toTimeString().slice(0, 8);
  }
}

function renderCityTabs() {
  const bar = document.getElementById('cityTabs');
  bar.innerHTML = '';
  savedCities.forEach(c => {
    const pill = document.createElement('button');
    pill.className = 'city-pill' + (c.id === activeCityId ? ' active' : '');
    pill.textContent = c.isLocal ? `📍 ${c.name}` : `${c.name} ×`;
    pill.onclick = () => {
      if (c.id === activeCityId && !c.isLocal) {
        if (confirm(`是否删除地区【${c.name}】？`)) {
          savedCities = savedCities.filter(x => x.id !== c.id);
          activeCityId = 'local';
          saveCities();
          renderCityTabs();
          loadActiveCityWeather();
        }
        return;
      }
      activeCityId = c.id;
      saveCities();
      renderCityTabs();
      updateLiveClock();
      loadActiveCityWeather();
    };
    bar.appendChild(pill);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'city-pill';
  addBtn.textContent = '+ 添加地区';
  addBtn.onclick = addNewCityDialog;
  bar.appendChild(addBtn);
}

async function addNewCityDialog() {
  const val = prompt('输入要添加的城市或地区名（支持中英文，如 上海、香港、东京、纽约、伦敦）：');
  if (!val || !val.trim()) return;
  try {
    const geo = await httpGetJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(val.trim())}&count=1&language=zh&format=json`
    );
    const loc = geo?.results?.[0];
    if (!loc) return alert('未找到该地区，请换个名称试试');
    const newCity = {
      id: 'city_' + Date.now(),
      name: loc.name,
      isLocal: false,
      lat: loc.latitude,
      lon: loc.longitude,
      timezone: loc.timezone || DEVICE_TZ
    };
    savedCities.push(newCity);
    activeCityId = newCity.id;
    saveCities();
    renderCityTabs();
    updateLiveClock();
    loadActiveCityWeather();
  } catch (e) {
    alert('添加地区失败：' + e.message);
  }
}

function buildSmartAdvice(overrideLabel, temp, precip, code) {
  const city = getActiveCity();
  const tips = [];
  const label = overrideLabel || `${city.name}当前`;

  if (precip >= 40 || (code >= 51 && code <= 99)) {
    tips.push(`☔ ${label}降水概率 ${precip}%，外出记得随身带伞、注意防滑！`);
  }
  if (temp <= 8) {
    tips.push(`🧥 ${label}气温偏低 (${temp}°C)，建议穿厚外套或羽绒服保暖。`);
  } else if (temp >= 29) {
    tips.push(`🕶️ ${label}气温较高 (${temp}°C)，注意防晒、多补充水分。`);
  } else {
    tips.push(`🌤️ ${label}温度约 ${temp}°C，体感舒适，非常适合学习与出行。`);
  }

  // 若看的是本地城市，结合今日课表与考试生成贴心建议
  if (city.isLocal && !overrideLabel) {
    const now = new Date();
    const hr = now.getHours();
    const todayCourses = courses
      .filter(c => Number(c.day) === now.getDay())
      .sort((a, b) => a.start.localeCompare(b.start));
    if (todayCourses.length) {
      const hm = `${String(hr).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const nextC = todayCourses.find(c => c.start >= hm);
      if (nextC) tips.push(`📚 今日共 ${todayCourses.length} 节课，下一节《${nextC.name}》(${nextC.start} ${nextC.room || ''})。`);
      else tips.push(`✅ 今日 ${todayCourses.length} 节课已全部上完，可以放松听歌或复盘笔记！`);
    }
    const upcoming = exams
      .filter(e => new Date(e.datetime).getTime() > Date.now())
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))[0];
    if (upcoming) {
      const days = Math.ceil((new Date(upcoming.datetime).getTime() - Date.now()) / 86400000);
      if (days <= 7) tips.push(`🎯 距离【${upcoming.name}】仅剩 ${days} 天，记得安排考前冲刺！`);
    }
  } else if (!city.isLocal) {
    tips.push(`✈️ 当前查看异地【${city.name}】实时时间与天气，可点击顶部其他城市自由切换。`);
  }

  document.getElementById('smartAdviceBox').innerHTML =
    `<strong>💡 ${city.name} · 智能建议</strong><br/>${tips.slice(0, 3).join('<br/>')}`;
}

async function resolveDeviceLocation(localCity) {
  // 1. 优先尝试安卓设备原生定位（GPS / 网络基站）
  if (Capacitor.isNativePlatform()) {
    try {
      const gps = await NativeTools.getDeviceLocation();
      if (gps && gps.lat != null && gps.lon != null) {
        localCity.lat = gps.lat;
        localCity.lon = gps.lon;
        localCity.timezone = DEVICE_TZ;
        try {
          const rev = await httpGetJson(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${gps.lat}&longitude=${gps.lon}&localityLanguage=zh`
          );
          const cname = rev?.city || rev?.locality || rev?.principalSubdivision;
          if (cname) localCity.name = cname.replace(/市$/, '');
        } catch {}
        saveCities();
        return;
      }
    } catch {}
  }

  // 2. 兜底使用 IP 地理定位自动对齐当前城市与时区
  try {
    const ip = await httpGetJson('https://get.geojs.io/v1/ip/geo.json');
    if (ip?.latitude && ip?.longitude) {
      localCity.lat = Number(ip.latitude);
      localCity.lon = Number(ip.longitude);
      localCity.name = ip.city || ip.region || '当前位置';
      localCity.timezone = ip.timezone || DEVICE_TZ;
      saveCities();
      return;
    }
  } catch {}

  // 3. 最终兜底默认北京
  if (localCity.lat == null) {
    localCity.lat = 39.9042;
    localCity.lon = 116.4074;
    localCity.name = '北京';
    localCity.timezone = DEVICE_TZ;
    saveCities();
  }
}

async function loadActiveCityWeather() {
  const city = getActiveCity();
  document.getElementById('weatherDesc').textContent = `同步 ${city.name} 天气...`;

  if (city.isLocal && city.lat == null) {
    await resolveDeviceLocation(city);
    renderCityTabs();
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&hourly=temperature_2m,weather_code,precipitation_probability` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&forecast_days=8`;
    const w = await httpGetJson(url);

    if (w.timezone) {
      city.timezone = w.timezone;
      saveCities();
      updateLiveClock();
    }

    const cur = w.current;
    const hourly = w.hourly;
    const daily = w.daily;
    const [ico, txt] = wmoDesc(cur.weather_code);
    const todayPrecip = daily?.precipitation_probability_max?.[0] ?? 0;

    document.getElementById('weatherTemp').textContent = `${ico} ${Math.round(cur.temperature_2m)}°C`;
    document.getElementById('weatherDesc').textContent = `${city.name} · ${txt}`;
    document.getElementById('weatherDetail').textContent =
      `体感 ${Math.round(cur.apparent_temperature)}°C · 湿度 ${cur.relative_humidity_2m}% · 降水 ${todayPrecip}%`;

    activeWeatherBundle = w;

    // 渲染未来 24 小时逐时天气时报（可左右滑动、点击互动）
    const hStrip = document.getElementById('hourlyStrip');
    hStrip.innerHTML = '';
    const curHourPrefix = (cur.time || '').slice(0, 13);
    let startIdx = (hourly?.time || []).findIndex(t => t.startsWith(curHourPrefix));
    if (startIdx < 0) startIdx = 0;

    for (let i = startIdx; i < Math.min(startIdx + 24, (hourly?.time || []).length); i++) {
      const tStr = hourly.time[i].slice(11, 16);
      const tTemp = Math.round(hourly.temperature_2m[i]);
      const tCode = hourly.weather_code[i];
      const tPrecip = hourly.precipitation_probability?.[i] ?? 0;
      const [hIco, hTxt] = wmoDesc(tCode);

      const chip = document.createElement('div');
      chip.className = 'hour-chip' + (i === startIdx ? ' selected' : '');
      chip.innerHTML = `
        <div style="opacity:0.85;">${i === startIdx ? '现在' : tStr}</div>
        <div style="font-size:16px; margin:2px 0;">${hIco}</div>
        <div style="font-weight:700;">${tTemp}°</div>
        <div style="opacity:0.8;">💧${tPrecip}%</div>
      `;
      chip.onclick = () => {
        hStrip.querySelectorAll('.hour-chip').forEach(x => x.classList.remove('selected'));
        chip.classList.add('selected');
        buildSmartAdvice(`${tStr} (${hTxt})`, tTemp, tPrecip, tCode);
      };
      hStrip.appendChild(chip);
    }

    // 渲染未来 7 天天气预报（可左右滑动、点击互动看当天建议）
    const dStrip = document.getElementById('dailyStrip');
    dStrip.innerHTML = '';
    for (let i = 0; i < Math.min(8, (daily?.time || []).length); i++) {
      const dateFull = daily.time[i];
      const dtShort = dateFull.slice(5);
      const dObj = new Date(dateFull + 'T12:00:00');
      const wk = i === 0 ? '今天' : (i === 1 ? '明天' : DAYS_LABEL[dObj.getDay()]);
      const dCode = daily.weather_code[i];
      const [dIco, dTxt] = wmoDesc(dCode);
      const dMin = Math.round(daily.temperature_2m_min[i]);
      const dMax = Math.round(daily.temperature_2m_max[i]);
      const dPrecip = daily.precipitation_probability_max?.[i] ?? 0;

      const chip = document.createElement('div');
      chip.className = 'day-chip' + (i === 0 ? ' selected' : '');
      chip.innerHTML = `
        <div style="font-weight:600;">${wk} ${dtShort}</div>
        <div style="font-size:17px; margin:2px 0;">${dIco}</div>
        <div>${dTxt}</div>
        <div style="font-weight:700; margin-top:2px;">${dMin}°~${dMax}°</div>
        <div style="opacity:0.8;">💧${dPrecip}%</div>
      `;
      chip.onclick = () => {
        dStrip.querySelectorAll('.day-chip').forEach(x => x.classList.remove('selected'));
        chip.classList.add('selected');
        buildSmartAdvice(`${wk} (${dtShort} ${dTxt})`, Math.round((dMin + dMax) / 2), dPrecip, dCode);
      };
      dStrip.appendChild(chip);
    }

    buildSmartAdvice(null, Math.round(cur.temperature_2m), todayPrecip, cur.weather_code);
  } catch (e) {
    document.getElementById('weatherDesc').textContent = `${city.name} 天气获取失败`;
  }
}

// ==================== 2. 闹钟与设备提醒引擎 ====================
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
        osc.connect(gain);
        gain.connect(ringAudioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.16);
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
    await LocalNotifications.createChannel({ id: 'alarm_ring_v3', name: '课表与日程响铃闹钟', description: '15秒连续响铃与震动', importance: 5, visibility: 1, vibration: true, sound: 'alarm_ring.wav' });
    await LocalNotifications.createChannel({ id: 'vibrate_channel_v3', name: '震动横幅提醒', description: '震动提醒', importance: 4, vibration: true });
    await LocalNotifications.createChannel({ id: 'normal_channel_v3', name: '普通通知', description: '常规通知', importance: 3, vibration: false });
    LocalNotifications.addListener('localNotificationReceived', (n) => { if (n.channelId === 'alarm_ring_v3') startRingingOverlay(n.title, n.body); });
    LocalNotifications.addListener('localNotificationActionPerformed', (act) => { if (act.notification?.channelId === 'alarm_ring_v3') startRingingOverlay(act.notification.title, act.notification.body); });
  } catch {}
}

async function syncToDeviceAlarm({ hour, minute, message, days }) {
  if (!Capacitor.isNativePlatform()) return alert(`系统闹钟：${hour}:${minute} ${message}`);
  try {
    await NativeTools.setSystemAlarm({ hour: Number(hour), minute: Number(minute), message: message || '学财助手闹钟', days: days || [], skipUi: false });
  } catch (e) { alert('写入系统闹钟失败：' + e.message); }
}

async function syncToDeviceCalendar({ title, location, description, startTimeMs, endTimeMs, rrule }) {
  if (!Capacitor.isNativePlatform()) return alert(`系统日历：${title}`);
  try {
    await NativeTools.addCalendarEvent({ title: title || '学习日程', location: location || '', description: description || '', startTimeMs, endTimeMs: endTimeMs || (startTimeMs + 3600000), rrule: rrule || '' });
  } catch (e) { alert('写入系统日历失败：' + e.message); }
}

async function scheduleAppReminder({ id, title, body, atDate, weeklyWeekday, hour, minute, mode }) {
  const isAlarm = mode === 'alarm' || mode === 'sys_alarm';
  const channelId = isAlarm ? 'alarm_ring_v3' : (mode === 'vibrate' ? 'vibrate_channel_v3' : 'normal_channel_v3');
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return;
      const schedule = weeklyWeekday !== undefined ? { on: { weekday: weeklyWeekday, hour, minute }, allowWhileIdle: true } : { at: atDate, allowWhileIdle: true };
      await LocalNotifications.schedule({ notifications: [{ id, title: (isAlarm ? '⏰ ' : '🔔 ') + title, body, channelId, schedule, sound: isAlarm ? 'alarm_ring.wav' : 'default' }] });
    } catch {}
  } else if (atDate) {
    const delay = atDate.getTime() - Date.now();
    if (delay > 0 && delay < 86400000) setTimeout(() => isAlarm ? startRingingOverlay(title, body) : alert(title + '\n' + body), delay);
  }
}

async function cancelReminder(id) {
  if (!id || !Capacitor.isNativePlatform()) return;
  try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch {}
}

document.getElementById('testAlarmBtn').addEventListener('click', () => {
  const box = document.createElement('div');
  box.innerHTML = `
    <p class="sub-text" style="margin-bottom:10px;">【系统闹钟】和【系统日历】写入手机底层，关掉 App 或重启手机依然准时响！</p>
    <button class="btn" id="t5s" style="width:100%; margin-bottom:8px;">🔔 App 5秒后连续响铃</button>
    <button class="btn btn-warn" id="tSys" style="width:100%; margin-bottom:8px;">📱 写入【系统时钟闹钟】(1分钟后)</button>
    <button class="btn btn-green" id="tCal" style="width:100%;">📅 写入【系统日历日程】(10分钟后)</button>
  `;
  box.querySelector('#t5s').onclick = async () => {
    modal.classList.remove('open');
    await scheduleAppReminder({ id: makeSafeNotifId(), title: '响铃闹钟测试', body: '15秒连续闹铃正常工作！', atDate: new Date(Date.now() + 5000), mode: 'alarm' });
    setTimeout(() => { if (document.visibilityState === 'visible') startRingingOverlay('响铃闹钟测试', '铃声正常响起！'); }, 5200);
    alert('5 秒后开始响铃！');
  };
  box.querySelector('#tSys').onclick = async () => { modal.classList.remove('open'); const d = new Date(Date.now() + 65000); await syncToDeviceAlarm({ hour: d.getHours(), minute: d.getMinutes(), message: '学财助手系统闹钟测试' }); };
  box.querySelector('#tCal').onclick = async () => { modal.classList.remove('open'); const s = Date.now() + 600000; await syncToDeviceCalendar({ title: '学财助手日程提醒测试', location: '自习室', description: '关App依然有效', startTimeMs: s, endTimeMs: s + 1800000 }); };
  openModal('⏰ 多样提醒与设备同步测试', box);
});

// ==================== 3. 导航与通用弹窗 ====================
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

// ==================== 4. OCR & 文档智能解析课表/日程 ====================
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
  const dayMap = { '一': 1, '1': 1, '二': 2, '2': 2, '三': 3, '3': 3, '四': 4, '4': 4, '五': 5, '5': 5, '六': 6, '6': 6, '日': 0, '天': 0, '7': 0 };
  const timeRangeRegex = /(\d{1,2})[:：](\d{2})\s*[-~至到]\s*(\d{1,2})[:：](\d{2})/;
  const singleTimeRegex = /(\d{1,2})[:：](\d{2})/;
  const periodRegex = /第?\s*(\d{1,2})\s*[-~至到]?\s*(\d{1,2})?\s*节/;
  const dateRegex = /(?:(\d{4})[-/.年])?\s*(\d{1,2})[-/.月](\d{1,2})日?/;
  const roomRegex = /([教实图综A-Za-z楼栋室]*\s*[A-Za-z]?-?\d{3,4}[室]?)/;
  const yearNow = new Date().getFullYear();

  lines.forEach(line => {
    const dm = line.match(dateRegex);
    if (dm && !line.includes('周')) {
      const y = dm[1] ? Number(dm[1]) : yearNow;
      const mo = String(Number(dm[2])).padStart(2, '0');
      const da = String(Number(dm[3])).padStart(2, '0');
      const tm = line.match(singleTimeRegex);
      const hh = tm ? String(Number(tm[1])).padStart(2, '0') : '09';
      const mm = tm ? tm[2] : '00';
      const rm = line.match(roomRegex);
      const title = line.replace(dateRegex, '').replace(timeRangeRegex, '').replace(singleTimeRegex, '').replace(/[,，|]/g, ' ').trim() || '识别日程';
      const type = /考|测验|答辩/.test(line) ? '考试' : (/闹钟|起床/.test(line) ? '闹钟' : '日程');
      parsedEvents.push({ type, name: title.slice(0, 28), datetime: `${y}-${mo}-${da}T${hh}:${mm}`, room: rm ? rm[1] : '', note: '智能识别导入' });
      return;
    }
    const dw = line.match(dayRegex), tr = line.match(timeRangeRegex), pr = line.match(periodRegex);
    if (dw || tr || pr) {
      const day = dw ? (dayMap[dw[1]] ?? 1) : 1;
      let start = '08:00', end = '09:40';
      if (tr) { start = `${String(Number(tr[1])).padStart(2, '0')}:${tr[2]}`; end = `${String(Number(tr[3])).padStart(2, '0')}:${tr[4]}`; }
      else if (pr) { const p1 = Number(pr[1]), p2 = Number(pr[2] || pr[1]); start = PERIOD_MAP[p1]?.[0] || '08:00'; end = PERIOD_MAP[p2]?.[1] || '09:40'; }
      const rm = line.match(roomRegex);
      const cname = line.replace(dayRegex, '').replace(timeRangeRegex, '').replace(periodRegex, '').replace(singleTimeRegex, '').replace(roomRegex, '').replace(/[,，|]/g, ' ').trim();
      if (cname.length >= 1) parsedCourses.push({ name: cname.slice(0, 22), day, start, end, room: rm ? rm[1] : '' });
    }
  });
  return { parsedCourses, parsedEvents };
}

async function runSmartRecognizeFromLocalFile(fileRecord) {
  openModal('🧠 智能识别中...', '<div style="text-align:center; padding:24px;">正在离线提取文字并解析...</div>');
  try {
    let text = fileRecord.textContent || '';
    if (!text && Capacitor.isNativePlatform() && fileRecord.localPath) {
      text = (await NativeTools.extractText({ localPath: fileRecord.localPath })).text || '';
    }
    showSmartImportReviewModal(text);
  } catch (e) {
    openModal('识别提示', `<p class="sub-text" style="color:#dc2626;">识别失败：${e.message}</p>`);
  }
}

function showSmartImportReviewModal(rawText) {
  const { parsedCourses, parsedEvents } = parseSmartText(rawText);
  const box = document.createElement('div');
  box.innerHTML = `
    <div style="font-size:12px; font-weight:600; margin-bottom:4px;">📄 提取到的原文（可微调）：</div>
    <textarea id="ocrRawEdit" style="min-height:95px; font-size:12px;">${(rawText || '').replace(/</g, '&lt;')}</textarea>
    <button class="btn btn-sm btn-outline" id="reparseBtn" style="margin:6px 0 10px;">🔄 重新解析</button>
    <div id="parsedPreviewArea"></div>
  `;
  const renderPreview = (cList, eList) => {
    const area = box.querySelector('#parsedPreviewArea');
    if (!cList.length && !eList.length) {
      area.innerHTML = `<div class="sub-text" style="color:#b45309; padding:8px; background:#fef3c7; border-radius:8px;">示例格式：<br/><code>高等数学 周一 08:00-09:40 教A201</code><br/><code>英语考试 2026-12-20 09:00 教B305</code></div>`;
      return;
    }
    let html = '';
    if (cList.length) {
      html += `<div style="font-weight:600; font-size:13px; margin:6px 0;">📅 识别到 ${cList.length} 节课：</div>`;
      cList.forEach((c, i) => { html += `<label style="display:flex; gap:6px; align-items:center; padding:5px 0; font-size:12px; border-bottom:1px solid var(--border);"><input type="checkbox" class="chk-course" data-idx="${i}" checked style="width:auto;" /><span><strong>${c.name}</strong> · ${DAYS_LABEL[c.day]} ${c.start}-${c.end} ${c.room}</span></label>`; });
    }
    if (eList.length) {
      html += `<div style="font-weight:600; font-size:13px; margin:10px 0 6px;">📝 识别到 ${eList.length} 条日程：</div>`;
      eList.forEach((ev, i) => { html += `<label style="display:flex; gap:6px; align-items:center; padding:5px 0; font-size:12px; border-bottom:1px solid var(--border);"><input type="checkbox" class="chk-event" data-idx="${i}" checked style="width:auto;" /><span><span class="badge">${ev.type}</span><strong>${ev.name}</strong> · ${ev.datetime.replace('T', ' ')}</span></label>`; });
    }
    html += `<button class="btn" id="doSmartImportBtn" style="width:100%; margin-top:12px;">✅ 一键导入并设提醒</button>`;
    area.innerHTML = html;
    area.querySelector('#doSmartImportBtn').onclick = async () => {
      let cc = 0, ec = 0;
      for (const chk of area.querySelectorAll('.chk-course:checked')) { await addCourseItem({ ...cList[Number(chk.dataset.idx)], advance: 15, mode: 'alarm' }); cc++; }
      for (const chk of area.querySelectorAll('.chk-event:checked')) { await addExamOrScheduleItem({ ...eList[Number(chk.dataset.idx)], advance: 30, mode: 'alarm' }); ec++; }
      modal.classList.remove('open');
      alert(`导入完成：${cc} 节课、${ec} 条日程！`);
    };
  };
  renderPreview(parsedCourses, parsedEvents);
  box.querySelector('#reparseBtn').onclick = () => { const r = parseSmartText(box.querySelector('#ocrRawEdit').value); renderPreview(r.parsedCourses, r.parsedEvents); };
  openModal('🧠 智能识别结果确认', box);
}

async function pickAndSmartRecognize() {
  try {
    if (Capacitor.isNativePlatform()) {
      const res = await NativeTools.pickFiles({ accept: '*/*', multiple: false });
      if (res.files?.[0]) await runSmartRecognizeFromLocalFile(res.files[0]);
    } else {
      const t = prompt('粘贴文字测试解析：', '高等数学 周一 08:00-09:40 A201');
      if (t) showSmartImportReviewModal(t);
    }
  } catch (e) { if (!String(e.message).includes('取消')) alert('选择失败：' + e.message); }
}
document.getElementById('smartImportCourseBtn').addEventListener('click', pickAndSmartRecognize);
document.getElementById('smartImportExamBtn').addEventListener('click', pickAndSmartRecognize);

// ==================== 5. 课表与考试日程 ====================
let courses = JSON.parse(localStorage.getItem('courses_v1') || '[]');
let selectedDay = new Date().getDay();
let exams = JSON.parse(localStorage.getItem('exams_v1') || '[]');

function calcCourseAlarmTime(item) {
  const [h, m] = (item.start || '08:00').split(':').map(Number);
  let totalMin = h * 60 + m - Number(item.advance || 15), dayIndex = Number(item.day);
  if (totalMin < 0) { totalMin += 1440; dayIndex = (dayIndex + 6) % 7; }
  return { hour: Math.floor(totalMin / 60), minute: totalMin % 60, capWeekday: dayIndex + 1 };
}
function getNextWeekdayDate(jsDay, timeStr) {
  const [h, m] = (timeStr || '08:00').split(':').map(Number), now = new Date(), d = new Date(now);
  d.setDate(now.getDate() + ((jsDay - now.getDay() + 7) % 7)); d.setHours(h, m, 0, 0);
  if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 7);
  return d;
}
function saveCourses() { localStorage.setItem('courses_v1', JSON.stringify(courses)); renderCourses(); }
function saveExams() { localStorage.setItem('exams_v1', JSON.stringify(exams)); renderExams(); }

function renderDayTabs() {
  const wrap = document.getElementById('dayTabs'); wrap.innerHTML = '';
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
  if (!filtered.length) { list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">今天暂无排课 ✨</div>'; return; }
  list.innerHTML = '';
  filtered.forEach(c => {
    const t = calcCourseAlarmTime(c), div = document.createElement('div');
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
      </div>`;
    div.querySelector('.sys-alarm-btn').onclick = () => syncToDeviceAlarm({ hour: t.hour, minute: t.minute, message: `上课：${c.name} (${c.room || ''})`, days: [t.capWeekday] });
    div.querySelector('.sys-cal-btn').onclick = () => { const sD = getNextWeekdayDate(Number(c.day), c.start), eD = getNextWeekdayDate(Number(c.day), c.end); syncToDeviceCalendar({ title: `上课：${c.name}`, location: c.room || '', description: `每周${DAYS_LABEL[c.day]}`, startTimeMs: sD.getTime(), endTimeMs: Math.max(eD.getTime(), sD.getTime() + 3600000), rrule: `FREQ=WEEKLY;BYDAY=${RRULE_DAYS[Number(c.day)]}` }); };
    div.querySelector('.del-btn').onclick = async () => { await cancelReminder(c.notifId); courses = courses.filter(x => x.id !== c.id); saveCourses(); };
    list.appendChild(div);
  });
}

async function addCourseItem(item) {
  const t = calcCourseAlarmTime(item), notifId = makeSafeNotifId();
  await scheduleAppReminder({ id: notifId, title: `即将上课：${item.name}`, body: `${item.start}-${item.end} ${item.room || ''}`, weeklyWeekday: t.capWeekday, hour: t.hour, minute: t.minute, mode: item.mode || 'alarm' });
  courses.push({ ...item, id: Date.now() + Math.random(), notifId });
  saveCourses();
  return t;
}

document.getElementById('addCourseBtn').addEventListener('click', async () => {
  const name = document.getElementById('cName').value.trim();
  if (!name) return alert('请输入课程名称');
  const item = { name, day: Number(document.getElementById('cDay').value), room: document.getElementById('cRoom').value.trim(), start: document.getElementById('cStart').value, end: document.getElementById('cEnd').value, advance: Number(document.getElementById('cAdvance').value), mode: document.getElementById('cMode').value };
  const t = await addCourseItem(item);
  document.getElementById('cName').value = ''; document.getElementById('cRoom').value = '';
  if (item.mode === 'sys_alarm') await syncToDeviceAlarm({ hour: t.hour, minute: t.minute, message: `上课：${item.name}`, days: [t.capWeekday] });
  else if (item.mode === 'sys_cal') { const sD = getNextWeekdayDate(item.day, item.start), eD = getNextWeekdayDate(item.day, item.end); await syncToDeviceCalendar({ title: `上课：${item.name}`, location: item.room, description: `每周${DAYS_LABEL[item.day]}`, startTimeMs: sD.getTime(), endTimeMs: Math.max(eD.getTime(), sD.getTime() + 3600000), rrule: `FREQ=WEEKLY;BYDAY=${RRULE_DAYS[item.day]}` }); }
  else alert('课程及提醒已保存！');
});
document.getElementById('openBatchCourseBtn').addEventListener('click', () => showSmartImportReviewModal('高等数学 周一 08:00-09:40 教A101\n大学英语 周三 10:00-11:40 教B205'));

async function addExamOrScheduleItem(item) {
  const targetMs = new Date(item.datetime).getTime() - Number(item.advance || 0) * 60000, notifId = makeSafeNotifId();
  if (targetMs > Date.now()) await scheduleAppReminder({ id: notifId, title: `${item.type || '日程'}：${item.name}`, body: `${item.datetime.replace('T', ' ')} ${item.room || ''}`, atDate: new Date(targetMs), mode: item.mode || 'alarm' });
  exams.push({ ...item, type: item.type || '考试', id: Date.now() + Math.random(), notifId });
  saveExams();
  return targetMs;
}

function renderExams() {
  const list = document.getElementById('examList'), sorted = [...exams].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  if (!sorted.length) { list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">暂无日程 🎯</div>'; return; }
  list.innerHTML = ''; const now = Date.now();
  sorted.forEach(ex => {
    const diffMs = new Date(ex.datetime).getTime() - now; let cd = '已过时', uc = '';
    if (diffMs > 0) { const d = Math.floor(diffMs / 86400000), h = Math.floor((diffMs % 86400000) / 3600000), m = Math.floor((diffMs % 3600000) / 60000); cd = d > 0 ? `剩 ${d}天${h}时` : (h > 0 ? `剩 ${h}时${m}分` : `剩 ${m}分钟`); if (d <= 3) uc = 'badge-urgent'; }
    const div = document.createElement('div'); div.className = 'item-row';
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
      </div>`;
    div.querySelector('.sys-alarm-btn').onclick = () => { const t = new Date(new Date(ex.datetime).getTime() - Number(ex.advance || 0) * 60000); syncToDeviceAlarm({ hour: t.getHours(), minute: t.getMinutes(), message: `${ex.type}：${ex.name}` }); };
    div.querySelector('.sys-cal-btn').onclick = () => { const st = new Date(ex.datetime).getTime(); syncToDeviceCalendar({ title: `[${ex.type}] ${ex.name}`, location: ex.room || '', description: ex.note || '', startTimeMs: st, endTimeMs: st + 7200000 }); };
    div.querySelector('.del-btn').onclick = async () => { await cancelReminder(ex.notifId); exams = exams.filter(x => x.id !== ex.id); saveExams(); };
    list.appendChild(div);
  });
}

document.getElementById('addExamBtn').addEventListener('click', async () => {
  const name = document.getElementById('eName').value.trim(), datetime = document.getElementById('eDateTime').value;
  if (!name || !datetime) return alert('请填写标题和日期时间');
  const item = { type: document.getElementById('eType').value, name, datetime, room: document.getElementById('eRoom').value.trim(), note: document.getElementById('eNote').value.trim(), advance: Number(document.getElementById('eAdvance').value), mode: document.getElementById('eMode').value };
  const targetMs = await addExamOrScheduleItem(item);
  document.getElementById('eName').value = ''; document.getElementById('eRoom').value = ''; document.getElementById('eNote').value = '';
  if (item.mode === 'sys_alarm') { const t = new Date(targetMs); await syncToDeviceAlarm({ hour: t.getHours(), minute: t.getMinutes(), message: `${item.type}：${item.name}` }); }
  else if (item.mode === 'sys_cal') { const st = new Date(datetime).getTime(); await syncToDeviceCalendar({ title: `[${item.type}] ${item.name}`, location: item.room, description: item.note, startTimeMs: st, endTimeMs: st + 7200000 }); }
  else alert('日程与提醒已保存！');
});

// ==================== 6. 图文资料库 ====================
let localFiles = JSON.parse(localStorage.getItem('files_meta_v3') || '[]');
function saveFilesMeta() { localStorage.setItem('files_meta_v3', JSON.stringify(localFiles)); renderFiles(); }

function renderFiles() {
  const filter = document.getElementById('fileFilter').value;
  const items = localFiles.filter(f => filter === 'all' || f.category === filter);
  const list = document.getElementById('fileList');
  if (!items.length) { list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">暂无资料 📂</div>'; return; }
  list.innerHTML = '';
  items.forEach(f => {
    const srcUrl = f.localPath ? Capacitor.convertFileSrc(f.localPath) : (f.dataUrl || '');
    const div = document.createElement('div'); div.className = 'item-row';
    const leftHtml = f.category === 'image' && srcUrl ? `<img src="${srcUrl}" class="thumb" />` : `<div style="font-size:26px; width:46px; text-align:center;">${f.category === 'text' ? '📝' : '📄'}</div>`;
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
      </div>`;
    div.querySelector('.open-trigger').onclick = () => {
      if (f.category === 'image') { openModal(f.name, `<img src="${srcUrl}" style="width:100%; border-radius:8px; margin-bottom:10px;" /><button class="btn btn-green" style="width:100%;" id="mOcr">🧠 OCR 识别图中课表/日程</button>`); document.getElementById('mOcr').onclick = () => runSmartRecognizeFromLocalFile(f); }
      else if (f.textContent !== undefined) openModal(f.name, `<pre style="white-space:pre-wrap; font-size:13px;">${f.textContent.replace(/</g, '&lt;')}</pre>`);
      else { openModal(f.name, `<p class="sub-text">格式：${f.format} ｜ ${(f.size / 1024).toFixed(1)} KB</p><button class="btn btn-green" style="width:100%;" id="mDocOcr">🧠 提取文字并解析</button>`); document.getElementById('mDocOcr').onclick = () => runSmartRecognizeFromLocalFile(f); }
    };
    div.querySelector('.ocr-btn').onclick = () => runSmartRecognizeFromLocalFile(f);
    div.querySelector('.del-btn').onclick = async () => {
      if (Capacitor.isNativePlatform() && f.localPath) { try { await NativeTools.deleteLocalFile({ localPath: f.localPath }); } catch {} }
      localFiles = localFiles.filter(x => x.id !== f.id); saveFilesMeta();
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
    } catch (e) { if (!String(e.message).includes('取消')) alert('导入失败：' + e.message); }
  } else document.getElementById('fallbackFileInput').click();
});
document.getElementById('fallbackFileInput').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    const ext = (file.name.split('.').pop() || 'FILE').toUpperCase(), isImg = file.type.startsWith('image/'), isTxt = file.type.startsWith('text/') || /^(TXT|MD|CSV)$/.test(ext);
    localFiles.unshift({ id: Date.now() + Math.random(), name: file.name, format: ext, size: file.size, category: isImg ? 'image' : (isTxt ? 'text' : 'doc'), textContent: isTxt ? await file.text() : undefined, dataUrl: isImg ? URL.createObjectURL(file) : undefined, createdAt: Date.now() });
  }
  e.target.value = ''; saveFilesMeta();
});
document.getElementById('openNoteModalBtn').addEventListener('click', () => {
  const box = document.createElement('div');
  box.innerHTML = `<input id="noteTitle" placeholder="笔记标题" style="margin-bottom:8px;" /><textarea id="noteBody" style="min-height:150px;" placeholder="输入文字..."></textarea><button class="btn" style="width:100%; margin-top:10px;" id="saveNoteBtn">保存</button>`;
  box.querySelector('#saveNoteBtn').onclick = () => {
    const title = box.querySelector('#noteTitle').value.trim() || '未命名笔记', body = box.querySelector('#noteBody').value;
    localFiles.unshift({ id: Date.now(), name: title + '.txt', format: 'TXT', size: new Blob([body]).size, category: 'text', textContent: body, createdAt: Date.now() });
    modal.classList.remove('open'); saveFilesMeta();
  };
  openModal('新建文字笔记', box);
});
document.getElementById('fileFilter').addEventListener('change', renderFiles);

// ==================== 7. 零占用路径直读音乐 + 多源在线搜歌(仅存搜索历史) + 硬件EQ ====================
let ambCtx = null, ambNodes = [], ambGain = null, sleepTimeout = null;
function stopAmbient() {
  ambNodes.forEach(n => { try { n.stop?.(); n.disconnect?.(); } catch {} }); ambNodes = [];
  document.querySelectorAll('.ambient-btn').forEach(b => b.classList.remove('playing'));
  if (Capacitor.isNativePlatform()) { try { NativeTools.setKeepAlive({ active: false }); } catch {} }
}
function applySleepTimer() {
  if (sleepTimeout) { clearTimeout(sleepTimeout); sleepTimeout = null; }
  const mins = Number(document.getElementById('sleepTimer').value);
  if (mins > 0) {
    document.getElementById('timerStatus').textContent = `⏱️ 将在 ${mins} 分钟后自动停止播放`;
    sleepTimeout = setTimeout(async () => {
      stopAmbient();
      if (Capacitor.isNativePlatform()) { try { await NativeTools.audioStop(); } catch {} } else audioPlayer.pause();
      playPauseBtn.textContent = '▶️ 播放';
    }, mins * 60000);
  } else document.getElementById('timerStatus').textContent = '';
}
document.getElementById('sleepTimer').addEventListener('change', applySleepTimer);

function playAmbient(type, btnEl) {
  stopAmbient();
  ambCtx = ambCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (ambCtx.state === 'suspended') ambCtx.resume();
  ambGain = ambCtx.createGain(); ambGain.gain.value = Number(document.getElementById('ambientVol').value); ambGain.connect(ambCtx.destination);
  if (type === 'alpha') {
    [261.63, 329.63, 392.0, 493.88].forEach(freq => { const osc = ambCtx.createOscillator(), g = ambCtx.createGain(); osc.type = 'sine'; osc.frequency.value = freq; g.gain.value = 0.09; osc.connect(g); g.connect(ambGain); osc.start(); ambNodes.push(osc, g); });
  } else {
    const bs = ambCtx.sampleRate * 3, buf = ambCtx.createBuffer(1, bs, ambCtx.sampleRate), d = buf.getChannelData(0); let lo = 0;
    for (let i = 0; i < bs; i++) { const w = Math.random() * 2 - 1; if (type === 'fire' || type === 'ocean') { d[i] = (lo + 0.02 * w) / 1.02; lo = d[i]; d[i] *= 3.5; } else d[i] = w * 0.45; }
    const noise = ambCtx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const filter = ambCtx.createBiquadFilter(); filter.type = type === 'rain' ? 'bandpass' : 'lowpass'; filter.frequency.value = type === 'rain' ? 1100 : (type === 'ocean' ? 420 : 260);
    noise.connect(filter);
    if (type === 'ocean') { const lfo = ambCtx.createOscillator(), lg = ambCtx.createGain(), wg = ambCtx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 0.35; wg.gain.value = 0.65; lfo.connect(lg); lg.connect(wg.gain); filter.connect(wg); wg.connect(ambGain); lfo.start(); ambNodes.push(lfo, lg, wg); }
    else filter.connect(ambGain);
    noise.start(); ambNodes.push(noise, filter);
  }
  btnEl.classList.add('playing');
  if (Capacitor.isNativePlatform()) { try { NativeTools.setKeepAlive({ active: true, title: btnEl.textContent }); } catch {} }
  applySleepTimer();
}
document.querySelectorAll('.ambient-btn').forEach(btn => btn.addEventListener('click', () => playAmbient(btn.dataset.sound, btn)));
document.getElementById('stopAmbientBtn').addEventListener('click', stopAmbient);
document.getElementById('ambientVol').addEventListener('input', (e) => { if (ambGain) ambGain.gain.value = Number(e.target.value); });

// 本地音乐列表（只存 URI 路径引用，零拷贝、不占额外存储空间！）
const audioPlayer = document.getElementById('audioPlayer');
const musicSeek = document.getElementById('musicSeek');
const curTimeEl = document.getElementById('curTime');
const durTimeEl = document.getElementById('durTime');
const playPauseBtn = document.getElementById('playPauseBtn');
const loopModeBtn = document.getElementById('loopModeBtn');

let tracks = JSON.parse(localStorage.getItem('tracks_v4') || '[]');
let onlineMusicHist = JSON.parse(localStorage.getItem('online_music_hist_v1') || '[]');
let currentTrackIdx = -1;
let isPlayingOnlineStream = false;
let loopMode = 'list';
let activeEqPreset = 'flat';
let nativeDurationMs = 0;
let isUserSeeking = false;

const EQ_PRESETS = {
  flat: { b: 0, m: 0, t: 0 },
  bass: { b: 9, m: 1, t: -1 },
  vocal: { b: -2, m: 6, t: 4 },
  sleep: { b: 2, m: -2, t: -7 },
  hall: { b: 5, m: 2, t: 6 }
};

function fmtSec(sec) {
  if (!isFinite(sec) || sec < 0) return '00:00';
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

function updateTrackUiHeader(title, format) {
  document.getElementById('nowPlaying').textContent = '🎵 ' + title;
  const badge = document.getElementById('nowFormatBadge');
  badge.textContent = format || 'AUDIO';
  badge.style.display = 'inline-block';
}

function syncEqToEngine() {
  const b = Number(document.getElementById('eqBass').value);
  const m = Number(document.getElementById('eqMid').value);
  const t = Number(document.getElementById('eqTreble').value);
  document.getElementById('eqBassVal').textContent = `${b > 0 ? '+' : ''}${b}dB`;
  document.getElementById('eqMidVal').textContent = `${m > 0 ? '+' : ''}${m}dB`;
  document.getElementById('eqTrebleVal').textContent = `${t > 0 ? '+' : ''}${t}dB`;
  if (Capacitor.isNativePlatform()) NativeTools.audioSetEq({ bass: b, mid: m, treble: t, preset: activeEqPreset }).catch(() => {});
}

document.querySelectorAll('#eqPresets .eq-pill').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('#eqPresets .eq-pill').forEach(x => x.classList.remove('active'));
  btn.classList.add('active');
  activeEqPreset = btn.dataset.eq;
  const p = EQ_PRESETS[activeEqPreset] || EQ_PRESETS.flat;
  document.getElementById('eqBass').value = p.b;
  document.getElementById('eqMid').value = p.m;
  document.getElementById('eqTreble').value = p.t;
  syncEqToEngine();
}));
['eqBass', 'eqMid', 'eqTreble'].forEach(id => document.getElementById(id).addEventListener('input', syncEqToEngine));
document.getElementById('playSpeed').addEventListener('change', (e) => {
  const sp = Number(e.target.value);
  if (Capacitor.isNativePlatform()) NativeTools.audioSetSpeed({ speed: sp }).catch(() => {});
  else audioPlayer.playbackRate = sp;
});
loopModeBtn.addEventListener('click', () => {
  if (loopMode === 'list') { loopMode = 'single'; loopModeBtn.textContent = '🔂 单曲'; }
  else if (loopMode === 'single') { loopMode = 'shuffle'; loopModeBtn.textContent = '🔀 随机'; }
  else { loopMode = 'list'; loopModeBtn.textContent = '🔁 列表'; }
  if (Capacitor.isNativePlatform()) NativeTools.audioSetLoopMode({ loopMode }).catch(() => {});
});

function saveTracks() {
  localStorage.setItem('tracks_v4', JSON.stringify(tracks));
  renderTracks();
}

function getTrackSource(t) {
  return t.uri || t.localPath || t.onlineUrl || t.webUrl || '';
}

async function playSingleOnlineUrl(url, title, format) {
  isPlayingOnlineStream = true;
  currentTrackIdx = -1;
  renderTracks();
  updateTrackUiHeader(title, format);
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeTools.audioPlayList({
        paths: [url],
        titles: [title],
        formats: [format || 'STREAM'],
        index: 0,
        loopMode: 'single',
        speed: Number(document.getElementById('playSpeed').value),
        bass: Number(document.getElementById('eqBass').value),
        mid: Number(document.getElementById('eqMid').value),
        treble: Number(document.getElementById('eqTreble').value)
      });
      playPauseBtn.textContent = '⏸ 暂停';
      applySleepTimer();
    } catch (e) {
      alert('在线播放失败（可能是该曲目受版权/VIP限制）：' + e.message);
    }
  } else {
    audioPlayer.src = url;
    audioPlayer.play().catch(() => {});
  }
}

async function playTrackAt(idx) {
  if (!tracks.length) return;
  isPlayingOnlineStream = false;
  currentTrackIdx = (idx + tracks.length) % tracks.length;
  const t = tracks[currentTrackIdx];
  updateTrackUiHeader(t.name, t.format);
  renderTracks();
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeTools.audioPlayList({
        paths: tracks.map(getTrackSource),
        titles: tracks.map(x => x.name || '音乐'),
        formats: tracks.map(x => x.format || 'AUDIO'),
        index: currentTrackIdx,
        loopMode,
        speed: Number(document.getElementById('playSpeed').value),
        bass: Number(document.getElementById('eqBass').value),
        mid: Number(document.getElementById('eqMid').value),
        treble: Number(document.getElementById('eqTreble').value)
      });
      playPauseBtn.textContent = '⏸ 暂停';
      applySleepTimer();
    } catch (err) {
      playPauseBtn.textContent = '▶️ 播放';
      alert('播放失败：' + err.message);
    }
  } else {
    audioPlayer.src = getTrackSource(t);
    audioPlayer.play().catch(() => {});
  }
}

// 实时同步后台切歌后的【歌名、格式徽章、高亮行、进度条】！
setInterval(async () => {
  if (!Capacitor.isNativePlatform() || document.visibilityState !== 'visible') return;
  try {
    const st = await NativeTools.audioGetStatus();
    if (!st) return;
    nativeDurationMs = st.durationMs || 0;
    playPauseBtn.textContent = st.playing ? '⏸ 暂停' : '▶️ 播放';

    // 修复：自动切到下一首时，立刻同步歌名、格式与列表高亮！
    if (!isPlayingOnlineStream && st.index >= 0 && st.index < tracks.length && st.index !== currentTrackIdx) {
      currentTrackIdx = st.index;
      updateTrackUiHeader(tracks[currentTrackIdx].name, tracks[currentTrackIdx].format);
      renderTracks();
    } else if (st.title && document.getElementById('nowPlaying').textContent !== '🎵 ' + st.title && st.durationMs > 0) {
      updateTrackUiHeader(st.title, st.format || 'AUDIO');
    }

    if (!isUserSeeking && nativeDurationMs > 0) {
      curTimeEl.textContent = fmtSec((st.currentMs || 0) / 1000);
      durTimeEl.textContent = fmtSec(nativeDurationMs / 1000);
      musicSeek.value = ((st.currentMs || 0) / nativeDurationMs) * 100;
    }
  } catch {}
}, 500);

musicSeek.addEventListener('pointerdown', () => { isUserSeeking = true; });
musicSeek.addEventListener('touchstart', () => { isUserSeeking = true; }, { passive: true });
musicSeek.addEventListener('change', async () => {
  const pct = Number(musicSeek.value) / 100;
  if (Capacitor.isNativePlatform() && nativeDurationMs > 0) {
    await NativeTools.audioSeek({ positionMs: Math.floor(pct * nativeDurationMs) }).catch(() => {});
  } else if (audioPlayer.duration) {
    audioPlayer.currentTime = pct * audioPlayer.duration;
  }
  isUserSeeking = false;
});

playPauseBtn.addEventListener('click', async () => {
  if (Capacitor.isNativePlatform()) {
    const st = await NativeTools.audioGetStatus().catch(() => ({ playing: false }));
    if (st.playing) { await NativeTools.audioPause(); playPauseBtn.textContent = '▶️ 播放'; }
    else if (st.durationMs > 0) { await NativeTools.audioResume(); playPauseBtn.textContent = '⏸ 暂停'; }
    else if (tracks.length) playTrackAt(0);
  } else {
    if (audioPlayer.paused) audioPlayer.play(); else audioPlayer.pause();
  }
});
document.getElementById('prevTrackBtn').addEventListener('click', () => playTrackAt(currentTrackIdx - 1));
document.getElementById('nextTrackBtn').addEventListener('click', () => playTrackAt(currentTrackIdx + 1));

// 渲染在线搜歌历史（仅存文字记录，零音频缓存占用）
function renderOnlineMusicHistory(container) {
  if (!onlineMusicHist.length) return;
  const hDiv = document.createElement('div');
  hDiv.style.marginBottom = '8px';
  hDiv.innerHTML = `<div class="sub-text" style="margin-bottom:4px; display:flex; justify-content:space-between;"><span>🕒 搜索历史（点击重搜）</span><span id="clrMusicHist" style="color:#dc2626; cursor:pointer;">清空</span></div>`;
  const pills = document.createElement('div');
  pills.className = 'day-tabs';
  onlineMusicHist.forEach(kw => {
    const p = document.createElement('button');
    p.className = 'day-pill';
    p.textContent = kw;
    p.onclick = () => {
      document.getElementById('onlineMusicQuery').value = kw;
      searchOnlineMusic(kw);
    };
    pills.appendChild(p);
  });
  hDiv.appendChild(pills);
  hDiv.querySelector('#clrMusicHist').onclick = () => {
    onlineMusicHist = [];
    localStorage.setItem('online_music_hist_v1', '[]');
    container.innerHTML = '';
  };
  container.appendChild(hDiv);
}

// 多源在线搜歌：网易云公开曲库 + Apple 港澳/大陆多区 + Audius 完整版（流式直播，0 缓存占用！）
async function searchOnlineMusic(query) {
  const q = query.trim();
  const resBox = document.getElementById('onlineMusicResults');
  resBox.innerHTML = '';
  if (!q) {
    renderOnlineMusicHistory(resBox);
    return;
  }

  onlineMusicHist = [q, ...onlineMusicHist.filter(x => x !== q)].slice(0, 10);
  localStorage.setItem('online_music_hist_v1', JSON.stringify(onlineMusicHist));
  renderOnlineMusicHistory(resBox);

  const loading = document.createElement('div');
  loading.className = 'sub-text';
  loading.style.padding = '8px';
  loading.textContent = '🔍 正在多源曲库搜歌（网易云 / Apple多区 / Audius）...';
  resBox.appendChild(loading);

  const songs = [];
  const seen = new Set();
  const pushSong = (s) => {
    const key = `${s.title}-${s.artist}-${s.src}`.toLowerCase();
    if (!seen.has(key) && s.url) { seen.add(key); songs.push(s); }
  };

  // 源 1：网易云音乐公开接口（覆盖李玉刚《刚好遇见你》等绝大多数华语歌曲！）
  try {
    const ne = await httpGetJson(
      `https://music.163.com/api/search/get/web?s=${encodeURIComponent(q)}&type=1&offset=0&limit=10`,
      { Referer: 'https://music.163.com/' }
    );
    (ne?.result?.songs || []).forEach(s => {
      const artist = (s.artists || []).map(a => a.name).join('/') || '未知歌手';
      pushSong({
        title: s.name,
        artist,
        cover: s.album?.picUrl || '',
        url: `https://music.163.com/song/media/outer/url?id=${s.id}.mp3`,
        format: 'MP3',
        src: '网易云'
      });
    });
  } catch {}

  // 源 2：Apple iTunes 港澳区(HK) + 大陆区(CN)（华语版权比单搜 CN 全得多！）
  for (const country of ['HK', 'CN']) {
    try {
      const it = await httpGetJson(
        `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=8&country=${country}`
      );
      (it?.results || []).forEach(r => {
        if (r.previewUrl) {
          pushSong({
            title: r.trackName,
            artist: r.artistName || '歌手',
            cover: r.artworkUrl100 || '',
            url: r.previewUrl,
            format: 'M4A',
            src: `Apple(${country})`
          });
        }
      });
    } catch {}
  }

  // 源 3：Audius 免费完整版独立曲库
  try {
    const au = await httpGetJson(
      `https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(q)}&app_name=studyhub`
    );
    (au?.data || []).slice(0, 4).forEach(t => {
      if (t.id) {
        pushSong({
          title: t.title,
          artist: t.user?.name || 'Audius',
          cover: t.artwork?.['150x150'] || '',
          url: `https://discoveryprovider.audius.co/v1/tracks/${t.id}/stream?app_name=studyhub`,
          format: 'MP3',
          src: 'Audius完整'
        });
      }
    });
  } catch {}

  loading.remove();
  if (!songs.length) {
    resBox.innerHTML += '<div class="sub-text" style="padding:8px;">未搜到结果，换个关键词试试~</div>';
    return;
  }

  songs.slice(0, 16).forEach(s => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div style="display:flex; gap:10px; align-items:center; flex:1; min-width:0;">
        ${s.cover ? `<img src="${s.cover}" class="cover-img" />` : `<div class="cover-img" style="display:flex;align-items:center;justify-content:center;">🎵</div>`}
        <div style="min-width:0;">
          <div style="font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s.title}</div>
          <div class="sub-text">
            <span class="badge badge-alarm">${s.src}</span>
            <span class="badge badge-fmt">${s.format}</span> ${s.artist}
          </div>
        </div>
      </div>
      <div style="display:flex; gap:4px; flex-shrink:0;">
        <button class="btn btn-sm play-online">▶️</button>
        <button class="btn btn-sm btn-outline fav-online" title="只存链接，不占存储空间">⭐收藏</button>
      </div>
    `;
    row.querySelector('.play-online').onclick = () => playSingleOnlineUrl(s.url, `${s.title} - ${s.artist}`, s.format);
    row.querySelector('.fav-online').onclick = async (e) => {
      // 只存轻量 URL 引用，0 字节音频下载占用！
      tracks.push({
        id: Date.now() + Math.random(),
        name: `${s.title} - ${s.artist}`,
        format: s.format,
        size: 0,
        onlineUrl: s.url,
        isOnlineRef: true
      });
      saveTracks();
      await syncPlaylistWithoutInterrupt();
      e.target.textContent = '已藏✅';
      e.target.disabled = true;
    };
    resBox.appendChild(row);
  });
}

document.getElementById('searchOnlineMusicBtn').addEventListener('click', () => {
  searchOnlineMusic(document.getElementById('onlineMusicQuery').value);
});
document.getElementById('onlineMusicQuery').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchOnlineMusic(e.target.value);
});

// 静默把新增歌曲同步进后台播放队列，绝对不打断当前正在听的歌！
async function syncPlaylistWithoutInterrupt() {
  if (!Capacitor.isNativePlatform() || isPlayingOnlineStream) return;
  try {
    await NativeTools.audioUpdatePlaylist({
      paths: tracks.map(getTrackSource),
      titles: tracks.map(x => x.name || '音乐'),
      formats: tracks.map(x => x.format || 'AUDIO')
    });
  } catch {}
}

function renderTracks() {
  const list = document.getElementById('trackList');
  if (!tracks.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:10px;">本地直读路径播放（零复制不占内存），支持 MP3/FLAC/WAV/M4A/OGG 🎶</div>';
    return;
  }
  list.innerHTML = '';
  tracks.forEach((t, i) => {
    const isActive = !isPlayingOnlineStream && i === currentTrackIdx;
    const div = document.createElement('div');
    div.className = 'item-row' + (isActive ? ' playing-row' : '');
    const sizeText = t.isOnlineRef ? '在线流 · 0MB占用' : `${((t.size || 0) / 1048576).toFixed(2)} MB · 原路径直读`;
    div.innerHTML = `
      <div style="flex:1; cursor:pointer;" class="play-track">
        <div>${isActive ? '🔊 ' : ''}<span class="badge badge-fmt">${t.format || 'AUDIO'}</span> ${t.name}</div>
        <div class="sub-text">${sizeText}</div>
      </div>
      <div style="display:flex; gap:4px;">
        <button class="btn btn-sm btn-outline ren-btn">改名</button>
        <button class="btn btn-sm btn-danger del-btn">移除</button>
      </div>
    `;
    div.querySelector('.play-track').onclick = () => playTrackAt(i);
    div.querySelector('.ren-btn').onclick = async () => {
      const nn = prompt('输入新的歌曲名称：', t.name);
      if (nn && nn.trim()) {
        t.name = nn.trim();
        saveTracks();
        if (i === currentTrackIdx) updateTrackUiHeader(t.name, t.format);
        await syncPlaylistWithoutInterrupt();
      }
    };
    div.querySelector('.del-btn').onclick = async () => {
      // 只移除列表引用，绝不删除你手机里的原文件
      tracks = tracks.filter(x => x.id !== t.id);
      if (i < currentTrackIdx) currentTrackIdx--;
      else if (i === currentTrackIdx) currentTrackIdx = -1;
      saveTracks();
      await syncPlaylistWithoutInterrupt();
    };
    list.appendChild(div);
  });
}

// 零拷贝导入本地音乐：只获取持久化 URI 路径，绝对不复制文件，也不打断当前播放！
document.getElementById('nativeImportMusicBtn').addEventListener('click', async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeTools.pickAudioRefs({ multiple: true });
      const added = res.files || [];
      if (!added.length) return;
      added.forEach(f => tracks.push({ id: Date.now() + Math.random(), ...f }));
      saveTracks();
      await syncPlaylistWithoutInterrupt();
      alert(`已直接关联 ${added.length} 首本地曲目（零拷贝、不占额外存储，未打断当前播放）！`);
    } catch (e) {
      if (!String(e.message).includes('取消')) alert('导入失败：' + e.message);
    }
  } else {
    document.getElementById('fallbackMusicInput').click();
  }
});

document.getElementById('fallbackMusicInput').addEventListener('change', (e) => {
  for (const file of e.target.files) {
    tracks.push({
      id: Date.now() + Math.random(),
      name: file.name,
      format: (file.name.split('.').pop() || 'AUDIO').toUpperCase(),
      size: file.size,
      webUrl: URL.createObjectURL(file)
    });
  }
  e.target.value = '';
  saveTracks();
});

// ==================== 8. A股专区 + 全球股市 + 可滑动走势图 ====================
let marketData = { updatedAt: '加载中...', globalNews: [], indices: [], stocks: [] };
let activeRegion = 'all', activeStockMkt = 'all';
let customWatchlist = JSON.parse(localStorage.getItem('custom_watchlist_v1') || '[]');

function renderMiniSparkline(history, isUp, height = 40) {
  if (!history || history.length < 2) return `<div class="sub-text" style="height:${height}px;">暂无走势</div>`;
  const min = Math.min(...history), max = Math.max(...history), span = max - min || 1, w = 240, pad = 3;
  const pts = history.map((v, i) => [(pad + (i / (history.length - 1)) * (w - pad * 2)).toFixed(1), (height - pad - ((v - min) / span) * (height - pad * 2)).toFixed(1)]);
  const line = pts.map(p => p.join(',')).join(' '), area = `${pts[0][0]},${height} ${line} ${pts[pts.length - 1][0]},${height}`;
  const color = isUp ? '#ef4444' : '#10b981', fill = isUp ? 'rgba(239,68,68,0.14)' : 'rgba(16,185,129,0.14)';
  return `<svg viewBox="0 0 ${w} ${height}" preserveAspectRatio="none" style="width:100%; height:${height}px; display:block;"><polygon points="${area}" fill="${fill}" /><polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
}

function mountInteractiveChart(container, history, dates, isUp) {
  container.innerHTML = '';
  if (!history || history.length < 2) { container.innerHTML = '<div class="sub-text" style="padding:20px; text-align:center;">暂无走势</div>'; return; }
  const scrubBar = document.createElement('div'); scrubBar.className = 'scrub-bar';
  const lastIdx = history.length - 1, firstVal = history[0] || 1;
  const updateReadout = (idx) => {
    const val = history[idx], dt = dates?.[idx] || `点${idx + 1}`, dp = (((val - firstVal) / firstVal) * 100).toFixed(2), sign = Number(dp) >= 0 ? '+' : '';
    scrubBar.innerHTML = `<span>🕒 ${dt}</span><span>💰 <strong>${val}</strong></span><span class="${Number(dp) >= 0 ? 'up' : 'down'}">${sign}${dp}%</span>`;
  };
  updateReadout(lastIdx);
  const chartBox = document.createElement('div'); chartBox.className = 'chart-interactive';
  const w = 320, h = 155, pad = 10, min = Math.min(...history), max = Math.max(...history), span = max - min || 1;
  const coords = history.map((v, i) => ({ x: pad + (i / (history.length - 1)) * (w - pad * 2), y: h - pad - ((v - min) / span) * (h - pad * 2) }));
  const line = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '), area = `${coords[0].x.toFixed(1)},${h - pad} ${line} ${coords[lastIdx].x.toFixed(1)},${h - pad}`;
  const color = isUp ? '#ef4444' : '#10b981', fill = isUp ? 'rgba(239,68,68,0.16)' : 'rgba(16,185,129,0.16)';
  chartBox.innerHTML = `<svg id="scrubSvg" viewBox="0 0 ${w} ${h}" style="width:100%; height:160px; display:block;"><polygon points="${area}" fill="${fill}" /><polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.4" /><line id="crossLine" x1="${coords[lastIdx].x}" y1="${pad}" x2="${coords[lastIdx].x}" y2="${h - pad}" stroke="#6366f1" stroke-width="1.4" stroke-dasharray="4 3" /><circle id="crossDot" cx="${coords[lastIdx].x}" cy="${coords[lastIdx].y}" r="5" fill="${color}" stroke="#fff" stroke-width="2" /></svg><div class="time-row"><span>低: ${min.toFixed(2)}</span><span>👆 左右滑动看价格与时间</span><span>高: ${max.toFixed(2)}</span></div>`;
  const svg = chartBox.querySelector('#scrubSvg'), cl = chartBox.querySelector('#crossLine'), cd = chartBox.querySelector('#crossDot');
  const handleMove = (cx) => {
    const rect = svg.getBoundingClientRect(), idx = Math.round(Math.max(0, Math.min(1, (cx - rect.left) / rect.width)) * (history.length - 1)), pt = coords[idx];
    cl.setAttribute('x1', pt.x); cl.setAttribute('x2', pt.x); cd.setAttribute('cx', pt.x); cd.setAttribute('cy', pt.y); updateReadout(idx);
  };
  svg.addEventListener('touchstart', (e) => { if (e.touches[0]) handleMove(e.touches[0].clientX); }, { passive: true });
  svg.addEventListener('touchmove', (e) => { if (e.touches[0]) { e.preventDefault(); handleMove(e.touches[0].clientX); } }, { passive: false });
  svg.addEventListener('pointerdown', (e) => handleMove(e.clientX));
  svg.addEventListener('pointermove', (e) => { if (e.buttons > 0 || e.pointerType === 'mouse') handleMove(e.clientX); });
  container.appendChild(scrubBar); container.appendChild(chartBox);
}

async function fetchEastMoneyChart(emSecId, range) {
  const klt = range === '5d' ? 30 : (range === '1y' ? 102 : 101), lmt = range === '5d' ? 40 : (range === '3mo' ? 65 : (range === '1y' ? 52 : 25));
  const res = await httpGetJson(`https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(emSecId)}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56&klt=${klt}&fqt=1&end=20500101&lmt=${lmt}`);
  const klines = res?.data?.klines; if (!klines?.length) throw new Error('东财暂无走势');
  const history = [], dates = []; let lo = 0, lh = 0, ll = 0, lv = 0;
  klines.forEach(line => { const [dt, op, cl, hi, l, vol] = line.split(','); dates.push(dt); history.push(Number(Number(cl).toFixed(2))); lo = Number(op); lh = Number(hi); ll = Number(l); lv = Number(vol); });
  const price = history[history.length - 1], prev = history.length >= 2 ? history[history.length - 2] : (Number(res?.data?.preKPrice) || price);
  const change = Number((price - prev).toFixed(2)), changePct = prev ? Number(((change / prev) * 100).toFixed(2)) : 0;
  return { price, change, changePct, history, dates, open: lo, high: lh, low: ll, volume: lv };
}

async function fetchYahooChart(symbol, range, interval) {
  const cData = await httpGetJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`);
  const r = cData?.chart?.result?.[0]; if (!r) throw new Error('Yahoo 无数据');
  const meta = r.meta || {}, q = r.indicators?.quote?.[0] || {}, rawCloses = q.close || [], ts = r.timestamp || [], history = [], dates = [];
  for (let i = 0; i < rawCloses.length; i++) {
    if (rawCloses[i] != null) {
      history.push(Number(rawCloses[i].toFixed(2)));
      const d = new Date((ts[i] || 0) * 1000);
      dates.push(range === '5d' ? `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
  }
  const price = Number((meta.regularMarketPrice || history[history.length - 1] || 0).toFixed(2)), prev = Number((meta.chartPreviousClose || history[0] || price).toFixed(2));
  const change = Number((price - prev).toFixed(2)), changePct = prev ? Number(((change / prev) * 100).toFixed(2)) : 0;
  return { price, change, changePct, history, dates, open: Number((q.open?.filter(v => v != null).slice(-1)[0] || 0).toFixed(2)), high: Number((q.high?.filter(v => v != null).slice(-1)[0] || 0).toFixed(2)), low: Number((q.low?.filter(v => v != null).slice(-1)[0] || 0).toFixed(2)), volume: q.volume?.filter(v => v != null).slice(-1)[0] || 0 };
}

async function fetchSmartChart(item, range, interval) {
  if (item.emSecId) { try { return await fetchEastMoneyChart(item.emSecId, range); } catch {} }
  try { return await fetchYahooChart(item.symbol, range, interval); } catch (e) {
    const s = item.symbol || '', guessed = s.endsWith('.SS') ? `1.${s.replace('.SS', '')}` : (s.endsWith('.SZ') ? `0.${s.replace('.SZ', '')}` : (s.endsWith('.HK') ? `116.${s.replace('.HK', '').padStart(5, '0')}` : ''));
    if (guessed) return await fetchEastMoneyChart(guessed, range);
    throw e;
  }
}

function openStockDetailModal(item) {
  const isUp = (item.changePct || 0) >= 0, sign = isUp ? '+' : '', box = document.createElement('div');
  const newsHtml = (item.news || []).length ? item.news.map(n => `<a class="news-link" href="${n.link || '#'}" target="_blank" rel="noopener"><div style="font-weight:500;">${n.title}</div><div class="sub-text">${n.source || '财经'} · ${n.time || ''}</div></a>`).join('') : '<div class="sub-text">暂无快讯</div>';
  box.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;"><span style="font-size:26px; font-weight:700;">${item.price ?? '--'}</span><span class="${isUp ? 'up' : 'down'}" style="font-size:15px;">${sign}${item.change ?? 0} (${sign}${item.changePct ?? 0}%)</span></div><div class="day-tabs" id="rangeTabs" style="margin-bottom:6px;"><button class="day-pill" data-r="5d" data-i="30m">5日分时</button><button class="day-pill active" data-r="1mo" data-i="1d">1月</button><button class="day-pill" data-r="3mo" data-i="1d">3月</button><button class="day-pill" data-r="1y" data-i="1wk">1年</button></div><div id="interactiveChartHost" style="margin-bottom:10px;"></div>${item.open ? `<div class="form-grid" style="font-size:12px; background:var(--card-sub); padding:10px; border-radius:8px; margin-bottom:10px;"><div>今开：<strong>${item.open}</strong></div><div>成交量：<strong>${item.volume ? (item.volume / 10000).toFixed(1) + '万' : '--'}</strong></div><div>最高：<strong class="up">${item.high}</strong></div><div>最低：<strong class="down">${item.low}</strong></div></div>` : ''}<div style="font-weight:600; margin-bottom:6px;">📰 每日消息汇总</div><div class="news-box">${newsHtml}</div>`;
  const host = box.querySelector('#interactiveChartHost');
  mountInteractiveChart(host, item.history, item.dates, isUp);
  box.querySelectorAll('#rangeTabs .day-pill').forEach(btn => btn.addEventListener('click', async () => {
    box.querySelectorAll('#rangeTabs .day-pill').forEach(b => b.classList.remove('active')); btn.classList.add('active');
    host.innerHTML = '<div class="sub-text" style="padding:30px; text-align:center;">加载走势中...</div>';
    try { const res = await fetchSmartChart(item, btn.dataset.r, btn.dataset.i); mountInteractiveChart(host, res.history, res.dates, res.changePct >= 0); }
    catch (e) { host.innerHTML = `<div class="sub-text" style="color:#dc2626; padding:12px;">加载失败：${e.message}</div>`; }
  }));
  openModal(`${item.name} (${item.symbol})`, box);
}

function renderStocks(keyword = '') {
  document.getElementById('stockUpdated').textContent = '更新时间：' + (marketData.updatedAt || '--');
  const indices = (marketData.indices || []).filter(i => activeRegion === 'all' || i.region === activeRegion);
  const idxGrid = document.getElementById('indicesGrid'); idxGrid.innerHTML = '';
  indices.forEach(i => {
    const isUp = (i.changePct || 0) >= 0, sign = isUp ? '+' : '', box = document.createElement('div'); box.className = 'idx-box';
    box.innerHTML = `<div style="font-size:12px; color:var(--sub);">${i.region} · ${i.name}</div><div style="display:flex; justify-content:space-between; align-items:baseline; margin:2px 0;"><span style="font-size:15px; font-weight:700;">${i.price}</span><span class="${isUp ? 'up' : 'down'}" style="font-size:12px;">${sign}${i.changePct}%</span></div>${renderMiniSparkline(i.history, isUp, 36)}`;
    box.onclick = () => openStockDetailModal(i); idxGrid.appendChild(box);
  });

  const gnList = document.getElementById('globalNewsList'), gNews = marketData.globalNews || [];
  gnList.innerHTML = gNews.length ? gNews.map(n => `<a class="news-link" href="${n.link || '#'}" target="_blank" rel="noopener"><div style="font-size:13px;">${n.title}</div><div class="sub-text">${n.source} · ${n.time}</div></a>`).join('') : '<div class="sub-text">点击“刷新”获取每日头条</div>';

  const allStocks = [...customWatchlist, ...(marketData.stocks || [])], kw = keyword.trim().toLowerCase();
  const filtered = allStocks.filter(s => (activeStockMkt === 'all' || s.market === activeStockMkt) && (!kw || (s.name || '').toLowerCase().includes(kw) || (s.symbol || '').toLowerCase().includes(kw) || (s.market || '').toLowerCase().includes(kw)));
  const list = document.getElementById('stocksList'); list.innerHTML = '';
  if (!filtered.length) { list.innerHTML = '<div class="sub-text" style="text-align:center; padding:12px;">本地未匹配，请点上方 <strong>🔍 全网搜</strong> 查全球任意股票！</div>'; return; }
  filtered.forEach(s => {
    const isUp = (s.changePct || 0) >= 0, sign = isUp ? '+' : '';
    const newsItems = (s.news || []).slice(0, 4).map(n => `<a class="news-link" href="${n.link || '#'}" target="_blank" rel="noopener"><div>${n.title}</div><div class="sub-text">${n.source || ''} · ${n.time || ''}</div></a>`).join('');
    const div = document.createElement('div'); div.className = 'item-row'; div.style.flexDirection = 'column';
    div.innerHTML = `<div style="display:flex; justify-content:space-between; width:100%; align-items:center; cursor:pointer;" class="st-head"><div><strong>${s.name}</strong> <span class="badge">${s.market || '全球'}</span><div class="sub-text">${s.symbol} · 点开滑动看价</div></div><div style="text-align:right;"><div style="font-size:16px; font-weight:700;">${s.price}</div><div class="${isUp ? 'up' : 'down'}" style="font-size:12px;">${sign}${s.changePct}%</div></div></div><div style="width:100%; cursor:pointer;" class="st-chart">${renderMiniSparkline(s.history, isUp, 44)}</div><div class="news-box" style="width:100%;"><div style="font-weight:600; margin-bottom:4px;">📰 每日消息汇总 (${(s.news || []).length}条)</div>${newsItems || '<div class="sub-text">暂无快讯</div>'}</div>`;
    div.querySelector('.st-head').onclick = () => openStockDetailModal(s);
    div.querySelector('.st-chart').onclick = () => openStockDetailModal(s);
    list.appendChild(div);
  });
}

function mapEastMoneyToSymbol(item) {
  const code = String(item.Code || ''), mkt = String(item.MktNum || '');
  if (mkt === '1') return `${code}.SS`;
  if (mkt === '0') return `${code}.SZ`;
  if (mkt === '116') return `${(code.length === 5 && code.startsWith('0') ? code.slice(1) : code.padStart(4, '0'))}.HK`;
  return code;
}

async function liveSearchGlobalStock(query) {
  const q = query.trim(), resBox = document.getElementById('liveSearchResult');
  if (!q) { resBox.innerHTML = ''; return; }
  resBox.innerHTML = '<div class="card" style="background:var(--primary-light);">🔍 正在全网检索 A股 / 港股 / 美股 / 全球个股与板块...</div>';
  const candidates = [], seen = new Set();
  const pushCand = (c) => { if (c.symbol && !seen.has(c.symbol.toUpperCase())) { seen.add(c.symbol.toUpperCase()); candidates.push(c); } };

  try {
    const emData = await httpGetJson(`https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(q)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=12`);
    const rows = emData?.QuotationCodeTable?.Data || [];
    rows.sort((a, b) => (String(a.MktNum) === '90' ? 1 : 0) - (String(b.MktNum) === '90' ? 1 : 0));
    rows.forEach(r => pushCand({ symbol: mapEastMoneyToSymbol(r), emSecId: r.QuoteID || `${r.MktNum}.${r.Code}`, name: r.Name || r.Code, market: r.SecurityTypeName || 'A股' }));
  } catch {}
  try {
    const yfData = await httpGetJson(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=6&newsCount=2`);
    (yfData.quotes || []).forEach(qt => { if (qt.symbol) pushCand({ symbol: qt.symbol, emSecId: '', name: qt.shortname || qt.longname || qt.symbol, market: qt.exchDisp || qt.exchange || '全球' }); });
  } catch {}

  if (!candidates.length) { resBox.innerHTML = '<div class="sub-text" style="padding:8px;">未找到匹配股票。</div>'; return; }
  resBox.innerHTML = '<div class="sub-text" style="margin-bottom:6px;">🌐 全网检索结果（个股优先，点击看实时滑动走势图与新闻）：</div>';
  candidates.slice(0, 10).forEach(cand => {
    const row = document.createElement('div'); row.className = 'card';
    row.style.cssText = 'padding:10px; margin-bottom:8px; border:1px solid var(--border); background:var(--card-sub); cursor:pointer;';
    row.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><div><strong>${cand.name}</strong><div class="sub-text">${cand.symbol} · ${cand.market}</div></div><button class="btn btn-sm">看态势图</button></div>`;
    row.onclick = async () => {
      row.querySelector('button').textContent = '加载中...';
      try {
        const chartInfo = await fetchSmartChart(cand, '1mo', '1d');
        let newsList = [];
        try {
          const xmlText = await httpGetText(`https://news.google.com/rss/search?q=${encodeURIComponent(cand.name + ' 股价 新闻')}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`);
          const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
          newsList = Array.from(doc.querySelectorAll('item')).slice(0, 6).map(it => ({ title: it.querySelector('title')?.textContent || '', source: it.querySelector('source')?.textContent || '财经资讯', time: (it.querySelector('pubDate')?.textContent || '').slice(0, 22), link: it.querySelector('link')?.textContent || '#' }));
        } catch {}
        const fullStock = { ...cand, ...chartInfo, news: newsList };
        openStockDetailModal(fullStock);
        customWatchlist = [fullStock, ...customWatchlist.filter(x => x.symbol !== fullStock.symbol)].slice(0, 12);
        localStorage.setItem('custom_watchlist_v1', JSON.stringify(customWatchlist));
        renderStocks('');
      } catch (err) { alert('拉取走势失败：' + err.message); }
      finally { row.querySelector('button').textContent = '看态势图'; }
    };
    resBox.appendChild(row);
  });
}

async function fetchMarketData() {
  const repo = localStorage.getItem('github_stock_repo') || DEFAULT_GITHUB_REPO;
  document.getElementById('stockUpdated').textContent = `正在同步 ${repo} 股市...`;
  try {
    marketData = await httpGetJson(`https://raw.githubusercontent.com/${repo}/main/data/market_data.json?t=${Date.now()}`);
    localStorage.setItem('cached_market_v3', JSON.stringify(marketData));
  } catch (e) {
    const cached = localStorage.getItem('cached_market_v3'); if (cached) marketData = JSON.parse(cached);
    document.getElementById('stockUpdated').textContent = '同步失败：' + e.message;
  }
  renderStocks(document.getElementById('stockSearch').value);
}

document.querySelectorAll('#regionTabs .day-pill').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('#regionTabs .day-pill').forEach(b => b.classList.remove('active')); btn.classList.add('active');
  activeRegion = btn.dataset.region; renderStocks(document.getElementById('stockSearch').value);
}));
document.querySelectorAll('#stockMarketTabs .day-pill').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('#stockMarketTabs .day-pill').forEach(b => b.classList.remove('active')); btn.classList.add('active');
  activeStockMkt = btn.dataset.mkt; renderStocks(document.getElementById('stockSearch').value);
}));
document.getElementById('refreshStocksBtn').addEventListener('click', fetchMarketData);
document.getElementById('stockSearch').addEventListener('input', (e) => renderStocks(e.target.value));
document.getElementById('stockSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') liveSearchGlobalStock(e.target.value); });
document.getElementById('liveSearchBtn').addEventListener('click', () => liveSearchGlobalStock(document.getElementById('stockSearch').value));
document.getElementById('configRepoBtn').addEventListener('click', () => {
  const val = prompt('GitHub 股市数据仓库（用户名/仓库名）：', localStorage.getItem('github_stock_repo') || DEFAULT_GITHUB_REPO);
  if (val && val.trim()) { localStorage.setItem('github_stock_repo', val.trim()); fetchMarketData(); }
});

// ==================== 9. 词典级多语言翻译（音标 / 短语 / 双语例句双击查词 / 中外双语连读） ====================
let transHistory = JSON.parse(localStorage.getItem('trans_hist_v1') || '[]');
let lastSrcText = '';
let lastSrcLang = 'en';
let lastTransResult = '';
let lastDstLang = 'zh-CN';

function wrapDoubleTapWords(sentence) {
  const safe = (sentence || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return safe.replace(/([A-Za-z][A-Za-z'-]*)/g, '<span class="tap-word" data-word="$1">$1</span>');
}

function detectSimpleLang(text, selectedFrom) {
  if (selectedFrom && selectedFrom !== 'auto') return selectedFrom;
  if (/[\u4e00-\u9fa5]/.test(text)) return 'zh-CN';
  if (/[\u3040-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  return 'en';
}

function renderTransHistory() {
  const list = document.getElementById('transHistory');
  if (!transHistory.length) { list.innerHTML = '<div class="sub-text" style="text-align:center;">暂无查词记录</div>'; return; }
  list.innerHTML = '';
  transHistory.slice(0, 15).forEach(h => {
    const div = document.createElement('div'); div.className = 'item-row'; div.style.cursor = 'pointer';
    div.innerHTML = `<div style="flex:1;"><div style="font-size:13px; font-weight:500;">${h.src}</div><div class="sub-text" style="color:var(--primary);">${h.dst}</div></div>`;
    div.onclick = () => { document.getElementById('transInput').value = h.src; doTranslate(); };
    list.appendChild(div);
  });
}

async function fetchRichDictionary(query) {
  const rich = { ukPhone: '', usPhone: '', meanings: [], phrases: [], examples: [] };

  // 引擎 A：有道词典公开 JSON（国内免VPN可用，含英美音标、中文释义、常用短语、中英双语例句！）
  try {
    const yd = await httpGetJson(`https://dict.youdao.com/jsonapi?q=${encodeURIComponent(query)}`);
    const ecWord = yd?.ec?.word?.[0];
    if (ecWord) {
      rich.ukPhone = ecWord.ukphone || '';
      rich.usPhone = ecWord.usphone || '';
      (ecWord.trs || []).forEach(tr => {
        const line = tr?.tr?.[0]?.l?.i?.[0];
        if (line) rich.meanings.push(line);
      });
    }
    // 汉译英词条
    const ceWord = yd?.ce?.word?.[0];
    if (ceWord && !rich.meanings.length) {
      if (ceWord.phone) rich.usPhone = ceWord.phone;
      (ceWord.trs || []).forEach(tr => {
        const parts = tr?.tr?.[0]?.l?.i || [];
        const txt = parts.map(p => (typeof p === 'string' ? p : (p['#text'] || ''))).join('').trim();
        if (txt) rich.meanings.push(txt);
      });
    }
    // 常用短语搭配
    (yd?.phrs?.phrs || []).slice(0, 8).forEach(p => {
      const en = p?.phr?.headword?.l?.i;
      const zh = p?.phr?.trs?.[0]?.tr?.l?.i;
      if (en && zh) rich.phrases.push({ en, zh });
    });
    // 双语例句
    (yd?.blng_sents_part?.['sentence-pair'] || []).slice(0, 6).forEach(sp => {
      const en = (sp.sentence || '').replace(/<[^>]+>/g, '');
      const zh = (sp['sentence-translation'] || '').replace(/<[^>]+>/g, '');
      if (en) rich.examples.push({ en, zh });
    });
  } catch {}

  // 引擎 B：FreeDictionary API（补充英文纯正音标与例句）
  if (/^[a-zA-Z-]+$/.test(query) && (!rich.usPhone || !rich.examples.length)) {
    try {
      const fd = await httpGetJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`);
      const entry = Array.isArray(fd) ? fd[0] : null;
      if (entry) {
        if (!rich.usPhone) rich.usPhone = entry.phonetic || entry.phonetics?.find(p => p.text)?.text || '';
        (entry.meanings || []).forEach(m => {
          (m.definitions || []).slice(0, 2).forEach(def => {
            if (def.example && rich.examples.length < 6) {
              rich.examples.push({ en: def.example, zh: `(${m.partOfSpeech}) ${def.definition}` });
            }
          });
        });
      }
    } catch {}
  }

  return rich;
}

function renderRichDictBox(rich) {
  const box = document.getElementById('dictRichBox');
  box.innerHTML = '';
  if (!rich.ukPhone && !rich.usPhone && !rich.meanings.length && !rich.phrases.length && !rich.examples.length) {
    return;
  }

  // 1. 音标
  if (rich.ukPhone || rich.usPhone) {
    const phDiv = document.createElement('div');
    phDiv.className = 'dict-sec';
    phDiv.innerHTML = `
      <div class="dict-sec-title">🔤 音标发音</div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; font-size:13px;">
        ${rich.ukPhone ? `<span class="badge">英 /${rich.ukPhone.replace(/\//g, '')}/</span>` : ''}
        ${rich.usPhone ? `<span class="badge badge-alarm">美 /${rich.usPhone.replace(/\//g, '')}/</span>` : ''}
      </div>
    `;
    box.appendChild(phDiv);
  }

  // 2. 词典释义
  if (rich.meanings.length) {
    const mDiv = document.createElement('div');
    mDiv.className = 'dict-sec';
    mDiv.innerHTML = `<div class="dict-sec-title">📖 词性释义</div>` +
      rich.meanings.slice(0, 6).map(m => `<div style="font-size:13px; margin-bottom:4px;">• ${m}</div>`).join('');
    box.appendChild(mDiv);
  }

  // 3. 常用短语搭配（点击短语直接查短语！）
  if (rich.phrases.length) {
    const pDiv = document.createElement('div');
    pDiv.className = 'dict-sec';
    pDiv.innerHTML = `<div class="dict-sec-title">🔗 常用短语（点一下可直接查）</div>`;
    rich.phrases.forEach(ph => {
      const chip = document.createElement('span');
      chip.className = 'phrase-chip';
      chip.innerHTML = `<strong>${ph.en}</strong> <span class="sub-text">${ph.zh}</span>`;
      chip.onclick = () => {
        document.getElementById('transInput').value = ph.en;
        doTranslate();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      pDiv.appendChild(chip);
    });
    box.appendChild(pDiv);
  }

  // 4. 双语例句（支持单词双击直接跳转翻译 + 每句带朗读按钮！）
  if (rich.examples.length) {
    const eDiv = document.createElement('div');
    eDiv.className = 'dict-sec';
    eDiv.innerHTML = `<div class="dict-sec-title">💬 双语例句（👆 双击任意英文单词可直接跳转查词）</div>`;
    rich.examples.forEach(ex => {
      const item = document.createElement('div');
      item.className = 'example-item';
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="flex:1;">${wrapDoubleTapWords(ex.en)}</div>
          <button class="btn btn-sm btn-outline ex-speak" title="朗读例句">🔊</button>
        </div>
        ${ex.zh ? `<div class="sub-text">${ex.zh}</div>` : ''}
      `;
      item.querySelector('.ex-speak').onclick = () => speakSingle(ex.en, 'en');
      eDiv.appendChild(item);
    });
    box.appendChild(eDiv);
  }
}

// 手机端 + 电脑端通用【双击例句单词直接跳转翻译】监听器
let lastTapWord = '';
let lastTapTime = 0;

function jumpTranslateWord(wordEl) {
  const w = wordEl?.dataset?.word;
  if (!w) return;
  wordEl.classList.add('flash');
  setTimeout(() => wordEl.classList.remove('flash'), 300);
  document.getElementById('transInput').value = w;
  document.getElementById('transFrom').value = 'en';
  document.getElementById('transTo').value = 'zh-CN';
  doTranslate();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('dictRichBox').addEventListener('click', (e) => {
  const span = e.target.closest('.tap-word');
  if (!span) return;
  const now = Date.now();
  const w = span.dataset.word;
  if (w === lastTapWord && now - lastTapTime < 420) {
    lastTapWord = '';
    lastTapTime = 0;
    jumpTranslateWord(span);
  } else {
    lastTapWord = w;
    lastTapTime = now;
  }
});

document.getElementById('dictRichBox').addEventListener('dblclick', (e) => {
  const span = e.target.closest('.tap-word');
  if (span) jumpTranslateWord(span);
});

async function speakSingle(text, lang) {
  if (!text) return;
  if (Capacitor.isNativePlatform()) {
    try { await NativeTools.speakText({ text, lang }); } catch (e) { alert('朗读失败：' + e.message); }
  } else if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text); u.lang = lang; speechSynthesis.speak(u);
  }
}

async function doTranslate() {
  const text = document.getElementById('transInput').value.trim();
  if (!text) return;
  const from = document.getElementById('transFrom').value;
  let to = document.getElementById('transTo').value;

  if (from === 'auto' && to === 'en' && /^[a-zA-Z0-9\s.,!?;:'"()-]+$/.test(text)) {
    to = 'zh-CN';
    document.getElementById('transTo').value = 'zh-CN';
  }
  const srcLang = detectSimpleLang(text, from);
  lastSrcText = text;
  lastSrcLang = srcLang;
  lastDstLang = to;

  const outEl = document.getElementById('transOutput');
  outEl.textContent = '🌐 正在查词与翻译...';
  document.getElementById('dictRichBox').innerHTML = '';

  let translated = '';
  // 并行拉取词典详解（单词/短语 <= 40 字符时自动加载音标、短语和例句）
  const richPromise = text.length <= 45 ? fetchRichDictionary(text) : Promise.resolve(null);

  try {
    const g = await httpGetJson(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`
    );
    if (Array.isArray(g?.[0])) translated = g[0].map(seg => seg?.[0] || '').join('');
  } catch {}

  if (!translated) {
    try {
      const mm = await httpGetJson(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=${encodeURIComponent(srcLang + '|' + to)}`
      );
      translated = mm?.responseData?.translatedText || '';
    } catch {}
  }

  const rich = await richPromise;
  if (!translated && rich?.meanings?.length) {
    translated = rich.meanings[0];
  }

  if (!translated) {
    outEl.textContent = '翻译失败，请检查网络连接后重试。';
    return;
  }

  lastTransResult = translated;
  outEl.textContent = translated;
  if (rich) renderRichDictBox(rich);

  transHistory = [
    { src: text.slice(0, 120), dst: translated.slice(0, 160) },
    ...transHistory.filter(x => x.src !== text.slice(0, 120))
  ].slice(0, 20);
  localStorage.setItem('trans_hist_v1', JSON.stringify(transHistory));
  renderTransHistory();
}

document.getElementById('doTranslateBtn').addEventListener('click', doTranslate);
document.getElementById('clearTransBtn').addEventListener('click', () => {
  document.getElementById('transInput').value = '';
  document.getElementById('transOutput').textContent = '译文将显示在这里...';
  document.getElementById('dictRichBox').innerHTML = '';
  lastSrcText = '';
  lastTransResult = '';
});
document.getElementById('swapLangBtn').addEventListener('click', () => {
  const f = document.getElementById('transFrom'), t = document.getElementById('transTo');
  if (f.value === 'auto') { f.value = t.value; t.value = t.value === 'zh-CN' ? 'en' : 'zh-CN'; }
  else { const tmp = f.value; f.value = t.value; t.value = tmp; }
});
document.getElementById('copyTransBtn').addEventListener('click', async () => {
  if (!lastTransResult) return;
  try { await navigator.clipboard.writeText(lastTransResult); alert('已复制译文！'); }
  catch { prompt('请长按复制译文：', lastTransResult); }
});
document.getElementById('speakSrcBtn').addEventListener('click', () => speakSingle(lastSrcText, lastSrcLang));
document.getElementById('speakTransBtn').addEventListener('click', () => speakSingle(lastTransResult, lastDstLang));
document.getElementById('speakBothBtn').addEventListener('click', async () => {
  if (!lastSrcText || !lastTransResult) return;
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeTools.speakPair({ text1: lastSrcText, lang1: lastSrcLang, text2: lastTransResult, lang2: lastDstLang });
    } catch (e) { alert('连读失败：' + e.message); }
  } else {
    speakSingle(lastSrcText, lastSrcLang);
    setTimeout(() => speakSingle(lastTransResult, lastDstLang), 1500);
  }
});
document.getElementById('clearTransHistBtn').addEventListener('click', () => {
  transHistory = []; localStorage.setItem('trans_hist_v1', '[]'); renderTransHistory();
});

document.getElementById('ocrTranslateBtn').addEventListener('click', async () => {
  if (!Capacitor.isNativePlatform()) return alert('请在安卓 App 中使用选图/文档识别翻译！');
  try {
    const res = await NativeTools.pickFiles({ accept: '*/*', multiple: false });
    const f = res.files?.[0];
    if (!f) return;
    document.getElementById('transOutput').textContent = '🧠 正在离线识别文字...';
    const ex = await NativeTools.extractText({ localPath: f.localPath });
    if (ex.text) { document.getElementById('transInput').value = ex.text; await doTranslate(); }
    else alert('未识别到文字');
  } catch (e) { if (!String(e.message).includes('取消')) alert('识图翻译失败：' + e.message); }
});

// ==================== 启动初始化 ====================
(async function bootstrap() {
  applyAppearance();
  renderCityTabs();
  updateLiveClock();
  setInterval(updateLiveClock, 1000);
  await initNotificationChannels();
  renderDayTabs();
  renderCourses();
  renderExams();
  renderFiles();
  renderTracks();
  renderOnlineMusicHistory(document.getElementById('onlineMusicResults'));
  renderTransHistory();
  fetchMarketData();
  loadActiveCityWeather();
})();
