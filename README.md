Chronos time tracker
============
<p align="center">
  <img src="https://github.com/0vvland/chronos/blob/master/source/logo.svg" alt="Chronos logo" width="128"/>
</p>

A GNOME Shell extension that tracks your working time from the top panel:
one click to start or pause, a running counter in the panel, and alarms that
remind you to take a break — or to start tracking when you forgot to.

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
- **Appearance** — separate colors for the running and paused states, optional
  seconds in the indicator
- **Lock/suspend handling** — optionally pause tracking while the screen is
  locked; when disabled, time spent locked or suspended is recovered on resume
- **Logging** — append every state change to `~/timeTrack.log`
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
| Behavior | Start tracker when restart timer | off | *Restart* also resumes tracking |
| Alarms | Enable break alarm, Interval | off, 1:00 | Alerts after that much uninterrupted tracking |
| Alarms | Enable start tracking reminder | off | Turning it on preselects Mon–Fri |
| Alarms | Days, From, To | Mon–Fri, 9:00, 18:00 | *To* must be later than *From*, otherwise the reminder is inactive |
| Alarms | Delay | 0:15 | Paused time inside the timeframe before alerting |

Notes on the alarms:

- The break alarm measures *uninterrupted* tracking — pausing resets it.
- The start reminder only fires while paused, once per idle period, and never
  immediately after login: the delay is counted from the latest of the pause,
  the moment the extension was enabled, and the opening of the timeframe.
- *Not today* silences the start reminder until the next calendar day.

### Development

| Command | What it does |
|---|---|
| `make build` | Updates translations and packs `chronos@time-tracker.com.shell-extension.zip` |
| `make install` | `build` + `gnome-extensions install --force` |
| `make run` | `build` + `install` + nested Shell session for testing |
| `make launch` | Nested `gnome-shell --devkit` session only |
| `make reload` | Disable/enable the extension in the running Shell |
| `npm run typecheck` | `tsc --noEmit` against the GJS type stubs |

Source layout: `source/extension.js` (panel indicator, timing, notifications),
`source/prefs.js` (preferences pages), `source/components/` (reusable rows and
dialogs), `source/schemas/` (GSettings schema). See [AGENTS.md](AGENTS.md) for
architecture notes and [development.md](development.md) for build dependencies.

Translations live in `source/locale/<lang>/LC_MESSAGES/`. To add a language,
copy `source/chronos.pot`, translate it, and run `make build` to compile.

## Plans (ToDo)

### Changes

- flexible timer: no timer on pause, 1 min and 1 sec timer (depend on settings) - spare resources

### Extension

- truncate log to limit size
- alarm on particular tracked time
- pause on screen lock with delay time (like small breaks)
- auto restart: new day, new session (if possible)
