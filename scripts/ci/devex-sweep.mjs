#!/usr/bin/env node
/**
 * @file Periodic garbage collection for Artifact Keeper dev builds published by
 * the DevEx bridge.
 *
 * The close-triggered cleanup (devex-bridge-cleanup.yml) fires exactly once per
 * PR; it can miss versions when the `closed` delivery is malformed, the run
 * fails, or a publish lands after the close event (the event never fires
 * again). This sweep enumerates every `-dev.pr<N>` (and `-dev.pr<N>.<sha>`)
 * version on AK for the bridged packages, checks whether the owning PR is
 * still open, and deletes the builds whose PR is closed — an idempotent GC
 * that converges even when individual close events were missed or failed.
 *
 * It also serves as the state-aware recovery path: pass PR_NUMBER to restrict
 * the sweep to one PR (its builds are then deleted regardless of GitHub state,
 * matching a manual "delete PR N" request from the cleanup alert).
 *
 * A PR that 404s from the API (or returns an unrecognized state) is almost
 * always a misconfiguration — closed/merged PRs stay API-visible forever — so
 * the sweep treats it as 'error': keep the builds in place and fail loudly,
 * matching check-pr-open.mjs's refusal to classify anything it does not
 * recognize.
 *
 * Env:
 *   AK_REGISTRY      - registry base the workflows derive from ARTIFACT_KEEPER_URL
 *   NODE_AUTH_TOKEN  - AK npm token (auth for npm view / unpublish)
 *   GH_TOKEN         - GitHub token for PR state checks (GITHUB_TOKEN is fine)
 *   GITHUB_REPOSITORY, GITHUB_API_URL
 *   PR_NUMBER        - optional; only sweep this one PR
 *
 * Exit codes: 0 all good; 1 something had to be deleted and failed, or a query
 * failed — must be visible so the scheduled GC is not silently broken.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { fail as fatal, isPackageAbsent } from './std-errors.mjs';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const BRIDGED_PACKAGES = JSON.parse(
    fs.readFileSync(path.join(scriptRoot, 'bridged-packages.json'), 'utf8'),
);
const UNPUBLISH_SCRIPT = path.join(scriptRoot, 'ak-dev-unpublish.mjs');

// The GitHub PR states the sweep distinguishes. Centralized constants (an
// "enum") keep the string literals in ONE place, so prState() and main()
// cannot drift apart (per review).
const PR_STATE = Object.freeze({
    OPEN: 'open',
    CLOSED: 'closed',
    ERROR: 'error',
});

const registry = process.env.AK_REGISTRY;
// When ARTIFACT_KEEPER_URL is unset, the workflow-level `${{ vars... }}`
// resolves to an EMPTY string and AK_REGISTRY becomes '/npm/npm-internal' —
// truthy but useless. Validate it is an actual http(s) URL so the operator
// gets this message, not a cryptic npm error against a relative path.
if (!registry || !/^https?:\/\//.test(registry)) {
    fatal(`AK_REGISTRY ('${registry || '<unset>'}') is not an http(s) URL — is the ARTIFACT_KEEPER_URL org variable set?`);
}

const repo = process.env.GITHUB_REPOSITORY || 'AdGuardSoftwareLimited/ext-tsurlfilter';
const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com';
const ghToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

let failures = 0;
const fail = (message) => {
    console.error(`::error::${message}`);
    failures += 1;
};

/**
 * List every version of a package on AK via `npm view`.
 *
 * Failures are classified: a package absent on the registry (an E404 whose
 * text names the package) returns an empty list; any other failure is logged
 * loudly and returns `null`, so a green sweep can never be produced by a
 * misbehaving registry.
 *
 * @param {string} pkg Bridged package name (unscoped); queried as `@adguard/<pkg>`.
 * @returns {string[] | null} The published versions, `[]` when absent, or
 *   `null` after logging a query/parse failure.
 */
function listVersions(pkg) {
    const spec = `@adguard/${pkg}`;
    let raw;
    try {
        raw = execFileSync('npm', ['view', spec, 'versions', '--json', `--registry=${registry}`, '--silent'], {
            encoding: 'utf8',
        }).trim();
    } catch (error) {
        const detail = (error.stderr?.toString?.() || error.stdout?.toString?.() || error.message || '').trim();
        // Package absent (E404 naming the package) -> no versions, not a failure.
        // Shared classification from std-errors.mjs so the sweep cannot drift
        // from ak-dev-unpublish.mjs (a plain 'not found' word is package-absent
        // in both).
        if (isPackageAbsent(detail, spec)) {
            return [];
        }
        fail(`could not query ${spec} on AK (${registry}): ${detail || String(error)}`);
        return null;
    }
    if (raw === '') {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        fail(`npm view ${spec} returned non-JSON (registry misbehaving?): ${raw}`);
        return null;
    }
}

// Overridable in tests: 'PR:7:closed,PR:9:open' simulates GitHub PR states
// without network access. An unlisted PR in override mode simulates a query
// failure so the "leaving in place" path is exercised too.
const stateOverride = (process.env.SWEEP_PR_STATES || '').trim();

/**
 * Check the GitHub state of a PR.
 *
 * Strict by design: only the literal `open` keeps the builds, only `closed` /
 * `merged` authorizes deletion. A garbled `state` field on a 200, a 404 (which
 * almost always means misconfiguration — closed/merged PRs stay API-visible
 * forever), an auth failure, or a hung/errored fetch all return 'error' so the
 * destructively-deleting consumer keeps the builds and fails loudly instead of
 * guessing.
 *
 * @param {string} prNumber PR number to query.
 * @returns {Promise<PR_STATE>} The observed state; 'error' when the state is
 *   unknown, a 404, a failure, or the override mode does not list the PR.
 */
async function prState(prNumber) {
    if (stateOverride) {
        for (const entry of stateOverride.split(',')) {
            const [pr, state] = entry.split(':');
            if (pr === prNumber) {
                return state;
            }
        }
        return PR_STATE.ERROR;
    }
    if (!ghToken) {
        return PR_STATE.ERROR;
    }
    const url = `${apiBase}/repos/${repo}/pulls/${prNumber}`;
    try {
        // A bounded fetch (30s) keeps a hung GitHub API call from burning the
        // shared 30-minute budget — these calls run sequentially, so even a
        // couple of hangs would kill the GC mid-pass.
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' },
            signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
            return PR_STATE.ERROR;
        }
        const body = await response.json();
        if (body.state === PR_STATE.OPEN) {
            return PR_STATE.OPEN;
        }
        if (body.state === 'closed' || body.state === 'merged') {
            return PR_STATE.CLOSED;
        }
        return PR_STATE.ERROR;
    } catch {
        return PR_STATE.ERROR;
    }
}

/**
 * Delete the `-dev.pr<N>` builds of one package for one PR by invoking the
 * shared unpublish script. The exact versions were already enumerated by
 * `main()` and are passed as `--versions`, so the shared script skips its own
 * `npm view` — without this every delete would re-query the registry once per
 * package (six extra round-trips per closed PR). Deleting is best-effort per
 * (package, PR), so a failure must surface rather than be swallowed.
 *
 * @param {string} pkg Bridged package name (unscoped).
 * @param {string} prNumber PR whose builds to delete.
 * @param {string[]} versions The exact `-dev.pr<N>*` versions to remove.
 * @returns {boolean} `true` on success, `false` after logging the failure.
 */
function deletePrVersions(pkg, prNumber, versions) {
    const args = [UNPUBLISH_SCRIPT, `@adguard/${pkg}`, registry, `-dev.pr${prNumber}`];
    if (versions.length > 0) {
        args.push('--versions', versions.join(','));
    }
    try {
        execFileSync('node', args, {
            stdio: ['ignore', 'inherit', 'inherit'],
        });
        return true;
    } catch {
        fail(`deleting -dev.pr${prNumber} builds of @adguard/${pkg} failed — see output above`);
        return false;
    }
}

async function main() {
    const onlyPr = process.env.PR_NUMBER || '';
    if (onlyPr && !/^\d+$/.test(onlyPr)) {
        fatal(`PR_NUMBER must be a positive integer, got '${onlyPr}'`);
    }

    // Collect (pkg -> versions) for all bridged packages.
    const perPr = new Map(); // pr string -> Map(pkg -> [versions])
    for (const pkg of BRIDGED_PACKAGES) {
        const versions = listVersions(pkg);
        if (versions === null) {
            continue; // fatal already logged
        }
        const leftover = versions.filter((v) => {
            const match = typeof v === 'string' ? v.match(/-dev\.pr(\d+)/) : null;
            return match && (onlyPr === '' || match[1] === onlyPr);
        });
        for (const version of leftover) {
            const pr = version.match(/-dev\.pr(\d+)/)[1];
            if (!perPr.has(pr)) {
                perPr.set(pr, new Map());
            }
            const pkgMap = perPr.get(pr);
            if (!pkgMap.has(pkg)) {
                pkgMap.set(pkg, []);
            }
            pkgMap.get(pkg).push(version);
        }
    }

    if (perPr.size === 0) {
        console.log(`no -dev.pr builds found on AK for the bridged packages${onlyPr ? ` (PR #${onlyPr})` : ''} — nothing to do`);
        return;
    }

    // With an explicit PR_NUMBER we delete blindly (targeted recovery). In the
    // full sweep we only delete builds whose PR is no longer open.
    for (const [pr, pkgMap] of perPr) {
        const total = [...pkgMap.values()].reduce((sum, versions) => sum + versions.length, 0);
        let shouldDelete;
        if (onlyPr !== '') {
            shouldDelete = true;
            console.log(`targeted sweep: deleting ${total} version(s) for PR #${pr}`);
        } else {
            const state = await prState(pr);
            if (state === PR_STATE.OPEN) {
                console.log(`PR #${pr} is open — keeping ${total} version(s)`);
                continue;
            }
            if (state === PR_STATE.ERROR) {
                fail(`could not check state of PR #${pr} — leaving its ${total} version(s) in place`);
                continue;
            }
            shouldDelete = true;
            console.log(`PR #${pr} is ${state} — deleting ${total} version(s)`);
        }
        if (shouldDelete) {
            for (const [pkg, versions] of pkgMap) {
                deletePrVersions(pkg, pr, versions);
            }
        }
    }

    if (failures > 0) {
        console.error(`::error::${failures} sweep error(s) — the AK registry may still hold orphaned dev builds`);
        process.exit(1);
    }
    console.log('dev-build sweep passed');
}

main().catch((error) => {
    console.error(`::error::unexpected sweep failure: ${error.stack || error}`);
    process.exit(1);
});
