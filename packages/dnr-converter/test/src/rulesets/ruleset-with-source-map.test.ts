import {
    describe,
    expect,
    it,
    type MockInstance,
    vi,
} from 'vitest';

import { type DeclarativeRule } from '../../../src/declarative-rule';
import { type IFilterWithSource } from '../../../src/filter/types';
import { NetworkRule, NetworkRuleOption } from '../../../src/network-rule';
import { RulesConverter } from '../../../src/rule-converters/rules-converter';
import { RulesScanner, type ScannedFilter } from '../../../src/rules-scanner';
import { type HashWithSource, RulesHashMap } from '../../../src/ruleset/rules-hash-map';
import {
    type RulesetContentProvider,
    RulesetWithSourceMap,
    type SerializedRulesetData,
} from '../../../src/ruleset/ruleset-with-source-map';
import { SourceMap } from '../../../src/ruleset/source-map';
import { createNetworkRuleMock } from '../../mocks/network-rule';

/**
 * Creates a test IFilter from an array of rule strings.
 *
 * @param rules Array of rule text strings.
 * @param filterId Filter list ID.
 *
 * @returns IFilterWithSource mock.
 */
const createFilter = (rules: string[], filterId = 0): IFilterWithSource => {
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
        getConversionData: () => undefined,
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
 * Creates a RuleSet from rule strings.
 *
 * @param contentLines Rule text strings.
 * @param filterId Filter list ID.
 *
 * @returns RuleSet instance.
 */
const createRuleSet = async (contentLines: string[], filterId = 0): Promise<RulesetWithSourceMap> => {
    const filter = createFilter(contentLines, filterId);

    const { filters } = await RulesScanner.scanFilters([filter]);
    const [scannedStaticFilter] = filters;
    const { badFilterRules } = scannedStaticFilter;

    const {
        sourceMapValues,
        declarativeRules,
    } = await RulesConverter.convert(filters);

    const ruleSetContent: RulesetContentProvider = {
        loadSourceMap: async () => new SourceMap(sourceMapValues),
        loadFilterList: async () => [filter],
        loadDeclarativeRules: async () => declarativeRules,
    };

    const listOfRulesWithHash: HashWithSource[] = filters
        .flatMap(({ id, rules }) => {
            return rules.map((r) => ({
                hash: r.getHash(),
                source: {
                    sourceRuleIndex: r.getIndex(),
                    filterId: id,
                },
            }));
        });

    const rulesHashMap = new RulesHashMap(listOfRulesWithHash);

    return new RulesetWithSourceMap(
        'ruleSetId',
        declarativeRules.length,
        0,
        declarativeRules.filter((d) => RulesConverter.isRegexRule(d)).length,
        ruleSetContent,
        badFilterRules,
        rulesHashMap,
    );
};

describe('RuleSet', () => {
    it('returns counters correctly', async () => {
        const content = [
            '||example.com^$document',
            '@@||example.io^',
        ];

        const ruleSet = await createRuleSet(content);

        expect(ruleSet.getRulesCount()).toStrictEqual(2);
    });

    it('returns bad filter rules from constructor', () => {
        const badFilterRule = createNetworkRuleMock({
            pattern: '||evil.com^',
            enabledOptions: [NetworkRuleOption.Badfilter],
        });

        const ruleSetContent: RulesetContentProvider = {
            loadSourceMap: async () => new SourceMap([]),
            loadFilterList: async () => [],
            loadDeclarativeRules: async () => [],
        };

        const ruleSet = new RulesetWithSourceMap(
            'testId',
            0,
            0,
            0,
            ruleSetContent,
            [badFilterRule],
            new RulesHashMap([]),
        );

        expect(ruleSet.getBadFilterRules()).toHaveLength(1);
        expect(ruleSet.getBadFilterRules()[0]).toBe(badFilterRule);
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

        const ruleSet = await createRuleSet(content, filterId);

        expect(ruleSet.getRulesCount()).toStrictEqual(1);

        const [declarativeRule] = await ruleSet.getDeclarativeRules();
        const originalRules = await ruleSet.getRulesById(declarativeRule.id);
        expect(originalRules[0].sourceRule).toStrictEqual(content[sourceRuleIndex]);

        const declarativeRulesIds = await ruleSet.getDeclarativeRulesIdsBySourceRuleIndex({
            sourceRuleIndex: scannedFilter.rules[0]?.getIndex(),
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
        const badFilterRuleIndex = scannedFilter.rules[2].getIndex();

        const ruleSet = await createRuleSet(content, filterId);

        const {
            id,
            data,
            lazyData,
        } = await ruleSet.serialize();

        const declarativeRules = await ruleSet.getDeclarativeRules();

        const {
            data: {
                regexpRulesCount,
                unsafeRulesCount,
                rulesCount,
                ruleSetHashMapRaw,
                badFilterRulesRaw,
            },
            ruleSetContentProvider,
        } = await RulesetWithSourceMap.deserialize(
            id,
            data,
            async () => lazyData,
            async () => JSON.stringify(declarativeRules),
            [originalFilter],
        );

        const sources = RulesHashMap.deserializeSources(ruleSetHashMapRaw);
        const ruleSetHashMap = new RulesHashMap(sources);
        const badFilterRules = badFilterRulesRaw
            .flatMap(
                (rawString) => NetworkRule.createFromText(
                    filterId,
                    badFilterRuleIndex,
                    rawString,
                ),
            );

        const deserializedRuleSet = new RulesetWithSourceMap(
            id,
            rulesCount,
            unsafeRulesCount,
            regexpRulesCount,
            ruleSetContentProvider,
            badFilterRules,
            ruleSetHashMap,
        );

        // check $badfilter rules
        expect(deserializedRuleSet.getBadFilterRules()).toHaveLength(ruleSet.getBadFilterRules().length);
        expect(deserializedRuleSet.getBadFilterRules()[0].text)
            .toEqual(ruleSet.getBadFilterRules()[0].text);

        // check declarative rules
        const d1 = await ruleSet.getDeclarativeRules();
        const d2 = await deserializedRuleSet.getDeclarativeRules();
        expect(d1).toStrictEqual(d2);

        // check counters
        expect(deserializedRuleSet.getRulesCount()).toStrictEqual(ruleSet.getRulesCount());

        // check source map works
        const [dRuleId] = await deserializedRuleSet.getDeclarativeRulesIdsBySourceRuleIndex({
            sourceRuleIndex: scannedFilter.rules[1]?.getIndex(),
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

        const ruleSet = await createRuleSet(content);

        // Load content
        await ruleSet.getDeclarativeRules();
        expect(Object.getOwnPropertyDescriptor(ruleSet, 'initialized')?.value).toBe(true);
        expect(Object.getOwnPropertyDescriptor(ruleSet, 'filterList')?.value.size).toBeGreaterThan(0);
        expect(Object.getOwnPropertyDescriptor(ruleSet, 'sourceMap')?.value).not.toBeUndefined();

        // Unload content
        ruleSet.unloadContent();
        expect(Object.getOwnPropertyDescriptor(ruleSet, 'initialized')?.value).toBe(false);
        expect(Object.getOwnPropertyDescriptor(ruleSet, 'filterList')?.value.size).toBe(0);
        expect(Object.getOwnPropertyDescriptor(ruleSet, 'sourceMap')?.value).toBeUndefined();
    });

    it('does not return stale content after unload', async () => {
        const content = [
            '||example.com^$document',
            '||example.net##h1',
            '@@||example.io^',
        ];

        const ruleSet = await createRuleSet(content);

        // Load content
        await ruleSet.getDeclarativeRules();
        expect(Object.getOwnPropertyDescriptor(ruleSet, 'initialized')?.value).toBe(true);

        // Unload content
        ruleSet.unloadContent();
        expect(Object.getOwnPropertyDescriptor(ruleSet, 'initialized')?.value).toBe(false);

        // Reload content after unloading
        await ruleSet.getDeclarativeRules();
        expect(Object.getOwnPropertyDescriptor(ruleSet, 'initialized')?.value).toBe(true);
    });

    it('waits for initialization before unloading', async () => {
        let resolveInit: () => void;
        const initPromise = new Promise<void>((resolve) => {
            resolveInit = resolve;
        });

        const ruleSetContent: RulesetContentProvider = {
            loadSourceMap: async () => {
                await initPromise;
                return new SourceMap([]);
            },
            loadFilterList: async () => [],
            loadDeclarativeRules: async () => [],
        };

        const ruleSet = new RulesetWithSourceMap(
            'testRuleSet',
            0,
            0,
            0,
            ruleSetContent,
            [],
            new RulesHashMap([]),
        );

        // Start loading content
        const loadPromise = ruleSet.getDeclarativeRules();

        // Call unloadContent while loading is still in progress
        ruleSet.unloadContent();

        // Resolve the initialization
        resolveInit!();
        await loadPromise;

        // Ensure that content is still correctly unloaded after the fetch completes
        expect(Object.getOwnPropertyDescriptor(ruleSet, 'initialized')?.value).toBe(false);
        expect(Object.getOwnPropertyDescriptor(ruleSet, 'sourceMap')?.value).toBeUndefined();
    });

    it('ensures filterList filters are unloaded', async () => {
        const content = [
            '||example.com^$document',
            '||example.net##h1',
            '@@||example.io^',
        ];

        const ruleSet = await createRuleSet(content);
        await ruleSet.getDeclarativeRules();

        // Mock `unloadContent` for all filters
        const unloadSpies: MockInstance<IFilterWithSource['unloadContent']>[] = [];

        Object.getOwnPropertyDescriptor(ruleSet, 'filterList')?.value.forEach((filter: IFilterWithSource) => {
            const spy = vi.spyOn(filter, 'unloadContent');
            unloadSpies.push(spy);
        });

        ruleSet.unloadContent();

        // Ensure all filters' `unloadContent` methods were called
        unloadSpies.forEach((spy) => expect(spy).toHaveBeenCalled());

        // Ensure filterList is cleared
        expect(Object.getOwnPropertyDescriptor(ruleSet, 'filterList')?.value.size).toBe(0);
    });

    it('returns rules hash map', async () => {
        const content = [
            '||example.com^$document',
            '@@||example.io^',
        ];

        const ruleSet = await createRuleSet(content);
        const hashMap = ruleSet.getRulesHashMap();

        expect(hashMap).toBeDefined();
        expect(hashMap.serialize()).toBeTruthy();
    });

    it('returns rule set id', async () => {
        const content = ['||example.com^$document'];

        const ruleSet = await createRuleSet(content);
        expect(ruleSet.getId()).toBe('ruleSetId');
    });

    describe('getNetworkRuleBySourceRule', () => {
        it('returns network rules for valid source rule', () => {
            const rules = RulesetWithSourceMap.getNetworkRuleBySourceRule({
                sourceRule: '||example.com^',
                filterId: 1,
            });

            expect(rules).toHaveLength(1);
            expect(rules[0].getPattern()).toBe('||example.com^');
        });

        it('returns empty array for invalid source rule', () => {
            const rules = RulesetWithSourceMap.getNetworkRuleBySourceRule({
                sourceRule: '!this is a comment, not a rule',
                filterId: 1,
            });

            expect(rules).toHaveLength(0);
        });

        it('returns empty array for cosmetic rules', () => {
            const rules = RulesetWithSourceMap.getNetworkRuleBySourceRule({
                sourceRule: '##.ad-banner',
                filterId: 1,
            });

            expect(rules).toHaveLength(0);
        });
    });

    describe('deserialize', () => {
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
                rulesCount: 0,
                ruleSetHashMapRaw: '[]',
                badFilterRulesRaw: [],
            };

            const { ruleSetContentProvider } = await RulesetWithSourceMap.deserialize(
                'testId',
                JSON.stringify(validData),
                async () => 'not-valid-json{{',
                async () => '[]',
                [],
            );

            // Accessing lazy data should throw
            await expect(ruleSetContentProvider.loadSourceMap()).rejects.toThrow();
        });
    });

    describe('serializeCompact', () => {
        it('serializes compact output', async () => {
            const content = [
                '||example.com^$document',
                '@@||example.io^',
            ];

            const ruleSet = await createRuleSet(content);
            const compactOutput = await ruleSet.serializeCompact(true);

            expect(compactOutput).toBeTruthy();
            const parsed = JSON.parse(compactOutput) as DeclarativeRule[];
            // Should contain metadata rule + declarative rules
            expect(parsed.length).toBeGreaterThan(0);
        });
    });
});
