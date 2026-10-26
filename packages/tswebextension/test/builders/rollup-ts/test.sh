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
# Current payload: 69,704 bytes. Raise this only when a genuine size increase
# lands, never to silence a regression.
max_size=70000
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

echo "Testing bundling with rollup-ts ended successfully"
