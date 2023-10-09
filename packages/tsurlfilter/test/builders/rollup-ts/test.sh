#!/bin/bash

echo "Staring to test a bundling with rollup-ts "

# install other deps
yarn install

# pack @adguard/tsurlfilter
curr_path="test/builders/rollup-ts"
tsurlfilter="tsurlfilter.tgz"

(cd ../../.. && yarn pack --filename $curr_path/$tsurlfilter)

# unzip to @adguard/tsurlfilter to node_modules
tsurlfilter_nm="node_modules/@adguard/tsurlfilter"
mkdir -p $tsurlfilter_nm
tar -xzf $tsurlfilter --strip-components=1 -C $tsurlfilter_nm

# needed for verbose logging for debugging
(cd node_modules/@adguard/tsurlfilter && pwd && ls -l)

{
    # try
    # bundle with rollup
    yarn build &&
    echo "Test successfully built."
} || {
    # catch
    echo "Test build ended with error"
    # clean up on error
    rm $tsurlfilter
    exit 1
}

rm $tsurlfilter

echo "Testing bundling with rollup-ts ended successfully"
