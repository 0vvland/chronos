# tick-scheduling Specification

## Purpose

Governs when the extension does periodic work and when it stands down entirely, so that an idle tracker costs the machine nothing while every counter, indicator and alarm behaves exactly as it would under a timer that never stopped.

## Requirements

### Requirement: Periodic work runs only when an outcome depends on it

The extension SHALL perform second-by-second periodic work only while the tracker is counting, or while the tracker is paused and a start alarm could fire at the present moment. At every other moment it SHALL perform no second-by-second work.

A start alarm could fire at the present moment when the start alarm is configured for the current weekday, the current local time falls inside the configured timeframe, the alarm has not already fired for the current paused period, and it has not been dismissed for the current day. These are the same conditions that decide whether a start notification is raised, so the extension never stands down while an alarm is pending and never keeps working after the last pending outcome is gone.

#### Scenario: Paused with no start alarm configured

- **WHEN** the tracker is paused and no start-alarm weekday is selected
- **THEN** the extension performs no periodic work of any kind until the tracker is started again

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

### Requirement: The extension notices the timeframe opening without a second-by-second timer

While the tracker is paused and a start alarm is configured for the current day but cannot fire at the present moment, the extension SHALL check at most once a minute whether it has become able to fire, and SHALL resume second-by-second work as soon as it has. When no start alarm is configured for the current day, the extension SHALL NOT perform even that check.

The once-a-minute check SHALL derive the current weekday and time of day afresh on each check rather than counting down to a moment computed in advance, so that it stays correct across a suspend, a timezone change, and a daylight-saving transition.

#### Scenario: Timeframe opens while paused

- **WHEN** the tracker has been paused since the previous evening, the delay is 15 minutes, and the timeframe opens at 09:00 on a selected weekday
- **THEN** the system notifies the user at 09:15, no more than a minute later than it would have under a timer that never stopped

#### Scenario: No check at all with the shipped defaults

- **WHEN** the tracker is paused with no start-alarm weekday selected
- **THEN** the extension performs no once-a-minute check

#### Scenario: Machine suspended across the timeframe opening

- **WHEN** the machine is suspended at 08:00 with the tracker paused and resumes at 10:00 on a selected weekday whose timeframe opened at 09:00 with a 15-minute delay
- **THEN** the system notifies the user 15 minutes after the timeframe opening as measured on the wall clock, and not at a moment shifted by the length of the suspend

#### Scenario: Timeframe closes while paused

- **WHEN** the tracker remains paused past 18:00, the close of the timeframe, without the alarm having fired
- **THEN** the extension returns to the once-a-minute check and performs no further second-by-second work that day

### Requirement: Standing down is never observable in the tracked time

Suspending periodic work SHALL NOT change the tracked time the extension reports or stores. Tracked time SHALL continue to reflect only the periods during which the tracker was counting, and the value shown on the indicator SHALL be correct whenever the user can see it change.

#### Scenario: Tracked time across a long pause

- **WHEN** the tracker is paused for eight hours and then started again
- **THEN** the tracked time is the same as it was when the tracker was paused, and counting continues from that value

#### Scenario: Indicator is correct on resuming

- **WHEN** the user starts the tracker after a pause during which the extension stood down
- **THEN** the indicator shows the correct tracked time within a second of the start

#### Scenario: Tracked time edited in preferences while paused

- **WHEN** the user changes the tracked time from the preferences while the tracker is paused and the extension has stood down
- **THEN** the indicator shows the new value without waiting for the tracker to be started

#### Scenario: Counter is not lost when the session ends during a pause

- **WHEN** the tracker is paused, the extension has stood down, and the session is then locked or the extension disabled
- **THEN** the stored tracked time is the same value it held when the tracker was paused

### Requirement: Standing down is never observable in the alarms

Suspending periodic work SHALL NOT change when the break, start and goal alarms fire, nor which of them fire. Each alarm SHALL be raised at the same moment it would be raised under a timer that never stopped, except that a start alarm anchored to the opening of the timeframe may be raised up to a minute later.

A postponement accepted while the extension is standing down SHALL take effect, resuming periodic work if the postponed alarm can fire.

#### Scenario: Break alarm is unaffected

- **WHEN** the break alarm is configured and the user tracks an uninterrupted stretch that reaches the interval
- **THEN** the break notification is raised at the same moment it was raised before this change

#### Scenario: Goal alarm is unaffected

- **WHEN** the goal alarm is enabled and tracked time reaches the target
- **THEN** the goal notification is raised at the same moment it was raised before this change

#### Scenario: Postponing a start alarm re-arms the extension

- **WHEN** the user postpones the start notification by 5 minutes while the tracker stays paused inside the timeframe
- **THEN** the system notifies the user again 5 minutes later, having resumed periodic work to do so

#### Scenario: Pausing inside the timeframe still schedules a start alarm

- **WHEN** the user pauses the tracker at 12:30 inside an open timeframe with a 15-minute delay
- **THEN** the system notifies the user at 12:45

#### Scenario: Reconfiguring the alarms while paused

- **WHEN** the tracker is paused with the extension stood down and the user selects the current weekday for the start alarm in preferences, placing the current time inside the timeframe
- **THEN** the alarm becomes able to fire without the user having to start the tracker or restart the extension

#### Scenario: Restarting the tracker while paused

- **WHEN** the tracker is paused with the extension stood down and the user chooses Restart with automatic start after reset enabled
- **THEN** the tracker begins counting and the indicator updates every second
