import {
    describe,
    expect,
    test,
    vi,
    beforeEach,
    afterEach,
} from 'vitest';
import { CosmeticResult } from '@adguard/tsurlfilter';

import { createCosmeticRule } from '../../helpers/rule-creator';
import { CosmeticApiCommon } from '../../../src/lib/common/cosmetic-api';
import * as cssCapabilities from '../../../src/lib/common/utils/css-capabilities';

/**
 * Creates cosmetic result for elemhide rules.
 *
 * @param rules Element hiding rules.
 *
 * @returns Element hiding rules cosmetic result.
 */
const getElemhideCosmeticResult = (rules: string[]): CosmeticResult => {
    const cosmeticResult = new CosmeticResult();
    rules.forEach((rule, ruleIndex) => {
        cosmeticResult.elementHiding.append(createCosmeticRule(rule, 0, ruleIndex));
    });
    return cosmeticResult;
};

/**
 * Creates cosmetic result for css rules.
 *
 * @param rules CSS hiding rules.
 *
 * @returns CSS rules cosmetic result.
 */
const getCssCosmeticResult = (rules: string[]): CosmeticResult => {
    const cosmeticResult = new CosmeticResult();
    rules.forEach((rule, ruleIndex) => {
        cosmeticResult.CSS.append(createCosmeticRule(rule, 0, ruleIndex));
    });
    return cosmeticResult;
};

describe('CosmeticApiCommon - reclassification of native-and-ext CSS', () => {
    beforeEach(() => {
        // Reset the cache before each test
        CosmeticApiCommon.resetNativeAndExtCssCache();
    });

    afterEach(() => {
        // Restore the original implementation and reset cache
        vi.restoreAllMocks();
        CosmeticApiCommon.resetNativeAndExtCssCache();
    });

    describe('getExtCssRules() with native-and-ext CSS support', () => {
        beforeEach(() => {
            // Reset cache and mock browser support for :has/:is/:not
            CosmeticApiCommon.resetNativeAndExtCssCache();
            vi.spyOn(cssCapabilities, 'supportsNativeAndExtCssPseudoClasses').mockReturnValue(true);
        });

        describe('when browser supports :has/:is/:not natively', () => {
            test('native rules with :has should NOT be reclassified to extended CSS', () => {
                const rules = [
                    'example.com##div:has(> a)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, false);

                // Should return null because native rules stay native
                expect(extCssRules).toBeNull();
            });

            test('native rules with :is should NOT be reclassified to extended CSS', () => {
                const rules = [
                    'example.com##div:is(.class1, .class2)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, false);

                expect(extCssRules).toBeNull();
            });

            test('native rules with :not should NOT be reclassified to extended CSS', () => {
                const rules = [
                    'example.com##div:not(.excluded)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, false);

                expect(extCssRules).toBeNull();
            });

            test('explicitly marked extended CSS rules should remain extended', () => {
                const rules = [
                    'example.com#?#div:has(> a)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, false);

                expect(extCssRules).toEqual(['div:has(> a) { display: none !important; }']);
            });

            test('mix of native and extended rules - only extended should be returned', () => {
                const cosmeticResult = new CosmeticResult();
                // Native rule with :has
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 0));
                // Explicitly extended rule
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com#?#span:contains(ad)', 0, 1));

                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, false);

                // Only the explicitly extended rule should be returned
                expect(extCssRules).toEqual(['span:contains(ad) { display: none !important; }']);
            });

            test('CSS injection rules with :has should NOT be reclassified', () => {
                const rules = [
                    'example.com#$#div:has(> a) { color: red !important; }',
                ];
                const cosmeticResult = getCssCosmeticResult(rules);
                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, false);

                expect(extCssRules).toBeNull();
            });
        });
    });

    describe('getExtCssRules() without native-and-ext CSS support', () => {
        beforeEach(() => {
            // Reset cache and mock browser NOT supporting :has/:is/:not
            CosmeticApiCommon.resetNativeAndExtCssCache();
            vi.spyOn(cssCapabilities, 'supportsNativeAndExtCssPseudoClasses').mockReturnValue(false);
        });

        describe('when browser does NOT support :has/:is/:not natively', () => {
            test('native rules with :has SHOULD be reclassified to extended CSS', () => {
                const rules = [
                    'example.com##div:has(> a)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, false);

                // Should be reclassified to extended CSS
                expect(extCssRules).toEqual(['div:has(> a) { display: none !important; }']);
            });

            test('native rules with :is SHOULD be reclassified to extended CSS', () => {
                const rules = [
                    'example.com##div:is(.class1, .class2)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, false);

                expect(extCssRules).toEqual(['div:is(.class1, .class2) { display: none !important; }']);
            });

            test('native rules with :not SHOULD be reclassified to extended CSS', () => {
                const rules = [
                    'example.com##div:not(.excluded)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, false);

                expect(extCssRules).toEqual(['div:not(.excluded) { display: none !important; }']);
            });

            test('native rules without :has/:is/:not should NOT be reclassified', () => {
                const rules = [
                    'example.com##div.banner',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, false);

                // Should return null - rule stays native
                expect(extCssRules).toBeNull();
            });

            test('multiple native rules with :has/:is/:not should all be reclassified', () => {
                const cosmeticResult = new CosmeticResult();
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 0));
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##span:is(.ad, .ads)', 0, 1));
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##p:not(.keep)', 0, 2));

                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, false);

                expect(extCssRules).toEqual([
                    'div:has(> a) { display: none !important; }',
                    'span:is(.ad, .ads) { display: none !important; }',
                    'p:not(.keep) { display: none !important; }',
                ]);
            });

            test('CSS injection rules with :has should be reclassified', () => {
                const rules = [
                    'example.com#$#div:has(> a) { color: red !important; }',
                ];
                const cosmeticResult = getCssCosmeticResult(rules);
                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, false);

                expect(extCssRules).toEqual(['div:has(> a) { color: red !important; }']);
            });

            test('mix of native rules with and without :has/:is/:not', () => {
                const cosmeticResult = new CosmeticResult();
                // Native rule with :has - should be reclassified
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 0));
                // Native rule without :has/:is/:not - should stay native
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##span.ad', 0, 1));

                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, false);

                // Only the rule with :has should be in extended CSS
                expect(extCssRules).toEqual(['div:has(> a) { display: none !important; }']);
            });
        });

        describe('reclassification with hits counter enabled', () => {
            test('reclassified rules should have hit markers', () => {
                const rules = [
                    'example.com##div:has(> a)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, true);

                // eslint-disable-next-line max-len
                expect(extCssRules).toEqual(['div:has(> a) { display: none !important; content: \'adguard0%3B0\' !important; }']);
            });
        });
    });

    describe('getCssText() with native-and-ext CSS support', () => {
        beforeEach(() => {
            // Reset cache and mock browser support for :has/:is/:not
            CosmeticApiCommon.resetNativeAndExtCssCache();
            vi.spyOn(cssCapabilities, 'supportsNativeAndExtCssPseudoClasses').mockReturnValue(true);
        });

        describe('when browser supports :has/:is/:not natively', () => {
            test('native rules with :has should be included in CSS text', () => {
                const rules = [
                    'example.com##div:has(> a)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, false);

                expect(cssText).toBe('div:has(> a) { display: none !important; }');
            });

            test('native rules with :is should be included in CSS text', () => {
                const rules = [
                    'example.com##div:is(.class1, .class2)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, false);

                expect(cssText).toBe('div:is(.class1, .class2) { display: none !important; }');
            });

            test('native rules with :not should be included in CSS text', () => {
                const rules = [
                    'example.com##div:not(.excluded)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, false);

                expect(cssText).toBe('div:not(.excluded) { display: none !important; }');
            });

            test('multiple native rules with :has/:is/:not should be grouped', () => {
                const cosmeticResult = new CosmeticResult();
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 0));
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##span:is(.ad, .ads)', 0, 1));

                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, false);

                expect(cssText).toBe('div:has(> a), span:is(.ad, .ads) { display: none !important; }');
            });

            test('explicitly extended CSS rules should NOT be included in CSS text', () => {
                const rules = [
                    'example.com#?#div:has(> a)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, false);

                // Extended CSS rules should not be in CSS text
                expect(cssText).toBeUndefined();
            });
        });
    });

    describe('getCssText() without native-and-ext CSS support', () => {
        beforeEach(() => {
            // Reset cache and mock browser NOT supporting :has/:is/:not
            CosmeticApiCommon.resetNativeAndExtCssCache();
            vi.spyOn(cssCapabilities, 'supportsNativeAndExtCssPseudoClasses').mockReturnValue(false);
        });

        describe('when browser does NOT support :has/:is/:not natively', () => {
            test('native rules with :has should NOT be included in CSS text', () => {
                const rules = [
                    'example.com##div:has(> a)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, false);

                // Should be reclassified to extended CSS, not in CSS text
                expect(cssText).toBeUndefined();
            });

            test('native rules with :is should NOT be included in CSS text', () => {
                const rules = [
                    'example.com##div:is(.class1, .class2)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, false);

                expect(cssText).toBeUndefined();
            });

            test('native rules with :not should NOT be included in CSS text', () => {
                const rules = [
                    'example.com##div:not(.excluded)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, false);

                expect(cssText).toBeUndefined();
            });

            test('native rules without :has/:is/:not should be included in CSS text', () => {
                const rules = [
                    'example.com##div.banner',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, false);

                expect(cssText).toBe('div.banner { display: none !important; }');
            });

            test('mix of native rules with and without :has/:is/:not', () => {
                const cosmeticResult = new CosmeticResult();
                // Native rule with :has - should be reclassified and NOT in CSS text
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 0));
                // Native rule without :has/:is/:not - should stay in CSS text
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##span.ad', 0, 1));

                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, false);

                // Only the rule without :has should be in CSS text
                expect(cssText).toBe('span.ad { display: none !important; }');
            });

            test('CSS injection rules with :has should NOT be in CSS text', () => {
                const rules = [
                    'example.com#$#div:has(> a) { color: red !important; }',
                ];
                const cosmeticResult = getCssCosmeticResult(rules);
                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, false);

                expect(cssText).toBeUndefined();
            });
        });

        describe('reclassification with hits counter enabled', () => {
            test('rules without :has/:is/:not should have hit markers in CSS text', () => {
                const rules = [
                    'example.com##div.banner',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, true);

                // eslint-disable-next-line max-len
                expect(cssText).toBe('div.banner { display: none !important; content: \'adguard0%3B0\' !important; }');
            });

            test('rules with :has should NOT appear in CSS text even with hit markers', () => {
                const rules = [
                    'example.com##div:has(> a)',
                ];
                const cosmeticResult = getElemhideCosmeticResult(rules);
                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, true);

                expect(cssText).toBeUndefined();
            });
        });
    });

    describe('buildStyleSheets()', () => {
        test('groups elemhide selectors when groupElemhideSelectors is true', () => {
            const rules = [
                'example.com##h1',
                'example.com##h2',
                'example.com##h3',
            ];
            const cosmeticResult = getElemhideCosmeticResult(rules);
            const styles = CosmeticApiCommon.buildStyleSheets(
                cosmeticResult.elementHiding.generic.concat(cosmeticResult.elementHiding.specific),
                [],
                true,
            );

            expect(styles).toEqual(['h1, h2, h3 { display: none !important; }']);
        });

        test('does not group elemhide selectors when groupElemhideSelectors is false', () => {
            const rules = [
                'example.com##h1',
                'example.com##h2',
            ];
            const cosmeticResult = getElemhideCosmeticResult(rules);
            const styles = CosmeticApiCommon.buildStyleSheets(
                cosmeticResult.elementHiding.generic.concat(cosmeticResult.elementHiding.specific),
                [],
                false,
            );

            expect(styles).toEqual([
                'h1 { display: none !important; }',
                'h2 { display: none !important; }',
            ]);
        });

        test('handles inject rules separately', () => {
            const injectRules = [
                'example.com#$#h1 { color: red !important; }',
            ];
            const cosmeticResult = getCssCosmeticResult(injectRules);
            const styles = CosmeticApiCommon.buildStyleSheets(
                [],
                cosmeticResult.CSS.generic.concat(cosmeticResult.CSS.specific),
                false,
            );

            expect(styles).toEqual(['h1 { color: red !important; }']);
        });
    });
});
