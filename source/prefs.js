/* jshint moz:true, unused: false */
/* exported init, buildPrefsWidget */
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import {
  ExtensionPreferences,
  gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// Page Adjust time
const AdjustTimePage = GObject.registerClass(
  class ChronosAdjustTimePrefPage extends Adw.PreferencesPage {
    _init (settings, settingsKey) {
      super._init({
        title: _('Adjust time'),
        icon_name: 'org.gnome.Settings-time-symbolic',
        name: 'ChronosAdjustTimePrefPage',
      });
      this.settings = settings;
      this.initialTrackedTime = settings.get_int('state-tracked-time');

      const groupAdjustStartTime = new Adw.PreferencesGroup({
        title: _('Adjust tracked time'),
      });

      this.spinHours = new Adw.SpinRow({
        title: _('Hours'),
        adjustment: new Gtk.Adjustment({
          value: 0,
          lower: -999,
          upper: 999,
          step_increment: 1,
        }),
        value: 0,
      });

      this.spinMin = new Adw.SpinRow({
        title: _('Minutes'),
        adjustment: new Gtk.Adjustment({
          value: 0,
          lower: -60,
          upper: 60,
          step_increment: 1,
        }),
        value: 0,
      });

      this.spinHours.connect('output', this._adjustTrackedTime.bind(this));
      this.spinMin.connect('output', this._adjustTrackedTime.bind(this));

      groupAdjustStartTime.add(this.spinHours);
      groupAdjustStartTime.add(this.spinMin);

      this.add(groupAdjustStartTime);
    }

    _adjustTrackedTime () {
      const hours = this.spinHours.get_value();
      const mins = this.spinMin.get_value();
      const change = hours * 60 * 60 + mins * 60;
      this.settings.set_int('state-tracked-time',
        this.initialTrackedTime + change);
    }
  },
);

// Page Appearance
const AppearancePage = GObject.registerClass(
  class ChronosAppearancePrefPage extends Adw.PreferencesPage {
    _init (settings, settingsKey) {
      super._init({
        title: _('Appearance'),
        icon_name: 'preferences-desktop-appearance-symbolic',
        name: 'ChronosAppearancePrefPage',
      });
      this.settings = settings;

      const groupDisplay = new Adw.PreferencesGroup({
        title: _('Display'),
      });

      const switchShowSeconds = new Adw.SwitchRow({
        title: _('Show seconds'),
      });

      this.settings.bind('pref-show-seconds', switchShowSeconds, 'active',
        Gio.SettingsBindFlags.DEFAULT);

      groupDisplay.add(switchShowSeconds);

      const groupColors = new Adw.PreferencesGroup({
        title: _('Colours'),
      });

      const normalColor = new Gdk.RGBA();
      normalColor.parse(this.settings.get_string('pref-indicator-color'));
      const colorButtonNormal = new Gtk.ColorDialogButton({
        rgba: normalColor,
        halign: 3,
        valign: 3,
        dialog: new Gtk.ColorDialog(),
      });
      const actionRowNormalColor = new Adw.ActionRow({
        title: _('Normal state'),
      });

      colorButtonNormal.connect('notify::rgba', () => {
        this._saveColorChange(colorButtonNormal.get_rgba(),
          'pref-indicator-color');
      });

      actionRowNormalColor.add_suffix(colorButtonNormal);
      groupColors.add(actionRowNormalColor);

      const pausedColor = new Gdk.RGBA();
      pausedColor.parse(
        this.settings.get_string('pref-indicator-paused-color'));
      const colorButtonPaused = new Gtk.ColorDialogButton({
        rgba: pausedColor,
        halign: 3,
        valign: 3,
        dialog: new Gtk.ColorDialog(),
      });
      const actionRowPausedColor = new Adw.ActionRow({
        title: _('Paused state'),
      });

      colorButtonPaused.connect('notify::rgba', () => {
        this._saveColorChange(colorButtonPaused.get_rgba(),
          'pref-indicator-paused-color');
      });

      actionRowPausedColor.add_suffix(colorButtonPaused);

      groupColors.add(actionRowPausedColor);

      this.add(groupDisplay);
      this.add(groupColors);
    }

    _saveColorChange (color, key) {
      // Saves changes to the settings
      this.settings.set_string(key, color.to_string());
    }
  },
);

// Page Behavior
const BehaviorPage = GObject.registerClass(
  class ChronosBehaviorPrefPage extends Adw.PreferencesPage {
    _init (settings, settingsKey) {
      super._init({
        title: _('Behavior'),
        icon_name: 'org.gnome.Settings-symbolic',
        name: 'ChronosBehaviorPrefPage',
      });
      this.settings = settings;

      const groupOnLock = new Adw.PreferencesGroup();

      const switchPauseOnLock = new Adw.SwitchRow({
        title: _('Pause while screen locked (and other inactive states)'),
      });

      this.settings.bind('pref-pause-on-destroy', switchPauseOnLock, 'active',
        Gio.SettingsBindFlags.DEFAULT);

      groupOnLock.add(switchPauseOnLock);

      this.add(groupOnLock);

      const groupLogging = new Adw.PreferencesGroup();

      const switchLogging = new Adw.SwitchRow({
        title: _('Log changes of time tracker state'),
        subtitle: 'Log file is ~/timeTrack.log',
      });

      this.settings.bind('pref-log-change-state', switchLogging, 'active',
        Gio.SettingsBindFlags.DEFAULT);

      groupLogging.add(switchLogging);

      this.add(groupLogging);

      const groupStartOnReset = new Adw.PreferencesGroup();
      const switchStartOnReset = new Adw.SwitchRow({
        title: _('Start tracker when restart timer'),
      });

      this.settings.bind('pref-start-on-reset', switchStartOnReset, 'active',
        Gio.SettingsBindFlags.DEFAULT);

      groupStartOnReset.add(switchStartOnReset);
      this.add(groupStartOnReset);
    }
  },
);

export default class ChronosPreferences extends ExtensionPreferences {
  fillPreferencesWindow (window) {
    const settings = this.getSettings();

    const pageAdjustTime = new AdjustTimePage(settings);
    const pageAppearance = new AppearancePage(settings);
    const pageBehavior = new BehaviorPage(settings);

    window.add(pageAdjustTime);
    window.add(pageAppearance);
    window.add(pageBehavior);
  }
}
