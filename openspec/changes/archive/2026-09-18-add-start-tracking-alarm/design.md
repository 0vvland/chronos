## Context

See proposal.md — Why. The relevant existing machinery:

- `Chronos._startTime` is the single source of pause state (`null` means paused); `isPaused` derives from it.
- A single 1-second `GLib.timeout_add` in `_init` already drives the label refresh and the break-alarm deadline check. The break alarm is one nullable field, `_breakDeadline`, holding an absolute unix timestamp.
- `disable()` → `onDestroy()` removes that timeout, so **no alarm can fire while the extension is disabled**, and the screen being locked disables the extension. Everything held in memory dies with it.
- The break alarm deliberately exploits that: its spec states it must not survive a disable/enable cycle in any form.
- `TimeRow` is an HH:MM spin-button row whose `value` is a number of seconds — it fits a time of day as directly as it fits a duration.
- `PostponeDialog(options, callback)` takes an array of durations in seconds and reports the chosen one; `formatPostponeTime` renders them readably.
- Preference keys use a sentinel value rather than a paired boolean to mean "off" (`pref-break-alarm-interval == 0`), with the prefs switch writing the sentinel and restoring the last chosen value.

## Goals / Non-Goals

**Goals:**

- Reuse the existing 1-second tick and the existing notification and postpone plumbing rather than introducing a second scheduler.
- Express the three cases the user raised — never started, paused mid-day, enabled mid-day — as one arithmetic rule with no branching on "kind of pause".
- Keep exactly one piece of new persisted state, and only because the requirement demands it.

**Non-Goals:**

- Any shared abstraction over "alarms". Two alarms with different lifetimes do not yet justify a base class; a premature one would have to reconcile their opposite persistence rules.
- Timeframes that cross midnight (night shifts). Out of scope — see Decisions.
- Detecting user idleness from input devices. The signal is the tracker's own pause state, nothing else.

## Decisions

### No coupling with the break alarm

The start alarm reads none of the break alarm's keys or fields, and the break alarm is not modified. A start notification arriving one delay after the user pauses in response to a break notification is the intended outcome: the two alarms bound opposite halves of a duty cycle (longest work stretch, longest idle stretch), and "your break is over" is the correct message at that moment.

*Alternatives considered:*

- **Grace period after a break notification.** Needs a `_lastBreakNotifiedAt` field that dies on lock, so the grace would apply inconsistently depending on whether the screen locked — an invisible, hard-to-explain difference.
- **Prefs-level validation tying the delay to the break interval.** Couples two independent keys and has no sensible meaning when the break alarm is off.
- **A configurable "break length" feeding a grace window.** A third duration for the user to tune, to solve a case the lock screen already solves.

The lock-screen behaviour is what makes plain independence safe: a genuine break — lunch, a meeting, a walk — locks the screen, the extension is disabled, and nothing fires. The alarm can only reach a user who is paused *and present at an unlocked session*, which is precisely the target. What remains is a defaults question, not an architectural one.

### One anchoring rule instead of two cases

```
deadline = max(pauseStart, enabledAt, timeframeOpenToday) + delay
```

- Already paused since yesterday → `timeframeOpenToday` wins → fires one delay after the timeframe opens.
- Paused at 12:30 inside an open timeframe → `pauseStart` wins → fires at 12:45.
- Unlocked at 10:00 while paused → `enabledAt` wins → fires at 10:15, never instantly.

`pauseStart` is a new in-memory field set alongside `_startTime = null` in `onPause`. It is not persisted and not reconstructed across a disable/enable cycle: `enabledAt` is in the `max` precisely so the unknown pause start cannot produce an immediate alert on unlock. `state-pause-start-time` is deliberately not reused — it means something else (inactive-time recovery) and is only written when `pref-pause-on-destroy` is false.

`onReset` does not touch `pauseStart`: resetting the counter is not starting the tracker, so an idle period continues across it.

### Deadline evaluated on the existing tick

A second nullable field, `_startDeadline`, checked in the same 1-second callback as `_breakDeadline`. Arming is lazy: rather than computing a deadline at each state transition, the tick evaluates whether the alarm is currently eligible (selected weekday, inside the timeframe, not dismissed today, tracker paused, not already fired this idle period) and compares the anchored deadline against now. This keeps the weekday/timeframe check honest across midnight, DST and suspend/resume without any explicit rescheduling logic, at a cost of a few comparisons per second.

A `_startAlarmFired` boolean, cleared in `onResume`, enforces "at most one notification per idle period". A postponement writes an explicit deadline that overrides the anchored one for the remainder of that idle period.

### Dismissal is persisted; postponement is not

| State | Lifetime | Where |
|---|---|---|
| Postponed-until | This idle period | In memory, dies with the extension |
| Dismissed-for-day | Rest of the local calendar day | `state-start-alarm-dismissed` in GSettings |

This asymmetry is required by the spec and is the right way round: the most likely event immediately after dismissing is a screen lock, so dismissal must outlive it; whereas on unlock the user is back at the machine and re-anchoring from `enabledAt` is both simpler and more correct than resurrecting a stale postponement.

Encoding: an `i` key holding `YYYYMMDD` in local time, `0` meaning never dismissed. Preferred over a raw timestamp because it is legible in `dconf` and compares by simple equality against today, with no timezone arithmetic. Crossing a timezone can cost or grant one spurious day of dismissal — accepted.

### Weekday encoding

`pref-start-alarm-days` is type `ai` holding `0 = Sunday … 6 = Saturday`, matching `Date.getDay()` — the codebase uses JS `Date` throughout (`logging()`) and introduces no `GLib.DateTime`. The rejected alternative, ISO `1 = Monday … 7 = Sunday` from `GLib.DateTime.get_day_of_week()`, would mean converting at every use. The encoding goes in the schema `<description>`, since an int array is otherwise unreadable in `dconf`. The picker renders Monday-first regardless, as GNOME does.

An **empty array means the alarm is off**, mirroring `pref-break-alarm-interval == 0`. The prefs switch is unbound, writing either an empty array or the last non-empty selection — the same pattern `AlarmsPage` already uses for the break alarm's interval.

### Timeframe as two times of day

`pref-start-alarm-from` and `pref-start-alarm-to` are `i` keys holding seconds since local midnight, bound to two `TimeRow`s with no modification to the component. A range with `to <= from` leaves the alarm inactive rather than wrapping past midnight; supporting a wrap would make "the rest of the day" for dismissal ambiguous and serves a case nobody has asked for. Defaults: 09:00–18:00, delay 900 seconds, days empty (off).

### New weekday picker component

Nothing in `source/components/` does multi-selection. A `Gtk.Box` of seven `Gtk.ToggleButton`s inside an `Adw.ActionRow`, exposing a `value` property carrying the int array, so `AlarmsPage` drives it the same way it drives `TimeRow`. `Gio.Settings.bind` does not handle array properties, so the row is wired by hand like the break-alarm switch already is.

### Notification

A separate `showStartNotification()` alongside `showNotification()` — three different actions and a different body make sharing a builder more tangle than saving. Actions: **Start** (calls `onResume`), **Postpone...** (opens `PostponeDialog`), **Not today** (writes the dismissal key). Postpone options `[300, 900, delay]`, deduped and sorted exactly as the break alarm does.

## Risks / Trade-offs

- **The rationale for independence rests on lock-on-break.** A user whose session never locks gets nagged after every deliberate pause → the per-idle-period fire-once rule, the postpone action and the daily dismissal are all there to bound the damage; the default delay of 15 minutes is the dial to turn if reports say otherwise.
- **Lazy evaluation on every tick reads several GSettings keys per second.** → GSettings reads are cached in-process; the break alarm already reads a key per notification. Cheap relative to the label refresh in the same callback.
- **DST and manual clock changes shift the timeframe boundaries mid-day.** → Deriving the boundaries from local time on each tick rather than precomputing an absolute deadline means the alarm simply follows the new wall clock. Worst case is one alarm firing up to an hour early or late on a DST boundary.
- **Suspend/resume without a lock** leaves the extension running with a deadline that may be long past → the timeframe check still applies, so it fires at most once, immediately, and only if still inside the timeframe.
- **Two alarms can notify within minutes of each other**, which reads as noisy even when each is individually correct. → Accepted deliberately; revisit only with real usage reports.
