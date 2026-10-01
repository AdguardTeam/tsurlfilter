import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
    type CompactRulesetContent,
    type DeclarativeRule,
    isSafeRule,
    MetadataRuleset,
    parseCompactRuleset,
} from '@adguard/dnr-converter';
import { convertFilters, generateMD5Hash } from '@adguard/dnr-converter/cli';
import {
    afterEach,
    describe,
    expect,
    it,
} from 'vitest';

import { RESOURCES_DIR } from '../../../common/constants';
import { excludeUnsafeRules } from '../../../src/lib/unsafe-rules/exclude-unsafe-rules';

/**
 * Maximum size in UTF-8 bytes of one serialized `metadata` value, as
 * guaranteed by `@adguard/dnr-converter` (not exported by the converter).
 */
const MAX_METADATA_VALUE_BYTES = 65_536;

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

/**
 * Reads the checksum of a ruleset from the metadata ruleset file.
 *
 * @param metadataPath Path to `ruleset_0.json`.
 * @param rulesetId Ruleset id, e.g. `ruleset_999`.
 *
 * @returns Stored checksum or `undefined`.
 */
async function readChecksum(metadataPath: string, rulesetId: string): Promise<string | undefined> {
    const raw = await fs.readFile(metadataPath, 'utf-8');

    return MetadataRuleset.deserialize(raw).getChecksum(rulesetId);
}

/**
 * Parses the content of a filter ruleset file. Comparing contents rather than
 * bytes ignores the key order inside rule objects, which the unsafe-rule pass
 * normalizes when it re-serializes a ruleset.
 *
 * @param raw Raw JSON of `ruleset_<id>.json`.
 * @param rulesetId Ruleset id, e.g. `ruleset_999`.
 *
 * @returns Metadata, ordinary rules and number of metadata rules.
 */
function parseContent(raw: string, rulesetId: string): CompactRulesetContent {
    return parseCompactRuleset(rulesetId, JSON.parse(raw));
}

/**
 * Reads unsafe rules stored in the metadata of a filter ruleset file.
 *
 * @param rulesetPath Path to `ruleset_<id>.json`.
 * @param rulesetId Ruleset id, e.g. `ruleset_999`.
 *
 * @returns Unsafe rules from the metadata.
 */
async function readUnsafeRules(rulesetPath: string, rulesetId: string): Promise<DeclarativeRule[]> {
    const raw = await fs.readFile(rulesetPath, 'utf-8');

    return parseContent(raw, rulesetId).metadata.unsafeRules;
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

    const rulesets = [
        {
            id: 2,
            dirWithCases: 'cases/zero_unsafe_rules_2/',
            unsafe: `${RULESET_999}/${RULESET_999}.json`,
            safe: `${RULESET_999}.json.safe`,
            // Input is the output of a previous run with no unsafe rules, so
            // the pass rewrites it byte for byte and the checksum stays.
            expectChecksumChange: false,
        },
        {
            id: 3,
            dirWithCases: 'cases/one_unsafe_rules/',
            unsafe: `${RULESET_999}/${RULESET_999}.json`,
            safe: `${RULESET_999}.json.safe`,
            expectChecksumChange: true,
        },
        {
            id: 4,
            dirWithCases: 'cases/five_unsafe_rules/',
            unsafe: `${RULESET_999}/${RULESET_999}.json`,
            safe: `${RULESET_999}.json.safe`,
            expectChecksumChange: true,
        },
    ];

    rulesets.forEach(({
        unsafe,
        safe,
        dirWithCases,
        expectChecksumChange,
    }) => {
        it(`case ${dirWithCases}`, async () => {
            // Move the unsafe ruleset to a temporary directory
            // to avoid modifying the original file.
            const tempDir = await copyToTemp(dirWithCases);
            tempDirs.push(tempDir);

            const metadataPath = path.join(tempDir, 'ruleset_0/ruleset_0.json');
            const rulesetPath = path.join(tempDir, unsafe);

            const input = await fs.readFile(rulesetPath, 'utf-8');
            const originalChecksum = await readChecksum(metadataPath, RULESET_999);

            // Fixtures store the real checksum of their input file.
            expect(originalChecksum).toBe(generateMD5Hash(input));

            await excludeUnsafeRules({ dir: tempDir });

            const result = await fs.readFile(rulesetPath, 'utf-8');
            const expected = await fs.readFile(path.join(tempDir, safe), 'utf-8');

            expect(parseContent(result, RULESET_999)).toEqual(parseContent(expected, RULESET_999));

            // The stored checksum matches the content of the processed ruleset.
            const newChecksum = await readChecksum(metadataPath, RULESET_999);
            expect(newChecksum).toBe(generateMD5Hash(result));

            if (expectChecksumChange) {
                expect(newChecksum).not.toBe(originalChecksum);
            } else {
                expect(result).toBe(input);
                expect(newChecksum).toBe(originalChecksum);
            }
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

        expect(parseContent(result, RULESET_999)).toEqual(parseContent(expected, RULESET_999));
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

        const firstUnsafeRules = await readUnsafeRules(rulesetPath, RULESET_999);
        expect(firstUnsafeRules.length).toBeGreaterThan(0);

        // Second run: should NOT lose unsafe rules already stored in metadata.
        await excludeUnsafeRules({ dir: tempDir });

        const secondUnsafeRules = await readUnsafeRules(rulesetPath, RULESET_999);

        // Unsafe rules must be preserved as they are.
        expect(secondUnsafeRules).toEqual(firstUnsafeRules);
    });

    it('is idempotent — checksum unchanged on second run of already-processed ruleset', async () => {
        const ruleset = rulesets.find((r) => r.id === 3);
        if (!ruleset) {
            throw new Error('Test ruleset not found');
        }

        const tempDir = await copyToTemp(ruleset.dirWithCases);
        tempDirs.push(tempDir);

        const metadataPath = path.join(tempDir, 'ruleset_0/ruleset_0.json');
        const rulesetPath = path.join(tempDir, ruleset.unsafe);

        // First run: moves the unsafe rule into the metadata.
        await excludeUnsafeRules({ dir: tempDir });

        const firstRun = await fs.readFile(rulesetPath, 'utf-8');

        // Second run: pure no-op, nothing left to move.
        await excludeUnsafeRules({ dir: tempDir });

        const secondRun = await fs.readFile(rulesetPath, 'utf-8');

        expect(secondRun).toBe(firstRun);
        expect(await readChecksum(metadataPath, RULESET_999)).toBe(generateMD5Hash(firstRun));
    });

    describe('ruleset with metadata split into several chunks', () => {
        const FILTER_ID = 999;
        const SAFE_RULES_COUNT = 3000;
        const UNSAFE_RULES_COUNT = 600;

        const safeRules = Array.from(
            { length: SAFE_RULES_COUNT },
            (_, i) => `||safe-${i}.example.org^`,
        );
        const unsafeRules = Array.from(
            { length: UNSAFE_RULES_COUNT },
            (_, i) => `||unsafe-${i}.example.org/ad.js$redirect=noopjs`,
        );
        // Mixes unsafe rules between safe ones and adds non-ASCII text, so
        // chunk boundaries can fall on escaped and multi-byte characters.
        const filterText = safeRules
            .map((rule, i) => (i < UNSAFE_RULES_COUNT
                ? `! Правило №${i} "кавычки" \\ ✓\n${rule}\n${unsafeRules[i]}`
                : rule))
            .join('\n');

        /**
         * Converts the generated filter with the converter CLI API, the same
         * way the dnr-rulesets build does, into a temporary directory.
         *
         * @returns Path to the directory with `ruleset_999` and `ruleset_0`.
         */
        async function buildRulesets(): Promise<string> {
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'exclude-unsafe-chunks-'));
            tempDirs.push(tempDir);

            const filtersDir = path.join(tempDir, 'filters');
            const rulesetsDir = path.join(tempDir, 'declarative');

            await fs.mkdir(filtersDir, { recursive: true });
            await fs.writeFile(path.join(filtersDir, `filter_${FILTER_ID}.txt`), filterText);
            await fs.writeFile(path.join(filtersDir, 'filters.json'), '{}');

            await convertFilters(filtersDir, RESOURCES_DIR, rulesetsDir, { prettifyJson: false });

            return rulesetsDir;
        }

        it('keeps every metadata value within the bound, IDs unique and rules intact', async () => {
            const dir = await buildRulesets();
            const rulesetPath = path.join(dir, `${RULESET_999}/${RULESET_999}.json`);
            const metadataPath = path.join(dir, 'ruleset_0/ruleset_0.json');

            const before = parseContent(await fs.readFile(rulesetPath, 'utf-8'), RULESET_999);
            expect(before.metadataRulesCount).toBeGreaterThanOrEqual(2);

            await excludeUnsafeRules({ dir });

            const raw = await fs.readFile(rulesetPath, 'utf-8');
            // Metadata rules carry `metadata`, which DNR rule typings omit.
            const parsed = JSON.parse(raw) as { id: number; metadata?: unknown }[];
            const after = parseCompactRuleset(RULESET_999, parsed);

            // Moving the unsafe rules into the metadata adds chunks.
            expect(after.metadataRulesCount).toBeGreaterThan(before.metadataRulesCount);

            // Compact output: re-serializing a parsed value gives the bytes
            // written to the file.
            parsed.slice(0, after.metadataRulesCount).forEach((rule) => {
                const size = Buffer.byteLength(JSON.stringify(rule.metadata), 'utf8');
                expect(size).toBeLessThanOrEqual(MAX_METADATA_VALUE_BYTES);
            });

            const allIds = [
                ...parsed.map((rule) => rule.id),
                ...after.metadata.unsafeRules.map((rule) => rule.id),
            ];
            expect(new Set(allIds).size).toBe(allIds.length);

            // Nothing is lost, duplicated, reordered or changed: safe rules stay
            // ordinary in file order, unsafe rules move to the metadata in order.
            expect(after.declarativeRules).toHaveLength(SAFE_RULES_COUNT);
            expect(after.metadata.unsafeRules).toHaveLength(UNSAFE_RULES_COUNT);
            expect(after.declarativeRules).toEqual(before.declarativeRules.filter((rule) => isSafeRule(rule)));
            expect(after.metadata.unsafeRules).toEqual(before.declarativeRules.filter((rule) => !isSafeRule(rule)));

            expect(after.filterContent).toBe(filterText);
            expect(after.lazyMetadata).toEqual(before.lazyMetadata);
            expect(after.metadata.rulesetHashMapRaw).toBe(before.metadata.rulesetHashMapRaw);

            expect(await readChecksum(metadataPath, RULESET_999)).toBe(generateMD5Hash(raw));
        });

        it('is byte-identical on a second run', async () => {
            const dir = await buildRulesets();
            const rulesetPath = path.join(dir, `${RULESET_999}/${RULESET_999}.json`);
            const metadataPath = path.join(dir, 'ruleset_0/ruleset_0.json');

            await excludeUnsafeRules({ dir });
            const firstRun = await fs.readFile(rulesetPath, 'utf-8');
            const firstMetadata = await fs.readFile(metadataPath, 'utf-8');

            await excludeUnsafeRules({ dir });
            const secondRun = await fs.readFile(rulesetPath, 'utf-8');
            const secondMetadata = await fs.readFile(metadataPath, 'utf-8');

            expect(secondRun).toBe(firstRun);
            expect(secondMetadata).toBe(firstMetadata);

            const { declarativeRules, metadata } = parseContent(secondRun, RULESET_999);
            expect(declarativeRules).toHaveLength(SAFE_RULES_COUNT);
            expect(metadata.unsafeRules).toHaveLength(UNSAFE_RULES_COUNT);
        });

        it('is byte-identical on a second run with pretty-printed output', async () => {
            const dir = await buildRulesets();
            const rulesetPath = path.join(dir, `${RULESET_999}/${RULESET_999}.json`);

            // The converter writer throws if a pretty-printed metadata value
            // would exceed the bound, so a successful run proves the bound.
            await excludeUnsafeRules({ dir, prettifyJson: true });
            const firstRun = await fs.readFile(rulesetPath, 'utf-8');

            await excludeUnsafeRules({ dir, prettifyJson: true });
            const secondRun = await fs.readFile(rulesetPath, 'utf-8');

            expect(secondRun).toBe(firstRun);

            const { metadataRulesCount, metadata } = parseContent(secondRun, RULESET_999);
            expect(metadataRulesCount).toBeGreaterThanOrEqual(2);
            expect(metadata.unsafeRules).toHaveLength(UNSAFE_RULES_COUNT);
        });
    });
});
