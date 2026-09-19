## Purpose

Presents a changelog on the About page of the preferences window, so that
features introduced by an automatic update are discoverable without leaving the
extension. It lists releases newest-first with the user-visible changes each one
brought, starting at version 16 and growing forward as later versions ship.

## ADDED Requirements

### Requirement: The About page shows a changelog of releases

The About page SHALL present a changelog section listing released versions of
the extension, each identified by its version number and followed by the
user-visible changes that version introduced. Releases SHALL be ordered
newest-first, so the most recent changes are the ones the user sees without
scrolling.

#### Scenario: The changelog is present on the About page

- **WHEN** the user opens the About page of the preferences window
- **THEN** a changelog section is shown between the logo and the description, listing released versions with their changes

#### Scenario: Newest release first

- **WHEN** the changelog covers more than one release
- **THEN** the most recent version and its changes appear first in the list

#### Scenario: Every change is attributed to a version

- **WHEN** the user reads any change in the changelog
- **THEN** it is presented under the version number that introduced it

### Requirement: The changelog starts at version 16

The changelog SHALL begin its history at version 16 and SHALL NOT cover releases
before it. No entry SHALL describe a feature that version 15 already had.

#### Scenario: Version 16 is the earliest release listed

- **WHEN** the user scrolls to the end of the changelog
- **THEN** version 16 is the last release listed, and no earlier version appears

#### Scenario: Version 16's changes

- **WHEN** the changelog lists version 16
- **THEN** its changes include the break alarm, the start-tracking reminder, the tracked-time goal alarm, the shared postpone dialog, the log line limit, and the About page

### Requirement: The changelog grows forward without rewriting history

Shipping a later release SHALL add that release ahead of the existing ones and
SHALL leave already-published entries unchanged, so that the changelog
accumulates rather than being replaced each release.

#### Scenario: A later release is added

- **WHEN** a version after 16 ships with its own changelog entry
- **THEN** that version is listed ahead of version 16, and version 16's entry is still present and unchanged

### Requirement: The changelog scrolls within a bounded area

The changelog SHALL be confined to a bounded area of the About page and SHALL
scroll within that area when it is taller than it. Confining the list SHALL NOT
displace the description and website link, which remain reachable on the About
page however many releases the changelog covers.

#### Scenario: A changelog longer than its area

- **WHEN** the changelog is taller than the area allotted to it
- **THEN** it scrolls within that area and the description and website link remain reachable on the page

#### Scenario: A changelog shorter than its area

- **WHEN** the changelog fits within the area allotted to it
- **THEN** the whole list is visible at once and offers no scrolling

### Requirement: The changelog is localised

Every changelog entry, and the section's heading, SHALL be translatable through
the extension's existing message catalogues and SHALL be presented in the user's
language when a translation exists. Version numbers SHALL be shown as they are,
untranslated.

#### Scenario: A translated locale

- **WHEN** the user runs the preferences window in a locale whose catalogue translates the changelog
- **THEN** the heading and every entry are shown in that language

#### Scenario: An untranslated locale

- **WHEN** the user runs the preferences window in a locale with no translation for the changelog
- **THEN** the heading and entries are shown in the source language, and the section is still present
