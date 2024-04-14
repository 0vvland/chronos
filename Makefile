TT_PO = `find ./source/locale -name *.po`
DOMAIN = chronos

.DEFAULT_GOAL := all

.PHONY: update_po
update_po: source/chronos.pot
	for item in $(TT_PO); do \
		echo "Processing" $$item; \
		xgettext --from-code=UTF-8 --output=$$item.tmp ./source/*.js; \
		msgmerge -U $$item $$item.tmp; \
		rm -f $$item.tmp; \
		msgfmt -c $$item -o `dirname $$item`/${DOMAIN}.mo; \
	done;

source/chronos.pot: source/*.js
	xgettext --from-code=UTF-8 --output=$@.tmp ./source/*.js
	msgmerge -U $@ $@.tmp
	rm -f $@.tmp

distr: ./source/*.*
	rm -rf build/
	cp -R source build
	find ./build -type f -name *.po -delete
	find ./build -type f -name *.po~ -delete
	find ./build -type f -name "*.pot" -delete
	find ./build -type f -name "*.pot~" -delete
	cd build && zip -qr chronos@time-tracker.com.shell-extension.zip . && mv chronos@time-tracker.com.shell-extension.zip ../
	rm -rf build

build: update_po distr

install: build
	gnome-extensions install ./chronos@time-tracker.com.shell-extension.zip --force

launch:
	dbus-run-session -- env GTK_A11Y=none gnome-shell --devkit # --wayland

run: build install launch
