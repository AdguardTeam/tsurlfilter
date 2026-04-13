# The current branch of the repository.
branch="${bamboo_planRepository_branchName}"

# The target branch for PRs, defaults to 'master' if not set.
target_branch="${bamboo_repository_pr_targetBranch:-master}"

# Checks if any files outside the 'packages/' or 'bamboo-specs/' directories have
# changed between the current branch and the target branch. Changes inside
# bamboo-specs/ are CI-infrastructure changes and do not affect package tests.
is_root_affected() {
  git diff --name-only "${target_branch}"...HEAD | grep -vE '^packages/|^bamboo-specs/' > /dev/null
}

# Checks if the specified project or any of its transitive @adguard/* workspace
# dependencies have changed between the current branch and the target branch.
# Reads package.json files directly — no Node.js or pnpm needed.
# Parameters:
#   - project_name: The npm package name to check, e.g. @adguard/tswebextension
is_project_affected() {
  local queue="$1" visited=""

  while [ -n "$queue" ]; do
    local name="${queue%%,*}"
    queue="${queue#"$name"}"; queue="${queue#,}"

    case ",$visited," in *",$name,"*) continue ;; esac
    visited="$visited,$name"

    local pkg_json
    pkg_json=$(grep -rlF "\"name\": \"$name\"" packages/ --include='package.json' 2>/dev/null | head -1)
    [ -z "$pkg_json" ] && continue

    git diff --quiet "${target_branch}...HEAD" -- "${pkg_json%/package.json}" || return 0

    deps=$(grep -oE '"@adguard/[^"]+": "workspace' "$pkg_json" | grep -oE '@adguard/[^"]+')
    for dep in $deps; do
      queue="${queue:+$queue,}$dep"
    done
  done

  return 1
}

# Writes a minimal JUnit XML report so that the Bamboo JUnit Parser succeeds
# even when tests are skipped. Only needed for jobs that have a JUnit parser task.
# Parameters:
#   - xml_file: Path to the XML report file to create (e.g. output/tests-reports/css-tokenizer.xml).
skip_tests() {
  local xml_file="${1:-}"
  if [ -n "$xml_file" ]; then
    mkdir -p "$(dirname "$xml_file")"
    cp "./bamboo-specs/scripts/skipped-tests.xml" "$xml_file"
  fi
}
