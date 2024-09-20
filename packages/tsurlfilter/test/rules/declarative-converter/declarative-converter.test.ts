import { DeclarativeFilterConverter } from '../../../src/rules/declarative-converter/filter-converter';
import {
    MaxScannedRulesError,
    TooManyRulesError,
} from '../../../src/rules/declarative-converter/errors/limitation-errors';
import {
    EmptyOrNegativeNumberOfRulesError,
    ResourcesPathError,
} from '../../../src/rules/declarative-converter/errors/converter-options-errors';
import { UnsupportedModifierError } from '../../../src/rules/declarative-converter/errors/conversion-errors';
import { RuleActionType } from '../../../src/rules/declarative-converter/declarative-rule';
import {
    EmptyDomainsError,
} from '../../../src/rules/declarative-converter/errors/conversion-errors/empty-domains-error';
import { re2Validator } from '../../../src/rules/declarative-converter/re2-regexp/re2-validator';
import { regexValidatorNode } from '../../../src/rules/declarative-converter/re2-regexp/regex-validator-node';
import { createNetworkRule } from '../../helpers/rule-creator';

import { createFilter } from './helpers';

describe('DeclarativeConverter', () => {
    const converter = new DeclarativeFilterConverter();
    re2Validator.setValidator(regexValidatorNode);

    it('converts simple blocking rule', async () => {
        const filter = createFilter(['||example.org^']);
        const { ruleSet } = await converter.convertStaticRuleSet(filter);
        const declarativeRules = await ruleSet.getDeclarativeRules();

        expect(declarativeRules).toHaveLength(1);
        expect(declarativeRules[0]).toStrictEqual({
            id: expect.any(Number),
            action: { type: 'block' },
            condition: {
                urlFilter: '||example.org^',
            },
            priority: 1,
        });
    });

    it('converts simple blocking regexp rule', async () => {
        const filter = createFilter(['/banner\\d+/$third-party']);
        const { ruleSet } = await converter.convertStaticRuleSet(filter);
        const declarativeRules = await ruleSet.getDeclarativeRules();

        expect(declarativeRules).toHaveLength(1);
        expect(declarativeRules[0]).toEqual({
            id: expect.any(Number),
            action: { type: 'block' },
            condition: {
                regexFilter: 'banner\\d+',
                domainType: 'thirdParty',
            },
            priority: 2,
        });
    });

    it('converts simple blocking regexp rule with ? quantifier', async () => {
        const filter = createFilter(['/aaa?/']);
        const { ruleSet } = await converter.convertStaticRuleSet(filter);
        const declarativeRules = await ruleSet.getDeclarativeRules();

        expect(declarativeRules).toHaveLength(1);
        expect(declarativeRules[0]).toEqual({
            id: expect.any(Number),
            action: { type: 'block' },
            condition: {
                regexFilter: 'aaa?',
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

            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                action: { type: 'block' },
                condition: {
                    urlFilter: '||persistent.com^',
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
                id: expect.any(Number),
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.org^',
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

            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                action: { type: 'block' },
                condition: {
                    urlFilter: '||persistent.com^',
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

            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                action: { type: 'block' },
                condition: {
                    urlFilter: '||persistent.com^',
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

            const content = await staticFilter.getContent();
            const keys = Object.keys(content.sourceMap);
            let id = Number(keys[1]) + 1;

            expect(disableRuleIds[0]).toEqual(id);
            let source = await ruleSet.getRulesById(id);
            expect(source[0].sourceRule).toEqual(ruleToCancel1);

            id = Number(keys[3]) + 1;

            expect(disableRuleIds[1]).toEqual(id);
            source = await ruleSet.getRulesById(id);
            expect(source[0].sourceRule).toEqual(ruleToCancel2);
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

            const content1 = await staticFilter1.getContent();
            let keys = Object.keys(content1.sourceMap);
            let id = Number(keys[1]) + 1;

            expect(disableStatic1.disableRuleIds[0]).toEqual(id);
            let source = await staticRuleSets[0].getRulesById(id);
            expect(source[0].sourceRule).toEqual(ruleToCancel1);

            id = Number(keys[3]) + 1;

            expect(disableStatic1.disableRuleIds[1]).toEqual(id);
            source = await staticRuleSets[0].getRulesById(id);
            expect(source[0].sourceRule).toEqual(ruleToCancel2);

            // Check second static filter.
            expect(disableStatic2.rulesetId).toBe(staticRuleSets[1].getId());

            expect(disableStatic2.disableRuleIds).toHaveLength(1);

            const content2 = await staticFilter2.getContent();
            keys = Object.keys(content2.sourceMap);
            id = Number(keys[2]) + 1;

            expect(disableStatic2.disableRuleIds[0]).toEqual(id);
            source = await staticRuleSets[1].getRulesById(id);
            expect(source[0].sourceRule).toEqual(ruleToCancel3);
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
            id: expect.any(Number),
            priority: 140101,
            action: { type: 'allowAllRequests' },
            condition: {
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

        const content = await filter.getContent();
        const keys = Object.keys(content.sourceMap);
        let id = Number(keys[0]) + 1;

        let sources = await ruleSet.getRulesById(id);
        let originalRules = sources.map(({ sourceRule }) => sourceRule);
        expect(originalRules).toEqual(expect.arrayContaining(rules));

        id = Number(keys[3]) + 1;

        sources = await ruleSet.getRulesById(id);
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

        const badFilterRules = ruleSet.getBadFilterRules();
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
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.org^',
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.com^',
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
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.org^',
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.com^',
                },
            });
            expect(declarativeRules[2]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.net^',
                },
            });
            expect(declarativeRules[3]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.co.uk^',
                },
            });
        });

        it('work with max number of regexp rules', async () => {
            const filter = createFilter([
                '/.s/src/[a-z0-9]*.js/$domain=plasma.3dn.ru',
                '/dbp/pre/$script,third-party',
                '/wind10.ru/w*.js/$domain=wind10.ru',
            ]);

            const { ruleSet } = await converter.convertStaticRuleSet(
                filter,
                { maxNumberOfRules: 2 },
            );
            const declarativeRules = await ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0]).toStrictEqual({
                id: expect.any(Number),
                priority: 201,
                action: { type: 'block' },
                condition: {
                    initiatorDomains: ['plasma.3dn.ru'],
                    regexFilter: '.s/src/[a-z0-9]*.js',
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: expect.any(Number),
                priority: 102,
                action: { type: 'block' },
                condition: {
                    domainType: 'thirdParty',
                    regexFilter: 'dbp/pre',
                    resourceTypes: ['script'],
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
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.org^',
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.com^',
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
                id: expect.any(Number),
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
                id: expect.any(Number),
                priority: 1001,
                action: {
                    type: 'redirect',
                    redirect: {
                        extensionPath: '/path/to/resources/nooptext.js',
                    },
                },
                condition: {
                    urlFilter: '||example.org^',
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
            const err = new Error('Error during creating indexed rule with hash: Cannot create IRule from filter "0" and byte offset "4": "Unknown modifier: webrtc" in the rule: "@@$webrtc,domain=example.com"');
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

            const networkRule = createNetworkRule(rule, 0);

            const err = new UnsupportedModifierError(
                `Unsupported option "${modifierName}"`,
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
            const err = new Error('Error during creating indexed rule with hash: Cannot create IRule from filter "0" and byte offset "4": "modifier $to is not compatible with $denyallow modifier" in the rule: "/ads$to=good.org,denyallow=good.com"');

            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(1);

            expect(errors[0]).toStrictEqual(err);
        });

        it('returns error if initiatorDomains is empty, but original rule has domains', async () => {
            const filter = createFilter(['$script,xmlhttprequest,third-party,domain=clickndownload.*|clicknupload.*']);
            const { ruleSet, errors } = await converter.convertStaticRuleSet(filter);
            const declarativeRules = await ruleSet.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(0); // wildcard domains are not supported
            expect(errors).toHaveLength(1);
            expect(errors[0]).toBeInstanceOf(EmptyDomainsError);
        });
    });

    it('not scan rules which overflow maxNumberOfRules', async () => {
        // Create rule with badfilter to ensure that scanner will increment
        // the number of scanned rules when it finds a canceled rule via badfilter.
        const staticFilterWithBadFilterRule = createFilter([
            '||example.com^$document,badfilter',
        ]);
        const { ruleSet: staticRuleSet } = await converter.convertStaticRuleSet(staticFilterWithBadFilterRule);
        // Combine network rules with cosmetic. Scanner should scan only network
        // rules, because cosmetic rules are not convertible to DNR.
        const rules = [
            'example.com##h1',
            '00kpqkfeek5mdv0cfanrmxocxeboxhas.oodwkuwccnccqeni', // First scanned rule.
            'example.org##h2',
            '||example.com^$document', // Will be ignored negated by $badfilter rule.
            'nmo41ycihw65yvn1wtkt62ty5sx3g8l4.qxgnckpddaslcwir', // Second scanned rule.
            '||example.org^$document', // Will be skipped.
        ];
        const filter = createFilter(rules);
        const maxNumberOfRules = 2;
        const result = await converter.convertDynamicRuleSets(
            [filter],
            [staticRuleSet],
            { maxNumberOfRules },
        );

        const lineIndex = rules.slice(0, rules.length - 1).join('\n').length + 1;
        const msg = `Maximum number of scanned network rules reached at line index ${lineIndex}.`;
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual(new MaxScannedRulesError(msg, lineIndex));
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

        // In old logic we used last rule id from previous filter to calculate
        // the id of the first rule in the next filter (last used plus one).
        // But in some cases it could lead to the same id for different rules,
        // for example when we have grouping rules in the first filter and
        // last converted rule will have not the highest id.
        it('while convert dynamic rules each rule should have unique id', async () => {
            const filter1 = createFilter([
                'example.com', // id = 5
                '||test.com$removeparam=p1', // id = 27
                '||test.com$removeparam=p2', // id = 70
                'example.org', // id = 113
            ], 1);
            // Length of first rule should be equal to = last rule id from filter1 - second last rule id + bytes needed
            // to serialize the rule node (which brings some extra offset, depends on the rule).
            const filter2 = createFilter([
                'm7sk4ubcalu89gp1q1elsulnhslt2vykalsdjfcvkldfncchfcvcc.zsxnbcfidxyhcwhc',
                'bad.rule',
            ], 2);

            const { ruleSet } = await converter.convertDynamicRuleSets([
                filter1, filter2,
            ], []);
            const declarativeRules = await ruleSet.getDeclarativeRules();

            // 5 is because of 2 removeparam rules are converted into 1 declarative rule.
            expect(declarativeRules).toHaveLength(5);

            // Function to bring more human readable error message.
            const checkForUniqueRule = (rules: typeof declarativeRules) => {
                rules.forEach((rule, index) => {
                    for (let i = 0; i < rules.length; i += 1) {
                        if (rule.id === rules[i].id && i !== index) {
                            // eslint-disable-next-line max-len
                            throw new Error(`Rules have the same id: ${JSON.stringify(rule, null, 2)}, ${JSON.stringify(rules[i], null, 2)}`);
                        }
                    }
                });
            };

            expect(() => checkForUniqueRule(declarativeRules)).not.toThrow();
        });
    });
});
