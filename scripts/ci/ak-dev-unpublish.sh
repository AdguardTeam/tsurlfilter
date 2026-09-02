#!/usr/bin/env bash
# Unpublish every version of a package on the Artifact Keeper npm registry whose
# version ends with a given suffix (e.g. '-dev.pr42'). Shared by:
#   - devex-bridge.yml  (overwrite previous -dev.pr<N> builds before publishing)
#   - devex-bridge-cleanup.yml  (delete -dev.pr<N> builds when the PR closes)
# so the registry error taxonomy (404 vs 405 vs other) lives in ONE place and
# the two workflows cannot drift again. Requires `npm` and `node`.
#
# Usage: ak-dev-unpublish.sh <package> <registry> <suffix> [--tolerate-405] [--keep <version>]
#   --tolerate-405   When AK replies 405 (unpublish not allowed), treat it as a
#                    warning and continue instead of failing. devex-bridge.yml
#                    passes this (overwrite is best-effort); the cleanup twin
#                    does NOT, because a broken cleanup must be noticed.
#   --keep <ver>     Do not delete this exact version (e.g. the version we just
#                    published). Repeatable.
#
# Exit codes:
#   0  success (nothing to do counts as success)
#   1  a query or unpublish failed and was not classified as benign
#
# A query is only treated as "package absent" when the error unambiguously
# names the package AND is a 404/not-found. A wildcard 404, a wrong registry
# base, or a proxy error page must NOT look like "nothing to do" — the jobs
# that call this are single-fire (cleanup especially), so a green run that
# deletes nothing must not be possible.
set -euo pipefail

PACKAGE="$1"
REGISTRY="$2"
SUFFIX="$3"
shift 3

TOLERATE_405=0
KEEP=()
while (($#)); do
    case "$1" in
        --tolerate-405)
            TOLERATE_405=1
            ;;
        --keep)
            KEEP+=("$2")
            shift
            ;;
        *)
            echo "::error::ak-dev-unpublish.sh: unknown argument '$1'" >&2
            exit 2
            ;;
    esac
    shift
done

# Query current versions. npm's failure output goes to stderr; merge it so we
# can classify it. 2>/dev/null on the query would hide an auth/transport error.
if ! raw="$(npm view "${PACKAGE}" versions --json --registry="${REGISTRY}" --silent 2>&1)"; then
    if grep -qiE 'E404|404 not found|not found' <<<"${raw}" && grep -qi "${PACKAGE}" <<<"${raw}"; then
        echo "${PACKAGE}: not present on AK — nothing to unpublish"
        exit 0
    fi
    echo "::error::Could not query ${PACKAGE} on AK:"
    printf '%s\n' "${raw}"
    exit 1
fi

# endsWith filter: '-dev.pr1' must not match '-dev.pr12'. Keep the --keep
# versions out of the delete set.
keep_list="$(printf '%s\n' "${KEEP[@]:-}")"
to_delete="$(node -e "
    const raw = JSON.parse(process.argv[1]);
    const keep = new Set(process.argv[3].trim().split('\n').filter(Boolean));
    const list = Array.isArray(raw) ? raw : [raw];
    process.stdout.write(list.filter((v) => v.endsWith(process.argv[2]) && !keep.has(v)).join('\n'));
" "${raw}" "${SUFFIX}" "${keep_list}")" || {
    echo "::error::npm view for ${PACKAGE} returned non-JSON (registry misbehaving?):" >&2
    printf '%s\n' "${raw}" >&2
    exit 1
}
if [[ -z "${to_delete}" ]]; then
    echo "${PACKAGE}: no previous -dev builds for this suffix on AK"
    exit 0
fi

failures=0
while IFS= read -r version; do
    [[ -n "${version}" ]] || continue
    echo "Unpublishing ${PACKAGE}@${version}"
    if out="$(npm unpublish "${PACKAGE}@${version}" --force --registry="${REGISTRY}" 2>&1)"; then
        continue
    fi
    if grep -qiE 'E404|404 not found|not found|EUNPUBLISH' <<<"${out}" && grep -qi "${PACKAGE}" <<<"${out}"; then
        echo "${PACKAGE}@${version}: already absent — nothing to unpublish"
        continue
    fi
    if grep -qE '\bE405\b|405 Method Not Allowed|405 not allowed' <<<"${out}"; then
        if ((TOLERATE_405)); then
            echo "${PACKAGE}@${version}: AK does not allow unpublish (405; tolerated)"
            continue
        fi
        echo "::error::${PACKAGE}@${version}: AK refuses to unpublish (405):"
        printf '%s\n' "${out}"
        failures=$((failures + 1))
        continue
    fi
    echo "::error::${PACKAGE}@${version}: npm unpublish failed:"
    printf '%s\n' "${out}"
    failures=$((failures + 1))
done <<< "${to_delete}"

if ((failures > 0)); then
    echo "::error::${failures} previous version(s) could not be unpublished — AK may still hold stale builds"
    exit 1
fi
echo "${PACKAGE}: done"
