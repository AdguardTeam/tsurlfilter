#!/bin/bash

set -e  # Exit on error

curr_path="test/smoke/exports"
agtree="agtree.tgz"
nm_path="node_modules"

# Define cleanup function
cleanup() {
    echo "Performing cleanup..."
    rm -f $agtree && rm -rf $nm_path
    echo "Cleanup complete"
}

# Set trap to execute the cleanup function on script exit
trap cleanup EXIT

(cd ../../.. && pnpm pack --out "$curr_path/$agtree")

pnpm install

# unzip to @adguard/agtree to node_modules
agtree_node_modules=$nm_path"/@adguard/agtree"
mkdir -p $agtree_node_modules
tar -xzf $agtree --strip-components=1 -C $agtree_node_modules

pnpm start
