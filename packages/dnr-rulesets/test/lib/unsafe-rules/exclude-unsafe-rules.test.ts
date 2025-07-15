import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
    afterAll,
    afterEach,
    describe,
    expect,
    it,
} from 'vitest';

import { excludeUnsafeRules } from '../../../src/lib/unsafe-rules/exclude-unsafe-rules';

// Counter for temporary directories to avoid conflicts in tests.
let tempCounter = 0;

/**
 * Recursively copies a folder and its contents to a new location.
 *
 * @param src The source folder path to copy from.
 * @param dest The destination folder path to copy to.
 */
async function copyFolder(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyFolder(srcPath, destPath);
        } else if (entry.isFile()) {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

/**
 * Creates a temporary directory and copies the ruleset file into it.
 * This is used to avoid modifying the original ruleset files during tests.
 *
 * @param dirPath The path to the directory with the ruleset file and metadata
 * ruleset file.
 *
 * @returns A promise that resolves to the path of the temporary directory
 * containing the copied ruleset file with metadata ruleset file.
 */
async function copyToTemp(
    dirPath: string,
): Promise<string> {
    tempCounter += 1;

    const tempDir = path.join(
        os.tmpdir(),
        'exclude-unsafe-test-' + tempCounter,
        dirPath,
    );

    await copyFolder(
        path.join(__dirname, dirPath),
        tempDir,
    );

    return tempDir;
}

describe('excludeUnsafeRules', () => {
    let tempDirs: string[] = [];

    afterEach(async () => {
        for (const dir of tempDirs) {
            await fs.rm(dir, { recursive: true, force: true });
        }
        tempDirs = [];
    });

    // Clean up any remaining temporary directories after all tests
    afterAll(() => {
        tempDirs.forEach(async (dir) => {
            try {
                await fs.rm(dir, { recursive: true, force: true });
            } catch (error) {
                console.error(`Failed to remove temporary directory ${dir}:`, error);
            }
        });
        tempDirs = [];
    });

    const rulesets = [
        {
            dirWithCases: 'cases/zero_unsafe_rules/',
            unsafe: 'ruleset_999/ruleset_999.json',
            safe: 'ruleset_999.json.safe',
        },
        {
            dirWithCases: 'cases/one_unsafe_rules/',
            unsafe: 'ruleset_999/ruleset_999.json',
            safe: 'ruleset_999.json.safe',
        },
        {
            dirWithCases: 'cases/five_unsafe_rules/',
            unsafe: 'ruleset_999/ruleset_999.json',
            safe: 'ruleset_999.json.safe',
        },
    ];

    rulesets.forEach(async ({ unsafe, safe, dirWithCases }) => {
        it(`case ${dirWithCases}`, async () => {
            // Move the unsafe ruleset to a temporary directory
            // to avoid modifying the original file.
            const tempDir = await copyToTemp(dirWithCases);
            tempDirs.push(tempDir);

            await excludeUnsafeRules({ dir: tempDir });

            const rulesetBeforePath = path.join(tempDir, unsafe);
            const extectedRulesetPath = path.join(tempDir, safe);

            const result = await fs.readFile(rulesetBeforePath, 'utf-8');
            const expected = await fs.readFile(extectedRulesetPath, 'utf-8');

            expect(JSON.parse(result)).toEqual(JSON.parse(expected));
        });
    });

    it(`respects the limit - should convert without error if not overflowed`, async () => {
        // Move the unsafe ruleset to a temporary directory
        // to avoid modifying the original file.
        const tempDir = await copyToTemp(rulesets[1].dirWithCases);
        tempDirs.push(tempDir);

        await excludeUnsafeRules({ dir: tempDir, limit: 2 });

        const rulesetBeforePath = path.join(tempDir, rulesets[1].unsafe);
        const extectedRulesetPath = path.join(tempDir, rulesets[1].safe);

        const result = await fs.readFile(rulesetBeforePath, 'utf-8');
        const expected = await fs.readFile(extectedRulesetPath, 'utf-8');

        expect(JSON.parse(result)).toEqual(JSON.parse(expected));
    });

    it(`respects the limit - should return an error if overflowed`, async () => {
        // Move the unsafe ruleset to a temporary directory
        // to avoid modifying the original file.
        const tempDir = await copyToTemp(rulesets[2].dirWithCases);
        tempDirs.push(tempDir);

        const promise = excludeUnsafeRules({ dir: tempDir, limit: 2 });
        await expect(promise).rejects.toThrowError(`Too many unsafe rules found: 5. Limit is 2.`);
    });
});
