import { describe, expect, it } from 'vitest';

import { FilterConverter } from '@adguard/dnr-converter';
import { FilterList } from '@adguard/tsurlfilter';

import { type CustomFilterMV3 } from '../../../../src/lib/mv3/background/configuration';
import FiltersApi from '../../../../src/lib/mv3/background/filters-api';

describe('FiltersApi', () => {
    describe('createCustomFilters', () => {
        it('should propagate filterId through to FilterList conversion errors', async () => {
            const CUSTOM_FILTER_ID = 42;

            // '##^:has-text()' is an HTML-filtering rule that triggers a
            // conversion error in FilterList.prepare(). We use it as a probe
            // to verify the error carries the correct filterId through the
            // entire chain:
            //   CustomFilterMV3 → FiltersApi.createCustomFilters() →
            //   TrustedFilter.getConversionErrors()
            const customFilters: CustomFilterMV3[] = [
                {
                    filterId: CUSTOM_FILTER_ID,
                    content: '##^:has-text()',
                    trusted: true,
                },
            ];

            const filters = FiltersApi.createCustomFilters(customFilters);

            expect(filters).toHaveLength(1);
            expect(filters[0].getId()).toBe(CUSTOM_FILTER_ID);

            const errors = filters[0].getConversionErrors();

            expect(errors).toHaveLength(1);
            expect(errors[0].filterId).toBe(CUSTOM_FILTER_ID);
            expect(errors[0].rule).toBe('##^:has-text()');
            expect(errors[0].message).toContain('has-text');
        });

        it('should create FilterList with correct filterId even when rules are valid', async () => {
            const CUSTOM_FILTER_ID = 99;

            const customFilters: CustomFilterMV3[] = [
                {
                    filterId: CUSTOM_FILTER_ID,
                    content: '||example.com^',
                    trusted: false,
                },
            ];

            const filters = FiltersApi.createCustomFilters(customFilters);

            expect(filters).toHaveLength(1);
            expect(filters[0].getId()).toBe(CUSTOM_FILTER_ID);
            expect(filters[0].isTrusted()).toBe(false);

            // Valid rule → no conversion errors
            const errors = filters[0].getConversionErrors();
            expect(errors).toHaveLength(0);

            // Content should still be correct
            const content = await filters[0].getContent();
            expect(content).toBe('||example.com^');
        });

        it('should preserve the original rule spelling for $badfilter comparison', async () => {
            // The extension stores the CONVERTED content and passes it together
            // with the conversion data, so the original spelling is only
            // recoverable from the conversion data.
            const original = [
                '||example.com^$queryprune=foo',
                '||example.com^$removeparam=foo,badfilter',
            ].join('\n');
            const filterList = new FilterList(original, 1);

            const customFilters: CustomFilterMV3[] = [
                {
                    filterId: 1,
                    content: filterList.getContent(),
                    conversionData: filterList.getConversionData(),
                    trusted: true,
                },
            ];

            const filters = FiltersApi.createCustomFilters(customFilters);
            const [{ ruleset }] = await new FilterConverter().convert(filters);

            // `$queryprune` and `$removeparam` are different spellings, so the
            // rules must not cancel each other — same as in MV2.
            expect(ruleset.getDeclarativeRules()).toHaveLength(1);
        });

        it('should assign distinct filterIds to each custom filter', async () => {
            const customFilters: CustomFilterMV3[] = [
                {
                    filterId: 10,
                    content: '##^:has-text()',
                    trusted: true,
                },
                {
                    filterId: 20,
                    content: '##^:min-text-length(abc)',
                    trusted: true,
                },
            ];

            const filters = FiltersApi.createCustomFilters(customFilters);

            expect(filters).toHaveLength(2);

            const errors1 = filters[0].getConversionErrors();
            const errors2 = filters[1].getConversionErrors();

            expect(errors1).toHaveLength(1);
            expect(errors1[0].filterId).toBe(10);

            expect(errors2).toHaveLength(1);
            expect(errors2[0].filterId).toBe(20);
        });
    });

    describe('createUserRulesFilter', () => {
        it('should preserve the original rule spelling for $badfilter comparison', async () => {
            const original = [
                '||example.com^$queryprune=foo',
                '||example.com^$removeparam=foo,badfilter',
            ].join('\n');
            const filterList = new FilterList(original, 0);

            const filter = FiltersApi.createUserRulesFilter({
                content: filterList.getContent(),
                conversionData: filterList.getConversionData(),
            });

            const [{ ruleset }] = await new FilterConverter().convert([filter]);

            // `$queryprune` and `$removeparam` are different spellings, so the
            // rules must not cancel each other — same as in MV2.
            expect(ruleset.getDeclarativeRules()).toHaveLength(1);
        });
    });
});
