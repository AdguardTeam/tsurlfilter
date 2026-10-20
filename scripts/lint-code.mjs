import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createSyntaxConfig, ownedRules } from '../oxlint.config.mjs';

/**
 * Resolves an executable declared by a package manifest.
 *
 * @param requireFrom Resolver anchored where the package is installed.
 * @param packageName Package that declares the executable.
 * @param binName Command name in its manifest.
 * @returns Absolute path to the executable script.
 */
function resolveBin(requireFrom, packageName, binName) {
    const manifestPath = requireFrom.resolve(`${packageName}/package.json`);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin[binName];
    return path.resolve(path.dirname(manifestPath), bin);
}

/**
 * Resolve the Oxlint executable once per process instead of once per file
 * group. The package's own installation wins; the root installation is the
 * fallback. Resolution order and candidates are unchanged.
 *
 * @param packageRequire - Require anchored at the linted package.
 * @returns Absolute path to the Oxlint executable script.
 */
function resolveOxlint(packageRequire) {
    try {
        return resolveBin(packageRequire, 'oxlint', 'oxlint');
    } catch {
        return resolveBin(createRequire(import.meta.url), 'oxlint', 'oxlint');
    }
}

/**
 * Runs both rule owners using the package's existing ESLint file selection.
 *
 * @param args Existing ESLint CLI arguments.
 * @returns The combined lint exit status.
 */
export async function lintCode(args) {
    // Full-migration path (gated): Oxlint owns every migrated rule via the
    // package's committed oxlint.migrated.json; a generated tail ESLint
    // config owns only the fallback list. The default path below is
    // unchanged until each package's cutover flips this flag on.
    if (process.env.ADGUARD_OXLINT_MIGRATED === '1') {
        return lintMigrated(args);
    }
    const require = createRequire(path.join(process.cwd(), 'package.json'));
    const { ESLint } = require('eslint');
    const flat = Number(require('eslint/package.json').version.split('.')[0]) >= 9;
    const options = { cache: false };
    const files = [];
    const ignorePatterns = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--cache') {
            options.cache = true;
        } else if (arg === '--ext') {
            options.extensions = args[++index].split(',');
        } else if (arg === '--ignore-path') {
            options.ignorePath = args[++index];
        } else if (arg === '--ignore-pattern') {
            ignorePatterns.push(args[++index]);
        } else if (arg.startsWith('-')) {
            throw new Error(`Unsupported lint argument: ${arg}`);
        } else {
            files.push(arg);
        }
    }
    options.overrideConfig = flat ? [{ ignores: ignorePatterns }] : { ignorePatterns };
    const disabled = Object.fromEntries(ownedRules.map((rule) => [rule, 'off']));
    const original = new ESLint(options);
    const fallback = new ESLint({
        ...options,
        overrideConfig: flat
            ? [...options.overrideConfig, { rules: disabled }]
            : { ...options.overrideConfig, rules: disabled },
    });
    const results = await fallback.lintFiles(files.length ? files : ['.']);
    const groups = new Map();
    for (const result of results) {
        if (!await original.isPathIgnored(result.filePath)) {
            const effective = await original.calculateConfigForFile(result.filePath);
            const key = JSON.stringify(ownedRules.map((rule) => effective.rules?.[rule] ?? 'off'));
            if (!groups.has(key)) {
                groups.set(key, { config: createSyntaxConfig(effective), files: [] });
            }
            groups.get(key).files.push(result.filePath);
        }
    }
    const formatter = await fallback.loadFormatter('stylish');
    const output = formatter.format(results);
    if (output) {
        process.stdout.write(output);
    }
    const directory = await mkdtemp(path.join(tmpdir(), 'adguard-oxlint-'));
    let failed = results.some((result) => result.errorCount > 0);
    try {
        const configPath = path.join(directory, 'config.json');
        const oxlint = resolveOxlint(createRequire(path.join(process.cwd(), 'package.json')));
        for (const { config, files: groupFiles } of groups.values()) {
            await writeFile(configPath, JSON.stringify(config));
            // One invocation per rule group. The file list of even the
            // largest package stays far below OS argv limits, so the
            // previous hundred-file chunking only added process startups.
            const run = spawnSync(process.execPath, [
                oxlint, '--no-ignore', '--config', configPath, ...groupFiles,
            ], { stdio: 'inherit' });
            if (run.error) {
                throw run.error;
            }
            failed ||= run.status !== 0;
        }
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
    return failed ? 1 : 0;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
    process.exitCode = await lintCode(process.argv.slice(2));
}

/**
 * Runs the migrated owners: one Oxlint pass over the committed migrated
 * config plus a tail ESLint pass owning exactly the fallback list.
 *
 * File selection mirrors the default path (same argv parsing, same ESLint
 * instance semantics) so the linted set is identical; only rule ownership
 * moves. The tail uses the package's committed .eslint-tail.cjs rules with
 * every other effective rule forced off via .eslint-tail.off.json.
 *
 * @param args Existing ESLint CLI arguments.
 * @returns The combined lint exit status.
 */
export async function lintMigrated(args) {
    const require = createRequire(path.join(process.cwd(), 'package.json'));
    const { ESLint } = require('eslint');
    const flat = Number(require('eslint/package.json').version.split('.')[0]) >= 9;
    const options = { cache: false };
    const files = [];
    const ignorePatterns = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--cache') {
            options.cache = true;
        } else if (arg === '--ext') {
            options.extensions = args[++index].split(',');
        } else if (arg === '--ignore-path') {
            options.ignorePath = args[++index];
        } else if (arg === '--ignore-pattern') {
            ignorePatterns.push(args[++index]);
        } else if (arg.startsWith('-')) {
            throw new Error(`Unsupported lint argument: ${arg}`);
        } else {
            files.push(arg);
        }
    }
    const baseOverrides = flat ? [{ ignores: ignorePatterns }] : ignorePatterns;
    // Single ESLint pass: the tail owns exactly the fallback list, so its
    // result set doubles as the file selection. Oxlint fans out in
    // parallel over the same files; total wall is the max of the two,
    // not their sum.
    const tail = new ESLint({
        ...options,
        overrideConfig: flat
            ? [...baseOverrides, { rules: { ...(require('./.eslint-tail.off.json')), ...require('./.eslint-tail.cjs').rules } }]
            : { ignorePatterns: baseOverrides, rules: { ...(require('./.eslint-tail.off.json')), ...require('./.eslint-tail.cjs').rules } },
    });
    const targets = files.length ? files : ['.'];
    const oxlint = resolveOxlint(createRequire(path.join(process.cwd(), 'package.json')));
    const migratedConfig = path.join(process.cwd(), 'oxlint.migrated.json');
    // Both owners fan out in parallel over the same targets with the same
    // ignore-path: the tail's exact file set is the lintFiles result, and
    // Oxlint applies the identical ignore-path to the same targets. Total
    // wall is the max of the two passes, not their sum.
    const ignorePath = args.includes('--ignore-path')
        ? args[args.indexOf('--ignore-path') + 1]
        : undefined;
    const tailRun = tail.lintFiles(targets);
    // Route the migrated pass through the resource-aware CLI when the
    // installed SDK provides it, so result caching matches the hybrid
    // warm lane; otherwise fall back to the raw engine invocation.
    // Formal T7 showed the uncached migrated warm lane losing to the
    // cached hybrid; the cache gate restores the win on both lanes.
    const packageRequire = createRequire(path.join(process.cwd(), 'package.json'));
    let lintCli;
    try {
        lintCli = packageRequire.resolve('@agcodeguidelines/oxlint-config/dist/lint-cli.js');
    } catch {
        lintCli = undefined;
    }
    const oxlintEntry = lintCli ?? oxlint;
    const oxlintArgs = lintCli
        ? ['--cache', '--config', migratedConfig, ...targets]
        : ['--config', migratedConfig,
            ...(ignorePath ? ['--ignore-path', ignorePath] : []),
            ...targets];
    const oxlintRun = new Promise((resolve, reject) => {
        const run = spawnSync(process.execPath, [
            oxlintEntry, ...oxlintArgs,
        ], { cwd: process.cwd(), stdio: 'inherit' });
        if (run.error) {
            reject(run.error);
        } else {
            resolve(run.status ?? 1);
        }
    });
    const [oxlintStatus, tailResults] = await Promise.all([oxlintRun, tailRun]);
    const formatter = await tail.loadFormatter('stylish');
    const output = formatter.format(tailResults);
    if (output) {
        process.stdout.write(output);
    }
    return (oxlintStatus !== 0 || tailResults.some((result) => result.errorCount > 0)) ? 1 : 0;
}
