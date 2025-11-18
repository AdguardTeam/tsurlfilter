import { describe, expect, it } from 'vitest';

import { type DeclarativeRule } from '../../../src/declarative-rule/declarative-rule';
import { HeaderOperation } from '../../../src/declarative-rule/modify-header-info';
import { RuleActionType } from '../../../src/declarative-rule/rule-action';
import { ResourceType } from '../../../src/declarative-rule/rule-condition';
import { isSafeRule } from '../../../src/utils/is-safe-rule';

describe('isSafeRule', () => {
    const createMockRule = (actionType: RuleActionType): DeclarativeRule => ({
        id: 1,
        action: {
            type: actionType,
        },
        condition: {
            urlFilter: 'example.com',
        },
    });

    describe('safe rule actions', () => {
        it('should return true for Block action', () => {
            const rule = createMockRule(RuleActionType.Block);
            expect(isSafeRule(rule)).toBe(true);
        });

        it('should return true for Allow action', () => {
            const rule = createMockRule(RuleActionType.Allow);
            expect(isSafeRule(rule)).toBe(true);
        });

        it('should return true for AllowAllRequests action', () => {
            const rule = createMockRule(RuleActionType.AllowAllRequests);
            expect(isSafeRule(rule)).toBe(true);
        });

        it('should return true for UpgradeScheme action', () => {
            const rule = createMockRule(RuleActionType.UpgradeScheme);
            expect(isSafeRule(rule)).toBe(true);
        });
    });

    describe('unsafe rule actions', () => {
        it('should return false for Redirect action', () => {
            const rule = createMockRule(RuleActionType.Redirect);
            expect(isSafeRule(rule)).toBe(false);
        });

        it('should return false for ModifyHeaders action', () => {
            const rule = createMockRule(RuleActionType.ModifyHeaders);
            expect(isSafeRule(rule)).toBe(false);
        });
    });

    describe('comprehensive coverage', () => {
        it('should handle rules with additional properties', () => {
            const rule: DeclarativeRule = {
                id: 123,
                priority: 5,
                action: {
                    type: RuleActionType.Block,
                },
                condition: {
                    urlFilter: 'example.com',
                    resourceTypes: [ResourceType.MainFrame],
                },
            };
            expect(isSafeRule(rule)).toBe(true);
        });

        it('should handle rules with complex conditions', () => {
            const rule: DeclarativeRule = {
                id: 456,
                action: {
                    type: RuleActionType.Allow,
                },
                condition: {
                    urlFilter: 'trusted.com',
                    domains: ['example.com'],
                    excludedDomains: ['malicious.com'],
                },
            };
            expect(isSafeRule(rule)).toBe(true);
        });

        it('should handle redirect rules with redirect properties', () => {
            const rule: DeclarativeRule = {
                id: 789,
                action: {
                    type: RuleActionType.Redirect,
                    redirect: {
                        url: 'https://safe.com',
                    },
                },
                condition: {
                    urlFilter: 'unsafe.com',
                },
            };
            expect(isSafeRule(rule)).toBe(false);
        });

        it('should handle modify headers rules with header properties', () => {
            const rule: DeclarativeRule = {
                id: 101,
                action: {
                    type: RuleActionType.ModifyHeaders,
                    requestHeaders: [
                        {
                            header: 'User-Agent',
                            operation: HeaderOperation.Set,
                            value: 'Custom-Agent',
                        },
                    ],
                },
                condition: {
                    urlFilter: 'example.com',
                },
            };
            expect(isSafeRule(rule)).toBe(false);
        });
    });
});
