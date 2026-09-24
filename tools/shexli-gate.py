#!/usr/bin/env python3
"""Turn a shexli report into a pass/fail gate.

shexli itself always exits 0 — it reports, it does not judge. This reads its
JSON on stdin and fails the build on anything that is not a known, explained
false positive.

Waivers are keyed by rule and file, not by line, so they survive edits above
the finding; a *new* violation of a waived rule in another file still fails.
"""

import json
import sys

# rule id -> { package-relative file: why this finding is not a real defect }
WAIVED = {}


def package_file(path):
    """Strip shexli's '<archive>:' prefix and any leading directories."""
    return path.rsplit(':', 1)[-1]


def waiver_for(finding):
    files = WAIVED.get(finding['rule_id'], {})
    for evidence in finding.get('evidence', []):
        if package_file(evidence.get('path', '')) not in files:
            return None
    return next(iter(files.values()), None) if files else None


def main():
    report = json.load(sys.stdin)
    blocking = []

    for finding in report.get('findings', []):
        waiver = waiver_for(finding)
        where = ', '.join(
            f"{package_file(e.get('path', '?'))}:{e.get('line', '?')}"
            for e in finding.get('evidence', [])
        )
        if waiver:
            print(f"  waived  {finding['rule_id']}  {where} — {waiver}")
        else:
            blocking.append(finding)
            print(f"  {finding['severity'].upper():7} {finding['rule_id']}  {where}")
            print(f"           {finding['message']}")
            if finding.get('source_url'):
                print(f"           {finding['source_url']}")

    if blocking:
        print(f"\nshexli gate: FAILED ({len(blocking)} blocking findings)")
        return 1

    print('shexli gate: passed')
    return 0


if __name__ == '__main__':
    sys.exit(main())
