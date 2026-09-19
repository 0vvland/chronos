## Context

See proposal.md — Why.

Two properties of the current logging code shape the whole approach:

- `logging()` (extension.js:382) opens `_logOutputStream` lazily on the first call and `onDestroy()` closes it. Between enables nothing holds the file open, so a rewrite performed at enable time is unopposed — provided it runs before `logging('init')` at extension.js:87.
- `metadata.json` declares no `session-modes`, so the default `['user']` applies and the extension is disabled on screen lock and re-enabled on unlock. "Once per enable" is therefore a frequent hook in practice, not a once-per-boot one.

Log volume is small: `init`, `collect inactive time`, `pause`, `start`, `reset`, `destroy`, each roughly 45 bytes.

## Goals / Non-Goals

**Goals:**

- Keep the truncation path strictly ordered ahead of the first write, so no log entry is lost or resurrected.
- Fail soft — a truncation problem must never prevent the extension from starting or logging.

**Non-Goals:**

- Holding the limit exactly at all times. The bound is approximate within a session by design (see specs — "Truncation runs once per enable").
- Rotating to numbered files, compressing, or pruning by age. Line count is the only policy.
- Reacting to a limit change while running.

## Decisions

### Read and rewrite synchronously

`Gio`'s synchronous `load_contents` / `replace_contents` on the log file, once per enable.

*Alternative considered:* the async variants. They avoid blocking the Shell main loop, which is the usual GNOME guidance, but they force `logging('init')` to either queue behind the callback or run against a file that is about to be overwritten — losing the init entry or resurrecting the tail that was just dropped. The ordering bug that mistake produces is silent and data-losing.

The blocking cost is a single read of a file that is realistically tens of kilobytes, on a path that already does synchronous GSettings work. Deterministic ordering is worth more here than a few milliseconds off the unlock path.

### Truncate before the append stream is opened

The check runs in `_init` immediately above `logging('init')`. At that point `_logOutputStream` is `null`, so the rewrite touches a file no one holds, and the subsequent `append_to` opens the already-trimmed file. No close/reopen dance is needed anywhere.

*Alternative considered:* doing it inside `logging()` behind a "first call this session" flag. That co-locates the logic with the file handling but hides an expensive one-shot inside a function called on every state change, and it still has to run before the stream is opened — the same constraint, less visibly.

### Split on newline, drop the trailing empty element

Every entry ends in `\n`, so splitting the file contents on `\n` yields a trailing empty string that is not a line. That element is dropped before counting and before slicing, and the rewritten content is the kept lines each terminated with `\n`.

This is the single most likely defect in the change: getting it wrong either appends a growing run of blank lines or silently drops the newest entry on each pass, and because truncation runs on every unlock the error compounds daily rather than showing up once. It is called out here and in the spec's "Appending continues after truncation" scenario so it gets an explicit test.

### The switch writes the sentinel; the spin row never can

`pref-log-max-lines` uses `0` as the off sentinel, matching `pref-break-alarm-interval`. The UI follows the existing break-alarm construction at prefs.js:179–216 exactly: the switch is *not* bound to the key, it writes `0` or the last chosen value, the detail row's `visible` tracks the switch, and the last non-zero value is held in a `this._` field seeded from a module-level default constant when the stored value is `0`.

Keeping the spin row's minimum at `1` means the sentinel has exactly one producer — the switch. A spin row that could reach `0` would give two independent ways to express "off" and let the switch and the stored value disagree.

*Alternative considered:* a separate boolean key, as `pref-goal-alarm-enabled` does. That exists because `0` is a legal goal target; here `0` lines is not a meaningful limit, so the sentinel is unambiguous and a second key would be redundant.

### Truncation is gated on logging being enabled

A file nobody is writing to does not need bounding, and the gate saves a read on every unlock for the majority of users who have logging off. This treats the limit as a log-rotation policy rather than a disk-hygiene one — a user who disables logging keeps whatever file they had.

## Risks / Trade-offs

- **Off-by-one on the trailing newline corrupts the log progressively** → Covered by an explicit spec scenario; verify by appending after a truncation and checking for neither a blank line nor a lost entry.
- **A crash between the read and the rewrite could lose the log** → `replace_contents` is atomic, so the file is either the old content or the new one, never a partial write. Not mitigated further.
- **Synchronous read on the unlock path** → Bounded by the file staying small, which is precisely what this feature enforces. The pathological case is the very first run after a user sets a limit on a log grown over years; that is one slow read, once.
- **Truncation drops the front of the file, so the oldest surviving entry is mid-session** — typically a `pause` or `start` with no preceding `init`. Expected, not a defect: anything reading the file must treat the first session in it as partial.
- **The file exceeds the limit between enables** → Accepted; see Non-Goals. A machine that never locks can drift, but only by a handful of lines per day.
