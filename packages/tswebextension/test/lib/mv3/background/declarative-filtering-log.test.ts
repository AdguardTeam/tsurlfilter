import {
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { type HTTPMethod } from '@adguard/tsurlfilter';

import { defaultFilteringLog, FilteringEventType } from '../../../../src/lib/common/filtering-log';
import { type ContentType } from '../../../../src/lib/common/request-type';
import { requestContextStorage } from '../../../../src/lib/mv3/background/request/request-context-storage';
import { declarativeFilteringLog } from '../../../../src/lib/mv3/background/declarative-filtering-log';

// Counter for generating unique nanoid values in tests.
let nanoidCounter = 0;

vi.mock('../../../../src/lib/common/utils/nanoid', () => ({
    nanoid: (): string => {
        nanoidCounter += 1;
        return `synthetic-${nanoidCounter}`;
    },
}));

vi.mock('../../../../src/lib/common/filtering-log', () => ({
    defaultFilteringLog: {
        publishEvent: vi.fn(),
    },
    FilteringEventType: {
        SendRequest: 'sendRequest',
        MatchedDeclarativeRule: 'matchedDeclarativeRule',
    },
}));

vi.mock('../../../../src/lib/common/utils/logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/request/request-context-storage', () => ({
    requestContextStorage: {
        get: vi.fn(),
        update: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/session-rules-api', () => ({
    SessionRulesApi: {
        MIN_DECLARATIVE_RULE_ID: 1000000,
        sourceMapForUnsafeRules: new Map(),
    },
}));

/**
 * Creates a minimal request context for testing.
 *
 * @param overrides Partial context to override defaults.
 *
 * @returns Mocked request context.
 */
const createContext = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    eventId: 'existing-event-id',
    tabId: 1,
    requestUrl: 'https://example.com/?a=1&b=2&c=3',
    referrerUrl: 'https://referrer.com/',
    contentType: 'document' as unknown as ContentType,
    timestamp: 1000,
    thirdParty: false,
    method: 'GET' as HTTPMethod,
    ...overrides,
});

/**
 * Creates a MatchedRuleInfoDebug record for testing.
 *
 * @param requestId Request id.
 * @param url URL at which the rule matched.
 * @param ruleId DNR rule id.
 * @param rulesetId Ruleset id.
 *
 * @returns Chrome MatchedRuleInfoDebug record.
 */
const createRecord = (
    requestId: string,
    url: string,
    ruleId: number,
    rulesetId = '_dynamic',
): chrome.declarativeNetRequest.MatchedRuleInfoDebug => ({
    request: {
        requestId,
        url,
        tabId: 1,
        type: 'main_frame' as chrome.declarativeNetRequest.ResourceType,
        initiator: 'https://referrer.com/',
        method: 'GET',
        frameId: 0,
        partentFrameId: -1,
    },
    rule: {
        ruleId,
        rulesetId,
    },
});

/**
 * Helper to call the private logMatchedRule method.
 *
 * @param record MatchedRuleInfoDebug record.
 *
 * @returns Promise from logMatchedRule.
 */
const callLogMatchedRule = (
    record: chrome.declarativeNetRequest.MatchedRuleInfoDebug,
): Promise<void> => {
    // logMatchedRule is private but bound in the constructor;
    // access it directly for testing.
    return (declarativeFilteringLog as any).logMatchedRule(record);
};

describe('DeclarativeFilteringLog.logMatchedRule', () => {
    beforeAll(() => {
        // Ensure chrome.declarativeNetRequest is available in the test env.
        global.chrome = {
            ...global.chrome,
            declarativeNetRequest: {
                ...((global.chrome as any)?.declarativeNetRequest ?? {}),
                SESSION_RULESET_ID: '_session',
            },
        } as any;
    });

    beforeEach(() => {
        vi.clearAllMocks();
        nanoidCounter = 0;

        // Default: getRuleInfo resolves to a simple declarative rule info.
        (declarativeFilteringLog as any).sourceRulesets = [{
            getId: (): string => '_dynamic',
            getRulesById: vi.fn(async () => [{ sourceRule: '||example.com^$removeparam=a', filterId: 0 }]),
            getDeclarativeRules: vi.fn(async () => [{ id: 100, action: { type: 'redirect' } }]),
        }];
    });

    it('publishes MatchedDeclarativeRule with existing eventId when URLs match', async () => {
        const context = createContext({
            requestUrl: 'https://example.com/?a=1&b=2&c=3',
        });
        vi.mocked(requestContextStorage.get).mockReturnValue(context as any);

        const record = createRecord('768', 'https://example.com/?a=1&b=2&c=3', 100);

        await callLogMatchedRule(record);

        // Should NOT publish a synthetic SendRequest.
        const { calls } = vi.mocked(defaultFilteringLog.publishEvent).mock;
        const [[publishEvent]] = calls;
        expect(calls).toHaveLength(1);
        expect(publishEvent).toEqual({
            type: FilteringEventType.MatchedDeclarativeRule,
            data: {
                eventId: 'existing-event-id',
                tabId: 1,
                declarativeRuleInfo: expect.any(Object),
            },
        });

        // Should NOT update requestContextStorage.
        expect(requestContextStorage.update).not.toHaveBeenCalled();
    });

    it('publishes synthetic SendRequest + MatchedDeclarativeRule when URLs differ', async () => {
        const context = createContext({
            requestUrl: 'https://example.com/?a=1&b=2&c=3',
        });
        vi.mocked(requestContextStorage.get).mockReturnValue(context as any);

        // The matched URL has one fewer param — Chrome skipped onBeforeRequest.
        const record = createRecord('768', 'https://example.com/?b=2&c=3', 100);

        await callLogMatchedRule(record);

        const { calls } = vi.mocked(defaultFilteringLog.publishEvent).mock;
        const [[firstEvent], [secondEvent]] = calls;
        expect(calls).toHaveLength(2);

        // First call: synthetic SendRequest.
        expect(firstEvent).toMatchObject({
            type: FilteringEventType.SendRequest,
            data: {
                tabId: 1,
                eventId: 'synthetic-1',
                requestUrl: 'https://example.com/?b=2&c=3',
                frameUrl: 'https://referrer.com/',
                timestamp: 1000,
                requestThirdParty: false,
                method: 'GET',
            },
        });

        // Second call: MatchedDeclarativeRule with the new eventId.
        expect(secondEvent).toEqual({
            type: FilteringEventType.MatchedDeclarativeRule,
            data: {
                eventId: 'synthetic-1',
                tabId: 1,
                declarativeRuleInfo: expect.any(Object),
            },
        });
    });

    it('updates requestContextStorage after synthetic event', async () => {
        const context = createContext({
            requestUrl: 'https://example.com/?a=1&b=2&c=3',
        });
        vi.mocked(requestContextStorage.get).mockReturnValue(context as any);

        const record = createRecord('768', 'https://example.com/?b=2&c=3', 100);

        await callLogMatchedRule(record);

        expect(requestContextStorage.update).toHaveBeenCalledWith('768', {
            eventId: 'synthetic-1',
            requestUrl: 'https://example.com/?b=2&c=3',
        });
    });

    it('handles chain of 4 rules with progressive URL stripping', async () => {
        // Simulate: Chrome fires onBeforeRequest twice (hops 1-2),
        // then onRuleMatchedDebug fires for all 4 rules.
        // Rules 1-2 have matching URLs, rules 3-4 have mismatched URLs.

        const baseUrl = 'https://example.com/page';
        const url3Params = `${baseUrl}?b=2&c=3&d=4`;
        const url2Params = `${baseUrl}?c=3&d=4`;
        const url1Param = `${baseUrl}?d=4`;

        // After 2 onBeforeRequest calls, context has the 2nd hop URL.
        const context = createContext({ requestUrl: url3Params });
        vi.mocked(requestContextStorage.get).mockReturnValue(context as any);

        // Provide 4 rulesets for getRulesById resolution.
        (declarativeFilteringLog as any).sourceRulesets = [{
            getId: (): string => '_dynamic',
            getRulesById: vi.fn(async (id: number) => [{
                sourceRule: `||example.com^$removeparam=rule${id}`,
                filterId: 0,
            }]),
            getDeclarativeRules: vi.fn(async () => [
                { id: 101, action: { type: 'redirect' } },
                { id: 102, action: { type: 'redirect' } },
                { id: 103, action: { type: 'redirect' } },
                { id: 104, action: { type: 'redirect' } },
            ]),
        }];

        // Rule 2: URL matches context (3 params) — no synthetic event.
        await callLogMatchedRule(createRecord('768', url3Params, 102));

        // Rule 3: URL has 2 params but context still has 3 — mismatch → synthetic.
        await callLogMatchedRule(createRecord('768', url2Params, 103));

        // After rule 3, context was updated to url2Params.
        // Rule 4: URL has 1 param but context now has 2 — mismatch → synthetic.
        // We need to return the updated context for rule 4.
        vi.mocked(requestContextStorage.get).mockReturnValue(
            createContext({ requestUrl: url2Params, eventId: 'synthetic-1' }) as any,
        );
        await callLogMatchedRule(createRecord('768', url1Param, 104));

        const { calls } = vi.mocked(defaultFilteringLog.publishEvent).mock;
        const [
            [rule2Event],
            [rule3SendRequestEvent],
            [rule3MatchedRuleEvent],
            [rule4SendRequestEvent],
            [rule4MatchedRuleEvent],
        ] = calls;

        // Rule 2: 1 MatchedDeclarativeRule (no synthetic).
        // Rule 3: 1 SendRequest + 1 MatchedDeclarativeRule.
        // Rule 4: 1 SendRequest + 1 MatchedDeclarativeRule.
        expect(calls).toHaveLength(5);

        // Rule 2: MatchedDeclarativeRule with existing eventId.
        expect(rule2Event).toMatchObject({
            type: FilteringEventType.MatchedDeclarativeRule,
            data: { eventId: 'existing-event-id' },
        });

        // Rule 3: synthetic SendRequest.
        expect(rule3SendRequestEvent).toMatchObject({
            type: FilteringEventType.SendRequest,
            data: { eventId: 'synthetic-1', requestUrl: url2Params },
        });

        // Rule 3: MatchedDeclarativeRule with synthetic eventId.
        expect(rule3MatchedRuleEvent).toMatchObject({
            type: FilteringEventType.MatchedDeclarativeRule,
            data: { eventId: 'synthetic-1' },
        });

        // Rule 4: synthetic SendRequest.
        expect(rule4SendRequestEvent).toMatchObject({
            type: FilteringEventType.SendRequest,
            data: { eventId: 'synthetic-2', requestUrl: url1Param },
        });

        // Rule 4: MatchedDeclarativeRule with synthetic eventId.
        expect(rule4MatchedRuleEvent).toMatchObject({
            type: FilteringEventType.MatchedDeclarativeRule,
            data: { eventId: 'synthetic-2' },
        });

        // Verify requestContextStorage.update was called for both synthetic events.
        expect(requestContextStorage.update).toHaveBeenCalledTimes(2);
        expect(requestContextStorage.update).toHaveBeenCalledWith('768', {
            eventId: 'synthetic-1',
            requestUrl: url2Params,
        });
        expect(requestContextStorage.update).toHaveBeenCalledWith('768', {
            eventId: 'synthetic-2',
            requestUrl: url1Param,
        });
    });

    it('does not emit synthetic event when context is missing', async () => {
        vi.mocked(requestContextStorage.get).mockReturnValue(undefined);

        const record = createRecord('999', 'https://example.com/', 100);

        await callLogMatchedRule(record);

        expect(defaultFilteringLog.publishEvent).not.toHaveBeenCalled();
    });
});
