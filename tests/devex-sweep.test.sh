#!/usr/bin/env bash
# Regression tests for scripts/ci/devex-sweep.mjs. Hermetic: npm is stubbed via
# PATH shadowing (replies consumed in order), and GitHub PR states are faked
# with SWEEP_PR_STATES so no network is touched.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${ROOT_DIR}/scripts/ci/devex-sweep.mjs"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TEMP_DIR}"' EXIT

BIN_DIR="${TEMP_DIR}/bin"
mkdir -p "${BIN_DIR}"

REPLY_FILE="${TEMP_DIR}/replies"
LOG_FILE="${TEMP_DIR}/npm.log"
export REPLY_FILE LOG_FILE
export PATH="${BIN_DIR}:${PATH}"
export AK_REGISTRY="https://ak.invalid/npm/npm-internal"
export GITHUB_REPOSITORY="AdGuardSoftwareLimited/ext-tsurlfilter"

# Fake npm: each invocation consumes one REPLY_FILE line and returns it.
#   ok:...     -> the payload, exit 0
#   err:...    -> the payload on stderr, exit 1
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

write_replies() {
    : > "${REPLY_FILE}"
    for line in "$@"; do
        printf '%s\n' "${line}" >> "${REPLY_FILE}"
    done
}

# Six packages each answer the sweep's initial `npm view ... versions` with the
# same list, containing a -dev.pr7 (closed) and a -dev.pr9 (open) build.
VERSIONS='["1.0.0","1.0.1-dev.pr7","1.0.1-dev.pr9"]'

run_sweep() {
    : > "${LOG_FILE}"
    set +e
    OUTPUT="$(env SWEEP_PR_STATES="$1" node "${SCRIPT}" 2>&1)"
    local code=$?
    set -e
    echo "${OUTPUT}"
    return "${code}"
}

# 1. Closed PR's builds are deleted, open PR's builds are kept. deletePrVersions
#    calls ak-dev-unpublish.sh, which queries versions again — everything after
#    the first 6 replies is "ok:[]" so the delete leg reports nothing to delete
#    (the unpublish itself is covered by ak-dev-unpublish.test.sh).
write_replies \
    "ok:${VERSIONS}" "ok:${VERSIONS}" "ok:${VERSIONS}" \
    "ok:${VERSIONS}" "ok:${VERSIONS}" "ok:${VERSIONS}" \
    "ok:[]" "ok:[]" "ok:[]" "ok:[]" "ok:[]" "ok:[]"
: > "${LOG_FILE}"
set +e
OUTPUT="$(env SWEEP_PR_STATES='7:closed,9:open' node "${SCRIPT}" 2>&1)"
code=$?
set -e
[[ "${code}" -eq 0 ]] || { echo "FAIL gc: expected exit 0, got ${code}" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }
grep -q 'PR #7 is closed — deleting' <<<"${OUTPUT}" || { echo "FAIL gc: expected PR #7 deletion:" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }
grep -q 'PR #9 is open — keeping' <<<"${OUTPUT}" || { echo "FAIL gc: expected PR #9 to be kept:" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }
# The deletion leg must have actually invoked ak-dev-unpublish.sh for each
# package with the -dev.pr7 suffix.
cd "${ROOT_DIR}"
grep -q 'view @adguard/dnr-converter versions' "${LOG_FILE}" || { echo "FAIL gc: dnr-converter not queried" >&2; cat "${LOG_FILE}" >&2; exit 1; }

# 2. A PR whose state cannot be determined is left in place and fails the run.
write_replies \
    "ok:${VERSIONS}" "ok:[]" "ok:[]" "ok:[]" "ok:[]" "ok:[]" \
    "ok:[]" "ok:[]" "ok:[]" "ok:[]" "ok:[]"
set +e
OUTPUT="$(env SWEEP_PR_STATES='7:error' node "${SCRIPT}" 2>&1)"
code=$?
set -e
[[ "${code}" -eq 1 ]] || { echo "FAIL state-error: expected exit 1, got ${code}" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }
grep -q 'could not check state of PR' <<<"${OUTPUT}" || { echo "FAIL state-error: expected a loud keep" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }

# 3. Targeted sweep (PR_NUMBER set) deletes that PR's builds without a state
#    check, and ignores everything else.
write_replies \
    "ok:${VERSIONS}" "ok:${VERSIONS}" "ok:${VERSIONS}" \
    "ok:${VERSIONS}" "ok:${VERSIONS}" "ok:${VERSIONS}" \
    "ok:[]" "ok:[]" "ok:[]" "ok:[]" "ok:[]" "ok:[]"
set +e
OUTPUT="$(env PR_NUMBER=7 node "${SCRIPT}" 2>&1)"
code=$?
set -e
[[ "${code}" -eq 0 ]] || { echo "FAIL targeted: expected exit 0, got ${code}" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }
grep -q 'targeted sweep: deleting .* for PR #7' <<<"${OUTPUT}" || { echo "FAIL targeted: expected PR #7 deletion" >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1; }
if grep -q 'PR #9' <<<"${OUTPUT}"; then
    echo 'FAIL targeted: PR #9 must not be touched' >&2; printf '%s\n' "${OUTPUT}" >&2; exit 1
fi

echo 'devex-sweep tests passed'
