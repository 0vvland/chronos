## Context

See proposal.md for the motivation. Constraints that shape the approach:

- `metadata.json` declares no `session-modes`, so the Shell disables the extension on lock and enables it on unlock. `Chronos._init` therefore runs on every boot, login, unlock and re-enable. A day check in `_init` covers "first start of a new day" in all of those cases.
- An idle tracker has no timer at all (tick-scheduling spec). A paused tracker with no start alarm runs nothing, so midnight needs a trigger of its own.
- `_init` already has a recovery path. With `state-paused == false` and a stored `state-pause-start-time`, it backdates `_startTime` and flushes the gap through `storeCountedTime()`. The reset has to be ordered against it.
- `logging(event)` formats a *live* `getTrackedTime()`, which is the stored value plus `now - _startTime`.
- `checkGoalAlarm()` already re-synchronises silently on any jump larger than `TICK_TOLERANCE`, so a reset never raises the goal notification.

## Goals / Non-Goals

**Goals:**
- One rollover routine, shared by the init path, the midnight timer and the tick.
- A correct day split for a counting tracker, whether the extension was running or disabled at midnight.

**Non-Goals:**
- A configurable rollover hour. Midnight in the system time zone is fixed.
- Detecting suspend directly (logind `PrepareForSleep`). Lock-on-suspend plus the init check covers it.
- Changing the manual Restart (`onReset()`).

## Decisions

### D1. One key: `state-daily-reset-day` (int, `YYYYMMDD`, `0` = off)

This is the user's choice. The value is maintained by the extension (rewritten on every rollover), so it takes the `state-` prefix, the same as `state-start-alarm-dismissed`, which uses the same `YYYYMMDD` encoding through `getLocalDay()`. The prefs switch reads `!= 0` as on.

- Switching on writes today's day from prefs. That one line duplicates the `getLocalDay()` formula in prefs.js, because prefs cannot import from extension.js.
- The extension writes the key only during a rollover, and only while it is non-zero. Off stays off.
- *Alternative considered:* `pref-daily-reset` bool plus a state key stamped on every enable. It is cleaner by convention, but the user picked the single key.

### D2. The prefs switch is not bound through `bindSentinelSwitch()`

The helper exists to remember a user-chosen live value behind a value row. Here there is no value row, and the "on" value is always today, never something remembered. The row is a plain `Adw.SwitchRow` with two handlers:

- seed `active = read() !== 0`
- on `notify::active`, write `today` or `0`

AGENTS.md gets a note so a later reader does not "fix" this into the helper.

### D3. `rollover(instant)`: one routine, three callers

```
rollover(instant):
  if stamp == 0 or stamp == getLocalDay(instant.date): return
  midnight = local 00:00 of instant.date, as uint seconds
  if counting:
     split = max(midnight, _startTime)       <-- never flush backwards
     storeCountedTime(split)                 <-- _startTime = split
  logging('auto reset', getTrackedSeconds(split))   <-- closing total, see D5
  state-tracked-time = pref-reset-time
  state-daily-reset-day = getLocalDay(instant.date)
  refresh label
```

Callers:

```
 _init  ----------------> after recovery, before goal seeding (D4)
 midnight timeout ------> takes its own instant (D6)
 onTick ----------------> top of the pass, from the pass's instant (D7)
```

- `midnight` comes from `new Date(y, m, d)` of the instant's date, so DST days are handled by the platform.
- The clamp `max(midnight, _startTime)` covers a tracker started after midnight on a stale stamp (e.g. a missed timer). Without it, `storeCountedTime()` would subtract.
- The running state is untouched. `_startTime == split` keeps counting into the new day. A paused tracker stays paused, and `pref-start-on-reset` is not consulted.
- `_breakDeadline` and the start-alarm fields are untouched. The break alarm measures a stretch, not a day, and the start-alarm dismissal is already per day.

### D4. Init ordering: inside recovery, between backdating and flushing

```
truncateLog
state-paused == false?
  |-- stored start --> _startTime = storedStartTime   (backdate to destroy time)
  |                    rollover(instant)              <-- NEW: flush to 00:00, reset
  |                    storeCountedTime()             (flush 00:00 -> now into new day)
  |                    log 'collect inactive time', beginWorkingStretch()
  |-- else ----------> onResume()
  `-- (paused)
rollover(instant)        <-- no-op if the branch above already ran it
_lastGoalTracked / _goalFired seeding   (sees the post-reset value)
_ensureTick, arm midnight timer, refresh label
```

- In the recovery branch, the rollover has to see the backdated `_startTime` *before* the flush. After the flush `_startTime == now`, the clamp gives `split = now`, and the stretch after midnight would be discarded together with the old day.
- In every other branch `_startTime` is null or `now`, so one call after the branch gives the right result. Because the call returns early once the stamp equals today, calling it in both places is safe.

### D5. `logging(event, trackedSeconds?)`

An optional second argument, passed to `getTrackedTime(trackedSeconds)`. Without it, an `auto reset` logged after the flush at 08:00 would report the midnight total plus eight hours. Existing callers are unchanged.

### D6. Midnight: one-shot `GLib.timeout_add_seconds`, re-armed from its own callback

- Armed while the stamp is non-zero: in `_init`, and from `onChangeSettings()` when the key goes from 0 to non-zero. Removed when the key goes to 0, and in `destroy()` (gotcha 7).
- Interval = `ceil((nextLocalMidnight - now) / 1000)`, where the next midnight comes from `new Date(y, m, d + 1)`.
- The callback takes its own instant, calls `rollover()` (which re-derives the day and does not trust the armed moment), clears `_midnightTimeout`, arms the next one, and returns `SOURCE_REMOVE`.
- Priority comes first: `(GLib.PRIORITY_LOW, seconds, cb)` (gotcha 9).
- *Alternative:* `GnomeDesktop.WallClock` follows wall time and time zones, but it fires every minute, which is periodic work the tick-scheduling spec forbids. *Alternative:* a 60-second poll, rejected for the same reason.

### D7. The tick checks the day too

`onTick()` calls `rollover(instant)` before refreshing the label. The cost is one cached-int compare plus `getLocalDay()` per second, and only while the tick runs anyway. It covers the one case D6 misses: suspend with lock-on-suspend off while counting, where the monotonic timer fires late by the length of the suspend. The tick resumes immediately after wake.

The stamp read by the tick is cached on `this` in `readCachedSettings()` (gotcha 10), refreshed from the `changed` signal. The extension's own write of the stamp re-enters `onChangeSettings()`; that is harmless and idempotent, and it also keeps the midnight timer armed.

## Risks / Trade-offs

- [Suspend across midnight with lock-on-suspend off, while paused] → The label shows yesterday's total until the late timer fires. It is accepted because it is rare and only cosmetic: the reset still lands on the correct day boundary when it runs.
- [The time zone changes while running] → JS `Date` follows the process TZ. The start alarm already makes this assumption. The armed interval may be off by the offset, but the callback re-derives the day, so at worst the reset is late, never on the wrong day.
- [Working past midnight] → The counter resets under a counting tracker at 00:00. That is the requested behaviour, and the closing total is preserved in the log.
- [Two writers of `state-tracked-time` at midnight (prefs open)] → No new risk. Prefs already writes the counter behind the extension's back.
- [The clock goes backwards] → Treated as a new day (the user accepted this).

## Migration Plan

A new key with a default of `0`, so upgrades start with the option off. No migration is needed. Rollback: older builds ignore the unknown key.
