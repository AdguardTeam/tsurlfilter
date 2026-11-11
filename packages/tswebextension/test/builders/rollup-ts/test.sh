#!/bin/bash

set -euo pipefail

echo "Testing bundling with rollup-ts"

# install other deps
pnpm install --ignore-scripts

# pack @adguard/tswebextension
curr_path="test/builders/rollup-ts"
tswebextension="tswebextension.tgz"

(cd ../../.. && pnpm pack --out "$curr_path/$tswebextension")

# unzip to @adguard/tswebextension to node_modules
tswebextension_nm="node_modules/@adguard/tswebextension"
mkdir -p $tswebextension_nm
tar -xzf $tswebextension --strip-components=1 -C $tswebextension_nm

{
    # try
    # bundle with rollup
    pnpm build &&
    echo "Test successfully built."
} || {
    # catch
    echo "Test build ended with error"
    # clean up on error
    rm $tswebextension
    exit 1
}

# check shipped css hits counter payload size
# The guard measures the entry and every relative module it imports, so a
# shared chunk added or renamed by the bundler is included instead of silently
# dropping out of the sum. The smoke builder's CJS bundle tree-shakes the
# collector, so its size is not the shipped size either.
# The measured bytes include comments. Comments are deliberately kept in
# `dist`: the Chrome Web Store review narrative for script-rule execution
# (`JS_RULES_EXECUTION`) and the policy notes around `chrome.scripting` must be
# readable in the shipped bundles, so stripping them is not an option.
# Current payload: 76,686 bytes. The ExtendedCss work moved affected-element
# hit collection into `css-hits-helpers.ts`, which the content script now
# imports at runtime; the long JSDoc blocks of that module were condensed, so
# the budget moves only slightly. Raise this only when a genuine size increase
# lands, never to silence a regression.
max_size=77500
package_dist="node_modules/@adguard/tswebextension/dist"
if ! filesize=$(node measure-payload.mjs "$package_dist/css-hits-counter.js"); then
    echo "Failed to measure the shipped css-hits-counter payload"
    echo "Testing bundling with rollup-ts ended with error"
    # clean up
    rm $tswebextension
    exit 1
fi
if [ "$filesize" -gt $max_size ]; then
    echo "Shipped css-hits-counter payload is more than $max_size bytes with size $filesize"
    echo "Testing bundling with rollup-ts ended with error"
    # clean up
    rm $tswebextension
    exit 1
else
   echo "Shipped css-hits-counter payload is less than or equal to $max_size bytes with size $filesize"
fi

rm $tswebextension

# check that the prebuilt ExtendedCss script asset is shipped
# The asset is injected by the background before the rule strings, so it must
# exist in `dist`, install the engine under the key the injected apply function
# reads, and stay small enough to inject into every frame with ExtCSS rules.
# Current payload: ~56 KB minified with the bundled engine. Raise this only
# when a genuine engine or helper growth lands, never to silence a regression.
extcss_asset="$package_dist/extcss-inject.js"
max_extcss_size=70000
if [ ! -f "$extcss_asset" ]; then
    echo "Shipped ExtendedCss script asset is missing: $extcss_asset"
    echo "Testing bundling with rollup-ts ended with error"
    exit 1
fi
if ! grep -q "__adguardExtCssEngine" "$extcss_asset"; then
    echo "Shipped ExtendedCss script asset does not install the engine global"
    echo "Testing bundling with rollup-ts ended with error"
    exit 1
fi
# The asset is stamped with the package version and the background rejects an
# asset built by another version, so a stale copy in a consumer extension is
# reported instead of silently running an older engine.
extcss_version=$(node -p "require('./node_modules/@adguard/tswebextension/package.json').version")
if ! grep -q "$extcss_version" "$extcss_asset"; then
    echo "Shipped ExtendedCss script asset is not stamped with the package version $extcss_version"
    echo "Testing bundling with rollup-ts ended with error"
    exit 1
fi
extcss_size=$(wc -c < "$extcss_asset" | tr -d ' ')
if [ "$extcss_size" -gt $max_extcss_size ]; then
    echo "Shipped ExtendedCss script asset is more than $max_extcss_size bytes with size $extcss_size"
    echo "Testing bundling with rollup-ts ended with error"
    exit 1
else
    echo "Shipped ExtendedCss script asset is less than or equal to $max_extcss_size bytes with size $extcss_size"
fi

echo "Testing bundling with rollup-ts ended successfully"
