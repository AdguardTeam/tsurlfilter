/* eslint-disable no-console, no-plusplus */
import { NetworkRuleParser } from '@adguard/agtree';
import console from 'node:console';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { EMPTY_STRING } from '../../src/common/constants';
import { SimpleRegex } from '../../src/rules/simple-regex';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = new URL('.', import.meta.url).pathname;

/**
 * Maximum amount of patterns that will be passed down to benchmark from incoming rule list.
 * Allows to reasonably compare plain and regexp shortcut extraction,
 * when limited number of patterns is available in one of the lists.
 */
const MAX_PATTERNS_COUNT = 320;

const enum FilePath {
    // Rule lists to get patterns from
    AdguardRegexpPatternNetworkRules = '../resources/adguard_regexp_pattern_network_rules.txt',
    EasylistBaseRules = '../resources/easylist.txt',
    // Reference files to compare results with
    RegexpShortcutsReference = '../resources/shortcuts-regexp-reference.txt',
    BasicShortcutsReference = '../resources/shortcuts-basic-reference.txt',
}

/**
 * Reads rule list from file and extracts patterns from it.
 *
 * @param filePath Path to file with rule list.
 *
 * @returns List of patterns extracted from rule list.
 */
const getPatterns = async (filePath: string): Promise<string[]> => {
    // If we run the tests from the Vitest workspace, we need to set the correct path
    // See https://github.com/vitest-dev/vitest/issues/5277
    const rulesString: string = await fs.promises.readFile(path.join(__dirname, filePath), 'utf8');

    const rulesList = rulesString
        .split('\n')
        .filter((r) => !!r && !r.startsWith('!'))
        .map((r) => r.trim());

    const patterns = rulesList
        .map((r) => NetworkRuleParser.parse(r)?.pattern.value ?? EMPTY_STRING)
        .filter((pattern) => !!pattern)
        .slice(0, MAX_PATTERNS_COUNT);

    return patterns;
};

/**
 * Calculates memory usage difference between current and base values.
 *
 * @param base Base memory usage values.
 *
 * @returns Memory usage difference.
 */
function memoryUsage(base = { heapUsed: 0, heapTotal: 0 }) {
    let { heapUsed, heapTotal } = process.memoryUsage();

    heapUsed -= base.heapUsed;
    heapTotal -= base.heapTotal;

    return ({ heapUsed, heapTotal });
}

/**
 * Validates extracted shortcuts against reference file.
 *
 * @param patterns List of patterns to extract shortcuts from.
 * @param referencePath Path to reference file.
 *
 * @throws Error if extracted shortcuts are not equal to reference.
 */
const validateExtraction = async (
    patterns: string[],
    referencePath: string,
): Promise<void> => {
    const shortcuts = patterns.map((pattern) => SimpleRegex.extractShortcut(pattern));

    const reference = await fs.promises
        // If we run the tests from the Vitest workspace, we need to set the correct path
        // See https://github.com/vitest-dev/vitest/issues/5277
        .readFile(path.join(__dirname, referencePath), 'utf8')
        .then((r: string) => r.split('\n'))
        .then((r: string[]) => r.filter((s) => !s.startsWith('!')));

    if (shortcuts.length !== reference.length) {
        throw new Error('Result length is not equal to reference.');
    }

    for (let i = 0; i < shortcuts.length; i += 1) {
        if (shortcuts[i] === reference[i]) {
            continue;
        }
        console.log(`Validation failed at line ${i + 1}`);
        console.log(`Expected: ${reference[i] || '\'\''}`);
        console.log(`Actual: ${shortcuts[i]}`);

        throw new Error('Result is not equal to reference.');
    }
};

/**
 * Runs benchmark for given patterns.
 *
 * @param title Title to print before benchmark results.
 * @param patterns List of patterns to extract shortcuts from.
 */
const runBench = async (
    title: string,
    patterns: string[],
) => {
    const initMemory = memoryUsage();
    const start = Date.now();

    let batchesCount = 3000;
    while (batchesCount--) {
        for (let i = 0; i < patterns.length - 1; i += 1) {
            SimpleRegex.extractShortcut(patterns[i]);
        }
    }

    const finalMemory = memoryUsage(initMemory);
    const elapsed = Date.now() - start;

    console.log(`\n${title}\n`);
    console.log(`Total patterns parsed: ${patterns.length}`);
    console.log(`Elapsed overall, ms: ${elapsed}`);
    console.log(`Average per pattern, ms: ${elapsed / patterns.length}`);
    console.log(`Heap growth, kB total: ${finalMemory.heapTotal}`);
    console.log(`Heap growth, kB used: ${finalMemory.heapUsed}`);
};

// TODO: Consider using Vitest benchmark feature: https://vitest.dev/guide/features#benchmarking
describe('Benchmarks', () => {
    it('runs SimpleRegex.extractRegexpShortcut', async () => {
        const patterns = await getPatterns(FilePath.AdguardRegexpPatternNetworkRules);

        await expect(
            validateExtraction(patterns, FilePath.RegexpShortcutsReference),
        ).resolves.not.toThrow();

        await runBench('SimpleRegex.extractRegexpShortcut:', patterns);
    });

    it('runs SimpleRegex.extractShortcut', async () => {
        const patterns = await getPatterns(FilePath.EasylistBaseRules);

        await expect(
            validateExtraction(patterns, FilePath.BasicShortcutsReference),
        ).resolves.not.toThrow();

        await runBench('SimpleRegex.extractRegexpShortcut:', patterns);
    });
});
