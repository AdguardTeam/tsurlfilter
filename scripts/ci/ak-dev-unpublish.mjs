#!/usr/bin/env node
/**
 * @file Unpublish every version of a package on the Artifact Keeper npm
 * registry whose version ends with `-dev.pr<N>` or carries `-dev.pr<N>.<...>`
 * (e.g. '-dev.pr42', '-dev.pr42.2f5d9548'). Shared by:
 *   - devex-bridge.yml  (purge the PR's older -dev.pr<N>* builds after a republish)
 *   - devex-bridge-cleanup.yml  (delete -dev.pr<N>* builds when the PR closes)
 *   - devex-bridge-sweep.mjs  (GC of closed PRs' -dev.pr<N>* builds)
 * so the registry error taxonomy (404 vs 405 vs other) and the per-PR suffix
 * matching live in ONE place and the workflows cannot drift again.
 *
 * Invoked from GitHub Actions `run:` steps with `node` (setup-node ensures a
 * runtime) — e.g. `node scripts/ci/ak-dev-unpublish.mjs ...`.
 *
 * Usage: ak-dev-unpublish.mjs <package> <registry> <suffix> [--tolerate-405] [--keep <version>]
 *   <suffix>         The version token to match. Matching is BOUNDED per PR:
 *                    a version matches when <suffix> is followed by
 *                    end-of-string (bare '-dev.pr42') or a dot (head-scoped
 *                    '-dev.pr42.<sha>'). '-dev.pr1' never matches '-dev.pr12'.
 *   --tolerate-405   When AK replies 405 (unpublish not allowed), treat it as
 *                    a warning and continue instead of failing. devex-bridge.yml
 *                    passes this (overwrite is best-effort); the cleanup twin
 *                    does NOT, because a broken cleanup must be noticed.
 *   --keep <ver>     Do not delete this exact version (e.g. the version we just
 *                    published). Repeatable.
 *
 * Exit codes:
 *   0  success (nothing to do counts as success)
 *   1  a query or unpublish failed and was not classified as benign
 *   2  usage error (unknown argument / missing positional); the caller's YAML
 *      is misconfigured
 *
 * A query is only treated as "package absent" when the error unambiguously
 * names the package AND is a 404/not-found. A wildcard 404, a wrong registry
 * base, or a proxy error page must NOT look like "nothing to do" — the jobs
 * that call this are single-fire (cleanup especially), so a green run that
 * deletes nothing must not be possible.
 *
 * Annotation policy: ::error:: / ::warning:: are written to STDOUT so GitHub
 * renders them as step annotations (workflow commands are parsed from stdout
 * only).
 */

import { execFileSync } from 'node:child_process';
import process from 'node:process';

const USAGE = 'Usage: ak-dev-unpublish.mjs <package> <registry> <suffix> [--tolerate-405] [--keep <version>]';

const fail = (message) => {
    console.error(`::error::${message}`);
    process.exit(1);
};

// --- argument parsing -------------------------------------------------------
const positional = process.argv.slice(2);
const [pkg, registry, suffix, ...rest] = positional;
if (!pkg || !registry || !suffix) {
    console.error(`::error::usage: ${USAGE}`);
    process.exit(2);
}
let tolerate405 = false;
const keep = new Set();
for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--tolerate-405') {
        tolerate405 = true;
    } else if (arg === '--keep') {
        const value = rest[i + 1];
        if (value === undefined || value.startsWith('--')) {
            console.error(`::error::usage: ${USAGE}`);
            process.exit(2);
        }
        keep.add(value);
        i += 1;
    } else {
        console.error(`::error::ak-dev-unpublish.mjs: unknown argument '${arg}'`);
        process.exit(2);
    }
}

// npm() — run npm, returning { ok, out } (out is stdout on success, or the
// merged error text on failure).
const npm = (npmArgs) => {
    try {
        return { ok: true, out: execFileSync('npm', npmArgs, { encoding: 'utf8' }).trim() };
    } catch (error) {
        const detail = (error.stderr?.toString?.() || error.stdout?.toString?.() || error.message || '').trim();
        return { ok: false, out: detail };
    }
};

// --- query current versions ------------------------------------------------
const query = npm(['view', pkg, 'versions', '--json', `--registry=${registry}`, '--silent']);
if (!query.ok) {
    // Only "package absent" when the error unambiguously names the package AND
    // is a 404/not-found. A wildcard/registry-path 404 or proxy page must fail
    // loudly — a green run that deletes nothing must not be possible.
    if (/E404|404 not found|not found/i.test(query.out) && query.out.includes(pkg)) {
        console.log(`${pkg}: not present on AK — nothing to unpublish`);
        process.exit(0);
    }
    console.error(`::error::Could not query ${pkg} on AK:`);
    console.error(query.out);
    process.exit(1);
}

let versions;
try {
    const parsed = JSON.parse(query.out);
    versions = Array.isArray(parsed) ? parsed : [parsed];
} catch {
    console.error(`::error::npm view for ${pkg} returned non-JSON (registry misbehaving?):`);
    console.error(query.out);
    process.exit(1);
}

// Bounded per-PR match: keeps '-dev.pr1' away from '-dev.pr12', while matching
// both bare '-dev.pr42' and head-scoped '-dev.pr42.<sha>'. The --keep versions
// are kept out of the delete set.
const belongsToPr = (version) => version.endsWith(suffix) || version.includes(`${suffix}.`);
const toDelete = versions
    .filter((version) => typeof version === 'string' && belongsToPr(version) && !keep.has(version))
    .sort();

if (toDelete.length === 0) {
    console.log(`${pkg}: no previous -dev builds for this suffix on AK`);
    process.exit(0);
}

// --- unpublish --------------------------------------------------------------
let failures = 0;
for (const version of toDelete) {
    console.log(`Unpublishing ${pkg}@${version}`);
    const result = npm(['unpublish', `${pkg}@${version}`, '--force', `--registry=${registry}`]);
    if (result.ok) {
        continue;
    }
    const out = result.out;
    if (/E404|404 not found|not found|EUNPUBLISH/i.test(out) && out.includes(pkg)) {
        console.log(`${pkg}@${version}: already absent — nothing to unpublish`);
        continue;
    }
    if (/\bE405\b|405 Method Not Allowed|405 not allowed/i.test(out)) {
        if (tolerate405) {
            console.log(`${pkg}@${version}: AK does not allow unpublish (405; tolerated)`);
            continue;
        }
        console.error(`::error::${pkg}@${version}: AK refuses to unpublish (405):`);
        console.error(out);
        failures += 1;
        continue;
    }
    console.error(`::error::${pkg}@${version}: npm unpublish failed:`);
    console.error(out);
    failures += 1;
}

if (failures > 0) {
    console.error(`::error::${failures} previous version(s) could not be unpublished — AK may still hold stale builds`);
    process.exit(1);
}
console.log(`${pkg}: done`);
