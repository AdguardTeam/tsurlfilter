#!/bin/bash

echo "Testing bundling with rollup-ts"

# install other deps
yarn install

# pack @adguard/tsurlfilter
curr_path="test/builders/rollup-ts"
tsurlfilter="tsurlfilter.tgz"
(cd ../../.. && yarn pack --filename $curr_path/$tsurlfilter)

# unzip to @adguard/tsurlfilter to node_modules
tsurlfilter_nm="node_modules/@adguard/tsurlfilter"
mkdir -p $tsurlfilter_nm
tar -xzf tsurlfilter.tgz -C $tsurlfilter_nm

# bundle with rollup
yarn build

# check css hits counter size
max_size=20000
filename="dist/css-hits-counter.js"
filesize=$(stat -f "%z" "$filename")
if [ "$filesize" -gt $max_size ]; then
   echo "\"$filename\" is more than $max_size bytes"
   echo "Testing bundling with rollup-ts ended with error"
   exit 1
else
   echo "$filename is less than or equal to $max_size bytes"
fi

rm $tsurlfilter

echo "Testing bundling with rollup-ts ended successfully"

