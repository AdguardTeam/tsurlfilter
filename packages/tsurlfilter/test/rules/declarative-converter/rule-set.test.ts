import {
    describe,
    it,
    expect,
    type MockInstance,
    vi,
} from 'vitest';
import { RuleParser } from '@adguard/agtree';

import {
    type IFilter,
    type Filter,
    IndexedNetworkRuleWithHash,
    RuleSet,
    type RuleSetContentProvider,
    RulesHashMap,
    SourceMap,
} from '../../../src/rules/declarative-converter';
// eslint-disable-next-line import-newlines/enforce
import {
    NetworkRulesScanner,
    type ScannedFilter,
} from '../../../src/rules/declarative-converter/network-rules-scanner';
import { DeclarativeRulesConverter } from '../../../src/rules/declarative-converter/rules-converter';
import { PREPROCESSOR_AGTREE_OPTIONS } from '../../../src';

import { createFilter } from './helpers';

describe('RuleSet', () => {
    const createScannedFilter = async (content: string[], filterId = 0): Promise<ScannedFilter[]> => {
        const filter = createFilter(content, filterId);

        const { filters } = await NetworkRulesScanner.scanRules([filter]);

        return filters;
    };

    const createRuleSet = async (content: string[], filterId = 0): Promise<RuleSet> => {
        const filter = createFilter(content, filterId);

        const { filters } = await NetworkRulesScanner.scanRules([filter]);

        const [scannedStaticFilter] = filters;
        const { badFilterRules } = scannedStaticFilter;

        const {
            sourceMapValues,
            declarativeRules,
        } = await DeclarativeRulesConverter.convert(filters);

        const ruleSetContent: RuleSetContentProvider = {
            loadSourceMap: async () => new SourceMap(sourceMapValues),
            loadFilterList: async () => [filter],
            loadDeclarativeRules: async () => declarativeRules,
        };

        const listOfRulesWithHash = filters
            .map(({ id, rules }) => {
                return rules.map((r) => ({
                    hash: r.hash,
                    source: {
                        sourceRuleIndex: r.index,
                        filterId: id,
                    },
                }));
            })
            .flat();

        const rulesHashMap = new RulesHashMap(listOfRulesWithHash);

        return new RuleSet(
            'ruleSetId',
            declarativeRules.length,
            0,
            declarativeRules.filter((d) => DeclarativeRulesConverter.isRegexRule(d)).length,
            ruleSetContent,
            badFilterRules,
            rulesHashMap,
        );
    };

    it('returns counters correctly', async () => {
        const content = [
            '||example.com^$document',
            '||example.net##h1',
            '@@||example.io^',
            '@@||evil.com^$badfilter',
        ];

        const ruleSet = await createRuleSet(content);

        expect(ruleSet.getRulesCount()).toStrictEqual(2);
        expect(ruleSet.getBadFilterRules()).toHaveLength(1);
    });

    it('returns original rule by declarative and declarative rule by source rule correctly', async () => {
        const content = [
            '||example.com##h1',
            '||example.net##h2',
            '@@||example.io^',
        ];

        const sourceRuleIndex = 2;
        const filterId = 99;

        const [scannedFilter] = await createScannedFilter(content, filterId);

        const ruleSet = await createRuleSet(content, filterId);

        expect(ruleSet.getRulesCount()).toStrictEqual(1);

        const [declarativeRule] = await ruleSet.getDeclarativeRules();
        const originalRules = await ruleSet.getRulesById(declarativeRule.id);
        expect(originalRules[0].sourceRule).toStrictEqual(content[sourceRuleIndex]);

        const declarativeRulesIds = await ruleSet.getDeclarativeRulesIdsBySourceRuleIndex({
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

        const [scannedFilter] = await createScannedFilter(content, filterId);
        const badFilterRuleIndex = scannedFilter.rules[2].index;

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
        } = await RuleSet.deserialize(
            id,
            data,
            async () => lazyData,
            async () => JSON.stringify(declarativeRules),
            [originalFilter],
        );

        const sources = RulesHashMap.deserializeSources(ruleSetHashMapRaw);
        const ruleSetHashMap = new RulesHashMap(sources);
        const badFilterRules = badFilterRulesRaw
            .map(
                (rawString) => IndexedNetworkRuleWithHash.createFromNode(
                    filterId,
                    badFilterRuleIndex,
                    RuleParser.parse(rawString, PREPROCESSOR_AGTREE_OPTIONS),
                ),
            )
            .flat();

        const deserializedRuleSet = new RuleSet(
            id,
            rulesCount,
            unsafeRulesCount || 0,
            regexpRulesCount,
            ruleSetContentProvider,
            badFilterRules,
            ruleSetHashMap,
        );

        // check $badfilter rules
        expect(deserializedRuleSet.getBadFilterRules()).toHaveLength(ruleSet.getBadFilterRules().length);
        expect(deserializedRuleSet.getBadFilterRules()[0]).toEqual(ruleSet.getBadFilterRules()[0]);

        // check declarative rules
        const d1 = await ruleSet.getDeclarativeRules();
        const d2 = await deserializedRuleSet.getDeclarativeRules();
        expect(d1).toStrictEqual(d2);

        // check counters
        expect(deserializedRuleSet.getRulesCount()).toStrictEqual(ruleSet.getRulesCount());

        // check source map works
        const [dRuleId] = await deserializedRuleSet.getDeclarativeRulesIdsBySourceRuleIndex({
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

        const ruleSetContent: RuleSetContentProvider = {
            loadSourceMap: async () => {
                await initPromise;
                return new SourceMap([]);
            },
            loadFilterList: async () => [],
            loadDeclarativeRules: async () => [],
        };

        const ruleSet = new RuleSet(
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
        const unloadSpies: MockInstance<IFilter['unloadContent']>[] = [];

        Object.getOwnPropertyDescriptor(ruleSet, 'filterList')?.value.forEach((filter: Filter) => {
            const spy = vi.spyOn(filter, 'unloadContent');
            unloadSpies.push(spy);
        });

        ruleSet.unloadContent();

        // Ensure all filters' `unloadContent` methods were called
        unloadSpies.forEach((spy) => expect(spy).toHaveBeenCalled());

        // Ensure filterList is cleared
        expect(Object.getOwnPropertyDescriptor(ruleSet, 'filterList')?.value.size).toBe(0);
    });
});
