#!/bin/bash

# 'set' should be added to the beginning of each script to ensure that it runs with the correct options.
# Please do not move it to some common file, like `setup-tests.sh`, because sourcing A script from B script
# cannot change the options of B script.
#  -e: Exit immediately if any command exits with a non-zero status (i.e., if a command fails).
#  -x: Print each command to the terminal as it is executed, which is useful for debugging.
set -ex

# Redirect stderr (2) to stdout (1) to capture all output in a single log
exec 2>&1

echo "@adguard/css-tokenizer tests starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "@adguard/css-tokenizer"; then
  echo "No changes in @adguard/css-tokenizer, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm install

# Check code, types, markdown
pnpm --filter @adguard/css-tokenizer lint

# Run tests with Vitest
pnpm --filter @adguard/css-tokenizer test

echo "@adguard/css-tokenizer tests completed"
