import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CSP_HEADER_NAME } from '../../../src/constants';
import { type DeclarativeRule, HeaderOperation, RuleActionType } from '../../../src/declarative-rule';
import { type NetworkRule } from '../../../src/network-rule';
import { CspConverter } from '../../../src/rule-converters';
import { RuleConverter } from '../../../src/rule-converters/rule-converter';

describe('CspConverter', () => {
    describe('createRuleTemplate', () => {
        it('should create template by removing id and CSP header value', () => {
            // @ts-expect-error Accessing private method for testing purposes
            const template = CspConverter.createRuleTemplate({
                id: 1,
                priority: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: HeaderOperation.Append,
                        value: 'script-src \'self\'',
                    }],
                },
            });

            const parsedTemplate = JSON.parse(template);
            expect(parsedTemplate).toEqual({
                priority: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: HeaderOperation.Append,
                    }],
                },
            });
        });

        it('should handle rule without response headers', () => {
            // @ts-expect-error Accessing private method for testing purposes
            const template = CspConverter.createRuleTemplate({
                id: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.Block,
                },
            });

            const parsedTemplate = JSON.parse(template);
            expect(parsedTemplate).toEqual({
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.Block,
                },
            });
        });
    });

    describe('isCspHeader', () => {
        it('should return true for CSP header', () => {
            // @ts-expect-error Accessing private method for testing purposes
            const result = CspConverter.isCspHeader({
                header: CSP_HEADER_NAME,
                operation: HeaderOperation.Append,
                value: 'script-src \'self\'',
            });
            expect(result).toBe(true);
        });

        it('should return false for non-CSP header', () => {
            // @ts-expect-error Accessing private method for testing purposes
            const result = CspConverter.isCspHeader({
                header: 'X-Custom-Header',
                operation: HeaderOperation.Set,
                value: 'custom-value',
            });
            expect(result).toBe(false);
        });
    });

    describe('combineRulePair', () => {
        it('should combine two CSP rules by merging header values', () => {
            const sourceRule: DeclarativeRule = {
                id: 1,
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: HeaderOperation.Append,
                        value: 'script-src \'self\'',
                    }],
                },
                condition: { urlFilter: 'example.com' },
            };

            const ruleToMerge: DeclarativeRule = {
                id: 2,
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: HeaderOperation.Append,
                        value: 'style-src \'unsafe-inline\'',
                    }],
                },
                condition: { urlFilter: 'example.com' },
            };

            // @ts-expect-error Accessing private method for testing purposes
            const result = CspConverter.combineRulePair(sourceRule, ruleToMerge);
            expect(result).toEqual({
                id: 1,
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: HeaderOperation.Append,
                        value: 'script-src \'self\'; style-src \'unsafe-inline\'',
                    }],
                },
                condition: { urlFilter: 'example.com' },
            });

            // Ensure original source rule is not mutated
            expect(result).not.toBe(sourceRule);
        });

        it('should set value when source rule has no CSP value', () => {
            const sourceRule: DeclarativeRule = {
                id: 1,
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: HeaderOperation.Append,
                    }],
                },
                condition: { urlFilter: 'example.com' },
            };

            const ruleToMerge: DeclarativeRule = {
                id: 2,
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: HeaderOperation.Append,
                        value: 'script-src \'self\'',
                    }],
                },
                condition: { urlFilter: 'example.com' },
            };

            // @ts-expect-error Accessing private method for testing purposes
            const result = CspConverter.combineRulePair(sourceRule, ruleToMerge);
            expect(result).toEqual({
                id: 1,
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: HeaderOperation.Append,
                        value: 'script-src \'self\'',
                    }],
                },
                condition: { urlFilter: 'example.com' },
            });

            // Ensure original source rule is not mutated
            expect(result).not.toBe(sourceRule);
        });

        it('should add CSP header when source rule has no response headers', () => {
            const sourceRule: DeclarativeRule = {
                id: 1,
                action: {
                    type: RuleActionType.ModifyHeaders,
                },
                condition: { urlFilter: 'example.com' },
            };

            const ruleToMerge: DeclarativeRule = {
                id: 2,
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: HeaderOperation.Append,
                        value: 'script-src \'self\'',
                    }],
                },
                condition: { urlFilter: 'example.com' },
            };

            // @ts-expect-error Accessing private method for testing purposes
            const result = CspConverter.combineRulePair(sourceRule, ruleToMerge);
            expect(result).toEqual({
                id: 1,
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: HeaderOperation.Append,
                        value: 'script-src \'self\'',
                    }],
                },
                condition: { urlFilter: 'example.com' },
            });

            // Ensure original source rule is not mutated
            expect(result).not.toBe(sourceRule);
            expect(result.action.responseHeaders).not.toBe(sourceRule.action.responseHeaders);
            expect(result.action.responseHeaders![0]).not.toBe(ruleToMerge.action.responseHeaders![0]);
        });

        it('should return unchanged rule when rule to merge has no headers', () => {
            const sourceRule: DeclarativeRule = {
                id: 1,
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: HeaderOperation.Append,
                        value: 'script-src \'self\'',
                    }],
                },
                condition: { urlFilter: 'example.com' },
            };

            const ruleToMerge: DeclarativeRule = {
                id: 2,
                action: {
                    type: RuleActionType.ModifyHeaders,
                },
                condition: { urlFilter: 'example.com' },
            };

            // @ts-expect-error Accessing private method for testing purposes
            const result = CspConverter.combineRulePair(sourceRule, ruleToMerge);
            expect(result).toEqual(sourceRule);

            // Ensure original source rule is not mutated
            expect(result).not.toBe(sourceRule);
        });

        it('should return unchanged rule when rule to merge has no CSP header', () => {
            const sourceRule: DeclarativeRule = {
                id: 1,
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: HeaderOperation.Append,
                        value: 'script-src \'self\'',
                    }],
                },
                condition: { urlFilter: 'example.com' },
            };

            const ruleToMerge: DeclarativeRule = {
                id: 2,
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: 'X-Custom-Header',
                        operation: HeaderOperation.Set,
                        value: 'custom-value',
                    }],
                },
                condition: { urlFilter: 'example.com' },
            };

            // @ts-expect-error Accessing private method for testing purposes
            const result = CspConverter.combineRulePair(sourceRule, ruleToMerge);
            expect(result).toEqual(sourceRule);

            // Ensure original source rule is not mutated
            expect(result).not.toBe(sourceRule);
        });

        it('should return unchanged rule when source rule has no CSP header', () => {
            const sourceRule: DeclarativeRule = {
                id: 1,
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: 'X-Custom-Header',
                        operation: HeaderOperation.Set,
                        value: 'custom-value',
                    }],
                },
                condition: { urlFilter: 'example.com' },
            };

            const ruleToMerge: DeclarativeRule = {
                id: 2,
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: HeaderOperation.Append,
                        value: 'script-src \'self\'',
                    }],
                },
                condition: { urlFilter: 'example.com' },
            };

            // @ts-expect-error Accessing private method for testing purposes
            const result = CspConverter.combineRulePair(sourceRule, ruleToMerge);
            expect(result).toEqual(sourceRule);

            // Ensure original source rule is not mutated
            expect(result).not.toBe(sourceRule);
        });
    });

    /**
     * Note: We don't actually test convert method logic here,
     * as it is inherited from the parent RuleConverter class,
     * and tested in `rule-converter.test.ts`.
     */
    describe('convert', () => {
        it('should use parent class methods', async () => {
            const webAccessibleResourcesPath = '/war';
            const cspConverter = new CspConverter(webAccessibleResourcesPath);

            // @ts-expect-error Accessing private property for testing purposes
            expect(cspConverter.webAccessibleResourcesPath).toBe(webAccessibleResourcesPath);

            // @ts-expect-error Accessing private method for testing purposes
            const convertRulesSpy = vi.spyOn(cspConverter, 'convertRules');
            // @ts-expect-error Accessing private method for testing purposes
            const groupConvertedRulesSpy = vi.spyOn(RuleConverter, 'groupConvertedRules');

            const filterListId = 1;
            const rules: NetworkRule[] = [];
            const usedIds = new Set<number>();
            await cspConverter.convert(filterListId, rules, usedIds);

            expect(convertRulesSpy).toHaveBeenCalledTimes(1);
            expect(convertRulesSpy).toHaveBeenCalledWith(filterListId, rules, usedIds);
            expect(groupConvertedRulesSpy).toHaveBeenCalledTimes(1);
            expect(groupConvertedRulesSpy).toHaveBeenCalledWith(
                expect.anything(),
                // @ts-expect-error Accessing private method for testing purposes
                CspConverter.createRuleTemplate,
                // @ts-expect-error Accessing private method for testing purposes
                CspConverter.combineRulePair,
            );
        });
    });
});
