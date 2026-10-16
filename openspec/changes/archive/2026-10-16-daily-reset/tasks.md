## 1. Schema

- [x] 1.1 Add `state-daily-reset-day` (type `i`, default `0`) to `org.gnome.shell.extensions.chronos.gschema.xml`, with a description stating the `YYYYMMDD` local day of the last reset and `0` = off

## 2. Extension: rollover core

- [x] 2.1 Cache the stamp in `readCachedSettings()` as `this._dailyResetDay` (gotcha 10)
- [x] 2.2 Give `logging()` an optional `trackedSeconds` argument passed through to `getTrackedTime()` (D5); existing callers unchanged
- [x] 2.3 Add `rollover(instant)` per D3: early return on stamp `0` or today; midnight from the instant's date; clamped `storeCountedTime(split)` when counting; `logging('auto reset', getTrackedSeconds(split))`; write `pref-reset-time` to `state-tracked-time`; write today's stamp; refresh the label
- [x] 2.4 Wire `rollover()` into `_init` per D4: inside the recovery branch between backdating `_startTime` and `storeCountedTime()`, and once after the branch, before the goal seeding
- [x] 2.5 Call `rollover(instant)` at the top of `onTick()`, from the pass's instant (D7)

## 3. Extension: midnight timer

- [x] 3.1 Add `_midnightTimeout` (null in `_init`) and `_ensureMidnightTimer()`: one-shot `GLib.timeout_add_seconds(GLib.PRIORITY_LOW, secondsToNextLocalMidnight, cb)`, armed only while the stamp is non-zero; the callback takes its own instant, calls `rollover()`, nulls the field, re-arms, returns `SOURCE_REMOVE` (D6)
- [x] 3.2 Arm it at the end of `_init`; in `onChangeSettings()` arm it when the stamp is non-zero and remove it when the stamp turns `0`
- [x] 3.3 Release `_midnightTimeout` in the `destroy()` override next to `_timeout` / `_pollTimeout` (gotcha 7)

## 4. Preferences

- [x] 4.1 Add a "Reset tracked time daily" `Adw.SwitchRow` (subtitle: at midnight and on the first start of a new day) to the "Start tracker when restart timer" group on the Behavior page, directly after it
- [x] 4.2 Wire it by hand per D2: seed `active` from `get_int() !== 0`; on `notify::active` write today's `YYYYMMDD` or `0`; add a one-line comment saying why `bindSentinelSwitch()` does not apply

## 5. Release and docs

- [x] 5.1 Bump `version` in `metadata.json` and prepend a `CHANGELOG` record in `prefs.js` with one `_()` entry for the daily reset
- [x] 5.2 Mention the daily reset in the `metadata.json` description feature list
- [x] 5.3 `make build` to update `chronos.pot`; translate the new strings in `source/locale/ru`
- [x] 5.4 `AGENTS.md`: add the key to the GSettings table; add a note under the `bindSentinelSwitch()` paragraph that `state-daily-reset-day` is a sentinel key deliberately wired without it (no value row, the on-value is always today)
- [x] 5.5 Regenerate `preferences.png` only if the README shot shows the Behavior page

## 6. Verification

- [x] 6.1 `make build` passes, including the shexli gate, with no new waivers
- [x] 6.2 Headless prefs check (`GSETTINGS_BACKEND=memory`): the switch is off by default; on writes today's `YYYYMMDD`; off writes `0`; a pre-seeded non-zero stamp shows the switch on
- [x] 6.3 Nested Shell driver, init path, paused: stamp = yesterday, tracked = 5:00, reset time = 0:00 → after enable, tracked = 0:00, still paused, stamp = today, log has `auto reset 5:00`
- [x] 6.4 Nested Shell driver, init recovery split: `state-paused=false`, `state-pause-start-time` = today 00:00 − 3600, stamp = yesterday, tracked = 2:00 → tracked ≈ (now − midnight) and counting; log `auto reset 3:00`
- [x] 6.5 Nested Shell driver, same day: stamp = today → no reset and no `auto reset` log line
- [x] 6.6 Nested Shell driver, runtime path: with the tracker counting, set the stamp to yesterday → the next tick resets to the reset value and keeps counting; with it paused and no alarm, invoke the midnight callback directly → reset, stays paused, a new `_midnightTimeout` is armed
- [x] 6.7 Switching off removes `_midnightTimeout`; with the option off and the tracker paused, no source is armed (tick-scheduling scenario)
- [x] 6.8 Check every API used (`GLib.timeout_add_seconds`, `Adw.SwitchRow`) against Shell 46 / libadwaita 1.5. Both are already in use, so this should be a formality
