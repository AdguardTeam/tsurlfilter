/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable guard-for-in */

import { describe, expect, it } from 'vitest';

import { HitsStorage } from '../../../../src/lib/common/content-script/hits-storage';

describe('HitsStorage', () => {
    const hitsStorage = new HitsStorage();

    const testRuleText = 'test-rule-text';
    const anOtherRuleText = 'an-other-rule';

    it('checks storage', () => {
        expect(hitsStorage.getCounter()).toBe(1);

        const element: any = {};
        expect(hitsStorage.isCounted(element, testRuleText)).toBe(false);

        hitsStorage.setCounted(element, testRuleText);
        for (const p in element) {
            expect(element[p]).toBe(2);
        }
        expect(hitsStorage.isCounted(element, testRuleText)).toBe(true);
        expect(hitsStorage.isCounted(element, anOtherRuleText)).toBe(false);

        hitsStorage.setCounted(element, anOtherRuleText);
        for (const p in element) {
            expect(element[p]).toBe(3);
        }
        expect(hitsStorage.isCounted(element, testRuleText)).toBe(false);
        expect(hitsStorage.isCounted(element, anOtherRuleText)).toBe(true);
    });
});
