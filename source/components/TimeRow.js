import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import GObject from 'gi://GObject';

export const TimeRow = GObject.registerClass({
    Properties: {
      value: GObject.ParamSpec.int(
        'value',
        'Value of time in seconds',
        'Value of time in seconds',
        GObject.ParamFlags.READWRITE,
        -2147483647, 2147483647,
        0,
      ),
    },
  },
  class ChronosTimeRow extends Adw.ActionRow {
    get value () {
      return this._value;
    }

    set value (v) {
      if (this._value === v) {
        return;
      }
      this._value = v;
      this.setSpinnerValues();
      this.notify('value');
    }

    _init (params) {
      super._init({
        title: params.title,
        subtitle: params.subtitle,
      });
      this._value = params.value || 0;
      const box = new Gtk.Box({
        halign: 3,
        spacing: 6,
        'margin-top': 10,
        'margin-bottom': 10,
      });
      this.add_suffix(box);

      this.hSpin = new Gtk.SpinButton({
        halign: 3,
        orientation: 1,
        wrap: true,
        'climb-rate': 1,
        adjustment: new Gtk.Adjustment({
          lower: -999,
          upper: 999,
          step_increment: 1,
        }),
      });

      this.mSpin = new Gtk.SpinButton({
        halign: 3,
        orientation: 1,
        wrap: true,
        'climb-rate': 1,
        adjustment: new Gtk.Adjustment({
          lower: 0,
          upper: 59,
          step_increment: 1,
        }),
      });

      const label = new Gtk.Label({
        label: ':',
      });

      box.append(this.hSpin);
      box.append(label);
      box.append(this.mSpin);

      const changeValue = (spin) => () => {
        const sec = Math.abs(this._value % 60);
        const hours = this.hSpin.adjustment.value;
        const isNegative = hours < 0 || this.hSpin.text === '-0';
        const min = this.mSpin.adjustment.value;
        const change = Math.abs(hours) * 3600 + min * 60 + sec;
        this.value = change * (isNegative ? -1 : 1);
        return true;
      };

      this.hSpin.connect('output', changeValue(this.hSpin));

      this.mSpin.connect('output', changeValue(this.mSpin));

      this.setSpinnerValues();
    }

    setSpinnerValues () {
      const isNegative = this._value < 0;
      const value = Math.abs(this._value);
      let hourValue = Math.floor(value / 3600);
      const minValue = Math.floor((value - hourValue * 3600) / 60);
      hourValue *= isNegative ? -1 : 1;

      this.freeze_notify();
      this.hSpin.adjustment.value = hourValue;
      if (hourValue === 0 && isNegative) {
        this.hSpin.text = '-0';
      } else {
        this.hSpin.text = hourValue.toString().padStart(2, '0');
      }

      this.mSpin.adjustment.value = minValue;
      this.mSpin.text = minValue.toString().padStart(2, '0');
      this.thaw_notify();
    }
  },
);
