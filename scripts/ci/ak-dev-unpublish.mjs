#!/usr/bin/env node
/**
 * @file Unpublish every version of a package on the Artifact Keeper npm
 * registry whose version ends with `-dev.pr<N>` or carries `-dev.pr<N>.<...>`
 * (e.g. '-dev.pr42', '-dev.pr42.2f5d9548').
 *
 * Why this exists: the DevEx bridge (AG-54910) publishes a fresh
 * `-dev.pr<N>.<sha>` build of each bridged package to the internal Artifact
 * Keeper registry on every PR push. Those builds are throwaway by design — they
 * exist only so a consumer checkout can test unmerged work, each push
 * supersedes the previous head, and once the owning PR closes they must be
 * gone. Without cleanup the registry accumulates orphaned dev versions forever
 * and a `-dev.pr<N>*` pin can silently resolve to a stale build. Cleanup is
 * therefore not a one-off but a routine shared by three flows (republish purge,
 * close cleanup, scheduled GC), so the error taxonomy — "already absent" (404),
 * "AK refuses to unpublish" (405), real failure — must be classified the same
 * way in all of them. This module is that single source of truth.
 *
 * Shared by:
 *   - devex-bridge.yml  (purge the PR's older -dev.pr<N>* builds after a republish)
 *   - devex-bridge-cleanup.yml  (delete -dev.pr<N>* builds when the PR closes)
 *   - scripts/ci/devex-sweep.mjs  (GC of closed PRs' -dev.pr<N>* builds,
 *     driven by devex-bridge-sweep.yml)
 * so the registry error taxonomy (404 vs 405 vs other) and the per-PR suffix
 * matching live in ONE place and the workflows cannot drift again.
 *
 * Invoked from GitHub Actions `run:` steps with `node` (setup-node ensures a
 * runtime) — e.g. `node scripts/ci/ak-dev-unpublish.mjs ...`.
 *
 * Usage: ak-dev-unpublish.mjs <package> <registry> <suffix> [--tolerate-405] [--keep <version>] [--versions <v1,v2,...>]
 *   <suffix>         The version token to match. Matching is BOUNDED per PR:
 *                    a version matches when <suffix> is followed by
 *                    end-of-string (bare '-dev.pr42') or a dot (head-scoped
 *                    '-dev.pr42.<sha>'). '-dev.pr1' never matches '-dev.pr12'.
 *   --tolerate-405   When AK replies 405 (unpublish not allowed), treat it as
 *                    a warning and continue instead of failing. devex-bridge.yml
 *                    passes this for the stale-version purge — with AK's
 *                    immutability the purge is best-effort; the cleanup twin
 *                    does NOT, because a broken cleanup must be noticed.
 *   --keep <ver>     Do not delete this exact version (e.g. the version we just
 *                    published). Repeatable.
 *   --versions <csv> Skip the initial `npm view` and unpublish exactly these
 *                    versions (comma-separated). Used by devex-sweep.mjs, which
 *                    already enumerated the versions — this avoids re-querying
 *                    the registry once per package per PR.
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
 * deletes nothing must not be possible. The classification is shared with the
 * sweep via `isPackageAbsent` in std-errors.mjs.
 *
 * Annotation policy: ::error:: / ::warning:: are written to stderr via
 * console.error/warn; GitHub renders step annotations from either stream, so
 * this matches std-errors.mjs (::error:: to stderr).
 */

import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { fail, isPackageAbsent, usageError } from './std-errors.mjs';

const USAGE = 'Usage: ak-dev-unpublish.mjs <package> <registry> <suffix> [--tolerate-405] [--keep <version>] [--versions <v1,v2,...>]';

// --- argument parsing -------------------------------------------------------
const positional = process.argv.slice(2);
const [pkg, registry, suffix, ...rest] = positional;
if (!pkg || !registry || !suffix) {
    usageError(USAGE);
}
let tolerate405 = false;
let explicitVersions = null;
const keep = new Set();
for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--tolerate-405') {
        tolerate405 = true;
    } else if (arg === '--keep') {
        const value = rest[i + 1];
        if (value === undefined || value.startsWith('--')) {
            usageError(USAGE);
        }
        keep.add(value);
        i += 1;
    } else if (arg === '--versions') {
        const value = rest[i + 1];
        if (value === undefined || value === '' || value.startsWith('--')) {
            usageError(USAGE);
        }
        explicitVersions = value.split(',').filter(Boolean);
        i += 1;
    } else {
        fail(`ak-dev-unpublish.mjs: unknown argument '${arg}'`, 2);
    }
}

/**
 * Run an `npm` CLI command without throwing, so failures can be classified.
 *
 * @param {string[]} npmArgs CLI arguments to pass to `npm`.
 * @returns {{ ok: boolean, out: string }} `{ ok: true, out }` with `out` set to
 *   the trimmed stdout on success, or `{ ok: false, out }` with `out` set to the
 *   merged error text (stderr, else stdout, else message) on failure.
 */
const npm = (npmArgs) => {
    try {
        return { ok: true, out: execFileSync('npm', npmArgs, { encoding: 'utf8' }).trim() };
    } catch (error) {
        const detail = (error.stderr?.toString?.() || error.stdout?.toString?.() || error.message || '').trim();
        return { ok: false, out: detail };
    }
};

// --- query current versions ------------------------------------------------
// With `--versions` the caller (devex-sweep.mjs) already enumerated the exact
// versions to delete, so skip the npm view round-trip entirely.
if (explicitVersions !== null) {
    if (explicitVersions.length === 0) {
        console.log(`${pkg}: no explicit versions to delete`);
        process.exit(0);
    }
} else {
    const query = npm(['view', pkg, 'versions', '--json', `--registry=${registry}`, '--silent']);
    if (!query.ok) {
        // Only "package absent" when the error unambiguously names the package AND
        // is a 404/not-found. A wildcard/registry-path 404 or proxy page must fail
        // loudly — a green run that deletes nothing must not be possible.
        if (isPackageAbsent(query.out, pkg)) {
            console.log(`${pkg}: not present on AK — nothing to unpublish`);
            process.exit(0);
        }
        console.error(`::error::Could not query ${pkg} on AK:`);
        console.error(query.out);
        process.exit(1);
    }
    let parsed;
    try {
        parsed = JSON.parse(query.out);
    } catch {
        console.error(`::error::npm view for ${pkg} returned non-JSON (registry misbehaving?):`);
        console.error(query.out);
        process.exit(1);
    }
    explicitVersions = Array.isArray(parsed) ? parsed : [parsed];
    if (explicitVersions.length === 0) {
        console.log(`${pkg}: no versions on AK`);
        process.exit(0);
    }
}

// Bounded per-PR match: keeps '-dev.pr1' away from '-dev.pr12', while matching
// both bare '-dev.pr42' and head-scoped '-dev.pr42.<sha>'. The --keep versions
// are kept out of the delete set.
const belongsToPr = (version) => version.endsWith(suffix) || version.includes(`${suffix}.`);
const toDelete = explicitVersions
    .filter((version) => typeof version === 'string' && belongsToPr(version) && !keep.has(version))
    .sort();

if (toDelete.length === 0) {
    console.log(`${pkg}: no previous -dev builds for this suffix on AK`);
    process.exit(0);
}

// --- unpublish --------------------------------------------------------------
let failures = 0;
let tolerated405 = 0;
for (const version of toDelete) {
    console.log(`Unpublishing ${pkg}@${version}`);
    const result = npm(['unpublish', `${pkg}@${version}`, '--force', `--registry=${registry}`]);
    if (result.ok) {
        continue;
    }
    const out = result.out;
    if (/EUNPUBLISH/i.test(out) || isPackageAbsent(out, pkg)) {
        console.log(`${pkg}@${version}: already absent — nothing to unpublish`);
        continue;
    }
    if (/\bE405\b|405 Method Not Allowed|405 not allowed/i.test(out)) {
        if (tolerate405) {
            console.log(`${pkg}@${version}: AK does not allow unpublish (405; tolerated)`);
            tolerated405 += 1;
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

// On a registry that always answers 405 (AK behaves this way today) every
// stale-version purge is K-1 known-futile calls per package per push. Surface
// the staleness so an operator can decide whether to enable AK unpublish.
if (tolerated405 > 0) {
    console.warn(`::warning::${pkg}: AK refused ${tolerated405} stale unpublish(es) with 405 — stale -dev.pr builds are NOT being removed; they accumulate until cleanup can delete them`);
}

if (failures > 0) {
    console.error(`::error::${failures} previous version(s) could not be unpublished — AK may still hold stale builds`);
    process.exit(1);
}
console.log(`${pkg}: done`);
