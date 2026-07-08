import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import {
  ExtensionPreferences,
  gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { TimeRow } from './components/TimeRow.js';
import { ColorRow } from './components/ColorRow.js';

// Page Adjust time
const AdjustTimePage = GObject.registerClass(
  class ChronosAdjustTimePrefPage extends Adw.PreferencesPage {
    _init (settings, settingsKey) {
      super._init({
        title: _('Time'),
        icon_name: 'org.gnome.Settings-time-symbolic',
        name: 'ChronosAdjustTimePrefPage',
      });
      this.settings = settings;

      const groupAdjustStartTime = new Adw.PreferencesGroup();

      this.add(groupAdjustStartTime);

      const timeRowTrackedTime = new TimeRow({
        title: _('Adjust tracked time'),
        subtitle: _(
          'If tracker is not paused value can be diff with indicator'),
      });

      this.settings.bind('state-tracked-time', timeRowTrackedTime, 'value',
        Gio.SettingsBindFlags.DEFAULT);

      groupAdjustStartTime.add(timeRowTrackedTime);

      const timeRowResetTime = new TimeRow({
        title: _('Reset time'),
        subtitle: _('Time that will be set initially on reset'),
      });

      this.settings.bind('pref-reset-time', timeRowResetTime, 'value',
        Gio.SettingsBindFlags.DEFAULT);

      groupAdjustStartTime.add(timeRowResetTime);

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
        title: _('Colors'),
      });

      const normalColorRow = new ColorRow({
        title: _('Normal state'),
      });
      this.settings.bind('pref-indicator-color', normalColorRow, 'value',
        Gio.SettingsBindFlags.DEFAULT);

      const pauseColorRow = new ColorRow({
        title: _('Paused state'),
      });
      this.settings.bind('pref-indicator-paused-color', pauseColorRow, 'value',
        Gio.SettingsBindFlags.DEFAULT);

      groupColors.add(normalColorRow);
      groupColors.add(pauseColorRow);

      this.add(groupDisplay);
      this.add(groupColors);

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

// Page Alarms
const AlarmsPage = GObject.registerClass(
  class ChronosAlarmsPrefPage extends Adw.PreferencesPage {
    _init (settings, settingsKey) {
      super._init({
        title: _('Alarms'),
        icon_name: 'alarm-symbolic',
        name: 'ChronosAlarmsPrefPage',
      });
      this.settings = settings;

      const groupBreakAlarm = new Adw.PreferencesGroup({
        title: _('Take a break alarm'),
      });

      const switchBreakAlarm = new Adw.SwitchRow({
        title: _('Enable break alarm'),
        subtitle: _('Notify to take a break after a period of tracking'),
      });

      this.settings.bind('pref-break-alarm-enabled', switchBreakAlarm, 'active',
        Gio.SettingsBindFlags.DEFAULT);

      groupBreakAlarm.add(switchBreakAlarm);

      const intervalRow = new TimeRow({
        title: _('Interval'),
        subtitle: _('Time of non-pause tracking before alarm triggers'),
        value: this.settings.get_int('pref-break-alarm-interval'),
      });

      this.settings.bind('pref-break-alarm-interval', intervalRow, 'value',
        Gio.SettingsBindFlags.DEFAULT);

      intervalRow.visible = switchBreakAlarm.active;
      switchBreakAlarm.connect('notify::active', () => {
        intervalRow.visible = switchBreakAlarm.active;
      });

      groupBreakAlarm.add(intervalRow);

      this.add(groupBreakAlarm);
    }
  },
);

export default class ChronosPreferences extends ExtensionPreferences {
  fillPreferencesWindow (window) {
    const settings = this.getSettings();

    const pageAdjustTime = new AdjustTimePage(settings);
    const pageAppearance = new AppearancePage(settings);
    const pageBehavior = new BehaviorPage(settings);
    const pageAlarms = new AlarmsPage(settings);

    window.add(pageAdjustTime);
    window.add(pageAppearance);
    window.add(pageBehavior);
    window.add(pageAlarms);
  }
}
