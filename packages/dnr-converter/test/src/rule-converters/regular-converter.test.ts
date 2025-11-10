import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { type NetworkRule } from '../../../src/network-rule';
import { RegularConverter } from '../../../src/rule-converters';

describe('RegularConverter', () => {
    /**
     * Note: We don't actually test convert method logic here,
     * as it is inherited from the parent RuleConverter class,
     * and tested in `rule-converter.test.ts`.
     */
    describe('convert', () => {
        it('should use parent class methods', async () => {
            const webAccessibleResourcesPath = '/war';
            const regularConverter = new RegularConverter(webAccessibleResourcesPath);

            // @ts-expect-error Accessing private property for testing purposes
            expect(regularConverter.webAccessibleResourcesPath).toBe(webAccessibleResourcesPath);

            // @ts-expect-error Accessing private method for testing purposes
            const convertRulesSpy = vi.spyOn(regularConverter, 'convertRules');

            const filterListId = 1;
            const rules: NetworkRule[] = [];
            const usedIds = new Set<number>();
            await regularConverter.convert(filterListId, rules, usedIds);

            expect(convertRulesSpy).toHaveBeenCalledTimes(1);
            expect(convertRulesSpy).toHaveBeenCalledWith(filterListId, rules, usedIds);
        });
    });
});
