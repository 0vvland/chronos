import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

export const formatPostponeTime = (seconds) => {
  const units = [
    {label: 'day', secs: 86400},
    {label: 'hour', secs: 3600},
    {label: 'minute', secs: 60},
  ];
  for (const unit of units) {
    if (seconds % unit.secs === 0) {
      const count = seconds / unit.secs;
      return `${count} ${unit.label}${count !== 1 ? 's' : ''}`;
    }
  }
  return `${seconds} seconds`;
};

export const PostponeDialog = GObject.registerClass({
  GTypeName: 'PostponeDialog',
}, class PostponeDialog extends ModalDialog.ModalDialog {
  _init(options, defaultValue, callback) {
    super._init({styleClass: 'chronos-modal-dialog'});
    this._callback = callback;

    let box = new St.BoxLayout({
      vertical: true,
      style_class: 'modal-dialog-content-box',
      style: 'min-width: 300px; padding: 10px;',
    });
    this.contentLayout.add_child(box);

    box.add_child(new St.Label({
      text: 'Select Duration',
      style_class: 'modal-dialog-title',
      style: 'font-weight: bold; margin-bottom: 15px;',
    }));

    let scrollView = new St.ScrollView({
      hscrollbar_policy: St.PolicyType.NEVER,
      vscrollbar_policy: St.PolicyType.AUTOMATIC,
      style: 'max-height: 300px;',
    });
    box.add_child(scrollView);

    let listBox = new St.BoxLayout({vertical: true});
    scrollView.set_child(listBox);

    options.forEach(option => {
      let btn = new St.Button({
        label: formatPostponeTime(option),
        style_class: 'button activity-item',
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
        label: 'Cancel',
        action: () => this.close(),
        key: Clutter.KEY_Escape,
      }]);
  }
});
