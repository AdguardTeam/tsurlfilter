import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { generateMD5Hash } from '@adguard/dnr-converter/cli';
import {
    afterAll,
    afterEach,
    describe,
    expect,
    it,
} from 'vitest';

import { excludeUnsafeRules } from '../../../src/lib/unsafe-rules/exclude-unsafe-rules';

// Counter for temporary directories to avoid conflicts in temp folders.
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

    const RULESET_999 = 'ruleset_999';

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
            id: 1,
            dirWithCases: 'cases/zero_unsafe_rules/',
            unsafe: `${RULESET_999}/${RULESET_999}.json`,
            safe: `${RULESET_999}.json.safe`,
        },
        {
            id: 2,
            dirWithCases: 'cases/zero_unsafe_rules_2/',
            unsafe: `${RULESET_999}/${RULESET_999}.json`,
            safe: `${RULESET_999}.json.safe`,
        },
        {
            id: 3,
            dirWithCases: 'cases/one_unsafe_rules/',
            unsafe: `${RULESET_999}/${RULESET_999}.json`,
            safe: `${RULESET_999}.json.safe`,
        },
        {
            id: 4,
            dirWithCases: 'cases/five_unsafe_rules/',
            unsafe: `${RULESET_999}/${RULESET_999}.json`,
            safe: `${RULESET_999}.json.safe`,
        },
    ];

    rulesets.forEach(async ({ unsafe, safe, dirWithCases }) => {
        it(`case ${dirWithCases}`, async () => {
            // Move the unsafe ruleset to a temporary directory
            // to avoid modifying the original file.
            const tempDir = await copyToTemp(dirWithCases);
            tempDirs.push(tempDir);

            // Read initial metadata to get the original checksum
            const metadataPath = path.join(tempDir, 'ruleset_0/ruleset_0.json');
            const initialMetadata = await fs.readFile(metadataPath, 'utf-8');
            const parsedInitialMetadata = JSON.parse(initialMetadata);
            const originalChecksum = parsedInitialMetadata[0].metadata.checksums[RULESET_999];

            await excludeUnsafeRules({ dir: tempDir });

            const rulesetBeforePath = path.join(tempDir, unsafe);
            const expectedRulesetPath = path.join(tempDir, safe);

            const result = await fs.readFile(rulesetBeforePath, 'utf-8');
            const expected = await fs.readFile(expectedRulesetPath, 'utf-8');

            expect(JSON.parse(result)).toEqual(JSON.parse(expected));

            // Check that checksum has been updated and is valid MD5
            const updatedMetadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
            const newChecksum = updatedMetadata[0].metadata.checksums[RULESET_999];

            // Verify that the new checksum matches the actual content of the processed ruleset
            const expectedChecksum = generateMD5Hash(result);
            expect(newChecksum).toBe(expectedChecksum);

            // Checksum always changes — excludeUnsafeRules re-serializes the ruleset.
            expect(newChecksum).not.toBe(originalChecksum);
        });
    });

    it(`respects the limit - should convert without error if not overflowed`, async () => {
        const ruleset = rulesets.find((r) => r.id === 3);
        if (!ruleset) {
            throw new Error('Test ruleset not found');
        }

        // Move the unsafe ruleset to a temporary directory
        // to avoid modifying the original file.
        const tempDir = await copyToTemp(ruleset.dirWithCases);
        tempDirs.push(tempDir);

        await excludeUnsafeRules({ dir: tempDir, limit: 2 });

        const rulesetBeforePath = path.join(tempDir, ruleset.unsafe);
        const expectedRulesetPath = path.join(tempDir, ruleset.safe);

        const result = await fs.readFile(rulesetBeforePath, 'utf-8');
        const expected = await fs.readFile(expectedRulesetPath, 'utf-8');

        expect(JSON.parse(result)).toEqual(JSON.parse(expected));
    });

    it(`respects the limit - should return an error if overflowed`, async () => {
        const ruleset = rulesets.find((r) => r.id === 4);
        if (!ruleset) {
            throw new Error('Test ruleset not found');
        }

        // Move the unsafe ruleset to a temporary directory
        // to avoid modifying the original file.
        const tempDir = await copyToTemp(ruleset.dirWithCases);
        tempDirs.push(tempDir);

        const promise = excludeUnsafeRules({ dir: tempDir, limit: 2 });
        await expect(promise).rejects.toThrowError(`Too many unsafe rules found: 5. Limit is 2.`);
    });

    it('is idempotent — running twice should not lose unsafe rules', async () => {
        const ruleset = rulesets.find((r) => r.id === 3);
        if (!ruleset) {
            throw new Error('Test ruleset not found');
        }

        const tempDir = await copyToTemp(ruleset.dirWithCases);
        tempDirs.push(tempDir);

        const rulesetPath = path.join(tempDir, ruleset.unsafe);

        // First run: extract unsafe rules from declarative rules into metadata.
        await excludeUnsafeRules({ dir: tempDir });

        const firstRun = JSON.parse(await fs.readFile(rulesetPath, 'utf-8'));
        const firstMeta = firstRun[0].metadata.metadata;
        const firstUnsafeRules = firstMeta.unsafeRules || [];
        expect(firstUnsafeRules.length).toBeGreaterThan(0);

        // Second run: should NOT lose unsafe rules already stored in metadata.
        await excludeUnsafeRules({ dir: tempDir });

        const secondRun = JSON.parse(await fs.readFile(rulesetPath, 'utf-8'));
        const secondMeta = secondRun[0].metadata.metadata;
        const secondUnsafeRules = secondMeta.unsafeRules || [];

        // Unsafe rules must be preserved — same count, same rule IDs.
        expect(secondUnsafeRules.length).toBe(firstUnsafeRules.length);
        const firstIds = firstUnsafeRules.map((r: { id: number }) => r.id).sort();
        const secondIds = secondUnsafeRules.map((r: { id: number }) => r.id).sort();
        expect(secondIds).toEqual(firstIds);
    });

    it('is idempotent — checksum unchanged on second run of already-processed ruleset', async () => {
        // Use zero_unsafe_rules_2: already has `unsafeRules` in metadata,
        // already uses `safeRulesCount`.
        const ruleset = rulesets.find((r) => r.id === 2);
        if (!ruleset) {
            throw new Error('Test ruleset not found');
        }

        const tempDir = await copyToTemp(ruleset.dirWithCases);
        tempDirs.push(tempDir);

        const metadataPath = path.join(tempDir, 'ruleset_0/ruleset_0.json');

        // First run: normalizes serialization formatting to current standard.
        await excludeUnsafeRules({ dir: tempDir });

        const rulesetBytes = await fs.readFile(path.join(tempDir, ruleset.unsafe));
        const checksumAfterFirstRun = generateMD5Hash(rulesetBytes.toString());

        // Second run: pure no-op, nothing to move or reformat.
        await excludeUnsafeRules({ dir: tempDir });

        const rulesetBytes2 = await fs.readFile(path.join(tempDir, ruleset.unsafe));
        const checksumAfterSecondRun = generateMD5Hash(rulesetBytes2.toString());

        // Checksums must be stable — second run doesn't change anything.
        expect(checksumAfterSecondRun).toBe(checksumAfterFirstRun);

        const updatedMetadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
        const metadataChecksum = updatedMetadata[0].metadata.checksums[RULESET_999];
        expect(metadataChecksum).toBe(checksumAfterFirstRun);
    });
});
