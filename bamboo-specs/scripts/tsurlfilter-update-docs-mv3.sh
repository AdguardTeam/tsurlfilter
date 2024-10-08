#!/bin/bash

# 'set' should be added to the beginning of each script to ensure that it runs with the correct options.
# Please do not move it to some common file, like `setup-tests.sh`, because sourcing A script from B script
# cannot change the options of B script.
#  -e: Exit immediately if any command exits with a non-zero status (i.e., if a command fails).
#  -x: Print each command to the terminal as it is executed, which is useful for debugging.
set -ex

# Redirect stderr (2) to stdout (1) to capture all output in a single log
exec 2>&1

echo "@adguard/tsurlfilter docs mv3 update starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

# Install dependencies
pnpm install

# Build with dependencies, lerna is used for builds caching, because
# we specified dependencies with workspace links.
npx lerna run build,docs:mv3 --scope @adguard/tsurlfilter --include-dependencies

echo "@adguard/tsurlfilter docs mv3 updated"
