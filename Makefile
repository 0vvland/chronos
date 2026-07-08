DOMAIN   := chronos
UUID     := chronos@time-tracker.com
ZIPFILE  := $(UUID).shell-extension.zip
SOURCES  := source/*.js source/components/*.js
PO_FILES := $(shell find source/locale -name '*.po')

SHELL    := /bin/bash

.DEFAULT_GOAL := all

.PHONY: all build clean install launch reload run update_po compile_schema distr

all: build

# ── i18n ───────────────────────────────────────────────────────

source/chronos.pot: $(SOURCES)
	xgettext --from-code=UTF-8 --output=$@.tmp $^
	if [ -f $@ ]; then \
		msgmerge -U $@ $@.tmp && rm -f $@.tmp; \
	else \
		mv $@.tmp $@; \
	fi

update_po: source/chronos.pot
	for po in $(PO_FILES); do \
		xgettext --from-code=UTF-8 --output=$$po.tmp $(SOURCES); \
		msgmerge -U $$po $$po.tmp; \
		rm -f $$po.tmp; \
		msgfmt -c $$po -o $$(dirname $$po)/$(DOMAIN).mo; \
	done

# ── package ────────────────────────────────────────────────────

distr:
	$(RM) -r build/
	cp -R source build
	find build -type f \( -name '*.po' -o -name '*.po~' -o -name '*.pot' -o -name '*.pot~' \) -delete
	cd build && zip -qr ../$(ZIPFILE) .
	$(RM) -r build/

build: update_po distr

# ── install / reload / launch ─────────────────────────────────

install: build
	gnome-extensions install ./$(ZIPFILE) --force

# Reload extension in the running Shell (disable + enable)
reload:
	gdbus call --session \
		--dest org.gnome.Shell \
		--object-path /org/gnome/Shell \
		--method org.gnome.Shell.Extensions.DisableExtension \
		'$(UUID)'
	gdbus call --session \
		--dest org.gnome.Shell \
		--object-path /org/gnome/Shell \
		--method org.gnome.Shell.Extensions.EnableExtension \
		'$(UUID)'

# Headless test session (for CI, no window)
launch:
	dbus-run-session -- env GTK_A11Y=none gnome-shell --devkit # --wayland

run: build install reload

# ── clean ──────────────────────────────────────────────────────

clean:
	$(RM) -f $(ZIPFILE) source/chronos.pot
	$(RM) -f source/locale/*/LC_MESSAGES/$(DOMAIN).mo
	$(RM) -rf build/
