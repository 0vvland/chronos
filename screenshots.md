# Regenerating `preferences.png`

`preferences.png` in the repo root is the README's preferences shot: the five
`Adw.PreferencesPage`s side by side, one pane each. It is rebuilt by **rendering
the prefs window offscreen from a gjs driver**, not by taking a desktop
screenshot — the Shell's `org.gnome.Shell.Screenshot.ScreenshotWindow` refuses
CLI callers (`AccessDenied`), so there is nothing to point a screenshot tool at.

The driver builds the real `ChronosPreferences` against the *installed*
extension, flips `visible_page_name` page by page, and saves each frame with
`Gsk.Renderer.render_texture`. The panes are then scaled and montaged into one
strip.

## Recipe

1. **Install the working tree** so the shot matches the code:

   ```shell
   make install
   ```

2. **Copy the installed extension and shim out the Shell import.** `prefs.js`
   and `components/WeekdayRow.js` import
   `resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js`, whose
   `gettext` throws `gettext can only be called from extensions` outside a real
   Shell extension host, and whose `ExtensionPreferences.lookupByUUID()` returns
   `null` because nothing populated the extension registry. A three-method shim
   replaces both:

   ```shell
   SRC=~/.local/share/gnome-shell/extensions/chronos@time-tracker.com
   D=/tmp/chronos-shot
   rm -rf $D && mkdir -p $D && cp -r $SRC/. $D/
   cat > $D/shim.js <<'EOF'
   import Gio from 'gi://Gio';

   export const gettext = (s) => s;

   export class ExtensionPreferences {
     constructor (metadata) {
       this.metadata = metadata;
     }

     get dir () {
       return this.metadata.dir;
     }

     getSettings (schema = this.metadata['settings-schema']) {
       const source = Gio.SettingsSchemaSource.new_from_directory(
         this.dir.get_child('schemas').get_path(),
         Gio.SettingsSchemaSource.get_default(),
         true);
       return new Gio.Settings({ settings_schema: source.lookup(schema, true) });
     }
   }
   EOF
   sed -i "s|'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js'|'./shim.js'|" $D/prefs.js
   sed -i "s|'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js'|'../shim.js'|" $D/components/WeekdayRow.js
   ```

   The shim keeps the real GSettings, read from the copied `schemas/` directory
   — so **the panes show whatever the live settings are**. Set them to what the
   README should advertise before capturing (the alarms in particular: with a
   switch off, its detail rows are hidden and the Alarms pane collapses to three
   toggles).

3. **Render the pages** with `/tmp/shot.js` below:

   ```shell
   GI_TYPELIB_PATH=/usr/lib64/gnome-shell LD_LIBRARY_PATH=/usr/lib64/gnome-shell \
     SHOT_HEIGHT=1150 gjs -m /tmp/shot.js
   ```

   ```js
   import Gio from 'gi://Gio';
   import GLib from 'gi://GLib';
   import Gtk from 'gi://Gtk?version=4.0';
   import Adw from 'gi://Adw?version=1';

   Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource')._register();

   const PAGES = [
     ['time', 'ChronosAdjustTimePrefPage'],
     ['appearance', 'ChronosAppearancePrefPage'],
     ['behavior', 'ChronosBehaviorPrefPage'],
     ['alarms', 'ChronosAlarmsPrefPage'],
     ['about', 'ChronosAboutPrefPage'],
   ];

   Adw.init();

   const height = Number(GLib.getenv('SHOT_HEIGHT') ?? '1150');
   const dir = Gio.File.new_for_path('/tmp/chronos-shot');
   const [, bytes] = dir.get_child('metadata.json').load_contents(null);
   const metadata = JSON.parse(new TextDecoder().decode(bytes));
   metadata.dir = dir;
   metadata.path = dir.get_path();
   const { default: ChronosPreferences } = await import(dir.get_child('prefs.js').get_uri());
   const ext = new ChronosPreferences(metadata);
   const loop = new GLib.MainLoop(null, false);

   const win = new Adw.PreferencesWindow({ default_width: 860, default_height: height });
   ext.fillPreferencesWindow(win);
   win.present();

   let i = 0;
   const shoot = () => {
     const [file, name] = PAGES[i];
     win.set_visible_page_name(name);
     GLib.timeout_add(GLib.PRIORITY_DEFAULT, 700, () => {
       const paintable = new Gtk.WidgetPaintable({ widget: win });
       const snapshot = Gtk.Snapshot.new();
       const w = win.get_width(), h = win.get_height();
       paintable.snapshot(snapshot, w, h);
       const node = snapshot.to_node();
       const renderer = win.get_native().get_renderer();
       const texture = renderer.render_texture(node, null);
       texture.save_to_png(`/tmp/shot-${file}.png`);
       print(`saved ${file} ${w}x${h}`);
       i += 1;
       if (i < PAGES.length) {
         shoot();
       } else {
         loop.quit();
       }
       return GLib.SOURCE_REMOVE;
     });
   };

   GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1200, () => {
     shoot();
     return GLib.SOURCE_REMOVE;
   });

   loop.run();
   ```

4. **Pick the window height** — every pane is captured at the same size, so the
   height has to fit the tallest page and anything more is dead space in the
   other four. Capture once at `SHOT_HEIGHT=1200`, measure where each page's
   content ends, then re-capture at roughly `max + 40`:

   ```shell
   python3 - <<'EOF'
   from PIL import Image
   for p in ['time','appearance','behavior','alarms','about']:
       im=Image.open(f'/tmp/shot-{p}.png').convert('RGB'); w,h=im.size
       px=im.load(); bg=im.getpixel((w//2,h-20))
       last=0
       for y in range(h-6,-1,-1):
           if any(sum(abs(a-b) for a,b in zip(px[x,y],bg))>12 for x in range(60,w-60,2)):
               last=y; break
       print(p,last)
   EOF
   ```

   The scan skips the last 5 rows and 60 px at each side: the window border is a
   1 px line the full way round and otherwise reads as content on every row.
   With all alarms on, 1150 is the right height; with them off, 700.

5. **Montage the panes** into the final image:

   ```shell
   python3 - <<'EOF'
   from PIL import Image
   pages=['time','appearance','behavior','alarms','about']
   gap=6; pw=643; ph=round(1150*pw/860)   # SHOT_HEIGHT * pw / 860
   ims=[Image.open(f'/tmp/shot-{p}.png').convert('RGB').resize((pw,ph), Image.LANCZOS) for p in pages]
   out=Image.new('RGB',(pw*len(ims)+gap*(len(ims)-1),ph),(0,0,0))
   for i,im in enumerate(ims):
       out.paste(im,(i*(pw+gap),0))
   out.save('preferences.png', optimize=True)
   EOF
   ```

   643 px panes and 6 px gaps keep the text at the same on-screen size as the
   original three-pane image.

6. **Clean up** `/tmp/chronos-shot`, `/tmp/shot-*.png` and `/tmp/shot.js`.

## Notes

- **860 px width is not cosmetic.** Below roughly 700 px `Adw.PreferencesWindow`
  moves the view switcher out of the header bar into a bottom bar, and the panes
  stop looking like the published screenshot.
- **`Shew` typelib.** The Shell resource pulls in `gi://Shew`, which lives in
  `/usr/lib64/gnome-shell/girepository-1.0` — hence `GI_TYPELIB_PATH`. The shim
  avoids the resource, but the `Gio.Resource.load` line still registers it, so
  keep the env vars.
- **The window really is mapped** while the driver runs; it flashes on screen
  for a couple of seconds. There is no offscreen surface — `render_texture()`
  needs the window's renderer.
- **The About page stretches.** Its logo box is `vexpand`, so at a too-tall
  window the logo balloons and the changelog is pushed to the bottom. This is
  the page that decides the upper bound on `SHOT_HEIGHT`.
- `screenshot.png` (the panel indicator) is *not* produced this way — it is a
  crop of the top bar.
