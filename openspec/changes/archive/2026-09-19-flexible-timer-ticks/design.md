## Context

See proposal.md — Why.

`Chronos._init` registers one `GLib.timeout_add(1000, ...)` that lives for the
whole enabled lifetime of the extension and drives five consumers: the
two-minute flush to `state-tracked-time`, the indicator label, the break alarm,
the start alarm, and the goal alarm.

Three properties of the existing code shape the approach:

- **The eligibility predicate already exists.** `isStartAlarmEligible(date)`
  (extension.js:167) already returns false unless the alarm is configured for
  today, the tracker is paused, the alarm has not fired this paused period, it
  has not been dismissed today, the timeframe is valid, and the current time of
  day is inside it. That is exactly the "a start alarm could fire right now"
  condition the spec names. It takes no new logic, only a second caller.

- **The tick is a wall-clock re-derivation loop, not a countdown.** Every
  consumer recomputes from `Date.now()` or `new Date()` on each pass. Nothing
  accumulates across ticks and nothing holds a monotonic deadline for a
  wall-clock event. That is why the current code survives suspend, timezone
  changes and DST transitions, and it is the property most easily lost here.

- **`_startTime === null` is the pause flag.** Consumers that assume a non-null
  start time are safe today only because the tick never runs while paused —
  which this change makes false.

## Goals / Non-Goals

**Goals:**

- One predicate decides whether the second-by-second source exists, derived
  from state the code already tracks.
- Arming and disarming are split so that no code path ever removes a `GSource`
  it is currently executing inside.
- Preserve wall-clock re-derivation everywhere; introduce no monotonic deadline
  for a wall-clock event.

**Non-Goals:**

- Varying the tick period with `pref-show-seconds`. Considered and dropped: the
  tick is one second or it does not exist.
- Replacing the poll with an event-driven scheduler that sleeps until the next
  computed deadline.
- Any user-visible control over this behaviour.

## Decisions

### The arming predicate is `!isPaused || isStartAlarmEligible()`

```js
needsTick () {
  return !this.isPaused || this.isStartAlarmEligible();
}
```

Reusing `isStartAlarmEligible()` rather than writing a second, narrower test is
what makes the "never stand down while an alarm is pending" guarantee hold by
construction: the condition that arms the timer and the condition that fires the
notification are the same expression, so they cannot drift apart as the start
alarm is maintained.

The three remaining consumers need no term of their own:

| consumer | why the predicate already covers it |
|---|---|
| flush + indicator | only move while counting, so `!isPaused` |
| break alarm | `_breakDeadline` is nulled in `onPause`, armed in `onResume` |
| goal alarm | driven by tracked time, which is frozen while paused |

*Alternative considered:* a dedicated `_tickReasons` set, each consumer
registering and unregistering its own need. More explicit, but it adds a second
place where the start alarm's conditions are written down — the exact
duplication the reuse above avoids — for a state machine with three states.

### Only the tick removes the tick; everything else only arms it

```
  _ensureTick()   -->  adds the source if needsTick() and _timeout is null
  tick tail       -->  if !needsTick(): _timeout = null; return SOURCE_REMOVE
```

Removing a `GSource` from inside its own callback via `GLib.Source.remove()` is
the standard way to double-free in GJS. Returning `GLib.SOURCE_REMOVE` is the
supported way, and it is only available to the callback itself — so the callback
is made the *only* remover, and every other site becomes an unconditional,
idempotent arm. That also disposes of a thrash concern: `onChangeSettings` fires
on the extension's own `state-tracked-time` write every two minutes, and an
`_ensureTick()` that is a no-op when the source exists costs nothing there.

Arm sites: `_init`, `onPause`, `onResume`, `onReset`, `onChangeSettings`, and
the `Postpone...` callback of `showStartNotification` — the last because that
callback clears `_startAlarmFired` after the tick has already removed itself,
and nothing else would notice. The `Start` action goes through `onResume` and
`Not today` only makes the predicate false, so neither needs anything.

`onDestroy` must guard `GLib.Source.remove(this._timeout)` with a null check and
clear the handle, since the tick may have removed itself already.

### A 60-second poll re-arms at the timeframe opening, gated on today's configuration

Nothing is running at 08:59, so something has to notice 09:00. The poll runs
only while paused, and only when a start alarm exists for today that merely
cannot fire *yet*:

```
                        paused?
                    no /        \ yes
              [ 1s tick ]    isStartAlarmEligible()?
                            yes /        \ no
                     [ 1s tick ]      start alarm configured today?
                                     no /        \ yes
                               [ NOTHING ]   [ 60s poll ]
```

"Configured today" means the weekday is selected, the timeframe is valid, and
the day is not dismissed — the parts of `isStartAlarmEligible()` that do not
depend on the current time of day or on `_startAlarmFired`. Extracting that
subset is the one piece of genuinely new conditional logic in the change.

With the shipped default of an empty `pref-start-alarm-days` the poll never
runs, so a paused tracker holds no timer at all — the case the change exists
for.

*Alternative considered — `GnomeDesktop.WallClock`:* subscribing to
`notify::clock` rides the minute pulse GNOME already runs, costing zero
additional wake-ups, and is wall-clock based. Rejected for now on risk, not
merit: it adds a `gi://GnomeDesktop` import that throws if the Shell has already
loaded a different GnomeDesktop version, and the no-import variant reaches into
`Main.panel.statusArea.dateMenu._clock`, a private field, across Shell 45–49.
A 60-second `GLib` timer costs about 945 wake-ups on a configured day against
the 86,400 being removed, which is not worth a compatibility hazard. Revisit
if the poll ever shows up in a profile.

*Alternative considered — a one-shot timeout until the timeframe opens:* one
wake-up instead of 945, and wrong. `GLib` timeouts run on `CLOCK_MONOTONIC`,
which does not advance across suspend, so a timer set at 08:00 for 09:00 fires
at 11:00 of wall clock after a two-hour suspend — possibly past the close of
the timeframe, silently losing the alarm for the day. The 60-second poll
re-derives from `new Date()` on each pass and inherits the suspend immunity the
current one-second poll has.

### The flush guard is corrected rather than moved

`getUintTime() - this._startTime > 60 * 2` evaluates `now - null` when paused,
which is a large number, so `storeCountedTime()` is called every paused second
today and saved only by its own early return. Once the tick runs during a paused
start-alarm window the call is still reached, so the guard gains an explicit
`!this.isPaused` term. Left alone it is not a live bug; corrected, the tick body
reads as what it does.

`checkGoalAlarm()` is deliberately left running during the paused window. With
tracked time frozen the step is zero and it does nothing but keep
`_lastGoalTracked` current — which is what keeps a preferences edit during the
pause from being read as accumulation on the first tick after resume.

### `TICK_TOLERANCE` stays at 5

`checkGoalAlarm` separates "accumulated about a tick's worth" from "somebody
else wrote the counter" by comparing the step against `TICK_TOLERANCE`. That
constant is coupled to the tick period, and a 60-second display tick would have
broken it — every ordinary step would have read as an external jump and the goal
alarm would never have fired. Since the period stays at one second, the constant
stays at 5. Worth recording because it is the reason the discarded 1s/60s design
was not a free win.

Gaps in the second-by-second timer do not disturb it either: the timer only
stops while paused, tracked time does not move while paused, and so the step
across a stand-down is zero.

## Risks / Trade-offs

- **A missed arm site silently disables an alarm.** The failure mode is a start
  alarm that never fires, with nothing in the log to say why. → The arm sites are
  enumerated above and each gets a task; the predicate is a single named method
  so a reviewer can grep its callers.

- **The start alarm may fire up to a minute late** when it is anchored to the
  timeframe opening rather than to a pause that happened inside it. → Accepted
  and written into the spec. The delay it sits on top of defaults to 15 minutes.

- **A future consumer added to the tick body may need a wake-up the predicate
  does not grant**, and would appear to work while tracking and fail while
  paused. → The predicate carries the table above as a comment naming what each
  consumer relies on.

- **Savings are bounded by the paused fraction.** Counting hours still cost one
  wake-up a second; at eight hours of tracking a day this is roughly 86,400 →
  28,800, with overnight going to zero. Dropping the 60-second display tier gave
  up the larger share of the theoretical win in exchange for not touching
  `TICK_TOLERANCE`, alarm precision, or display latency.

## Migration Plan

None. No stored state, preference or schema is touched, so the change takes
effect on the next enable and reverts by reverting the commit. A user who
suspects it can confirm the tracker still behaves by watching a start alarm
fire.
