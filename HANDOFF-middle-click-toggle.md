# Handoff: middle-click toggle (Chronos)

Repo: `/home/projects/chronos` (GNOME Shell extension, targets Shell 45–50). Read
`AGENTS.md` first — it is the project's instruction file and is not auto-loaded.

## Next session's focus

Turn the exploration below into a file in the repo. Explore mode only allows
OpenSpec artifacts, so this means an OpenSpec change. The proposed scope is below
and was **offered but not yet confirmed** by the user. Confirm it before you write:

1. `openspec new change "middle-click-toggle"` (never create the directory by hand)
2. `proposal.md` covers:
   - why: the pitch "one click to start or pause", from `source/metadata.json` and `README.md:8`;
   - what: middle-click toggles tracking, left and right click still open the menu;
   - the new capability `quick-toggle`;
   - the updates that follow: the metadata description, a What's New `CHANGELOG` entry in `prefs.js`, the README, and removing the README Plans line (`README.md:125`).
3. `design.md` holds the findings below.
4. Skip specs and tasks until the open questions are settled, and tell the user you skipped them.

Then follow `openspec status` / `openspec instructions` for each artifact.

## Findings (not recorded anywhere else yet)

- The indicator is a plain `PanelMenu.Button` (`source/extension.js:40`) with no event handling of its own. `onToggle()` (`source/extension.js:~489`) already does everything the toggle needs: storing the counted time, the break deadline, logging, the style change and `_ensureTick`. Only the click interception is new.
- **The Shell's click handling differs by version:**
  - Shell 45–48: `PanelMenu.Button.vfunc_event` toggles the menu on a press of any button.
  - Shell 50 (installed: 50.5): `vfunc_event` is gone. `_init` adds a `Clutter.ClickGesture` with `set_recognize_on_press(true)` and `required-button` left at its default 0, meaning any button. Checked by running `gresource extract /usr/lib64/gnome-shell/libshell-18.so /org/gnome/shell/ui/panelMenu.js` and reading `/usr/lib64/mutter-18/Clutter-18.gir`.
- **Options considered:**
  - Override `vfunc_event`: doesn't work on Shell 50.
  - Change the Shell's private `_clickGesture.required_button`: uses a private field, and right-click would stop opening the menu.
  - Add a second `ClickGesture` for button 2: two gestures fire on press and the winner depends on order.
  - **Override `vfunc_captured_event` (recommended):** the capture phase runs before the bubble-phase handler or gesture, it works on every version, and there is no `connect()` to release, so nothing for EGO-L-002/003/004 to flag. The shape: middle `BUTTON_PRESS` → `onToggle()` and return `EVENT_STOP`; middle `BUTTON_RELEASE` → `EVENT_STOP`; everything else → `EVENT_PROPAGATE`.
- **Spike needed:** check that stopping the event in the capture phase really keeps it from the Shell 50 gesture, because the gesture code picks its actors at press time. Run a nested Shell following the AGENTS.md "Automated Testing" recipe (don't forget the `update-check-50` stamp). In the driver:
  - create a virtual pointer with `seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE)`;
  - call `notify_absolute_motion` to the indicator's centre, then `notify_button(time, Clutter.BUTTON_MIDDLE, PRESSED/RELEASED)`;
  - assert `isPaused` flipped and `menu.isOpen === false`;
  - do the same with a left click and assert the menu opens and the tracking state is unchanged.
- **Gap:** only Shell 50 is installed here, so the Shell 45–48 path can't be checked in a real Shell.

## Open questions (the user hasn't answered)

- **Menu already open:** `PopupMenuManager` probably catches the click first, so a middle click would just close the menu. Is that acceptable, or should it also toggle? This was asked twice without an answer.
- **Press or release:** leaning towards press, to match the Shell's recognise-on-press.
- **Feedback:** leaning towards the label colour flip alone, with no OSD or notification.
- **Preference:** leaning towards no pref (YAGNI): pausing is reversible and logged.

## Repo state

- There's an uncommitted change to `source/metadata.json`: version 17 → 19. The user made it before this session; don't revert it.
- There are no active OpenSpec changes. Existing specs are in `openspec/specs/` (break-alarm, goal-alarm, log-truncation, start-alarm, tick-scheduling, whats-new); none of them covers basic tracking.

## Suggested skills

- `opsx:explore`: if the open questions need more discussion first.
- `opsx:propose` or `openspec-propose`: to scaffold the change and write the artifacts in one step, once the scope is confirmed.
- `opsx:apply`: later, to implement it.
- `itest`: to write the nested-Shell virtual-pointer driver.
