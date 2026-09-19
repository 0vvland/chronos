## Why

The break alarm shipped in commit `3bec753` does not follow its intended user story. Its trigger is anchored to cumulative `state-tracked-time` rather than to the current uninterrupted working stretch, so once the interval has been exceeded the alarm re-fires on the very next tick after every resume and after every unlock. Separately, the postpone flow throws a `TypeError` before the dialog can open, so postponing is entirely non-functional, and the `pref-break-alarm-enabled` switch is never read.

## What Changes

- Re-anchor the break alarm to **continuous running-and-enabled time** instead of cumulative tracked time. The alarm measures one uninterrupted working stretch; pausing the tracker and disabling the extension (screen lock) both end that stretch and count as taking a break.
- Replace the `_breakAlarmShown` / `_nextBreakAlarmTime` pair with a single in-memory nullable deadline. Firing, dismissing, and pausing are all represented by the same "disarmed" state; only resuming the tracker or enabling the extension re-arms it.
- Collapse `pref-break-alarm-enabled` and `pref-break-alarm-interval` into the interval key alone, where `0` means the alarm is off. The alarm arms only when the interval is greater than zero. The prefs switch keeps its place in the UI but is no longer bound to a key: switching it off writes `0`, switching it on restores the last interval the user chose.
- Fix the postpone option list: the dedupe predicate currently passes a number where `Array.prototype.findIndex` requires a callback, throwing before `PostponeDialog` is constructed. Sorting is also lexicographic and must be numeric.
- Read `pref-break-alarm-interval` once, when the alarm is armed. A change to it governs the next alarm rather than the one already pending, so no settings-change handling is needed.
- Remove `getTrackedSeconds()`, which exists only to feed the old cumulative trigger and duplicates the head of `getTrackedTime()`.
- Remove the leftover debug `test` menu action that fires a notification on demand.
- Replace the placeholder notification strings (`'Chronos Tracker'`, `'message'`, `'Postpone...'`) with translated strings via `gettext`, and regenerate the translation catalogue.
- Drop the unused `defaultValue` parameter from `PostponeDialog` and the unused `settingsKey` parameter from `AlarmsPage`.
- Fix `formatPostponeTime` so durations that are not an exact multiple of a single unit (for example 5400 seconds) render as a readable duration rather than falling through to raw seconds.

One breaking change: `pref-break-alarm-enabled` is removed from the schema. No other key is added or repurposed, and no persisted state is introduced. An installation that had the alarm enabled keeps its interval and therefore keeps its alarm; one that had it disabled while holding a non-zero interval will find the alarm on, and can switch it off again.

## Capabilities

### New Capabilities

- `break-alarm`: Notifying the user to take a break after a configured stretch of uninterrupted tracking, including the arm/disarm lifecycle across pause, resume, extension disable and enable, and the postpone interaction.

### Modified Capabilities

None. The repository has no existing specs; this change introduces the first one.

## Impact

- `source/extension.js` — the `Chronos` 1-second tick, `_init`, `onPause`, `onResume`, `onReset`, `showNotification`, and the removal of `getTrackedSeconds` and the debug menu action.
- `source/components/PostponeDialog.js` — signature cleanup and `formatPostponeTime`.
- `source/prefs.js` — `AlarmsPage` signature cleanup, and the switch now drives the interval key instead of its own key.
- `source/schemas/org.gnome.shell.extensions.chronos.gschema.xml` — `pref-break-alarm-enabled` removed.
- `source/chronos.pot` and `source/locale/ru/LC_MESSAGES/chronos.po` — new translatable notification strings.
- `pref-pause-on-destroy` becomes irrelevant to the break alarm, since the alarm no longer reads tracked time.
