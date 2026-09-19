## Why

The break alarm covers one half of a working rhythm — it caps how long a stretch of tracking may run. Nothing covers the other half: a user who forgets to start the tracker in the morning, or who pauses for a phone call and never resumes, silently loses tracked time and only notices at the end of the day. A reminder that fires while the user is sitting at an unlocked machine, not tracking, during hours they said they work, recovers that time.

## What Changes

- Add a **start tracking alarm**: when the tracker is paused during a user-configured working timeframe on a user-configured weekday, notify the user after a configured delay.
- Add preferences on the existing Alarms page: enabled weekdays, a daily time range (from / to), and the delay before alerting.
- The notification offers three actions: **Start** (resumes the tracker directly), **Postpone...** (re-arms the alarm after a chosen duration, reusing the existing `PostponeDialog`), and **Not today** (silences the alarm for the remainder of the current calendar day).
- Add a multi-select weekday picker component — no existing component in `source/components/` supports multi-selection.
- No coupling with the break alarm. The two alarms stay independent: the break alarm bounds the longest work stretch, the start alarm bounds the longest idle stretch. A start alert arriving one delay after a break notification is intended behaviour, not a conflict to suppress.

## Capabilities

### New Capabilities
- `start-alarm`: Reminds the user to start tracking when the tracker has been paused for a configured delay inside a configured weekly working timeframe, and lets them start, postpone, or dismiss the reminder for the rest of the day.

### Modified Capabilities

<!-- None. The break alarm's requirements are unchanged; the two alarms are independent. -->

## Impact

- `source/schemas/org.gnome.shell.extensions.chronos.gschema.xml` — new preference keys for weekdays, timeframe bounds and delay, plus one state key persisting the dismissed day.
- `source/extension.js` — a second deadline tracked alongside `_breakDeadline`, armed and disarmed from `_init`, `onPause`, `onResume` and the existing 1-second timeout; a second notification with three actions.
- `source/prefs.js` — a new preferences group on the existing `AlarmsPage`.
- `source/components/` — a new weekday picker component; `PostponeDialog` is reused unchanged.
- `source/chronos.pot` and `source/locale/ru` — new translatable strings.
