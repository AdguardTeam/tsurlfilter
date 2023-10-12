import {
    Filter,
    IndexedNetworkRuleWithHash,
    RuleSet,
    RuleSetContentProvider,
    RulesHashMap,
    SourceMap,
} from '../../../src/rules/declarative-converter';
import { NetworkRulesScanner } from '../../../src/rules/declarative-converter/network-rules-scanner';
import { DeclarativeRulesConverter } from '../../../src/rules/declarative-converter/rules-converter';

const createFilter = (
    rules: string[],
    filterId: number = 0,
) => {
    return new Filter(
        filterId,
        { getContent: async () => rules },
    );
};

describe('RuleSet', () => {
    const createRuleSet = async (content: string[], filterId = 0): Promise<RuleSet> => {
        const filter = createFilter(content, filterId);

        const { filters } = await NetworkRulesScanner.scanRules([filter]);

        const [scannedStaticFilter] = filters;
        const { badFilterRules } = scannedStaticFilter;

        const {
            sourceMapValues,
            declarativeRules,
        } = DeclarativeRulesConverter.convert(filters);

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
            declarativeRules.filter((d) => d.condition.regexFilter).length,
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

        const ruleSet = await createRuleSet(content, filterId);

        expect(ruleSet.getRulesCount()).toStrictEqual(1);

        const [declarativeRule] = await ruleSet.getDeclarativeRules();
        const originalRules = await ruleSet.getRulesById(declarativeRule.id);
        expect(originalRules[0].sourceRule).toStrictEqual(content[sourceRuleIndex]);

        const declarativeRulesIds = await ruleSet.getDeclarativeRulesIdsBySourceRuleIndex({
            sourceRuleIndex,
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
            .map((rawString) => IndexedNetworkRuleWithHash.createFromRawString(filterId, 3, rawString))
            .flat();

        const deserializedRuleSet = new RuleSet(
            id,
            rulesCount,
            regexpRulesCount,
            ruleSetContentProvider,
            badFilterRules,
            ruleSetHashMap,
        );

        // check $badfilter rules
        expect(deserializedRuleSet.getBadFilterRules()).toHaveLength(ruleSet.getBadFilterRules().length);
        expect(deserializedRuleSet.getBadFilterRules()[0]).toStrictEqual(ruleSet.getBadFilterRules()[0]);

        // check declarative rules
        const d1 = await ruleSet.getDeclarativeRules();
        const d2 = await deserializedRuleSet.getDeclarativeRules();
        expect(d1).toStrictEqual(d2);

        // check counters
        expect(deserializedRuleSet.getRulesCount()).toStrictEqual(ruleSet.getRulesCount());

        // check source map works
        const [dRuleId] = await deserializedRuleSet.getDeclarativeRulesIdsBySourceRuleIndex({
            sourceRuleIndex: 2,
            filterId,
        });
        expect(d2.find((d) => d.id === dRuleId)).toStrictEqual(d1[1]);
    });
});
