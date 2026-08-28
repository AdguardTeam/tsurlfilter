#!/usr/bin/env bash
# Regression tests for scripts/ci/verify-tarball.sh.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${ROOT_DIR}/scripts/ci/verify-tarball.sh"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TEMP_DIR}"' EXIT

# pnpm pack stores entries under a package/ prefix; fixtures must do the same.
make_tgz() {
    local dir="$1"
    local version="$2"
    local with_manifest="$3"
    local extra_files="$4"
    local pkg_dir="${dir}/package"

    mkdir -p "${pkg_dir}/dist/types" "${pkg_dir}/dist/es" "${pkg_dir}/src"
    if [ "${with_manifest}" = "yes" ]; then
        printf '{"name":"@adguard/logger","version":"%s"}\n' "${version}" > "${pkg_dir}/package.json"
    fi
    printf 'MIT\n' > "${pkg_dir}/LICENSE"
    printf '# logger\n' > "${pkg_dir}/README.md"
    printf 'console.log("hi")\n' > "${pkg_dir}/dist/index.js"
    printf 'export {};\n' > "${pkg_dir}/dist/es/index.mjs"
    printf 'export {};\n' > "${pkg_dir}/dist/types/index.d.ts"
    printf 'export {};\n' > "${pkg_dir}/src/index.ts"
    for f in ${extra_files}; do
        printf '%s\n' "${f}" > "${pkg_dir}/${f}"
    done
    (cd "${dir}" && tar -czf fixture.tgz package)
}

# expect_pass NAME TGZ VERSION
expect_pass() {
    local name="$1" tgz="$2" version="$3" out err status
    out="$(mktemp)"; err="$(mktemp)"
    set +e
    bash "${SCRIPT}" "${tgz}" "${version}" >"${out}" 2>"${err}"
    status=$?
    set -e
    if [ "${status}" -ne 0 ]; then
        echo "FAIL ${name}: expected success, got exit ${status}. stderr:" >&2
        cat "${err}" >&2
        exit 1
    fi
    if ! grep -q '^package/package.json$' "${out}"; then
        echo "FAIL ${name}: listing does not show package/package.json" >&2
        exit 1
    fi
    if ! grep -q "^Verified .* version ${version}, " "${out}"; then
        echo "FAIL ${name}: missing Verified line: $(cat "${out}")" >&2
        exit 1
    fi
    echo "ok ${name}"
}

# expect_fail NAME TGZ VERSION EXPECTED_ERR
expect_fail() {
    local name="$1" tgz="$2" version="$3" expected_err="$4" out err status
    out="$(mktemp)"; err="$(mktemp)"
    set +e
    bash "${SCRIPT}" "${tgz}" "${version}" >"${out}" 2>"${err}"
    status=$?
    set -e
    if [ "${status}" -eq 0 ]; then
        echo "FAIL ${name}: expected failure, got success" >&2
        exit 1
    fi
    if ! grep -qF "${expected_err}" "${err}"; then
        echo "FAIL ${name}: expected stderr to contain '${expected_err}', got: $(cat "${err}")" >&2
        exit 1
    fi
    echo "ok ${name}"
}

# The regression case: a valid logger-like tarball (package.json is the 3rd
# entry, as in the real release) must pass — the old racy grep pipeline
# sporadically rejected exactly this shape on CI.
valid_dir="${TEMP_DIR}/valid"
make_tgz "${valid_dir}" '2.0.1' 'yes' 'src/Logger.ts src/error.ts src/format-time.ts dist/types/Logger.d.ts'
for i in 1 2 3 4 5 6 7 8 9 10; do
    expect_pass "valid-run-${i}" "${valid_dir}/fixture.tgz" '2.0.1'
done

# A tarball without package/package.json must fail with a clear error.
missing_dir="${TEMP_DIR}/missing-manifest"
make_tgz "${missing_dir}" '2.0.1' 'no' 'src/Logger.ts'
expect_fail 'missing-manifest' "${missing_dir}/fixture.tgz" '2.0.1' 'package.json missing'

# A manifest with a different version must fail and name both versions.
wrong_dir="${TEMP_DIR}/wrong-version"
make_tgz "${wrong_dir}" '1.0.0' 'yes' 'src/Logger.ts'
expect_fail 'wrong-version' "${wrong_dir}/fixture.tgz" '2.0.1' 'has version 1.0.0, expected 2.0.1'

# A nearly-empty tarball must trip the entry-count check (package/ dir plus
# package/package.json = 2 entries).
sparse_dir="${TEMP_DIR}/too-few-entries"
mkdir -p "${sparse_dir}/package"
printf '{"name":"@adguard/logger","version":"2.0.1"}\n' > "${sparse_dir}/package/package.json"
(cd "${sparse_dir}" && tar -czf fixture.tgz package)
expect_fail 'too-few-entries' "${sparse_dir}/fixture.tgz" '2.0.1' 'contains only 2 entries'

echo 'verify-tarball tests passed'
