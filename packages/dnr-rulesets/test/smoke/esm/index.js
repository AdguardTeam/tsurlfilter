import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { AssetsLoader } from '@adguard/dnr-rulesets';

const libraryUrl = import.meta.resolve('@adguard/dnr-rulesets');
const filtersPath = fileURLToPath(new URL('../filters/', libraryUrl));
const cliPath = fileURLToPath(new URL('../cli.cjs', libraryUrl));
const browsers = ['chromium-mv3', 'edge-mv3', 'opera-mv3'];

/**
 * Create distinct packaged assets for each browser without downloading filters.
 *
 * @param browser Browser whose assets to create.
 *
 * @returns Fixture files and their contents.
 */
function assetsFor(browser) {
    return {
        'filters_i18n.json': JSON.stringify({ browser }),
        'local_script_rules.js': `export const localScriptRules = { '${browser}': () => {} };`,
        'local_script_rules.json': JSON.stringify({ [browser]: [] }),
        'declarative/ruleset_1/ruleset_1.json': JSON.stringify([
            { id: 1, action: { type: 'block' }, condition: { urlFilter: `||${browser}.example^` } },
        ]),
    };
}

/**
 * Read the copied asset tree, including each file's contents.
 *
 * @param directory Directory to inspect.
 *
 * @returns Files indexed by their paths relative to the directory.
 */
async function readAssets(directory) {
    const files = {};
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            const children = await readAssets(entryPath);
            for (const [name, content] of Object.entries(children)) {
                files[`${entry.name}/${name}`] = content;
            }
        } else {
            files[entry.name] = await fs.readFile(entryPath, 'utf8');
        }
    }
    return files;
}

/**
 * Create a temporary working directory and remove it after the test.
 *
 * @param context Test context.
 *
 * @returns Temporary working directory.
 */
async function createWorkingDirectory(context) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dnr-rulesets-smoke-'));
    context.after(() => fs.rm(directory, { recursive: true, force: true }));
    return directory;
}

before(async () => {
    // The smoke package is disposable; production build assets remain untouched.
    await fs.rm(filtersPath, { recursive: true, force: true });
    for (const browser of browsers) {
        for (const [name, content] of Object.entries(assetsFor(browser))) {
            const filename = path.join(filtersPath, browser, name);
            await fs.mkdir(path.dirname(filename), { recursive: true });
            await fs.writeFile(filename, content);
        }
    }
});

for (const browser of browsers) {
    test(`CLI load copies ${browser} assets from the installed package`, async (context) => {
        const cwd = await createWorkingDirectory(context);
        const args = [cliPath, 'load', 'output'];
        if (browser !== 'chromium-mv3') {
            args.push('--browser', browser);
        }
        const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
        assert.equal(result.error, undefined);
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(await readAssets(path.join(cwd, 'output')), assetsFor(browser));
    });

    test(`ESM AssetsLoader copies ${browser} assets from the installed package`, async (context) => {
        const cwd = await createWorkingDirectory(context);
        const output = path.join(cwd, 'output');
        await new AssetsLoader().load(output, { browser });
        assert.deepEqual(await readAssets(output), assetsFor(browser));
    });
}

test('CLI load --only-declarative-rulesets excludes auxiliary assets', async (context) => {
    const cwd = await createWorkingDirectory(context);
    const result = spawnSync(process.execPath, [cliPath, 'load', 'output', '--only-declarative-rulesets'], {
        cwd,
        encoding: 'utf8',
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    const filename = 'declarative/ruleset_1/ruleset_1.json';
    assert.deepEqual(await readAssets(path.join(cwd, 'output')), {
        [filename]: assetsFor('chromium-mv3')[filename],
    });
});

test('ESM AssetsLoader copies individual local script rule files', async (context) => {
    const cwd = await createWorkingDirectory(context);
    const loader = new AssetsLoader();
    const jsPath = path.join(cwd, 'local_script_rules.js');
    const jsonPath = path.join(cwd, 'local_script_rules.json');
    await loader.copyLocalScriptRulesJs(jsPath);
    await loader.copyLocalScriptRulesJson(jsonPath);
    const assets = assetsFor('chromium-mv3');
    assert.equal(await fs.readFile(jsPath, 'utf8'), assets['local_script_rules.js']);
    assert.equal(await fs.readFile(jsonPath, 'utf8'), assets['local_script_rules.json']);
});

test('CLI load reports a copy failure with a nonzero exit status', async (context) => {
    const cwd = await createWorkingDirectory(context);
    await fs.writeFile(path.join(cwd, 'not-a-directory'), '');
    const result = spawnSync(process.execPath, [cliPath, 'load', 'not-a-directory/output'], {
        cwd,
        encoding: 'utf8',
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ENOTDIR/);
});

test('CLI load reports missing packaged assets with a nonzero exit status', async (context) => {
    const cwd = await createWorkingDirectory(context);
    const browserPath = path.join(filtersPath, 'chromium-mv3');
    const backupPath = `${browserPath}-backup`;
    await fs.rename(browserPath, backupPath);
    try {
        const result = spawnSync(process.execPath, [cliPath, 'load', 'output'], { cwd, encoding: 'utf8' });
        assert.equal(result.error, undefined);
        assert.equal(result.signal, null);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /ENOENT/);
    } finally {
        await fs.rename(backupPath, browserPath);
    }
});
