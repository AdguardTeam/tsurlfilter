#!/bin/bash

# 'set' should be added to the beginning of each script to ensure that it runs with the correct options.
# Please do not move it to some common file, like `setup-tests.sh`, because sourcing A script from B script
# cannot change the options of B script.
#  -e: Exit immediately if any command exits with a non-zero status (i.e., if a command fails).
#  -x: Print each command to the terminal as it is executed, which is useful for debugging.
set -ex

# Redirect stderr (2) to stdout (1) to capture all output in a single log
exec 2>&1

echo "@adguard/tsurlfilter tests starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "@adguard/tsurlfilter"; then
  echo "No changes in @adguard/tsurlfilter, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm install

# Build dependencies, then the package itself
npx lerna run build --scope @adguard/tsurlfilter --include-dependencies

# IMPORTANT:
# test:prod includes linting, smoke testing and no-cache unit testing
# so it should run after the build because
# - linting requires types to be generated
# - smoke tests require tsurlfilter to have a built dist directory
pnpm --filter @adguard/tsurlfilter test:prod

echo "@adguard/tsurlfilter tests completed"
