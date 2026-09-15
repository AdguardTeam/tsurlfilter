#!/usr/bin/env bash
# Regression tests for scripts/ci/check-pr-open.mjs. Hermetic: the GitHub API
# is simulated by a local HTTP server (no network), and the gate output goes
# to temp files. The script is invoked with `node`, the same way the workflows
# call it. Covers the exit-code contract (0 open / 10 closed|merged / 1
# undetermined / 2 usage) and the gate output emitted to the output file.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${ROOT_DIR}/scripts/ci/check-pr-open.mjs"
TEMP_DIR="$(mktemp -d)"

REPLY_FILE="${TEMP_DIR}/reply"
PORT_FILE="${TEMP_DIR}/port"
OUTPUT_FILE="${TEMP_DIR}/output"
GITHUB_OUTPUT_FILE="${TEMP_DIR}/github_output"
: > "${REPLY_FILE}"

# Fake GitHub API: `ok <state>` replies 200 {"state": ...}; `status <code>`
# replies that status (a 200 with a non-JSON body exercises the parse failure).
cat > "${TEMP_DIR}/api-server.mjs" <<'MJS'
import http from 'node:http';
import fs from 'node:fs';

const { REPLY_FILE, PORT_FILE } = process.env;
const server = http.createServer((req, res) => {
    const line = fs.readFileSync(REPLY_FILE, 'utf8').trim();
    if (line.startsWith('ok ')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ state: line.slice(3) }));
        return;
    }
    const code = Number(line.replace('status ', ''));
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(code === 200 ? 'this is not json' : '{"message":"gone"}');
});
server.listen(0, '127.0.0.1', () => {
    fs.writeFileSync(PORT_FILE, String(server.address().port));
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
MJS

env REPLY_FILE="${REPLY_FILE}" PORT_FILE="${PORT_FILE}" node "${TEMP_DIR}/api-server.mjs" &
SERVER_PID=$!
trap 'rm -rf "${TEMP_DIR}"; kill "${SERVER_PID}" 2>/dev/null || true' EXIT

# Wait for the server to report its port.
i=0
while [[ ! -s "${PORT_FILE}" && "${i}" -lt 50 ]]; do
    sleep 0.1
    i=$((i + 1))
done
PORT="$(cat "${PORT_FILE}")"
PR_URL="http://127.0.0.1:${PORT}/repos/owner/repo/pulls/42"
TOKEN="test-token"

set_reply() { printf '%s\n' "$1" > "${REPLY_FILE}"; }

# run_case NAME EXPECTED_EXIT EXPECTED_LINE [ARGS...]
#   EXPECTED_LINE is the single line the output file must contain ('' = unchanged).
run_case() {
    local name="$1" expected_exit="$2" expected_line="$3"
    shift 3
    : > "${OUTPUT_FILE}"
    set +e
    OUTPUT="$(env GITHUB_OUTPUT="${GITHUB_OUTPUT_FILE}" node "${SCRIPT}" "$@" 2>&1)"
    local code=$?
    set -e
    if [[ "${code}" -ne "${expected_exit}" ]]; then
        echo "FAIL ${name}: expected exit ${expected_exit}, got ${code}" >&2
        printf '%s\n' "${OUTPUT}" >&2
        exit 1
    fi
    if [[ "$(cat "${OUTPUT_FILE}")" != "${expected_line}" ]]; then
        echo "FAIL ${name}: expected output '${expected_line}', got '$(cat "${OUTPUT_FILE}")'" >&2
        printf '%s\n' "${OUTPUT}" >&2
        exit 1
    fi
    echo "PASS ${name}"
}

set_reply 'ok open'
run_case 'open'          0 'open=true'  "${PR_URL}" "${TOKEN}" "${OUTPUT_FILE}"

set_reply 'ok closed'
run_case 'closed'        10 'open=false' "${PR_URL}" "${TOKEN}" "${OUTPUT_FILE}"
CLOSED_OUTPUT="${OUTPUT}"

set_reply 'ok merged'
run_case 'merged'        10 'open=false' "${PR_URL}" "${TOKEN}" "${OUTPUT_FILE}"

set_reply 'ok unknown-state'
run_case 'unknown state' 1 ''            "${PR_URL}" "${TOKEN}" "${OUTPUT_FILE}"

set_reply 'status 500'
run_case 'http 500'      1 ''            "${PR_URL}" "${TOKEN}" "${OUTPUT_FILE}"

set_reply 'status 404'
run_case 'http 404'      1 ''            "${PR_URL}" "${TOKEN}" "${OUTPUT_FILE}"

set_reply 'status 200'
run_case 'non-json 200'  1 ''            "${PR_URL}" "${TOKEN}" "${OUTPUT_FILE}"

# A closed/merged PR emits a warning annotation on stdout (workflow commands
# are parsed from stdout only).
if ! grep -q '::warning::' <<<"${CLOSED_OUTPUT}"; then
    echo 'FAIL closed case: expected ::warning:: annotation on stdout' >&2
    exit 1
fi
echo 'PASS warning annotation'

# Third argument omitted: the gate line goes to ${GITHUB_OUTPUT}.
set_reply 'ok open'
: > "${GITHUB_OUTPUT_FILE}"
set +e
DEFAULT_OUTPUT="$(env GITHUB_OUTPUT="${GITHUB_OUTPUT_FILE}" node "${SCRIPT}" "${PR_URL}" "${TOKEN}" 2>&1)"
default_code=$?
set -e
if [[ "${default_code}" -ne 0 ]] || [[ "$(cat "${GITHUB_OUTPUT_FILE}")" != 'open=true' ]]; then
    echo "FAIL default GITHUB_OUTPUT: exit=${default_code} output='$(cat "${GITHUB_OUTPUT_FILE}")'" >&2
    printf '%s\n' "${DEFAULT_OUTPUT}" >&2
    exit 1
fi
echo 'PASS default GITHUB_OUTPUT'

# Usage error: missing required positionals.
set +e
USAGE_OUTPUT="$(env GITHUB_OUTPUT="${GITHUB_OUTPUT_FILE}" node "${SCRIPT}" 2>&1)"
usage_code=$?
set -e
if [[ "${usage_code}" -ne 2 ]] || ! grep -q '::error::usage:' <<<"${USAGE_OUTPUT}"; then
    echo "FAIL usage error: exit=${usage_code}" >&2
    printf '%s\n' "${USAGE_OUTPUT}" >&2
    exit 1
fi
echo 'PASS usage error'

echo 'check-pr-open tests passed'
