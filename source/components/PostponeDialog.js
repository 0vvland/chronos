import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import {
  gettext as _,
  ngettext,
} from 'resource:///org/gnome/shell/extensions/extension.js';

// Each unit carries its own ngettext call rather than an English '+s': plural
// rules differ per language, and several have more than two forms. The calls
// live in thunks so the strings are translated when a dialog is built, not at
// module load, by which time the extension has bound its domain.
const UNITS = [
  { secs: 86400, plural: (n) => ngettext('%d day', '%d days', n) },
  { secs: 3600, plural: (n) => ngettext('%d hour', '%d hours', n) },
  { secs: 60, plural: (n) => ngettext('%d minute', '%d minutes', n) },
  { secs: 1, plural: (n) => ngettext('%d second', '%d seconds', n) },
];

export const formatPostponeTime = (seconds) => {
  const parts = [];
  let rest = seconds;
  for (const unit of UNITS) {
    const count = Math.floor(rest / unit.secs);
    // seconds are the last unit, and carry the whole remainder - including a
    // remainder of zero, when it is the only thing there is to say
    if (count > 0 || (unit.secs === 1 && parts.length === 0)) {
      parts.push(unit.plural(count).format(count));
      rest -= count * unit.secs;
    }
  }
  return parts.join(' ');
};

export const PostponeDialog = GObject.registerClass({
  GTypeName: 'PostponeDialog',
}, class PostponeDialog extends ModalDialog.ModalDialog {
  _init (options, callback, heading = _('Select Duration')) {
    super._init();
    this._callback = callback;

    const box = new St.BoxLayout({
      vertical: true,
      style_class: 'modal-dialog-content-box',
      style: 'min-width: 300px; padding: 10px;',
    });
    this.contentLayout.add_child(box);

    box.add_child(new St.Label({
      text: heading,
      style_class: 'modal-dialog-title',
      style: 'font-weight: bold; margin-bottom: 15px;',
    }));

    const scrollView = new St.ScrollView({
      hscrollbar_policy: St.PolicyType.NEVER,
      vscrollbar_policy: St.PolicyType.AUTOMATIC,
      style: 'max-height: 300px;',
    });
    box.add_child(scrollView);

    const listBox = new St.BoxLayout({ vertical: true });
    scrollView.set_child(listBox);

    options.forEach((option) => {
      const btn = new St.Button({
        label: formatPostponeTime(option),
        style_class: 'button',
        x_align: Clutter.ActorAlign.FILL,
        style: 'margin: 2px; padding: 8px;',
      });

      btn.connect('clicked', () => {
        this._callback(option);
        this.close();
      });

      listBox.add_child(btn);
    });

    this.setButtons([
      {
        label: _('Cancel'),
        action: () => this.close(),
        key: Clutter.KEY_Escape,
      }]);
  }
});
