# Fedora 43 (Gnome 49)

```shell
dnf install mutter-devel
```

# Quality gate (shexli)

[shexli](https://pypi.org/project/shexli/) is a static analyzer for the
[EGO review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html).
`make build` ends in `make lint`, which runs it over the packaged zip; see
[AGENTS.md](AGENTS.md) for what the gate fails on and how findings are waived.

**Nothing to install by hand.** The `lint` target bootstraps its own
environment in `.venv-shexli/` (gitignored) the first time it runs, and reuses
it afterwards. All it needs is `python3` ≥ 3.12 with the `venv` module —
already present on Fedora, and `apt install python3-venv` on Debian/Ubuntu.

To rebuild that environment after a shexli release, drop it and let the next
build recreate it:

```shell
rm -rf .venv-shexli
make lint
```

### Installing it yourself

Only needed to run shexli outside the build. Two things bite:

- **Pin `tree-sitter<0.26`.** shexli's own floor resolves `tree-sitter` to
  0.26, which segfaults against the 0.25 ABI `tree-sitter-javascript` is built
  with — every run dies, whatever the input.
- **Pass an absolute path.** A relative one crashes shexli in its path mapper.

```shell
python3 -m venv ~/.venv/shexli
~/.venv/shexli/bin/pip install shexli 'tree-sitter<0.26'

~/.venv/shexli/bin/shexli "$PWD/chronos@time-tracker.com.shell-extension.zip"
~/.venv/shexli/bin/shexli "$PWD/source" --format json        # machine-readable
```

With `pipx`, the same two packages: `pipx install shexli` followed by
`pipx inject shexli 'tree-sitter<0.26'`.

Point it at the **zip**, not `source/`: the packaging rules (`EGO-P-006`) only
mean anything after `make distr` has stripped the `.po`/`.pot` files and
`gschemas.compiled`, so a run against `source/` reports three findings that
never ship.

shexli always exits 0 — it reports, it does not judge. The pass/fail verdict is
`tools/shexli-gate.py`, which reads the JSON report on stdin:

```shell
shexli "$PWD/chronos@time-tracker.com.shell-extension.zip" --format json \
  | python3 tools/shexli-gate.py
```
