# Redirect stderr (2) to stdout (1) to capture all output in a single log
exec 2>&1

ls -alt

# Set cache directory
pnpm config set store-dir "$bamboo_cachePnpm"
