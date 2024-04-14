import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import {
  Notification,
  // NotificationBanner,
  Source,
} from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

/*
Alert to take a brake, forget to start tracking, time reached (list? every x time)
Required actions:
- close (use common close action)
- remind in: pass list of times, custom (time selector)
- dismiss for: passed time * 2, current track (while not paused), custom

Props:
- text
- title (Chronos?)
- Remind: number[]
- dismiss: { time: number[], tracking: boolean, day: boolean}

*/

const DropdownActionButton = GObject.registerClass({
  GTypeName: 'DropdownActionButton',
}, class DropdownActionButton extends St.Button {
  _init (label, callback) {
    super._init({
      label: `${label} ▼`,
      style_class: 'button',
      can_focus: true,
      x_expand: true,
    });

    this._callback = callback;

    // Create the dropdown menu
    this._menu = new PopupMenu.PopupMenu(this, 0.5, St.Side.TOP);
    Main.uiGroup.add_child(this._menu.actor);
    this._menu.actor.hide();

    this._menu.addAction('Option 1', () => console.log('Selected 1'));
    this._menu.addAction('Option 2', () => console.log('Selected 2'));

    // Connect the physical click to the activation logic
    this.connect('clicked', () => this.activate());
  }

  // This method fulfills the requirement to call the callback
  activate () {
    if (this._menu.isOpen) {
      this._menu.close();
    } else {
      this._menu.open();
      // You can trigger the callback here or when an item is selected
      if (this._callback) {
        this._callback();
      }
    }
  }

  addMenuItem (label, callback) {
    this._menu.addAction(label, callback);
  }

  destroy () {
    if (this._menu) {
      Main.uiGroup.remove_child(this._menu.actor);
      this._menu.destroy();
    }
    super.destroy();
  }
});

export const ChronosNotification = GObject.registerClass({
    GTypeName: 'ChronosNotification',
    Signals: {},
  },
  class ChronosNotification extends Notification {

    get actions () {
      return [this._dropdownButton];
    }

    _init (title, message, params) {
      this.source = new Source({});
      // TODO set sandwatch icon
      super._init({
        source: this.source,
        title: 'Chronos Tracker',
        iconName: 'appointment-new-symbolic',
        // gicon:
        body: 'message',
      });

      this._dropdownBin = new St.Bin({
        style_class: 'notification-dropdown-bin',
        x_expand: true,
        layout_manager: new Clutter.BinLayout(),
      });

      this._dropdownButton = new DropdownActionButton('Select Task', () => {
        console.log('Dropdown menu was toggled!');
      });
      // this.emit('action-added', this._dropdownButton);
    }

    show () {
      if (!Main.messageTray.getSources().includes(this.source)) {
        Main.messageTray.add(this.source);
      }

      this.source.addNotification(this);
    }

    destroy () {
      super.destroy();
    }
  },
);
