# This script only needed until release/v3.1 branch is not merged into master.
# Purpose: faster link latest builds of tswebextension and tsurlfilter
# right in repository without pushing to npm registry.
set -e
set -x

# Fix mixed logs
exec 2>&1

echo "@adguard/tswebextension and @adguard/tsurlfilter builds starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "release/v3.1" ]; then
  echo "Skip builds in not release/v3.1 branch"
  exit 0;
fi

# Install dependencies
pnpm install

# build with dependencies, lerna is used for builds caching
npx lerna run build --scope @adguard/tswebextension --include-dependencies

# FIXME remove this task before merge to master
(cd packages/tswebextension && pnpm pack && mv adguard-tswebextension-*.tgz tswebextension.tgz)

# FIXME remove this task before merging to master
(cd packages/tsurlfilter && pnpm pack && mv adguard-tsurlfilter-*.tgz tsurlfilter.tgz)

# FIXME d.seregin move this task to the separate plan
pnpm --filter @adguard/tsurlfilter docs:mv3

echo "@adguard/tswebextension and @adguard/tsurlfilter builds completed"
