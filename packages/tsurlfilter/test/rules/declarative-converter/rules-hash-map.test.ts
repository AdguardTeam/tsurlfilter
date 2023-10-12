import { RulesHashMap } from '../../../src/rules/declarative-converter';

describe('Rules Hash Map', () => {
    it('serializes and deserializes', async () => {
        const items = [
            { hash: 1, source: { sourceRuleIndex: 1, filterId: 1 } },
            { hash: 2, source: { sourceRuleIndex: 2, filterId: 1 } },
            { hash: 3, source: { sourceRuleIndex: 3, filterId: 1 } },
        ];
        const rulesHashMap = new RulesHashMap(items);

        const serialized = rulesHashMap.serialize();

        const deserialized = RulesHashMap.deserializeSources(serialized);

        expect(deserialized).toHaveLength(items.length);
        expect(deserialized[0]).toEqual(items[0]);
        expect(deserialized[1]).toEqual(items[1]);
        expect(deserialized[2]).toEqual(items[2]);
    });

    it('returns source rules for provided hash', async () => {
        const items = [
            // There can be two sources with identical hashes.
            { hash: 1, source: { sourceRuleIndex: 1, filterId: 1 } },
            { hash: 1, source: { sourceRuleIndex: 2, filterId: 1 } },
            { hash: 3, source: { sourceRuleIndex: 3, filterId: 1 } },
        ];
        const rulesHashMap = new RulesHashMap(items);

        let sources = rulesHashMap.findRules(1);

        expect(sources).toHaveLength(2);
        expect(sources[0]).toEqual(items[0].source);
        expect(sources[1]).toEqual(items[1].source);

        sources = rulesHashMap.findRules(2);
        expect(sources).toHaveLength(0);

        sources = rulesHashMap.findRules(3);

        expect(sources).toHaveLength(1);
        expect(sources[0]).toEqual(items[2].source);
    });
});
