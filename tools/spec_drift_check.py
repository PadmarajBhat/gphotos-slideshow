"""Spec Drift Check.

Fails when source under ``src/`` changed without a matching update under
``specs/``. The previous version of this script ran ``git status``, discarded
the result and always exited 0, so it never caught anything.

Usage:
    python tools/spec_drift_check.py                 # working tree vs HEAD
    python tools/spec_drift_check.py --base origin/main
    python tools/spec_drift_check.py --allow-drift   # explicit override
"""
import argparse
import subprocess
import sys

SOURCE_PREFIXES = ('src/', 'vite.config.ts', 'package.json', 'tailwind.config.js')
SPEC_PREFIXES = ('specs/', 'requirement.md', 'README.md')

# Test-only changes do not need a spec update.
EXEMPT_PREFIXES = ('src/test/',)


def run_git(args):
    result = subprocess.run(
        ['git', *args],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or 'git command failed')
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def changed_files(base):
    if base:
        return run_git(['diff', '--name-only', f'{base}...HEAD'])

    tracked = run_git(['diff', '--name-only', 'HEAD'])
    untracked = run_git(['ls-files', '--others', '--exclude-standard'])
    return sorted(set(tracked) | set(untracked))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', help='Compare against this ref instead of the working tree.')
    parser.add_argument(
        '--allow-drift',
        action='store_true',
        help='Skip the check. Use only when a change genuinely has no spec impact.',
    )
    args = parser.parse_args()

    if args.allow_drift:
        print('Spec drift check skipped (--allow-drift).')
        return 0

    try:
        files = changed_files(args.base)
    except (RuntimeError, OSError) as exc:
        print(f'Spec drift check could not inspect the repository: {exc}', file=sys.stderr)
        return 2

    source_changes = [
        f for f in files
        if f.startswith(SOURCE_PREFIXES) and not f.startswith(EXEMPT_PREFIXES)
    ]
    spec_changes = [f for f in files if f.startswith(SPEC_PREFIXES)]

    if not source_changes:
        print('No source changes detected; nothing to verify.')
        return 0

    if spec_changes:
        print(f'OK: {len(source_changes)} source file(s) changed alongside {len(spec_changes)} spec file(s).')
        return 0

    print('Spec drift detected.', file=sys.stderr)
    print('', file=sys.stderr)
    print('These source files changed with no corresponding update under specs/:', file=sys.stderr)
    for path in source_changes:
        print(f'  - {path}', file=sys.stderr)
    print('', file=sys.stderr)
    print('Update specs/ (or requirement.md), or re-run with --allow-drift.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
