## MODIFIED Requirements

### Requirement: Periodic work runs only when an outcome depends on it

The extension SHALL perform second-by-second periodic work only while the tracker is counting, or while the tracker is paused and a start alarm could fire at the present moment. At every other moment it SHALL perform no second-by-second work.

A start alarm could fire at the present moment when the start alarm is configured for the current weekday, the current local time falls inside the configured timeframe, the alarm has not already fired for the current paused period, and it has not been dismissed for the current day. These are the same conditions that decide whether a start notification is raised, so the extension never stands down while an alarm is pending and never keeps working after the last pending outcome is gone.

While the daily reset is on, the extension SHALL additionally wake once at each local midnight to apply it. That wakeup is a single scheduled moment per day, not a recurring check, and SHALL NOT exist while the daily reset is off.

#### Scenario: Paused with no start alarm configured

- **WHEN** the tracker is paused, no start-alarm weekday is selected, and the daily reset is off
- **THEN** the extension performs no periodic work of any kind until the tracker is started again

#### Scenario: Paused with only the daily reset on

- **WHEN** the tracker is paused, no start-alarm weekday is selected, and the daily reset is on
- **THEN** the extension wakes only at local midnight and performs no other periodic work

#### Scenario: Paused outside the timeframe

- **WHEN** the timeframe is 09:00 to 18:00 and the tracker is paused at 22:00 on a selected weekday
- **THEN** the extension performs no second-by-second work

#### Scenario: Paused inside the timeframe

- **WHEN** the tracker is paused at 10:00 on a selected weekday whose timeframe is open and the alarm has neither fired nor been dismissed
- **THEN** the extension performs second-by-second work

#### Scenario: Standing down once the alarm has fired

- **WHEN** the start notification is raised and the user leaves it untouched while remaining paused
- **THEN** the extension performs no further second-by-second work for that paused period

#### Scenario: Standing down once the alarm is dismissed for the day

- **WHEN** the user dismisses the start notification for the day while remaining paused inside the timeframe
- **THEN** the extension performs no further second-by-second work that day

#### Scenario: Counting always works

- **WHEN** the tracker is counting
- **THEN** the extension performs second-by-second work regardless of how the alarms are configured
