source ./setup-tests.sh

echo "tswebextension-mv3 tests starting"

# import helper functions and some common variables
. ./bamboo-specs/scripts/helpers.sh

if [ "$branch" != "master" ] && ! is_root_affected && ! is_project_affected "tswebextension-mv3"; then
  echo "No changes in tswebextension-mv3, skipping tests"
  exit 0;
fi

# Install dependencies
pnpm install

# First build since we need dependencies
npx lerna run build --scope tswebextension-mv3 --include-dependencies

# Lint
pnpm --filter tswebextension-mv3 lint

# TODO
## Test
## Should be run after build, since test requires build
#pnpm --filter tswebextension-mv3 test

# TODO add artifacts for testing
#  artifacts:
#    - name: extension.zip
#      location: packages/examples/adguard-api/build
#      pattern: extension.zip
#      shared: true
#      required: false

echo "tswebextension-mv3 tests completed"
