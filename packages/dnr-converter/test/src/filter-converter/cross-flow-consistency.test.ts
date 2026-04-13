/**
 * Cross-flow consistency tests: verify that FilterConverter (simple) and
 * FilterConverterWithSourceMap (advanced) produce the same declarative rules
 * for equivalent input.
 */
import { describe, expect, it } from 'vitest';

import { type IFilter, type IFilterWithSource } from '../../../src/filter/types';
import { FilterConverter } from '../../../src/filter-converter/filter-converter';
import { FilterConverterWithSourceMap } from '../../../src/filter-converter/filter-converter-with-source-map';

/**
 * Creates a minimal IFilter (for the simple flow).
 *
 * @param rules Rule text strings.
 * @param filterId Filter list ID.
 *
 * @returns IFilter mock.
 */
const makeSimpleFilter = (rules: string[], filterId = 0): IFilter => ({
    getId: () => filterId,
    getContent: () => rules.join('\n'),
});

/**
 * Creates an IFilterWithSource (for the advanced flow).
 *
 * @param rules Rule text strings.
 * @param filterId Filter list ID.
 *
 * @returns IFilterWithSource mock.
 */
const makeAdvancedFilter = (rules: string[], filterId = 0): IFilterWithSource => {
    const content = rules.join('\n');
    return {
        getId: () => filterId,
        getContent: async (): Promise<string> => content,
        getConversionData: () => undefined,
        getRuleByIndex: async () => '',
        unloadContent: () => {},
    };
};

describe('Cross-flow consistency', () => {
    const simpleConverter = new FilterConverter();
    const advancedConverter = new FilterConverterWithSourceMap();

    it('produces the same declarative rules for a single filter (per-filter mode)', async () => {
        const rules = ['||example.com^', '@@||example.net^', '||example.org^$document'];
        const filterId = 1;

        const [simpleResult] = await simpleConverter.convert([makeSimpleFilter(rules, filterId)]);
        const [advancedResult] = await advancedConverter.convert(
            [makeAdvancedFilter(rules, filterId)],
        );

        const simpleRules = simpleResult.ruleSet.getDeclarativeRules();
        const advancedRules = await advancedResult.ruleSet.getDeclarativeRules();

        expect(simpleRules).toStrictEqual(advancedRules);
    });

    it('produces the same declarative rules in combine mode', async () => {
        const rules1 = ['||example.com^'];
        const rules2 = ['||example.net^'];

        const [simpleResult] = await simpleConverter.convert(
            [makeSimpleFilter(rules1, 1), makeSimpleFilter(rules2, 2)],
            { combine: true },
        );
        const [advancedResult] = await advancedConverter.convert(
            [makeAdvancedFilter(rules1, 1), makeAdvancedFilter(rules2, 2)],
            { combine: true },
        );

        const simpleRules = simpleResult.ruleSet.getDeclarativeRules();
        const advancedRules = await advancedResult.ruleSet.getDeclarativeRules();

        expect(simpleRules).toStrictEqual(advancedRules);
    });

    it('produces the same rules count for multiple filters', async () => {
        const multiRules = [
            ['||a.com^', '||b.com^'],
            ['@@||c.com^'],
            ['||d.com^', '||e.com^', '@@||f.com^'],
        ];

        const simpleFilters = multiRules.map((r, i) => makeSimpleFilter(r, i + 1));
        const advancedFilters = multiRules.map((r, i) => makeAdvancedFilter(r, i + 1));

        const simpleResults = await simpleConverter.convert(simpleFilters);
        const advancedResults = await advancedConverter.convert(advancedFilters);

        expect(simpleResults).toHaveLength(advancedResults.length);

        for (let i = 0; i < simpleResults.length; i += 1) {
            const simpleRules = simpleResults[i].ruleSet.getDeclarativeRules();
            // eslint-disable-next-line no-await-in-loop
            const advancedRules = await advancedResults[i].ruleSet.getDeclarativeRules();
            expect(simpleRules).toStrictEqual(advancedRules);
        }
    });

    it('simple getDeclarativeRules matches advanced getDeclarativeRules', async () => {
        const rules = ['||example.com^', '||example.net^'];
        const filterId = 5;

        const [simpleResult] = await simpleConverter.convert([makeSimpleFilter(rules, filterId)]);
        const [advancedResult] = await advancedConverter.convert(
            [makeAdvancedFilter(rules, filterId)],
        );

        const simpleRules = simpleResult.ruleSet.getDeclarativeRules();
        const advancedRules = await advancedResult.ruleSet.getDeclarativeRules();

        expect(simpleRules).toStrictEqual(advancedRules);
    });
});
