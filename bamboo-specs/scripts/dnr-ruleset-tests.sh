#!/bin/bash

# 'set' should be added to the beginning of each script to ensure that it runs with the correct options.
# Please do not move it to some common file, like `setup-tests.sh`, because sourcing A script from B script
# cannot change the options of B script.
#  -e: Exit immediately if any command exits with a non-zero status (i.e., if a command fails).
#  -x: Print each command to the terminal as it is executed, which is useful for debugging.
set -ex

# Redirect stderr (2) to stdout (1) to capture all output in a single log
exec 2>&1

echo "@adguard/dnr-rulesets tests starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "@adguard/dnr-rulesets"; then
  echo "No changes in @adguard/dnr-rulesets, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm install

# Build the package
npx lerna run build --scope @adguard/dnr-rulesets --include-dependencies

# Run all tests in parallel
echo "Running tests in parallel..."

# Run linter
pnpm --filter @adguard/dnr-rulesets lint &
LINT_PID=$!

# Run tests
pnpm --filter @adguard/dnr-rulesets test &
TEST_PID=$!

# Wait for all processes to complete
wait $LINT_PID $TEST_PID

# Check if any of the commands failed
if [ $? -ne 0 ]; then
  echo "One or more tests failed"
  exit 1
fi

echo "@adguard/dnr-rulesets tests completed"
