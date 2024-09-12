set -e
set -x

# Fix mixed logs
exec 2>&1

echo "@adguard/css-tokenizer tests starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "@adguard/css-tokenizer"; then
  echo "No changes in @adguard/css-tokenizer, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm install

# Check TypeScript types with TSC
pnpm --filter @adguard/css-tokenizer check-types

# ESLint & Markdownlint
pnpm --filter @adguard/css-tokenizer lint

# Run tests with Jest
pnpm --filter @adguard/css-tokenizer test

echo "@adguard/css-tokenizer tests completed"
