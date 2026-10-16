## Why

Users who track one working day at a time have to press **Restart** every morning, and a forgotten restart folds yesterday's total into today's. The extension already knows the local calendar day (the start alarm's "Not today" dismissal is stored per day). It can start each day from the reset value by itself.

## What Changes

- A new **Behavior** option, placed right after "Start tracker when restart timer", that resets the tracked time to the configured reset time once per local calendar day.
- The reset happens at **local midnight** while the extension runs, and on the **first start of a new day** (boot, login, unlock, re-enable) when midnight passed while the extension was not running. A second start on the same day does not reset.
- The running state is preserved. A tracker that is counting at midnight keeps counting, and the time after 00:00 belongs to the new day. A paused tracker stays paused, and "Start tracker when restart timer" does not apply to an automatic reset.
- When time spent locked or suspended is recovered on enable (pause-on-destroy off), the recovered stretch is split at midnight. The part before midnight closes the old day. The part after midnight is counted into the new one.
- Each automatic reset is written to the state log as `auto reset`, carrying the closing total of the day that ended.
- The option is stored in **one key**, as the user asked. The key holds the local day of the last reset as `YYYYMMDD`, and `0` means the option is off. Switching it on writes today's day, so turning it on mid-day never resets the time that is already tracked.

## Capabilities

### New Capabilities

- `daily-reset`: resetting the tracked time to the reset value once per local calendar day, at midnight or on the first start of a new day, with the running state preserved and the day boundary honoured when time is recovered.

### Modified Capabilities

- `tick-scheduling`: an idle tracker currently does no periodic work of any kind. With the daily reset on, it is woken once a day at local midnight. There is still no polling.

## Impact

- `source/schemas/org.gnome.shell.extensions.chronos.gschema.xml`: one new int key, the day of the last reset or `0` for off.
- `source/extension.js`: a day check in `_init`, ordered against the existing suspend-gap recovery; a one-shot midnight timeout, released in `destroy()`; a day check on the tick; an `auto reset` log entry with an explicit tracked value.
- `source/prefs.js`: one switch row on the Behavior page. It is not wired through `bindSentinelSwitch()`, because there is no value row and no remembered value.
- `source/chronos.pot` and `source/locale/ru`: new translatable strings.
- `metadata.json` version bump and a *What's New* entry.
- `AGENTS.md`: key table, plus a note on why this sentinel key is not bound through `bindSentinelSwitch()`.
- No change to the manual Restart, the alarms, or the stored tracked-time format.
