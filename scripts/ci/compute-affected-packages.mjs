#!/usr/bin/env node
/**
 * @file Computes the CI test targets affected by the current change and writes
 * the resulting matrix to $GITHUB_OUTPUT as
 * `matrix={"include":[{"target":...}]}`.
 *
 * On pull requests, a package is affected when its own directory or any of its
 * transitive @adguard/* workspace dependencies changed. On any other event
 * (e.g. pushes to master) every target is tested.
 *
 * NOTE on a Lerna-based alternative (review thread #47): `lerna list --since
 * --include-dependents` yields the same changed-plus-dependents closure, but
 * it needs an installed workspace (lerna builds its project graph from
 * node_modules), and the self-hosted team-extensions runners have no pnpm on
 * PATH in this first, install-less job. The matcher is therefore kept
 * dependency-free (pure git + fs) so the job stays fast and never depends on a
 * registry fetch or a package-manager preinstall.
 *
 * Environment:
 *   BASE_REF     - PR base branch (github.base_ref); only used for PRs.
 *   EVENT_NAME   - github.event_name ('pull_request' or 'push').
 *   GITHUB_OUTPUT - step output file provided by the runner.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// All CI test targets and the npm package they belong to.
const targets = [
    { target: 'logger', npm: '@adguard/logger' },
    { target: 'css-tokenizer', npm: '@adguard/css-tokenizer' },
    { target: 'eslint-plugin-logger-context', npm: '@adguard/eslint-plugin-logger-context' },
    { target: 'agtree', npm: '@adguard/agtree' },
    { target: 'tsurlfilter', npm: '@adguard/tsurlfilter' },
    { target: 'dnr-converter', npm: '@adguard/dnr-converter' },
    { target: 'dnr-rulesets', npm: '@adguard/dnr-rulesets' },
    { target: 'tswebextension', npm: '@adguard/tswebextension' },
    { target: 'adguard-api', npm: '@adguard/api' },
    { target: 'adguard-api-mv3', npm: '@adguard/api-mv3' },
    { target: 'examples', npm: null },
];

// npm name -> package directory (covers packages/*, packages/examples/*, packages/benchmarks/*).
const dirByName = {};
const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const pj = path.join(dir, entry.name, 'package.json');
        if (fs.existsSync(pj)) {
            const name = JSON.parse(fs.readFileSync(pj, 'utf8')).name;
            if (name) dirByName[name] = path.join(dir, entry.name);
        }
    }
};
scan('packages');
scan('packages/examples');
scan('packages/benchmarks');

// The targets list is the source of truth for CI coverage; every non-examples
// npm name must resolve to a scanned package directory or someone forgot to
// wire the new package up and we'd silently lose coverage for it. (Validated
// below, after dirByName and examplesWatched are initialised.)

// On pushes to master everything is tested.
let changed = null;
if (process.env.EVENT_NAME === 'pull_request') {
    if (!process.env.BASE_REF) {
        throw new Error('Missing BASE_REF for pull_request event');
    }
    // execFileSync avoids a shell, so the base ref can never be interpreted as
    // shell metacharacters / options (command-injection hardening).
    changed = execFileSync('git', ['diff', '--name-only', `origin/${process.env.BASE_REF}...HEAD`, '--'], { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean);
}

// Root change = anything outside packages/ OR a packages/ file that cannot be
// attributed to any known package (loose files, a brand-new package dir that is
// not yet a target). Both must force the full matrix — never silently pare the
// test set down to zero.
const unattributed = (changed || []).some((f) => f.startsWith('packages/')
    && !Object.values(dirByName).some((dir) => f.startsWith(`${dir}/`)));

const rootAffected = changed === null
    || changed.some((f) => !f.startsWith('packages/'))
    || unattributed;

const changedNames = new Set(
    (changed || [])
        .map((f) => Object.keys(dirByName).find((name) => f.startsWith(`${dirByName[name]}/`)))
        .filter(Boolean),
);

// A package is affected when its own directory or any of its
// transitive @adguard/* workspace dependencies changed.
const workspaceDeps = (name) => {
    const pj = JSON.parse(fs.readFileSync(path.join(dirByName[name], 'package.json'), 'utf8'));
    return Object.entries({ ...pj.dependencies, ...pj.devDependencies })
        .filter(([dep, range]) => dep.startsWith('@adguard/') && String(range).startsWith('workspace'))
        .map(([dep]) => dep)
        .filter((dep) => dirByName[dep]);
};
// No memoization: isAffected's result depends on the caller's `seen` set (cycle
// pruning), so caching by name could reuse a `false` computed on a DFS path
// where the only path to a changed package was pruned. The dependency graph is
// small (<~30 nodes), so recomputing is cheap and correct.
const isAffected = (name, seen = new Set()) => {
    if (seen.has(name)) return false;
    seen.add(name);
    return changedNames.has(name)
        || workspaceDeps(name).some((dep) => isAffected(dep, seen));
};

// Examples are tested when the example apps or their API dependencies changed.
const examplesWatched = [
    '@adguard/tswebextension',
    '@adguard/api',
    '@adguard/api-mv3',
    'adguard-api-example',
    'adguard-api-mv3-example',
    'tswebextension-mv2',
    'tswebextension-mv3',
];

// Drift assertions: fail loudly instead of silently losing coverage.
for (const { target, npm } of targets) {
    if (npm && !dirByName[npm]) {
        throw new Error(`Target '${target}' maps to npm '${npm}' which was not found under packages/ (add it to the scan or fix the target list)`);
    }
}
for (const watched of examplesWatched) {
    if (!dirByName[watched]) {
        throw new Error(`examplesWatched name '${watched}' not found among scanned packages (stale entry?)`);
    }
}

const include = targets
    .filter(({ target, npm }) => rootAffected
        || (target === 'examples'
            ? examplesWatched.some((n) => dirByName[n] && isAffected(n))
            : isAffected(npm)))
    .map(({ target }) => ({ target }));

console.log(`Changed files: ${changed === null ? '(push to master — all)' : changed.length}`);
console.log(`Affected targets: ${include.map((i) => i.target).join(', ') || '(none)'}`);
console.log(`Root affected: ${rootAffected}`);
fs.appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify({ include })}\n`);
fs.appendFileSync(process.env.GITHUB_OUTPUT, `root-affected=${rootAffected ? 'true' : 'false'}\n`);
