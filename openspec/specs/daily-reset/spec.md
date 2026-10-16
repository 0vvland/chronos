# daily-reset Specification

## Purpose

Starts every local calendar day from the configured reset time without a manual Restart, while keeping the tracker's running state and the boundary between days intact.

## Requirements

### Requirement: The daily reset is an opt-in preference stored as a day

The system SHALL offer a daily reset switch on the Behavior preferences page, placed directly after the "Start tracker when restart timer" option. The option SHALL be off by default.

The option SHALL be stored in a single setting holding the local calendar day of the most recent reset as `YYYYMMDD`. The value `0` SHALL mean the option is off. Switching the option on SHALL store the current local day. Switching it off SHALL store `0`.

#### Scenario: Off by default

- **WHEN** the extension is installed with default settings
- **THEN** the daily reset switch is off and the tracked time is never reset automatically

#### Scenario: Switching on mid-day keeps today's tracked time

- **WHEN** the tracked time is 3:20 and the user switches the daily reset on at 14:00
- **THEN** the tracked time stays 3:20 for the rest of that day, including across a lock and unlock

#### Scenario: Switching off

- **WHEN** the user switches the daily reset off
- **THEN** the tracked time is not reset at the next midnight or on any later start

### Requirement: Tracked time resets once per local calendar day

While the daily reset is on, the system SHALL set the tracked time to the configured reset time once per local calendar day, as determined by the system time zone. The reset SHALL happen at local midnight when the extension is running at that moment. Otherwise it SHALL happen on the first start of the extension on a day later than the stored one. After a reset the stored day SHALL be the current local day.

Any difference between the current local day and the stored day SHALL count as a new day, including a clock that moved backwards.

#### Scenario: Midnight while running

- **WHEN** the daily reset is on, the reset time is 0:00, and the session stays unlocked across midnight
- **THEN** the indicator shows 0:00 at midnight, give or take the time the extension takes to notice

#### Scenario: First start of a new day

- **WHEN** the daily reset is on and the machine is shut down at 19:00 and booted at 08:00 the next day
- **THEN** the tracked time is the reset time when the indicator appears

#### Scenario: Locked overnight

- **WHEN** the daily reset is on and the screen is locked at 19:00 and unlocked at 08:00 the next day
- **THEN** the tracked time is reset on unlock

#### Scenario: Restart on the same day

- **WHEN** the daily reset is on and the machine is restarted in the afternoon of a day that has already been reset
- **THEN** the tracked time is not reset again

#### Scenario: Several days away

- **WHEN** the daily reset is on and the extension does not run for three days
- **THEN** the next start resets the tracked time exactly once

### Requirement: An automatic reset preserves the running state

An automatic reset SHALL NOT start or pause the tracker. A tracker that is counting SHALL keep counting from the reset time, and the time tracked after local midnight SHALL count toward the new day. A paused tracker SHALL stay paused, whatever the "Start tracker when restart timer" option is set to.

#### Scenario: Counting across midnight

- **WHEN** the daily reset is on, the reset time is 0:00, and the tracker counts continuously from 23:30 until 00:20
- **THEN** at 00:20 the tracked time is 0:20

#### Scenario: Paused across midnight

- **WHEN** the daily reset is on, the tracker is paused at midnight, and "Start tracker when restart timer" is on
- **THEN** the tracked time is reset and the tracker remains paused

### Requirement: Recovered time is split at the day boundary

When the extension recovers the time that elapsed while it was disabled with the tracker counting (pause on lock off), and a new day has begun since then, the recovered time before the most recent local midnight SHALL belong to the day that ended. The recovered time after it SHALL be counted on top of the reset time.

#### Scenario: Tracking left on overnight while locked

- **WHEN** pause on lock is off, the daily reset is on with a reset time of 0:00, the tracker is counting when the screen locks at 23:00, and the screen is unlocked at 08:00
- **THEN** the tracked time on unlock is 8:00 and the tracker is counting

### Requirement: Automatic resets are logged with the closing total

When state logging is on, each automatic reset SHALL append one `auto reset` entry to the log. The entry SHALL carry the tracked time of the day that ended, measured at the day boundary, not the value after the reset or a value that includes time from the new day.

#### Scenario: Log entry at a new day's start

- **WHEN** logging is on, the tracker was counting until the screen locked at 23:00 with 7:45 tracked, pause on lock is off, and the screen is unlocked at 08:00
- **THEN** the log has an `auto reset` entry carrying 8:45, the total at midnight

#### Scenario: Manual restart is unchanged

- **WHEN** the user chooses Restart from the menu
- **THEN** the log has a `reset` entry as before and no `auto reset` entry
