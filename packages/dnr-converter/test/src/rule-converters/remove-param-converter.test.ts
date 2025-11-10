import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { type DeclarativeRule, RuleActionType } from '../../../src/declarative-rule';
import { type NetworkRule } from '../../../src/network-rule';
import { RemoveParamConverter } from '../../../src/rule-converters';
import { RuleConverter } from '../../../src/rule-converters/rule-converter';

describe('RemoveParamConverter', () => {
    describe('createRuleTemplate', () => {
        it('should create template by removing id and remove params', () => {
            // @ts-expect-error Accessing private method for testing purposes
            const template = RemoveParamConverter.createRuleTemplate({
                id: 1,
                priority: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.Redirect,
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: ['param1', 'param2'],
                            },
                        },
                    },
                },
            });

            const parsedTemplate = JSON.parse(template);
            expect(parsedTemplate).toEqual({
                priority: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.Redirect,
                    redirect: {
                        transform: {
                            queryTransform: {},
                        },
                    },
                },
            });
        });

        it('should handle rule without remove params', () => {
            // @ts-expect-error Accessing private method for testing purposes
            const template = RemoveParamConverter.createRuleTemplate({
                id: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.Redirect,
                },
            });

            const parsedTemplate = JSON.parse(template);
            expect(parsedTemplate).toEqual({
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.Redirect,
                },
            });
        });
    });

    describe('combineRulePair', () => {
        it('should combine two rules with remove params', () => {
            const sourceRule: DeclarativeRule = {
                id: 1,
                priority: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.Redirect,
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: ['param1', 'param2'],
                            },
                        },
                    },
                },
            };

            const ruleToMerge: DeclarativeRule = {
                id: 2,
                priority: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.Redirect,
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: ['param3', 'param4'],
                            },
                        },
                    },
                },
            };

            // @ts-expect-error Accessing private method for testing purposes
            const result = RemoveParamConverter.combineRulePair(sourceRule, ruleToMerge);
            expect(result).toEqual({
                id: 1,
                priority: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.Redirect,
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: ['param1', 'param2', 'param3', 'param4'],
                            },
                        },
                    },
                },
            });

            // Ensure original source rule is not mutated
            expect(result).not.toBe(sourceRule);
        });

        it('should ignore if rule to merge has no remove params', () => {
            const sourceRule: DeclarativeRule = {
                id: 1,
                priority: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.Redirect,
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: ['param1', 'param2'],
                            },
                        },
                    },
                },
            };

            const ruleToMerge: DeclarativeRule = {
                id: 2,
                priority: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.Redirect,
                },
            };

            // @ts-expect-error Accessing private method for testing purposes
            const result = RemoveParamConverter.combineRulePair(sourceRule, ruleToMerge);
            expect(result).toEqual({
                id: 1,
                priority: 1,
                condition: {
                    urlFilter: 'example.com',
                },
                action: {
                    type: RuleActionType.Redirect,
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: ['param1', 'param2'],
                            },
                        },
                    },
                },
            });

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
            const removeParamConverter = new RemoveParamConverter(webAccessibleResourcesPath);

            // @ts-expect-error Accessing private property for testing purposes
            expect(removeParamConverter.webAccessibleResourcesPath).toBe(webAccessibleResourcesPath);

            // @ts-expect-error Accessing private method for testing purposes
            const convertRulesSpy = vi.spyOn(removeParamConverter, 'convertRules');
            // @ts-expect-error Accessing private method for testing purposes
            const groupConvertedRulesSpy = vi.spyOn(RuleConverter, 'groupConvertedRules');

            const filterListId = 1;
            const rules: NetworkRule[] = [];
            const usedIds = new Set<number>();
            await removeParamConverter.convert(filterListId, rules, usedIds);

            expect(convertRulesSpy).toHaveBeenCalledTimes(1);
            expect(convertRulesSpy).toHaveBeenCalledWith(filterListId, rules, usedIds);
            expect(groupConvertedRulesSpy).toHaveBeenCalledTimes(1);
            expect(groupConvertedRulesSpy).toHaveBeenCalledWith(
                expect.anything(),
                // @ts-expect-error Accessing private method for testing purposes
                RemoveParamConverter.createRuleTemplate,
                // @ts-expect-error Accessing private method for testing purposes
                RemoveParamConverter.combineRulePair,
            );
        });
    });
});
