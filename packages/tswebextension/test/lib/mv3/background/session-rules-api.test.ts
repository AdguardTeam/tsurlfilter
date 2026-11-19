import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';

import {
    type DeclarativeRule,
    type IRulesetWithSourceMap,
    RuleActionType,
    TooManyRegexpRulesError,
    TooManyUnsafeRulesError,
} from '@adguard/dnr-converter';

import { SessionRulesApi } from '../../../../src/lib/mv3/background/session-rules-api';

/**
 * Creates the ruleset methods used by SessionRulesApi.
 *
 * @param id Ruleset ID.
 * @param unsafeRules Unsafe DNR rules.
 * @param sourceMap Source rule indexes by declarative rule id.
 *
 * @returns Minimal ruleset mock.
 */
function createRuleset(
    id: string,
    unsafeRules: DeclarativeRule[],
    sourceMap: Record<number, number[]> = {},
): IRulesetWithSourceMap {
    return {
        getId: () => id,
        getUnsafeRules: async () => unsafeRules,
        getSourceRuleIndexes: async (declarativeRuleId: number) => (
            (sourceMap[declarativeRuleId] ?? []).map((sourceRuleIndex) => ({
                sourceRuleIndex,
                filterId: 1,
            }))
        ),
    } as IRulesetWithSourceMap;
}

describe('SessionRulesApi', () => {
    afterEach(() => {
        SessionRulesApi.sourceMapForUnsafeRules.clear();
    });

    it('replaces only CSP rules and preserves other unsafe rules', async () => {
        const oldCspRule = {
            id: 2,
            action: {
                type: RuleActionType.ModifyHeaders,
                responseHeaders: [{
                    header: 'Content-Security-Policy',
                    operation: 'append',
                    value: "script-src 'none'",
                }],
            },
            condition: {},
        } as DeclarativeRule;
        const removeHeaderRule = {
            id: 3,
            action: {
                type: RuleActionType.ModifyHeaders,
                responseHeaders: [{
                    header: 'Set-Cookie',
                    operation: 'remove',
                }],
            },
            condition: {},
        } as DeclarativeRule;
        const rebuiltCspRule: DeclarativeRule = {
            ...oldCspRule,
            id: 4,
            condition: {
                excludedRequestDomains: ['cdn.example.com'],
            },
        };
        const updateSessionRules = vi.fn().mockResolvedValue(undefined);

        chrome.declarativeNetRequest = {
            getSessionRules: vi.fn().mockResolvedValue([]),
            updateSessionRules,
            MAX_NUMBER_OF_SESSION_RULES: 5000,
            MAX_NUMBER_OF_UNSAFE_SESSION_RULES: 5000,
            MAX_NUMBER_OF_REGEX_RULES: 1000,
        } as unknown as typeof chrome.declarativeNetRequest;

        const staticRuleset = createRuleset('ruleset_1', [oldCspRule, removeHeaderRule]);
        const cspRuleset = createRuleset('_csp', []);

        const limitations = await SessionRulesApi.updateSessionRules(
            [staticRuleset],
            undefined,
            [rebuiltCspRule],
            cspRuleset,
        );

        const [{ addRules }] = updateSessionRules.mock.calls[0];
        expect(addRules).toHaveLength(2);
        expect(addRules.map((rule: DeclarativeRule) => rule.action.responseHeaders?.[0].header))
            .toEqual(['Content-Security-Policy', 'Set-Cookie']);
        expect(SessionRulesApi.sourceMapForUnsafeRules.get(7)).toEqual(['_csp', 4]);
        expect(limitations).toEqual([]);
    });

    it('keeps CSP rules of an unreadable static ruleset only', async () => {
        const createCspRule = (id: number, value: string): DeclarativeRule => ({
            id,
            action: {
                type: RuleActionType.ModifyHeaders,
                responseHeaders: [{
                    header: 'Content-Security-Policy',
                    operation: 'append',
                    value,
                }],
            },
            condition: {},
        } as DeclarativeRule);
        // A readable filter is represented in the rebuilt list, a filter whose
        // content could not be read is not, so only the latter keeps its rules.
        const staleReadableCspRule = createCspRule(2, "script-src 'none'");
        const unreadableCspRule = createCspRule(3, "img-src 'self'");
        const rebuiltCspRule = createCspRule(4, "script-src 'self'");
        const updateSessionRules = vi.fn().mockResolvedValue(undefined);

        chrome.declarativeNetRequest = {
            getSessionRules: vi.fn().mockResolvedValue([]),
            updateSessionRules,
            MAX_NUMBER_OF_SESSION_RULES: 5000,
            MAX_NUMBER_OF_UNSAFE_SESSION_RULES: 5000,
            MAX_NUMBER_OF_REGEX_RULES: 1000,
        } as unknown as typeof chrome.declarativeNetRequest;

        await SessionRulesApi.updateSessionRules(
            [
                createRuleset('ruleset_1', [staleReadableCspRule]),
                createRuleset('ruleset_2', [unreadableCspRule]),
            ],
            undefined,
            [rebuiltCspRule],
            createRuleset('_csp', []),
            [2],
        );

        const [{ addRules }] = updateSessionRules.mock.calls[0];
        expect(addRules.map((rule: DeclarativeRule) => rule.action.responseHeaders?.[0].value))
            .toEqual(["script-src 'self'", "img-src 'self'"]);
    });

    it('preserves the previous source map when the browser update fails', async () => {
        const previousSource: [string, number] = ['ruleset_1', 2];
        SessionRulesApi.sourceMapForUnsafeRules.set(7, previousSource);

        chrome.declarativeNetRequest = {
            getSessionRules: vi.fn().mockResolvedValue([{ id: 7 }]),
            updateSessionRules: vi.fn().mockRejectedValue(new Error('Update failed')),
            MAX_NUMBER_OF_SESSION_RULES: 5000,
            MAX_NUMBER_OF_UNSAFE_SESSION_RULES: 5000,
            MAX_NUMBER_OF_REGEX_RULES: 1000,
        } as unknown as typeof chrome.declarativeNetRequest;

        await expect(SessionRulesApi.updateSessionRules([])).rejects.toThrow('Update failed');
        expect(SessionRulesApi.sourceMapForUnsafeRules.get(7)).toEqual(previousSource);
    });

    it('prioritizes rebuilt CSP rules when the unsafe quota is exhausted', async () => {
        const staticRule = {
            id: 2,
            action: { type: RuleActionType.ModifyHeaders },
            condition: {},
        } as DeclarativeRule;
        const cspRule = {
            id: 3,
            action: {
                type: RuleActionType.ModifyHeaders,
                responseHeaders: [{ header: 'Content-Security-Policy', operation: 'append' }],
            },
            condition: {},
        } as DeclarativeRule;
        const updateSessionRules = vi.fn().mockResolvedValue(undefined);

        // Ids 1..6 are reserved for stealth rules, so a quota of 7 holds one
        // unsafe rule and the error must report that reachable count, not the
        // quota.
        const declarativeNetRequest = {
            getSessionRules: vi.fn().mockResolvedValue([]),
            updateSessionRules,
            MAX_NUMBER_OF_SESSION_RULES: 7,
            MAX_NUMBER_OF_UNSAFE_SESSION_RULES: 7,
            MAX_NUMBER_OF_REGEX_RULES: 1000,
        } as unknown as typeof chrome.declarativeNetRequest;
        chrome.declarativeNetRequest = declarativeNetRequest;
        // @ts-expect-error(2540)
        browser.declarativeNetRequest = declarativeNetRequest;

        const limitations = await SessionRulesApi.updateSessionRules(
            [createRuleset('ruleset_1', [staticRule])],
            undefined,
            [cspRule],
            createRuleset('_csp', []),
        );

        const [{ addRules }] = updateSessionRules.mock.calls[0];
        expect(addRules).toHaveLength(1);
        expect(addRules[0].action.responseHeaders?.[0].header).toBe('Content-Security-Policy');

        expect(limitations).toHaveLength(1);
        expect(limitations[0]).toBeInstanceOf(TooManyUnsafeRulesError);
        expect((limitations[0] as TooManyUnsafeRulesError).excludedRulesIds).toEqual([staticRule.id]);
        expect((limitations[0] as TooManyUnsafeRulesError).numberOfMaximumRules).toBe(1);
        expect((limitations[0] as TooManyUnsafeRulesError).numberOfExcludedDeclarativeRules).toBe(1);
    });

    it('reports a limitation when the session regexp quota is exhausted', async () => {
        const regexpRule = {
            id: 2,
            action: { type: RuleActionType.Block },
            condition: { regexFilter: '/ads/' },
        } as DeclarativeRule;
        const updateSessionRules = vi.fn().mockResolvedValue(undefined);

        const declarativeNetRequest = {
            getSessionRules: vi.fn().mockResolvedValue([]),
            updateSessionRules,
            MAX_NUMBER_OF_SESSION_RULES: 5000,
            MAX_NUMBER_OF_UNSAFE_SESSION_RULES: 5000,
            MAX_NUMBER_OF_REGEX_RULES: 0,
        } as unknown as typeof chrome.declarativeNetRequest;
        chrome.declarativeNetRequest = declarativeNetRequest;
        // @ts-expect-error(2540)
        browser.declarativeNetRequest = declarativeNetRequest;

        const limitations = await SessionRulesApi.updateSessionRules(
            [createRuleset('ruleset_1', [regexpRule])],
        );

        const [{ addRules }] = updateSessionRules.mock.calls[0];
        expect(addRules).toHaveLength(0);
        expect(limitations).toHaveLength(1);
        expect(limitations[0]).toBeInstanceOf(TooManyRegexpRulesError);
        expect((limitations[0] as TooManyRegexpRulesError).excludedRulesIds).toEqual([regexpRule.id]);
    });

    it('reports source rule ids of omitted rules of a static ruleset', async () => {
        const staticRule = {
            id: 2,
            action: { type: RuleActionType.ModifyHeaders },
            condition: {},
        } as DeclarativeRule;
        const updateSessionRules = vi.fn().mockResolvedValue(undefined);

        const declarativeNetRequest = {
            getSessionRules: vi.fn().mockResolvedValue([]),
            updateSessionRules,
            MAX_NUMBER_OF_SESSION_RULES: 1,
            MAX_NUMBER_OF_UNSAFE_SESSION_RULES: 1,
            MAX_NUMBER_OF_REGEX_RULES: 1000,
        } as unknown as typeof chrome.declarativeNetRequest;
        chrome.declarativeNetRequest = declarativeNetRequest;
        // @ts-expect-error(2540)
        browser.declarativeNetRequest = declarativeNetRequest;

        const limitations = await SessionRulesApi.updateSessionRules(
            [createRuleset('ruleset_1', [staticRule], { [staticRule.id]: [101, 102] })],
        );

        expect(limitations).toHaveLength(1);
        expect((limitations[0] as TooManyUnsafeRulesError).excludedRulesIds).toEqual([101, 102]);
    });

    it('reports source rule ids of omitted rebuilt CSP rules', async () => {
        const cspRule = {
            id: 3,
            action: {
                type: RuleActionType.ModifyHeaders,
                responseHeaders: [{ header: 'Content-Security-Policy', operation: 'append' }],
            },
            condition: {},
        } as DeclarativeRule;
        const updateSessionRules = vi.fn().mockResolvedValue(undefined);

        const declarativeNetRequest = {
            getSessionRules: vi.fn().mockResolvedValue([]),
            updateSessionRules,
            MAX_NUMBER_OF_SESSION_RULES: 1,
            MAX_NUMBER_OF_UNSAFE_SESSION_RULES: 1,
            MAX_NUMBER_OF_REGEX_RULES: 1000,
        } as unknown as typeof chrome.declarativeNetRequest;
        chrome.declarativeNetRequest = declarativeNetRequest;
        // @ts-expect-error(2540)
        browser.declarativeNetRequest = declarativeNetRequest;

        const limitations = await SessionRulesApi.updateSessionRules(
            [],
            undefined,
            [cspRule],
            createRuleset('_csp', [], { [cspRule.id]: [201] }),
        );

        expect(limitations).toHaveLength(1);
        expect((limitations[0] as TooManyUnsafeRulesError).excludedRulesIds).toEqual([201]);
    });
});
