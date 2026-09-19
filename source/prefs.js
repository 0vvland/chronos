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

// Offered when log truncation is switched on without a stored limit
const DEFAULT_LOG_MAX_LINES = 150;

const DEFAULT_START_DAYS = [1, 2, 3, 4, 5];

// times of day and the delay stay inside one day: 00:00 to 23:59
const TIME_OF_DAY_BOUNDS = { hoursLower: 0, hoursUpper: 23 };

// Release notes for the About page, newest release first — array order is
// display order. A version bump prepends a record; published entries are never
// rewritten. A thunk, so _() runs when the page is built, not at module load.
// Three preferences share one shape: their key has no room for an "off"
// state, so off is a sentinel value - 0, or an empty array. The switch is
// therefore not bound to the key; it writes either the sentinel or the last
// value the user chose, and the value row is hidden while off.
//
// `read`/`write` speak the key's own type, `isOn` decides what counts as a
// live value, and `refresh` is for the one site whose switch governs more
// than a single row.
const bindSentinelSwitch = ({
  switchRow, valueRow, read, write, off, isOn, fallback, refresh,
}) => {
  const stored = read();
  let remembered = isOn(stored) ? stored : fallback;
  const apply = refresh ?? (() => {
    valueRow.visible = switchRow.active;
  });

  // both set before anything is connected, so seeding writes nothing back
  switchRow.active = isOn(stored);
  valueRow.value = remembered;

  valueRow.connect('notify::value', () => {
    if (isOn(valueRow.value)) {
      remembered = valueRow.value;
    }
    if (switchRow.active) {
      write(valueRow.value);
    }
  });

  switchRow.connect('notify::active', () => {
    write(switchRow.active ? remembered : off);
    apply();
  });

  apply();
};

const CHANGELOG = () => [
  {
    version: 16,
    changes: [
      _('Break alarm: a reminder after a stretch of uninterrupted tracking'),
      _('Start tracking reminder: a nudge when tracking stays paused during working hours'),
      _('Goal alarm: a notification when tracked time reaches your target'),
      _('Postpone dialog shared by the alarms, to put a reminder off for a while'),
      _('Log line limit: the log file can be capped to a number of lines'),
      _('About page with the extension description and website link'),
    ],
  },
];

// Page Adjust time
const AdjustTimePage = GObject.registerClass(
  class ChronosAdjustTimePrefPage extends Adw.PreferencesPage {
    _init (settings) {
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
    _init (settings) {
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
    _init (settings) {
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

      // 'pref-log-max-lines' of 0 means never truncate
      const switchLogTruncate = new Adw.SwitchRow({
        title: _('Limit log file size'),
        subtitle: _('Keep only the newest lines, trimmed when the extension starts'),
      });

      groupLogging.add(switchLogTruncate);

      // minimum of 1, so 0 is reachable only through the switch
      const maxLinesRow = new Adw.SpinRow({
        title: _('Lines to keep'),
        adjustment: new Gtk.Adjustment({
          lower: 1,
          upper: 1000000,
          step_increment: 10,
          page_increment: 100,
        }),
      });

      groupLogging.add(maxLinesRow);

      bindSentinelSwitch({
        switchRow: switchLogTruncate,
        valueRow: maxLinesRow,
        read: () => this.settings.get_int('pref-log-max-lines'),
        write: (value) => this.settings.set_int('pref-log-max-lines', value),
        off: 0,
        isOn: (value) => value > 0,
        fallback: DEFAULT_LOG_MAX_LINES,
      });

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

      // 'pref-break-alarm-interval' of 0 means the alarm is off
      const switchBreakAlarm = new Adw.SwitchRow({
        title: _('Enable break alarm'),
        subtitle: _('Notify to take a break after a period of tracking'),
      });

      groupBreakAlarm.add(switchBreakAlarm);

      const intervalRow = new TimeRow({
        title: _('Interval'),
        subtitle: _('Time of non-pause tracking before alarm triggers'),
      });

      groupBreakAlarm.add(intervalRow);

      bindSentinelSwitch({
        switchRow: switchBreakAlarm,
        valueRow: intervalRow,
        read: () => this.settings.get_int('pref-break-alarm-interval'),
        write: (value) =>
          this.settings.set_int('pref-break-alarm-interval', value),
        off: 0,
        isOn: (value) => value > 0,
        fallback: DEFAULT_BREAK_INTERVAL,
      });

      this.add(groupBreakAlarm);

      const groupStartAlarm = new Adw.PreferencesGroup({
        title: _('Start tracking reminder'),
      });

      // an empty 'pref-start-alarm-days' means the alarm is off
      const switchStartAlarm = new Adw.SwitchRow({
        title: _('Enable start tracking reminder'),
        subtitle: _(
          'Notify when the tracker stays paused during working hours'),
      });

      groupStartAlarm.add(switchStartAlarm);

      const daysRow = new WeekdayRow({
        title: _('Days'),
        subtitle: _('Weekdays the reminder is active on'),
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

      // Gio.Settings.bind does not handle array properties, so the days are
      // wired by hand - which the sentinel switch was going to do regardless
      bindSentinelSwitch({
        switchRow: switchStartAlarm,
        valueRow: daysRow,
        read: () => this.settings.get_value('pref-start-alarm-days')
          .deep_unpack(),
        write: (days) => this.settings.set_value('pref-start-alarm-days',
          new GLib.Variant('ai', days)),
        off: [],
        isOn: (days) => days.length > 0,
        fallback: DEFAULT_START_DAYS,
        refresh: refreshStartAlarmRows,
      });

      this.add(groupStartAlarm);

      const groupGoalAlarm = new Adw.PreferencesGroup({
        title: _('Tracked time goal'),
      });

      // unlike the other two alarms every target value is usable, 0:00 and
      // negative included, so the switch binds to a key of its own
      const switchGoalAlarm = new Adw.SwitchRow({
        title: _('Enable tracked time goal alarm'),
        subtitle: _('Notify when the tracked time reaches the target'),
      });

      this.settings.bind('pref-goal-alarm-enabled', switchGoalAlarm, 'active',
        Gio.SettingsBindFlags.DEFAULT);

      groupGoalAlarm.add(switchGoalAlarm);

      // default hour bounds, so a negative target stays reachable
      const goalTimeRow = new TimeRow({
        title: _('Target'),
        subtitle: _('Tracked time at which the alarm triggers'),
      });

      this.settings.bind('pref-goal-alarm-time', goalTimeRow, 'value',
        Gio.SettingsBindFlags.DEFAULT);

      groupGoalAlarm.add(goalTimeRow);

      goalTimeRow.visible = switchGoalAlarm.active;
      switchGoalAlarm.connect('notify::active', () => {
        goalTimeRow.visible = switchGoalAlarm.active;
      });

      this.add(groupGoalAlarm);
    }
  },
);

// Page About
const AboutPage = GObject.registerClass(
  class ChronosAboutPrefPage extends Adw.PreferencesPage {
    _init (extensionDir) {
      super._init({
        title: _('About'),
        icon_name: 'help-about-symbolic',
        name: 'ChronosAboutPrefPage',
      });

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

      const groupWhatsNew = new Adw.PreferencesGroup({
        title: _('What\'s New'),
      });

      const changelogLabel = new Gtk.Label({
        wrap: true,
        xalign: 0,
        use_markup: true,
        margin_top: 12,
        margin_bottom: 12,
        margin_start: 12,
        margin_end: 12,
        label: CHANGELOG().map(({ version, changes }) => [
          `<b>${GLib.markup_escape_text(`Version ${version}`, -1)}</b>`,
          ...changes.map(
            (change) => `• ${GLib.markup_escape_text(change, -1)}`),
        ].join('\n')).join('\n\n'),
      });

      const changelogScroller = new Gtk.ScrolledWindow({
        height_request: 180,
        max_content_height: 180,
        propagate_natural_height: true,
        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        child: changelogLabel,
      });

      groupWhatsNew.add(changelogScroller);

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
      this.add(groupWhatsNew);
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
    const pageAbout = new AboutPage(this.dir);

    window.add(pageAdjustTime);
    window.add(pageAppearance);
    window.add(pageBehavior);
    window.add(pageAlarms);
    window.add(pageAbout);
  }
}
