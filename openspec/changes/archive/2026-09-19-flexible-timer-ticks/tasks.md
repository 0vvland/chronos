## 1. Predicates

- [x] 1.1 Add `needsTick()` to `Chronos`, returning `!this.isPaused || this.isStartAlarmEligible()`, with the consumer table from design.md as its comment so a later addition to the tick body knows what the predicate promises
- [x] 1.2 Add a predicate for "a start alarm is configured for today but cannot fire yet" — weekday selected, timeframe valid, day not dismissed, and `needsTick()` false — factoring the day-level checks out of `isStartAlarmEligible()` so the two cannot drift

## 2. Arming and disarming the one-second tick

- [x] 2.1 Extract the existing `GLib.timeout_add(1000, ...)` callback body out of `_init` into its own method, leaving behaviour unchanged
- [x] 2.2 Add `_ensureTick()`: arm the one-second source only when `needsTick()` is true and `this._timeout` is null; make it a no-op otherwise
- [x] 2.3 Give the tick body a self-removing tail — when `needsTick()` is false, null `this._timeout` and return `GLib.SOURCE_REMOVE`, otherwise return `GLib.SOURCE_CONTINUE` — and confirm no other code path calls `GLib.Source.remove` on the running source
- [x] 2.4 Replace the unconditional `timeout_add` in `_init` with `_ensureTick()`, keeping it after the `_lastGoalTracked` / `_goalFired` seeding so the first tick still sees no step
- [x] 2.5 Call `_ensureTick()` from `onPause`, `onResume` and `onReset`
- [x] 2.6 Call `_ensureTick()` from `onChangeSettings`, and confirm it stays cheap when the extension's own two-minute `state-tracked-time` write re-enters it
- [x] 2.7 Call `_ensureTick()` from the `Postpone...` callback in `showStartNotification`, after it clears `_startAlarmFired` and sets `_startDeadline`
- [x] 2.8 Guard `onDestroy` against a null `this._timeout` and clear the handle after removing the source

## 3. The 60-second re-arming poll

- [x] 3.1 Add the 60-second source, armed by the predicate from 1.2, whose callback does nothing but call `_ensureTick()` and remove itself once the one-second tick has taken over or the start alarm is no longer configured for today
- [x] 3.2 Drive the 60-second source from the same sites as `_ensureTick()`, so exactly one of the two sources — or neither — exists at any moment
- [x] 3.3 Confirm the poll re-derives weekday and time of day from `new Date()` on every pass and holds no precomputed deadline
- [x] 3.4 Remove the 60-second source in `onDestroy`, with the same null guard as 2.8

## 4. Corrections the conditional tick exposes

- [x] 4.1 Gate the two-minute flush on `!this.isPaused` so `getUintTime() - this._startTime` is never evaluated against a null start time during a paused start-alarm window
- [x] 4.2 Leave `checkGoalAlarm()` running during the paused window and note in a comment why it must not be skipped — it keeps `_lastGoalTracked` current so a preferences edit during the pause is not read as accumulation on the first tick after resume
- [x] 4.3 Leave `TICK_TOLERANCE` at 5 and record beside it that it is coupled to the one-second period

## 5. Verification

- [x] 5.1 Paused with no start-alarm weekday selected: neither source exists, and the indicator still updates when the tracked time is edited in preferences
- [x] 5.2 Paused on a selected weekday before the timeframe opens: only the 60-second source exists, and the one-second source appears within a minute of the opening
- [x] 5.3 Paused inside the timeframe: the start notification fires one delay after the anchoring moment, matching the `start-alarm` spec
- [x] 5.4 After the start notification fires and is left untouched, both sources are gone; after `Not today`, both sources are gone
- [x] 5.5 Postponing the start notification re-arms the one-second source and the alarm fires again after the chosen duration
- [x] 5.6 Break and goal alarms fire at the same moments as before the change, and tracked time across an eight-hour pause is unchanged
- [x] 5.7 Suspend across the timeframe opening and confirm the alarm is anchored to the wall-clock opening, not shifted by the length of the suspend
- [x] 5.8 Enable, disable and re-enable the extension in each of the three states and confirm no warning about a removed or double-removed source appears in the journal
