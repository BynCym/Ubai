// ===== Ubai - 核心逻辑 =====

const STORAGE_KEY = 'ubai_sessions';
const BG_KEY = 'ubai_bg';

// ----- 背景图 -----
const BG_IMAGES = [
  'assets/images/bg-1.jpg',
  'assets/images/bg-2.jpg',
  'assets/images/bg-3.jpg',
  'assets/images/bg-4.jpg',
  'assets/images/bg-5.jpg',
  'assets/images/bg-6.jpg',
  'assets/images/bg-7.jpg',
  'assets/images/bg-8.jpg',
];

// ----- 状态 -----
let focusDuration = 25 * 60;
let restDuration = 5 * 60;
let timeLeft = focusDuration;
let totalTime = focusDuration;
let isRunning = false;
let timerId = null;
let sessionStartTime = null;
let currentTab = 'focus'; // focus | rest
let currentBg = 0;
let activeSound = null;

// ----- DOM -----
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const bgLayer = $('#bg-layer');
const timerTime = $('#timer-time');
const timerLabel = $('#timer-label');
const waveFill = $('#wave-fill');
const btnStart = $('#btn-start');
const btnReset = $('#btn-reset');
const btnSkip = $('#btn-skip');

// ----- 背景 -----
async function loadBg() {
  const saved = localStorage.getItem(BG_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);

      if (data.type === 'tauri-path') {
        try {
          const { exists } = await import('@tauri-apps/api/fs');
          const fileExists = await exists(data.path);
          if (fileExists) {
            const { convertFileSrc } = await import('@tauri-apps/api/tauri');
            bgLayer.style.backgroundImage = `url(${convertFileSrc(data.path)})`;
            return;
          }
          localStorage.removeItem(BG_KEY);
        } catch {
          localStorage.removeItem(BG_KEY);
        }
      }

      if (data.type === 'url') {
        bgLayer.style.backgroundImage = `url(${data.url})`;
        return;
      }

      if (data.type === 'index' && BG_IMAGES[data.index]) {
        currentBg = data.index;
      }
    } catch {}
  }
  bgLayer.style.backgroundImage = `url(${BG_IMAGES[currentBg]})`;
}

function setBg(index) {
  currentBg = index;
  bgLayer.style.backgroundImage = `url(${BG_IMAGES[index]})`;
  localStorage.setItem(BG_KEY, JSON.stringify({ type: 'index', index }));
  renderBgThumbnails();
}

async function setCustomBg(file) {
  try {
    const { writeBinaryFile, createDir } = await import('@tauri-apps/api/fs');
    const { appConfigDir, join } = await import('@tauri-apps/api/path');

    const configDir = await appConfigDir();
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `custom-bg-${Date.now()}.${ext}`;
    const filePath = await join(configDir, fileName);

    const buffer = await file.arrayBuffer();
    await createDir(configDir, { recursive: true });
    await writeBinaryFile(filePath, new Uint8Array(buffer));

    localStorage.setItem(BG_KEY, JSON.stringify({ type: 'tauri-path', path: filePath }));

    const { convertFileSrc } = await import('@tauri-apps/api/tauri');
    bgLayer.style.backgroundImage = `url(${convertFileSrc(filePath)})`;
    renderBgThumbnails();
  } catch (err) {
    console.error('Failed to save custom background:', err);
    const url = URL.createObjectURL(file);
    bgLayer.style.backgroundImage = `url(${url})`;
    localStorage.setItem(BG_KEY, JSON.stringify({ type: 'url', url }));
    renderBgThumbnails();
  }
}

function renderBgThumbnails() {
  const container = $('#bg-thumbnails');
  container.innerHTML = '';
  BG_IMAGES.forEach((src, i) => {
    const el = document.createElement('div');
    el.className = `bg-thumb${i === currentBg ? ' active' : ''}`;
    el.style.backgroundImage = `url(${src})`;
    el.addEventListener('click', () => setBg(i));
    container.appendChild(el);
  });
}

// 微视差
document.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 10;
  const y = (e.clientY / window.innerHeight - 0.5) * 10;
  bgLayer.style.transform = `translate(${x}px, ${y}px)`;
});

// 背景选择面板
$('#bg-toggle').addEventListener('click', (e) => {
  e.stopPropagation();
  const picker = $('#bg-picker');
  picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
});

// 点击外部关闭背景选择面板
document.addEventListener('click', (e) => {
  const picker = $('#bg-picker');
  if (picker.style.display !== 'none' && !picker.contains(e.target) && e.target.id !== 'bg-toggle') {
    picker.style.display = 'none';
  }
});

$('#bg-upload').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) setCustomBg(file);
});

// ----- 计时器 -----
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateDisplay() {
  timerTime.textContent = formatTime(timeLeft);
  timerLabel.textContent = isRunning
    ? (currentTab === 'focus' ? '专注中' : '休息中')
    : (timeLeft < totalTime ? '已暂停' : (currentTab === 'focus' ? '专注中' : '休息中'));

  // 液面
  const progress = 1 - (timeLeft / totalTime);
  waveFill.style.height = `${progress * 100}%`;
}

function tick() {
  if (timeLeft <= 0) {
    clearInterval(timerId);
    timerId = null;
    isRunning = false;
    updatePlayPauseBtn(btnStart, false);

    if (currentTab === 'focus') {
      completeFocusSession();
    } else {
      // 休息结束，切回专注
      switchTab('focus');
    }
    return;
  }
  timeLeft--;
  updateDisplay();
}

function startTimer() {
  if (isRunning) {
    clearInterval(timerId);
    timerId = null;
    isRunning = false;
    updatePlayPauseBtn(btnStart, false);
  } else {
    isRunning = true;
    if (currentTab === 'focus' && timeLeft === totalTime) {
      sessionStartTime = Date.now();
    }
    timerId = setInterval(tick, 1000);
    updatePlayPauseBtn(btnStart, true);
  }
  updateDisplay();
}

function resetTimer() {
  clearInterval(timerId);
  timerId = null;
  isRunning = false;
  timeLeft = currentTab === 'focus' ? focusDuration : restDuration;
  totalTime = timeLeft;
  sessionStartTime = null;
  updatePlayPauseBtn(btnStart, false);
  updateDisplay();
}

function skipTimer() {
  if (currentTab === 'focus' && timeLeft < totalTime) {
    const sessions = loadSessions();
    const elapsed = Math.round((totalTime - timeLeft) / 60);
    if (elapsed >= 1) {
      sessions.push({
        date: todayKey(), timestamp: Date.now(),
        duration: elapsed,
        startHour: sessionStartTime ? new Date(sessionStartTime).getHours() : new Date().getHours(),
      });
      saveSessions(sessions);
    }
  }
  switchTab(currentTab === 'focus' ? 'rest' : 'focus');
  updateTodayStats();
  updateDashboard();
}

function completeFocusSession() {
  playEndSound();
  // 庆祝动画
  timerTime.style.animation = 'celebrate 0.6s ease';
  setTimeout(() => {
    timerTime.style.animation = '';
    const sessions = loadSessions();
    sessions.push({
      date: todayKey(), timestamp: Date.now(),
      duration: Math.round(focusDuration / 60),
      startHour: sessionStartTime ? new Date(sessionStartTime).getHours() : new Date().getHours(),
    });
    saveSessions(sessions);
    switchTab('rest');
    updateTodayStats();
    updateDashboard();
  }, 1200);
}

function switchTab(tab) {
  clearInterval(timerId);
  timerId = null;
  isRunning = false;
  currentTab = tab;

  $$('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $('#focus-page').classList.toggle('active', tab === 'focus');
  $('#rest-page').classList.toggle('active', tab === 'rest');
  $('#dashboard-page').classList.toggle('active', tab === 'dashboard');

  if (tab === 'focus') {
    timeLeft = focusDuration;
    totalTime = focusDuration;
    updatePlayPauseBtn(btnStart, false);
    updateDisplay();
  } else if (tab === 'rest') {
    timeLeft = restDuration;
    totalTime = restDuration;
    updatePlayPauseBtn($('#btn-rest-start'), false);
    updateRestDisplay();
  } else {
    updateDashboard();
  }
}

function updatePlayPauseBtn(btn, playing) {
  btn.querySelector('.icon-play').style.display = playing ? 'none' : '';
  btn.querySelector('.icon-pause').style.display = playing ? '' : 'none';
}

// ----- 休息计时器 -----
function updateRestDisplay() {
  $('#rest-timer-time').textContent = formatTime(timeLeft);
  $('#rest-timer-label').textContent = isRunning ? '休息中' : (timeLeft < restDuration ? '已暂停' : '休息中');
}

function startRestTimer() {
  if (isRunning) {
    clearInterval(timerId); timerId = null; isRunning = false;
    updatePlayPauseBtn($('#btn-rest-start'), false);
  } else {
    isRunning = true;
    timerId = setInterval(restTick, 1000);
    updatePlayPauseBtn($('#btn-rest-start'), true);
  }
  updateRestDisplay();
}

function restTick() {
  if (timeLeft <= 0) {
    clearInterval(timerId); timerId = null; isRunning = false;
    updatePlayPauseBtn($('#btn-rest-start'), false);
    switchTab('focus');
    return;
  }
  timeLeft--;
  updateRestDisplay();
}

// ----- 提示音 -----
const END_SOUNDS = ['assets/sounds/bell.mp3', 'assets/sounds/bowl.mp3'];

function playEndSound() {
  const src = END_SOUNDS[Math.floor(Math.random() * END_SOUNDS.length)];
  const audio = new Audio(src);
  audio.volume = 0.6;
  audio.play();
}

// ----- 背景音 -----
const SOUND_FILES = {
  'white-noise': 'assets/sounds/white-noise.mp3',
  'rain': 'assets/sounds/rain.mp3',
  'ocean': 'assets/sounds/ocean.mp3',
  'forest': 'assets/sounds/forest.mp3',
  'cafe': 'assets/sounds/cafe.mp3',
};

let bgAudio = null;
let isMuted = false;
let volumeBeforeMute = 50;

function startSound(name) {
  stopSound();
  const src = SOUND_FILES[name];
  if (!src) return;
  bgAudio = new Audio(src);
  bgAudio.loop = true;
  bgAudio.volume = ($('#volume-slider').value / 100) * 0.7;
  bgAudio.play();
  activeSound = name;
}

function stopSound() {
  if (bgAudio) {
    bgAudio.pause();
    bgAudio.src = '';
    bgAudio = null;
  }
  activeSound = null;
}

// 音量控制
$('#volume-slider').addEventListener('input', (e) => {
  if (bgAudio) {
    bgAudio.volume = (e.target.value / 100) * 0.7;
  }
  isMuted = e.target.value === '0';
  $('#volume-icon').textContent = isMuted ? '🔇' : '🔊';
});

// 静音 toggle
$('#volume-icon').addEventListener('click', () => {
  const slider = $('#volume-slider');
  if (isMuted) {
    slider.value = volumeBeforeMute;
    if (bgAudio) bgAudio.volume = (volumeBeforeMute / 100) * 0.7;
    isMuted = false;
    $('#volume-icon').textContent = '🔊';
  } else {
    volumeBeforeMute = slider.value;
    slider.value = 0;
    if (bgAudio) bgAudio.volume = 0;
    isMuted = true;
    $('#volume-icon').textContent = '🔇';
  }
});

// 背景音按钮
$$('.sound-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const name = btn.dataset.sound;
    if (activeSound === name) {
      stopSound();
      $$('.sound-btn').forEach(b => b.classList.remove('active'));
    } else {
      startSound(name);
      $$('.sound-btn').forEach(b => b.classList.toggle('active', b.dataset.sound === name));
    }
  });
});

// ----- 时间预设 -----
$$('.preset-btn[data-minutes]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.minutes === 'custom') {
      $('#custom-wrap').style.display = '';
      $('#custom-minutes').focus();
      $$('.preset-btn[data-minutes]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    } else {
      const min = parseInt(btn.dataset.minutes);
      $$('.preset-btn[data-minutes]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('#custom-wrap').style.display = 'none';
      setFocusDuration(min);
    }
  });
});

$('#custom-minutes').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const val = parseInt(e.target.value);
    if (val >= 1 && val <= 180) setFocusDuration(val);
  }
});

function setFocusDuration(min) {
  if (isRunning) return;
  focusDuration = min * 60;
  timeLeft = focusDuration;
  totalTime = focusDuration;
  sessionStartTime = null;
  if (currentTab !== 'focus') switchTab('focus');
  updatePlayPauseBtn(btnStart, false);
  updateDisplay();
}

// 休息预设
$$('.preset-btn[data-rest]').forEach(btn => {
  btn.addEventListener('click', () => {
    const min = btn.dataset.rest === 'long' ? 15 : 5;
    $$('.preset-btn[data-rest]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    restDuration = min * 60;
    if (currentTab === 'rest' && !isRunning) {
      timeLeft = restDuration;
      totalTime = restDuration;
      updateRestDisplay();
    }
  });
});

// ----- 事件绑定 -----
btnStart.addEventListener('click', startTimer);
btnReset.addEventListener('click', resetTimer);
btnSkip.addEventListener('click', skipTimer);
$('#btn-rest-start').addEventListener('click', startRestTimer);
$('#btn-rest-reset').addEventListener('click', () => {
  clearInterval(timerId); timerId = null; isRunning = false;
  timeLeft = restDuration; totalTime = restDuration;
  updatePlayPauseBtn($('#btn-rest-start'), false);
  updateRestDisplay();
});
$('#btn-rest-skip').addEventListener('click', () => switchTab('focus'));

$$('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// 空格键
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
    e.preventDefault();
    if (currentTab === 'focus') startTimer();
    else if (currentTab === 'rest') startRestTimer();
  }
});

// 窗口控制按钮
function setupWindowControls() {
  const invoke = window.__TAURI__?.tauri?.invoke || window.__TAURI__?.invoke;
  if (!invoke) return;
  $('#win-minimize').addEventListener('click', () => invoke('minimize_window'));
  $('#win-maximize').addEventListener('click', () => invoke('toggle_maximize'));
  $('#win-close').addEventListener('click', () => invoke('close_window'));
}
setupWindowControls();

// ----- 数据 -----
function todayKey() { return new Date().toISOString().slice(0, 10); }
function loadSessions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveSessions(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

function updateTodayStats() {
  const sessions = loadSessions().filter(s => s.date === todayKey());
  const completed = sessions.length;
  const totalMin = sessions.reduce((sum, s) => sum + (s.duration || 25), 0);
  $('#stat-sessions').textContent = completed;
  $('#stat-minutes').textContent = totalMin;
  $('#stat-hours').textContent = (totalMin / 60).toFixed(1) + 'h';
}

function updateDashboard() {
  const sessions = loadSessions();
  renderHeatmap(sessions);
  renderWeeklyChart(sessions);
  renderHistory(sessions);
}

function renderHeatmap(sessions) {
  const container = $('#heatmap');
  container.innerHTML = '';
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const dayLabels = ['日', '一', '二', '三', '四', '五', '六'];

  container.appendChild(Object.assign(document.createElement('div'), { className: 'heatmap-label' }));
  days.forEach(d => {
    const el = document.createElement('div');
    el.className = 'heatmap-day-label';
    const date = new Date(d);
    el.textContent = `${date.getMonth()+1}/${date.getDate()} ${dayLabels[date.getDay()]}`;
    container.appendChild(el);
  });

  for (let hour = 6; hour <= 23; hour++) {
    const label = document.createElement('div');
    label.className = 'heatmap-label';
    label.textContent = `${hour}:00`;
    container.appendChild(label);
    days.forEach(day => {
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      const count = sessions.filter(s => s.date === day && s.startHour === hour).length;
      cell.setAttribute('data-level', Math.min(count, 4));
      cell.setAttribute('data-tip', `${day} ${hour}:00 - ${count} 个番茄`);
      container.appendChild(cell);
    });
  }
}

function renderWeeklyChart(sessions) {
  const container = $('#weekly-chart');
  container.innerHTML = '';
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const maxCount = Math.max(1, ...days.map(d => sessions.filter(s => s.date === d).length));

  days.forEach(d => {
    const count = sessions.filter(s => s.date === d).length;
    const h = (count / maxCount) * 100;
    const group = document.createElement('div');
    group.className = 'chart-bar-group';
    const val = document.createElement('div');
    val.className = 'chart-bar-value';
    val.textContent = count > 0 ? count : '';
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-bar-wrapper';
    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    bar.style.height = `${Math.max(2, h)}%`;
    wrapper.appendChild(bar);
    const label = document.createElement('div');
    label.className = 'chart-bar-label';
    const date = new Date(d);
    label.textContent = `${date.getMonth()+1}/${date.getDate()}`;
    group.append(val, wrapper, label);
    container.appendChild(group);
  });
}

function renderHistory(sessions) {
  const container = $('#history-list');
  container.innerHTML = '';
  if (!sessions.length) {
    container.innerHTML = '<div class="history-empty">还没有专注记录，开始你的第一个番茄吧！</div>';
    return;
  }
  sessions.slice(-20).reverse().forEach(s => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const t = new Date(s.timestamp);
    const timeStr = `${t.getMonth()+1}/${t.getDate()} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
    item.innerHTML = `
      <span class="history-time">${timeStr}</span>
      <span class="history-duration">${s.duration || 25} 分钟</span>
    `;
    container.appendChild(item);
  });
}

// ----- 初始化 -----
loadBg();
renderBgThumbnails();
updateDisplay();
updateTodayStats();
