## Why

The extension keeps a one-second timer running from the moment it is enabled
until it is disabled, whether or not anything can change. While the tracker is
paused nothing it does per tick can produce a different result: the counter is
frozen, the indicator shows a value that cannot move, the break alarm is
disarmed, and the start alarm is usually outside its timeframe or switched off
altogether. On a machine left paused overnight that is tens of thousands of
wake-ups a night spent confirming that nothing happened, which keeps the CPU
out of its deeper idle states and shows up as battery drain on a laptop.

## What Changes

- The one-second timer becomes conditional. It runs while the tracker is
  counting, and while the tracker is paused only during the window in which the
  start alarm could actually fire. At every other moment there is no
  one-second timer at all.
- While the tracker is paused with a start alarm configured for today but the
  timeframe not yet open, a single once-a-minute check takes its place, purely
  to notice the timeframe opening and hand back to the one-second timer. With
  the shipped defaults, where no start-alarm weekday is selected, even that
  check never runs, so a paused tracker costs nothing.
- All existing alarm, counter and indicator behaviour is preserved exactly. No
  preference is added, removed, or reinterpreted, and nothing about the change
  is user-configurable.

## Capabilities

### New Capabilities

- `tick-scheduling`: when the extension runs periodic work and when it stands
  down, expressed as the guarantee that suspending that work is never
  observable — alarms fire at the same moments, the indicator shows the same
  values, and tracked time accrues identically.

### Modified Capabilities

<!-- None. The observable behaviour of the break, start and goal alarms is
     unchanged; tick-scheduling states the guarantee that keeps it unchanged. -->

## Impact

- `source/extension.js` only. The periodic callback registered in `_init` gains
  an arming condition and a self-removing tail; `onPause`, `onResume`,
  `onReset`, `onChangeSettings`, `onDestroy` and the start notification's
  postpone action gain a call that re-arms it.
- No change to the GSettings schema, the preferences pages, the translation
  catalogue, or the build.
- The existing dead call into `storeCountedTime()` on every paused tick —
  which today survives only because that method returns early when paused —
  has to be gated properly, because the one-second timer will now run during a
  paused start-alarm window with a null start time.
