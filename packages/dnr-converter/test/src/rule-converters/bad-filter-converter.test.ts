import {
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

import { type NetworkRule } from '../../../src/network-rule';
import { BadFilterConverter } from '../../../src/rule-converters';

describe('BadFilterConverter', () => {
    const webAccessibleResourcePath = '/war';
    const filterListId = 1;
    const rules: NetworkRule[] = [];
    const usedIds = new Set<number>();

    let badFilterConverter: BadFilterConverter;
    beforeEach(() => {
        badFilterConverter = new BadFilterConverter(webAccessibleResourcePath);
    });

    it('returns empty converted rules', async () => {
        const convertedRules = await badFilterConverter.convert(filterListId, rules, usedIds);
        expect(convertedRules).toEqual({
            sourceMapValues: [],
            declarativeRules: [],
            errors: [],
        });
    });
});
