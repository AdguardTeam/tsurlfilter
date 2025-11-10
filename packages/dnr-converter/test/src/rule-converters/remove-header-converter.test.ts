import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { type DeclarativeRule, HeaderOperation, RuleActionType } from '../../../src/declarative-rule';
import { type NetworkRule } from '../../../src/network-rule';
import { RemoveHeaderConverter } from '../../../src/rule-converters';
import { RuleConverter } from '../../../src/rule-converters/rule-converter';

describe('RemoveHeaderConverter', () => {
    describe('createRuleTemplate', () => {
        it('should create template by removing id, response and request headers', () => {
            // @ts-expect-error Accessing private method for testing purposes
            const template = RemoveHeaderConverter.createRuleTemplate({
                id: 1,
                priority: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: 'Any-Response-Header',
                        operation: HeaderOperation.Remove,
                    }],
                    requestHeaders: [{
                        header: 'Any-Request-Header',
                        operation: HeaderOperation.Remove,
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
                },
            });
        });

        it('should handle rule without response headers', () => {
            // @ts-expect-error Accessing private method for testing purposes
            const template = RemoveHeaderConverter.createRuleTemplate({
                id: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    requestHeaders: [{
                        header: 'Any-Request-Header',
                        operation: HeaderOperation.Remove,
                    }],
                },
            });

            const parsedTemplate = JSON.parse(template);
            expect(parsedTemplate).toEqual({
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                },
            });
        });

        it('should handle rule without request headers', () => {
            // @ts-expect-error Accessing private method for testing purposes
            const template = RemoveHeaderConverter.createRuleTemplate({
                id: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: 'Any-Response-Header',
                        operation: HeaderOperation.Remove,
                    }],
                },
            });

            const parsedTemplate = JSON.parse(template);
            expect(parsedTemplate).toEqual({
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                },
            });
        });

        it('should handle rule without response or request headers', () => {
            // @ts-expect-error Accessing private method for testing purposes
            const template = RemoveHeaderConverter.createRuleTemplate({
                id: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: 'Any-Response-Header',
                        operation: HeaderOperation.Remove,
                    }],
                },
            });

            const parsedTemplate = JSON.parse(template);
            expect(parsedTemplate).toEqual({
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                },
            });
        });
    });

    describe('combineRulePair', () => {
        it('should combine rules with both response and request headers', () => {
            const sourceRule: DeclarativeRule = {
                id: 1,
                priority: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: 'Response-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                    requestHeaders: [{
                        header: 'Request-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                },
            };

            const ruleToMerge: DeclarativeRule = {
                id: 2,
                priority: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [
                        {
                            header: 'Response-Header-2',
                            operation: HeaderOperation.Remove,
                        },
                        {
                            header: 'Response-Header-3',
                            operation: HeaderOperation.Remove,
                        },
                    ],
                    requestHeaders: [
                        {
                            header: 'Request-Header-2',
                            operation: HeaderOperation.Remove,
                        },
                        {
                            header: 'Request-Header-3',
                            operation: HeaderOperation.Remove,
                        },
                    ],
                },
            };

            // @ts-expect-error Accessing private method for testing purposes
            const result = RemoveHeaderConverter.combineRulePair(sourceRule, ruleToMerge);
            expect(result).toEqual({
                id: 1,
                priority: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [
                        {
                            header: 'Response-Header-1',
                            operation: HeaderOperation.Remove,
                        },
                        {
                            header: 'Response-Header-2',
                            operation: HeaderOperation.Remove,
                        },
                        {
                            header: 'Response-Header-3',
                            operation: HeaderOperation.Remove,
                        },
                    ],
                    requestHeaders: [
                        {
                            header: 'Request-Header-1',
                            operation: HeaderOperation.Remove,
                        },
                        {
                            header: 'Request-Header-2',
                            operation: HeaderOperation.Remove,
                        },
                        {
                            header: 'Request-Header-3',
                            operation: HeaderOperation.Remove,
                        },
                    ],
                },
            });

            // Ensure original source rule is not mutated
            expect(result).not.toBe(sourceRule);
            expect(result.action.responseHeaders).not.toBe(sourceRule.action.responseHeaders);
            expect(result.action.responseHeaders).not.toBe(ruleToMerge.action.responseHeaders);
            expect(result.action.responseHeaders![0]).not.toBe(sourceRule.action.responseHeaders![0]);
            expect(result.action.responseHeaders![1]).not.toBe(ruleToMerge.action.responseHeaders![0]);
            expect(result.action.responseHeaders![2]).not.toBe(ruleToMerge.action.responseHeaders![1]);
            expect(result.action.requestHeaders).not.toBe(sourceRule.action.requestHeaders);
            expect(result.action.requestHeaders).not.toBe(ruleToMerge.action.requestHeaders);
            expect(result.action.requestHeaders![0]).not.toBe(sourceRule.action.requestHeaders![0]);
            expect(result.action.requestHeaders![1]).not.toBe(ruleToMerge.action.requestHeaders![0]);
            expect(result.action.requestHeaders![2]).not.toBe(ruleToMerge.action.requestHeaders![1]);
        });

        it('should merge response headers when source rule has no response headers', () => {
            const sourceRule: DeclarativeRule = {
                id: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    requestHeaders: [{
                        header: 'Request-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                },
            };

            const ruleToMerge: DeclarativeRule = {
                id: 2,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: 'Response-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                },
            };

            // @ts-expect-error Accessing private method for testing purposes
            const result = RemoveHeaderConverter.combineRulePair(sourceRule, ruleToMerge);
            expect(result).toEqual({
                id: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: 'Response-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                    requestHeaders: [{
                        header: 'Request-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                },
            });

            // Ensure original source rule is not mutated
            expect(result).not.toBe(sourceRule);
            expect(result.action.responseHeaders).not.toBe(ruleToMerge.action.responseHeaders);
            expect(result.action.responseHeaders![1]).not.toBe(ruleToMerge.action.responseHeaders![0]);
        });

        it('should merge request headers when source rule has no request headers', () => {
            const sourceRule: DeclarativeRule = {
                id: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: 'Response-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                },
            };

            const ruleToMerge: DeclarativeRule = {
                id: 2,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    requestHeaders: [{
                        header: 'Request-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                },
            };

            // @ts-expect-error Accessing private method for testing purposes
            const result = RemoveHeaderConverter.combineRulePair(sourceRule, ruleToMerge);
            expect(result).toEqual({
                id: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: 'Response-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                    requestHeaders: [{
                        header: 'Request-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                },
            });

            // Ensure original source rule is not mutated
            expect(result).not.toBe(sourceRule);
            expect(result.action.requestHeaders).not.toBe(ruleToMerge.action.requestHeaders);
            expect(result.action.requestHeaders![1]).not.toBe(ruleToMerge.action.requestHeaders![0]);
        });

        it('should handle rule to merge with no headers', () => {
            const sourceRule: DeclarativeRule = {
                id: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: 'Response-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                    requestHeaders: [{
                        header: 'Request-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                },
            };

            const ruleToMerge: DeclarativeRule = {
                id: 2,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                },
            };

            // @ts-expect-error Accessing private method for testing purposes
            const result = RemoveHeaderConverter.combineRulePair(sourceRule, ruleToMerge);
            expect(result).toEqual({
                id: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: 'Response-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                    requestHeaders: [{
                        header: 'Request-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                },
            });

            // Ensure original source rule is not mutated
            expect(result).not.toBe(sourceRule);
            expect(result.action.responseHeaders).not.toBe(sourceRule.action.responseHeaders);
            expect(result.action.responseHeaders![0]).not.toBe(sourceRule.action.responseHeaders![0]);
            expect(result.action.requestHeaders).not.toBe(sourceRule.action.requestHeaders);
            expect(result.action.requestHeaders![0]).not.toBe(sourceRule.action.requestHeaders![0]);
        });

        it('should handle source rule with no headers', () => {
            const sourceRule: DeclarativeRule = {
                id: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                },
            };

            const ruleToMerge: DeclarativeRule = {
                id: 2,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: 'Response-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                    requestHeaders: [{
                        header: 'Request-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                },
            };

            // @ts-expect-error Accessing private method for testing purposes
            const result = RemoveHeaderConverter.combineRulePair(sourceRule, ruleToMerge);
            expect(result).toEqual({
                id: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.ModifyHeaders,
                    responseHeaders: [{
                        header: 'Response-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                    requestHeaders: [{
                        header: 'Request-Header-1',
                        operation: HeaderOperation.Remove,
                    }],
                },
            });

            // Ensure original source rule is not mutated
            expect(result).not.toBe(sourceRule);
            expect(result.action.responseHeaders).not.toBe(ruleToMerge.action.responseHeaders);
            expect(result.action.responseHeaders![1]).not.toBe(ruleToMerge.action.responseHeaders![0]);
            expect(result.action.requestHeaders).not.toBe(ruleToMerge.action.requestHeaders);
            expect(result.action.requestHeaders![1]).not.toBe(ruleToMerge.action.requestHeaders![0]);
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
            const removeHeaderConverter = new RemoveHeaderConverter(webAccessibleResourcesPath);

            // @ts-expect-error Accessing private property for testing purposes
            expect(removeHeaderConverter.webAccessibleResourcesPath).toBe(webAccessibleResourcesPath);

            // @ts-expect-error Accessing private method for testing purposes
            const convertRulesSpy = vi.spyOn(removeHeaderConverter, 'convertRules');
            // @ts-expect-error Accessing private method for testing purposes
            const groupConvertedRulesSpy = vi.spyOn(RuleConverter, 'groupConvertedRules');

            const filterListId = 1;
            const rules: NetworkRule[] = [];
            const usedIds = new Set<number>();
            await removeHeaderConverter.convert(filterListId, rules, usedIds);

            expect(convertRulesSpy).toHaveBeenCalledTimes(1);
            expect(convertRulesSpy).toHaveBeenCalledWith(filterListId, rules, usedIds);
            expect(groupConvertedRulesSpy).toHaveBeenCalledTimes(1);
            expect(groupConvertedRulesSpy).toHaveBeenCalledWith(
                expect.anything(),
                // @ts-expect-error Accessing private method for testing purposes
                RemoveHeaderConverter.createRuleTemplate,
                // @ts-expect-error Accessing private method for testing purposes
                RemoveHeaderConverter.combineRulePair,
            );
        });
    });
});
