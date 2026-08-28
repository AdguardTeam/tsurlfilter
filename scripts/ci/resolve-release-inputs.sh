#!/bin/bash
# Usage: resolve-release-inputs.sh
#
# Resolves which package to publish and from which ref, for both triggers of
# publish-release.yml:
#   - workflow_dispatch: takes explicit inputs (package, optional ref, dry_run);
#   - pull_request (closed): fires on merged release-bump/<package>-v<version>
#     PRs and publishes the merge commit.
#
# Expected environment:
#   EVENT_NAME   - github.event_name
#   HEAD_REF     - github.event.pull_request.head.ref (PR trigger only)
#   MERGE_SHA    - github.event.pull_request.merge_commit_sha (PR trigger only)
#   INPUT_PACKAGE / INPUT_REF / INPUT_DRY_RUN - workflow_dispatch inputs
#   GITHUB_OUTPUT - step output file provided by the runner

set -euo pipefail

# The publishable packages — keep in sync with the workflow_dispatch `choice`
# options and packages/*/CHANGELOG.md. A package derived from an untrusted
# release-bump ref must be checked against this allowlist, not just a regex.
ALLOWLIST="logger css-tokenizer agtree tsurlfilter dnr-converter dnr-rulesets tswebextension adguard-api adguard-api-mv3 eslint-plugin-logger-context"

if [ "$EVENT_NAME" = "workflow_dispatch" ]; then
    PACKAGE="$INPUT_PACKAGE"
    REF="$INPUT_REF"
    DRY_RUN="${INPUT_DRY_RUN:-false}"
else
    # Fail fast on unexpected events/refs instead of silently deriving a
    # malformed package from a non-release-bump ref.
    if [ "$EVENT_NAME" != "pull_request" ] || [[ "$HEAD_REF" != release-bump/* ]]; then
        echo "::error::unexpected event '$EVENT_NAME' or non-release-bump ref '$HEAD_REF'"
        exit 1
    fi

    # release-bump/<package>-v<version> -> package (strip the release-bump/
    # prefix, then the shortest matching -v* suffix — ${PACKAGE%-v*} is a
    # *shortest* suffix removal, correct for hyphenated names like
    # adguard-api-mv3).
    PACKAGE="${HEAD_REF#release-bump/}"
    PACKAGE="${PACKAGE%-v*}"
    # An empty MERGE_SHA must fail loudly, not flow through as an empty 'ref'
    # (which the publish engine treats as "use the triggering commit" — a
    # silent publish from an unintended commit).
    if [ -z "$MERGE_SHA" ]; then
        echo "::error::missing MERGE_SHA for merged release-bump PR '$HEAD_REF'"
        exit 1
    fi
    REF="$MERGE_SHA"
    DRY_RUN="false"
fi

if [[ ! " $ALLOWLIST " =~ " ${PACKAGE} " ]]; then
    echo "::error::unknown package '$PACKAGE'; expected one of: $ALLOWLIST"
    exit 1
fi

case "$PACKAGE" in
    adguard-api)     NPM_NAME="@adguard/api" ;;
    adguard-api-mv3) NPM_NAME="@adguard/api-mv3" ;;
    *)               NPM_NAME="@adguard/${PACKAGE}" ;;
esac

{
    echo "package=$PACKAGE"
    echo "npm_package_name=$NPM_NAME"
    echo "ref=$REF"
    echo "dry_run=$DRY_RUN"
} >> "$GITHUB_OUTPUT"
