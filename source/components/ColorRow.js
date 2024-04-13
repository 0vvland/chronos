import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gdk from 'gi://Gdk';

export const ColorRow = GObject.registerClass({
    Properties: {
      value: GObject.ParamSpec.string(
        'value',
        'RGBA value of color',
        'RGBA value of color',
        GObject.ParamFlags.READWRITE,
        null,
      ),
    },
  },
  class ChronosColorRow extends Adw.ActionRow {
    get value () {
      return this._value;
    }

    set value (v) {
      if (this._value === v) {
        return;
      }
      this._value = v;
      const rgba = new Gdk.RGBA();
      rgba.parse(this._value);
      this.colorButton.rgba = rgba;
      this.notify('value');
    }

    _init (params) {
      super._init({
        title: params.title,
        subtitle: params.subtitle || '',
      });
      this.colorButton = new Gtk.ColorDialogButton({
        halign: 3,
        valign: 3,
        dialog: new Gtk.ColorDialog(),
      });

      this.value = params.value;

      this.colorButton.connect('notify::rgba', () => {
        this.value = this.colorButton.get_rgba().to_string();
      });

      this.add_suffix(this.colorButton);
    }
  },
);
