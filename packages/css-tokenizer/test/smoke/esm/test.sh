#!/bin/bash

set -e  # Exit on error

# pack @adguard/css-tokenizer
curr_path="test/smoke/esm"
csstokenizer="css-tokenizer.tgz"
nm_path="node_modules"

# Define cleanup function
cleanup() {
    echo "Cleaning up..."
    rm -f $csstokenizer && rm -rf $nm_path
    echo "Cleanup complete"
}

# Set trap to execute the cleanup function on script exit
trap cleanup EXIT

(cd ../../.. && pnpm pack && mv adguard-css-tokenizer-*.tgz "$curr_path/$csstokenizer")

# unzip to @adguard/tsurlfilter to node_modules
csstokenizer_node_modules=$nm_path"/@adguard/css-tokenizer"
mkdir -p $csstokenizer_node_modules
tar -xzf $csstokenizer --strip-components=1 -C $csstokenizer_node_modules

pnpm start
echo "Test successfully built."
