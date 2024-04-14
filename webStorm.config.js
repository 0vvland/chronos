System.config({
  'paths': {
    // git clone https://gitlab.gnome.org/GNOME/gnome-shell.git
    'resource:///org/gnome/shell/*': './gnome-shell/js/*',
    'resource:///org/gnome/Shell/Extensions/*': './gnome-shell/*',
    // https://github.com/gjsify/types
    // npm install @girs/gjs @girs/gtk-4.0 @girs/adw-1 @girs/gobject-2.0 @girs/clutter-14 @girs/st-14
    'gi://Gio': './node_modules/gio-2.0/gio-2.0.d.ts',
    'gi://Adw': './node_modules/adw-1/adw-1.d.ts',
    'gi://GObject': './node_modules/gobject-2.0/gobject-2.0.d.ts',
    'gi://GLib': './node_modules/glib-2.0/glib-2.0.d.ts',
    'gi://Gtk': './node_modules/gtk-4.0/gtk-4.0.d.ts',
    'gi://Clutter': './node_modules/clutter-14/clutter-14.d.ts',
    'gi://St': './node_modules/st-14/st-14.d.ts',
  },
});
