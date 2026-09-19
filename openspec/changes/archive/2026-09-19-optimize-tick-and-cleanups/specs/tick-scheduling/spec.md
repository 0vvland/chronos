## ADDED Requirements

### Requirement: A single pass of periodic work observes a single instant

Every time-dependent value used within one pass of periodic work SHALL be derived from one reading of the clock. Within a single pass, the tracked time shown on the indicator, the tracked time tested against the goal target, the weekday and calendar day tested against the start alarm's configuration, the moment tested against the break and start deadlines, and the decision whether further periodic work is needed SHALL all refer to the same moment.

It is the reading of the clock that is held fixed, not the extension's state. A value that changes during a pass because the extension itself changed state — an alarm having just been raised, for instance — SHALL be re-derived from the pass's own instant rather than reused, so that a pass still observes the consequences of what it did.

#### Scenario: Indicator and goal alarm agree on the counter

- **WHEN** a pass of periodic work spans a whole-second boundary between rendering the indicator and testing the goal target
- **THEN** the goal target is tested against the same tracked value the indicator displays, and the goal alarm is never raised on a value the indicator did not show

#### Scenario: Calendar day is consistent within a pass

- **WHEN** a pass of periodic work runs in the final moments before local midnight
- **THEN** the day tested against the start alarm's dismissal and the day used to decide whether further periodic work is needed are the same day, and the pass cannot treat the alarm as dismissed and undismissed at once

#### Scenario: Timeframe boundary is consistent within a pass

- **WHEN** a pass of periodic work runs at the exact moment the start-alarm timeframe opens or closes
- **THEN** the pass either treats the timeframe as open throughout or as closed throughout, and does not raise an alarm for a timeframe it then treats as shut

#### Scenario: An alarm raised during a pass still stands the work down

- **WHEN** the start alarm is raised during a pass and the tracker remains paused with nothing further pending
- **THEN** that same pass concludes that no further second-by-second work is needed, rather than continuing until the next pass notices

#### Scenario: Tracked total is unchanged by the single reading

- **WHEN** the tracker counts for an hour
- **THEN** the tracked total is exactly one hour, as it was before this change, and does not drift by the number of passes performed

### Requirement: Periodic wakeups may be coalesced with other system timers

The extension SHALL allow the system to align and coalesce its periodic wakeups with other timers, so that an active tracker costs the machine fewer distinct wakeups. Coalescing SHALL NOT move the moment at which any alarm is raised, and SHALL NOT change the tracked time the extension reports or stores.

Because tracked time is derived from the clock and never from a count of passes, a coalesced wakeup MAY cause a displayed second to be repeated or skipped. The total SHALL remain exact regardless.

#### Scenario: Alarms are unaffected by coalescing

- **WHEN** the break, start or goal alarm becomes due and the wakeup that observes it has been coalesced
- **THEN** the notification is raised at the same moment it would have been raised without coalescing, to within the one-second resolution of the periodic work

#### Scenario: Tracked total survives a skipped display second

- **WHEN** coalescing causes the indicator to skip or repeat a displayed second while seconds are shown
- **THEN** the tracked total still matches the elapsed counting time exactly, and the next displayed value is correct

#### Scenario: Counting for a long stretch stays exact

- **WHEN** the tracker counts uninterrupted for eight hours with coalesced wakeups
- **THEN** the tracked time is eight hours, with no accumulated drift

### Requirement: The indicator is repainted only when its text changes

The extension SHALL NOT repaint the indicator during a pass of periodic work when the text it would show is identical to the text already shown. When the text does change, the indicator SHALL show the new text within one second.

#### Scenario: Seconds hidden, minute unchanged

- **WHEN** seconds are not shown and a pass produces the same value as the previous pass
- **THEN** the indicator is not repainted

#### Scenario: Seconds hidden, minute rolls over

- **WHEN** seconds are not shown and the counted time crosses a whole minute
- **THEN** the indicator shows the new value within one second of the rollover

#### Scenario: Seconds shown

- **WHEN** seconds are shown and the counted time crosses a whole second
- **THEN** the indicator shows the new value

#### Scenario: Pause and resume still repaint

- **WHEN** the user pauses or starts the tracker
- **THEN** the indicator and its colour reflect the new state immediately, without waiting for the text to change on its own
