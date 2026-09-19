## 1. Cleanups — no behaviour change

Landed first: independent of the tick instant, and they shrink the diff the tick-instant work has to be read against. Keep as commits separate from group 3.

- [x] 1.1 Verify `GLib.DateTime.new_now_local().format('%Y-%m-%dT%H:%M:%S%:z')` matches the current `logging()` output byte-for-byte at a whole-hour offset, at a half-hour offset (`TZ=Asia/Kolkata`), and on both sides of a DST transition. If any output differs, stop: skip tasks 1.2 and 1.3 and leave `logging()` unchanged.
- [x] 1.2 Replace the hand-rolled ISO 8601 construction in `logging()` with the verified `GLib.DateTime` call, deleting `tzo`, `dif` and the `pad` helper.
- [x] 1.3 Remove the Style Conventions note in `AGENTS.md` about `function` being used in one place — `pad` was the only occurrence.
- [x] 1.4 Extract one notification helper that builds the source and the `Notification` with the shared title and icon, attaches the caller's actions, and posts it. Rewrite `showNotification`, `showStartNotification` and `showGoalNotification` against it, leaving each one's body, action set and postpone semantics exactly as they are.
- [x] 1.5 Replace the duplicated `.filter((s, i, a) => a.indexOf(s) === i).sort(...)` at both postpone call sites with `[...new Set(options)].sort((a, b) => a - b)`.
- [x] 1.6 Rewrite the hours/minutes/seconds split in `getTrackedTime()` using `%`, deleting the two `if (... !== 0)` guards that subtract zero, and drop the `=== true` comparison on `pref-show-seconds`.
- [x] 1.7 Fix the guard at `extension.js:373`: `this._label.get_parent` tests that the method exists. Either call it or drop it, leaving `this._label &&` as the real check.
- [x] 1.8 Confirm the log file, the notification text and the indicator string are unchanged after group 1: enable the extension, track, pause, resume, reset, and trigger each of the three alarms.

## 2. Separate the two start-alarm predicates

Prepares the hoisting in group 3 and is behaviour-neutral on its own.

- [x] 2.1 Reorder `isStartAlarmEligible()` so `isPaused` and `_startAlarmFired` are tested before `isStartAlarmConfiguredToday()`, so a counting tracker never pays for the four day-level GSettings reads.
- [x] 2.2 Add a comment at both predicates recording the split: `isStartAlarmConfiguredToday()` folds in nothing the tick body can change and may be evaluated once per pass; `isStartAlarmEligible()` folds in `_startAlarmFired` and must not be.

## 3. One pass, one instant

- [x] 3.1 Add the per-pass instant record built at the top of `onTick()`, holding `date`, `uintTime`, `trackedSeconds` and `configuredToday`. It must be a local value that dies with the pass, not a field on `this`.
- [x] 3.2 Make `isStartAlarmConfiguredToday` accept the pass's date as a required argument and remove its `date = new Date()` default. Do the same for `getLocalDay`, `isStartAlarmEligible` and `getStartDeadline`. Update every caller, including the notification actions and the sixty-second poll, which build their own instant.
- [x] 3.3 Thread `configuredToday` from the record into `isStartAlarmEligible()` so the day-level question is asked once per pass instead of twice.
- [x] 3.4 Give `needsTick()` and `needsPoll()` the pass's instant, so the tail of the pass no longer constructs a `Date` of its own. Confirm `isStartAlarmEligible()` is still genuinely re-evaluated there — only the instant is shared, not the answer.
- [x] 3.5 Thread `trackedSeconds` from the record into `refreshIndicatorLabel()` / `getTrackedTime()` and `checkGoalAlarm()`, so both read the same counter value.
- [x] 3.6 Replace the remaining bare `getUintTime()` calls in the tick body — the flush threshold test and the break deadline test — with the record's `uintTime`.
- [x] 3.7 Re-read `onTick()` end to end and confirm exactly one clock reading occurs per pass, and that nothing derived from the record outlives it.

## 4. Cheaper periodic work

- [x] 4.1 Switch the one-second source in `_ensureTick()` from `GLib.timeout_add` to `GLib.timeout_add_seconds`, matching the sixty-second poll.
- [x] 4.2 Hold the last rendered indicator string and skip `set_text` when the new string matches. Leave `updateIndicatorStyle()` and the pause/resume repaint paths alone. Clear the held string on teardown along with `_label`.

## 5. Verification

- [x] 5.1 Stand-down after the start alarm fires, the highest-value regression: with the tracker paused inside an open timeframe, let the alarm fire and confirm periodic work ceases for that paused period rather than continuing. This is what a mistaken hoist of `isStartAlarmEligible()` would silently break.
- [x] 5.2 Re-run the `flexible-timer-ticks` scenarios that still bind: paused with no weekday selected does no work at all; paused outside the timeframe does no second-by-second work; the sixty-second poll picks up the timeframe opening; postponing a start alarm re-arms the work.
- [x] 5.3 Confirm the indicator and the goal alarm agree: set a goal target a minute or two ahead, let it trigger, and confirm the notification value is one the indicator displayed.
- [x] 5.4 Confirm each alarm — break, start, goal — still fires at the same moment it did before the change.
- [x] 5.5 Confirm tracked time is exact over a long counting stretch with coalesced wakeups, and that pause, resume, restart and a preferences edit of tracked time all behave as before.
- [x] 5.6 Confirm teardown is still clean: disable the extension while counting and while paused inside a timeframe, and check both sources and the log stream are released.
  - Note: verified as *unchanged*. In a nested Shell both sources are re-armed during `onDestroy()` — the `state-paused` / `state-tracked-time` writes re-enter `onChangeSettings()` → `_ensureTick()` before the `changed` handler is disconnected. The pre-change build behaves identically, so this is pre-existing and out of scope here; it is masked in a real session because dconf delivers `changed` asynchronously, after the disconnect.
- [x] 5.7 Run `openspec validate "optimize-tick-and-cleanups" --strict`.
- [x] 5.8 Add a Gotchas entry to `AGENTS.md` recording the one-pass-one-instant rule and the reason `isStartAlarmEligible()` is exempt from it.
