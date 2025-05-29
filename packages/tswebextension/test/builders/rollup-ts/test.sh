#!/bin/bash

echo "Testing bundling with rollup-ts"

# install other deps
pnpm install

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

# check css hits counter size
max_size=20100
filename="dist/css-hits-counter.js"
filesize=$(stat -f "%z" "$filename")
if [ "$filesize" -gt $max_size ]; then
    echo "\"$filename\" is more than $max_size bytes with size $filesize"
    echo "Testing bundling with rollup-ts ended with error"
    # clean up
    rm $tswebextension
    exit 1
else
   echo "$filename is less than or equal to $max_size bytes with size $filesize"
fi

rm $tswebextension

echo "Testing bundling with rollup-ts ended successfully"
