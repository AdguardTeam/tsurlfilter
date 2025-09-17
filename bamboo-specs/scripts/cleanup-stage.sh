#!/bin/bash

# Exit on error and print commands
set -ex

# Redirect stderr to stdout to capture all output in a single log
exec 2>&1

echo "Starting per-stage cleanup process..."
echo "Size before cleanup:" && du -h | tail -n 1

# Check if we should preserve artifacts
# Set to "true" if you want to skip cleaning certain build artifacts
PRESERVE_ARTIFACTS="${PRESERVE_ARTIFACTS:-false}"

# Log the top 30 largest directories/files for debugging
du -h . | sort -hr | head -n 30

# Define common build artifact directories to clean
BUILD_ARTIFACTS=("dist" "build")

# Clean with pnpm if node_modules exists
if [ -d "node_modules" ]; then
  echo "Running pnpm clean scripts in packages..."
  # Run clean scripts in each package (if they exist)
  pnpm -r clean || echo "Some packages may not have clean scripts, continuing..."

  echo "Removing node_modules..."
  # Remove node_modules
  pnpm clean || echo "Error during pnpm clean, attempting to continue..."
else
  echo "node_modules directory does not exist, skipping pnpm clean"
fi

# remove coverage directory always
if [ -d "coverage" ]; then
  echo "Removing coverage directory..."
  rm -rf coverage || echo "Error during coverage directory removal, attempting to continue..."
fi

# Clean up common build artifacts unless PRESERVE_ARTIFACTS is true
if [ "$PRESERVE_ARTIFACTS" != "true" ]; then
  echo "Cleaning build artifacts..."
  for artifact in "${BUILD_ARTIFACTS[@]}"; do
    find . -type d -name "$artifact" -exec echo "Removing {}" \; -exec rm -rf {} \; 2>/dev/null || true
  done

  # Clean up temporary files
  echo "Cleaning temporary files..."
  find . -name "*.tgz" -exec echo "Removing {}" \; -exec rm -f {} \; 2>/dev/null || true
  find . -name "*.log" -exec echo "Removing {}" \; -exec rm -f {} \; 2>/dev/null || true
  find . -name "*.tsbuildinfo" -exec echo "Removing {}" \; -exec rm -f {} \; 2>/dev/null || true
else
  echo "Preserving artifacts as PRESERVE_ARTIFACTS=$PRESERVE_ARTIFACTS"
fi

# Report final size
echo "Size after cleanup:" && du -h | tail -n 1
echo "Per-stage cleanup completed"
