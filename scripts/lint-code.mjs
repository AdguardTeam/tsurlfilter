import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createSyntaxConfig, ownedRules } from '../oxlint.config.mjs';

/**
 * Runs both rule owners using the package's existing ESLint file selection.
 *
 * @param args Existing ESLint CLI arguments.
 * @returns The combined lint exit status.
 */
export async function lintCode(args) {
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
        for (const { config, files: groupFiles } of groups.values()) {
            await writeFile(configPath, JSON.stringify(config));
            for (let offset = 0; offset < groupFiles.length; offset += 100) {
                const run = spawnSync('pnpm', [
                    'exec', 'oxlint', '--no-ignore', '--config', configPath,
                    ...groupFiles.slice(offset, offset + 100),
                ], { stdio: 'inherit' });
                if (run.error) {
                    throw run.error;
                }
                failed ||= run.status !== 0;
            }
        }
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
    return failed ? 1 : 0;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
    process.exitCode = await lintCode(process.argv.slice(2));
}