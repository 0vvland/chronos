## Why

`~/timeTrack.log` is append-only and never pruned, so a user who leaves logging on accumulates an unbounded file that grows for as long as the extension is installed. There is no way to cap it short of deleting the file by hand.

## What Changes

- Add a `pref-log-max-lines` preference: the maximum number of lines to keep in the log file. `0` means never truncate, which stays the default so existing users see no behaviour change.
- On every enable, when logging is on and the limit is above `0`, the extension checks the log file and — if it holds more lines than the limit — rewrites it keeping only the newest `limit` lines. The check runs once per enable, before the first `init` entry is written.
- Add a switch plus a folded spin row to the Behavior page's logging group, following the existing break-alarm pattern: the switch is not bound to the key, it writes `0` when off and the last chosen value when on, and the spin row is hidden while the switch is off.

Not a breaking change: the default of `0` preserves today's behaviour exactly.

## Capabilities

### New Capabilities

- `log-truncation`: bounding the size of the state-change log file by line count, and the preference that controls it.

### Modified Capabilities

<!-- None. The existing logging behaviour has no spec file; this change only adds
     truncation on top of it and does not alter what gets logged or when. -->

## Impact

- `source/schemas/org.gnome.shell.extensions.chronos.gschema.xml` — new `pref-log-max-lines` key.
- `source/extension.js` — truncation check in `_init`, ahead of `logging('init')` (currently line 87); reads and rewrites the log file before the append stream is opened.
- `source/prefs.js` — new switch and spin row in the existing logging group on the Behavior page.
- `source/chronos.pot` and `source/locale/ru` — new translatable strings.
- `AGENTS.md` — GSettings key table.

No new dependencies. The file rewrite uses `Gio` calls already imported by `extension.js`.
