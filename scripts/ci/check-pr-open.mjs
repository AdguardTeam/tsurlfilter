#!/usr/bin/env node
/**
 * @file Check whether a GitHub pull request is open, gating every AK-facing
 * step of the DevEx bridge. The actual consumers are the devex-bridge jobs
 * publish / unpublish / comment — the cleanup workflow has its own preflight
 * and never calls this — so the fetch flags and the state
 * classification live in one place and cannot drift. Only an explicit "open"
 * proceeds; only "closed"/"merged" skips; anything else (e.g. an empty string
 * from a garbled response) is an error, so a broken API response can never
 * turn into a silent green run.
 *
 * Invoked from GitHub Actions `run:` steps as
 * `node scripts/ci/check-pr-open.mjs <pr-url>` (setup-node provides the
 * runtime; the self-hosted runners also ship node for the inline `node -`
 * steps). The token is read from the ${GH_TOKEN} environment variable (set on
 * the step), never passed as an argument, so it cannot show up in the shared
 * runner's process table while the call is in flight.
 *
 * Usage: check-pr-open.mjs <pr-url> [<gh-token>] [<output-file>]
 *   <pr-url>       Full API URL of the pull request
 *                  (github.event.pull_request.url).
 *   <gh-token>     GitHub token with read access to the PR (optional; defaults
 *                  to ${GH_TOKEN} env). Avoid passing it as a CLI argument in
 *                  workflows — set GH_TOKEN on the step instead.
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
 * branch on 0 / 10 / 1. The wrappers in devex-bridge.yml are centralised in
 * the .github/actions/check-pr-open composite action so this contract is
 * consumed in exactly one place.
 *
 * Annotation policy: the ::warning:: below is written to STDOUT, where GitHub
 * renders step annotations from (workflow commands are parsed from stdout).
 * ::error:: is written to stderr by std-errors.mjs; the runner scans both
 * streams for annotations.
 *
 * The API fetch is bounded with AbortSignal.timeout(30s): without it a hung
 * connection would ride undici's ~300s default, burning half a publish leg's
 * budget (this gate runs ~14 times per push).
 */

import fs from 'node:fs';
import process from 'node:process';
import { fail, usageError } from './std-errors.mjs';

const USAGE = 'Usage: check-pr-open.mjs <pr-url> [<gh-token>] [<output-file>]';

const [prUrl, ghTokenArg, outputFile = process.env.GITHUB_OUTPUT || ''] = process.argv.slice(2);
const ghToken = ghTokenArg || process.env.GH_TOKEN;
if (!prUrl || !ghToken) {
    usageError(USAGE);
}

let state;
try {
    const response = await fetch(prUrl, {
        headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: 'application/vnd.github+json',
        },
        signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
        fail(`Could not query PR state at ${prUrl} (HTTP ${response.status})`);
    }
    state = (await response.json()).state;
} catch (error) {
    fail(`Could not query PR state at ${prUrl}: ${error?.message || error}`);
}

/**
 * Append the gate line to the output file (no-op when no output file is set).
 *
 * It is invoked BEFORE branching on the exit code, so a caller that reads the
 * step's outputs (and otherwise exits with the script's code) still sees it.
 *
 * @param {boolean} open `true` writes `open=true`, `false` writes `open=false`.
 */
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
        fail(`Unexpected PR state '${state}' for ${prUrl} (expected open/closed/merged)`);
        break;
}
