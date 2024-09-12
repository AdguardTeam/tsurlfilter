set -e
set -x

# Fix mixed logs
exec 2>&1

echo "@adguard/agtree tests starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "@adguard/agtree"; then
  echo "No changes in @adguard/agtree, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm install

# Build dependencies before running tests
npx lerna run build --scope @adguard/agtree --include-dependencies

# Check TypeScript types with TSC
pnpm --filter @adguard/agtree check-types

# Check code with ESLint
pnpm --filter @adguard/agtree lint

# Run tests with Jest
pnpm --filter @adguard/agtree test

echo "@adguard/agtree tests completed"
