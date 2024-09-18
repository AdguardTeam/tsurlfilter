source ./setup-tests.sh

echo "@adguard/logger tests starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "@adguard/logger"; then
  echo "No changes in @adguard/logger, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm install

# Build the package
npx lerna run build --scope @adguard/logger --include-dependencies

# Lint code
pnpm --filter @adguard/logger lint

# Run tests
pnpm --filter @adguard/logger test

# Run smoke tests
pnpm --filter @adguard/logger test:smoke

echo "@adguard/logger tests completed"
