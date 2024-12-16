#!/bin/bash

# 'set' should be added to the beginning of each script to ensure that it runs with the correct options.
# Please do not move it to some common file, like `setup-tests.sh`, because sourcing A script from B script
# cannot change the options of B script.
#  -e: Exit immediately if any command exits with a non-zero status (i.e., if a command fails).
#  -x: Print each command to the terminal as it is executed, which is useful for debugging.
set -ex

# Redirect stderr (2) to stdout (1) to capture all output in a single log
exec 2>&1

echo "@adguard/tswebextension and @adguard/tsurlfilter builds starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

# FIXME: Remove after merge to master
if [ "$branch" != "release/v3.1" ]; then
  echo "Skip builds in not release/v3.1 branch"
  exit 0;
fi

# Install dependencies
pnpm install

# build with dependencies, lerna is used for builds caching
npx lerna run build --scope @adguard/tswebextension --include-dependencies

# FIXME: remove this task before merge to master
(cd packages/agtree && pnpm pack && mv adguard-agtree-*.tgz agtree.tgz)

# FIXME: remove this task before merging to master
(cd packages/tsurlfilter && pnpm pack && mv adguard-tsurlfilter-*.tgz tsurlfilter.tgz)

# FIXME: remove this task before merge to master
(cd packages/tswebextension && pnpm pack && mv adguard-tswebextension-*.tgz tswebextension.tgz)

echo "@adguard/tswebextension and @adguard/tsurlfilter builds completed"
