/**
 * Cross-flow consistency tests: verify that FilterConverter produces the same
 * declarative rules in simple mode (withSourceMap omitted) and source-map mode
 * (withSourceMap: true) for equivalent input.
 */
import { describe, expect, it } from 'vitest';

import { type IFilter } from '../../../src/filter/types';
import { FilterConverter } from '../../../src/filter-converter/filter-converter';

/**
 * Creates a test IFilter from an array of rule strings.
 *
 * @param rules Rule text strings.
 * @param filterId Filter list ID.
 *
 * @returns IFilter mock.
 */
const makeFilter = (rules: string[], filterId = 0): IFilter => {
    const content = rules.join('\n');
    return {
        getId: () => filterId,
        getContent: async (): Promise<string> => content,
        getRuleByIndex: async () => '',
        unloadContent: () => {},
    };
};

describe('Cross-flow consistency', () => {
    const converter = new FilterConverter();

    it('produces the same declarative rules for a single filter (per-filter mode)', async () => {
        const rules = ['||example.com^', '@@||example.net^', '||example.org^$document'];
        const filterId = 1;

        const [simpleResult] = await converter.convert([makeFilter(rules, filterId)]);
        const [advancedResult] = await converter.convert(
            [makeFilter(rules, filterId)],
            { withSourceMap: true },
        );

        const simpleRules = simpleResult.ruleset.getDeclarativeRules();
        const advancedRules = await advancedResult.ruleset.getDeclarativeRules();

        expect(simpleRules).toStrictEqual(advancedRules);
    });

    it('produces the same declarative rules in combine mode', async () => {
        const rules1 = ['||example.com^'];
        const rules2 = ['||example.net^'];

        const [simpleResult] = await converter.convert(
            [makeFilter(rules1, 1), makeFilter(rules2, 2)],
            { combine: true },
        );
        const [advancedResult] = await converter.convert(
            [makeFilter(rules1, 1), makeFilter(rules2, 2)],
            { combine: true, withSourceMap: true },
        );

        const simpleRules = simpleResult.ruleset.getDeclarativeRules();
        const advancedRules = await advancedResult.ruleset.getDeclarativeRules();

        expect(simpleRules).toStrictEqual(advancedRules);
    });

    it('produces the same rules count for multiple filters', async () => {
        const multiRules = [
            ['||a.com^', '||b.com^'],
            ['@@||c.com^'],
            ['||d.com^', '||e.com^', '@@||f.com^'],
        ];

        const simpleFilters = multiRules.map((r, i) => makeFilter(r, i + 1));
        const advancedFilters = multiRules.map((r, i) => makeFilter(r, i + 1));

        const simpleResults = await converter.convert(simpleFilters);
        const advancedResults = await converter.convert(advancedFilters, { withSourceMap: true });

        expect(simpleResults).toHaveLength(advancedResults.length);

        for (let i = 0; i < simpleResults.length; i += 1) {
            const simpleRules = simpleResults[i].ruleset.getDeclarativeRules();
            // eslint-disable-next-line no-await-in-loop
            const advancedRules = await advancedResults[i].ruleset.getDeclarativeRules();
            expect(simpleRules).toStrictEqual(advancedRules);
        }
    });

    it('simple getDeclarativeRules matches advanced getDeclarativeRules', async () => {
        const rules = ['||example.com^', '||example.net^'];
        const filterId = 5;

        const [simpleResult] = await converter.convert([makeFilter(rules, filterId)]);
        const [advancedResult] = await converter.convert(
            [makeFilter(rules, filterId)],
            { withSourceMap: true },
        );

        const simpleRules = simpleResult.ruleset.getDeclarativeRules();
        const advancedRules = await advancedResult.ruleset.getDeclarativeRules();

        expect(simpleRules).toStrictEqual(advancedRules);
    });
});
