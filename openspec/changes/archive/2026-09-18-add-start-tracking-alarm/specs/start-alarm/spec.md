## Purpose

Reminds the user to start tracking when the tracker has been left paused during the hours they said they work, so that forgotten starts and abandoned pauses do not silently cost tracked time. The reminder is offered while the user is present at an unlocked session, and can be acted on, postponed for the moment, or silenced for the rest of the day.

## ADDED Requirements

### Requirement: Start alarm is active only inside the configured working timeframe

The start alarm SHALL be active only on the weekdays the user selected and only between the configured start and end times of day, evaluated in local time. An empty weekday selection SHALL be the single representation of the alarm being off. A timeframe whose end is not later than its start SHALL leave the alarm inactive. The preferences SHALL offer a switch that turns the alarm off and on without the user having to clear the weekday selection by hand, and turning it back on SHALL restore the weekday selection the user last chose.

#### Scenario: No weekday selected disables the alarm

- **WHEN** no weekday is selected
- **THEN** the system never raises a start notification

#### Scenario: Paused on a weekday that is not selected

- **WHEN** the tracker is paused all day on a weekday the user did not select
- **THEN** the system raises no start notification that day

#### Scenario: Paused before the timeframe opens

- **WHEN** the timeframe is 09:00 to 18:00 and the tracker is paused at 07:00
- **THEN** the system raises no start notification before 09:00

#### Scenario: Switching the alarm off and on again

- **WHEN** the user switches the start alarm off in preferences and later switches it on again
- **THEN** no alarm is armed while the switch is off, and on switching it back on the weekday selection the user last chose is restored

#### Scenario: An end time that is not after the start time

- **WHEN** the configured timeframe ends at or before the time it starts
- **THEN** the system never raises a start notification

### Requirement: The alarm is anchored to the latest of the pause, the session start, and the timeframe opening

While the tracker is paused, the start alarm SHALL be scheduled for the configured delay after the latest of: the moment the current pause began, the moment the extension was enabled, and the moment the timeframe opened. The alarm SHALL therefore treat a tracker that was already paused when the timeframe opened, a tracker paused by the user during the timeframe, and a session enabled mid-timeframe with the tracker paused, all under one rule.

#### Scenario: Tracker was already paused when the timeframe opened

- **WHEN** the timeframe opens at 09:00, the delay is 15 minutes, and the tracker has been paused since the previous evening
- **THEN** the system notifies the user at 09:15

#### Scenario: User pauses during the timeframe

- **WHEN** the timeframe is open, the delay is 15 minutes, and the user pauses the tracker at 12:30
- **THEN** the system notifies the user at 12:45

#### Scenario: Extension is enabled mid-timeframe with the tracker paused

- **WHEN** the screen is unlocked at 10:00 during an open timeframe with a 15-minute delay and the tracker is paused
- **THEN** the system notifies the user at 10:15 rather than immediately

#### Scenario: Enabling the extension does not produce an immediate alert

- **WHEN** the extension is enabled during an open timeframe after the tracker has been paused for several hours
- **THEN** the system waits a full delay before notifying the user

### Requirement: The alarm never fires outside the timeframe

A scheduled start alarm whose moment falls outside the configured timeframe SHALL NOT fire, and SHALL NOT be brought forward to the close of the timeframe. The alarm SHALL be scheduled again when the timeframe next opens on a selected weekday.

#### Scenario: Pause shortly before the timeframe closes

- **WHEN** the timeframe closes at 18:00, the delay is 15 minutes, and the user pauses the tracker at 17:55
- **THEN** the system raises no start notification that day

#### Scenario: A new day reopens the timeframe

- **WHEN** the tracker remains paused overnight and the timeframe opens again on the next selected weekday
- **THEN** the system notifies the user one delay after that opening

### Requirement: Starting the tracker disarms the alarm

Starting the tracker SHALL drop any scheduled start alarm, including one that was postponed. The alarm SHALL be scheduled again only when the tracker is paused once more.

#### Scenario: Starting before the alarm fires

- **WHEN** the tracker is paused with a start alarm scheduled and the user starts the tracker
- **THEN** the system raises no start notification while the tracker is running

#### Scenario: A later pause schedules a new alarm

- **WHEN** the user starts the tracker and pauses it again later within the timeframe
- **THEN** the system notifies the user one delay after that later pause

### Requirement: The alarm fires once per idle period

The start alarm SHALL raise at most one notification per uninterrupted period of being paused. Once it has fired, it SHALL NOT be scheduled again for that same paused period unless the user postpones it. Starting the tracker and pausing it again SHALL begin a new paused period.

#### Scenario: No repeat within the same paused period

- **WHEN** the start notification is raised and the user leaves it untouched while remaining paused
- **THEN** the system raises no further start notification until the tracker has been started and paused again

#### Scenario: A new paused period fires again

- **WHEN** the start notification has already fired, and the user starts the tracker and then pauses it again inside the timeframe
- **THEN** the system notifies the user one delay after that pause

### Requirement: The start notification offers to start, postpone, or dismiss for the day

The start notification SHALL offer an action that starts the tracker, an action that postpones the reminder by a duration chosen from a list, and an action that dismisses the reminder for the remainder of the day. The postpone durations SHALL be presented as human-readable durations, offered in ascending order without duplicates. A postponed alarm SHALL fire again after the chosen duration and SHALL itself be postponable, without limit, subject to the timeframe.

#### Scenario: Starting from the notification

- **WHEN** the user chooses the start action on the start notification
- **THEN** the tracker begins counting and no further start notification is raised while it runs

#### Scenario: Postponing re-arms the alarm

- **WHEN** the user postpones the start notification by 5 minutes
- **THEN** the system notifies the user again 5 minutes later, provided the tracker is still paused

#### Scenario: Repeated postponement

- **WHEN** the user postpones a start notification that was itself the result of an earlier postponement
- **THEN** the system notifies the user again after the newly chosen duration

#### Scenario: Postponing past the close of the timeframe

- **WHEN** the user postpones the start notification by a duration that lands after the timeframe closes
- **THEN** the system raises no further start notification that day

#### Scenario: Postpone durations are readable and ordered

- **WHEN** the user opens the postpone duration list
- **THEN** each offered duration appears exactly once, the list is ordered from shortest to longest, and each is shown as a human-readable duration rather than a raw number of seconds

### Requirement: Dismissal silences the alarm for the rest of the day and survives a lock

Dismissing the start notification for the day SHALL prevent any further start notification until the next calendar day in local time, regardless of how many times the tracker is started and paused in between. The dismissal SHALL survive the extension being disabled and enabled again, so that locking the screen does not revive the alarm. A postponement SHALL NOT survive the extension being disabled and enabled again; on being enabled the alarm SHALL be scheduled afresh under the anchoring rule.

#### Scenario: No further notification after dismissal

- **WHEN** the user dismisses the start notification for the day and then pauses the tracker again within the timeframe
- **THEN** the system raises no further start notification that day

#### Scenario: Dismissal survives a screen lock

- **WHEN** the user dismisses the start notification for the day and the screen is later locked and unlocked with the tracker still paused inside the timeframe
- **THEN** the system raises no further start notification that day

#### Scenario: Dismissal expires at midnight

- **WHEN** the user dismisses the start notification and the timeframe opens on the next selected weekday
- **THEN** the system notifies the user one delay after that opening

#### Scenario: Postponement does not survive a screen lock

- **WHEN** the user postpones the start notification and the screen is then locked and unlocked with the tracker still paused inside the timeframe
- **THEN** the system notifies the user one delay after the unlock rather than at the postponed moment

### Requirement: The start alarm is independent of the break alarm

The start alarm SHALL be scheduled, fired, postponed and dismissed without regard to the break alarm's configuration or state, and the break alarm's behaviour SHALL be unaffected by the start alarm. A start notification arriving a delay after the user pauses in response to a break notification is correct behaviour and SHALL NOT be suppressed.

#### Scenario: Pausing after a break notification still schedules a start alarm

- **WHEN** the break notification is raised, the user pauses the tracker, and the session remains unlocked inside the timeframe
- **THEN** the system notifies the user to start tracking one delay after that pause

#### Scenario: Break alarm off does not disable the start alarm

- **WHEN** the break alarm is off and the tracker is paused inside the timeframe
- **THEN** the start alarm behaves exactly as it does when the break alarm is on

### Requirement: The start notification is user-presentable

The start notification SHALL present a translated title, body, and action labels, drawn from the extension's translation catalogue like the rest of the user-facing interface. The extension SHALL NOT expose any menu action whose sole purpose is to raise a start notification for testing.

#### Scenario: Notification text is translated

- **WHEN** the start notification is raised under a locale with a translation available
- **THEN** its title, body, and action labels are shown in that locale

#### Scenario: No debug trigger in the menu

- **WHEN** the user opens the extension menu
- **THEN** no entry is offered that raises a start notification on demand
