#!/usr/bin/env bash
# Regression tests for scripts/ci/check-npm-version.sh. Hermetic: `curl` is
# replaced by a stub on PATH (no network), so each case decides the registry's
# answer. The exit code now gates the weekly npm publish, so the contract is:
# 200 skips the publish (exit 0, exists=true), 404 lets it run (exit 0,
# exists=false), and anything else — 429, 5xx, a network failure (000) — exits
# non-zero, which skips the publish instead of pushing blindly. A slip back to
# fail-open would turn the last three cases green again.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${ROOT_DIR}/scripts/ci/check-npm-version.sh"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TEMP_DIR}"' EXIT

fail() {
    echo "FAIL $1: $2" >&2
    exit 1
}

# Fake curl. `code` prints $CURL_CODE the way `-w '%{http_code}'` would; `fail`
# exits 6 with the resolver's message, which exercises the `|| HTTP=000` path
# and must stay visible now that the script no longer redirects stderr.
mkdir -p "${TEMP_DIR}/bin"
cat > "${TEMP_DIR}/bin/curl" <<'STUB'
#!/usr/bin/env bash
if [ "${CURL_MODE:-code}" = "fail" ]; then
    echo 'curl: (6) Could not resolve host: registry.npmjs.org' >&2
    exit 6
fi
printf '%s' "${CURL_CODE:?CURL_CODE must be set}"
STUB
chmod +x "${TEMP_DIR}/bin/curl"

# The script reads only package/package.json from the tarball (entries live
# under a package/ prefix), so one minimal fixture covers every case.
VERSION='5.0.20261124001700'
mkdir -p "${TEMP_DIR}/package"
printf '{"name":"@adguard/dnr-rulesets","version":"%s"}\n' "${VERSION}" > "${TEMP_DIR}/package/package.json"
TGZ="${TEMP_DIR}/dnr-rulesets.tgz"
(cd "${TEMP_DIR}" && tar -czf "${TGZ}" package)
GITHUB_OUTPUT_FILE="${TEMP_DIR}/github_output"

# run_check MODE CODE -> sets OUTPUT and STATUS.
run_check() {
    : > "${GITHUB_OUTPUT_FILE}"
    set +e
    OUTPUT="$(env PATH="${TEMP_DIR}/bin:${PATH}" CURL_MODE="$1" CURL_CODE="$2" \
        GITHUB_OUTPUT="${GITHUB_OUTPUT_FILE}" bash "${SCRIPT}" "${TGZ}" 2>&1)"
    STATUS=$?
    set -e
}

# expect_success NAME CODE EXISTS
expect_success() {
    local name="$1" code="$2" exists="$3"
    run_check code "${code}"
    [ "${STATUS}" -eq 0 ] || fail "${name}" "expected exit 0, got ${STATUS}: ${OUTPUT}"
    grep -qx "version=${VERSION}" "${GITHUB_OUTPUT_FILE}" || fail "${name}" "missing version output: $(cat "${GITHUB_OUTPUT_FILE}")"
    grep -qx "exists=${exists}" "${GITHUB_OUTPUT_FILE}" || fail "${name}" "expected exists=${exists}: $(cat "${GITHUB_OUTPUT_FILE}")"
    echo "ok ${name}"
}

# expect_failure NAME MODE CODE
expect_failure() {
    local name="$1" mode="$2" code="$3"
    run_check "${mode}" "${code}"
    [ "${STATUS}" -ne 0 ] || fail "${name}" "expected a non-zero exit"
    grep -qF "::error::npm version check returned ${code}" <<<"${OUTPUT}" || fail "${name}" "missing error annotation for ${code}: ${OUTPUT}"
    [ ! -s "${GITHUB_OUTPUT_FILE}" ] || fail "${name}" "must not write outputs on failure: $(cat "${GITHUB_OUTPUT_FILE}")"
    echo "ok ${name}"
}

# Already published: skip the publish, stay green.
expect_success 'already published (200)' 200 true

# Not published: the only answer that lets the publish run.
expect_success 'not published (404)' 404 false

# Everything else fails closed — these are the answers that used to proceed.
expect_failure 'throttled (429)' code 429
expect_failure 'server error (503)' code 503
expect_failure 'unreachable (000)' fail 000

# The network cause must reach the log instead of being swallowed.
run_check fail 000
grep -q 'Could not resolve host' <<<"${OUTPUT}" || fail 'curl diagnostics' "the curl error is missing: ${OUTPUT}"
echo 'ok curl diagnostics'

# Without GITHUB_OUTPUT the script still reports through its exit code.
set +e
env -u GITHUB_OUTPUT PATH="${TEMP_DIR}/bin:${PATH}" CURL_MODE=code CURL_CODE=404 \
    bash "${SCRIPT}" "${TGZ}" >/dev/null 2>&1
output_code=$?
set -e
[ "${output_code}" -eq 0 ] || fail 'no GITHUB_OUTPUT' "expected exit 0, got ${output_code}"
echo 'ok no GITHUB_OUTPUT'

echo 'check-npm-version tests passed'
