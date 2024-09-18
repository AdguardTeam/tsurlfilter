#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Print commands and their arguments as they are executed
set -x

echo "tswebextension-mv2 tests starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "tswebextension-mv2"; then
  echo "No changes in tswebextension-mv2, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm install

# First build since we need dependencies
npx lerna run build --scope tswebextension-mv2 --include-dependencies

# Lint
pnpm --filter tswebextension-mv2 lint

## Test
## TODO: fail if tests are not passing
#pnpm --filter tswebextension-mv2 test
# TODO add artifacts
#  artifacts:
#    - name: extension.zip
#      location: packages/examples/adguard-api/build
#      pattern: extension.zip
#      shared: true
#      required: false

echo "tswebextension-mv2 tests completed"
