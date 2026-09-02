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

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptRoot, '..');
const BRIDGED_PACKAGES = JSON.parse(
    fs.readFileSync(path.join(scriptRoot, 'bridged-packages.json'), 'utf8'),
);
const UNPUBLISH_SCRIPT = path.join(scriptRoot, 'ak-dev-unpublish.sh');
const LEASE_DAYS = 14;

const registry = process.env.AK_REGISTRY;
if (!registry) {
    fatal('AK_REGISTRY is empty — is the ARTIFACT_KEEPER_URL org variable set?');
}

const repo = process.env.GITHUB_REPOSITORY || 'AdGuardSoftwareLimited/ext-tsurlfilter';
const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com';
const ghToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

let failures = 0;
const fail = (message) => {
    console.error(`::error::${message}`);
    failures += 1;
};

// npm view for all versions of a package. Failures are classified (package
// absent = empty list; anything else = loud failure).
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
        if (/E404|404 not found/i.test(detail) && detail.includes(spec)) {
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

// Check the GitHub state of a PR. Returns 'open' | 'closed' | 'not-found' |
// 'error'. A PR that 404s from the API is one we can no longer query — treat
// it as closed so its builds get collected rather than leaking forever.
async function prState(prNumber) {
    if (stateOverride) {
        for (const entry of stateOverride.split(',')) {
            const [pr, state] = entry.split(':');
            if (pr === prNumber) {
                return state;
            }
        }
        return 'error';
    }
    if (!ghToken) {
        return 'error';
    }
    const url = `${apiBase}/repos/${repo}/pulls/${prNumber}`;
    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' },
        });
        if (response.status === 404) {
            return 'not-found';
        }
        if (!response.ok) {
            return 'error';
        }
        const body = await response.json();
        return body.state === 'open' ? 'open' : 'closed';
    } catch {
        return 'error';
    }
}

function deletePrVersions(pkg, prNumber) {
    // Deleting is best-effort per (package, PR); a failure must surface.
    try {
        execFileSync('bash', [UNPUBLISH_SCRIPT, `@adguard/${pkg}`, registry, `-dev.pr${prNumber}`], {
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
            if (state === 'open') {
                console.log(`PR #${pr} is open — keeping ${total} version(s)`);
                continue;
            }
            if (state === 'error') {
                fail(`could not check state of PR #${pr} — leaving its ${total} version(s) in place`);
                continue;
            }
            shouldDelete = true;
            console.log(`PR #${pr} is ${state} — deleting ${total} version(s)`);
        }
        if (shouldDelete) {
            for (const [pkg] of pkgMap) {
                deletePrVersions(pkg, pr);
            }
        }
    }

    if (failures > 0) {
        console.error(`::error::${failures} sweep error(s) — the AK registry may still hold orphaned dev builds`);
        process.exit(1);
    }
    console.log('dev-build sweep passed');
}

function fatal(message) {
    console.error(`::error::${message}`);
    process.exit(1);
}

main().catch((error) => {
    console.error(`::error::unexpected sweep failure: ${error.stack || error}`);
    process.exit(1);
});
