import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// Rendered Monday-first as GNOME does, but the values are Date.getDay()
// encoding: 0 = Sunday ... 6 = Saturday
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// translated in _init, once the extension has bound its domain
const weekdayLabels = () => ({
  0: _('Sun'),
  1: _('Mon'),
  2: _('Tue'),
  3: _('Wed'),
  4: _('Thu'),
  5: _('Fri'),
  6: _('Sat'),
});

const sortDays = (days) => [...days].sort((a, b) => a - b);

const sameDays = (a, b) => a.length === b.length &&
  a.every((day, i) => day === b[i]);

export const WeekdayRow = GObject.registerClass({
    Properties: {
      value: GObject.ParamSpec.jsobject(
        'value',
        'Selected weekdays',
        'Selected weekdays as an array of Date.getDay() values',
        GObject.ParamFlags.READWRITE,
      ),
    },
  },
  class ChronosWeekdayRow extends Adw.ActionRow {
    get value () {
      return this._value;
    }

    set value (v) {
      const days = sortDays(v || []);
      if (sameDays(this._value, days)) {
        return;
      }
      this._value = days;
      this.setButtonStates();
      this.notify('value');
    }

    _init (params) {
      super._init({
        title: params.title,
        subtitle: params.subtitle,
      });
      this._value = sortDays(params.value || []);
      // set while reflecting an external value, so the toggles do not each
      // write back a partial selection
      this._updating = false;

      const box = new Gtk.Box({
        halign: Gtk.Align.CENTER,
        spacing: 6,
        'margin-top': 10,
        'margin-bottom': 10,
      });
      this.add_suffix(box);

      const labels = weekdayLabels();
      this._updating = true;
      this._buttons = WEEKDAY_ORDER.map((day) => {
        const button = new Gtk.ToggleButton({
          label: labels[day],
          active: this._value.includes(day),
          valign: Gtk.Align.CENTER,
        });
        button.connect('toggled', () => {
          if (this._updating) {
            return;
          }
          const selected = this._buttons
            .filter((b) => b.active)
            .map((b) => b._chronosDay);
          this.value = selected;
        });
        button._chronosDay = day;
        box.append(button);
        return button;
      });
      this._updating = false;
    }

    setButtonStates () {
      this._updating = true;
      this._buttons.forEach((button) => {
        button.active = this._value.includes(button._chronosDay);
      });
      this._updating = false;
    }
  },
);
