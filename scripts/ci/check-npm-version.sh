#!/bin/bash
# Usage: check-npm-version.sh <tarball> [package-name]
#
# Reports whether an exact package version is already published on npm, so a
# publish pipeline can skip idempotently instead of failing with a 409. Reads
# the version from the packed package.json inside <tarball> (entries live
# under a package/ prefix), then asks the registry's per-version endpoint — a
# tiny filtered response, far cheaper than fetching the whole packument (for
# @adguard/dnr-rulesets that is ~79 MB across ~22 000 versions).
#
# When run inside a GitHub Actions step (GITHUB_OUTPUT set), it writes the
# `version` and `exists` outputs for that step.
#
# The registry's answer decides whether the publish runs, and it fails closed:
#   200 -> the version is already published (exists=true, publish is skipped)
#   404 -> not published (exists=false, proceed)
#   anything else (429/5xx/timeout/unreachable) -> the check exits non-zero, so
#   the publish step is skipped instead of pushing blindly. npm asked us to keep
#   this package quiet (AG-58867, AG-59859): a blind attempt during throttling
#   spends the budget and re-uploads a ~70 MB tarball, and the pipeline no
#   longer retries on its own.

set -euo pipefail

TGZ="${1:?usage: check-npm-version.sh <tarball> [package-name]}"
PKG="${2:-@adguard/dnr-rulesets}"

# Same extraction as verify-tarball.sh; node reads stdin to EOF, so tar never
# hits a closed pipe and pipefail can't trip over SIGPIPE.
VERSION=$(tar -xOf "$TGZ" package/package.json | node -e "let json = ''; process.stdin.on('data', (data) => json += data).on('end', () => process.stdout.write(JSON.parse(json).version))")

# `|| HTTP=000` maps curl failures (timeout/DNS/refused) onto a non-200 code.
# No `2>/dev/null`: `-S` then prints the cause, so a `000` in the log says why.
HTTP=$(curl -sS --max-time 30 -o /dev/null -w '%{http_code}' "https://registry.npmjs.org/${PKG}/${VERSION}") || HTTP=000

EXISTS=false
case "$HTTP" in
    200)
        echo "::warning::${PKG}@${VERSION} already exists on npm; skipping the publish"
        EXISTS=true
        ;;
    404)
        echo "${PKG}@${VERSION} is not on npm"
        ;;
    *)
        echo "::error::npm version check returned ${HTTP} for ${PKG}@${VERSION}; refusing to publish without a 404 from the registry"
        exit 1
        ;;
esac

if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "version=${VERSION}" >> "$GITHUB_OUTPUT"
    echo "exists=${EXISTS}" >> "$GITHUB_OUTPUT"
fi
