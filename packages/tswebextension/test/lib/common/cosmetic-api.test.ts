import { describe, expect, test } from 'vitest';
import { CosmeticResult } from '@adguard/tsurlfilter';

import { createCosmeticRule } from '../../helpers/rule-creator';
import { CosmeticApiCommon } from '../../../src/lib/common/cosmetic-api';

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

describe('CosmeticApiCommon', () => {
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

    describe('isNativeHasSupported option reclassification', () => {
        describe('getCssText() with isNativeHasSupported option', () => {
            describe('element hiding rules with :has pseudo-class', () => {
                test('isNativeHasSupported = false: :has rules are excluded from native CSS', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.simple', 0, 0));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 1));

                    const cssText = CosmeticApiCommon.getCssText(cosmeticResult, {
                        isNativeHasSupported: false,
                    });

                    // Only the simple selector should be in native CSS
                    expect(cssText).toBe('.simple { display: none !important; }');
                });

                test('isNativeHasSupported = true: :has rules are included in native CSS', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.simple', 0, 0));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 1));

                    const cssText = CosmeticApiCommon.getCssText(cosmeticResult, {
                        isNativeHasSupported: true,
                    });

                    // Both selectors should be in native CSS
                    expect(cssText).toBe('.simple, div:has(> a) { display: none !important; }');
                });
            });

            describe('element hiding rules with :is pseudo-class', () => {
                test('isNativeHasSupported = false: :is rules are excluded from native CSS', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.simple', 0, 0));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##:is(h1, h2)', 0, 1));

                    const cssText = CosmeticApiCommon.getCssText(cosmeticResult, {
                        isNativeHasSupported: false,
                    });

                    expect(cssText).toBe('.simple { display: none !important; }');
                });

                test('isNativeHasSupported = true: :is rules are included in native CSS', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.simple', 0, 0));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##:is(h1, h2)', 0, 1));

                    const cssText = CosmeticApiCommon.getCssText(cosmeticResult, {
                        isNativeHasSupported: true,
                    });

                    expect(cssText).toBe('.simple, :is(h1, h2) { display: none !important; }');
                });
            });

            describe('element hiding rules with :not pseudo-class', () => {
                test('isNativeHasSupported = false: :not rules are excluded from native CSS', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.simple', 0, 0));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:not(.keep)', 0, 1));

                    const cssText = CosmeticApiCommon.getCssText(cosmeticResult, {
                        isNativeHasSupported: false,
                    });

                    expect(cssText).toBe('.simple { display: none !important; }');
                });

                test('isNativeHasSupported = true: :not rules are included in native CSS', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.simple', 0, 0));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:not(.keep)', 0, 1));

                    const cssText = CosmeticApiCommon.getCssText(cosmeticResult, {
                        isNativeHasSupported: true,
                    });

                    expect(cssText).toBe('.simple, div:not(.keep) { display: none !important; }');
                });
            });

            describe('CSS injection rules with :has pseudo-class', () => {
                test('isNativeHasSupported = false: :has rules are excluded from native CSS', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.CSS.append(
                        createCosmeticRule('example.com#$#.simple { color: red !important; }', 0, 0),
                    );
                    cosmeticResult.CSS.append(
                        createCosmeticRule('example.com#$#div:has(> a) { color: blue !important; }', 0, 1),
                    );

                    const cssText = CosmeticApiCommon.getCssText(cosmeticResult, {
                        isNativeHasSupported: false,
                    });

                    expect(cssText).toBe('.simple { color: red !important; }');
                });

                test('isNativeHasSupported = true: :has rules are included in native CSS', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.CSS.append(
                        createCosmeticRule('example.com#$#.simple { color: red !important; }', 0, 0),
                    );
                    cosmeticResult.CSS.append(
                        createCosmeticRule('example.com#$#div:has(> a) { color: blue !important; }', 0, 1),
                    );

                    const cssText = CosmeticApiCommon.getCssText(cosmeticResult, {
                        isNativeHasSupported: true,
                    });

                    const expected = '.simple { color: red !important; }\r\n'
                        + 'div:has(> a) { color: blue !important; }';
                    expect(cssText).toBe(expected);
                });
            });

            describe('complex combinations', () => {
                test('isNativeHasSupported = false: multiple native-and-ext selectors are excluded', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.simple', 0, 0));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 1));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##:is(h1, h2)', 0, 2));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##span:not(.keep)', 0, 3));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.another-simple', 0, 4));

                    const cssText = CosmeticApiCommon.getCssText(cosmeticResult, {
                        isNativeHasSupported: false,
                    });

                    // Only simple selectors without :has/:is/:not
                    expect(cssText).toBe('.simple, .another-simple { display: none !important; }');
                });

                test('isNativeHasSupported = true: all selectors are included', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.simple', 0, 0));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 1));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##:is(h1, h2)', 0, 2));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##span:not(.keep)', 0, 3));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.another-simple', 0, 4));

                    const cssText = CosmeticApiCommon.getCssText(cosmeticResult, {
                        isNativeHasSupported: true,
                    });

                    const expected = '.simple, div:has(> a), :is(h1, h2), span:not(.keep), '
                        + '.another-simple { display: none !important; }';
                    expect(cssText).toBe(expected);
                });
            });
        });

        describe('getExtCssRules() with isNativeHasSupported option', () => {
            describe('element hiding rules with :has pseudo-class', () => {
                test('isNativeHasSupported = false: :has rules are moved to extended CSS', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 0));

                    const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, {
                        isNativeHasSupported: false,
                    });

                    expect(extCssRules).toEqual([
                        'div:has(> a) { display: none !important; }',
                    ]);
                });

                test('isNativeHasSupported = true: :has rules are NOT in extended CSS', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 0));

                    const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, {
                        isNativeHasSupported: true,
                    });

                    // Should be null (no extended CSS rules)
                    expect(extCssRules).toBeNull();
                });

                test('isNativeHasSupported = false: :has rules added to existing extended rules', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 0));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com#?#div:contains(text)', 0, 1));

                    const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, {
                        isNativeHasSupported: false,
                    });

                    expect(extCssRules).toEqual([
                        'div:contains(text) { display: none !important; }',
                        'div:has(> a) { display: none !important; }',
                    ]);
                });

                test('isNativeHasSupported = true: only originally extended rules remain', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 0));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com#?#div:contains(text)', 0, 1));

                    const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, {
                        isNativeHasSupported: true,
                    });

                    // Only the originally extended rule
                    expect(extCssRules).toEqual([
                        'div:contains(text) { display: none !important; }',
                    ]);
                });
            });

            describe('element hiding rules with :is and :not pseudo-classes', () => {
                test('isNativeHasSupported = false: :is/:not rules are moved to extended CSS', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##:is(h1, h2)', 0, 0));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:not(.keep)', 0, 1));

                    const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, {
                        isNativeHasSupported: false,
                    });

                    expect(extCssRules).toEqual([
                        ':is(h1, h2) { display: none !important; }',
                        'div:not(.keep) { display: none !important; }',
                    ]);
                });

                test('isNativeHasSupported = true: :is/:not rules are NOT in extended CSS', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##:is(h1, h2)', 0, 0));
                    cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:not(.keep)', 0, 1));

                    const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, {
                        isNativeHasSupported: true,
                    });

                    expect(extCssRules).toBeNull();
                });
            });

            describe('CSS injection rules with :has pseudo-class', () => {
                test('isNativeHasSupported = false: :has CSS rules are moved to extended CSS', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.CSS.append(
                        createCosmeticRule('example.com#$#div:has(> a) { color: blue !important; }', 0, 0),
                    );

                    const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, {
                        isNativeHasSupported: false,
                    });

                    expect(extCssRules).toEqual([
                        'div:has(> a) { color: blue !important; }',
                    ]);
                });

                test('isNativeHasSupported = true: :has CSS rules are NOT in extended CSS', () => {
                    const cosmeticResult = new CosmeticResult();
                    cosmeticResult.CSS.append(
                        createCosmeticRule('example.com#$#div:has(> a) { color: blue !important; }', 0, 0),
                    );

                    const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, {
                        isNativeHasSupported: true,
                    });

                    expect(extCssRules).toBeNull();
                });
            });

            describe('mixed element hiding and CSS injection rules', () => {
                test('isNativeHasSupported = false: both rule types with :has are reclassified', () => {
                    const cosmeticResult = new CosmeticResult();

                    // Element hiding rules
                    cosmeticResult.elementHiding.append(
                        createCosmeticRule('example.com##div:has(> a)', 0, 0),
                    );

                    // CSS injection rules
                    cosmeticResult.CSS.append(
                        createCosmeticRule('example.com#$#span:has(.ad) { display: block !important; }', 0, 1),
                    );

                    const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, {
                        isNativeHasSupported: false,
                    });

                    expect(extCssRules).toEqual([
                        'div:has(> a) { display: none !important; }',
                        'span:has(.ad) { display: block !important; }',
                    ]);
                });

                test('isNativeHasSupported = true: no reclassification happens', () => {
                    const cosmeticResult = new CosmeticResult();

                    // Element hiding rules
                    cosmeticResult.elementHiding.append(
                        createCosmeticRule('example.com##div:has(> a)', 0, 0),
                    );

                    // CSS injection rules
                    cosmeticResult.CSS.append(
                        createCosmeticRule('example.com#$#span:has(.ad) { display: block !important; }', 0, 1),
                    );

                    const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, {
                        isNativeHasSupported: true,
                    });

                    expect(extCssRules).toBeNull();
                });
            });
        });

        describe('combined getCssText() and getExtCssRules() consistency', () => {
            test('isNativeHasSupported = false: rules are properly split between native and extended', () => {
                const cosmeticResult = new CosmeticResult();
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.simple', 0, 0));
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 1));
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.another-simple', 0, 2));

                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, {
                    isNativeHasSupported: false,
                });
                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, {
                    isNativeHasSupported: false,
                });

                // Native CSS should only have simple selectors
                expect(cssText).toBe('.simple, .another-simple { display: none !important; }');

                // Extended CSS should have :has selector
                expect(extCssRules).toEqual([
                    'div:has(> a) { display: none !important; }',
                ]);
            });

            test('isNativeHasSupported = true: all rules remain in native, extended is empty', () => {
                const cosmeticResult = new CosmeticResult();
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.simple', 0, 0));
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 1));
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.another-simple', 0, 2));

                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, {
                    isNativeHasSupported: true,
                });
                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, {
                    isNativeHasSupported: true,
                });

                // Native CSS should have all selectors
                expect(cssText).toBe('.simple, div:has(> a), .another-simple { display: none !important; }');

                // Extended CSS should be null
                expect(extCssRules).toBeNull();
            });
        });

        describe('with hits counter enabled', () => {
            test('isNativeHasSupported = false: hits counter works with reclassified rules', () => {
                const cosmeticResult = new CosmeticResult();
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.simple', 0, 0));
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 1));

                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, {
                    isNativeHasSupported: false,
                    areHitsStatsCollected: true,
                });
                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, {
                    isNativeHasSupported: false,
                    areHitsStatsCollected: true,
                });

                // Native CSS with hit marker
                expect(cssText).toBe('.simple { display: none !important; content: \'adguard0%3B0\' !important; }');

                // Extended CSS with hit marker
                expect(extCssRules).toEqual([
                    'div:has(> a) { display: none !important; content: \'adguard0%3B1\' !important; }',
                ]);
            });

            test('isNativeHasSupported = true: hits counter works without reclassification', () => {
                const cosmeticResult = new CosmeticResult();
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##.simple', 0, 0));
                cosmeticResult.elementHiding.append(createCosmeticRule('example.com##div:has(> a)', 0, 1));

                const cssText = CosmeticApiCommon.getCssText(cosmeticResult, {
                    isNativeHasSupported: true,
                    areHitsStatsCollected: true,
                });
                const extCssRules = CosmeticApiCommon.getExtCssRules(cosmeticResult, {
                    isNativeHasSupported: true,
                    areHitsStatsCollected: true,
                });

                // Both selectors in native CSS with hit markers
                const expectedCss = '.simple { display: none !important; content: \'adguard0%3B0\' !important; }\r\n'
                    + 'div:has(> a) { display: none !important; content: \'adguard0%3B1\' !important; }';
                expect(cssText).toBe(expectedCss);

                // Extended CSS should be null
                expect(extCssRules).toBeNull();
            });
        });
    });
});
