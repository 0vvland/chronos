## 1. Settings schema

- [x] 1.1 Add `pref-start-alarm-days` (`ai`, default `[]`) to the gschema, documenting `0 = Sunday … 6 = Saturday` and that an empty array means the alarm is off
- [x] 1.2 Add `pref-start-alarm-from` and `pref-start-alarm-to` (`i`, seconds since local midnight, defaults 32400 and 64800) to the gschema
- [x] 1.3 Add `pref-start-alarm-delay` (`i`, default 900) to the gschema
- [x] 1.4 Add `state-start-alarm-dismissed` (`i`, default 0, `YYYYMMDD` in local time) to the gschema
- [x] 1.5 Confirm the new keys read back with `gsettings`
- [x] 1.6 Add the new keys to the GSettings table in `AGENTS.md`

## 2. Weekday picker component

- [x] 2.1 Add `source/components/WeekdayRow.js` — an `Adw.ActionRow` holding a `Gtk.Box` of seven `Gtk.ToggleButton`s, rendered Monday-first
- [x] 2.2 Expose a `value` GObject property carrying the selected days as an int array in `Date.getDay()` encoding, emitting `notify::value` on toggle
- [x] 2.3 Make the row reflect an externally set `value` without re-emitting per button

## 3. Preferences

- [x] 3.1 Add a "Start tracking reminder" group to `AlarmsPage` with an unbound enable switch, active when the stored weekday array is non-empty
- [x] 3.2 Wire the switch to write either an empty array or the last non-empty selection, mirroring the break-alarm interval pattern, and to show/hide the rows below it
- [x] 3.3 Add the `WeekdayRow`, wired by hand to `pref-start-alarm-days` (`Gio.Settings.bind` does not handle array properties)
- [x] 3.4 Add `TimeRow`s for the from/to bounds and the delay, bound to their keys
- [x] 3.5 Show a visible indication when `to <= from` leaves the alarm inactive

## 4. Alarm state in the indicator

- [x] 4.1 Add `_pauseStartTime`, `_startDeadline` and `_startAlarmFired` fields, initialised in `_init` alongside `_breakDeadline`, and record `_enabledAt`
- [x] 4.2 Set `_pauseStartTime` in `onPause`; clear `_startDeadline` and `_startAlarmFired` in `onResume`; leave both untouched in `onReset`
- [x] 4.3 Add an eligibility check: selected weekday, inside the timeframe, tracker paused, `state-start-alarm-dismissed` not today, `_startAlarmFired` false — all derived from local time on each call
- [x] 4.4 Add the anchored deadline `max(_pauseStartTime, _enabledAt, timeframeOpenToday) + delay`, overridden by `_startDeadline` when a postponement is pending
- [x] 4.5 Evaluate the check in the existing 1-second timeout next to the `_breakDeadline` check, raising the notification and setting `_startAlarmFired`

## 5. Notification

- [x] 5.1 Add `showStartNotification()` with a translated title and body
- [x] 5.2 Add the **Start** action, calling `onResume`
- [x] 5.3 Add the **Postpone...** action, opening `PostponeDialog` with `[300, 900, delay]` deduped and sorted, writing the chosen offset to `_startDeadline` and clearing `_startAlarmFired`
- [x] 5.4 Add the **Not today** action, writing today's `YYYYMMDD` to `state-start-alarm-dismissed`

## 6. Translations

- [x] 6.1 Add the new preference and notification strings to `source/chronos.pot`
- [x] 6.2 Add Russian translations to `source/locale/ru/LC_MESSAGES/chronos.po`

## 7. Verification

- [x] 7.1 `make run` — with the tracker paused and the timeframe open, confirm the alert appears one delay later and not before
- [x] 7.2 Confirm the alert does not appear on an unselected weekday, outside the timeframe, or when a deadline would land past the close
- [x] 7.3 Confirm enabling the extension mid-timeframe while paused waits a full delay instead of alerting immediately
- [x] 7.4 Confirm the alert fires once per idle period: leaving it untouched raises no second notification until the tracker is started and paused again
- [x] 7.5 Confirm **Start** resumes tracking, **Postpone...** re-alerts after the chosen duration, and **Not today** silences the rest of the day
- [x] 7.6 Confirm dismissal survives a lock/unlock cycle and a postponement does not
- [x] 7.7 Confirm the break alarm's behaviour is unchanged with the start alarm both on and off
