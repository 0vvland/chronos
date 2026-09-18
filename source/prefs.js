import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import {
  ExtensionPreferences,
  gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { TimeRow } from './components/TimeRow.js';
import { ColorRow } from './components/ColorRow.js';
import { WeekdayRow } from './components/WeekdayRow.js';

// Offered when the break alarm is switched on without a stored interval
const DEFAULT_BREAK_INTERVAL = 3600;

const DEFAULT_START_DAYS = [1, 2, 3, 4, 5];

// times of day and the delay stay inside one day: 00:00 to 23:59
const TIME_OF_DAY_BOUNDS = { hoursLower: 0, hoursUpper: 23 };

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
    _init (settings) {
      super._init({
        title: _('Alarms'),
        icon_name: 'alarm-symbolic',
        name: 'ChronosAlarmsPrefPage',
      });
      this.settings = settings;

      const groupBreakAlarm = new Adw.PreferencesGroup({
        title: _('Take a break alarm'),
      });

      // 'pref-break-alarm-interval' of 0 means the alarm is off, so the switch
      // is not bound to a key: it writes 0 or the last interval the user chose
      const storedInterval = this.settings.get_int('pref-break-alarm-interval');
      this._breakInterval = storedInterval > 0
        ? storedInterval
        : DEFAULT_BREAK_INTERVAL;

      const switchBreakAlarm = new Adw.SwitchRow({
        title: _('Enable break alarm'),
        subtitle: _('Notify to take a break after a period of tracking'),
        active: storedInterval > 0,
      });

      groupBreakAlarm.add(switchBreakAlarm);

      const intervalRow = new TimeRow({
        title: _('Interval'),
        subtitle: _('Time of non-pause tracking before alarm triggers'),
        value: this._breakInterval,
      });

      intervalRow.connect('notify::value', () => {
        if (intervalRow.value > 0) {
          this._breakInterval = intervalRow.value;
        }
        if (switchBreakAlarm.active) {
          this.settings.set_int('pref-break-alarm-interval', intervalRow.value);
        }
      });

      intervalRow.visible = switchBreakAlarm.active;
      switchBreakAlarm.connect('notify::active', () => {
        intervalRow.visible = switchBreakAlarm.active;
        this.settings.set_int('pref-break-alarm-interval',
          switchBreakAlarm.active ? this._breakInterval : 0);
      });

      groupBreakAlarm.add(intervalRow);

      this.add(groupBreakAlarm);

      const groupStartAlarm = new Adw.PreferencesGroup({
        title: _('Start tracking reminder'),
      });

      // an empty 'pref-start-alarm-days' means the alarm is off, so the switch
      // is not bound to a key: it writes an empty array or the last selection
      const storedDays = this.settings.get_value('pref-start-alarm-days')
        .deep_unpack();
      this._startDays = storedDays.length > 0
        ? storedDays
        : DEFAULT_START_DAYS;

      const switchStartAlarm = new Adw.SwitchRow({
        title: _('Enable start tracking reminder'),
        subtitle: _(
          'Notify when the tracker stays paused during working hours'),
        active: storedDays.length > 0,
      });

      groupStartAlarm.add(switchStartAlarm);

      const daysRow = new WeekdayRow({
        title: _('Days'),
        subtitle: _('Weekdays the reminder is active on'),
        value: this._startDays,
      });

      // Gio.Settings.bind does not handle array properties, so wire it by hand
      daysRow.connect('notify::value', () => {
        if (daysRow.value.length > 0) {
          this._startDays = daysRow.value;
        }
        if (switchStartAlarm.active) {
          this.settings.set_value('pref-start-alarm-days',
            new GLib.Variant('ai', daysRow.value));
        }
      });

      groupStartAlarm.add(daysRow);

      const fromRow = new TimeRow({
        title: _('From'),
        subtitle: _('Time of day the reminder becomes active'),
        ...TIME_OF_DAY_BOUNDS,
      });

      this.settings.bind('pref-start-alarm-from', fromRow, 'value',
        Gio.SettingsBindFlags.DEFAULT);

      groupStartAlarm.add(fromRow);

      const toRow = new TimeRow({
        title: _('To'),
        subtitle: _('Time of day the reminder stops being active'),
        ...TIME_OF_DAY_BOUNDS,
      });

      this.settings.bind('pref-start-alarm-to', toRow, 'value',
        Gio.SettingsBindFlags.DEFAULT);

      groupStartAlarm.add(toRow);

      const delayRow = new TimeRow({
        title: _('Delay'),
        subtitle: _('Time of pause inside the timeframe before alarm triggers'),
        ...TIME_OF_DAY_BOUNDS,
      });

      this.settings.bind('pref-start-alarm-delay', delayRow, 'value',
        Gio.SettingsBindFlags.DEFAULT);

      groupStartAlarm.add(delayRow);

      const timeframeWarning = new Adw.ActionRow({
        title: _('The reminder is inactive'),
        subtitle: _('"To" must be later than "From"'),
      });
      timeframeWarning.add_prefix(new Gtk.Image({
        icon_name: 'dialog-warning-symbolic',
      }));

      groupStartAlarm.add(timeframeWarning);

      const startAlarmRows = [daysRow, fromRow, toRow, delayRow];

      const refreshStartAlarmRows = () => {
        startAlarmRows.forEach((row) => {
          row.visible = switchStartAlarm.active;
        });
        timeframeWarning.visible = switchStartAlarm.active &&
          toRow.value <= fromRow.value;
      };

      fromRow.connect('notify::value', refreshStartAlarmRows);
      toRow.connect('notify::value', refreshStartAlarmRows);

      switchStartAlarm.connect('notify::active', () => {
        this.settings.set_value('pref-start-alarm-days',
          new GLib.Variant('ai',
            switchStartAlarm.active ? this._startDays : []));
        refreshStartAlarmRows();
      });

      refreshStartAlarmRows();

      this.add(groupStartAlarm);
    }
  },
);

// Page About
const AboutPage = GObject.registerClass(
  class ChronosAboutPrefPage extends Adw.PreferencesPage {
    _init (settings, extensionDir) {
      super._init({
        title: _('About'),
        icon_name: 'help-about-symbolic',
        name: 'ChronosAboutPrefPage',
      });
      this.settings = settings;

      const groupLogo = new Adw.PreferencesGroup();

      const logoBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
        margin_top: 24,
        margin_bottom: 24,
      });
      logoBox.set_size_request(96, 144);
      const cssProvider = new Gtk.CssProvider();
      cssProvider.load_from_string('box { background: white; border-radius: 12px; padding: 16px; }');
      logoBox.get_style_context().add_provider(cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

      const logoFile = extensionDir.get_child('logo.svg');
      const logoPicture = Gtk.Picture.new_for_file(logoFile);
      logoPicture.set_halign(Gtk.Align.FILL);
      logoPicture.set_valign(Gtk.Align.FILL);
      logoPicture.set_hexpand(true);
      logoPicture.set_vexpand(true);
      logoPicture.set_keep_aspect_ratio(true);
      logoBox.append(logoPicture);

      groupLogo.add(logoBox);

      const groupInfo = new Adw.PreferencesGroup({
        title: _('Chronos Time Tracker'),
      });

      const descriptionRow = new Adw.ActionRow({
        title: _('Description'),
        subtitle: _(
          'Time tracker tool. Track your time, customize display, log start/pause events.'
        ),
      });

      const urlRow = new Adw.ActionRow({
        title: _('Website'),
        subtitle: 'https://github.com/0vvland/chronos',
      });

      const linkButton = new Gtk.LinkButton({
        label: _('Open'),
        uri: 'https://github.com/0vvland/chronos',
        valign: Gtk.Align.CENTER,
      });
      urlRow.add_suffix(linkButton);
      urlRow.activatable_widget = linkButton;

      groupInfo.add(descriptionRow);
      groupInfo.add(urlRow);

      this.add(groupLogo);
      this.add(groupInfo);
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
    const pageAbout = new AboutPage(settings, this.dir);

    window.add(pageAdjustTime);
    window.add(pageAppearance);
    window.add(pageBehavior);
    window.add(pageAlarms);
    window.add(pageAbout);
  }
}
