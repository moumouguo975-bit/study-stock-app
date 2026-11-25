import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const NativeTools = registerPlugin('NativeTools');
const DEFAULT_GITHUB_REPO = 'moumouguo975-bit/study-stock-app';
const DAYS_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// ==================== 通用工具（轻提示 & 网络） ====================
let toastTimer = null;

function showToast(msg, duration = 2000) {
  const el = document.getElementById('toastTip');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, duration);
}

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
  const headers = {
    'User-Agent': 'Mozilla/5.0',
    ...extraHeaders
  };
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url, headers });
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  }
  const res = await fetch(url);
  return await res.text();
}

// ==================== 0. 个性化外观与手势设置 ====================
const FONT_MAP = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  serif: '"Noto Serif SC", "Songti SC", Georgia, serif',
  mono: '"JetBrains Mono", Consolas, "Courier New", monospace',
  rounded: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", ui-rounded, sans-serif'
};

let appPrefs = JSON.parse(localStorage.getItem('app_prefs_v2') || 'null') || {
  color: '#4f46e5',
  darkMode: 'system',
  glass: true,
  slideDwell: true,
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

  const isDark =
    appPrefs.darkMode === 'dark' ||
    (appPrefs.darkMode === 'system' && darkMediaQuery.matches);

  document.body.classList.toggle('dark-mode', isDark);
  document.body.classList.toggle('glass-mode', !!appPrefs.glass);

  document.getElementById('customColorPicker').value = appPrefs.color || '#4f46e5';
  document.getElementById('darkModeSelect').value = appPrefs.darkMode || 'system';
  document.getElementById('glassModeToggle').checked = !!appPrefs.glass;
  document.getElementById('slideDwellToggle').checked = appPrefs.slideDwell !== false;
  document.getElementById('fontFamilySelect').value = appPrefs.fontFamily || 'system';
  document.getElementById('fontSizeSelect').value = appPrefs.fontSize || '14px';

  document.querySelectorAll('#colorSwatches .swatch').forEach(s => {
    const matched = s.dataset.color.toLowerCase() === (appPrefs.color || '').toLowerCase();
    s.classList.toggle('active', matched);
  });
}

function savePrefs() {
  localStorage.setItem('app_prefs_v2', JSON.stringify(appPrefs));
  applyAppearance();
}

darkMediaQuery.addEventListener?.('change', applyAppearance);

const settingsModal = document.getElementById('settingsModal');

document.getElementById('openSettingsBtn').addEventListener('click', () => {
  applyAppearance();
  settingsModal.classList.add('open');
});

document.getElementById('closeSettingsBtn').addEventListener('click', () => {
  settingsModal.classList.remove('open');
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('open');
  }
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

document.getElementById('slideDwellToggle').addEventListener('change', (e) => {
  appPrefs.slideDwell = e.target.checked;
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

// ==================== 1. 底部毛玻璃滑切 + 全页面0.85秒停顿自动打开手势引擎 ====================
const bottomNav = document.getElementById('bottomNav');
const navIndicator = document.getElementById('navGlassIndicator');
const navBtns = Array.from(bottomNav.querySelectorAll('button'));
let currentTabIdx = 0;

function updateNavIndicatorPosition(idx) {
  const slotW = bottomNav.clientWidth / navBtns.length;
  navIndicator.style.transform = `translateX(${idx * slotW}px)`;
}

function switchTabByIndex(idx, withHaptic = false) {
  if (idx < 0 || idx >= navBtns.length) return;
  const changed = idx !== currentTabIdx;
  currentTabIdx = idx;
  const targetBtn = navBtns[idx];

  navBtns.forEach(b => b.classList.remove('active'));
  targetBtn.classList.add('active');
  document.getElementById('headerTitle').textContent = targetBtn.dataset.title;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${targetBtn.dataset.tab}`).classList.add('active');

  updateNavIndicatorPosition(idx);
  if (changed && withHaptic && navigator.vibrate) {
    navigator.vibrate(10);
  }
}

window.addEventListener('resize', () => {
  updateNavIndicatorPosition(currentTabIdx);
});

function handleNavSlideAt(clientX) {
  const rect = bottomNav.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(0.9999, (clientX - rect.left) / rect.width));
  const idx = Math.floor(ratio * navBtns.length);
  switchTabByIndex(idx, true);
}

navBtns.forEach((btn, idx) => {
  btn.addEventListener('click', () => switchTabByIndex(idx, false));
});

bottomNav.addEventListener('touchstart', (e) => {
  if (e.touches[0]) {
    handleNavSlideAt(e.touches[0].clientX);
  }
}, { passive: true });

bottomNav.addEventListener('touchmove', (e) => {
  if (e.touches[0]) {
    e.preventDefault();
    handleNavSlideAt(e.touches[0].clientX);
  }
}, { passive: false });

// 全页面其余按钮：滑动毛玻璃光晕 + 停顿 0.85 秒自动打开
const slideLens = document.getElementById('slideGlassLens');
const slideBar = document.getElementById('slideGlassBar');
const INTERACTIVE_SEL = [
  'button:not(#bottomNav button)',
  '.day-pill',
  '.city-pill',
  '.eq-pill',
  '.ambient-btn',
  '.idx-box',
  '.hour-chip',
  '.day-chip',
  '.phrase-chip',
  '.swatch',
  '.play-track',
  '.st-head',
  '.open-trigger',
  '.tap-word'
].join(', ');

let dwellTarget = null;
let dwellTimer = null;
let dwellFired = false;
let suppressClickUntil = 0;
let lastTouchX = 0;
let lastTouchY = 0;

function positionSlideLens(el) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  const pad = 3;
  slideLens.style.left = `${r.left - pad}px`;
  slideLens.style.top = `${r.top - pad}px`;
  slideLens.style.width = `${r.width + pad * 2}px`;
  slideLens.style.height = `${r.height + pad * 2}px`;
  slideLens.classList.add('visible');
}

function cancelSlideDwell() {
  if (dwellTimer) {
    clearTimeout(dwellTimer);
    dwellTimer = null;
  }
  slideLens.classList.remove('visible');
  slideBar.style.transition = 'none';
  slideBar.style.width = '0%';
}

function resetAndStartDwell(el) {
  if (dwellTimer) {
    clearTimeout(dwellTimer);
  }
  slideBar.style.transition = 'none';
  slideBar.style.width = '0%';
  void slideBar.offsetWidth;
  slideBar.style.transition = 'width 850ms linear';
  slideBar.style.width = '100%';

  dwellTimer = setTimeout(() => {
    dwellTimer = null;
    if (dwellTarget !== el) return;
    dwellFired = true;
    suppressClickUntil = Date.now() + 450;
    if (navigator.vibrate) {
      navigator.vibrate(22);
    }
    cancelSlideDwell();
    if (el.classList.contains('tap-word')) {
      jumpTranslateWord(el);
    } else {
      el.click();
    }
  }, 850);
}

document.addEventListener('touchstart', (e) => {
  if (appPrefs.slideDwell === false) return;
  if (e.target.closest('#bottomNav') || e.target.closest('input, textarea, select')) return;
  const t = e.touches[0];
  if (!t) return;
  dwellFired = false;
  lastTouchX = t.clientX;
  lastTouchY = t.clientY;
  const el = e.target.closest(INTERACTIVE_SEL);
  if (el) {
    dwellTarget = el;
    positionSlideLens(el);
    resetAndStartDwell(el);
  }
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (appPrefs.slideDwell === false || dwellFired) return;
  if (e.target.closest('#bottomNav') || e.target.closest('input[type="range"]')) return;
  const t = e.touches[0];
  if (!t) return;

  const dist = Math.hypot(t.clientX - lastTouchX, t.clientY - lastTouchY);
  lastTouchX = t.clientX;
  lastTouchY = t.clientY;

  const hit = document.elementFromPoint(t.clientX, t.clientY);
  const el = hit ? hit.closest(INTERACTIVE_SEL) : null;

  if (!el) {
    cancelSlideDwell();
    dwellTarget = null;
    return;
  }

  if (el !== dwellTarget) {
    dwellTarget = el;
    positionSlideLens(el);
    resetAndStartDwell(el);
  } else {
    positionSlideLens(el);
    if (dist > 6) {
      resetAndStartDwell(el);
    }
  }
}, { passive: true });

document.addEventListener('touchend', () => {
  cancelSlideDwell();
  dwellTarget = null;
}, { passive: true });

document.addEventListener('touchcancel', () => {
  cancelSlideDwell();
  dwellTarget = null;
}, { passive: true });

document.addEventListener('click', (e) => {
  if (Date.now() < suppressClickUntil) {
    e.stopPropagation();
    e.preventDefault();
  }
}, true);

// ==================== 2. 双时区参考（设备当前 + 网络IP）+ 24h/7天互动天气 ====================
const DEVICE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
let savedCities = JSON.parse(localStorage.getItem('weather_cities_v3') || '[]');
let dismissedAutoIds = JSON.parse(localStorage.getItem('dismissed_auto_cities_v1') || '[]');
let activeCityId = localStorage.getItem('active_city_id_v3') || '';
let deviceRefInfo = null;
let networkRefInfo = null;

const WMO_MAP = {
  0: ['☀️', '晴朗'],
  1: ['🌤️', '晴间多云'],
  2: ['⛅', '多云'],
  3: ['☁️', '阴天'],
  45: ['🌫️', '有雾'],
  48: ['🌫️', '冻雾'],
  51: ['🌦️', '小毛雨'],
  53: ['🌦️', '毛毛雨'],
  55: ['🌧️', '浓毛雨'],
  61: ['🌧️', '小雨'],
  63: ['🌧️', '中雨'],
  65: ['🌧️', '大雨'],
  71: ['❄️', '小雪'],
  73: ['❄️', '中雪'],
  75: ['❄️', '大雪'],
  80: ['🌦️', '阵雨'],
  81: ['🌧️', '中阵雨'],
  82: ['⛈️', '强阵雨'],
  95: ['⛈️', '雷阵雨'],
  96: ['⛈️', '雷暴'],
  99: ['⛈️', '强雷暴']
};

function wmoDesc(code) {
  return WMO_MAP[code] || ['🌤️', '多云'];
}

function saveCitiesState() {
  localStorage.setItem('weather_cities_v3', JSON.stringify(savedCities));
  localStorage.setItem('dismissed_auto_cities_v1', JSON.stringify(dismissedAutoIds));
  localStorage.setItem('active_city_id_v3', activeCityId);
}

function getActiveCity() {
  return savedCities.find(c => c.id === activeCityId) || savedCities[0];
}

function formatClockInTz(now, tz) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(now);
  } catch {
    return now.toTimeString().slice(0, 8);
  }
}

function updateLiveClock() {
  const now = new Date();
  const city = getActiveCity();
  const tz = city?.timezone || DEVICE_TZ;

  try {
    document.getElementById('liveClock').textContent = formatClockInTz(now, tz);
    document.getElementById('liveDate').textContent = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    }).format(now);

    let kindTag = '🌍 自选地区';
    if (city?.kind === 'device') kindTag = '📱 设备时区';
    else if (city?.kind === 'network') kindTag = '🌐 网络时区';
    else if (city?.kind === 'synced') kindTag = '📍 设备与网络同区';

    document.getElementById('liveTzLabel').textContent = `${kindTag} · ${tz}`;
  } catch {
    document.getElementById('liveClock').textContent = now.toTimeString().slice(0, 8);
  }

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

function renderCityTabs() {
  const bar = document.getElementById('cityTabs');
  bar.innerHTML = '';

  savedCities.forEach(c => {
    const pill = document.createElement('button');
    pill.className = 'city-pill' + (c.id === activeCityId ? ' active' : '');

    let icon = '🌍';
    if (c.kind === 'device') icon = '📱';
    else if (c.kind === 'network') icon = '🌐';
    else if (c.kind === 'synced') icon = '📍';

    pill.textContent = c.id === activeCityId ? `${icon} ${c.name} ×` : `${icon} ${c.name}`;
    pill.onclick = () => {
      if (c.id === activeCityId) {
        if (savedCities.length <= 1) {
          showToast('⚠️ 最少需保留 1 个地区，可先添加新地区后再删除');
          return;
        }
        if (confirm(`确定删除地区【${c.name}】吗？`)) {
          if (c.id === 'auto_device' || c.id === 'auto_network') {
            if (!dismissedAutoIds.includes(c.id)) {
              dismissedAutoIds.push(c.id);
            }
          }
          savedCities = savedCities.filter(x => x.id !== c.id);
          activeCityId = savedCities[0].id;
          saveCitiesState();
          renderCityTabs();
          updateLiveClock();
          loadActiveCityWeather();
        }
        return;
      }

      activeCityId = c.id;
      saveCitiesState();
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
  const val = prompt('输入要添加的城市或地区名（如 上海、香港、东京、纽约、伦敦）：');
  if (!val || !val.trim()) return;
  try {
    const geo = await httpGetJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(val.trim())}&count=1&language=zh&format=json`
    );
    const loc = geo?.results?.[0];
    if (!loc) {
      alert('未找到该地区，请换个名称试试');
      return;
    }
    const newCity = {
      id: 'custom_' + Date.now(),
      kind: 'custom',
      name: loc.name,
      lat: loc.latitude,
      lon: loc.longitude,
      timezone: loc.timezone || DEVICE_TZ
    };
    savedCities.push(newCity);
    activeCityId = newCity.id;
    saveCitiesState();
    renderCityTabs();
    updateLiveClock();
    loadActiveCityWeather();
  } catch (e) {
    alert('添加地区失败：' + e.message);
  }
}

async function detectDeviceAndNetworkZones(resetDismissed = false) {
  if (resetDismissed) {
    dismissedAutoIds = [];
  }

  let netLoc = null;
  try {
    const ip = await httpGetJson('https://get.geojs.io/v1/ip/geo.json');
    if (ip?.latitude && ip?.longitude) {
      netLoc = {
        name: ip.city || ip.region || '网络地区',
        lat: Number(ip.latitude),
        lon: Number(ip.longitude),
        timezone: ip.timezone || DEVICE_TZ
      };
    }
  } catch {}

  if (!netLoc) {
    try {
      const ip2 = await httpGetJson('https://ipwho.is/');
      if (ip2?.success) {
        netLoc = {
          name: ip2.city || ip2.region || '网络地区',
          lat: Number(ip2.latitude),
          lon: Number(ip2.longitude),
          timezone: ip2.timezone?.id || DEVICE_TZ
        };
      }
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
          const rev = await httpGetJson(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${gps.lat}&longitude=${gps.lon}&localityLanguage=zh`
          );
          const found = rev?.city || rev?.locality || rev?.principalSubdivision;
          if (found) {
            cname = found.replace(/市$/, '');
          }
        } catch {}
        devLoc = {
          name: cname,
          lat: gps.lat,
          lon: gps.lon,
          timezone: DEVICE_TZ
        };
      }
    } catch {}
  }

  if (!devLoc) {
    if (netLoc && netLoc.timezone === DEVICE_TZ) {
      devLoc = { ...netLoc };
    } else {
      const tzCity = DEVICE_TZ.split('/').pop().replace(/_/g, ' ');
      try {
        const g = await httpGetJson(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(tzCity)}&count=1&language=zh&format=json`
        );
        const loc = g?.results?.[0];
        if (loc) {
          devLoc = {
            name: loc.name,
            lat: loc.latitude,
            lon: loc.longitude,
            timezone: DEVICE_TZ
          };
        }
      } catch {}
    }
  }

  if (!devLoc) {
    devLoc = {
      name: '北京',
      lat: 39.9042,
      lon: 116.4074,
      timezone: DEVICE_TZ
    };
  }
  deviceRefInfo = devLoc;

  const isMismatch = !!(networkRefInfo && networkRefInfo.timezone !== deviceRefInfo.timezone);

  const upsertAutoCity = (id, data) => {
    if (dismissedAutoIds.includes(id)) return;
    const idx = savedCities.findIndex(c => c.id === id);
    if (idx >= 0) {
      savedCities[idx] = { ...savedCities[idx], ...data, id };
    } else {
      savedCities.unshift({ id, ...data });
    }
  };

  if (isMismatch) {
    upsertAutoCity('auto_network', { kind: 'network', ...networkRefInfo });
    upsertAutoCity('auto_device', { kind: 'device', ...deviceRefInfo });
  } else {
    savedCities = savedCities.filter(c => c.id !== 'auto_network');
    upsertAutoCity('auto_device', { kind: 'synced', ...deviceRefInfo });
  }

  if (!savedCities.length) {
    savedCities.push({ id: 'auto_device', kind: 'device', ...deviceRefInfo });
  }
  if (!savedCities.some(c => c.id === activeCityId)) {
    activeCityId = savedCities[0].id;
  }

  saveCitiesState();
  renderCityTabs();
  updateLiveClock();
  await loadActiveCityWeather();
}

function buildSmartAdvice(overrideLabel, temp, precip, code) {
  const city = getActiveCity();
  if (!city) return;
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

  if ((city.kind === 'device' || city.kind === 'synced') && !overrideLabel) {
    const now = new Date();
    const hr = now.getHours();
    const todayCourses = courses
      .filter(c => Number(c.day) === now.getDay())
      .sort((a, b) => a.start.localeCompare(b.start));

    if (todayCourses.length) {
      const hm = `${String(hr).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const nextC = todayCourses.find(c => c.start >= hm);
      if (nextC) {
        tips.push(`📚 今日共 ${todayCourses.length} 节课，下一节《${nextC.name}》(${nextC.start} ${nextC.room || ''})。`);
      } else {
        tips.push(`✅ 今日 ${todayCourses.length} 节课已全部上完，可以放松听歌或复盘笔记！`);
      }
    }

    const upcoming = exams
      .filter(e => new Date(e.datetime).getTime() > Date.now())
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))[0];
    if (upcoming) {
      const days = Math.ceil((new Date(upcoming.datetime).getTime() - Date.now()) / 86400000);
      if (days <= 7) {
        tips.push(`🎯 距离【${upcoming.name}】仅剩 ${days} 天，记得安排考前冲刺！`);
      }
    }
  } else if (city.kind === 'network') {
    tips.push(`🌐 当前显示网络节点【${city.name}】的实时天气与时区（开启 VPN 时会与设备位置不同）。`);
  } else if (!overrideLabel) {
    tips.push(`✈️ 当前查看自选地区【${city.name}】的当地实时时间与天气。`);
  }

  document.getElementById('smartAdviceBox').innerHTML =
    `<strong>💡 ${city.name} · 智能建议</strong><br/>${tips.slice(0, 3).join('<br/>')}`;
}

async function loadActiveCityWeather() {
  const city = getActiveCity();
  if (!city) return;
  document.getElementById('weatherDesc').textContent = `同步 ${city.name} 天气...`;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&hourly=temperature_2m,weather_code,precipitation_probability` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&forecast_days=8`;

    const w = await httpGetJson(url);
    if (w.timezone && city.kind === 'custom') {
      city.timezone = w.timezone;
      saveCitiesState();
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
  } catch {
    document.getElementById('weatherDesc').textContent = `${city.name} 天气获取失败`;
  }
}

document.getElementById('refreshWeatherBtn').addEventListener('click', async () => {
  showToast('🔄 正在刷新设备与网络双时区及天气...');
  await detectDeviceAndNetworkZones(true);
  showToast('✅ 双时区与天气已更新');
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
    if (ringAudioCtx.state === 'suspended') {
      ringAudioCtx.resume();
    }
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
      if (navigator.vibrate) {
        navigator.vibrate([300, 150, 300, 150]);
      }
    };
    beep();
    ringInterval = setInterval(beep, 1200);
  } catch {}
}

function stopRingingSoundOnly() {
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
  if (ringAudioCtx) {
    try { ringAudioCtx.close(); } catch {}
    ringAudioCtx = null;
  }
  if (navigator.vibrate) {
    navigator.vibrate(0);
  }
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
    await LocalNotifications.createChannel({
      id: 'alarm_ring_v3',
      name: '课表与日程响铃闹钟',
      description: '15秒连续响铃与震动',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: 'alarm_ring.wav'
    });
    await LocalNotifications.createChannel({
      id: 'vibrate_channel_v3',
      name: '震动横幅提醒',
      description: '震动提醒',
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
      if (n.channelId === 'alarm_ring_v3') {
        startRingingOverlay(n.title, n.body);
      }
    });
    LocalNotifications.addListener('localNotificationActionPerformed', (act) => {
      if (act.notification?.channelId === 'alarm_ring_v3') {
        startRingingOverlay(act.notification.title, act.notification.body);
      }
    });
  } catch {}
}

async function syncToDeviceAlarm({ hour, minute, message, days }) {
  if (!Capacitor.isNativePlatform()) {
    alert(`系统闹钟：${hour}:${minute} ${message}`);
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
    alert(`系统日历：${title}`);
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
  const channelId = isAlarm
    ? 'alarm_ring_v3'
    : (mode === 'vibrate' ? 'vibrate_channel_v3' : 'normal_channel_v3');

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
      setTimeout(() => {
        if (isAlarm) startRingingOverlay(title, body);
        else alert(title + '\n' + body);
      }, delay);
    }
  }
}

async function cancelReminder(id) {
  if (!id || !Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {}
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
    await scheduleAppReminder({
      id: makeSafeNotifId(),
      title: '响铃闹钟测试',
      body: '15秒连续闹铃正常工作！',
      atDate: new Date(Date.now() + 5000),
      mode: 'alarm'
    });
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        startRingingOverlay('响铃闹钟测试', '铃声正常响起！');
      }
    }, 5200);
    showToast('⏰ 5 秒后开始响铃！');
  };
  box.querySelector('#tSys').onclick = async () => {
    modal.classList.remove('open');
    const d = new Date(Date.now() + 65000);
    await syncToDeviceAlarm({
      hour: d.getHours(),
      minute: d.getMinutes(),
      message: '学财助手系统闹钟测试'
    });
  };
  box.querySelector('#tCal').onclick = async () => {
    modal.classList.remove('open');
    const s = Date.now() + 600000;
    await syncToDeviceCalendar({
      title: '学财助手日程提醒测试',
      location: '自习室',
      description: '关App依然有效',
      startTimeMs: s,
      endTimeMs: s + 1800000
    });
  };
  openModal('⏰ 多样提醒与设备同步测试', box);
});

// ==================== 4. 通用弹窗 & OCR智能解析 ====================
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalContent = document.getElementById('modalContent');

function openModal(title, htmlOrNode) {
  modalTitle.textContent = title;
  modalContent.innerHTML = '';
  if (typeof htmlOrNode === 'string') {
    modalContent.innerHTML = htmlOrNode;
  } else {
    modalContent.appendChild(htmlOrNode);
  }
  modal.classList.add('open');
}

document.getElementById('closeModalBtn').addEventListener('click', () => {
  modal.classList.remove('open');
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.remove('open');
  }
});

const PERIOD_MAP = {
  1: ['08:00', '08:45'],
  2: ['08:55', '09:40'],
  3: ['10:00', '10:45'],
  4: ['10:55', '11:40'],
  5: ['14:00', '14:45'],
  6: ['14:55', '15:40'],
  7: ['16:00', '16:45'],
  8: ['16:55', '17:40'],
  9: ['19:00', '19:45'],
  10: ['19:55', '20:40']
};

function parseSmartText(rawText) {
  const lines = (rawText || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const parsedCourses = [];
  const parsedEvents = [];
  const dayRegex = /(?:星期|周)([一二三四五六日天1-7])/;
  const dayMap = {
    '一': 1, '1': 1, '二': 2, '2': 2, '三': 3, '3': 3,
    '四': 4, '4': 4, '五': 5, '5': 5, '六': 6, '6': 6,
    '日': 0, '天': 0, '7': 0
  };
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
      const title = line
        .replace(dateRegex, '')
        .replace(timeRangeRegex, '')
        .replace(singleTimeRegex, '')
        .replace(/[,，|]/g, ' ')
        .trim() || '识别日程';
      const type = /考|测验|答辩/.test(line)
        ? '考试'
        : (/闹钟|起床/.test(line) ? '闹钟' : '日程');
      parsedEvents.push({
        type,
        name: title.slice(0, 28),
        datetime: `${y}-${mo}-${da}T${hh}:${mm}`,
        room: rm ? rm[1] : '',
        note: '智能识别导入'
      });
      return;
    }

    const dw = line.match(dayRegex);
    const tr = line.match(timeRangeRegex);
    const pr = line.match(periodRegex);
    if (dw || tr || pr) {
      const day = dw ? (dayMap[dw[1]] ?? 1) : 1;
      let start = '08:00';
      let end = '09:40';
      if (tr) {
        start = `${String(Number(tr[1])).padStart(2, '0')}:${tr[2]}`;
        end = `${String(Number(tr[3])).padStart(2, '0')}:${tr[4]}`;
      } else if (pr) {
        const p1 = Number(pr[1]);
        const p2 = Number(pr[2] || pr[1]);
        start = PERIOD_MAP[p1]?.[0] || '08:00';
        end = PERIOD_MAP[p2]?.[1] || '09:40';
      }
      const rm = line.match(roomRegex);
      const cname = line
        .replace(dayRegex, '')
        .replace(timeRangeRegex, '')
        .replace(periodRegex, '')
        .replace(singleTimeRegex, '')
        .replace(roomRegex, '')
        .replace(/[,，|]/g, ' ')
        .trim();
      if (cname.length >= 1) {
        parsedCourses.push({
          name: cname.slice(0, 22),
          day,
          start,
          end,
          room: rm ? rm[1] : ''
        });
      }
    }
  });

  return { parsedCourses, parsedEvents };
}

async function runSmartRecognizeFromLocalFile(fileRecord) {
  openModal(
    '🧠 智能识别中...',
    '<div style="text-align:center; padding:24px;">正在离线提取文字并解析...</div>'
  );
  try {
    let text = fileRecord.textContent || '';
    if (!text && Capacitor.isNativePlatform() && fileRecord.localPath) {
      const res = await NativeTools.extractText({ localPath: fileRecord.localPath });
      text = res.text || '';
    }
    showSmartImportReviewModal(text);
  } catch (e) {
    openModal(
      '识别提示',
      `<p class="sub-text" style="color:#dc2626;">识别失败：${e.message}</p>`
    );
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
      area.innerHTML = `
        <div class="sub-text" style="color:#b45309; padding:8px; background:#fef3c7; border-radius:8px;">
          示例格式：<br/>
          <code>高等数学 周一 08:00-09:40 教A201</code><br/>
          <code>英语考试 2026-12-20 09:00 教B305</code>
        </div>
      `;
      return;
    }

    let html = '';
    if (cList.length) {
      html += `<div style="font-weight:600; font-size:13px; margin:6px 0;">📅 识别到 ${cList.length} 节课：</div>`;
      cList.forEach((c, i) => {
        html += `
          <label style="display:flex; gap:6px; align-items:center; padding:5px 0; font-size:12px; border-bottom:1px solid var(--border);">
            <input type="checkbox" class="chk-course" data-idx="${i}" checked style="width:auto;" />
            <span><strong>${c.name}</strong> · ${DAYS_LABEL[c.day]} ${c.start}-${c.end} ${c.room}</span>
          </label>
        `;
      });
    }
    if (eList.length) {
      html += `<div style="font-weight:600; font-size:13px; margin:10px 0 6px;">📝 识别到 ${eList.length} 条日程：</div>`;
      eList.forEach((ev, i) => {
        html += `
          <label style="display:flex; gap:6px; align-items:center; padding:5px 0; font-size:12px; border-bottom:1px solid var(--border);">
            <input type="checkbox" class="chk-event" data-idx="${i}" checked style="width:auto;" />
            <span><span class="badge">${ev.type}</span><strong>${ev.name}</strong> · ${ev.datetime.replace('T', ' ')}</span>
          </label>
        `;
      });
    }
    html += `<button class="btn" id="doSmartImportBtn" style="width:100%; margin-top:12px;">✅ 一键导入并设提醒</button>`;
    area.innerHTML = html;

    area.querySelector('#doSmartImportBtn').onclick = async () => {
      let cc = 0;
      let ec = 0;
      for (const chk of area.querySelectorAll('.chk-course:checked')) {
        await addCourseItem({ ...cList[Number(chk.dataset.idx)], advance: 15, mode: 'alarm' });
        cc++;
      }
      for (const chk of area.querySelectorAll('.chk-event:checked')) {
        await addExamOrScheduleItem({ ...eList[Number(chk.dataset.idx)], advance: 30, mode: 'alarm' });
        ec++;
      }
      modal.classList.remove('open');
      showToast(`✅ 导入完成：${cc} 节课、${ec} 条日程`);
    };
  };

  renderPreview(parsedCourses, parsedEvents);
  box.querySelector('#reparseBtn').onclick = () => {
    const r = parseSmartText(box.querySelector('#ocrRawEdit').value);
    renderPreview(r.parsedCourses, r.parsedEvents);
  };
  openModal('🧠 智能识别结果确认', box);
}

async function pickAndSmartRecognize() {
  try {
    if (Capacitor.isNativePlatform()) {
      const res = await NativeTools.pickFiles({ accept: '*/*', multiple: false });
      if (res.files?.[0]) {
        await runSmartRecognizeFromLocalFile(res.files[0]);
      }
    } else {
      const t = prompt('粘贴文字测试解析：', '高等数学 周一 08:00-09:40 A201');
      if (t) {
        showSmartImportReviewModal(t);
      }
    }
  } catch (e) {
    if (!String(e.message).includes('取消')) {
      alert('选择失败：' + e.message);
    }
  }
}

document.getElementById('smartImportCourseBtn').addEventListener('click', pickAndSmartRecognize);
document.getElementById('smartImportExamBtn').addEventListener('click', pickAndSmartRecognize);

// ==================== 5. 课表与考试日程 ====================
let courses = JSON.parse(localStorage.getItem('courses_v1') || '[]');
let selectedDay = new Date().getDay();
let exams = JSON.parse(localStorage.getItem('exams_v1') || '[]');

function calcCourseAlarmTime(item) {
  const [h, m] = (item.start || '08:00').split(':').map(Number);
  let totalMin = h * 60 + m - Number(item.advance || 15);
  let dayIndex = Number(item.day);
  if (totalMin < 0) {
    totalMin += 1440;
    dayIndex = (dayIndex + 6) % 7;
  }
  return {
    hour: Math.floor(totalMin / 60),
    minute: totalMin % 60,
    capWeekday: dayIndex + 1
  };
}

function getNextWeekdayDate(jsDay, timeStr) {
  const [h, m] = (timeStr || '08:00').split(':').map(Number);
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() + ((jsDay - now.getDay() + 7) % 7));
  d.setHours(h, m, 0, 0);
  if (d.getTime() < now.getTime()) {
    d.setDate(d.getDate() + 7);
  }
  return d;
}

function saveCourses() {
  localStorage.setItem('courses_v1', JSON.stringify(courses));
  renderCourses();
}

function saveExams() {
  localStorage.setItem('exams_v1', JSON.stringify(exams));
  renderExams();
}

function renderDayTabs() {
  const wrap = document.getElementById('dayTabs');
  wrap.innerHTML = '';
  [1, 2, 3, 4, 5, 6, 0].forEach(d => {
    const b = document.createElement('button');
    b.className = 'day-pill' + (d === selectedDay ? ' active' : '');
    b.textContent = DAYS_LABEL[d];
    b.onclick = () => {
      selectedDay = d;
      renderDayTabs();
      renderCourses();
    };
    wrap.appendChild(b);
  });
}

function renderCourses() {
  const list = document.getElementById('courseList');
  const filtered = courses
    .filter(c => Number(c.day) === Number(selectedDay))
    .sort((a, b) => a.start.localeCompare(b.start));

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
        <div><strong>${c.name}</strong> <span class="badge badge-alarm">提前${c.advance}分</span></div>
        <div class="sub-text">🕒 ${c.start}-${c.end} ｜ 📍 ${c.room || '未填教室'}</div>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <button class="btn btn-sm btn-warn sys-alarm-btn">⏰系统闹钟</button>
        <button class="btn btn-sm btn-green sys-cal-btn">📅系统日历</button>
        <button class="btn btn-sm btn-danger del-btn">删除</button>
      </div>
    `;
    div.querySelector('.sys-alarm-btn').onclick = () => {
      syncToDeviceAlarm({
        hour: t.hour,
        minute: t.minute,
        message: `上课：${c.name} (${c.room || ''})`,
        days: [t.capWeekday]
      });
    };
    div.querySelector('.sys-cal-btn').onclick = () => {
      const sD = getNextWeekdayDate(Number(c.day), c.start);
      const eD = getNextWeekdayDate(Number(c.day), c.end);
      syncToDeviceCalendar({
        title: `上课：${c.name}`,
        location: c.room || '',
        description: `每周${DAYS_LABEL[c.day]}`,
        startTimeMs: sD.getTime(),
        endTimeMs: Math.max(eD.getTime(), sD.getTime() + 3600000),
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
    id: notifId,
    title: `即将上课：${item.name}`,
    body: `${item.start}-${item.end} ${item.room || ''}`,
    weeklyWeekday: t.capWeekday,
    hour: t.hour,
    minute: t.minute,
    mode: item.mode || 'alarm'
  });
  courses.push({
    ...item,
    id: Date.now() + Math.random(),
    notifId
  });
  saveCourses();
  return t;
}

document.getElementById('addCourseBtn').addEventListener('click', async () => {
  const name = document.getElementById('cName').value.trim();
  if (!name) {
    alert('请输入课程名称');
    return;
  }
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

  if (item.mode === 'sys_alarm') {
    await syncToDeviceAlarm({
      hour: t.hour,
      minute: t.minute,
      message: `上课：${item.name}`,
      days: [t.capWeekday]
    });
  } else if (item.mode === 'sys_cal') {
    const sD = getNextWeekdayDate(item.day, item.start);
    const eD = getNextWeekdayDate(item.day, item.end);
    await syncToDeviceCalendar({
      title: `上课：${item.name}`,
      location: item.room,
      description: `每周${DAYS_LABEL[item.day]}`,
      startTimeMs: sD.getTime(),
      endTimeMs: Math.max(eD.getTime(), sD.getTime() + 3600000),
      rrule: `FREQ=WEEKLY;BYDAY=${RRULE_DAYS[item.day]}`
    });
  } else {
    showToast('✅ 课程与提醒已保存');
  }
});

document.getElementById('openBatchCourseBtn').addEventListener('click', () => {
  showSmartImportReviewModal('高等数学 周一 08:00-09:40 教A101\n大学英语 周三 10:00-11:40 教B205');
});

async function addExamOrScheduleItem(item) {
  const targetMs = new Date(item.datetime).getTime() - Number(item.advance || 0) * 60000;
  const notifId = makeSafeNotifId();
  if (targetMs > Date.now()) {
    await scheduleAppReminder({
      id: notifId,
      title: `${item.type || '日程'}：${item.name}`,
      body: `${item.datetime.replace('T', ' ')} ${item.room || ''}`,
      atDate: new Date(targetMs),
      mode: item.mode || 'alarm'
    });
  }
  exams.push({
    ...item,
    type: item.type || '考试',
    id: Date.now() + Math.random(),
    notifId
  });
  saveExams();
  return targetMs;
}

function renderExams() {
  const list = document.getElementById('examList');
  const sorted = [...exams].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  if (!sorted.length) {
    list.innerHTML = '<div class="sub-text" style="text-align:center; padding:16px;">暂无日程 🎯</div>';
    return;
  }

  list.innerHTML = '';
  const now = Date.now();
  sorted.forEach(ex => {
    const diffMs = new Date(ex.datetime).getTime() - now;
    let cd = '已过时';
    let uc = '';
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
      syncToDeviceAlarm({
        hour: t.getHours(),
        minute: t.getMinutes(),
        message: `${ex.type}：${ex.name}`
      });
    };
    div.querySelector('.sys-cal-btn').onclick = () => {
      const st = new Date(ex.datetime).getTime();
      syncToDeviceCalendar({
        title: `[${ex.type}] ${ex.name}`,
        location: ex.room || '',
        description: ex.note || '',
        startTimeMs: st,
        endTimeMs: st + 7200000
      });
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
  if (!name || !datetime) {
    alert('请填写标题和日期时间');
    return;
  }
  const item = {
    type: document.getElementById('eType').value,
    name,
    datetime,
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
    await syncToDeviceAlarm({
      hour: t.getHours(),
      minute: t.getMinutes(),
      message: `${item.type}：${item.name}`
    });
  } else if (item.mode === 'sys_cal') {
    const st = new Date(datetime).getTime();
    await syncToDeviceCalendar({
      title: `[${item.type}] ${item.name}`,
      location: item.room,
      description: item.note,
      startTimeMs: st,
      endTimeMs: st + 7200000
    });
  } else {
    showToast('✅ 日程与提醒已保存');
  }
});
