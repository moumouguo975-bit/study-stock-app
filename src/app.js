import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const NativeTools = registerPlugin('NativeTools');
const DEFAULT_GITHUB_REPO = 'moumouguo975-bit/study-stock-app';
const DAYS_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// ==================== 通用工具 ====================
let toastTimer = null;
function showToast(msg, duration = 2000) {
  const el = document.getElementById('toastTip');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

async function httpGetJson(url, extraHeaders = {}) {
  const headers = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36', ...extraHeaders };
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url, headers });
    return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  }
  return await (await fetch(url)).json();
}

async function httpGetText(url, extraHeaders = {}) {
  const headers = { 'User-Agent': 'Mozilla/5.0', ...extraHeaders };
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url, headers });
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  }
  return await (await fetch(url)).text();
}

// ==================== 0. 个性化外观设置 ====================
const FONT_MAP = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  serif: '"Noto Serif SC", "Songti SC", Georgia, serif',
  mono: '"JetBrains Mono", Consolas, "Courier New", monospace',
  rounded: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", ui-rounded, sans-serif'
};

let appPrefs = JSON.parse(localStorage.getItem('app_prefs_v2') || 'null') || {
  color: '#4f46e5', darkMode: 'system', glass: true, slideDwell: true, fontFamily: 'system', fontSize: '14px'
};
const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

function hexToSoftBg(hex) {
  const c = (hex || '#4f46e5').replace('#', '');
  return `rgba(${parseInt(c.slice(0, 2), 16) || 79}, ${parseInt(c.slice(2, 4), 16) || 70}, ${parseInt(c.slice(4, 6), 16) || 229}, 0.14)`;
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

  document.getElementById('customColorPicker').value = appPrefs.color || '#4f46e5';
  document.getElementById('darkModeSelect').value = appPrefs.darkMode || 'system';
  document.getElementById('glassModeToggle').checked = !!appPrefs.glass;
  document.getElementById('slideDwellToggle').checked = appPrefs.slideDwell !== false;
  document.getElementById('fontFamilySelect').value = appPrefs.fontFamily || 'system';
  document.getElementById('fontSizeSelect').value = appPrefs.fontSize || '14px';
  document.querySelectorAll('#colorSwatches .swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.color.toLowerCase() === (appPrefs.color || '').toLowerCase());
  });
}

function savePrefs() {
  localStorage.setItem('app_prefs_v2', JSON.stringify(appPrefs));
  applyAppearance();
}

darkMediaQuery.addEventListener?.('change', applyAppearance);
const settingsModal = document.getElementById('settingsModal');
document.getElementById('openSettingsBtn').addEventListener('click', () => { applyAppearance(); settingsModal.classList.add('open'); });
document.getElementById('closeSettingsBtn').addEventListener('click', () => settingsModal.classList.remove('open'));
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.classList.remove('open'); });
document.querySelectorAll('#colorSwatches .swatch').forEach(s => s.addEventListener('click', () => { appPrefs.color = s.dataset.color; savePrefs(); }));
document.getElementById('customColorPicker').addEventListener('input', (e) => { appPrefs.color = e.target.value; savePrefs(); });
document.getElementById('darkModeSelect').addEventListener('change', (e) => { appPrefs.darkMode = e.target.value; savePrefs(); });
document.getElementById('glassModeToggle').addEventListener('change', (e) => { appPrefs.glass = e.target.checked; savePrefs(); });
document.getElementById('slideDwellToggle').addEventListener('change', (e) => { appPrefs.slideDwell = e.target.checked; savePrefs(); });
document.getElementById('fontFamilySelect').addEventListener('change', (e) => { appPrefs.fontFamily = e.target.value; savePrefs(); });
document.getElementById('fontSizeSelect').addEventListener('change', (e) => { appPrefs.fontSize = e.target.value; savePrefs(); });

// ==================== 1. 底部连续跟手液态毛玻璃 + 全局GPU跟手光球 & 0.85秒停顿自动打开 ====================
const bottomNav = document.getElementById('bottomNav');
const navIndicator = document.getElementById('navGlassIndicator');
const navBtns = Array.from(bottomNav.querySelectorAll('button'));
let currentTabIdx = 0;
let navDragging = false;
let navDragRaf = 0;
let navPendingClientX = 0;

function updateNavIndicatorPosition(idx) {
  const tabW = bottomNav.clientWidth / navBtns.length;
  navIndicator.style.transform = `translate3d(${idx * tabW}px, 0, 0) scale(1)`;
}

function setNavIndicatorDragX(clientX) {
  const rect = bottomNav.getBoundingClientRect();
  if (!rect.width) return;
  const tabW = rect.width / navBtns.length;
  const rawX = clientX - rect.left - tabW / 2;
  const clampedX = Math.max(0, Math.min(rect.width - tabW, rawX));
  navIndicator.style.transform = `translate3d(${clampedX.toFixed(2)}px, 0, 0) scale(1.05)`;
}

function switchTabByIndex(idx, withHaptic = false, snapIndicator = true) {
  if (idx < 0 || idx >= navBtns.length) return;
  const changed = idx !== currentTabIdx;
  currentTabIdx = idx;
  const targetBtn = navBtns[idx];
  navBtns.forEach(b => b.classList.remove('active'));
  targetBtn.classList.add('active');
  document.getElementById('headerTitle').textContent = targetBtn.dataset.title;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${targetBtn.dataset.tab}`).classList.add('active');
  if (snapIndicator) updateNavIndicatorPosition(idx);
  if (changed && withHaptic && navigator.vibrate) navigator.vibrate(10);
}

window.addEventListener('resize', () => {
  if (!navDragging) updateNavIndicatorPosition(currentTabIdx);
});

function handleNavSlideAt(clientX) {
  const rect = bottomNav.getBoundingClientRect();
  if (!rect.width) return;
  const idx = Math.floor(Math.max(0, Math.min(0.9999, (clientX - rect.left) / rect.width)) * navBtns.length);
  setNavIndicatorDragX(clientX);
  switchTabByIndex(idx, true, false);
}

navBtns.forEach((btn, idx) => btn.addEventListener('click', () => {
  navDragging = false;
  navIndicator.classList.remove('dragging');
  switchTabByIndex(idx, false, true);
}));

bottomNav.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  if (!t) return;
  navDragging = true;
  navPendingClientX = t.clientX;
  navIndicator.classList.add('dragging');
  handleNavSlideAt(t.clientX);
}, { passive: true });

bottomNav.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (!t) return;
  e.preventDefault();
  navPendingClientX = t.clientX;
  if (!navDragRaf) {
    navDragRaf = requestAnimationFrame(() => {
      navDragRaf = 0;
      if (navDragging) handleNavSlideAt(navPendingClientX);
    });
  }
}, { passive: false });

function finishNavDrag() {
  if (navDragRaf) { cancelAnimationFrame(navDragRaf); navDragRaf = 0; }
  navDragging = false;
  navIndicator.classList.remove('dragging');
  updateNavIndicatorPosition(currentTabIdx);
}
bottomNav.addEventListener('touchend', finishNavDrag, { passive: true });
bottomNav.addEventListener('touchcancel', finishNavDrag, { passive: true });

// 顶栏防下拉截断，保证上方100%跟手
document.getElementById('topHeader').addEventListener('touchmove', (e) => {
  if (appPrefs.slideDwell !== false) e.preventDefault();
}, { passive: false });

const fingerOrb = document.getElementById('fingerGlassOrb');
const slideLens = document.getElementById('slideGlassLens');
const slideBar = document.getElementById('slideGlassBar');
const INTERACTIVE_SEL = [
  'button:not(#bottomNav button)', '.day-pill', '.city-pill', '.eq-pill',
  '.ambient-btn', '.idx-box', '.hour-chip', '.day-chip', '.phrase-chip',
  '.swatch', '.play-track', '.st-head', '.open-trigger', '.tap-word'
].join(', ');

let dwellTarget = null;
let dwellTimer = null;
let dwellBarRaf1 = 0;
let dwellBarRaf2 = 0;
let dwellFired = false;
let isProgrammaticDwellClick = false;
let suppressClickUntil = 0;
let dwellAnchorX = 0;
let dwellAnchorY = 0;

let orbActive = false;
let orbRafId = 0;
let orbX = -120;
let orbY = -120;
let touchStartScrollY = 0;
let lastHitCheckX = -999;
let lastHitCheckY = -999;

function hideFingerOrb() {
  orbActive = false;
  if (orbRafId) { cancelAnimationFrame(orbRafId); orbRafId = 0; }
  fingerOrb.classList.remove('visible');
}

function positionSlideLens(el) {
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const pad = 3;
  slideLens.style.transform = `translate3d(${(r.left - pad).toFixed(1)}px, ${(r.top - pad).toFixed(1)}px, 0)`;
  slideLens.style.width = `${(r.width + pad * 2).toFixed(1)}px`;
  slideLens.style.height = `${(r.height + pad * 2).toFixed(1)}px`;
  slideLens.classList.add('visible');
}

function cancelSlideDwell() {
  if (dwellTimer) { clearTimeout(dwellTimer); dwellTimer = null; }
  if (dwellBarRaf1) { cancelAnimationFrame(dwellBarRaf1); dwellBarRaf1 = 0; }
  if (dwellBarRaf2) { cancelAnimationFrame(dwellBarRaf2); dwellBarRaf2 = 0; }
  slideLens.classList.remove('visible', 'fired');
  slideBar.style.transition = 'none';
  slideBar.style.transform = 'scaleX(0)';
}

function startDwellOn(el, ax, ay) {
  if (dwellTimer) { clearTimeout(dwellTimer); dwellTimer = null; }
  if (dwellBarRaf1) { cancelAnimationFrame(dwellBarRaf1); dwellBarRaf1 = 0; }
  if (dwellBarRaf2) { cancelAnimationFrame(dwellBarRaf2); dwellBarRaf2 = 0; }
  dwellTarget = el;
  dwellAnchorX = ax;
  dwellAnchorY = ay;
  positionSlideLens(el);
  slideLens.classList.remove('fired');
  slideBar.style.transition = 'none';
  slideBar.style.transform = 'scaleX(0)';

  // 双 rAF 纯 GPU 合成层启动进度条，彻底消除 offsetWidth 强制重排
  dwellBarRaf1 = requestAnimationFrame(() => {
    dwellBarRaf1 = 0;
    dwellBarRaf2 = requestAnimationFrame(() => {
      dwellBarRaf2 = 0;
      if (dwellTarget !== el || dwellFired) return;
      slideBar.style.transition = 'transform 850ms linear';
      slideBar.style.transform = 'scaleX(1)';
    });
  });

  dwellTimer = setTimeout(() => {
    dwellTimer = null;
    if (dwellTarget !== el) return;
    dwellFired = true;
    slideLens.classList.add('fired');
    if (navigator.vibrate) navigator.vibrate(25);

    isProgrammaticDwellClick = true;
    try {
      if (el.classList.contains('tap-word')) jumpTranslateWord(el);
      else el.click();
    } finally {
      isProgrammaticDwellClick = false;
    }

    suppressClickUntil = Date.now() + 450;
    setTimeout(() => {
      cancelSlideDwell();
      hideFingerOrb();
    }, 150);
  }, 850);
}

function flushOrbFrame() {
  orbRafId = 0;
  if (!orbActive) return;
  fingerOrb.style.transform = `translate3d(${orbX.toFixed(1)}px, ${orbY.toFixed(1)}px, 0)`;
  fingerOrb.classList.add('visible');

  if (dwellFired) return;
  // 页面发生明显滚动时立即收起吸附框，防止框体脱离按钮悬空
  if (Math.abs(window.scrollY - touchStartScrollY) > 8) {
    if (dwellTarget) { cancelSlideDwell(); dwellTarget = null; }
    return;
  }

  if (Math.hypot(orbX - lastHitCheckX, orbY - lastHitCheckY) >= 2 || !dwellTarget) {
    lastHitCheckX = orbX;
    lastHitCheckY = orbY;
    const hit = document.elementFromPoint(orbX, orbY);
    const el = hit ? hit.closest(INTERACTIVE_SEL) : null;
    if (!el) {
      if (dwellTarget) { cancelSlideDwell(); dwellTarget = null; }
    } else if (el !== dwellTarget) {
      startDwellOn(el, orbX, orbY);
    } else if (Math.hypot(orbX - dwellAnchorX, orbY - dwellAnchorY) > 22) {
      startDwellOn(el, orbX, orbY);
    }
  }
}

function scheduleOrbFrame() {
  if (!orbRafId) orbRafId = requestAnimationFrame(flushOrbFrame);
}

document.addEventListener('touchstart', (e) => {
  if (appPrefs.slideDwell === false) return;
  if (e.target.closest('#bottomNav') || e.target.closest('input, textarea, select')) return;
  const t = e.touches[0];
  if (!t) return;
  dwellFired = false;
  orbActive = true;
  orbX = t.clientX;
  orbY = t.clientY;
  touchStartScrollY = window.scrollY;
  lastHitCheckX = orbX;
  lastHitCheckY = orbY;

  fingerOrb.style.transform = `translate3d(${orbX.toFixed(1)}px, ${orbY.toFixed(1)}px, 0)`;
  fingerOrb.classList.add('visible');

  const el = e.target instanceof Element ? e.target.closest(INTERACTIVE_SEL) : null;
  if (el) startDwellOn(el, orbX, orbY);
  else { cancelSlideDwell(); dwellTarget = null; }
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (appPrefs.slideDwell === false || !orbActive) return;
  if (e.target.closest('#bottomNav') || e.target.closest('input[type="range"]')) return;
  const t = e.touches[0];
  if (!t) return;
  orbX = t.clientX;
  orbY = t.clientY;
  scheduleOrbFrame();
}, { passive: true });

document.addEventListener('touchend', () => {
  hideFingerOrb();
  if (!dwellFired) cancelSlideDwell();
  dwellTarget = null;
}, { passive: true });

document.addEventListener('touchcancel', () => {
  hideFingerOrb();
  if (!dwellFired) cancelSlideDwell();
  dwellTarget = null;
}, { passive: true });

// 任意容器发生滚动时立即同步收起按钮吸附框，保证不漂移脱节
document.addEventListener('scroll', () => {
  if (dwellTarget && !dwellFired) {
    cancelSlideDwell();
    dwellTarget = null;
  }
}, { capture: true, passive: true });

document.addEventListener('click', (e) => {
  if (!isProgrammaticDwellClick && Date.now() < suppressClickUntil) {
    e.stopPropagation();
    e.preventDefault();
  }
}, true);

// ==================== 2. 双时区参考 + 中外双源天气 + 切地区即时建议 ====================
const DEVICE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
let savedCities = JSON.parse(localStorage.getItem('weather_cities_v3') || '[]');
let dismissedAutoIds = JSON.parse(localStorage.getItem('dismissed_auto_cities_v1') || '[]');
let activeCityId = localStorage.getItem('active_city_id_v3') || '';
let weatherCache = JSON.parse(localStorage.getItem('weather_cache_v1') || '{}');
let deviceRefInfo = null;
let networkRefInfo = null;

const BUILTIN_CITIES = {
  '北京': [39.904, 116.407, 'Asia/Shanghai'], '上海': [31.230, 121.474, 'Asia/Shanghai'], '广州': [23.129, 113.264, 'Asia/Shanghai'],
  '深圳': [22.543, 114.058, 'Asia/Shanghai'], '杭州': [30.274, 120.155, 'Asia/Shanghai'], '成都': [30.573, 104.067, 'Asia/Shanghai'],
  '重庆': [29.563, 106.552, 'Asia/Shanghai'], '武汉': [30.593, 114.306, 'Asia/Shanghai'], '南京': [32.060, 118.797, 'Asia/Shanghai'],
  '西安': [34.342, 108.940, 'Asia/Shanghai'], '苏州': [31.299, 120.585, 'Asia/Shanghai'], '天津': [39.084, 117.201, 'Asia/Shanghai'],
  '长沙': [28.228, 112.939, 'Asia/Shanghai'], '郑州': [34.747, 113.625, 'Asia/Shanghai'], '青岛': [36.067, 120.383, 'Asia/Shanghai'],
  '厦门': [24.480, 118.089, 'Asia/Shanghai'], '大连': [38.914, 121.615, 'Asia/Shanghai'], '宁波': [29.868, 121.544, 'Asia/Shanghai'],
  '合肥': [31.821, 117.227, 'Asia/Shanghai'], '昆明': [25.039, 102.718, 'Asia/Shanghai'], '哈尔滨': [45.804, 126.535, 'Asia/Shanghai'],
  '沈阳': [41.806, 123.432, 'Asia/Shanghai'], '济南': [36.651, 117.120, 'Asia/Shanghai'], '福州': [26.075, 119.297, 'Asia/Shanghai'],
  '太原': [37.871, 112.549, 'Asia/Shanghai'], '石家庄': [38.043, 114.515, 'Asia/Shanghai'], '南宁': [22.817, 108.367, 'Asia/Shanghai'],
  '贵阳': [26.647, 106.630, 'Asia/Shanghai'], '海口': [20.044, 110.200, 'Asia/Shanghai'], '三亚': [18.253, 109.512, 'Asia/Shanghai'],
  '兰州': [36.061, 103.834, 'Asia/Shanghai'], '拉萨': [29.653, 91.172, 'Asia/Shanghai'], '乌鲁木齐': [43.826, 87.617, 'Asia/Shanghai'],
  '南昌': [28.683, 115.858, 'Asia/Shanghai'], '长春': [43.817, 125.324, 'Asia/Shanghai'], '无锡': [31.491, 120.312, 'Asia/Shanghai'],
  '佛山': [23.022, 113.121, 'Asia/Shanghai'], '东莞': [23.021, 113.752, 'Asia/Shanghai'], '珠海': [22.271, 113.577, 'Asia/Shanghai'],
  '香港': [22.319, 114.169, 'Asia/Hong_Kong'], '澳门': [22.199, 113.544, 'Asia/Macau'], '台北': [25.033, 121.565, 'Asia/Taipei'],
  '东京': [35.676, 139.650, 'Asia/Tokyo'], '首尔': [37.567, 126.978, 'Asia/Seoul'], '新加坡': [1.352, 103.820, 'Asia/Singapore'],
  '纽约': [40.713, -74.006, 'America/New_York'], '洛杉矶': [34.052, -118.244, 'America/Los_Angeles'], '旧金山': [37.775, -122.419, 'America/Los_Angeles'],
  '伦敦': [51.507, -0.128, 'Europe/London'], '巴黎': [48.857, 2.352, 'Europe/Paris'], '悉尼': [-33.869, 151.209, 'Australia/Sydney']
};

const WMO_MAP = {
  0: ['☀️', '晴朗'], 1: ['🌤️', '晴间多云'], 2: ['⛅', '多云'], 3: ['☁️', '阴天'],
  45: ['🌫️', '有雾'], 48: ['🌫️', '冻雾'], 51: ['🌦️', '小毛雨'], 53: ['🌦️', '毛毛雨'], 55: ['🌧️', '浓毛雨'],
  61: ['🌧️', '小雨'], 63: ['🌧️', '中雨'], 65: ['🌧️', '大雨'], 71: ['❄️', '小雪'], 73: ['❄️', '中雪'], 75: ['❄️', '大雪'],
  80: ['🌦️', '阵雨'], 81: ['🌧️', '中阵雨'], 82: ['⛈️', '强阵雨'], 95: ['⛈️', '雷阵雨'], 96: ['⛈️', '雷暴'], 99: ['⛈️', '强雷暴']
};

function wmoDesc(code) { return WMO_MAP[code] || ['🌤️', '多云']; }
function wttrCodeToWmo(wc) {
  const c = Number(wc);
  if (c === 113) return 0; if (c === 116) return 2; if (c === 119 || c === 122) return 3;
  if (c === 143 || c === 248 || c === 260) return 45; if (c >= 176 && c <= 299) return 61;
  if (c >= 302 && c <= 314) return 63; if (c >= 317 && c <= 338) return 71;
  if (c >= 353 && c <= 359) return 80; if (c >= 386) return 95;
  return 2;
}

function saveCitiesState() {
  localStorage.setItem('weather_cities_v3', JSON.stringify(savedCities));
  localStorage.setItem('dismissed_auto_cities_v1', JSON.stringify(dismissedAutoIds));
  localStorage.setItem('active_city_id_v3', activeCityId);
}
function getActiveCity() { return savedCities.find(c => c.id === activeCityId) || savedCities[0]; }
function formatClockInTz(now, tz) {
  try {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
  } catch { return now.toTimeString().slice(0, 8); }
}
function getCityLocalHour(tz) {
  try { return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz || DEVICE_TZ, hour12: false, hour: '2-digit' }).format(new Date())) % 24; }
  catch { return new Date().getHours(); }
}

function updateLiveClock() {
  const now = new Date();
  const city = getActiveCity();
  const tz = city?.timezone || DEVICE_TZ;
  try {
    document.getElementById('liveClock').textContent = formatClockInTz(now, tz);
    document.getElementById('liveDate').textContent = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz, year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    }).format(now);
    const tag = city?.kind === 'device' ? '📱 设备时区'
      : (city?.kind === 'network' ? '🌐 网络时区' : (city?.kind === 'synced' ? '📍 设备与网络同区' : '🌍 自选地区'));
    document.getElementById('liveTzLabel').textContent = `${tag} · ${tz}`;
  } catch { document.getElementById('liveClock').textContent = now.toTimeString().slice(0, 8); }

  const dualBar = document.getElementById('dualTzBar');
  if (deviceRefInfo && networkRefInfo && deviceRefInfo.timezone !== networkRefInfo.timezone) {
    dualBar.classList.add('show');
    dualBar.innerHTML = `
      <span>📱 设备(${deviceRefInfo.name}): <strong>${formatClockInTz(now, deviceRefInfo.timezone)}</strong></span>
      <span>🌐 网络(${networkRefInfo.name}): <strong>${formatClockInTz(now, networkRefInfo.timezone)}</strong></span>
    `;
  } else {
    dualBar.classList.remove('show');
  }
}

async function geocodeCitySmart(rawName) {
  const trimmed = (rawName || '').trim();
  const clean = trimmed.replace(/(省|市|特别行政区|自治区)$/, '');
  if (BUILTIN_CITIES[clean]) {
    const [lat, lon, timezone] = BUILTIN_CITIES[clean];
    return { name: clean, lat, lon, timezone };
  }
  try {
    const geo = await httpGetJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=1&language=zh&format=json`);
    const loc = geo?.results?.[0];
    if (loc) return { name: loc.name || clean, lat: loc.latitude, lon: loc.longitude, timezone: loc.timezone || DEVICE_TZ };
  } catch {}
  try {
    const nom = await httpGetJson(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=1&accept-language=zh`);
    if (nom?.[0]?.lat) return { name: clean || trimmed, lat: Number(nom[0].lat), lon: Number(nom[0].lon), timezone: DEVICE_TZ };
  } catch {}
  return null;
}

function renderCityTabs() {
  const bar = document.getElementById('cityTabs');
  bar.innerHTML = '';
  savedCities.forEach(c => {
    const pill = document.createElement('button');
    pill.className = 'city-pill' + (c.id === activeCityId ? ' active' : '');
    const icon = c.kind === 'device' ? '📱' : (c.kind === 'network' ? '🌐' : (c.kind === 'synced' ? '📍' : '🌍'));
    pill.textContent = c.id === activeCityId ? `${icon} ${c.name} ×` : `${icon} ${c.name}`;
    pill.onclick = () => {
      if (c.id === activeCityId) {
        if (savedCities.length <= 1) { showToast('⚠️ 最少需保留 1 个地区'); return; }
        if (confirm(`确定删除地区【${c.name}】吗？`)) {
          if ((c.id === 'auto_device' || c.id === 'auto_network') && !dismissedAutoIds.includes(c.id)) {
            dismissedAutoIds.push(c.id);
          }
          savedCities = savedCities.filter(x => x.id !== c.id);
          activeCityId = savedCities[0].id;
          saveCitiesState(); renderCityTabs(); updateLiveClock(); loadActiveCityWeather();
        }
        return;
      }
      activeCityId = c.id;
      saveCitiesState(); renderCityTabs(); updateLiveClock(); loadActiveCityWeather();
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
  const val = prompt('输入城市或地区名（如 成都、杭州、上海、东京、纽约）：');
  if (!val || !val.trim()) return;
  showToast(`🔍 正在查找「${val.trim()}」...`);
  const loc = await geocodeCitySmart(val.trim());
  if (!loc) return alert('未找到该地区，请尝试输入城市简称');
  const newCity = { id: 'custom_' + Date.now(), kind: 'custom', ...loc };
  savedCities.push(newCity);
  activeCityId = newCity.id;
  saveCitiesState(); renderCityTabs(); updateLiveClock(); loadActiveCityWeather();
}

function buildSmartAdvice(cityObj, overrideLabel, temp, precip, code) {
  const city = cityObj || getActiveCity();
  if (!city) return;
  const tips = [];
  const label = overrideLabel || `${city.name}当前`;
  const localHr = getCityLocalHour(city.timezone);

  if (temp != null && !isNaN(temp)) {
    if (precip >= 40 || (code >= 51 && code <= 99)) tips.push(`☔ ${label}降水概率 ${precip}%，外出记得带伞！`);
    if (temp <= 8) tips.push(`🧥 ${label}气温偏低 (${temp}°C)，注意穿厚外套防寒。`);
    else if (temp >= 29) tips.push(`🕶️ ${label}气温较高 (${temp}°C)，注意防晒与补水。`);
    else tips.push(`🌤️ ${label}温度约 ${temp}°C，体感舒适，适合学习与出行。`);
  } else {
    tips.push(`🕒 ${city.name}当前当地时间约 ${localHr} 点，正在同步最新气象数据...`);
  }

  if ((city.kind === 'device' || city.kind === 'synced') && !overrideLabel) {
    const now = new Date();
    const todayCourses = courses.filter(c => Number(c.day) === now.getDay()).sort((a, b) => a.start.localeCompare(b.start));
    if (todayCourses.length) {
      const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const nextC = todayCourses.find(c => c.start >= hm);
      tips.push(nextC ? `📚 今日共 ${todayCourses.length} 节课，下一节《${nextC.name}》(${nextC.start} ${nextC.room || ''})。` : `✅ 今日 ${todayCourses.length} 节课已上完，听歌放松吧！`);
    }
    const upcoming = exams.filter(e => new Date(e.datetime).getTime() > Date.now()).sort((a, b) => new Date(a.datetime) - new Date(b.datetime))[0];
    if (upcoming) {
      const days = Math.ceil((new Date(upcoming.datetime).getTime() - Date.now()) / 86400000);
      if (days <= 7) tips.push(`🎯 距离【${upcoming.name}】仅剩 ${days} 天，记得安排冲刺复习！`);
    }
  } else if (!overrideLabel) {
    const period = (localHr >= 22 || localHr < 6) ? '当地正值深夜/凌晨，注意时差与休息。'
      : (localHr >= 12 && localHr <= 14 ? '当地正值午间。' : '当地正值白天活跃时段。');
    tips.push(`🌍 【${city.name}】${period}`);
  }
  document.getElementById('smartAdviceBox').innerHTML = `<strong>💡 ${city.name} · 智能建议</strong><br/>${tips.slice(0, 3).join('<br/>')}`;
}

async function fetchWeatherFromOpenMeteo(city) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,weather_code,precipitation_probability` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=8`;
  const w = await httpGetJson(url);
  if (!w?.current) throw new Error('Open-Meteo 无数据');
  const cur = w.current, hourly = w.hourly || {}, daily = w.daily || {};
  let startIdx = (hourly.time || []).findIndex(t => t.startsWith((cur.time || '').slice(0, 13)));
  if (startIdx < 0) startIdx = 0;

  const hours = [];
  for (let i = startIdx; i < Math.min(startIdx + 24, (hourly.time || []).length); i++) {
    hours.push({ label: i === startIdx ? '现在' : hourly.time[i].slice(11, 16), temp: Math.round(hourly.temperature_2m[i]), code: hourly.weather_code[i], precip: hourly.precipitation_probability?.[i] ?? 0 });
  }
  const days = [];
  for (let i = 0; i < Math.min(8, (daily.time || []).length); i++) {
    const df = daily.time[i], dObj = new Date(df + 'T12:00:00');
    days.push({ dateShort: df.slice(5), wk: i === 0 ? '今天' : (i === 1 ? '明天' : DAYS_LABEL[dObj.getDay()]), code: daily.weather_code[i], min: Math.round(daily.temperature_2m_min[i]), max: Math.round(daily.temperature_2m_max[i]), precip: daily.precipitation_probability_max?.[i] ?? 0 });
  }
  return { timezone: w.timezone || city.timezone, temp: Math.round(cur.temperature_2m), feels: Math.round(cur.apparent_temperature), humidity: cur.relative_humidity_2m, code: cur.weather_code, precip: days[0]?.precip ?? 0, hours, days };
}

async function fetchWeatherFromWttr(city) {
  const w = await httpGetJson(`https://wttr.in/${city.lat},${city.lon}?format=j1&lang=zh`);
  const cc = w?.current_condition?.[0];
  if (!cc) throw new Error('wttr.in 无数据');
  const hours = [], days = [];
  (w.weather || []).forEach((d, idx) => {
    const dObj = new Date(d.date + 'T12:00:00');
    const maxRain = Math.max(...(d.hourly || []).map(h => Number(h.chanceofrain || 0)), 0);
    days.push({ dateShort: (d.date || '').slice(5), wk: idx === 0 ? '今天' : (idx === 1 ? '明天' : DAYS_LABEL[dObj.getDay()]), code: wttrCodeToWmo(d.hourly?.[4]?.weatherCode || cc.weatherCode), min: Number(d.mintempC || 0), max: Number(d.maxtempC || 0), precip: maxRain });
    if (idx < 2) {
      (d.hourly || []).forEach(h => {
        hours.push({ label: `${String(Math.floor(Number(h.time || 0) / 100)).padStart(2, '0')}:00`, temp: Number(h.tempC || cc.temp_C), code: wttrCodeToWmo(h.weatherCode), precip: Number(h.chanceofrain || 0) });
      });
    }
  });
  return { timezone: city.timezone, temp: Number(cc.temp_C), feels: Number(cc.FeelsLikeC || cc.temp_C), humidity: Number(cc.humidity || 50), code: wttrCodeToWmo(cc.weatherCode), precip: days[0]?.precip ?? 0, hours: hours.slice(0, 16), days };
}

function renderWeatherDataToUI(city, data) {
  const [ico, txt] = wmoDesc(data.code);
  document.getElementById('weatherTemp').textContent = `${ico} ${data.temp}°C`;
  document.getElementById('weatherDesc').textContent = `${city.name} · ${txt}`;
  document.getElementById('weatherDetail').textContent = `体感 ${data.feels}°C · 湿度 ${data.humidity}% · 降水 ${data.precip}%`;

  const hStrip = document.getElementById('hourlyStrip');
  hStrip.innerHTML = '';
  (data.hours || []).forEach((h, i) => {
    const [hIco, hTxt] = wmoDesc(h.code);
    const chip = document.createElement('div');
    chip.className = 'hour-chip' + (i === 0 ? ' selected' : '');
    chip.innerHTML = `<div style="opacity:0.85;">${h.label}</div><div style="font-size:16px; margin:2px 0;">${hIco}</div><div style="font-weight:700;">${h.temp}°</div><div style="opacity:0.8;">💧${h.precip}%</div>`;
    chip.onclick = () => {
      hStrip.querySelectorAll('.hour-chip').forEach(x => x.classList.remove('selected'));
      chip.classList.add('selected');
      buildSmartAdvice(city, `${city.name} ${h.label} (${hTxt})`, h.temp, h.precip, h.code);
    };
    hStrip.appendChild(chip);
  });

  const dStrip = document.getElementById('dailyStrip');
  dStrip.innerHTML = '';
  (data.days || []).forEach((d, i) => {
    const [dIco, dTxt] = wmoDesc(d.code);
    const chip = document.createElement('div');
    chip.className = 'day-chip' + (i === 0 ? ' selected' : '');
    chip.innerHTML = `<div style="font-weight:600;">${d.wk} ${d.dateShort}</div><div style="font-size:17px; margin:2px 0;">${dIco}</div><div>${dTxt}</div><div style="font-weight:700; margin-top:2px;">${d.min}°~${d.max}°</div><div style="opacity:0.8;">💧${d.precip}%</div>`;
    chip.onclick = () => {
      dStrip.querySelectorAll('.day-chip').forEach(x => x.classList.remove('selected'));
      chip.classList.add('selected');
      buildSmartAdvice(city, `${city.name} ${d.wk} (${d.dateShort} ${dTxt})`, Math.round((d.min + d.max) / 2), d.precip, d.code);
    };
    dStrip.appendChild(chip);
  });
  buildSmartAdvice(city, null, data.temp, data.precip, data.code);
}

async function loadActiveCityWeather() {
  const city = getActiveCity();
  if (!city) return;
  const reqId = city.id;
  if (weatherCache[city.id]) {
    renderWeatherDataToUI(city, weatherCache[city.id]);
  } else {
    document.getElementById('weatherDesc').textContent = `同步 ${city.name} 天气...`;
    buildSmartAdvice(city, null, null, 0, 0);
  }
  let data = null;
  try { data = await fetchWeatherFromOpenMeteo(city); }
  catch { try { data = await fetchWeatherFromWttr(city); } catch {} }
  if (getActiveCity()?.id !== reqId) return;
  if (data) {
    if (data.timezone && city.kind === 'custom') { city.timezone = data.timezone; saveCitiesState(); updateLiveClock(); }
    weatherCache[city.id] = data;
    localStorage.setItem('weather_cache_v1', JSON.stringify(weatherCache));
    renderWeatherDataToUI(city, data);
  } else if (!weatherCache[city.id]) {
    document.getElementById('weatherDesc').textContent = `${city.name} · 暂未联网`;
    buildSmartAdvice(city, null, null, 0, 0);
  }
}

async function detectDeviceAndNetworkZones(resetDismissed = false) {
  if (resetDismissed) dismissedAutoIds = [];
  let netLoc = null;
  try {
    const ip = await httpGetJson('https://get.geojs.io/v1/ip/geo.json');
    if (ip?.latitude && ip?.longitude) netLoc = { name: ip.city || ip.region || '网络地区', lat: Number(ip.latitude), lon: Number(ip.longitude), timezone: ip.timezone || DEVICE_TZ };
  } catch {}
  if (!netLoc) {
    try {
      const ip2 = await httpGetJson('https://ipwho.is/');
      if (ip2?.success) netLoc = { name: ip2.city || ip2.region || '网络地区', lat: Number(ip2.latitude), lon: Number(ip2.longitude), timezone: ip2.timezone?.id || DEVICE_TZ };
    } catch {}
  }
  networkRefInfo = netLoc;

  let devLoc = null;
  if (Capacitor.isNativePlatform()) {
    try {
      const gps = await NativeTools.getDeviceLocation();
      if (gps && gps.lat != null && gps.lon != null) {
        let cname = DEVICE_TZ.split('/').pop().replace(/_/g, ' ');
        try {
          const rev = await httpGetJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${gps.lat}&longitude=${gps.lon}&localityLanguage=zh`);
          const f = rev?.city || rev?.locality || rev?.principalSubdivision;
          if (f) cname = f.replace(/市$/, '');
        } catch {}
        devLoc = { name: cname, lat: gps.lat, lon: gps.lon, timezone: DEVICE_TZ };
      }
    } catch {}
  }
  if (!devLoc) {
    if (netLoc && netLoc.timezone === DEVICE_TZ) devLoc = { ...netLoc };
    else if (/Shanghai|Chongqing|Beijing/i.test(DEVICE_TZ)) devLoc = { name: '北京', lat: 39.904, lon: 116.407, timezone: DEVICE_TZ };
    else {
      const found = await geocodeCitySmart(DEVICE_TZ.split('/').pop().replace(/_/g, ' '));
      if (found) devLoc = { ...found, timezone: DEVICE_TZ };
    }
  }
  if (!devLoc) devLoc = { name: '北京', lat: 39.904, lon: 116.407, timezone: DEVICE_TZ };
  deviceRefInfo = devLoc;

  const isMismatch = !!(networkRefInfo && networkRefInfo.timezone !== deviceRefInfo.timezone);
  const upsert = (id, data) => {
    if (dismissedAutoIds.includes(id)) return;
    const idx = savedCities.findIndex(c => c.id === id);
    if (idx >= 0) savedCities[idx] = { ...savedCities[idx], ...data, id };
    else savedCities.unshift({ id, ...data });
  };
  if (isMismatch) {
    upsert('auto_network', { kind: 'network', ...networkRefInfo });
    upsert('auto_device', { kind: 'device', ...deviceRefInfo });
  } else {
    savedCities = savedCities.filter(c => c.id !== 'auto_network');
    upsert('auto_device', { kind: 'synced', ...deviceRefInfo });
  }
  if (!savedCities.length) savedCities.push({ id: 'auto_device', kind: 'device', ...deviceRefInfo });
  if (!savedCities.some(c => c.id === activeCityId)) activeCityId = savedCities[0].id;
  saveCitiesState(); renderCityTabs(); updateLiveClock(); await loadActiveCityWeather();
}

document.getElementById('refreshWeatherBtn').addEventListener('click', async () => {
  showToast('🔄 正在双源刷新天气与双时区...');
  await detectDeviceAndNetworkZones(true);
  showToast('✅ 天气、双时区与建议已更新');
});

// ==================== 3. 闹钟与设备提醒引擎 ====================
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
        const osc = ringAudioCtx.createOscillator(), gain = ringAudioCtx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        const t = ringAudioCtx.currentTime + i * 0.17;
        gain.gain.setValueAtTime(0.001, t); gain.gain.exponentialRampToValueAtTime(0.6, t + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain); gain.connect(ringAudioCtx.destination); osc.start(t); osc.stop(t + 0.16);
      });
      if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150]);
    };
    beep(); ringInterval = setInterval(beep, 1200);
  } catch {}
}
function stopRingingSoundOnly() {
  if (ringInterval) { clearInterval(ringInterval); ringInterval = null; }
  if (ringAudioCtx) { try { ringAudioCtx.close(); } catch {} ringAudioCtx = null; }
  if (navigator.vibrate) navigator.vibrate(0);
}
document.getElementById('stopRingBtn').addEventListener('click', () => { stopRingingSoundOnly(); document.getElementById('ringingOverlay').classList.remove('active'); });
function makeSafeNotifId() { return Math.floor(Math.random() * 2000000000) + 1; }

async function initNotificationChannels() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.requestPermissions();
    await LocalNotifications.createChannel({ id: 'alarm_ring_v3', name: '课表与日程响铃闹钟', description: '15秒响铃与震动', importance: 5, visibility: 1, vibration: true, sound: 'alarm_ring.wav' });
    await LocalNotifications.createChannel({ id: 'vibrate_channel_v3', name: '震动横幅提醒', description: '震动提醒', importance: 4, vibration: true });
    await LocalNotifications.createChannel({ id: 'normal_channel_v3', name: '普通通知', description: '常规通知', importance: 3, vibration: false });
    LocalNotifications.addListener('localNotificationReceived', (n) => { if (n.channelId === 'alarm_ring_v3') startRingingOverlay(n.title, n.body); });
    LocalNotifications.addListener('localNotificationActionPerformed', (a) => { if (a.notification?.channelId === 'alarm_ring_v3') startRingingOverlay(a.notification.title, a.notification.body); });
  } catch {}
}
async function syncToDeviceAlarm({ hour, minute, message, days }) {
  if (!Capacitor.isNativePlatform()) return alert(`系统闹钟：${hour}:${minute} ${message}`);
  try { await NativeTools.setSystemAlarm({ hour: Number(hour), minute: Number(minute), message: message || '学财助手闹钟', days: days || [], skipUi: false }); }
  catch (e) { alert('写入系统闹钟失败：' + e.message); }
}
async function syncToDeviceCalendar({ title, location, description, startTimeMs, endTimeMs, rrule }) {
  if (!Capacitor.isNativePlatform()) return alert(`系统日历：${title}`);
  try { await NativeTools.addCalendarEvent({ title: title || '学习日程', location: location || '', description: description || '', startTimeMs, endTimeMs: endTimeMs || (startTimeMs + 3600000), rrule: rrule || '' }); }
  catch (e) { alert('写入系统日历失败：' + e.message); }
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
async function cancelReminder(id) { if (id && Capacitor.isNativePlatform()) { try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch {} } }

document.getElementById('testAlarmBtn').addEventListener('click', () => {
  const box = document.createElement('div');
  box.innerHTML = `
    <p class="sub-text" style="margin-bottom:10px;">【系统闹钟】和【系统日历】写入手机底层，关掉 App 依然准时响！</p>
    <button class="btn" id="t5s" style="width:100%; margin-bottom:8px;">🔔 App 5秒后连续响铃</button>
    <button class="btn btn-warn" id="tSys" style="width:100%; margin-bottom:8px;">📱 写入【系统时钟闹钟】(1分钟后)</button>
    <button class="btn btn-green" id="tCal" style="width:100%;">📅 写入【系统日历日程】(10分钟后)</button>
  `;
  box.querySelector('#t5s').onclick = async () => {
    modal.classList.remove('open');
    await scheduleAppReminder({ id: makeSafeNotifId(), title: '响铃闹钟测试', body: '15秒连续闹铃正常！', atDate: new Date(Date.now() + 5000), mode: 'alarm' });
    setTimeout(() => { if (document.visibilityState === 'visible') startRingingOverlay('响铃闹钟测试', '铃声正常响起！'); }, 5200);
    showToast('⏰ 5 秒后开始响铃！');
  };
  box.querySelector('#tSys').onclick = async () => { modal.classList.remove('open'); const d = new Date(Date.now() + 65000); await syncToDeviceAlarm({ hour: d.getHours(), minute: d.getMinutes(), message: '学财助手系统闹钟测试' }); };
  box.querySelector('#tCal').onclick = async () => { modal.classList.remove('open'); const s = Date.now() + 600000; await syncToDeviceCalendar({ title: '学财助手日程提醒测试', location: '自习室', description: '关App依然有效', startTimeMs: s, endTimeMs: s + 1800000 }); };
  openModal('⏰ 多样提醒与设备同步测试', box);
});

// ==================== 4. 通用弹窗 & OCR智能解析 ====================
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

const PERIOD_MAP = { 1:['08:00','08:45'], 2:['08:55','09:40'], 3:['10:00','10:45'], 4:['10:55','11:40'], 5:['14:00','14:45'], 6:['14:55','15:40'], 7:['16:00','16:45'], 8:['16:55','17:40'], 9:['19:00','19:45'], 10:['19:55','20:40'] };

function parseSmartText(rawText) {
  const lines = (rawText || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const parsedCourses = [], parsedEvents = [];
  const dayRegex = /(?:星期|周)([一二三四五六日天1-7])/, dayMap = { '一':1,'1':1,'二':2,'2':2,'三':3,'3':3,'四':4,'4':4,'五':5,'5':5,'六':6,'6':6,'日':0,'天':0,'7':0 };
  const timeRangeRegex = /(\d{1,2})[:：](\d{2})\s*[-~至到]\s*(\d{1,2})[:：](\d{2})/, singleTimeRegex = /(\d{1,2})[:：](\d{2})/;
  const periodRegex = /第?\s*(\d{1,2})\s*[-~至到]?\s*(\d{1,2})?\s*节/, dateRegex = /(?:(\d{4})[-/.年])?\s*(\d{1,2})[-/.月](\d{1,2})日?/, roomRegex = /([教实图综A-Za-z楼栋室]*\s*[A-Za-z]?-?\d{3,4}[室]?)/;
  const yearNow = new Date().getFullYear();

  lines.forEach(line => {
    const dm = line.match(dateRegex);
    if (dm && !line.includes('周')) {
      const y = dm[1] ? Number(dm[1]) : yearNow, mo = String(Number(dm[2])).padStart(2, '0'), da = String(Number(dm[3])).padStart(2, '0');
      const tm = line.match(singleTimeRegex), hh = tm ? String(Number(tm[1])).padStart(2, '0') : '09', mm = tm ? tm[2] : '00', rm = line.match(roomRegex);
      const title = line.replace(dateRegex, '').replace(timeRangeRegex, '').replace(singleTimeRegex, '').replace(/[,，|]/g, ' ').trim() || '识别日程';
      parsedEvents.push({ type: /考|测验|答辩/.test(line) ? '考试' : (/闹钟|起床/.test(line) ? '闹钟' : '日程'), name: title.slice(0, 28), datetime: `${y}-${mo}-${da}T${hh}:${mm}`, room: rm ? rm[1] : '', note: '智能识别导入' });
      return;
    }
    const dw = line.match(dayRegex), tr = line.match(timeRangeRegex), pr = line.match(periodRegex);
    if (dw || tr || pr) {
      const day = dw ? (dayMap[dw[1]] ?? 1) : 1; let start = '08:00', end = '09:40';
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
    if (!text && Capacitor.isNativePlatform() && fileRecord.localPath) text = (await NativeTools.extractText({ localPath: fileRecord.localPath })).text || '';
    showSmartImportReviewModal(text);
  } catch (e) { openModal('识别提示', `<p class="sub-text" style="color:#dc2626;">识别失败：${e.message}</p>`); }
}

function showSmartImportReviewModal(rawText) {
  const { parsedCourses, parsedEvents } = parseSmartText(rawText);
  const box = document.createElement('div');
  box.innerHTML = `<div style="font-size:12px; font-weight:600; margin-bottom:4px;">📄 提取到的原文（可微调）：</div><textarea id="ocrRawEdit" style="min-height:95px; font-size:12px;">${(rawText || '').replace(/</g, '&lt;')}</textarea><button class="btn btn-sm btn-outline" id="reparseBtn" style="margin:6px 0 10px;">🔄 重新解析</button><div id="parsedPreviewArea"></div>`;
  const renderPreview = (cList, eList) => {
    const area = box.querySelector('#parsedPreviewArea');
    if (!cList.length && !eList.length) { area.innerHTML = `<div class="sub-text" style="color:#b45309; padding:8px; background:#fef3c7; border-radius:8px;">示例：<br/><code>高等数学 周一 08:00-09:40 教A201</code><br/><code>英语考试 2026-12-20 09:00 教B305</code></div>`; return; }
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
      modal.classList.remove('open'); showToast(`✅ 导入完成：${cc} 节课、${ec} 条日程`);
    };
  };
  renderPreview(parsedCourses, parsedEvents);
  box.querySelector('#reparseBtn').onclick = () => { const r = parseSmartText(box.querySelector('#ocrRawEdit').value); renderPreview(r.parsedCourses, r.parsedEvents); };
  openModal('🧠 智能识别结果确认', box);
}

async function pickAndSmartRecognize() {
  try {
    if (Capacitor.isNativePlatform()) { const res = await NativeTools.pickFiles({ accept: '*/*', multiple: false }); if (res.files?.[0]) await runSmartRecognizeFromLocalFile(res.files[0]); }
    else { const t = prompt('粘贴文字测试解析：', '高等数学 周一 08:00-09:40 A201'); if (t) showSmartImportReviewModal(t); }
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
      </div>
    `;
    div.querySelector('.sys-alarm-btn').onclick = () => syncToDeviceAlarm({ hour: t.hour, minute: t.minute, message: `上课：${c.name} (${c.room || ''})`, days: [t.capWeekday] });
    div.querySelector('.sys-cal-btn').onclick = () => {
      const sD = getNextWeekdayDate(Number(c.day), c.start), eD = getNextWeekdayDate(Number(c.day), c.end);
      syncToDeviceCalendar({ title: `上课：${c.name}`, location: c.room || '', description: `每周${DAYS_LABEL[c.day]}`, startTimeMs: sD.getTime(), endTimeMs: Math.max(eD.getTime(), sD.getTime() + 3600000), rrule: `FREQ=WEEKLY;BYDAY=${RRULE_DAYS[Number(c.day)]}` });
    };
    div.querySelector('.del-btn').onclick = async () => { await cancelReminder(c.notifId); courses = courses.filter(x => x.id !== c.id); saveCourses(); };
    list.appendChild(div);
  });
}

async function addCourseItem(item) {
  const t = calcCourseAlarmTime(item), notifId = makeSafeNotifId();
  await scheduleAppReminder({ id: notifId, title: `即将上课：${item.name}`, body: `${item.start}-${item.end} ${item.room || ''}`, weeklyWeekday: t.capWeekday, hour: t.hour, minute: t.minute, mode: item.mode || 'alarm' });
  courses.push({ ...item, id: Date.now() + Math.random(), notifId }); saveCourses(); return t;
}

document.getElementById('addCourseBtn').addEventListener('click', async () => {
  const name = document.getElementById('cName').value.trim();
  if (!name) return alert('请输入课程名称');
  const item = { name, day: Number(document.getElementById('cDay').value), room: document.getElementById('cRoom').value.trim(), start: document.getElementById('cStart').value, end: document.getElementById('cEnd').value, advance: Number(document.getElementById('cAdvance').value), mode: document.getElementById('cMode').value };
  const t = await addCourseItem(item);
  document.getElementById('cName').value = ''; document.getElementById('cRoom').value = '';
  if (item.mode === 'sys_alarm') await syncToDeviceAlarm({ hour: t.hour, minute: t.minute, message: `上课：${item.name}`, days: [t.capWeekday] });
  else if (item.mode === 'sys_cal') {
    const sD = getNextWeekdayDate(item.day, item.start), eD = getNextWeekdayDate(item.day, item.end);
    await syncToDeviceCalendar({ title: `上课：${item.name}`, location: item.room, description: `每周${DAYS_LABEL[item.day]}`, startTimeMs: sD.getTime(), endTimeMs: Math.max(eD.getTime(), sD.getTime() + 3600000), rrule: `FREQ=WEEKLY;BYDAY=${RRULE_DAYS[item.day]}` });
  } else showToast('✅ 课程与提醒已保存');
});
document.getElementById('openBatchCourseBtn').addEventListener('click', () => showSmartImportReviewModal('高等数学 周一 08:00-09:40 教A101\n大学英语 周三 10:00-11:40 教B205'));

async function addExamOrScheduleItem(item) {
  const targetMs = new Date(item.datetime).getTime() - Number(item.advance || 0) * 60000, notifId = makeSafeNotifId();
  if (targetMs > Date.now()) await scheduleAppReminder({ id: notifId, title: `${item.type || '日程'}：${item.name}`, body: `${item.datetime.replace('T', ' ')} ${item.room || ''}`, atDate: new Date(targetMs), mode: item.mode || 'alarm' });
  exams.push({ ...item, type: item.type || '考试', id: Date.now() + Math.random(), notifId }); saveExams(); return targetMs;
}

function renderExams() {
  const list = document.getElementById('examList'), sorted = [...exams].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  if (!sorted.length) { list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">暂无日程 🎯</div>'; return; }
  list.innerHTML = ''; const now = Date.now();
  sorted.forEach(ex => {
    const diffMs = new Date(ex.datetime).getTime() - now; let cd = '已过时', uc = '';
    if (diffMs > 0) {
      const d = Math.floor(diffMs / 86400000), h = Math.floor((diffMs % 86400000) / 3600000), m = Math.floor((diffMs % 3600000) / 60000);
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
  else showToast('✅ 日程与提醒已保存');
});

// ==================== 6. 图文资料库 ====================
let localFiles = JSON.parse(localStorage.getItem('files_meta_v3') || '[]');
function saveFilesMeta() { localStorage.setItem('files_meta_v3', JSON.stringify(localFiles)); renderFiles(); }

function renderFiles() {
  const filter = document.getElementById('fileFilter').value, items = localFiles.filter(f => filter === 'all' || f.category === filter), list = document.getElementById('fileList');
  if (!items.length) { list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">暂无资料 📂</div>'; return; }
  list.innerHTML = '';
  items.forEach(f => {
    const srcUrl = f.localPath ? Capacitor.convertFileSrc(f.localPath) : (f.dataUrl || '');
    const div = document.createElement('div');
    div.className = 'item-row';
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
      </div>
    `;
    div.querySelector('.open-trigger').onclick = () => {
      if (f.category === 'image') { openModal(f.name, `<img src="${srcUrl}" style="width:100%; border-radius:8px; margin-bottom:10px;" /><button class="btn btn-green" style="width:100%;" id="mOcr">🧠 OCR 识别图中课表/日程</button>`); document.getElementById('mOcr').onclick = () => runSmartRecognizeFromLocalFile(f); }
      else if (f.textContent !== undefined) openModal(f.name, `<pre style="white-space:pre-wrap; font-size:13px;">${f.textContent.replace(/</g, '&lt;')}</pre>`);
      else { openModal(f.name, `<p class="sub-text">格式：${f.format} ｜ ${(f.size / 1024).toFixed(1)} KB</p><button class="btn btn-green" style="width:100%;" id="mDocOcr">🧠 提取文字并解析</button>`); document.getElementById('mDocOcr').onclick = () => runSmartRecognizeFromLocalFile(f); }
    };
    div.querySelector('.ocr-btn').onclick = () => runSmartRecognizeFromLocalFile(f);
    div.querySelector('.del-btn').onclick = async () => { if (Capacitor.isNativePlatform() && f.localPath) { try { await NativeTools.deleteLocalFile({ localPath: f.localPath }); } catch {} } localFiles = localFiles.filter(x => x.id !== f.id); saveFilesMeta(); };
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

// ==================== 7. 零占用直读音乐 + 常驻搜歌/听歌历史 + 硬件EQ ====================
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

const audioPlayer = document.getElementById('audioPlayer'), musicSeek = document.getElementById('musicSeek'), curTimeEl = document.getElementById('curTime'), durTimeEl =
