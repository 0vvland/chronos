## Why

The tracker shows cumulative tracked time but never says anything about it. A user who works to a daily target — "eight hours and I stop" — has to keep glancing at the indicator. The two existing alarms cannot express this: the break alarm measures one uninterrupted stretch and the start alarm measures wall-clock time of day, while a daily target is a reading on the counter itself.

## What Changes

- A third alarm that notifies once when cumulative tracked time reaches a target the user configures, e.g. `8:00`.
- The alarm is armed and fired only by continuous accumulation while the tracker runs. Discontinuous movements of the counter — a manual edit in preferences, a restart to the reset time, recovery of time elapsed while the extension was disabled — never raise a notification; they silently re-synchronise the alarm to whichever side of the target the counter has landed on.
- The notification offers **Postpone…** and **Dismiss**. Postponement is measured in *tracked* time, not wall-clock time: postponing by 15 minutes means 15 further minutes of tracking, so a lunch break does not consume the postponement.
- The alarm fires at most once per target. Restarting the tracker (which moves the counter back to the reset time) re-arms it for the next day.
- New preferences on the existing Alarms page: a switch and a target time.
- Because `0:00` and negative values are legitimate targets — the tracked time may be negative, so `0:00` means "time debt worked off" — this alarm cannot use the sentinel-value off switch the other two use. It gets its own boolean key. This is a deliberate departure from the established `0 = off` / `[] = off` convention.

## Capabilities

### New Capabilities

- `goal-alarm`: notifying the user once when cumulative tracked time reaches a configured target, with postponement measured in tracked time, and with immunity to discontinuous changes of the counter.

### Modified Capabilities

None. The break and start alarms are untouched in behaviour.

## Impact

- `source/schemas/org.gnome.shell.extensions.chronos.gschema.xml` — two new keys (an enable flag and a target in seconds).
- `source/extension.js` — a new alarm evaluated on the existing one-second tick; a new notification; extraction of the raw tracked seconds, which `getTrackedTime()` currently computes and discards in favour of a formatted string.
- `source/prefs.js` — a new preferences group on the Alarms page.
- `source/chronos.pot` and `source/locale/ru` — new translatable strings.
- `AGENTS.md` — the GSettings key table.
- No change to the existing alarms, the indicator, the menu, or the stored state format.
