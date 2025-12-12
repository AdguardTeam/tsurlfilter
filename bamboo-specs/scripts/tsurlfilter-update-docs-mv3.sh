#!/bin/bash

# 'set' should be added to the beginning of each script to ensure that it runs with the correct options.
# Please do not move it to some common file, like `setup-tests.sh`, because sourcing A script from B script
# cannot change the options of B script.
#  -e: Exit immediately if any command exits with a non-zero status (i.e., if a command fails).
#  -x: Print each command to the terminal as it is executed, which is useful for debugging.
set -ex

# Redirect stderr (2) to stdout (1) to capture all output in a single log
exec 2>&1

echo "@adguard/tsurlfilter docs mv3 update starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

# Check if there are any changes to files that affect MV3 documentation
# Relevant files:
# - Source code in tsurlfilter package (affects the declarative converter behavior)
# - The input documentation file (readme.txt)
# - The generation script itself
echo "Checking for changes since last commit..."

# Get the last commit that modified the generated README.md
LAST_DOC_COMMIT=$(git log -1 --format="%H" -- packages/tsurlfilter/src/rules/declarative-converter/README.md 2>/dev/null || echo "")

if [ -n "$LAST_DOC_COMMIT" ]; then
    echo "Last doc update commit: $LAST_DOC_COMMIT"

    # Check if any relevant files have changed since the last doc update
    CHANGED_FILES=$(git diff --name-only "$LAST_DOC_COMMIT" HEAD -- \
        'packages/tsurlfilter/src/' \
        'packages/tsurlfilter/tasks/generate-examples.ts' \
        'packages/tsurlfilter/src/rules/declarative-converter/readme.txt' 2>/dev/null || echo "")

    if [ -z "$CHANGED_FILES" ]; then
        echo "No changes detected in files that affect MV3 documentation since last update."
        echo "Skipping documentation generation."
        exit 0
    fi

    echo "Changes detected in the following files:"
    echo "$CHANGED_FILES"
else
    echo "No previous doc update found - proceeding with generation"
fi

# Install dependencies
pnpm install

# Build with dependencies, lerna is used for builds caching, because
# we specified dependencies with workspace links.
npx lerna run build,docs:mv3 --scope @adguard/tsurlfilter --include-dependencies

echo "@adguard/tsurlfilter docs mv3 updated"
