## 1. Settings schema

- [x] 1.1 Add `pref-goal-alarm-enabled` (`b`, default `false`) to `source/schemas/org.gnome.shell.extensions.chronos.gschema.xml`, with summary and description
- [x] 1.2 Add `pref-goal-alarm-time` (`i`, default `28800`) to the same schema, describing it as the cumulative tracked time in seconds at which the alarm triggers, and noting that zero and negative targets are valid
- [x] 1.3 Add both keys to the GSettings table in `AGENTS.md`, noting that this alarm uses an explicit enable flag rather than the `0`/`[]` sentinel the other two use

## 2. Raw tracked seconds

- [x] 2.1 Extract `getTrackedSeconds()` in `source/extension.js` — `state-tracked-time` plus the un-flushed elapsed time when running — and rewrite `getTrackedTime()` to format its result, leaving the formatted output byte-identical for positive, negative and zero values with seconds both shown and hidden

## 3. Goal alarm state and detection

- [x] 3.1 Add `_goalFired`, `_goalDeadline` (null unless postponed) and `_lastGoalTracked` to `_init`, and a `TICK_TOLERANCE` module constant of 5 seconds
- [x] 3.2 Add `getGoalTarget()` returning `_goalDeadline` when set, otherwise `pref-goal-alarm-time`
- [x] 3.3 Seed `_lastGoalTracked` and `_goalFired` at the end of `_init`, after the suspend-gap recovery block, so an enable with the counter already above the target starts out already fired
- [x] 3.4 Add the goal branch to the one-second tick: compute the step from `_lastGoalTracked`; on a normal advance fire when the step crosses the target and `_goalFired` is false; on a discontinuity re-synchronise `_goalFired` to `tracked >= target`, clear `_goalDeadline`, and raise nothing; update `_lastGoalTracked` either way
- [x] 3.5 Guard the whole branch on `pref-goal-alarm-enabled`, keeping `_lastGoalTracked` up to date while the alarm is off so switching it on mid-session does not read as a jump

## 4. Notification

- [x] 4.1 Add an optional heading parameter to `PostponeDialog` in `source/components/PostponeDialog.js`, defaulting to the current "Select Duration" text so the break and start callers are unchanged
- [x] 4.2 Add `showGoalNotification()` to `source/extension.js` with a translated title, a body stating the tracked time target has been reached, and Postpone and Dismiss actions
- [x] 4.3 Wire Postpone to open `PostponeDialog` with 5, 15 and 30 minutes and a heading naming the unit as tracked time; on selection set `_goalDeadline = getTrackedSeconds() + selected` and clear `_goalFired`
- [x] 4.4 Wire Dismiss to close the notification without changing alarm state, and clear `_goalDeadline` when the alarm fires so a later re-arm uses the configured target

## 5. Preferences

- [x] 5.1 Add a goal alarm group to `AlarmsPage` in `source/prefs.js`, after the start alarm group, with a `SwitchRow` bound to `pref-goal-alarm-enabled` and a `TimeRow` bound to `pref-goal-alarm-time`, both with `Gio.SettingsBindFlags.DEFAULT`
- [x] 5.2 Show and hide the target row with the switch, matching how the break and start groups present their rows; leave the `TimeRow` at its default hour bounds so negative targets remain reachable

## 6. Translations

- [x] 6.1 Regenerate `source/chronos.pot` and update `source/locale/ru/LC_MESSAGES/chronos.po` with the new notification and preferences strings

## 7. Verification

- [x] 7.1 `make install` and confirm the schema compiles and both new keys are readable
- [x] 7.2 In a nested shell (`make run`), verify the alarm fires once on a short target reached by tracking, and does not fire again while tracking continues past it
- [x] 7.3 Verify the silent cases raise nothing and leave the alarm correctly armed afterwards: editing the tracked time across the target in preferences in both directions, restarting the tracker with a reset time above and below the target, and changing the target across the current tracked time in both directions
- [x] 7.4 Verify a postponement is measured in tracked time by pausing for longer than the postponement and confirming the notification arrives only after the chosen amount of further tracking
- [x] 7.5 Verify a disable/enable cycle with the counter above the target raises nothing, and that a postponement does not survive it
- [x] 7.6 Verify the break and start alarms are unchanged, including both alarms being raised when two come due together
