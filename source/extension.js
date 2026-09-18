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
      // in the anchoring rule, so unlocking never alerts immediately
      this._enabledAt = getUintTime();
      this._extention = extention;
      this._settings = this._extention.getSettings();
      this.set_style_class_name('panel-button');

      this._settings.connect('changed', this.onChangeSettings.bind(this));

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

      this._timeout = GLib.timeout_add(1000, GLib.PRIORITY_LOW, () => {
        // every 2 collected minutes store them
        if (getUintTime() - this._startTime > 60 * 2) {
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

        return true;
      });

      this.updateIndicatorStyle();
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

    // Everything is derived from local time on each call, so the timeframe
    // follows the wall clock across midnight, DST and suspend/resume
    isStartAlarmEligible (date = new Date()) {
      const days = this._settings.get_value('pref-start-alarm-days')
        .deep_unpack();
      if (days.length === 0 || !days.includes(date.getDay())) {
        return false;
      }
      if (!this.isPaused || this._startAlarmFired) {
        return false;
      }
      if (this._settings.get_int('state-start-alarm-dismissed') ===
        this.getLocalDay(date)) {
        return false;
      }
      const from = this._settings.get_int('pref-start-alarm-from');
      const to = this._settings.get_int('pref-start-alarm-to');
      if (to <= from) {
        return false;
      }
      const secondsOfDay = date.getHours() * 3600 +
        date.getMinutes() * 60 +
        date.getSeconds();
      return secondsOfDay >= from && secondsOfDay < to;
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

    getTrackedTime () {
      let trackedTime = this._settings.get_int('state-tracked-time');
      if (!this.isPaused) {
        const extraCountedTime = getUintTime() - this._startTime;
        trackedTime += extraCountedTime;
      }
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
    }

    onDestroy () {
      GLib.Source.remove(this._timeout);
      this.storeCountedTime();
      this._settings.set_boolean('state-paused', this.isPaused);
      if (!this.isPaused &&
        !this._settings.get_boolean('pref-pause-on-destroy')) {
        this._settings.set_uint('state-pause-start-time', getUintTime());
      }
      this.logging('destroy');
      if (this._logOutputStream) {
        this._logOutputStream.close(null);
      }
      this?.destroy();
    }

    logging (event) {
      if (!this._settings.get_boolean('pref-log-change-state')) {
        return;
      }
      if (!this._logOutputStream) {
        const filepath = GLib.build_filenamev(
          [GLib.get_home_dir(), 'timeTrack.log']);
        const file = Gio.File.new_for_path(filepath);

        this._logOutputStream = file.append_to(Gio.FileCreateFlags.NONE, null);
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
        });
        dialog.open();
      });

      notification.addAction(_('Not today'), () => {
        this._settings.set_int('state-start-alarm-dismissed',
          this.getLocalDay());
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
    this._indicator = null;
  }
}
