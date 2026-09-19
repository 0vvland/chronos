DOMAIN   := chronos
UUID     := chronos@time-tracker.com
ZIPFILE  := $(UUID).shell-extension.zip
SOURCES  := source/*.js source/components/*.js
PO_FILES := $(shell find source/locale -name '*.po')

SHELL    := /bin/bash

.DEFAULT_GOAL := all

.PHONY: all build clean install launch reload run update_po distr lint

SHEXLI_VENV := .venv-shexli
SHEXLI      := $(SHEXLI_VENV)/bin/shexli

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
	# zip -r updates an existing archive rather than replacing it, so a file
	# dropped from the build would otherwise live on in the shipped zip
	$(RM) -f $(ZIPFILE)
	$(RM) -r build/
	cp -R source build
	# gschemas.compiled is a local build artifact: gnome-extensions install
	# compiles the schema itself, and shipping it is an EGO review warning
	find build -type f \( -name '*.po' -o -name '*.po~' -o -name '*.pot' -o -name '*.pot~' -o -name 'gschemas.compiled' \) -delete
	cd build && zip -qr ../$(ZIPFILE) .
	$(RM) -r build/

# ── quality gate ───────────────────────────────────────────────

$(SHEXLI):
	python3 -m venv $(SHEXLI_VENV)
	# tree-sitter 0.26 segfaults against tree-sitter-javascript's 0.25 ABI,
	# which is what shexli's own floor resolves to
	$(SHEXLI_VENV)/bin/pip install -q shexli 'tree-sitter<0.26'

# Gates the packaged zip, not source/: that is what EGO reviews, and the
# build-artifact rules only make sense against what actually ships.
# shexli needs an absolute path — a relative one crashes it.
lint: $(SHEXLI)
	@test -f $(ZIPFILE) || $(MAKE) distr
	$(SHEXLI) $(CURDIR)/$(ZIPFILE) --format json | python3 tools/shexli-gate.py

build: update_po distr lint

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
