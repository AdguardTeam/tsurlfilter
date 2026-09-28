import {
    describe,
    expect,
    it,
    type MockInstance,
    vi,
} from 'vitest';

import { type DeclarativeRule, RuleActionType } from '../../../src/declarative-rule';
import { UnavailableRulesetSourceError } from '../../../src/errors/unavailable-sources-errors';
import { type IFilter } from '../../../src/filter/types';
import { OPTION_NAMES } from '../../../src/rule/option-names';
import { Rule } from '../../../src/rule/rule';
import { RulesConverter } from '../../../src/rule-converters/rules-converter';
import { RulesScanner, type ScannedFilter } from '../../../src/rules-scanner';
import { parseCompactRuleset } from '../../../src/ruleset/compact-ruleset';
import { type HashWithSource, RulesHashMap } from '../../../src/ruleset/rules-hash-map';
import {
    type RulesetContentProvider,
    RulesetWithSourceMap,
    type SerializedRulesetData,
} from '../../../src/ruleset/ruleset-with-source-map';
import { SourceMap } from '../../../src/ruleset/source-map';
import { expectMetadataValuesWithinBound } from '../../mocks/metadata-rule';
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

/**
 * Rebuilds a ruleset from compact output through `deserialize()` and the
 * constructor, as tswebextension does from IndexedDB. It is the reference
 * that `fromCompact()` is compared against.
 *
 * @param compactOutput Output of `serializeCompact()`.
 * @param filter Source filter of the ruleset.
 *
 * @returns Restored ruleset.
 */
const restoreFromCompact = async (compactOutput: string, filter: IFilter): Promise<RulesetWithSourceMap> => {
    const id = 'rulesetId';
    const { metadata, lazyMetadata, declarativeRules } = parseCompactRuleset(id, JSON.parse(compactOutput));

    const { data, rulesetContentProvider } = await RulesetWithSourceMap.deserialize(
        id,
        JSON.stringify(metadata),
        async () => JSON.stringify(lazyMetadata),
        async () => JSON.stringify(declarativeRules),
        [filter],
    );

    return new RulesetWithSourceMap(
        id,
        data.safeRulesCount,
        data.unsafeRulesCount,
        data.regexpRulesCount,
        rulesetContentProvider,
        data.badFilterRulesRaw.flatMap((raw) => Rule.createFromText(filter.getId(), 0, raw)),
        new RulesHashMap(RulesHashMap.deserializeSources(data.rulesetHashMapRaw)),
        data.unsafeRules,
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
        // Not read from a ruleset file, so there are no metadata rules.
        expect(ruleset.getMetadataRulesCount()).toStrictEqual(0);
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

        const ruleset = await createRuleset(content, filterId);

        // Produce the compact ruleset and read it back with the public
        // reader, mirroring the production consumers.
        const compactOutput = await ruleset.serializeCompact([], true);

        expect(parseCompactRuleset(ruleset.getId(), JSON.parse(compactOutput)).metadataRulesCount)
            .toBeGreaterThanOrEqual(1);

        const deserializedRuleset = await restoreFromCompact(compactOutput, originalFilter);

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

            const parsed = parseCompactRuleset(ruleset.getId(), JSON.parse(compactOutput));

            expect(parsed.metadataRulesCount).toBe(1);
            expect(parsed.filterContent).toBe(content.join('\n'));
            expect(parsed.declarativeRules).toStrictEqual(await ruleset.getDeclarativeRules());
            expect(parsed.metadata.safeRulesCount).toBe(ruleset.getSafeRulesCount());
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
            const unsafeRules = await ruleset.getUnsafeRules();

            const compactOutput = await ruleset.serializeCompact(unsafeRules, true);
            const parsed = parseCompactRuleset(ruleset.getId(), JSON.parse(compactOutput));

            expect(parsed.metadata.unsafeRulesCount).toBe(unsafeRulesCount);
            expect(parsed.metadata.unsafeRules).toHaveLength(unsafeRulesCount);

            const unsafeIds = unsafeRules.map((r) => r.id);
            expect(parsed.metadata.unsafeRules.map((r) => r.id)).toEqual(expect.arrayContaining(unsafeIds));

            const unsafeIdsSet = new Set(unsafeIds);
            expect(parsed.declarativeRules.every((r) => !unsafeIdsSet.has(r.id))).toBe(true);
        });

        it('splits large metadata into several metadata rules within the bound', async () => {
            const content = Array.from({ length: 6000 }, (_, i) => `||example${i}.com^`);
            const ruleset = await createRuleset(content);
            const declarativeRules = await ruleset.getDeclarativeRules();
            const ordinaryIds = new Set(declarativeRules.map((r) => r.id));

            for (const pretty of [false, true]) {
                // eslint-disable-next-line no-await-in-loop
                const compactOutput = await ruleset.serializeCompact([], pretty);
                const rules = JSON.parse(compactOutput) as DeclarativeRule[];
                const parsed = parseCompactRuleset(ruleset.getId(), rules);

                expect(parsed.metadataRulesCount).toBeGreaterThan(1);
                expectMetadataValuesWithinBound(compactOutput, pretty);

                for (const rule of rules.slice(0, parsed.metadataRulesCount)) {
                    expect(ordinaryIds.has(rule.id)).toBe(false);
                }

                const allIds = rules.map((r) => r.id);
                expect(new Set(allIds).size).toBe(allIds.length);
                expect(parsed.filterContent).toBe(content.join('\n'));
                expect(parsed.declarativeRules).toStrictEqual(declarativeRules);
            }
        });

        it('gives metadata rules the smallest ids not used by ordinary or unsafe rules', async () => {
            /**
             * Builds a block rule with the given id.
             *
             * @param id Rule id.
             *
             * @returns Declarative rule.
             */
            const makeRule = (id: number): DeclarativeRule => {
                return {
                    id,
                    action: { type: RuleActionType.Block },
                    condition: { urlFilter: `||example${id}.com^` },
                };
            };
            const declarativeRules = [makeRule(1), makeRule(2), makeRule(4)];
            const unsafeRule: DeclarativeRule = {
                ...makeRule(1),
                action: {
                    type: RuleActionType.Redirect,
                    redirect: { extensionPath: '/redirect.js' },
                },
            };
            const filter = createFilter(['||example1.com^']);
            const ruleset = new RulesetWithSourceMap(
                'rulesetId',
                2,
                1,
                0,
                {
                    loadSourceMap: async () => new SourceMap([]),
                    loadFilterList: async () => [filter],
                    loadDeclarativeRules: async () => declarativeRules,
                },
                [],
                new RulesHashMap([]),
                [unsafeRule],
            );

            const parsed = JSON.parse(await ruleset.serializeCompact([unsafeRule], false)) as DeclarativeRule[];

            // Ordinary ids after excluding the unsafe rule: 2, 4; unsafe: 1.
            // The single metadata rule takes 3 and ordinary ids are untouched.
            expect(parsed.map((r) => r.id)).toEqual([3, 2, 4]);
        });

        it.each([
            [['dummy.rule.adguard.com', '||example.com^']],
            [['||example.com^', 'dummy.rule.adguard.com']],
        ])('keeps an ordinary rule whose urlFilter equals the metadata marker (%j)', async (content) => {
            const ruleset = await createRuleset(content);
            const declarativeRules = await ruleset.getDeclarativeRules();

            const parsed = parseCompactRuleset(ruleset.getId(), JSON.parse(await ruleset.serializeCompact([], false)));

            expect(parsed.metadataRulesCount).toBe(1);
            expect(parsed.declarativeRules).toHaveLength(2);
            expect(parsed.declarativeRules).toStrictEqual(declarativeRules);
            expect(parsed.declarativeRules.some((rule) => rule.condition.urlFilter === 'dummy.rule.adguard.com'))
                .toBe(true);
        });

        it('is deterministic and does not mutate the ruleset', async () => {
            const ruleset = await createRuleset(['||example.com^', '||example.org^']);
            const before = await ruleset.getDeclarativeRules();

            const first = await ruleset.serializeCompact([], true);
            const second = await ruleset.serializeCompact([], true);

            expect(second).toBe(first);
            expect(await ruleset.getDeclarativeRules()).toBe(before);
        });

        it('re-serializes a restored ruleset within the bound and stays stable on repeated post-passes', async () => {
            const content = [
                '||example.com^$document',
                '||test.com^$document',
                '@@||example.io^',
            ];
            const filter = createFilter(content);
            const ruleset = await createRuleset(content, 0, 2);
            const unsafeRules = await ruleset.getUnsafeRules();
            const id = ruleset.getId();

            const first = await ruleset.serializeCompact(unsafeRules, false);
            const restoredOnce = await restoreFromCompact(first, filter);
            const second = await restoredOnce.serializeCompact(await restoredOnce.getUnsafeRules(), false);
            const restoredTwice = await restoreFromCompact(second, filter);
            const third = await restoredTwice.serializeCompact(await restoredTwice.getUnsafeRules(), false);

            // Same content after the first post-pass (valibot may reorder keys
            // inside `unsafeRules`, which toEqual ignores) ...
            expect(parseCompactRuleset(id, JSON.parse(second))).toEqual(parseCompactRuleset(id, JSON.parse(first)));
            // ... and identical bytes from then on.
            expect(third).toBe(second);
            expectMetadataValuesWithinBound(second, false);
        });
    });

    describe('fromDeserialized', () => {
        const content = [
            '||example.com^$document',
            '@@||example.io^',
            '@@||evil.com^$badfilter',
        ];

        it('builds the same ruleset as calling the constructor by hand', async () => {
            const filter = createFilter(content);
            const ruleset = await createRuleset(content);
            const compactOutput = await ruleset.serializeCompact([], false);
            const { metadata, lazyMetadata, declarativeRules } = parseCompactRuleset(
                'rulesetId',
                JSON.parse(compactOutput),
            );

            const expected = await restoreFromCompact(compactOutput, filter);
            const actual = RulesetWithSourceMap.fromDeserialized(await RulesetWithSourceMap.deserialize(
                'rulesetId',
                JSON.stringify(metadata),
                async () => JSON.stringify(lazyMetadata),
                async () => JSON.stringify(declarativeRules),
                [filter],
            ), 3);

            expect(actual.getId()).toBe('rulesetId');
            expect(actual.getMetadataRulesCount()).toBe(3);
            expect(actual.getSafeRulesCount()).toBe(expected.getSafeRulesCount());
            expect(actual.getUnsafeRulesCount()).toBe(expected.getUnsafeRulesCount());
            expect(actual.getRegexpRulesCount()).toBe(expected.getRegexpRulesCount());
            expect(await actual.getUnsafeRules()).toStrictEqual(await expected.getUnsafeRules());
            expect(actual.getBadFilterRules().map((r) => r.getText()))
                .toEqual(expected.getBadFilterRules().map((r) => r.getText()));
            expect(actual.getBadFilterRules()).toHaveLength(1);
            expect(actual.getRulesHashMap().serialize()).toBe(expected.getRulesHashMap().serialize());
            expect(await actual.getDeclarativeRules()).toStrictEqual(await expected.getDeclarativeRules());
            expect(await actual.serializeCompact([], false)).toBe(await expected.serializeCompact([], false));
        });
    });

    describe('fromCompact', () => {
        const content = [
            '||example.com^$document',
            '||example.net##h2',
            '@@||example.io^',
            '@@||evil.com^$badfilter',
            '||test.com^$redirect=noopjs',
        ];

        it('builds the same ruleset as the deserialize path', async () => {
            const filter = createFilter(content);
            const ruleset = await createRuleset(content, 0, 1);
            const compactOutput = await ruleset.serializeCompact(await ruleset.getUnsafeRules(), true);

            const expected = await restoreFromCompact(compactOutput, filter);
            const parsed = parseCompactRuleset('rulesetId', JSON.parse(compactOutput));
            const actual = RulesetWithSourceMap.fromCompact('rulesetId', parsed, [filter]);

            expect(actual.getId()).toBe('rulesetId');
            expect(actual.getMetadataRulesCount()).toBe(parsed.metadataRulesCount);
            expect(actual.getSafeRulesCount()).toBe(expected.getSafeRulesCount());
            expect(actual.getUnsafeRulesCount()).toBe(expected.getUnsafeRulesCount());
            expect(actual.getRegexpRulesCount()).toBe(expected.getRegexpRulesCount());
            expect(await actual.getUnsafeRules()).toStrictEqual(await expected.getUnsafeRules());
            expect(actual.getBadFilterRules().map((r) => r.getText()))
                .toEqual(expected.getBadFilterRules().map((r) => r.getText()));
            expect(actual.getRulesHashMap().serialize()).toBe(expected.getRulesHashMap().serialize());

            const declarativeRules = await actual.getDeclarativeRules();
            expect(declarativeRules).toStrictEqual(await expected.getDeclarativeRules());

            for (const { id } of declarativeRules) {
                // eslint-disable-next-line no-await-in-loop
                expect(await actual.getRulesById(id)).toStrictEqual(await expected.getRulesById(id));
            }

            // A post-pass over the result writes the same bytes as the
            // deserialize path, byte for byte.
            const actualOutput = await actual.serializeCompact(await actual.getUnsafeRules(), true);
            expect(actualOutput).toBe(await expected.serializeCompact(await expected.getUnsafeRules(), true));

            // Guard against a vacuous pass: the fresh build writes rules in
            // converter key order, and both paths normalize them to the
            // schema key order. If fromCompact returned the input objects,
            // the bytes above would differ.
            const [freshRule] = parseCompactRuleset('rulesetId', JSON.parse(compactOutput)).declarativeRules;
            const [writtenRule] = parseCompactRuleset('rulesetId', JSON.parse(actualOutput)).declarativeRules;
            expect(Object.keys(freshRule)).not.toEqual(Object.keys(writtenRule));
            expect(Object.keys(writtenRule).slice(0, 3)).toEqual(['action', 'condition', 'id']);

            const [freshUnsafe] = parseCompactRuleset('rulesetId', JSON.parse(compactOutput)).metadata.unsafeRules;
            const [writtenUnsafe] = await actual.getUnsafeRules();
            expect(Object.keys(freshUnsafe)).not.toEqual(Object.keys(writtenUnsafe));
        });

        it('does not serialize the parsed content back to strings', async () => {
            const filter = createFilter(content);
            const ruleset = await createRuleset(content);
            const parsed = parseCompactRuleset('rulesetId', JSON.parse(await ruleset.serializeCompact([], false)));
            const stringifySpy = vi.spyOn(JSON, 'stringify');

            try {
                const restored = RulesetWithSourceMap.fromCompact('rulesetId', parsed, [filter]);
                await restored.getDeclarativeRules();

                const stringified = stringifySpy.mock.calls.map(([value]) => value);
                expect(stringified).not.toContain(parsed.metadata);
                expect(stringified).not.toContain(parsed.lazyMetadata);
                expect(stringified).not.toContain(parsed.declarativeRules);
            } finally {
                stringifySpy.mockRestore();
            }
        });

        it('throws UnavailableRulesetSourceError on invalid metadata', async () => {
            const ruleset = await createRuleset(content);
            const parsed = parseCompactRuleset('rulesetId', JSON.parse(await ruleset.serializeCompact([], false)));
            const { unsafeRules, ...metadataWithoutUnsafeRules } = parsed.metadata;

            expect(unsafeRules).toEqual([]);
            expect(() => RulesetWithSourceMap.fromCompact(
                'rulesetId',
                { ...parsed, metadata: metadataWithoutUnsafeRules as SerializedRulesetData },
                [createFilter(content)],
            )).toThrow(UnavailableRulesetSourceError);
        });

        it('rejects lazy loads of invalid lazy metadata or declarative rules', async () => {
            const ruleset = await createRuleset(content);
            const parsed = parseCompactRuleset('rulesetId', JSON.parse(await ruleset.serializeCompact([], false)));
            const [firstRule] = parsed.declarativeRules;

            const withBadLazyData = RulesetWithSourceMap.fromCompact(
                'rulesetId',
                { ...parsed, lazyMetadata: { sourceMapRaw: 42 } as unknown as typeof parsed.lazyMetadata },
                [createFilter(content)],
            );
            await expect(withBadLazyData.getRulesById(firstRule.id)).rejects.toThrow();

            const withBadRules = RulesetWithSourceMap.fromCompact(
                'rulesetId',
                { ...parsed, declarativeRules: [{ ...firstRule, metadata: {} } as DeclarativeRule] },
                [createFilter(content)],
            );
            await expect(withBadRules.getDeclarativeRules()).rejects.toThrow();
        });
    });
});
