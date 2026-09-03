#!/usr/bin/env bash
# Regression tests for the finalize-changelog composite action.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ACTION_SCRIPT="${ROOT_DIR}/.github/actions/finalize-changelog/finalize-changelog.mjs"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TEMP_DIR}"' EXIT

# Fixed date emitted by the action via FINALIZE_DATE so the assertions are
# fully deterministic and immune to a UTC-midnight boundary between cases.
TEST_DATE='2026-01-15'

# run_case NAME CHANGELOG NEW_VERSION EXPECTED_FILE EXPECTED_NOTES
run_case() {
    local name="$1"
    local changelog="$2"
    local new_version="$3"
    local expected_file="$4"
    local expected_notes="$5"
    local case_dir="${TEMP_DIR}/${name}"

    mkdir -p "${case_dir}"
    printf '%s\n' "${changelog}" > "${case_dir}/CHANGELOG.md"
    CHANGELOG_PATH="${case_dir}/CHANGELOG.md" \
        NEW_VERSION="${new_version}" \
        FINALIZE_DATE="${TEST_DATE}" \
        GITHUB_OUTPUT="${case_dir}/github-output" \
        node "${ACTION_SCRIPT}"

    local actual_file
    actual_file="$(cat "${case_dir}/CHANGELOG.md")"
    if [[ "${actual_file}" != "${expected_file}" ]]; then
        echo "FAIL ${name}: changelog mismatch. Diff:" >&2
        diff <(printf '%s\n' "${expected_file}") <(printf '%s\n' "${actual_file}") >&2 || true
        exit 1
    fi

    # The output file uses the multiline heredoc syntax with a randomized
    # delimiter; the payload is exactly the lines between the header and footer,
    # so stripping the first and last line is robust and never drops a changelog
    # bullet that merely starts with the word 'release_notes'.
    local actual_notes
    actual_notes="$(sed -n '2,$p' "${case_dir}/github-output" | sed '$d')"
    if [[ "${actual_notes}" != "${expected_notes}" ]]; then
        echo "FAIL ${name}: release_notes mismatch. Diff:" >&2
        diff <(printf '%s\n' "${expected_notes}") <(printf '%s\n' "${actual_notes}") >&2 || true
        exit 1
    fi
}

run_case \
    standard \
    $'# Changelog\n\n## [Unreleased]\n\n### Added\n\n- New thing\n\n### Fixed\n\n- Bug fix\n\n## [4.2.0] - 2026-06-01\n\n### Added\n\n- Old thing' \
    '4.3.0' \
    $'# Changelog\n\n## [Unreleased]\n\n### Added\n\n### Changed\n\n### Deprecated\n\n### Removed\n\n### Fixed\n\n### Security\n\n## [4.3.0] - '"${TEST_DATE}"$'\n\n### Added\n\n- New thing\n\n### Fixed\n\n- Bug fix\n\n## [4.2.0] - 2026-06-01\n\n### Added\n\n- Old thing' \
    $'## [4.3.0] - '"${TEST_DATE}"$'\n\n### Added\n\n- New thing\n\n### Fixed\n\n- Bug fix'

run_case \
    empty-unreleased \
    $'# Changelog\n\n## [Unreleased]\n\n## [4.2.0] - 2026-06-01' \
    '4.3.0-beta.1' \
    $'# Changelog\n\n## [Unreleased]\n\n### Added\n\n### Changed\n\n### Deprecated\n\n### Removed\n\n### Fixed\n\n### Security\n\n## [4.3.0-beta.1] - '"${TEST_DATE}"$'\n\n## [4.2.0] - 2026-06-01' \
    $'## [4.3.0-beta.1] - '"${TEST_DATE}"

# A previous prerelease tag (e.g. `dnr-rulesets-v4.2.1-beta.1`) must keep the
# compare-link chain intact: the `[Unreleased]` link is re-pointed at the new
# tag and a `[<version>]` definition is emitted. The old regex only matched
# digits-and-dots versions, so a prerelease predecessor left `[Unreleased]`
# pointing at the stale tag with no `[<version>]` definition. The script only
# rewrites the links when the changelog path looks like
# packages/<name>/CHANGELOG.md, hence the nested path here.
prerelease_dir="${TEMP_DIR}/prerelease-compare-link"
mkdir -p "${prerelease_dir}/packages/dnr-rulesets"
printf '%s\n' \
    '# Changelog' \
    '' \
    '## [Unreleased]' \
    '' \
    '### Fixed' \
    '' \
    '- Bug fix' \
    '' \
    '[Unreleased]: https://github.com/AdguardTeam/tsurlfilter/compare/dnr-rulesets-v4.2.1-beta.1...HEAD' \
    '' \
    '## [4.2.0] - 2026-06-01' > "${prerelease_dir}/packages/dnr-rulesets/CHANGELOG.md"
CHANGELOG_PATH="${prerelease_dir}/packages/dnr-rulesets/CHANGELOG.md" \
    NEW_VERSION='4.2.2' \
    FINALIZE_DATE="${TEST_DATE}" \
    GITHUB_OUTPUT="${prerelease_dir}/github-output" \
    node "${ACTION_SCRIPT}"

prerelease_out="$(cat "${prerelease_dir}/packages/dnr-rulesets/CHANGELOG.md")"
if ! grep -q '^\[Unreleased\]: .*compare/dnr-rulesets-v4\.2\.2\.\.\.HEAD$' <<<"${prerelease_out}"; then
    echo 'FAIL prerelease-compare-link: [Unreleased] was not re-pointed at the new tag' >&2
    exit 1
fi
if ! grep -q '^\[4\.2\.2\]: .*compare/dnr-rulesets-v4\.2\.1-beta\.1\.\.\.dnr-rulesets-v4\.2\.2$' <<<"${prerelease_out}"; then
    echo 'FAIL prerelease-compare-link: no [4.2.2] compare-link definition emitted' >&2
    exit 1
fi

# The nine packages link every version to `.../releases/tag/<pkg>-v<version>`
# (no [Unreleased] compare link). The new heading must get a
# `[<version>]: .../releases/tag/...` definition in that same style, otherwise
# it renders with literal `[x.y.z]` brackets unlike every existing entry.
release_tag_dir="${TEMP_DIR}/release-tag-refs"
mkdir -p "${release_tag_dir}/packages/logger"
printf '%s\n' \
    '# Changelog' \
    '' \
    '## [Unreleased]' \
    '' \
    '### Added' \
    '' \
    '- New thing' \
    '' \
    '## [2.0.0] - 2026-06-01' \
    '' \
    '[2.0.0]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/logger-v2.0.0' > "${release_tag_dir}/packages/logger/CHANGELOG.md"
CHANGELOG_PATH="${release_tag_dir}/packages/logger/CHANGELOG.md" \
    NEW_VERSION='2.1.0' \
    FINALIZE_DATE="${TEST_DATE}" \
    GITHUB_OUTPUT="${release_tag_dir}/github-output" \
    node "${ACTION_SCRIPT}"

release_tag_out="$(cat "${release_tag_dir}/packages/logger/CHANGELOG.md")"
if ! grep -q '^\[2\.1\.0\]: .*/releases/tag/logger-v2\.1\.0$' <<<"${release_tag_out}"; then
    echo 'FAIL release-tag-refs: no [2.1.0] releases/tag definition emitted for the new heading' >&2
    exit 1
fi

# tsurlfilter mixes both styles: a compare-style [Unreleased] link AND
# per-version releases/tag definitions. Both halves must be preserved: the
# [Unreleased] link re-pointed at the new tag, and the new version's definition
# emitted in the releases/tag style matching its other version headings.
mixed_dir="${TEMP_DIR}/tsurlfilter-mixed"
mkdir -p "${mixed_dir}/packages/tsurlfilter"
printf '%s\n' \
    '# Changelog' \
    '' \
    '## [Unreleased]' \
    '' \
    '### Added' \
    '' \
    '- New thing' \
    '' \
    '[Unreleased]: https://github.com/AdguardTeam/tsurlfilter/compare/tsurlfilter-v6.0.2...HEAD' \
    '' \
    '## [6.0.2] - 2026-07-28' \
    '' \
    '[6.0.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v6.0.2' > "${mixed_dir}/packages/tsurlfilter/CHANGELOG.md"
CHANGELOG_PATH="${mixed_dir}/packages/tsurlfilter/CHANGELOG.md" \
    NEW_VERSION='6.0.3' \
    FINALIZE_DATE="${TEST_DATE}" \
    GITHUB_OUTPUT="${mixed_dir}/github-output" \
    node "${ACTION_SCRIPT}"

mixed_out="$(cat "${mixed_dir}/packages/tsurlfilter/CHANGELOG.md")"
if ! grep -q '^\[Unreleased\]: .*compare/tsurlfilter-v6\.0\.3\.\.\.HEAD$' <<<"${mixed_out}"; then
    echo 'FAIL tsurlfilter-mixed: [Unreleased] not re-pointed at the new tag' >&2
    exit 1
fi
if ! grep -q '^\[6\.0\.3\]: .*/releases/tag/tsurlfilter-v6\.0\.3$' <<<"${mixed_out}"; then
    echo 'FAIL tsurlfilter-mixed: no [6.0.3] releases/tag definition emitted' >&2
    exit 1
fi

# Two consecutive releases must keep the compare-chain intact. The re-pointed
# `[Unreleased]` link must stay inside the Unreleased block so the second
# finalize re-collects it and re-points it at the newer tag. The previous bug
# emitted the re-pointed line inside the released section after the first
# release, so the second finalize never re-collected it and the file ended up
# with a stale, misplaced `[Unreleased]: ...compare/...v6.0.3...HEAD` inside the
# 6.0.3 section while the fresh Unreleased block had no definition at all.
double_dir="${TEMP_DIR}/tsurlfilter-mixed-two-releases"
mkdir -p "${double_dir}/packages/tsurlfilter"
printf '%s\n' \
    '# Changelog' \
    '' \
    '## [Unreleased]' \
    '' \
    '### Added' \
    '' \
    '- New thing' \
    '' \
    '[Unreleased]: https://github.com/AdguardTeam/tsurlfilter/compare/tsurlfilter-v6.0.2...HEAD' \
    '' \
    '## [6.0.2] - 2026-07-28' \
    '' \
    '[6.0.2]: https://github.com/AdguardTeam/tsurlfilter/releases/tag/tsurlfilter-v6.0.2' > "${double_dir}/packages/tsurlfilter/CHANGELOG.md"

double_finalize() {
    local ver="$1"
    CHANGELOG_PATH="${double_dir}/packages/tsurlfilter/CHANGELOG.md" \
        NEW_VERSION="${ver}" \
        FINALIZE_DATE="${TEST_DATE}" \
        GITHUB_OUTPUT="${double_dir}/github-output-${ver}" \
        node "${ACTION_SCRIPT}"
}
double_finalize '6.0.3'
double_finalize '6.0.4'

double_out="$(cat "${double_dir}/packages/tsurlfilter/CHANGELOG.md")"
if ! grep -q '^\[Unreleased\]: .*compare/tsurlfilter-v6\.0\.4\.\.\.HEAD$' <<<"${double_out}"; then
    echo 'FAIL tsurlfilter-mixed-two-releases: [Unreleased] not re-pointed at the 2nd release tag' >&2
    exit 1
fi
if grep -q '^\[Unreleased\]: .*compare/tsurlfilter-v6\.0\.3\.\.\.HEAD$' <<<"${double_out}"; then
    echo 'FAIL tsurlfilter-mixed-two-releases: stale [Unreleased] v6.0.3 link left behind' >&2
    exit 1
fi
double_unreleased_heading="$(grep -n '^## \[Unreleased\]$' <<<"${double_out}" | head -1 | cut -d: -f1)"
double_v604_heading="$(grep -n '^## \[6\.0\.4\] - ' <<<"${double_out}" | head -1 | cut -d: -f1)"
double_unreleased_link="$(grep -n '^\[Unreleased\]: ' <<<"${double_out}" | head -1 | cut -d: -f1)"
if [[ -z "${double_unreleased_heading}" || -z "${double_v604_heading}" || -z "${double_unreleased_link}" ]] \
    || ! (( double_unreleased_heading < double_unreleased_link && double_unreleased_link < double_v604_heading )); then
    echo 'FAIL tsurlfilter-mixed-two-releases: [Unreleased] link not inside the Unreleased block' >&2
    exit 1
fi
if ! grep -q '^\[6\.0\.4\]: .*/releases/tag/tsurlfilter-v6\.0\.4$' <<<"${double_out}"; then
    echo 'FAIL tsurlfilter-mixed-two-releases: no [6.0.4] releases/tag definition emitted' >&2
    exit 1
fi

# Missing [Unreleased] must fail with a clear error.
missing_dir="${TEMP_DIR}/missing-unreleased"
mkdir -p "${missing_dir}"
printf '%s\n' $'# Changelog\n\n## [4.2.0] - 2026-06-01' > "${missing_dir}/CHANGELOG.md"
err_file="${missing_dir}/err"
if CHANGELOG_PATH="${missing_dir}/CHANGELOG.md" \
    NEW_VERSION='4.3.0' \
    FINALIZE_DATE="${TEST_DATE}" \
    GITHUB_OUTPUT="${missing_dir}/github-output" \
    node "${ACTION_SCRIPT}" 2>"${err_file}"; then
    echo 'FAIL missing-unreleased: expected a non-zero exit code' >&2
    exit 1
fi
if ! grep -q 'Could not find \[Unreleased\] section' "${err_file}"; then
    echo "FAIL missing-unreleased: unexpected error output: $(cat "${err_file}")" >&2
    exit 1
fi

echo 'finalize-changelog tests passed'
