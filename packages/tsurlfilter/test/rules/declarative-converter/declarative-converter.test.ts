import { DeclarativeFilterConverter } from '../../../src/rules/declarative-converter/filter-converter';
import { Filter } from '../../../src/rules/declarative-converter/filter';
import { TooManyRulesError } from '../../../src/rules/declarative-converter/errors/limitation-errors';
import {
    EmptyOrNegativeNumberOfRulesError,
    ResourcesPathError,
} from '../../../src/rules/declarative-converter/errors/converter-options-errors';
import { UnsupportedModifierError } from '../../../src/rules/declarative-converter/errors/conversion-errors';
import { NetworkRule } from '../../../src/rules/network-rule';
import { RuleActionType } from '../../../src/rules/declarative-converter/declarative-rule';

const createFilter = (
    rules: string[],
    filterId: number = 0,
) => {
    return new Filter(
        filterId,
        { getContent: async () => rules },
    );
};

describe('DeclarativeConverter', () => {
    const converter = new DeclarativeFilterConverter();

    it('converts simple blocking rule', async () => {
        const filter = createFilter(['||example.org^']);
        const { ruleSet } = await converter.convertStaticRuleSet(filter);
        const declarativeRules = await ruleSet.getDeclarativeRules();

        const ruleId = 1;

        expect(declarativeRules).toHaveLength(1);
        expect(declarativeRules[0]).toStrictEqual({
            id: ruleId,
            action: { type: 'block' },
            condition: {
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: false,
            },
            priority: 1,
        });
    });

    it('converts simple blocking regexp rule', async () => {
        const filter = createFilter(['/banner\\d+/$third-party']);
        const { ruleSet } = await converter.convertStaticRuleSet(filter);
        const declarativeRules = await ruleSet.getDeclarativeRules();

        const ruleId = 1;

        expect(declarativeRules).toHaveLength(1);
        expect(declarativeRules[0]).toEqual({
            id: ruleId,
            action: { type: 'block' },
            condition: {
                regexFilter: '/banner\\d+/',
                domainType: 'thirdParty',
                isUrlFilterCaseSensitive: false,
            },
            priority: 2,
        });
    });

    it('converts simple blocking regexp rule with ? quantifier', async () => {
        const filter = createFilter(['/aaa?/']);
        const { ruleSet } = await converter.convertStaticRuleSet(filter);
        const declarativeRules = await ruleSet.getDeclarativeRules();

        const ruleId = 1;

        expect(declarativeRules).toHaveLength(1);
        expect(declarativeRules[0]).toEqual({
            id: ruleId,
            action: { type: 'block' },
            condition: {
                regexFilter: '/aaa?/',
                isUrlFilterCaseSensitive: false,
            },
            priority: 1,
        });
    });

    // TODO: Add cases for domain intersections
    describe('respects badfilter rules', () => {
        it('applies $badfilter to one filter', async () => {
            const filter = createFilter([
                '||example.org^',
                '||example.org^$badfilter',
                '||persistent.com^',
            ]);
            const { ruleSet } = await converter.convertStaticRuleSet(filter);
            const declarativeRules = await ruleSet.getDeclarativeRules();

            const ruleId = 3;

            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: ruleId,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||persistent.com^',
                    isUrlFilterCaseSensitive: false,
                },
                priority: 1,
            });
        });

        it('applies $badfilter to one filter with allowlist', async () => {
            const filter = createFilter([
                '||example.org^',
                '@@||example.org^',
                '@@||example.org^$badfilter',
            ]);
            const { ruleSet } = await converter.convertStaticRuleSet(filter);
            const declarativeRules = await ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.org^',
                    isUrlFilterCaseSensitive: false,
                },
                priority: 1,
            });
        });

        it('applies badfilter to multiple filters', async () => {
            const filter = createFilter([
                '||example.org^',
            ], 0);
            const filter2 = createFilter([
                '||example.com^',
                '||example.com^$badfilter',
                '||example.org^$badfilter',
                '||persistent.com^',
            ], 1);
            const filter3 = createFilter([
                '||example.org^$badfilter',
            ], 2);
            const { ruleSet } = await converter.convertDynamicRuleSets([
                filter, filter2, filter3,
            ], []);
            const declarativeRules = await ruleSet.getDeclarativeRules();

            const ruleId = 4;

            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: ruleId,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||persistent.com^',
                    isUrlFilterCaseSensitive: false,
                },
                priority: 1,
            });
        });

        it('applies $badfilter rules from static filter to user rules', async () => {
            const staticFilter = createFilter([
                '||example.com^',
                '||example.org^$badfilter',
            ]);
            const userRules = createFilter([
                '||example.org^',
                '||persistent.com^',
            ]);
            const { ruleSet: staticRuleSet } = await converter.convertStaticRuleSet(staticFilter);
            const { ruleSet } = await converter.convertDynamicRuleSets([userRules], [staticRuleSet]);
            const declarativeRules = await ruleSet.getDeclarativeRules();

            const ruleId = 2;

            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: ruleId,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||persistent.com^',
                    isUrlFilterCaseSensitive: false,
                },
                priority: 1,
            });
        });

        it('applies badfilter rules from user rules to static filter', async () => {
            const ruleToCancel1 = '||example.com^';
            const ruleToCancel2 = '||example.io^';

            const staticFilter = createFilter([
                '||example.org^',
                ruleToCancel1,
                '||example.net^',
                ruleToCancel2,
            ], 1);

            const userRules = createFilter([
                `${ruleToCancel1}$badfilter`,
                '||persistent.com^',
                `${ruleToCancel2}$badfilter`,
            ], 2);

            const { ruleSet } = await converter.convertStaticRuleSet(staticFilter);
            const {
                declarativeRulesToCancel,
            } = await converter.convertDynamicRuleSets([userRules], [ruleSet]);

            expect(declarativeRulesToCancel).toBeDefined();
            if (declarativeRulesToCancel === undefined) {
                return;
            }

            expect(declarativeRulesToCancel).toHaveLength(1);
            const { rulesetId, disableRuleIds } = declarativeRulesToCancel[0];

            expect(rulesetId).toBe(ruleSet.getId());

            expect(disableRuleIds[0]).toEqual(2);
            let source = await ruleSet.getRulesById(2);
            expect(source[0].sourceRule).toBe(ruleToCancel1);

            expect(disableRuleIds[1]).toEqual(4);
            source = await ruleSet.getRulesById(4);
            expect(source[0].sourceRule).toBe(ruleToCancel2);
        });

        it('applies badfilter rules from custom filter and user rules to several static filters', async () => {
            const ruleToCancel1 = '||example.com^';
            const ruleToCancel2 = '||example.io^';
            const ruleToCancel3 = '||evil.net^';

            const staticFilter1 = createFilter([
                '||example.org^',
                ruleToCancel1,
                '||example.net^',
                ruleToCancel2,
            ], 1);
            const staticFilter2 = createFilter([
                '||good.org^',
                '||good.io^',
                ruleToCancel3,
            ], 2);
            const converted = await Promise.all([
                converter.convertStaticRuleSet(staticFilter1),
                converter.convertStaticRuleSet(staticFilter2),
            ]);
            const staticRuleSets = converted.map(({ ruleSet }) => ruleSet);

            const customFilter1 = createFilter([
                '||good.org##h1',
                `${ruleToCancel3}$badfilter`,
            ], 3);
            const userRules = createFilter([
                `${ruleToCancel1}$badfilter`,
                '||persistent.com^',
                `${ruleToCancel2}$badfilter`,
            ], 4);
            const {
                declarativeRulesToCancel,
            } = await converter.convertDynamicRuleSets([customFilter1, userRules], staticRuleSets);

            expect(declarativeRulesToCancel).toBeDefined();
            if (declarativeRulesToCancel === undefined) {
                return;
            }

            expect(declarativeRulesToCancel).toHaveLength(2);

            const [disableStatic1, disableStatic2] = declarativeRulesToCancel;

            // Check first static filter.
            expect(disableStatic1.rulesetId).toBe(staticRuleSets[0].getId());

            expect(disableStatic1.disableRuleIds).toHaveLength(2);

            expect(disableStatic1.disableRuleIds[0]).toEqual(2);
            let source = await staticRuleSets[0].getRulesById(2);
            expect(source[0].sourceRule).toBe(ruleToCancel1);

            expect(disableStatic1.disableRuleIds[1]).toEqual(4);
            source = await staticRuleSets[0].getRulesById(4);
            expect(source[0].sourceRule).toBe(ruleToCancel2);

            // Check second static filter.
            expect(disableStatic2.rulesetId).toBe(staticRuleSets[1].getId());

            expect(disableStatic2.disableRuleIds).toHaveLength(1);

            expect(disableStatic2.disableRuleIds[0]).toEqual(3);
            source = await staticRuleSets[1].getRulesById(3);
            expect(source[0].sourceRule).toBe(ruleToCancel3);
        });
    });

    it('skips some inapplicable rules', async () => {
        const filter = createFilter([
            '||example.org^$badfilter',
            '@@||example.org^$elemhide',
        ]);
        const { ruleSet } = await converter.convertStaticRuleSet(filter);
        const declarativeRules = await ruleSet.getDeclarativeRules();

        expect(declarativeRules).toHaveLength(0);
    });

    it('respects document and ignores urlblock modifiers', async () => {
        const filter = createFilter([
            '@@||example.org^$document',
            '@@||example.com^$urlblock',
        ]);
        const { ruleSet } = await converter.convertStaticRuleSet(filter);
        const declarativeRules = await ruleSet.getDeclarativeRules();

        expect(declarativeRules).toHaveLength(1);
        expect(declarativeRules[0]).toStrictEqual({
            id: 1,
            priority: 140101,
            action: { type: 'allowAllRequests' },
            condition: {
                isUrlFilterCaseSensitive: false,
                resourceTypes: ['main_frame'],
                urlFilter: '||example.org^',
            },
        });
    });

    it('returns original rule text for specified declarative rule', async () => {
        const rules = [
            '||testcases.adguard.com$xmlhttprequest,removeparam=p1case1',
            '||testcases.adguard.com$xmlhttprequest,removeparam=p2case1',
            '||testcases.adguard.com$xmlhttprequest,removeparam=P3Case1',
        ];
        const additionalRule = '$xmlhttprequest,removeparam=p1case2';
        const filter = createFilter([
            ...rules,
            additionalRule,
        ]);
        const { ruleSet } = await converter.convertStaticRuleSet(filter);

        let sources = await ruleSet.getRulesById(1);
        let originalRules = sources.map(({ sourceRule }) => sourceRule);
        expect(originalRules).toEqual(expect.arrayContaining(rules));

        sources = await ruleSet.getRulesById(4);
        originalRules = sources.map(({ sourceRule }) => sourceRule);
        expect(originalRules).toEqual(expect.arrayContaining([additionalRule]));
    });

    it('returns badfilter sources', async () => {
        const rulesToCancel = [
            '||example.net^$document,badfilter',
            '||example.io^$badfilter',
        ];
        const rules = [
            '||example.com^$document',
            `${rulesToCancel[0]}`,
            '||example.org^$document',
            `${rulesToCancel[1]}`,
        ];
        const filter = createFilter(rules);
        const { ruleSet } = await converter.convertStaticRuleSet(filter);

        const badFilterRules = await ruleSet.getBadFilterRules();
        expect(badFilterRules[0].rule.getText()).toEqual(rulesToCancel[0]);
        expect(badFilterRules[1].rule.getText()).toEqual(rulesToCancel[1]);
    });

    describe('respects limitations', () => {
        it('work with max number of rules in one filter', async () => {
            const filter = createFilter([
                '||example.org^',
                '||example.com^',
                '||example.net^',
            ]);

            const { ruleSet } = await converter.convertStaticRuleSet(
                filter,
                { maxNumberOfRules: 2 },
            );
            const declarativeRules = await ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0]).toStrictEqual({
                id: 1,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.org^',
                    isUrlFilterCaseSensitive: false,
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: 2,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.com^',
                    isUrlFilterCaseSensitive: false,
                },
            });
        });

        it('work with max number of rules in many filter', async () => {
            const filter1 = createFilter([
                '||example.org^',
                '||example.com^',
                '||example.net^',
            ], 0);
            const filter2 = createFilter([
                '||example.co.uk^',
                '||example.io^',
            ], 1);

            const { ruleSet } = await converter.convertDynamicRuleSets(
                [filter1, filter2],
                [],
                { maxNumberOfRules: 4 },
            );
            const declarativeRules = await ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(4);
            expect(declarativeRules[0]).toStrictEqual({
                id: 1,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.org^',
                    isUrlFilterCaseSensitive: false,
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: 2,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.com^',
                    isUrlFilterCaseSensitive: false,
                },
            });
            expect(declarativeRules[2]).toStrictEqual({
                id: 3,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.net^',
                    isUrlFilterCaseSensitive: false,
                },
            });
            expect(declarativeRules[3]).toStrictEqual({
                id: 4,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.co.uk^',
                    isUrlFilterCaseSensitive: false,
                },
            });
        });

        it('work with max number of regexp rules', async () => {
            const filter = createFilter([
                '/.s/src/[a-z0-9]*.js/$domain=plasma.3dn.ru',
                '/dbp/pre/$script,third-party',
                '/wind10.ru/w*.js/$domain=wind10.ru,',
            ]);

            const { ruleSet } = await converter.convertStaticRuleSet(
                filter,
                { maxNumberOfRules: 2 },
            );
            const declarativeRules = await ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0]).toStrictEqual({
                id: 1,
                priority: 201,
                action: { type: 'block' },
                condition: {
                    initiatorDomains: ['plasma.3dn.ru'],
                    isUrlFilterCaseSensitive: false,
                    regexFilter: '/.s/src/[a-z0-9]*.js/',
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: 2,
                priority: 102,
                action: { type: 'block' },
                condition: {
                    domainType: 'thirdParty',
                    regexFilter: '/dbp/pre/',
                    resourceTypes: ['script'],
                    isUrlFilterCaseSensitive: false,
                },
            });
        });

        it('return limitations errors', async () => {
            const filter = createFilter([
                '||example.org^',
                '||example.com^',
                '||example.net^',
            ]);

            const maxNumberOfRules = 2;

            const { ruleSet, limitations } = await converter.convertStaticRuleSet(
                filter,
                { maxNumberOfRules },
            );
            const declarativeRules = await ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0]).toStrictEqual({
                id: 1,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.org^',
                    isUrlFilterCaseSensitive: false,
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: 2,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.com^',
                    isUrlFilterCaseSensitive: false,
                },
            });

            const msg = 'After conversion, too many declarative rules remain: '
                + '3 exceeds the limit provided - 2';
            const err = new TooManyRulesError(msg, [2], maxNumberOfRules, 1);

            expect(limitations).toHaveLength(1);
            expect(limitations[0]).toStrictEqual(err);
        });
    });

    describe('checks convert options', () => {
        it('throws error when empty resources path provided', async () => {
            const filter = createFilter(['||example.org^']);
            const resourcesPath = '';
            const convert = async () => {
                await converter.convertStaticRuleSet(filter, { resourcesPath });
            };

            const msg = 'Path to web accessible resources should '
                + `be started with leading slash: ${resourcesPath}`;
            await expect(convert).rejects.toThrow(new ResourcesPathError(msg));
        });

        it('throws error if the resources path started with a slash', async () => {
            const filter = createFilter(['||example.org^']);
            const resourcesPath = 'path';
            const convert = async () => {
                await converter.convertStaticRuleSet(filter, { resourcesPath });
            };

            const msg = 'Path to web accessible resources should '
                + `be started with leading slash: ${resourcesPath}`;
            await expect(convert).rejects.toThrow(new ResourcesPathError(msg));
        });

        it('throws error if the resources path ended with a slash', async () => {
            const filter = createFilter(['||example.org^']);
            const resourcesPath = '/path/';
            const convert = async () => {
                await converter.convertStaticRuleSet(filter, { resourcesPath });
            };

            const msg = 'Path to web accessible resources should '
                + `not be ended with slash: ${resourcesPath}`;
            await expect(convert).rejects.toThrow(new ResourcesPathError(msg));
        });

        it('throws error if the maximum number of rules is equal to or less than 0', async () => {
            const filter = createFilter(['||example.org^']);
            const maxNumberOfRules = 0;
            const convert = async () => {
                await converter.convertStaticRuleSet(filter, { maxNumberOfRules });
            };

            const msg = 'Maximum number of rules cannot be equal or less than 0';
            await expect(convert).rejects.toThrow(new EmptyOrNegativeNumberOfRulesError(msg));
        });

        it('throws error if the maximum number of regexp rules is less than 0', async () => {
            const filter = createFilter(['||example.org^']);
            const maxNumberOfRegexpRules = -1;
            const convert = async () => {
                await converter.convertStaticRuleSet(filter, { maxNumberOfRegexpRules });
            };

            const msg = 'Maximum number of regexp rules cannot be less than 0';
            await expect(convert).rejects.toThrow(new EmptyOrNegativeNumberOfRulesError(msg));
        });
    });

    describe('uses RuleConverter to convert rules to AG syntax', () => {
        it('converts deprecated modifier mp4 to redirect rule', async () => {
            const filter = createFilter(['||example.org^$mp4']);
            const { ruleSet } = await converter.convertStaticRuleSet(
                filter,
                { resourcesPath: '/path/to/resources' },
            );

            const declarativeRules = await ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toStrictEqual({
                id: 1,
                priority: 1101,
                action: {
                    type: 'redirect',
                    redirect: {
                        extensionPath: '/path/to/resources/noopmp4.mp4',
                    },
                },
                condition: {
                    urlFilter: '||example.org^',
                    resourceTypes: ['media'],
                    isUrlFilterCaseSensitive: false,
                },
            });
        });

        it('converts deprecated modifier $empty to redirect rule', async () => {
            const filter = createFilter(['||example.org^$empty']);
            const { ruleSet } = await converter.convertStaticRuleSet(
                filter,
                { resourcesPath: '/path/to/resources' },
            );

            const declarativeRules = await ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toStrictEqual({
                id: 1,
                priority: 1001,
                action: {
                    type: 'redirect',
                    redirect: {
                        extensionPath: '/path/to/resources/nooptext.js',
                    },
                },
                condition: {
                    urlFilter: '||example.org^',
                    isUrlFilterCaseSensitive: false,
                },
            });
        });
    });

    describe('return errors when passed bad rules', () => {
        it('return error for not supported modifier in NetworkRule', async () => {
            const filter = createFilter(['@@$webrtc,domain=example.com']);
            const { ruleSet, errors } = await converter.convertStaticRuleSet(filter);

            const declarativeRules = await ruleSet.getDeclarativeRules();

            // eslint-disable-next-line max-len
            const err = new Error('Error during creating indexed rule with hash: Cannot create IRule from filter "0" and line "0": "Unknown modifier: webrtc" in the rule: "@@$webrtc,domain=example.com"');
            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(1);
            expect(errors[0]).toStrictEqual(err);
        });

        it('return error for not supported modifier in DNR', async () => {
            const modifierName = '$replace';
            const rule = '||example.org^$replace=/X/Y/';
            const filter = createFilter([rule]);
            const { ruleSet, errors } = await converter.convertStaticRuleSet(filter);

            const declarativeRules = await ruleSet.getDeclarativeRules();

            const networkRule = new NetworkRule(rule, 0);

            const err = new UnsupportedModifierError(
                `Unsupported option "${modifierName}" found in the rule: "${rule}"`,
                networkRule,
            );

            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(1);
            expect(errors[0]).toStrictEqual(err);
        });

        it('return error for simultaneously used $to and $denyallow modifiers', async () => {
            const filter = createFilter(['/ads$to=good.org,denyallow=good.com']);
            const { ruleSet, errors } = await converter.convertStaticRuleSet(filter);

            const declarativeRules = await ruleSet.getDeclarativeRules();

            // eslint-disable-next-line max-len
            const err = new Error('Error during creating indexed rule with hash: Cannot create IRule from filter "0" and line "0": "modifier $to is not compatible with $denyallow modifier" in the rule: "/ads$to=good.org,denyallow=good.com"');

            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(1);

            expect(errors[0]).toStrictEqual(err);
        });
    });

    describe('test some edge cases', () => {
        it('use only main_frame or sub_frame for allowAllRequests rules', async () => {
            const rule = '@@||example.com/*/search?*&method=HEAD$xmlhttprequest,document';
            const filter = createFilter([rule]);
            const { ruleSet } = await converter.convertStaticRuleSet(filter);

            const declarativeRules = await ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].action.type).not.toContain(RuleActionType.ALLOW_ALL_REQUESTS);
        });

        it('test allowlist rule with $document, $csp and $domain', async () => {
            const filter = createFilter([
                '@@*$document,csp=worker-src \'none\',domain=new.lewd.ninja',
            ]);
            const { ruleSet, errors } = await converter.convertStaticRuleSet(filter);
            const declarativeRules = await ruleSet.getDeclarativeRules();

            expect(errors).toHaveLength(1);
            expect(declarativeRules).toHaveLength(0);
        });
    });
});
