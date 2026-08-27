import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    type DeclarativeRule,
    HeaderOperation,
    type IRulesetWithSourceMap,
    Rule,
    RuleActionType,
} from '@adguard/dnr-converter';

import { SessionRulesApi } from '../../../../src/lib/mv3/background/session-rules-api';

const { declarativeNetRequest } = vi.hoisted(() => ({
    declarativeNetRequest: {
        MAX_NUMBER_OF_UNSAFE_SESSION_RULES: 5000,
        MAX_NUMBER_OF_REGEX_RULES: 1000,
        getSessionRules: vi.fn(),
        updateSessionRules: vi.fn(),
    },
}));

vi.mock('webextension-polyfill', () => ({
    default: { declarativeNetRequest },
}));

const createRule = (text: string): Rule => {
    const [rule] = Rule.createFromText(1, 0, text);
    return rule;
};

const createDeclarativeCspRule = (value: string): DeclarativeRule => ({
    id: 42,
    priority: 1,
    action: {
        type: RuleActionType.ModifyHeaders,
        responseHeaders: [{
            header: 'Content-Security-Policy',
            operation: HeaderOperation.Append,
            value,
        }],
    },
    condition: {
        resourceTypes: [],
    },
});

const createRuleset = (rule: DeclarativeRule, sourceRules: string[]): IRulesetWithSourceMap => {
    return {
        getId: () => 'ruleset-1',
        getUnsafeRules: vi.fn(async () => [rule]),
        getCspAllowlistRules: () => [],
        getRulesById: vi.fn(async () => sourceRules.map((sourceRule) => ({ sourceRule, filterId: 1 }))),
    } as unknown as IRulesetWithSourceMap;
};

describe('SessionRulesApi', () => {
    beforeEach(() => {
        SessionRulesApi.sourceMapForUnsafeRules.clear();
        vi.clearAllMocks();
        declarativeNetRequest.getSessionRules.mockResolvedValue([]);
        declarativeNetRequest.updateSessionRules.mockResolvedValue(undefined);

        Object.assign(chrome, {
            declarativeNetRequest,
        });
    });

    it('installs only the CSP source value not cancelled by a dynamic exact exception', async () => {
        const ruleset = createRuleset(
            createDeclarativeCspRule("default-src 'self'; script-src 'none'"),
            [
                "||example.com^$csp=default-src 'self'",
                "||example.com^$csp=script-src 'none'",
            ],
        );

        await SessionRulesApi.updateSessionRules(
            [ruleset],
            undefined,
            [createRule("@@||example.com^$csp=script-src 'none'")],
        );

        expect(declarativeNetRequest.updateSessionRules).toHaveBeenCalledWith({
            addRules: [expect.objectContaining({
                id: SessionRulesApi.MIN_DECLARATIVE_RULE_ID + 1,
                action: expect.objectContaining({
                    responseHeaders: [expect.objectContaining({ value: "default-src 'self'" })],
                }),
            })],
            removeRuleIds: [],
        });
        expect(SessionRulesApi.sourceMapForUnsafeRules).toEqual(new Map([
            [SessionRulesApi.MIN_DECLARATIVE_RULE_ID + 1, ['ruleset-1', 42]],
        ]));
    });

    it('adds a dynamic domain exception as a CSP-only request-domain exclusion', async () => {
        const ruleset = createRuleset(
            createDeclarativeCspRule("worker-src 'none'"),
            ["||example.com^$csp=worker-src 'none'"],
        );

        await SessionRulesApi.updateSessionRules(
            [ruleset],
            undefined,
            [createRule('@@||google.com^$csp')],
        );

        expect(declarativeNetRequest.updateSessionRules).toHaveBeenCalledWith({
            addRules: [expect.objectContaining({
                condition: expect.objectContaining({ excludedRequestDomains: ['google.com'] }),
            })],
            removeRuleIds: [],
        });
    });
});
