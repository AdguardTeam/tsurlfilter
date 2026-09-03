#!/usr/bin/env node
/**
 * @file Check whether a GitHub pull request is open, gating every AK-facing
 * step of the DevEx bridge. Shared by the devex-bridge jobs (publish /
 * comment / cleanup) so the fetch flags and the state classification live in
 * one place and cannot drift. Only an explicit "open" proceeds; only
 * "closed"/"merged" skips; anything else (e.g. an empty string from a garbled
 * response) is an error, so a broken API response can never turn into a silent
 * green run.
 *
 * Invoked from GitHub Actions `run:` steps as
 * `node scripts/ci/check-pr-open.mjs ...` (setup-node provides the runtime;
 * the self-hosted runners also ship node for the inline `node -` steps).
 *
 * Usage: check-pr-open.mjs <pr-url> <gh-token> [<output-file>]
 *   <pr-url>       Full API URL of the pull request
 *                  (github.event.pull_request.url).
 *   <gh-token>     GitHub token with read access to the PR (github.token).
 *   <output-file>  File to append one gate line to (optional). Defaults to
 *                  ${GITHUB_OUTPUT}, so callers can key subsequent steps off
 *                  `steps.<id>.outputs.open` without passing an argument.
 *
 * Gate output (appended to the output file):
 *   open=true   the PR is open
 *   open=false  the PR is closed or merged
 *
 * Exit codes:
 *   0   the PR is open; the caller should proceed.
 *   10  the PR is closed or merged; the caller should skip gracefully.
 *   1   the PR state could not be determined (network/auth/API error, or an
 *       unrecognized state); the caller should fail loudly.
 *   2   usage error (missing argument); the caller's YAML is misconfigured.
 *
 * Callers must read the exit code immediately — `$?` directly after an `if`
 * compound is the status of the completed `if`, not of this script — then
 * branch on 0 / 10 / 1.
 *
 * Annotation policy: ::error:: / ::warning:: are written to STDOUT so GitHub
 * renders them as step annotations (workflow commands are parsed from stdout
 * only).
 */

import fs from 'node:fs';
import process from 'node:process';

const USAGE = 'Usage: check-pr-open.mjs <pr-url> <gh-token> [<output-file>]';

const usageError = () => {
    console.error(`::error::usage: ${USAGE}`);
    process.exit(2);
};

const [prUrl, ghToken, outputFile = process.env.GITHUB_OUTPUT || ''] = process.argv.slice(2);
if (!prUrl || !ghToken) {
    usageError();
}

let state;
try {
    const response = await fetch(prUrl, {
        headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: 'application/vnd.github+json',
        },
    });
    if (!response.ok) {
        console.error(`::error::Could not query PR state at ${prUrl} (HTTP ${response.status})`);
        process.exit(1);
    }
    state = (await response.json()).state;
} catch (error) {
    console.error(`::error::Could not query PR state at ${prUrl}: ${error?.message || error}`);
    process.exit(1);
}

// Emit the gate output BEFORE branching, so a caller that reads the step's
// outputs (and otherwise exits with the script's code) still sees it.
const emitGate = (open) => {
    if (outputFile) {
        fs.appendFileSync(outputFile, `open=${open}\n`);
    }
};

switch (state) {
    case 'open':
        emitGate(true);
        process.exit(0);
        break;
    case 'closed':
    case 'merged':
        emitGate(false);
        console.log(`::warning::PR at ${prUrl} is '${state}'; skipping AK step`);
        process.exit(10);
        break;
    default:
        console.error(`::error::Unexpected PR state '${state}' for ${prUrl} (expected open/closed/merged)`);
        process.exit(1);
        break;
}
