# AGENTS.md — Chronos Time Tracker

GNOME Shell extension (uuid: `chronos@time-tracker.com`), GJS, targets Shell 45–50.

## Architecture

`extension.js` → `Chronos` (`PanelMenu.Button`) added to `Main.panel`. 1‑second `GLib.timeout_add_seconds` drives label refresh + periodic `storeCountedTime()`. State in GSettings (`state-tracked-time`, `state-paused`, `state-pause-start-time`).

`prefs.js` → `ChronosPreferences` fills 3 Adw pages (Time, Appearance, Behavior), each a `GObject.registerClass` subclass of `Adw.PreferencesPage`.

The About page carries a *What's New* changelog between the logo and the
description, rendered from the `CHANGELOG` thunk near the top of `prefs.js` into
one markup label inside a bounded `Gtk.ScrolledWindow`. **A version bump means
prepending a release record** — newest first, each change its own `_()` literal
so `xgettext` extracts it — and published entries are never rewritten. Version
headings are formatted from the integer, so no version number ever becomes a
translatable message.

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
| `pref-log-max-lines` | int | 0 | Lines kept in the log file, trimmed at enable; 0 = off |
| `pref-start-on-reset` | bool | false | Auto-start after reset |
| `pref-indicator-color` | string | `'rgb(51, 209, 122)'` | Active color |
| `pref-indicator-paused-color` | string | `'rgb(237, 51, 59)'` | Paused color |
| `pref-reset-time` | int | 0 | Reset target in seconds |
| `pref-break-alarm-interval` | int | 0 | Tracking seconds before break alarm; 0 = off |
| `pref-start-alarm-days` | int array | `[]` | Start alarm weekdays, `0 = Sunday … 6 = Saturday`; empty = off |
| `pref-start-alarm-from` | int | 32400 | Timeframe opening, seconds since local midnight |
| `pref-start-alarm-to` | int | 64800 | Timeframe closing; `<= from` = inactive |
| `pref-start-alarm-delay` | int | 900 | Paused seconds inside timeframe before alerting |
| `state-start-alarm-dismissed` | int | 0 | Local day dismissed for, `YYYYMMDD`; 0 = never |
| `pref-goal-alarm-enabled` | bool | false | Goal alarm on/off — an explicit flag, not a sentinel |
| `pref-goal-alarm-time` | int | 28800 | Tracked-time target in seconds; 0 and negative are valid targets |

The goal alarm deliberately departs from the `0`/`[]` "off" sentinel the break
and start alarms use: every target value — including `0:00` and negative ones —
has to stay usable, so the off switch gets its own boolean key.

## Build Commands

| Command | What it runs |
|---|---|
| `make build` | update PO → zip to `.shell-extension.zip` |
| `make install` | build + `gnome-extensions install --force` |
| `make run` | build + install + nested Shell via `dbus-run-session` |
| `make launch` | `dbus-run-session -- gnome-shell --devkit` |

Schemas are not compiled by the build: `gnome-extensions install` compiles them
on install (Shell 50).

## Automated Testing

There is no unit-test suite — the indicator only exists inside a running Shell.
Behaviour is verified by driving it in a **throwaway nested Shell**, which is
scriptable end to end and needs no display of its own. The recipe below works;
the notes after it are the parts that silently don't.

**Splice a driver into `enable()`** in a *copy* of the extension, rather than
trying to poke the live one from outside:

```bash
TH=/tmp/chronos-testhome                     # isolated HOME: own dconf, own
D=$TH/.local/share/gnome-shell/extensions    # ~/timeTrack.log, own extensions
mkdir -p "$D" && cp -r ~/.local/share/gnome-shell/extensions/chronos@* "$D/"
# append a runTestDriver(ind) to $D/chronos@*/extension.js, and call it from
# enable(), right after Main.panel.addToStatusArea(...)
HOME=$TH GSETTINGS_BACKEND=keyfile MUTTER_DEBUG_DUMMY_MODE_SPECS=1280x720 \
  dbus-run-session -- gnome-shell --devkit --wayland &> /tmp/shell.log
```

The driver gets the indicator handed to it, logs with a greppable prefix
(`log('CHRONOSTEST ...')`), and the results are read back out of `/tmp/shell.log`.

- **`Shell.Eval` is refused** — `global.context.unsafe_mode` is `false` and
  there is no way to flip it from outside. Driving the extension over D-Bus is
  a dead end; splice the driver in instead.
- **`GSETTINGS_BACKEND=keyfile` is required.** Under an isolated `HOME` the
  dconf writes appear to succeed and then silently revert a moment later, so
  every setting reads back as its default and every assertion fails for the
  wrong reason.
- **GSettings writes land asynchronously.** A step that reads back a value it
  just wrote must run in a later turn — structure the driver as timed steps
  (~400ms apart), never as one straight-line function. Two keys written
  together can also land at different moments, which briefly yields states
  neither value alone describes.
- **Sources remove themselves from their own callback**, so a tick or poll
  armed by one scenario is still live in the next. Clear `_timeout` and
  `_pollTimeout` explicitly between scenarios or results leak forwards.
- **To count real repaints, wrap `_label.set_text`** — not
  `refreshIndicatorLabel()`, which is where the "did the text change" gate
  lives, so wrapping it counts calls rather than paints.
- **Assertions must allow for time passing.** A restart or an edit checked a
  beat later legitimately reads a second or two high, because the tracker is
  still counting. Pause first when an exact value is wanted.

**Behaviour-neutral changes are checked by diffing against the previous build**,
not by eyeballing: `git stash`, `make install`, run the same driver, `git stash
pop`, and diff the two logs with timestamps normalised. This is what makes a
"no user-visible change" claim worth anything — and it is how the `logging()`
rewrite and the teardown findings were settled.

## Style Conventions

- **Strings:** single quotes
- **`this._` prefix** for private properties
- **Arrow functions** throughout; the `function` keyword is not used anywhere

## Gotchas

1. **`_indicatorColors` rule:** `[0]=active, [1]=paused`. But the *menu* item gets the *opposite* color from the indicator label (`updateIndicatorStyle()` swaps them). If you change one color, check you're targeting the right slot.
2. **Time recovery on resume:** when `pref-pause-on-destroy=false`, the extension stores `state-pause-start-time` on destroy and recovers elapsed time on next init (extension.js:75–86). The stored time is used to backdate `_startTime`, then `storeCountedTime()` flushes the gap.
3. **`storeCountedTime()` flushing:** called from the 1‑second timeout but only writes to GSettings when elapsed ≥ 2 minutes. It also fires eagerly on pause/resume. `getTrackedTime()` computes display incrementally without flushing.
4. **Negative time:** `state-tracked-time` can go negative (the `-` prefix appears in the label). `TimeRow` hours spin goes down to -999 to support this.
5. **`Chronos` is paused when `_startTime === null`** (getter `isPaused`). Not a boolean flag — pauses set `_startTime = null`, resumes set it to `getUintTime()`.
6. **`onReset` behavior:** sets tracked time to `pref-reset-time` value, then if not paused (or `pref-start-on-reset` is true) also resets `_startTime` — meaning it starts counting from *now* on top of the reset value. If paused and `pref-start-on-reset=false`, it just sets the value without starting.
7. **Teardown split:** `onDestroy()` releases everything the indicator owns (timeout source, `changed` signal, log stream) and `disable()` then calls `destroy()` on the actor. Anything created in `_init` needs a matching release in `onDestroy` — the EGO linter (EGO-L-002/003/004) checks for it.
8. **One pass, one instant.** `onTick()` opens with `takeInstant()` and threads that record (`date`, `uintTime`, `trackedSeconds`, `configuredToday`) through everything it calls, so a pass reads the clock exactly once. The date methods — `getLocalDay`, `isStartAlarmConfiguredToday`, `isStartAlarmEligible`, `getStartDeadline` — deliberately have **no `date = new Date()` default**: that default is what previously let `needsTick()` construct a second, later instant thirteen lines after the first. A caller outside a pass (a notification action, the poll) builds its own instant. The record is a local value that dies with the pass — never store it or anything derived from it on `this`.
   - **`isStartAlarmEligible()` is exempt from the hoisting half of that rule.** It folds in `_startAlarmFired`, which the pass itself flips when the alarm fires, and the second answer is *required* to differ — that flip is what stands the tick down. It must be asked again at the tail of the pass, from the pass's instant. Hoisting it is silent: everything keeps working and the machine simply never sleeps. Its day-level half, `isStartAlarmConfiguredToday()`, folds in nothing the pass can change and *is* memoised on the record — as a thunk, so a counting tracker never pays its four GSettings reads.
9. **`GLib.timeout_add*` takes `(priority, interval)`, in that order.** Reversing them is silent, because `GLib.PRIORITY_LOW` is `300` and reads as a plausible millisecond interval: the tick once ran at 300 ms instead of 1 s, and the "60-second" poll at 300 s.
