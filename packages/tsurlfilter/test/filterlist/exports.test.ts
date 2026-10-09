import { describe, expect, test } from 'vitest';

import { conversionDataValidator, FilterList } from '../../src/filterlist/filter-list';

describe('tsurlfilter conversion-data exports', () => {
    test('validator + FilterList are exported and interoperable', () => {
        const list = new FilterList('||example.com^');
        expect(() => conversionDataValidator.parse(list.getConversionData())).not.toThrow();
    });
});
