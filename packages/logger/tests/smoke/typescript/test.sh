#!/bin/bash

set -e  # Exit on error

curr_path="tests/smoke/typescript"
logger="logger.tgz"
nm_path="node_modules"

# Define cleanup function
cleanup() {
    echo "Performing cleanup..."
    rm -f $logger && rm -rf $nm_path
    echo "Cleanup complete"
}

# Set trap to execute the cleanup function on script exit
trap cleanup EXIT

(cd ../../.. && pnpm pack && mv adguard-logger-*.tgz "$curr_path/$logger")

# unzip to @adguard/tsurlfilter to node_modules
logger_node_modules=$nm_path"/@adguard/logger"
mkdir -p $logger_node_modules
tar -xzf $logger --strip-components=1 -C $logger_node_modules

pnpm start
echo "Test successfully built."
