/* Pomodoro Timer JavaScript
   Essential features:
   - Start/pause/reset/skip
   - Work/short break/long break modes
   - Settings to configure durations and sessions until long break
   - Themes: saved to localStorage
   - Auto-start next toggle and sound notifications
*/

const $ = sel => document.querySelector(sel);
const $all = sel => document.querySelectorAll(sel);

// Elements
const minutesEl = $('#minutes');
const secondsEl = $('#seconds');
const startBtn = $('#start-pause');
const resetBtn = $('#reset');
const skipBtn = $('#skip');
const sessionIndicator = $('#session-indicator');
const progressBar = $('#progress-bar');
const dingAudio = $('#ding-audio');

const settingsBtn = $('#settings-btn');
const settingsPanel = $('#settings');
const settingsBg = document.getElementById('settings-bg');
const saveSettingsBtn = $('#save-settings');
const resetSettingsBtn = $('#reset-settings');
const settingsCloseBtn = $('#settings-close');
const sessionDotsContainer = $('#session-dots');
const quoteArea = $('#quote-area');
const quoteText = $('#quote-text');
const quoteAuthor = $('#quote-author');

// Settings inputs
const workMinIn = $('#work-min');
const shortMinIn = $('#short-min');
const longMinIn = $('#long-min');
const sessionsUntilLongIn = $('#sessions-until-long');
const themeSelect = $('#theme-select');
const autoStartCheckbox = $('#auto-start');

// Defaults and state
const DEFAULTS = {
  work: 25,
  short: 5,
  long: 15,
  sessionsUntilLong: 4,
  autoStart: false,
  theme: 'morning'
};

let state = {
  running: false,
  timerId: null,
  mode: 'work', // work, short, long
  totalSeconds: DEFAULTS.work * 60,
  remainingSeconds: DEFAULTS.work * 60,
  completedSessions: 0
};

function loadSettings(){
  try{
    const saved = JSON.parse(localStorage.getItem('pomodoro-settings')) || {};
    return {...DEFAULTS, ...saved};
  }catch(e){
    return DEFAULTS;
  }
}
function saveSettings(settings){
  localStorage.setItem('pomodoro-settings', JSON.stringify(settings));
}

function applyTheme(themeName){
  document.body.className = `theme-${themeName}`;
}

// Init UI / settings
let settings = loadSettings();
workMinIn.value = settings.work;
shortMinIn.value = settings.short;
longMinIn.value = settings.long;
sessionsUntilLongIn.value = settings.sessionsUntilLong;
autoStartCheckbox.checked = settings.autoStart;
themeSelect.value = settings.theme;
applyTheme(settings.theme);

// Utility
function formatTime(sec){
  const m = Math.floor(sec/60);
  const s = Math.floor(sec%60);
  return {m: String(m).padStart(2,'0'), s: String(s).padStart(2,'0')};
}

function updateDisplay(){
  const time = formatTime(state.remainingSeconds);
  minutesEl.textContent = time.m;
  secondsEl.textContent = time.s;
  // progress
  const percent = Math.min(100, ((state.totalSeconds - state.remainingSeconds)/state.totalSeconds) * 100);
  progressBar.style.width = `${percent}%`;
  sessionIndicator.textContent = state.mode === 'work' ? 'Work' : (state.mode === 'short' ? 'Short Break' : 'Long Break');
}

function playDing(){
  // Try to play a short tone using WebAudio if audio element has no src
  if(dingAudio.src){
    dingAudio.currentTime = 0;
    dingAudio.play().catch(()=>{});
    return;
  }

  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.stop(ctx.currentTime + 0.55);
  }catch(e){
    // last resort: beep with minimal approach
    console.log('ding fallback', e);
  }
}

function notify(title, body){
  if(!('Notification' in window)) return;
  if(Notification.permission === 'granted'){
    const n = new Notification(title, {body});
    setTimeout(()=>n.close(), 4500);
  }else if(Notification.permission !== 'denied'){
    Notification.requestPermission().then(p => {
      if(p === 'granted') notify(title, body);
    })
  }
}

function setMode(mode){
  state.mode = mode;
  document.body.dataset.mode = mode;
  if(mode === 'work'){
    state.totalSeconds = parseInt(workMinIn.value) * 60;
  }else if(mode === 'short'){
    state.totalSeconds = parseInt(shortMinIn.value) * 60;
  }else{
    state.totalSeconds = parseInt(longMinIn.value) * 60;
  }
  state.remainingSeconds = state.totalSeconds;
  updateDisplay();
}
// do not auto-rotate quotes at every internal setMode call to avoid errors during init

function toggleStartPause(){
  if(state.running){
    pauseTimer();
  }else{
    startTimer();
  }
}

function startTimer(){
  if(state.running) return;
  state.running = true;
  startBtn.textContent = 'Pause';
  state.timerId = setInterval(() => {
    state.remainingSeconds -= 1;
    if(state.remainingSeconds <= 0){
      clearInterval(state.timerId);
      state.running = false;
      startBtn.textContent = 'Start';
      onTimerEnd();
    }
    updateDisplay();
  }, 1000);
}

function pauseTimer(){
  if(!state.running) return;
  state.running = false;
  startBtn.textContent = 'Start';
  clearInterval(state.timerId);
}

function resetTimer(){
  pauseTimer();
  state.remainingSeconds = state.totalSeconds;
  updateDisplay();
}

function skipTimer(){
  pauseTimer();
  onTimerEnd(true);
}

function onTimerEnd(skipped=false){
  // Play sound and notify
  playDing();
  notify('Pomodoro', `Session complete: ${state.mode}`);

  if(state.mode === 'work'){
    state.completedSessions = (state.completedSessions || 0) + 1;
  }

  // choose next mode
  const sessionsUntilLong = parseInt(sessionsUntilLongIn.value);
  if(state.mode === 'work'){
    // if reached long break threshold
    if(state.completedSessions % sessionsUntilLong === 0){
      setMode('long');
    }else{
      setMode('short');
    }
  }else{
    // we just finished a break -> go to work
    setMode('work');
  }

  // If auto-start enabled, start next session
  if(autoStartCheckbox.checked && !skipped) {
    startTimer();
  }
  // rotate quote on session end/change
  try{ nextQuote(); }catch(e){}
  renderSessionDots();
}

// Settings handlers
function openSettings(){
  settingsPanel.classList.add('open');
  settingsPanel.setAttribute('aria-hidden','false');
  settingsBtn.setAttribute('aria-expanded','true');
  settingsBg.classList.add('open');
  // hide quote area while settings open
  quoteArea?.classList.add('hidden');
}
function closeSettings(){
  settingsPanel.classList.remove('open');
  settingsPanel.setAttribute('aria-hidden','true');
  settingsBtn.setAttribute('aria-expanded','false');
  settingsBg.classList.remove('open');
  // reveal quote area when settings closed
  quoteArea?.classList.remove('hidden');
}

settingsBtn.addEventListener('click', () => {
  if(settingsPanel.classList.contains('open')) closeSettings();
  else openSettings();
});

settingsBg.addEventListener('click', closeSettings);
window.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeSettings(); });
settingsCloseBtn?.addEventListener('click', closeSettings);

saveSettingsBtn.addEventListener('click', () => {
  const newSettings = {
    work: parseInt(workMinIn.value),
    short: parseInt(shortMinIn.value),
    long: parseInt(longMinIn.value),
    sessionsUntilLong: parseInt(sessionsUntilLongIn.value),
    autoStart: autoStartCheckbox.checked,
    theme: themeSelect.value
  };
  saveSettings(newSettings);
  settings = newSettings;
  applyTheme(settings.theme);
  // set current mode durations only if not running
  if(!state.running){
    // keep same mode but update total
    setMode(state.mode);
  }
  closeSettings();
  // simple toast fallback: small status
  const toast = document.createElement('div');
  toast.textContent = 'Settings saved';
  toast.className = 'toast';
  document.body.appendChild(toast);
  setTimeout(()=>{toast.remove();}, 2400);
  // Ask for notifications permission if not already denied
  if('Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission();
  }
});

resetSettingsBtn.addEventListener('click', () => {
  if(confirm('Reset to defaults?')){
    localStorage.removeItem('pomodoro-settings');
    workMinIn.value = DEFAULTS.work;
    shortMinIn.value = DEFAULTS.short;
    longMinIn.value = DEFAULTS.long;
    sessionsUntilLongIn.value = DEFAULTS.sessionsUntilLong;
    autoStartCheckbox.checked = DEFAULTS.autoStart;
    themeSelect.value = DEFAULTS.theme;
    applyTheme(DEFAULTS.theme);
    setMode('work');
  }
});

// Buttons
startBtn.addEventListener('click', toggleStartPause);
resetBtn.addEventListener('click', resetTimer);
skipBtn.addEventListener('click', skipTimer);

// theme change
themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

// keyboard shortcuts: space to toggle start, r to reset, s to skip, t to toggle theme
window.addEventListener('keydown', (e) => {
  if(e.code === 'Space') { e.preventDefault(); toggleStartPause(); }
  if(e.code.toLowerCase() === 'keyr') resetTimer();
  if(e.code.toLowerCase() === 'keys') skipTimer();
});

// initialize
function init(){
  setMode('work');
  updateDisplay();
  renderSessionDots();
}

init();

// Accessibility: request notification permission option
if('Notification' in window && Notification.permission === 'default'){
  // nothing by default; ask when user saves settings
}

// Make sure onload we reflect saved theme
applyTheme(settings.theme);

// Try to set up a small beep in audio element for fallback (data uri optional)
// We'll keep it simple: don't load external assets.

// Save state before unload
window.addEventListener('beforeunload', () => {
  localStorage.setItem('pomodoro-state', JSON.stringify({
    mode: state.mode,
    remainingSeconds: state.remainingSeconds,
    completedSessions: state.completedSessions
  }));
});

// Restore some state if available
try{
  const saved = JSON.parse(localStorage.getItem('pomodoro-state'));
  if(saved){
    if(saved.mode) state.mode = saved.mode;
    if(saved.remainingSeconds) state.remainingSeconds = saved.remainingSeconds;
    if(saved.completedSessions) state.completedSessions = saved.completedSessions;
    setTimeout(updateDisplay, 10);
  }
}catch(e){
  // ignore errors
}

function renderSessionDots(){
  const count = parseInt(sessionsUntilLongIn.value) || 4;
  sessionDotsContainer.innerHTML = '';
  for(let i=0;i<count;i++){
    const d = document.createElement('div');
    d.className = 'dot' + (i < (state.completedSessions % count) ? ' active' : '');
    sessionDotsContainer.appendChild(d);
  }
}

// Rotating quotes
const QUOTES = [
  {text: 'You may delay, but time will not.', author: '— Benjamin Franklin'},
  {text: 'The key is in not spending time, but in investing it.', author: '— Stephen R. Covey'},
  {text: 'Time is what we want most, but what we use worst.', author: '— William Penn'},
  {text: 'It’s not knowing what to do, it’s doing what you know.', author: '— Tony Robbins'},
  {text: 'Lost time is never found again.', author: '— Benjamin Franklin'},
  {text: 'Your future is created by what you do today, not tomorrow.', author: '— Robert Kiyosaki'},
  {text: 'Don’t count the days; make the days count.', author: '— Muhammad Ali'},
  {text: 'Small daily improvements over time lead to stunning results.', author: '— Robin Sharma'}
];

let currentQuoteIndex = parseInt(localStorage.getItem('pomodoro-quote-index')) || 0;
let quoteTimer = null;

function renderQuote(idx){
  const q = QUOTES[idx % QUOTES.length];
  quoteText.textContent = q.text;
  quoteAuthor.textContent = q.author;
  localStorage.setItem('pomodoro-quote-index', idx);
}

function nextQuote(){
  currentQuoteIndex = (currentQuoteIndex + 1) % QUOTES.length;
  renderQuote(currentQuoteIndex);
}

function startQuoteRotation(interval = 20000){
  // Clear any existing
  clearInterval(quoteTimer);
  quoteTimer = setInterval(() => {
    // animate fade
    quoteArea.querySelector('.quote-card').classList.add('fade-exit-active');
    setTimeout(()=>{
      nextQuote();
      const qcard = quoteArea.querySelector('.quote-card');
      qcard.classList.remove('fade-exit-active');
      qcard.classList.add('fade-enter-active');
      setTimeout(()=>{
        qcard.classList.remove('fade-enter-active');
      }, 480);
    }, 240);
  }, interval);
}

// Render initial
renderQuote(currentQuoteIndex);
startQuoteRotation();
