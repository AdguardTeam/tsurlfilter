#!/bin/bash

# 'set' should be added to the beginning of each script to ensure that it runs with the correct options.
# Please do not move it to some common file, like `setup-tests.sh`, because sourcing A script from B script
# cannot change the options of B script.
#  -e: Exit immediately if any command exits with a non-zero status (i.e., if a command fails).
#  -x: Print each command to the terminal as it is executed, which is useful for debugging.
set -ex

# Redirect stderr (2) to stdout (1) to capture all output in a single log
exec 2>&1

# Define package name as a constant
PACKAGE_NAME="@adguard/css-tokenizer"

echo "$PACKAGE_NAME tests starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

# Function to verify if a package.json script exists before running it
verify_script_exists() {
  local package=$1
  local script=$2

  # Check if the script exists in package.json
  if ! pnpm --filter $package exec jq -e ".scripts.$script" package.json > /dev/null 2>&1; then
    echo "Error: Script '$script' does not exist in package '$package'"
    exit 1
  fi
}

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "$PACKAGE_NAME"; then
  echo "No changes in $PACKAGE_NAME, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm install

# Define an array of commands to run
COMMANDS=(
    "lint"
    "test"
)

# Run all tests in parallel
echo "Running tests in parallel..."

# Array to store process IDs
PIDS=()

# Verify all scripts exist before running them
for cmd in "${COMMANDS[@]}"; do
  verify_script_exists "$PACKAGE_NAME" "$cmd"
done

# Run all commands in parallel
for cmd in "${COMMANDS[@]}"; do
  echo "Running $cmd..."
  pnpm --filter "$PACKAGE_NAME" $cmd &
  PID=$!
  PIDS+=($PID)
done

# Wait for all processes to complete
echo "Waiting for all processes to complete..."
wait ${PIDS[@]}

# Check if any of the commands failed
if [ $? -ne 0 ]; then
  echo "One or more tests failed"
  exit 1
fi

echo "$PACKAGE_NAME tests completed"
