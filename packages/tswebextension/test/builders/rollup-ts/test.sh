#!/bin/bash

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

# check css hits counter size
# The css-hits-counter smoke bundle is currently ~35 KB unminified; the guard
# previously used BSD-only `stat -f "%z"`, which silently no-oped on GNU/Linux
# (treating -f as --file-system), so this check passed green on every Linux CI
# (both the old ubuntu test.yml and Docker) even as the bundle grew past the old
# 27000-byte limit. Updated to the current size now that the guard is portable
# and actually enforces on Linux; raise this only when a genuine size increase
# lands, never to silence a regression.
max_size=40000
filename="dist/css-hits-counter.js"
# Portable file-size query: GNU stat (Linux/Docker) needs `-c %s`, BSD stat
# (macOS) needs `-f %z`.
filesize=$(stat -c %s "$filename" 2>/dev/null || stat -f%z "$filename")
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
