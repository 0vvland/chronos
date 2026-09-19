## Context

See proposal.md — Why. The constraints that shape the approach:

- All three alarms are evaluated from a single one-second `GLib.timeout_add` in `Chronos._init` (`source/extension.js`). There is no scheduler; each alarm is an `if` in that tick.
- The quantity this alarm watches, `state-tracked-time`, is unlike the quantities the other two watch. It is not monotonic in wall time: it stands still while paused, and it is writable from four places — the Time preferences page binds a spin control straight to it, `onReset` overwrites it, the suspend-gap recovery at enable backdates it, and `storeCountedTime()` flushes it every two minutes.
- `storeCountedTime()` is the reason a naive "watch the GSettings key" approach fails. It changes the *stored* value on a schedule while leaving the *displayed* value untouched, so a `changed`-signal handler cannot distinguish the extension's own bookkeeping from a user edit.
- `getTrackedTime()` computes the raw second count and then discards it, returning a formatted `H:MM` string. Nothing in the codebase exposes the number.
- Existing conventions: `this._` private fields, in-memory `_*Fired` flags for once-only semantics, nullable `_*Deadline` fields for postponement overrides, `0`/`[]` sentinels for "alarm off".

## Goals / Non-Goals

**Goals:**

- Detect the crossing from the displayed tracked time, so the alarm is not quantised to the two-minute storage flush.
- Make immunity to discontinuous counter movement fall out of one rule rather than out of a special case per writer.
- Keep the change additive: no behavioural change to the break alarm, the start alarm, the indicator, the menu, or the stored state format.

**Non-Goals:**

- Unifying the three alarms behind a shared abstraction. The three do have one shape — a deadline expressed in the alarm's own measure, with postponement meaning `deadline += n` in that measure — but extracting it would mean rewriting two working, specified alarms for no behavioural gain. Recorded as an observation, deliberately not acted on.
- Multiple targets, or any "almost there" pre-warning.
- Auto-pausing the tracker when the target is reached. The notification informs; it does not act.
- Persisting the fired state across a disable/enable cycle. The re-synchronisation rule below reproduces the correct answer on enable without storing anything.

## Decisions

### Detect the crossing by comparing consecutive ticks, not by watching the settings key

Keep `_lastGoalTracked`, the tracked-seconds value seen on the previous tick. On each tick compute `step = tracked - _lastGoalTracked` and branch:

```
  step within [0, TICK_TOLERANCE]      -> a normal advance
      if _lastGoalTracked < target <= tracked and not _goalFired:
          fire

  otherwise (negative, or a large forward jump)
      -> a discontinuity: re-synchronise silently
          _goalFired    = tracked >= target
          _goalDeadline = null          (a jump ends any postponement)
```

Every writer of the counter is covered by the second branch without knowing it exists:

| Writer | Effect on displayed tracked time | Branch |
|---|---|---|
| the tick, while tracking | +1s | normal advance |
| `storeCountedTime()` flush | **none** — it moves `_startTime` by the same amount it adds | normal advance (step unchanged) |
| Time preferences spin control | arbitrary jump, either direction | discontinuity |
| `onReset` | jump to `pref-reset-time` | discontinuity |
| suspend-gap recovery at enable | large forward jump | discontinuity |
| pause / resume | none (counter stands still while paused) | normal advance, step 0 |

The flush being invisible to the rule is the point: the alarm reads the same value the indicator reads, so it is unaffected by when that value happens to be written down.

`onReset` needing no code is a consequence worth noting — the jump it causes re-arms the alarm for the next day by itself. Contrast `_startAlarmFired`, which has to be cleared by hand in `onResume`, `onReset` and the postpone callback.

**Alternatives considered.** (a) Hook `onChangeSettings` and re-synchronise there — fails on the two-minute flush, as above, which would silently swallow the alarm. (b) Compare the stored key rather than the displayed value — quantises the alarm to a two-minute grid and still cannot tell a flush from an edit. (c) Persist the fired flag in GSettings — needs explicit invalidation on every counter write, which is the problem the delta rule dissolves.

### `TICK_TOLERANCE`

A small constant, on the order of five seconds. The tick is registered at `GLib.PRIORITY_LOW` and coalesces under load, so a strict `step === 1` test would mistake ordinary jitter for an edit and silently disarm a legitimate alarm. Five seconds is far above tick jitter and far below any plausible manual edit, which moves the counter by minutes at least.

A machine that suspends without locking, while tracking, produces a large forward step and is therefore treated as a discontinuity. That is the desired reading: the user was not working, and the recovered time should not raise a "you have worked eight hours" notification.

### Two GSettings keys, an explicit boolean for the off switch

- `pref-goal-alarm-enabled` (`b`, default `false`)
- `pref-goal-alarm-time` (`i`, default `28800` — eight hours)

The other two alarms encode "off" in the value (`0`, `[]`) and their preferences switch writes the sentinel. That is unavailable here: `0:00` is a legitimate target, meaning "time debt worked off", and so is any negative target. Using a sentinel would carve a hole in the middle of the useful range.

The boolean also removes the machinery the other two groups need — `this._breakInterval` and `this._startDays` exist only to remember the user's value across a trip through the sentinel. `pref-goal-alarm-time` can bind straight to a `TimeRow` with `Gio.SettingsBindFlags.DEFAULT`, and the switch binds straight to `pref-goal-alarm-enabled`; only row visibility needs wiring by hand.

**Trade-off:** three alarms, two conventions. The inconsistency is real; it buys a target range with no reserved values.

### Postponement is an override target in counter units

Follow the `_startDeadline` pattern: `_goalDeadline`, null unless postponed. When set it replaces the configured target in the rule above. Postponing sets it to `tracked + n` and clears `_goalFired`; firing clears it back to null, so the configured target governs any later re-arm.

Because it lives on the counter's scale rather than the wall clock, paused time does not consume it — which is the whole reason it is a separate mechanism rather than the `getUintTime() + selected` the other two use.

Offered durations: a fixed ascending list of 5, 15 and 30 minutes. The other two alarms append their own configured interval to the list; here the configured value is an absolute target, not a duration, so there is nothing to append.

`PostponeDialog` already takes a list of seconds and hands back a choice, making no assumption about the unit — it needs no change to serve a counter-based deadline. Its heading reads "Select Duration", which is ambiguous between the two units; an optional heading parameter, defaulted to the present text, keeps the existing callers untouched.

### Extract `getTrackedSeconds()`

`getTrackedTime()` splits into a raw accessor returning `state-tracked-time` plus any un-flushed elapsed time, and the existing formatter built on top of it. The alarm reads the accessor. This is a prerequisite, not a cleanup: no correct formulation of the rule can work from a formatted string.

### Where the alarm state lives

`_goalFired`, `_goalDeadline` and `_lastGoalTracked` are in-memory only, matching `_startAlarmFired` and `_breakDeadline`. `_lastGoalTracked` is seeded at the end of `_init`, after the suspend-gap recovery has run, so the first tick sees a step of roughly zero rather than a jump from nothing. `_goalFired` is seeded the same way the discontinuity branch seeds it: `tracked >= target`.

That seeding is what makes the fired state survive a lock without being persisted: after an unlock with the counter still above the target, the alarm starts out already fired, so nothing is raised. The start alarm needs `state-start-alarm-dismissed` in GSettings for the equivalent guarantee because its condition — "the user said not today" — cannot be recomputed from anything observable. This alarm's condition can be.

## Risks / Trade-offs

- **A slow or blocked tick could be mistaken for an edit** → `TICK_TOLERANCE` is set well above realistic jitter; the failure mode when it is exceeded is a silently missed notification, not a spurious one.
- **Two conventions for "alarm off" across three alarms** → accepted deliberately; documented in the GSettings table in `AGENTS.md` alongside the keys.
- **A postponement is lost on screen lock** → matches the start alarm's behaviour and is specified; the alternative is persisting a counter-scale deadline, which is more state than the feature is worth.
- **A target below the reset time is silently inert** → configuring, say, a target of 6:00 with a reset time of 9:00 means the alarm re-synchronises to "already fired" on every restart and never notifies. This is the rule behaving correctly rather than a fault, but it is not signalled in the preferences. The Alarms page already carries a precedent for a warning row (the start alarm's "To must be later than From"); adding one here is possible but not proposed.
- **`PostponeDialog`'s heading is not run through `gettext`** → a pre-existing gap the new heading parameter inherits. Not in scope; noted so it is not mistaken for something this change introduced.
