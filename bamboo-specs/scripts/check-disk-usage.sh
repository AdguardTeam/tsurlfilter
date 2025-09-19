#!/bin/bash

# 'set' should be added to the beginning of each script to ensure that it runs with the correct options.
#  -e: Exit immediately if any command exits with a non-zero status (i.e., if a command fails).
#  -x: Print each command to the terminal as it is executed, which is useful for debugging.
set -ex

ls -alt

echo "Current size:" && du -h | tail -n 1

du -h . | sort -hr | head -n 30
