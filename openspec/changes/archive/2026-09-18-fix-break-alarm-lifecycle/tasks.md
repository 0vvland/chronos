## 1. Replace the alarm state model

- [x] 1.1 In `source/extension.js`, remove the `_breakAlarmShown` and `_nextBreakAlarmTime` fields from `Chronos._init` and introduce a single `_breakDeadline` field initialised to `null`
- [x] 1.2 Add a private helper that arms the deadline: returns `getUintTime() + interval` when `pref-break-alarm-interval > 0`, otherwise `null`
- [x] 1.3 Replace the alarm block in the 1-second tick with a single check: when `_breakDeadline` is non-null and `getUintTime() >= _breakDeadline`, set `_breakDeadline = null` and then call `showNotification()`
- [x] 1.4 Delete `getTrackedSeconds()` and confirm it has no remaining callers

## 2. Wire the lifecycle transitions

- [x] 2.1 In `onPause`, set `_breakDeadline = null` in place of the two removed fields
- [x] 2.2 In `onResume`, arm the deadline
- [x] 2.3 In `_init`, arm the deadline when the extension starts with the tracker running, and leave it `null` when the tracker starts paused — covering the lock/unlock path, since `Chronos` is rebuilt on enable
- [x] 2.4 In `onReset`, remove the two lines that cleared the old alarm fields, and arm the deadline in the branch where reset starts a previously paused tracker via `pref-start-on-reset`
- [x] 2.5 Confirm nothing in the alarm path reads `state-tracked-time` or `pref-pause-on-destroy`

## 3. Honour the alarm settings

- [x] 3.1 Read `pref-break-alarm-interval` only when arming, and leave `onChangeSettings` free of any break-alarm branch or cached interval — a setting change governs the next alarm, not the pending one
- [x] 3.2 Remove `pref-break-alarm-enabled` from the schema, and rework the prefs switch to write `0` or the last chosen interval to `pref-break-alarm-interval` instead of binding to its own key

## 4. Fix the postpone flow

- [x] 4.1 Fix the option list in `showNotification`: replace `a.findIndex(s)` with a proper dedupe predicate and add a numeric comparator to `.sort()`
- [x] 4.2 Change the postpone callback to set `_breakDeadline = getUintTime() + selected`
- [x] 4.3 Drop the unused `defaultValue` parameter from `PostponeDialog._init` in `source/components/PostponeDialog.js` and from its call site
- [x] 4.4 Fix `formatPostponeTime` so a duration that is not an exact multiple of a single unit (for example 5400 seconds) renders as a readable duration instead of raw seconds
- [x] 4.5 Confirm the notification does not set `isTransient`, and that no `destroy` signal handler is connected

## 5. Clean up the notification and preferences

- [x] 5.1 Remove the debug `test` menu action from `Chronos._init`
- [x] 5.2 Wrap the notification title, body, and postpone action label in `_()`, replacing the `'message'` placeholder body with real user-facing text
- [x] 5.3 Remove the unused `settingsKey` parameter from `AlarmsPage._init` in `source/prefs.js`
- [x] 5.4 Regenerate `source/chronos.pot` and update `source/locale/ru/LC_MESSAGES/chronos.po` with the new strings

## 6. Verify

- [x] 6.1 Run `make build` and confirm the schema compiles and the extension packages cleanly
- [x] 6.2 In a nested Shell (`make run`), walk the user story: start the tracker, let the alarm fire, postpone and confirm it fires again after the chosen duration
- [x] 6.3 Verify pause then start restarts the full interval, including after the alarm has already fired and after a dismissal
- [x] 6.4 Verify lock/unlock (or manual disable/enable) drops a pending alarm and restarts the full interval, including with `pref-pause-on-destroy` set to false
- [x] 6.5 Verify a changed interval governs the next alarm and leaves a pending one alone, that switching off then on restores the previous interval, and that a stretch started after the change uses it
- [x] 6.6 Verify the postpone dialog opens with focus and is usable when launched from the notification action; if it loses focus, defer its construction to an idle callback as noted in design.md
