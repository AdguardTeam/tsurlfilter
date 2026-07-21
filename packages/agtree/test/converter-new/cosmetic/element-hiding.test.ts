/**
 * @file Element hiding rule converter tests.
 */
import { describe, expect, test } from 'vitest';

import { ElementHidingRuleConverter } from '../../../src/converter-new/cosmetic/element-hiding';

// Import custom matcher setup (registers toBeConvertedProperlyNew)
import '../../setup/custom-matchers/check-conversion';

describe('ElementHidingRuleConverter', () => {
    describe('convertToUbo', () => {
        test.each([
            // Simple rule without :contains() — no conversion needed
            {
                actual: 'example.com##div.ad',
                expected: ['example.com##div.ad'],
                shouldConvert: false,
            },

            // :contains() with unpaired quote — must be quoted for uBO
            {
                actual: String.raw`example.com#?#main:has(> div:contains(te'st))`,
                expected: [String.raw`example.com##main:has(> div:has-text('te\'st'))`],
                shouldConvert: true,
            },

            // :contains() without problematic chars — still quoted (always)
            {
                actual: 'example.com#?#div:contains(test)',
                expected: ["example.com##div:has-text('test')"],
                shouldConvert: true,
            },

            // Extended exception rule
            {
                actual: 'example.com#@?#div:contains(test)',
                expected: ["example.com#@#div:has-text('test')"],
                shouldConvert: true,
            },

            // Plain rule without extended CSS — no conversion
            {
                actual: 'example.com##div > span.text',
                expected: ['example.com##div > span.text'],
                shouldConvert: false,
            },

            // Multiple :contains() in selector
            {
                actual: 'example.com#?#div:has(> span:contains(hello)):has(> p:contains(world))',
                expected: ["example.com##div:has(> span:has-text('hello')):has(> p:has-text('world'))"],
                shouldConvert: true,
            },
        ])("should convert '$actual'", (testData) => {
            expect(testData).toBeConvertedProperlyNew(
                ElementHidingRuleConverter,
                'convertToUbo',
            );
        });
    });
});
