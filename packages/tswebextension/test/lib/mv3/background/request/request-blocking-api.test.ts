import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';

import { MatchingResult, RequestType } from '@adguard/tsurlfilter';

import { defaultFilteringLog } from '../../../../../src/lib/common/filtering-log';
import { ContentType } from '../../../../../src/lib/common/request-type';
import { RequestBlockingApi } from '../../../../../src/lib/mv3/background/request/request-blocking-api';
import { tabsApi } from '../../../../../src/lib/mv3/tabs/tabs-api';
import { createNetworkRule } from '../../../../helpers/rule-creator';

vi.mock('../../../../../src/lib/common/filtering-log', () => ({
    defaultFilteringLog: {
        publishEvent: vi.fn(),
    },
    FilteringEventType: {
        ApplyBasicRule: 'ApplyBasicRule',
        PopupBlocked: 'PopupBlocked',
    },
}));

vi.mock('../../../../../src/lib/common/utils/rule-text-provider', () => ({
    getRuleTexts: vi.fn(() => ({
        appliedRuleText: '||example.com^$popup',
        originalRuleText: '||example.com^$popup',
    })),
}));

vi.mock('../../../../../src/lib/common/companies-db-service', () => ({
    companiesDbService: {
        match: vi.fn(() => null),
    },
}));

vi.mock('../../../../../src/lib/mv3/tabs/tabs-api', () => ({
    tabsApi: {
        isNewPopupTab: vi.fn(() => false),
        incrementTabBlockedRequestCount: vi.fn(),
    },
}));

vi.mock('../../../../../src/lib/mv3/background/engine-api', () => ({
    engineApi: {
        matchRequest: vi.fn(() => null),
        getOriginalRuleText: vi.fn(() => null),
    },
}));

/**
 * Returns simple data object for {@link RequestBlockingApi.getBlockingResponse} (MV3)
 * with hardcoded values:
 * - `tabId: 1`;
 * - `eventId: '1'`;
 * - `referrerUrl: ''`.
 *
 * Other parameters are passed as arguments.
 *
 * @param rules Rules.
 * @param requestUrl Request url.
 * @param requestType Request type.
 * @param contentType Content type.
 *
 * @returns Data for getBlockingResponse() method.
 */
const makeBlockingResponseParams = (
    rules: string[],
    requestUrl: string,
    requestType: RequestType,
    contentType: ContentType,
): {
    tabId: number;
    eventId: string;
    rule: ReturnType<MatchingResult['getBasicResult']>;
    popupRule: ReturnType<MatchingResult['getPopupRule']>;
    referrerUrl: string;
    requestId: string;
    requestUrl: string;
    requestType: RequestType;
    contentType: ContentType;
} => {
    const result = new MatchingResult(
        rules.map((rule) => createNetworkRule(rule, 0)),
        null,
    );

    return {
        tabId: 1,
        eventId: '1',
        rule: result.getBasicResult(),
        popupRule: result.getPopupRule(),
        referrerUrl: '',
        requestId: '1',
        requestUrl,
        requestType,
        contentType,
    };
};

describe('MV3 RequestBlockingApi - allowlist $popup rule prevents closing the tab', () => {
    let tabsRemoveSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.mocked(tabsApi.isNewPopupTab).mockReturnValue(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tabsRemoveSpy = vi.spyOn(browser.tabs, 'remove' as any).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('blocking basic rule and allowlist popup rule, document request - do not close tab', () => {
        // An allowlist $popup rule unblocks the popup, so a blocking basic
        // rule matched together with it should not close the tab.
        const rules = [
            '||example.com^',
            '@@example.com$popup',
        ];
        const data = makeBlockingResponseParams(
            rules,
            'http://example.com',
            RequestType.Document,
            ContentType.Document,
        );
        const response = RequestBlockingApi.getBlockingResponse(data);
        expect(response).toEqual(undefined);
        expect(tabsRemoveSpy).not.toHaveBeenCalled();
    });

    it('blocking popup rule and allowlist popup rule, document request - do not close tab', () => {
        // The allowlist $popup rule has a higher priority than the blocking
        // one, so the popup should not be closed.
        const rules = [
            '||example.com^$popup',
            '@@example.com$popup',
        ];
        const data = makeBlockingResponseParams(
            rules,
            'http://example.com',
            RequestType.Document,
            ContentType.Document,
        );
        const response = RequestBlockingApi.getBlockingResponse(data);
        expect(response).toEqual(undefined);
        expect(tabsRemoveSpy).not.toHaveBeenCalled();
    });

    it('important blocking popup rule and allowlist popup rule, document request - close tab', () => {
        // The $important blocking $popup rule has a higher priority than the
        // allowlist $popup rule, so the popup should still be closed.
        const rules = [
            '||example.com^$popup,important',
            '@@example.com$popup',
        ];
        const data = makeBlockingResponseParams(
            rules,
            'http://example.com',
            RequestType.Document,
            ContentType.Document,
        );
        const response = RequestBlockingApi.getBlockingResponse(data);
        expect(response).toEqual({ cancel: true });
        expect(tabsRemoveSpy).toHaveBeenCalledTimes(1);
    });
});

describe('MV3 RequestBlockingApi - closeTab publishes PopupBlocked event (AG-3736)', () => {
    let tabsRemoveSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.mocked(tabsApi.isNewPopupTab).mockReturnValue(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tabsRemoveSpy = vi.spyOn(browser.tabs, 'remove' as any).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('publishes PopupBlocked for $popup rule with the real tabId, removes the actual tab', () => {
        const TAB_ID = 42;
        const data = {
            ...makeBlockingResponseParams(
                ['||example.com^$popup'],
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            ),
            tabId: TAB_ID,
        };

        RequestBlockingApi.getBlockingResponse(data);

        // The actual tab should be removed.
        expect(tabsRemoveSpy).toHaveBeenCalledWith(TAB_ID);

        // The filtering log event must be PopupBlocked and carry the real tabId.
        // The consumer (e.g. browser extension) is responsible for attaching it
        // to the background page.
        expect(defaultFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'PopupBlocked',
                data: expect.objectContaining({
                    tabId: TAB_ID,
                }),
            }),
        );
        expect(defaultFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'ApplyBasicRule',
            }),
        );
    });

    it('publishes PopupBlocked for $all rule with the real tabId, removes the actual tab', () => {
        const TAB_ID = 7;
        const data = {
            ...makeBlockingResponseParams(
                ['||example.com^$all'],
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            ),
            tabId: TAB_ID,
        };

        RequestBlockingApi.getBlockingResponse(data);

        expect(tabsRemoveSpy).toHaveBeenCalledWith(TAB_ID);
        expect(defaultFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'PopupBlocked',
                data: expect.objectContaining({
                    tabId: TAB_ID,
                }),
            }),
        );
    });

    it('publishes PopupBlocked for explicit $popup,$document rule with the real tabId, removes the actual tab', () => {
        const TAB_ID = 15;
        const data = {
            ...makeBlockingResponseParams(
                ['||example.com^$popup,document', '||example.com^'],
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            ),
            tabId: TAB_ID,
        };

        RequestBlockingApi.getBlockingResponse(data);

        expect(tabsRemoveSpy).toHaveBeenCalledWith(TAB_ID);
        expect(defaultFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'PopupBlocked',
                data: expect.objectContaining({
                    tabId: TAB_ID,
                }),
            }),
        );
    });

    it('does not publish duplicate PopupBlocked event during redirect race', () => {
        const TAB_ID = 99;
        let resolveRemove: () => void;
        tabsRemoveSpy.mockImplementation(() => new Promise<void>((resolve) => {
            resolveRemove = resolve;
        }));

        const data = {
            ...makeBlockingResponseParams(
                ['||example.com^$popup'],
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            ),
            tabId: TAB_ID,
        };

        RequestBlockingApi.getBlockingResponse(data);
        expect(tabsRemoveSpy).toHaveBeenCalledTimes(1);
        expect(defaultFilteringLog.publishEvent).toHaveBeenCalledTimes(1);

        // Simulate a second onBeforeRequest arriving before tabs.remove resolves.
        RequestBlockingApi.getBlockingResponse(data);
        expect(tabsRemoveSpy).toHaveBeenCalledTimes(1);
        expect(defaultFilteringLog.publishEvent).toHaveBeenCalledTimes(1);

        resolveRemove!();
    });
});
