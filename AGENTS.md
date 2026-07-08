# AGENTS.md — Chronos Time Tracker

GNOME Shell extension (uuid: `chronos@time-tracker.com`), GJS, targets Shell 45–49.

## Architecture

`extension.js` → `Chronos` (`PanelMenu.Button`) added to `Main.panel`. 1‑second `GLib.timeout_add` drives label refresh + periodic `storeCountedTime()`. State in GSettings (`state-tracked-time`, `state-paused`, `state-pause-start-time`).

`prefs.js` → `ChronosPreferences` fills 3 Adw pages (Time, Appearance, Behavior), each a `GObject.registerClass` subclass of `Adw.PreferencesPage`.

Reusable components in `source/components/`: `TimeRow` (HH:MM spin buttons), `ColorRow` (Gtk color picker), `PostponeDialog` (Shell modal dialog with activity list).

## GSettings Keys

| Key | Type | Default | Notes |
|---|---|---|---|
| `state-tracked-time` | int | 0 | Cumulative seconds |
| `state-pause-start-time` | uint | 0 | Timestamp for inactive time recovery |
| `state-paused` | bool | true | Current pause state |
| `pref-pause-on-destroy` | bool | true | Pause on lock/suspend |
| `pref-show-seconds` | bool | false | Show seconds in indicator |
| `pref-log-change-state` | bool | false | Log to ~/timeTrack.log |
| `pref-start-on-reset` | bool | false | Auto-start after reset |
| `pref-indicator-color` | string | `'rgb(51, 209, 122)'` | Active color |
| `pref-indicator-paused-color` | string | `'rgb(237, 51, 59)'` | Paused color |
| `pref-reset-time` | int | 0 | Reset target in seconds |

## Build Commands

| Command | What it runs |
|---|---|
| `make build` | update PO → compile schema → zip to `.shell-extension.zip` |
| `make install` | build + `gnome-extensions install --force` |
| `make run` | build + install + nested Shell via `dbus-run-session` |
| `make compile_schema` | `glib-compile-schemas source/schemas/` |
| `make launch` | `dbus-run-session -- gnome-shell --devkit` |

## Style Conventions

- **Strings:** single quotes
- **`this._` prefix** for private properties
- **`function` keyword** used only in one place: `const pad = function (num) {...}` inside `logging()`; everywhere else arrow functions

## Gotchas

1. **`_indicatorColors` rule:** `[0]=active, [1]=paused`. But the *menu* item gets the *opposite* color from the indicator label (`updateIndicatorStyle()` swaps them). If you change one color, check you're targeting the right slot.
2. **Time recovery on resume:** when `pref-pause-on-destroy=false`, the extension stores `state-pause-start-time` on destroy and recovers elapsed time on next init (extension.js:75–86). The stored time is used to backdate `_startTime`, then `storeCountedTime()` flushes the gap.
3. **`storeCountedTime()` flushing:** called from the 1‑second timeout but only writes to GSettings when elapsed ≥ 2 minutes. It also fires eagerly on pause/resume. `getTrackedTime()` computes display incrementally without flushing.
4. **Negative time:** `state-tracked-time` can go negative (the `-` prefix appears in the label). `TimeRow` hours spin goes down to -999 to support this.
5. **`Chronos` is paused when `_startTime === null`** (getter `isPaused`). Not a boolean flag — pauses set `_startTime = null`, resumes set it to `getUintTime()`.
6. **`onReset` behavior:** sets tracked time to `pref-reset-time` value, then if not paused (or `pref-start-on-reset` is true) also resets `_startTime` — meaning it starts counting from *now* on top of the reset value. If paused and `pref-start-on-reset=false`, it just sets the value without starting.
7. **`this?.destroy()`** on line 221 — optional chaining on `this` is suspicious but preserved from original code.
