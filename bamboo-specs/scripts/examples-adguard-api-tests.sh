echo "adguard-api-example tests starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "adguard-api-example"; then
  echo "No changes in adguard-api-example, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm install

# Build
npx lerna run build --scope adguard-api-example --include-dependencies

# Lint
pnpm --filter adguard-api-example lint

echo "adguard-api-example tests completed"
