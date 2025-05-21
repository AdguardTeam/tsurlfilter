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

# Function to verify if a package.json script exists before running it
# Parameters:
#   - package: The package name
#   - script: The script name to check
verify_script_exists() {
  local package=$1
  local script=$2

  # Check if the script exists in package.json
  if ! pnpm --filter $package exec jq -e ".scripts.$script" package.json > /dev/null 2>&1; then
    echo "Error: Script '$script' does not exist in package '$package'"
    exit 1
  fi
}

# Function to run multiple commands in parallel for a package
# Parameters:
#   - package_name: The name of the package
#   - commands: Array of commands to run
# Usage example: run_commands_in_parallel "@adguard/css-tokenizer" "${COMMANDS[@]}"
run_commands_in_parallel() {
  local package_name=$1
  shift
  local commands=($@)

  echo "Running tests in parallel..."

  # Array to store process IDs
  local pids=()

  # Verify all scripts exist before running them
  for cmd in "${commands[@]}"; do
    verify_script_exists "$package_name" "$cmd"
  done

  # Run all commands in parallel
  for cmd in "${commands[@]}"; do
    echo "Running $cmd..."
    pnpm --filter "$package_name" $cmd &
    local pid=$!
    pids+=("$pid")
  done

  # Wait for all processes to complete
  echo "Waiting for all processes to complete..."
  wait "${pids[@]}"

  # Check if any of the commands failed
  if [ $? -ne 0 ]; then
    echo "One or more $package_name tests failed"
    return 1
  fi

  return 0
}
