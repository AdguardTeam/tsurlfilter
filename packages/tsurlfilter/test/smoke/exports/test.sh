#!/bin/bash

set -e  # Exit on error

curr_path="test/smoke/exports"
tsurlfilter="tsurlfilter.tgz"
nm_path="node_modules"

#FIXME uncomment
## Define cleanup function
#cleanup() {
#    echo "Performing cleanup..."
#    rm -f $tsurlfilter && rm -rf $nm_path
#    echo "Cleanup complete"
#}
#
## Set trap to execute the cleanup function on script exit
#trap cleanup EXIT

(cd ../../.. && pnpm pack && mv adguard-tsurlfilter-*.tgz "$curr_path/$tsurlfilter")

# unzip to @adguard/tsurlfilter to node_modules
tsurlfilter_node_modules=$nm_path"/@adguard/tsurlfilter"
mkdir -p $tsurlfilter_node_modules
tar -xzf $tsurlfilter --strip-components=1 -C $tsurlfilter_node_modules

pnpm start
#echo "Test successfully built."
