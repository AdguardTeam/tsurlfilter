#!/usr/bin/env node
/**
 * @file Release-time check that a packed package works with the oldest
 * versions of its `@adguard/*` dependencies it declares, not with the
 * workspace copies it was built and tested against.
 *
 * Why: `workspace:^` is rewritten at pack time to `^<latest changelog version
 * of the dependency>` — the *floor* of the range. A consumer that imports an
 * API added after that dependency's last release still passes every workspace
 * test, and the "version exists on npm" check, yet fails for the first user
 * whose resolver picks the floor (a tsurlfilter that imports
 * `collectRegexValueRegions` from an `@adguard/agtree` release that predates
 * it, F-085). The dependency must be released first, and the consumer's floor
 * must be at or above that release.
 *
 * How: install the packed tarball into an empty project with every
 * `@adguard/*` dependency pinned to its exact floor, then import each public
 * entry point of the package in Node. An import fails to link when the floor
 * does not export a name the consumer imports; that, and a missing module or
 * subpath, fail the check. A package that cannot be loaded in Node for another
 * reason (a browser-only global at load time, say) only draws a warning, so a
 * runtime difference cannot block a release.
 *
 * Usage: check-dependency-floors.mjs <tarball> [--source <name>=<spec>]...
 *   <tarball>  Packed package (`pnpm pack`), entries under a `package/` prefix.
 *   --source   Install `<name>` from `<spec>` (a tarball path or any npm spec)
 *              instead of `<name>@<floor>` from the registry. Used by the
 *              regression tests to stay off the network.
 *
 * Exit codes:
 *   0  every entry point loads against the floors (or there is nothing to check).
 *   1  an entry point does not load against the floors, or the install failed.
 *   2  usage error.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fail, usageError } from './std-errors.mjs';

const USAGE = 'Usage: check-dependency-floors.mjs <tarball> [--source <name>=<spec>]...';

/**
 * Scope of the packages whose floors are checked.
 */
const SCOPE = '@adguard/';

/**
 * A dependency range that is a plain floor, e.g. `^5.0.0-alpha.0` or `~6.0.3`.
 * Same shape the "versions exist on npm" release step accepts.
 */
const FLOOR_RANGE = /^[\^~]?(\d+\.\d+\.\d+(?:-[a-z]+\.[0-9]+)?)$/;

/**
 * Error output of Node when an entry point does not link against the floor:
 * a named import the floor does not export, a module or package it does not
 * ship, or a subpath it does not expose.
 */
const FLOOR_FAILURE = /does not provide an export named|ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|Cannot find (?:module|package)/;

/**
 * Parses the command line.
 *
 * @param {string[]} args Arguments after the script name.
 *
 * @returns {{ tarball: string, sources: Map<string, string> }} Tarball path and the install source overrides.
 */
const parseArgs = (args) => {
    const sources = new Map();
    let tarball = '';

    for (let i = 0; i < args.length; i += 1) {
        if (args[i] === '--source') {
            const [name, ...rest] = (args[i + 1] ?? '').split('=');
            if (!name || rest.length === 0) {
                usageError(USAGE);
            }
            sources.set(name, rest.join('='));
            i += 1;
        } else if (!tarball) {
            tarball = args[i];
        } else {
            usageError(USAGE);
        }
    }

    if (!tarball) {
        usageError(USAGE);
    }

    return { tarball, sources };
};

/**
 * Reads the `@adguard/*` runtime dependencies of a packed manifest with the floor of each range.
 *
 * @param {Record<string, any>} manifest Packed `package.json`.
 *
 * @returns {Array<[string, string]>} Pairs of dependency name and floor version.
 */
const getFloors = (manifest) => {
    const floors = [];

    for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
        if (!name.startsWith(SCOPE) || name === manifest.name) {
            continue;
        }

        const match = String(range).match(FLOOR_RANGE);
        if (!match) {
            fail(`Unexpected dependency range ${name}@${range} in the packed package.json`);
        }

        floors.push([name, match[1]]);
    }

    return floors;
};

/**
 * Resolves the file an `exports` target points to for the `import` condition.
 *
 * @param {unknown} target Value of an `exports` entry: a path, or a conditions object.
 *
 * @returns {string | null} Path the target resolves to, or `null` when there is none.
 */
const resolveImportTarget = (target) => {
    if (typeof target === 'string') {
        return target;
    }

    if (target === null || typeof target !== 'object') {
        return null;
    }

    for (const condition of ['import', 'node', 'default']) {
        if (condition in target) {
            return resolveImportTarget(target[condition]);
        }
    }

    return null;
};

/**
 * Lists the module specifiers of the public JavaScript entry points of a package.
 *
 * @param {Record<string, any>} manifest Packed `package.json`.
 *
 * @returns {string[]} Specifiers such as `@adguard/tsurlfilter` or `@adguard/tsurlfilter/utils`.
 */
const getEntryPoints = (manifest) => {
    const { exports: exportsMap, main, name } = manifest;

    if (exportsMap === undefined) {
        return main ? [name] : [];
    }

    // A string or conditions object without subpath keys is the root export
    const entries = typeof exportsMap === 'string' || !Object.keys(exportsMap).some((key) => key.startsWith('.'))
        ? { '.': exportsMap }
        : exportsMap;

    const specifiers = [];
    for (const [subpath, target] of Object.entries(entries)) {
        const file = resolveImportTarget(target);

        // Only ES modules can be loaded with `import()`: wildcard subpaths, type and JSON
        // files, and UMD or CommonJS bundles are not entry points to check here
        if (!file || subpath.includes('*') || !/\.m?js$/.test(file) || /umd|cjs/i.test(file)) {
            continue;
        }

        specifiers.push(subpath === '.' ? name : `${name}${subpath.slice(1)}`);
    }

    return specifiers;
};

const { tarball, sources } = parseArgs(process.argv.slice(2));

if (!fs.existsSync(tarball)) {
    fail(`Tarball not found: ${tarball}`);
}

const manifest = JSON.parse(execFileSync('tar', ['-xOf', tarball, 'package/package.json'], { encoding: 'utf8' }));
const floors = getFloors(manifest);

if (floors.length === 0) {
    console.log(`${manifest.name} has no ${SCOPE}* dependencies; nothing to check`);
    process.exit(0);
}

const entryPoints = getEntryPoints(manifest);
if (entryPoints.length === 0) {
    fail(`${manifest.name} declares no JavaScript entry point to load`);
}

const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dependency-floors-'));

// `fail()` exits the process, which skips `finally` blocks, so clean up on exit
process.on('exit', () => fs.rmSync(projectDir, { recursive: true, force: true }));

fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify({ name: 'dependency-floors-check', private: true, type: 'module' }),
);

// Floors go first and exact, so npm keeps them for the tarball's own `^floor` ranges
const specs = floors.map(([name, floor]) => sources.get(name) ?? `${name}@${floor}`);

console.log(`Installing ${manifest.name}@${manifest.version} with its dependency floors: ${specs.join(', ')}`);

const install = spawnSync(
    'npm',
    [
        'install',
        '--no-audit',
        '--no-fund',
        '--ignore-scripts',
        '--omit=dev',
        '--loglevel=error',
        ...specs,
        path.resolve(tarball),
    ],
    { cwd: projectDir, encoding: 'utf8' },
);

if (install.status !== 0) {
    fail(`npm install failed for ${manifest.name} with its dependency floors:\n${install.stderr || install.stdout}`);
}

const failures = [];

for (const specifier of entryPoints) {
    const result = spawnSync(
        process.execPath,
        ['--input-type=module', '-e', `await import(${JSON.stringify(specifier)});`],
        { cwd: projectDir, encoding: 'utf8' },
    );

    if (result.status === 0) {
        console.log(`ok       ${specifier}`);
    } else if (FLOOR_FAILURE.test(result.stderr)) {
        console.log(`FAILED   ${specifier}`);
        failures.push({ specifier, stderr: result.stderr.trim() });
    } else {
        console.log(`::warning::${specifier} could not be loaded in Node for a reason unrelated to the floors:`);
        console.log(result.stderr.trim().split('\n').slice(0, 3).join('\n'));
    }
}

if (failures.length > 0) {
    const floorList = floors.map(([name, floor]) => `${name}@${floor}`).join(', ');
    const detail = failures.map(({ specifier, stderr }) => `${specifier}:\n${stderr}`).join('\n\n');
    fail(
        `${manifest.name}@${manifest.version} does not load against its dependency floors (${floorList}).\n`
        + 'Release the dependency first and raise the floor to that release.\n\n'
        + detail,
    );
}

console.log(`${manifest.name} loads against its dependency floors`);
