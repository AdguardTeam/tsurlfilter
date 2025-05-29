#!/bin/bash

set -e  # Exit on error

# pack @adguard/agtree
curr_path="test/smoke/esm"
adguard_dnr_rulesets="adguard-dnr-rulesets.tgz"
nm_path="node_modules"

# Define cleanup function
cleanup() {
    echo "Cleaning up..."
    rm -f $adguard_dnr_rulesets && rm -rf $nm_path
    echo "Cleanup complete"
}

# Set trap to execute the cleanup function on script exit
trap cleanup EXIT

(cd ../../.. && pnpm pack --out "$curr_path/$adguard_dnr_rulesets")

# unzip to @adguard/dnr-rulesets to node_modules
adguard_dnr_rulesets_node_modules=$nm_path"/@adguard/dnr-rulesets"
mkdir -p $adguard_dnr_rulesets_node_modules
tar -xzf $adguard_dnr_rulesets --strip-components=1 -C $adguard_dnr_rulesets_node_modules

pnpm start
echo "Test successfully built."
