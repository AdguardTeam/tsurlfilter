#!/bin/bash

# Cleanup script that preserves specified artifacts
# Usage: ./cleanup.sh "artifact1,artifact2,artifact3"

set -e
set -x

# Fix mixed logs
exec 2>&1

echo "Size before cleanup:" && du -h | tail -n 1
echo "Top 5 files:" && du -h | sort -hr | head -n 5

# Parse artifacts from command line argument
ARTIFACTS_ARG="${1:-}"
if [ -z "$ARTIFACTS_ARG" ]; then
    echo "No artifacts specified, cleaning entire workspace"
    ARTIFACTS=""
else
    # Convert comma-separated string to space-separated
    ARTIFACTS=$(echo "$ARTIFACTS_ARG" | tr ',' ' ')
    echo "Preserving artifacts: $ARTIFACTS"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Stash artifacts to /tmp
for f in $ARTIFACTS; do
  [ -e "$f" ] || continue
  echo "Stashing artifact: $f"
  mkdir -p "$TMP/$(dirname "$f")"
  mv "$f" "$TMP/$f"
done

# Clean entire workspace (including dotfiles and .git)
find . -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +

# Restore artifacts
for f in $ARTIFACTS; do
  [ -e "$TMP/$f" ] || continue
  echo "Restoring artifact: $f"
  mkdir -p "$(dirname "$f")"
  mv "$TMP/$f" "$f"
done

echo "Size after cleanup:" && du -h | tail -n 1
echo "Top 5 files:" && du -h | sort -hr | head -n 5

echo "Cleanup completed successfully"
