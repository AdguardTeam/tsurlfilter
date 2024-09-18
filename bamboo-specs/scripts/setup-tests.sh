# Fix mixed logs
exec 2>&1

ls -alt

# Set cache directory
pnpm config set store-dir "$bamboo_cachePnpm"
