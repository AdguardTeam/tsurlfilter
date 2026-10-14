import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createSyntaxConfig, ownedRules } from '../oxlint.config.mjs';

const require = createRequire(new URL('../packages/logger/package.json', import.meta.url));
const { Linter } = require('eslint');

test('shared syntax ownership matches ESLint and never activates preset rules', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'oxlint-parity-'));
    try {
        const filePath = path.join(directory, 'fixture.ts');
        const rules = Object.fromEntries(ownedRules.map((rule) => [rule, 'error']));
        const config = createSyntaxConfig({ rules });
        assert.deepEqual(Object.entries(config.rules).filter(([, setting]) => setting !== 'off').map(([rule]) => rule),
            ownedRules.map((rule) => `ag-compat/${rule}`));
        assert.ok(Object.values(config.categories).every((setting) => setting === 'off'));
        assert.equal(config.overrides.length, 0);
        assert.ok(Object.values(createSyntaxConfig().rules).every((setting) => setting === 'off'));
        assert.throws(() => createSyntaxConfig({
            rules: { 'no-debugger': ['error', {}] },
        }), /Unverified options/);
        const configPath = path.join(directory, 'config.json');
        await writeFile(configPath, JSON.stringify(config));
        const snippets = [
            ['debugger;', 'no-debugger'],
            ['switch (value) { case 1: break; case 1: break; }', 'no-duplicate-case'],
            ['const values = [1, , 3];', 'no-sparse-arrays'],
            ['const values = [1, 2, 3];', null],
            ['/* oxlint-disable ag-compat/no-debugger */ debugger;', null],
            ['/* eslint-disable */ debugger;', null],
        ];
        for (const [source, rule] of snippets) {
            await writeFile(filePath, source);
            const run = spawnSync('pnpm', ['exec', 'oxlint', '-c', configPath, filePath], { encoding: 'utf8' });
            assert.equal(run.status, rule ? 1 : 0, run.stdout + run.stderr);
            if (rule) {
                assert.match(run.stdout + run.stderr, new RegExp(rule));
                const diagnostics = new Linter().verify(source, { parserOptions: { ecmaVersion: 2022 }, rules });
                assert.deepEqual(diagnostics.map(({ ruleId }) => ruleId), [rule]);
            }
        }
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('runner preserves ignores, nested resets, warnings and staged file arguments', async () => {
    const directory = await mkdtemp(new URL('../packages/logger/.oxlint-parity-', import.meta.url).pathname);
    const runner = new URL('../scripts/lint-code.mjs', import.meta.url).pathname;
    try {
        await writeFile(path.join(directory, 'package.json'), '{}');
        await writeFile(path.join(directory, '.eslintrc.cjs'), `module.exports = {
            root: true,
            parserOptions: { ecmaVersion: 2022 },
            rules: { 'no-debugger': 'error', 'no-alert': 'error' },
        };`);
        await writeFile(path.join(directory, '.eslintignore'), 'ignored.js\n');
        await writeFile(path.join(directory, 'ignored.js'), 'debugger;');
        await writeFile(path.join(directory, 'valid.js'), 'const values = [1, , 3];');
        await mkdir(path.join(directory, 'nested'));
        await writeFile(path.join(directory, 'nested', '.eslintrc.cjs'), 'module.exports = { root: true };');
        await writeFile(path.join(directory, 'nested', 'reset.js'), 'debugger;');
        const run = (args) => spawnSync(process.execPath, [runner, ...args], {
            cwd: directory,
            encoding: 'utf8',
        });
        const valid = run(['.']);
        assert.equal(valid.status, 0, valid.stdout + valid.stderr);
        await writeFile(path.join(directory, 'invalid.js'), 'debugger; alert("fallback");');
        const invalid = run(['invalid.js']);
        assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
        assert.match(invalid.stdout + invalid.stderr, /ag-compat\(no-debugger\)/);
        assert.match(invalid.stdout + invalid.stderr, /no-alert/);
        const ignored = run(['--ignore-pattern', 'invalid.js', '.']);
        assert.equal(ignored.status, 0, ignored.stdout + ignored.stderr);
        await writeFile(path.join(directory, '.eslintrc.cjs'), `module.exports = {
            root: true, rules: { 'no-debugger': 'warn' },
        };`);
        await writeFile(path.join(directory, 'invalid.js'), 'debugger;');
        const warning = run(['invalid.js']);
        assert.equal(warning.status, 0, warning.stdout + warning.stderr);
        assert.match(warning.stdout + warning.stderr, /warning ag-compat\(no-debugger\)/);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});