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
# The registry's answer is interpreted conservatively so this check can never
# block a legitimate publish — the publish itself is the source of truth:
#   200 -> the version is already published (exists=true, publish is skipped)
#   404 -> not published (exists=false, proceed)
#   anything else (429/5xx/timeout/unreachable) -> unknown, assume absent and
#   proceed; a wrong "absent" only risks one throttled publish attempt, which
#   the workflow's retry pass is the backstop for.

set -euo pipefail

TGZ="${1:?usage: check-npm-version.sh <tarball> [package-name]}"
PKG="${2:-@adguard/dnr-rulesets}"

# Same extraction as verify-tarball.sh; node reads stdin to EOF, so tar never
# hits a closed pipe and pipefail can't trip over SIGPIPE.
VERSION=$(tar -xOf "$TGZ" package/package.json | node -e "let json = ''; process.stdin.on('data', (data) => json += data).on('end', () => process.stdout.write(JSON.parse(json).version))")

# `|| HTTP=000` maps curl failures (timeout/DNS/refused) onto a non-200 code.
HTTP=$(curl -sS --max-time 30 -o /dev/null -w '%{http_code}' "https://registry.npmjs.org/${PKG}/${VERSION}" 2>/dev/null) || HTTP=000

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
        echo "::warning::npm version check returned ${HTTP} for ${PKG}@${VERSION}; assuming not published and proceeding"
        ;;
esac

if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "version=${VERSION}" >> "$GITHUB_OUTPUT"
    echo "exists=${EXISTS}" >> "$GITHUB_OUTPUT"
fi
