set -e
set -x

# Fix mixed logs
exec 2>&1

echo "adguard-api-mv3-example tests starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "adguard-api-mv3-example"; then
  echo "No changes in adguard-api-example, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm install

# Build
npx lerna run build --scope adguard-api-mv3-example --include-dependencies

# Lint
pnpm --filter adguard-api-example lint

echo "adguard-api-mv3-example tests completed"
