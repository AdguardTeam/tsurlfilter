import { describe, expect, it } from 'vitest';

import { HitsStorage } from '../../../../src/lib/common/content-script/hits-storage';

describe('HitsStorage', () => {
    const hitsStorage = new HitsStorage();

    const testRuleText = 'test-rule-text';
    const anOtherRuleText = 'an-other-rule';

    it('checks storage', () => {
        const element = {};

        expect(hitsStorage.isCounted(element, testRuleText)).toBe(false);

        hitsStorage.setCounted(element, testRuleText);
        expect(hitsStorage.isCounted(element, testRuleText)).toBe(true);
        expect(hitsStorage.isCounted(element, anOtherRuleText)).toBe(false);

        // Several rules can match one element, so the storage keeps them all.
        hitsStorage.setCounted(element, anOtherRuleText);
        expect(hitsStorage.isCounted(element, testRuleText)).toBe(true);
        expect(hitsStorage.isCounted(element, anOtherRuleText)).toBe(true);

        // A repeated rule is not counted twice.
        hitsStorage.setCounted(element, testRuleText);
        expect(hitsStorage.isCounted(element, testRuleText)).toBe(true);
    });
});
