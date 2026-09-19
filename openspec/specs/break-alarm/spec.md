# break-alarm Specification

## Purpose

Reminds the user to take a break once they have been tracking time continuously for a configured interval, and lets them postpone or dismiss that reminder. The reminder measures one uninterrupted working stretch, so any genuine interruption — pausing the tracker or locking the screen — counts as the break and starts the measurement over.

## Requirements

### Requirement: Break alarm measures uninterrupted tracking

The break alarm SHALL measure the time elapsed since the current uninterrupted working stretch began, and SHALL NOT be derived from the cumulative tracked time shown in the indicator. A working stretch begins when the tracker starts counting and ends when the tracker is paused or the extension is disabled.

#### Scenario: Alarm fires after a full interval of uninterrupted tracking

- **WHEN** the break alarm is enabled with an interval of 60 minutes and the user has been tracking continuously for 60 minutes
- **THEN** the system notifies the user to take a break

#### Scenario: Cumulative tracked time does not trigger the alarm

- **WHEN** the cumulative tracked time already exceeds the configured interval but the current working stretch began less than one interval ago
- **THEN** the system does not notify the user

#### Scenario: Adjusting the tracked time does not affect the alarm

- **WHEN** the user resets or manually edits the tracked time while the tracker is running
- **THEN** the break alarm continues counting down from the start of the current working stretch, unaffected

### Requirement: Pausing the tracker counts as taking a break

Pausing the tracker SHALL drop any pending break alarm, including a pending postponement. Starting the tracker again SHALL begin a new working stretch and start the interval over from the beginning. Any pause SHALL count as a break regardless of how briefly it lasts.

#### Scenario: Pause drops a pending alarm

- **WHEN** the tracker is running with a break alarm pending and the user pauses the tracker
- **THEN** no break notification is raised while the tracker remains paused

#### Scenario: Start begins a fresh interval

- **WHEN** the user pauses the tracker after 50 minutes of a 60-minute interval and then starts it again
- **THEN** the system notifies the user 60 minutes after the restart, not 10 minutes after it

#### Scenario: Pause after the alarm has already fired

- **WHEN** the break alarm has already fired during the current working stretch and the user pauses and then starts the tracker
- **THEN** the system notifies the user again one full interval after the restart

#### Scenario: A brief pause still counts

- **WHEN** the user pauses the tracker for a few seconds and starts it again
- **THEN** the interval starts over from the beginning

### Requirement: Disabling the extension counts as taking a break

Disabling the extension — which occurs when the screen is locked — SHALL drop any pending break alarm, including a pending postponement. Enabling the extension SHALL begin a new working stretch and start the interval over from the beginning, provided the tracker is running. The break alarm SHALL NOT survive a disable/enable cycle in any form.

#### Scenario: Screen lock drops a pending alarm

- **WHEN** the tracker is running with a break alarm pending and the screen is locked
- **THEN** no break notification is pending when the extension is next enabled from the time before the lock

#### Scenario: Unlock begins a fresh interval

- **WHEN** the user locks the screen after 50 minutes of a 60-minute interval, and on unlock the tracker is running
- **THEN** the system notifies the user 60 minutes after the unlock

#### Scenario: Alarm is not armed when the tracker is paused on enable

- **WHEN** the extension is enabled and the tracker is paused
- **THEN** no break alarm is armed until the user starts the tracker

#### Scenario: Continued tracking across a lock does not shorten the interval

- **WHEN** the extension is configured to keep tracking while disabled and the screen is locked for several hours
- **THEN** on unlock the system starts the interval over rather than notifying immediately

### Requirement: Break alarm respects its enabled setting and interval

The break alarm SHALL be active only when the configured interval is greater than zero; an interval of zero SHALL be the single representation of the alarm being off. A change to the interval SHALL apply from the next time the alarm is armed and SHALL NOT disturb an alarm already pending. The preferences SHALL offer a switch that turns the alarm off and on without the user having to zero the interval by hand, and turning it back on SHALL restore the interval the user last chose.

#### Scenario: Interval of zero disables the alarm

- **WHEN** the configured interval is zero
- **THEN** the system never raises a break notification

#### Scenario: Switching the alarm off and on again

- **WHEN** the user switches the break alarm off in preferences and later switches it on again
- **THEN** no new alarm is armed while the switch is off, and on switching it back on the interval the user last chose is restored

#### Scenario: Turning the alarm on mid-stretch

- **WHEN** the tracker is running with the alarm off and the user turns the break alarm on with a 30-minute interval
- **THEN** the alarm is armed when the next working stretch begins, not at the moment the setting changes

#### Scenario: Changing the interval mid-stretch

- **WHEN** the tracker is running with a break alarm pending and the user changes the configured interval
- **THEN** the pending alarm still fires at its original deadline, and the new interval governs every alarm armed after it

#### Scenario: Turning the alarm off mid-stretch

- **WHEN** the tracker is running with a break alarm pending and the user turns the break alarm off
- **THEN** the pending alarm still fires at its original deadline, and no alarm is armed thereafter

### Requirement: Break notification offers postponement

The break notification SHALL offer the user a way to postpone the reminder by a duration chosen from a list. Choosing a duration SHALL re-arm the alarm to fire again after that duration has elapsed. A postponed alarm SHALL itself be postponable, without limit.

#### Scenario: Postponing re-arms the alarm

- **WHEN** the user postpones the break notification by 5 minutes
- **THEN** the system notifies the user again 5 minutes later

#### Scenario: Repeated postponement

- **WHEN** the user postpones a break notification that was itself the result of an earlier postponement
- **THEN** the system notifies the user again after the newly chosen duration

#### Scenario: Postpone durations are offered in ascending order without duplicates

- **WHEN** the user opens the postpone duration list
- **THEN** each offered duration appears exactly once and the list is ordered from shortest to longest

#### Scenario: Postpone durations are shown as readable durations

- **WHEN** a postpone duration is offered or reported
- **THEN** it is presented as a human-readable duration rather than a raw number of seconds

#### Scenario: Postponement is dropped by a break

- **WHEN** the user postpones the break notification and then pauses the tracker, or the extension is disabled
- **THEN** the postponed alarm does not fire, and the interval starts over when tracking resumes

### Requirement: Dismissing the notification silences the alarm until the next break

Dismissing the break notification without postponing it SHALL prevent any further break notification for the remainder of the current working stretch. The alarm SHALL be armed again only when the next working stretch begins — that is, when the tracker is started after a pause, or when the extension is enabled with the tracker running.

#### Scenario: No repeat within the same working stretch

- **WHEN** the user dismisses the break notification and continues tracking without pausing
- **THEN** the system raises no further break notification during that working stretch

#### Scenario: Dismissal is cleared by a pause

- **WHEN** the user dismisses the break notification, later pauses the tracker, and then starts it again
- **THEN** the system notifies the user one full interval after the restart

#### Scenario: Dismissal is cleared by a lock

- **WHEN** the user dismisses the break notification and the screen is later locked and unlocked with the tracker running
- **THEN** the system notifies the user one full interval after the unlock

### Requirement: Break notification is user-presentable

The break notification SHALL present a translated title, body, and action label, drawn from the extension's translation catalogue like the rest of the user-facing interface. The extension SHALL NOT expose any menu action whose sole purpose is to raise a break notification for testing.

#### Scenario: Notification text is translated

- **WHEN** the break notification is raised under a locale with a translation available
- **THEN** its title, body, and postpone action label are shown in that locale

#### Scenario: No debug trigger in the menu

- **WHEN** the user opens the extension menu
- **THEN** no entry is offered that raises a break notification on demand
