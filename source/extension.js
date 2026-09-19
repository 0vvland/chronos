import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import {
  Extension,
  gettext as _,
} from 'resource:///org/gnome/shell/extensions/extension.js';
import {
  MessageTray,
  Notification,
  getSystemSource,
} from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { PostponeDialog, formatPostponeTime } from './components/PostponeDialog.js';

const getUintTime = (ms = Date.now()) => Math.floor(ms / 1000);

// coupled to the one-second tick period: it is what separates "accumulated
// about a tick's worth" from "somebody else wrote the counter". Lengthening
// the period without raising this would read every ordinary step as an
// external jump and the goal alarm would never fire.
const TICK_TOLERANCE = 5;

const Chronos = GObject.registerClass(
  class Chronos extends PanelMenu.Button {

    get isPaused () {
      return this._startTime === null;
    }

    _init (extention) {
      super._init(0.5, 'Chronos', false);
      // null - if paused, timestamp when started if count
      this._startTime = null;
      // null - if disarmed, timestamp of the next break alarm otherwise
      this._breakDeadline = null;
      // null - unless a postponement overrides the anchored start deadline
      this._startDeadline = null;
      // timestamp the current pause began, null while tracking
      this._pauseStartTime = getUintTime();
      // the start alarm fires at most once per idle period
      this._startAlarmFired = false;
      // the goal alarm fires at most once per target reached
      this._goalFired = false;
      // null - unless a postponement overrides the configured goal target
      this._goalDeadline = null;
      // tracked seconds seen on the previous tick, seeded at the end of _init
      this._lastGoalTracked = 0;
      // in the anchoring rule, so unlocking never alerts immediately
      this._enabledAt = getUintTime();
      // null - unless the matching periodic source is currently armed
      this._timeout = null;
      this._pollTimeout = null;
      this._extention = extention;
      this._settings = this._extention.getSettings();
      this.set_style_class_name('panel-button');

      this._settingsChangedId = this._settings.connect('changed',
        this.onChangeSettings.bind(this));

      this._label = new St.Label({
        text: 'Loading...',
        can_focus: true,
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,

      });
      this._label.connect('destroy', () => {
        this._label = null;
      });
      this.add_child(this._label);

      this._pauseMenu = this.menu.addAction(_('Start'),
        this.onToggle.bind(this),
        'media-playback-start-symbolic',
      );
      this.menu.addAction(_('Restart'),
        this.onReset.bind(this),
        'view-refresh-symbolic',
      );
      this.menu.addAction(_('Preferences'),
        (() => this._extention.openPreferences()),
        'org.gnome.Settings-symbolic',
      );

      this._indicatorColors = [
        this._settings.get_string('pref-indicator-color'),
        this._settings.get_string('pref-indicator-paused-color'),
      ];

      this.truncateLog();
      this.logging('init');

      if (!this._settings.get_boolean('state-paused')) {
        // not paused on destroy
        const storedStartTime = this._settings.get_uint(
          'state-pause-start-time');
        if (storedStartTime) {
          this._startTime = storedStartTime;
          this._settings.set_uint('state-pause-start-time', 0);
          this.storeCountedTime();
          this.logging('collect inactive time');
        }
        this.onResume();
        // a new working stretch begins on every enable
        this._breakDeadline = this.getBreakDeadline();
      }

      // seeded after the recovered time has been folded in, so the first tick
      // sees no step - and so an enable above the target starts out fired
      this._lastGoalTracked = this.getTrackedSeconds();
      this._goalFired = this._lastGoalTracked >= this.getGoalTarget();

      this._ensureTick();

      // the tick may not be running at all, so the label cannot wait a second
      // for its first value
      this.refreshIndicatorLabel();
      this.updateIndicatorStyle();
    }

    // The one-second source exists only while needsTick() holds. Arming is
    // idempotent and happens from many sites; removal belongs to the callback
    // alone, because removing a GSource from inside its own callback with
    // GLib.Source.remove() is how GJS double-frees.
    _ensureTick () {
      if (this._timeout === null && this.needsTick()) {
        this._timeout = GLib.timeout_add(1000, GLib.PRIORITY_LOW,
          this.onTick.bind(this));
      }
      this._ensurePoll();
    }

    // The 60-second re-arming poll: all that runs while paused with a start
    // alarm set for today that merely cannot fire yet. Never armed alongside
    // the one-second tick - the tick's own tail arms it on standing down.
    _ensurePoll () {
      if (this._pollTimeout !== null || this._timeout !== null ||
        !this.needsPoll()) {
        return;
      }
      this._pollTimeout = GLib.timeout_add_seconds(60, GLib.PRIORITY_LOW,
        () => {
          // needsPoll() re-derives the weekday and the time of day from a
          // fresh Date on every pass and holds no precomputed deadline, so a
          // suspend, a timezone change or a DST transition cannot shift or
          // lose the opening
          this._ensureTick();
          if (this._timeout !== null || !this.needsPoll()) {
            this._pollTimeout = null;
            return GLib.SOURCE_REMOVE;
          }
          return GLib.SOURCE_CONTINUE;
        });
    }

    onTick () {
      // every 2 collected minutes store them - only while counting, since the
      // tick also runs through a paused start-alarm window and _startTime is
      // null there
      if (!this.isPaused && getUintTime() - this._startTime > 60 * 2) {
        this.storeCountedTime();
      }
      this.refreshIndicatorLabel();

      if (this._breakDeadline !== null && getUintTime() >= this._breakDeadline) {
        this._breakDeadline = null;
        this.showNotification();
      }

      const now = new Date();
      if (this.isStartAlarmEligible(now) &&
        getUintTime(now.getTime()) >= this.getStartDeadline(now)) {
        this._startAlarmFired = true;
        this._startDeadline = null;
        this.showStartNotification();
      }

      // deliberately not skipped during the paused window: tracked time is
      // frozen so the step is zero, and the call keeps _lastGoalTracked
      // current - otherwise a preferences edit made during the pause would
      // read as accumulation on the first tick after resume
      this.checkGoalAlarm();

      if (!this.needsTick()) {
        this._timeout = null;
        this._ensurePoll();
        return GLib.SOURCE_REMOVE;
      }
      return GLib.SOURCE_CONTINUE;
    }

    updateIndicatorStyle () {
      const indicatorColor = this._indicatorColors[this.isPaused ? 1 : 0];
      const menuColor = this._indicatorColors[this.isPaused ? 0 : 1];
      const menuLabel = this.isPaused ? _('Start') : _('Pause');
      const icon = this.isPaused
        ? 'media-playback-start-symbolic'
        : 'media-playback-pause-symbolic';

      this._label.set_style(`color: ${indicatorColor};`);
      this._pauseMenu?.set_style(`color: ${menuColor};`);
      this._pauseMenu?.label.set_text(menuLabel);
      this._pauseMenu?.setIcon(icon);
    }

    getBreakDeadline () {
      const interval = this._settings.get_int('pref-break-alarm-interval');
      return interval > 0 ? getUintTime() + interval : null;
    }

    // local calendar day as YYYYMMDD, the encoding of
    // 'state-start-alarm-dismissed'
    getLocalDay (date = new Date()) {
      return date.getFullYear() * 10000 +
        (date.getMonth() + 1) * 100 +
        date.getDate();
    }

    // The day-level half of the start alarm's conditions: the alarm is set up
    // for this weekday, the timeframe is a real interval, and the day has not
    // been dismissed. Nothing here depends on the time of day or on whether
    // the alarm has already fired, which is what lets the 60-second poll ask
    // "is there anything to wait for today?" without duplicating the test.
    isStartAlarmConfiguredToday (date = new Date()) {
      const days = this._settings.get_value('pref-start-alarm-days')
        .deep_unpack();
      if (days.length === 0 || !days.includes(date.getDay())) {
        return false;
      }
      if (this._settings.get_int('state-start-alarm-dismissed') ===
        this.getLocalDay(date)) {
        return false;
      }
      return this._settings.get_int('pref-start-alarm-to') >
        this._settings.get_int('pref-start-alarm-from');
    }

    // Everything is derived from local time on each call, so the timeframe
    // follows the wall clock across midnight, DST and suspend/resume
    isStartAlarmEligible (date = new Date()) {
      if (!this.isStartAlarmConfiguredToday(date)) {
        return false;
      }
      if (!this.isPaused || this._startAlarmFired) {
        return false;
      }
      const from = this._settings.get_int('pref-start-alarm-from');
      const to = this._settings.get_int('pref-start-alarm-to');
      const secondsOfDay = date.getHours() * 3600 +
        date.getMinutes() * 60 +
        date.getSeconds();
      return secondsOfDay >= from && secondsOfDay < to;
    }

    // Whether anything the one-second tick does can produce a different
    // result. The start alarm is asked with the very expression that fires it,
    // so the two cannot drift; the other consumers need no term of their own:
    //
    //   | consumer           | why the predicate already covers it            |
    //   |--------------------|------------------------------------------------|
    //   | flush + indicator  | only move while counting, so !isPaused         |
    //   | break alarm        | _breakDeadline nulled in onPause, armed on      |
    //   |                    | onResume                                        |
    //   | goal alarm         | driven by tracked time, frozen while paused     |
    //
    // A consumer added to the tick body that needs a wake-up outside those
    // terms has to add its own here, or it will work while tracking and
    // quietly fail while paused.
    needsTick () {
      return !this.isPaused || this.isStartAlarmEligible();
    }

    // A start alarm is set for today but cannot fire yet - the one case where
    // standing the tick down still leaves something to wait for
    needsPoll () {
      return !this.needsTick() && this.isStartAlarmConfiguredToday();
    }

    // deadline = max(pauseStart, enabledAt, timeframeOpenToday) + delay,
    // unless a postponement pinned an explicit one
    getStartDeadline (date = new Date()) {
      if (this._startDeadline !== null) {
        return this._startDeadline;
      }
      const secondsOfDay = date.getHours() * 3600 +
        date.getMinutes() * 60 +
        date.getSeconds();
      const timeframeOpenToday = getUintTime(date.getTime()) - secondsOfDay +
        this._settings.get_int('pref-start-alarm-from');
      const anchor = Math.max(
        this._pauseStartTime ?? 0,
        this._enabledAt,
        timeframeOpenToday,
      );
      return anchor + this._settings.get_int('pref-start-alarm-delay');
    }

    // a reading of the counter, not a moment in time, unless a postponement
    // pinned an explicit one - which is likewise on the counter's scale
    getGoalTarget () {
      if (this._goalDeadline !== null) {
        return this._goalDeadline;
      }
      return this._settings.get_int('pref-goal-alarm-time');
    }

    // stored tracked time plus whatever has not been flushed to it yet
    getTrackedSeconds () {
      const trackedTime = this._settings.get_int('state-tracked-time');
      if (this.isPaused) {
        return trackedTime;
      }
      return trackedTime + (getUintTime() - this._startTime);
    }

    // Only accumulation raises the alarm. Every other writer of the counter -
    // a preferences edit, a restart, the suspend-gap recovery - moves it by
    // more than a tick's worth and is re-synchronised silently instead.
    checkGoalAlarm () {
      const tracked = this.getTrackedSeconds();
      if (!this._settings.get_boolean('pref-goal-alarm-enabled')) {
        // kept current while off, so switching on is not read as a jump
        this._lastGoalTracked = tracked;
        return;
      }
      const step = tracked - this._lastGoalTracked;
      if (step >= 0 && step <= TICK_TOLERANCE) {
        const target = this.getGoalTarget();
        if (tracked < target) {
          // below the target the alarm is pending, so raising the target past
          // the counter re-arms it
          this._goalFired = false;
        } else if (this._lastGoalTracked < target && !this._goalFired) {
          this._goalFired = true;
          // a later re-arm uses the configured target again
          this._goalDeadline = null;
          this.showGoalNotification();
        }
      } else {
        this._goalDeadline = null;
        this._goalFired = tracked >= this.getGoalTarget();
      }
      this._lastGoalTracked = tracked;
    }

    getTrackedTime () {
      let trackedTime = this.getTrackedSeconds();
      const isNegative = trackedTime < 0;
      trackedTime = Math.abs(trackedTime);
      const hours = Math.floor(trackedTime / 3600);
      if (hours !== 0) {
        trackedTime -= hours * 3600;
      }
      const mins = Math.floor(trackedTime / 60);
      if (mins !== 0) {
        trackedTime -= mins * 60;
      }
      let timer;
      if (this._settings.get_boolean('pref-show-seconds') === true) {
        timer = '%d:%02d:%02d'.format(hours, mins, trackedTime);
      } else {
        timer = '%d:%02d'.format(hours, mins);
      }
      return isNegative ? '-' + timer : timer;
    }

    refreshIndicatorLabel () {
      if (this._label && this._label.get_parent) {
        this._label.set_text(this.getTrackedTime());
      }
    }

    storeCountedTime () {
      if (this.isPaused) {
        return;
      }
      const countedTime = this._settings.get_int('state-tracked-time');
      const now = getUintTime();
      const extraCountedTime = now - this._startTime;
      this._startTime = now;
      this._settings.set_int('state-tracked-time',
        countedTime + extraCountedTime);
    }

    onToggle () {
      if (this.isPaused) {
        this.onResume();
      } else {
        this.onPause();
      }
    }

    onPause () {
      if (this.isPaused) {
        return;
      }
      this.storeCountedTime();
      this._startTime = null;
      this._breakDeadline = null;
      this._pauseStartTime = getUintTime();
      this.logging('pause');
      this.updateIndicatorStyle();
      this._settings.set_boolean('state-paused', true);
      this._ensureTick();
    }

    onResume () {
      if (!this.isPaused) {
        return;
      }
      this._startTime = getUintTime();
      this._breakDeadline = this.getBreakDeadline();
      // starting the tracker ends the idle period, so the start alarm is
      // disarmed and may fire again after the next pause
      this._pauseStartTime = null;
      this._startDeadline = null;
      this._startAlarmFired = false;
      this.logging('start');
      this.updateIndicatorStyle();
      this._settings.set_boolean('state-paused', false);
      this._ensureTick();
    }

    onReset () {
      this.logging('reset');
      this._settings.set_int('state-tracked-time',
        this._settings.get_int('pref-reset-time'));
      if (!this.isPaused || this._settings.get_boolean('pref-start-on-reset')) {
        const wasPaused = this.isPaused;
        this._startTime = getUintTime();
        if (wasPaused) {
          // reset started a new working stretch, so it also ended the idle
          // period - a later pause begins a fresh one
          this._breakDeadline = this.getBreakDeadline();
          this._pauseStartTime = null;
          this._startDeadline = null;
          this._startAlarmFired = false;
        }
      }
      this.updateIndicatorStyle();
      this._ensureTick();
    }

    onChangeSettings (event) {
      // console.log('changed', data);
      if (this._settings.get_string('pref-indicator-color') !==
        this._indicatorColors[0]
        || this._settings.get_string('pref-indicator-paused-color') !==
        this._indicatorColors[1]) {
        this._indicatorColors = [
          this._settings.get_string('pref-indicator-color'),
          this._settings.get_string('pref-indicator-paused-color'),
        ];
        this.updateIndicatorStyle();
      }
      this.refreshIndicatorLabel();
      // a no-op whenever the right source is already armed, which is what the
      // extension's own two-minute 'state-tracked-time' write re-enters here
      this._ensureTick();
    }

    // Full teardown, run from disable() before the actor itself is destroyed.
    onDestroy () {
      // either source may have removed itself already
      if (this._timeout !== null) {
        GLib.Source.remove(this._timeout);
        this._timeout = null;
      }
      if (this._pollTimeout !== null) {
        GLib.Source.remove(this._pollTimeout);
        this._pollTimeout = null;
      }
      this.storeCountedTime();
      this._settings.set_boolean('state-paused', this.isPaused);
      if (!this.isPaused &&
        !this._settings.get_boolean('pref-pause-on-destroy')) {
        this._settings.set_uint('state-pause-start-time', getUintTime());
      }
      this.logging('destroy');
      if (this._logOutputStream) {
        this._logOutputStream.close(null);
        this._logOutputStream = null;
      }
      if (this._settingsChangedId) {
        this._settings.disconnect(this._settingsChangedId);
        this._settingsChangedId = null;
      }
      this._settings = null;
      this._extention = null;
    }

    getLogFile () {
      return Gio.File.new_for_path(
        GLib.build_filenamev([GLib.get_home_dir(), 'timeTrack.log']));
    }

    // Runs once per enable, ahead of the first log entry, while nothing holds
    // the file open. Any failure leaves the existing file as it was.
    truncateLog () {
      if (!this._settings.get_boolean('pref-log-change-state')) {
        return;
      }
      const limit = this._settings.get_int('pref-log-max-lines');
      if (limit <= 0) {
        return;
      }
      const file = this.getLogFile();
      if (!file.query_exists(null)) {
        return;
      }
      try {
        const [ok, contents] = file.load_contents(null);
        if (!ok) {
          return;
        }
        const lines = new TextDecoder().decode(contents).split('\n');
        // every entry ends in '\n', so the split leaves a trailing empty
        // element that is not a line
        if (lines[lines.length - 1] === '') {
          lines.pop();
        }
        if (lines.length <= limit) {
          return;
        }
        const kept = lines.slice(lines.length - limit)
          .map((line) => `${line}\n`)
          .join('');
        // atomic: the file is either the old content or the new one
        file.replace_contents(new TextEncoder().encode(kept), null, false,
          Gio.FileCreateFlags.NONE, null);
      } catch (error) {
        console.error('Chronos: could not truncate the log file', error);
      }
    }

    logging (event) {
      if (!this._settings.get_boolean('pref-log-change-state')) {
        return;
      }
      if (!this._logOutputStream) {
        this._logOutputStream = this.getLogFile()
          .append_to(Gio.FileCreateFlags.NONE, null);
      }
      const date = new Date();
      const tzo = -date.getTimezoneOffset();
      const dif = tzo >= 0 ? '+' : '-';
      const pad = function (num) {
        return (num < 10 ? '0' : '') + num;
      };

      const isoDate = date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes()) +
        ':' + pad(date.getSeconds()) +
        dif + pad(Math.floor(Math.abs(tzo) / 60)) +
        ':' + pad(Math.abs(tzo) % 60);

      const bytes = new GLib.Bytes(
        `${isoDate}: [${event}] ${this.getTrackedTime()}\n`,
      );
      this._logOutputStream.write_bytes(bytes, null);
    }

    showNotification () {
      const source = getSystemSource();
      const notification = new Notification({
        source: source,
        title: _('Chronos Tracker'),
        iconName: 'appointment-new-symbolic',
        // gicon: null,
        body: _('Time to take a break'),
      });

      notification.addAction(_('Postpone...'), () => {
        const options = [
          60,
          300,
          this._settings.get_int('pref-break-alarm-interval'),
        ].filter((s, i, a) => a.indexOf(s) === i).sort((a, b) => a - b);
        const dialog = new PostponeDialog(options, (selected) => {
          this._breakDeadline = getUintTime() + selected;
        });
        dialog.open();
      });
      source.addNotification(notification);
    }

    showStartNotification () {
      const source = getSystemSource();
      const notification = new Notification({
        source: source,
        title: _('Chronos Tracker'),
        iconName: 'appointment-new-symbolic',
        body: _('Time tracking is paused, time to start'),
      });

      notification.addAction(_('Start'), () => {
        this.onResume();
      });

      notification.addAction(_('Postpone...'), () => {
        const options = [
          300,
          900,
          this._settings.get_int('pref-start-alarm-delay'),
        ].filter((s, i, a) => a.indexOf(s) === i).sort((a, b) => a - b);
        const dialog = new PostponeDialog(options, (selected) => {
          this._startDeadline = getUintTime() + selected;
          this._startAlarmFired = false;
          // the tick stood down when the alarm fired, and clearing the flag
          // above is the only thing that makes it eligible again
          this._ensureTick();
        });
        dialog.open();
      });

      notification.addAction(_('Not today'), () => {
        this._settings.set_int('state-start-alarm-dismissed',
          this.getLocalDay());
      });

      source.addNotification(notification);
    }

    showGoalNotification () {
      const source = getSystemSource();
      const notification = new Notification({
        source: source,
        title: _('Chronos Tracker'),
        iconName: 'appointment-new-symbolic',
        body: _('The tracked time target is reached'),
      });

      notification.addAction(_('Postpone...'), () => {
        // measured in tracked time, so a pause does not consume it
        const dialog = new PostponeDialog([300, 900, 1800], (selected) => {
          this._goalDeadline = this.getTrackedSeconds() + selected;
          this._goalFired = false;
        }, _('Select Tracked Time'));
        dialog.open();
      });

      notification.addAction(_('Dismiss'), () => {
        notification.destroy();
      });

      source.addNotification(notification);
    }
  });

export default class ChronosExtension extends Extension {
  enable () {
    this._indicator = new Chronos(this);

    // Add the indicator to the panel
    Main.panel.addToStatusArea(this.uuid, this._indicator, 0);
    // Main.panel._rightBox.insert_child_at_index(this._indicator, 0);
  }

  disable () {
    this._indicator.onDestroy();
    this._indicator.destroy();
    this._indicator = null;
  }
}
