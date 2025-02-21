#!/bin/bash

# 'set' should be added to the beginning of each script to ensure that it runs with the correct options.
# Please do not move it to some common file, like `setup-tests.sh`, because sourcing A script from B script
# cannot change the options of B script.
#  -e: Exit immediately if any command exits with a non-zero status (i.e., if a command fails).
#  -x: Print each command to the terminal as it is executed, which is useful for debugging.
set -ex

# Redirect stderr (2) to stdout (1) to capture all output in a single log
exec 2>&1

echo "agtree-benchmark"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "agtree-benchmark"; then
  echo "No changes in agtree-benchmark, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm install

# Build the dependencies (benchmark has no build script)
# Note: Lerna does not allow to run a command just on the dependencies of a package:
# https://github.com/lerna/lerna/issues/2345
npx lerna run build --include-dependencies --scope @adguard/agtree

# Lint
pnpm --filter agtree-benchmark lint

echo "agtree-benchmark tests completed"
