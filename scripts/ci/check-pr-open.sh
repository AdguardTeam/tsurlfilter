#!/usr/bin/env bash
# Usage: check-pr-open.sh <pr-url> <gh-token>
#   exit 0  - the PR is open; the caller should proceed.
#   exit 10 - the PR is closed or merged; the caller should skip gracefully.
#   exit 1  - the PR state could not be determined (network/auth/API error, or
#             an unrecognized state); the caller should fail loudly.
#
# Shared by the devex-bridge jobs (unpublish / publish / comment / cleanup) so
# the curl flags and the state classification live in one place and cannot
# drift. Only an explicit "open" proceeds; only "closed"/"merged" skips;
# anything else (e.g. an empty string from a garbled response) is an error, so
# a broken API response can never turn into a silent green run.
set -euo pipefail

pr_url="$1"
gh_token="$2"

state="$(
    curl -fsSL \
        -H "Authorization: Bearer ${gh_token}" \
        -H "Accept: application/vnd.github+json" \
        "${pr_url}" \
        | node -e "let d='';process.stdin.on('data',(c)=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).state||'')}catch{/* non-JSON response */}})"
)" || {
    echo "::error::Could not query PR state at ${pr_url}"
    exit 1
}

case "${state}" in
    open)
        exit 0
        ;;
    closed|merged)
        echo "::warning::PR at ${pr_url} is '${state}'; skipping AK step"
        exit 10
        ;;
    *)
        echo "::error::Unexpected PR state '${state}' for ${pr_url} (expected open/closed/merged)"
        exit 1
        ;;
esac
