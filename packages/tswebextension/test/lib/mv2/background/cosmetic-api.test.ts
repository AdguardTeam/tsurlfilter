import { CosmeticApi } from '@lib/mv2/background/cosmetic-api';
import { localScriptRulesService } from '@lib/mv2/background/services/local-script-rules-service';

import { CosmeticResult, CosmeticRule } from '@adguard/tsurlfilter';
import { USER_FILTER_ID } from '@lib/common/constants';
import { getLocalScriptRulesFixture } from './fixtures/local-script-rules';

/**
 * Creates cosmetic result for elemhide rules.
 *
 * @param rules Element hiding rules.
 *
 * @returns Element hiding rules cosmetic result.
 */
const getElemhideCosmeticResult = (rules: string[]): CosmeticResult => {
    const cosmeticResult = new CosmeticResult();
    rules.forEach((rule) => {
        cosmeticResult.elementHiding.append(new CosmeticRule(rule, 0));
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
    rules.forEach((rule) => {
        cosmeticResult.CSS.append(new CosmeticRule(rule, 0));
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
                expect(CosmeticApi.getCssText(cosmeticResult, false)).toEqual(expected);
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
                expect(CosmeticApi.getCssText(cosmeticResult, false)).toEqual(expected);
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
                    expected: 'h1 { display: none !important; content: \'adguard0%3Bexample.com%23%23h1\' !important; }',
                },
                {
                    // few specific rules
                    actual: [
                        'example.com##h1',
                        'example.org##h2',
                    ],
                    // eslint-disable-next-line max-len
                    expected: 'h1 { display: none !important; content: \'adguard0%3Bexample.com%23%23h1\' !important; }\r\nh2 { display: none !important; content: \'adguard0%3Bexample.org%23%23h2\' !important; }',
                },
                {
                    // few generic rules
                    actual: [
                        '##h1',
                        '##h2',
                    ],
                    // eslint-disable-next-line max-len
                    expected: 'h1 { display: none !important; content: \'adguard0%3B%23%23h1\' !important; }\r\nh2 { display: none !important; content: \'adguard0%3B%23%23h2\' !important; }',
                },
            ];
            test.each(testCases)('$actual', ({ actual, expected }) => {
                const cosmeticResult = getElemhideCosmeticResult(actual);
                expect(CosmeticApi.getCssText(cosmeticResult, true)).toEqual(expected);
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
                    expected: 'h1 { color: black !important; content: \'adguard0%3Bexample.com%23%24%23h1%20%7B%20color%3A%20black%20!important%3B%20%7D\' !important; }',
                },
                {
                    // few specific rules
                    actual: [
                        'example.com#$#h1 { color: black !important; }',
                        'example.org#$#h2 { color: red !important; }',
                    ],
                    // eslint-disable-next-line max-len
                    expected: 'h1 { color: black !important; content: \'adguard0%3Bexample.com%23%24%23h1%20%7B%20color%3A%20black%20!important%3B%20%7D\' !important; }\r\nh2 { color: red !important; content: \'adguard0%3Bexample.org%23%24%23h2%20%7B%20color%3A%20red%20!important%3B%20%7D\' !important; }',
                },
                {
                    // few generic rules
                    actual: [
                        '#$#h1 { color: black !important; }',
                        '#$#h2 { color: red !important; }',
                    ],
                    // eslint-disable-next-line max-len
                    expected: 'h1 { color: black !important; content: \'adguard0%3B%23%24%23h1%20%7B%20color%3A%20black%20!important%3B%20%7D\' !important; }\r\nh2 { color: red !important; content: \'adguard0%3B%23%24%23h2%20%7B%20color%3A%20red%20!important%3B%20%7D\' !important; }',
                },
            ];
            test.each(testCases)('$actual', ({ actual, expected }) => {
                const cosmeticResult = getCssCosmeticResult(actual);
                const exp = CosmeticApi.getCssText(cosmeticResult, true);
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
                expect(CosmeticApi.getExtCssRules(cosmeticResult, false)).toEqual(expected);
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
                expect(CosmeticApi.getExtCssRules(cosmeticResult, false)).toEqual(expected);
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
                        'h1 { display: none !important; content: \'adguard0%3Bexample.com%23%3F%23h1\' !important; }',
                    ],
                },
                {
                    // few specific rules
                    actual: [
                        'example.com#?#h1',
                        'example.org#?#h2',
                    ],
                    expected: [
                        'h1 { display: none !important; content: \'adguard0%3Bexample.com%23%3F%23h1\' !important; }',
                        'h2 { display: none !important; content: \'adguard0%3Bexample.org%23%3F%23h2\' !important; }',
                    ],
                },
                {
                    // few generic rules
                    actual: [
                        '#?#h1',
                        '#?#h2',
                    ],
                    expected: [
                        'h1 { display: none !important; content: \'adguard0%3B%23%3F%23h1\' !important; }',
                        'h2 { display: none !important; content: \'adguard0%3B%23%3F%23h2\' !important; }',
                    ],
                },
            ];
            test.each(testCases)('$actual', ({ actual, expected }) => {
                const cosmeticResult = getElemhideCosmeticResult(actual);
                expect(CosmeticApi.getExtCssRules(cosmeticResult, true)).toEqual(expected);
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
                        'h1 { color: black !important; content: \'adguard0%3Bexample.com%23%24%3F%23h1%20%7B%20color%3A%20black%20!important%3B%20%7D\' !important; }',
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
                        'h1 { color: black !important; content: \'adguard0%3Bexample.com%23%24%3F%23h1%20%7B%20color%3A%20black%20!important%3B%20%7D\' !important; }',
                        // eslint-disable-next-line max-len
                        'h2 { color: red !important; content: \'adguard0%3Bexample.org%23%24%3F%23h2%20%7B%20color%3A%20red%20!important%3B%20%7D\' !important; }',
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
                        'h1 { color: black !important; content: \'adguard0%3B%23%24%3F%23h1%20%7B%20color%3A%20black%20!important%3B%20%7D\' !important; }',
                        // eslint-disable-next-line max-len
                        'h2 { color: red !important; content: \'adguard0%3B%23%24%3F%23h2%20%7B%20color%3A%20red%20!important%3B%20%7D\' !important; }',
                    ],
                },
            ];
            test.each(testCases)('$actual', ({ actual, expected }) => {
                const cosmeticResult = getCssCosmeticResult(actual);
                expect(CosmeticApi.getExtCssRules(cosmeticResult, true)).toEqual(expected);
            });
        });
    });

    describe('returns correct script text', () => {
        const getScriptRules = (id: number): CosmeticRule[] => {
            return [
                new CosmeticRule('example.com#%#window.confirm = undefined;', id),
            ];
        };

        const getLocalScriptRules = (id: number): CosmeticRule[] => {
            return [
                new CosmeticRule('example.com#%#window.open = undefined;', id),
            ];
        };

        const getScriptletsRules = (id: number): CosmeticRule[] => {
            return [
                new CosmeticRule('example.com#%#//scriptlet("abort-on-property-read", "alert")', id),
            ];
        };

        it('allow scriptlets and JS rules from user filter in all browsers', () => {
            const userFilterRules = [
                ...getScriptRules(USER_FILTER_ID),
                ...getLocalScriptRules(USER_FILTER_ID),
                ...getScriptletsRules(USER_FILTER_ID),
            ];

            const scriptText = CosmeticApi.getScriptText(userFilterRules);

            const expectScriptText = userFilterRules.map((rule) => rule.getScript()).join('\n');

            expect(scriptText).toStrictEqual(expectScriptText);
        });

        it('allow scriptlets and JS rules from custom filter in all browsers, except FirefoxAMO', () => {
            const CUSTOM_FILTER_ID = 1001;

            const customFilterRules = [
                ...getScriptRules(CUSTOM_FILTER_ID),
                ...getLocalScriptRules(CUSTOM_FILTER_ID),
                ...getScriptletsRules(CUSTOM_FILTER_ID),
            ];

            const scriptText = CosmeticApi.getScriptText(customFilterRules);

            const expectScriptText = [
                ...getScriptRules(CUSTOM_FILTER_ID),
                ...getLocalScriptRules(CUSTOM_FILTER_ID),
                ...getScriptletsRules(CUSTOM_FILTER_ID),
            ].map((rule) => rule.getScript()).join('\n');

            expect(scriptText).toStrictEqual(expectScriptText);
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

            const expectFirefoxScriptText = [
                ...getLocalScriptRules(CUSTOM_FILTER_ID),
                ...getScriptletsRules(CUSTOM_FILTER_ID),
            ].map((rule) => rule.getScript()).join('\n');

            expect(firefoxScriptText).toStrictEqual(expectFirefoxScriptText);
        });
    });
});
