echo "@adguard/dnr-rulesets tests starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "@adguard/dnr-rulesets"; then
  echo "No changes in @adguard/dnr-rulesets, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm --filter @adguard/dnr-rulesets install

# Run linter
pnpm --filter @adguard/dnr-rulesets lint

# Run tests
pnpm --filter @adguard/dnr-rulesets test

echo "@adguard/dnr-rulesets tests completed"
