#!/bin/bash

set -e  # Exit on error

# pack @adguard/tsurlfilter
curr_path="test/smoke/esm"
tsurlfilter="tsurlfilter.tgz"
nm_path="node_modules"

# Define cleanup function
cleanup() {
    echo "Cleaning up..."
#    rm -f $tsurlfilter && rm -rf $nm_path
    echo "Cleanup complete"
}

# Set trap to execute the cleanup function on script exit
trap cleanup EXIT

(cd ../../.. && pnpm pack && mv adguard-tsurlfilter-*.tgz "$curr_path/$tsurlfilter")

# unzip to @adguard/tsurlfilter to node_modules
tsurlfilter_node_modules=$nm_path"/@adguard/tsurlfilter"
mkdir -p $tsurlfilter_node_modules
tar -xzf $tsurlfilter --strip-components=1 -C $tsurlfilter_node_modules

pnpm start
echo "Test successfully built."
