# This script only needed until release/v3.1 branch is not merged into master.
# Purpose: faster link latest builds of tswebextension and tsurlfilter
# right in repository without pushing to npm registry.
set -e
set -x

# Fix mixed logs
exec 2>&1

echo "@adguard/tsurlfilter docs mv3 update starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

# Install dependencies
pnpm install

# Build with dependencies, lerna is used for builds caching, because
# we specified dependencies with workspace links.
npx lerna run build,docs:mv3 --scope @adguard/tsurlfilter --include-dependencies

echo "@adguard/tsurlfilter docs mv3 updated"
