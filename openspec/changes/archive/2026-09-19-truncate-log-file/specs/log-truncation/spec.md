## Purpose

Bounds the size of the state-change log file by capping how many lines it keeps, so that leaving logging enabled indefinitely does not grow `~/timeTrack.log` without limit. The cap keeps the newest entries and discards the oldest.

## ADDED Requirements

### Requirement: Log line limit preference

The extension SHALL provide a preference for the maximum number of lines to keep in the log file. A value of `0` SHALL mean the log file is never truncated, and SHALL be the default so that upgrading does not change behaviour for an existing user. A value above `0` SHALL be the number of lines the log file is allowed to keep.

#### Scenario: Default leaves the log untouched

- **WHEN** the user has never set a line limit and logging is enabled
- **THEN** the log file grows without being truncated, exactly as before

#### Scenario: Limit above zero caps the file

- **WHEN** the line limit is set to 500
- **THEN** the log file is allowed to keep at most 500 lines

### Requirement: Truncation keeps the newest lines

When the log file holds more lines than the limit, the extension SHALL rewrite it so that only the newest lines are kept, discarding the oldest. The number of lines kept SHALL equal the limit exactly. The surviving content SHALL be unchanged in order and text, and SHALL remain a valid log file that later entries append to normally.

#### Scenario: Oldest lines are discarded

- **WHEN** the log file holds 1200 lines and the limit is 500
- **THEN** the file afterwards holds the last 500 of those lines, in their original order, and the first 700 are gone

#### Scenario: Newest entry always survives

- **WHEN** the log file is truncated
- **THEN** the most recent entry written before the truncation is still present as the last line

#### Scenario: Appending continues after truncation

- **WHEN** the log file has been truncated and the tracker is then paused
- **THEN** the pause entry is appended as the next line, with no blank line and no duplicated line between it and the preserved content

### Requirement: Truncation runs once per enable

The extension SHALL check whether truncation is needed once each time it is enabled, and SHALL perform that check before writing its first log entry of the session. It SHALL NOT check again while it remains enabled. Consequently the file MAY exceed the limit by the number of entries written during a single session, and SHALL be brought back within the limit at the next enable.

#### Scenario: Check happens at enable

- **WHEN** the extension is enabled, the limit is 100, and the log file holds 400 lines
- **THEN** the file is reduced to 100 lines before the enable entry for this session is written

#### Scenario: Overshoot within a session is tolerated

- **WHEN** the file was truncated to the limit at enable and six further entries are logged during the session
- **THEN** the file is allowed to hold the limit plus six lines until the extension is next enabled

#### Scenario: Changing the limit takes effect at the next enable

- **WHEN** the user lowers the limit while the extension is running
- **THEN** the log file is left alone until the extension is next enabled, at which point the new limit is applied

### Requirement: Truncation is skipped when it cannot apply

The extension SHALL NOT read or rewrite the log file when logging is disabled, when the limit is `0`, or when the log file does not exist. When the file holds the limit or fewer lines, the extension SHALL leave it byte-for-byte unchanged.

#### Scenario: Logging disabled

- **WHEN** logging is disabled and a line limit above zero is set
- **THEN** the extension does not read or modify the log file at enable

#### Scenario: File already within the limit

- **WHEN** the log file holds 40 lines and the limit is 100
- **THEN** the file is left unchanged

#### Scenario: File does not exist yet

- **WHEN** no log file exists and a line limit above zero is set
- **THEN** the extension does not create one at enable, and does not report an error

### Requirement: Log file remains usable after a failed truncation

If the log file cannot be read or rewritten, the extension SHALL continue to start and SHALL continue logging, leaving the existing log file intact rather than discarding entries or losing the session's log output.

#### Scenario: Rewrite fails

- **WHEN** the log file cannot be rewritten at enable
- **THEN** the extension still starts, the existing log file is not left truncated or emptied, and entries for the session are still recorded

### Requirement: Line limit is configured by a switch and a folded spin control

The preferences UI SHALL present the limit as a switch alongside the existing logging option, with a numeric control that is hidden while the switch is off. Turning the switch off SHALL set the limit to `0`. Turning the switch on SHALL restore the last value the user chose. The numeric control SHALL NOT allow a value below `1`, so that `0` is reachable only through the switch.

#### Scenario: Switch off hides the control and disables truncation

- **WHEN** the user turns the truncation switch off
- **THEN** the numeric control is hidden and the limit is set to `0`

#### Scenario: Switch on restores the previous value

- **WHEN** the user turns the switch off with the limit at 500 and then turns it back on
- **THEN** the numeric control reappears showing 500 and the limit is set to 500

#### Scenario: Control cannot reach zero

- **WHEN** the numeric control is shown and the user decrements it to its minimum
- **THEN** it stops at `1` and the limit never becomes `0` through the control

#### Scenario: Switch reflects the stored limit when preferences open

- **WHEN** the user opens preferences with the limit stored as `0`
- **THEN** the switch is off and the numeric control is hidden
