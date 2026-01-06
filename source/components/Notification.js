import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import {
  Notification,
  NotificationBanner,
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

export const ChronosNotification = GObject.registerClass({
    GTypeName: 'ChronosNotification',
    Signals: {},
  },
  class ChronosNotification extends Notification {

    _init (title, message, params) {
      // TODO set sandwatch icon
      this.source = new Source('Chronos', 'avatar-default');
      super._init(this.source, title, message);
    }

    createBanner () {

      // 1. Create a container for our "dropdown"
      this._dropdownBin = new St.Bin({
        style_class: 'notification-dropdown-bin',
        x_expand: true,
        layout_manager: new Clutter.BinLayout()
      });

      // 2. Create the dropdown button
      this._dropdownButton = new St.Button({
        label: 'Select Option ▼',
        style_class: 'button',
        can_focus: true
      });

      // 3. Attach a Menu (The "Dropdown" list)
      this._menu = new PopupMenu.PopupMenu(this._dropdownButton, 0.5, St.Side.TOP);
      Main.uiGroup.add_actor(this._menu.actor);
      this._menu.actor.hide();

      this._menu.addAction('Option 1', () => console.log('Selected 1'));
      this._menu.addAction('Option 2', () => console.log('Selected 2'));
    }

    show () {
      Main.messageTray.add(this.source);
      this.source.showNotification(this);
    }
  }
);
