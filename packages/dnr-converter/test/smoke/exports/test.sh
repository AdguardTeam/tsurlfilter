#!/bin/bash

set -e  # Exit on error

curr_path="test/smoke/exports"
adguard_dnr_converter="adguard-dnr-converter.tgz"
nm_path="node_modules"

# Define cleanup function
cleanup() {
    echo "Performing cleanup..."
    rm -f $adguard_dnr_converter && rm -rf $nm_path
    echo "Cleanup complete"
}

# Set trap to execute the cleanup function on script exit
trap cleanup EXIT

(cd ../../.. && pnpm pack --out "$curr_path/$adguard_dnr_converter")

pnpm install

# unzip to @adguard/dnr-converter to node_modules
adguard_dnr_converter_node_modules=$nm_path"/@adguard/dnr-converter"
mkdir -p $adguard_dnr_converter_node_modules
tar -xzf $adguard_dnr_converter --strip-components=1 -C $adguard_dnr_converter_node_modules

pnpm start
