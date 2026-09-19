# goal-alarm Specification

## Purpose

Notifies the user once when the cumulative tracked time shown in the indicator reaches a target they configured, so that a daily target such as eight hours announces itself instead of having to be watched. The reminder is raised only by time the user actually tracked, never by adjusting the counter, and can be postponed by a further amount of tracking or dismissed.

## Requirements

### Requirement: The goal alarm triggers on cumulative tracked time reaching a target

The goal alarm SHALL notify the user when the cumulative tracked time shown in the indicator becomes equal to or greater than a configured target. The comparison SHALL be made against the same value the indicator displays, including while the tracker is running and the counter has advanced beyond the last value written to storage. The target SHALL accept any value the tracked time itself can take, including zero and negative values.

#### Scenario: Alarm fires when the counter reaches the target

- **WHEN** the goal alarm is enabled with a target of 8:00 and the tracker runs until the cumulative tracked time reaches 8:00
- **THEN** the system notifies the user

#### Scenario: Alarm does not fire below the target

- **WHEN** the goal alarm is enabled with a target of 8:00 and the cumulative tracked time is 7:59
- **THEN** the system raises no goal notification

#### Scenario: A negative counter climbing to a zero target

- **WHEN** the goal alarm is enabled with a target of 0:00, the cumulative tracked time is negative, and the user tracks until it reaches zero
- **THEN** the system notifies the user

#### Scenario: The alarm does not wait for tracked time to be written to storage

- **WHEN** the cumulative tracked time crosses the target between two writes of the tracked time to storage
- **THEN** the system notifies the user at the moment the displayed time reaches the target, not at the next write

### Requirement: Only tracking raises the notification

The goal alarm SHALL be raised only by tracked time accumulating while the tracker runs. A discontinuous change of the cumulative tracked time SHALL NOT raise a notification; it SHALL instead silently re-synchronise the alarm, so that the alarm is pending afterwards exactly when the counter has landed below the target and is not pending when it has landed at or above it. This SHALL apply to every cause of a discontinuous change, including the user editing the tracked time in preferences, restarting the tracker, and the extension recovering time that elapsed while it was disabled.

#### Scenario: Editing the tracked time past the target does not notify

- **WHEN** the goal alarm is enabled with a target of 8:00 and the user edits the tracked time in preferences from 5:00 to 9:00
- **THEN** the system raises no goal notification

#### Scenario: Editing past the target silences the alarm for that target

- **WHEN** the user has edited the tracked time from 5:00 to 9:00 against a target of 8:00 and then continues tracking
- **THEN** the system raises no goal notification while the tracked time keeps rising

#### Scenario: Editing the tracked time back below the target re-arms the alarm

- **WHEN** the goal notification has already been raised for a target of 8:00 and the user edits the tracked time back to 5:00
- **THEN** the system raises no notification at the moment of the edit, and notifies the user again when tracking brings the time back to 8:00

#### Scenario: Restarting the tracker re-arms the alarm for the next target

- **WHEN** the goal notification has been raised for a target of 8:00 and the user restarts the tracker, setting the tracked time back to the reset time
- **THEN** the system raises no notification at the moment of the restart, and notifies the user again when tracking brings the time to 8:00

#### Scenario: Restarting to a time already above the target does not notify

- **WHEN** the reset time is 9:00, the target is 8:00, and the user restarts the tracker
- **THEN** the system raises no goal notification, either at the restart or while tracking continues

#### Scenario: Recovered time that spans the target does not notify

- **WHEN** the extension is configured to keep tracking while disabled, the tracked time was 7:00 before the screen was locked, the target is 8:00, and several hours elapsed before unlocking
- **THEN** the system raises no goal notification on recovering that time, and raises none thereafter while tracking continues

#### Scenario: No notification while the tracker is paused

- **WHEN** the tracker is paused below the target and left paused
- **THEN** the system raises no goal notification, because the cumulative tracked time does not advance

### Requirement: The alarm fires once per target

The goal alarm SHALL raise at most one notification for a given target reached. Once raised, it SHALL NOT be raised again unless the user postpones it, or the cumulative tracked time falls back below the target. An extension disable and enable cycle, such as locking and unlocking the screen, SHALL NOT revive an alarm already raised for a target the counter is still at or above.

#### Scenario: No repeat while tracking continues past the target

- **WHEN** the goal notification has been raised and the user keeps tracking well beyond the target
- **THEN** the system raises no further goal notification

#### Scenario: A lock does not revive an alarm already raised

- **WHEN** the goal notification has been raised, the screen is locked and unlocked, and the cumulative tracked time is still above the target
- **THEN** the system raises no further goal notification

#### Scenario: A lock does not raise a notification for a target already passed

- **WHEN** the cumulative tracked time is already above the target and the extension is enabled after a lock
- **THEN** the system raises no goal notification on being enabled

### Requirement: The goal alarm has its own enable switch, independent of the target value

The goal alarm SHALL be turned off and on by a dedicated setting that is independent of the target value, so that every target the tracked time can take — including zero and negative targets — remains usable while the alarm is on. No value of the target SHALL be reserved to mean that the alarm is off. While the alarm is off the system SHALL raise no goal notification. A change to the target SHALL take effect immediately, re-synchronising the alarm against the new target without raising a notification.

#### Scenario: The alarm off raises nothing

- **WHEN** the goal alarm is switched off and the cumulative tracked time passes what was configured as the target
- **THEN** the system raises no goal notification

#### Scenario: A target of zero is a working target

- **WHEN** the goal alarm is switched on with a target of 0:00
- **THEN** the alarm behaves as for any other target and is not treated as off

#### Scenario: Raising the target re-arms the alarm

- **WHEN** the goal notification has been raised for a target of 8:00 and the user changes the target to 9:00 while still tracking
- **THEN** the system raises no notification at the moment of the change, and notifies the user when the tracked time reaches 9:00

#### Scenario: Lowering the target below the current time does not notify

- **WHEN** the cumulative tracked time is 7:00 and the user changes the target from 8:00 to 6:00
- **THEN** the system raises no goal notification, either at the moment of the change or while tracking continues

#### Scenario: Turning the alarm on above the target does not notify

- **WHEN** the cumulative tracked time is already above the target and the user switches the goal alarm on
- **THEN** the system raises no goal notification

### Requirement: The goal notification offers postponement measured in tracked time

The goal notification SHALL offer an action that postpones the reminder by a duration chosen from a list, and that duration SHALL be measured in further tracked time rather than in elapsed wall-clock time. Time spent with the tracker paused SHALL NOT consume a postponement. The postpone durations SHALL be presented as human-readable durations, offered in ascending order without duplicates. A postponed alarm SHALL itself be postponable, without limit. A postponement SHALL NOT survive the extension being disabled and enabled again.

#### Scenario: Postponing re-arms the alarm after further tracking

- **WHEN** the user postpones the goal notification by 15 minutes and keeps tracking
- **THEN** the system notifies the user again after 15 further minutes of tracked time

#### Scenario: A pause does not consume the postponement

- **WHEN** the user postpones the goal notification by 15 minutes, pauses the tracker for an hour, and then starts it again
- **THEN** the system notifies the user 15 minutes of tracking after the restart, not on resuming

#### Scenario: Repeated postponement

- **WHEN** the user postpones a goal notification that was itself the result of an earlier postponement
- **THEN** the system notifies the user again after the newly chosen amount of further tracked time

#### Scenario: Postpone durations are readable and ordered

- **WHEN** the user opens the postpone duration list
- **THEN** each offered duration appears exactly once, the list is ordered from shortest to longest, and each is shown as a human-readable duration rather than a raw number of seconds

#### Scenario: Postponement does not survive a screen lock

- **WHEN** the user postpones the goal notification and the screen is then locked and unlocked with the cumulative tracked time still above the target
- **THEN** the system raises no further goal notification for that target

### Requirement: The goal notification offers dismissal

The goal notification SHALL offer an action that dismisses the reminder. Dismissing it SHALL leave the alarm in the same state as ignoring it: no further goal notification is raised for that target until the cumulative tracked time falls back below the target or the target is changed.

#### Scenario: Dismissing silences the reminder

- **WHEN** the user dismisses the goal notification and keeps tracking
- **THEN** the system raises no further goal notification

#### Scenario: Dismissal does not prevent a later target being reached

- **WHEN** the user dismisses the goal notification, restarts the tracker, and tracks up to the target again
- **THEN** the system notifies the user

### Requirement: The goal alarm is independent of the break and start alarms

The goal alarm SHALL be armed, raised, postponed and dismissed without regard to the break alarm's or the start alarm's configuration or state, and neither of those alarms' behaviour SHALL be affected by the goal alarm. Two notifications arriving close together because two alarms came due SHALL NOT be suppressed.

#### Scenario: Break alarm off does not disable the goal alarm

- **WHEN** the break alarm is off and the tracked time reaches the goal target
- **THEN** the goal alarm behaves exactly as it does when the break alarm is on

#### Scenario: Both alarms coming due are both raised

- **WHEN** the tracked time reaches the goal target at the same moment a break alarm comes due
- **THEN** the system raises both notifications

#### Scenario: Pausing in response to the goal notification does not suppress the start alarm

- **WHEN** the goal notification is raised, the user pauses the tracker, and the start alarm's conditions are met
- **THEN** the start alarm behaves exactly as it does after any other pause

### Requirement: The goal alarm is user-presentable

The goal notification SHALL present a translated title, body, and action labels, drawn from the extension's translation catalogue like the rest of the user-facing interface, and the preferences for the alarm SHALL likewise be translated. The body SHALL make clear that the configured tracked time target has been reached. The extension SHALL NOT expose any menu action whose sole purpose is to raise a goal notification for testing.

#### Scenario: Notification text is translated

- **WHEN** the goal notification is raised under a locale with a translation available
- **THEN** its title, body, and action labels are shown in that locale

#### Scenario: Preferences are translated

- **WHEN** the preferences window is opened under a locale with a translation available
- **THEN** the goal alarm's switch and target labels are shown in that locale

#### Scenario: No debug trigger in the menu

- **WHEN** the user opens the extension menu
- **THEN** no entry is offered that raises a goal notification on demand

### Requirement: The goal alarm is configured on the Alarms page

The preferences SHALL offer the goal alarm's settings on the same page as the break and start alarms, as a group of its own, with a switch that turns the alarm off and on and a target time entered in hours and minutes. The target SHALL remain stored while the alarm is switched off, so that switching it on again restores the target the user last chose. The target control SHALL be shown only while the alarm is on, following the presentation of the other two alarms.

#### Scenario: Switching the alarm off and on again

- **WHEN** the user switches the goal alarm off in preferences and later switches it on again
- **THEN** no goal notification is raised while the switch is off, and on switching it back on the target the user last chose is restored

#### Scenario: The target control follows the switch

- **WHEN** the user switches the goal alarm off
- **THEN** the target control is hidden, and it is shown again when the switch is turned back on

#### Scenario: The target is entered in hours and minutes

- **WHEN** the user sets the goal target in preferences
- **THEN** the target is entered as hours and minutes, in the same form as the other time settings
