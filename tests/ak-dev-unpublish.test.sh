#!/usr/bin/env bash
# Regression tests for scripts/ci/ak-dev-unpublish.sh. Hermetic: npm is stubbed
# via PATH shadowing; every case runs against a throwaway fixture dir.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${ROOT_DIR}/scripts/ci/ak-dev-unpublish.sh"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TEMP_DIR}"' EXIT

BIN_DIR="${TEMP_DIR}/bin"
mkdir -p "${BIN_DIR}"

# Fake npm records invocations; behavior per test via REPLY_FILE (a list of
# "status:<key> <output>" applied in order).
REPLY_FILE="${TEMP_DIR}/replies"
LOG_FILE="${TEMP_DIR}/npm.log"
export REPLY_FILE LOG_FILE
export PATH="${BIN_DIR}:${PATH}"

write_replies() {
    : > "${REPLY_FILE}"
    for line in "$@"; do
        printf '%s\n' "${line}" >> "${REPLY_FILE}"
    done
}

cat > "${BIN_DIR}/npm" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "${LOG_FILE}"
line="$(head -n1 "${REPLY_FILE}")"
sed -i '' '1d' "${REPLY_FILE}" 2>/dev/null || sed -i '1d' "${REPLY_FILE}"
status="${line%%:*}"
payload="${line#*:}"
case "${status}" in
    ok)  printf '%s' "${payload}"; exit 0 ;;
    err) printf '%s' "${payload}" >&2; exit 1 ;;
esac
SH
chmod +x "${BIN_DIR}/npm"

# run_case NAME EXPECTED_EXIT [REPLY_LINE]...
#   Appends replies, runs the script once, asserts the exit code, and returns
#   the captured output via $OUTPUT.
run_case() {
    local name="$1"
    local expected_exit="$2"
    shift 2
    write_replies "$@"
    : > "${LOG_FILE}"
    set +e
    OUTPUT="$(bash "${SCRIPT}" "@adguard/testpkg" "https://ak.invalid/npm/npm-internal" "-dev.pr42" 2>&1)"
    local code=$?
    set -e
    if [[ "${code}" -ne "${expected_exit}" ]]; then
        echo "FAIL ${name}: expected exit ${expected_exit}, got ${code}" >&2
        printf '%s\n' "${OUTPUT}" >&2
        exit 1
    fi
}

# 1. Package absent (E404 naming the package) -> success, nothing to do.
run_case absent "0" \
    "err:E404 Not Found - GET https://ak.invalid/@adguard%2ftestpkg - not found @adguard/testpkg"
grep -q "testpkg: not present on AK" <<<"${OUTPUT}" || { echo "FAIL absent: unexpected output:" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }

# 2. Registry path 404 (generic, does not name the package) -> MUST fail loudly.
run_case registry-404 "1" \
    "err:404 Not Found"
grep -q "Could not query" <<<"${OUTPUT}" || { echo "FAIL registry-404: expected loud failure:" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }

# 3. No matching suffix -> success, nothing to unpublish (endsWith semantics).
run_case no-match "0" \
    "ok:[\"1.0.1\",\"1.0.2-dev.pr4\"]"
grep -q "no previous -dev builds" <<<"${OUTPUT}" || { echo "FAIL no-match:" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }

# 4. One dev version to delete, unpublish succeeds.
run_case delete-ok "0" \
    "ok:[\"1.0.1\",\"1.0.2-dev.pr42\"]" \
    "ok:deleted"
grep -q "Unpublishing @adguard/testpkg@1.0.2-dev.pr42" <<<"${OUTPUT}" || { echo "FAIL delete-ok:" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }

# 5. --keep version is NOT deleted even though it matches the suffix.
write_replies \
    "ok:[\"1.0.1\",\"1.0.2-dev.pr42\"]" \
    "ok:deleted"
: > "${LOG_FILE}"
set +e
OUTPUT="$(bash "${SCRIPT}" "@adguard/testpkg" "https://ak.invalid/npm/npm-internal" "-dev.pr42" --keep "1.0.2-dev.pr42" 2>&1)"
code=$?
set -e
[[ "${code}" -eq 0 ]] || { echo "FAIL keep: exit ${code}" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }
grep -q "no previous -dev builds" <<<"${OUTPUT}" || { echo "FAIL keep: expected nothing to delete:" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }

# 6. 405 tolerated when --tolerate-405 is passed (bridge job policy).
write_replies \
    "ok:[\"1.0.2-dev.pr42\"]" \
    "err:405 Method Not Allowed"
: > "${LOG_FILE}"
set +e
OUTPUT="$(bash "${SCRIPT}" "@adguard/testpkg" "https://ak.invalid/npm/npm-internal" "-dev.pr42" --tolerate-405 2>&1)"
code=$?
set -e
[[ "${code}" -eq 0 ]] || { echo "FAIL tolerate-405: exit ${code}" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }
grep -q "405" <<<"${OUTPUT}" || { echo "FAIL tolerate-405:" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }

# 7. 405 fatal when --tolerate-405 is NOT passed (cleanup twin policy).
run_case fail-405 "1" \
    "ok:[\"1.0.2-dev.pr42\"]" \
    "err:405 Method Not Allowed"
grep -q "refuses to unpublish" <<<"${OUTPUT}" || { echo "FAIL fail-405:" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }

# 8. Other unpublish error -> failure counted and surfaced.
run_case other-error "1" \
    "ok:[\"1.0.2-dev.pr42\"]" \
    "err:500 Internal Server Error"
grep -q "npm unpublish failed" <<<"${OUTPUT}" || { echo "FAIL other-error:" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }

# 9. Already-absent during unpublish (E404 naming the version) -> success.
run_case already-absent "0" \
    "ok:[\"1.0.2-dev.pr42\"]" \
    "err:E404 404 Not Found - @adguard/testpkg@1.0.2-dev.pr42"
grep -q "already absent" <<<"${OUTPUT}" || { echo "FAIL already-absent:" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }

# 10. Non-JSON version list from npm view -> loud failure, not a silent delete.
run_case non-json "1" \
    "err:some auth error line"
grep -q "Could not query" <<<"${OUTPUT}" || { echo "FAIL non-json:" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }

echo 'ak-dev-unpublish tests passed'
