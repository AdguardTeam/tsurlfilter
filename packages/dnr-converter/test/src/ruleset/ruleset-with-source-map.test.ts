import {
    describe,
    expect,
    it,
    type MockInstance,
    vi,
} from 'vitest';

import { type DeclarativeRule, RuleActionType } from '../../../src/declarative-rule';
import { type IFilter } from '../../../src/filter/types';
import { OPTION_NAMES } from '../../../src/rule/option-names';
import { Rule } from '../../../src/rule/rule';
import { RulesConverter } from '../../../src/rule-converters/rules-converter';
import { RulesScanner, type ScannedFilter } from '../../../src/rules-scanner';
import { type HashWithSource, RulesHashMap } from '../../../src/ruleset/rules-hash-map';
import {
    type RulesetContentProvider,
    RulesetWithSourceMap,
    type SerializedRulesetData,
} from '../../../src/ruleset/ruleset-with-source-map';
import { SourceMap } from '../../../src/ruleset/source-map';
import { createRuleMock } from '../../mocks/rule';

/**
 * Creates a test IFilter from an array of rule strings.
 *
 * @param rules Array of rule text strings.
 * @param filterId Filter list ID.
 *
 * @returns IFilter mock.
 */
const createFilter = (rules: string[], filterId = 0): IFilter => {
    const content = rules.join('\n');

    return {
        getId: () => filterId,
        getRuleByIndex: async (index: number) => {
            // The index is the character offset from FilterListParser.
            // Find the line that starts at `index`.
            const lines = content.split('\n');
            let offset = 0;
            for (const line of lines) {
                if (offset === index) {
                    return line;
                }
                offset += line.length + 1; // +1 for '\n'
            }
            throw new Error(`No rule at index ${index}`);
        },
        getContent: async (): Promise<string> => content,
        unloadContent: () => {},
    };
};

/**
 * Creates a ScannedFilter array from rule strings.
 *
 * @param contentLines Rule text strings.
 * @param filterId Filter list ID.
 *
 * @returns ScannedFilter array.
 */
const createScannedFilters = async (contentLines: string[], filterId = 0): Promise<ScannedFilter[]> => {
    const filter = createFilter(contentLines, filterId);
    const { filters } = await RulesScanner.scanFilters([filter]);
    return filters;
};

/**
 * Creates a Ruleset from rule strings.
 *
 * @param contentLines Rule text strings.
 * @param filterId Filter list ID.
 * @param unsafeRulesCount Number of converted rules to mark as unsafe. When
 * greater than 0, the first N declarative rules are reused (with an unsafe
 * redirect action and the same ids) so the id-based exclusion in
 * `serializeCompact()` removes the corresponding declarative rules.
 *
 * @returns Ruleset instance.
 */
const createRuleset = async (
    contentLines: string[],
    filterId = 0,
    unsafeRulesCount = 0,
): Promise<RulesetWithSourceMap> => {
    const filter = createFilter(contentLines, filterId);

    const { filters } = await RulesScanner.scanFilters([filter]);
    const [scannedStaticFilter] = filters;
    const { badFilterRules } = scannedStaticFilter;

    const {
        sourceMapValues,
        declarativeRules,
    } = await RulesConverter.convert(filters);

    // Derive unsafe rules from the converted declarative rules when requested.
    // Reuse the rules' ids (with an unsafe redirect action) so the id-based
    // exclusion in serializeCompact() removes the corresponding rules from the
    // serialized declarative list.
    const unsafeRules: DeclarativeRule[] = unsafeRulesCount > 0
        ? declarativeRules.slice(0, unsafeRulesCount).map((rule) => ({
            ...rule,
            action: {
                type: RuleActionType.Redirect,
                redirect: { extensionPath: '/redirect.js' },
            },
        }))
        : [];

    const rulesetContent: RulesetContentProvider = {
        loadSourceMap: async () => new SourceMap(sourceMapValues),
        loadFilterList: async () => [filter],
        loadDeclarativeRules: async () => declarativeRules,
    };

    const listOfRulesWithHash: HashWithSource[] = filters
        .flatMap(({ id, rules }) => {
            return rules.map((r) => ({
                hash: r.hash,
                source: {
                    sourceRuleIndex: r.index,
                    filterId: id,
                },
            }));
        });

    const rulesHashMap = new RulesHashMap(listOfRulesWithHash);

    return new RulesetWithSourceMap(
        'rulesetId',
        declarativeRules.length,
        unsafeRulesCount,
        declarativeRules.filter((d) => RulesConverter.isRegexRule(d)).length,
        rulesetContent,
        badFilterRules,
        rulesHashMap,
        unsafeRules,
    );
};

describe('Ruleset', () => {
    it('returns counters correctly', async () => {
        const content = [
            '||example.com^$document',
            '@@||example.io^',
        ];

        const ruleset = await createRuleset(content);

        expect(ruleset.getSafeRulesCount()).toStrictEqual(2);
    });

    it('returns bad filter rules from constructor', () => {
        const badFilterRule = createRuleMock({
            pattern: '||evil.com^',
            enabledOptions: [OPTION_NAMES.BADFILTER],
        });

        const rulesetContent: RulesetContentProvider = {
            loadSourceMap: async () => new SourceMap([]),
            loadFilterList: async () => [],
            loadDeclarativeRules: async () => [],
        };

        const ruleset = new RulesetWithSourceMap(
            'testId',
            0,
            0,
            0,
            rulesetContent,
            [badFilterRule],
            new RulesHashMap([]),
            [],
        );

        expect(ruleset.getBadFilterRules()).toHaveLength(1);
        expect(ruleset.getBadFilterRules()[0]).toBe(badFilterRule);
    });

    it('returns original rule by declarative and declarative rule by source rule correctly', async () => {
        const content = [
            '||example.com##h1',
            '||example.net##h2',
            '@@||example.io^',
        ];

        const sourceRuleIndex = 2;
        const filterId = 99;

        const scannedFilters = await createScannedFilters(content, filterId);
        const [scannedFilter] = scannedFilters;

        const ruleset = await createRuleset(content, filterId);

        expect(ruleset.getSafeRulesCount()).toStrictEqual(1);

        const [declarativeRule] = await ruleset.getDeclarativeRules();
        const originalRules = await ruleset.getRulesById(declarativeRule.id);
        expect(originalRules[0].sourceRule).toStrictEqual(content[sourceRuleIndex]);

        const declarativeRulesIds = await ruleset.getDeclarativeRulesIdsBySourceRuleIndex({
            sourceRuleIndex: scannedFilter.rules[0]?.index,
            filterId,
        });
        expect(declarativeRulesIds[0]).toStrictEqual(declarativeRule.id);
    });

    it('serializes and deserializes', async () => {
        const content = [
            '||example.com^$document',
            '||example.net##h2',
            '@@||example.io^',
            '@@||evil.com^$badfilter',
        ];
        const filterId = 99;

        const originalFilter = createFilter(content, filterId);

        const scannedFilters = await createScannedFilters(content, filterId);
        const [scannedFilter] = scannedFilters;
        const badFilterRuleIndex = scannedFilter.rules[2].index;

        const ruleset = await createRuleset(content, filterId);

        // Produce the compact ruleset and extract the metadata envelope that
        // deserialize() expects, mirroring the production reader in
        // dnr-rulesets/src/lib/unsafe-rules/ruleset-deserialize.ts.
        const compactOutput = await ruleset.serializeCompact([], true);
        const parsedRuleset = JSON.parse(compactOutput) as DeclarativeRule[];
        // The first element is the metadata rule whose `metadata` key
        // carries the `metadata` (SerializedRulesetData) and `lazyMetadata`
        // (SerializedRulesetLazyData) envelopes.
        const metadataRule = parsedRuleset[0] as unknown as {
            metadata: {
                metadata: unknown;
                lazyMetadata: unknown;
            };
        };
        const { metadata, lazyMetadata } = metadataRule.metadata;

        const {
            data: {
                regexpRulesCount,
                unsafeRulesCount,
                safeRulesCount,
                rulesetHashMapRaw,
                badFilterRulesRaw,
                unsafeRules,
            },
            rulesetContentProvider,
        } = await RulesetWithSourceMap.deserialize(
            ruleset.getId(),
            JSON.stringify(metadata),
            async () => JSON.stringify(lazyMetadata),
            async () => JSON.stringify(parsedRuleset.slice(1)),
            [originalFilter],
        );

        const sources = RulesHashMap.deserializeSources(rulesetHashMapRaw);
        const rulesetHashMap = new RulesHashMap(sources);
        const badFilterRules = badFilterRulesRaw
            .flatMap(
                (rawString) => Rule.createFromText(
                    filterId,
                    badFilterRuleIndex,
                    rawString,
                ),
            );

        const deserializedRuleset = new RulesetWithSourceMap(
            ruleset.getId(),
            safeRulesCount,
            unsafeRulesCount,
            regexpRulesCount,
            rulesetContentProvider,
            badFilterRules,
            rulesetHashMap,
            unsafeRules,
        );

        // check $badfilter rules
        expect(deserializedRuleset.getBadFilterRules()).toHaveLength(ruleset.getBadFilterRules().length);
        expect(deserializedRuleset.getBadFilterRules()[0].getText())
            .toEqual(ruleset.getBadFilterRules()[0].getText());

        // check declarative rules
        const d1 = await ruleset.getDeclarativeRules();
        const d2 = await deserializedRuleset.getDeclarativeRules();
        expect(d1).toStrictEqual(d2);

        // check counters
        expect(deserializedRuleset.getSafeRulesCount()).toStrictEqual(ruleset.getSafeRulesCount());

        // check source map works
        const [dRuleId] = await deserializedRuleset.getDeclarativeRulesIdsBySourceRuleIndex({
            sourceRuleIndex: scannedFilter.rules[1]?.index,
            filterId,
        });
        expect(d2.find((d) => d.id === dRuleId)).toStrictEqual(d1[1]);
    });

    it('unloads content correctly', async () => {
        const content = [
            '||example.com^$document',
            '||example.net##h1',
            '@@||example.io^',
        ];

        const ruleset = await createRuleset(content);

        // Load content
        await ruleset.getDeclarativeRules();
        expect(Object.getOwnPropertyDescriptor(ruleset, 'contentLoader')?.value.isLoaded()).toBe(true);
        expect(Object.getOwnPropertyDescriptor(ruleset, 'filterList')?.value.size).toBeGreaterThan(0);
        expect(Object.getOwnPropertyDescriptor(ruleset, 'sourceMap')?.value).not.toBeUndefined();

        // Unload content
        ruleset.unloadContent();
        expect(Object.getOwnPropertyDescriptor(ruleset, 'contentLoader')?.value.isLoaded()).toBe(false);
        expect(Object.getOwnPropertyDescriptor(ruleset, 'filterList')?.value.size).toBe(0);
        expect(Object.getOwnPropertyDescriptor(ruleset, 'sourceMap')?.value).toBeUndefined();
    });

    it('does not return stale content after unload', async () => {
        const content = [
            '||example.com^$document',
            '||example.net##h1',
            '@@||example.io^',
        ];

        const ruleset = await createRuleset(content);

        // Load content
        await ruleset.getDeclarativeRules();
        expect(Object.getOwnPropertyDescriptor(ruleset, 'contentLoader')?.value.isLoaded()).toBe(true);

        // Unload content
        ruleset.unloadContent();
        expect(Object.getOwnPropertyDescriptor(ruleset, 'contentLoader')?.value.isLoaded()).toBe(false);

        // Reload content after unloading
        await ruleset.getDeclarativeRules();
        expect(Object.getOwnPropertyDescriptor(ruleset, 'contentLoader')?.value.isLoaded()).toBe(true);
    });

    it('waits for initialization before unloading', async () => {
        let resolveInit: () => void;
        const initPromise = new Promise<void>((resolve) => {
            resolveInit = resolve;
        });

        const rulesetContent: RulesetContentProvider = {
            loadSourceMap: async () => {
                await initPromise;
                return new SourceMap([]);
            },
            loadFilterList: async () => [],
            loadDeclarativeRules: async () => [],
        };

        const ruleset = new RulesetWithSourceMap(
            'testRuleset',
            0,
            0,
            0,
            rulesetContent,
            [],
            new RulesHashMap([]),
            [],
        );

        // Start loading content
        const loadPromise = ruleset.getDeclarativeRules();

        // Call unloadContent while loading is still in progress
        ruleset.unloadContent();

        // Resolve the initialization
        resolveInit!();
        await loadPromise;

        // Ensure that content is still correctly unloaded after the fetch completes
        expect(Object.getOwnPropertyDescriptor(ruleset, 'contentLoader')?.value.isLoaded()).toBe(false);
        expect(Object.getOwnPropertyDescriptor(ruleset, 'sourceMap')?.value).toBeUndefined();
    });

    it('ensures filterList filters are unloaded', async () => {
        const content = [
            '||example.com^$document',
            '||example.net##h1',
            '@@||example.io^',
        ];

        const ruleset = await createRuleset(content);
        await ruleset.getDeclarativeRules();

        // Mock `unloadContent` for all filters
        const unloadSpies: MockInstance<IFilter['unloadContent']>[] = [];

        Object.getOwnPropertyDescriptor(ruleset, 'filterList')?.value.forEach((filter: IFilter) => {
            const spy = vi.spyOn(filter, 'unloadContent');
            unloadSpies.push(spy);
        });

        ruleset.unloadContent();

        // Ensure all filters' `unloadContent` methods were called
        unloadSpies.forEach((spy) => expect(spy).toHaveBeenCalled());

        // Ensure filterList is cleared
        expect(Object.getOwnPropertyDescriptor(ruleset, 'filterList')?.value.size).toBe(0);
    });

    it('returns rules hash map', async () => {
        const content = [
            '||example.com^$document',
            '@@||example.io^',
        ];

        const ruleset = await createRuleset(content);
        const hashMap = ruleset.getRulesHashMap();

        expect(hashMap).toBeDefined();
        expect(hashMap.serialize()).toBeTruthy();
    });

    it('returns rule set id', async () => {
        const content = ['||example.com^$document'];

        const ruleset = await createRuleset(content);
        expect(ruleset.getId()).toBe('rulesetId');
    });

    it('does not expose the deprecated serialize() method', async () => {
        const content = ['||example.com^$document'];
        const ruleset = await createRuleset(content);

        // The deprecated serialize() method must be removed from the public
        // API; only serializeCompact() remains.
        expect((ruleset as unknown as Record<string, unknown>).serialize).toBeUndefined();
        expect(typeof ruleset.serializeCompact).toBe('function');
    });

    describe('getRuleBySourceRule', () => {
        it('returns network rules for valid source rule', () => {
            const rules = RulesetWithSourceMap.getRuleBySourceRule({
                sourceRule: '||example.com^',
                filterId: 1,
            });

            expect(rules).toHaveLength(1);
            expect(rules[0].pattern).toBe('||example.com^');
        });

        it('returns empty array for invalid source rule', () => {
            const rules = RulesetWithSourceMap.getRuleBySourceRule({
                sourceRule: '!this is a comment, not a rule',
                filterId: 1,
            });

            expect(rules).toHaveLength(0);
        });

        it('returns empty array for cosmetic rules', () => {
            const rules = RulesetWithSourceMap.getRuleBySourceRule({
                sourceRule: '##.ad-banner',
                filterId: 1,
            });

            expect(rules).toHaveLength(0);
        });
    });

    describe('deserialize', () => {
        it('throws when unsafeRules is missing from the data', async () => {
            // unsafeRules is now a required field; metadata omitting it must fail
            // validation with a descriptive error.
            const dataWithoutUnsafeRules = {
                regexpRulesCount: 0,
                unsafeRulesCount: 0,
                safeRulesCount: 0,
                rulesetHashMapRaw: '[]',
                badFilterRulesRaw: [],
                // unsafeRules intentionally omitted
            };

            await expect(
                RulesetWithSourceMap.deserialize(
                    'testId',
                    JSON.stringify(dataWithoutUnsafeRules),
                    async () => '{}',
                    async () => '[]',
                    [],
                ),
            ).rejects.toThrow();
        });

        it('throws on invalid data', async () => {
            await expect(
                RulesetWithSourceMap.deserialize(
                    'testId',
                    'invalid-json{{{',
                    async () => '{}',
                    async () => '[]',
                    [],
                ),
            ).rejects.toThrow();
        });

        it('throws on invalid lazy data', async () => {
            const validData: SerializedRulesetData = {
                regexpRulesCount: 0,
                unsafeRulesCount: 0,
                safeRulesCount: 0,
                rulesetHashMapRaw: '[]',
                badFilterRulesRaw: [],
                unsafeRules: [],
            };

            const { rulesetContentProvider } = await RulesetWithSourceMap.deserialize(
                'testId',
                JSON.stringify(validData),
                async () => 'not-valid-json{{',
                async () => '[]',
                [],
            );

            // Accessing lazy data should throw
            await expect(rulesetContentProvider.loadSourceMap()).rejects.toThrow();
        });
    });

    describe('serializeCompact', () => {
        it('serializes compact output', async () => {
            const content = [
                '||example.com^$document',
                '@@||example.io^',
            ];

            const ruleset = await createRuleset(content);
            const compactOutput = await ruleset.serializeCompact([], true);

            expect(compactOutput).toBeTruthy();
            const parsed = JSON.parse(compactOutput) as DeclarativeRule[];
            // Should contain metadata rule + declarative rules
            expect(parsed.length).toBeGreaterThan(0);
        });

        it('serializes compact output with non-empty unsafe rules and excludes them', async () => {
            // Regression guard for the non-empty `unsafeRules` path of
            // `serializeCompact()` — used by the unsafe-rule post-pass in
            // `@adguard/dnr-rulesets`, where `unsafeRules.length > 0` triggers
            // the count validation and the declarative-rule exclusion.
            const content = [
                '||example.com^$document',
                '||test.com^$document',
                '@@||example.io^',
            ];

            const unsafeRulesCount = 2;
            const ruleset = await createRuleset(content, 0, unsafeRulesCount);

            // The unsafe rules are stored on the rule set; pass them back to
            // `serializeCompact()` the same way the production post-pass does.
            const unsafeRules = await ruleset.getUnsafeRules();

            // 1. Count validation accepts the non-empty array (length ===
            //    unsafeRulesCount) — a mismatch would throw before producing
            //    output.
            const compactOutput = await ruleset.serializeCompact(unsafeRules, true);

            expect(compactOutput).toBeTruthy();
            // The compact output's first rule is the metadata rule, whose
            // `metadata` key holds `{ metadata: SerializedRulesetData, ... }`.
            type ParsedRule = DeclarativeRule & {
                metadata?: { metadata?: SerializedRulesetData };
            };
            const parsed = JSON.parse(compactOutput) as ParsedRule[];

            // 2. The compact output metadata rule (first rule) contains the
            //    unsafe-rule entries.
            const metadataRule = parsed[0];
            const serializedData = metadataRule.metadata?.metadata;
            expect(serializedData).toBeDefined();
            expect(serializedData?.unsafeRulesCount).toBe(unsafeRulesCount);
            expect(serializedData?.unsafeRules).toHaveLength(unsafeRulesCount);
            const unsafeIds = unsafeRules.map((r) => r.id);
            const metadataUnsafeIds = serializedData?.unsafeRules?.map((r) => r.id) ?? [];
            expect(metadataUnsafeIds).toEqual(expect.arrayContaining(unsafeIds));

            // 3. The excluded unsafe rules are removed from the serialized
            //    declarative rules array (every rule after the metadata rule).
            const outputDeclarativeRules = parsed.slice(1);
            const unsafeIdsSet = new Set(unsafeIds);
            expect(outputDeclarativeRules.every((r) => !unsafeIdsSet.has(r.id))).toBe(true);
        });
    });
});
