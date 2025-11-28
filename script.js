function pomodoroApp() {
  const DEFAULTS = {
    work: 25,
    short: 5,
    long: 15,
    sessionsUntilLong: 4,
    autoStart: false,
    theme: 'morning',
    workTitle: '',
    hateSliders: false
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
    originalTitle: document.title,

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
      if (!this.QUOTES || this.QUOTES.length === 0) return { text: '', author: '' };
      return this.QUOTES[this.currentQuoteIndex % this.QUOTES.length];
    },

// Quotes
    QUOTES: [],
    async loadQuotes() {
      const fallback = [
        { text: 'Keep going; progress is progress, no matter how small.', author: '— Unknown' },
        { text: 'The only way to do great work is to love what you do.', author: '— Steve Jobs' },
        { text: 'Believe you can and you\'re halfway there.', author: '— Theodore Roosevelt' }
      ];
      try {
        const resp = await fetch('./quotes.json');
        if (!resp.ok) throw new Error('Fetch failed');
        const data = await resp.json();
        if (!Array.isArray(data) || data.length === 0) {
          this.QUOTES = fallback;
        } else {
          this.QUOTES = data;
        }
      } catch (e) {
        console.warn('Could not load quotes.json, falling back to default quotes', e);
        this.QUOTES = fallback;
      }
      // ensure stored index is valid
      const savedIndex = parseInt(localStorage.getItem('pomodoro-quote-index')) || 0;
      this.currentQuoteIndex = this.QUOTES.length > 0 ? savedIndex % this.QUOTES.length : 0;
    },

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
    setMode(mode, resetTime = true) {
      this.state.mode = mode;
      document.body.dataset.mode = mode;
      if (mode === 'work') {
        this.state.totalSeconds = this.settings.work * 60;
        document.body.className = `theme-${this.settings.theme}`;
      } else if (mode === 'short') {
        this.state.totalSeconds = this.settings.short * 60;
        const natureThemes = ['mint', 'meadow', 'emerald', 'forest'];
        const randomTheme = natureThemes[Math.floor(Math.random() * natureThemes.length)];
        document.body.className = `theme-${randomTheme}`;
      } else {
        this.state.totalSeconds = this.settings.long * 60;
        const natureThemes = ['mint', 'meadow', 'emerald', 'forest'];
        const randomTheme = natureThemes[Math.floor(Math.random() * natureThemes.length)];
        document.body.className = `theme-${randomTheme}`;
      }
      // Only reset remaining seconds if we want to start a fresh session
      if (resetTime) {
        this.state.remainingSeconds = this.state.totalSeconds;
      }
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
      this.updateTitleWithTimer();
      this.state.timerId = setInterval(() => {
        this.state.remainingSeconds -= 1;
        this.updateTitleWithTimer();
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
      this.updateTitleWithTimer();
      clearInterval(this.state.timerId);
    },
    resetTimer() {
      this.pauseTimer();
      this.state.remainingSeconds = this.state.totalSeconds;
      this.updateTitleWithTimer();
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

      if (this.settings.autoStart) {
        this.startTimer();
      } else {
        this.updateTitleWithTimer();
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
      
      // Always update the current mode with new settings
      // If timer is running, update totalSeconds but preserve remainingSeconds
      if (this.state.running) {
        if (this.state.mode === 'work') {
          this.state.totalSeconds = this.settings.work * 60;
        } else if (this.state.mode === 'short') {
          this.state.totalSeconds = this.settings.short * 60;
        } else if (this.state.mode === 'long') {
          this.state.totalSeconds = this.settings.long * 60;
        }
        // Ensure remainingSeconds doesn't exceed the new totalSeconds
        if (this.state.remainingSeconds > this.state.totalSeconds) {
          this.state.remainingSeconds = this.state.totalSeconds;
        }
      } else {
        // If timer is not running, update mode with new settings
        this.setMode(this.state.mode, false);
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
    updateCurrentModeDuration() {
      // Update the totalSeconds for the current mode based on the new slider value
      if (this.state.mode === 'work') {
        this.state.totalSeconds = this.settings.work * 60;
      } else if (this.state.mode === 'short') {
        this.state.totalSeconds = this.settings.short * 60;
      } else if (this.state.mode === 'long') {
        this.state.totalSeconds = this.settings.long * 60;
      }
      
      // If timer is not running, update remainingSeconds to match the new totalSeconds
      if (!this.state.running) {
        this.state.remainingSeconds = this.state.totalSeconds;
      } else {
        // If timer is running, ensure remainingSeconds doesn't exceed the new totalSeconds
        if (this.state.remainingSeconds > this.state.totalSeconds) {
          this.state.remainingSeconds = this.state.totalSeconds;
        }
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
    updateTitleWithTimer() {
      if (this.state.running) {
        document.title = `${this.minutes}:${this.seconds} - ${this.originalTitle}`;

        const favicon = document.getElementById('dynamic-favicon');
        if (favicon) {
          const paths = {
            work: 'favicons/work-orange.svg',
            short: 'favicons/short-green.svg',
            long: 'favicons/long-purple.svg'
          };
          favicon.href = paths[this.state.mode] || '';
        }
      } else {
        document.title = this.originalTitle;

        const favicon = document.getElementById('dynamic-favicon');
        if (favicon) {
          favicon.href = 'favicons/pomodoro-default.svg';
        }
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

        // Cmd/Ctrl+K to open settings (global)
        if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyK' || e.key === 'k' || e.key === 'K')) {
          e.preventDefault();
          e.stopPropagation();
          this.toggleSettings();
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
      if (!this.QUOTES || this.QUOTES.length === 0) return;
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
    async init() {
      this.applyTheme();
      await this.loadQuotes();

      // Restore state first to preserve the current mode and timer state
      this.restoreState();

      // Then ensure correct mode is set based on restored state without resetting the timer
      this.setMode(this.state.mode, false);

      this.startQuoteRotation();
      this.setupUnloadHandler();
      this.updateTitleWithTimer();
    },
    restoreState() {
      try {
        const saved = JSON.parse(localStorage.getItem('pomodoro-state'));
        if (saved) {
          if (saved.mode) this.state.mode = saved.mode;
          if (saved.remainingSeconds) this.state.remainingSeconds = saved.remainingSeconds;
          if (saved.completedSessions) this.state.completedSessions = saved.completedSessions;
        }
      } catch (e) { /* storage unavailable */ }
    },
    setupUnloadHandler() {
      window.addEventListener('beforeunload', () => this.saveState());
    },
    saveState() {
      try {
        localStorage.setItem('pomodoro-state', JSON.stringify({
          mode: this.state.mode,
          remainingSeconds: this.state.remainingSeconds,
          completedSessions: this.state.completedSessions
        }));
      } catch (e) { /* storage unavailable */ }
    }
  };
}
