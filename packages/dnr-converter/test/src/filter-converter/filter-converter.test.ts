import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { RE2 } from '@adguard/re2-wasm';
import { SimpleRegex } from '@adguard/tsurlfilter';

import { type RuleCondition } from '../../../src/declarative-rule/rule-condition';
import { UnsupportedModifierError, UnsupportedRegexpError } from '../../../src/errors/conversion-errors';
import {
    EmptyOrNegativeNumberOfRulesError,
    NegativeNumberOfRulesError,
    ResourcesPathError,
} from '../../../src/errors/converter-options-errors';
import { UnavailableFilterSourceError } from '../../../src/errors/unavailable-sources-errors';
import { Filter } from '../../../src/filter/filter';
import { type IFilter } from '../../../src/filter/types';
import { FilterConverter } from '../../../src/filter-converter/filter-converter';
import { re2Validator } from '../../../src/re2-regexp/re2-validator';
import { regexValidatorNode } from '../../../src/re2-regexp/regex-validator-node';

/**
 * Creates a test IFilter from an array of rule strings.
 *
 * @param rules Array of rule text strings.
 * @param filterId Filter list ID.
 *
 * @returns IFilter mock.
 */
const createFilter = (rules: string[], filterId = 0): IFilter => {
    const content = rules.join('\n');

    return {
        getId: () => filterId,
        getContent: async () => content,
        getRuleByIndex: async () => '',
        unloadContent: () => {},
    };
};

/**
 * Creates a matcher for the URL pattern of a converted DNR condition.
 *
 * @param condition Converted DNR condition.
 *
 * @returns Matcher using RE2 for regex filters and the shared basic-pattern syntax for URL filters.
 */
const createUrlMatcher = (condition: RuleCondition): RegExp | RE2 => {
    const { urlFilter, regexFilter, isUrlFilterCaseSensitive } = condition;
    const flags = isUrlFilterCaseSensitive ? '' : 'i';
    return regexFilter
        ? new RE2(regexFilter, `${flags}u`)
        : new RegExp(SimpleRegex.patternToRegexp(urlFilter!), flags);
};

describe('FilterConverter', () => {
    const converter = new FilterConverter();

    beforeEach(() => {
        vi.spyOn(re2Validator, 'isRegexSupported').mockImplementation(regexValidatorNode);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('convert (single filter)', () => {
        it('converts network rules to declarative rules', async () => {
            const filter = createFilter(['||example.org^']);
            const [{ ruleset, errors, limitations }] = await converter.convert([filter]);

            const declarativeRules = ruleset.getDeclarativeRules();
            expect(declarativeRules.length).toBeGreaterThanOrEqual(1);
            expect(declarativeRules[0].condition.urlFilter).toBe('||example.org^');
            expect(errors).toBeDefined();
            expect(limitations).toBeDefined();
        });

        it('converts value-less $removeparam into a strip-all-query redirect, not a block', async () => {
            const filter = createFilter(['||example.org^$removeparam']);
            const [{ ruleset, errors }] = await converter.convert([filter]);

            const declarativeRules = ruleset.getDeclarativeRules();
            expect(errors).toHaveLength(0);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].action).toEqual({
                type: 'redirect',
                redirect: {
                    transform: {
                        query: '',
                    },
                },
            });
            expect(declarativeRules[0].condition.urlFilter).toBe('||example.org^');
            expect(declarativeRules[0].condition.resourceTypes).toEqual(['main_frame', 'sub_frame']);
        });

        it('converts value-less $removeparam with $domain into a strip-all-query redirect, not a block', async () => {
            const filter = createFilter(['$removeparam,domain=example.org']);
            const [{ ruleset, errors }] = await converter.convert([filter]);

            const declarativeRules = ruleset.getDeclarativeRules();
            expect(errors).toHaveLength(0);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].action).toEqual({
                type: 'redirect',
                redirect: {
                    transform: {
                        query: '',
                    },
                },
            });
            expect(declarativeRules[0].condition.initiatorDomains).toEqual(['example.org']);
            expect(declarativeRules[0].condition.resourceTypes).toEqual(['main_frame', 'sub_frame']);
        });

        it('converts $removeparam with a value into a query transform', async () => {
            const filter = createFilter(['||example.org^$removeparam=utm_source']);
            const [{ ruleset, errors }] = await converter.convert([filter]);

            const declarativeRules = ruleset.getDeclarativeRules();
            expect(errors).toHaveLength(0);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].action).toEqual({
                type: 'redirect',
                redirect: {
                    transform: {
                        queryTransform: {
                            removeParams: ['utm_source'],
                        },
                    },
                },
            });
        });

        it.each([
            ['first', '?cvid=tracking&q=adguard', '?q=adguard'],
            ['middle', '?q=adguard&cvid=tracking&form=QBRE', '?q=adguard&form=QBRE'],
            ['last', '?q=adguard&cvid=tracking', '?q=adguard'],
            ['only', '?cvid=tracking', ''],
        ])('removes a named parameter in the %s query position', async (_, query, expectedQuery) => {
            const [{ ruleset, errors }] = await converter.convert([
                createFilter(['||bing.com/search^$removeparam=cvid']),
            ]);
            expect(errors).toEqual([]);

            const [declarativeRule] = ruleset.getDeclarativeRules();
            const regexp = createUrlMatcher(declarativeRule.condition);
            const url = new URL(`https://bing.com/search${query}`);

            expect(regexp.test(url.href)).toBe(true);
            const removeParams = declarativeRule.action.redirect?.transform?.queryTransform?.removeParams;
            expect(removeParams).toEqual(['cvid']);
            removeParams!.forEach((param) => url.searchParams.delete(param));
            expect(url.href).toBe(`https://bing.com/search${expectedQuery}`);
            expect(regexp.test(url.href)).toBe(false);
        });

        it.each([
            { name: 'simple default', withSourceMap: false, matchCase: false },
            { name: 'simple match-case', withSourceMap: false, matchCase: true },
            { name: 'source-map default', withSourceMap: true, matchCase: false },
            { name: 'source-map match-case', withSourceMap: true, matchCase: true },
        ])('preserves long named parameter rules when generated RE2 exceeds its budget ($name)', async ({
            withSourceMap,
            matchCase,
        }) => {
            const pattern = '||subdomain.example-long-domain.co.uk/path/segment^';
            const rule = `${pattern}$removeparam=cvid${matchCase ? ',match-case' : ''}`;
            const filter = createFilter([rule]);
            const [{ ruleset, errors }] = withSourceMap
                ? await converter.convert([filter], { withSourceMap: true })
                : await converter.convert([filter]);

            expect(errors).toEqual([]);
            const declarativeRules = await ruleset.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(1);
            expect(ruleset.getRegexpRulesCount()).toBe(0);

            const [declarativeRule] = declarativeRules;
            const regexp = createUrlMatcher(declarativeRule.condition);
            const removeParams = declarativeRule.action.redirect?.transform?.queryTransform?.removeParams;
            expect(removeParams).toEqual(['cvid']);
            expect(regexp.test('https://subdomain.example-long-domain.co.uk/PATH/SEGMENT?q=keep&cvid=tracking'))
                .toBe(!matchCase);

            for (const query of ['?q=keep&cvid=tracking&control=keep', '?q=keep&cvid=tracking']) {
                const url = new URL(`https://subdomain.example-long-domain.co.uk/path/segment${query}`);
                expect(regexp.test(url.href)).toBe(true);
                removeParams!.forEach((param) => url.searchParams.delete(param));
                expect(regexp.test(url.href)).toBe(false);
            }
        });

        it('preserves removal rule restrictions after a generated RE2 rejection', async () => {
            const [{ ruleset, errors }] = await converter.convert([
                createFilter([
                    '||subdomain.example-long-domain.co.uk/path/segment^$removeparam=cvid,'
                    + 'domain=origin.example,to=subdomain.example-long-domain.co.uk,important,xmlhttprequest',
                ]),
            ]);

            expect(errors).toEqual([]);
            const declarativeRules = ruleset.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(1);
            const [declarativeRule] = declarativeRules;
            expect(declarativeRule.condition.initiatorDomains).toEqual(['origin.example']);
            expect(declarativeRule.condition.requestDomains).toEqual(['subdomain.example-long-domain.co.uk']);
            expect(declarativeRule.condition.resourceTypes).toEqual(['xmlhttprequest']);
            expect(declarativeRule.priority).toBeGreaterThan(1_000_000);
            expect(declarativeRule.action.redirect?.transform?.queryTransform?.removeParams).toEqual(['cvid']);
            const regexp = createUrlMatcher(declarativeRule.condition);
            expect(regexp.test('https://subdomain.example-long-domain.co.uk/path/segment?q=keep&cvid=tracking'))
                .toBe(true);
            expect(regexp.test('https://subdomain.example-long-domain.co.uk/path/segment?q=keep')).toBe(false);
        });

        it('keeps unsupported source regex rules as conversion errors', async () => {
            const [{ ruleset, errors }] = await converter.convert([
                createFilter([
                    '/(?<=test)example/$removeparam=cvid',
                    '/(?<=test)example/$script',
                ]),
            ]);

            expect(ruleset.getDeclarativeRules()).toHaveLength(0);
            expect(errors).toHaveLength(2);
            errors.forEach((error) => expect(error).toBeInstanceOf(UnsupportedRegexpError));
        });

        it.each([
            'https://bing.com/search?q=adguard',
            'https://bing.com/search?other_cvid=tracking',
            'https://bing.com/search?cvid_extra=tracking',
            'https://bing.com/search/cvid=tracking?control=keep',
            'https://bing.com/search?control=keep#cvid=tracking',
            'https://bing.com/search#?cvid=tracking',
            'https://bing.com/search?q=?cvid=tracking',
            'https://bing.com:8443/search?cvid=tracking',
            'https://bing.com/searchother?cvid=tracking',
            'https://bing.com/other?cvid=tracking',
            'https://other.example/search?cvid=tracking',
        ])('keeps named parameter removal scoped for %s', async (url) => {
            const [{ ruleset, errors }] = await converter.convert([
                createFilter(['||bing.com/search^$removeparam=cvid']),
            ]);
            expect(errors).toEqual([]);

            const [declarativeRule] = ruleset.getDeclarativeRules();
            const regexp = createUrlMatcher(declarativeRule.condition);

            expect(regexp.test(url)).toBe(false);
        });

        it.each([
            '||bing.com^$removeparam=cvid',
            '|https://bing.com/search^$removeparam=cvid',
            '||bing.com/search^$removeparam=%63vid',
        ])('matches the first parameter for %s', async (rule) => {
            const [{ ruleset, errors }] = await converter.convert([createFilter([rule])]);
            expect(errors).toEqual([]);
            const [declarativeRule] = ruleset.getDeclarativeRules();
            const regexp = createUrlMatcher(declarativeRule.condition);

            expect(regexp.test('https://bing.com/search?cvid=tracking&q=adguard')).toBe(true);
            expect(regexp.test('https://bing.com/search?q=adguard')).toBe(false);
        });

        it.each([
            'https://www.bing.com/search?cvid=tracking',
            'https://bing.com/search/subpage?cvid=tracking',
        ])('retains the original scope for %s', async (url) => {
            const [{ ruleset, errors }] = await converter.convert([
                createFilter(['||bing.com/search^$removeparam=cvid']),
            ]);
            expect(errors).toEqual([]);
            const [declarativeRule] = ruleset.getDeclarativeRules();
            const regexp = createUrlMatcher(declarativeRule.condition);

            expect(regexp.test(url)).toBe(true);
        });

        it.each([
            ['search^', 'https://example.test/?q=search&x=1&cvid=tracking'],
            ['bing.com^', 'https://example.test/?q=bing.com&x=1&cvid=tracking'],
        ])('retains an unanchored %s pattern match inside the query', async (pattern, requestUrl) => {
            const [{ ruleset, errors }] = await converter.convert([
                createFilter([`${pattern}$removeparam=cvid`]),
            ]);
            expect(errors).toEqual([]);
            const [declarativeRule] = ruleset.getDeclarativeRules();
            const regexp = createUrlMatcher(declarativeRule.condition);
            const url = new URL(requestUrl);

            expect(new RegExp(SimpleRegex.patternToRegexp(pattern)).test(url.href)).toBe(true);
            expect(url.searchParams.has('cvid')).toBe(true);
            expect(regexp.test(url.href)).toBe(true);
            url.searchParams.delete('cvid');
            expect(regexp.test(url.href)).toBe(false);
        });

        it.each([
            'https://example.test/?q=search?cvid=tracking',
            'https://example.test/?q=search?cvid=tracking&control=keep',
            'https://example.test/?q=search?cvid=tracking#fragment',
        ])('does not treat a nested question mark as the query boundary for %s', async (requestUrl) => {
            const [{ ruleset, errors }] = await converter.convert([
                createFilter(['search^$removeparam=cvid']),
            ]);
            expect(errors).toEqual([]);
            const [declarativeRule] = ruleset.getDeclarativeRules();
            const regexp = createUrlMatcher(declarativeRule.condition);
            const url = new URL(requestUrl);

            expect(url.searchParams.has('cvid')).toBe(false);
            expect(regexp.test(url.href)).toBe(false);
        });

        it('keeps a no-op higher-priority rule from masking a real parameter removal', async () => {
            const [{ ruleset, errors }] = await converter.convert([
                createFilter([
                    'search^$removeparam=cvid,important',
                    '||other.example^$removeparam=form',
                ]),
            ]);
            expect(errors).toEqual([]);
            const declarativeRules = ruleset.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(2);
            const url = new URL('https://other.example/?return=search?cvid=tracking&form=drop');
            expect(url.searchParams.has('cvid')).toBe(false);
            expect(url.searchParams.has('form')).toBe(true);

            const matchingRules = declarativeRules.filter((rule) => (
                createUrlMatcher(rule.condition).test(url.href)
            ));
            expect(matchingRules).toHaveLength(1);
            expect(matchingRules[0].action.redirect?.transform?.queryTransform?.removeParams).toEqual(['form']);
        });

        it.each([
            'https://user:pass@bing.com/search?q=hello&cvid=tracking',
            'https://user:pass@bing.com/search?cvid=tracking&q=hello',
            'https://user:pass@bing.com/search?cvid=tracking',
            'https://user@bing.com/search?q=hello&cvid=tracking',
            'https://:pass@bing.com/search?q=hello&cvid=tracking',
            'https://user:pass@www.bing.com/search?q=hello&cvid=tracking',
        ])('retains domain-anchor matches for a request with credentials: %s', async (requestUrl) => {
            const [{ ruleset, errors }] = await converter.convert([
                createFilter(['||bing.com/search^$removeparam=cvid']),
            ]);
            expect(errors).toEqual([]);
            const [declarativeRule] = ruleset.getDeclarativeRules();
            const regexp = createUrlMatcher(declarativeRule.condition);
            const url = new URL(requestUrl);

            expect(url.hostname === 'bing.com' || url.hostname.endsWith('.bing.com')).toBe(true);
            expect(url.searchParams.has('cvid')).toBe(true);
            expect(regexp.test(url.href)).toBe(true);
            url.searchParams.delete('cvid');
            expect(regexp.test(url.href)).toBe(false);
        });

        it.each([
            'https://bing.com@other.example/search?q=hello&cvid=tracking',
            'https://user:pass@bing.com.evil.example/search?q=hello&cvid=tracking',
            'https://user:pass@bing.com/other?q=hello&cvid=tracking',
            'https://user:pass@bing.com/search?q=hello',
        ])('preserves domain and path scope with credentials for %s', async (requestUrl) => {
            const [{ ruleset, errors }] = await converter.convert([
                createFilter(['||bing.com/search^$removeparam=cvid']),
            ]);
            expect(errors).toEqual([]);
            const [declarativeRule] = ruleset.getDeclarativeRules();
            const url = new URL(requestUrl);

            expect(createUrlMatcher(declarativeRule.condition).test(url.href)).toBe(false);
        });

        it.each([
            ['https://user:pass@bing.com/search?cvid=tracking', true],
            ['https://user:pass@bing.com/search?q=hello&cvid=tracking', true],
            ['https://bing.com@other.example/search?cvid=tracking', false],
            ['https://bing.com:pass@other.example/search?cvid=tracking', false],
            ['file://bing.com/search?cvid=tracking', true],
            ['https://user:pass@bing.com/search?q=hello#?cvid=tracking', false],
        ])('keeps a domain-only source pattern tied to the actual host for %s', async (requestUrl, matches) => {
            const [{ ruleset, errors }] = await converter.convert([
                createFilter(['||bing.com^$removeparam=cvid']),
            ]);
            expect(errors).toEqual([]);
            const [declarativeRule] = ruleset.getDeclarativeRules();
            const url = new URL(requestUrl);

            expect(createUrlMatcher(declarativeRule.condition).test(url.href)).toBe(matches);
        });

        it('retains an at-sign as a separator within the request path', async () => {
            const [{ ruleset, errors }] = await converter.convert([
                createFilter(['||bing.com/search^$removeparam=cvid']),
            ]);
            expect(errors).toEqual([]);
            const [declarativeRule] = ruleset.getDeclarativeRules();
            const url = new URL('https://bing.com/search@sub?cvid=tracking');

            expect(createUrlMatcher(declarativeRule.condition).test(url.href)).toBe(true);
        });

        it('escapes punctuation in named parameters', async () => {
            const [{ ruleset, errors }] = await converter.convert([
                createFilter(['||bing.com/search^$removeparam=cvid.foo']),
            ]);
            expect(errors).toEqual([]);
            const [declarativeRule] = ruleset.getDeclarativeRules();
            const regexp = createUrlMatcher(declarativeRule.condition);

            expect(regexp.test('https://bing.com/search?cvid.foo=tracking')).toBe(true);
            expect(regexp.test('https://bing.com/search?cvidXfoo=tracking')).toBe(false);
        });

        it.each([
            '||bing.com/search$removeparam=cvid',
            '$removeparam=cvid,domain=bing.com',
            '||bing.com/search^$removeparam',
            '||bing.com/search^$removeparam=cvid|form',
            '||bing.com/search*^$removeparam=cvid',
            '||bing.com/search?q=adguard^$removeparam=cvid',
            '||bing.com/search#fragment^$removeparam=cvid',
            '||bing.com/search^path^$removeparam=cvid',
        ])('keeps unaffected %s rules within the non-regex rule quota', async (rule) => {
            const [{ ruleset, errors }] = await converter.convert([createFilter([rule])]);
            expect(errors).toEqual([]);
            expect(ruleset.getDeclarativeRules()).toHaveLength(1);
            expect(ruleset.getRegexpRulesCount()).toBe(0);
        });

        it('chains named parameter redirects without repeating a completed removal', async () => {
            const [{ ruleset, errors }] = await converter.convert([
                createFilter([
                    '||bing.com/search^$removeparam=cvid',
                    '||bing.com/search^$removeparam=form',
                ]),
            ]);
            expect(errors).toEqual([]);
            const declarativeRules = ruleset.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(2);
            const url = new URL('https://bing.com/search?cvid=tracking&q=adguard&form=QBRE');

            for (let hop = 0; hop < 2; hop += 1) {
                const matchingRules = declarativeRules.filter((rule) => (
                    createUrlMatcher(rule.condition).test(url.href)
                ));
                expect(matchingRules).toHaveLength(2 - hop);
                const [matchingRule] = matchingRules;
                const removeParams = matchingRule.action.redirect?.transform?.queryTransform?.removeParams;
                expect(removeParams).toHaveLength(1);
                removeParams!.forEach((param) => url.searchParams.delete(param));
            }

            expect(url.href).toBe('https://bing.com/search?q=adguard');
            expect(declarativeRules.some((rule) => createUrlMatcher(rule.condition).test(url.href))).toBe(false);
        });

        it('reports a conversion error (not a block) for an undecodable $removeparam value', async () => {
            const filter = createFilter(['||example.org^$removeparam=%zz']);
            const [{ ruleset, errors }] = await converter.convert([filter]);

            expect(ruleset.getDeclarativeRules()).toHaveLength(0);
            expect(errors).toHaveLength(1);
            expect(errors[0]).toBeInstanceOf(UnsupportedModifierError);
        });

        it('applies an unanchored $urltransform pattern to the query string', async () => {
            vi.spyOn(re2Validator, 'isRegexSupported').mockResolvedValueOnce(true);

            const filter = createFilter([
                '||safebooru.org^$urltransform=/order%3A/sort%3A/i',
            ]);
            const requestUrl = 'https://safebooru.org/index.php?page=post&s=list&tags=order%3ascore';
            const expectedUrl = 'https://safebooru.org/index.php?page=post&s=list&tags=sort%3Ascore';

            const [{ ruleset, errors }] = await converter.convert([filter]);

            expect(errors).toEqual([]);

            const [declarativeRule] = ruleset.getDeclarativeRules();
            const { regexFilter, isUrlFilterCaseSensitive } = declarativeRule.condition;
            const regexSubstitution = declarativeRule.action.redirect?.regexSubstitution;

            expect(regexFilter).toBeDefined();
            expect(regexSubstitution).toBeDefined();

            const flags = isUrlFilterCaseSensitive === false ? 'i' : '';
            const regexp = new RegExp(regexFilter!, flags);
            const jsSubstitution = regexSubstitution!.replace(/\\([0-9])/g, '$$$1');

            expect(requestUrl.replace(regexp, jsSubstitution)).toBe(expectedUrl);
        });

        it('assigns a rule set id based on filter id', async () => {
            const filterId = 42;
            const filter = createFilter(['||example.org^'], filterId);
            const [{ ruleset }] = await converter.convert([filter]);

            expect(ruleset.getId()).toBe(FilterConverter.getRulesetId(filterId));
        });

        it('handles empty lines in filter list', async () => {
            const filter = createFilter([
                '||example.org^',
                '',
                '||example.com^',
                '',
                '',
                '||example.net^',
            ]);
            const [{ ruleset }] = await converter.convert([filter]);
            const declarativeRules = ruleset.getDeclarativeRules();

            // Three valid network rules should produce 3 declarative rules
            expect(declarativeRules).toHaveLength(3);
        });

        it('returns counters', async () => {
            const filter = createFilter([
                '||example.com^',
                '@@||example.io^',
            ]);
            const [{ ruleset }] = await converter.convert([filter]);

            expect(ruleset.getSafeRulesCount()).toStrictEqual(2);
        });

        it('does not throw on conversion errors', async () => {
            const filter = createFilter([
                '||example.com^',
                // Unsupported modifier will produce a conversion error
                '||example.org^$ping',
            ]);
            const [{ ruleset }] = await converter.convert([filter]);

            // At least the valid rule should be converted
            expect(ruleset.getSafeRulesCount()).toBeGreaterThanOrEqual(1);
        });
    });

    describe('convert (combined)', () => {
        it('converts multiple filters into one combined ruleset', async () => {
            const filter1 = createFilter(['||example.com^'], 1);
            const filter2 = createFilter(['||example.net^'], 2);

            const [{ ruleset }] = await converter.convert(
                [filter1, filter2],
                { combine: true },
            );

            const declarativeRules = ruleset.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(2);
            expect(ruleset.getId()).toBe(FilterConverter.COMBINED_RULESET_ID);
        });
    });

    describe('empty filters (fresh install)', () => {
        // Reproduces AG-55141: on a fresh install the user rules (0), allowlist
        // (100) and blocking-page trusted domains (-10) dynamic filters are all
        // empty. They must convert to zero rules without producing errors.
        it('converts empty filters to zero rules without errors', async () => {
            const userRules = createFilter([], 0);
            const allowlist = createFilter([], 100);
            const trustedDomains = createFilter([], -10);

            const [{ ruleset, errors }] = await converter.convert(
                [allowlist, trustedDomains, userRules],
                { combine: true },
            );
            const declarativeRules = ruleset.getDeclarativeRules();

            expect(errors).toHaveLength(0);
            expect(ruleset.getSafeRulesCount()).toBe(0);
            expect(declarativeRules).toHaveLength(0);
        });

        it('converts non-empty filters while ignoring empty ones, without errors', async () => {
            const emptyUserRules = createFilter([], 0);
            const allowlist = createFilter(['||example.org^'], 100);

            const [{ ruleset, errors }] = await converter.convert(
                [allowlist, emptyUserRules],
                { combine: true },
            );
            const declarativeRules = ruleset.getDeclarativeRules();

            expect(errors).toHaveLength(0);
            expect(declarativeRules.length).toBeGreaterThan(0);
        });

        it('rejects with UnavailableFilterSourceError when a filter source is genuinely unavailable', async () => {
            const failingFilter = new Filter(
                100,
                async () => {
                    throw new Error('source failure');
                },
            );

            await expect(converter.convert([failingFilter], { combine: true }))
                .rejects.toThrow(UnavailableFilterSourceError);
        });
    });

    describe('respects limitations', () => {
        it('limits max number of rules', async () => {
            const filter = createFilter([
                '||example1.com^',
                '||example2.com^',
                '||example3.com^',
            ]);
            const [{ ruleset, limitations }] = await converter.convert(
                [filter],
                { maxNumberOfRules: 2 },
            );

            const declarativeRules = ruleset.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(2);
            expect(limitations.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('checks converter options', () => {
        it('throws error when empty resources path provided', async () => {
            const filter = createFilter(['||example.org^']);
            const resourcesPath = '';
            const convert = async (): Promise<void> => {
                await converter.convert([filter], { resourcesPath });
            };

            const msg = 'Path to web accessible resources should '
                + `start with a leading slash: ${resourcesPath}`;
            await expect(convert).rejects.toThrow(new ResourcesPathError(msg));
        });

        it('throws error if the resources path does not start with a slash', async () => {
            const filter = createFilter(['||example.org^']);
            const resourcesPath = 'path';
            const convert = async (): Promise<void> => {
                await converter.convert([filter], { resourcesPath });
            };

            const msg = 'Path to web accessible resources should '
                + `start with a leading slash: ${resourcesPath}`;
            await expect(convert).rejects.toThrow(new ResourcesPathError(msg));
        });

        it('throws error if the resources path ended with a slash', async () => {
            const filter = createFilter(['||example.org^']);
            const resourcesPath = '/path/';
            const convert = async (): Promise<void> => {
                await converter.convert([filter], { resourcesPath });
            };

            const msg = 'Path to web accessible resources should '
                + `not end with a slash: ${resourcesPath}`;
            await expect(convert).rejects.toThrow(new ResourcesPathError(msg));
        });

        it('throws error if max number of rules is equal to or less than 0', async () => {
            const filter = createFilter(['||example.org^']);
            const maxNumberOfRules = 0;
            const convert = async (): Promise<void> => {
                await converter.convert([filter], { maxNumberOfRules });
            };

            const msg = 'Maximum number of rules cannot be equal or less than 0';
            await expect(convert).rejects.toThrow(new EmptyOrNegativeNumberOfRulesError(msg));
        });

        it('throws error if max number of regexp rules is less than 0', async () => {
            const filter = createFilter(['||example.org^']);
            const maxNumberOfRegexpRules = -1;
            const convert = async (): Promise<void> => {
                await converter.convert([filter], { maxNumberOfRegexpRules });
            };

            const msg = 'Maximum number of regexp rules cannot be less than 0';
            await expect(convert).rejects.toThrow(new NegativeNumberOfRulesError(msg));
        });

        it('throws error if max number of unsafe rules is less than 0', async () => {
            const filter = createFilter(['||example.org^']);
            const maxNumberOfUnsafeRules = -1;
            const convert = async (): Promise<void> => {
                await converter.convert([filter], { maxNumberOfUnsafeRules });
            };

            const msg = 'Maximum number of unsafe rules cannot be less than 0';
            await expect(convert).rejects.toThrow(new NegativeNumberOfRulesError(msg));
        });
    });
});
