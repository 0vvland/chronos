## 1. Changelog content

- [x] 1.1 Add a `CHANGELOG` thunk near the other module constants in `source/prefs.js`, returning an array of `{ version, changes }` records ordered newest-first, so `_()` runs at page-build time
- [x] 1.2 Write the version 16 record: break alarm, start-tracking reminder, tracked-time goal alarm, shared postpone dialog, log line limit, About page — each change its own `_()` literal
- [x] 1.3 Comment the array with the two rules it has to keep: newest release first, and published entries are never rewritten

## 2. About page section

- [x] 2.1 Build a *What's New* `Adw.PreferencesGroup` in `AboutPage._init` and add it between `groupLogo` and `groupInfo`
- [x] 2.2 Fill it with a bounded `Gtk.ScrolledWindow` (`height_request` ~180, `propagate_natural_height: true`, `max_content_height` matching, vertical policy `AUTOMATIC`, horizontal `NEVER`) holding one wrapping `Gtk.Label`
- [x] 2.3 Render the array into that label: a markup version heading per release, formatted from the integer and not translated, with its changes bulleted beneath

## 3. Localisation

- [x] 3.1 Run `make build` to regenerate `source/chronos.pot` and confirm every change entry and the group title were extracted, and that no version number became a message
- [x] 3.2 Add Russian translations for the new messages in `source/locale/ru/LC_MESSAGES/chronos.po` and rebuild the `.mo`

## 4. Verification

- [x] 4.1 `make run` and open About: the *What's New* section appears above the description, with version 16 and its six changes
- [x] 4.2 With a second, newer release record temporarily prepended, confirm it renders above version 16 and version 16's entry is untouched
- [x] 4.3 With the changelog temporarily padded past the box height, confirm it scrolls inside its own area and that the description and website link stay reachable on the page
- [x] 4.4 With a short changelog, confirm the box sits at its natural height and shows no scrollbar
- [x] 4.5 Run the preferences window under `LANGUAGE=ru` and confirm the heading and entries are translated while version numbers are not

## 5. Documentation

- [x] 5.1 Update the `AGENTS.md` architecture note for `prefs.js` to mention the About page changelog, and record that a version bump means prepending a release entry
