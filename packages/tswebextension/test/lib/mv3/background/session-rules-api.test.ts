import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';

import { type DeclarativeRule, type IRulesetWithSourceMap, RuleActionType } from '@adguard/dnr-converter';

import { SessionRulesApi } from '../../../../src/lib/mv3/background/session-rules-api';

/**
 * Creates the ruleset methods used by SessionRulesApi.
 *
 * @param id Ruleset ID.
 * @param unsafeRules Unsafe DNR rules.
 *
 * @returns Minimal ruleset mock.
 */
function createRuleset(id: string, unsafeRules: DeclarativeRule[]): IRulesetWithSourceMap {
    return {
        getId: () => id,
        getUnsafeRules: async () => unsafeRules,
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

        await SessionRulesApi.updateSessionRules(
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

        await SessionRulesApi.updateSessionRules(
            [createRuleset('ruleset_1', [staticRule])],
            undefined,
            [cspRule],
            createRuleset('_csp', []),
        );

        const [{ addRules }] = updateSessionRules.mock.calls[0];
        expect(addRules).toHaveLength(1);
        expect(addRules[0].action.responseHeaders?.[0].header).toBe('Content-Security-Policy');
    });
});
