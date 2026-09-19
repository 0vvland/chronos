## Context

See proposal.md — Why, for motivation, and `specs/break-alarm/spec.md` for the behaviour contract.

Constraints that shape the approach:

- The existing implementation carries two fields, `_breakAlarmShown` (bool) and `_nextBreakAlarmTime` (timestamp), plus a helper `getTrackedSeconds()` that reads the persisted `state-tracked-time`. The alarm check runs inside the existing 1-second `GLib.timeout_add` tick in `Chronos._init`.
- `Chronos` is constructed in `ChronosExtension.enable()` and torn down in `disable()`. GNOME locks the screen by disabling extensions, so every lock/unlock cycle destroys and rebuilds the object. Anything held only in instance fields is therefore dropped on lock for free; anything in GSettings survives.
- `Chronos.isPaused` is derived (`this._startTime === null`), not a stored flag. Pause sets `_startTime = null`; resume sets it to the current timestamp.
- Verified against GNOME Shell 50.4 (`libshell-18.so`): `NotificationDestroyedReason = { EXPIRED: 1, DISMISSED: 2, SOURCE_CLOSED: 3, REPLACED: 4 }`, and `Notification.destroy(reason = NotificationDestroyedReason.DISMISSED)`. Activating an action on a non-resident notification calls `this.destroy()` with that default, so a postpone click is indistinguishable from a user dismissal at the `destroy` signal. A banner is auto-destroyed with `EXPIRED` only when `isTransient` is set; otherwise it parks in the message tray. `MAX_NOTIFICATIONS_PER_SOURCE` eviction also destroys with `EXPIRED`, and the extension posts to the *shared* system source, so unrelated notifications can evict ours.

## Goals / Non-Goals

**Goals:**

- Represent the whole alarm lifecycle with the minimum state that satisfies the spec.
- Keep the alarm entirely independent of `state-tracked-time` and of `pref-pause-on-destroy`.
- Introduce no new GSettings key, and express "alarm off" with one key rather than two.

**Non-Goals:**

- Any minimum-break-duration rule. A pause of any length counts as a break, per the spec. Guarding against a user tapping pause/start to snooze indefinitely is explicitly out of scope.
- Persisting break-alarm state across a disable/enable cycle, in any form.
- Changing how `state-tracked-time` is accumulated, stored, or displayed.
- Reworking the notification source. The extension keeps using the shared system source.

## Decisions

### A single nullable deadline replaces both existing fields

Hold one instance field, a break deadline that is either an absolute timestamp in seconds or `null`.

```
arm() := interval > 0 ? getUintTime() + interval : null
```

| Event                              | deadline        |
|------------------------------------|-----------------|
| `enable()`, tracker running        | `arm()`         |
| `enable()`, tracker paused         | `null`          |
| `disable()`                        | object destroyed |
| pause                              | `null`          |
| resume                             | `arm()`         |
| tick, `now >= deadline`            | `null`, then notify |
| postpone by *n*                    | `now + n`       |
| interval changed                   | unchanged; applies at next `arm()` |

*Why:* "paused", "already fired", and "dismissed" are behaviourally identical — in all three the alarm must stay silent, and in all three the only thing that revives it is the start of a new working stretch. The spec distinguishes them nowhere, so they need no distinct representation. Resume and enable arm unconditionally, which is correct whatever the prior reason for being disarmed.

*Consequence:* dismissal requires no code at all. The tick sets the deadline to `null` when it fires, which is already the dismissed state.

*Alternative considered:* keeping a separate `_dismissed` flag alongside the deadline. Rejected — it would be write-only, since nothing ever reads it that the null deadline does not already answer.

*Alternative considered:* a persisted `state-break-alarm-dismissed` key so dismissal survives a lock. Rejected — the spec requires that enabling the extension starts a new working stretch unconditionally, so a persisted dismissal would contradict it.

### Wall-clock, not tracked time, is the anchor

The deadline is an absolute wall-clock timestamp compared against `getUintTime()` in the existing tick.

*Why:* while the tracker is running, elapsed wall-clock time and elapsed tracked time advance together. They diverge only across a pause or a disable — and both of those disarm the alarm, so the divergence is never observed. Wall-clock is therefore exactly equivalent to "time since this working stretch began", at no bookkeeping cost.

*Consequence:* `getTrackedSeconds()` loses its only caller and is deleted. It duplicated the first five lines of `getTrackedTime()`, so removing it also removes the duplication.

*Alternative considered:* accumulating a "seconds worked in this stretch" counter incremented per tick. Rejected as strictly more state for the same answer, and it would drift if a tick is ever missed or delayed.

### Do not listen for the notification `destroy` signal

Because dismissal needs no representation, the implementation never connects to `destroy` and never inspects `NotificationDestroyedReason`.

*Why:* this sidesteps three traps at once — a postpone click reporting `DISMISSED`, the extension's own teardown reporting `SOURCE_CLOSED`, and shared-source eviction reporting `EXPIRED`. None of them can be misread as user intent if none of them is read.

*Corollary:* the notification must not set `isTransient`, so that an unattended alarm parks in the message tray instead of being destroyed when its banner scrolls away. This is the current (default) behaviour and must be preserved.

### Cancelling the postpone dialog leaves the alarm disarmed

Clicking the postpone action destroys the notification and opens the dialog. If the user then cancels the dialog, no new deadline is set and the alarm stays silent for the rest of the working stretch — the same outcome as dismissing.

*Why:* it is the natural consequence of the single-deadline model, and it is a defensible reading of cancelling. Making cancel restore the fired-but-not-answered state would require reintroducing the distinction the model deliberately removes.

### A settings change applies at the next arming, not immediately

The interval is read once, when the deadline is armed. Nothing watches it afterwards, so `onChangeSettings` needs no break-alarm branch and no cached copy of the interval.

*Why:* the deadline already is the decision. Re-reading the setting mid-stretch would mean deciding what a change means for an alarm that is already counting down — re-arm from now, re-anchor to the stretch start, or fire immediately — and every answer is a rule the user has to learn. "It applies to the next alarm" is one rule, and it needs no code.

*Consequence:* turning the alarm off while one is pending does not cancel it; that last alarm fires, and nothing is armed after it. Likewise, turning the alarm on mid-stretch stays silent until the next stretch begins — a pause and start, or a lock and unlock.

*Alternative considered:* clearing the deadline when the interval becomes zero, so switching off takes effect at once. Rejected for now as the one exception that would reintroduce a setting-watching branch; revisit if the pending-alarm-after-off behaviour proves annoying in use.

### One key, zero means off

`pref-break-alarm-enabled` is removed; `pref-break-alarm-interval` alone carries the state, with `0` meaning off.

*Why:* two keys can disagree — enabled with a zero interval, or disabled with an hour stored — and every reader then has to consult both and decide what the contradiction means. A single number has no contradictory state to interpret, and the alarm's one real question ("how long is the stretch?") already has zero as a natural "never".

*Consequence:* the prefs switch can no longer bind to a key. It keeps its place in the UI as an affordance — off writes `0`, on writes back the interval the user last chose, remembered in the page instance for the lifetime of the prefs window and defaulting to one hour. A user who zeroes the spinner with the switch on disables the alarm and leaves the switch on; that reading is honest about what is stored and is not worth extra code to police.

*Alternative considered:* keeping both keys and treating `enabled` as authoritative. Rejected — it preserves exactly the contradictory states the squash removes.

### Reset does not touch the alarm

`onReset` currently clears the two alarm fields. It should stop doing so, since the alarm no longer depends on tracked time.

*Exception:* `onReset` can start the tracker directly when it was paused and `pref-start-on-reset` is set, bypassing the resume path. That branch must arm the deadline, or a reset-initiated start would leave the alarm silent for the whole stretch.

## Risks / Trade-offs

- **Pause/start is an unlimited snooze** → Accepted deliberately; see Non-Goals. A user who does not want a break can tap pause and start to reset the countdown.
- **Opening a modal dialog from a notification action may lose focus**, since the banner's grab may still be active when the dialog opens → Verify in a nested Shell (`make run`). If it misbehaves, defer the dialog construction to an idle callback. This is a pre-existing condition of the shipped code, not something this change introduces.
- **The shared system source can evict the break notification** under notification pressure, silently losing the alarm for that stretch → Accepted; using a dedicated source is out of scope, and the user can still see the tracker running.
- **A long lock with tracking enabled yields no break alarm** until a full interval after unlock → This is the specified behaviour, and follows from treating a lock as a break.
- **The deadline is wall-clock based, so a system clock jump or suspend/resume shifts it** → Bounded: the alarm can only fire early or late by the size of the jump, and the next pause or lock re-arms it. Not worth compensating for.

## Migration Plan

`pref-break-alarm-enabled` is dropped from the schema and its stored value is abandoned, not migrated. The alarm shipped one commit ago and defaults to off with a zero interval, so the only installation affected is one that turned the alarm on, then off, and kept a non-zero interval — it finds the alarm on after the upgrade and can switch it off again. Reading the old key before dropping it is not worth the code for that. No other key is added or repurposed; no schema recompilation beyond the normal build. Rollback is reverting the commit; a reverted installation reads `pref-break-alarm-enabled` at its schema default of `false`, so the alarm returns off.
