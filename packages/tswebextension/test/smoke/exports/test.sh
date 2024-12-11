#!/bin/bash

# Exit on error, fail on unset variables, and fail on any command in a pipeline
set -euo pipefail

# This script builds the @adguard/tswebextension package, packs it, installs
# it in a test environment, and runs smoke tests (via `pnpm start`).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/../../.."
PACKAGE_TGZ="$SCRIPT_DIR/tswebextension.tgz"
TSWEBEXTENSION_INSTALL_DIR="$SCRIPT_DIR/node_modules/@adguard/tswebextension"

cleanup() {
    echo "Performing cleanup..."
    rm -f "${PACKAGE_TGZ}"
    rm -rf "${SCRIPT_DIR:?}/node_modules"
    echo "Cleanup complete"
}

trap cleanup EXIT

# Move to script directory
cd "$SCRIPT_DIR"

# Build and pack the package within the monorepo root directory
(
    cd "$ROOT_DIR"
    npx lerna run build --scope @adguard/tswebextension --include-dependencies
    pnpm pack
    mv adguard-tswebextension-*.tgz "$PACKAGE_TGZ"
)

# Install dependencies for the smoke test environment
pnpm install

# Extract the packaged @adguard/tswebextension into node_modules
mkdir -p "$TSWEBEXTENSION_INSTALL_DIR"
tar -xzf "$PACKAGE_TGZ" --strip-components=1 -C "$TSWEBEXTENSION_INSTALL_DIR"

# Run the start command (expected to run smoke tests)
pnpm start
