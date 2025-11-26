# Pomodoro — Beautiful Timer

A simple, responsive Pomodoro timer built with HTML, CSS, and JS. The timer uses the full browser width to display a large, visually pleasing countdown. Includes a settings panel with theme switching, configurable durations (work/short/long), auto-start toggle, and sessions until long break.

## Features
- Full width, large countdown display (responsive)
- Work / Short break / Long break modes
- Configurable durations and sessions until long break
- Multiple themes (Morning, Night, Mint, Lavender)
 - Multiple themes (Morning, Night, Mint, Lavender + new: Sunrise, Ocean, Forest, Rose, Dusk)
 - Multiple themes (Morning, Night, Mint, Lavender, Sunrise, Ocean, Forest, Rose, Sunset, Desert, Sky, Meadow, Autumn)
- Overlay settings drawer
- Auto-start next session option
- Small session progress dots
- Sound via WebAudio and optional notification permission
- Saves settings and some state to localStorage
 - Right-side rotating time-management quotes for motivation

## Running
Open `index.html` in a modern browser.

## Usage
- Click the Start button (or press Space) to start/pause.
- Skip (S) or Reset (R) a session using the buttons or the keyboard.
 - Global Spacebar support: press Space anywhere (when not focused in a text field) to start/pause the timer.
 - Global Cmd/Ctrl + K: press Cmd+K (macOS) or Ctrl+K (Windows/Linux) to open/close the settings panel.
- Click the ⚙️ icon to open settings; modify durations, theme, and auto-start behavior.
- Settings are saved to localStorage.

## Recommended improvements (optional)
- Add user-uploaded sounds or MP3s
- Add a task list or to-do integration
- Add statistics and charts of completed Pomodoro sessions

---

Built for quick use and easy customization — enjoy focused work!
