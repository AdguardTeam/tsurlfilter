#!/bin/bash
# Usage: copy-test-reports.sh <package-dir> [fallback-xml-name]
#
# Copies JUnit XML reports from <package-dir>/tests-reports/ to /out/tests-reports/.
#
# If tests-reports/ does not exist and a fallback name is provided, copies
# skipped-tests.xml to /out/tests-reports/<fallback-xml-name>.xml instead.
# Note: CI job scripts touch extracted XML files after `docker build --output`
# to ensure Bamboo's JUnit parser accepts their timestamps on re-runs.

PACKAGE_DIR="$1"
FALLBACK_NAME="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -d "${PACKAGE_DIR}/tests-reports" ]; then
    cp -R "${PACKAGE_DIR}/tests-reports/." /out/tests-reports/
elif [ -n "${FALLBACK_NAME}" ]; then
    cp "${SCRIPT_DIR}/skipped-tests.xml" "/out/tests-reports/${FALLBACK_NAME}.xml"
fi
