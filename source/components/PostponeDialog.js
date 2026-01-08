import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

export const PostponeDialog = GObject.registerClass({
  GTypeName: 'PostponeDialog',
}, class PostponeDialog extends ModalDialog.ModalDialog {
  _init (callback) {
    super._init({ styleClass: 'chronos-modal-dialog' });
    this._callback = callback;

    // 1. Create a content layout
    let box = new St.BoxLayout({
      vertical: true,
      style_class: 'modal-dialog-content-box',
      style: 'min-width: 300px; padding: 10px;',
    });
    this.contentLayout.add_child(box);

    // 2. Add a title
    box.add_child(new St.Label({
      text: 'Select Activity',
      style_class: 'modal-dialog-title',
      style: 'font-weight: bold; margin-bottom: 15px;',
    }));

    // 3. Create a Scrollable List Area
    let scrollView = new St.ScrollView({
      hscrollbar_policy: St.PolicyType.NEVER,
      vscrollbar_policy: St.PolicyType.AUTOMATIC,
      style: 'max-height: 300px;',
    });
    box.add_child(scrollView);

    let listBox = new St.BoxLayout({ vertical: true });
    scrollView.set_child(listBox);

    // 4. Add items to the list
    const options = ['Coding', 'Meeting', 'Design', 'Planning', 'Testing'];
    options.forEach(option => {
      let btn = new St.Button({
        label: option,
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

    // 5. Add a standard Cancel button at the bottom
    this.setButtons([
      {
        label: 'Cancel',
        action: () => this.close(),
        key: Clutter.KEY_Escape,
      }]);
  }
});
