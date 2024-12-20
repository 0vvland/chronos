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
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

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
      this.actor.add_child(this._label);

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
      }

      this._timeout = GLib.timeout_add(1000, GLib.PRIORITY_LOW, () => {
        // every 2 collected minutes store them
        if (getUintTime() - this._startTime > 60 * 2) {
          this.storeCountedTime();
        }
        this.refreshIndicatorLabel();
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
      this._label.set_text(this.getTrackedTime());
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
      this.logging('pause');
      this.updateIndicatorStyle();
      this._settings.set_boolean('state-paused', true);
    }

    onResume () {
      if (!this.isPaused) {
        return;
      }
      this._startTime = getUintTime();
      this.logging('start');
      this.updateIndicatorStyle();
      this._settings.set_boolean('state-paused', false);
    }

    onReset () {
      this.logging('reset');
      this._settings.set_int('state-tracked-time',
        this._settings.get_int('pref-reset-time'));
      if (!this.isPaused || this._settings.get_boolean('pref-start-on-reset')) {
        this._startTime = getUintTime();
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
