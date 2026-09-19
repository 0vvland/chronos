## Why

Version 16 adds a large batch of user-visible features — three alarms, the
postpone dialog, the log line limit, the About page itself — on top of the
published version 15, and nothing in the extension tells the user any of it
happened. Preferences is the only surface the user ever opens deliberately, and
the About page is the only place on it that is not a control, so it is where
release notes belong. The same will be true of every release after this one, so
the section is built as a changelog that grows, not as a one-off note.

## What Changes

- The About page gains a **What's New** changelog section, placed between the
  logo and the existing description/website group.
- The changelog lists releases newest-first, each headed by its version number
  and followed by that version's user-visible changes.
- Version 16 is where the changelog starts: it is the only release covered for
  now, and earlier releases are not backfilled. Later releases are added ahead
  of it as they ship, and nothing already in the list is rewritten.
- The list lives inside a fixed-height scrolling area, so the changelog can grow
  over releases without ever pushing the description and website link off the
  page.
- The entries shipped for version 16 cover: the break alarm, the start-tracking
  reminder, the tracked-time goal alarm, the postpone dialog shared by them, the
  log line limit, and the About page.
- All entry text is translatable and carried in the existing `.po` catalogues.

## Capabilities

### New Capabilities

- `whats-new`: the changelog section on the About page — what it lists, how
  releases are ordered and attributed, where the history starts, and how it
  behaves as the list outgrows the space it is given.

### Modified Capabilities

<!-- None. The existing About page has no spec, and its description and website
     rows are unchanged by this change. -->

## Impact

- `source/prefs.js` — `AboutPage` gains the new group and the changelog data.
- `source/chronos.pot` and `source/locale/ru/LC_MESSAGES/chronos.po` — new
  translatable strings; `make build` regenerates the catalogues.
- No GSettings keys, no schema change, no change to `extension.js`.
- `AGENTS.md` — the About page description gains the new section, and a note
  that a release bump means a new changelog entry.
