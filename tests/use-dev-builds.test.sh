#!/usr/bin/env bash
# Regression tests for scripts/use-dev-builds.mjs. Hermetic: npm and pnpm are
# stubbed via PATH shadowing; every case runs against a throwaway fixture copy
# of a browser-extension-shaped package.json.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${ROOT_DIR}/scripts/use-dev-builds.mjs"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TEMP_DIR}"' EXIT

BIN_DIR="${TEMP_DIR}/bin"
mkdir -p "${BIN_DIR}"
export PNPM_LOG="${TEMP_DIR}/pnpm.log"

# Fake npm: answers `npm view <name> versions --json` with a canned list
# containing one release and one dev build (1.0.1-dev.pr42), and
# `npm view <name>@<version> dist.tarball` with a deterministic AK-shaped URL.
# Failure modes (selected one at a time):
#   FAKE_NPM_ERROR=1      — every query exits non-zero with an E401 message.
#   FAKE_NPM_NONJSON=1    — the versions query returns non-JSON text.
#   FAKE_NPM_NO_DEV=1     — the versions list has no dev build.
#   FAKE_NPM_MULTI_DEV=1  — the versions list has several -dev.pr42 builds.
#   FAKE_NPM_NO_TARBALL=1 — the dist.tarball query returns nothing.
cat > "${BIN_DIR}/npm" <<'STUB'
#!/usr/bin/env bash
spec="$2"
field="$3"
if [[ "${field}" == "dist.tarball" ]]; then
    if [[ "${FAKE_NPM_NO_TARBALL:-}" == "1" ]]; then
        exit 0
    fi
    name="${spec%@*}"
    version="${spec##*@}"
    base="${name##*/}"
    echo "https://ak.int.agrd.dev/npm/npm-internal/${name}/-/${base}-${version}.tgz"
    exit 0
fi
if [[ "${FAKE_NPM_ERROR:-}" == "1" ]]; then
    echo "npm error code E401" >&2
    echo "npm error Unable to authenticate" >&2
    exit 1
fi
if [[ "${FAKE_NPM_NONJSON:-}" == "1" ]]; then
    echo "npm error some registry problem line"
    exit 0
fi
if [[ "${FAKE_NPM_MULTI_DEV:-}" == "1" ]]; then
    echo '["1.0.0","1.0.1-dev.pr41","1.0.2-dev.pr42","1.0.3-dev.pr42"]'
    exit 0
fi
if [[ -n "${FAKE_NPM_NO_DEV:-}" ]]; then
    echo '["1.0.0"]'
else
    echo '["1.0.0","1.0.1-dev.pr42"]'
fi
STUB
chmod +x "${BIN_DIR}/npm"

# Fake pnpm: records invocations, does nothing.
cat > "${BIN_DIR}/pnpm" <<'STUB'
#!/usr/bin/env bash
echo "pnpm $*" >> "${PNPM_LOG}"
STUB
chmod +x "${BIN_DIR}/pnpm"

export PATH="${BIN_DIR}:${PATH}"

BASE_PKG='{
    "name": "adguard-browser-extension",
    "version": "5.6.0.0",
    "dependencies": {
        "@adguard/agtree": "4.2.0",
        "@adguard/logger": "2.0.0",
        "@adguard/tsurlfilter": "6.0.2",
        "@adguard/tswebextension": "5.0.0",
        "webext-bridge": "6.0.1"
    },
    "devDependencies": {
        "@adguard/dnr-rulesets": "~5.0.20260817120135"
    }
}'

new_case() {
    local name="$1"
    local case_dir="${TEMP_DIR}/${name}"
    mkdir -p "${case_dir}"
    printf '%s\n' "${BASE_PKG}" > "${case_dir}/package.json"
    : > "${PNPM_LOG}"
    echo "${case_dir}"
}

# pin-fresh: overrides added (6 AK URLs at 1.0.1-dev.pr42), deps untouched,
# 4-space indentation preserved, exactly one pnpm install (fresh pin).
case_dir="$(new_case pin-fresh)"
node "${SCRIPT}" --pr 42 --extension "${case_dir}" --registry https://ak.int.agrd.dev/npm/npm-internal
node - "${case_dir}/package.json" <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert');
const pkg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const ov = pkg.pnpm?.overrides ?? {};
assert.strictEqual(Object.keys(ov).length, 6, 'expected exactly 6 overrides');
assert.strictEqual(
    ov['@adguard/logger'],
    'https://ak.int.agrd.dev/npm/npm-internal/@adguard/logger/-/logger-1.0.1-dev.pr42.tgz',
);
assert.strictEqual(
    ov['@adguard/css-tokenizer'],
    'https://ak.int.agrd.dev/npm/npm-internal/@adguard/css-tokenizer/-/css-tokenizer-1.0.1-dev.pr42.tgz',
);
assert.strictEqual(pkg.dependencies['@adguard/tsurlfilter'], '6.0.2', 'dependencies must stay untouched');
assert.strictEqual(pkg.dependencies['webext-bridge'], '6.0.1', 'unrelated dep must stay untouched');
NODE
grep -q '^    "dependencies"' "${case_dir}/package.json" || {
    echo 'FAIL pin-fresh: 4-space indentation not preserved' >&2; exit 1; }
[[ "$(wc -l < "${PNPM_LOG}" | tr -d ' ')" == '1' ]] || {
    echo 'FAIL pin-fresh: expected exactly 1 pnpm install' >&2; cat "${PNPM_LOG}" >&2; exit 1; }
grep -q 'install --no-frozen-lockfile --ignore-scripts' "${PNPM_LOG}" || {
    echo 'FAIL pin-fresh: unexpected pnpm args' >&2; cat "${PNPM_LOG}" >&2; exit 1; }

# pin-refresh: re-pinning over existing dev overrides takes the two-phase path
# (strip + install + re-pin + install = 2 pnpm installs) so the lockfile's
# stale integrity is dropped, and unrelated overrides survive.
case_dir="$(new_case pin-refresh)"
node - "${case_dir}/package.json" <<'NODE'
const fs = require('node:fs');
const p = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.pnpm = { overrides: {
    '@adguard/logger': 'https://ak.int.agrd.dev/npm/npm-internal/@adguard/logger/-/logger-1.0.1-dev.pr42.tgz',
    'left-pad': '1.3.0',
} };
fs.writeFileSync(p, JSON.stringify(pkg, null, 4) + '\n');
NODE
node "${SCRIPT}" --pr 42 --extension "${case_dir}" --registry https://ak.int.agrd.dev/npm/npm-internal
[[ "$(wc -l < "${PNPM_LOG}" | tr -d ' ')" == '2' ]] || {
    echo 'FAIL pin-refresh: expected 2 pnpm installs (two-phase refresh)' >&2; cat "${PNPM_LOG}" >&2; exit 1; }
node - "${case_dir}/package.json" <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert');
const pkg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert.strictEqual(Object.keys(pkg.pnpm.overrides).length, 7, '6 bridged + left-pad must survive');
assert.strictEqual(pkg.pnpm.overrides['left-pad'], '1.3.0', 'unrelated override must survive');
NODE

# remove: only the dev-pinned bridged keys are stripped; one install runs.
case_dir="$(new_case remove)"
node - "${case_dir}/package.json" <<'NODE'
const fs = require('node:fs');
const p = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.pnpm = { overrides: {
    '@adguard/logger': 'https://ak.int.agrd.dev/npm/npm-internal/@adguard/logger/-/logger-1.0.1-dev.pr42.tgz',
    '@adguard/agtree': '4.3.0',
} };
fs.writeFileSync(p, JSON.stringify(pkg, null, 4) + '\n');
NODE
node "${SCRIPT}" --remove --extension "${case_dir}"
node - "${case_dir}/package.json" <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert');
const pkg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const ov = pkg.pnpm.overrides;
assert.ok(!ov['@adguard/logger'], 'dev-pinned logger override must be removed');
assert.strictEqual(ov['@adguard/agtree'], '4.3.0', 'non-dev override must survive');
NODE
[[ "$(wc -l < "${PNPM_LOG}" | tr -d ' ')" == '1' ]] || {
    echo 'FAIL remove: expected exactly 1 pnpm install' >&2; cat "${PNPM_LOG}" >&2; exit 1; }

# missing-dev-version: registry has no dev build for the PR -> clear failure.
case_dir="$(new_case missing-dev)"
if FAKE_NPM_NO_DEV=1 node "${SCRIPT}" --pr 42 --extension "${case_dir}" 2>"${case_dir}/err"; then
    echo 'FAIL missing-dev-version: expected a non-zero exit code' >&2; exit 1;
fi
grep -q 'dev.pr42' "${case_dir}/err" || {
    echo 'FAIL missing-dev-version: error should name the missing dev version' >&2
    cat "${case_dir}/err" >&2; exit 1; }

# invalid-pr: non-numeric --pr is rejected before any registry/package.json work.
case_dir="$(new_case invalid-pr)"
if node "${SCRIPT}" --pr abc --extension "${case_dir}" 2>/dev/null; then
    echo 'FAIL invalid-pr: expected a non-zero exit code' >&2; exit 1;
fi

# flag-as-value: `--extension --pr` must be rejected with a clear error instead
# of silently treating '--pr' as the extension path.
case_dir="$(new_case arg-flag-value)"
if node "${SCRIPT}" --extension --pr 42 2>"${case_dir}/err"; then
    echo 'FAIL arg-flag-value: expected a non-zero exit code' >&2; exit 1;
fi
grep -q 'expects a value' "${case_dir}/err" || {
    echo 'FAIL arg-flag-value: error should name the bad argument' >&2; cat "${case_dir}/err" >&2; exit 1; }

# npm-error: a failed registry round-trip must produce a curated error naming
# the npm view and registry — never a raw Node stack trace.
case_dir="$(new_case npm-error)"
if FAKE_NPM_ERROR=1 node "${SCRIPT}" --pr 42 --extension "${case_dir}" 2>"${case_dir}/err"; then
    echo 'FAIL npm-error: expected a non-zero exit code' >&2; exit 1;
fi
grep -q 'npm view @adguard/logger versions failed' "${case_dir}/err" || {
    echo 'FAIL npm-error: error should name the failed npm view' >&2; cat "${case_dir}/err" >&2; exit 1; }
grep -q 'registry https://ak.int.agrd.dev/npm/npm-internal' "${case_dir}/err" || {
    echo 'FAIL npm-error: error should name the registry' >&2; cat "${case_dir}/err" >&2; exit 1; }
if grep -Eq '^\s+at ' "${case_dir}/err"; then
    echo 'FAIL npm-error: raw stack trace leaked to the operator' >&2; cat "${case_dir}/err" >&2; exit 1;
fi

# npm-nonjson: non-JSON npm view output produces a curated message, not a
# JSON.parse stack trace.
case_dir="$(new_case npm-nonjson)"
if FAKE_NPM_NONJSON=1 node "${SCRIPT}" --pr 42 --extension "${case_dir}" 2>"${case_dir}/err"; then
    echo 'FAIL npm-nonjson: expected a non-zero exit code' >&2; exit 1;
fi
grep -q 'unexpected output' "${case_dir}/err" || {
    echo 'FAIL npm-nonjson: error should mention the unexpected output' >&2; cat "${case_dir}/err" >&2; exit 1; }

# npm-multi: several -dev.pr42 builds (mid-PR release bump) must resolve to the
# newest core instead of failing on ambiguity.
case_dir="$(new_case npm-multi)"
FAKE_NPM_MULTI_DEV=1 node "${SCRIPT}" --pr 42 --extension "${case_dir}" --registry https://ak.int.agrd.dev/npm/npm-internal
node - "${case_dir}/package.json" <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert');
const pkg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const ov = pkg.pnpm.overrides;
assert.ok(
    ov['@adguard/logger'].endsWith('logger-1.0.3-dev.pr42.tgz'),
    'newest -dev.pr42 must win (got ' + ov['@adguard/logger'] + ')',
);
NODE

# no-tarball: registry confirms the dev version but returns no dist.tarball URL.
case_dir="$(new_case no-tarball)"
if FAKE_NPM_NO_TARBALL=1 node "${SCRIPT}" --pr 42 --extension "${case_dir}" 2>"${case_dir}/err"; then
    echo 'FAIL no-tarball: expected a non-zero exit code' >&2; exit 1;
fi
grep -q 'no dist.tarball URL' "${case_dir}/err" || {
    echo 'FAIL no-tarball: error should name the missing tarball URL' >&2; cat "${case_dir}/err" >&2; exit 1; }

# pin-manual-override: a hand-written non-dev override for a bridged package
# survives the pin; other bridged packages still get dev pins.
case_dir="$(new_case pin-manual-override)"
node - "${case_dir}/package.json" <<'NODE'
const fs = require('node:fs');
const p = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.pnpm = { overrides: { '@adguard/tsurlfilter': '6.0.2' } };
fs.writeFileSync(p, JSON.stringify(pkg, null, 4) + '\n');
NODE
node "${SCRIPT}" --pr 42 --extension "${case_dir}" --registry https://ak.int.agrd.dev/npm/npm-internal 2>"${case_dir}/warn"
node - "${case_dir}/package.json" <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert');
const pkg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const ov = pkg.pnpm.overrides;
assert.strictEqual(ov['@adguard/tsurlfilter'], '6.0.2', 'manual non-dev override must survive');
assert.strictEqual(
    ov['@adguard/logger'],
    'https://ak.int.agrd.dev/npm/npm-internal/@adguard/logger/-/logger-1.0.1-dev.pr42.tgz',
    'other bridged packages still pinned',
);
assert.strictEqual(Object.keys(ov).length, 6, '5 dev pins + 1 manual = 6');
NODE
grep -q 'keeping existing manual override @adguard/tsurlfilter' "${case_dir}/warn" || {
    echo 'FAIL pin-manual-override: expected a warning about the preserved override' >&2; exit 1; }

# crlf-manifest: a CRLF manifest keeps its 4-space indentation.
case_dir="$(new_case crlf-manifest)"
node - "${case_dir}/package.json" <<'NODE'
const fs = require('node:fs');
const p = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
fs.writeFileSync(p, JSON.stringify(pkg, null, 4).replace(/\n/g, '\r\n') + '\r\n');
NODE
node "${SCRIPT}" --pr 42 --extension "${case_dir}" --registry https://ak.int.agrd.dev/npm/npm-internal
grep -q $'^    "dependencies": {\r$' "${case_dir}/package.json" || {
    echo 'FAIL crlf-manifest: CRLF + 4-space indentation not preserved' >&2; exit 1; }

echo 'use-dev-builds tests passed'
