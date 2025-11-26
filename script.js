function pomodoroApp() {
  const DEFAULTS = {
    work: 25,
    short: 5,
    long: 15,
    sessionsUntilLong: 4,
    autoStart: false,
    theme: 'morning',
    workTitle: ''
  };

  const loadSettings = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('pomodoro-settings')) || {};
      return { ...DEFAULTS, ...saved };
    } catch (e) {
      return { ...DEFAULTS };
    }
  };

  const settings = loadSettings();

  return {
    DEFAULTS,
    settings,
    state: {
      running: false,
      timerId: null,
      mode: 'work',
      totalSeconds: settings.work * 60,
      remainingSeconds: settings.work * 60,
      completedSessions: 0
    },
    settingsOpen: false,
    quoteFadeClass: '',
    currentQuoteIndex: 0,
    quoteTimer: null,

    // Computed properties
    get minutes() {
      return String(Math.floor(this.state.remainingSeconds / 60)).padStart(2, '0');
    },
    get seconds() {
      return String(Math.floor(this.state.remainingSeconds % 60)).padStart(2, '0');
    },
    get progressPercent() {
      return Math.min(100, ((this.state.totalSeconds - this.state.remainingSeconds) / this.state.totalSeconds) * 100);
    },
    get sessionIndicator() {
      if (this.state.mode === 'work') {
        return this.settings.workTitle || 'Work';
      }
      return this.state.mode === 'short' ? 'Short Break' : 'Long Break';
    },
    get startBtnText() {
      return this.state.running ? 'Pause' : 'Start';
    },
    get sessionDots() {
      const count = this.settings.sessionsUntilLong || 4;
      const dots = [];
      for (let i = 0; i < count; i++) {
        dots.push({ active: i < (this.state.completedSessions % count) });
      }
      return dots;
    },
    get currentQuote() {
      return this.QUOTES[this.currentQuoteIndex % this.QUOTES.length];
    },

    // Quotes
    QUOTES: [
      { text: 'You may delay, but time will not.', author: '— Benjamin Franklin' },
      { text: 'The key is in not spending time, but in investing it.', author: '— Stephen R. Covey' },
      { text: 'Time is what we want most, but what we use worst.', author: '— William Penn' },
      { text: 'It’s not knowing what to do, it’s doing what you know.', author: '— Tony Robbins' },
      { text: 'Lost time is never found again.', author: '— Benjamin Franklin' },
      { text: 'Your future is created by what you do today, not tomorrow.', author: '— Robert Kiyosaki' },
      { text: 'Don’t count the days; make the days count.', author: '— Muhammad Ali' },
      { text: 'Small daily improvements over time lead to stunning results.', author: '— Robin Sharma' }
    ],

    // Methods
    saveSettingsToStorage(settings) {
      localStorage.setItem('pomodoro-settings', JSON.stringify(settings));
    },
    applyTheme() {
      // apply theme class to body based on current settings
      try {
        document.body.className = `theme-${this.settings.theme}`;
      } catch (e) {
        // fallback: ensure at least DEFAULTS theme
        document.body.className = `theme-${DEFAULTS.theme}`;
      }
    },
    playDing() {
      try {
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
      } catch (e) {
        // no sound
      }
    },
    notify(title, body) {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'granted') {
        const n = new Notification(title, { body });
        setTimeout(() => n.close(), 4500);
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
          if (p === 'granted') this.notify(title, body);
        });
      }
    },
    setMode(mode) {
      this.state.mode = mode;
      document.body.dataset.mode = mode;
      if (mode === 'work') {
        this.state.totalSeconds = this.settings.work * 60;
      } else if (mode === 'short') {
        this.state.totalSeconds = this.settings.short * 60;
      } else {
        this.state.totalSeconds = this.settings.long * 60;
      }
      this.state.remainingSeconds = this.state.totalSeconds;
    },
    toggleStartPause() {
      if (this.state.running) {
        this.pauseTimer();
      } else {
        this.startTimer();
      }
    },
    startTimer() {
      if (this.state.running) return;
      this.state.running = true;
      this.state.timerId = setInterval(() => {
        this.state.remainingSeconds -= 1;
        if (this.state.remainingSeconds <= 0) {
          clearInterval(this.state.timerId);
          this.state.running = false;
          this.onTimerEnd();
        }
      }, 1000);
    },
    pauseTimer() {
      if (!this.state.running) return;
      this.state.running = false;
      clearInterval(this.state.timerId);
    },
    resetTimer() {
      this.pauseTimer();
      this.state.remainingSeconds = this.state.totalSeconds;
    },
    skipTimer() {
      this.pauseTimer();
      this.onTimerEnd(true);
    },
    onTimerEnd(skipped = false) {
      this.playDing();
      this.notify('Pomodoro', `Session complete: ${this.state.mode}`);

      if (this.state.mode === 'work') {
        this.state.completedSessions = (this.state.completedSessions || 0) + 1;
      }

      if (this.state.mode === 'work') {
        if (this.state.completedSessions % this.settings.sessionsUntilLong === 0) {
          this.setMode('long');
        } else {
          this.setMode('short');
        }
      } else {
        this.setMode('work');
      }

      if (this.settings.autoStart && !skipped) {
        this.startTimer();
      }
      this.nextQuote();
    },
    toggleSettings() {
      this.settingsOpen = !this.settingsOpen;
    },
    closeSettings() {
      this.settingsOpen = false;
    },
    saveSettings() {
      this.saveSettingsToStorage(this.settings);
      this.applyTheme();
      if (!this.state.running) {
        this.setMode(this.state.mode);
      }
      this.closeSettings();
      // Toast
      const toast = document.createElement('div');
      toast.textContent = 'Settings saved';
      toast.className = 'toast';
      document.body.appendChild(toast);
      setTimeout(() => { toast.remove(); }, 2400);
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    },
    resetSettings() {
      if (confirm('Reset to defaults?')) {
        localStorage.removeItem('pomodoro-settings');
        this.settings = { ...this.DEFAULTS };
        this.applyTheme();
        this.setMode('work');
      }
    },
    handleGlobalKeydown(e) {
      try {
        const active = document.activeElement;
        const tag = (active && active.tagName) ? active.tagName.toUpperCase() : '';
        const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (active && active.isContentEditable);
        if (isTyping) return; // allow normal typing (including spaces)

        // Space toggles start/pause when not typing in a field
        const keyIsSpace = e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar' || e.which === 32 || e.keyCode === 32;
        if (keyIsSpace) {
          e.preventDefault();
          e.stopPropagation();
          this.toggleStartPause();
          return;
        }

        if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          this.resetTimer();
          return;
        }

        if (e.code === 'KeyS' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          this.skipTimer();
          return;
        }

        if (e.key === 'Escape') {
          this.closeSettings();
        }
      } catch (err) {
        console.warn('Keyboard handler error:', err);
      }
    },
    nextQuote() {
      this.currentQuoteIndex = (this.currentQuoteIndex + 1) % this.QUOTES.length;
      localStorage.setItem('pomodoro-quote-index', this.currentQuoteIndex);
      // Animate
      this.quoteFadeClass = 'fade-exit-active';
      setTimeout(() => {
        this.quoteFadeClass = 'fade-enter-active';
        setTimeout(() => {
          this.quoteFadeClass = '';
        }, 480);
      }, 240);
    },
    startQuoteRotation(interval = 20000) {
      clearInterval(this.quoteTimer);
      this.quoteTimer = setInterval(() => {
        this.nextQuote();
      }, interval);
    },
    init() {
      this.applyTheme();
      this.setMode('work');
      this.currentQuoteIndex = parseInt(localStorage.getItem('pomodoro-quote-index')) || 0;
      this.startQuoteRotation();

      // Restore state
      try {
        const saved = JSON.parse(localStorage.getItem('pomodoro-state'));
        if (saved) {
          if (saved.mode) this.state.mode = saved.mode;
          if (saved.remainingSeconds) this.state.remainingSeconds = saved.remainingSeconds;
          if (saved.completedSessions) this.state.completedSessions = saved.completedSessions;
        }
      } catch (e) { }

      // Save state before unload
      window.addEventListener('beforeunload', () => {
        localStorage.setItem('pomodoro-state', JSON.stringify({
          mode: this.state.mode,
          remainingSeconds: this.state.remainingSeconds,
          completedSessions: this.state.completedSessions
        }));
      });
    }
  };
}
