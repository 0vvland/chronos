## 1. Settings key

- [x] 1.1 Add the `pref-log-max-lines` int key to `source/schemas/org.gnome.shell.extensions.chronos.gschema.xml`, default `0`, with a summary and a description noting that `0` means never truncate
- [x] 1.2 Add the key to the GSettings table in `AGENTS.md`, noting the `0 = off` sentinel alongside the break and start alarms

## 2. Truncation in the extension

- [x] 2.1 Add a truncation method to `Chronos` in `source/extension.js` that returns early when logging is disabled, when the limit is `0`, or when the log file does not exist
- [x] 2.2 Read the log file, split on `\n`, drop the trailing empty element, and return without writing when the line count is at or below the limit
- [x] 2.3 When over the limit, rewrite the file with the last `limit` lines, each terminated with `\n`, using an atomic replace
- [x] 2.4 Wrap the read and rewrite so a failure leaves the existing file intact and lets `_init` continue — the extension must still start and still log
- [x] 2.5 Call the method in `_init` immediately above `this.logging('init')` (currently line 87), so it runs before the append stream is opened

## 3. Preferences UI

- [x] 3.1 Add a module-level default constant for the initial line limit, matching how `DEFAULT_BREAK_INTERVAL` is used
- [x] 3.2 In the Behavior page's logging group in `source/prefs.js`, add a switch that is not bound to the key, seeded active from a stored limit above `0`, following the break-alarm construction at prefs.js:179–216
- [x] 3.3 Add a spin row for the line count with a minimum of `1`, hidden while the switch is off, writing to the key only while the switch is on
- [x] 3.4 Hold the last chosen non-zero value in a `this._` field so turning the switch back on restores it; turning the switch off writes `0`

## 4. Translations and docs

- [x] 4.1 Regenerate `source/chronos.pot` and add the new strings to `source/locale/ru/LC_MESSAGES/chronos.po`
- [x] 4.2 Update the logging bullet in the `description` field of `source/metadata.json` and in `README.md` if either describes the log file's growth

## 5. Verification

- [x] 5.1 Run `make build` and confirm the schema compiles on install
- [x] 5.2 With a log file larger than the limit, enable the extension and confirm the file is reduced to exactly the limit with the newest lines kept in order
- [x] 5.3 Pause the tracker after a truncation and confirm the new entry appends with no blank line and no lost or duplicated line
- [x] 5.4 Confirm a file at or under the limit is left unchanged, and that no file is created when none exists
- [x] 5.5 Confirm the limit is untouched at enable when logging is disabled or the limit is `0`
- [x] 5.6 In preferences, confirm the switch hides the spin row and writes `0`, that turning it back on restores the previous value, and that the spin row stops at `1`
