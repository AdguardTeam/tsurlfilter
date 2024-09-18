#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Print commands and their arguments as they are executed
set -x

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

pnpm --filter @adguard/tsurlfilter lint

# IMPORTANT: run tests after the build because smoke tests requires tsurlfilter to have built dist dir
pnpm --filter @adguard/tsurlfilter test:prod

echo "@adguard/tsurlfilter tests completed"
