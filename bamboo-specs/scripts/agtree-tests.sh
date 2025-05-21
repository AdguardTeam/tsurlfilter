#!/bin/bash

# 'set' should be added to the beginning of each script to ensure that it runs with the correct options.
# Please do not move it to some common file, like `setup-tests.sh`, because sourcing A script from B script
# cannot change the options of B script.
#  -e: Exit immediately if any command exits with a non-zero status (i.e., if a command fails).
#  -x: Print each command to the terminal as it is executed, which is useful for debugging.
set -ex

# Redirect stderr (2) to stdout (1) to capture all output in a single log
exec 2>&1

echo "@adguard/agtree tests starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "@adguard/agtree"; then
  echo "No changes in @adguard/agtree, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm install

# Build dependencies before running tests
npx lerna run build --scope @adguard/agtree --include-dependencies

# Run all tests in parallel
echo "Running tests in parallel..."

# Check TypeScript types with TSC
pnpm --filter @adguard/agtree check-types &
TYPES_PID=$!

# Check code with ESLint
pnpm --filter @adguard/agtree lint &
LINT_PID=$!

# Run tests with Vitest
pnpm --filter @adguard/agtree test &
TEST_PID=$!

# Run smoke tests
pnpm --filter @adguard/agtree test:smoke &
SMOKE_PID=$!

# Wait for all processes to complete
wait $TYPES_PID $LINT_PID $TEST_PID $SMOKE_PID

# Check if any of the commands failed
if [ $? -ne 0 ]; then
  echo "One or more tests failed"
  exit 1
fi

echo "@adguard/agtree tests completed"
