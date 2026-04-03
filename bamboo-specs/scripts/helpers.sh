# The current branch of the repository.
branch="${bamboo_planRepository_branchName}"

# The target branch for PRs, defaults to 'master' if not set.
target_branch="${bamboo_repository_pr_targetBranch:-master}"

# Checks if any files outside the 'packages/' directory have changed
# between the current branch and the target branch.
is_root_affected() {
  git diff --name-only "${target_branch}"...HEAD | grep -v '^packages/' > /dev/null
}

# Checks if the specified project has been affected by changes
# between the current branch and the target branch.
# Parameters:
#   - project_name: The name of the project to check.
is_project_affected() {
  local project_name="$1"

  pnpm list --filter "...[${target_branch}]" --depth=-1 | grep -q "${project_name}"
}

# Creates a minimal JUnit XML report and exit-code file so that the Bamboo
# JUnit parser and exit-code checker succeed even when tests are skipped.
# Parameters:
#   - xml_file: Path to the XML report file to create (e.g. output/tests-reports/css-tokenizer.xml).
#               Omit this argument when the job has no JUnit parser task.
skip_tests() {
  local xml_file="${1:-}"
  if [ -n "$xml_file" ]; then
    mkdir -p "$(dirname "$xml_file")"
    cp "$(dirname "${BASH_SOURCE[0]}")/skipped-tests.xml" "$xml_file"
  fi
}
