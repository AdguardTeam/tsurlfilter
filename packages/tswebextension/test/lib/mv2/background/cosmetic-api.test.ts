import {
    describe,
    expect,
    it,
    test,
    vi,
} from 'vitest';
import { CosmeticResult, type CosmeticRule } from '@adguard/tsurlfilter';

import { createCosmeticRule } from '../../../helpers/rule-creator';
import { CosmeticApi } from '../../../../src/lib/mv2/background/cosmetic-api';
import { localScriptRulesService } from '../../../../src/lib/mv2/background/services/local-script-rules-service';
import { USER_FILTER_ID } from '../../../../src/lib/common/constants';

import { getLocalScriptRulesFixture } from './fixtures/local-script-rules';

vi.mock('../../../../src/lib/mv2/background/app-context', async () => {
    const { MockAppContext } = await import('./mocks/mock-app-context');
    return {
        appContext: vi.fn(() => new MockAppContext()),
    };
});

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

describe('cosmetic api', () => {
    describe('getCssText()', () => {
        describe('elemhide rules + no hits counter', () => {
            const testCases = [
                {
                    // one specific rule
                    actual: [
                        'example.com##h1',
                    ],
                    expected: 'h1 { display: none !important; }',
                },
                {
                    // few specific rules
                    actual: [
                        'example.com##h1',
                        'example.org##h2',
                    ],
                    expected: 'h1, h2 { display: none !important; }',
                },
                {
                    // few generic rules
                    actual: [
                        '##h1',
                        '##h2',
                    ],
                    expected: 'h1, h2 { display: none !important; }',
                },
            ];
            test.each(testCases)('$actual', ({ actual, expected }) => {
                const cosmeticResult = getElemhideCosmeticResult(actual);
                expect(CosmeticApi.getCssText(
                    cosmeticResult,
                    {
                        areHitsStatsCollected: false,
                    },
                )).toEqual(expected);
            });
        });

        describe('css rules + no hits counter', () => {
            const testCases = [
                {
                    // one specific rule
                    actual: [
                        'example.com#$#h1 { color: black !important; }',
                    ],
                    expected: 'h1 { color: black !important; }',
                },
                {
                    // few specific rules
                    actual: [
                        'example.com#$#h1 { color: black !important; }',
                        'example.org#$#h2 { color: red !important; }',
                    ],
                    expected: 'h1 { color: black !important; }\r\nh2 { color: red !important; }',
                },
                {
                    // few generic rules
                    actual: [
                        '#$#h1 { color: black !important; }',
                        '#$#h2 { color: red !important; }',
                    ],
                    expected: 'h1 { color: black !important; }\r\nh2 { color: red !important; }',
                },
            ];
            test.each(testCases)('$actual', ({ actual, expected }) => {
                const cosmeticResult = getCssCosmeticResult(actual);
                expect(CosmeticApi.getCssText(
                    cosmeticResult,
                    {
                        areHitsStatsCollected: false,
                    },
                )).toEqual(expected);
            });
        });

        describe('elemhide rules + hits counter enabled', () => {
            const testCases = [
                {
                    // one specific rules
                    actual: [
                        'example.com##h1',
                    ],
                    // eslint-disable-next-line max-len
                    expected: 'h1 { display: none !important; content: \'adguard0%3B0\' !important; }',
                },
                {
                    // few specific rules
                    actual: [
                        'example.com##h1',
                        'example.org##h2',
                    ],
                    // eslint-disable-next-line max-len
                    expected: 'h1 { display: none !important; content: \'adguard0%3B0\' !important; }\r\nh2 { display: none !important; content: \'adguard0%3B1\' !important; }',
                },
                {
                    // few generic rules
                    actual: [
                        '##h1',
                        '##h2',
                    ],
                    // eslint-disable-next-line max-len
                    expected: 'h1 { display: none !important; content: \'adguard0%3B0\' !important; }\r\nh2 { display: none !important; content: \'adguard0%3B1\' !important; }',
                },
            ];
            test.each(testCases)('$actual', ({ actual, expected }) => {
                const cosmeticResult = getElemhideCosmeticResult(actual);
                expect(CosmeticApi.getCssText(
                    cosmeticResult,
                    {
                        areHitsStatsCollected: true,
                    },
                )).toEqual(expected);
            });
        });

        describe('css rules + hits counter enabled', () => {
            const testCases = [
                {
                    // one specific rules
                    actual: [
                        'example.com#$#h1 { color: black !important; }',
                    ],
                    // eslint-disable-next-line max-len
                    expected: 'h1 { color: black !important; content: \'adguard0%3B0\' !important; }',
                },
                {
                    // few specific rules
                    actual: [
                        'example.com#$#h1 { color: black !important; }',
                        'example.org#$#h2 { color: red !important; }',
                    ],
                    // eslint-disable-next-line max-len
                    expected: 'h1 { color: black !important; content: \'adguard0%3B0\' !important; }\r\nh2 { color: red !important; content: \'adguard0%3B1\' !important; }',
                },
                {
                    // few generic rules
                    actual: [
                        '#$#h1 { color: black !important; }',
                        '#$#h2 { color: red !important; }',
                    ],
                    // eslint-disable-next-line max-len
                    expected: 'h1 { color: black !important; content: \'adguard0%3B0\' !important; }\r\nh2 { color: red !important; content: \'adguard0%3B1\' !important; }',
                },
            ];
            test.each(testCases)('$actual', ({ actual, expected }) => {
                const cosmeticResult = getCssCosmeticResult(actual);
                const exp = CosmeticApi.getCssText(
                    cosmeticResult,
                    {
                        areHitsStatsCollected: true,
                    },
                );
                expect(exp).toEqual(expected);
            });
        });
    });

    describe('getExtCssRules()', () => {
        describe('elemhide rules + no hits counter', () => {
            const testCases = [
                {
                    // one specific rule
                    actual: [
                        'example.com#?#h1',
                    ],
                    expected: [
                        'h1 { display: none !important; }',
                    ],
                },
                {
                    // few specific rules
                    actual: [
                        'example.com#?#h1',
                        'example.org#?#h2',
                    ],
                    expected: [
                        'h1 { display: none !important; }',
                        'h2 { display: none !important; }',
                    ],
                },
                {
                    // few generic rules
                    actual: [
                        '#?#h1',
                        '#?#h2',
                    ],
                    expected: [
                        'h1 { display: none !important; }',
                        'h2 { display: none !important; }',
                    ],
                },
            ];
            test.each(testCases)('$actual', ({ actual, expected }) => {
                const cosmeticResult = getElemhideCosmeticResult(actual);
                expect(CosmeticApi.getExtCssRules(
                    cosmeticResult,
                    {
                        areHitsStatsCollected: false,
                    },
                )).toEqual(expected);
            });
        });

        describe('css rules + no hits counter', () => {
            const testCases = [
                {
                    // one specific rule
                    actual: [
                        'example.com#$?#h1 { color: black !important; }',
                    ],
                    expected: [
                        'h1 { color: black !important; }',
                    ],
                },
                {
                    // few specific rules
                    actual: [
                        'example.com#$?#h1 { color: black !important; }',
                        'example.org#$?#h2 { color: red !important; }',
                    ],
                    expected: [
                        'h1 { color: black !important; }',
                        'h2 { color: red !important; }',
                    ],
                },
                {
                    // few generic rules
                    actual: [
                        '#$?#h1 { color: black !important; }',
                        '#$?#h2 { color: red !important; }',
                    ],
                    expected: [
                        'h1 { color: black !important; }',
                        'h2 { color: red !important; }',
                    ],
                },
            ];
            test.each(testCases)('$actual', ({ actual, expected }) => {
                const cosmeticResult = getCssCosmeticResult(actual);
                expect(CosmeticApi.getExtCssRules(
                    cosmeticResult,
                    {
                        areHitsStatsCollected: false,
                    },
                )).toEqual(expected);
            });
        });

        describe('elemhide rules + hits counter enabled', () => {
            const testCases = [
                {
                    // one specific rules
                    actual: [
                        'example.com#?#h1',
                    ],
                    expected: [
                        'h1 { display: none !important; content: \'adguard0%3B0\' !important; }',
                    ],
                },
                {
                    // few specific rules
                    actual: [
                        'example.com#?#h1',
                        'example.org#?#h2',
                    ],
                    expected: [
                        'h1 { display: none !important; content: \'adguard0%3B0\' !important; }',
                        'h2 { display: none !important; content: \'adguard0%3B1\' !important; }',
                    ],
                },
                {
                    // few generic rules
                    actual: [
                        '#?#h1',
                        '#?#h2',
                    ],
                    expected: [
                        'h1 { display: none !important; content: \'adguard0%3B0\' !important; }',
                        'h2 { display: none !important; content: \'adguard0%3B1\' !important; }',
                    ],
                },
            ];
            test.each(testCases)('$actual', ({ actual, expected }) => {
                const cosmeticResult = getElemhideCosmeticResult(actual);
                expect(CosmeticApi.getExtCssRules(
                    cosmeticResult,
                    {
                        areHitsStatsCollected: true,
                    },
                )).toEqual(expected);
            });
        });

        describe('css rules + hits counter enabled', () => {
            const testCases = [
                {
                    // one specific rules
                    actual: [
                        'example.com#$?#h1 { color: black !important; }',
                    ],
                    expected: [
                        // eslint-disable-next-line max-len
                        'h1 { color: black !important; content: \'adguard0%3B0\' !important; }',
                    ],
                },
                {
                    // few specific rules
                    actual: [
                        'example.com#$?#h1 { color: black !important; }',
                        'example.org#$?#h2 { color: red !important; }',
                    ],
                    expected: [
                        // eslint-disable-next-line max-len
                        'h1 { color: black !important; content: \'adguard0%3B0\' !important; }',
                        // eslint-disable-next-line max-len
                        'h2 { color: red !important; content: \'adguard0%3B1\' !important; }',
                    ],
                },
                {
                    // few generic rules
                    actual: [
                        '#$?#h1 { color: black !important; }',
                        '#$?#h2 { color: red !important; }',
                    ],
                    expected: [
                        // eslint-disable-next-line max-len
                        'h1 { color: black !important; content: \'adguard0%3B0\' !important; }',
                        // eslint-disable-next-line max-len
                        'h2 { color: red !important; content: \'adguard0%3B1\' !important; }',
                    ],
                },
            ];
            test.each(testCases)('$actual', ({ actual, expected }) => {
                const cosmeticResult = getCssCosmeticResult(actual);
                expect(CosmeticApi.getExtCssRules(
                    cosmeticResult,
                    {
                        areHitsStatsCollected: true,
                    },
                )).toEqual(expected);
            });
        });
    });

    describe('returns correct script text', () => {
        const getScriptRules = (id: number): CosmeticRule[] => {
            return [
                createCosmeticRule('example.com#%#window.confirm = undefined;', id),
            ];
        };

        const getLocalScriptRules = (id: number): CosmeticRule[] => {
            return [
                createCosmeticRule('example.com#%#window.open = undefined;', id),
            ];
        };

        const getScriptletsRules = (id: number): CosmeticRule[] => {
            return [
                createCosmeticRule('example.com#%#//scriptlet("abort-on-property-read", "alert")', id),
            ];
        };

        const wrapScriptText = (text: string): string => {
            return `
            (function () {
                try {
                    ${text}
                } catch (ex) {
                    console.error('Error executing AG js: ' + ex);
                }
            })();
            //# sourceURL=ag-scripts.js
            `;
        };

        it('allow scriptlets and JS rules from user filter in all browsers', () => {
            const userFilterRules = [
                ...getScriptRules(USER_FILTER_ID),
                ...getLocalScriptRules(USER_FILTER_ID),
                ...getScriptletsRules(USER_FILTER_ID),
            ];

            const scriptText = CosmeticApi.getScriptText(userFilterRules);

            const expectScriptText = wrapScriptText(userFilterRules.map((rule) => rule.getScript()).join('\n'));

            expect(scriptText?.replace(/\s/g, '')).toStrictEqual(expectScriptText.replace(/\s/g, ''));
        });

        it('no rules -- empty string', () => {
            const testRules: CosmeticRule[] = [];

            const scriptText = CosmeticApi.getScriptText(testRules);

            expect(scriptText).toStrictEqual('');
        });

        it('allow scriptlets and JS rules from custom filter in all browsers, except FirefoxAMO', () => {
            const CUSTOM_FILTER_ID = 1001;

            const customFilterRules = [
                ...getScriptRules(CUSTOM_FILTER_ID),
                ...getLocalScriptRules(CUSTOM_FILTER_ID),
                ...getScriptletsRules(CUSTOM_FILTER_ID),
            ];

            const scriptText = CosmeticApi.getScriptText(customFilterRules);

            const expectScriptText = wrapScriptText([
                ...getScriptRules(CUSTOM_FILTER_ID),
                ...getLocalScriptRules(CUSTOM_FILTER_ID),
                ...getScriptletsRules(CUSTOM_FILTER_ID),
            ].map((rule) => rule.getScript()).join('\n'));

            expect(scriptText?.replace(/\s/g, '')).toStrictEqual(expectScriptText.replace(/\s/g, ''));
        });

        it('allow scriptlets and JS rules (only from pre-built JSON) from custom filter in Firefox AMO', () => {
            const CUSTOM_FILTER_ID = 1001;

            const customFilterRules = [
                ...getScriptRules(CUSTOM_FILTER_ID),
                ...getLocalScriptRules(CUSTOM_FILTER_ID),
                ...getScriptletsRules(CUSTOM_FILTER_ID),
            ];

            // Emulate Firefox AMO case
            localScriptRulesService.setLocalScriptRules(getLocalScriptRulesFixture());

            const firefoxScriptText = CosmeticApi.getScriptText(customFilterRules);

            const expectFirefoxScriptText = wrapScriptText([
                ...getLocalScriptRules(CUSTOM_FILTER_ID),
                ...getScriptletsRules(CUSTOM_FILTER_ID),
            ].map((rule) => rule.getScript()).join('\n'));

            expect(firefoxScriptText?.replace(/\s/g, '')).toStrictEqual(expectFirefoxScriptText.replace(/\s/g, ''));
        });
    });
});
