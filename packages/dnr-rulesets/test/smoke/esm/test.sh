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

# Install through a path containing spaces to exercise ESM file URL handling.
adguard_dnr_rulesets_package_path="$nm_path/package with spaces"
mkdir -p "$adguard_dnr_rulesets_package_path" "$nm_path/@adguard"
tar -xzf "$adguard_dnr_rulesets" --strip-components=1 -C "$adguard_dnr_rulesets_package_path"
ln -s '../package with spaces' "$nm_path/@adguard/dnr-rulesets"

pnpm start
echo "Test successfully built."
