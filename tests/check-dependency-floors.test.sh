#!/usr/bin/env bash
# Regression tests for scripts/ci/check-dependency-floors.mjs. Hermetic: the
# dependency and the consumer are tiny fake tarballs built here and the
# dependency floor is installed from a local tarball through `--source`, so
# nothing is fetched from a registry. The script is invoked with `node`, the
# same way the release workflow calls it.
#
# Covers the case the check exists for (a consumer that imports a name its
# dependency floor does not export fails; the same consumer passes once the
# floor has it), the "nothing to check" and usage paths, and that an entry
# point that cannot load for an unrelated reason does not block a release.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${ROOT_DIR}/scripts/ci/check-dependency-floors.mjs"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TEMP_DIR}"' EXIT

# make_tarball FILE PACKAGE VERSION MANIFEST_EXTRA [PATH CONTENT]...
#   Writes ${TEMP_DIR}/FILE.tgz with the layout `pnpm pack` produces
#   (everything under a package/ prefix) for the package @adguard/PACKAGE.
#   MANIFEST_EXTRA is JSON merged into the manifest.
make_tarball() {
    local file="$1" package="$2" version="$3" extra="$4"
    shift 4
    local dir="${TEMP_DIR}/build-${file}"
    mkdir -p "${dir}/package"
    node -e '
        const [name, version, extra] = process.argv.slice(1);
        const manifest = { name: `@adguard/${name}`, version, type: "module", ...JSON.parse(extra) };
        process.stdout.write(JSON.stringify(manifest, null, 2));
    ' "${package}" "${version}" "${extra}" > "${dir}/package/package.json"
    while [[ $# -gt 0 ]]; do
        printf '%s\n' "$2" > "${dir}/package/$1"
        shift 2
    done
    tar -czf "${TEMP_DIR}/${file}.tgz" -C "${dir}" package
}

# run_case NAME EXPECTED_EXIT EXPECTED_TEXT ARGS...
#   EXPECTED_TEXT must appear in the combined output ('' = no requirement).
run_case() {
    local name="$1" expected_exit="$2" expected_text="$3"
    shift 3
    set +e
    OUTPUT="$(node "${SCRIPT}" "$@" 2>&1)"
    local code=$?
    set -e
    if [[ "${code}" -ne "${expected_exit}" ]]; then
        echo "FAIL ${name}: expected exit ${expected_exit}, got ${code}" >&2
        printf '%s\n' "${OUTPUT}" >&2
        exit 1
    fi
    if [[ -n "${expected_text}" ]] && ! grep -qF -- "${expected_text}" <<<"${OUTPUT}"; then
        echo "FAIL ${name}: expected the output to contain '${expected_text}'" >&2
        printf '%s\n' "${OUTPUT}" >&2
        exit 1
    fi
    echo "PASS ${name}"
}

# The dependency's released floor and a later build of it that exports more.
DEP_MANIFEST='{"main":"index.js","exports":{".":"./index.js"}}'
make_tarball dep-old dep 1.0.0 "${DEP_MANIFEST}" index.js 'export const released = 1;'
make_tarball dep-new dep 1.0.0 "${DEP_MANIFEST}" index.js 'export const released = 1; export const added = 2;'
OLD_DEP="${TEMP_DIR}/dep-old.tgz"
NEW_DEP="${TEMP_DIR}/dep-new.tgz"

# A consumer that imports `added`, which the old floor does not have.
make_tarball consumer consumer 2.0.0 \
    '{"dependencies":{"@adguard/dep":"^1.0.0"},"exports":{".":{"import":"./index.js"},"./sub":{"import":"./sub.js"},"./umd":"./bundle.umd.js"}}' \
    index.js "import { added } from '@adguard/dep'; export const value = added;" \
    sub.js "export const sub = 1;" \
    bundle.umd.js "module.exports = {};"
CONSUMER="${TEMP_DIR}/consumer.tgz"

run_case 'floor lacks an imported export' 1 "does not provide an export named 'added'" \
    "${CONSUMER}" --source "@adguard/dep=${OLD_DEP}"
run_case 'failure names the floor and the fix' 1 'Release the dependency first' \
    "${CONSUMER}" --source "@adguard/dep=${OLD_DEP}"
run_case 'floor has the imported export' 0 'loads against its dependency floors' \
    "${CONSUMER}" --source "@adguard/dep=${NEW_DEP}"
# The UMD bundle cannot be imported as an ES module and must not be loaded
if grep -qF 'bundle.umd.js' <<<"${OUTPUT}"; then
    echo 'FAIL UMD entry point was loaded' >&2
    exit 1
fi
echo 'PASS UMD entry point is skipped'

# A package with no @adguard/* dependency has nothing to check
make_tarball standalone standalone 1.0.0 '{"main":"index.js"}' index.js 'export const x = 1;'
run_case 'no dependencies to check' 0 'nothing to check' "${TEMP_DIR}/standalone.tgz"

# An entry point that cannot load in Node for another reason is a warning only
make_tarball browser-only browser-only 1.0.0 \
    '{"dependencies":{"@adguard/dep":"^1.0.0"},"main":"index.js"}' \
    index.js "export const tab = chrome.tabs;"
run_case 'unrelated load failure only warns' 0 '::warning::' \
    "${TEMP_DIR}/browser-only.tgz" --source "@adguard/dep=${NEW_DEP}"

# The release step only accepts plain floors: a range it cannot read is an error
make_tarball odd-range odd-range 1.0.0 '{"dependencies":{"@adguard/dep":">=1.0.0 <2"},"main":"index.js"}' index.js 'export {};'
run_case 'unreadable range is an error' 1 'Unexpected dependency range' \
    "${TEMP_DIR}/odd-range.tgz" --source "@adguard/dep=${NEW_DEP}"

run_case 'missing tarball' 1 'Tarball not found' "${TEMP_DIR}/absent.tgz"
run_case 'no arguments' 2 'usage:'
run_case 'malformed --source' 2 'usage:' "${CONSUMER}" --source nonsense

echo 'All check-dependency-floors tests passed'
