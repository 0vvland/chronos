## Context

See `proposal.md` — Why. The relevant current state is the shape of `onTick()` in `source/extension.js`.

A pass currently reads the clock at six points. Two of them allocate a `Date`:

```
onTick()
  |
  +-- refreshIndicatorLabel -> getTrackedSeconds -> Date.now()      [1]
  +-- line 165  getUintTime()                                       [2]
  +-- line 170  getUintTime()                                       [3]
  +-- line 175  const now = new Date()                              [4]  <- shared
  |     +-- isStartAlarmEligible(now)   ... uses [4]
  |     +-- getStartDeadline(now)       ... uses [4]
  +-- checkGoalAlarm -> getTrackedSeconds -> Date.now()             [5]
  +-- needsTick() -> isStartAlarmEligible() -> new Date()           [6]  <- fresh
```

Four methods carry a `date = new Date()` default parameter: `getLocalDay`, `isStartAlarmConfiguredToday`, `isStartAlarmEligible`, `getStartDeadline`. The tick passes `now` to two of them. `needsTick()` takes no date and so triggers the default, producing instant `[6]` — a different moment from `[4]`, thirteen lines earlier. The default reads as a convenience; it is in fact the only reason a second instant can exist.

GSettings reads per pass, counted by scenario:

```
                       | tracking | tracking   | PAUSED inside
                       | no alarms| + start al.| start window
  ---------------------+----------+------------+---------------
  indicator refresh    |    2     |     2      |      2
  start-alarm eligible |    1     |     4      |      4
  start deadline       |    0     |     0      |      2
  goal alarm           |    2     |     2      |      2
  needsTick() tail     |    0     |     0      |      4
  ---------------------+----------+------------+---------------
  total per second     |    5     |     8      |     14
```

A hard constraint from the previous change (`flexible-timer-ticks`) still binds: settings are re-derived from GSettings on every pass, never cached across passes, because `needsTick()` must ask the start alarm with the very expression that fires it or the two drift. This design does not touch that.

## Goals / Non-Goals

**Goals:**

- One pass observes one instant, with the single exception that state the pass itself changes is re-observed.
- Remove per-pass duplicate GSettings reads and allocations without introducing any value that survives a pass.
- Clear the dead branches and duplicated blocks in the same file while it is open.
- Preserve the log file format exactly.

**Non-Goals:**

- **No cross-pass caching of settings.** Explicitly rejected. The drift-proofness of `needsTick()` is worth more than the remaining four reads per second.
- **No unification of the three alarm state machines.** Only their notification rendering is shared. Break encodes "fired" as a null deadline while start and goal use explicit flags, and the goal deadline lives on the counter's scale rather than the clock's. They rhyme; they are not the same.
- **No change to `source/prefs.js`.** It runs in a separate process and is built once on demand.
- No new preference, GSettings key, dependency or translated string.

## Decisions

### Decision: A per-pass instant record, built once at the top of the pass

`onTick()` opens by building one plain object holding everything time-derived that the pass needs, and passes it down. Shape (names indicative, not binding):

```
{ date, uintTime, trackedSeconds, configuredToday }
```

- `date` — the single `Date`, replacing instants [4] and [6].
- `uintTime` — `getUintTime(date.getTime())`, replacing [2] and [3].
- `trackedSeconds` — one `getTrackedSeconds()` evaluation, replacing [1] and [5]. This is what makes the indicator and the goal alarm agree.
- `configuredToday` — one `isStartAlarmConfiguredToday(date)` evaluation, the four-read day-level question.

*Alternative considered: memoising each getter on `this` with a generation counter.* Rejected — it makes per-pass state indistinguishable from the long-lived `_startTime` / `_goalFired` fields, which is exactly the confusion this change exists to remove. A record that is born and dies inside the pass cannot be mistaken for durable state.

*Alternative considered: keeping the `date = new Date()` defaults and merely passing `now` everywhere.* Rejected — the defaults would still be there for the next caller to forget, which is how `needsTick()` acquired instant [6] in the first place. Removing them makes the instant a required argument, so the mistake becomes a runtime error rather than a silent second clock read.

### Decision: `isStartAlarmEligible` is re-evaluated, `isStartAlarmConfiguredToday` is not

This is the trap in the change and the reason the two halves stay separate methods.

```
  onTick
    |
    +-- eligible? ---- yes ----> raise alarm; _startAlarmFired = true
    |                                              |
    |                                              v
    +-- needsTick -> eligible? -- must now say NO --+
                                  (this flip is what stands the tick down)
```

`isStartAlarmEligible()` folds in `_startAlarmFired` and `isPaused`, both of which the pass can change. Hoisting its result would keep the tick armed forever after the alarm fires, silently undoing `flexible-timer-ticks`. It is re-evaluated, from the pass's instant.

`isStartAlarmConfiguredToday()` folds in only the weekday, the dismissal day and the timeframe bounds. Nothing in the pass body writes those — the "Not today" dismissal is a notification action, which runs outside the pass. It is therefore safe to evaluate once and carry on the record, which is where the four saved reads come from.

### Decision: `isPaused` is tested before the day-level settings reads

`isStartAlarmEligible()` currently calls `isStartAlarmConfiguredToday()` first and only then checks `!this.isPaused`. While the tracker is counting — the common case — that spends four GSettings reads per second reaching a conclusion a field access already determined. Reordering is behaviour-neutral: both terms are required, and neither has a side effect.

### Decision: `GLib.DateTime.format('%Y-%m-%dT%H:%M:%S%:z')`, not `format_iso8601()`

Verified against the current hand-rolled output on this machine:

```
  format_iso8601()                ->  2026-09-19T10:40:28.412195+03
  format('%Y-%m-%dT%H:%M:%S%:z')  ->  2026-09-19T10:40:37+03:00
  hand-rolled (current)           ->  2026-09-19T10:40:37+03:00
```

`format_iso8601()` is wrong twice over: it appends microseconds and renders the offset as `+03` rather than `+03:00`. Only the explicit format string matches. `%:z` also renders half-hour and three-quarter-hour zones (`+05:30`, `+05:45`) the same way the hand-rolled arithmetic does.

This removes the codebase's only `function` keyword — the lone exception `AGENTS.md` documents under Style Conventions — so that note is deleted rather than updated.

*Alternative considered: leaving `logging()` alone.* Reasonable, and the fallback if the byte-for-byte check fails on any reviewer's machine. The fourteen lines are correct today; the argument for changing them is that they are fourteen lines of date arithmetic a platform call already performs, plus the style exception they force.

### Decision: share notification rendering, not alarm state

One helper builds the source, the `Notification` with the shared title and icon, attaches the caller's actions, and posts it. The three call sites keep their own bodies, their own action sets, and their own postpone semantics — including the goal alarm's, which is measured in tracked seconds rather than wall-clock seconds and must stay that way.

The duplicated `[a, b, c].filter((s, i, a) => a.indexOf(s) === i).sort(...)` becomes `[...new Set(options)].sort(...)` at both sites. The complexity change is irrelevant at n=3; this is purely about the block being read twice.

### Decision: gate the repaint on the rendered string

The indicator holds the last string it rendered and skips the repaint when the new one matches. This is preferred over gating on `seconds % 60` because it is correct regardless of which preference is set, survives a tracked-time edit landing mid-minute, and needs no knowledge of what makes the text change. `updateIndicatorStyle()` and the pause/resume paths are untouched, so state changes still repaint immediately.

### Decision: `timeout_add_seconds` for the one-second source

Matches the sixty-second poll, which already uses it, and matches the power argument `flexible-timer-ticks` was built on. Tracked time is computed from the clock rather than by counting passes, so a snapped wakeup cannot cost or invent time.

## Risks / Trade-offs

**Hoisting `isStartAlarmEligible` by mistake → the tick never stands down.** The single highest-value failure mode, and a silent one: everything keeps working, the machine just never sleeps. Mitigated by keeping the two predicates as separate methods with the split documented at both, and by a dedicated task that exercises the stand-down after the alarm fires.

**The log format check is done on one machine, in one timezone.** `%:z` and the hand-rolled arithmetic could in principle disagree at a non-hour offset or across a DST boundary. Mitigated by verifying at a half-hour offset (`TZ=Asia/Kolkata`) and on both sides of a DST transition before the change lands. If any mismatch appears, this cleanup is dropped and `logging()` stays as it is — the rest of the change does not depend on it.

**A displayed second repeats or is skipped under coalescing.** Accepted, and specified. The total stays exact. Only visible with seconds enabled, and only at the moment the kernel batches the wakeup.

**The instant record is one more thing to thread through.** Every consumer gains a parameter. The compensation is that the four `= new Date()` defaults disappear, so the net count of ways to obtain "now" inside a pass goes from several to one.

**Reviewing behaviour-neutrality across many small edits.** The dead-code and arithmetic cleanups are individually trivial and collectively easy to wave through. Mitigated by keeping them as separate commits from the tick-instant work, so the behavioural change can be reviewed on its own.

## Migration Plan

No data migration, no schema change, no rollback concern beyond reverting the commits. The log file is appended to in the same format, so files written before and after are continuous.

Landing order: the cleanups first, since they are independent and shrink the diff the tick-instant change has to be read against; then the tick instant; then `timeout_add_seconds` and the repaint gate, which are one-liners on top of the new shape. `AGENTS.md` is updated in the same change as the code that makes its notes false.
