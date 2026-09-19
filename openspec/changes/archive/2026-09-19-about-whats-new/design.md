## Context

See proposal.md — Why.

`AboutPage` (`source/prefs.js:412`) is an `Adw.PreferencesPage` with two groups:
a logo box and an info group holding the description and website rows. It is
constructed in `ChronosPreferences.fillPreferencesWindow` as
`new AboutPage(settings, this.dir)`.

Two constraints shape the approach:

- `Adw.PreferencesPage` is itself a scrolled viewport. A second scroller nested
  inside it is a known GTK annoyance — with default settings the inner widget
  reports its natural height, grows without bound and never scrolls, and if it
  is bounded but greedy the wheel is captured by whichever surface is under the
  pointer.
- Translatable strings are extracted from the source by `xgettext` during
  `make build`. Anything not written as a `_('…')` literal in the source never
  reaches `chronos.pot`, so a changelog read from a data file at runtime could
  not be translated.

## Goals / Non-Goals

**Goals:**

- Adding a release is editing one array in one place — prepend a version and its
  entries, touch nothing else.
- Entry text granular enough that a translator sees one message per change.
- Deterministic layout: however long the changelog grows, the description and
  website link stay reachable.

**Non-Goals:**

- A persisted "seen" flag, a first-run banner, or any dismissal. The section is
  a static part of the About page.
- Highlighting, filtering or collapsing by the running version. The changelog
  shows its full history to everyone; correlating it with `metadata.version`
  buys nothing and needs the version plumbed into the page.
- Rendering `CHANGELOG.md` or `README.md`. Neither is translatable, and parsing
  Markdown in prefs buys nothing here.
- Backfilling version 15 or earlier.

## Decisions

**The changelog is an ordered array of release records in `prefs.js`, newest
first.**

```js
// Newest release first. A release bump prepends an entry; published entries
// are never rewritten.
const CHANGELOG = () => [
  { version: 16, changes: [_('Break alarm …'), _('Start tracking reminder …'), …] },
];
```

Array order *is* display order, so "newest first" is enforced by where the next
release is inserted rather than by a sort the reader has to trust. The whole
literal is wrapped in a thunk so `_()` runs when the page is built, after
`initTranslations`, not at module load.

*Alternatives:* an object keyed by version, sorted descending at render time —
needs a sort, and numeric key order in JS objects would silently work until it
didn't. A separate `changelog.json` in the extension directory — not extractable
by `xgettext`, and it adds file I/O to prefs for no gain.

**Version numbers stay out of the catalogue.**

The per-release heading is formatted from the integer (`Version %d` or plain
`16`), never authored as a translatable literal containing the number, so
shipping a release adds only its change entries to the `.pot` — never a new
message per version heading.

**One `Gtk.ScrolledWindow` holding a single `Gtk.Label`, inside an
`Adw.PreferencesGroup` titled *What's New*.**

The label renders the array as version headings with their changes bulleted
beneath, with `wrap: true`, `xalign: 0` and `use_markup: true` — markup is what
makes a version heading read as a heading (bold) inside a single label, and it
lets long changes wrap instead of widening the window.

*Alternative:* one `Adw.ExpanderRow` per release, or one `ActionRow` per change.
Closer to the rest of the prefs UI and needs no scroller — but the user asked
for a scrolled section, rows force every change into a `title`/`subtitle` shape,
and a changelog that grows every release would stretch the page indefinitely
instead of staying bounded.

**The scroller is bounded, and scrolls only when it must.**

`height_request` around 180px, `propagate_natural_height: true`,
`vscrollbar_policy: Gtk.PolicyType.AUTOMATIC`, `hscrollbar_policy: NEVER`.
Natural-height propagation lets a short changelog sit at its own height with no
scrollbar (spec: "a changelog shorter than its area"), while `height_request`
caps how far it may grow, at which point `AUTOMATIC` turns the scrollbar on.
`max_content_height` is the other half of the same idiom and is set to the same
value as a belt-and-braces bound.

With only version 16 listed, the changelog is close to the box height, so both
sides of that behaviour need checking by eye — see Risks.

**Placement: between `groupLogo` and `groupInfo`.**

The changelog is the page's news; the description and website are reference
material that has been there since the page existed.

**`AboutPage`'s constructor is unchanged.**

Nothing in the section depends on the running version, so `this.metadata` does
not need to reach the page and `new AboutPage(settings, this.dir)` stays as is.

## Risks / Trade-offs

- **Nested scrolling misbehaves** (inner area swallows the page's wheel events,
  or grows unbounded despite the height request) → verify in a nested Shell via
  `make run` with a deliberately over-long changelog, both shorter and longer
  than the box; fall back to a plain unbounded label in the group if the nested
  scroller cannot be made to behave.
- **A release ships without a changelog entry** — the section then silently
  understates what changed, which is a quieter failure than showing wrong
  information but a failure all the same → state the expectation in the comment
  above `CHANGELOG` and in `AGENTS.md`, next to the version bump it follows.
- **`use_markup` with translated text** — a translator can break the label with
  an unescaped `&` or `<`. Change entries are authored as plain text with no
  markup of their own (markup is added around them when assembling the label),
  so nothing in the source invites markup in a translation.
- **The changelog outgrows a single label** — many releases in one wrapped label
  is more string building than a row-per-release would be, and the whole thing
  is rebuilt on every page construction. At the scale of one release per few
  months this is not worth pre-empting.

## Migration Plan

Not applicable — no stored state, no schema key, nothing to roll back beyond the
code change itself.
