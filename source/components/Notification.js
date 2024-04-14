import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import St from 'gi://St';
import {
  Notification,
  NotificationBanner,
  Source,
} from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Message } from 'resource:///org/gnome/shell/ui/messageList.js';
import Gio from 'gi://Gio';

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
      const banner = new NotificationBanner(this);
      // const banner = new Message('test', 'message');

      // const menuModel = new Gio.MenuModel({});

      // SplitButton
      // const button = new Gtk.LinkButton({
      //   // style_class: 'notification-button' + extra_style,
      //   label: 'button',
      //   uri: 'https://wwww.ya.ru',
      //   // x_expand: true,
      //   // can_focus: true,
      //   // menuModel,
      // });

      // button.menuModel.

      const buttonBox = new St.BoxLayout({
        style_class: 'notification-actions',
        x_expand: true,
      });

      const label = new Gtk.Label({
        label: ':',
      });

      buttonBox.add(label);
      banner.setActionArea(buttonBox);
      // banner.addButton(button, () => console.log('test'));
      return banner;
    }

    show () {
      Main.messageTray.add(this.source);
      this.source.showNotification(this);
    }
  },
);
