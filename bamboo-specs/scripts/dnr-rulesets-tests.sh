#!/bin/bash

# 'set' should be added to the beginning of each script to ensure that it runs with the correct options.
# Please do not move it to some common file, like `setup-tests.sh`, because sourcing A script from B script
# cannot change the options of B script.
#  -e: Exit immediately if any command exits with a non-zero status (i.e., if a command fails).
#  -x: Print each command to the terminal as it is executed, which is useful for debugging.
set -ex

# Redirect stderr (2) to stdout (1) to capture all output in a single log
exec 2>&1

# Define package name and directory as constants
PACKAGE_NAME="@adguard/dnr-rulesets"
PACKAGE_DIR="./packages/dnr-rulesets"

echo "$PACKAGE_NAME tests starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "$PACKAGE_NAME"; then
  echo "No changes in $PACKAGE_NAME, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm install

# Build the package
npx lerna run build --scope $PACKAGE_NAME --include-dependencies

# Define an array of commands to run
COMMANDS=(
    "lint:code"
    "lint:types"
    "test"
)

run_commands_in_parallel "$PACKAGE_DIR" "$PACKAGE_NAME" "${COMMANDS[@]}"

# Check if any of the commands failed
if [ $? -ne 0 ]; then
  exit 1
fi

echo "@adguard/dnr-rulesets tests completed"
