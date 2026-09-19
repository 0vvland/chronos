Chronos time tracker
============
<p align="center">
  <img src="https://github.com/0vvland/chronos/blob/master/source/logo.svg" alt="Chronos logo" width="128"/>
</p>

A GNOME Shell extension that tracks your working time from the top panel:
one click to start or pause, a running counter in the panel, and alarms that
remind you to take a break, to start tracking when you forgot to, or to stop
once you have hit your daily target.

Supports GNOME Shell 45–50.

![indicator](https://github.com/0vvland/chronos/blob/master/screenshot.png)
![preferences](https://github.com/0vvland/chronos/blob/master/preferences.png)

### Features

- **Tracking** — start/pause from the panel menu, cumulative counter shown as
  `H:MM` (or `H:MM:SS`), restart to a preset value at any time
- **Break alarm** — a notification after a chosen span of uninterrupted
  tracking, with a *Postpone…* dialog
- **Start tracking reminder** — a notification when the tracker stays paused
  inside your working hours, with *Start*, *Postpone…* and *Not today* actions
- **Tracked time goal** — a notification when the cumulative counter reaches
  your target (e.g. 8:00), with a *Postpone…* dialog measured in further
  tracked time
- **Appearance** — separate colors for the running and paused states, optional
  seconds in the indicator
- **Lock/suspend handling** — optionally pause tracking while the screen is
  locked; when disabled, time spent locked or suspended is recovered on resume
- **Logging** — append every state change to `~/timeTrack.log`, optionally
  capped to a number of lines, trimmed to the newest ones on every start
- **Localisation** — English and Russian

### Install

Turn it On at [Gnome extensions](https://extensions.gnome.org/extension/6856/chronos-time-tracker/)

or build and install from source:

```shell
git clone https://github.com/0vvland/chronos.git
cd chronos
make install     # builds the zip, then `gnome-extensions install --force`
```

Then log out and back in (or restart the Shell on X11) and enable
*Chronos Time Tracker* in the Extensions app.

### Usage

Click the panel counter to open the menu:

| Action | Effect |
|---|---|
| **Start / Pause** | Toggles tracking; the counter and its color follow the state |
| **Restart** | Sets the tracked time back to the configured *Reset time* |
| **Preferences** | Opens the settings window |

The counter can go negative (e.g. after restarting to a negative reset value),
which is handy for counting time owed down against a daily target.

### Preferences

| Page | Setting | Default | Notes |
|---|---|---|---|
| Time | Adjust tracked time | 0:00 | Edits the current counter directly |
| Time | Reset time | 0:00 | Value applied by *Restart* |
| Appearance | Show seconds | off | `H:MM:SS` instead of `H:MM` |
| Appearance | Normal / Paused state color | green / red | Indicator colors |
| Behavior | Pause while screen locked | on | Off = time while locked is counted |
| Behavior | Log changes of time tracker state | off | Appends to `~/timeTrack.log` |
| Behavior | Limit log file size, Lines to keep | off, 150 | Oldest lines dropped when the extension starts |
| Behavior | Start tracker when restart timer | off | *Restart* also resumes tracking |
| Alarms | Enable break alarm, Interval | off, 1:00 | Alerts after that much uninterrupted tracking |
| Alarms | Enable start tracking reminder | off | Turning it on preselects Mon–Fri |
| Alarms | Days, From, To | Mon–Fri, 9:00, 18:00 | *To* must be later than *From*, otherwise the reminder is inactive |
| Alarms | Delay | 0:15 | Paused time inside the timeframe before alerting |
| Alarms | Enable tracked time goal alarm | off | Has its own switch, so every target stays usable |
| Alarms | Target | 8:00 | Tracked time at which the alarm triggers |

Notes on the alarms:

- The break alarm measures *uninterrupted* tracking — pausing resets it.
- The start reminder only fires while paused, once per idle period, and never
  immediately after login: the delay is counted from the latest of the pause,
  the moment the extension was enabled, and the opening of the timeframe.
- *Not today* silences the start reminder until the next calendar day.
- The goal alarm is raised only by time you actually tracked: editing the
  counter, restarting, or recovering time spent locked moves it past the target
  silently. It fires once per target, and postponing it waits for that much
  *further tracking* — a pause does not consume the postponement.
- The goal alarm's switch is separate from its target because the counter can
  be negative, so `0:00` and negative targets have to stay usable.

### Development

| Command | What it does |
|---|---|
| `make build` | Updates translations and packs `chronos@time-tracker.com.shell-extension.zip` |
| `make install` | `build` + `gnome-extensions install --force` |
| `make run` | `build` + `install` + nested Shell session for testing |
| `make launch` | Nested `gnome-shell --devkit` session only |
| `make reload` | Disable/enable the extension in the running Shell |
| `make lint` | shexli static analysis of the packed zip against the EGO review guidelines |
| `npm run typecheck` | `tsc --noEmit` against the GJS type stubs |

`make build` runs `make lint` as its last step and fails on any finding that is
not an explained waiver. The linter installs itself into `.venv-shexli/` on
first use — see [development.md](development.md) if you want it outside the
build.

Source layout: `source/extension.js` (panel indicator, timing, notifications),
`source/prefs.js` (preferences pages), `source/components/` (reusable rows and
dialogs), `source/schemas/` (GSettings schema). See [AGENTS.md](AGENTS.md) for
architecture notes and [development.md](development.md) for build dependencies.

Translations live in `source/locale/<lang>/LC_MESSAGES/`. To add a language,
copy `source/chronos.pot`, translate it, and run `make build` to compile.

## Plans (ToDo)
- more flexible timer ticks: 1 min and 1 sec timer (depend on view settings) - spare resources
- Auto-pause on idle Pause-on-lock exists; "walked away without locking" does not. global.backend.get_core_idle_monitor() gives a watch that fires after N ms idle and on becoming active again — pause on idle, and optionally retroactively subtract the idle span (you already backdate _startTime for the suspend gap, so the machinery is there). Same class of feature as pref-pause-on-destroy, one new key + one watch to release in onDestroy().
- middle-click toggle The pitch is "one click to start or pause"; one middle-click on the indicator skips the menu entirely
- Alarm urgency / persistence The three notifications use default urgency, so a break alarm is easy to miss in fullscreen or Do Not Disturb. A per-alarm "urgent" option (Notification.urgency = CRITICAL, which stays on screen until acted on) makes the alarms actually do their job. Small, but it's the difference between a reminder and a suggestion
- Projects / multiple timers. It breaks "one counter" and drags in a data model, a picker UI, and per-project history
