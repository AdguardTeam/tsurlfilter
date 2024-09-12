echo "@adguard/tswebextension tests starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "@adguard/tswebextension"; then
  echo "No changes in project @adguard/tswebextension, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm install

# build with dependencies, lerna is used for builds caching
npx lerna run build --scope @adguard/tswebextension --include-dependencies

# IMPORTANT: run lint after the build because linting requires types to be generated
pnpm --filter @adguard/tswebextension lint

# IMPORTANT: run tests after the build because smoke tests requires tswebextension to have built dist dir
pnpm --filter @adguard/tswebextension test:prod

# FIXME d.seregin move this task to the separate plan
#pnpm --filter @adguard/tsurlfilter docs:mv3

echo "@adguard/tswebextension tests completed"
