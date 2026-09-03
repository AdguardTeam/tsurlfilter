#!/bin/bash
# Usage: verify-tarball.sh <tarball> <expected-version>
#
# Release-time sanity checks for a packed npm tarball produced by
# `pnpm pack` (entries live under a package/ prefix):
#   1. package/package.json must be present;
#   2. its `version` field must equal <expected-version>;
#   3. the tarball must hold more than five entries.
#
# This logic used to live inline in
# .github/workflows/_publish-release-monorepo.yml as
# `tar -tzf "$TGZ" | grep -q '^package/package.json$'`. That pipeline is racy
# under `set -o pipefail`: grep -q exits as soon as it matches, GNU tar then
# dies of SIGPIPE ("tar: stdout: write error"), and pipefail propagates the
# producer's failure — the step falsely reported a missing package.json on a
# valid tarball. Extraction-based checks have no early-exiting consumer, so no
# pipe can break.

set -euo pipefail

TGZ="$1"
EXPECTED_VERSION="$2"

# The listing doubles as an audit trail in the release log.
tar -tzf "$TGZ"

# Presence check: tar -xOf exits non-zero when the member is absent.
if ! tar -xOf "$TGZ" package/package.json >/dev/null; then
    echo "::error::package.json missing from $TGZ" >&2
    exit 1
fi

# Version check. node consumes stdin to EOF, so tar completes without SIGPIPE.
PACKED_VERSION=$(tar -xOf "$TGZ" package/package.json | node -e "let json = ''; process.stdin.on('data', (data) => json += data).on('end', () => process.stdout.write(JSON.parse(json).version))")
if [ "$PACKED_VERSION" != "$EXPECTED_VERSION" ]; then
    echo "::error::$TGZ has version $PACKED_VERSION, expected $EXPECTED_VERSION" >&2
    exit 1
fi

# Entry-count check. `wc -l` reads the listing to EOF, so tar never sees a
# closed pipe here either.
FILE_COUNT=$(tar -tzf "$TGZ" | wc -l | tr -d ' ')
if [ "$FILE_COUNT" -le 5 ]; then
    echo "::error::$TGZ contains only $FILE_COUNT entries — likely a broken package" >&2
    exit 1
fi

echo "Verified $TGZ: version $PACKED_VERSION, $FILE_COUNT entries"
