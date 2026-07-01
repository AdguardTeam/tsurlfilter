import { describe, expect, it } from 'vitest';

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
            //   Filter.getContent() → FilterList.getConversionErrors()
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

            // Trigger lazy content loading
            const filterList = await filters[0].getContent();

            const errors = filterList.getConversionErrors();

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

            const filterList = await filters[0].getContent();

            // Valid rule → no conversion errors
            const errors = filterList.getConversionErrors();
            expect(errors).toHaveLength(0);

            // Content should still be correct
            expect(filterList.getContent()).toBe('||example.com^');
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

            const list1 = await filters[0].getContent();
            const list2 = await filters[1].getContent();

            const errors1 = list1.getConversionErrors();
            const errors2 = list2.getConversionErrors();

            expect(errors1).toHaveLength(1);
            expect(errors1[0].filterId).toBe(10);

            expect(errors2).toHaveLength(1);
            expect(errors2[0].filterId).toBe(20);
        });
    });
});
