## Why

The previous change stood the one-second tick down whenever nothing depended on it, but left untouched what the tick does while it is up. Each pass currently reads the clock five times and builds up to three separate `Date` objects, so within a single tick the indicator, the goal alarm and the start alarm can each be working from a different "now". It also re-reads the same GSettings keys two and three times per pass — up to fourteen reads a second while paused inside a start-alarm window — and repaints a label that, with seconds hidden, changes once a minute.

None of this produces a bug a user would report. It produces a tick in which "the tracked counter" and "today" are not single well-defined values, which is the kind of looseness that makes the next change to the alarm logic subtly wrong. The same pass over the file turns up a handful of dead branches and duplicated blocks worth clearing while the area is open.

## What Changes

**One tick, one instant.** The tick computes the current moment once and threads it through every consumer, rather than letting each method fall back to a `Date` of its own:

- `onTick()` derives a single reading — one `Date`, one whole-second timestamp, one tracked-seconds value, one answer to the day-level start-alarm question — and passes it to the indicator refresh, the break deadline check, the start alarm, the goal alarm and `needsTick()`.
- The `date = new Date()` default parameter is removed from `getLocalDay`, `isStartAlarmConfiguredToday`, `isStartAlarmEligible` and `getStartDeadline`. That default is what let `needsTick()` silently construct a second instant.
- `isStartAlarmEligible()` tests `isPaused` before the four settings reads that `isStartAlarmConfiguredToday()` performs, so a counting tracker stops paying for a question a boolean already answered.
- `isStartAlarmConfiguredToday()` is evaluated once per tick. `isStartAlarmEligible()` deliberately is **not** hoisted: the start alarm sets `_startAlarmFired` mid-tick and the second answer is required to differ — that flip is what stands the tick down.
- `getTrackedSeconds()` is evaluated once per tick instead of twice, so the goal alarm can no longer act on a value the indicator never displayed.

**Cheaper periodic work.**

- The one-second source moves from `GLib.timeout_add` to `GLib.timeout_add_seconds`, letting the kernel coalesce the wakeup with other second-aligned timers. The sixty-second poll already uses it.
- The indicator is not repainted when the rendered text is unchanged, which with seconds hidden is fifty-nine passes in sixty.

**Cleanups, no behaviour change.**

- `logging()` replaces roughly fourteen lines of hand-rolled local-offset ISO 8601 with `GLib.DateTime.new_now_local().format(...)`. The output must stay byte-for-byte identical; `format_iso8601()` does **not** qualify and is not used. This also removes the codebase's only `function` keyword, the single style exception `AGENTS.md` documents.
- The three `show*Notification` methods share one helper for building and posting the notification. Their state machines are left alone — they genuinely differ, and only the rendering is common.
- The duplicated postpone-option dedupe becomes `[...new Set(options)].sort(...)`.
- `getTrackedTime()` drops two no-op guards that subtract zero and uses `%` for the minutes and seconds split.
- Dead code removed: `=== true` on a boolean, and the `this._label.get_parent` guard that tests whether the method exists rather than calling it.

No preference, GSettings key, or user-visible string is added, removed or changed.

## Capabilities

### New Capabilities

None. The change adds no new area of behaviour.

### Modified Capabilities

- `tick-scheduling`: gains requirements that a single pass of periodic work observes a single instant, that the wakeup may be coalesced with other system timers provided no outcome moves, and that the indicator is not repainted when its text is unchanged.

The log entry format is a hard constraint of this change rather than a new requirement: the format is being deliberately preserved, so no spec changes. It is pinned in `design.md` and verified in `tasks.md`.

The `start-alarm`, `break-alarm` and `goal-alarm` capabilities are untouched. Every alarm must fire at exactly the moment it fires today; the reordering and hoisting described above are implementation detail beneath their existing requirements.

## Impact

**Code**

- `source/extension.js` — the bulk of the change: `onTick`, `needsTick`, `_ensureTick`, `isStartAlarmConfiguredToday`, `isStartAlarmEligible`, `getStartDeadline`, `getLocalDay`, `getTrackedSeconds`, `getTrackedTime`, `checkGoalAlarm`, `refreshIndicatorLabel`, `logging`, and the three `show*Notification` methods.
- `source/components/PostponeDialog.js` — unchanged; the dedupe lives at the call sites.
- `AGENTS.md` — the Style Conventions note about the lone `function` keyword becomes false once `logging()` is rewritten, and the Gotchas list is worth a line about the tick instant.

**Risk**

- The `_startAlarmFired` mid-tick flip is the one place where reusing a value would break the stand-down introduced by the previous change. It is called out in the design and given its own task.
- `timeout_add_seconds` may snap the wakeup to the second boundary, so with seconds shown a displayed second could repeat or be skipped at the moment of coalescing. The tracked total is derived from the clock, never from a tick count, so no time is lost either way.
- Changing `logging()` writes to a file the user keeps. Byte-for-byte equality is a release blocker, not a nicety.

**Not affected**

No dependency, build step, schema or translated string changes. `source/prefs.js` runs in its own process and is out of scope.
