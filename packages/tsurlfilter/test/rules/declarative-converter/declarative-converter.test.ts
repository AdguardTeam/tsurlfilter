import { describe, it, expect } from 'vitest';

import { DeclarativeFilterConverter } from '../../../src/rules/declarative-converter/filter-converter';
import {
    MaxScannedRulesError,
    TooManyRulesError,
    TooManyUnsafeRulesError,
} from '../../../src/rules/declarative-converter/errors/limitation-errors';
import {
    EmptyOrNegativeNumberOfRulesError,
    ResourcesPathError,
} from '../../../src/rules/declarative-converter/errors/converter-options-errors';
import { UnsupportedModifierError } from '../../../src/rules/declarative-converter/errors/conversion-errors';
import { ResourceType, RuleActionType } from '../../../src/rules/declarative-converter/declarative-rule';
import {
    EmptyDomainsError,
} from '../../../src/rules/declarative-converter/errors/conversion-errors/empty-domains-error';
import { re2Validator } from '../../../src/rules/declarative-converter/re2-regexp/re2-validator';
import { regexValidatorNode } from '../../../src/rules/declarative-converter/re2-regexp/regex-validator-node';
import { createNetworkRule } from '../../helpers/rule-creator';

import { createFilter } from './helpers';

const allResourcesTypes = Object.values(ResourceType);

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

            // Sugar for ts linter.
            if (declarativeRulesToCancel === undefined) {
                return;
            }

            expect(declarativeRulesToCancel).toHaveLength(1);
            const { rulesetId } = declarativeRulesToCancel[0];

            expect(rulesetId).toBe(ruleSet.getId());

            const { disableRuleIds } = declarativeRulesToCancel[0];

            expect(disableRuleIds).toHaveLength(2);

            let id = disableRuleIds[0];
            let source = await ruleSet.getRulesById(id);
            expect(source[0].sourceRule).toEqual(ruleToCancel1);

            // eslint-disable-next-line prefer-destructuring
            id = disableRuleIds[1];
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

            const [disableStaticFilter1, disableStaticFilter2] = declarativeRulesToCancel;

            // Check first static filter.
            expect(disableStaticFilter1.rulesetId).toBe(staticRuleSets[0].getId());

            let { disableRuleIds } = disableStaticFilter1;
            expect(disableRuleIds).toHaveLength(2);

            let id = disableRuleIds[0];
            let source = await staticRuleSets[0].getRulesById(id);
            expect(source[0].sourceRule).toEqual(ruleToCancel1);

            // eslint-disable-next-line prefer-destructuring
            id = disableRuleIds[1];
            source = await staticRuleSets[0].getRulesById(id);
            expect(source[0].sourceRule).toEqual(ruleToCancel2);

            // Check second static filter.
            expect(disableStaticFilter2.rulesetId).toBe(staticRuleSets[1].getId());

            disableRuleIds = disableStaticFilter2.disableRuleIds;
            expect(disableRuleIds).toHaveLength(1);

            // eslint-disable-next-line prefer-destructuring
            id = disableRuleIds[0];
            expect(disableStaticFilter2.disableRuleIds[0]).toEqual(id);
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

        const declarativeRules = await ruleSet.getDeclarativeRules();

        // Since we combine removeparam rules into one.
        expect(declarativeRules).toHaveLength(2);

        let sources = await ruleSet.getRulesById(declarativeRules[0].id);
        let originalRules = sources.map(({ sourceRule }) => sourceRule);
        expect(originalRules).toEqual(expect.arrayContaining(rules));

        sources = await ruleSet.getRulesById(declarativeRules[1].id);
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
        expect(badFilterRules[0].rule.rule).toMatchNetworkRule(createNetworkRule(rulesToCancel[0]));
        expect(badFilterRules[1].rule.rule).toMatchNetworkRule(createNetworkRule(rulesToCancel[1]));
    });

    describe('respects limitations for static rulesets', () => {
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

    describe('respects limitations for dynamic rules', () => {
        it('in one filter — safe first', async () => {
            const filter = createFilter([
                '||example1.org^',
                '||example2.org^',
                '||example.com^$removeheader=test',
                '||example.net^$removeheader=test',
            ]);

            const maxNumberOfRules = 4;
            const maxNumberOfUnsafeRules = 1;

            const {
                errors,
                ruleSet,
                limitations,
                declarativeRulesToCancel,
            } = await converter.convertDynamicRuleSets(
                [filter],
                [],
                {
                    maxNumberOfRules,
                    maxNumberOfUnsafeRules,
                },
            );

            expect(ruleSet.getRulesCount()).toStrictEqual(3);
            expect(ruleSet.getUnsafeRulesCount()).toStrictEqual(maxNumberOfUnsafeRules);
            expect(ruleSet.getRegexpRulesCount()).toStrictEqual(0);

            const declarativeRules = await ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(3);
            expect(declarativeRules[0]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example1.org^',
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example2.org^',
                },
            });
            // only one unsafe rule due to the maxNumberOfUnsafeRules limitation
            expect(declarativeRules[2]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'test', operation: 'remove' },
                    ],
                },
                condition: {
                    urlFilter: '||example.com^',
                    resourceTypes: allResourcesTypes,
                },
            });

            expect(errors).toHaveLength(0);
            expect(declarativeRulesToCancel).toHaveLength(0);

            expect(limitations).toHaveLength(1);
            const msg = 'After conversion, too many unsafe rules remain: '
                + `2 exceeds the limit provided - ${maxNumberOfUnsafeRules}`;
            const err = new TooManyUnsafeRulesError(msg, [2], maxNumberOfUnsafeRules, 1);
            expect(limitations[0]).toStrictEqual(err);
        });

        it('in one filter — unsafe first but basic (safe) rules come first after conversion', async () => {
            const filter = createFilter([
                '||example.com^$removeheader=test',
                '||example.net^$removeheader=test',
                '||example1.org^',
                '||example2.org^',
            ]);

            const maxNumberOfRules = 4;
            const maxNumberOfUnsafeRules = 1;

            const {
                errors,
                ruleSet,
                limitations,
                declarativeRulesToCancel,
            } = await converter.convertDynamicRuleSets(
                [filter],
                [],
                {
                    maxNumberOfRules,
                    maxNumberOfUnsafeRules,
                },
            );

            expect(ruleSet.getRulesCount()).toStrictEqual(3);
            expect(ruleSet.getUnsafeRulesCount()).toStrictEqual(maxNumberOfUnsafeRules);
            expect(ruleSet.getRegexpRulesCount()).toStrictEqual(0);

            const declarativeRules = await ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(3);
            // the order of rules are different because they are being sorted during conversion
            expect(declarativeRules[0]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example1.org^',
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example2.org^',
                },
            });
            // only one unsafe rule due to the maxNumberOfUnsafeRules limitation
            expect(declarativeRules[2]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'test', operation: 'remove' },
                    ],
                },
                condition: {
                    urlFilter: '||example.com^',
                    resourceTypes: allResourcesTypes,
                },
            });

            expect(errors).toHaveLength(0);
            expect(declarativeRulesToCancel).toHaveLength(0);

            expect(limitations).toHaveLength(1);

            const actualErr = limitations[0];
            const expectedMsg = 'After conversion, too many unsafe rules remain: '
                + `2 exceeds the limit provided - ${maxNumberOfUnsafeRules}`;
            const expectedErr = new TooManyUnsafeRulesError(expectedMsg, [53], maxNumberOfUnsafeRules, 1);

            expect(actualErr).toStrictEqual(expectedErr);
            expect(actualErr).toBeInstanceOf(TooManyUnsafeRulesError);
            if (actualErr instanceof TooManyUnsafeRulesError) {
                // toStrictEqual checks the structure and type but not the values
                // so values should be checked explicitly
                expect(actualErr.excludedRulesIds).toStrictEqual(expectedErr.excludedRulesIds);
                expect(actualErr.numberOfMaximumRules).toStrictEqual(expectedErr.numberOfMaximumRules);
            }
        });

        it('in one filter — some unsafe rules may not be included', async () => {
            const rules = [
                '||example.com^$removeheader=test',
                '||example.net^$removeheader=test',
                '||example1.org^',
                '||example2.org^',
            ];
            const filter = createFilter(rules);

            const maxNumberOfRules = 3;
            const maxNumberOfUnsafeRules = 2;

            const {
                errors,
                ruleSet,
                limitations,
                declarativeRulesToCancel,
            } = await converter.convertDynamicRuleSets(
                [filter],
                [],
                {
                    maxNumberOfRules,
                    maxNumberOfUnsafeRules,
                },
            );

            expect(ruleSet.getRulesCount()).toStrictEqual(maxNumberOfRules);
            expect(ruleSet.getUnsafeRulesCount()).toStrictEqual(1);
            expect(ruleSet.getRegexpRulesCount()).toStrictEqual(0);

            const declarativeRules = await ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(3);
            // the order of rules are different because they are being sorted during conversion
            expect(declarativeRules[0]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example1.org^',
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example2.org^',
                },
            });
            // only one unsafe rule BUT in this case because of the maxNumberOfRules limitation (3)
            expect(declarativeRules[2]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'test', operation: 'remove' },
                    ],
                },
                condition: {
                    urlFilter: '||example.com^',
                    resourceTypes: allResourcesTypes,
                },
            });

            const lineIndex = rules.slice(0, rules.length - 1).join('\n').length + 1;
            const msg = `Maximum number of scanned network rules reached at line index ${lineIndex}.`;
            expect(errors).toHaveLength(1);
            expect(errors[0]).toEqual(new MaxScannedRulesError(msg, lineIndex));

            expect(declarativeRulesToCancel).toHaveLength(0);

            expect(limitations).toHaveLength(1);

            const actualErr = limitations[0];
            const expectedMsg = 'After conversion, too many declarative rules remain: '
                + `4 exceeds the limit provided - ${maxNumberOfRules}`;
            const expectedErr = new TooManyRulesError(expectedMsg, [53], maxNumberOfRules, 1);

            expect(actualErr).toStrictEqual(expectedErr);
            expect(actualErr).toBeInstanceOf(TooManyRulesError);
            if (actualErr instanceof TooManyRulesError) {
                // toStrictEqual checks the structure and type but not the values
                // so values should be checked explicitly
                expect(actualErr.excludedRulesIds).toStrictEqual(expectedErr.excludedRulesIds);
                expect(actualErr.numberOfMaximumRules).toStrictEqual(expectedErr.numberOfMaximumRules);
            }
        });

        it('in one filter — safe, unsafe, regex limits', async () => {
            const filter = createFilter([
                '||example0.org^',
                '||example1.org^',
                '||example2.org^',
                '||example3.org^',
                '/reg01/$media,third-party',
                '/reg02/$media,third-party',
                '/reg03/$media,third-party',
                '||example.com^$removeheader=test',
                '||example.net^$removeheader=test',
                '||example.org^$removeheader=test',
            ]);

            const maxNumberOfRules = 10;
            const maxNumberOfUnsafeRules = 2;
            const maxNumberOfRegexpRules = 1;

            const { ruleSet } = await converter.convertDynamicRuleSets(
                [filter],
                [],
                {
                    maxNumberOfRules,
                    maxNumberOfUnsafeRules,
                    maxNumberOfRegexpRules,
                },
            );

            expect(ruleSet.getRulesCount()).toStrictEqual(7);
            expect(ruleSet.getUnsafeRulesCount()).toStrictEqual(maxNumberOfUnsafeRules);
            expect(ruleSet.getRegexpRulesCount()).toStrictEqual(maxNumberOfRegexpRules);

            const declarativeRules = await ruleSet.getDeclarativeRules();

            // 2 unsafe + 1 regex + 4 safe (simple basic) rules
            expect(declarativeRules).toHaveLength(7);
            // the order of rules are different because they are being sorted during conversion
            expect(declarativeRules[0]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'test', operation: 'remove' },
                    ],
                },
                condition: {
                    urlFilter: '||example.com^',
                    resourceTypes: allResourcesTypes,
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'test', operation: 'remove' },
                    ],
                },
                condition: {
                    urlFilter: '||example.net^',
                    resourceTypes: allResourcesTypes,
                },
            });
            expect(declarativeRules[2]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example0.org^',
                },
            });
            expect(declarativeRules[3]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example1.org^',
                },
            });
            expect(declarativeRules[4]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example2.org^',
                },
            });
            expect(declarativeRules[5]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example3.org^',
                },
            });
            expect(declarativeRules[6]).toStrictEqual({
                id: expect.any(Number),
                priority: 102,
                action: { type: 'block' },
                condition: {
                    domainType: 'thirdParty',
                    regexFilter: 'reg01',
                    resourceTypes: ['media'],
                },
            });
        });

        it('in one filter — just safe, regex safe, regexp unsafe, just unsafe', async () => {
            const filter = createFilter([
                '||example0.org^',
                '||example1.org^',
                '/r0/$removeheader=test',
                '/r1/$ping',
                '/r2/$subdocument',
                '||example.com^$removeheader=test',
                '||example.net^$removeheader=test',
            ]);

            const maxNumberOfRules = 6;
            const maxNumberOfUnsafeRules = 2;
            const maxNumberOfRegexpRules = 1;

            const { ruleSet } = await converter.convertDynamicRuleSets(
                [filter],
                [],
                {
                    maxNumberOfRules,
                    maxNumberOfUnsafeRules,
                    maxNumberOfRegexpRules,
                },
            );

            expect(ruleSet.getRulesCount()).toStrictEqual(5);
            expect(ruleSet.getUnsafeRulesCount()).toStrictEqual(maxNumberOfUnsafeRules);
            expect(ruleSet.getRegexpRulesCount()).toStrictEqual(maxNumberOfRegexpRules);

            const declarativeRules = await ruleSet.getDeclarativeRules();

            expect(declarativeRules).toHaveLength(5);
            // the order of rules are different because they are being sorted during conversion
            expect(declarativeRules[0]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example0.org^',
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example1.org^',
                },
            });
            expect(declarativeRules[2]).toStrictEqual({
                id: expect.any(Number),
                priority: 101,
                action: { type: 'block' },
                condition: {
                    regexFilter: 'r1',
                    resourceTypes: ['ping'],
                },
            });
            expect(declarativeRules[3]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'test', operation: 'remove' },
                    ],
                },
                condition: {
                    urlFilter: '||example.com^',
                    resourceTypes: allResourcesTypes,
                },
            });
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

        it('dynamic rules - error if the maximum number of unsafe rules less than 0', async () => {
            const filter = createFilter(['||example.org^']);
            const maxNumberOfUnsafeRules = -1;
            const convert = async () => {
                await converter.convertDynamicRuleSets([filter], [], { maxNumberOfUnsafeRules });
            };

            const msg = 'Maximum number of unsafe rules cannot be less than 0';
            await expect(convert).rejects.toThrow(new EmptyOrNegativeNumberOfRulesError(msg));
        });

        it('static ruleset - error if the maximum number of unsafe rules is set at all', async () => {
            const filter = createFilter(['||example.org^']);
            const maxNumberOfUnsafeRules = 0;
            const convert = async () => {
                await converter.convertStaticRuleSet(filter, { maxNumberOfUnsafeRules });
            };

            const msg = 'Static rulesets do not require the maximum number of unsafe rules';
            await expect(convert).rejects.toThrow(new Error(msg));
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

        it('for two same rules inside one filter it generated unique ids', async () => {
            const filter = createFilter([
                '||example.com^',
                '||example.com^',
            ]);
            const { ruleSet } = await converter.convertStaticRuleSet(filter);
            const declarativeRules = await ruleSet.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0].id).not.toEqual(declarativeRules[1].id);
        });

        it('for two same rules inside two filters it generated unique ids', async () => {
            const filter1 = createFilter(['||example.com^']);
            const filter2 = createFilter(['||example.com^']);

            const { ruleSet } = await converter.convertDynamicRuleSets([filter1, filter2], []);

            const declarativeRules = await ruleSet.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0].id).not.toEqual(declarativeRules[1].id);
        });

        it('IDs of rules in the same filter stays the same if text of the rule is the same', async () => {
            const rules = [
                '||example.com^',
                '||example.org^',
                '||example.net^',
            ];
            const filter = createFilter(rules);
            const { ruleSet } = await converter.convertStaticRuleSet(filter);
            const declarativeRules = await ruleSet.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(3);

            // Save ids of the rules to check if they are the same.
            const ids = declarativeRules.map((rule) => rule.id);

            rules[1] = '||example.org^$important';
            rules.push('||new.site^');
            rules.unshift('||another.new.site^');

            const filter2 = createFilter(rules);
            const { ruleSet: ruleSet2 } = await converter.convertStaticRuleSet(filter2);
            const declarativeRules2 = await ruleSet2.getDeclarativeRules();
            expect(declarativeRules2).toHaveLength(5);
            const newIds = declarativeRules2.map((rule) => rule.id);
            // New rule
            expect(ids.includes(newIds[0])).toBe(false);
            // Rule without changes
            expect(newIds[1]).toEqual(ids[0]);
            // Rule with changes - id should be different
            expect(ids.includes(newIds[2])).toBe(false);
            // Rule without changes
            expect(newIds[3]).toEqual(ids[2]);
            // New rule
            expect(ids.includes(newIds[4])).toBe(false);
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

        it('blocking document rule and non-convertible exception generichide', async () => {
            const documentBlockingRule = '||example.org^$document';
            const generichideRule = '@@||example.org^$generichide';

            const filter = createFilter([
                documentBlockingRule,
                generichideRule,
            ]);

            const { ruleSet, declarativeRulesToCancel } = await converter.convertStaticRuleSet(filter);

            const declarativeRules = await ruleSet.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toStrictEqual({
                id: expect.any(Number),
                priority: 101,
                action: {
                    type: 'block',
                },
                condition: {
                    resourceTypes: ['main_frame'],
                    urlFilter: '||example.org^',
                },
            });

            expect(declarativeRulesToCancel).toBeUndefined();
        });
    });
});
