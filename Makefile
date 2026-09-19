DOMAIN   := chronos
UUID     := chronos@time-tracker.com
ZIPFILE  := $(UUID).shell-extension.zip
SOURCES  := source/*.js source/components/*.js
PO_FILES := $(shell find source/locale -name '*.po')

SHELL    := /bin/bash

.DEFAULT_GOAL := all

.PHONY: all build clean install launch reload run update_po distr

all: build

# ── i18n ───────────────────────────────────────────────────────

source/chronos.pot: $(SOURCES)
	xgettext --from-code=UTF-8 --output=$@.tmp $^
	if [ -f $@ ]; then \
		msgmerge -U $@ $@.tmp && rm -f $@.tmp; \
	else \
		mv $@.tmp $@; \
	fi
	# Avoid time-only diffs: strip POT-Creation-Date
	sed -i '/^"POT-Creation-Date:/d' $@

update_po: source/chronos.pot
	for po in $(PO_FILES); do \
		xgettext --from-code=UTF-8 --output=$$po.tmp $(SOURCES); \
		msgmerge -U $$po $$po.tmp; \
		rm -f $$po.tmp; \
		sed -i '/^"POT-Creation-Date:/d' $$po; \
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

# Reload extension in the running Shell (only style and preferences)
reload:
	-gnome-extensions disable '$(UUID)'
	gnome-extensions enable '$(UUID)'

install: build
	gnome-extensions install ./$(ZIPFILE) --force

# Nested test session (for CI, no window)
launch:
	dbus-run-session env MUTTER_DEBUG_DUMMY_MODE_SPECS=1280x720 NO_GAIL=1 GNOME_DISABLE_ACCESSIBILITY=1 gnome-shell --devkit --wayland

run: build install launch

# ── clean ──────────────────────────────────────────────────────

clean:
	$(RM) -f $(ZIPFILE) source/chronos.pot
	$(RM) -f source/locale/*/LC_MESSAGES/$(DOMAIN).mo
	$(RM) -rf build/
